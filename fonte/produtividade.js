/* ================= Produtividade: busca rápida (Ctrl+K), atalhos de teclado, tema escuro e ajuda do filtro escrito ================= */

const pkSemAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const pkDigitando = el => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/* ---------- tema escuro ---------- */
function pkTema(escuro){
  if (typeof escuro !== 'boolean') escuro = !document.documentElement.classList.contains('tema-escuro');
  document.documentElement.classList.toggle('tema-escuro', escuro);
  try { localStorage.setItem('ciclodev-tema', escuro ? 'escuro' : 'claro'); } catch(e){}
  const b = $('[data-pk-tema]'); if (b){ b.setAttribute('aria-pressed', String(escuro)); b.title = escuro ? 'Voltar ao tema claro (T)' : 'Tema escuro (T)'; }
}
try { if (localStorage.getItem('ciclodev-tema') === 'escuro') document.documentElement.classList.add('tema-escuro'); } catch(e){}

/* ---------- ir para um lugar ---------- */
function pkIrNo(chave){ UI.sel = chave; UI.view = 'dashboard'; if (!UI.abertos[chave]) UI.abertos[chave] = true; salvarUI(); if (UI.modulo !== 'operacoes') abrirModulo('operacoes'); else rOperacoes(); }
function pkIrModulo(id){ const el = $('.item[data-tela="' + id + '"]'); if (el && !(el.parentElement && el.parentElement.hidden)){ if (id === 'operacoes' && UI.modulo !== 'operacoes') UI.view = 'dashboard'; abrirModulo(id); return true; } toast('Esse módulo não está disponível para você'); return false; }
function pkIrAba(v){ if (UI.modulo !== 'operacoes') abrirModulo('operacoes'); const b = $('.ops-cab [data-view="' + v + '"]'); if (!b){ toast('Essa aba não existe aqui'); return; } UI.view = v; salvarUI(); rView(); }
function pkNovoItem(){ if (!podeEditar()){ toast('Você só pode ver, não criar'); return; } if (UI.modulo !== 'operacoes') abrirModulo('operacoes'); if (UI.sel === 'all' && D.projects[0]) pkIrNo('project:' + D.projects[0].id); novoItem(); }
function pkMeuTrabalho(){ UI.sel = 'all'; UI.view = 'mywork'; salvarUI(); if (UI.modulo !== 'operacoes') abrirModulo('operacoes'); else rOperacoes(); }
function pkBuscarNaTela(){ const b = $('#busca-itens'); if (b){ b.focus(); b.select(); return true; } return false; }

/* ---------- a lista de ações ---------- */
function pkAcoes(){
  const a = [];
  if (podeEditar()) a.push({t:'Criar item', d:'abre a janela de novo item aqui', k:'C', f:pkNovoItem});
  a.push({t:'Meu trabalho', d:'os itens que estão com você', k:'G M', f:pkMeuTrabalho});
  a.push({t:document.documentElement.classList.contains('tema-escuro') ? 'Tema claro' : 'Tema escuro', d:'muda as cores da tela', k:'T', f:() => pkTema()});
  a.push({t:'Atalhos do teclado', d:'a lista de todas as teclas', k:'?', f:pkAtalhos});
  if (typeof abrirNotificacoes === 'function') a.push({t:'Notificações', d:'o que mudou nos seus itens', f:() => (window.cmAbrirCaixa || abrirNotificacoes)()});
  if (UI.modulo === 'operacoes' && $('#busca-itens')) a.push({t:'Filtrar os itens desta tela', d:'escreva, por exemplo: status = fazendo', k:'/', f:pkBuscarNaTela});
  return a.map(x => Object.assign({g:'Ações'}, x));
}
function pkModulos(){
  return $$('.menu .item[data-tela]').filter(el => !(el.parentElement && el.parentElement.hidden))
    .map(el => ({g:'Módulos', t:el.dataset.nome || (el.textContent || '').trim(), d:'abrir o módulo', f:() => pkIrModulo(el.dataset.tela)}));
}
function pkAbas(){
  if (UI.modulo !== 'operacoes') return [];
  return $$('.ops-cab .views [data-view].view-b').map(b => ({g:'Abas desta tela', t:b.textContent.trim(), d:(EXPL_VIEW[b.dataset.view] || '').slice(0, 90), f:() => pkIrAba(b.dataset.view)}));
}
function pkEstrutura(){
  const tipos = [['clients','client','Cliente'],['projects','project','Projeto'],['products','product','Produto'],['apps','app','Aplicação'],['ws','ws','Frente']];
  const l = [];
  tipos.forEach(([col, tp, rot]) => (D[col] || []).forEach(o => { if (o.excluido) return; const ch = tp + ':' + o.id; const tr = (typeof caminho === 'function' ? caminho(ch) : []).slice(0, -1).map(p => p[1]).join(' › '); l.push({g:'Estrutura', t:o.nome, d:rot + (tr ? ' em ' + tr : ''), f:() => pkIrNo(ch)}); }));
  return l;
}
function pkPessoas(){
  return (D.people || []).filter(p => p.acesso !== 'stakeholder').map(p => ({g:'Pessoas', t:p.nome, d:'ver os itens com ' + p.nome.split(' ')[0], f:() => { UI.sel = 'all'; UI.view = 'table'; UI.busca = 'responsável = ' + pkSemAcento(p.nome.split(' ')[0]); salvarUI(); if (UI.modulo !== 'operacoes') abrirModulo('operacoes'); else rOperacoes(); }}));
}
function pkItens(q){
  const qq = pkSemAcento(q).trim(); if (!qq) return [];
  const r = [];
  D.issues.forEach(i => {
    if (i.arquivado || i.excluido) return;
    const ch = typeof chaveDe === 'function' ? chaveDe(i) || '' : '';
    let nota = 0, onde = '';
    const tit = pkSemAcento(i.titulo);
    if (pkSemAcento(ch) === qq) nota = 100;
    else if (tit.startsWith(qq)) nota = 80;
    else if (tit.includes(qq)) nota = 60;
    else if (pkSemAcento(ch).includes(qq)) nota = 50;
    else if (pkSemAcento(i.desc).includes(qq)) { nota = 30; onde = 'na descrição'; }
    else if ((i.coments || []).some(c => pkSemAcento(c.txt).includes(qq))) { nota = 20; onde = 'num comentário'; }
    if (nota) r.push({nota, g:'Itens', t:i.titulo, d:[ch, stNome(i.status), onde].filter(Boolean).join(' · '), k:'', f:() => { if (UI.modulo !== 'operacoes') abrirModulo('operacoes'); abrirItem(i.id); }, tipo:i.tipo});
  });
  return r.sort((a, b) => b.nota - a.nota);
}
function pkResultados(q){
  const qq = pkSemAcento(q).trim();
  const bate = x => !qq || qq.split(/\s+/).every(p => pkSemAcento(x.t + ' ' + x.d).includes(p));
  const grupos = [];
  const acoes = pkAcoes().filter(bate), itens = pkItens(q).slice(0, 8), est = qq ? pkEstrutura().filter(bate).slice(0, 6) : [], abas = pkAbas().filter(bate).slice(0, qq ? 6 : 0), mods = pkModulos().filter(bate).slice(0, qq ? 6 : 0), pes = qq ? pkPessoas().filter(bate).slice(0, 4) : [];
  if (!qq){
    const recentes = (UI.pkRecentes || []).map(id => byId('issues', id)).filter(i => i && !i.arquivado).slice(0, 5)
      .map(i => ({g:'Abertos há pouco', t:i.titulo, d:[typeof chaveDe === 'function' ? chaveDe(i) : '', stNome(i.status)].filter(Boolean).join(' · '), f:() => { if (UI.modulo !== 'operacoes') abrirModulo('operacoes'); abrirItem(i.id); }}));
    grupos.push(recentes, acoes);
  } else grupos.push(itens, acoes, est, abas, mods, pes);
  return grupos.flat();
}

/* ---------- a janela da busca rápida ---------- */
let PK = null;
function pkAbrir(){
  if (PK && PK.dlg.open){ PK.inp.select(); return; }
  const dlg = document.createElement('dialog'); dlg.className = 'pk'; dlg.setAttribute('aria-label', 'Busca rápida');
  dlg.innerHTML = '<div class="pk-cab"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input class="pk-inp" type="text" placeholder="Buscar item, projeto, pessoa, aba ou ação" aria-label="Buscar" role="combobox" aria-expanded="true" aria-controls="pk-lista" aria-autocomplete="list" autocomplete="off" spellcheck="false"><kbd>Esc</kbd></div>' +
    '<ul class="pk-lista" id="pk-lista" role="listbox"></ul><div class="pk-rod"><span><kbd>↑</kbd><kbd>↓</kbd> escolher</span><span><kbd>Enter</kbd> abrir</span><span><kbd>?</kbd> todos os atalhos</span></div>';
  document.body.appendChild(dlg);
  PK = {dlg, inp:$('.pk-inp', dlg), lista:$('.pk-lista', dlg), res:[], ix:0};
  const pinta = () => {
    PK.res = pkResultados(PK.inp.value); PK.ix = Math.min(PK.ix, Math.max(0, PK.res.length - 1));
    let ult = '';
    PK.lista.innerHTML = PK.res.length ? PK.res.map((r, n) => { const cab = r.g !== ult ? '<li class="pk-grupo" role="presentation">' + esc(r.g) + '</li>' : ''; ult = r.g; return cab + '<li class="pk-op" role="option" id="pk-op-' + n + '" data-pk-ix="' + n + '" aria-selected="' + (n === PK.ix) + '">' + (r.tipo && typeof tipoHTML === 'function' ? tipoHTML(r.tipo) : '') + '<span class="pk-t"><b>' + esc(r.t) + '</b>' + (r.d ? '<small>' + esc(r.d) + '</small>' : '') + '</span>' + (r.k ? '<kbd>' + esc(r.k) + '</kbd>' : '') + '</li>'; }).join('')
      : '<li class="pk-nada" role="presentation">Nada encontrado para "' + esc(PK.inp.value) + '".' + (podeEditar() ? ' Aperte Enter para criar um item com esse nome.' : '') + '</li>';
    PK.inp.setAttribute('aria-activedescendant', PK.res.length ? 'pk-op-' + PK.ix : '');
    const sel = $('.pk-op[aria-selected="true"]', PK.lista); if (sel) sel.scrollIntoView({block:'nearest'});
  };
  const executar = n => {
    const r = PK.res[n];
    if (!r){ const t = PK.inp.value.trim(); if (t && podeEditar()){ dlg.close(); pkNovoItem(); setTimeout(() => { const c = $('dialog[open] #ni-t'); if (c) c.value = t; }, 30); } return; }
    dlg.close(); r.f();
  };
  PK.inp.addEventListener('input', () => { PK.ix = 0; pinta(); });
  PK.inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown'){ e.preventDefault(); PK.ix = Math.min(PK.res.length - 1, PK.ix + 1); pinta(); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); PK.ix = Math.max(0, PK.ix - 1); pinta(); }
    else if (e.key === 'Enter'){ e.preventDefault(); executar(PK.ix); }
  });
  PK.lista.addEventListener('mousemove', e => { const o = e.target.closest('[data-pk-ix]'); if (o && +o.dataset.pkIx !== PK.ix){ PK.ix = +o.dataset.pkIx; $$('.pk-op', PK.lista).forEach(x => x.setAttribute('aria-selected', String(x === o))); } });
  PK.lista.addEventListener('click', e => { const o = e.target.closest('[data-pk-ix]'); if (o) executar(+o.dataset.pkIx); });
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { dlg.remove(); PK = null; });
  dlg.showModal(); pinta(); PK.inp.focus();
}

/* ---------- a lista de atalhos ---------- */
const PK_ATALHOS = [
  ['Em qualquer tela', [['Ctrl K', 'busca rápida: itens, projetos, pessoas, abas e ações'], ['/', 'filtrar os itens da tela (ou abrir a busca rápida)'], ['C', 'criar item'], ['T', 'alternar tema claro e escuro'], ['?', 'esta lista de atalhos']]],
  ['Ir para (aperte G e depois a letra)', [['G O', 'Overview'], ['G P', 'Operações'], ['G M', 'Meu trabalho'], ['G C', 'Clientes'], ['G E', 'Equipe'], ['G L', 'Lixeira'], ['G S', 'Configurações']]],
  ['Na tela de Operações', [['1 a 9', 'abrir a aba nessa posição'], ['Esc', 'fechar o item aberto']]]
];
function pkAtalhos(){
  if ($('dialog[open] .pk-atalhos')) return;
  modal('Atalhos do teclado', '<div class="pk-atalhos">' + PK_ATALHOS.map(([tit, l]) => '<section><p class="rotulo-mini">' + esc(tit) + '</p><dl>' + l.map(([k, d]) => '<div><dt>' + k.split(' ').map(x => '<kbd>' + esc(x) + '</kbd>').join(' ') + '</dt><dd>' + esc(d) + '</dd></div>').join('') + '</dl></section>').join('') + '</div><p class="sec" style="margin:14px 0 0;font-size:13px">Os atalhos não funcionam enquanto você está escrevendo num campo. No Mac, use Cmd no lugar de Ctrl.</p>', [{txt:'Fechar'}]);
}

/* ---------- teclado ---------- */
let pkG = 0;
const PK_IR = {o:'overview', p:'operacoes', c:'clientes', e:'time', l:'lixeira', s:'configuracoes'};
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k'){ e.preventDefault(); if (PK && PK.dlg.open) PK.dlg.close(); else pkAbrir(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
  if (pkDigitando(e.target) || document.querySelector('dialog[open]')) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (pkG && Date.now() - pkG < 1200){
    pkG = 0;
    if (k === 'm'){ e.preventDefault(); pkMeuTrabalho(); return; }
    if (PK_IR[k]){ e.preventDefault(); pkIrModulo(PK_IR[k]); return; }
    return;
  }
  if (k === 'g'){ pkG = Date.now(); return; }
  if (e.key === '?'){ e.preventDefault(); pkAtalhos(); return; }
  if (k === '/'){ e.preventDefault(); if (!pkBuscarNaTela()) pkAbrir(); return; }
  if (k === 'c' && !itemAberto){ e.preventDefault(); pkNovoItem(); return; }
  if (k === 't'){ e.preventDefault(); pkTema(); toast(document.documentElement.classList.contains('tema-escuro') ? 'Tema escuro' : 'Tema claro'); return; }
  if (/^[1-9]$/.test(k) && UI.modulo === 'operacoes' && !itemAberto){ const b = $$('.ops-cab .views > .view-casa:not([hidden]) [data-view]')[+k - 1]; if (b){ e.preventDefault(); b.click(); } }
});

/* ---------- itens abertos há pouco (para a busca rápida vazia) ---------- */
const _abrirItemPk = abrirItem;
abrirItem = function(id){ const r = _abrirItemPk.apply(this, arguments); if (byId('issues', id)){ UI.pkRecentes = [id].concat((UI.pkRecentes || []).filter(x => x !== id)).slice(0, 8); salvarUI(); } return r; };

/* ---------- botões no menu: busca rápida e tema ---------- */
function pkBotoesMenu(){
  if ($('[data-pk-abrir]')) return;
  const alvo = $('.menu-rodape'); if (!alvo) return;
  alvo.insertAdjacentHTML('beforebegin', '<div class="pk-menu-botoes"><button type="button" class="pk-menu-b" data-pk-abrir title="Busca rápida (Ctrl K)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><span>Buscar</span><kbd>Ctrl K</kbd></button><button type="button" class="pk-menu-b pk-tema-b" data-pk-tema aria-pressed="' + document.documentElement.classList.contains('tema-escuro') + '" title="Tema escuro (T)" aria-label="Tema escuro"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg></button></div>');
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-pk-abrir]')){ pkAbrir(); return; }
  if (e.target.closest('[data-pk-tema]')){ pkTema(); return; }
  const ex = e.target.closest('[data-pk-exemplo]');
  if (ex){ const b = $('#busca-itens'); UI.busca = ex.dataset.pkExemplo; salvarUI(); const d = ex.closest('dialog'); if (d) d.close(); rView(); const nb = $('#busca-itens'); if (nb){ nb.focus(); nb.setSelectionRange(nb.value.length, nb.value.length); } return; }
  if (e.target.closest('[data-pk-ajuda-filtro]')){ pkAjudaFiltro(); }
});

/* ---------- filtro escrito: em português, aceita os nomes antigos em inglês, e tem ajuda ---------- */
function pkNormalizarBusca(b){
  return String(b || '').replace(/\b(status|situação|situacao|tipo|prioridade)\s*=\s*([^=]+?)(?=\s+e\s+|$)/gi, (m, campo, v) => {
    const c = pkSemAcento(campo), vv = pkSemAcento(v.trim());
    const lista = c === 'tipo' ? TIPOS : c === 'prioridade' ? PRIOS : STATUS;
    const achou = lista.find(x => pkSemAcento(x.en || '') === vv || pkSemAcento(x.id) === vv || pkSemAcento(x.nome) === vv) || lista.find(x => pkSemAcento(x.nome).includes(vv) || pkSemAcento(x.en || '').includes(vv));
    return (c === 'situacao' ? 'status' : c) + ' = ' + (achou ? achou.nome.toLowerCase() : v.trim());
  });
}
const _listaFiltradaPk = listaFiltrada;
listaFiltrada = function(){ const orig = UI.busca; UI.busca = pkNormalizarBusca(orig); try { return _listaFiltradaPk.apply(this, arguments); } finally { UI.busca = orig; } };
const _ferramentasPk = ferramentasHTML;
ferramentasHTML = function(extra){
  return _ferramentasPk(extra)
    .replace('placeholder="Buscar ou: status = in progress e responsável = ana"', 'placeholder="Buscar, ou escreva: status = fazendo e responsável = ana"')
    .replace(/<button class="info" type="button" data-info="Advanced search[^"]*"[^>]*>i<\/button>/, '<button class="btn fant peq pk-ajuda-b" type="button" data-pk-ajuda-filtro title="Como escrever um filtro">Como filtrar</button>')
    .replace(/Quick filters<button class="info"[^>]*>i<\/button>/, 'Filtros rápidos')
    .replace('<option value="">Saved views</option>', '<option value="">Visões salvas</option>');
};
function pkAjudaFiltro(){
  const ex = [['status = fazendo', 'os itens em andamento'], ['responsável = ana', 'os itens da Ana'], ['prioridade = urgente', 'só os urgentes'], ['tipo = defeito', 'só os defeitos'], ['status = travado e responsável = bruno', 'junte duas regras com " e "'], ['login', 'sem "=": procura a palavra no título e no caminho']];
  modal('Como filtrar os itens', '<p style="margin:0 0 12px">Escreva uma palavra para procurar no título, ou use <b>campo = valor</b>. Para juntar regras, use <b>" e "</b> entre elas. Não importa se tem acento ou letra maiúscula.</p>' +
    '<div class="pk-campos"><p class="rotulo-mini">Campos que dá para usar</p><dl>' +
      '<div><dt>status</dt><dd>' + STATUS.map(s => esc(s.nome.toLowerCase())).join(', ') + '</dd></div>' +
      '<div><dt>prioridade</dt><dd>' + PRIOS.map(s => esc(s.nome.toLowerCase())).join(', ') + '</dd></div>' +
      '<div><dt>tipo</dt><dd>' + TIPOS.map(s => esc(s.nome.toLowerCase())).join(', ') + '</dd></div>' +
      '<div><dt>responsável</dt><dd>o nome da pessoa, ou só o começo</dd></div></dl></div>' +
    '<p class="rotulo-mini" style="margin:16px 0 6px">Exemplos (clique para usar)</p><ul class="pk-exemplos">' + ex.map(([q, d]) => '<li><button type="button" data-pk-exemplo="' + esc(q) + '"><code>' + esc(q) + '</code><small>' + esc(d) + '</small></button></li>').join('') + '</ul>', [{txt:'Fechar'}]);
}

/* ---------- ligar ---------- */
const _renderPk = render;
render = function(){ const r = _renderPk.apply(this, arguments); pkBotoesMenu(); return r; };
pkBotoesMenu();

if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {abrirItem, pkAbrir, pkResultados, pkNormalizarBusca, pkTema, listaFiltrada});
