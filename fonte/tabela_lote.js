/* ===== Tabela: responsável em lote =====
   Botão no cabeçalho da coluna Responsável da Tabela (projeto, produto, aplicação, frente...): escolhe a pessoa e
   se vale só para os itens marcados ou para todos os itens da lista que está na tela (com os filtros de agora).
   A mudança passa pelo mesmo caminho da edição em massa: automações de "responsável mudou", histórico e banco. */
const RL_ICO = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" aria-hidden="true"><circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20c.8-3.5 3.3-5.5 6.5-5.5s5.7 2 6.5 5.5"></path><path d="M17 8v6M14 11h6"></path></svg>';
const _vTableRl = vTable;
vTable = function(){
  const h = _vTableRl.apply(this, arguments);
  if (!podeEditar()) return h;
  const bt = '<button class="rl-col" type="button" data-rl-abrir title="Responsável em lote: a mesma pessoa em vários itens de uma vez" aria-label="Responsável em lote">' + RL_ICO + '</button>';
  // o botão fica dentro do cabeçalho da coluna Responsável
  return h.replace(/(<th scope="col" class="ord" data-ordem="resp">)([^<]*)(<\/th>)/, '$1<span class="tl-resp-cab">' + bt + '$2</span>$3');
};
function rlAbrir(){
  const lista = listaFiltrada(), marcados = lista.filter(i => selItens.has(i.id));
  if (!lista.length){ toast('Não há itens nesta lista.'); return; }
  const equipe = D.people.filter(p => p.acesso !== 'stakeholder');
  const alc = (v, txt, n, marcado, desl) => '<label class="rl-op' + (desl ? ' desl' : '') + '"><input type="radio" name="rl-alcance" value="' + v + '"' + (marcado ? ' checked' : '') + (desl ? ' disabled' : '') + '><span><b>' + txt + '</b><small>' + n + (n === 1 ? ' item' : ' itens') + '</small></span></label>';
  const corpo = '<div class="rl-form"><label class="lb">Responsável<select class="sel" id="rl-pessoa"><option value="">Escolha a pessoa</option><option value="-">Sem responsável (tirar)</option>' +
      equipe.map(p => '<option value="' + esc(p.id) + '">' + esc(p.nome) + '</option>').join('') + '</select></label>' +
    '<fieldset class="rl-alcance"><legend>Para quais itens</legend>' +
      alc('sel', 'Só os marcados na tabela', marcados.length, marcados.length > 0, !marcados.length) +
      alc('todos', 'Todos os itens desta lista', lista.length, !marcados.length, false) +
    '</fieldset>' + (marcados.length ? '' : '<p class="sec rl-dica">Para escolher só alguns, marque as caixinhas na primeira coluna da tabela.</p>') + '</div>';
  modal('Responsável em lote', corpo, [{txt:'Cancelar', cls:'sec'}, {txt:'Aplicar', acao:d => {
    const v = $('#rl-pessoa', d).value; if (!v){ toast('Escolha a pessoa'); return false; }
    const todos = (d.querySelector('[name="rl-alcance"]:checked') || {}).value === 'todos';
    const its = (todos ? lista : marcados).filter(i => byId('issues', i.id));
    const resp = v === '-' ? null : v, nome = resp ? (pessoa(resp) || {nome:'?'}).nome : 'sem responsável';
    let n = 0;
    its.forEach(i => { if (i.resp !== resp){ i.resp = resp; n++; rodarAutomacoes(i, 'responsavel_mudou'); } });
    registrar('status', null, 'Responsável ' + (resp ? nome : 'tirado') + ' em ' + its.length + (its.length === 1 ? ' item' : ' itens') + ' de uma vez');
    salvar(); rView();
    toast(n ? (resp ? nome + ' agora é responsável por ' : 'Tirado o responsável de ') + n + (n === 1 ? ' item' : ' itens') + (n < its.length ? ' (' + (its.length - n) + ' já estavam assim)' : '') + '.' : 'Nada mudou: todos já estavam assim.');
  }}]);
}
// captura antes do clique de ordenar a coluna, para o botão não ordenar a tabela junto
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-rl-abrir]')){ e.stopPropagation(); e.preventDefault(); rlAbrir(); } }, true);
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {rlAbrir, selItens});
