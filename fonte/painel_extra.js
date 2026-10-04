/* =====================================================================
   Painel: linha do tempo com o histórico de verdade e o indicador "parados há quanto tempo". Prefixo pch.
   - Com o banco, as mudanças dos itens ficam em itens_historico (gravado pelos gatilhos do banco). A linha do tempo
     lia só D.eventos (que existe só nos dados de exemplo), por isso ficava vazia. Aqui ela passa a ler o histórico.
   - "Parados há quanto tempo": o que está em andamento, pronto para testar ou travado, separado pelos dias desde a
     última mudança de situação. Mostra o trabalho esquecido antes que vire atraso.
   ===================================================================== */
const PCH = {hist:null, lendo:false, em:0};
const PCH_DIAS = 60;

async function pchLer(forcar){
  const sb = window.ciclodevBanco;
  if (!sb || typeof BANCO === 'undefined' || !BANCO.carregado || PCH.lendo) return;
  if (PCH.hist && !forcar && Date.now() - PCH.em < 60000) return;
  PCH.lendo = true;
  try {
    const desde = new Date(Date.now() - PCH_DIAS * 864e5).toISOString(), todas = [];
    for (let de = 0; de < 20000; de += 1000){
      const {data, error} = await sb.from('itens_historico').select('item_id,tipo,para,criado_em').gte('criado_em', desde).order('criado_em', {ascending:false}).range(de, de + 999);
      if (error){ console.warn('Histórico do painel', error.message); break; }
      todas.push(...(data || [])); if (!data || data.length < 1000) break;
    }
    PCH.hist = todas; PCH.em = Date.now();
  } finally { PCH.lendo = false; }
  if (UI.modulo === 'overview' && typeof rOverview === 'function') rOverview();
}

// a linha do tempo usa o histórico do banco quando ele existe; nos dados de exemplo continua com D.eventos
const _eventosEmPch = eventosEm;
eventosEm = function(chave, lista){
  if (!PCH.hist) { pchLer(); return _eventosEmPch(chave, lista); }
  const ids = new Set(lista.map(i => i.id));
  return PCH.hist.filter(h => ids.has(h.item_id)).map(h => ({item:h.item_id, tipo:h.tipo === 'situacao' && h.para === 'done' ? 'concluiu' : h.tipo === 'situacao' ? 'status' : 'edicao', quando:new Date(h.criado_em).getTime()}));
};

// última mudança de situação de cada item (histórico do banco; sem ele, a data de início ou de criação)
function pchUltimaMudanca(i){
  if (PCH.hist){ const h = PCH.hist.find(x => x.item_id === i.id && x.tipo === 'situacao'); if (h) return new Date(h.criado_em); }
  const ev = (D.eventos || []).filter(e => e.item === i.id && (e.tipo === 'status' || e.tipo === 'criou')).sort((a, b) => b.quando - a.quando)[0];
  if (ev) return new Date(ev.quando);
  const d = i.iniciado || i.ini || i.criado; return d ? parse(d) : null;
}
const PCH_FAIXAS = [
  {nome:'até 2 dias', curto:'0-2 d', ate:2, cor:'#0E8A55'}, {nome:'3 a 7 dias', curto:'3-7 d', ate:7, cor:'#7FA83A'}, {nome:'8 a 14 dias', curto:'8-14 d', ate:14, cor:'#D4A300'},
  {nome:'15 a 30 dias', curto:'15-30 d', ate:30, cor:'#E08600'}, {nome:'mais de 30 dias', curto:'+30 d', ate:Infinity, cor:'#E00000'}];

function pchParadosHTML(lista){
  const abertos = lista.filter(i => i.tipo !== 'epic' && ['doing', 'review', 'blocked'].includes(i.status));
  if (!abertos.length) return '';
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const dias = i => { const d = pchUltimaMudanca(i); if (!d) return Infinity; const x = new Date(d); x.setHours(0, 0, 0, 0); return Math.max(0, Math.round((hoje - x) / 864e5)); };
  const cont = PCH_FAIXAS.map(() => 0); abertos.forEach(i => { const d = dias(i); cont[PCH_FAIXAS.findIndex(f => d <= f.ate)]++; });
  const max = Math.max(1, ...cont), velhos = cont[3] + cont[4];
  return '<div class="pc-bv pch" aria-label="Parados há quanto tempo"><div class="pc-bv-in pch-in">' +
    '<div class="pch-tit"><b>Parados há quanto tempo</b><small>' + abertos.length + ' em andamento, prontos ou travados' + (velhos ? ' · <em>' + velhos + ' há mais de 2 semanas</em>' : '') + '</small></div>' +
    PCH_FAIXAS.map((f, k) => '<div class="pc-bv-col" title="' + esc(cont[k] + (cont[k] === 1 ? ' item' : ' itens') + ' sem mudar de situação há ' + f.nome) + '">' +
      '<span class="pc-bv-n">' + cont[k] + '</span><span class="pc-bv-trilho"><i style="height:' + (cont[k] / max * 100).toFixed(1) + '%;background:' + f.cor + '"></i></span>' +
      '<span class="pc-bv-nome">' + esc(f.curto) + '</span></div>').join('') + '</div></div>';
}

// registra no ao vivo depois que o aovivo.js (carregado depois deste arquivo) existir
setTimeout(() => { try { if (typeof avOuvir === 'function') avOuvir(['itens_historico'], () => pchLer(true)); } catch(e){} }, 0);
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {PCH, pchLer, pchParadosHTML, pchUltimaMudanca});
