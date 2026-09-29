/* ===== Entregas: versões em forma de tabela =====
   Uma janela como uma planilha: cada linha é uma versão (nome, previsão, resumo, se o cliente vê).
   As que já existem aparecem para editar; o + no fim acrescenta linhas para criar várias de uma vez.
   Também aceita colar do Excel ou do Google Planilhas (colunas separadas por tab: nome, previsão, resumo).
   Grava como a janela Nova versão: marcos do tipo release no projeto, com Desfazer. */
const VS_LINHAS_VAZIAS = 3;
function vsData(s){
  s = String(s || '').trim(); if (!s) return '';
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); if (m) return s;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
  if (m){ const a = m[3].length === 2 ? '20' + m[3] : m[3]; return a + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'); }
  return '';
}
function vsLinha(m, focoId){
  const novo = !m, id = novo ? '' : m.id, no = m && m.entregue;
  return '<tr class="vs-linha' + (novo ? ' vs-nova' : '') + (focoId && focoId === id ? ' vs-foco' : '') + '" data-vs-id="' + id + '">' +
    '<td><input class="campo vs-c" data-vs-c="nome" value="' + esc(m ? m.nome : '') + '" placeholder="' + (novo ? 'Ex.: v0.3' : '') + '" aria-label="Nome da versão" maxlength="60"></td>' +
    '<td><input class="campo vs-c" type="date" data-vs-c="data" value="' + esc(m ? m.data || '' : '') + '" aria-label="Previsão"></td>' +
    '<td><input class="campo vs-c" data-vs-c="desc" value="' + esc(m ? m.desc || '' : '') + '" placeholder="' + (novo ? 'O que ela entrega' : '') + '" aria-label="Resumo"></td>' +
    '<td class="vs-meio"><input type="checkbox" data-vs-c="vis"' + (!m || m.vis !== false ? ' checked' : '') + ' aria-label="O cliente vê esta versão"></td>' +
    '<td class="vs-sit">' + (novo ? '<span class="vs-tag">nova</span>' : no ? '<span class="vs-tag ok">no ar</span>' : '<span class="vs-tag">planejada</span>') + '</td>' +
    '<td class="vs-meio">' + (novo ? '<button type="button" class="ico-btn vs-tirar" data-vs-tirar aria-label="Tirar esta linha" title="Tirar esta linha">' + ICO.fechar + '</button>' : '') + '</td></tr>';
}
function vsAbrir(focoId){
  if (!podeEditar()) return;
  const chave = enProjeto(UI.sel), versoes = enVersoes(chave).slice().sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')) || a.nome.localeCompare(b.nome));
  const vazias = versoes.length ? 1 : VS_LINHAS_VAZIAS;
  const dlg = modal('Versões de ' + esc(nomeDe(chave)),
    '<p class="sec tf-nota" style="margin-top:0">Mude o que quiser nas linhas e clique em <b>Salvar</b>. Para criar várias de uma vez, clique no <b>+</b> e preencha as linhas novas. Dá também para colar uma lista do Excel na coluna Nome.</p>' +
    '<div class="vs-rolo"><table class="vs-tabela"><colgroup><col style="width:17%"><col style="width:17%"><col><col style="width:9%"><col style="width:11%"><col style="width:5%"></colgroup>' +
    '<thead><tr><th scope="col">Nome</th><th scope="col">Previsão</th><th scope="col">Resumo</th><th scope="col" class="vs-meio">Cliente vê</th><th scope="col">Situação</th><th scope="col"><span class="sr-only">Tirar</span></th></tr></thead>' +
    '<tbody>' + versoes.map(m => vsLinha(m, focoId)).join('') + Array.from({length:vazias}, () => vsLinha(null)).join('') + '</tbody></table></div>' +
    '<button type="button" class="btn sec peq vs-mais" data-vs-mais>' + ICO.mais + 'Adicionar linha</button><p class="vs-erro" role="alert" hidden></p>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Salvar', acao:dl => vsSalvar(dl, chave)}]);
  const d = dlg; if (!d) return;
  d.classList.add('vs-modal');
  const corpo = $('.vs-tabela tbody', d);
  const novaLinha = () => { corpo.insertAdjacentHTML('beforeend', vsLinha(null)); return corpo.lastElementChild; };
  d.addEventListener('click', e => {
    if (e.target.closest('[data-vs-mais]')){ const l = novaLinha(); $('[data-vs-c="nome"]', l).focus(); return; }
    const t = e.target.closest('[data-vs-tirar]'); if (t){ t.closest('tr').remove(); if (!$('.vs-linha', corpo)) novaLinha(); }
  });
  // Enter desce para a mesma coluna da linha de baixo (e cria a linha se for a última), como numa planilha
  d.addEventListener('keydown', e => {
    const c = e.target.closest && e.target.closest('input.vs-c'); if (!c || e.key !== 'Enter') return;
    e.preventDefault(); let prox = c.closest('tr').nextElementSibling; if (!prox) prox = novaLinha();
    const alvo = $('[data-vs-c="' + c.dataset.vsC + '"]', prox); if (alvo) alvo.focus();
  });
  // colar várias linhas: cada linha vira uma versão; colunas separadas por tab (nome, previsão, resumo)
  d.addEventListener('paste', e => {
    const c = e.target.closest && e.target.closest('input.vs-c'); if (!c) return;
    const txt = (e.clipboardData || window.clipboardData).getData('text') || '';
    if (!/[\n\t]/.test(txt.trim())) return;
    e.preventDefault();
    const cols = ['nome', 'data', 'desc'], ini = Math.max(0, cols.indexOf(c.dataset.vsC));
    let tr = c.closest('tr');
    txt.replace(/\r/g, '').split('\n').filter(l => l.trim()).forEach((l, k) => {
      if (k > 0){ tr = tr.nextElementSibling || novaLinha(); }
      l.split('\t').forEach((v, j) => { const campo = cols[ini + j]; const inp = campo && $('[data-vs-c="' + campo + '"]', tr); if (inp) inp.value = campo === 'data' ? vsData(v) : v.trim(); });
    });
  });
  const foco = focoId && $('.vs-foco [data-vs-c="nome"]', d); (foco || $('.vs-nova [data-vs-c="nome"]', d) || $('[data-vs-c="nome"]', d)).focus();
}
function vsSalvar(d, chave){
  const erro = $('.vs-erro', d), mostrar = (msg, el) => { erro.textContent = msg; erro.hidden = false; $$('.vs-ruim', d).forEach(x => x.classList.remove('vs-ruim')); if (el){ el.classList.add('vs-ruim'); el.focus(); } return false; };
  const linhas = $$('.vs-linha', d).map(tr => ({tr, id:tr.dataset.vsId, nome:$('[data-vs-c="nome"]', tr).value.trim(), data:$('[data-vs-c="data"]', tr).value, desc:$('[data-vs-c="desc"]', tr).value.trim(), vis:$('[data-vs-c="vis"]', tr).checked}));
  const usadas = linhas.filter(l => l.id || l.nome || l.desc || l.data);
  for (const l of usadas) if (!l.nome) return mostrar(l.id ? 'Toda versão precisa de nome. Para tirar uma versão, use a lixeira na lista de versões.' : 'Uma linha nova está sem nome. Escreva o nome ou tire a linha no X.', $('[data-vs-c="nome"]', l.tr));
  const vistos = new Map(), outras = enVersoes(chave).filter(m => !usadas.some(l => l.id === m.id));
  for (const l of usadas){ const k = l.nome.toLowerCase(); if (vistos.has(k) || outras.some(m => m.nome.toLowerCase() === k)) return mostrar('O nome ' + l.nome + ' aparece duas vezes. Cada versão precisa de um nome diferente.', $('[data-vs-c="nome"]', l.tr)); vistos.set(k, 1); }
  const mudou = (m, l) => m.nome !== l.nome || (m.data || '') !== l.data || (m.desc || '') !== l.desc || (m.vis !== false) !== l.vis;
  const editar = usadas.filter(l => l.id).filter(l => { const m = byId('marcos', l.id); return m && mudou(m, l); }), criar = usadas.filter(l => !l.id);
  if (!editar.length && !criar.length){ toast('Nada mudou'); return; }
  const partes = [criar.length ? criar.length + (criar.length === 1 ? ' versão criada' : ' versões criadas') : '', editar.length ? editar.length + (editar.length === 1 ? ' versão alterada' : ' versões alteradas') : ''].filter(Boolean);
  tfComDesfazer(partes.join(' e ') + '.', () => {
    editar.forEach(l => { const m = byId('marcos', l.id); if (!m) return; m.nome = l.nome; m.data = l.data || m.data || iso(dAdd(HOJE, 14)); m.desc = l.desc; m.vis = l.vis; });
    criar.forEach(l => D.marcos.push({id:uid('mc'), no:chave, tipo:'release', nome:l.nome, desc:l.desc, data:l.data || iso(dAdd(HOJE, 14)), vis:l.vis, entregue:null, notas:''}));
  });
  if (UI.view === 'entregas') rView();
}

// na aba Entregas: "Editar em tabela" no alto da caixa Versões e um lápis em cada versão.
// O conteúdo da aba chega depois de ler o banco, então quem põe os botões é um observador da tela.
function vsBotoes(){
  if (UI.view !== 'entregas' || !podeEditar()) return;
  const caixa = $$('#ops-corpo .en2-caixa').find(s => { const h = $('header h3', s); return h && h.textContent.trim() === 'Versões'; });
  if (!caixa || $('[data-vs-abrir]', caixa)) return;
  $('header', caixa).insertAdjacentHTML('beforeend', '<button type="button" class="btn sec peq vs-abrir" data-vs-abrir>' + TF_ICO.editar + 'Editar em tabela</button>');
  $$('[data-en-notas]', caixa).forEach(b => b.insertAdjacentHTML('beforebegin', '<button type="button" class="ico-btn vs-lapis" data-vs-abrir="' + b.dataset.enNotas + '" aria-label="Editar esta versão" title="Editar">' + TF_ICO.editar + '</button>'));
}
new MutationObserver(vsBotoes).observe(document.body, {childList:true, subtree:true});
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-vs-abrir]'); if (b){ e.preventDefault(); vsAbrir(b.dataset.vsAbrir || null); } });
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {vsAbrir, vsData});
