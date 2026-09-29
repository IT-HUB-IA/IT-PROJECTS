/* ===== O status do épico (e de qualquer item com subitens) acompanha os subitens =====
   - todos os subitens feitos: o item de cima vai sozinho para Feito;
   - pelo menos um subitem andando (Fazendo, Em revisão ou Feito) e o de cima ainda na fila ou A fazer: vai para Fazendo;
   - o de cima estava Feito e um subitem foi reaberto: volta para Fazendo.
   Travado e Em revisão escolhidos à mão no item de cima não são trocados por "Fazendo".
   A mudança passa por mudarStatus, então fica no histórico e vai para o banco como qualquer outra.
   Ao abrir o sistema, acerta também os itens que já estavam fora da regra (por exemplo, épico com tudo feito ainda em A fazer). */
const PS = {quieto:false};
const psFilhos = p => D.issues.filter(x => x.pai === p.id && !x.arquivado);
function psAlvo(p){
  const f = psFilhos(p); if (!f.length || p.arquivado) return null;
  if (f.every(x => x.status === 'done')) return p.status === 'done' ? null : 'done';
  if (p.status === 'done') return 'doing';
  if ((p.status === 'backlog' || p.status === 'todo') && f.some(x => x.status === 'doing' || x.status === 'review' || x.status === 'done')) return 'doing';
  return null;
}
const psTipo = p => p.tipo === 'epic' ? 'O épico' : 'O item';
const _mudarStatusPs = mudarStatus;
mudarStatus = function(i, s){
  const r = _mudarStatusPs.apply(this, arguments);
  const p = i && i.pai && byId('issues', i.pai), alvo = p && podeEditar() ? psAlvo(p) : null;
  if (alvo){
    mudarStatus(p, alvo);   // passa por aqui de novo e sobe para o avô, se houver
    if (!PS.quieto) toast('"' + i.titulo + '" foi para ' + stNome(i.status) + '. ' + psTipo(p) + ' "' + p.titulo + '" foi junto para ' + stNome(p.status) + '.');
  }
  return r;
};
// acerta de uma vez os itens que estão fora da regra; devolve quantos mudaram
function psAcertarTodos(){
  if (!podeEditar() || !D || !Array.isArray(D.issues)) return 0;
  let n = 0;
  const _toast = toast; PS.quieto = true; toast = () => {};
  try {
    // de baixo para cima: primeiro os pais mais fundos, para o avô já ver o pai certo
    const prof = p => { let d = 0, x = p; while (x && x.pai && d < 20){ x = byId('issues', x.pai); d++; } return d; };
    const pais = D.issues.filter(p => !p.arquivado && D.issues.some(x => x.pai === p.id && !x.arquivado)).sort((a, b) => prof(b) - prof(a));
    for (const p of pais){ const alvo = psAlvo(p); if (alvo){ mudarStatus(p, alvo); n++; } }
  } finally { toast = _toast; PS.quieto = false; }
  if (n){ salvar(); if (typeof render === 'function') render(); toast(n === 1 ? '1 épico com os subitens já andando teve o status acertado sozinho.' : n + ' épicos e itens com subitens tiveram o status acertado sozinhos.'); }
  return n;
}
if (COM_BANCO){
  const _carregarPs = carregarDoBanco;
  carregarDoBanco = async function(){ const r = await _carregarPs.apply(this, arguments); setTimeout(() => { if (BANCO.carregado) psAcertarTodos(); }, 300); return r; };
  window.ciclodevCarregarBanco = carregarDoBanco;
} else setTimeout(psAcertarTodos, 300);
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {psAcertarTodos, mudarStatus});
