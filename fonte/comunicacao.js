/* ================= Comunicação: @menção nos comentários, caixa de avisos, preferências e aviso do navegador =================
   Com banco: os avisos de menção, comentário e responsável nascem no banco (parte 20) e chegam aqui a cada minuto.
   Sem banco (exemplo): a menção cria o aviso aqui mesmo. */

const CM = {prefs:null, lendoPrefs:null, vistos:new Set(), filtro:'nao_lidas'};
const CM_TOKEN = /@\[([^\]]{1,120})\]\(([\w-]{1,64})\)/g;
const CM_TIPOS = {mencao:'Menções', comentario:'Comentários', responsavel:'Passados para você', lembrete:'Lembretes', automacao:'Automações', aviso:'Outros'};
const CM_ICO = {
  mencao:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></svg>',
  comentario:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 4h16v12H8l-4 4z"/></svg>',
  responsavel:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  lembrete:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21h4"/></svg>',
  aviso:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>'
};
CM_ICO.automacao = CM_ICO.aviso;

/* ---------- texto com menções ---------- */
const cmSemToken = t => String(t || '').replace(CM_TOKEN, '@$1');
function cmHtml(t){
  let h = '', ult = 0; const s = String(t || ''); CM_TOKEN.lastIndex = 0; let m;
  while ((m = CM_TOKEN.exec(s))){ h += esc(s.slice(ult, m.index)) + '<span class="cm-mencao' + (m[2] === eu() ? ' eu' : '') + '" title="' + esc(m[1]) + '">@' + esc(m[1]) + '</span>'; ult = m.index + m[0].length; }
  return h + esc(s.slice(ult));
}
const cmMencionados = t => { const r = []; let m; CM_TOKEN.lastIndex = 0; while ((m = CM_TOKEN.exec(String(t || '')))) if (!r.includes(m[2])) r.push(m[2]); return r; };

/* ---------- escolher a pessoa ao digitar @ ---------- */
function cmCandidatos(q){
  const qq = pkSemAcento(q);
  return (D.people || []).filter(p => p.id !== eu() && p.ativo !== false && (!qq || pkSemAcento(p.nome).split(/\s+/).some(w => w.startsWith(qq)) || pkSemAcento(p.nome).startsWith(qq))).slice(0, 6);
}
function cmFecharLista(){ const l = $('#cm-lista'); if (l) l.remove(); }
function cmMostrarLista(inp){
  const antes = inp.value.slice(0, inp.selectionStart);
  const m = /(^|\s)@([^\s@]{0,30})$/.exec(antes);
  if (!m){ cmFecharLista(); return; }
  const cand = cmCandidatos(m[2]);
  if (!cand.length){ cmFecharLista(); return; }
  let l = $('#cm-lista');
  if (!l){ l = document.createElement('ul'); l.id = 'cm-lista'; l.className = 'cm-lista'; l.setAttribute('role', 'listbox'); inp.closest('form').appendChild(l); inp.setAttribute('aria-controls', 'cm-lista'); }
  const ix = Math.min(+(l.dataset.ix || 0), cand.length - 1);
  l.dataset.ix = ix;
  l.innerHTML = cand.map((p, n) => '<li role="option" id="cm-op-' + n + '" data-cm-pessoa="' + esc(p.id) + '" aria-selected="' + (n === ix) + '">' + avatar(p.id) + '<span><b>' + esc(p.nome) + '</b>' + (p.funcao ? '<small>' + esc(p.funcao) + '</small>' : '') + '</span></li>').join('');
  inp.setAttribute('aria-activedescendant', 'cm-op-' + ix);
}
function cmEscolher(inp, id){
  const p = pessoa(id); if (!p) return;
  const pos = inp.selectionStart, antes = inp.value.slice(0, pos).replace(/@([^\s@]{0,30})$/, '@' + p.nome + ' ');
  inp.value = antes + inp.value.slice(pos);
  inp.setSelectionRange(antes.length, antes.length);
  const f = inp.closest('form'); f._mencoes = (f._mencoes || []).filter(x => x.id !== p.id).concat({id:p.id, nome:p.nome});
  cmFecharLista(); inp.focus();
}
document.addEventListener('input', e => { if (e.target.matches && e.target.matches('form[data-form="coment"] input[name="t"]')) cmMostrarLista(e.target); });
document.addEventListener('keydown', e => {
  const inp = e.target.closest && e.target.closest('form[data-form="coment"] input[name="t"]');
  const l = $('#cm-lista'); if (!inp || !l) return;
  const ops = $$('[data-cm-pessoa]', l); let ix = +(l.dataset.ix || 0);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); ix = (ix + (e.key === 'ArrowDown' ? 1 : ops.length - 1)) % ops.length; l.dataset.ix = ix; cmMostrarLista(inp); }
  else if (e.key === 'Enter' || e.key === 'Tab'){ e.preventDefault(); e.stopPropagation(); cmEscolher(inp, ops[ix].dataset.cmPessoa); }
  else if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); cmFecharLista(); }
}, true);
document.addEventListener('mousedown', e => { const o = e.target.closest('[data-cm-pessoa]'); if (o){ e.preventDefault(); const inp = o.closest('form').querySelector('input[name="t"]'); cmEscolher(inp, o.dataset.cmPessoa); } else if (!e.target.closest('#cm-lista')) cmFecharLista(); });
// ao enviar: "@Nome" escolhido vira @[Nome](id), que o banco entende; sem banco, a menção já cria o aviso aqui
document.addEventListener('submit', e => {
  const f = e.target; if (!f.matches || !f.matches('form[data-form="coment"]')) return;
  cmFecharLista();
  const inp = f.querySelector('input[name="t"]'); if (!inp) return;
  let v = inp.value;
  (f._mencoes || []).forEach(m => { v = v.split('@' + m.nome).join('@[' + m.nome + '](' + m.id + ')'); });
  inp.value = v; f._mencoes = [];
  const i = byId('issues', itemAberto);
  if (!COM_BANCO && i && v.trim()){
    const autor = (pessoa(eu()) || {nome:'Alguém'}).nome;
    cmMencionados(v).filter(id => id !== eu() && pessoa(id)).forEach(id => D.notifs.unshift({id:uid('nt'), pessoa:id, tipo:'mencao', titulo:autor + ' mencionou você', txt:(typeof chaveDe === 'function' && chaveDe(i) ? chaveDe(i) + ' ' : '') + i.titulo + ': ' + cmSemToken(v).slice(0, 240), item:i.id, quando:Date.now(), lida:false}));
  }
}, true);

/* ---------- menções bonitas nos comentários do item ---------- */
const _abrirItemCm = abrirItem;
abrirItem = function(id){
  const r = _abrirItemCm.apply(this, arguments);
  $$('#gaveta-wrap .g-com > div > div:last-child').forEach(d => { if (CM_TOKEN.test(d.textContent)){ CM_TOKEN.lastIndex = 0; d.innerHTML = cmHtml(d.textContent); } CM_TOKEN.lastIndex = 0; });
  const inp = $('#gaveta-wrap form[data-form="coment"] input[name="t"]'); if (inp){ inp.placeholder = 'Escrever um comentário. Use @ para chamar alguém'; inp.setAttribute('autocomplete', 'off'); }
  return r;
};

/* ---------- a caixa de avisos ---------- */
const cmMeus = () => (D.notifs || []).filter(x => x.pessoa === eu());
const cmTipo = n => n.tipo || (/^Lembrete:/.test(n.titulo || '') ? 'lembrete' : 'aviso');
function cmQuando(t){
  const d = Date.now() - t; if (d < 60000) return 'agora';
  if (d < 3600000) return 'há ' + Math.floor(d / 60000) + ' min';
  if (d < 86400000) return 'há ' + Math.floor(d / 3600000) + ' h';
  return new Date(t).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
}
function cmCorpoCaixa(){
  const todos = cmMeus().slice().sort((a, b) => b.quando - a.quando);
  const naoLidos = todos.filter(x => !x.lida);
  const filtros = [['nao_lidas', 'Não lidos', naoLidos.length], ['todas', 'Todos', todos.length]].concat(Object.keys(CM_TIPOS).map(k => [k, CM_TIPOS[k], todos.filter(x => cmTipo(x) === k).length]).filter(f => f[2]));
  if (!filtros.some(f => f[0] === CM.filtro)) CM.filtro = 'nao_lidas';
  const lista = CM.filtro === 'todas' ? todos : CM.filtro === 'nao_lidas' ? naoLidos : todos.filter(x => cmTipo(x) === CM.filtro);
  return '<div class="cm-caixa"><div class="cm-filtros" role="group" aria-label="Filtrar avisos">' + filtros.map(([k, n, q]) => '<button type="button" class="filtro-rap" data-cm-filtro="' + k + '" aria-pressed="' + (CM.filtro === k) + '">' + esc(n) + ' <span class="cm-q">' + q + '</span></button>').join('') + '</div>' +
    (lista.length ? '<ul class="cm-avisos">' + lista.slice(0, 60).map(x => '<li class="' + (x.lida ? 'lida' : 'nova') + '"><span class="cm-ico cm-' + cmTipo(x) + '">' + (CM_ICO[cmTipo(x)] || CM_ICO.aviso) + '</span>' +
      '<button type="button" class="cm-abrir" ' + (x.item ? 'data-cm-abrir="' + esc(x.item) + '" ' : '') + 'data-cm-id="' + esc(x.id) + '"><b>' + esc(x.titulo) + '</b><span>' + esc(cmSemToken(x.txt)) + '</span><small>' + cmQuando(x.quando) + '</small></button>' +
      (x.lida ? '' : '<button type="button" class="ico-btn cm-lida" data-cm-lida="' + esc(x.id) + '" aria-label="Marcar como lido" title="Marcar como lido"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg></button>') + '</li>').join('') + '</ul>'
      : '<p class="cm-vazio">' + (CM.filtro === 'nao_lidas' ? 'Tudo lido por aqui.' : 'Nenhum aviso.') + '</p>') + '</div>';
}
function cmRepintar(){ const c = $('dialog[open] .cm-caixa'); if (c) c.outerHTML = cmCorpoCaixa(); atualizarSino(); }
function cmMarcar(ids){ let n = 0; (D.notifs || []).forEach(x => { if (ids.includes(x.id) && !x.lida){ x.lida = true; n++; } }); if (n) salvar(); return n; }
function cmAbrirCaixa(){
  if ($('dialog[open] .cm-caixa')){ cmRepintar(); return; }
  modal('Avisos', cmCorpoCaixa(), [
    {txt:'Preferências', cls:'sec', acao:() => { setTimeout(cmPreferencias, 0); }},
    {txt:'Marcar todos como lidos', cls:'sec', acao:() => { cmMarcar(cmMeus().map(x => x.id)); cmRepintar(); return false; }},
    {txt:'Fechar'}]);
  const d = $('dialog[open] .cm-caixa'); if (d) d.closest('dialog').classList.add('cm-dlg');
}
abrirNotificacoes = cmAbrirCaixa;
window.cmAbrirCaixa = cmAbrirCaixa;
document.addEventListener('click', e => {
  let x;
  if ((x = e.target.closest('[data-cm-filtro]'))){ CM.filtro = x.dataset.cmFiltro; cmRepintar(); return; }
  if ((x = e.target.closest('[data-cm-lida]'))){ cmMarcar([x.dataset.cmLida]); cmRepintar(); return; }
  if ((x = e.target.closest('[data-cm-id]'))){
    cmMarcar([x.dataset.cmId]); atualizarSino();
    const item = x.dataset.cmAbrir, dlg = x.closest('dialog');
    if (item && byId('issues', item)){ if (dlg){ dlg.close(); dlg.remove(); } if (UI.modulo !== 'operacoes' && UI.verComo !== 'stakeholder') abrirModulo('operacoes'); abrirItem(item); }
    else { if (item) toast('Esse item não existe mais ou você não tem acesso a ele'); cmRepintar(); }
  }
});

/* ---------- preferências ---------- */
const CM_PADRAO = {email_modo:'diario', email_tipos:['mencao','responsavel','comentario','lembrete'], navegador:false, relatorio_semanal:false, painel:[]};
async function cmLerPrefs(){
  if (CM.prefs) return CM.prefs;
  const sb = domBanco();
  if (!sb){ D.prefs = D.prefs || {}; CM.prefs = Object.assign({}, CM_PADRAO, D.prefs[eu()] || {}); return CM.prefs; }
  if (!CM.lendoPrefs) CM.lendoPrefs = sb.from('pessoas_preferencias').select('*').eq('pessoa_id', eu()).maybeSingle()
    .then(({data, error}) => { CM.prefs = Object.assign({}, CM_PADRAO, error ? {} : (data || {})); CM.prefsErro = error ? error.message : null; return CM.prefs; }, () => { CM.prefs = Object.assign({}, CM_PADRAO); return CM.prefs; })
    .finally(() => { CM.lendoPrefs = null; });
  return CM.lendoPrefs;
}
async function cmGravarPrefs(novo){
  const sb = domBanco();
  const linha = Object.assign({}, CM_PADRAO, CM.prefs || {}, novo);
  if (!sb){ D.prefs = D.prefs || {}; D.prefs[eu()] = {email_modo:linha.email_modo, email_tipos:linha.email_tipos, navegador:linha.navegador, relatorio_semanal:linha.relatorio_semanal, painel:linha.painel}; salvar(); CM.prefs = linha; return true; }
  const {data, error} = await sb.from('pessoas_preferencias').upsert({pessoa_id:eu(), email_modo:linha.email_modo, email_tipos:linha.email_tipos, navegador:linha.navegador, relatorio_semanal:linha.relatorio_semanal, painel:linha.painel}, {onConflict:'pessoa_id'}).select();
  if (error || !data || !data.length){ toast(error && /relation|does not exist|schema cache/i.test(error.message) ? 'As preferências ainda não estão disponíveis: falta atualizar o banco.' : 'Não deu para salvar as preferências.'); return false; }
  CM.prefs = Object.assign({}, CM_PADRAO, data[0]); return true;
}
async function cmPreferencias(){
  const p = await cmLerPrefs();
  const temNav = 'Notification' in window;
  modal('Preferências de avisos',
    '<div class="cm-prefs"><fieldset><legend class="rotulo-mini">E-mail</legend>' +
      [['imediato', 'Na hora', 'um e-mail a cada aviso (juntamos os que chegam no mesmo minuto)'], ['diario', 'Resumo do dia', 'um e-mail por dia, às 8h, só com o que você ainda não leu'], ['nunca', 'Nunca', 'só no sininho do sistema']]
        .map(([v, n, d]) => '<label class="cm-op"><input type="radio" name="cm-modo" value="' + v + '"' + (p.email_modo === v ? ' checked' : '') + '><span><b>' + n + '</b><small>' + d + '</small></span></label>').join('') +
    '</fieldset><fieldset><legend class="rotulo-mini">O que vai por e-mail</legend>' +
      [['mencao', 'Quando alguém me menciona'], ['responsavel', 'Quando passam um item para mim'], ['comentario', 'Comentários nos meus itens'], ['lembrete', 'Lembretes que eu marquei'], ['automacao', 'Avisos das automações']]
        .map(([v, n]) => '<label class="cm-ck"><input type="checkbox" name="cm-tipo" value="' + v + '"' + (p.email_tipos.includes(v) ? ' checked' : '') + '>' + n + '</label>').join('') +
    '</fieldset><fieldset><legend class="rotulo-mini">Outros</legend>' +
      '<label class="cm-ck"><input type="checkbox" id="cm-nav"' + (p.navegador ? ' checked' : '') + (temNav ? '' : ' disabled') + '>Aviso do navegador quando chegar algo novo' + (temNav ? '' : ' (este navegador não permite)') + '</label>' +
      '<label class="cm-ck"><input type="checkbox" id="cm-sem"' + (p.relatorio_semanal ? ' checked' : '') + '>Relatório da semana por e-mail, toda segunda às 8h</label>' +
    '</fieldset>' + (domBanco() ? '<p class="sec" style="margin:0;font-size:12px">O e-mail vai para o endereço do seu cadastro.</p>' : '<p class="sec" style="margin:0;font-size:12px">Nos dados de exemplo, as preferências ficam só neste navegador e nenhum e-mail é enviado.</p>') + '</div>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Salvar', acao:dlg => {
      const novo = {email_modo:(dlg.querySelector('input[name="cm-modo"]:checked') || {value:'diario'}).value, email_tipos:$$('input[name="cm-tipo"]:checked', dlg).map(x => x.value), navegador:$('#cm-nav', dlg).checked, relatorio_semanal:$('#cm-sem', dlg).checked};
      const pedir = novo.navegador && temNav && Notification.permission === 'default' ? Notification.requestPermission().catch(() => 'denied') : Promise.resolve(temNav ? Notification.permission : 'denied');
      pedir.then(perm => { if (novo.navegador && perm !== 'granted'){ novo.navegador = false; toast('O navegador não deixou mostrar avisos. Libere nas configurações do site.'); } return cmGravarPrefs(novo); }).then(ok => { if (ok) toast('Preferências salvas'); });
    }}]);
}

/* ---------- avisos novos: busca a cada minuto (com banco) e aviso do navegador ---------- */
function cmAvisoNavegador(n){
  if (!CM.prefs || !CM.prefs.navegador || !('Notification' in window) || Notification.permission !== 'granted') return;
  try { const nt = new Notification(n.titulo, {body:cmSemToken(n.txt).slice(0, 180), tag:'ciclodev-' + n.id}); nt.onclick = () => { window.focus(); if (n.item && byId('issues', n.item)) abrirItem(n.item); nt.close(); }; } catch(e){}
}
async function cmBuscarNovos(){
  const sb = domBanco(); if (!sb || !D || !D.notifs || typeof SYNC === 'undefined' || !SYNC.base) return;
  const {data, error} = await sb.from('notificacoes').select('*').eq('pessoa_id', eu()).order('criado_em', {ascending:false}).limit(50);
  if (error || !data) return;
  const tem = new Set(D.notifs.map(x => x.id)); let novos = 0;
  data.slice().reverse().forEach(r => {
    if (tem.has(r.id)) return;
    const n = {id:r.id, pessoa:r.pessoa_id, tipo:r.tipo || undefined, titulo:r.titulo, txt:r.texto || '', item:r.item_id || '', quando:new Date(r.criado_em).getTime(), lida:!!r.lida_em, _banco:true, _lidaEm:r.lida_em || undefined};
    D.notifs.unshift(n);
    if (SYNC.base.notificacoes) SYNC.base.notificacoes.set(chaveLinha({id:n.id}, ['id']), {id:n.id, lida_em:r.lida_em || null});
    if (!n.lida){ novos++; if (!CM.vistos.has(n.id)) cmAvisoNavegador(n); }
    CM.vistos.add(n.id);
  });
  if (novos){ atualizarSino(); cmRepintar(); }
}
setInterval(() => { cmBuscarNovos().catch(() => {}); }, 60000);
// o tipo de cada aviso vem do banco (parte 20); sem a parte 20, continua como antes
const _montarDadosCm = montarDados;
montarDados = function(T, e){
  const d = _montarDadosCm.apply(this, arguments);
  const tipos = new Map((T.notificacoes || []).map(n => [n.id, n.tipo]));
  (d.notifs || []).forEach(n => { if (tipos.get(n.id)) n.tipo = tipos.get(n.id); CM.vistos.add(n.id); });
  CM.prefs = null; setTimeout(() => { cmLerPrefs().catch(() => {}); }, 0);
  return d;
};
const _renderCm = render;
render = function(){ const r = _renderCm.apply(this, arguments); atualizarSino(); return r; };
cmLerPrefs().catch(() => {});

if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {abrirItem, cmHtml, cmAbrirCaixa, cmPreferencias, cmLerPrefs, CM});
