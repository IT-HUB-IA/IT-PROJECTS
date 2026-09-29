/* =====================================================================
   BOARD NO FORMATO JIRA E TRELLO, BACKLOG, SINALIZAR, CHAVE BL-123 E EQUIPES
   Organização da tela igual à do Jira e do Trello, para quem vem de lá se sentir em casa.
   Modelo único de dados: ver docs/INTEGRACOES-MODELO.md (nada repetido).
   ===================================================================== */

/* ---------- prioridade "Lowest" (Jira tem 5 níveis) ---------- */
if (!PRIOS.some(p => p.id === 'lowest')) PRIOS.push({id:'lowest', nome:'Lowest', expl:'mínima'});
ICO_PRIO.lowest = SV('<path d="M6 5l6 6 6-6M6 11l6 6 6-6"/>');

/* ---------- dados novos: começam vazios nos dados de exemplo e nos antigos ---------- */
function garantirBoard(d){
  d.boards = d.boards || {};
  d.equipes = d.equipes || [];
  d.issues.forEach(i => { i.membros = i.membros || []; i.observadores = i.observadores || []; i.votos = i.votos || []; i.etiquetas = i.etiquetas || []; if (i.ordem == null) i.ordem = 0; });
}
garantirBoard(D);
const _sementeB = semente;
semente = function(){ const d = _sementeB(); garantirBoard(d); return d; };

/* ---------- chave legível (BL-123): no banco o gatilho gera; no exemplo, geramos aqui ---------- */
function prefixoProjeto(pj){
  if (!pj) return 'IT';
  if (pj.chavePrefixo) return pj.chavePrefixo;
  const base = (pj.nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().replace(/^[0-9]+/, '').slice(0, 4) || 'IT';
  return base;
}
function chaveDe(i){
  if (i.chave) return i.chave;
  if (COM_BANCO) return '';
  const pj = projDe(appDe(i)); if (!pj) return '';
  const doProj = D.issues.filter(x => projDe(appDe(x)) === pj).sort((a, b) => String(a.criado || '').localeCompare(String(b.criado || '')) || String(a.id).localeCompare(String(b.id)));
  doProj.forEach(x => { if (!x.chave){ pj.chaveSeq = (pj.chaveSeq || 0) + 1; x.chave = prefixoProjeto(pj) + '-' + pj.chaveSeq; } });
  return i.chave || '';
}

/* ---------- configuração do Board: vale a do nó ou a do nó acima mais próximo (como o board de um projeto do Jira) ---------- */
function boardDoEscopo(chave){
  if (!chave || chave === 'all') return {chave:null, cfg:null};
  const acima = caminho(chave).map(p => p[0]).reverse();
  for (const k of acima) if (D.boards[k]) return {chave:k, cfg:D.boards[k]};
  return {chave:null, cfg:null};
}
const tokenStatus = i => (i.st && D.statusCustom.some(s => s.id === i.st)) ? i.st : i.status;
const nomeToken = t => { const c = D.statusCustom.find(s => s.id === t); return c ? c.nome : stNome(t); };
const grupoToken = t => { const c = D.statusCustom.find(s => s.id === t); return c ? c.grupo : t; };
function statusDisponiveis(chave){
  const lista = STATUS.map(s => ({id:s.id, nome:s.nome, grupo:s.id}));
  statusDoEscopo(chave).forEach(c => lista.push({id:c.id, nome:c.nome, grupo:c.grupo, custom:true}));
  return lista;
}
function colunasDoBoard(chave){
  const {cfg} = boardDoEscopo(chave);
  if (cfg && cfg.colunas && cfg.colunas.length) return cfg.colunas.slice().sort((a, b) => a.ordem - b.ordem);
  // padrão: uma coluna por status (como o Kanban padrão do Jira e as listas do Trello)
  return statusDisponiveis(chave).map((s, k) => ({id:'auto:' + s.id, nome:s.nome, ordem:k, min:null, max:null, status:[s.id], auto:true, grupo:s.grupo}));
}
const estimativaDe = cfg => (cfg && cfg.estimativa) || 'pontos';
function somaEstimativa(lista, tipo){
  if (tipo === 'nenhuma') return '';
  if (tipo === 'contagem') return '';
  if (tipo === 'horas') { const h = lista.reduce((s, i) => s + (+i.est || 0), 0); return h ? h + 'h' : ''; }
  const p = lista.reduce((s, i) => s + (+i.pontos || 0), 0); return p ? p + ' pts' : '';
}

/* ---------- cartão no formato Jira + Trello ---------- */
const PALETA_EPIC = ['#6D4AFF','#0E8A55','#E08600','#3355E0','#B04A00','#C2185B','#00838F','#5D4037','#455A64'];
const corEpic = e => { let h = 0; String(e.id).split('').forEach(c => { h = (h * 31 + c.charCodeAt(0)) >>> 0; }); return PALETA_EPIC[h % PALETA_EPIC.length]; };
const ICO_BAND = SV('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>');
const ICO_DESC = SV('<path d="M4 6h16M4 12h16M4 18h10"/>');
const ICO_CHECK = SV('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12.5l2.5 2.5L16 9.5"/>');
const ICO_CLIP = ICO.clip;
const ICO_COM = SV('<path d="M4 4h16v12H8l-4 4z"/>');
const ICO_RELOGIO = SV('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>');
function etiquetasDoItem(i){ return (i.etiquetas || []).map(id => D.tags.find(t => t.id === id)).filter(Boolean); }
function capaDoItem(i){ const r = (i.refs || []).find(x => x.capa && (x.tipo === 'imagem') && x.url); return r ? r.url : ''; }
cartaoHTML = function(i){
  const ck = i.check.filter(x => x.f).length, atr = atrasado(i), ep = epicDe(i), chave = chaveDe(i);
  const tags = etiquetasDoItem(i), capa = capaDoItem(i), feito = i.status === 'done';
  const pessoasC = [i.resp].concat(i.membros || []).filter((v, k, a) => v && a.indexOf(v) === k).slice(0, 3);
  const badge = (ico, txt, tit, cls) => '<span class="bj-badge' + (cls ? ' ' + cls : '') + '" title="' + esc(tit) + '">' + ico + (txt !== '' && txt != null ? '<span>' + txt + '</span>' : '') + '</span>';
  return '<article class="cartao bj-cartao c-' + i.status + (i.sinal ? ' sinalizado' : '') + '" draggable="' + podeEditar() + '" data-item="' + i.id + '" tabindex="0" aria-label="' + esc((chave ? chave + ' ' : '') + i.titulo) + '">' +
    (capa ? '<div class="bj-capa" style="background-image:url(\'' + esc(capa).replace(/'/g, '') + '\')"></div>' : '') +
    (tags.length ? '<div class="bj-tags">' + tags.map(t => '<span class="bj-tag" style="--c:' + esc(t.cor) + '" title="' + esc(t.nome) + '">' + esc(t.nome) + '</span>').join('') + '</div>' : '') +
    (ep ? '<div class="bj-epic" style="--c:' + corEpic(ep) + '" title="Épico: ' + esc(ep.titulo) + '">' + esc(ep.titulo) + '</div>' : '') +
    '<div class="tt">' + esc(i.titulo) + '</div>' +
    '<div class="bj-badges">' +
      (i.fim ? badge(ICO_RELOGIO, fmt(i.fim), (atr ? 'Atrasado. ' : '') + 'Prazo ' + fmt(i.fim), feito ? 'ok' : atr ? 'atraso' : '') : '') +
      (i.desc ? badge(ICO_DESC, '', 'Tem descrição') : '') +
      (i.check.length ? badge(ICO_CHECK, ck + '/' + i.check.length, 'Checklist ' + ck + ' de ' + i.check.length, ck === i.check.length ? 'ok' : '') : '') +
      (i.coments.length ? badge(ICO_COM, i.coments.length, i.coments.length + ' comentário(s)') : '') +
      ((i.refs || []).length ? badge(ICO_CLIP, i.refs.length, i.refs.length + ' anexo(s)') : '') +
      (i.links.length ? badge(SV('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'), '', 'Tem ligação com outro item') : '') +
      (i.vis === 'cliente' ? badge(SV('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'), '', 'Visível ao cliente') : '') +
    '</div>' +
    '<div class="bj-rod"><span class="bj-rod-esq">' + tipoHTML(i.tipo) + (chave ? '<span class="bj-chave' + (feito ? ' feito' : '') + '">' + esc(chave) + '</span>' : '') +
      (i.sinal ? '<span class="bj-band" title="Sinalizado' + (i.motivoSinal ? ': ' + esc(i.motivoSinal) : '') + '">' + ICO_BAND + '</span>' : '') + '</span>' +
      '<span class="bj-rod-dir">' + prioHTML(i.prio) + (i.pontos ? '<span class="bj-pts" title="Story points">' + esc(i.pontos) + '</span>' : '') +
      '<span class="bj-avs">' + (pessoasC.length ? pessoasC.map(avatar).join('') : '' + avatar(null) + '') + '</span></span></div>' +
    '</article>';
};

/* ---------- filtro por pessoa (os avatares acima do Board, como no Jira) ---------- */
const _listaFiltradaB = listaFiltrada;
listaFiltrada = function(){
  let l = _listaFiltradaB();
  const ps = UI.bjPessoas || [];
  if (ps.length) l = l.filter(i => ps.includes(i.resp || '') || (i.membros || []).some(m => ps.includes(m)));
  if (UI.bjEpic) l = l.filter(i => UI.bjEpic === 'sem' ? !epicDe(i) && i.tipo !== 'epic' : (epicDe(i) || {}).id === UI.bjEpic);
  return l;
};
function avataresFiltro(lista){
  const ids = [...new Set(lista.flatMap(i => [i.resp].concat(i.membros || [])).filter(Boolean))];
  const ps = UI.bjPessoas || [];
  if (!ids.length) return '';
  return '<div class="bj-avfiltro" role="group" aria-label="Filtrar por pessoa">' + ids.map(id => { const p = pessoa(id); if (!p) return '';
    return '<button type="button" class="bj-avbtn' + (ps.includes(id) ? ' ligado' : '') + '" data-bj-pessoa="' + id + '" aria-pressed="' + ps.includes(id) + '" title="Mostrar só os itens de ' + esc(p.nome) + '">' + avatar(id) + '</button>'; }).join('') +
    (ps.length ? '<button type="button" class="btn fant peq" data-bj-pessoa="">Limpar</button>' : '') + '</div>';
}

/* ---------- ordem manual (Jira: rank; Trello: pos) ---------- */
const porOrdemItem = (a, b) => (+a.ordem || 0) - (+b.ordem || 0) || String(a.criado || '').localeCompare(String(b.criado || ''));
function novaOrdem(lista, antesDeId){
  const ord = lista.slice().sort(porOrdemItem);
  if (!antesDeId){ const ult = ord[ord.length - 1]; return ult ? (+ult.ordem || 0) + 1024 : 1024; }
  const k = ord.findIndex(x => x.id === antesDeId); if (k < 0) return (ord.length ? +ord[ord.length - 1].ordem + 1024 : 1024);
  const depois = +ord[k].ordem || 0, antes = k > 0 ? (+ord[k - 1].ordem || 0) : depois - 2048;
  return (antes + depois) / 2;
}

/* ---------- o Board ---------- */
vBoard = function(){
  const {chave:chCfg, cfg} = boardDoEscopo(UI.sel);
  const tipoB = (cfg && cfg.tipo) || 'kanban', est = estimativaDe(cfg);
  const pj = cadeia(UI.sel).project;
  let l = listaFiltrada();
  let topoSprint = '';
  if (tipoB === 'scrum'){
    const sp = pj && D.sprints.find(s => s.project === pj.id && s.status === 'ativo');
    if (!sp) return ferramentasBoard(l, tipoB) + '<div class="bj-vazio"><h3>Nenhum sprint ativo</h3><p>No Scrum, o Board mostra o sprint que está em andamento. Vá para o <button type="button" class="btn sec peq" data-bj-view="backlog">Backlog</button> e inicie um sprint.</p></div>';
    l = l.filter(i => i.sprint === sp.id && i.tipo !== 'epic');
    const dias = Math.round((parse(sp.fim) - HOJE) / 864e5);
    topoSprint = '<div class="bj-sprint-topo"><div><b>' + esc(sp.nome) + '</b>' + (sp.meta ? '<span class="sec"> · ' + esc(sp.meta) + '</span>' : '') + '</div><div class="bj-sprint-dir"><span class="sec">' + (dias >= 0 ? 'termina em ' + dias + ' dia' + (dias === 1 ? '' : 's') : 'passou ' + (-dias) + ' dia' + (dias === -1 ? '' : 's') + ' do fim') + ' (' + fmt(sp.fim) + ')</span>' + (podeEditar() ? '<button class="btn sec peq" type="button" data-rc-sprint-fim="' + sp.id + '">Concluir sprint</button>' : '') + '</div></div>';
  } else if (cfg && cfg.backlog && tipoB === 'kanban'){
    l = l.filter(i => i.status !== 'backlog');
  }
  if (!(cfg && cfg.subtarefas === false)) { /* subtarefas aparecem no Board, como no Jira */ }
  const cols = colunasDoBoard(UI.sel).filter(c => !(tipoB !== 'simples' && cfg && cfg.backlog && tipoB === 'kanban' && c.status.length === 1 && c.status[0] === 'backlog'));
  const naColuna = new Map(); cols.forEach(c => c.status.forEach(t => naColuna.set(t, c.id)));
  const semColuna = l.filter(i => !naColuna.has(tokenStatus(i)));
  const [tipo, id] = UI.sel.split(':');
  const wip = tipo === 'ws' ? ((byId('ws', id) || {}).wip || 0) : 0;
  const coluna = (c, lista, raia) => {
    const its = lista.filter(i => naColuna.get(tokenStatus(i)) === c.id).sort(porOrdemItem);
    const contam = cfg && cfg.subtarefas === false ? its.filter(i => i.tipo !== 'subtask') : its;
    const max = c.max || (c.auto && wip && c.grupo === 'doing' ? wip : null), min = c.min;
    const estouro = max && contam.length > max, falta = min != null && contam.length < min;
    const soma = somaEstimativa(its, est);
    const grupoCor = c.status.length ? grupoToken(c.status[0]) : 'todo';
    return '<section class="coluna bj-coluna col-' + grupoCor + (estouro ? ' cheia' : '') + (falta ? ' abaixo' : '') + '" aria-label="' + esc(c.nome) + '">' +
      '<div class="coluna-cab"><span class="bj-col-nome">' + esc(c.nome) + (c.status.length > 1 ? I(c.nome + ': junta os status ' + c.status.map(nomeToken).join(', ')) : '') + '</span>' +
        '<span class="bj-col-dir">' + (soma ? '<span class="bj-soma" title="Soma da estimativa">' + soma + '</span>' : '') + '<span class="qt' + (estouro ? ' estouro' : '') + '" title="' + (max ? 'Máximo ' + max : '') + (min != null ? ' Mínimo ' + min : '') + '">' + contam.length + (max ? ' / ' + max : '') + '</span></span></div>' +
      (estouro ? '<div class="bj-aviso-col">Passou do máximo de ' + max + '</div>' : falta ? '<div class="bj-aviso-col falta">Abaixo do mínimo de ' + min + '</div>' : '') +
      '<div class="coluna-corpo" data-bj-coluna="' + esc(c.id) + '" data-bj-status="' + esc(c.status[0] || '') + '"' + (raia ? ' data-raia="' + esc(raia) + '"' : '') + '>' + its.map(cartaoHTML).join('') + '</div>' +
      (podeEditar() && !raia && c.status.length ? '<form class="add-rap bj-criar" data-add-status="' + esc(c.status[0]) + '"><input class="campo" name="t" placeholder="+ Criar" aria-label="Criar item em ' + esc(c.nome) + '"><button class="btn peq" type="submit" aria-label="Criar">' + ICO.mais + '</button></form>' : '') +
      '</section>';
  };
  const colunas = (lista, raia) => '<div class="board bj-board">' + cols.map(c => coluna(c, lista, raia)).join('') +
    (!raia && souMaster() ? '<button type="button" class="bj-nova-col" data-bj-acao="config" title="Adicionar outra coluna" aria-label="Adicionar outra coluna">' + ICO.mais + '</button>' : '') + '</div>';
  let corpo;
  if (UI.raias === 'nenhuma') corpo = colunas(l);
  else {
    const chaveR = i => UI.raias === 'resp' ? (pessoa(i.resp) || {nome:'Sem responsável'}).nome : UI.raias === 'prio' ? prioNome(i.prio) : UI.raias === 'epic' ? ((epicDe(i) || (i.tipo === 'epic' ? i : null)) || {titulo:'Sem épico'}).titulo : UI.raias === 'sprint' ? ((D.sprints.find(s => s.id === i.sprint) || {nome:'Fora de sprint'}).nome) : (appDe(i) || {nome:'-'}).nome;
    const grupos = [...new Set(l.map(chaveR))].sort();
    corpo = grupos.map(g => '<div class="raia"><div class="raia-cab">' + esc(g) + '</div>' + colunas(l.filter(i => chaveR(i) === g), g) + '</div>').join('') || '<p class="vazio-linha">Nenhum item com esses filtros.</p>';
  }
  const aviso = semColuna.length ? '<p class="bj-sem-col">' + semColuna.length + ' ite' + (semColuna.length === 1 ? 'm está' : 'ns estão') + ' num status que não tem coluna neste Board (' + [...new Set(semColuna.map(i => nomeToken(tokenStatus(i))))].join(', ') + ').' + (souMaster() ? ' <button type="button" class="btn fant peq" data-bj-acao="config">Configurar colunas</button>' : '') + '</p>' : '';
  return ferramentasBoard(l, tipoB) + topoSprint + aviso + '<div class="board-rolo">' + corpo + '</div>';
};
function ferramentasBoard(l, tipoB){
  const raiasSel = '<label class="rotulo-mini bj-agrupar">Agrupar por' + I('Agrupar por (Jira: swimlanes, faixas horizontais que agrupam o quadro)') + '<select class="sel peq" id="raias">' + [['nenhuma','Nada'],['resp','Responsável'],['prio','Prioridade'],['app','Aplicação'],['epic','Épico'],['sprint','Sprint']].map(([k, n]) => '<option value="' + k + '"' + (UI.raias === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>';
  const extra = avataresFiltro(issuesEm(UI.sel)) + raiasSel +
    '<span class="bj-tipo-board" title="Tipo deste Board">' + ({scrum:'Scrum', kanban:'Kanban', simples:'Simples'}[tipoB] || 'Kanban') + '</span>' +
    (souMaster() && UI.sel !== 'all' ? '<button class="btn sec peq" type="button" data-bj-acao="config" title="Configurar o Board">⋯ Configurar</button>' : '') +
    (podeEditar() ? '<button class="btn" type="button" data-acao="novo-item">' + ICO.mais + 'Criar</button>' : '');
  return ferramentasHTML(extra);
}

/* ---------- arrastar: muda a coluna e a posição (ordem) ---------- */
const _ligarArrastarB = ligarArrastar;
ligarArrastar = function(){
  _ligarArrastarB();
  const marcar = (z, y) => { z.querySelectorAll('.bj-alvo').forEach(x => x.classList.remove('bj-alvo', 'bj-alvo-fim'));
    const cards = [...z.querySelectorAll('[data-item]:not(.arrastando)')]; const alvo = cards.find(c => { const r = c.getBoundingClientRect(); return y < r.top + r.height / 2; });
    if (alvo) alvo.classList.add('bj-alvo'); else if (cards.length) cards[cards.length - 1].classList.add('bj-alvo-fim'); return alvo ? alvo.dataset.item : null; };
  $$('[data-bj-coluna],[data-bj-sec]').forEach(z => {
    z.addEventListener('dragover', e => { e.preventDefault(); z.classList.add('sobre'); marcar(z, e.clientY); });
    z.addEventListener('dragleave', e => { if (!z.contains(e.relatedTarget)){ z.classList.remove('sobre'); z.querySelectorAll('.bj-alvo,.bj-alvo-fim').forEach(x => x.classList.remove('bj-alvo', 'bj-alvo-fim')); } });
    z.addEventListener('drop', e => {
      e.preventDefault(); z.classList.remove('sobre');
      const antes = marcar(z, e.clientY); z.querySelectorAll('.bj-alvo,.bj-alvo-fim').forEach(x => x.classList.remove('bj-alvo', 'bj-alvo-fim'));
      const i = byId('issues', e.dataTransfer.getData('text/plain')); if (!i) return;
      if (z.dataset.bjColuna){
        const col = colunasDoBoard(UI.sel).find(c => c.id === z.dataset.bjColuna); if (!col) return;
        const vizinhos = listaFiltrada().filter(x => x.id !== i.id && col.status.includes(tokenStatus(x)));
        if (!col.status.includes(tokenStatus(i))){
          const alvo = col.status[0]; const cst = D.statusCustom.find(s => s.id === alvo);
          if (cst){ i.st = cst.id; mudarStatus(i, cst.grupo); } else { delete i.st; mudarStatus(i, alvo); }
        }
        i.ordem = novaOrdem(vizinhos, antes && antes !== i.id ? antes : null);
      } else {
        const sec = z.dataset.bjSec; const novo = sec || null;
        if ((i.sprint || null) !== novo){ i.sprint = novo; toast('"' + (chaveDe(i) || i.titulo) + '" foi para ' + (novo ? (D.sprints.find(s => s.id === novo) || {}).nome : 'o Backlog')); }
        const vizinhos = issuesEm(UI.sel).filter(x => x.id !== i.id && (x.sprint || null) === novo);
        i.ordem = novaOrdem(vizinhos, antes && antes !== i.id ? antes : null);
      }
      salvar(); rView();
    });
  });
  $$('[data-bj-linha][draggable="true"]').forEach(c => {
    c.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', c.dataset.bjLinha); e.dataTransfer.effectAllowed = 'move'; c.classList.add('arrastando'); });
    c.addEventListener('dragend', () => c.classList.remove('arrastando'));
  });
};

/* ---------- configurar o Board (tipo, estimativa, colunas com mínimo e máximo) ---------- */
function abrirConfigBoard(){
  if (!souMaster()) return;
  const alvoK = (() => { const pj = cadeia(UI.sel).project; return boardDoEscopo(UI.sel).chave || (pj ? 'project:' + pj.id : UI.sel); })();
  const atual = D.boards[alvoK];
  const cfg = JSON.parse(JSON.stringify(atual || {tipo:'kanban', estimativa:'pontos', backlog:false, subtarefas:true, colunas:[]}));
  if (!cfg.colunas.length) cfg.colunas = colunasDoBoard(alvoK).map((c, k) => ({id:novoUuid(), nome:c.nome, ordem:k, min:null, max:c.max || null, status:c.status.slice()}));
  const sts = statusDisponiveis(alvoK);
  const desenhar = dl => {
    const usados = new Map(); cfg.colunas.forEach(c => c.status.forEach(s => usados.set(s, c.id)));
    $('.modal-corpo', dl).innerHTML =
      '<p class="sec" style="margin:0">Vale para ' + esc(nomeDe(alvoK)) + ' e tudo o que está dentro.</p>' +
      '<div class="grade-form"><label class="lb">Forma de trabalhar' + I('Contínuo: o Quadro mostra tudo o que começou. Com sprints: o Quadro mostra só o sprint em andamento e a Fila guarda o resto. Só colunas: o mais simples, sem fila') +
        '<select class="sel" data-bjc="tipo">' + [['kanban','Contínuo (sem sprints)'],['scrum','Com sprints de 1 ou 2 semanas'],['simples','Só colunas']].map(([v, n]) => '<option value="' + v + '"' + (cfg.tipo === v ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' +
      '<label class="lb">O que somar em cada coluna' + I('O total que aparece no topo de cada coluna e do sprint') + '<select class="sel" data-bjc="estimativa">' + [['pontos','Pontos de esforço'],['horas','Horas estimadas'],['contagem','Quantidade de itens'],['nenhuma','Nada']].map(([v, n]) => '<option value="' + v + '"' + (cfg.estimativa === v ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' +
      '<label class="lb"><span>Fila fora do Quadro</span><select class="sel" data-bjc="backlog"><option value="1"' + (cfg.backlog ? ' selected' : '') + '>Sim, o que está na fila não aparece no Quadro</option><option value="0"' + (!cfg.backlog ? ' selected' : '') + '>Não</option></select></label>' +
      '<label class="lb"><span>Subtarefas contam no máximo da coluna</span><select class="sel" data-bjc="subtarefas"><option value="1"' + (cfg.subtarefas !== false ? ' selected' : '') + '>Sim</option><option value="0"' + (cfg.subtarefas === false ? ' selected' : '') + '>Não</option></select></label></div>' +
      '<h3 class="bj-cfg-tit">Colunas do Quadro</h3><p class="sec" style="margin:0 0 8px;font-size:13px">Cada coluna junta uma ou mais situações. A última é a de concluído. Se passar do mínimo ou do máximo, a coluna fica amarela ou vermelha.</p>' +
      '<div class="bj-cfg-cols">' + cfg.colunas.map((c, k) => '<div class="bj-cfg-col" data-k="' + k + '">' +
        '<div class="bj-cfg-l1"><input class="campo" data-bjcol="nome" value="' + esc(c.nome) + '" aria-label="Nome da coluna">' +
        '<label class="bj-mini">Mín.<input class="campo" type="number" min="0" data-bjcol="min" value="' + (c.min ?? '') + '"></label><label class="bj-mini">Máx.<input class="campo" type="number" min="1" data-bjcol="max" value="' + (c.max ?? '') + '"></label>' +
        '<button type="button" class="ico-btn" data-bjcol-mover="-1" aria-label="Mover para a esquerda"' + (k === 0 ? ' disabled' : '') + '>‹</button><button type="button" class="ico-btn" data-bjcol-mover="1" aria-label="Mover para a direita"' + (k === cfg.colunas.length - 1 ? ' disabled' : '') + '>›</button>' +
        '<button type="button" class="ico-btn perigo" data-bjcol-tirar aria-label="Tirar coluna">' + ICO.fechar + '</button></div>' +
        '<div class="bj-cfg-sts">' + sts.map(s => { const dono = usados.get(s.id); const aqui = c.status.includes(s.id);
          return '<label class="bj-chk' + (dono && !aqui ? ' outra' : '') + '"><input type="checkbox" data-bjcol-st="' + esc(s.id) + '"' + (aqui ? ' checked' : '') + '>' + esc(s.nome) + (dono && !aqui ? ' <small>(em outra coluna)</small>' : '') + '</label>'; }).join('') + '</div></div>').join('') + '</div>' +
      '<button type="button" class="btn sec peq" data-bjcol-nova>' + ICO.mais + 'Adicionar outra coluna</button>' +
      (sts.filter(s => !usados.has(s.id)).length ? '<p class="bj-sem-col">Situações sem coluna (os itens nelas não aparecem no Quadro): ' + sts.filter(s => !usados.has(s.id)).map(s => esc(s.nome)).join(', ') + '</p>' : '');
  };
  const dl = modal('Configurar o quadro', '', [{txt:'Cancelar', cls:'sec'}, {txt:'Salvar', acao:() => {
    cfg.colunas = cfg.colunas.filter(c => c.nome.trim()).map((c, k) => Object.assign(c, {ordem:k, nome:c.nome.trim()}));
    if (!cfg.colunas.length){ toast('O quadro precisa de pelo menos uma coluna'); return false; }
    if (cfg.colunas.some(c => c.min != null && c.max != null && c.max < c.min)){ toast('O máximo não pode ser menor que o mínimo'); return false; }
    cfg.colunas.forEach(c => c.status.sort((x, y) => ordemToken(x) - ordemToken(y)));
    D.boards[alvoK] = cfg; salvar(); rView(); toast('Board configurado');
  }}]);
  dl.classList.add('modal-larga');
  desenhar(dl);
  dl.addEventListener('input', e => { const t = e.target, box = t.closest('[data-k]');
    if (t.dataset.bjc) cfg[t.dataset.bjc] = t.dataset.bjc === 'backlog' || t.dataset.bjc === 'subtarefas' ? t.value === '1' : t.value;
    if (box && t.dataset.bjcol){ const c = cfg.colunas[+box.dataset.k]; if (t.dataset.bjcol === 'nome') c.nome = t.value; else c[t.dataset.bjcol] = t.value === '' ? null : Math.max(0, parseInt(t.value, 10) || 0); } });
  dl.addEventListener('change', e => { const t = e.target, box = t.closest('[data-k]');
    if (t.dataset.bjc){ cfg[t.dataset.bjc] = t.dataset.bjc === 'backlog' || t.dataset.bjc === 'subtarefas' ? t.value === '1' : t.value; return; }
    if (box && t.dataset.bjcolSt){ const st = t.dataset.bjcolSt; cfg.colunas.forEach(c => { c.status = c.status.filter(x => x !== st); }); if (t.checked) cfg.colunas[+box.dataset.k].status.push(st); desenhar(dl); } });
  dl.addEventListener('click', e => { const b = e.target.closest('[data-bjcol-nova],[data-bjcol-tirar],[data-bjcol-mover]'); if (!b) return; const box = b.closest('[data-k]');
    if (b.hasAttribute('data-bjcol-nova')) cfg.colunas.push({id:novoUuid(), nome:'Nova coluna', ordem:cfg.colunas.length, min:null, max:null, status:[]});
    else if (b.hasAttribute('data-bjcol-tirar')) cfg.colunas.splice(+box.dataset.k, 1);
    else { const k = +box.dataset.k, n = k + (+b.dataset.bjcolMover); const [c] = cfg.colunas.splice(k, 1); cfg.colunas.splice(n, 0, c); }
    desenhar(dl); });
}

/* ---------- BACKLOG (como o do Jira: sprints em cima, backlog embaixo, épicos ao lado) ---------- */
VIEWS.splice(VIEWS.findIndex(v => v[0] === 'board'), 0, ['backlog', 'Backlog', 'fila de trabalho e planejamento dos sprints']);
EXPL_VIEW.backlog = 'Backlog: a fila de tudo o que ainda vai ser feito. Em cima ficam os sprints (o ativo e os próximos) e embaixo o backlog. Arraste os itens para planejar o sprint e para mudar a ordem de prioridade, como no Jira.';
// ordem das abas igual à do menu do projeto no Jira: Resumo, Linha do tempo, Backlog, Board, Lista...
(function(){ const ordem = ['dashboard','timeline','backlog','board','list','table','calendar','workload','sprints','mywork','whiteboard','custos','sheet','stages'];
  VIEWS.sort((a, b) => (ordem.indexOf(a[0]) + 1 || 99) - (ordem.indexOf(b[0]) + 1 || 99)); })();
const _rViewB = rView;
rView = function(){
  if (UI.view === 'backlog'){ const c = $('#ops-corpo'); if (!c) return; c.innerHTML = vBacklog(); ligarArrastar(); return; }
  _rViewB();
};
function linhaBacklog(i){
  const ep = epicDe(i), chave = chaveDe(i), sel = (UI.bjSel || []).includes(i.id);
  return '<li class="bj-linha' + (sel ? ' marcada' : '') + (i.sinal ? ' sinalizado' : '') + '" data-bj-linha="' + i.id + '" draggable="' + podeEditar() + '">' +
    (podeEditar() ? '<input type="checkbox" class="bj-marca" data-bj-marca="' + i.id + '"' + (sel ? ' checked' : '') + ' aria-label="Selecionar ' + esc(chave || i.titulo) + '">' : '') +
    tipoHTML(i.tipo) + (chave ? '<span class="bj-chave">' + esc(chave) + '</span>' : '') +
    '<button type="button" class="bj-linha-tit" data-abrir-item="' + i.id + '">' + esc(i.titulo) + '</button>' +
    (i.sinal ? '<span class="bj-band" title="Sinalizado">' + ICO_BAND + '</span>' : '') +
    (ep ? '<span class="bj-epic peq" style="--c:' + corEpic(ep) + '">' + esc(ep.titulo) + '</span>' : '') +
    etiquetasDoItem(i).map(t => '<span class="bj-tag peq" style="--c:' + esc(t.cor) + '">' + esc(t.nome) + '</span>').join('') +
    '<span class="bj-linha-dir"><span class="st st-' + i.status + '">' + esc(nomeToken(tokenStatus(i))) + '</span>' + prioHTML(i.prio) + '<span class="bj-pts' + (i.pontos ? '' : ' bj-sem') + '">' + (i.pontos || '–') + '</span>' + avatar(i.resp) + '</span></li>';
}
function vBacklog(){
  const pj = cadeia(UI.sel).project;
  const {cfg} = boardDoEscopo(UI.sel), tipoB = (cfg && cfg.tipo) || 'kanban', est = estimativaDe(cfg);
  if (!pj) return '<div class="bj-vazio"><h3>Escolha um projeto</h3><p>O Backlog é de um projeto. Escolha um projeto (ou algo dentro dele) na Estrutura.</p></div>';
  const todos = listaFiltrada().filter(i => i.tipo !== 'epic' && !i.arquivado);
  const epics = issuesEm('project:' + pj.id).filter(i => i.tipo === 'epic' && !i.arquivado);
  const sps = D.sprints.filter(s => s.project === pj.id && s.status !== 'encerrado').sort((a, b) => (a.status === 'ativo' ? -1 : b.status === 'ativo' ? 1 : a.ini.localeCompare(b.ini)));
  const idsSp = new Set(sps.map(s => s.id));
  const pode = podeEditar();
  const secao = (id, titulo, sub, itens, acoes, aberta) => {
    const soma = somaEstimativa(itens, est);
    const aberto = (UI.bjFechadas || []).includes(id || 'backlog') ? false : aberta !== false;
    return '<section class="bj-sec' + (aberto ? '' : ' fechada') + '"><header class="bj-sec-cab"><button type="button" class="bj-sec-seta" data-bj-dobrar="' + (id || 'backlog') + '" aria-expanded="' + aberto + '" aria-label="Abrir ou fechar">' + (aberto ? '▾' : '▸') + '</button>' +
      '<div class="bj-sec-tit"><b>' + titulo + '</b><span class="sec">' + sub + ' · ' + itens.length + ' ite' + (itens.length === 1 ? 'm' : 'ns') + (soma ? ' · ' + soma : '') + '</span></div><div class="bj-sec-acoes">' + (acoes || '') + '</div></header>' +
      (aberto ? '<ul class="bj-lista" data-bj-sec="' + (id || '') + '">' + (itens.length ? itens.sort(porOrdemItem).map(linhaBacklog).join('') : '<li class="bj-vazio-linha">' + (id ? 'Arraste itens da fila para planejar este sprint.' : 'Nada na fila. Tudo o que foi criado já começou.') + '</li>') + '</ul>' +
        (pode ? '<form class="bj-criar-linha" data-bj-criar="' + (id || '') + '"><input class="campo" name="t" placeholder="+ Novo item' + (id ? ' neste sprint' : ' na fila') + '" aria-label="Criar item"><button class="btn peq" type="submit">Criar</button></form>' : '') : '') + '</section>';
  };
  let html = '';
  if (tipoB === 'kanban' || tipoB === 'simples'){
    const bl = todos.filter(i => i.status === 'backlog' || (!cfg || !cfg.backlog ? false : false));
    const nMarc = (UI.bjSel || []).filter(id => bl.some(i => i.id === id)).length;
    html += secao('', 'Na fila', 'ainda não começaram', bl, pode ? '<button type="button" class="btn ' + (nMarc ? '' : 'sec ') + 'peq" data-bj-acao="mover-board"' + (nMarc ? '' : ' disabled title="Marque os itens na caixinha da esquerda"') + '>' + (nMarc ? 'Começar ' + nMarc + (nMarc === 1 ? ' item' : ' itens') : 'Começar os marcados') + '</button>' : '');
    const resto = todos.filter(i => i.status !== 'backlog' && i.status !== 'done');
    html += '<p class="sec bj-dica">Já começados: ' + resto.length + (resto.length === 1 ? ' item está' : ' itens estão') + ' no Quadro. <button type="button" class="bj-link" data-view="board">Ver o Quadro</button></p>';
  } else {
    sps.forEach(s => {
      const its = todos.filter(i => i.sprint === s.id);
      const sub = (s.status === 'ativo' ? 'ativo · ' : 'planejado · ') + fmt(s.ini) + ' a ' + fmt(s.fim) + (s.meta ? ' · ' + esc(s.meta) : '');
      const ac = pode ? (s.status === 'ativo' ? '<button class="btn sec peq" type="button" data-rc-sprint-fim="' + s.id + '">Concluir sprint</button>' : '<button class="btn peq" type="button" data-rc-sprint-ini="' + s.id + '">Iniciar sprint</button>') : '';
      html += secao(s.id, esc(s.nome), sub, its, ac);
    });
    const bl = todos.filter(i => i.status !== 'done' && (!i.sprint || !idsSp.has(i.sprint)));
    html += secao('', 'Na fila', 'ainda não estão em nenhum sprint', bl, pode ? '<button type="button" class="btn sec peq" data-rc-acao="sprint-novo">Criar sprint</button>' : '');
  }
  const marc = (UI.bjSel || []).filter(id => byId('issues', id));
  const barra = marc.length && pode ? '<div class="bj-massa"><b>' + marc.length + ' selecionado' + (marc.length === 1 ? '' : 's') + '</b>' +
    (tipoB === 'scrum' ? '<label class="rotulo-mini">Mover para<select class="sel peq" data-bj-massa="sprint"><option value="">Escolha</option><option value="__bl">Fila</option>' + sps.map(s => '<option value="' + s.id + '">' + esc(s.nome) + '</option>').join('') + '</select></label>' : '') +
    '<label class="rotulo-mini">Épico<select class="sel peq" data-bj-massa="epic"><option value="">Escolha</option><option value="__sem">Tirar do épico</option>' + epics.map(e => '<option value="' + e.id + '">' + esc(e.titulo) + '</option>').join('') + '</select></label>' +
    '<button type="button" class="btn sec peq" data-bj-acao="sinalizar-massa">Sinalizar</button><button type="button" class="btn fant peq" data-bj-acao="limpar-sel">Limpar seleção</button></div>' : '';
  const painelEp = UI.bjEpicos === false ? '' : '<aside class="bj-epicos" aria-label="Épicos"><header><b>Épicos<small class="bj-ep-expl">as entregas grandes. Clique para ver só os itens de uma</small></b><button type="button" class="ico-btn" data-bj-acao="epicos" aria-label="Fechar o painel de épicos">' + ICO.fechar + '</button></header>' +
    '<button type="button" class="bj-ep' + (!UI.bjEpic ? ' ligado' : '') + '" data-bj-epic="">Todos os itens</button>' +
    epics.map(e => { const filhos = D.issues.filter(x => epicDe(x) && epicDe(x).id === e.id); const f = filhos.filter(x => x.status === 'done').length; const p = filhos.length ? Math.round(f / filhos.length * 100) : 0;
      return '<button type="button" class="bj-ep' + (UI.bjEpic === e.id ? ' ligado' : '') + '" data-bj-epic="' + e.id + '" style="--c:' + corEpic(e) + '"><span class="bj-ep-nome">' + esc(e.titulo) + '</span><span class="bj-ep-bar"><i style="width:' + p + '%"></i></span><small>' + f + ' de ' + filhos.length + ' concluídos</small></button>'; }).join('') +
    '<button type="button" class="bj-ep' + (UI.bjEpic === 'sem' ? ' ligado' : '') + '" data-bj-epic="sem">Itens sem épico</button>' +
    (pode ? '<button type="button" class="btn fant peq" data-bj-acao="novo-epic">' + ICO.mais + 'Criar épico</button>' : '') + '</aside>';
  const extra = avataresFiltro(issuesEm(UI.sel)) + (UI.bjEpicos === false ? '<button class="btn sec peq" type="button" data-bj-acao="epicos">Épicos</button>' : '') +
    (souMaster() ? '<button class="btn sec peq" type="button" data-bj-acao="config" title="Colunas do quadro, forma de trabalhar (com ou sem sprints) e estimativa">⋯ Configurar o quadro</button>' : '');
  const intro = '<div class="bj-intro"><b>Fila de ' + esc(pj.nome) + '</b><span>' + (tipoB === 'scrum' ? 'Tudo o que ainda não está em nenhum sprint. Arraste um item para um sprint para planejar.' : 'Tudo o que foi pedido e ainda não começou. Para começar, marque os itens e clique em <b>Começar</b>: eles vão para a coluna A fazer do Quadro.') + '</span></div>';
  return ferramentasHTML(extra) + barra + intro + '<div class="bj-backlog' + (painelEp ? ' com-epicos' : '') + '">' + painelEp + '<div class="bj-secs">' + html + '</div></div>';
}

/* ---------- criar item pelo Backlog e ações ---------- */
function criarItemRapido(titulo, sprint, status){
  const ws = UI.sel.startsWith('ws:') ? UI.sel.slice(3) : primeiroWs(UI.sel);
  if (!ws){ toast('Crie antes uma frente de trabalho numa aplicação (Estrutura › aplicação › + Frente)'); return null; }
  const ni = novoIssue({titulo, status:status || (sprint ? 'todo' : 'backlog'), ws});
  if (sprint) ni.sprint = sprint;
  garantirBoard({issues:[ni], boards:D.boards, equipes:D.equipes});
  ni.ordem = novaOrdem(D.issues.filter(x => (x.sprint || null) === (sprint || null)), null);
  if (UI.bjEpic && UI.bjEpic !== 'sem' && ni.tipo !== 'epic'){ ni.pai = UI.bjEpic; ni.tipo = 'story'; }
  D.issues.push(ni); registrar('criou', ni); return ni;
}
function alternarSinal(i, motivo){
  if (i.sinal){ i.sinal = null; i.motivoSinal = ''; toast('"' + (chaveDe(i) || i.titulo) + '" não está mais sinalizado'); }
  else { i.sinal = new Date().toISOString(); i.motivoSinal = motivo || ''; toast('"' + (chaveDe(i) || i.titulo) + '" foi sinalizado'); }
}
function pedirSinal(i, depois){
  if (i.sinal){ alternarSinal(i); salvar(); depois && depois(); return; }
  modal('Sinalizar ' + esc(chaveDe(i) || i.titulo), '<p class="sec" style="margin:0">Sinalizar avisa que o item está com impedimento (a bandeira do Jira). Ele fica marcado no Board e no Backlog.</p><label class="lb">Motivo (opcional)<input class="campo" id="bj-motivo" placeholder="Ex.: esperando acesso ao banco do cliente"></label>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Sinalizar', acao:dl => { alternarSinal(i, $('#bj-motivo', dl).value.trim()); salvar(); depois && depois(); }}]);
}
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-bj-criar]'); if (!f) return;
  e.preventDefault(); const t = f.t.value.trim(); if (!t) return;
  const ni = criarItemRapido(t, f.dataset.bjCriar || null); if (!ni) return;
  salvar(); rView(); toast('Item criado'); setTimeout(() => { const n = $('[data-bj-criar="' + (f.dataset.bjCriar || '') + '"] input'); if (n) n.focus(); }, 30);
}, true);
document.addEventListener('change', e => {
  const t = e.target;
  if (t.matches('[data-bj-marca]')){ const s = new Set(UI.bjSel || []); t.checked ? s.add(t.dataset.bjMarca) : s.delete(t.dataset.bjMarca); UI.bjSel = [...s]; rView(); return; }
  if (t.matches('[data-bj-massa]') && t.value){
    const ids = (UI.bjSel || []).map(id => byId('issues', id)).filter(Boolean);
    if (t.dataset.bjMassa === 'sprint') ids.forEach(i => { i.sprint = t.value === '__bl' ? null : t.value; });
    if (t.dataset.bjMassa === 'epic') ids.forEach(i => { if (t.value === '__sem'){ if (i.pai && (byId('issues', i.pai) || {}).tipo === 'epic') i.pai = null; } else if (i.tipo !== 'subtask'){ i.pai = t.value; if (i.tipo === 'epic') i.tipo = 'story'; } });
    toast(ids.length + ' ite' + (ids.length === 1 ? 'm movido' : 'ns movidos')); UI.bjSel = []; salvar(); rView();
  }
});
document.addEventListener('click', e => {
  let x;
  if ((x = e.target.closest('[data-bj-pessoa]'))){ const id = x.dataset.bjPessoa; const s = new Set(UI.bjPessoas || []); if (!id) s.clear(); else s.has(id) ? s.delete(id) : s.add(id); UI.bjPessoas = [...s]; salvarUI(); rView(); return; }
  if ((x = e.target.closest('[data-bj-epic]'))){ UI.bjEpic = x.dataset.bjEpic || null; salvarUI(); rView(); return; }
  if ((x = e.target.closest('[data-bj-dobrar]'))){ const s = new Set(UI.bjFechadas || []); const k = x.dataset.bjDobrar; s.has(k) ? s.delete(k) : s.add(k); UI.bjFechadas = [...s]; salvarUI(); rView(); return; }
  if ((x = e.target.closest('[data-bj-view]'))){ UI.view = x.dataset.bjView; salvarUI(); rOperacoes(); return; }
  if ((x = e.target.closest('[data-bj-sinal]'))){ e.stopPropagation(); const i = byId('issues', x.dataset.bjSinal); if (i) pedirSinal(i, () => { rView(); if (itemAberto === i.id) abrirItem(i.id); }); return; }
  if ((x = e.target.closest('[data-bj-acao]'))){
    const a = x.dataset.bjAcao;
    if (a === 'config') abrirConfigBoard();
    else if (a === 'epicos'){ UI.bjEpicos = UI.bjEpicos === false; salvarUI(); rView(); }
    else if (a === 'limpar-sel'){ UI.bjSel = []; rView(); }
    else if (a === 'sinalizar-massa'){ (UI.bjSel || []).map(id => byId('issues', id)).filter(Boolean).forEach(i => { if (!i.sinal) alternarSinal(i, ''); }); UI.bjSel = []; salvar(); rView(); }
    else if (a === 'mover-board'){ const ids = (UI.bjSel || []).map(id => byId('issues', id)).filter(Boolean); if (!ids.length){ toast('Marque os itens que quer começar'); return; } ids.forEach(i => mudarStatus(i, 'todo')); UI.bjSel = []; salvar(); rView(); toast(ids.length + (ids.length === 1 ? ' item foi' : ' itens foram') + ' para A fazer, no Quadro'); }
    else if (a === 'novo-epic'){ modal('Criar épico', '<label class="lb">Nome do épico<input class="campo" id="bj-ep-n" placeholder="Ex.: Área do cliente"></label>', [{txt:'Cancelar', cls:'sec'}, {txt:'Criar', acao:dl => { const n = $('#bj-ep-n', dl).value.trim(); if (!n){ toast('Escreva o nome'); return false; } const ni = criarItemRapido(n, null, 'todo'); if (!ni) return false; ni.tipo = 'epic'; ni.pai = null; salvar(); rView(); toast('Épico criado'); }}]); }
    return;
  }
}, true);

/* ---------- item aberto: chave, sinalizar, pessoas, etiquetas, resolução e horas que faltam ---------- */
const _abrirItemB = abrirItem;
abrirItem = function(id){
  _abrirItemB(id);
  const i = byId('issues', id), g = $('#gaveta-wrap .gaveta'); if (!i || !g) return;
  const pode = podeEditar(), chave = chaveDe(i);
  const cab = $('.gaveta-cab', g);
  if (cab && !cab.querySelector('.bj-chave')){
    const tr = cab.querySelector('.g-trilha'); if (tr && chave) tr.insertAdjacentHTML('beforeend', ' › <span class="bj-chave forte">' + esc(chave) + '</span>');
    const fechar = cab.querySelector('[data-fechar-gaveta]');
    if (fechar && pode) fechar.insertAdjacentHTML('beforebegin', '<button type="button" class="btn ' + (i.sinal ? 'acento' : 'sec') + ' peq bj-sinal-btn" data-bj-sinal="' + i.id + '" title="Sinalizar impedimento (Jira: flag)">' + ICO_BAND + (i.sinal ? 'Tirar sinal' : 'Sinalizar') + '</button>');
  }
  const faixa = $('.g-faixa', g);
  if (faixa && i.sinal) faixa.insertAdjacentHTML('afterbegin', '<span class="bj-sinal-faixa">' + ICO_BAND + 'Sinalizado' + (i.motivoSinal ? ': ' + esc(i.motivoSinal) : '') + '</span>');
  const lat = $('.g-lateral', g); if (!lat) return;
  const dis = pode ? '' : ' disabled';
  const outros = D.people.filter(p => p.acesso !== 'stakeholder');
  const chips = (lista, papel) => lista.map(pid => { const p = pessoa(pid); return p ? '<span class="bj-chip">' + avatar(pid) + esc(p.nome) + (pode ? '<button type="button" class="ico-btn" data-bj-tira-pessoa="' + papel + ':' + pid + '" aria-label="Tirar ' + esc(p.nome) + '">' + ICO.fechar + '</button>' : '') + '</span>' : ''; }).join('');
  const addPessoa = papel => pode ? '<select class="sel peq" data-bj-add-pessoa="' + papel + '"><option value="">+ Adicionar</option>' + outros.filter(p => !(i[papel === 'membro' ? 'membros' : 'observadores'] || []).includes(p.id)).map(p => '<option value="' + p.id + '">' + esc(p.nome) + '</option>').join('') + '</select>' : '';
  const tags = etiquetasDoItem(i);
  const eu = idEu(UI.verComo), votou = (i.votos || []).includes(eu), observa = (i.observadores || []).includes(eu);
  const html = '<section class="g-cartao bj-add-cartao"><h4>Pessoas e etiquetas' + I('Como no Trello (Adicionar ao cartão) e no Jira (observadores e votos)') + '</h4>' +
    '<div class="d-lin"><span class="d-rot">Membros' + I('Outras pessoas que trabalham no item além do responsável (Trello: membros do card)') + '</span><span class="d-val bj-chips">' + chips(i.membros || [], 'membro') + addPessoa('membro') + '</span></div>' +
    '<div class="d-lin"><span class="d-rot">Observadores' + I('Quem recebe aviso das mudanças (Jira: watchers)') + '</span><span class="d-val bj-chips">' + chips(i.observadores || [], 'observador') + addPessoa('observador') + '</span></div>' +
    '<div class="d-lin"><span class="d-rot">Etiquetas</span><span class="d-val bj-chips">' + tags.map(t => '<span class="bj-tag" style="--c:' + esc(t.cor) + '">' + esc(t.nome) + (pode ? '<button type="button" class="ico-btn" data-bj-tira-tag="' + t.id + '" aria-label="Tirar etiqueta">' + ICO.fechar + '</button>' : '') + '</span>').join('') +
      (pode ? '<select class="sel peq" data-bj-add-tag><option value="">+ Etiqueta</option>' + D.tags.filter(t => !(i.etiquetas || []).includes(t.id)).map(t => '<option value="' + t.id + '">' + esc(t.nome) + '</option>').join('') + '<option value="__nova">Criar etiqueta...</option></select>' : '') + '</span></div>' +
    '<div class="d-lin"><span class="d-rot">Votos</span><span class="d-val"><span class="bj-pts">' + (i.votos || []).length + '</span><button type="button" class="btn fant peq" data-bj-votar="' + i.id + '">' + (votou ? 'Tirar meu voto' : 'Votar') + '</button><button type="button" class="btn fant peq" data-bj-observar="' + i.id + '">' + (observa ? 'Parar de observar' : 'Observar') + '</button></span></div>' +
    '</section>' +
    '<section class="g-cartao"><h4>Estimativa e conclusão</h4>' +
    '<div class="d-lin"><span class="d-rot">Story points</span><span class="d-val"><select class="sel d-sel" data-bj-campo="pontos"' + dis + '><option value="">Sem pontos</option>' + [1, 2, 3, 5, 8, 13, 21].map(n => '<option value="' + n + '"' + (+i.pontos === n ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></span></div>' +
    '<div class="d-lin"><span class="d-rot">Horas que faltam' + I('Jira: remaining estimate. As horas já lançadas vêm do cronômetro e dos lançamentos.') + '</span><span class="d-val"><input class="campo d-sel" type="number" min="0" step="0.5" data-bj-campo="restante" value="' + esc(i.restante ?? '') + '"' + dis + '><span class="sec" style="font-size:12px">h</span></span></div>' +
    '<div class="d-lin"><span class="d-rot">Resolução' + I('Como o item terminou (Jira: resolution)') + '</span><span class="d-val"><select class="sel d-sel" data-bj-campo="resolucao"' + dis + '><option value="">Sem resolução</option>' + [['feito','Feito'],['nao_sera_feito','Não vai ser feito'],['duplicado','Duplicado'],['nao_reproduz','Não se repete']].map(([v, n]) => '<option value="' + v + '"' + (i.resolucao === v ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></span></div>' +
    '</section>';
  const primeiro = lat.querySelector('.g-cartao'); if (primeiro) primeiro.insertAdjacentHTML('afterend', html); else lat.insertAdjacentHTML('afterbegin', html);
};
document.addEventListener('change', e => {
  const t = e.target; if (!itemAberto) return; const i = byId('issues', itemAberto); if (!i) return;
  if (t.matches('[data-bj-add-pessoa]') && t.value){ const k = t.dataset.bjAddPessoa === 'membro' ? 'membros' : 'observadores'; i[k] = (i[k] || []).concat(t.value); salvar(); abrirItem(i.id); rView(); return; }
  if (t.matches('[data-bj-add-tag]') && t.value){
    if (t.value === '__nova'){ modal('Nova etiqueta', '<label class="lb">Nome<input class="campo" id="bj-tg-n"></label><label class="lb">Cor<input class="campo" type="color" id="bj-tg-c" value="#3355E0"></label>', [{txt:'Cancelar', cls:'sec'}, {txt:'Criar', acao:dl => { const n = $('#bj-tg-n', dl).value.trim(); if (!n){ toast('Escreva o nome'); return false; } if (D.tags.some(x => x.nome.toLowerCase() === n.toLowerCase())){ toast('Já existe uma etiqueta com esse nome'); return false; } const tg = {id:uid('tg'), nome:n, cor:$('#bj-tg-c', dl).value.toUpperCase(), cat:'', desc:''}; D.tags.push(tg); i.etiquetas = (i.etiquetas || []).concat(tg.id); salvar(); abrirItem(i.id); rView(); }}]); t.value = ''; return; }
    i.etiquetas = (i.etiquetas || []).concat(t.value); salvar(); abrirItem(i.id); rView(); return; }
  if (t.matches('[data-bj-campo]')){ const c = t.dataset.bjCampo; if (c === 'pontos') i.pontos = t.value ? +t.value : null; else if (c === 'restante') i.restante = t.value === '' ? null : Math.max(0, +t.value); else if (c === 'resolucao') i.resolucao = t.value || null; salvar(); rView(); }
});
document.addEventListener('click', e => {
  let x; if (!itemAberto) return; const i = byId('issues', itemAberto); if (!i) return;
  if ((x = e.target.closest('[data-bj-tira-pessoa]'))){ const [papel, pid] = x.dataset.bjTiraPessoa.split(':'); const k = papel === 'membro' ? 'membros' : 'observadores'; i[k] = (i[k] || []).filter(v => v !== pid); salvar(); abrirItem(i.id); rView(); return; }
  if ((x = e.target.closest('[data-bj-tira-tag]'))){ i.etiquetas = (i.etiquetas || []).filter(v => v !== x.dataset.bjTiraTag); salvar(); abrirItem(i.id); rView(); return; }
  if ((x = e.target.closest('[data-bj-votar]'))){ const eu = idEu(UI.verComo); if (!eu) return; i.votos = (i.votos || []).includes(eu) ? i.votos.filter(v => v !== eu) : (i.votos || []).concat(eu); salvar(); abrirItem(i.id); return; }
  if ((x = e.target.closest('[data-bj-observar]'))){ const eu = idEu(UI.verComo); if (!eu) return; i.observadores = (i.observadores || []).includes(eu) ? i.observadores.filter(v => v !== eu) : (i.observadores || []).concat(eu); salvar(); abrirItem(i.id); return; }
});

/* ---------- EQUIPES (Team) ---------- */
const _rTimeB = rTime;
rTime = function(){
  _rTimeB();
  const el = $('#m-time'); if (!el) return;
  const m = souMaster();
  const nos = [...D.clients.map(x => ['client:' + x.id, x.nome]), ...D.projects.map(x => ['project:' + x.id, x.nome]), ...D.products.map(x => ['product:' + x.id, x.nome]), ...D.apps.map(x => ['app:' + x.id, x.nome]), ...D.ws.map(x => ['ws:' + x.id, (byId('apps', x.app) || {nome:''}).nome + ' › ' + x.nome])];
  const PAPEL = {owner:'Owner', dev:'Dev', stakeholder:'Stakeholder'};
  const html = '<section class="bj-equipes"><div class="bj-eq-cab"><div><h2 class="sub" style="margin:0">Equipes' + I('Equipes: um grupo de pessoas ligado a projetos, produtos, aplicações ou frentes. Quem está na equipe enxerga e trabalha onde ela está ligada, sem cadastrar pessoa por pessoa. Corresponde aos membros de um board do Trello e às equipes e grupos do Jira.') + '</h2>' +
    '<p class="sec" style="margin:4px 0 0;font-size:13px">Ligue uma equipe a um projeto e todos os membros ganham acesso a ele.</p></div>' + (m ? '<button class="btn" type="button" data-bj-equipe="">' + ICO.mais + 'Nova equipe</button>' : '') + '</div>' +
    (D.equipes.length ? '<div class="bj-eq-grade">' + D.equipes.map(q => '<article class="bj-eq" style="--c:' + esc(q.cor) + '"><header><b>' + esc(q.nome) + '</b>' + (q.ativa === false ? '<span class="sec"> (inativa)</span>' : '') + (m ? '<button class="ico-btn" type="button" data-bj-equipe="' + q.id + '" aria-label="Editar ' + esc(q.nome) + '">' + SV('<path d="M4 20h4L20 8l-4-4L4 16z"/>') + '</button>' : '') + '</header>' +
      (q.desc ? '<p class="sec">' + esc(q.desc) + '</p>' : '') +
      '<div class="bj-eq-av">' + (q.membros.length ? q.membros.map(x => '<span title="' + esc((pessoa(x.pessoa) || {}).nome || '') + (x.papel === 'lider' ? ' (líder)' : '') + '">' + avatar(x.pessoa) + '</span>').join('') + '<span class="sec">' + q.membros.length + ' pessoa' + (q.membros.length === 1 ? '' : 's') + '</span>' : '<span class="sec">Sem membros</span>') + '</div>' +
      '<ul class="bj-eq-nos">' + (q.nos.length ? q.nos.map(x => '<li>' + esc(nomeDe(x.no)) + ' <span class="sec">· ' + PAPEL[x.papel] + '</span></li>').join('') : '<li class="sec">Ainda não ligada a nenhum ponto da estrutura</li>') + '</ul></article>').join('') + '</div>'
      : '<p class="sec">Nenhuma equipe ainda.' + (m ? ' Crie uma para dar acesso a várias pessoas de uma vez.' : '') + '</p>') + '</section>';
  el.insertAdjacentHTML('beforeend', html);
  el._nosEquipe = nos;
};
function abrirEquipe(id){
  const q = JSON.parse(JSON.stringify(D.equipes.find(x => x.id === id) || {id:uid('eq'), nome:'', desc:'', cor:'#3355E0', ativa:true, membros:[], nos:[]}));
  const nos = ($('#m-time') || {})._nosEquipe || [];
  const corpo = () => '<div class="grade-form"><label class="lb">Nome<input class="campo" data-eq="nome" value="' + esc(q.nome) + '" placeholder="Ex.: Time do Java BL"></label><label class="lb">Cor<input class="campo" type="color" data-eq="cor" value="' + esc(q.cor) + '"></label>' +
    '<label class="lb largo">Descrição<input class="campo" data-eq="desc" value="' + esc(q.desc || '') + '"></label><label class="lb"><span>Situação</span><select class="sel" data-eq="ativa"><option value="1"' + (q.ativa !== false ? ' selected' : '') + '>Ativa</option><option value="0"' + (q.ativa === false ? ' selected' : '') + '>Inativa (ninguém ganha acesso por ela)</option></select></label></div>' +
    '<h3 class="bj-cfg-tit">Membros</h3><div class="bj-eq-lista">' + D.people.map(p => { const mm = q.membros.find(x => x.pessoa === p.id);
      return '<div class="bj-eq-lin"><label class="bj-chk"><input type="checkbox" data-eq-pessoa="' + p.id + '"' + (mm ? ' checked' : '') + '>' + avatar(p.id) + esc(p.nome) + '</label>' + (mm ? '<select class="sel peq" data-eq-papel-p="' + p.id + '"><option value="membro"' + (mm.papel !== 'lider' ? ' selected' : '') + '>Membro</option><option value="lider"' + (mm.papel === 'lider' ? ' selected' : '') + '>Líder</option></select>' : '') + '</div>'; }).join('') + '</div>' +
    '<h3 class="bj-cfg-tit">Onde a equipe trabalha</h3><p class="sec" style="margin:0 0 6px;font-size:13px">Todos os membros ganham o papel escolhido no ponto e em tudo o que está dentro dele.</p><div class="bj-eq-lista">' + nos.map(([k, n]) => { const ln = q.nos.find(x => x.no === k);
      return '<div class="bj-eq-lin"><label class="bj-chk"><input type="checkbox" data-eq-no="' + k + '"' + (ln ? ' checked' : '') + '>' + esc(n) + ' <small class="sec">' + ({client:'cliente', project:'projeto', product:'produto', app:'aplicação', ws:'frente'})[k.split(':')[0]] + '</small></label>' + (ln ? '<select class="sel peq" data-eq-papel-n="' + k + '">' + [['dev','Dev (trabalha)'],['owner','Owner (responde pelo ponto)'],['stakeholder','Stakeholder (só acompanha)']].map(([v, t]) => '<option value="' + v + '"' + (ln.papel === v ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>' : '') + '</div>'; }).join('') + '</div>';
  const botoes = [{txt:'Cancelar', cls:'sec'}];
  if (D.equipes.some(x => x.id === q.id)) botoes.push({txt:'Apagar equipe', cls:'perigo', acao:() => { D.equipes = D.equipes.filter(x => x.id !== q.id); salvar(); render(); toast('Equipe apagada'); }});
  botoes.push({txt:'Salvar', acao:() => { q.nome = q.nome.trim(); if (!q.nome){ toast('Escreva o nome da equipe'); return false; } if (D.equipes.some(x => x.id !== q.id && x.nome.toLowerCase() === q.nome.toLowerCase())){ toast('Já existe uma equipe com esse nome'); return false; }
    const k = D.equipes.findIndex(x => x.id === q.id); if (k >= 0) D.equipes[k] = q; else D.equipes.push(q); salvar(); render(); toast('Equipe salva'); }});
  const dl = modal(D.equipes.some(x => x.id === q.id) ? 'Editar equipe' : 'Nova equipe', corpo(), botoes);
  dl.classList.add('modal-larga');
  dl.addEventListener('input', e => { const t = e.target; if (t.dataset.eq && t.dataset.eq !== 'ativa') q[t.dataset.eq] = t.value; });
  dl.addEventListener('change', e => { const t = e.target;
    if (t.dataset.eq === 'ativa') q.ativa = t.value === '1';
    else if (t.dataset.eqPessoa){ q.membros = q.membros.filter(x => x.pessoa !== t.dataset.eqPessoa); if (t.checked) q.membros.push({pessoa:t.dataset.eqPessoa, papel:'membro'}); $('.modal-corpo', dl).innerHTML = corpo(); }
    else if (t.dataset.eqPapelP){ const mm = q.membros.find(x => x.pessoa === t.dataset.eqPapelP); if (mm) mm.papel = t.value; }
    else if (t.dataset.eqNo){ q.nos = q.nos.filter(x => x.no !== t.dataset.eqNo); if (t.checked) q.nos.push({no:t.dataset.eqNo, papel:'dev'}); $('.modal-corpo', dl).innerHTML = corpo(); }
    else if (t.dataset.eqPapelN){ const ln = q.nos.find(x => x.no === t.dataset.eqPapelN); if (ln) ln.papel = t.value; } });
}
document.addEventListener('click', e => { const x = e.target.closest('[data-bj-equipe]'); if (!x) return; if (!souMaster()) return; abrirEquipe(x.dataset.bjEquipe || null); });

/* ---------- banco: ler e gravar os campos e tabelas novos ---------- */
TABELAS_BANCO.push('boards_config', 'boards_colunas', 'boards_colunas_status', 'itens_pessoas', 'etiquetas_itens', 'comentarios_reacoes', 'equipes', 'equipes_membros', 'equipes_nos');
(function(){
  const depoisDe = (t, novas) => { const k = GRAVAR.findIndex(g => g[0] === t); GRAVAR.splice(k + 1, 0, ...novas); };
  depoisDe('status_fluxo', [['boards_config', ['no_id']], ['boards_colunas', ['id']], ['boards_colunas_status', ['coluna_id', 'status_id'], 1]]);
  depoisDe('frentes', [['equipes', ['id']], ['equipes_membros', ['equipe_id', 'pessoa_id'], 1], ['equipes_nos', ['equipe_id', 'no_id'], 1]]);
  depoisDe('itens', [['itens_pessoas', ['item_id', 'pessoa_id', 'papel'], 1], ['etiquetas_itens', ['item_id', 'etiqueta_id'], 1]]);
})();
// ordem fixa dos status (padrões na ordem do fluxo, depois os personalizados pelo grupo): o banco devolve sem ordem
function ordemToken(t, d){ const k = STATUS.findIndex(s => s.id === t); if (k >= 0) return k; const c = ((d || D).statusCustom || []).find(s => s.id === t); return c ? 10 + STATUS.findIndex(s => s.id === c.grupo) : 99; }
const _montarDadosB = montarDados;
montarDados = function(T, eu){
  const d = _montarDadosB(T, eu);
  const tipoNo = {cliente:'client', projeto:'project', produto:'product', aplicacao:'app', frente:'ws'};
  const nos = new Map((T.nos || []).map(n => [n.id, n]));
  const chaveNo = id => { const n = nos.get(id); return n ? tipoNo[n.tipo] + ':' + n.id : null; };
  const itensT = new Map((T.itens || []).map(r => [r.id, r]));
  const stPorId = new Map((T.status_fluxo || []).map(s => [s.id, s]));
  d.issues.forEach(i => { const r = itensT.get(i.id) || {};
    i.chave = r.chave || ''; i.sinal = r.sinalizado_em || null; i.motivoSinal = r.motivo_sinal || ''; i.resolucao = r.resolucao || null;
    i.restante = r.restante_h == null ? null : +r.restante_h; i.ordem = r.ordem == null ? 0 : +r.ordem;
    i.membros = []; i.observadores = []; i.votos = []; i.etiquetas = []; });
  const porId = new Map(d.issues.map(i => [i.id, i]));
  (T.itens_pessoas || []).forEach(p => { const i = porId.get(p.item_id); if (!i) return; (p.papel === 'membro' ? i.membros : p.papel === 'observador' ? i.observadores : i.votos).push(p.pessoa_id); });
  (T.etiquetas_itens || []).forEach(p => { const i = porId.get(p.item_id); if (i) i.etiquetas.push(p.etiqueta_id); });
  const ckT = new Map((T.itens_checklist || []).map(c => [c.id, c]));
  d.issues.forEach(i => (i.check || []).forEach(c => { const r = ckT.get(c._id); if (r){ c.grupo = r.grupo || ''; c.prazo = r.prazo || null; c.pessoa = r.pessoa_id || null; } }));
  const prjT = new Map((T.projetos || []).map(p => [p.no_id, p]));
  d.projects.forEach(p => { const r = prjT.get(p.id) || {}; p.chavePrefixo = r.chave_prefixo || ''; p.chaveSeq = r.chave_seq || 0; });
  const tokenDe = sid => { const s = stPorId.get(sid); if (!s) return null; return s.no_id ? s.id : s.chave; };
  d.boards = {};
  (T.boards_config || []).forEach(b => { const k = chaveNo(b.no_id); if (!k) return; d.boards[k] = {tipo:b.tipo, estimativa:b.estimativa, backlog:!!b.backlog, subtarefas:b.subtarefas_contam !== false, colunas:[]}; });
  const stsCol = new Map(); (T.boards_colunas_status || []).forEach(x => { if (!stsCol.has(x.coluna_id)) stsCol.set(x.coluna_id, []); stsCol.get(x.coluna_id).push(x.status_id); });
  (T.boards_colunas || []).forEach(c => { const k = chaveNo(c.no_id); if (!k) return; const b = d.boards[k] || (d.boards[k] = {tipo:'kanban', estimativa:'pontos', backlog:true, subtarefas:true, colunas:[], _semCfg:true});
    b.colunas.push({id:c.id, nome:c.nome, ordem:c.ordem, min:c.minimo, max:c.maximo, status:(stsCol.get(c.id) || []).map(tokenDe).filter(Boolean).sort((x, y) => ordemToken(x, d) - ordemToken(y, d))}); });
  Object.values(d.boards).forEach(bb => bb.colunas.sort((x, y) => x.ordem - y.ordem));
  const memb = new Map(); (T.equipes_membros || []).forEach(m => { if (!memb.has(m.equipe_id)) memb.set(m.equipe_id, []); memb.get(m.equipe_id).push({pessoa:m.pessoa_id, papel:m.papel}); });
  const eqNos = new Map(); (T.equipes_nos || []).forEach(m => { const k = chaveNo(m.no_id); if (!k) return; if (!eqNos.has(m.equipe_id)) eqNos.set(m.equipe_id, []); eqNos.get(m.equipe_id).push({no:k, papel:m.papel}); });
  d.equipes = (T.equipes || []).map(q => ({id:q.id, nome:q.nome, desc:q.descricao || '', cor:q.cor, ativa:q.ativa !== false, membros:memb.get(q.id) || [], nos:eqNos.get(q.id) || []}));
  return d;
};
const _linhasDaTelaB = linhasDaTela;
linhasDaTela = function(d){
  const L = _linhasDaTelaB(d);
  ['boards_config','boards_colunas','boards_colunas_status','itens_pessoas','etiquetas_itens','equipes','equipes_membros','equipes_nos'].forEach(t => { L[t] = L[t] || []; });
  const porId = new Map(d.issues.map(i => [i.id, i]));
  const temPessoa = new Set(d.people.map(p => p.id)), temTag = new Set(d.tags.map(t => t.id));
  L.itens.forEach(r => { const i = porId.get(r.id); if (!i) return;
    r.sinalizado_em = i.sinal || null; r.motivo_sinal = i.sinal ? (i.motivoSinal || null) : null; r.resolucao = i.resolucao || null;
    r.restante_h = i.restante == null || i.restante === '' ? null : +i.restante; r.ordem = +i.ordem || 0;
    (i.membros || []).forEach(p => { if (temPessoa.has(p)) L.itens_pessoas.push({item_id:i.id, pessoa_id:p, papel:'membro'}); });
    (i.observadores || []).forEach(p => { if (temPessoa.has(p)) L.itens_pessoas.push({item_id:i.id, pessoa_id:p, papel:'observador'}); });
    (i.votos || []).forEach(p => { if (temPessoa.has(p)) L.itens_pessoas.push({item_id:i.id, pessoa_id:p, papel:'voto'}); });
    [...new Set(i.etiquetas || [])].forEach(t => { if (temTag.has(t)) L.etiquetas_itens.push({item_id:i.id, etiqueta_id:t}); }); });
  const ckPorId = new Map(); d.issues.forEach(i => (i.check || []).forEach(c => ckPorId.set(c._id, c)));
  L.itens_checklist.forEach(r => { const c = ckPorId.get(r.id); if (!c) return; r.grupo = c.grupo || null; r.prazo = c.prazo || null; r.pessoa_id = c.pessoa && temPessoa.has(c.pessoa) ? c.pessoa : null; });
  const stPad = BANCO.stPadrao || {}, idsCustom = new Set(d.statusCustom.map(s => s.id));
  const idNo2 = k => k && k.includes(':') ? k.split(':')[1] : null;
  const temNo = new Set(L.nos.map(n => n.id));
  Object.entries(d.boards || {}).forEach(([k, b]) => { const nid = idNo2(k); if (!nid || !temNo.has(nid)) return;
    if (!b._semCfg) L.boards_config.push({no_id:nid, tipo:b.tipo || 'kanban', estimativa:b.estimativa || 'pontos', backlog:b.backlog !== false, subtarefas_contam:b.subtarefas !== false});
    (b.colunas || []).forEach((c, k2) => { if (!c.id || String(c.id).startsWith('auto:')) return;
      L.boards_colunas.push({id:c.id, no_id:nid, nome:c.nome, ordem:k2, minimo:c.min == null ? null : +c.min, maximo:c.max == null ? null : +c.max});
      [...new Set(c.status || [])].forEach(t => { const sid = idsCustom.has(t) ? t : stPad[t]; if (sid) L.boards_colunas_status.push({coluna_id:c.id, status_id:sid}); }); }); });
  (d.equipes || []).forEach(q => { L.equipes.push({id:q.id, nome:q.nome, descricao:q.desc || null, cor:q.cor || '#2E2E31', ativa:q.ativa !== false});
    (q.membros || []).forEach(m => { if (temPessoa.has(m.pessoa)) L.equipes_membros.push({equipe_id:q.id, pessoa_id:m.pessoa, papel:m.papel === 'lider' ? 'lider' : 'membro'}); });
    (q.nos || []).forEach(n => { const nid = idNo2(n.no); if (nid && temNo.has(nid)) L.equipes_nos.push({equipe_id:q.id, no_id:nid, papel:n.papel || 'dev'}); }); });
  return L;
};
