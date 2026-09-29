/* ===== Fila: criar em lote =====
   Cola ou digita a lista inteira de uma vez, como no Trello e no ClickUp:
     linha sem traço            = épico
     linha começando com - * •  = item dentro do épico de cima
     [Nome da frente] no fim    = em qual frente fica (o item herda a do épico)
   Antes de criar, mostra a prévia. Épico com o mesmo nome de um que já existe no projeto não é duplicado: os itens entram nele.
   Grava como se cada um fosse criado à mão (épico em A fazer, itens na Fila), com Desfazer. */
const LT_EXEMPLO = 'Carteira de clientes [Database]\n- Cadastro do cliente\n- Cadastro das lojas\n- Tela da lista da carteira [Frontend]\n\nCatálogo e limite de publicação [Integração SHEIN]\n- Limite total de SKCs\n- SKCs publicados e saldo';
const ltNorm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// as frentes que valem aqui: primeiro as do ponto escolhido na Estrutura, depois as do projeto
function ltFrentes(){
  const pj = cadeia(UI.sel).project; if (!pj) return [];
  const doProjeto = D.ws.filter(w => { const a = byId('apps', w.app); return a && a.project === pj.id && w.status !== 'archived'; });
  const aqui = new Set(issuesEm(UI.sel).map(i => i.ws).concat(UI.sel.startsWith('ws:') ? [UI.sel.slice(3)] : []));
  const [tipo, id] = UI.sel.split(':');
  const dentro = w => aqui.has(w.id) || (tipo === 'app' && w.app === id) || (tipo === 'product' && (byId('apps', w.app) || {}).product === id) || tipo === 'project' || (tipo === 'ws' && w.id === id);
  return doProjeto.filter(dentro).concat(doProjeto.filter(w => !dentro(w)));
}
function ltLer(texto){
  const frentes = ltFrentes(), padrao = UI.sel.startsWith('ws:') ? UI.sel.slice(3) : primeiroWs(UI.sel);
  const pj = cadeia(UI.sel).project;
  const epicsJa = pj ? issuesEm('project:' + pj.id).filter(i => i.tipo === 'epic' && !i.arquivado) : [];
  const achaFrente = nome => { const n = ltNorm(nome); return frentes.find(w => ltNorm(w.nome) === n) || frentes.find(w => ltNorm(byId('apps', w.app).nome + ' › ' + w.nome) === n) || null; };
  const grupos = [], avisos = [];
  let atual = null;
  String(texto || '').split(/\r?\n/).forEach((bruta, k) => {
    let l = bruta.trim(); if (!l) return;
    const item = /^[-*•–]\s*/.test(l); if (item) l = l.replace(/^[-*•–]\s*/, '').trim(); if (!l) return;
    let ws = null; const m = /\s*\[([^\]]+)\]\s*$/.exec(l);
    if (m){ l = l.slice(0, m.index).trim(); const f = achaFrente(m[1]); if (f) ws = f.id; else avisos.push('Linha ' + (k + 1) + ': a frente "' + m[1].trim() + '" não existe aqui. Vai para ' + (item && atual ? 'a frente do épico' : 'a frente escolhida na Estrutura') + '.'); }
    if (!l) return;
    if (!item){ const ja = epicsJa.find(e => ltNorm(e.titulo) === ltNorm(l)) || null; atual = {titulo:l, ws:ws || (ja ? ja.ws : padrao), ja, itens:[]}; grupos.push(atual); return; }
    if (!atual){ atual = {titulo:null, ws:padrao, ja:null, itens:[]}; grupos.push(atual); }
    atual.itens.push({titulo:l, ws:ws || atual.ws});
  });
  return {grupos, avisos, padrao};
}
const ltFrenteNome = id => { const w = byId('ws', id); return w ? w.nome : 'sem frente'; };
function ltPreviaHTML(r){
  const novos = r.grupos.filter(g => g.titulo && !g.ja).length, nItens = r.grupos.reduce((s, g) => s + g.itens.length, 0);
  if (!r.grupos.length) return '<p class="lt-vazio">A prévia aparece aqui enquanto você escreve.</p>';
  return '<p class="lt-conta"><b>' + novos + (novos === 1 ? ' épico novo' : ' épicos novos') + '</b> e <b>' + nItens + (nItens === 1 ? ' item' : ' itens') + '</b> vão ser criados.</p>' +
    (r.avisos.length ? '<ul class="lt-avisos">' + r.avisos.map(a => '<li>' + esc(a) + '</li>').join('') + '</ul>' : '') +
    '<ol class="lt-lista">' + r.grupos.map(g => '<li><div class="lt-ep">' + (g.titulo ? '<b>' + esc(g.titulo) + '</b>' + (g.ja ? '<small>já existe: os itens entram nele</small>' : '') : '<b class="lt-sem">Itens sem épico</b>') + '<span class="lt-fr">' + esc(ltFrenteNome(g.ws)) + '</span></div>' +
      (g.itens.length ? '<ul>' + g.itens.map(i => '<li><span>' + esc(i.titulo) + '</span>' + (i.ws !== g.ws ? '<span class="lt-fr">' + esc(ltFrenteNome(i.ws)) + '</span>' : '') + '</li>').join('') + '</ul>' : '') + '</li>').join('') + '</ol>';
}
function ltNovo(titulo, ws, tipo, status, pai){
  const ni = novoIssue({titulo, status, ws, tipo, pai:pai || null});
  garantirBoard({issues:[ni], boards:D.boards, equipes:D.equipes});
  ni.ordem = novaOrdem(D.issues.filter(x => !x.sprint), null);
  D.issues.push(ni); registrar('criou', ni); return ni;
}
function ltAbrir(){
  if (!podeEditar()) return;
  if (!ltFrentes().length){ toast('Crie antes uma frente de trabalho numa aplicação (Estrutura › aplicação › ⋯ › Criar dentro)'); return; }
  modal('Criar em lote', '<div class="lt-grade"><div class="lt-esq"><label class="lb" for="lt-t">Escreva ou cole a lista</label>' +
    '<textarea class="campo lt-texto" id="lt-t" rows="16" spellcheck="false" placeholder="' + esc(LT_EXEMPLO) + '"></textarea>' +
    '<div class="lt-regras"><p><b>Linha sem traço</b> vira épico.</p><p><b>Linha com - na frente</b> vira item dentro do épico de cima.</p><p><b>[Nome da frente]</b> no fim da linha escolhe a frente. O item fica na frente do épico, se não disser outra.</p>' +
    '<p class="lt-frentes">Frentes daqui: ' + ltFrentes().map(w => esc(w.nome)).filter((n, k, a) => a.indexOf(n) === k).join(', ') + '</p>' +
    '<button type="button" class="btn fant peq" data-lt-exemplo>Usar o exemplo</button></div></div>' +
    '<div class="lt-dir"><span class="lb">Prévia</span><div class="lt-previa" aria-live="polite">' + ltPreviaHTML({grupos:[], avisos:[]}) + '</div></div></div>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Criar tudo', acao:dl => {
      const r = ltLer($('#lt-t', dl).value); const nItens = r.grupos.reduce((s, g) => s + g.itens.length, 0);
      const novos = r.grupos.filter(g => g.titulo && !g.ja).length;
      if (!novos && !nItens){ toast('Escreva pelo menos um épico ou um item'); return false; }
      tfComDesfazer((novos ? novos + (novos === 1 ? ' épico' : ' épicos') + (nItens ? ' e ' : '') : '') + (nItens ? nItens + (nItens === 1 ? ' item' : ' itens') : '') + ' criados.', () => {
        r.grupos.forEach(g => {
          const ep = g.titulo ? (g.ja && byId('issues', g.ja.id)) || ltNovo(g.titulo, g.ws, 'epic', 'todo', null) : null;
          g.itens.forEach(i => ltNovo(i.titulo, i.ws, ep ? 'story' : 'task', 'backlog', ep ? ep.id : null));
        });
      });
    }}]);
  const dl = document.querySelector('dialog.modal:last-of-type'); if (!dl) return;
  dl.classList.add('lt-modal');
  const ta = $('#lt-t', dl), pv = $('.lt-previa', dl);
  const atualizar = () => { pv.innerHTML = ltPreviaHTML(ltLer(ta.value)); };
  ta.addEventListener('input', atualizar);
  $('[data-lt-exemplo]', dl).addEventListener('click', () => { ta.value = LT_EXEMPLO; atualizar(); ta.focus(); });
  ta.focus();
}

// o botão fica no painel Épicos da Fila, logo abaixo de Criar épico
const _rViewLt = rView;
rView = function(){
  _rViewLt();
  if (UI.view !== 'backlog' || !podeEditar()) return;
  const b = $('#ops-corpo [data-bj-acao="novo-epic"]');
  if (b && !$('#ops-corpo [data-lt-abrir]')) b.insertAdjacentHTML('afterend', '<button type="button" class="btn fant peq" data-lt-abrir>' + ICO.mais + 'Criar em lote</button>');
};
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-lt-abrir]')){ e.preventDefault(); ltAbrir(); } });
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {ltLer, ltAbrir});
