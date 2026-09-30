/* ===== Ficha técnica que se preenche sozinha (parte 34 do banco, função diagramas-auto) =====
   O que dá para sair do código (repositório ligado a este ponto) e da estrutura do banco ligado aparece em cada campo
   da ficha, com de onde veio. É separado do que as pessoas escrevem: o campo vazio mostra o valor automático; quem
   quiser escreve à mão por cima, e o automático continua visível embaixo ("o código diz agora").
   Atualiza sozinha: a cada push no branch principal, a cada publicação em produção e quando a estrutura do banco muda.
   Com a ficha aberta, confere a cada 30 segundos e avisa o que mudou (valor anterior e quando). */
const FA = {no:null, linhas:[], assin:'', carregando:false, visto:{}};
const faNo = () => { const [t, id] = (UI.sel || '').split(':'); return ['project','product','app'].includes(t) ? id : null; };
const faBanco = () => (typeof COM_BANCO !== 'undefined' && COM_BANCO && window.ciclodevBanco && typeof BANCO !== 'undefined' && BANCO.carregado) ? window.ciclodevBanco : null;
const faChaveVisto = no => 'ciclodev-ficha-vista:' + no;
function faLerVisto(no){ try { return localStorage.getItem(faChaveVisto(no)) || ''; } catch(e){ return ''; } }
function faGravarVisto(no, v){ try { localStorage.setItem(faChaveVisto(no), v); } catch(e){} }
const faAssin = l => l.length + '|' + l.map(r => r.atualizado_em).sort().pop() + '|' + l.map(r => r.mudou_em).sort().pop();
async function faCarregar(){
  const sb = faBanco(), no = faNo(); if (!sb || !no) { FA.no = no; FA.linhas = []; return false; }
  const {data, error} = await sb.from('ficha_auto').select('*').eq('no_id', no);
  if (error) return false;
  const l = (data || []).filter(r => r.no_id === no), a = faAssin(l), mudou = FA.no !== no || a !== FA.assin;
  const antes = FA.no === no ? FA.linhas : null;
  FA.no = no; FA.linhas = l; FA.assin = a;
  return {mudou, antes};
}
const faDe = r => r.fonte === 'banco' ? 'do banco ' + r.rotulo : 'do repositório ' + r.rotulo;
const faQuando = s => { try { return new Date(s).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}); } catch(e){ return ''; } };
const faRecente = r => r.anterior && Date.now() - Date.parse(r.mudou_em) < 7 * 86400000;
function faBlocoCampo(rs, temManual, novoDesde){
  return '<div class="fa-auto' + (temManual ? ' fa-sob' : '') + '">' + rs.map(r => '<div class="fa-orig">' +
    '<div class="fa-cab"><span class="fa-selo">' + (temManual ? 'O ' + (r.fonte === 'banco' ? 'banco' : 'código') + ' diz agora' : 'Automático') + '</span><span class="fa-de">' + esc(faDe(r)) + (r.fonte === 'codigo' && r.referencia ? ' · commit ' + esc(String(r.referencia).slice(0, 7)) : '') + ' · ' + esc(faQuando(r.atualizado_em)) + '</span>' +
      (novoDesde && r.mudou_em > novoDesde ? '<span class="fa-novo">mudou</span>' : '') + '</div>' +
    '<div class="fa-valor">' + esc(r.valor) + '</div>' +
    (faRecente(r) ? '<div class="fa-mudou">Mudou em ' + esc(faQuando(r.mudou_em)) + '. Antes: <span>' + esc(String(r.anterior).slice(0, 300)) + (String(r.anterior).length > 300 ? '…' : '') + '</span></div>' : '') + '</div>').join('') + '</div>';
}
function faDecorar(){
  const c = $('#ops-corpo'); if (!c || UI.view !== 'sheet' || FA.no !== faNo()) return;
  c.querySelectorAll('.fa-auto, .fa-escrever, .fa-faixa').forEach(x => x.remove());
  c.querySelectorAll('textarea[data-ficha].fa-escondido').forEach(t => { if (document.activeElement !== t) t.classList.remove('fa-escondido'); });
  const porCampo = new Map(); FA.linhas.forEach(r => { const k = r.secao + '|' + r.campo; (porCampo.get(k) || porCampo.set(k, []).get(k)).push(r); });
  const visto = faLerVisto(FA.no), pode = typeof podeEditar === 'function' && podeEditar();
  let n = 0;
  c.querySelectorAll('textarea[data-ficha]').forEach(t => {
    const rs = (porCampo.get(t.dataset.ficha) || []).slice().sort((a, b) => a.fonte.localeCompare(b.fonte) || a.rotulo.localeCompare(b.rotulo)); if (!rs.length) return;
    n++;
    const manual = t.value.trim() !== '';
    t.insertAdjacentHTML('afterend', faBlocoCampo(rs, manual, visto));
    if (!manual && document.activeElement !== t){ t.classList.add('fa-escondido'); if (pode) t.nextElementSibling.insertAdjacentHTML('afterend', '<button type="button" class="fa-escrever" data-fa-escrever>Escrever à mão por cima</button>'); }
  });
  // a faixa do alto: de onde a ficha se preenche e o que mudou nos últimos 7 dias
  const repos = [...new Set(FA.linhas.filter(r => r.fonte === 'codigo').map(r => r.rotulo))], bancos = [...new Set(FA.linhas.filter(r => r.fonte === 'banco').map(r => r.rotulo))];
  const mudancas = FA.linhas.filter(faRecente).sort((a, b) => b.mudou_em.localeCompare(a.mudou_em)).slice(0, 12);
  const intro = c.querySelector('.intro');
  const h = '<div class="fa-faixa">' + (FA.linhas.length
      ? '<p><b>Preenchida sozinha:</b> ' + n + (n === 1 ? ' campo veio ' : ' campos vieram ') + [repos.length ? 'do código (' + esc(repos.join(', ')) + ')' : '', bancos.length ? 'do banco (' + esc(bancos.join(', ')) + ')' : ''].filter(Boolean).join(' e ') + '. Atualiza a cada push no branch principal, a cada publicação em produção e quando a estrutura do banco muda. O que você escreve à mão fica por cima e nunca é apagado.</p>'
      : '<p><b>A ficha pode se preencher sozinha.</b> Ligue um repositório (aba Entregas) ou um banco de dados (aba Infraestrutura) a este ponto: linguagens, frameworks, bibliotecas, APIs, integrações, os nomes dos segredos (nunca o valor), tabelas e regras de acesso aparecem aqui e se atualizam quando o código ou o banco mudam.</p>') +
    (mudancas.length ? '<details class="fa-mudancas"' + (mudancas.some(r => r.mudou_em > visto) ? ' open' : '') + '><summary>O que mudou nos últimos 7 dias (' + mudancas.length + ')</summary><ul>' + mudancas.map(r => '<li><b>' + esc(r.campo) + '</b> <small>' + esc(faDe(r)) + ' · ' + esc(faQuando(r.mudou_em)) + '</small>' + (r.mudou_em > visto ? ' <span class="fa-novo">novo</span>' : '') + '</li>').join('') + '</ul></details>' : '') +
    (pode && faBanco() ? '<button type="button" class="btn sec peq" data-fa-atualizar>Atualizar agora</button>' : '') + '</div>';
  if (intro) intro.insertAdjacentHTML('afterend', h); else c.insertAdjacentHTML('afterbegin', h);
  const ult = FA.linhas.map(r => r.mudou_em).sort().pop();
  if (ult && ult > visto) setTimeout(() => { if (FA.no === faNo() && UI.view === 'sheet') faGravarVisto(FA.no, ult); }, 4000);
}
const _rViewFa = rView;
rView = function(){
  const r = _rViewFa.apply(this, arguments);
  if (UI.view === 'sheet' && faNo()){
    if (FA.no === faNo()) faDecorar();
    faCarregar().then(x => { if (x && (x.mudou || !$('#ops-corpo .fa-faixa'))) faDecorar(); });
  }
  return r;
};
document.addEventListener('click', async e => {
  const w = e.target.closest('[data-fa-escrever]');
  if (w){ const t = w.previousElementSibling && w.previousElementSibling.previousElementSibling; if (t && t.matches('textarea[data-ficha]')){ t.classList.remove('fa-escondido'); const auto = w.previousElementSibling; auto.classList.add('fa-sob'); w.remove(); t.focus(); } return; }
  const a = e.target.closest('[data-fa-atualizar]');
  if (a){ const sb = faBanco(); if (!sb) return; a.disabled = true;
    const {error} = await sb.rpc('infra_auto_pedir', {p_no:FA.no});
    toast(error ? 'Não deu para pedir: ' + (error.message || error) : 'Pedido feito: o robô lê o código e o banco de novo e a ficha se atualiza sozinha em instantes.'); a.disabled = false; }
});
// ficha aberta: confere a cada 30 segundos e avisa o que mudou
async function faConferir(){
  if (UI.view !== 'sheet' || document.visibilityState !== 'visible' || !faNo() || FA.carregando) return;
  FA.carregando = true;
  try {
    const x = await faCarregar(); if (!x || !x.mudou) return;
    const novos = x.antes ? FA.linhas.filter(r => { const v = x.antes.find(y => y.id === r.id); return !v || v.valor !== r.valor; }) : [];
    faDecorar();
    if (novos.length) toast(novos.length === 1 ? 'A ficha técnica mudou sozinha: ' + novos[0].campo + ' (' + faDe(novos[0]) + ').' : 'A ficha técnica mudou sozinha: ' + novos.length + ' campos (' + [...new Set(novos.map(faDe))].join(', ') + ').');
  } finally { FA.carregando = false; }
}
setInterval(faConferir, 30000);
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {FA, faCarregar, faDecorar, faConferir});
