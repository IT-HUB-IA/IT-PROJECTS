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
// o que não cabe na linha vai no texto ao passar o mouse
function pg2Detalhe(nome, p){
  if (!p.n) return nome + ': sem itens';
  return nome + ' · ' + PG2_FAIXAS.map(x => x.nome + ' ' + p.faixas[x.k].n + ' (' + Math.round(p.pc(x.k)) + '%)').join(' · ') +
    (p.atrasados ? ' · ' + p.atrasados + ' atrasados' : '') + (p.semPontos ? ' · ' + p.semPontos + ' sem pontos' : '') +
    (p.crit.t ? ' · ' + p.crit.f + ' de ' + p.crit.t + ' critérios comprovados' : '') + ' · ' + (p.aceitos14 ? p.aceitos14 + ' aceitos em 14 dias' : 'nenhum aceito em 14 dias');
}
// no mesmo formato e tamanho do cartão de antes (pp, pp-lin, pp-bar): nome | barra em cinco faixas | % aceito com % construído embaixo
function pg2Linha(no, nome, p){
  const alerta = [p.faixas.blocked.n ? p.faixas.blocked.n + (p.faixas.blocked.n === 1 ? ' bloqueado' : ' bloqueados') : '', p.atrasados ? p.atrasados + (p.atrasados === 1 ? ' atrasado' : ' atrasados') : ''].filter(Boolean).join(' · ');
  return '<button type="button" class="pp-lin pg2-lin' + (p.n ? '' : ' vazia') + '" data-ir="' + esc(no) + '" title="' + esc(pg2Detalhe(nome, p)) + '">' +
    '<span class="pp-nome">' + esc(nome) + (alerta ? '<small class="pg2-alerta">' + esc(alerta) + '</small>' : '') + '</span>' +
    '<span class="pp-bar pg2-bar">' + (p.n ? PG2_FAIXAS.filter(x => p.faixas[x.k].n).map(x => '<i class="pg2-' + x.k + '" style="flex:' + p.faixas[x.k].pts.toFixed(3) + ' 1 0" data-pg2-no="' + esc(no) + '" data-pg2-st="' + x.k + '" title="' + esc(x.nome + ': ' + p.faixas[x.k].n + (p.faixas[x.k].n === 1 ? ' item' : ' itens') + ' · ' + pg2Num(p.faixas[x.k].pts) + ' pontos (' + Math.round(p.pc(x.k)) + '%). Clique para ver a lista.') + '"></i>').join('') : '') + '</span>' +
    '<b>' + (p.n ? p.aceito + '%<small>' + p.construido + '% constr.</small>' : '–<small>sem itens</small>') + '</b></button>';
}
// o cartão: mesma estrutura do de antes (título, uma linha por parte, legenda); o total vai na legenda
function progressoPartesHTML(chave, nos, rot, opts){
  const filtrar = l => opts && opts.soCliente ? l.filter(i => i.vis === 'cliente' || i.status === 'done') : l;
  const tudo = progressoDe(filtrar(issuesEm(chave)));
  const linhas = nos.map(f => ({f, p:progressoDe(filtrar(issuesEm(f)))}));
  return '<section class="pc-c pg2"><h3>Progresso por ' + esc(rot) + '<span>' + nos.length + '</span></h3>' +
    '<div class="pp">' + linhas.map(x => pg2Linha(x.f, nomeDe(x.f), x.p)).join('') + '</div>' +
    '<div class="pc-leg pg2-leg">' + PG2_FAIXAS.map(x => '<span><i class="pg2-' + x.k + '"></i>' + esc(x.nome) + '</span>').join('') +
    '<span class="pg2-tot" title="' + esc(pg2Detalhe('Total', tudo)) + '">Total: <b>' + tudo.aceito + '%</b> aceito · <b>' + tudo.construido + '%</b> construído' + I('Conta só itens de trabalho (épico não conta: ele é a soma dos filhos), pesados pelos pontos; item sem pontos vale a média. Aceito: o P.O. aceitou. Construído: aceito mais o que está pronto e falta aceitar. Passe o mouse numa linha para ver o detalhe; clique numa cor para ver a lista.') + '</span></div></section>';
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
