/* ===== Estrutura: editar e reorganizar =====
   Editar: o nome de cliente, projeto, produto, aplicação ou frente (e a plataforma da aplicação e a origem do projeto), pelo ⋯ da linha.
   Reorganizar: arrastar uma linha da Estrutura e soltar acima ou abaixo de outra do mesmo nível e do mesmo pai.
   A ordem vai para o campo ordem da tabela nos (parte 01 do banco), que o carregamento já usa para montar a árvore. */
const ES_LISTA = {client:'clients', project:'projects', product:'products', app:'apps', ws:'ws'};
const ES_NOME = {client:'cliente', project:'projeto', product:'produto', app:'aplicação', ws:'frente de trabalho'};
// quem são os irmãos: o mesmo pai na árvore (a aplicação pode estar num produto ou direto no projeto)
const esPai = (tipo, o) => tipo === 'client' ? '' : tipo === 'project' ? o.client : tipo === 'product' ? o.project : tipo === 'app' ? o.project + '|' + (o.product || '') : o.app;

function esEditar(chave){
  const [tipo] = chave.split(':'), o = tfObjNo(chave); if (!o || !podeEditar()) return;
  const extra = tipo === 'app' ? '<label class="lb">Plataforma<select class="sel" id="es-p">' + [['web','Web'],['desktop','Desktop'],['mobile','Celular']].map(([k, n]) => '<option value="' + k + '"' + ((o.plataforma || 'web') === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>'
    : tipo === 'project' ? '<label class="lb">Origem<select class="sel" id="es-o"><option value="greenfield"' + (o.origem !== 'brownfield' ? ' selected' : '') + '>Greenfield · do zero</option><option value="brownfield"' + (o.origem === 'brownfield' ? ' selected' : '') + '>Brownfield · já em andamento</option></select></label>' : '';
  modal('Editar ' + ES_NOME[tipo], '<div class="grade-form"><label class="lb largo">Nome<input class="campo" id="es-n" maxlength="160" value="' + esc(o.nome) + '"></label>' + extra + '</div>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Salvar', acao:d => {
      const n = $('#es-n', d).value.trim(); if (!n){ toast('Escreva o nome'); return false; }
      const p = $('#es-p', d), og = $('#es-o', d);
      o.nome = n; if (p) o.plataforma = p.value; if (og) o.origem = og.value;
      salvar(); render(); toast('Salvo');
    }}]);
  const dlg = document.querySelector('dialog.modal:last-of-type'), inp = dlg && $('#es-n', dlg);
  if (inp){ inp.focus(); inp.select(); inp.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); const b = dlg.querySelector('.modal-rod .btn:not(.sec)'); if (b) b.click(); } }); }
}

/* ---------- arrastar e soltar na Estrutura ---------- */
const _arvoreHTMLEs = arvoreHTML;
arvoreHTML = function(){
  const h = _arvoreHTMLEs(); if (!podeEditar()) return h;
  return h.replace(/(<div class="no-arv[^"]*" data-no="[^"]+")/g, '$1 draggable="true"');
};
const ES = {arr:null};
const esLinha = e => e.target.closest && e.target.closest('.ops-arvore .no-arv[data-no]');
const esLimpar = () => document.querySelectorAll('.ops-arvore .es-antes, .ops-arvore .es-depois, .ops-arvore .es-arrastando').forEach(n => n.classList.remove('es-antes', 'es-depois', 'es-arrastando'));
function esPodeSoltar(de, em){
  if (!de || !em || de === em) return false;
  const [t1] = de.split(':'), [t2] = em.split(':'); if (t1 !== t2) return false;
  const a = tfObjNo(de), b = tfObjNo(em); return !!(a && b) && esPai(t1, a) === esPai(t2, b);
}
document.addEventListener('dragstart', e => {
  const l = esLinha(e); if (!l || !podeEditar()) return;
  ES.arr = l.dataset.no; l.classList.add('es-arrastando');
  e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', ES.arr); } catch(x){}
});
document.addEventListener('dragover', e => {
  if (!ES.arr) return;
  const l = esLinha(e);
  document.querySelectorAll('.ops-arvore .es-antes, .ops-arvore .es-depois').forEach(n => { if (n !== l) n.classList.remove('es-antes', 'es-depois'); });
  if (!l || !esPodeSoltar(ES.arr, l.dataset.no)) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  const r = l.getBoundingClientRect(), antes = e.clientY < r.top + r.height / 2;
  l.classList.toggle('es-antes', antes); l.classList.toggle('es-depois', !antes);
});
document.addEventListener('drop', e => {
  if (!ES.arr) return;
  const l = esLinha(e), de = ES.arr; ES.arr = null;
  if (!l || !esPodeSoltar(de, l.dataset.no)){ esLimpar(); return; }
  e.preventDefault();
  const antes = l.classList.contains('es-antes'), em = l.dataset.no; esLimpar();
  const [tipo] = de.split(':');
  tfComDesfazer(tfObjNo(de).nome + ' mudou de lugar.', () => {
    const a2 = tfObjNo(de), b2 = tfObjNo(em), l2 = D[ES_LISTA[tipo]];
    l2.splice(l2.indexOf(a2), 1);
    l2.splice(l2.indexOf(b2) + (antes ? 0 : 1), 0, a2);
    // renumera todos os irmãos, para a ordem ficar igual depois de recarregar
    const pai = esPai(tipo, a2); let k = 0; l2.forEach(x => { if (esPai(tipo, x) === pai) x.ordem = k++; });
  });
});
document.addEventListener('dragend', () => { ES.arr = null; esLimpar(); });
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {esEditar, linhasDaTela});
