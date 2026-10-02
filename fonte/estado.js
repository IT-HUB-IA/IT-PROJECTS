/* ===== Estado de cada pessoa no banco (parte 52) =====
   O que antes ficava só neste navegador agora fica em pessoas_preferencias.estado (cada pessoa só lê e grava o seu):
   a frente em foco, as fichas técnicas automáticas já vistas, o guia do P.O. (passo de cada projeto e os avisos
   silenciados) e o Desfazer do último lote. O registro das automações vem de automacoes_execucoes (o banco já grava).
   Nada se perde: ao entrar, o que já estava neste navegador é JUNTADO com o que está no banco (nada do banco é
   apagado), gravado, relido e conferido; só depois de conferido a cópia antiga do navegador sai. Se não der para
   gravar, a cópia do navegador fica onde está e tenta de novo depois. */
const EPS = {pronto:false, dados:{}, timer:0, ultimo:'', semColuna:false, tentativa:0};
const ES_LEGADO = {ficha:'ciclodev-ficha-vista:', guia:'ciclodev-guia-projeto-', silencio:'ciclodev-po-silenciados', lote:'ciclodev-ultimo-lote'};
const esBanco = () => (typeof COM_BANCO !== 'undefined' && COM_BANCO && typeof BANCO !== 'undefined' && BANCO.carregado && window.ciclodevBanco && typeof eu === 'function' && eu()) ? window.ciclodevBanco : null;
const esJson = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, c) => (o[c] = x[c], o), {}) : x);
function esLocal(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
function esLocalJson(k){ try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch(e){ return null; } }
function esChavesLocais(prefixo){ const out = {}; try { for (let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if (k && k.startsWith(prefixo)) out[k.slice(prefixo.length)] = localStorage.getItem(k); } } catch(e){} return out; }

// o que estava só neste navegador (formato antigo)
function esLegado(){
  const guia = {}; Object.entries(esChavesLocais(ES_LEGADO.guia)).forEach(([pj, v]) => { if (v != null && v !== '' && !isNaN(+v)) guia[pj] = +v; });
  // a cópia antiga de todos os dados (versão sem login) vai inteira para o banco da pessoa, como foi encontrada
  const bruto = typeof CHAVE_DADOS !== 'undefined' ? esLocal(CHAVE_DADOS) : null;
  return {ficha_vistos:esChavesLocais(ES_LEGADO.ficha), guia_passos:guia, po_silenciados:esLocalJson(ES_LEGADO.silencio) || {}, lote_desfazer:esLocalJson(ES_LEGADO.lote), dados_antigos:bruto};
}
// junta sem perder: no que só existe de um lado, fica o que existe; nos dois lados, o banco ganha (o silêncio fica com o prazo maior; o Desfazer, com o lote mais novo)
function esJuntar(banco, local){
  const b = Object.assign({}, banco || {}), l = local || {};
  b.ficha_vistos = Object.assign({}, l.ficha_vistos || {}, b.ficha_vistos || {});
  b.guia_passos = Object.assign({}, l.guia_passos || {}, b.guia_passos || {});
  const sil = Object.assign({}, b.po_silenciados || {}); Object.entries(l.po_silenciados || {}).forEach(([k, t]) => { if (!(+sil[k] >= +t)) sil[k] = +t; }); b.po_silenciados = sil;
  const lb = b.lote_desfazer, ll = l.lote_desfazer;
  b.lote_desfazer = !lb ? (ll || null) : !ll ? lb : (String(ll.quando || '') > String(lb.quando || '') ? ll : lb);
  if (b.foco === undefined) b.foco = null;
  return b;
}
function esTemLegado(l){ return Object.keys(l.ficha_vistos).length || Object.keys(l.guia_passos).length || Object.keys(l.po_silenciados).length || !!l.lote_desfazer; }
function esApagarLegado(){
  try {
    const tirar = []; for (let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if (k && (k.startsWith(ES_LEGADO.ficha) || k.startsWith(ES_LEGADO.guia))) tirar.push(k); }
    tirar.concat([ES_LEGADO.silencio, ES_LEGADO.lote]).forEach(k => localStorage.removeItem(k));
  } catch(e){}
}
// grava e confere relendo do banco; true só quando o banco devolveu exatamente o que foi gravado
async function esGravarConferido(estado){
  const sb = esBanco(); if (!sb || EPS.semColuna) return false;
  const {error} = await sb.from('pessoas_preferencias').upsert({pessoa_id:eu(), estado}, {onConflict:'pessoa_id'});
  if (error){ if (/column|estado|schema cache/i.test(error.message || '')) EPS.semColuna = true; console.warn('Estado:', error.message); return false; }
  const {data, error:e2} = await sb.from('pessoas_preferencias').select('estado').eq('pessoa_id', eu()).maybeSingle();
  const lido = Array.isArray(data) ? data[0] : data;
  if (e2 || !lido) return false;
  return esJson(lido.estado) === esJson(estado);
}
// a cópia antiga de TODOS os dados deste navegador (versão sem login) vai inteira, como foi encontrada, para
// pessoas_preferencias.navegador_antigo (só a própria pessoa vê). Sai do navegador só depois de relida e conferida.
async function esGuardarDadosAntigos(){
  const sb = esBanco(), bruto = esLegado().dados_antigos; if (!sb || !bruto) return;
  const {data, error} = await sb.from('pessoas_preferencias').select('navegador_antigo').eq('pessoa_id', eu()).maybeSingle();
  if (error){ console.warn('Dados antigos:', error.message); return; }
  const row = Array.isArray(data) ? data[0] : data, lista = ((row && row.navegador_antigo) || []).slice();
  if (!lista.some(x => x.bruto === bruto)){
    lista.push({guardado_em:new Date().toISOString(), bruto});
    const {error:e1} = await sb.from('pessoas_preferencias').upsert({pessoa_id:eu(), navegador_antigo:lista}, {onConflict:'pessoa_id'});
    if (e1){ console.warn('Dados antigos:', e1.message); return; }
  }
  const {data:d2, error:e2} = await sb.from('pessoas_preferencias').select('navegador_antigo').eq('pessoa_id', eu()).maybeSingle();
  const r2 = Array.isArray(d2) ? d2[0] : d2;
  if (!e2 && r2 && (r2.navegador_antigo || []).some(x => x.bruto === bruto)){ try { localStorage.removeItem(CHAVE_DADOS); } catch(e){} }
}
async function esCarregar(){
  const sb = esBanco(); if (!sb) return;
  esGuardarDadosAntigos().catch(e => console.warn('Dados antigos', e));
  const {data:lido, error} = await sb.from('pessoas_preferencias').select('estado').eq('pessoa_id', eu()).maybeSingle();
  const row = Array.isArray(lido) ? lido[0] : lido;
  if (error){ if (/column|estado|schema cache/i.test(error.message || '')) EPS.semColuna = true; console.warn('Estado:', error.message); return; }
  const legado = esLegado(), juntos = esJuntar(row && row.estado, legado);
  EPS.dados = juntos; EPS.pronto = true;
  if (esTemLegado(legado) || !row || esJson(row.estado) !== esJson(juntos)){
    if (await esGravarConferido(juntos)){ EPS.ultimo = esJson(juntos); esApagarLegado(); }
    else esTentarDeNovo();   // a cópia do navegador continua onde está
  } else EPS.ultimo = esJson(juntos);
  // a frente em foco volta (se a frente ainda existe)
  const f = EPS.dados.foco; D.focus = f && f.ws && byId('ws', f.ws) ? f : null;
  if (typeof render === 'function') render();
}
// não gravou: tenta de novo com o que está na tela agora (que já inclui o que veio do navegador); só apaga a cópia antiga depois de conferido
function esTentarDeNovo(){
  if (++EPS.tentativa > 20) return;
  setTimeout(async () => { if (await esGravarConferido(EPS.dados)){ EPS.ultimo = esJson(EPS.dados); esApagarLegado(); } else esTentarDeNovo(); }, 30000);
}
function esAgendar(){
  if (!EPS.pronto) return;
  clearTimeout(EPS.timer);
  EPS.timer = setTimeout(async () => { const j = esJson(EPS.dados); if (j === EPS.ultimo) return; if (await esGravarConferido(EPS.dados)) EPS.ultimo = j; else setTimeout(esAgendar, 15000); }, 700);
}
// leitura e gravação usadas pelas telas. Sem login (modo de exemplo), continua no navegador como antes.
function esLer(k, padrao){
  if (!COM_BANCO) return padrao;
  if (EPS.pronto) return EPS.dados[k] === undefined ? padrao : EPS.dados[k];
  const l = esLegado()[k]; return l == null ? padrao : l;   // antes do banco responder: o que está neste navegador
}
function esGravar(k, v){ if (!COM_BANCO) return false; if (!EPS.pronto) return false; EPS.dados[k] = v; esAgendar(); return true; }

/* ---------- os lugares que guardavam no navegador ---------- */
faLerVisto = function(no){ if (!COM_BANCO){ try { return localStorage.getItem(faChaveVisto(no)) || ''; } catch(e){ return ''; } } return (esLer('ficha_vistos', {}) || {})[no] || ''; };
faGravarVisto = function(no, v){ if (!COM_BANCO){ try { localStorage.setItem(faChaveVisto(no), v); } catch(e){} return; } const m = Object.assign({}, esLer('ficha_vistos', {})); m[no] = v; esGravar('ficha_vistos', m); };
leUltimo = function(){ if (!COM_BANCO){ try { return JSON.parse(localStorage.getItem(LE_CHAVE) || 'null'); } catch(e){ return null; } } return esLer('lote_desfazer', null); };
// o Desfazer guarda dados dos itens: com login vai só para o banco da pessoa, nunca para o navegador
function esLoteGuardar(reg){ if (!COM_BANCO){ try { localStorage.setItem(LE_CHAVE, JSON.stringify(reg)); } catch(e){} return; } if (!esGravar('lote_desfazer', reg)) toast('O Desfazer deste lote não foi guardado: o banco ainda está abrindo.'); }
function esLoteLimpar(){ if (!COM_BANCO){ try { localStorage.removeItem(LE_CHAVE); } catch(e){} return; } esGravar('lote_desfazer', null); }
function esSilenciados(){ const o = Object.assign({}, COM_BANCO ? esLer('po_silenciados', {}) : (esLocalJson(ES_LEGADO.silencio) || {})), ag = Date.now(); Object.keys(o).forEach(k => { if (+o[k] < ag) delete o[k]; }); return o; }
pgSilenciar = function(k){ const o = esSilenciados(); o[k] = Date.now() + 7 * 864e5; if (COM_BANCO) esGravar('po_silenciados', o); else { try { localStorage.setItem(ES_LEGADO.silencio, JSON.stringify(o)); } catch(e){} } };
function esGuiaPasso(pj){ if (!COM_BANCO){ const v = esLocal(ES_LEGADO.guia + pj); return v == null ? -1 : +v; } const m = esLer('guia_passos', {}) || {}; return m[pj] == null ? -1 : +m[pj]; }
function esGuiaGuardar(pj, k){ if (!COM_BANCO){ try { localStorage.setItem(ES_LEGADO.guia + pj, String(k)); } catch(e){} return; } const m = Object.assign({}, esLer('guia_passos', {})); if (m[pj] === k) return; m[pj] = k; esGravar('guia_passos', m); }
function esFoco(f){ D.focus = f; esGravar('foco', f); }

/* ---------- registro das automações (o banco grava em automacoes_execucoes) ---------- */
async function esLerAutomacoes(){
  const sb = esBanco(); if (!sb) return;
  const {data, error} = await sb.from('automacoes_execucoes').select('automacao_id, item_id, resultado, detalhe, em').order('em', {ascending:false}).limit(200);
  if (error){ console.warn('Automações:', error.message); return; }
  D.autoLog = (data || []).map(r => ({auto:r.automacao_id, item:r.item_id, quando:Date.parse(r.em), ok:r.resultado === 'ok', det:r.detalhe || (r.resultado === 'ignorada' ? 'Ignorada' : '')}));
}

if (COM_BANCO){
  const _carregarEs = carregarDoBanco;
  carregarDoBanco = async function(){ const r = await _carregarEs.apply(this, arguments);
    esLerAutomacoes().catch(e => console.warn('Automações', e));
    if (!EPS.pronto) esCarregar().catch(e => console.warn('Estado', e));
    else { const f = EPS.dados.foco; D.focus = f && f.ws && byId('ws', f.ws) ? f : null; }   // a releitura do banco não apaga a frente em foco
    return r; };
  window.ciclodevCarregarBanco = carregarDoBanco;
  window.addEventListener('beforeunload', () => { if (EPS.pronto && esJson(EPS.dados) !== EPS.ultimo) esGravarConferido(EPS.dados); });
}
window.ciclodevEstado = EPS;
if (location.protocol === 'file:') Object.assign(window, {esFoco, esLoteGuardar, esCarregar, esGuiaPasso, esLer, faGravarVisto, faLerVisto, pgSilenciar, leUltimo});
