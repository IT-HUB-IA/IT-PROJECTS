/* ===== Tudo para o banco: Quadro livre e Visões salvas =====
   As duas já tinham tabela no banco (parte 02: quadros, quadro_elementos e visoes_salvas, com as regras de acesso da parte 07),
   mas a tela só guardava na memória e perdia ao recarregar. Aqui entram na gravação e na leitura como todo o resto.
   Quadro livre: nota vira elemento "texto"; cartão de registro vira "cartao" ligado ao item ou ao ponto da Estrutura; ligação vira "seta".
   Visão salva: a view, os filtros, a busca, as raias e a ordem vão juntos no campo filtros (a coluna visao só aceita algumas views). */
GRAVAR.push(['quadros', ['no_id']], ['quadro_elementos', ['id']], ['visoes_salvas', ['id']]);
TABELAS_BANCO.push('quadros', 'quadro_elementos', 'visoes_salvas');
const PS_VISOES = ['board', 'table', 'list', 'calendar', 'timeline', 'workload'];
const psNum = v => { const n = +v; return isFinite(n) ? Math.round(n * 10) / 10 : 0; };

const _linhasDaTelaPs = linhasDaTela;
linhasDaTela = function(d){
  const L = _linhasDaTelaPs(d);
  L.quadros = []; L.quadro_elementos = []; L.visoes_salvas = [];
  const temNo = new Set(L.nos.map(n => n.id)), temItem = new Set(L.itens.map(i => i.id));
  Object.entries(d.quadros || {}).forEach(([chave, q]) => {
    const no = idNo(chave); if (!no || !temNo.has(no) || !q || !(q.els || []).length) return;
    L.quadros.push({no_id:no});
    const ids = new Set();
    const els = q.els.filter(e => e && e.tipo !== 'seta'), setas = q.els.filter(e => e && e.tipo === 'seta');
    els.forEach(e => {
      const base = {id:e.id, quadro_id:no, x:psNum(e.x), y:psNum(e.y), largura:e.w ? psNum(e.w) : null};
      if (e.tipo === 'nota'){ L.quadro_elementos.push(Object.assign(base, {tipo:'texto', texto:e.texto || ''})); ids.add(e.id); return; }
      if (e.tipo === 'registro' && e.ref){ const [t, rid] = String(e.ref).split(':');
        if (t === 'issue'){ if (!temItem.has(rid)) return; L.quadro_elementos.push(Object.assign(base, {tipo:'cartao', ref_item_id:rid})); }
        else { if (!temNo.has(rid)) return; L.quadro_elementos.push(Object.assign(base, {tipo:'cartao', ref_no_id:rid})); }
        ids.add(e.id); }
    });
    // as setas depois dos elementos que elas ligam
    setas.forEach(s => { if (ids.has(s.de) && ids.has(s.para) && s.de !== s.para) L.quadro_elementos.push({id:s.id, quadro_id:no, tipo:'seta', de_id:s.de, para_id:s.para, x:0, y:0}); });
  });
  const temPessoa = new Set(d.people.map(p => p.id)), nomes = new Set();
  (d.vistas || []).slice().reverse().forEach(v => {
    if (!v || !v.nome || !temPessoa.has(v.pessoa)) return;
    const k = v.pessoa + '|' + v.nome.toLowerCase(); if (nomes.has(k)) return; nomes.add(k);   // o banco não aceita duas com o mesmo nome da mesma pessoa: fica a mais nova
    const no = v.sel && v.sel !== 'all' ? idNo(v.sel) : null;
    L.visoes_salvas.push({id:v.id, pessoa_id:v.pessoa, no_id:no && temNo.has(no) ? no : null, nome:v.nome, visao:PS_VISOES.includes(v.view) ? v.view : 'table',
      filtros:{view:v.view || 'table', sel:v.sel || 'all', filtros:v.filtros || {}, busca:v.busca || '', raias:v.raias || null, calModo:v.calModo || null, ordem:v.ordem || null}, compartilhada:!!v.compartilhada});
  });
  L.visoes_salvas.reverse();
  return L;
};

const _montarDadosPs = montarDados;
montarDados = function(T, eu){
  const d = _montarDadosPs(T, eu);
  const chaveDe = {}; [['clients', 'client'], ['projects', 'project'], ['products', 'product'], ['apps', 'app'], ['ws', 'ws']].forEach(([lista, t]) => (d[lista] || []).forEach(o => { chaveDe[o.id] = t + ':' + o.id; }));
  d.quadros = d.quadros || {};
  const porQuadro = new Map(); (T.quadro_elementos || []).forEach(e => { if (!porQuadro.has(e.quadro_id)) porQuadro.set(e.quadro_id, []); porQuadro.get(e.quadro_id).push(e); });
  (T.quadros || []).forEach(q => {
    const k = chaveDe[q.no_id]; if (!k) return;
    const els = [];
    (porQuadro.get(q.no_id) || []).forEach(e => {
      if (e.tipo === 'seta') els.push({id:e.id, tipo:'seta', de:e.de_id, para:e.para_id});
      else if (e.tipo === 'cartao' && (e.ref_item_id || e.ref_no_id)) els.push({id:e.id, tipo:'registro', ref:e.ref_item_id ? 'issue:' + e.ref_item_id : (chaveDe[e.ref_no_id] || ''), x:+e.x || 0, y:+e.y || 0, w:e.largura ? +e.largura : 220});
      else els.push({id:e.id, tipo:'nota', texto:e.texto || '', x:+e.x || 0, y:+e.y || 0, w:e.largura ? +e.largura : 220});
    });
    // setas por último, como a tela espera
    d.quadros[k] = {els:els.filter(e => e.tipo !== 'seta').concat(els.filter(e => e.tipo === 'seta'))};
  });
  d.vistas = (T.visoes_salvas || []).slice().sort((a, b) => String(a.criado_em || '').localeCompare(String(b.criado_em || ''))).map(v => { const f = v.filtros || {};
    return {id:v.id, nome:v.nome, pessoa:v.pessoa_id, sel:f.sel || (v.no_id && chaveDe[v.no_id]) || 'all', view:f.view || v.visao, filtros:f.filtros || {}, busca:f.busca || '', raias:f.raias || 'nenhuma', calModo:f.calModo || undefined, ordem:f.ordem || undefined, compartilhada:!!v.compartilhada}; });
  return d;
};
