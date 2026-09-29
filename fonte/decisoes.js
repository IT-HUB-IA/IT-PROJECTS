/* ===== Decisões que vão para a ficha técnica =====
   Um item de decisão (por exemplo "Escolher o banco de dados") pode ser ligado a um campo da ficha técnica do projeto
   (por exemplo Database › Banco e schema). O texto da decisão fica num lugar só, o campo da ficha:
   escrever no item muda a ficha, escrever na ficha muda o item, e aplicações e produtos do projeto herdam como sempre.
   A ligação fica na própria ficha do projeto, na chave "_decisao|Seção›Campo" com o id do item (grava em ficha_campos,
   sem mudar o banco). O item mostra a ligação no cartão Principal e o campo da ficha mostra de qual item veio. */
const DC_PREFIXO = '_decisao|';
const dcChave = (sec, campo) => DC_PREFIXO + sec + '›' + campo;
function dcProjeto(i){ const c = i && cadeia('ws:' + i.ws); return c && c.project ? 'project:' + c.project.id : null; }
function dcFicha(pk){ return D.sheets[pk] || (D.sheets[pk] = {campos:{}, custom:[], arquivos:[]}); }
// o campo da ficha ligado a este item, ou null
function dcLigacao(i){
  const pk = dcProjeto(i); if (!pk || !D.sheets[pk]) return null;
  const k = Object.keys(D.sheets[pk].campos).find(x => x.startsWith(DC_PREFIXO) && D.sheets[pk].campos[x] === i.id); if (!k) return null;
  const [sec, campo] = k.slice(DC_PREFIXO.length).split('›'); return {pk, sec, campo, chave:sec + '|' + campo};
}
// o item ligado a um campo da ficha, ou null
function dcItemDoCampo(pk, sec, campo){ const f = D.sheets[pk]; const id = f && f.campos[dcChave(sec, campo)]; const it = id ? byId('issues', id) : null; return it && dcProjeto(it) === pk ? it : null; }   // o item precisa ser do mesmo projeto (uma cópia de projeto leva a ficha junto)
function dcLigar(i, alvo){
  const pk = dcProjeto(i); if (!pk) return;
  const f = dcFicha(pk), atual = dcLigacao(i);
  if (atual) delete f.campos[dcChave(atual.sec, atual.campo)];
  if (alvo){ const [sec, campo] = alvo.split('|'); const outro = dcItemDoCampo(pk, sec, campo);
    if (outro && outro.id !== i.id) toast('Esse campo estava ligado a "' + outro.titulo + '". Agora fica com este item.');
    f.campos[dcChave(sec, campo)] = i.id; }
  salvar(); abrirItem(i.id);
}

function dcHTML(i){
  const pode = podeEditar(), dis = pode ? '' : ' disabled', lig = dcLigacao(i), pk = dcProjeto(i); if (!pk) return '';
  const opcoes = '<option value="">Não vai para a ficha</option>' + FICHA.map(([sec, expl, campos]) => '<optgroup label="' + esc(expl ? expl.charAt(0).toUpperCase() + expl.slice(1) + ' (' + sec + ')' : sec) + '">' +
    campos.map(cp => { const k = sec + '|' + cp; return '<option value="' + esc(k) + '"' + (lig && lig.chave === k ? ' selected' : '') + '>' + esc(cp) + '</option>'; }).join('') + '</optgroup>').join('');
  const valor = lig ? (dcFicha(pk).campos[lig.chave] || '') : '';
  // item que não é decisão: uma linha só, discreta
  if (!lig) return pode ? '<section class="g-sec dc-sec dc-curta" data-dc-item="' + i.id + '"><label class="dc-linha"><span>É uma decisão? Mande para a ficha técnica:</span><select class="sel peq" data-dc-ligar>' + opcoes + '</select></label></section>' : '';
  return '<section class="g-sec dc-sec" data-dc-item="' + i.id + '"><h4>Decisão para a ficha técnica</h4>' +
    '<p class="dc-ajuda">Se este item é uma decisão (nome, banco, cores...), escolha o campo da ficha técnica. O que você escrever aqui aparece lá na hora, e o que mudar lá aparece aqui.</p>' +
    '<label class="lb dc-campo">Campo da ficha técnica<select class="sel" data-dc-ligar' + dis + '>' + opcoes + '</select></label>' +
    (lig ? '<label class="lb dc-campo">O que foi decidido<textarea class="campo" rows="3" data-dc-valor="' + esc(lig.chave) + '"' + dis + ' placeholder="Ex.: Postgres no Supabase">' + esc(valor) + '</textarea></label>' +
      '<p class="dc-onde">Fica em <b>' + esc(nomeDe(pk)) + ' › Ficha técnica › ' + esc(lig.sec) + ' › ' + esc(lig.campo) + '</b>. <button type="button" class="btn fant peq" data-dc-abrir-ficha="' + esc(pk) + '">Abrir a ficha</button></p>' : '') + '</section>';
}
const _abrirItemDc = abrirItem;
abrirItem = function(id){
  const r = _abrirItemDc.apply(this, arguments);
  const i = byId('issues', id), g = $('#gaveta-wrap .gaveta'); if (!i || !g || $('.dc-sec', g)) return r;
  const pri = $('.g-principal', g); if (!pri) return r;
  // entra logo depois da descrição, antes do checklist
  const desc = $(':scope > .tf-desc', pri) || $(':scope > .g-sec', pri);
  if (desc) desc.insertAdjacentHTML('afterend', dcHTML(i)); else pri.insertAdjacentHTML('beforeend', dcHTML(i));
  return r;
};
document.addEventListener('change', e => {
  const s = e.target.closest && e.target.closest('[data-dc-ligar]'); if (!s || !itemAberto) return;
  const i = byId('issues', itemAberto); if (i) dcLigar(i, s.value);
});
document.addEventListener('input', e => {
  const t = e.target.closest && e.target.closest('[data-dc-valor]'); if (!t || !itemAberto) return;
  const i = byId('issues', itemAberto), lig = i && dcLigacao(i); if (!lig) return;
  dcFicha(lig.pk).campos[lig.chave] = t.value; salvar();
});
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-dc-abrir-ficha]'); if (b){ const k = b.dataset.dcAbrirFicha; fecharItem(); UI.sel = k; UI.view = 'sheet'; salvarUI(); abrirModulo('operacoes'); return; }
  const a = e.target.closest && e.target.closest('[data-dc-abrir-item]'); if (a){ abrirItem(a.dataset.dcAbrirItem); }
});

// na ficha técnica: cada campo ligado mostra de qual item veio a decisão
const _vSheetDc = vSheet;
vSheet = function(){
  let h = _vSheetDc();
  const pk = (cadeia(UI.sel).project && UI.sel.startsWith('project:')) ? UI.sel : null; if (!pk || !D.sheets[pk]) return h;
  FICHA.forEach(([sec, , campos]) => campos.forEach(cp => {
    const it = dcItemDoCampo(pk, sec, cp); if (!it) return;
    const k = esc(sec + '|' + cp), marca = 'data-ficha="' + k + '"';
    const ix = h.indexOf(marca); if (ix < 0) return;
    const fim = h.indexOf('</label>', ix); if (fim < 0) return;
    const nota = '<small class="dc-veio">Decidido no item <button type="button" class="dc-link" data-dc-abrir-item="' + it.id + '">' + esc(((typeof chaveDe === 'function' && chaveDe(it)) ? chaveDe(it) + ' ' : '') + it.titulo) + '</button></small>';
    h = h.slice(0, fim) + nota + h.slice(fim);
  }));
  return h;
};
// escrever na ficha com a janela do item aberta atualiza o texto da decisão na janela
document.addEventListener('input', e => {
  const t = e.target.closest && e.target.closest('textarea[data-ficha]'); if (!t) return;
  const box = $('#gaveta-wrap [data-dc-valor="' + (window.CSS && CSS.escape ? CSS.escape(t.dataset.ficha) : t.dataset.ficha) + '"]'); if (box && box !== t) box.value = t.value;
});
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {dcLigacao, dcLigar, dcItemDoCampo, abrirItem, fecharItem});
