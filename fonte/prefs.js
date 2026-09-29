/* ===== Preferências de tela e lembretes vistos no banco (parte 22) =====
   A arrumação da tela de cada pessoa vai para pessoas_preferencias.tela, e os lembretes que já apareceram vão para
   pessoas_preferencias.lembretes_vistos. O navegador continua com uma cópia só para abrir mais rápido.
   Na primeira vez (banco ainda vazio para a pessoa), o que já estava guardado neste navegador sobe para o banco,
   para ninguém ter de arrumar tudo de novo. */
const PF_CAMPOS = ['modulo', 'sel', 'view', 'ovSel', 'abertos', 'tabAbertos', 'filtros', 'raias', 'calModo', 'cargaModo', 'ordem', 'abasFixas', 'arvW', 'semArvore', 'bjEpicos', 'bjFechadas'];
const PF = {pronto:false, timer:0, ultimo:'', vistosUlt:'', semColuna:false};
const pfBanco = () => (COM_BANCO && BANCO.carregado && window.ciclodevBanco && typeof eu === 'function' && eu()) ? window.ciclodevBanco : null;
function pfTela(){
  const t = {}; PF_CAMPOS.forEach(k => { if (UI[k] !== undefined) t[k] = UI[k]; });
  t.tema = document.documentElement.classList.contains('tema-escuro') ? 'escuro' : 'claro';
  return t;
}
function pfAplicar(t){
  if (!t || typeof t !== 'object') return;
  PF_CAMPOS.forEach(k => { if (t[k] !== undefined) UI[k] = t[k]; });
  // um ponto da Estrutura que não existe mais (apagado por alguém) não é aplicado
  ['sel', 'ovSel'].forEach(k => { if (t[k] && t[k] !== 'all' && typeof tfObjNo === 'function' && !tfObjNo(t[k])) UI[k] = k === 'sel' ? (D.projects[0] ? 'project:' + D.projects[0].id : 'all') : 'all'; });
  if (t.tema) { document.documentElement.classList.toggle('tema-escuro', t.tema === 'escuro'); try { localStorage.setItem('ciclodev-tema', t.tema); } catch(e){} }
  try { localStorage.setItem('ciclodev-ui', JSON.stringify(UI)); } catch(e){}
}
// os lembretes vistos há mais de 60 dias saem, para a lista não crescer para sempre
const pfPodar = v => { const lim = Date.now() - 60 * 864e5, o = {}; Object.entries(v || {}).forEach(([k, t]) => { if (+t > lim) o[k] = +t; }); return o; };
async function pfGravar(campos){
  const sb = pfBanco(); if (!sb || PF.semColuna) return false;
  const {error} = await sb.from('pessoas_preferencias').upsert(Object.assign({pessoa_id:eu()}, campos), {onConflict:'pessoa_id'});
  if (error){ if (/column|tela|lembretes_vistos|schema cache/i.test(error.message || '')) PF.semColuna = true; console.warn('Preferências:', error.message); return false; }
  return true;
}
function pfAgendar(){
  if (!PF.pronto) return;
  clearTimeout(PF.timer);
  PF.timer = setTimeout(() => { const t = pfTela(), j = JSON.stringify(t); if (j === PF.ultimo) return; PF.ultimo = j; pfGravar({tela:t}); }, 1500);
}
// depois de ler o banco: traz a arrumação da pessoa (ou sobe a deste navegador, se o banco ainda não tem)
async function pfCarregar(){
  const sb = pfBanco(); if (!sb) return;
  const {data:lido, error} = await sb.from('pessoas_preferencias').select('tela, lembretes_vistos').eq('pessoa_id', eu()).maybeSingle();
  const data = Array.isArray(lido) ? lido[0] : lido;
  if (error){ if (/column|tela|lembretes_vistos|schema cache/i.test(error.message || '')) PF.semColuna = true; PF.pronto = true; return; }
  const noBanco = data && data.tela && Object.keys(data.tela).length ? data.tela : null;
  const vistosBanco = (data && data.lembretes_vistos) || {};
  let local = {}; try { local = JSON.parse(localStorage.getItem('ciclodev-lembretes-vistos') || '{}'); } catch(e){}
  const vistos = pfPodar(Object.assign({}, local, vistosBanco));
  if (typeof TF !== 'undefined'){ TF.vistos = vistos; try { localStorage.setItem('ciclodev-lembretes-vistos', JSON.stringify(vistos)); } catch(e){} }
  PF.vistosUlt = JSON.stringify(vistosBanco);
  if (noBanco){ pfAplicar(noBanco); PF.ultimo = JSON.stringify(pfTela()); if (typeof render === 'function') render(); }
  else { const t = pfTela(); PF.ultimo = JSON.stringify(t); await pfGravar({tela:t}); }   // primeira vez: o que já estava neste navegador vai para o banco
  if (JSON.stringify(vistos) !== PF.vistosUlt){ if (await pfGravar({lembretes_vistos:vistos})) PF.vistosUlt = JSON.stringify(vistos); }
  PF.pronto = true;
}
if (COM_BANCO){
  const _salvarUIPf = salvarUI;
  salvarUI = function(){ const r = _salvarUIPf.apply(this, arguments); pfAgendar(); return r; };
  const _pkTemaPf = pkTema;
  pkTema = function(){ const r = _pkTemaPf.apply(this, arguments); pfAgendar(); return r; };
  const _carregarPf = carregarDoBanco;
  carregarDoBanco = async function(){ const r = await _carregarPf.apply(this, arguments); if (!PF.pronto) pfCarregar().catch(e => { console.warn('Preferências', e); PF.pronto = true; }); return r; };
  window.ciclodevCarregarBanco = carregarDoBanco;
  // lembretes vistos: quando aparecer um novo, sobe para o banco
  setInterval(() => { if (!PF.pronto || typeof TF === 'undefined' || !TF.vistos) return; const v = pfPodar(TF.vistos), j = JSON.stringify(v); if (j === PF.vistosUlt) return; pfGravar({lembretes_vistos:v}).then(ok => { if (ok) PF.vistosUlt = j; }); }, 20000);
  // largura da Estrutura e outras mudanças que não passam por salvarUI: confere de tempos em tempos
  setInterval(pfAgendar, 15000);
  window.addEventListener('beforeunload', () => { if (PF.pronto && JSON.stringify(pfTela()) !== PF.ultimo) pfGravar({tela:pfTela()}); });
}
window.ciclodevPrefs = PF;
