/* ===== O CicloDev como P.O.: o sistema olha o que já existe e guia (ciclodev-po-automatico.md, ondas 1 e 2) =====
   Regra: o sistema SUGERE, a pessoa decide. Nada aqui muda situação, ordem ou aceite sozinho: só mostra, avisa e
   oferece um botão. Todo aviso diz por quê. Os avisos podem ser silenciados por 7 dias (no navegador).
   Feito aqui: selo Preparado (4) e item grande (5), dependência fora de ordem e circular (10), decisão que trava itens (11),
   previsão por velocidade (13), item parado (16), começou sem estar preparado (17), esperando aceite (18), O que fazer hoje (22),
   Definição de Pronto padrão (2), ordem sugerida com o porquê (9), aceite guiado (19), semáforo da versão (23), épico e versão sem meta (7). */
const PG = {parado:5, aceite:3, grande:13, semanas:4};   // limites: dias parado, dias esperando aceite, pontos "grande demais", semanas para medir o ritmo
const PG_DOD_PADRAO = '- Todos os critérios de aceite marcados e conferidos pelo P.O.\n- Sem bugs conhecidos no que foi entregue\n- Testado no computador e no celular (quando tem tela)\n- Texto da tela revisado, sem termo técnico para o usuário\n- O que mudou está na nota da versão\n- Publicado na prévia e conferido antes de ir para o ar';
const pgDias = d => d ? Math.floor((HOJE - new Date(String(d).length === 10 ? d + 'T12:00:00' : d)) / 864e5) : null;

/* ---------- a data da última mudança (o banco tem; a tela passa a guardar) ---------- */
const _montarDadosPg = montarDados;
montarDados = function(T, eu){ const d = _montarDadosPg(T, eu); const r = new Map((T.itens || []).map(x => [x.id, x])); d.issues.forEach(i => { const x = r.get(i.id); if (x && x.atualizado_em) Object.defineProperty(i, '_mudou', {value:x.atualizado_em, enumerable:false, writable:true}); }); return d; };

/* ---------- 4 e 5: o item está preparado para começar? (INVEST simplificado) ---------- */
function pgPreparo(i){
  if (!poTemPO(i) || i.externa) return null;
  const f = [];
  if (!poHistoria(i)) f.push('história (Como, quero, para)');
  if (!poCrit(i).length) f.push('critérios de aceite');
  if (!i.moscow) f.push('prioridade (Deve, Deveria...)');
  if (!i.valor) f.push('valor');
  if (!i.pontos) f.push('estimativa em pontos');
  const grande = +i.pontos >= PG.grande;
  const deps = poDepsAbertas(i);
  return {ok:!f.length && !grande, faltas:f, grande, deps};
}
function pgSeloHTML(i){
  const p = pgPreparo(i); if (!p || i.status === 'done') return '';
  if (p.ok) return '<span class="po-chip pg-ok" title="Preparado: tem história, critérios, prioridade, valor e pontos">Preparado</span>';
  return '<span class="po-chip pg-falta" title="' + esc((p.faltas.length ? 'Falta: ' + p.faltas.join(', ') + '. ' : '') + (p.grande ? 'Grande demais (' + i.pontos + ' pontos): quebre em itens menores antes de começar.' : '')) + '">' + (p.grande ? 'Grande' : 'Falta ' + p.faltas.length) + '</span>';
}
const _poChipsHTMLPg = poChipsHTML;
poChipsHTML = function(i, curto){ const h = _poChipsHTMLPg.apply(this, arguments); return h ? h.replace('<span class="po-chips">', '<span class="po-chips">' + pgSeloHTML(i)) : h; };

/* ---------- 10 e 11: dependências na fila e decisões que travam itens ---------- */
function pgDependentes(i){ return D.issues.filter(x => !x.arquivado && x.id !== i.id && x.status !== 'done' && poDeps(x).some(d => d.id === i.id)); }
function pgCiclo(i){ const vistos = new Set(), pilha = [[i, 0]]; while (pilha.length){ const [x, n] = pilha.pop(); if (n > 30) continue; for (const d of poDeps(x)){ if (d.id === i.id) return true; if (!vistos.has(d.id)){ vistos.add(d.id); pilha.push([d, n + 1]); } } } return false; }
function pgForaDeOrdem(i){ const fila = poFila(i); const k = fila.indexOf(i); if (k < 0) return []; return poDepsAbertas(i).filter(d => fila.indexOf(d) > k); }

/* ---------- 13 e 23: ritmo, previsão e semáforo da versão ---------- */
function pgRitmo(chave){
  const its = issuesEm(chave).filter(i => i.status === 'done' && i.feito && !i.externa && +i.pontos > 0 && pgDias(i.feito) != null && pgDias(i.feito) <= PG.semanas * 7);
  return its.reduce((s, i) => s + (+i.pontos || 0), 0) / PG.semanas;   // pontos por semana
}
function pgPrevisao(m){
  const a = poAndamentoVersao(m), falta = a.pts - a.ptsAc, ritmo = pgRitmo(m.no || UI.sel);
  if (!a.n) return null;
  const sem = falta <= 0 ? 0 : ritmo > 0 ? falta / ritmo : null;
  const prev = sem == null ? null : iso(dAdd(HOJE, Math.ceil(sem * 7)));
  const its = issuesEm(m.no || UI.sel).filter(i => i.marco === m.id && !i.arquivado && poTemPO(i) && i.status !== 'done');
  const prep = its.filter(i => (pgPreparo(i) || {}).ok).length, voltou = its.filter(poVoltou).length;
  let cor = 'verde', por = [];
  if (prev && m.data && prev > m.data){ cor = 'vermelho'; por.push('no ritmo atual sai em ' + fmtData(prev) + ', depois da entrega (' + fmtData(m.data) + ')'); }
  else if (sem == null && falta > 0){ cor = 'amarelo'; por.push('ainda não há ritmo medido (nenhum ponto aceito nas últimas ' + PG.semanas + ' semanas)'); }
  if (its.length && prep / its.length < 0.5){ if (cor === 'verde') cor = 'amarelo'; por.push('só ' + prep + ' de ' + its.length + ' itens abertos estão preparados'); }
  if (voltou){ if (cor === 'verde') cor = 'amarelo'; por.push(voltou + (voltou === 1 ? ' item voltou' : ' itens voltaram') + ' do teste'); }
  if (m.data && pgDias(m.data) > 0 && falta > 0 && cor !== 'vermelho'){ cor = 'vermelho'; por.unshift('a data de entrega já passou'); }
  return {cor, por, prev, ritmo, falta, a};
}
const PG_COR = {verde:'No prazo', amarelo:'Atenção', vermelho:'Em risco'};
const _enHTMLPg = enHTML;
enHTML = function(chave){
  const h = _enHTMLPg.apply(this, arguments), box = document.createElement('div'); box.innerHTML = h;
  $$('.en2-v', box).forEach(li => { const b = $('[data-en-notas]', li); const m = b && byId('marcos', b.dataset.enNotas); if (!m || m.entregue) return; const p = pgPrevisao(m); if (!p) return;
    const prog = $('.en2-prog', li); if (prog) prog.insertAdjacentHTML('beforeend', '<small class="pg-sem pg-' + p.cor + '" title="' + esc(p.por.join('. ') || 'Ritmo e preparo dentro do esperado') + '">' + PG_COR[p.cor] + (p.prev ? ' · previsão ' + fmtData(p.prev) : '') + '</small>'); });
  return box.innerHTML;
};

/* ---------- 22: O que fazer hoje (no Painel e no topo da Fila) ---------- */
const PG_SIL = 'ciclodev-po-silenciados';
const pgSil = () => { try { const o = JSON.parse(localStorage.getItem(PG_SIL) || '{}'); const ag = Date.now(); Object.keys(o).forEach(k => { if (o[k] < ag) delete o[k]; }); return o; } catch(e){ return {}; } };
function pgSilenciar(k){ try { const o = pgSil(); o[k] = Date.now() + 7 * 864e5; localStorage.setItem(PG_SIL, JSON.stringify(o)); } catch(e){} }
function pgAcoes(chave){
  const its = issuesEm(chave).filter(i => !i.arquivado && poTemPO(i)), A = [];
  const pj = cadeia(chave).project, sil = pgSil();
  const add = (k, peso, tit, por, botao) => { if (!sil[k]) A.push({k, peso, tit, por, botao}); };
  // aceitar o que espera (18)
  its.filter(i => i.status === 'review').forEach(i => { const d = pgDias(i._mudou) || 0;
    add('aceite:' + i.id, 90 + Math.min(d, 9), 'Testar e aceitar ' + leNomePg(i), d >= PG.aceite ? 'Está em Pronto para testar há ' + d + ' dias. Item parado no teste segura a entrega.' : 'Está pronto para testar. Aceitar ou devolver logo mantém o ritmo.', {txt:'Abrir', item:i.id}); });
  // decisões e itens que travam outros (11)
  its.filter(i => i.status !== 'done').map(i => ({i, n:pgDependentes(i).length})).filter(x => x.n).sort((a, b) => b.n - a.n).slice(0, 5).forEach(({i, n}) =>
    add('trava:' + i.id, 70 + Math.min(n, 20), (/^decidir/i.test(i.titulo) ? 'Decidir: ' : 'Destravar: ') + leNomePg(i), 'Trava ' + n + (n === 1 ? ' item' : ' itens') + ' que dependem dele. Resolver primeiro libera o resto da fila.', {txt:'Abrir', item:i.id}));
  // dependência fora de ordem e circular (10)
  its.filter(i => i.status !== 'done').forEach(i => { if (pgCiclo(i)) add('ciclo:' + i.id, 85, 'Dependência em círculo em ' + leNomePg(i), 'Este item depende, por outros, dele mesmo: nenhum dos dois consegue começar. Tire uma das dependências.', {txt:'Abrir', item:i.id});
    const fo = pgForaDeOrdem(i); if (fo.length) add('ordem:' + i.id, 60, 'Fora de ordem: ' + leNomePg(i), 'Está na frente de ' + fo.map(leNomePg).join(', ') + ', de que ele depende. Quem é dependido vem antes na fila.', {txt:'Ver a ordem sugerida', ordem:true}); });
  // item parado (16)
  its.filter(i => i.status === 'doing').forEach(i => { const d = pgDias(i._mudou); if (d != null && d >= PG.parado) add('parado:' + i.id, 50 + Math.min(d, 20), 'Parado: ' + leNomePg(i), 'Em andamento há ' + d + ' dias sem mudança. Se travou, marque Travado e diga o motivo; se ficou grande, quebre.', {txt:'Abrir', item:i.id}); });
  // refinar o topo da fila (4 e 5)
  const fila = its.filter(i => ['backlog','todo'].includes(i.status)).sort((a, b) => (+a.ordem || 0) - (+b.ordem || 0)).slice(0, 8);
  fila.forEach(i => { const p = pgPreparo(i); if (!p || p.ok) return; add('refinar:' + i.id, 40, (p.grande ? 'Quebrar ' : 'Refinar ') + leNomePg(i), p.grande ? 'Tem ' + i.pontos + ' pontos: item grande demais costuma atrasar. Quebre em itens de até 8 pontos.' : 'Está no topo da fila e falta: ' + p.faltas.join(', ') + '. Os do topo precisam estar preparados para começar.', {txt:'Abrir', item:i.id}); });
  // versão em risco (23) e sem meta (7)
  if (pj) ltVersoesDoProjeto().filter(m => m.tipo === 'release' && !m.entregue).forEach(m => { const p = pgPrevisao(m);
    if (p && p.cor === 'vermelho') add('versao:' + m.id, 80, 'Versão ' + m.nome + ' em risco', p.por.join('. ') + '. Corte itens Poderia ou de menor valor por ponto, ou combine outra data.', {txt:'Ver Entregas', view:'entregas'});
    if (!m.meta) add('vmeta:' + m.id, 20, 'Escrever a meta da versão ' + m.nome, 'Sem meta, não dá para saber se um item ajuda a entrega.', {txt:'Ver Entregas', view:'entregas'}); });
  issuesEm(chave).filter(i => i.tipo === 'epic' && !i.arquivado && i.status !== 'done' && !i.meta).slice(0, 3).forEach(e => add('emeta:' + e.id, 15, 'Escrever a meta do épico ' + e.titulo, 'A meta diz o que a entrega resolve; sem ela, a fila perde o rumo.', {txt:'Abrir', item:e.id}));
  // montar o projeto (1 e 2)
  if (pj && !pj.dod) add('dod:' + pj.id, 75, 'Escrever a Definição de Pronto de ' + pj.nome, 'É o que todo item precisa ter para ser aceito. Há um modelo pronto para começar.', {txt:'Escrever', dod:pj.id});
  if (pj && !pj.po) add('po:' + pj.id, 74, 'Definir o P.O. de ' + pj.nome, 'Sem P.O., qualquer um aceita. Com P.O., só ele aceita e devolve.', {txt:'Definir', po:pj.id});
  return A.sort((a, b) => b.peso - a.peso);
}
const leNomePg = x => (typeof chaveDe === 'function' && chaveDe(x) ? chaveDe(x) + ' ' : '') + '"' + x.titulo + '"';
function pgHojeHTML(chave){
  const A = pgAcoes(chave), mostra = A.slice(0, 5);
  const vs = cadeia(chave).project ? ltVersoesDoProjeto().filter(m => m.tipo === 'release' && !m.entregue).sort((a, b) => String(a.data).localeCompare(String(b.data))).slice(0, 4) : [];
  const sem = vs.map(m => ({m, p:pgPrevisao(m)})).filter(x => x.p);
  return '<section class="pg-hoje" aria-label="O que fazer hoje"><header><b>O que fazer hoje</b><span>O CicloDev olhou a fila e sugere, em ordem. Você decide.</span></header>' +
    (mostra.length ? '<ol>' + mostra.map(a => '<li><div><b>' + esc(a.tit) + '</b><small>' + esc(a.por) + '</small></div><span class="pg-bts">' +
      '<button type="button" class="btn sec peq" data-pg-ir="' + esc(JSON.stringify(a.botao)) + '">' + esc(a.botao.txt) + '</button><button type="button" class="btn fant peq" data-pg-sil="' + esc(a.k) + '" title="Não mostrar este aviso por 7 dias">Silenciar</button></span></li>').join('') + '</ol>' +
      (A.length > 5 ? '<p class="po-nota">E mais ' + (A.length - 5) + ' sugestões de menor peso.</p>' : '')
      : '<p class="po-nota">Nada urgente: a fila está preparada e nada está parado.</p>') +
    (sem.length ? '<div class="pg-sems">' + sem.map(({m, p}) => '<span class="pg-sem pg-' + p.cor + '" title="' + esc(p.por.join('. ') || 'Ritmo e preparo dentro do esperado') + '">' + esc(m.nome) + ': ' + PG_COR[p.cor] + (p.prev ? ' · previsão ' + fmtData(p.prev) : '') + '</span>').join('') + '</div>' : '') + '</section>';
}
const _rViewPg = rView;
rView = function(){
  const r = _rViewPg.apply(this, arguments);
  try { if ((UI.view === 'dashboard' || UI.view === 'backlog') && UI.modulo === 'operacoes' && cadeia(UI.sel).project){ const c = $('#ops-corpo'); if (c && !$('.pg-hoje', c)) c.insertAdjacentHTML('afterbegin', pgHojeHTML(UI.sel)); } } catch(e){ console.warn('P.O. hoje', e); }
  return r;
};
document.addEventListener('click', e => {
  const s = e.target.closest && e.target.closest('[data-pg-sil]'); if (s){ pgSilenciar(s.dataset.pgSil); rView(); return; }
  const b = e.target.closest && e.target.closest('[data-pg-ir]'); if (!b) return; const a = JSON.parse(b.dataset.pgIr || '{}');
  if (a.item) abrirItem(a.item); else if (a.view){ UI.view = a.view; salvarUI(); rOperacoes(); } else if (a.ordem) pgOrdemSugerida();
  else if (a.dod){ const pj = byId('projects', a.dod); if (pj) poEditarDod(pj, () => rView()); } else if (a.po){ const pj = byId('projects', a.po); if (pj) poEditarPO(pj, () => rView()); }
});

/* ---------- 9: ordem sugerida, com o porquê de cada lugar ---------- */
function pgOrdemSugerida(){
  const its = issuesEm(UI.sel).filter(i => !i.arquivado && poTemPO(i) && i.status !== 'done' && ['backlog','todo'].includes(i.status));
  if (!its.length){ toast('Não há itens na fila para ordenar aqui.'); return; }
  // pela prioridade e, depois, quem é dependido sobe para antes de quem depende dele
  const base = its.slice().sort(poCompararPrioridade), pos = new Map(base.map((x, k) => [x.id, k])), ord = [], feitos = new Set();
  const por = new Map();
  const visitar = (x, n) => { if (feitos.has(x.id) || n > 40) return; poDepsAbertas(x).filter(d => pos.has(d.id)).sort((a, b) => pos.get(a.id) - pos.get(b.id)).forEach(d => { if (!feitos.has(d.id)){ por.set(d.id, 'vem antes porque ' + leNomePg(x) + ' depende dele'); visitar(d, n + 1); } }); if (!feitos.has(x.id)){ feitos.add(x.id); ord.push(x); } };
  base.forEach(x => visitar(x, 0));
  const razao = x => por.get(x.id) || [poMoscowNome(x.moscow) || 'sem classe', 'nível ' + poNivel(x), x.valor ? 'valor ' + x.valor : 'sem valor', x.pontos ? (Math.round((+x.valor || 0) / (+x.pontos) * 10) / 10) + ' de valor por ponto' : 'sem pontos'].join(', ');
  const atual = its.slice().sort((a, b) => (+a.ordem || 0) - (+b.ordem || 0));
  modal('Ordem sugerida pelo método', '<p class="sec tf-nota" style="margin-top:0">Pela classe (Deve, Deveria, Poderia), pelo nível, pelo valor e, no empate, pelo valor por ponto. Quem é dependido vem antes de quem depende dele. Nada muda até você clicar em Aplicar.</p>' +
    '<div class="tabela-rolo"><table class="tabela pg-ordem"><thead><tr><th>Nova</th><th>Hoje</th><th>Item</th><th>Por que está aqui</th></tr></thead><tbody>' +
    ord.map((x, k) => '<tr><td>' + (k + 1) + '</td><td>' + (atual.indexOf(x) + 1) + '</td><td>' + esc(leNomePg(x)) + '</td><td>' + esc(razao(x)) + '</td></tr>').join('') + '</tbody></table></div>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Aplicar esta ordem', acao:() => { tfComDesfazer('Fila na ordem sugerida (' + ord.length + ' itens).', () => { const b0 = Math.min(...its.map(i => +i.ordem || 0)); ord.forEach((x, k) => { const i = byId('issues', x.id); if (i) i.ordem = b0 + k + 1; }); }); }}]);
}
// a Fila: o botão "Ordenar pela prioridade" passa a abrir a ordem sugerida (com o porquê e o Aplicar)
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-po-ordenar]')){ e.stopImmediatePropagation(); e.preventDefault(); pgOrdemSugerida(); } }, true);

/* ---------- 17: começou sem estar preparado ---------- */
const _mudarStatusPg = mudarStatus;
mudarStatus = function(i, s){
  const g = poGrupo(s); if (g === 'doing' && ['backlog','todo'].includes(i.status)){ const p = pgPreparo(i); if (p && !p.ok) setTimeout(() => toast('"' + i.titulo + '" começou sem estar preparado' + (p.faltas.length ? ': falta ' + p.faltas.join(', ') : '') + (p.grande ? (p.faltas.length ? '; e ' : ': ') + 'é grande demais (' + i.pontos + ' pontos)' : '') + '. Vale completar antes de seguir.'), 1600); }
  return _mudarStatusPg.apply(this, arguments);
};

/* ---------- 4 e 5 na janela do item: o selo e o que falta ---------- */
const _abrirItemPg = abrirItem;
abrirItem = function(id){
  const r = _abrirItemPg.apply(this, arguments);
  try { const i = byId('issues', id), g = $('#gaveta-wrap .gaveta'), c = g && $('.po-cartao', g), p = i && pgPreparo(i);
    if (c && p && i.status !== 'done' && !$('.pg-prep', c)){ const dep = pgDependentes(i).length, fo = pgForaDeOrdem(i);
      $('h4', c).insertAdjacentHTML('afterend', '<div class="pg-prep ' + (p.ok ? 'pg-prep-ok' : '') + '">' + (p.ok ? '<b>Preparado para começar</b>' : '<b>Ainda não está preparado</b>' + (p.faltas.length ? '<span>Falta: ' + esc(p.faltas.join(', ')) + '.</span>' : '')) +
        (p.grande ? '<span>Grande demais (' + i.pontos + ' pontos): quebre em itens de até 8 pontos antes de começar.</span>' : '') +
        (dep ? '<span>Trava ' + dep + (dep === 1 ? ' item' : ' itens') + ' que dependem dele.</span>' : '') + (fo.length ? '<span>Está na fila na frente de ' + esc(fo.map(leNomePg).join(', ')) + ', de que depende.</span>' : '') + '</div>'); } } catch(e){ console.warn('P.O. preparo', e); }
  return r;
};

/* ---------- 19: aceite guiado (critérios um a um, desenho e Definição de Pronto) ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-po-acao="aceitar"]'); if (!b) return;
  e.stopImmediatePropagation(); e.preventDefault();
  const i = itemAberto && byId('issues', itemAberto); if (!i || !poPodeAceitar(i, true)) return;
  const pj = poProjeto(i), crit = poCrit(i), des = (i.refs || []).filter(x => x.papel && (x.url || x._ver));
  const dod = String(pj && pj.dod || '').split('\n').map(l => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
  const caixa = (k, txt) => '<label class="pg-conf"><input type="checkbox" data-pg-conf="' + k + '"><span>' + esc(txt) + '</span></label>';
  modal('Aceitar "' + i.titulo + '"', '<p class="sec tf-nota" style="margin-top:0">Confira cada ponto no que foi entregue (não só no que está escrito). Para aceitar, todos precisam estar conferidos.' + (i.resp && poDoPO(i) && i.resp === poDoPO(i).id ? ' Você fez e também aceita este item: confira com calma, um a um.' : '') + '</p>' +
    (crit.length ? '<h4 class="pg-h">Critérios de aceite</h4>' + crit.map((c, k) => caixa('c' + k, c.t)).join('') : '') +
    (des.length ? '<h4 class="pg-h">Desenho</h4><div class="pg-des">' + des.map(x => '<img src="' + esc(x.url || x._ver) + '" alt="' + esc(x.papel === 'desenho_celular' ? 'Desenho do celular' : 'Desenho do computador') + '">').join('') + '</div>' + caixa('d', 'A tela entregue está como o desenho') : '') +
    (dod.length ? '<h4 class="pg-h">Definição de Pronto</h4>' + dod.map((t, k) => caixa('p' + k, t)).join('') : ''),
    [{txt:'Cancelar', cls:'sec'}, {txt:'Devolver', cls:'sec', acao:() => { setTimeout(() => { const d = $('#gaveta-wrap [data-po-acao="devolver"]'); if (d) d.click(); }, 50); }}, {txt:'Aceitar', acao:d => {
      const falta = $$('[data-pg-conf]', d).filter(x => !x.checked).length; if (falta){ toast('Faltam ' + falta + (falta === 1 ? ' ponto' : ' pontos') + ' para conferir. Se algo não está certo, use Devolver.'); return false; }
      mudarStatus(i, 'done'); salvar(); poReabrir(i); rView(); }}]);
}, true);

/* ---------- 2: Definição de Pronto com modelo pronto ---------- */
const _poEditarDodPg = poEditarDod;
poEditarDod = function(pj, depois){
  const r = _poEditarDodPg.apply(this, arguments); const dl = document.querySelector('dialog.modal:last-of-type'); const ta = dl && $('#po-dod', dl);
  if (ta && !$('[data-pg-dod]', dl)){ ta.insertAdjacentHTML('afterend', '<button type="button" class="btn fant peq" data-pg-dod style="justify-self:start;margin-top:6px">Usar o modelo padrão</button>'); $('[data-pg-dod]', dl).addEventListener('click', () => { ta.value = (ta.value.trim() ? ta.value.trim() + '\n' : '') + PG_DOD_PADRAO; ta.focus(); }); }
  return r;
};
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {pgPreparo, pgAcoes, pgPrevisao, pgOrdemSugerida, abrirItem, mudarStatus});
