/* ===== O CicloDev como P.O.: o sistema olha o que já existe e guia (ciclodev-po-automatico.md, ondas 1 e 2) =====
   Regra: o sistema SUGERE, a pessoa decide. Nada aqui muda situação, ordem ou aceite sozinho: só mostra, avisa e
   oferece um botão. Todo aviso diz por quê. Os avisos podem ser silenciados por 7 dias (no navegador).
   Feito aqui: selo Preparado (4) e item grande (5), dependência fora de ordem e circular (10), decisão que trava itens (11),
   previsão por velocidade (13), item parado (16), começou sem estar preparado (17), esperando aceite (18), O que fazer hoje (22),
   Definição de Pronto padrão (2), ordem sugerida com o porquê (9), aceite guiado (19), semáforo da versão (23), épico e versão sem meta (7). */
const PG_PADRAO = {parado:5, aceite:3, grande:13, semanas:4};   // limites padrão: dias parado, dias esperando aceite, pontos "grande demais", semanas para medir o ritmo
// os limites valem por projeto (Configurar limites); sem nada guardado, o padrão
const pgLim = x => { const pj = !x ? cadeia(UI.sel).project : x.ws ? poProjeto(x) : x.dod !== undefined ? x : cadeia(x.no || UI.sel).project; return Object.assign({}, PG_PADRAO, pj && pj.poLimites || {}); };
const PG = new Proxy({}, {get:(_, k) => pgLim()[k]});
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
  if (!i.marco) f.push('versão');
  const grande = +i.pontos >= pgLim(i).grande;
  const deps = poDepsAbertas(i);
  return {ok:!f.length && !grande, faltas:f, grande, deps, bloqueado:deps.length > 0};
}
function pgSeloHTML(i){
  const p = pgPreparo(i); if (!p || i.status === 'done') return '';
  const blq = p.bloqueado && ['backlog','todo','doing'].includes(i.status) ? '<span class="po-chip pg-blq" title="Bloqueado: depende de ' + esc(p.deps.map(x => leNomePg(x)).join(', ')) + ', ainda não aceito">Bloqueado</span>' : '';
  if (p.ok) return blq + '<span class="po-chip pg-ok" title="Preparado: tem história, critérios, prioridade, valor e pontos">Preparado</span>';
  return blq + '<span class="po-chip pg-falta" title="' + esc((p.faltas.length ? 'Falta: ' + p.faltas.join(', ') + '. ' : '') + (p.grande ? 'Grande demais (' + i.pontos + ' pontos, o limite é ' + (pgLim(i).grande - 1) + '): quebre em itens menores antes de começar.' : '')) + '">' + (p.grande ? 'Grande' : 'Falta ' + p.faltas.length) + '</span>';
}
const _poChipsHTMLPg = poChipsHTML;
poChipsHTML = function(i, curto){ const h = _poChipsHTMLPg.apply(this, arguments); return h ? h.replace('<span class="po-chips">', '<span class="po-chips">' + pgSeloHTML(i)) : h; };

/* ---------- 10 e 11: dependências na fila e decisões que travam itens ---------- */
function pgDependentes(i){ return D.issues.filter(x => !x.arquivado && x.id !== i.id && x.status !== 'done' && poDeps(x).some(d => d.id === i.id)); }
function pgCiclo(i){ const vistos = new Set(), pilha = [[i, 0]]; while (pilha.length){ const [x, n] = pilha.pop(); if (n > 30) continue; for (const d of poDeps(x)){ if (d.id === i.id) return true; if (!vistos.has(d.id)){ vistos.add(d.id); pilha.push([d, n + 1]); } } } return false; }
function pgForaDeOrdem(i){ const fila = poFila(i); const k = fila.indexOf(i); if (k < 0) return []; return poDepsAbertas(i).filter(d => fila.indexOf(d) > k); }

/* ---------- 13 e 23: ritmo, previsão e semáforo da versão ---------- */
function pgRitmo(chave){
  const its = issuesEm(chave).filter(i => i.status === 'done' && i.feito && !i.externa && +i.pontos > 0 && pgDias(i.feito) != null && pgDias(i.feito) <= pgLim().semanas * 7 && !i.decisao);
  return its.reduce((s, i) => s + (+i.pontos || 0), 0) / pgLim().semanas;   // pontos por semana
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
    add('aceite:' + i.id, 100 + Math.min(d, 9), 'Testar e aceitar ' + leNomePg(i), d >= pgLim(i).aceite ? 'Está em Pronto para testar há ' + d + ' dias. Item parado no teste segura a entrega.' : 'Está pronto para testar. Aceitar ou devolver logo mantém o ritmo.', {txt:'Abrir', item:i.id}); });
  // decisões e itens que travam outros (11)
  its.filter(i => i.decisao && i.status !== 'done').map(i => ({i, n:pgDependentes(i).length})).sort((a, b) => b.n - a.n || String(a.i.fim || '9').localeCompare(String(b.i.fim || '9'))).slice(0, 5).forEach(({i, n}) => { const v = i.fim ? pgDias(i.fim) : null;
    add('trava:' + i.id, 90 + Math.min(n, 9), 'Decidir: ' + leNomePg(i), (n ? 'Esta decisão trava ' + n + (n === 1 ? ' item' : ' itens') + '. ' : 'Decisão em aberto. ') + (i.fim ? (v > 0 ? 'Venceu há ' + v + (v === 1 ? ' dia' : ' dias') + '. ' : 'Vence em ' + fmtData(i.fim) + '. ') : 'Sem prazo de decisão. ') + 'Destravar antes de começar coisa nova.', {txt:'Abrir', item:i.id}); });
  // dependência fora de ordem e circular (10)
  its.filter(i => i.status !== 'done').forEach(i => { if (pgCiclo(i)) add('ciclo:' + i.id, 80, 'Dependência em círculo em ' + leNomePg(i), 'Este item depende, por outros, dele mesmo: nenhum dos dois consegue começar. Tire uma das dependências.', {txt:'Abrir', item:i.id});
    const fo = pgForaDeOrdem(i); if (fo.length) add('ordem:' + i.id, 40, 'Fora de ordem: ' + leNomePg(i), 'Está na frente de ' + fo.map(leNomePg).join(', ') + ', de que ele depende. Quem é dependido vem antes na fila.', {txt:'Ver a ordem sugerida', ordem:true}); });
  // item parado (16)
  its.filter(i => i.status === 'doing').forEach(i => { const d = pgDias(i._mudou); if (d != null && d >= pgLim(i).parado) add('parado:' + i.id, 50 + Math.min(d, 9), 'Parado: ' + leNomePg(i), 'Em andamento há ' + d + ' dias sem mudança. Se travou, marque Travado e diga o motivo; se ficou grande, quebre.', {txt:'Abrir', item:i.id}); });
  // refinar o topo da fila (4 e 5)
  const fila = its.filter(i => ['backlog','todo'].includes(i.status)).sort((a, b) => (+a.ordem || 0) - (+b.ordem || 0)).slice(0, 8);
  fila.forEach(i => { const p = pgPreparo(i); if (!p || p.ok) return; add('refinar:' + i.id, 30, (p.grande ? 'Quebrar ' : 'Refinar ') + leNomePg(i), p.grande ? 'Tem ' + i.pontos + ' pontos: item grande demais costuma atrasar. Quebre em itens de até 8 pontos.' : 'Está no topo da fila e falta: ' + p.faltas.join(', ') + '. Os do topo precisam estar preparados para começar.', {txt:'Abrir', item:i.id}); });
  // versão em risco (23) e sem meta (7)
  if (pj) ltVersoesDoProjeto().filter(m => m.tipo === 'release' && !m.entregue).forEach(m => { const p = pgPrevisao(m);
    if (p && p.cor === 'vermelho') add('versao:' + m.id, 70, 'Versão ' + m.nome + ' em risco', p.por.join('. ') + '. Corte itens Poderia ou de menor valor por ponto, ou combine outra data.', {txt:'Ver Entregas', view:'entregas'});
    if (!m.meta) add('vmeta:' + m.id, 20, 'Escrever a meta da versão ' + m.nome, 'Sem meta, não dá para saber se um item ajuda a entrega.', {txt:'Ver Entregas', view:'entregas'}); });
  issuesEm(chave).filter(i => i.tipo === 'epic' && !i.arquivado && i.status !== 'done' && !i.meta).slice(0, 3).forEach(e => add('emeta:' + e.id, 15, 'Escrever a meta do épico ' + e.titulo, 'A meta diz o que a entrega resolve; sem ela, a fila perde o rumo.', {txt:'Abrir', item:e.id}));
  // montar o projeto (1 e 2)
  if (pj && !pj.dod) add('dod:' + pj.id, 61, 'Escrever a Definição de Pronto de ' + pj.nome, 'É o que todo item precisa ter para ser aceito. Há um modelo pronto para começar.', {txt:'Escrever', dod:pj.id});
  if (pj && !pj.po) add('po:' + pj.id, 60, 'Definir o P.O. de ' + pj.nome, 'Sem P.O., qualquer um aceita. Com P.O., só ele aceita e devolve.', {txt:'Definir', po:pj.id});
  return A.sort((a, b) => b.peso - a.peso);
}
const leNomePg = x => (typeof chaveDe === 'function' && chaveDe(x) ? chaveDe(x) + ' ' : '') + '"' + x.titulo + '"';
function pgHojeHTML(chave){
  const A = pgAcoes(chave), mostra = A.slice(0, 5);
  const vs = cadeia(chave).project ? ltVersoesDoProjeto().filter(m => m.tipo === 'release' && !m.entregue).sort((a, b) => String(a.data).localeCompare(String(b.data))).slice(0, 4) : [];
  const sem = vs.map(m => ({m, p:pgPrevisao(m)})).filter(x => x.p);
  const pj = cadeia(chave).project, prog = pj ? pgGuiaProgresso(pj) : null;
  return '<section class="pg-hoje" aria-label="O que fazer hoje"><header><div><b>O que fazer hoje</b><span>O CicloDev olhou a fila e sugere, em ordem. Você decide.</span></div>' +
    (pj ? '<span class="pg-bts"><button type="button" class="btn ' + (prog.feitos < prog.total ? '' : 'sec ') + 'peq" data-pg-guia>Montar o projeto · ' + prog.feitos + ' de ' + prog.total + '</button><button type="button" class="btn fant peq" data-pg-limites>Limites</button></span>' : '') + '</header>' +
    (mostra.length ? '<ol>' + mostra.map(a => '<li><div><b>' + esc(a.tit) + '</b><small>' + esc(a.por) + '</small></div><span class="pg-bts">' +
      '<button type="button" class="btn sec peq" data-pg-ir="' + esc(JSON.stringify(a.botao)) + '">' + esc(a.botao.txt) + '</button><button type="button" class="btn fant peq" data-pg-sil="' + esc(a.k) + '" title="Não mostrar este aviso por 7 dias">Silenciar</button></span></li>').join('') + '</ol>' +
      (A.length > 5 ? '<p class="po-nota">E mais ' + (A.length - 5) + ' sugestões de menor peso.</p>' : '')
      : '<p class="po-nota">Nada urgente: a fila está preparada e nada está parado.</p>') +
    (sem.length ? '<div class="pg-sems">' + sem.map(({m, p}) => '<span class="pg-sem pg-' + p.cor + '" title="' + esc(p.por.join('. ') || 'Ritmo e preparo dentro do esperado') + '">' + esc(m.nome) + ': ' + PG_COR[p.cor] + (p.prev ? ' · previsão ' + fmtData(p.prev) : '') + '</span>').join('') + '</div>' : '') + '</section>';
}
const _rViewPg = rView;
rView = function(){
  const r = _rViewPg.apply(this, arguments);
  try { if (UI.view === 'backlog' && UI.modulo === 'operacoes' && cadeia(UI.sel).project){ const c = $('#ops-corpo'); if (c && !$('.pg-hoje', c)) c.insertAdjacentHTML('afterbegin', pgHojeHTML(UI.sel)); } } catch(e){ console.warn('P.O. hoje', e); }
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
/* ---------- limites do método, por projeto ---------- */
function pgLimites(pj){
  const l = Object.assign({}, PG_PADRAO, pj.poLimites || {});
  const campo = (k, rot, ajuda, min, max) => '<label class="lb">' + rot + '<input class="campo" type="number" min="' + min + '" max="' + max + '" id="pg-l-' + k + '" value="' + l[k] + '"><small class="jn-ajuda">' + ajuda + '</small></label>';
  modal('Limites do método: ' + pj.nome, '<p class="sec tf-nota" style="margin-top:0">São sugestões do CicloDev (não regras do método). Valem só para este projeto.</p><div class="grade-form">' +
    campo('parado', 'Dias para avisar item parado', 'Em andamento sem mudança há esse tanto de dias (padrão 5)', 1, 60) +
    campo('aceite', 'Dias para lembrar o aceite', 'Em Pronto para testar há esse tanto de dias (padrão 3)', 1, 60) +
    campo('grande', 'Pontos para "grande demais"', 'A partir deste número de pontos, pede para quebrar (padrão 13)', 2, 100) +
    campo('semanas', 'Semanas para medir o ritmo', 'Quantas semanas de pontos aceitos entram na previsão (padrão 4)', 1, 26) + '</div>',
    [{txt:'Voltar ao padrão', cls:'sec', acao:() => { pj.poLimites = {}; salvar(); rView(); toast('Limites no padrão.'); }}, {txt:'Cancelar', cls:'sec'}, {txt:'Guardar', acao:d => {
      const n = {}; Object.keys(PG_PADRAO).forEach(k => { const v = Math.round(+$('#pg-l-' + k, d).value); if (v > 0) n[k] = v; }); pj.poLimites = n; salvar(); rView(); toast('Limites guardados para ' + pj.nome + '.'); }}]);
}
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-pg-limites]')){ const pj = cadeia(UI.sel).project; if (pj) pgLimites(pj); } });

/* ---------- 1: guia "Montar o projeto" (9 passos; o passo só vale feito quando o sistema confere) ---------- */
// o filtro "não preparados" da Lista (passo 7)
const _listaFiltradaPg = listaFiltrada;
listaFiltrada = function(){ let l = _listaFiltradaPg.apply(this, arguments); if ((UI.poF || {}).prep === 'nao') l = l.filter(i => { const p = pgPreparo(i); return p && !p.ok && i.status !== 'done'; }); return l; };
const pgLinhas = t => String(t || '').split('\n').map(x => x.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
const PG_GUIA = [
  {tit:'Visão e meta', texto:'Escreva em uma frase para que serve o projeto e o que ele precisa conseguir. Exemplo: "O analista de cobrança fecha o mês, gera os Pix e confere o dinheiro que entrou sem usar planilha."', nota:'A meta precisa dizer o resultado para a pessoa que usa, não a tecnologia.', perg:'Qual é a visão do projeto em uma frase? Escreva aqui e eu guardo como meta do projeto.',
    campo:'visao', confere:pj => !!String(pj.visao || '').trim(), falta:'O projeto ainda não tem a visão escrita.'},
  {tit:'Partes interessadas e quem é o P.O.', texto:'Diga quem usa o sistema, quem decide e quem paga. Escolha também quem é o P.O. do projeto, que é a pessoa que aceita ou devolve cada item. Se o time for uma pessoa só, o P.O. é ela mesma e o sistema vai pedir que você confira cada critério antes de aceitar.', nota:'Sem P.O. definido, qualquer pessoa do time pode aceitar. Definir o P.O. protege o método.', perg:'Quem é o P.O. deste projeto, e quem são as outras partes interessadas?',
    campo:'partes', po:true, confere:pj => !!pj.po, falta:'O projeto ainda não tem P.O. definido.'},
  {tit:'Valor e como medir o sucesso', texto:'Escolha 1 a 3 sinais que mostram que o projeto deu certo. Pode ser dinheiro economizado ou recebido, tempo ganho ou menos erro. Exemplo: "Fechar o mês em 1 dia em vez de 5."', nota:'Valor entregue é diferente de quantidade de tarefas feitas.', perg:'Como você vai saber que o projeto deu certo? Diga até 3 sinais com número, se souber.',
    campo:'sucesso', confere:pj => /\d|\b(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/i.test(pj.sucesso || ''), falta:'Os sinais de sucesso ainda não têm um número ou uma data para medir (ex.: "fechar o mês em 1 dia" ou "medir em 31/12/2026").'},
  {tit:'Versões com data e meta', texto:'Divida a entrega em versões. Cada versão precisa de data de entrega e de uma meta de uma frase. Comece pequeno: a primeira versão deve entregar algo que já dá para usar. Evite data na sexta-feira.', nota:'Versão nova sem data não é aceita pelo sistema.', perg:'Quais são as versões, a data de cada uma e a meta de cada uma?',
    abrir:['Abrir Entregas', () => { UI.view = 'entregas'; salvarUI(); rOperacoes(); }], confere:() => ltVersoesDoProjeto().some(m => m.tipo === 'release' && m.data && String(m.meta || '').trim()), falta:'Ainda não há versão com data e meta (a meta se escreve em Entregas, em cada versão).'},
  {tit:'Definição de Pronto', texto:'Escolha as regras que todo item precisa cumprir para ser aceito. O sistema oferece um modelo para você marcar o que vale para o seu projeto. Exemplos: "testado por quem pediu", "sem bug conhecido", "documentação atualizada".', nota:'Pronto é uma lista combinada com o time. Ela aparece como lembrete em todo item.', perg:'Quais regras de pronto valem para este projeto? Quer começar pelo modelo padrão?',
    abrir:['Abrir a Definição de Pronto', pj => poEditarDod(pj, () => pgGuiaDesenhar())], confere:pj => pgLinhas(pj.dod).length >= 3, falta:'A Definição de Pronto precisa de pelo menos 3 regras.'},
  {tit:'Épicos e itens', texto:'Liste as entregas grandes (épicos) e, dentro de cada uma, os itens. Dê a cada item um título curto que comece com um verbo. Você pode digitar um por um ou colar vários de uma vez no Criar em lote.', nota:'Item muito grande deve ser quebrado. O sistema avisa quando passa do limite de pontos, que é editável.', perg:'Quais são as entregas grandes do projeto e quais itens entram em cada uma?',
    abrir:['Abrir Criar em lote', () => ltAbrir()], confere:pj => { const its = issuesEm('project:' + pj.id); return its.some(e => e.tipo === 'epic' && its.some(x => x.pai === e.id)); }, falta:'Ainda não há épico com itens dentro.'},
  {tit:'História, critérios de aceite e prioridade', texto:'Para os itens do topo, escreva: "Como [quem], quero [o quê], para [por quê]". Depois escreva os critérios, cada um com resposta sim ou não ("Salva nome e CPF"). Por fim, escolha a prioridade (Deve, Deveria, Poderia ou Não terá agora), o valor de 1 a 10 e os pontos.', nota:'O item só ganha o selo Preparado quando tem tudo isso, mais versão e tamanho dentro do limite. Deixe pronto primeiro o que vai ser feito primeiro.', perg:'Quer que eu mostre os itens do topo que ainda não estão preparados e o que falta em cada um?',
    abrir:['Mostrar os não preparados', () => { UI.poF = Object.assign({}, UI.poF, {prep:'nao'}); UI.view = 'list'; salvarUI(); rOperacoes(); toast('Lista com os itens ainda não preparados. Para tirar o filtro, use Limpar nos filtros.'); }],
    confere:pj => { const fila = issuesEm('project:' + pj.id).filter(i => poTemPO(i) && !i.externa && !i.decisao && ['backlog','todo'].includes(i.status)).sort((a, b) => (+a.ordem || 0) - (+b.ordem || 0)).slice(0, 5); return fila.length > 0 && fila.every(i => (pgPreparo(i) || {}).ok); }, falta:'Os 5 primeiros da fila ainda não estão todos Preparados.'},
  {tit:'Riscos e o que ainda não foi verificado', texto:'Liste o que pode dar errado e o que você ainda não confirmou. Para cada risco, diga quem cuida e quando revisar. Decisões que ainda estão abertas viram itens do tipo Decisão, com prazo (no Criar em lote: tipo: Decisão e prazo:).', nota:'O sistema avisa quando uma decisão aberta trava itens.', perg:'Quais são os maiores riscos e quais decisões ainda estão abertas?',
    campo:'riscos', nenhum:true, abrir:['Abrir Criar em lote (para as decisões)', () => ltAbrir()], confere:pj => !!String(pj.riscos || '').trim() || pj.riscosNenhum || issuesEm('project:' + pj.id).some(i => i.decisao), falta:'Ainda não há risco escrito nem decisão registrada (ou marque que não há).'},
  {tit:'Rotina de acompanhamento', texto:'Combine uma rotina simples. Todo dia, olhe a lista O que fazer hoje. Toda semana, olhe o resumo da versão. Ao fechar uma versão, faça a revisão do ciclo: o que entregou, o que foi devolvido e o que aprendeu.', nota:'O sistema sugere e você decide. Ele nunca aceita, devolve nem muda a ordem sozinho.', perg:'Quer receber o relatório da semana por e-mail? Hoje ele sai toda segunda às 8h.',
    abrir:['Abrir as preferências de avisos', () => { if (typeof cmPreferencias === 'function') cmPreferencias(); }], confere:() => !!(typeof CM !== 'undefined' && CM.prefs && CM.prefs.relatorio_semanal), falta:'O relatório da semana ainda não está ligado nas preferências de avisos.'}
];
const PG_FAQ = [['O que é o selo Preparado?', 'O item está bem escrito e pode começar: tem história, critério, prioridade, valor, pontos, versão e tamanho dentro do limite.'],
  ['O que é Bloqueado?', 'O item depende de outro que ainda não foi aceito. Ele pode estar Preparado e mesmo assim esperar.'],
  ['Sou uma pessoa só. Preciso de P.O.?', 'Sim, o papel existe. Você acumula os dois, e o sistema pede que confira os critérios um a um antes de aceitar.'],
  ['Por que meu item é "grande demais"?', 'Tem mais pontos que o limite do projeto. Quebre em itens menores para a estimativa ficar confiável.'],
  ['Posso mudar os limites?', 'Sim, no botão Limites, ao lado de O que fazer hoje. Valem só para este projeto.'],
  ['Posso pular um passo?', 'Pode. Use "Pular por agora" e volte depois. O passo só fica marcado como feito quando o sistema confere.']];
function pgGuiaProgresso(pj){ const ok = PG_GUIA.map(p => { try { return !!p.confere(pj); } catch(e){ return false; } }); return {ok, feitos:ok.filter(Boolean).length, total:PG_GUIA.length}; }
const PG_GUIA_EST = {pj:null, passo:-1, aba:''};
function pgGuiaAbrir(){
  const pj = cadeia(UI.sel).project; if (!pj){ toast('Escolha um projeto na Estrutura'); return; }
  if (typeof cmLerPrefs === 'function') Promise.resolve(cmLerPrefs()).then(() => pgGuiaDesenhar()).catch(() => {});
  let k = -1; try { k = +(localStorage.getItem('ciclodev-guia-projeto-' + pj.id) || -1); } catch(e){}
  Object.assign(PG_GUIA_EST, {pj, passo:k, aba:''});
  modal('Montar o projeto: ' + pj.nome, '<div class="pg-guia"></div>', [{txt:'Fechar', cls:'sec'}]);
  const dl = document.querySelector('dialog.modal:last-of-type'); if (dl) dl.classList.add('pg-guia-modal');
  pgGuiaDesenhar();
}
function pgGuiaDesenhar(){
  const box = $('dialog.pg-guia-modal[open] .pg-guia'); const pj = PG_GUIA_EST.pj; if (!box || !pj) return;
  const prog = pgGuiaProgresso(pj), k = PG_GUIA_EST.passo;
  try { localStorage.setItem('ciclodev-guia-projeto-' + pj.id, String(k)); } catch(e){}
  const lado = '<ol class="pg-g-lado">' + PG_GUIA.map((p, n) => '<li class="' + (n === k ? 'atual ' : '') + (prog.ok[n] ? 'ok' : '') + '"><button type="button" data-pg-g-ir="' + n + '">' + (prog.ok[n] ? '✓ ' : '') + (n + 1) + '. ' + esc(p.tit) + '</button></li>').join('') + '</ol>';
  let meio;
  if (k < 0) meio = '<p class="pg-g-txt">Vou te ajudar a montar o projeto do jeito que um Product Owner faria, um passo por vez. São 9 passos curtos. Ao final, o projeto terá meta, versões com data, regras de pronto, itens e riscos. Você pode parar e voltar quando quiser. Vamos começar?</p>' +
    '<p class="po-nota">' + prog.feitos + ' de ' + prog.total + ' passos já conferidos pelo sistema.</p><div class="po-acoes"><button type="button" class="btn peq" data-pg-g-ir="' + Math.max(0, prog.ok.indexOf(false)) + '">' + (prog.feitos ? 'Continuar do passo ' + (Math.max(0, prog.ok.indexOf(false)) + 1) : 'Começar') + '</button></div>';
  else if (k >= PG_GUIA.length) meio = '<p class="pg-g-txt">' + (prog.feitos === prog.total ? 'Pronto! O projeto está montado: tem meta, P.O., versões com data, Definição de Pronto, itens e riscos. A partir de agora, comece o dia pela lista O que fazer hoje. Se algo mudar, você pode voltar a qualquer passo deste guia.' : 'Você chegou ao fim, mas ' + (prog.total - prog.feitos) + (prog.total - prog.feitos === 1 ? ' passo ainda não confere' : ' passos ainda não conferem') + '. Clique neles ao lado para completar.') + '</p>';
  else {
    const p = PG_GUIA[k], ok = prog.ok[k], pes = D.people.filter(x => x.ativo !== false);
    meio = '<p class="pg-g-num">Passo ' + (k + 1) + ' de ' + PG_GUIA.length + '</p><h3 class="pg-g-tit">' + esc(p.tit) + '</h3><p class="pg-g-txt">' + esc(p.texto) + '</p>' + (p.nota ? '<p class="pg-g-nota">' + esc(p.nota) + '</p>' : '') +
      '<p class="pg-g-perg"><b>' + esc(p.perg) + '</b></p>' +
      (p.po ? '<label class="lb">P.O. do projeto<select class="sel" data-pg-g-po><option value="">Escolha a pessoa</option>' + pes.map(x => '<option value="' + esc(x.id) + '"' + (x.id === pj.po ? ' selected' : '') + '>' + esc(x.nome) + '</option>').join('') + '</select></label>' : '') +
      (p.campo ? '<label class="lb" for="pg-g-campo">' + ({visao:'Visão do projeto', partes:'Partes interessadas (quem usa, quem decide, quem paga)', sucesso:'Sinais de sucesso', riscos:'Riscos e o que ainda não foi verificado'}[p.campo] || '') + '</label><textarea id="pg-g-campo" class="campo" rows="3" data-pg-g-campo="' + p.campo + '" maxlength="' + (p.campo === 'visao' ? 1000 : 4000) + '" placeholder="Escreva aqui">' + esc(pj[p.campo] || '') + '</textarea><button type="button" class="btn sec peq" data-pg-g-guardar style="justify-self:start">Guardar</button>' : '') +
      (p.nenhum ? '<label class="cm-ck"><input type="checkbox" data-pg-g-nenhum' + (pj.riscosNenhum ? ' checked' : '') + '> Não há riscos nem decisões abertas agora</label>' : '') +
      '<p class="pg-g-conf ' + (ok ? 'ok' : '') + '">' + (ok ? '✓ O sistema conferiu: este passo está feito.' : 'Ainda não confere: ' + esc(p.falta)) + '</p>' +
      '<div class="po-acoes">' + (p.abrir ? '<button type="button" class="btn sec peq" data-pg-g-abrir>' + esc(p.abrir[0]) + '</button>' : '') +
        '<button type="button" class="btn peq" data-pg-g-feito>Feito, próximo passo</button><button type="button" class="btn fant peq" data-pg-g-pular>Pular por agora</button>' +
        '<button type="button" class="btn fant peq" data-pg-g-aba="duvida">Tenho uma dúvida</button><button type="button" class="btn fant peq" data-pg-g-aba="erro">Deu erro</button></div>' +
      (PG_GUIA_EST.aba === 'duvida' ? '<div class="pg-g-faq">' + PG_FAQ.map(([q, r]) => '<details><summary>' + esc(q) + '</summary><p>' + esc(r) + '</p></details>').join('') + '<p class="po-nota">Não achou? Pergunte ao DevIT, no botão de conversa do canto da tela.</p></div>' : '') +
      (PG_GUIA_EST.aba === 'erro' ? '<div class="pg-g-faq"><p>Diga ao DevIT (botão de conversa do canto da tela) o que você fez e a mensagem que apareceu. Se o erro foi ao gravar, a mensagem do banco aparece no aviso do canto. O guia continua deste mesmo passo quando você voltar.</p></div>' : '');
  }
  box.innerHTML = '<div class="pg-g-grade">' + lado + '<div class="pg-g-meio">' + meio + '</div></div>';
}
document.addEventListener('click', e => {
  if (e.target.closest && e.target.closest('[data-pg-guia]')){ pgGuiaAbrir(); return; }
  const box = e.target.closest && e.target.closest('dialog.pg-guia-modal'); if (!box) return;
  const pj = PG_GUIA_EST.pj, k = PG_GUIA_EST.passo, p = PG_GUIA[k];
  const ir = e.target.closest('[data-pg-g-ir]'); if (ir){ PG_GUIA_EST.passo = +ir.dataset.pgGIr; PG_GUIA_EST.aba = ''; pgGuiaDesenhar(); return; }
  if (e.target.closest('[data-pg-g-aba]')){ const a = e.target.closest('[data-pg-g-aba]').dataset.pgGAba; PG_GUIA_EST.aba = PG_GUIA_EST.aba === a ? '' : a; pgGuiaDesenhar(); return; }
  if (e.target.closest('[data-pg-g-pular]')){ PG_GUIA_EST.passo = k + 1; PG_GUIA_EST.aba = ''; pgGuiaDesenhar(); return; }
  if (e.target.closest('[data-pg-g-guardar]')){ const t = $('[data-pg-g-campo]', box); if (t){ pj[t.dataset.pgGCampo] = t.value.trim(); salvar(); toast('Guardado.'); pgGuiaDesenhar(); rView(); } return; }
  if (e.target.closest('[data-pg-g-abrir]') && p && p.abrir){ p.abrir[1](pj); return; }
  if (e.target.closest('[data-pg-g-feito]') && p){
    const t = $('[data-pg-g-campo]', box); if (t && t.value.trim() !== String(pj[t.dataset.pgGCampo] || '')){ pj[t.dataset.pgGCampo] = t.value.trim(); salvar(); }
    if (!p.confere(pj)){ toast('Este passo ainda não confere: ' + p.falta + ' Se quiser, use Pular por agora.'); pgGuiaDesenhar(); return; }
    PG_GUIA_EST.passo = k + 1; PG_GUIA_EST.aba = ''; pgGuiaDesenhar(); rView(); return; }
});
document.addEventListener('change', e => {
  const box = e.target.closest && e.target.closest('dialog.pg-guia-modal'); if (!box) return; const pj = PG_GUIA_EST.pj;
  if (e.target.matches('[data-pg-g-po]')){ const atual = pj.po && pessoa(pj.po); if (atual && atual.ativo !== false && atual.id !== eu() && e.target.value !== pj.po){ toast('Só o P.O. atual (' + atual.nome + ') passa o papel para outra pessoa.'); pgGuiaDesenhar(); return; } pj.po = e.target.value || null; salvar(); pgGuiaDesenhar(); rView(); }
  if (e.target.matches('[data-pg-g-nenhum]')){ pj.riscosNenhum = e.target.checked; salvar(); pgGuiaDesenhar(); }
});
// ao voltar de uma janela aberta pelo guia (Criar em lote, Definição de Pronto, preferências), o guia confere de novo
new MutationObserver(() => { if ($('dialog.pg-guia-modal[open]')) setTimeout(pgGuiaDesenhar, 50); }).observe(document.body, {childList:true});

if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {cadeia, pgGuiaAbrir, pgGuiaProgresso, pgLimites, pgPreparo, pgAcoes, pgPrevisao, pgOrdemSugerida, abrirItem, mudarStatus});
