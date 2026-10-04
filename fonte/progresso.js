/* =====================================================================
   Progresso por frente (e por parte) com regra única. Prefixo pg2.
   - Conta só itens de trabalho (história, tarefa, bug...), nunca épico: o épico é a soma dos filhos.
   - Pesa pelos pontos; item sem pontos vale a média de pontos da lista (ou 1, se ninguém tem pontos).
   - Cinco faixas: Aceito · Pronto, falta aceitar (em revisão) · Em andamento · Bloqueado · A fazer.
   - Três números: % de progresso (conta o trabalho em andamento, ver pg2Avanco), % aceito (entregue de verdade)
     e % construído (aceito + pronto, falta aceitar). O número grande é o progresso.
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
/* quanto de um item já foi feito (0 a 1):
   aceito 1 · pronto, falta aceitar 0,9 · em andamento ou bloqueado: a parte feita dos subitens (ou da checklist
   e dos critérios), entre 0,1 e 0,85; sem nada para medir, 0,5 · a fazer: 0, a não ser que já tenha subitens andando */
function pg2Avanco(i, _vistos){
  if (!i) return 0;
  if (i.status === 'done') return 1;
  if (i.status === 'review') return 0.9;
  const vistos = _vistos || new Set(); vistos.add(i.id);
  const filhos = (D.issues || []).filter(x => x.pai === i.id && !x.arquivado && !vistos.has(x.id));
  let parte = null;
  if (filhos.length) parte = filhos.reduce((s, x) => s + pg2Avanco(x, vistos), 0) / filhos.length;
  else {
    const ck = (i.check || []).filter(c => String(c.t || '').trim()), cr = (typeof poCrit === 'function' ? poCrit(i) : []).filter(c => String(c.t || '').trim());
    const n = ck.length + cr.length; if (n) parte = (ck.filter(c => c.f).length + cr.filter(c => c.f).length) / n;
  }
  if (i.status === 'doing' || i.status === 'blocked') return parte === null ? 0.5 : Math.min(0.85, Math.max(0.1, parte));
  return filhos.length && parte ? Math.min(0.85, parte) : 0;
}
// progresso (0 a 100) de uma lista qualquer, com a mesma regra: sem épicos quando há itens de trabalho, pesado pelos pontos
function progressoPct(lista){
  const l = (lista || []).filter(Boolean); if (!l.length) return 0;
  const t = pg2Trabalho(l), base = t.length ? t : l;
  const comPts = base.filter(i => +i.pontos > 0), media = comPts.length ? comPts.reduce((s, i) => s + +i.pontos, 0) / comPts.length : 1;
  const peso = i => +i.pontos > 0 ? +i.pontos : media, total = base.reduce((s, i) => s + peso(i), 0);
  return total ? Math.round(base.reduce((s, i) => s + peso(i) * pg2Avanco(i), 0) / total * 100) : 0;
}
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
  const progresso = total ? Math.round(l.reduce((s, i) => s + peso(i) * pg2Avanco(i), 0) / total * 100) : 0;
  return {n:l.length, total, faixas:f, pc, progresso, aceito:Math.round(pc('done')), construido:Math.round(pc('done') + pc('review')),
    atrasados:l.filter(atrasado).length, semPontos:l.length - comPts.length, crit, aceitos14:l.filter(i => i.status === 'done' && i.feito && parse(i.feito) > limite).length};
}
const pg2Num = v => (Math.round(v * 10) / 10).toLocaleString('pt-BR');
// o que não cabe na linha vai no texto ao passar o mouse
function pg2Detalhe(nome, p){
  if (!p.n) return nome + ': sem itens';
  return nome + ' · Progresso ' + p.progresso + '% · ' + PG2_FAIXAS.map(x => x.nome + ' ' + p.faixas[x.k].n + ' (' + Math.round(p.pc(x.k)) + '%)').join(' · ') +
    (p.atrasados ? ' · ' + p.atrasados + ' atrasados' : '') + (p.semPontos ? ' · ' + p.semPontos + ' sem pontos' : '') +
    (p.crit.t ? ' · ' + p.crit.f + ' de ' + p.crit.t + ' critérios comprovados' : '') + ' · ' + (p.aceitos14 ? p.aceitos14 + ' aceitos em 14 dias' : 'nenhum aceito em 14 dias');
}
// no mesmo formato e tamanho do cartão de antes (pp, pp-lin, pp-bar): nome | barra em cinco faixas | % aceito com % construído embaixo
function pg2Linha(no, nome, p){
  const alerta = [p.faixas.blocked.n ? p.faixas.blocked.n + (p.faixas.blocked.n === 1 ? ' bloqueado' : ' bloqueados') : '', p.atrasados ? p.atrasados + (p.atrasados === 1 ? ' atrasado' : ' atrasados') : ''].filter(Boolean).join(' · ');
  return '<button type="button" class="pp-lin pg2-lin' + (p.n ? '' : ' vazia') + '" data-ir="' + esc(no) + '" title="' + esc(pg2Detalhe(nome, p)) + '">' +
    '<span class="pp-nome">' + esc(nome) + (alerta ? '<small class="pg2-alerta">' + esc(alerta) + '</small>' : '') + '</span>' +
    '<span class="pp-bar pg2-bar">' + (p.n ? PG2_FAIXAS.filter(x => p.faixas[x.k].n).map(x => '<i class="pg2-' + x.k + '" style="flex:' + p.faixas[x.k].pts.toFixed(3) + ' 1 0" data-pg2-no="' + esc(no) + '" data-pg2-st="' + x.k + '" title="' + esc(x.nome + ': ' + p.faixas[x.k].n + (p.faixas[x.k].n === 1 ? ' item' : ' itens') + ' · ' + pg2Num(p.faixas[x.k].pts) + ' pontos (' + Math.round(p.pc(x.k)) + '%). Clique para ver a lista.') + '"></i>').join('') : '') + '</span>' +
    '<b>' + (p.n ? p.progresso + '%<small>' + p.aceito + '% aceito</small>' : '–<small>sem itens</small>') + '</b></button>';
}
// o cartão: mesma estrutura do de antes (título, uma linha por parte, legenda); o total vai na legenda
function progressoPartesHTML(chave, nos, rot, opts){
  const filtrar = l => opts && opts.soCliente ? l.filter(i => i.vis === 'cliente' || i.status === 'done') : l;
  const tudo = progressoDe(filtrar(issuesEm(chave)));
  const linhas = nos.map(f => ({f, p:progressoDe(filtrar(issuesEm(f)))}));
  return '<section class="pc-c pg2"><h3>Progresso por ' + esc(rot) + '<span>' + nos.length + '</span></h3>' +
    '<div class="pp">' + linhas.map(x => pg2Linha(x.f, nomeDe(x.f), x.p)).join('') + '</div>' +
    '<div class="pc-leg pg2-leg">' + PG2_FAIXAS.map(x => '<span><i class="pg2-' + x.k + '"></i>' + esc(x.nome) + '</span>').join('') +
    '<span class="pg2-tot" title="' + esc(pg2Detalhe('Total', tudo)) + '">Total: <b>' + tudo.progresso + '%</b> de progresso · <b>' + tudo.aceito + '%</b> aceito' + I('Conta só itens de trabalho (épico não conta: ele é a soma dos filhos), pesados pelos pontos; item sem pontos vale a média. Progresso: aceito vale 100%, pronto e faltando aceitar 90%, em andamento ou bloqueado a parte já feita dos subitens, da checklist e dos critérios (sem nada para medir, metade), a fazer 0%. Aceito: só o que o P.O. aceitou. Passe o mouse numa linha para ver o detalhe; clique numa cor para ver a lista.') + '</span></div></section>';
}
// a saúde e a tabela "Por parte" usam a mesma conta (sem épicos, pesada pelos pontos)
const _metricasPg2 = metricas;
metricas = function(lista){
  const m = _metricasPg2(pg2Trabalho(lista || [])), p = progressoDe(lista);
  m.prog = p.progresso; m.aceito = p.aceito; m.construido = p.construido; m.and = p.faixas.doing.n + p.faixas.review.n;
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
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {progressoDe, progressoPartesHTML, pg2Avanco, progressoPct});
