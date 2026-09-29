/* ===== Voltar para a janela anterior =====
   Quando, de dentro de um item, a pessoa abre outro (o épico, um subitem, uma ligação, um item citado),
   a janela nova ganha uma setinha vermelha no canto que volta para o item de antes. Guarda o caminho todo:
   dá para voltar vários passos. Fechar a janela esquece o caminho. */
const NAV = {pilha:[], voltando:false};
const NAV_SETA = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const _abrirItemNav = abrirItem;
abrirItem = function(id){
  const antes = itemAberto;
  if (!NAV.voltando && antes && antes !== id && byId('issues', antes)){ if (NAV.pilha[NAV.pilha.length - 1] !== antes) NAV.pilha.push(antes); if (NAV.pilha.length > 30) NAV.pilha.shift(); }
  const r = _abrirItemNav.apply(this, arguments);
  navSeta();
  return r;
};
function navSeta(){
  const cab = $('#gaveta-wrap .gaveta-cab'); if (!cab) return;
  const velho = $('.nav-voltar', cab); if (velho) velho.remove();
  NAV.pilha = NAV.pilha.filter(id => byId('issues', id) && id !== itemAberto);
  const ant = NAV.pilha.length && byId('issues', NAV.pilha[NAV.pilha.length - 1]); if (!ant) return;
  const nome = ((typeof chaveDe === 'function' && chaveDe(ant)) ? chaveDe(ant) + ' ' : '') + ant.titulo;
  cab.insertAdjacentHTML('afterbegin', '<button type="button" class="nav-voltar" data-nav-voltar aria-label="Voltar para ' + esc(nome) + '" title="Voltar para ' + esc(nome) + '">' + NAV_SETA + '</button>');
}
function navVoltar(){
  const id = NAV.pilha.pop(); if (!id || !byId('issues', id)) { navSeta(); return; }
  NAV.voltando = true; try { abrirItem(id); } finally { NAV.voltando = false; }
}
const _fecharItemNav = fecharItem;
fecharItem = function(){ NAV.pilha = []; return _fecharItemNav.apply(this, arguments); };
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-nav-voltar]')){ e.preventDefault(); e.stopPropagation(); navVoltar(); } }, true);
// Alt + seta para a esquerda também volta, como no navegador
document.addEventListener('keydown', e => { if (e.altKey && e.key === 'ArrowLeft' && itemAberto && NAV.pilha.length && !document.querySelector('dialog[open]')){ e.preventDefault(); navVoltar(); } });
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {abrirItem, fecharItem, NAV});
