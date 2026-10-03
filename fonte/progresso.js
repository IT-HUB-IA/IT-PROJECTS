/* =====================================================================
   Progresso por frente (e por parte) com regra única. Prefixo pg2.
   - Conta só itens de trabalho (história, tarefa, bug...), nunca épico: o épico é a soma dos filhos.
   - Pesa pelos pontos; item sem pontos vale a média de pontos da lista (ou 1, se ninguém tem pontos).
   - Cinco faixas: Aceito · Pronto, falta aceitar (em revisão) · Em andamento · Bloqueado · A fazer.
   - Dois números: % aceito (entregue de verdade) e % construído (aceito + pronto, falta aceitar).
   A mesma conta vale no painel, na tabela "Por parte" e na saúde (metricas), para os números nunca brigarem.
   ===================================================================== */
const PG2_FAIXAS = [
  {k:'done',    nome:'Aceito',                 st:['done']},
  {k:'review',  nome:'Pronto, falta aceitar',  st:['review']},
  {k:'doing',   nome:'Em andamento',           st:['doing']},
  {k:'blocked', nome:'Bloqueado',              st:['blocked']},
  {k:'afazer',  nome:'A fazer',                st:['backlog','todo']}
];
const pg2Trabalho = l => l.filter(i => i.tipo !== 'epic');
function progressoDe(lista){
  const l = pg2Trabalho(lista || []);
  const comPts = l.filter(i => +i.pontos > 0), media = comPts.length ? comPts.reduce((s, i) => s + +i.pontos, 0) / comPts.length : 1;
  const peso = i => +i.pontos > 0 ? +i.pontos : media;
  const total = l.reduce((s, i) => s + peso(i), 0);
  const f = {}; PG2_FAIXAS.forEach(x => { const its = l.filter(i => x.st.includes(i.status)); f[x.k] = {n:its.length, pts:its.reduce((s, i) => s + peso(i), 0)}; });
  // situação fora das cinco (fluxo próprio sem grupo conhecido): entra em A fazer
  const conhecidos = PG2_FAIXAS.reduce((s, x) => s + f[x.k].n, 0);
  if (conhecidos < l.length){ const resto = l.filter(i => !PG2_FAIXAS.some(x => x.st.includes(i.status))); f.afazer.n += resto.length; f.afazer.pts += resto.reduce((s, i) => s + peso(i), 0); }
  const pc = k => total ? f[k].pts / total * 100 : 0;
  const crit = {t:0, f:0}; if (typeof poCrit === 'function') l.forEach(i => poCrit(i).forEach(c => { if (String(c.t || '').trim()){ crit.t++; if (c.f) crit.f++; } }));
  const limite = dAdd(HOJE, -14);
  return {n:l.length, total, faixas:f, pc, aceito:Math.round(pc('done')), construido:Math.round(pc('done') + pc('review')),
    atrasados:l.filter(atrasado).length, semPontos:l.length - comPts.length, crit, aceitos14:l.filter(i => i.status === 'done' && i.feito && parse(i.feito) > limite).length};
}
const pg2Num = v => (Math.round(v * 10) / 10).toLocaleString('pt-BR');
// a barra empilhada: cada faixa com a largura do peso dela, separadas por 2px; clique leva à lista filtrada naquela situação
function pg2Barra(no, p, grande){
  if (!p.n) return '<span class="pg2-bar vazia" aria-hidden="true"></span>';
  return '<span class="pg2-bar' + (grande ? ' grande' : '') + '" role="img" aria-label="' + esc(PG2_FAIXAS.map(x => x.nome + ' ' + Math.round(p.pc(x.k)) + '%').join(', ')) + '">' +
    PG2_FAIXAS.filter(x => p.faixas[x.k].n).map(x => '<i class="pg2-' + x.k + '" style="flex:' + p.faixas[x.k].pts.toFixed(3) + ' 1 0" data-pg2-no="' + esc(no) + '" data-pg2-st="' + x.k + '" title="' + esc(x.nome + ': ' + p.faixas[x.k].n + (p.faixas[x.k].n === 1 ? ' item' : ' itens') + ' · ' + pg2Num(p.faixas[x.k].pts) + ' pontos (' + Math.round(p.pc(x.k)) + '%). Clique para ver a lista.') + '"></i>').join('') + '</span>';
}
function pg2Sinais(p){
  const s = [];
  if (p.faixas.blocked.n) s.push('<span class="pg2-s alerta">' + p.faixas.blocked.n + (p.faixas.blocked.n === 1 ? ' bloqueado' : ' bloqueados') + '</span>');
  if (p.atrasados) s.push('<span class="pg2-s alerta">' + p.atrasados + (p.atrasados === 1 ? ' atrasado' : ' atrasados') + '</span>');
  if (p.semPontos) s.push('<span class="pg2-s">' + p.semPontos + ' sem pontos</span>');
  if (p.crit.t) s.push('<span class="pg2-s">' + p.crit.f + ' de ' + p.crit.t + ' critérios comprovados</span>');
  s.push('<span class="pg2-s">' + (p.aceitos14 ? p.aceitos14 + ' aceitos em 14 dias' : 'nenhum aceito em 14 dias') + '</span>');
  return '<span class="pg2-sinais">' + s.join('') + '</span>';
}
function pg2Linha(no, nome, p, total){
  return '<div class="pg2-lin' + (total ? ' total' : '') + '"><button type="button" class="pg2-nome" data-ir="' + esc(no) + '" title="Abrir ' + esc(nome) + '">' + esc(nome) + '</button>' + pg2Barra(no, p, total) +
    '<span class="pg2-num"><b>' + p.aceito + '%</b><small>aceito</small><em>' + p.construido + '% construído</em></span>' + pg2Sinais(p) + '</div>';
}
// o bloco inteiro: total no topo, uma linha por parte com itens, as vazias recolhidas no fim, e a legenda com os totais
function progressoPartesHTML(chave, nos, rot, opts){
  const filtrar = l => opts && opts.soCliente ? l.filter(i => i.vis === 'cliente' || i.status === 'done') : l;
  const linhas = nos.map(f => ({f, p:progressoDe(filtrar(issuesEm(f)))}));
  const cheias = linhas.filter(x => x.p.n), vazias = linhas.filter(x => !x.p.n);
  const tudo = progressoDe(filtrar(issuesEm(chave)));
  const legenda = '<div class="pc-leg pg2-leg">' + PG2_FAIXAS.map(x => '<span><i class="pg2-' + x.k + '"></i>' + esc(x.nome) + ' <b>' + Math.round(tudo.pc(x.k)) + '%</b></span>').join('') + '</div>';
  return '<section class="pc-c pg2"><h3>Progresso por ' + esc(rot) + '<span>' + cheias.length + (vazias.length ? ' de ' + nos.length : '') + '</span>' + I('Conta só itens de trabalho (épico não conta: ele é a soma dos filhos), pesados pelos pontos; item sem pontos vale a média. Aceito: o P.O. aceitou. Construído: aceito mais o que está pronto e falta aceitar.') + '</h3>' +
    (nos.length > 1 && tudo.n ? pg2Linha(chave, 'Total', tudo, true) : '') +
    '<div class="pg2-lista">' + (cheias.length ? cheias.map(x => pg2Linha(x.f, nomeDe(x.f), x.p)).join('') : '<p class="vazio-linha">Nenhum item de trabalho aqui ainda.</p>') + '</div>' +
    (vazias.length ? '<details class="pg2-vazias"><summary>+ ' + vazias.length + (vazias.length === 1 ? ' sem itens' : ' sem itens') + '</summary><div class="pg2-lista">' + vazias.map(x => '<div class="pg2-lin vazia"><button type="button" class="pg2-nome" data-ir="' + esc(x.f) + '">' + esc(nomeDe(x.f)) + '</button><span class="pg2-bar vazia"></span><span class="pg2-num"><small>sem itens</small></span></div>').join('') + '</div></details>' : '') +
    legenda + '</section>';
}
// a saúde e a tabela "Por parte" usam a mesma conta (sem épicos, pesada pelos pontos)
const _metricasPg2 = metricas;
metricas = function(lista){
  const m = _metricasPg2(pg2Trabalho(lista || [])), p = progressoDe(lista);
  m.prog = p.aceito; m.construido = p.construido; m.and = p.faixas.doing.n + p.faixas.review.n;
  return m;
};
// clique numa faixa: abre a lista daquela parte, já filtrada naquela situação
document.addEventListener('click', e => {
  const s = e.target.closest('[data-pg2-st]'); if (!s) return;
  e.preventDefault(); e.stopPropagation();
  const no = s.dataset.pg2No, st = s.dataset.pg2St;
  UI.sel = no; UI.view = 'table';
  UI.busca = st === 'afazer' ? '' : 'status = ' + stNome(st).toLowerCase();
  salvarUI();
  if (UI.modulo !== 'operacoes') abrirModulo('operacoes'); else rOperacoes();
}, true);
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {progressoDe, progressoPartesHTML});
