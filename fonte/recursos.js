/* =====================================================================
   RECURSOS: ciclos (Sprints), marcos, visões salvas, automações, status e campos personalizados,
   edição em massa, pai e filhos, My Work, Everything, quadro visual ligado, métricas de ritmo,
   origem do código, SLA, print anotado e gravação de tela.
   Tudo entra no mesmo escopo do sistema e se liga às funções que já existem.
   ===================================================================== */
const eu = () => idEu(UI.verComo);
/* ---------- versão com login: a tela mostra SÓ o que está no banco. Nada de exemplo, nada guardado no navegador ---------- */
const COM_BANCO = document.body.classList.contains('com-login');
function regrasVazias(){ return {regime:'simples', impostos:{simples:0, presumido:0, real:0}, encargos:{inss:0, rat:0, terceiros:0, fgts:0, ferias:0, terco:0, decimo:0, multaFgts:0}, horasMes:168, faturavel:100, margem:0, risco:0, cambio:0, complexidade:{'Média':1}, urgencia:{Normal:1}, manutencaoAnual:0, reservaOverhead:0}; }
function dadosVazios(){
  return {v:2, clients:[], tags:[], tagLinks:[], projects:[], products:[], apps:[], ws:[], people:[], issues:[], sheets:{}, template:[], stages:{}, requests:[], agents:[], focus:null, statusCfg:{}, baseline:{},
    eventos:[], regras:regrasVazias(), opCustos:[], custos:[], receitas:[], catalog:[], sprints:[], marcos:[], automacoes:[], autoLog:[], notifs:[], vistas:[], statusCustom:[], camposItem:[], quadros:{}, recursosV:1, autoPrazoDia:iso(HOJE)};
}
if (COM_BANCO){
  EU_IDS = {};
  D = dadosVazios();
  salvar = function(){};
  try { localStorage.removeItem(CHAVE_DADOS); } catch(e){}
}

const GRUPO_NOME = {backlog:'Backlog', todo:'To Do', doing:'In Progress', review:'In Review', blocked:'Blocked', done:'Done'};

function garantirRecursos(d){
  ['sprints','marcos','automacoes','autoLog','notifs','vistas','statusCustom','camposItem'].forEach(k => { d[k] = d[k] || []; });
  d.quadros = d.quadros || {};
  if (d.recursosV) return;
  const seg = dAdd(HOJE, -((HOJE.getDay() + 6) % 7));
  d.sprints.push({id:'sp_1', project:'pj_bl', nome:'Ciclo 1 · Painel do CEO e Fiscal', meta:'Painel central do CEO no ar e filtro de competência corrigido', ini:iso(dAdd(seg, -7)), fim:iso(dAdd(seg, 6)), status:'ativo'});
  ['is_6','is_7'].forEach(id => { const i = d.issues.find(x => x.id === id); if (i) i.sprint = 'sp_1'; });
  d.marcos.push(
    {id:'mc_1', no:'project:pj_bl', tipo:'marco', nome:'Painel do CEO no ar', desc:'O CEO acompanha o grupo pelo app e pelo Java BL', data:iso(dAdd(HOJE, 12)), vis:true, entregue:null},
    {id:'mc_2', no:'product:pr_you', tipo:'release', nome:'YOU v0.5', desc:'Fiscal com competência corrigida e Área do Cliente com login por CPF', data:iso(dAdd(HOJE, 30)), vis:true, entregue:null},
    {id:'mc_3', no:'project:pj_bl', tipo:'marco', nome:'Financeiro no ar', desc:'Conexa integrada nos Javas', data:iso(dAdd(HOJE, 60)), vis:true, entregue:null});
  const pc = d.issues.find(x => x.titulo.startsWith('Painel central')); if (pc) pc.marco = 'mc_1';
  d.automacoes.push(
    {id:'au_1', no:'project:pj_bl', nome:'Bug concluído avisa quem abriu', gatilho:'status_mudou', cond:{tipo:'bug', grupo:'done'}, acao:'notificar', param:{para:'relator', titulo:'O bug que você abriu foi resolvido'}, ativa:true},
    {id:'au_2', no:'project:pj_bl', nome:'Item bloqueado sobe a prioridade', gatilho:'status_mudou', cond:{grupo:'blocked'}, acao:'mudar_prioridade', param:{prio:'high'}, ativa:true});
  d.statusCustom.push({id:'cs_cli', no:'project:pj_bl', nome:'Aguardando cliente', cor:'#B04A00', grupo:'blocked'});
  d.camposItem.push({id:'cf_amb', no:'project:pj_bl', nome:'Ambiente', tipo:'lista', opcoes:['Teste','Produção']});
  d.apps.forEach(a => { a.servico = a.servico || (a.plataforma === 'mobile' ? 'sv_mobile' : 'sv_desktop'); a.origemCodigo = a.origemCodigo || 'proprio'; });
  const bl = d.clients.find(c => c.id === 'cl_bl'); if (bl && !bl.sla) bl.sla = {parado:[1, 8], quebrada:[4, 24], incomodo:[8, 72], cosmetico:[24, 168]};
  d.issues.forEach(i => { if (['doing','review','blocked','done'].includes(i.status) && !i.iniciado) i.iniciado = i.ini || i.criado; });
  const disc = d.template.find(et => et.nome === 'Discovery');
  if (disc && !disc.itens.some(it => it.terceiros)) disc.itens.push(
    {id:'eti_terc_1', texto:'Acesso ao código, ao banco e à documentação do sistema de terceiros', modo:'Aviso', obrig:true, prova:'Texto', quem:'Responsável da etapa', terceiros:true},
    {id:'eti_terc_2', texto:'Mapa dos riscos do código feito por outra empresa', modo:'Aviso', obrig:true, prova:'Arquivo', quem:'Responsável da etapa', terceiros:true},
    {id:'eti_terc_3', texto:'O que dá para aproveitar e o que precisa ser refeito', modo:'Aviso', obrig:true, prova:'Texto', quem:'Responsável da etapa', terceiros:true});
  d.recursosV = 1;
}
const _semente = semente;
semente = function(){ const d = _semente(); garantirRecursos(d); return d; };

/* ---------- escopo e status personalizados ---------- */
const escoposAcima = chave => new Set(chave === 'all' ? [] : caminho(chave).map(p => p[0]));
const statusDoEscopo = chave => chave === 'all' ? D.statusCustom.slice() : D.statusCustom.filter(s => escoposAcima(chave).has(s.no));
const statusCustomDe = i => i.st ? D.statusCustom.find(s => s.id === i.st) || null : null;
function statusItemHTML(i){
  const c = statusCustomDe(i);
  return c ? '<span class="st st-' + c.grupo + ' st-custom"><i style="background:' + esc(c.cor) + '"></i>' + esc(c.nome) + '</span>' : stHTML(i.status);
}
const _mudarStatus = mudarStatus;
mudarStatus = function(i, s){
  const cs = D.statusCustom.find(x => x.id === s);
  const grupo = cs ? cs.grupo : s;
  const antes = i.status + '|' + (i.st || '');
  if (cs){
    i.st = cs.id;
    if (i.status === grupo){ registrar('status', i, i.titulo + ' → ' + cs.nome); toast('"' + i.titulo + '" foi para ' + cs.nome); }
    else _mudarStatus(i, grupo);
  } else { i.st = null; _mudarStatus(i, s); }
  if ((grupo === 'doing' || grupo === 'review') && !i.iniciado) i.iniciado = iso(HOJE);
  if (antes !== i.status + '|' + (i.st || '')) rodarAutomacoes(i, 'status_mudou');
};

/* ---------- automações ---------- */
const GATILHOS = [['item_criado','Quando um item é criado'],['status_mudou','Quando o status muda'],['prioridade_mudou','Quando a prioridade muda'],['responsavel_mudou','Quando o responsável muda'],['prazo_vencido','Quando o prazo vence']];
const ACOES = [['notificar','Avisar uma pessoa'],['comentar','Escrever um comentário'],['mudar_prioridade','Mudar a prioridade'],['atribuir','Passar para uma pessoa'],['mudar_status','Mudar o status'],['marcar_visivel','Deixar visível ao cliente']];
let rodandoAuto = false;
function rodarAutomacoes(i, gatilho){
  if (rodandoAuto || !i) return;
  rodandoAuto = true;
  try {
    const acima = escoposAcima('ws:' + i.ws);
    D.automacoes.filter(a => a.ativa && a.gatilho === gatilho && acima.has(a.no)).forEach(a => {
      const c = a.cond || {};
      if ((c.tipo && c.tipo !== i.tipo) || (c.grupo && c.grupo !== i.status) || (c.prio && c.prio !== i.prio)) return;
      let ok = true, det = '';
      try {
        const p = a.param || {};
        if (a.acao === 'notificar'){
          const dest = p.pessoa || (p.para === 'relator' ? i.rep : i.resp);
          if (dest) D.notifs.unshift({id:uid('nt'), pessoa:dest, titulo:p.titulo || a.nome, txt:i.titulo, item:i.id, quando:Date.now(), lida:false});
          else { ok = false; det = 'Ninguém para avisar'; }
        } else if (a.acao === 'comentar') i.coments.push({quem:idEu('master'), txt:p.texto || a.nome, quando:iso(HOJE), cliente:!!p.cliente, auto:true});
        else if (a.acao === 'mudar_prioridade') i.prio = p.prio || 'high';
        else if (a.acao === 'atribuir') i.resp = p.pessoa || null;
        else if (a.acao === 'marcar_visivel') i.vis = 'cliente';
        else if (a.acao === 'mudar_status' && p.status) mudarStatus(i, p.status);
      } catch (e){ ok = false; det = String(e && e.message || e); }
      D.autoLog.unshift({auto:a.id, item:i.id, quando:Date.now(), ok, det});
      if (D.autoLog.length > 200) D.autoLog.length = 200;
      toast('Automação: ' + a.nome);
    });
  } finally { rodandoAuto = false; }
  atualizarSino();
}
const _registrar = registrar;
registrar = function(tipo, i, txt){ _registrar(tipo, i, txt); if (tipo === 'criou' && i) rodarAutomacoes(i, 'item_criado'); };
function checarPrazosVencidos(){
  if (D.autoPrazoDia === iso(HOJE)) return;
  const ontem = iso(dAdd(HOJE, -1));
  D.issues.filter(i => !i.arquivado && i.status !== 'done' && i.fim === ontem).forEach(i => rodarAutomacoes(i, 'prazo_vencido'));
  D.autoPrazoDia = iso(HOJE); salvar();
}

/* ---------- notificações (sino no rodapé do menu) ---------- */
function atualizarSino(){
  const n = (D.notifs || []).filter(x => x.pessoa === eu() && !x.lida).length;
  const b = $('#notif-n'); if (b){ b.textContent = n; b.hidden = !n; }
}
function abrirNotificacoes(){
  const minhas = D.notifs.filter(x => x.pessoa === eu()).slice(0, 30);
  modal('Notificações', minhas.length ? '<ul class="rc-notifs">' + minhas.map(x => '<li class="' + (x.lida ? '' : 'nova') + '"><button type="button" data-abrir-item="' + x.item + '" data-rc-lida="' + x.id + '"><b>' + esc(x.titulo) + '</b><span>' + esc(x.txt) + '</span><small>' + new Date(x.quando).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) + '</small></button></li>').join('') + '</ul>' : '<p style="margin:0">Nenhuma notificação por aqui.</p>',
    [{txt:'Marcar todas como lidas', cls:'sec', acao:() => { D.notifs.forEach(x => { if (x.pessoa === eu()) x.lida = true; }); salvar(); atualizarSino(); }}, {txt:'Fechar'}]);
}

/* ---------- filtros e visões salvas ---------- */
const _listaFiltrada = listaFiltrada;
listaFiltrada = function(){
  const meus = UI.filtros.meus; UI.filtros.meus = false;
  let l = _listaFiltrada();
  UI.filtros.meus = meus;
  if (meus) l = l.filter(i => i.resp === eu());
  if (UI.filtros.sprint){ const ativos = new Set(D.sprints.filter(s => s.status === 'ativo').map(s => s.id)); l = l.filter(i => i.sprint && ativos.has(i.sprint)); }
  return l;
};
ferramentasHTML = function(extra){
  const fr = [['meus','Meus itens'],['alta','Alta prioridade'],['atraso','Atrasados'],['bloq','Bloqueados'],['cliente','Visíveis ao cliente'],['sprint','Sprint ativo']];
  const vistas = D.vistas.filter(v => !v.pessoa || v.pessoa === eu());
  return '<div class="ferramentas"><input class="campo" id="busca-itens" type="search" placeholder="Buscar ou: status = in progress e responsável = ana" value="' + esc(UI.busca) + '" aria-label="Busca avançada">' + I('Advanced search (busca avançada no estilo JQL, a linguagem de busca do Jira): escreva campo = valor, e junte com " e "') +
    '<span class="rotulo-mini" style="margin-left:8px">Quick filters' + I('Quick filters (filtros rápidos de um clique)') + '</span>' + fr.map(([k, n]) => '<button class="filtro-rap" type="button" data-filtro="' + k + '" aria-pressed="' + !!UI.filtros[k] + '">' + n + '</button>').join('') +
    '<span class="espaco"></span><span class="rc-vistas"><select class="sel peq" data-rc-vista aria-label="Visões salvas"><option value="">Saved views</option>' + vistas.map(v => '<option value="' + v.id + '">' + esc(v.nome) + '</option>').join('') + '</select>' +
    I('Saved views (visões salvas): guarde os filtros, a busca, o agrupamento e a view de agora com um nome, e volte a eles num clique') +
    '<button class="btn sec peq" type="button" data-rc-acao="vista-salvar">Salvar visão</button>' + (vistas.length ? '<button class="btn fant peq" type="button" data-rc-acao="vista-gerir">Gerenciar</button>' : '') + '</span>' + (extra || '') + '</div>';
};
function salvarVista(){
  modal('Salvar visão', '<label class="lb">Nome da visão<input class="campo" id="vs-n" placeholder="Ex.: Bugs abertos do Fiscal"></label><p class="sec" style="margin:0;font-size:13px">Guarda a view ' + esc((VIEWS.find(v => v[0] === UI.view) || ['', UI.view])[1]) + ' de ' + esc(nomeDe(UI.sel)) + ', com os filtros, a busca e o agrupamento de agora.</p>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Salvar', acao:dl => { const n = $('#vs-n', dl).value.trim(); if (!n){ toast('Escreva o nome'); return false; }
      D.vistas.push({id:uid('vs'), nome:n, pessoa:eu(), sel:UI.sel, view:UI.view, filtros:Object.assign({}, UI.filtros), busca:UI.busca || '', raias:UI.raias, calModo:UI.calModo, ordem:Object.assign({}, UI.ordem)}); salvar(); rView(); toast('Visão "' + n + '" salva'); }}]);
}
function aplicarVista(id){
  const v = D.vistas.find(x => x.id === id); if (!v) return;
  Object.assign(UI, {sel:v.sel, view:v.view, filtros:Object.assign({}, v.filtros), busca:v.busca, raias:v.raias || 'nenhuma', calModo:v.calModo || UI.calModo, ordem:v.ordem || UI.ordem});
  if (UI.sel !== 'all') abrirArvore(UI.sel); salvarUI(); rOperacoes(); toast('Visão "' + v.nome + '" aplicada');
}
function gerirVistas(){
  modal('Visões salvas', '<ul class="rc-lista-simples">' + D.vistas.filter(v => !v.pessoa || v.pessoa === eu()).map(v => '<li><span><b>' + esc(v.nome) + '</b><small>' + esc((VIEWS.find(x => x[0] === v.view) || ['', v.view])[1]) + ' · ' + esc(nomeDe(v.sel)) + '</small></span><button class="btn fant peq" type="button" data-rc-vista-del="' + v.id + '">Excluir</button></li>').join('') + '</ul>', [{txt:'Fechar'}]);
}

/* ---------- Board com status personalizados, pai no cartão e faixas por Epic e Sprint ---------- */
const epicDe = i => { let x = i, n = 0; while (x && x.pai && n++ < 6) x = byId('issues', x.pai); return x && x.id !== i.id && x.tipo === 'epic' ? x : null; };
const _cartaoHTML = cartaoHTML;
cartaoHTML = function(i){
  let h = _cartaoHTML(i);
  const pai = i.pai && byId('issues', i.pai);
  const sp = i.sprint && D.sprints.find(s => s.id === i.sprint);
  const extra = (pai ? '<div class="c-pai" title="Dentro de ' + esc(tipoNome(pai.tipo)) + '">' + tipoHTML(pai.tipo) + '<span>' + esc(pai.titulo) + '</span></div>' : '') +
    (sp && sp.status !== 'encerrado' ? '<span class="c-sprint" title="Sprint ' + esc(sp.nome) + '">' + esc(sp.nome.split('·')[0].trim()) + '</span>' : '');
  return extra ? h.replace('<div class="tt">', extra + '<div class="tt">') : h;
};
vBoard = function(){
  const l = listaFiltrada();
  const [tipo, id] = UI.sel.split(':');
  const wip = tipo === 'ws' ? (byId('ws', id).wip || 0) : 0;
  const customs = statusDoEscopo(UI.sel);
  const ordem = [];
  STATUS.forEach(s => { ordem.push({id:s.id, nome:s.nome, expl:s.expl, grupo:s.id}); customs.filter(c => c.grupo === s.id).forEach(c => ordem.push({id:c.id, nome:c.nome, cor:c.cor, grupo:c.grupo, custom:true})); });
  const idsCustom = new Set(customs.map(c => c.id));
  const colunas = (lista, raia) => '<div class="board">' + ordem.map(s => {
    const its = s.custom ? lista.filter(i => i.st === s.id) : lista.filter(i => i.status === s.id && !(i.st && idsCustom.has(i.st)));
    const estouro = wip && s.grupo === 'doing' && !s.custom && its.length > wip;
    const info = s.custom ? I(s.nome + ' (status personalizado do grupo ' + GRUPO_NOME[s.grupo] + '): criado em Settings para este projeto. Nos painéis ele conta junto com ' + GRUPO_NOME[s.grupo] + '.') : I(s.nome + ' (' + s.expl + ')');
    return '<section class="coluna col-' + s.grupo + (s.custom ? ' col-custom' : '') + (estouro ? ' cheia' : '') + '" aria-label="' + esc(s.nome) + '"' + (s.custom ? ' style="--c-custom:' + esc(s.cor) + '"' : '') + '><div class="coluna-cab"><span>' + esc(s.nome) + info + '</span><span class="qt' + (estouro ? ' estouro' : '') + '">' + its.length + (wip && s.grupo === 'doing' && !s.custom ? ' / ' + wip : '') + '</span></div>' +
      '<div class="coluna-corpo" data-soltar-status="' + s.id + '"' + (raia ? ' data-raia="' + esc(raia) + '"' : '') + '>' + its.map(cartaoHTML).join('') + '</div>' +
      (podeEditar() && !raia && !s.custom ? '<form class="add-rap" data-add-status="' + s.id + '"><input class="campo" name="t" placeholder="Quick add" aria-label="Criar item em ' + esc(s.nome) + '"><button class="btn peq" type="submit">' + ICO.mais + '</button></form>' : '') + '</section>';
  }).join('') + '</div>';
  const raiasSel = '<label class="rotulo-mini" style="display:flex;gap:8px;align-items:center">Swimlanes' + I('Swimlanes (faixas horizontais que agrupam o quadro)') + '<select class="sel peq" id="raias">' + [['nenhuma','Nenhuma'],['resp','Responsável'],['prio','Prioridade'],['app','Aplicação'],['epic','Epic'],['sprint','Sprint']].map(([k, n]) => '<option value="' + k + '"' + (UI.raias === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' +
    (wip ? '<span class="rotulo-mini">WIP limit' + I('WIP limit (limite de cartões em andamento: a coluna fica vermelha se passar)') + ' ' + wip + '</span>' : '') +
    (podeEditar() ? '<button class="btn" type="button" data-acao="novo-item">' + ICO.mais + 'Novo item</button>' : '');
  let corpo;
  if (UI.raias === 'nenhuma') corpo = colunas(l);
  else {
    const chaveR = i => UI.raias === 'resp' ? (pessoa(i.resp) || {nome:'Sem responsável'}).nome : UI.raias === 'prio' ? prioNome(i.prio) : UI.raias === 'epic' ? ((epicDe(i) || (i.tipo === 'epic' ? i : null)) || {titulo:'Sem epic'}).titulo : UI.raias === 'sprint' ? ((D.sprints.find(s => s.id === i.sprint) || {nome:'Fora de sprint'}).nome) : (appDe(i) || {nome:'-'}).nome;
    const grupos = [...new Set(l.map(chaveR))].sort();
    corpo = grupos.map(g => '<div class="raia"><div class="raia-cab">' + esc(g) + '</div>' + colunas(l.filter(i => chaveR(i) === g), g) + '</div>').join('') || '<p class="vazio-linha">Nenhum item com esses filtros.</p>';
  }
  return ferramentasHTML(raiasSel) + '<div class="board-rolo">' + corpo + '</div>';
};

/* ---------- Table com edição em massa (Bulk edit) ---------- */
const selItens = new Set();
vTable = function(){
  const l = listaFiltrada().slice();
  const o = UI.ordem, val = i => o.campo === 'resp' ? (pessoa(i.resp) || {nome:'~'}).nome : o.campo === 'prio' ? PRIOS.findIndex(p => p.id === i.prio) : o.campo === 'status' ? STATUS.findIndex(s => s.id === i.status) : (i[o.campo] || '~');
  l.sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * o.dir);
  [...selItens].forEach(id => { if (!l.some(i => i.id === id)) selItens.delete(id); });
  const th = (campo, nome) => '<th scope="col" class="ord" data-ordem="' + campo + '">' + nome + (o.campo === campo ? (o.dir > 0 ? ' ↑' : ' ↓') : '') + '</th>';
  const pode = podeEditar(), dis = pode ? '' : ' disabled';
  const customs = statusDoEscopo(UI.sel);
  const stOpts = i => STATUS.map(s => '<option value="' + s.id + '"' + (i.status === s.id && !i.st ? ' selected' : '') + '>' + s.nome + '</option>').join('') + customs.map(c => '<option value="' + c.id + '"' + (i.st === c.id ? ' selected' : '') + '>' + esc(c.nome) + '</option>').join('');
  const equipe = D.people.filter(p => p.acesso !== 'stakeholder');
  const sprintsProj = sprintsDoEscopo(UI.sel).filter(s => s.status !== 'encerrado');
  const barra = pode && selItens.size ? '<div class="rc-massa" role="region" aria-label="Edição em massa"><b>' + selItens.size + (selItens.size === 1 ? ' item selecionado' : ' itens selecionados') + '</b>' + I('Bulk edit (edição em massa): muda de uma vez todos os itens marcados na tabela') +
    '<select class="sel peq" data-rc-massa="status"><option value="">Status…</option>' + STATUS.map(s => '<option value="' + s.id + '">' + s.nome + '</option>').join('') + customs.map(c => '<option value="' + c.id + '">' + esc(c.nome) + '</option>').join('') + '</select>' +
    '<select class="sel peq" data-rc-massa="prio"><option value="">Prioridade…</option>' + PRIOS.map(p => '<option value="' + p.id + '">' + p.nome + '</option>').join('') + '</select>' +
    '<select class="sel peq" data-rc-massa="resp"><option value="">Responsável…</option><option value="-">Sem responsável</option>' + equipe.map(p => '<option value="' + p.id + '">' + esc(p.nome) + '</option>').join('') + '</select>' +
    '<select class="sel peq" data-rc-massa="sprint"><option value="">Sprint…</option><option value="-">Tirar do sprint</option>' + sprintsProj.map(s => '<option value="' + s.id + '">' + esc(s.nome) + '</option>').join('') + '</select>' +
    '<button class="btn fant peq" type="button" data-rc-acao="massa-arquivar">Arquivar</button><button class="btn fant peq" type="button" data-rc-acao="massa-limpar">Limpar seleção</button></div>' : '';
  return ferramentasHTML(pode ? '<button class="btn" type="button" data-acao="novo-item">' + ICO.mais + 'Novo item</button>' : '') + barra +
    '<div class="tabela-rolo"><table class="tabela itens"><colgroup>' + (pode ? '<col style="width:3%">' : '') + '<col style="width:' + (pode ? 21 : 24) + '%"><col style="width:8%"><col style="width:14%"><col style="width:12%"><col style="width:9%"><col style="width:12%"><col style="width:10%"><col style="width:10%"></colgroup><thead><tr>' +
    (pode ? '<th scope="col"><input type="checkbox" data-rc-sel-todos aria-label="Selecionar todos"' + (l.length && selItens.size === l.length ? ' checked' : '') + '></th>' : '') +
    th('titulo','Título') + th('tipo','Tipo') + '<th scope="col">Onde</th>' + th('status','Status') + th('prio','Prioridade') + th('resp','Responsável') + th('ini','Início') + th('fim','Prazo') + '</tr></thead><tbody>' +
    l.map(i => '<tr data-linha="' + i.id + '"' + (selItens.has(i.id) ? ' class="marcada"' : '') + '>' + (pode ? '<td><input type="checkbox" data-rc-sel="' + i.id + '"' + (selItens.has(i.id) ? ' checked' : '') + ' aria-label="Selecionar ' + esc(i.titulo) + '"></td>' : '') +
      '<th scope="row"><input class="campo" data-editar="titulo" value="' + esc(i.titulo) + '"' + dis + ' aria-label="Título"></th>' +
      '<td><select class="sel" data-editar="tipo"' + dis + '>' + TIPOS.map(t => '<option value="' + t.id + '"' + (i.tipo === t.id ? ' selected' : '') + '>' + t.nome + '</option>').join('') + '</select></td>' +
      '<td class="sec" style="font-size:12px"><button class="btn fant peq" type="button" data-abrir-item="' + i.id + '">' + esc(caminhoTexto(i)) + '</button></td>' +
      '<td><select class="sel" data-editar="status"' + dis + '>' + stOpts(i) + '</select></td>' +
      '<td><select class="sel" data-editar="prio"' + dis + '>' + PRIOS.map(p => '<option value="' + p.id + '"' + (i.prio === p.id ? ' selected' : '') + '>' + p.nome + '</option>').join('') + '</select></td>' +
      '<td><select class="sel" data-editar="resp"' + dis + '><option value="">Sem responsável</option>' + equipe.map(p => '<option value="' + p.id + '"' + (i.resp === p.id ? ' selected' : '') + '>' + esc(p.nome) + '</option>').join('') + '</select></td>' +
      '<td><input class="campo" type="date" data-editar="ini" value="' + esc(i.ini || '') + '"' + dis + ' aria-label="Início"></td>' +
      '<td><input class="campo' + (atrasado(i) ? ' atrasado' : '') + '" type="date" data-editar="fim" value="' + esc(i.fim || '') + '"' + dis + ' aria-label="Prazo"></td></tr>').join('') +
    '</tbody></table></div>' + (l.length ? '' : '<p class="vazio-linha">Nenhum item com esses filtros.</p>');
};
function aplicarMassa(campo, v){
  if (!v) return;
  const its = [...selItens].map(id => byId('issues', id)).filter(Boolean);
  its.forEach(i => {
    if (campo === 'status') mudarStatus(i, v);
    else if (campo === 'prio'){ const a = i.prio; i.prio = v; if (a !== v) rodarAutomacoes(i, 'prioridade_mudou'); }
    else if (campo === 'resp'){ const a = i.resp; i.resp = v === '-' ? null : v; if (a !== i.resp) rodarAutomacoes(i, 'responsavel_mudou'); }
    else if (campo === 'sprint') i.sprint = v === '-' ? null : v;
  });
  registrar('status', null, its.length + ' itens mudados de uma vez');
  salvar(); rView(); toast(its.length + (its.length === 1 ? ' item mudado' : ' itens mudados'));
}

/* ---------- item aberto (gaveta): relator, pai e filhos, sprint, marco, pontos e campos personalizados ---------- */
const FILHO_DE = {epic:'story', story:'task', task:'subtask', bug:'subtask'};
const PAIS_VALIDOS = {epic:[], story:['epic'], task:['epic','story'], bug:['epic','story'], subtask:['task','bug']};
function descendentes(id){ const r = new Set(); const fila = [id]; while (fila.length){ const x = fila.pop(); D.issues.filter(i => i.pai === x).forEach(i => { if (!r.has(i.id)){ r.add(i.id); fila.push(i.id); } }); } return r; }
function sprintsDoEscopo(chave){ const pj = chave === 'all' ? null : cadeia(chave).project; return D.sprints.filter(s => !pj || s.project === pj.id); }
function marcosDoEscopo(chave){ if (chave === 'all') return D.marcos.slice(); const acima = escoposAcima(chave); return D.marcos.filter(m => acima.has(m.no) || caminho(m.no).some(p => p[0] === chave)); }
const camposDoEscopo = chave => chave === 'all' ? D.camposItem.slice() : D.camposItem.filter(c => escoposAcima(chave).has(c.no));
const _abrirItem = abrirItem;
abrirItem = function(id){
  _abrirItem(id);
  const i = byId('issues', id); const g = $('#gaveta-wrap .gaveta'); if (!i || !g) return;
  const pode = podeEditar(), dis = pode ? '' : ' disabled';
  const chaveWs = 'ws:' + i.ws;
  // status: inclui os personalizados
  const customs = statusDoEscopo(chaveWs);
  const selSt = $('select[data-g="status"]', g);
  if (selSt && customs.length){ customs.forEach(c => { const op = document.createElement('option'); op.value = c.id; op.textContent = c.nome + ' · ' + GRUPO_NOME[c.grupo]; if (i.st === c.id) op.selected = true; selSt.appendChild(op); }); }
  const faixaSt = $('.g-faixa .st', g); if (faixaSt && i.st){ faixaSt.outerHTML = statusItemHTML(i); }
  // detalhes extras
  const app = appDe(i);
  const candidatosPai = D.issues.filter(x => !x.arquivado && x.id !== i.id && PAIS_VALIDOS[i.tipo].includes(x.tipo) && appDe(x) && app && appDe(x).id === app.id && !descendentes(i.id).has(x.id));
  const linha = (rot, info, ctrl) => '<div class="d-lin"><span class="d-rot">' + esc(rot) + (info ? I(info) : '') + '</span><span class="d-val">' + ctrl + '</span></div>';
  const sel = (campo, opts, atual) => '<select class="sel d-sel" data-rc-g="' + campo + '"' + dis + '>' + opts.map(([v, n]) => '<option value="' + esc(v) + '"' + ((atual || '') === v ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select>';
  const sprints = sprintsDoEscopo(chaveWs).filter(s => s.status !== 'encerrado' || s.id === i.sprint);
  const marcos = marcosDoEscopo(chaveWs);
  const det = $('.g-lateral .g-cartao', g);
  if (det) det.insertAdjacentHTML('beforeend',
    linha('Reporter', 'Reporter (relator): quem abriu o item. É a pessoa avisada quando uma automação diz "avisar quem abriu".', sel('rep', [['', 'Ninguém']].concat(D.people.map(p => [p.id, p.nome])), i.rep)) +
    linha('Parent', 'Parent (item pai): o item maior de que este faz parte. Uma story fica num epic, uma tarefa numa story e uma subtarefa numa tarefa.', PAIS_VALIDOS[i.tipo].length ? sel('pai', [['', 'Nenhum']].concat(candidatosPai.map(x => [x.id, tipoNome(x.tipo) + ' · ' + x.titulo])), i.pai) : '<span class="sec" style="font-size:12px">Epic não fica dentro de outro item</span>') +
    linha('Sprint', 'Sprint (ciclo curto): o período de uma a duas semanas em que este item deve ficar pronto, junto com os outros itens do mesmo ciclo.', sel('sprint', [['', 'Fora de sprint']].concat(sprints.map(s => [s.id, s.nome])), i.sprint)) +
    linha('Milestone', 'Milestone (marco): um ponto importante com data, como "Financeiro no ar". O item conta para o progresso do marco.', sel('marco', [['', 'Nenhum']].concat(marcos.map(m => [m.id, (m.tipo === 'release' ? 'Release · ' : '') + m.nome])), i.marco)) +
    linha('Story points', 'Story points (pontos de esforço): uma nota de tamanho do trabalho (1, 2, 3, 5, 8, 13 ou 21). Mede a velocidade do time nos sprints, sem depender de horas.', sel('pontos', [['', 'Sem pontos']].concat([1,2,3,5,8,13,21].map(n => [String(n), String(n)])), i.pontos ? String(i.pontos) : '')));
  // filhos
  const filhos = D.issues.filter(x => x.pai === i.id && !x.arquivado);
  const feitos = filhos.filter(x => x.status === 'done').length;
  const secFilhos = FILHO_DE[i.tipo] ? '<section class="g-sec"><h4>Child issues' + I('Child issues (itens filhos): as partes menores deste item. O progresso aqui soma quantos filhos já foram concluídos.') + (filhos.length ? '<span class="g-cont">' + feitos + ' de ' + filhos.length + '</span>' : '') + '</h4>' +
    (filhos.length ? '<div class="progresso" style="margin-bottom:6px"><i style="width:' + (feitos / filhos.length * 100) + '%"></i></div><ul class="g-lista">' + filhos.map(x => '<li class="g-link">' + tipoHTML(x.tipo) + '<button class="g-lk-nome" type="button" data-abrir-item="' + x.id + '">' + esc(x.titulo) + '</button>' + statusItemHTML(x) + '</li>').join('') + '</ul>' : '<p class="sec" style="margin:0 0 6px;font-size:13px">Nenhum item dentro deste ainda.</p>') +
    (pode ? '<form class="g-add" data-rc-form="filho"><input class="campo" name="t" placeholder="Novo ' + esc(tipoNome(FILHO_DE[i.tipo])) + ' dentro deste"><button class="btn sec peq" type="submit">Criar</button></form>' : '') + '</section>' : '';
  // campos personalizados
  const campos = camposDoEscopo(chaveWs);
  const cf = i.cf || {};
  const ctrlCampo = c => c.tipo === 'lista' ? '<select class="sel" data-rc-cf="' + c.id + '"' + dis + '><option value="">Sem valor</option>' + c.opcoes.map(o => '<option' + (cf[c.id] === o ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>'
    : c.tipo === 'sim_nao' ? '<select class="sel" data-rc-cf="' + c.id + '"' + dis + '><option value="">Sem valor</option><option value="sim"' + (cf[c.id] === 'sim' ? ' selected' : '') + '>Sim</option><option value="nao"' + (cf[c.id] === 'nao' ? ' selected' : '') + '>Não</option></select>'
    : '<input class="campo" data-rc-cf="' + c.id + '" type="' + (c.tipo === 'numero' || c.tipo === 'dinheiro' ? 'number' : c.tipo === 'data' ? 'date' : 'text') + '" value="' + esc(cf[c.id] || '') + '"' + dis + '>';
  const secCampos = campos.length ? '<section class="g-sec"><h4>Custom fields' + I('Custom fields (campos personalizados): informações extras que o projeto criou para os itens, além das que o sistema já traz. Crie e apague em Settings.') + '</h4><div class="grade-form">' + campos.map(c => '<label class="lb">' + esc(c.nome) + ctrlCampo(c) + '</label>').join('') + '</div></section>' : '';
  const secCheck = $$('.g-principal .g-sec', g)[2];
  if (secCheck) secCheck.insertAdjacentHTML('afterend', secFilhos + secCampos);
};

/* ---------- Sprints: planejamento, queima (Burndown) e velocidade (Velocity) ---------- */
function restanteNoDia(its, dia){ return its.reduce((s, i) => s + ((i.status !== 'done' || (i.feito && i.feito > dia)) ? (+i.est || 0) : 0), 0); }
function queimaSVG(sp, its, alto){
  const ini = parse(sp.ini), fim = parse(sp.fim), n = Math.max(1, Math.round((fim - ini) / 864e5));
  const total = its.reduce((s, i) => s + (+i.est || 0), 0) || 1;
  const W = 600, H = alto || 180, px = k => 36 + k / n * (W - 48), py = v => 12 + (1 - v / total) * (H - 36);
  const hojeK = Math.min(n, Math.max(0, Math.round((HOJE - ini) / 864e5)));
  let real = ''; for (let k = 0; k <= hojeK; k++) real += (k ? ' L' : 'M') + px(k).toFixed(1) + ' ' + py(restanteNoDia(its, iso(dAdd(ini, k)))).toFixed(1);
  const marcas = [0, 0.5, 1].map(f => '<line x1="36" x2="' + (W - 12) + '" y1="' + py(total * f) + '" y2="' + py(total * f) + '" class="q-grade"/><text x="30" y="' + (py(total * f) + 4) + '" class="q-eixo" text-anchor="end">' + Math.round(total * f) + 'h</text>').join('');
  return '<svg class="queima" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Gráfico de queima do sprint ' + esc(sp.nome) + '">' + marcas +
    '<line x1="' + px(0) + '" y1="' + py(total) + '" x2="' + px(n) + '" y2="' + py(0) + '" class="q-ideal"/>' +
    (HOJE >= ini ? '<path d="' + real + '" class="q-real"/>' : '') +
    (HOJE >= ini && HOJE <= fim ? '<line x1="' + px(hojeK) + '" x2="' + px(hojeK) + '" y1="8" y2="' + (H - 22) + '" class="q-hoje"/>' : '') +
    '<text x="' + px(0) + '" y="' + (H - 6) + '" class="q-eixo">' + fmt(sp.ini) + '</text><text x="' + px(n) + '" y="' + (H - 6) + '" class="q-eixo" text-anchor="end">' + fmt(sp.fim) + '</text></svg>';
}
function vSprints(){
  const pj = cadeia(UI.sel).project;
  if (!pj) return '<p class="vazio-linha">Os sprints são de um projeto. Escolha um projeto, produto, aplicação ou frente na estrutura.</p>';
  const sps = D.sprints.filter(s => s.project === pj.id).sort((a, b) => a.ini.localeCompare(b.ini));
  const ativo = sps.find(s => s.status === 'ativo');
  const itensDe = sp => D.issues.filter(i => i.sprint === sp.id && !i.arquivado);
  const pode = podeEditar();
  const cardAtivo = ativo ? (() => { const its = itensDe(ativo), f = its.filter(i => i.status === 'done');
    const h = its.reduce((s, i) => s + (+i.est || 0), 0), hf = f.reduce((s, i) => s + (+i.est || 0), 0);
    return '<div class="pc-c rc-sprint-ativo"><h3>Sprint ativo<span>' + fmt(ativo.ini) + ' a ' + fmt(ativo.fim) + '</span></h3><div class="rc-sp-cab"><div><b class="rc-sp-nome">' + esc(ativo.nome) + '</b><p class="sec" style="margin:4px 0 0">' + esc(ativo.meta || '') + '</p></div>' +
      '<div class="rc-sp-num"><b>' + f.length + '<small>/' + its.length + '</small></b><span>itens concluídos</span></div><div class="rc-sp-num"><b>' + num(hf) + '<small>/' + num(h) + 'h</small></b><span>horas concluídas</span></div>' +
      (pode ? '<button class="btn sec" type="button" data-rc-sprint-fim="' + ativo.id + '">Encerrar sprint</button>' : '') + '</div>' +
      '<div class="rc-queima"><div class="rc-queima-leg"><span><i class="lg-real"></i>Restante</span><span><i class="lg-ideal"></i>Ritmo ideal</span><span>Burndown' + I('Burndown (gráfico de queima): as horas que faltam no sprint caindo dia a dia. Se a linha real fica acima da ideal, o sprint está atrasado.') + '</span></div>' + queimaSVG(ativo, its) + '</div></div>'; })()
    : '<div class="aviso-faixa"><b>Nenhum sprint ativo</b><span>Crie um sprint e inicie para acompanhar o ritmo e a queima.</span></div>';
  const encerrados = sps.filter(s => s.status === 'encerrado');
  const velocidade = encerrados.length ? '<h2 class="sub">Velocity' + I('Velocity (velocidade): quanto o time conclui por sprint, em itens, horas e story points. Serve para planejar o próximo sprint com base no que o time costuma entregar.') + '</h2><div class="tabela-rolo"><table class="tabela"><thead><tr><th>Sprint</th><th>Período</th><th>Itens concluídos</th><th>Horas concluídas</th><th>Story points</th></tr></thead><tbody>' +
    encerrados.map(s => { const its = itensDe(s).concat(D.issues.filter(i => (i.sprintsAnteriores || []).includes(s.id))); const f = its.filter(i => i.status === 'done' && i.feito && i.feito <= s.fim);
      return '<tr><th scope="row">' + esc(s.nome) + '</th><td>' + fmt(s.ini) + ' a ' + fmt(s.fim) + '</td><td>' + f.length + ' de ' + its.length + '</td><td>' + num(f.reduce((a, i) => a + (+i.est || 0), 0)) + 'h</td><td>' + f.reduce((a, i) => a + (+i.pontos || 0), 0) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '';
  const lista = '<h2 class="sub">Todos os sprints de ' + esc(pj.nome) + '</h2><div class="tabela-rolo"><table class="tabela"><thead><tr><th>Sprint</th><th>Meta</th><th>Período</th><th>Situação</th><th>Itens</th><th></th></tr></thead><tbody>' +
    (sps.length ? sps.map(s => '<tr' + (s.status === 'ativo' ? ' class="destaque"' : '') + '><th scope="row">' + esc(s.nome) + '</th><td class="sec">' + esc(s.meta || '') + '</td><td>' + fmt(s.ini) + ' a ' + fmt(s.fim) + '</td><td>' + ({planejado:'Planejado', ativo:'Ativo', encerrado:'Encerrado'}[s.status]) + '</td><td>' + itensDe(s).length + '</td><td><div class="acoes">' +
      (pode && s.status === 'planejado' ? '<button class="btn peq" type="button" data-rc-sprint-ini="' + s.id + '">Iniciar</button>' : '') + (pode && s.status !== 'encerrado' ? '<button class="btn fant peq" type="button" data-rc-sprint-plan="' + s.id + '">Planejar</button>' : '') + '</div></td></tr>').join('') : '<tr><td colspan="6" class="sec">Nenhum sprint ainda.</td></tr>') + '</tbody></table></div>';
  const alvo = D.sprints.find(s => s.id === UI.spPlan && s.project === pj.id) || ativo || sps.find(s => s.status === 'planejado');
  const plano = alvo && pode ? (() => { const dentro = itensDe(alvo); const fora = issuesEm('project:' + pj.id).filter(i => i.status !== 'done' && i.sprint !== alvo.id && !(i.sprint && D.sprints.some(s => s.id === i.sprint && s.status === 'ativo' && s.id !== alvo.id)));
    const li = (i, btn) => '<li>' + tipoHTML(i.tipo) + prioHTML(i.prio) + '<button class="g-lk-nome" type="button" data-abrir-item="' + i.id + '">' + esc(i.titulo) + '</button><span class="sec" style="font-size:12px">' + esc(num(+i.est || 0)) + 'h</span>' + btn + '</li>';
    return '<h2 class="sub">Planejar: ' + esc(alvo.nome) + '</h2><div class="rc-plano"><div class="pc-c"><h3>No sprint<span>' + dentro.length + ' · ' + num(dentro.reduce((s, i) => s + (+i.est || 0), 0)) + 'h</span></h3><ul class="rc-plano-l">' + (dentro.map(i => li(i, '<button class="btn fant peq" type="button" data-rc-sprint-tirar="' + i.id + '">Tirar</button>')).join('') || '<li class="sec">Nenhum item.</li>') + '</ul></div>' +
      '<div class="pc-c"><h3>Backlog do projeto<span>' + fora.length + '</span></h3><ul class="rc-plano-l">' + (fora.slice(0, 60).map(i => li(i, '<button class="btn sec peq" type="button" data-rc-sprint-por="' + i.id + '" data-sp="' + alvo.id + '">Pôr no sprint</button>')).join('') || '<li class="sec">Nada no backlog.</li>') + '</ul></div></div>'; })() : '';
  return '<div class="topo-tela"><p class="intro" style="margin:0">Os ' + 'Sprints' + I('Sprints (ciclos curtos): períodos de uma a duas semanas com uma meta fechada. O time escolhe os itens que cabem e acompanha a queima até o fim.') + ' de ' + esc(pj.nome) + '. Dois sprints do mesmo projeto não podem se sobrepor.</p><div class="acoes">' + (pode ? '<button class="btn" type="button" data-rc-acao="sprint-novo">' + ICO.mais + 'Novo sprint</button>' : '') + '</div></div>' +
    cardAtivo + plano + lista + velocidade;
}
function novoSprint(){
  const pj = cadeia(UI.sel).project; if (!pj) return;
  const ultimo = D.sprints.filter(s => s.project === pj.id).sort((a, b) => b.fim.localeCompare(a.fim))[0];
  const ini = ultimo ? iso(dAdd(parse(ultimo.fim), 1)) : iso(HOJE), fim = iso(dAdd(parse(ini), 13));
  modal('Novo sprint em ' + esc(pj.nome), '<div class="grade-form"><label class="lb largo">Nome<input class="campo" id="sp-n" value="Ciclo ' + (D.sprints.filter(s => s.project === pj.id).length + 1) + '"></label><label class="lb largo">Meta<input class="campo" id="sp-m" placeholder="O que precisa estar pronto no fim"></label><label class="lb">Início<input class="campo" type="date" id="sp-i" value="' + ini + '"></label><label class="lb">Fim<input class="campo" type="date" id="sp-f" value="' + fim + '"></label></div>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Criar sprint', acao:dl => { const n = $('#sp-n', dl).value.trim(), a = $('#sp-i', dl).value, b = $('#sp-f', dl).value;
      if (!n || !a || !b){ toast('Preencha nome, início e fim'); return false; } if (b < a){ toast('O fim vem antes do início'); return false; }
      const choca = D.sprints.find(s => s.project === pj.id && !(b < s.ini || a > s.fim)); if (choca){ toast('Choca com o sprint "' + choca.nome + '"'); return false; }
      const sp = {id:uid('sp'), project:pj.id, nome:n, meta:$('#sp-m', dl).value.trim(), ini:a, fim:b, status:'planejado'}; D.sprints.push(sp); UI.spPlan = sp.id; salvar(); salvarUI(); rView(); toast('Sprint criado. Agora escolha os itens.'); }}]);
}
function encerrarSprint(id){
  const sp = D.sprints.find(s => s.id === id); const abertos = D.issues.filter(i => i.sprint === id && i.status !== 'done' && !i.arquivado);
  const prox = D.sprints.find(s => s.project === sp.project && s.status === 'planejado');
  modal('Encerrar ' + esc(sp.nome) + '?', '<p style="margin:0">' + (abertos.length ? abertos.length + (abertos.length === 1 ? ' item não terminou e vai ' : ' itens não terminaram e vão ') + (prox ? 'para o próximo sprint, "' + esc(prox.nome) + '".' : 'voltar para o backlog.') : 'Todos os itens foram concluídos.') + '</p>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Encerrar', acao:() => { sp.status = 'encerrado'; abertos.forEach(i => { i.sprintsAnteriores = (i.sprintsAnteriores || []).concat(sp.id); i.sprint = prox ? prox.id : null; }); salvar(); rView(); toast('Sprint encerrado'); }}]);
}

/* ---------- My Work: as tarefas de quem está usando, por prazo ---------- */
function vMyWork(){
  const me = eu(), p = pessoa(me);
  const its = issuesEm(UI.sel).filter(i => i.resp === me && i.status !== 'done');
  const hoje = iso(HOJE), fimSem = iso(dAdd(HOJE, 6 - HOJE.getDay()));
  const grupos = [['Atrasados', i => i.fim && i.fim < hoje], ['Hoje', i => i.fim === hoje], ['Esta semana', i => i.fim > hoje && i.fim <= fimSem], ['Depois', i => i.fim > fimSem], ['Sem prazo', i => !i.fim]];
  const blocos = D.issues.filter(i => i.resp === me && i.bloco && i.bloco.data === hoje).sort((a, b) => a.bloco.ini.localeCompare(b.bloco.ini));
  const foco = D.focus && byId('ws', D.focus.ws);
  const notifs = (D.notifs || []).filter(x => x.pessoa === me && !x.lida).slice(0, 5);
  const linha = i => '<li data-abrir-item="' + i.id + '"><span style="display:flex;gap:8px;align-items:center">' + tipoHTML(i.tipo) + prioHTML(i.prio) + esc(i.titulo) + '</span><span class="sec" style="font-size:12px">' + esc(caminhoTexto(i)) + '</span><span style="display:flex;gap:8px;align-items:center">' + statusItemHTML(i) + (i.fim ? '<span class="sec' + (atrasado(i) ? ' atraso' : '') + '" style="font-size:12px">' + fmt(i.fim) + '</span>' : '') + '</span></li>';
  return '<div class="topo-tela"><p class="intro" style="margin:0">' + T('My Work','minhas tarefas: tudo o que está com você, em qualquer projeto, organizado por prazo') + ' de ' + esc(p ? p.nome : '') + (UI.sel === 'all' ? ', em todos os clientes.' : ', em ' + esc(nomeDe(UI.sel)) + '.') + '</p></div>' +
    '<div class="rc-mw">' +
      '<div class="rc-mw-lado"><div class="pc-c"><h3>Agora</h3>' + (foco ? '<p style="margin:0"><b>Em foco:</b> ' + esc(byId('apps', foco.app).nome + ' › ' + foco.nome) + '</p>' : '<p class="sec" style="margin:0">Nenhuma frente em foco.</p>') + '</div>' +
      '<div class="pc-c"><h3>Horários reservados hoje<span>' + blocos.length + '</span></h3>' + (blocos.length ? '<ul class="pc-lista">' + blocos.map(i => '<li class="clicavel" data-abrir-item="' + i.id + '"><i style="background:var(--preto)"></i><span>' + esc(i.bloco.ini + ' às ' + i.bloco.fim + ' · ' + i.titulo) + '</span></li>').join('') + '</ul>' : '<p class="sec" style="margin:0">Nada reservado para hoje.</p>') + '</div>' +
      '<div class="pc-c"><h3>Avisos para você<span>' + notifs.length + '</span></h3>' + (notifs.length ? '<ul class="pc-lista">' + notifs.map(x => '<li class="clicavel" data-abrir-item="' + x.item + '" data-rc-lida="' + x.id + '"><i style="background:var(--vermelho)"></i><span>' + esc(x.titulo + ': ' + x.txt) + '</span></li>').join('') + '</ul>' : '<p class="sec" style="margin:0">Nenhum aviso novo.</p>') + '</div></div>' +
      '<div class="rc-mw-meio">' + grupos.map(([nome, f]) => { const l = its.filter(f).sort((a, b) => (a.fim || '9').localeCompare(b.fim || '9')); return l.length ? '<div class="grupo-lista"><h3>' + esc(nome) + '<span class="rotulo-mini">' + l.length + '</span></h3><ul>' + l.map(linha).join('') + '</ul></div>' : ''; }).join('') +
      (its.length ? '' : '<p class="vazio-linha">Nada com você por aqui.</p>') + '</div></div>';
}

/* ---------- views novas e Everything ---------- */
VIEWS.splice(VIEWS.findIndex(v => v[0] === 'whiteboard'), 0, ['sprints','Sprints','ciclos curtos com meta'], ['mywork','My Work','minhas tarefas']);
const _rView = rView;
rView = function(){
  const c = $('#ops-corpo'); if (!c) return;
  if (UI.view === 'sprints'){ c.innerHTML = vSprints(); ligarArrastar(); }
  else if (UI.view === 'mywork'){ c.innerHTML = vMyWork(); }
  else _rView();
  if (UI.view === 'calendar') ligarPuxadores();
  if (UI.view === 'whiteboard'){ ligarQuadro(); ajustarSetas(); }
};
const _rOperacoes = rOperacoes;
rOperacoes = function(){
  if (UI.sel === 'all'){ rEverything(); return; }
  _rOperacoes();
  const [tipo, id] = UI.sel.split(':');
  if (!cadeia(UI.sel).project){ const b = $('.view-b[data-view="sprints"]'); if (b) (b.closest('.view-casa') || b).remove(); if (UI.view === 'sprints'){ UI.view = 'dashboard'; rView(); } }
  const arv = $('.ops-arvore [role="tree"]');
  if (arv) arv.insertAdjacentHTML('afterbegin', '<div class="no-arv rc-tudo" data-rc-tudo role="treeitem" aria-selected="false" style="padding-left:8px"><span class="seta"></span><span class="nome">Everything</span><span class="tipo">tudo</span></div>');
  if (tipo === 'app' && podeEditar()){ const a = byId('apps', id); const ac = $('.ops-cab .acoes');
    if (a && ac) ac.insertAdjacentHTML('afterbegin', '<label class="rotulo-mini" style="display:flex;gap:8px;align-items:center">Código' + I('Origem do código: nosso (feito pela IT.IA) ou de terceiros (feito por outra empresa). Quando é de terceiros, o Discovery ganha itens a mais para entender o código antes de mexer.') + '<select class="sel peq" data-rc-origem="' + a.id + '"><option value="proprio"' + (a.origemCodigo !== 'terceiros' ? ' selected' : '') + '>Nosso</option><option value="terceiros"' + (a.origemCodigo === 'terceiros' ? ' selected' : '') + '>De terceiros</option></select></label>'); }
};
function rEverything(){
  const el = $('#m-operacoes');
  const disp = VIEWS.filter(v => ['dashboard','board','table','list','calendar','timeline','workload','mywork'].includes(v[0]));
  if (!disp.some(v => v[0] === UI.view)) UI.view = 'board';
  // monta a estrutura padrão com um projeto qualquer e depois troca o cabeçalho para Everything
  const view = UI.view; UI.sel = 'project:' + (D.projects[0] || {id:'pj_bl'}).id; UI.view = 'dashboard';
  const _rv = rView; rView = () => {}; try { _rOperacoes(); } finally { rView = _rv; }
  UI.sel = 'all'; UI.view = view;
  const cab = $('.ops-cab');
  if (cab) cab.innerHTML = '<nav class="ops-trilha" aria-label="Breadcrumb"><button type="button" data-rc-tudo>Everything</button></nav>' +
    '<div class="ops-titulo"><div class="titulo-esq"><h1>Everything<small>tudo</small>' + I('Everything (visão de tudo): todos os itens de todos os clientes e projetos numa tela só, com as mesmas views, filtros e visões salvas') + '</h1></div></div>' +
    '<div class="views" role="tablist" aria-label="Views">' + disp.map(abaView).join('') + '</div>';
  $$('.ops-arvore .no-arv.escolhido').forEach(n => n.classList.remove('escolhido'));
  const arv = $('.ops-arvore [role="tree"]');
  if (arv) arv.insertAdjacentHTML('afterbegin', '<div class="no-arv rc-tudo escolhido" data-rc-tudo role="treeitem" aria-selected="true" style="padding-left:8px"><span class="seta"></span><span class="nome">Everything</span><span class="tipo">tudo</span></div>');
  rView();
}

/* ---------- linha do tempo com marcos e entregas de versão ---------- */
const _vTimeline = vTimeline;
vTimeline = function(){
  const ms = marcosDoEscopo(UI.sel).sort((a, b) => a.data.localeCompare(b.data));
  const pode = podeEditar() && UI.sel !== 'all';
  const itensDo = m => D.issues.filter(i => i.marco === m.id && !i.arquivado);
  const a = dAdd(HOJE, -14), b = dAdd(HOJE, 106), tot = (b - a) / 864e5, pos = d => Math.min(100, Math.max(0, ((parse(d) - a) / 864e5) / tot * 100));
  const faixa = '<div class="rc-marcos-faixa" aria-hidden="true"><div class="rc-mf-hoje" style="left:' + pos(iso(HOJE)) + '%"></div>' + ms.filter(m => parse(m.data) >= a && parse(m.data) <= b).map(m => '<span class="rc-diamante ' + m.tipo + (m.entregue ? ' entregue' : '') + '" style="left:' + pos(m.data) + '%" title="' + esc(m.nome + ' · ' + fmt(m.data)) + '"><i></i><b>' + esc(m.nome) + '</b></span>').join('') + '</div>';
  const tabela = '<h2 class="sub">Milestones e Releases' + I('Milestones (marcos: pontos importantes com data, como "Financeiro no ar") e Releases (entregas de versão: um pacote de mudanças que vai para o ar junto). Os itens ligados a cada um formam o progresso.') + '</h2>' +
    '<div class="topo-tela" style="margin-bottom:12px"><p class="intro" style="margin:0">Os próximos 120 dias na faixa, com hoje em vermelho.</p><div class="acoes">' + (pode ? '<button class="btn" type="button" data-rc-acao="marco-novo">' + ICO.mais + 'Novo marco</button>' : '') + '</div></div>' + faixa +
    '<div class="tabela-rolo"><table class="tabela"><thead><tr><th>Nome</th><th>Tipo</th><th>Data</th><th>Onde</th><th>Progresso</th><th>Cliente vê</th><th></th></tr></thead><tbody>' +
    (ms.length ? ms.map(m => { const its = itensDo(m), f = its.filter(i => i.status === 'done').length; const atr = !m.entregue && parse(m.data) < HOJE;
      return '<tr><th scope="row">' + esc(m.nome) + (m.desc ? '<div class="sec" style="font-family:var(--font-body);font-size:12px;font-weight:400">' + esc(m.desc) + '</div>' : '') + '</th><td>' + (m.tipo === 'release' ? 'Release' : 'Milestone') + '</td><td' + (atr ? ' class="atraso"' : '') + '>' + fmt(m.data) + (m.entregue ? '<div class="sec" style="font-size:11px">entregue em ' + fmt(m.entregue) + '</div>' : '') + '</td><td>' + esc(nomeDe(m.no)) + '</td>' +
        '<td>' + (its.length ? '<div class="progresso"><i style="width:' + (f / its.length * 100) + '%"></i></div><span class="sec" style="font-size:12px">' + f + ' de ' + its.length + ' itens</span>' : '<span class="sec" style="font-size:12px">Nenhum item ligado</span>') + '</td><td>' + (m.vis ? 'Sim' : 'Não') + '</td>' +
        '<td>' + (pode ? '<div class="acoes">' + (m.entregue ? '' : '<button class="btn sec peq" type="button" data-rc-marco-ok="' + m.id + '">Entregue</button>') + '<button class="btn fant peq" type="button" data-rc-marco-ed="' + m.id + '">Editar</button></div>' : '') + '</td></tr>'; }).join('') : '<tr><td colspan="7" class="sec">Nenhum marco ainda.</td></tr>') + '</tbody></table></div>';
  return _vTimeline() + tabela;
};
function formMarco(m){
  const m0 = m || {nome:'', tipo:'marco', data:iso(dAdd(HOJE, 30)), desc:'', vis:true, no:UI.sel};
  const onde = caminho(UI.sel).filter(p => !p[0].startsWith('client') && !p[0].startsWith('ws'));
  modal(m ? 'Editar ' + esc(m.nome) : 'Novo marco', '<div class="grade-form"><label class="lb largo">Nome<input class="campo" id="mc-n" value="' + esc(m0.nome) + '"></label><label class="lb">Tipo<select class="sel" id="mc-t"><option value="marco"' + (m0.tipo === 'marco' ? ' selected' : '') + '>Milestone (marco)</option><option value="release"' + (m0.tipo === 'release' ? ' selected' : '') + '>Release (entrega de versão)</option></select></label><label class="lb">Data<input class="campo" type="date" id="mc-d" value="' + esc(m0.data) + '"></label>' +
    '<label class="lb">Onde<select class="sel" id="mc-o">' + (onde.length ? onde : [[UI.sel, nomeDe(UI.sel)]]).map(([k, n]) => '<option value="' + k + '"' + (m0.no === k ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select></label><label class="lb">Cliente vê<select class="sel" id="mc-v"><option value="1"' + (m0.vis ? ' selected' : '') + '>Sim</option><option value="0"' + (!m0.vis ? ' selected' : '') + '>Não</option></select></label><label class="lb largo">Descrição<input class="campo" id="mc-ds" value="' + esc(m0.desc || '') + '"></label></div>',
    [m ? {txt:'Excluir', cls:'fant', acao:() => { D.marcos = D.marcos.filter(x => x.id !== m.id); D.issues.forEach(i => { if (i.marco === m.id) i.marco = null; }); salvar(); rView(); }} : null, {txt:'Cancelar', cls:'sec'}, {txt:'Salvar', acao:dl => { const n = $('#mc-n', dl).value.trim(); if (!n){ toast('Escreva o nome'); return false; }
      const alvo = m || {id:uid('mc'), entregue:null}; Object.assign(alvo, {nome:n, tipo:$('#mc-t', dl).value, data:$('#mc-d', dl).value, no:$('#mc-o', dl).value, vis:$('#mc-v', dl).value === '1', desc:$('#mc-ds', dl).value.trim()}); if (!m) D.marcos.push(alvo); salvar(); rView(); toast('Marco salvo'); }}].filter(Boolean));
}

/* ---------- calendário: marcos nos dias e esticar o bloco reservado (Resize) ---------- */
const _vCalendar = vCalendar;
vCalendar = function(){
  const ms = marcosDoEscopo(UI.sel);
  const ev = di => ms.filter(m => m.data === di).map(m => '<div class="ev marco rc-ev-' + m.tipo + '" title="' + esc((m.tipo === 'release' ? 'Release' : 'Milestone') + ': ' + m.nome) + '">◆ ' + esc(m.nome) + '</div>').join('');
  let h = _vCalendar();
  h = h.replace(/data-soltar-data="(\d{4}-\d{2}-\d{2})"><span class="dn">(\d+)<\/span>/g, (all, di) => all + ev(di));
  h = h.replace(/class="dia-todo" data-soltar-data="(\d{4}-\d{2}-\d{2})">/g, (all, di) => all + ev(di));
  h = h.replace('Clique num horário vazio para reservar um bloco.', 'Clique num horário vazio para reservar um bloco. Puxe a borda de baixo de um bloco para mudar a duração. ' + 'Resize' + I('Resize (esticar): puxe a borda de baixo do bloco reservado para ele durar mais ou menos. A reserva no calendário muda junto.') + '.');
  return h;
};
let puxando = null;
function ligarPuxadores(){
  if (!podeEditar()) return;
  $$('.bloco-abs[data-abrir-item]').forEach(b => {
    if ($('.rc-puxa', b)) return;
    const pux = document.createElement('span'); pux.className = 'rc-puxa'; pux.title = 'Arraste para mudar a duração'; b.appendChild(pux);
    pux.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      const i = byId('issues', b.dataset.abrirItem); if (!i || !i.bloco) return;
      puxando = {i, b, y0:e.clientY, h0:b.offsetHeight, moveu:false};
      pux.setPointerCapture(e.pointerId);
    });
    pux.addEventListener('pointermove', e => { if (!puxando) return; const dy = e.clientY - puxando.y0; if (Math.abs(dy) > 3) puxando.moveu = true; puxando.b.style.height = Math.max(18, puxando.h0 + dy) + 'px'; });
    pux.addEventListener('pointerup', e => {
      if (!puxando) return;
      const {i, b: bl, h0, y0, moveu} = puxando; puxando = null;
      if (!moveu) return;
      const [h1, m1] = i.bloco.ini.split(':').map(Number);
      const durMin = Math.max(15, Math.round(((h0 + 3) + (e.clientY - y0)) / 44 * 60 / 15) * 15);
      const fimMin = Math.min(23 * 60 + 45, h1 * 60 + m1 + durMin);
      i.bloco.fim = String(Math.floor(fimMin / 60)).padStart(2, '0') + ':' + String(fimMin % 60).padStart(2, '0');
      bl.dataset.rcSoltou = '1'; salvar(); toast('Bloco vai até ' + i.bloco.fim); setTimeout(rView, 0);
    });
  });
}
document.addEventListener('click', e => { const b = e.target.closest('[data-rc-soltou]'); if (b){ e.stopPropagation(); e.preventDefault(); delete b.dataset.rcSoltou; } if (e.target.closest('.rc-puxa')){ e.stopPropagation(); e.preventDefault(); } }, true);

/* ---------- quadro visual (Whiteboard) com cartões ligados a registros de verdade ---------- */
function quadroDe(chave){ return D.quadros[chave] || (D.quadros[chave] = {els:[]}); }
function infoRegistro(ref){
  const [t, id] = ref.split(':');
  if (t === 'issue'){ const i = byId('issues', id); return i ? {nome:i.titulo, sub:tipoNome(i.tipo) + ' · ' + stNome(i.status), pct: i.status === 'done' ? 100 : null, abrir:'data-abrir-item="' + i.id + '"', st:i.status} : null; }
  const nome = nomeDe(ref); if (!nome) return null;
  const its = issuesEm(ref), f = its.filter(i => i.status === 'done').length;
  return {nome, sub:({app:'Application', product:'Product', project:'Project', ws:'Workstream', client:'Client'}[t] || '') + ' · ' + f + ' de ' + its.length + ' itens', pct: its.length ? Math.round(f / its.length * 100) : 0, abrir:'data-no-ir="' + ref + '"'};
}
vWhiteboard = function(){
  const q = quadroDe(UI.sel), pode = podeEditar();
  const els = q.els.filter(e => e.tipo !== 'seta');
  const setas = q.els.filter(e => e.tipo === 'seta');
  const centro = id => { const e = els.find(x => x.id === id); return e ? [e.x + (e.w || 220) / 2, e.y + 50] : null; };
  const svg = '<svg class="qd-setas" aria-hidden="true"><defs><marker id="qd-ponta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>' + setas.map(s => { const a = centro(s.de), b = centro(s.para); return a && b ? '<line data-de="' + s.de + '" data-para="' + s.para + '" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '" marker-end="url(#qd-ponta)"/>' : ''; }).join('') + '</svg>';
  const html = els.map(e => {
    const inf = e.tipo === 'registro' ? infoRegistro(e.ref) : null;
    const base = '<div class="qd-el qd-' + e.tipo + (UI.qdLigar === e.id ? ' ligando' : '') + '" data-qd="' + e.id + '" style="left:' + e.x + 'px;top:' + e.y + 'px;width:' + (e.w || 220) + 'px">';
    const del = pode ? '<button class="qd-del" type="button" data-rc-qd-del="' + e.id + '" aria-label="Tirar do quadro">' + ICO.fechar + '</button>' : '';
    if (e.tipo === 'nota') return base + del + '<div class="qd-texto" data-rc-qd-texto="' + e.id + '"' + (pode ? ' contenteditable="true"' : '') + ' spellcheck="false">' + esc(e.texto || '') + '</div></div>';
    if (!inf) return base + del + '<div class="sec">Registro apagado</div></div>';
    return base + del + '<div class="qd-sub">' + esc(inf.sub) + '</div><button class="qd-nome" type="button" ' + inf.abrir + '>' + esc(inf.nome) + '</button>' + (inf.pct !== null ? '<div class="progresso"><i style="width:' + inf.pct + '%"></i></div>' : '') + '</div>';
  }).join('');
  return '<div class="topo-tela"><p class="intro" style="margin:0">O ' + T('Whiteboard','quadro visual livre') + ' de ' + esc(nomeDe(UI.sel)) + '. Os cartões de registro mostram o andamento de verdade e abrem o item ao clicar. Arraste para organizar.</p><div class="acoes">' +
    (pode ? '<button class="btn sec" type="button" data-rc-acao="qd-nota">' + ICO.mais + 'Nota</button><button class="btn sec" type="button" data-rc-acao="qd-registro">' + ICO.mais + 'Cartão de registro</button><button class="btn sec" type="button" data-rc-acao="qd-ligar"' + (UI.qdLigar ? ' aria-pressed="true"' : '') + '>' + (UI.qdLigar ? 'Escolha o segundo cartão' : 'Ligar dois cartões') + '</button>' : '') +
    '<a class="btn fant" href="https://claude.ai/artifact/GYBDTp5XrcAVbA5Z8Aqa88" target="_blank" rel="noopener">Abrir o canvas do BL</a></div></div>' +
    '<div class="qd-rolo"><div class="qd-area" data-quadro="' + esc(UI.sel) + '">' + svg + html + (els.length ? '' : '<p class="qd-vazio">Quadro vazio. Comece com uma nota ou um cartão de registro.</p>') + '</div></div>';
};
function ligarQuadro(){
  const area = $('.qd-area'); if (!area || !podeEditar()) return;
  const q = quadroDe(UI.sel);
  $$('.qd-el', area).forEach(el => {
    el.addEventListener('pointerdown', e => {
      if (e.target.closest('button,[contenteditable="true"]:focus')) return;
      if (UI.qdLigar){ e.preventDefault(); const id = el.dataset.qd;
        if (UI.qdLigar === true){ UI.qdLigar = id; rView(); return; }
        if (UI.qdLigar !== id){ q.els.push({id:uid('qs'), tipo:'seta', de:UI.qdLigar, para:id}); UI.qdLigar = null; salvar(); rView(); toast('Cartões ligados'); } return; }
      const d = q.els.find(x => x.id === el.dataset.qd); if (!d) return;
      const x0 = e.clientX, y0 = e.clientY, dx = d.x, dy = d.y; let moveu = false;
      const mv = ev => { const nx = Math.max(0, dx + ev.clientX - x0), ny = Math.max(0, dy + ev.clientY - y0); if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > 3) moveu = true; el.style.left = nx + 'px'; el.style.top = ny + 'px'; d.x = nx; d.y = ny; ajustarSetas(); };
      const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); if (moveu){ salvar(); rView(); } };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
    });
  });
  $$('[data-rc-qd-texto]', area).forEach(t => t.addEventListener('blur', () => { const d = q.els.find(x => x.id === t.dataset.rcQdTexto); if (d){ d.texto = t.textContent; salvar(); } }));
}
// a seta sai da borda de um cartão e termina na borda do outro, para a ponta ficar visível
function ajustarSetas(){
  const area = $('.qd-area'); if (!area) return;
  const caixa = id => { const el = $('.qd-el[data-qd="' + id + '"]', area); return el ? {x:el.offsetLeft, y:el.offsetTop, w:el.offsetWidth, h:el.offsetHeight} : null; };
  const borda = (c, px, py) => { const cx = c.x + c.w / 2, cy = c.y + c.h / 2, dx = px - cx, dy = py - cy; if (!dx && !dy) return [cx, cy]; const t = Math.min(Math.abs((c.w / 2 + 6) / (dx || 1e-9)), Math.abs((c.h / 2 + 6) / (dy || 1e-9))); return [cx + dx * t, cy + dy * t]; };
  $$('.qd-setas line[data-de]', area).forEach(l => { const a = caixa(l.dataset.de), b = caixa(l.dataset.para); if (!a || !b) return;
    const [x1, y1] = borda(a, b.x + b.w / 2, b.y + b.h / 2), [x2, y2] = borda(b, a.x + a.w / 2, a.y + a.h / 2);
    l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2); });
}
function novoCartaoRegistro(){
  const opcoes = [['', 'Escolha um registro']].concat(filhosDe(UI.sel).map(k => [k, nomeDe(k)])).concat(issuesEm(UI.sel).slice(0, 80).map(i => ['issue:' + i.id, tipoNome(i.tipo) + ' · ' + i.titulo]));
  modal('Cartão de registro', '<label class="lb">O que o cartão mostra<select class="sel" id="qd-r">' + opcoes.map(([v, n]) => '<option value="' + esc(v) + '">' + esc(n) + '</option>').join('') + '</select></label>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Pôr no quadro', acao:dl => { const r = $('#qd-r', dl).value; if (!r){ toast('Escolha um registro'); return false; } const q = quadroDe(UI.sel); const n = q.els.length; q.els.push({id:uid('qd'), tipo:'registro', ref:r, x:40 + (n % 4) * 250, y:40 + Math.floor(n / 4) * 140, w:220}); salvar(); rView(); }}]);
}

/* ---------- métricas de ritmo nos painéis: Throughput, Lead time, Cycle time, Burndown e Velocity ---------- */
function ritmoHTML(chave, lista){
  const semanas = Array.from({length:8}, (_, k) => { const fim = dAdd(HOJE, -7 * (7 - k)); const ini = dAdd(fim, -6); return {ini:iso(ini), fim:iso(fim)}; });
  const feitos = lista.filter(i => i.status === 'done' && i.feito);
  const porSem = semanas.map(s => feitos.filter(i => i.feito >= s.ini && i.feito <= s.fim).length);
  const max = Math.max(1, ...porSem);
  const rec = feitos.filter(i => i.feito >= iso(dAdd(HOJE, -28)));
  const dias = (a, b) => Math.max(0, (parse(b) - parse(a)) / 864e5);
  const lead = rec.length ? rec.reduce((s, i) => s + dias(i.criado || i.ini || i.feito, i.feito), 0) / rec.length : null;
  const cyc = rec.filter(i => i.iniciado); const cycle = cyc.length ? cyc.reduce((s, i) => s + dias(i.iniciado, i.feito), 0) / cyc.length : null;
  const pj = chave === 'all' ? null : cadeia(chave).project;
  const sp = pj && D.sprints.find(s => s.project === pj.id && s.status === 'ativo');
  const spIts = sp ? D.issues.filter(i => i.sprint === sp.id && !i.arquivado) : [];
  const stake = UI.verComo === 'stakeholder';
  return '<div class="pc-l3 rc-ritmo">' +
    '<div class="pc-c"><h3>Throughput' + I('Throughput (vazão): quantos itens o time concluiu em cada semana. Mostra se o ritmo está subindo, caindo ou estável.') + '<span>8 semanas</span></h3><div class="rc-barras">' +
      porSem.map((n, k) => '<div class="rc-bar" title="' + fmt(semanas[k].ini) + ' a ' + fmt(semanas[k].fim) + ': ' + n + ' concluídos"><i style="height:' + (n / max * 100) + '%"></i><b>' + n + '</b><span>' + fmt(semanas[k].fim).slice(0, 5) + '</span></div>').join('') + '</div></div>' +
    '<div class="pc-c"><h3>Tempos de entrega<span>últimos 28 dias</span></h3><div class="rc-tempos">' +
      '<div><b>' + (lead === null ? '–' : num(lead) + '<small> dias</small>') + '</b><span>Lead time' + I('Lead time (tempo total): de quando o item foi criado até ficar pronto, em média. É o tempo que o cliente espera.') + '</span></div>' +
      '<div><b>' + (cycle === null ? '–' : num(cycle) + '<small> dias</small>') + '</b><span>Cycle time' + I('Cycle time (tempo de execução): de quando alguém começou a fazer até ficar pronto, em média. Mostra quanto o trabalho em si demora.') + '</span></div>' +
      '<div><b>' + rec.length + '</b><span>itens concluídos</span></div></div></div>' +
    (sp && !stake ? '<div class="pc-c"><h3>Sprint ativo<span>' + esc(sp.nome.split('·')[0].trim()) + '</span></h3>' + queimaSVG(sp, spIts, 150) + '<p class="sec" style="margin:0;font-size:12px">Burndown' + I('Burndown (gráfico de queima): as horas que faltam no sprint caindo dia a dia. Se a linha real fica acima da ideal, o sprint está atrasado.') + ' · ' + spIts.filter(i => i.status === 'done').length + ' de ' + spIts.length + ' itens</p></div>'
      : '<div class="pc-c"><h3>Previsão<span>no ritmo atual</span></h3>' + (() => { const abertos = lista.filter(i => i.status !== 'done').length; const media = porSem.slice(-4).reduce((a, b) => a + b, 0) / 4; return media ? '<p style="margin:0;font-size:15px">Faltam <b>' + abertos + '</b> itens. No ritmo das últimas 4 semanas (' + num(media) + ' por semana), terminam em cerca de <b>' + Math.ceil(abertos / media) + ' semanas</b>.</p>' : '<p class="sec" style="margin:0">Ainda sem ritmo suficiente para prever.</p>'; })() + '</div>') +
  '</div>';
}
const _painelCards = painelCards;
painelCards = function(chave, lista, filhos, opts){ return _painelCards(chave, lista, filhos, opts) + ritmoHTML(chave, lista); };

/* ---------- Overview: por tipo de serviço, tempo real comparado com o Catalog ---------- */
const _rOverview = rOverview;
rOverview = function(){
  _rOverview();
  if (UI.verComo === 'stakeholder') return;
  const el = $('#m-overview'); if (!el) return;
  const servs = [...new Set(D.apps.map(a => a.servico).filter(Boolean))].map(id => byId('catalog', id)).filter(Boolean);
  if (!servs.length) return;
  const filtro = UI.ovServ || '';
  const horasReais = i => (i.tempo || []).reduce((s, t) => s + ((t.fim || Date.now()) - t.ini) / 36e5, 0);
  const linhas = servs.filter(s => !filtro || s.id === filtro).map(s => {
    const apps = D.apps.filter(a => a.servico === s.id);
    const its = D.issues.filter(i => !i.arquivado && apps.some(a => a.id === (appDe(i) || {}).id));
    const est = its.reduce((a, i) => a + (+i.est || 0), 0), real = its.reduce((a, i) => a + horasReais(i), 0), feitas = its.filter(i => i.status === 'done').reduce((a, i) => a + (+i.est || 0), 0);
    const [hmin, hmax] = s.horas || [0, 0]; const fmin = hmin * apps.length, fmax = hmax * apps.length;
    const sit = !fmax ? 'Sem faixa no Catalog' : est > fmax ? 'Acima do Catalog' : est < fmin ? 'Abaixo do Catalog' : 'Dentro do Catalog';
    return {s, apps, its, est, real, feitas, fmin, fmax, sit};
  });
  const maxH = Math.max(1, ...linhas.map(l => Math.max(l.est, l.fmax)));
  const html = '<div class="pc-c rc-servicos" style="margin-top:16px"><h3>Por tipo de serviço' + I('Por tipo de serviço: as aplicações agrupadas pelo serviço do Catalog. Compara as horas estimadas nos itens com a faixa de esforço que o Catalog prevê para aquele serviço.') + '<span>' + servs.length + ' serviços</span></h3>' +
    '<div class="rc-chips" role="group" aria-label="Filtrar por serviço"><button type="button" class="filtro-rap" data-rc-ovserv="" aria-pressed="' + !filtro + '">Todos</button>' + servs.map(s => '<button type="button" class="filtro-rap" data-rc-ovserv="' + s.id + '" aria-pressed="' + (filtro === s.id) + '">' + esc(s.nome) + '</button>').join('') + '</div>' +
    '<div class="tabela-rolo"><table class="tabela"><colgroup><col style="width:22%"><col style="width:9%"><col style="width:9%"><col style="width:32%"><col style="width:10%"><col style="width:18%"></colgroup><thead><tr><th>Serviço</th><th>Aplicações</th><th>Itens abertos</th><th>Estimado nos itens × faixa do Catalog</th><th>Gasto real' + I('Gasto real: as horas registradas no cronômetro dos itens. Fica mais preciso conforme o time usa o Time tracking.') + '</th><th>Situação</th></tr></thead><tbody>' +
    linhas.map(l => '<tr><th scope="row">' + esc(l.s.nome) + '</th><td>' + l.apps.length + '</td><td>' + l.its.filter(i => i.status !== 'done').length + '</td>' +
      '<td><div class="rc-faixa" title="Estimado: ' + num(l.est) + 'h · Catalog: ' + num(l.fmin) + ' a ' + num(l.fmax) + 'h"><span class="rc-faixa-cat" style="left:' + (l.fmin / maxH * 100) + '%;width:' + (Math.max(0.5, (l.fmax - l.fmin) / maxH * 100)) + '%"></span><span class="rc-faixa-est" style="width:' + (l.est / maxH * 100) + '%"></span><span class="rc-faixa-feito" style="width:' + (l.feitas / maxH * 100) + '%"></span></div><span class="sec" style="font-size:12px">' + num(l.est) + 'h estimadas · ' + num(l.feitas) + 'h concluídas · Catalog ' + num(l.fmin) + ' a ' + num(l.fmax) + 'h</span></td>' +
      '<td>' + num(l.real) + 'h</td><td>' + (l.sit === 'Acima do Catalog' ? '<span class="rc-sit alerta">' : '<span class="rc-sit">') + esc(l.sit) + '</span></td></tr>').join('') + '</tbody></table></div>' +
    '<div class="legenda"><span><i style="background:var(--nevoa)"></i>Faixa do Catalog</span><span><i style="background:var(--grafite)"></i>Estimado</span><span><i style="background:var(--st-done)"></i>Concluído</span></div></div>';
  const alvo = $$('#m-overview .pc-l4').pop() || $$('#m-overview .pc-l3').pop();
  if (alvo) alvo.insertAdjacentHTML('afterend', html);
};

/* ---------- Settings: status personalizados, campos personalizados e automações ---------- */
const nosDeProjeto = () => D.projects.map(p => ['project:' + p.id, p.nome]).concat(D.products.map(p => ['product:' + p.id, byId('projects', p.project).nome + ' › ' + p.nome])).concat(D.apps.map(a => ['app:' + a.id, (byId('projects', a.project) || {nome:''}).nome + ' › ' + a.nome]));
const _rConfig = rConfig;
rConfig = function(){
  _rConfig();
  const el = $('#m-configuracoes'); if (!el) return;
  const m = souMaster();
  const pessoaNome = id => (pessoa(id) || {nome:'-'}).nome;
  const descAuto = a => { const c = a.cond || {}, p = a.param || {}; return [c.tipo ? 'tipo ' + tipoNome(c.tipo) : '', c.grupo ? 'status no grupo ' + GRUPO_NOME[c.grupo] : '', c.prio ? 'prioridade ' + prioNome(c.prio) : ''].filter(Boolean).join(' e ') || 'qualquer item'; };
  const descAcao = a => { const p = a.param || {}; return ({notificar:'Avisar ' + (p.pessoa ? pessoaNome(p.pessoa) : p.para === 'relator' ? 'quem abriu' : 'o responsável'), comentar:'Comentar: "' + (p.texto || '') + '"', mudar_prioridade:'Prioridade vira ' + prioNome(p.prio || 'high'), atribuir:'Passar para ' + pessoaNome(p.pessoa), mudar_status:'Status vira ' + ((D.statusCustom.find(x => x.id === p.status) || {}).nome || stNome(p.status)), marcar_visivel:'Deixar visível ao cliente'})[a.acao] || a.acao; };
  const html =
    '<h2 class="sub">Custom statuses' + I('Custom statuses (status personalizados): colunas novas do Board para um projeto, como "Aguardando cliente". Cada uma pertence a um grupo do fluxo, e os painéis somam pelo grupo.') + '</h2>' +
    '<div class="tabela-rolo"><table class="tabela"><thead><tr><th style="width:28%">Status</th><th>Grupo do fluxo</th><th>Vale em</th><th>Itens agora</th><th></th></tr></thead><tbody>' +
      (D.statusCustom.length ? D.statusCustom.map(c => '<tr><th scope="row"><span class="st st-custom"><i style="background:' + esc(c.cor) + '"></i>' + esc(c.nome) + '</span></th><td>' + GRUPO_NOME[c.grupo] + '</td><td>' + esc(nomeDe(c.no)) + '</td><td>' + D.issues.filter(i => i.st === c.id && !i.arquivado).length + '</td><td>' + (m ? '<button class="btn fant peq" type="button" data-rc-cs-del="' + c.id + '">Excluir</button>' : '') + '</td></tr>').join('') : '<tr><td colspan="5" class="sec">Nenhum status personalizado.</td></tr>') +
    '</tbody></table></div>' + (m ? '<div class="acoes" style="margin-top:10px"><button class="btn sec" type="button" data-rc-acao="cs-novo">' + ICO.mais + 'Novo status</button></div>' : '') +
    '<h2 class="sub">Custom fields dos itens' + I('Custom fields (campos personalizados): informações extras que aparecem no item aberto, como "Ambiente" ou "Cliente final". Valem para o nível escolhido e tudo abaixo dele.') + '</h2>' +
    '<div class="tabela-rolo"><table class="tabela"><thead><tr><th style="width:28%">Campo</th><th>Tipo</th><th>Opções</th><th>Vale em</th><th></th></tr></thead><tbody>' +
      (D.camposItem.length ? D.camposItem.map(c => '<tr><th scope="row">' + esc(c.nome) + '</th><td>' + ({texto:'Texto', numero:'Número', data:'Data', lista:'Lista', sim_nao:'Sim ou não', dinheiro:'Dinheiro'})[c.tipo] + '</td><td class="sec">' + esc((c.opcoes || []).join(', ')) + '</td><td>' + esc(nomeDe(c.no)) + '</td><td>' + (m ? '<button class="btn fant peq" type="button" data-rc-cf-del="' + c.id + '">Excluir</button>' : '') + '</td></tr>').join('') : '<tr><td colspan="5" class="sec">Nenhum campo personalizado.</td></tr>') +
    '</tbody></table></div>' + (m ? '<div class="acoes" style="margin-top:10px"><button class="btn sec" type="button" data-rc-acao="cf-novo">' + ICO.mais + 'Novo campo</button></div>' : '') +
    '<h2 class="sub">Automations' + I('Automations (automações): regras do tipo "quando acontecer X, faça Y", que rodam sozinhas. Por exemplo: quando um bug for concluído, avisar quem abriu.') + '</h2>' +
    '<div class="tabela-rolo"><table class="tabela"><colgroup><col style="width:22%"><col style="width:18%"><col style="width:20%"><col style="width:20%"><col style="width:10%"><col style="width:10%"></colgroup><thead><tr><th>Nome</th><th>Quando</th><th>Se</th><th>Faça</th><th>Vale em</th><th></th></tr></thead><tbody>' +
      (D.automacoes.length ? D.automacoes.map(a => '<tr' + (a.ativa ? '' : ' class="apagada"') + '><th scope="row">' + esc(a.nome) + '</th><td>' + esc((GATILHOS.find(g => g[0] === a.gatilho) || ['', a.gatilho])[1]) + '</td><td>' + esc(descAuto(a)) + '</td><td>' + esc(descAcao(a)) + '</td><td>' + esc(nomeDe(a.no)) + '</td><td>' + (m ? '<div class="acoes"><label class="rc-liga"><input type="checkbox" data-rc-auto-liga="' + a.id + '"' + (a.ativa ? ' checked' : '') + '> ' + (a.ativa ? 'Ligada' : 'Desligada') + '</label><button class="btn fant peq" type="button" data-rc-auto-del="' + a.id + '">Excluir</button></div>' : (a.ativa ? 'Ligada' : 'Desligada')) + '</td></tr>').join('') : '<tr><td colspan="6" class="sec">Nenhuma automação.</td></tr>') +
    '</tbody></table></div>' + (m ? '<div class="acoes" style="margin-top:10px"><button class="btn sec" type="button" data-rc-acao="auto-nova">' + ICO.mais + 'Nova automação</button></div>' : '') +
    '<h2 class="sub">Registro das automações</h2>' +
    (D.autoLog.length ? '<div class="tabela-rolo"><table class="tabela"><thead><tr><th style="width:18%">Quando</th><th>Automação</th><th>Item</th><th>Resultado</th></tr></thead><tbody>' + D.autoLog.slice(0, 20).map(r => { const a = D.automacoes.find(x => x.id === r.auto), i = byId('issues', r.item); return '<tr><td>' + new Date(r.quando).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) + '</td><td>' + esc(a ? a.nome : 'Automação apagada') + '</td><td>' + (i ? '<button class="btn fant peq" type="button" data-abrir-item="' + i.id + '">' + esc(i.titulo) + '</button>' : '-') + '</td><td>' + (r.ok ? 'Feito' : 'Não rodou: ' + esc(r.det || '')) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="sec" style="font-size:13px">Nenhuma automação rodou ainda.</p>');
  const alvo = $$('#m-configuracoes h2.sub').find(h => h.textContent.startsWith('Dados deste protótipo'));
  if (alvo) alvo.insertAdjacentHTML('beforebegin', html); else el.insertAdjacentHTML('beforeend', html);
};
function novoStatus(){
  modal('Novo status', '<div class="grade-form"><label class="lb largo">Nome<input class="campo" id="cs-n" placeholder="Ex.: Aguardando cliente"></label><label class="lb">Grupo do fluxo<select class="sel" id="cs-g">' + Object.keys(GRUPO_NOME).map(k => '<option value="' + k + '">' + GRUPO_NOME[k] + '</option>').join('') + '</select></label><label class="lb">Cor<input class="campo" type="color" id="cs-c" value="#B04A00"></label><label class="lb largo">Vale em<select class="sel" id="cs-o">' + nosDeProjeto().map(([k, n]) => '<option value="' + k + '">' + esc(n) + '</option>').join('') + '</select></label></div>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Criar status', acao:dl => { const n = $('#cs-n', dl).value.trim(); if (!n){ toast('Escreva o nome'); return false; } D.statusCustom.push({id:uid('cs'), no:$('#cs-o', dl).value, nome:n, cor:$('#cs-c', dl).value, grupo:$('#cs-g', dl).value}); salvar(); rConfig(); toast('Status criado. Ele já aparece no Board.'); }}]);
}
function novoCampo(){
  modal('Novo campo dos itens', '<div class="grade-form"><label class="lb largo">Nome<input class="campo" id="cf-n" placeholder="Ex.: Ambiente"></label><label class="lb">Tipo<select class="sel" id="cf-t"><option value="texto">Texto</option><option value="numero">Número</option><option value="dinheiro">Dinheiro</option><option value="data">Data</option><option value="lista">Lista de opções</option><option value="sim_nao">Sim ou não</option></select></label><label class="lb">Opções (para lista, separadas por vírgula)<input class="campo" id="cf-op" placeholder="Teste, Produção"></label><label class="lb largo">Vale em<select class="sel" id="cf-o">' + nosDeProjeto().map(([k, n]) => '<option value="' + k + '">' + esc(n) + '</option>').join('') + '</select></label></div>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Criar campo', acao:dl => { const n = $('#cf-n', dl).value.trim(), t = $('#cf-t', dl).value; const op = $('#cf-op', dl).value.split(',').map(x => x.trim()).filter(Boolean);
      if (!n){ toast('Escreva o nome'); return false; } if (t === 'lista' && !op.length){ toast('Uma lista precisa de opções'); return false; }
      D.camposItem.push({id:uid('cf'), no:$('#cf-o', dl).value, nome:n, tipo:t, opcoes:t === 'lista' ? op : []}); salvar(); rConfig(); toast('Campo criado. Ele aparece no item aberto.'); }}]);
}
function novaAutomacao(){
  const equipe = D.people.filter(p => p.acesso !== 'stakeholder');
  modal('Nova automação', '<div class="grade-form"><label class="lb largo">Nome<input class="campo" id="au-n" placeholder="Ex.: Bug concluído avisa quem abriu"></label>' +
    '<label class="lb">Vale em<select class="sel" id="au-o">' + nosDeProjeto().map(([k, n]) => '<option value="' + k + '">' + esc(n) + '</option>').join('') + '</select></label>' +
    '<label class="lb">Quando<select class="sel" id="au-g">' + GATILHOS.map(([k, n]) => '<option value="' + k + '">' + n + '</option>').join('') + '</select></label>' +
    '<label class="lb">Se o tipo for<select class="sel" id="au-ct"><option value="">Qualquer tipo</option>' + TIPOS.map(t => '<option value="' + t.id + '">' + t.nome + '</option>').join('') + '</select></label>' +
    '<label class="lb">E o status estiver em<select class="sel" id="au-cg"><option value="">Qualquer status</option>' + Object.keys(GRUPO_NOME).map(k => '<option value="' + k + '">' + GRUPO_NOME[k] + '</option>').join('') + '</select></label>' +
    '<label class="lb">Faça<select class="sel" id="au-a">' + ACOES.map(([k, n]) => '<option value="' + k + '">' + n + '</option>').join('') + '</select></label>' +
    '<label class="lb">Pessoa (avisar ou passar para)<select class="sel" id="au-pp"><option value="">O responsável do item</option><option value="relator">Quem abriu o item</option>' + equipe.map(p => '<option value="' + p.id + '">' + esc(p.nome) + '</option>').join('') + '</select></label>' +
    '<label class="lb">Prioridade (para mudar a prioridade)<select class="sel" id="au-pr">' + PRIOS.map(p => '<option value="' + p.id + '">' + p.nome + '</option>').join('') + '</select></label>' +
    '<label class="lb">Status (para mudar o status)<select class="sel" id="au-st">' + STATUS.map(s => '<option value="' + s.id + '">' + s.nome + '</option>').join('') + D.statusCustom.map(c => '<option value="' + c.id + '">' + esc(c.nome) + '</option>').join('') + '</select></label>' +
    '<label class="lb largo">Texto (título do aviso ou comentário)<input class="campo" id="au-tx"></label></div>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Criar automação', acao:dl => { const n = $('#au-n', dl).value.trim(); if (!n){ toast('Escreva o nome'); return false; }
      const pp = $('#au-pp', dl).value, ac = $('#au-a', dl).value, tx = $('#au-tx', dl).value.trim();
      const param = {notificar:{pessoa: pp && pp !== 'relator' ? pp : null, para: pp === 'relator' ? 'relator' : 'responsavel', titulo:tx || n}, comentar:{texto:tx || n}, mudar_prioridade:{prio:$('#au-pr', dl).value}, atribuir:{pessoa: pp && pp !== 'relator' ? pp : null}, mudar_status:{status:$('#au-st', dl).value}, marcar_visivel:{}}[ac];
      if (ac === 'atribuir' && !param.pessoa){ toast('Escolha a pessoa'); return false; }
      D.automacoes.push({id:uid('au'), no:$('#au-o', dl).value, nome:n, gatilho:$('#au-g', dl).value, cond:{tipo:$('#au-ct', dl).value || undefined, grupo:$('#au-cg', dl).value || undefined}, acao:ac, param, ativa:true}); salvar(); rConfig(); toast('Automação criada e ligada'); }}]);
}

/* ---------- etapas: itens a mais quando o código é de terceiros ---------- */
function temTerceiros(chave){ const [t, id] = chave.split(':'); if (t === 'app') return (byId('apps', id) || {}).origemCodigo === 'terceiros'; if (t === 'project') return D.apps.some(a => a.project === id && a.origemCodigo === 'terceiros'); return false; }
const _vStages = vStages;
vStages = function(){
  const orig = D.template, terc = temTerceiros(UI.sel);
  D.template = orig.map(et => Object.assign({}, et, {itens: et.itens.filter(it => !it.terceiros || terc)}));
  try { let h = _vStages(); if (terc) h = h.replace('<p class="intro">', '<p class="intro"><b>Código de terceiros:</b> o Discovery ganhou itens a mais para entender o sistema de outra empresa antes de mexer. '); return h; }
  finally { D.template = orig; }
};

/* ---------- SLA: prazo combinado por gravidade, no cadastro do cliente ---------- */
const GRAV_CHAVE = {'Sistema parado':'parado', 'Função quebrada':'quebrada', 'Incômodo':'incomodo', 'Cosmético':'cosmetico'};
const SLA_PADRAO = {parado:[1, 8], quebrada:[4, 24], incomodo:[8, 72], cosmetico:[24, 168]};
function slaDoPedido(r){
  const cl = byId('clients', r.cliente) || {}; const sla = (cl.sla || {})[GRAV_CHAVE[r.grav] || 'incomodo']; if (!sla) return null;
  const criado = (parse(r.quando) || HOJE).getTime() + 9 * 36e5;
  const resp = criado + sla[0] * 36e5, sol = criado + sla[1] * 36e5, agora = Date.now();
  const fechado = /Resolvido|Recusado/.test(r.status);
  let sit, cls;
  if (fechado){ sit = 'Resolvido'; cls = 'ok'; }
  else if (agora > sol){ sit = 'SLA estourado'; cls = 'estourado'; }
  else if (!r.respondido && agora > resp){ sit = 'Resposta atrasada'; cls = 'estourado'; }
  else if (agora > criado + sla[1] * 36e5 * 0.8){ sit = 'Perto do limite'; cls = 'perto'; }
  else { sit = 'No prazo'; cls = 'ok'; }
  return {sla, resp, sol, sit, cls};
}
const _formCliente = formCliente;
formCliente = function(c){
  const s = (c && c.sla) || SLA_PADRAO;
  return _formCliente(c) + '<div class="bloco-g"><h4>SLA' + I('SLA (prazo combinado): o tempo máximo para a IT.IA responder e resolver um pedido deste cliente, por gravidade. O Service Desk avisa quando um pedido passa do prazo.') + '</h4><div class="tabela-rolo"><table class="tabela"><thead><tr><th>Gravidade</th><th>Responder em (horas)</th><th>Resolver em (horas)</th></tr></thead><tbody>' +
    [['parado','Sistema parado'],['quebrada','Função quebrada'],['incomodo','Incômodo'],['cosmetico','Cosmético']].map(([k, n]) => '<tr><th scope="row">' + n + '</th><td><input class="campo peq" type="number" min="0" step="0.5" data-rc-sla="' + k + '|0" value="' + (s[k] || SLA_PADRAO[k])[0] + '"></td><td><input class="campo peq" type="number" min="0" step="0.5" data-rc-sla="' + k + '|1" value="' + (s[k] || SLA_PADRAO[k])[1] + '"></td></tr>').join('') + '</tbody></table></div></div>';
};
const _salvarCliente = salvarCliente;
salvarCliente = function(dlg, c){
  const antes = new Set(D.clients.map(x => x.id));
  const r = _salvarCliente(dlg, c); if (r === false) return false;
  const alvo = c || D.clients.find(x => !antes.has(x.id)); if (!alvo) return r;
  const sla = {}; $$('[data-rc-sla]', dlg).forEach(inp => { const [k, ix] = inp.dataset.rcSla.split('|'); sla[k] = sla[k] || [0, 0]; sla[k][+ix] = +inp.value || 0; });
  Object.keys(sla).forEach(k => { if (sla[k][1] < sla[k][0]) sla[k][1] = sla[k][0]; });
  alvo.sla = sla; salvar(); return r;
};

/* ---------- Service Desk: SLA na lista e no detalhe, print com anotação e gravação de tela ---------- */
const _rServiceDesk = rServiceDesk;
rServiceDesk = function(){
  _rServiceDesk();
  $$('#m-servicedesk [data-ped]').forEach(el => { const r = byId('requests', el.dataset.ped); const s = r && slaDoPedido(r); const l2 = $('.sd-l2', el); if (s && l2) l2.insertAdjacentHTML('beforeend', '<span class="rc-sla ' + s.cls + '">' + esc(s.sit) + '</span>'); });
  const r = byId('requests', UI.pedSel) || (() => { const p = $('#m-servicedesk .sd-item.escolhido'); return p && byId('requests', p.dataset.ped); })();
  const props = $('#m-servicedesk .sd-props');
  if (r && props){ const s = slaDoPedido(r); const dt = t => new Date(t).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
    if (s) props.insertAdjacentHTML('beforeend', '<div class="sd-prop largo"><span>SLA' + I('SLA (prazo combinado): o tempo máximo para responder e resolver este pedido, conforme a gravidade e o combinado com o cliente.') + '</span><b style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="rc-sla ' + s.cls + '">' + esc(s.sit) + '</span><span class="sec" style="font-weight:400;font-size:13px">Responder até ' + dt(s.resp) + (r.respondido ? ' (respondido ' + dt(r.respondido) + ')' : '') + ' · Resolver até ' + dt(s.sol) + '</span></b></div>'); }
  const refs = r && $$('#m-servicedesk .sd-det .g-sec').find(x => x.textContent.startsWith('References'));
  if (refs && UI.verComo !== 'dev') refs.insertAdjacentHTML('beforeend', '<div class="acoes rc-capturas"><button class="btn sec peq" type="button" data-rc-acao="print-anotado" data-rc-req="' + r.id + '">Print com anotação</button>' + I('Screenshot com anotação (print com setas e marcações): escolha uma imagem ou capture a tela, marque o problema com setas, caixas ou traço, e anexe no pedido.') +
    '<button class="btn sec peq" type="button" data-rc-acao="gravar-tela" data-rc-req="' + r.id + '">' + (gravacao ? 'Parar gravação' : 'Gravar a tela') + '</button>' + I('Screen recording (gravação da tela): grava a tela mostrando o problema acontecendo. Ao parar, o vídeo entra como referência do pedido.') + '</div>');
};
function lerImagem(arquivo){ return new Promise((ok, erro) => { const fr = new FileReader(); fr.onload = () => { const im = new Image(); im.onload = () => ok(im); im.onerror = erro; im.src = fr.result; }; fr.onerror = erro; fr.readAsDataURL(arquivo); }); }
async function capturarTelaImagem(){
  const st = await navigator.mediaDevices.getDisplayMedia({video:true});
  const v = document.createElement('video'); v.srcObject = st; v.muted = true; await v.play(); await new Promise(r => setTimeout(r, 300));
  const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0);
  st.getTracks().forEach(t => t.stop());
  const im = new Image(); im.src = c.toDataURL('image/png'); await new Promise(r => { im.onload = r; }); return im;
}
function anotador(reqId){
  let ferramenta = 'seta', img = null, marcas = [], atual = null;
  const dl = modal('Print com anotação', '<div class="rc-anot"><div class="acoes"><label class="btn sec peq" style="cursor:pointer">Escolher imagem<input type="file" accept="image/*" id="an-arq" hidden></label><button class="btn sec peq" type="button" id="an-cap">Capturar a tela</button><span class="espaco"></span>' +
    '<div class="seg" role="group" aria-label="Ferramenta">' + [['seta','Seta'],['caixa','Caixa'],['traco','Traço']].map(([k, n]) => '<button type="button" data-an-f="' + k + '" aria-pressed="' + (k === 'seta') + '">' + n + '</button>').join('') + '</div><button class="btn fant peq" type="button" id="an-desf">Desfazer</button></div>' +
    '<canvas id="an-tela" width="960" height="540" aria-label="Área de anotação"></canvas><p class="sec" style="margin:0;font-size:12px">Escolha ou capture a imagem e desenhe em cima para marcar o problema.</p></div>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Anexar no pedido', acao:d => { if (!img){ toast('Escolha ou capture uma imagem'); return false; } desenhar(); const tela = $('#an-tela', d);
      let url = tela.toDataURL('image/jpeg', 0.82); if (url.length > 800000){ const c2 = document.createElement('canvas'); const f = Math.sqrt(800000 / url.length); c2.width = tela.width * f; c2.height = tela.height * f; c2.getContext('2d').drawImage(tela, 0, 0, c2.width, c2.height); url = c2.toDataURL('image/jpeg', 0.8); }
      const r = byId('requests', reqId); r.anexos = r.anexos || []; r.anexos.push({nome:'print-anotado-' + new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '') + '.jpg', tipo:'imagem', url, tam:Math.round(url.length * 0.75)}); salvar(); rServiceDesk(); toast('Print anotado anexado'); }}]);
  const tela = $('#an-tela', dl), ctx = tela.getContext('2d');
  function desenhar(){
    ctx.fillStyle = '#F4F4F5'; ctx.fillRect(0, 0, tela.width, tela.height);
    if (img) ctx.drawImage(img, 0, 0, tela.width, tela.height);
    ctx.strokeStyle = '#FF0000'; ctx.fillStyle = '#FF0000'; ctx.lineWidth = Math.max(3, tela.width / 320); ctx.lineCap = 'round';
    marcas.concat(atual ? [atual] : []).forEach(m => {
      if (m.f === 'caixa'){ ctx.strokeRect(m.x0, m.y0, m.x1 - m.x0, m.y1 - m.y0); }
      else if (m.f === 'seta'){ ctx.beginPath(); ctx.moveTo(m.x0, m.y0); ctx.lineTo(m.x1, m.y1); ctx.stroke(); const a = Math.atan2(m.y1 - m.y0, m.x1 - m.x0), t = ctx.lineWidth * 5; ctx.beginPath(); ctx.moveTo(m.x1, m.y1); ctx.lineTo(m.x1 - t * Math.cos(a - 0.45), m.y1 - t * Math.sin(a - 0.45)); ctx.lineTo(m.x1 - t * Math.cos(a + 0.45), m.y1 - t * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill(); }
      else { ctx.beginPath(); m.pts.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); }
    });
  }
  const ajustar = im => { img = im; const r = im.width / im.height; tela.width = Math.min(1600, im.width); tela.height = Math.round(tela.width / r); marcas = []; desenhar(); };
  desenhar();
  $('#an-arq', dl).addEventListener('change', e => { const f = e.target.files[0]; if (f) lerImagem(f).then(ajustar).catch(() => toast('Não consegui abrir essa imagem')); });
  $('#an-cap', dl).addEventListener('click', () => capturarTelaImagem().then(ajustar).catch(() => toast('O navegador não liberou a captura de tela aqui. Use "Escolher imagem".')));
  $$('[data-an-f]', dl).forEach(b => b.addEventListener('click', () => { ferramenta = b.dataset.anF; $$('[data-an-f]', dl).forEach(x => x.setAttribute('aria-pressed', String(x === b))); }));
  $('#an-desf', dl).addEventListener('click', () => { marcas.pop(); desenhar(); });
  const pt = e => { const r = tela.getBoundingClientRect(); return [(e.clientX - r.left) * tela.width / r.width, (e.clientY - r.top) * tela.height / r.height]; };
  tela.addEventListener('pointerdown', e => { if (!img) return; const [x, y] = pt(e); atual = {f:ferramenta, x0:x, y0:y, x1:x, y1:y, pts:[[x, y]]}; tela.setPointerCapture(e.pointerId); });
  tela.addEventListener('pointermove', e => { if (!atual) return; const [x, y] = pt(e); atual.x1 = x; atual.y1 = y; atual.pts.push([x, y]); desenhar(); });
  tela.addEventListener('pointerup', () => { if (atual){ marcas.push(atual); atual = null; desenhar(); } });
}
let gravacao = null;
async function alternarGravacao(reqId){
  if (gravacao){ gravacao.rec.stop(); return; }
  try {
    const st = await navigator.mediaDevices.getDisplayMedia({video:{frameRate:12}, audio:false});
    const tipo = ['video/webm;codecs=vp9', 'video/webm'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
    const rec = new MediaRecorder(st, tipo ? {mimeType:tipo, videoBitsPerSecond:400000} : undefined); const partes = [];
    rec.ondataavailable = e => { if (e.data.size) partes.push(e.data); };
    rec.onstop = () => { st.getTracks().forEach(t => t.stop()); const blob = new Blob(partes, {type:'video/webm'}); gravacao = null;
      const r = byId('requests', reqId); r.anexos = r.anexos || []; const nome = 'gravacao-tela-' + new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '') + '.webm';
      if (blob.size <= 1500000){ const fr = new FileReader(); fr.onload = () => { r.anexos.push({nome, tipo:'vídeo', url:fr.result, tam:blob.size}); salvar(); rServiceDesk(); toast('Gravação anexada'); }; fr.readAsDataURL(blob); }
      else { r.anexos.push({nome, tipo:'vídeo', tam:blob.size, grande:true}); salvar(); rServiceDesk(); toast('Gravação grande: guardado só o nome até o banco ser ligado'); } };
    st.getVideoTracks()[0].addEventListener('ended', () => { if (rec.state !== 'inactive') rec.stop(); });
    rec.start(1000); gravacao = {rec}; rServiceDesk(); toast('Gravando a tela. Clique em "Parar gravação" quando terminar.');
  } catch (e){ gravacao = null; toast('O navegador não liberou a gravação de tela aqui.'); }
}

/* ---------- cliques, mudanças e formulários dos recursos novos ---------- */
document.addEventListener('click', e => {
  const q = s => e.target.closest(s);
  let x;
  if ((x = q('[data-rc-tudo]'))){ UI.sel = 'all'; salvarUI(); rOperacoes(); return; }
  if ((x = q('[data-rc-lida]'))){ const n = D.notifs.find(z => z.id === x.dataset.rcLida); if (n){ n.lida = true; salvar(); atualizarSino(); } const dlg = x.closest('dialog'); if (dlg){ dlg.close(); dlg.remove(); } }
  if ((x = q('[data-rc-sino]'))){ abrirNotificacoes(); return; }
  if ((x = q('[data-rc-vista-del]'))){ D.vistas = D.vistas.filter(v => v.id !== x.dataset.rcVistaDel); salvar(); const li = x.closest('li'); if (li) li.remove(); rView(); return; }
  if ((x = q('[data-rc-sprint-ini]'))){ const sp = D.sprints.find(s => s.id === x.dataset.rcSprintIni); const at = D.sprints.find(s => s.project === sp.project && s.status === 'ativo'); if (at){ toast('Encerre antes o sprint "' + at.nome + '"'); return; } sp.status = 'ativo'; UI.spPlan = sp.id; salvar(); rView(); toast('Sprint iniciado'); return; }
  if ((x = q('[data-rc-sprint-fim]'))){ encerrarSprint(x.dataset.rcSprintFim); return; }
  if ((x = q('[data-rc-sprint-plan]'))){ UI.spPlan = x.dataset.rcSprintPlan; salvarUI(); rView(); return; }
  if ((x = q('[data-rc-sprint-por]'))){ const i = byId('issues', x.dataset.rcSprintPor); i.sprint = x.dataset.sp; salvar(); rView(); return; }
  if ((x = q('[data-rc-sprint-tirar]'))){ const i = byId('issues', x.dataset.rcSprintTirar); i.sprint = null; salvar(); rView(); return; }
  if ((x = q('[data-rc-marco-ok]'))){ const m = D.marcos.find(z => z.id === x.dataset.rcMarcoOk); m.entregue = iso(HOJE); salvar(); rView(); toast('Marco entregue'); return; }
  if ((x = q('[data-rc-marco-ed]'))){ formMarco(D.marcos.find(z => z.id === x.dataset.rcMarcoEd)); return; }
  if ((x = q('[data-rc-qd-del]'))){ const qd = quadroDe(UI.sel); const id = x.dataset.rcQdDel; qd.els = qd.els.filter(z => z.id !== id && z.de !== id && z.para !== id); salvar(); rView(); return; }
  if ((x = q('[data-rc-ovserv]'))){ UI.ovServ = x.dataset.rcOvserv; salvarUI(); rOverview(); return; }
  if ((x = q('[data-rc-cs-del]'))){ const c = D.statusCustom.find(z => z.id === x.dataset.rcCsDel); modal('Excluir o status ' + esc(c.nome) + '?', '<p style="margin:0">Os itens nele voltam para ' + GRUPO_NOME[c.grupo] + '.</p>', [{txt:'Cancelar', cls:'sec'}, {txt:'Excluir', cls:'acento', acao:() => { D.issues.forEach(i => { if (i.st === c.id) i.st = null; }); D.statusCustom = D.statusCustom.filter(z => z.id !== c.id); salvar(); rConfig(); }}]); return; }
  if ((x = q('[data-rc-cf-del]'))){ const c = D.camposItem.find(z => z.id === x.dataset.rcCfDel); modal('Excluir o campo ' + esc(c.nome) + '?', '<p style="margin:0">Os valores preenchidos nos itens saem junto.</p>', [{txt:'Cancelar', cls:'sec'}, {txt:'Excluir', cls:'acento', acao:() => { D.issues.forEach(i => { if (i.cf) delete i.cf[c.id]; }); D.camposItem = D.camposItem.filter(z => z.id !== c.id); salvar(); rConfig(); }}]); return; }
  if ((x = q('[data-rc-auto-del]'))){ D.automacoes = D.automacoes.filter(z => z.id !== x.dataset.rcAutoDel); salvar(); rConfig(); return; }
  if ((x = q('[data-rc-acao]'))){
    const a = x.dataset.rcAcao;
    if (a === 'vista-salvar') salvarVista();
    else if (a === 'vista-gerir') gerirVistas();
    else if (a === 'massa-limpar'){ selItens.clear(); rView(); }
    else if (a === 'massa-arquivar'){ const n = selItens.size; modal('Arquivar ' + n + (n === 1 ? ' item?' : ' itens?'), '<p style="margin:0">Somem das views e continuam guardados.</p>', [{txt:'Cancelar', cls:'sec'}, {txt:'Arquivar', cls:'acento', acao:() => { [...selItens].forEach(id => { const i = byId('issues', id); if (i){ i.arquivado = true; registrar('arquivou', i); } }); selItens.clear(); salvar(); rView(); toast(n + ' arquivados'); }}]); }
    else if (a === 'sprint-novo') novoSprint();
    else if (a === 'marco-novo') formMarco(null);
    else if (a === 'qd-nota'){ const qd = quadroDe(UI.sel); const n = qd.els.length; qd.els.push({id:uid('qd'), tipo:'nota', texto:'Nova nota', x:40 + (n % 4) * 250, y:40 + Math.floor(n / 4) * 140, w:200}); salvar(); rView(); }
    else if (a === 'qd-registro') novoCartaoRegistro();
    else if (a === 'qd-ligar'){ UI.qdLigar = UI.qdLigar ? null : true; rView(); if (UI.qdLigar) toast('Clique no primeiro cartão e depois no segundo'); }
    else if (a === 'cs-novo') novoStatus();
    else if (a === 'cf-novo') novoCampo();
    else if (a === 'auto-nova') novaAutomacao();
    else if (a === 'print-anotado') anotador(x.dataset.rcReq);
    else if (a === 'gravar-tela') alternarGravacao(x.dataset.rcReq);
  }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.rcVista !== undefined && t.value){ aplicarVista(t.value); return; }
  if (t.dataset.rcSel){ if (t.checked) selItens.add(t.dataset.rcSel); else selItens.delete(t.dataset.rcSel); rView(); return; }
  if (t.hasAttribute('data-rc-sel-todos')){ const l = listaFiltrada(); if (t.checked) l.forEach(i => selItens.add(i.id)); else selItens.clear(); rView(); return; }
  if (t.dataset.rcMassa){ aplicarMassa(t.dataset.rcMassa, t.value); return; }
  if (t.dataset.rcOrigem){ const a = byId('apps', t.dataset.rcOrigem); a.origemCodigo = t.value; salvar(); toast(t.value === 'terceiros' ? 'Código de terceiros: o Discovery ganhou itens a mais em Stages' : 'Código nosso'); return; }
  if (t.dataset.rcAutoLiga){ const a = D.automacoes.find(z => z.id === t.dataset.rcAutoLiga); a.ativa = t.checked; salvar(); rConfig(); return; }
  if (t.dataset.rcG && itemAberto){ const i = byId('issues', itemAberto); const c = t.dataset.rcG; const v = t.value || null;
    if (c === 'pontos') i.pontos = v ? +v : null; else i[c] = v;
    salvar(); abrirItem(i.id); return; }
  if (t.dataset.rcCf && itemAberto){ const i = byId('issues', itemAberto); i.cf = i.cf || {}; if (t.value === '') delete i.cf[t.dataset.rcCf]; else i.cf[t.dataset.rcCf] = t.value; salvar(); return; }
  // prioridade e responsável mudados no item aberto ou na tabela disparam automações
  const campo = t.dataset.g || t.dataset.editar;
  if (campo === 'prio' || campo === 'resp'){
    const id = itemAberto && t.dataset.g ? itemAberto : (t.closest('[data-linha]') || {dataset:{}}).dataset.linha; const i = id && byId('issues', id);
    const velho = [...(t.options || [])].find(o => o.defaultSelected); const antes = velho ? velho.value : null;
    if (i && antes !== t.value){ rodarAutomacoes(i, campo === 'prio' ? 'prioridade_mudou' : 'responsavel_mudou'); salvar(); if (t.dataset.g) abrirItem(i.id); else rView(); }
  }
});
document.addEventListener('submit', e => {
  const f = e.target;
  if (f.dataset.rcForm === 'filho'){
    e.preventDefault(); const pai = itemAberto && byId('issues', itemAberto); const txt = f.t.value.trim(); if (!pai || !txt) return;
    const ni = novoIssue({titulo:txt, tipo:FILHO_DE[pai.tipo], ws:pai.ws, pai:pai.id, sprint:pai.sprint || null, rep:eu(), status:'todo'}); D.issues.push(ni); registrar('criou', ni); salvar(); abrirItem(pai.id); toast(tipoNome(ni.tipo) + ' criado dentro de "' + pai.titulo + '"'); return;
  }
  if (f.dataset.form === 'resp-ped'){
    const r = byId('requests', UI.pedSel) || D.requests[0]; const m = r && r.msgs[r.msgs.length - 1];
    if (m && !m.quando){ m.quando = Date.now(); if (m.de === 'voce' && !r.respondido) r.respondido = m.quando; salvar(); rServiceDesk(); }
  }
});

/* ---------- partida ---------- */
garantirRecursos(D);
checarPrazosVencidos();
salvar();
setTimeout(atualizarSino, 0);

/* ---------- login: quem entrou define o papel (só na versão com login) ---------- */
window.itiaEntrouComo = function(p){
  if (!p || !['master','dev','stakeholder'].includes(p.papel)) return;
  UI.verComo = p.papel;
  const s = $('#ver-como');
  if (s){ s.value = p.papel; s.hidden = p.papel !== 'master'; const r = s.closest('.menu-rodape'); if (r){ const l = r.querySelector('label[for=ver-como]'); if (l) l.hidden = p.papel !== 'master'; } }
  const seguir = () => { document.body.classList.add('logado'); aplicarVerComo(); salvarUI(); abrirModulo(UI.modulo); };
  if (COM_BANCO && window.itiaBanco) return carregarDoBanco(p).then(seguir, e => { toast('Não foi possível ler o banco: ' + e.message); seguir(); });
  seguir();
};

/* ---------- Costs › Domínios. Com login (versão publicada) lê e grava no banco; sem login, usa os dados de exemplo ---------- */
ABAS_CUSTO.push(['dominios','Domínios']);
const DOM = {cache:null, carregando:false, aberto:null, erro:null};
const domBanco = () => (window.itiaBanco && document.body.classList.contains('logado')) ? window.itiaBanco : null;
const DOM_TIPOS = ['CNAME','A','AAAA','MX','TXT','NS','CAA','Túnel','Outro'];
function domSemente(){
  if (D.dominios) return;
  const r = (nome, tipo, aponta_para, servico, para_que, proxy) => ({id:uid('dr'), nome, tipo, aponta_para, servico, para_que, proxy:!!proxy});
  D.dominios = [{id:'dm_1', nome:'it-ia.tec.br', no_id:null, registrador:'Registro.br', dns_em:'Cloudflare', servidores_dns:['karsyn.ns.cloudflare.com','kellen.ns.cloudflare.com'],
    comprado_em:'2026-09-09', vence_em:'2036-09-09', renovacao_automatica:null, custo_operacao_id:null, custo_tecnico_id:null, email_provedor:'Google (Gmail)', acesso_onde:null,
    observacoes:'Domínio da própria IT.IA. Envio de e-mails do sistema pelo Resend (domínio verificado).',
    registros:[r('system','CNAME','cname.vercel-dns.com','Vercel','Sistema IT.IA (system.it-ia.tec.br)'), r('conversor','Túnel','conversor-billy','Cloudflare Tunnel','Conversor do Billy',true),
      r('@','MX','smtp.google.com','Google','Receber e-mails do domínio'), r('@','TXT','v=spf1 include:_spf.google.com ~all','Google','SPF: quem pode enviar e-mail pelo domínio'),
      r('_dmarc','TXT','v=DMARC1; p=reject;','E-mail','DMARC: recusar e-mail falso com o domínio'), r('@','TXT','google-site-verification (valor no Cloudflare)','Google','Prova de que o domínio é nosso para o Google'),
      r('resend._domainkey','TXT','chave DKIM do Resend (valor no Cloudflare)','Resend','Assinatura dos e-mails enviados pelo Resend'),
      r('send','CNAME','send.forge.rmta.net','Resend','Envio de e-mails pelo Resend'), r('rsend','CNAME','rsend.forge.rmta.net','Resend','Envio de e-mails pelo Resend')]}];
  salvar();
}
async function domCarregar(){
  const sb = domBanco();
  if (!sb && COM_BANCO){ DOM.cache = {dominios:[], donos:[], custos:[]}; return; }
  if (!sb){
    domSemente();
    DOM.cache = {dominios:D.dominios,
      donos:[...D.clients.map(x => ({id:x.id, nome:x.nome, tipo:'cliente'})), ...D.projects.map(x => ({id:x.id, nome:x.nome, tipo:'projeto'})), ...D.products.map(x => ({id:x.id, nome:x.nome, tipo:'produto'})), ...D.apps.map(x => ({id:x.id, nome:x.nome, tipo:'aplicacao'}))],
      custos:[...D.opCustos.map(x => ({id:'op:' + x.id, nome:x.nome, grupo:'Operação interna'})), ...D.custos.map(x => ({id:'tec:' + x.id, nome:x.fornecedor + (x.desc ? ' · ' + x.desc : ''), grupo:'Custos técnicos'}))]};
    return;
  }
  DOM.carregando = true;
  const res = await Promise.all([
    sb.from('dominios').select('*').order('nome'),
    sb.from('dominios_registros').select('*').order('nome'),
    sb.from('nos').select('id,nome,tipo').in('tipo', ['cliente','projeto','produto','aplicacao']).neq('status', 'arquivado').order('nome'),
    sb.from('custos_operacao').select('id,nome').order('nome'),
    sb.from('custos_tecnicos').select('id,fornecedor,descricao').order('fornecedor')]);
  DOM.carregando = false;
  const falha = res.find(x => x.error);
  if (falha){ DOM.erro = falha.error.message; return; }
  const [d, r, n, co, ct] = res.map(x => x.data);
  DOM.erro = null;
  DOM.cache = {dominios: d.map(x => Object.assign(x, {registros: r.filter(y => y.dominio_id === x.id)})), donos: n,
    custos:[...co.map(x => ({id:'op:' + x.id, nome:x.nome, grupo:'Operação interna'})), ...ct.map(x => ({id:'tec:' + x.id, nome:x.fornecedor + (x.descricao ? ' · ' + x.descricao : ''), grupo:'Custos técnicos'}))]};
}
function domSituacao(d){
  if (!d.vence_em) return ['Sem data', 'alerta'];
  const dias = Math.round((parse(d.vence_em) - parse(iso(HOJE))) / 864e5);
  if (dias < 0) return ['Vencido', 'perigo'];
  if (dias <= 30) return ['Vence em ' + dias + (dias === 1 ? ' dia' : ' dias'), 'perigo'];
  if (dias <= 60) return ['Vence em ' + dias + ' dias', 'alerta'];
  return ['Em dia', ''];
}
const domDono = d => { const x = DOM.cache.donos.find(o => o.id === d.no_id); return x ? x.nome : 'IT.IA'; };
const domCusto = d => { const k = d.custo_operacao_id ? 'op:' + d.custo_operacao_id : d.custo_tecnico_id ? 'tec:' + d.custo_tecnico_id : ''; const x = DOM.cache.custos.find(o => o.id === k); return x ? x.nome : ''; };
const domHost = (r, d) => r.nome === '@' ? d.nome : r.nome + '.' + d.nome;
function domDominios(){
  if (!souMaster()) return '<p class="intro">Só o Master vê os domínios.</p>';
  if (!DOM.cache){ if (!DOM.carregando) domCarregar().then(() => { if (UI.modulo === 'custos' && UI.ctAba === 'dominios') rCustos(); }); return '<p class="intro">Carregando os domínios…</p>'; }
  if (DOM.erro) return '<p class="intro">Não foi possível ler os domínios do banco: ' + esc(DOM.erro) + '</p><button class="btn sec" type="button" data-dm="recarregar">Tentar de novo</button>';
  const lista = DOM.cache.dominios;
  const linhas = lista.map(d => { const [s, c] = domSituacao(d); const ab = DOM.aberto === d.id;
    return '<tr' + (ab ? ' class="dm-aberto"' : '') + '><th scope="row"><button class="dm-nome" type="button" data-dm-abrir="' + d.id + '" aria-expanded="' + ab + '">' + esc(d.nome) + '</button></th><td>' + esc(domDono(d)) + '</td><td>' + esc(d.registrador) + '</td><td>' + esc(d.dns_em || '—') + '</td><td>' + (d.vence_em ? fmtData(d.vence_em) : '—') + ' <span class="rc-sit' + (c ? ' ' + c : '') + '">' + s + '</span></td><td>' + (d.renovacao_automatica === true ? 'Automática' : d.renovacao_automatica === false ? 'Manual' : 'Não informada') + '</td><td>' + d.registros.length + '</td>' +
      '<td><div class="acoes"><button class="btn sec peq" type="button" data-dm-editar="' + d.id + '">Editar</button><button class="ico-btn perigo" type="button" data-dm-excluir="' + d.id + '" aria-label="Excluir ' + esc(d.nome) + '">' + ICO.fechar + '</button></div></td></tr>' +
      (ab ? '<tr class="dm-det"><td colspan="8">' + domDetalhe(d) + '</td></tr>' : ''); }).join('');
  return '<div class="topo-tela"><p class="intro" style="margin:0">Cada domínio do grupo: onde foi comprado, onde o DNS' + I('DNS: o "catálogo de endereços" da internet, que diz para onde cada endereço do domínio aponta') + ' é administrado, quando vence e para onde cada subdomínio' + I('Subdomínio: um endereço dentro do domínio, como system.it-ia.tec.br dentro de it-ia.tec.br') + ' aponta. O Master recebe um aviso 60, 30, 7 e 1 dia antes de vencer.</p><div class="acoes"><button class="btn" type="button" data-dm="novo">' + ICO.mais + 'Novo domínio</button></div></div><div style="height:12px"></div>' +
    (lista.length ? '<div class="tabela-rolo"><table class="tabela"><thead><tr><th>Domínio</th><th>Empresa dona</th><th>Comprado em</th><th>DNS em</th><th>Vence em</th><th>Renovação</th><th>Registros</th><th></th></tr></thead><tbody>' + linhas + '</tbody></table></div>'
      : '<p class="intro">Nenhum domínio cadastrado ainda.</p>');
}
function domDetalhe(d){
  const cst = domCusto(d);
  const dados = [['Comprado em', d.comprado_em ? fmtData(d.comprado_em) : '—'], ['Servidores de DNS', (d.servidores_dns || []).join(', ') || '—'], ['E-mail do domínio', d.email_provedor || '—'], ['Custo', cst || 'Não ligado a um custo'], ['Onde fica o acesso', d.acesso_onde || '—'], ['Observações', d.observacoes || '—']];
  return '<div class="dm-dados">' + dados.map(([k, v]) => '<div><span>' + k + '</span><b>' + esc(v) + '</b></div>').join('') + '</div>' +
    '<div class="topo-tela" style="margin-top:16px"><h3 class="dm-tit">Registros do domínio' + I('Registros: cada linha do DNS do domínio, como um subdomínio, o e-mail ou uma verificação de serviço') + '</h3><div class="acoes"><button class="btn sec peq" type="button" data-dm-novo-reg="' + d.id + '">' + ICO.mais + 'Novo registro</button></div></div>' +
    (d.registros.length ? '<div class="tabela-rolo"><table class="tabela"><thead><tr><th>Endereço</th><th>Tipo</th><th>Aponta para</th><th>Serviço</th><th>Para que serve</th><th></th></tr></thead><tbody>' +
      d.registros.map(r => '<tr><th scope="row">' + esc(domHost(r, d)) + '</th><td>' + esc(r.tipo) + (r.proxy ? ' <span class="rc-sit">Proxy</span>' : '') + '</td><td class="dm-quebra">' + esc(r.aponta_para) + '</td><td>' + esc(r.servico || '—') + '</td><td>' + esc(r.para_que || '—') + '</td><td><div class="acoes"><button class="btn sec peq" type="button" data-dm-editar-reg="' + d.id + '|' + r.id + '">Editar</button><button class="ico-btn perigo" type="button" data-dm-excluir-reg="' + d.id + '|' + r.id + '" aria-label="Excluir registro">' + ICO.fechar + '</button></div></td></tr>').join('') + '</tbody></table></div>'
      : '<p class="intro">Nenhum registro ainda.</p>');
}
async function domGravar(tabela, valores, id){
  const sb = domBanco();
  if (!sb) return {ok:true};
  const q = id ? sb.from(tabela).update(valores).eq('id', id).select() : sb.from(tabela).insert(valores).select();
  const {data, error} = await q;
  if (error) return {ok:false, msg: /duplicate|unique/i.test(error.message) ? 'Já existe um domínio com esse nome.' : /check/i.test(error.message) ? 'Algum campo está num formato que o banco não aceita. Confira o nome e as datas.' : error.message};
  if (!data || !data.length) return {ok:false, msg:'O banco não confirmou a gravação. Confira se você entrou como Master.'};
  return {ok:true, linha:data[0]};
}
async function domApagar(tabela, id){
  const sb = domBanco(); if (!sb) return {ok:true};
  const {data, error} = await sb.from(tabela).delete().eq('id', id).select();
  if (error) return {ok:false, msg:error.message};
  if (!data || !data.length) return {ok:false, msg:'O banco não confirmou a exclusão.'};
  return {ok:true};
}
function domForm(d){
  d = d || {};
  const donos = DOM.cache.donos, custos = DOM.cache.custos;
  const custoAtual = d.custo_operacao_id ? 'op:' + d.custo_operacao_id : d.custo_tecnico_id ? 'tec:' + d.custo_tecnico_id : '';
  const grupos = [...new Set(custos.map(c => c.grupo))];
  const rot = {cliente:'Cliente', projeto:'Projeto', produto:'Produto', aplicacao:'Aplicação'};
  modal(d.id ? 'Editar ' + esc(d.nome) : 'Novo domínio',
    '<div class="grade-form">' +
    '<label class="lb">Domínio<input class="campo" id="dm-n" value="' + esc(d.nome || '') + '" placeholder="exemplo.com.br" autocomplete="off"></label>' +
    '<label class="lb">Empresa dona' + I('Empresa dona: a quem o domínio pertence. Vazio quer dizer que é da própria IT.IA') + '<select class="sel" id="dm-dono"><option value="">IT.IA</option>' + ['cliente','projeto','produto','aplicacao'].map(t => donos.filter(o => o.tipo === t).length ? '<optgroup label="' + rot[t] + '">' + donos.filter(o => o.tipo === t).map(o => '<option value="' + o.id + '"' + (d.no_id === o.id ? ' selected' : '') + '>' + esc(o.nome) + '</option>').join('') + '</optgroup>' : '').join('') + '</select></label>' +
    '<label class="lb">Comprado em (registrador)' + I('Registrador: a empresa onde o domínio foi comprado e é renovado, como o Registro.br') + '<input class="campo" id="dm-reg" value="' + esc(d.registrador || 'Registro.br') + '"></label>' +
    '<label class="lb">Onde o DNS é administrado<input class="campo" id="dm-dns" value="' + esc(d.dns_em || '') + '" placeholder="Cloudflare"></label>' +
    '<label class="lb">Servidores de DNS' + I('Servidores de DNS: os endereços que o registrador usa para saber onde o DNS do domínio fica. Separe por vírgula') + '<input class="campo" id="dm-ns" value="' + esc((d.servidores_dns || []).join(', ')) + '"></label>' +
    '<label class="lb">Data da compra<input class="campo" type="date" id="dm-c" value="' + esc(d.comprado_em || '') + '"></label>' +
    '<label class="lb">Data de vencimento<input class="campo" type="date" id="dm-v" value="' + esc(d.vence_em || '') + '"></label>' +
    '<label class="lb">Renovação<select class="sel" id="dm-ren"><option value=""' + (d.renovacao_automatica == null ? ' selected' : '') + '>Não informada</option><option value="sim"' + (d.renovacao_automatica === true ? ' selected' : '') + '>Automática</option><option value="nao"' + (d.renovacao_automatica === false ? ' selected' : '') + '>Manual</option></select></label>' +
    '<label class="lb">Custo' + I('Custo: liga o domínio a um custo já cadastrado em Costs, para ele entrar nas contas sem ser digitado duas vezes') + '<select class="sel" id="dm-custo"><option value="">Não ligado a um custo</option>' + grupos.map(g => '<optgroup label="' + g + '">' + custos.filter(c => c.grupo === g).map(c => '<option value="' + c.id + '"' + (custoAtual === c.id ? ' selected' : '') + '>' + esc(c.nome) + '</option>').join('') + '</optgroup>').join('') + '</select></label>' +
    '<label class="lb">E-mail do domínio<input class="campo" id="dm-em" value="' + esc(d.email_provedor || '') + '" placeholder="Google, Microsoft, nenhum"></label>' +
    '<label class="lb">Onde fica o acesso ao painel' + I('Onde fica o acesso: em qual cofre ou com quem está a senha do painel. Nunca escreva a senha aqui') + '<input class="campo" id="dm-ac" value="' + esc(d.acesso_onde || '') + '" placeholder="Ex.: cofre de senhas da IT.IA (nunca a senha)"></label>' +
    '<label class="lb">Observações<textarea class="campo" id="dm-ob" rows="2">' + esc(d.observacoes || '') + '</textarea></label></div>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Salvar', acao:dlg => {
      const nome = $('#dm-n', dlg).value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(nome)){ toast('Escreva o domínio sem espaço, como exemplo.com.br'); return false; }
      const c = $('#dm-c', dlg).value || null, v = $('#dm-v', dlg).value || null;
      if (c && v && v < c){ toast('O vencimento não pode ser antes da compra'); return false; }
      const custo = $('#dm-custo', dlg).value, ren = $('#dm-ren', dlg).value;
      const val = {nome, no_id: $('#dm-dono', dlg).value || null, registrador: $('#dm-reg', dlg).value.trim() || 'Não informado', dns_em: $('#dm-dns', dlg).value.trim() || null,
        servidores_dns: $('#dm-ns', dlg).value.split(',').map(s => s.trim()).filter(Boolean), comprado_em: c, vence_em: v, renovacao_automatica: ren === '' ? null : ren === 'sim',
        custo_operacao_id: custo.startsWith('op:') ? custo.slice(3) : null, custo_tecnico_id: custo.startsWith('tec:') ? custo.slice(4) : null,
        email_provedor: $('#dm-em', dlg).value.trim() || null, acesso_onde: $('#dm-ac', dlg).value.trim() || null, observacoes: $('#dm-ob', dlg).value.trim() || null};
      if (!domBanco() && D.dominios.some(x => x.nome === nome && x.id !== d.id)){ toast('Já existe um domínio com esse nome.'); return false; }
      domGravar('dominios', val, d.id).then(res => {
        if (!res.ok){ toast(res.msg); return; }
        if (domBanco()) DOM.cache = null; else { if (d.id) Object.assign(d, val); else D.dominios.push(Object.assign({id:uid('dm'), registros:[]}, val)); salvar(); }
        rCustos(); toast('Domínio salvo');
      });
    }}]);
}
function domFormReg(d, r){
  r = r || {};
  const apps = DOM.cache.donos.filter(o => o.tipo === 'aplicacao');
  modal((r.id ? 'Editar registro de ' : 'Novo registro em ') + esc(d.nome),
    '<div class="grade-form">' +
    '<label class="lb">Nome' + I('Nome: a parte antes do domínio. Para system.it-ia.tec.br, escreva system. Para o próprio domínio, escreva @') + '<span class="com-suf"><input class="campo" id="dr-n" value="' + esc(r.nome || '') + '" placeholder="system"><span>.' + esc(d.nome) + '</span></span></label>' +
    '<label class="lb">Tipo' + I('Tipo do registro: CNAME aponta para outro endereço; A aponta para um número de IP; MX recebe e-mail; TXT guarda verificações') + '<select class="sel" id="dr-t">' + DOM_TIPOS.map(t => '<option' + (r.tipo === t ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></label>' +
    '<label class="lb">Aponta para<input class="campo" id="dr-a" value="' + esc(r.aponta_para || '') + '" placeholder="cname.vercel-dns.com"></label>' +
    '<label class="lb">Serviço<input class="campo" id="dr-s" value="' + esc(r.servico || '') + '" placeholder="Vercel, Google, Resend"></label>' +
    '<label class="lb">Para que serve<input class="campo" id="dr-p" value="' + esc(r.para_que || '') + '"></label>' +
    (apps.length ? '<label class="lb">Aplicação ligada<select class="sel" id="dr-app"><option value="">Nenhuma</option>' + apps.map(a => '<option value="' + a.id + '"' + (r.aplicacao_id === a.id ? ' selected' : '') + '>' + esc(a.nome) + '</option>').join('') + '</select></label>' : '') +
    '<label class="lb ck"><input type="checkbox" id="dr-px"' + (r.proxy ? ' checked' : '') + '> Passa pelo proxy do Cloudflare (nuvem laranja)' + I('Proxy: o Cloudflare fica no meio do caminho. Para sites na Vercel deve ficar desligado (nuvem cinza)') + '</label></div>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Salvar', acao:dlg => {
      let nome = $('#dr-n', dlg).value.trim().toLowerCase(); if (nome === '' ) nome = '@';
      nome = nome.replace(new RegExp('\\.?' + d.nome.replace(/\./g, '\\.') + '$'), '') || '@';
      if (nome !== '@' && !/^[a-z0-9_]([a-z0-9_.-]*[a-z0-9])?$/.test(nome)){ toast('O nome aceita só letras, números, ponto, hífen e sublinhado'); return false; }
      const aponta = $('#dr-a', dlg).value.trim(); if (!aponta){ toast('Diga para onde o registro aponta'); return false; }
      const appSel = $('#dr-app', dlg);
      const val = {dominio_id: d.id, nome, tipo: $('#dr-t', dlg).value, aponta_para: aponta, servico: $('#dr-s', dlg).value.trim() || null, para_que: $('#dr-p', dlg).value.trim() || null,
        aplicacao_id: appSel && appSel.value ? appSel.value : null, proxy: $('#dr-px', dlg).checked};
      domGravar('dominios_registros', val, r.id).then(res => {
        if (!res.ok){ toast(res.msg); return; }
        if (domBanco()) DOM.cache = null; else { delete val.dominio_id; if (r.id) Object.assign(r, val); else d.registros.push(Object.assign({id:uid('dr')}, val)); salvar(); }
        DOM.aberto = d.id; rCustos(); toast('Registro salvo');
      });
    }}]);
}
const rCustosAntes = rCustos;
rCustos = function(){
  if (UI.ctAba !== 'dominios') return rCustosAntes();
  UI.ctAba = 'regras'; rCustosAntes(); UI.ctAba = 'dominios';
  const el = $('#m-custos'); if (!el) return;
  el.querySelectorAll('[data-ct-aba]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.ctAba === 'dominios')));
  const esp = el.querySelector('.views').nextElementSibling;
  while (esp.nextSibling) esp.nextSibling.remove();
  esp.insertAdjacentHTML('afterend', '<div id="dm-area">' + domDominios() + '</div>');
};
document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-dm],[data-dm-abrir],[data-dm-editar],[data-dm-excluir],[data-dm-novo-reg],[data-dm-editar-reg],[data-dm-excluir-reg]');
  if (!t || !DOM.cache && t.dataset.dm !== 'recarregar') return;
  const acha = id => DOM.cache.dominios.find(x => String(x.id) === String(id));
  if (t.dataset.dm === 'recarregar'){ DOM.cache = null; DOM.erro = null; rCustos(); return; }
  if (t.dataset.dm === 'novo') return domForm();
  if (t.dataset.dmAbrir){ DOM.aberto = DOM.aberto === t.dataset.dmAbrir ? null : t.dataset.dmAbrir; rCustos(); return; }
  if (t.dataset.dmEditar) return domForm(acha(t.dataset.dmEditar));
  if (t.dataset.dmNovoReg) return domFormReg(acha(t.dataset.dmNovoReg));
  if (t.dataset.dmEditarReg){ const [di, ri] = t.dataset.dmEditarReg.split('|'); const d = acha(di); return domFormReg(d, d.registros.find(r => String(r.id) === ri)); }
  if (t.dataset.dmExcluir){ const d = acha(t.dataset.dmExcluir);
    return modal('Excluir ' + esc(d.nome) + '?', '<p style="margin:0">O domínio e os ' + d.registros.length + ' registros dele saem do cadastro. O domínio continua existindo no registrador; só deixa de estar anotado aqui.</p>',
      [{txt:'Cancelar', cls:'sec'}, {txt:'Excluir', cls:'acento', acao:() => { domApagar('dominios', d.id).then(res => { if (!res.ok) return toast(res.msg); if (domBanco()) DOM.cache = null; else { D.dominios = D.dominios.filter(x => x.id !== d.id); salvar(); DOM.cache.dominios = D.dominios; } rCustos(); toast('Domínio excluído'); }); }}]); }
  if (t.dataset.dmExcluirReg){ const [di, ri] = t.dataset.dmExcluirReg.split('|'); const d = acha(di); const r = d.registros.find(x => String(x.id) === ri);
    return modal('Excluir o registro ' + esc(domHost(r, d)) + '?', '<p style="margin:0">Sai só do cadastro. No Cloudflare (ou onde o DNS fica) ele continua valendo até ser apagado lá.</p>',
      [{txt:'Cancelar', cls:'sec'}, {txt:'Excluir', cls:'acento', acao:() => { domApagar('dominios_registros', r.id).then(res => { if (!res.ok) return toast(res.msg); if (domBanco()) DOM.cache = null; else { d.registros = d.registros.filter(x => x.id !== r.id); salvar(); } DOM.aberto = d.id; rCustos(); toast('Registro excluído'); }); }}]); }
});

/* ---------- Board: as colunas vão sempre até o fim da tela ---------- */
function esticarColunas(){
  document.querySelectorAll('.board').forEach(b => {
    if (b.closest('.raia')) return;
    const rolo = b.closest('.principal'); const sobe = rolo ? rolo.scrollTop : 0;
    // desconta os espaços embaixo do quadro (margens de quem está em volta) para a coluna terminar exatamente no fim da tela
    let folga = 0; for (let e = b; e && e !== rolo; e = e.parentElement){ const s = getComputedStyle(e); folga += parseFloat(s.paddingBottom) + parseFloat(s.borderBottomWidth) + (e === b ? 0 : parseFloat(s.marginBottom)); }
    const rs = rolo ? getComputedStyle(rolo) : null; if (rs) folga += parseFloat(rs.paddingBottom);
    const alt = Math.floor(window.innerHeight - (b.getBoundingClientRect().top + sobe) - folga - 2);
    b.style.setProperty('--col-min', Math.max(alt, 240) + 'px');
  });
}
let esticarPedido = 0;
const pedirEsticar = () => { cancelAnimationFrame(esticarPedido); esticarPedido = requestAnimationFrame(esticarColunas); };
new MutationObserver(pedirEsticar).observe(document.querySelector('.principal') || document.body, {childList:true, subtree:true});
window.addEventListener('resize', pedirEsticar);

/* ---------- Estrutura: linhas pontilhadas ligando cada item aos filhos ---------- */
function linhasArvore(){
  const nos = [...document.querySelectorAll('.ops-arvore .no-arv[data-no]')];
  const nivel = nos.map(n => Math.max(0, Math.round((parseFloat(n.style.paddingLeft) - 8) / 14)));
  const raiz = getComputedStyle(document.documentElement);
  const vermelho = raiz.getPropertyValue('--vermelho').trim() || '#FF0000', preto = raiz.getPropertyValue('--preto').trim() || '#050506';
  // até as empresas do projeto (nível 2) o pontilhado é vermelho; das aplicações para dentro, preto
  const corDe = k => k <= 2 ? vermelho : preto;
  const v = (x, alto, k) => ['repeating-linear-gradient(to bottom,' + corDe(k) + ' 0 1px,transparent 1px 3px)', x + 'px 0', '1px ' + alto, 'no-repeat'];
  const h = (x, k) => ['repeating-linear-gradient(to right,' + corDe(k) + ' 0 1px,transparent 1px 3px)', x + 'px 50%', '7px 1px', 'no-repeat'];
  // a linha do nível k continua depois do item i se aparece outro item do nível k antes de algum de nível menor
  const continua = (i, k) => { for (let j = i + 1; j < nos.length; j++){ if (nivel[j] < k) return false; if (nivel[j] === k) return true; } return false; };
  nos.forEach((n, i) => {
    const L = nivel[i], camadas = [];
    for (let k = 1; k < L; k++) if (continua(i, k)) camadas.push(v(14 * k + 2, '100%', k));
    if (L >= 1){ camadas.push(v(14 * L + 2, continua(i, L) ? '100%' : '50%', L)); camadas.push(h(14 * L + 2, L)); }
    n.style.backgroundImage = camadas.map(c => c[0]).join(',');
    n.style.backgroundPosition = camadas.map(c => c[1]).join(',');
    n.style.backgroundSize = camadas.map(c => c[2]).join(',');
    n.style.backgroundRepeat = camadas.map(c => c[3]).join(',');
  });
}
let linhasPedido = 0;
new MutationObserver(() => { cancelAnimationFrame(linhasPedido); linhasPedido = requestAnimationFrame(linhasArvore); }).observe(document.querySelector('.principal') || document.body, {childList:true, subtree:true});

/* ---------- versão com login: monta a tela a partir das tabelas do banco ---------- */
const BANCO = {carregado:false, erros:[], quando:null};
const TIPO_NO = {cliente:'client', projeto:'project', produto:'product', aplicacao:'app', frente:'ws'};
const ST_NO = {ativo:'active', pausado:'on_hold', concluido:'done', arquivado:'archived'};
const inverter = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k]));
const DE_MOD = inverter({fixo:'fixo', hora:'hora', marco:'marco', setup:'implantacao', mensal:'mensalidade', banco:'banco_horas', usuario:'usuario', faixa:'faixas', uso:'uso', valor:'valor', sucesso:'sucesso', manutencao:'manutencao', repasse:'repasse'});
const DE_VINC = {clt:'CLT', pj:'PJ', estagio:'Estágio', socio:'Sócio'};
const DE_REC = {mensal:'Mensal', anual:'Anual', unico:'Único', depreciacao:'Depreciação', uso:'Por uso'};
const DE_FORMA = {mensal:'Mensal', unica:'Único', parcelada:'Parcelado'};
const DE_MODO = {aviso:'Aviso', trava:'Trava', desligado:'Desligado'};
const DE_PROVA = {nenhuma:'Nenhuma', captura:'Captura de tela', arquivo:'Arquivo', link:'Link', texto:'Texto', aprovacao:'Aprovação de alguém'};
const DE_QUEM = {responsavel_etapa:'Responsável da etapa', qualquer_um:'Qualquer pessoa do time'};
const DE_PERM = {livre:'Livre', automatica:'Automática', confirmacao:'Com confirmação', bloqueada:'Bloqueada'};
const DE_PT = {bug:'Bug report', correcao:'Fix request', mudanca:'Change request', funcionalidade:'Feature request', duvida:'Question'};
const DE_GR = {parado:'Sistema parado', quebrada:'Função quebrada', incomodo:'Incômodo', cosmetico:'Cosmético'};
const DE_PS = {novo:'Em triagem', ia_conversando:'IA conversando', aguardando_voce:'Aguardando você', virou_item:'Virou item', resolvido:'Resolvido', recusado:'Recusado'};
const DE_ANEXO = {audio:'áudio', video:'vídeo'};
const TABELAS_BANCO = ['pessoas','nos','clientes','projetos','aplicacoes','frentes','participacoes','etiquetas','etiquetas_nos','status_fluxo','requisitos','servicos','servicos_cobranca',
  'servicos_requisitos','regras_calculo','pessoas_custos','custos_operacao','custos_tecnicos','custos_uso','receitas','slas','sprints','marcos','automacoes','campos_personalizados',
  'itens','itens_campos','itens_checklist','itens_ligacoes','comentarios','blocos_agenda','tempo_registros','anexos','ficha_campos','etapas_modelo','etapas_modelo_itens',
  'etapas_nos','provas','agentes','agentes_fontes','agentes_ferramentas','pedidos','pedidos_mensagens','notificacoes'];

async function lerTabela(sb, t){
  const todas = []; const passo = 1000;
  for (let de = 0; ; de += passo){
    const {data, error} = await sb.from(t).select('*').range(de, de + passo - 1);
    if (error) throw new Error(t + ': ' + error.message);
    todas.push(...(data || []));
    if (!data || data.length < passo) return todas;
  }
}
const diaDe = ts => ts ? iso(new Date(ts)) : null;
const horaDe = ts => { const d = new Date(ts); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const porOrdem = (a, b) => (a.ordem || 0) - (b.ordem || 0);
function agrupar(lista, campo){ const m = new Map(); lista.forEach(x => { const k = x[campo]; if (!m.has(k)) m.set(k, []); m.get(k).push(x); }); return m; }

function montarDados(T, eu){
  const d = dadosVazios();
  const nos = new Map(T.nos.map(n => [n.id, n]));
  const chave = id => { const n = nos.get(id); return n ? TIPO_NO[n.tipo] + ':' + n.id : null; };
  const acima = (id, tipo) => { let n = nos.get(id); while (n && n.tipo !== tipo) n = nos.get(n.pai_id); return n ? n.id : ''; };
  const um = (lista, campo) => new Map(lista.map(x => [x[campo], x]));
  const cli = um(T.clientes, 'no_id'), prj = um(T.projetos, 'no_id'), apl = um(T.aplicacoes, 'no_id'), fre = um(T.frentes, 'no_id');
  const slas = agrupar(T.slas, 'no_id');
  const base = n => ({id:n.id, nome:n.nome, status:ST_NO[n.status] || 'active', motivo:n.motivo_pausa || ''});
  const ord = T.nos.slice().sort((a, b) => porOrdem(a, b) || String(a.nome).localeCompare(String(b.nome)));
  ord.forEach(n => {
    if (n.tipo === 'cliente'){ const c = cli.get(n.id) || {}; const s = slas.get(n.id);
      d.clients.push(Object.assign(base(n), {tipo:c.tipo_cliente || 'empresa', holding:c.holding_id || null, doc:c.documento || '', ficha:Object.fromEntries(CAMPOS_FICHA_CLI.map(k => [k, c[k] == null ? '' : c[k]])), sla: s ? Object.fromEntries(s.map(x => [x.gravidade, [+x.horas_resposta, +x.horas_solucao]])) : undefined})); }
    else if (n.tipo === 'projeto'){ const p = prj.get(n.id) || {}; d.projects.push(Object.assign(base(n), {client:n.pai_id, origem:p.origem || 'greenfield', inicio:p.inicio, alvo:p.alvo})); }
    else if (n.tipo === 'produto') d.products.push(Object.assign(base(n), {project:acima(n.id, 'projeto'), client:acima(n.id, 'cliente')}));
    else if (n.tipo === 'aplicacao'){ const a = apl.get(n.id) || {}; d.apps.push(Object.assign(base(n), {project:acima(n.id, 'projeto'), product:acima(n.id, 'produto'), plataforma:a.plataforma || 'web', servico:a.servico_id || '', origemCodigo:a.origem_codigo || 'proprio'})); }
    else if (n.tipo === 'frente'){ const f = fre.get(n.id) || {}; d.ws.push(Object.assign(base(n), {app:n.pai_id, wip:f.wip_limite == null ? null : +f.wip_limite})); }
  });

  const part = agrupar(T.participacoes, 'pessoa_id');
  const custoP = agrupar(T.pessoas_custos.slice().sort((a, b) => String(b.vigente_desde).localeCompare(String(a.vigente_desde))), 'pessoa_id');
  T.pessoas.slice().sort((a, b) => (a.papel === 'master' ? 0 : 1) - (b.papel === 'master' ? 0 : 1) || String(a.nome).localeCompare(String(b.nome))).forEach(p => {
    const c = (custoP.get(p.id) || [])[0];
    const esc1 = (part.get(p.id) || []).map(x => chave(x.no_id)).filter(Boolean)[0];
    d.people.push({id:p.id, nome:p.nome, funcao:p.funcao || '', skills:p.habilidades || [], cap:+p.capacidade_h || 0, acesso:p.papel === 'master' ? 'owner' : p.papel,
      email:p.email || '', ativo:p.ativo, escopo:p.papel === 'stakeholder' ? (esc1 || 'all') : undefined,
      custo: c ? {vinculo:DE_VINC[c.vinculo] || c.vinculo, salario:+c.salario || 0, prolabore:+c.prolabore || 0, valorPJ:+c.valor_pj || 0, beneficios:+c.beneficios || 0, _id:c.id, _desde:c.vigente_desde} : undefined});
  });

  d.tags = T.etiquetas.map(t => ({id:t.id, nome:t.nome, cor:t.cor, cat:t.categoria || '', desc:t.descricao || ''}));
  d.tagLinks = T.etiquetas_nos.map(l => { const k = chave(l.no_id); return k ? {tag:l.etiqueta_id, tipo:k.split(':')[0], id:l.no_id} : null; }).filter(Boolean);
  d.statusCustom = T.status_fluxo.filter(s => s.no_id).sort(porOrdem).map(s => ({id:s.id, no:chave(s.no_id), nome:s.nome, cor:s.cor, grupo:s.grupo, _chave:s.chave}));
  BANCO.stPadrao = Object.fromEntries(T.status_fluxo.filter(s => !s.no_id).map(s => [s.chave, s.id]));
  BANCO.reqIds = Object.fromEntries(T.requisitos.map(q => [q.nome, q.id]));
  BANCO.fonteIds = Object.fromEntries(T.agentes_fontes.map(f => [f.agente_id + '|' + f.nome, f.id]));
  const stPorId = um(T.status_fluxo, 'id');
  T.requisitos.slice().sort(porOrdem).forEach(q => { d.baseline[q.nome] = !!q.padrao; });

  const reqNome = um(T.requisitos, 'id'), cob = agrupar(T.servicos_cobranca.slice().sort(porOrdem), 'servico_id'), sreq = agrupar(T.servicos_requisitos, 'servico_id');
  d.catalog = T.servicos.map(s => ({id:s.id, cat:s.categoria, nome:s.nome, desc:s.descricao || '', entrega:s.entregaveis || [], frentes:s.frentes_padrao || [],
    horas:[+s.horas_min || 0, +s.horas_max || 0], preco:(cob.get(s.id) || []).map(c => Object.assign({m:DE_MOD[c.modelo] || c.modelo}, c.parametros || {}, {_id:c.id})),
    req:(sreq.get(s.id) || []).map(x => (reqNome.get(x.requisito_id) || {}).nome).filter(Boolean), sla:s.sla || '', check:s.checklist_inicio || [], ativo:s.ativo !== false, _codigo:s.codigo}));

  const R = T.regras_calculo.slice().sort((a, b) => String(b.vigente_desde).localeCompare(String(a.vigente_desde)))[0];
  if (R) d.regras = {regime:R.regime, impostos:{simples:+R.aliq_simples, presumido:+R.aliq_presumido, real:+R.aliq_real},
    encargos:{inss:+R.inss_patronal, rat:+R.rat, terceiros:+R.terceiros, fgts:+R.fgts, ferias:+R.ferias, terco:+R.terco_ferias, decimo:+R.decimo_terceiro, multaFgts:+R.multa_fgts},
    horasMes:+R.horas_mes, faturavel:+R.faturavel_pct, margem:+R.margem_pct, risco:+R.contingencia_pct, cambio:+R.cambio_usd, complexidade:R.complexidade || {'Média':1},
    urgencia:R.urgencia || {Normal:1}, manutencaoAnual:+R.manutencao_pct, reservaOverhead:+R.folga_rateio_pct, _desde:R.vigente_desde};

  d.opCustos = T.custos_operacao.map(o => ({id:o.id, nome:o.nome, cat:o.categoria, valor:+o.valor, moeda:o.moeda, rec:DE_REC[o.recorrencia] || o.recorrencia, meses:o.meses_depreciacao, inicio:o.inicio, fim:o.fim || ''}));
  const usos = agrupar(T.custos_uso.slice().sort((a, b) => String(a.mes).localeCompare(String(b.mes))), 'custo_id');
  d.custos = T.custos_tecnicos.map(c => { const n = nos.get(c.no_id);
    return {id:c.id, cliente:acima(c.no_id, 'cliente'), app:n && n.tipo === 'aplicacao' ? n.id : '', fornecedor:c.fornecedor, cat:c.categoria, desc:c.descricao || '', rec:DE_REC[c.recorrencia] || c.recorrencia,
      moeda:c.moeda, valor:+c.valor, repasse:!!c.repasse, markup:+c.taxa_repasse_pct || 0, inicio:c.inicio, fim:c.fim || '',
      uso: c.unidade ? {unidade:c.unidade, hist:(usos.get(c.id) || []).map(u => +u.quantidade), _meses:(usos.get(c.id) || []).map(u => String(u.mes).slice(0, 10)), limite:c.limite == null ? null : +c.limite, plano:c.plano || '',
        prox: c.proximo_plano ? {nome:c.proximo_plano, valor:+c.proximo_valor || 0, extraUnidade:c.extra_por_unidade == null ? null : +c.extra_por_unidade} : null} : null}; });
  d.receitas = T.receitas.map(r => { const n = nos.get(r.no_id);
    return {id:r.id, cliente:acima(r.no_id, 'cliente'), project:acima(r.no_id, 'projeto'), app:n && n.tipo === 'aplicacao' ? n.id : '', servico:r.servico_id || '', desc:r.descricao,
      modelo:DE_MOD[r.modelo] || r.modelo, valor:+r.valor, rec:DE_FORMA[r.forma] || r.forma, parcelas:r.parcelas, inicio:r.inicio, fim:r.fim || ''}; });

  d.sprints = T.sprints.map(s => ({id:s.id, project:s.projeto_id, nome:s.nome, meta:s.meta || '', ini:s.inicio, fim:s.fim, status:s.status}));
  d.marcos = T.marcos.map(m => ({id:m.id, no:chave(m.no_id), tipo:m.tipo, nome:m.nome, desc:m.descricao || '', data:m.data, vis:!!m.visivel_cliente, entregue:m.entregue_em ? diaDe(m.entregue_em) : null})).filter(m => m.no);
  d.automacoes = T.automacoes.map(a => { const c = a.condicao || {}, p = a.parametros || {};
    return {id:a.id, no:chave(a.no_id), nome:a.nome, gatilho:a.gatilho, cond:{tipo:c.tipo, grupo:c.grupo, prio:c.prioridade}, acao:a.acao,
      param:{para:p.para, titulo:p.titulo, texto:p.texto, pessoa:p.pessoa_id, prio:p.prioridade, status:p.status, cliente:p.visivel_cliente}, ativa:a.ativa !== false}; }).filter(a => a.no);
  d.camposItem = T.campos_personalizados.slice().sort(porOrdem).map(c => ({id:c.id, no:chave(c.no_id), nome:c.nome, tipo:c.tipo, opcoes:c.opcoes || []})).filter(c => c.no);

  const chk = agrupar(T.itens_checklist.slice().sort(porOrdem), 'item_id'), com = agrupar(T.comentarios.slice().sort((a, b) => String(a.criado_em).localeCompare(String(b.criado_em))), 'item_id');
  const lig = agrupar(T.itens_ligacoes, 'origem_id'), blo = agrupar(T.blocos_agenda, 'item_id'), tmp = agrupar(T.tempo_registros, 'item_id');
  const anxItem = agrupar(T.anexos.filter(x => x.item_id), 'item_id'), cmp = agrupar(T.itens_campos, 'item_id');
  const TL = {bloqueia:'Blocks', relacionado:'Relates to', duplica:'Duplicates'};
  d.issues = T.itens.map(i => { const st = stPorId.get(i.status_id) || {}; const custom = !!st.no_id; const b = (blo.get(i.id) || [])[0];
    return {id:i.id, ws:i.frente_id, tipo:i.tipo, titulo:i.titulo, desc:i.descricao || '', status:custom ? st.grupo : (st.chave || 'backlog'), st:custom ? st.id : undefined,
      prio:i.prioridade, resp:i.responsavel_id || null, rep:i.relator_id || null, ini:i.inicio, fim:i.prazo, alvo:i.data_prevista, est:i.estimativa_h == null ? null : +i.estimativa_h,
      pontos:i.pontos == null ? undefined : +i.pontos, vis:i.visivel_cliente ? 'cliente' : 'interno', pai:i.pai_id || null,
      check:(chk.get(i.id) || []).map(c => ({t:c.texto, f:!!c.feito, _id:c.id})), links:(lig.get(i.id) || []).map(l => ({tipo:TL[l.tipo] || 'Relates to', alvo:l.destino_id})),
      coments:(com.get(i.id) || []).map(c => ({quem:c.autor_id, txt:c.texto, quando:diaDe(c.criado_em), cliente:!!c.visivel_cliente, _id:c.id})),
      tempo:(tmp.get(i.id) || []).map(t => ({ini:new Date(t.inicio).getTime(), fim:t.fim ? new Date(t.fim).getTime() : null, quem:t.pessoa_id, origem:t.origem || '', _id:t.id})),
      bloco: b ? {data:diaDe(b.inicio), ini:horaDe(b.inicio), fim:horaDe(b.fim), _id:b.id} : null,
      refs:(anxItem.get(i.id) || []).map(x => ({nome:x.nome, tipo:DE_ANEXO[x.tipo] || x.tipo, url:x.url || undefined, tam:x.tamanho_bytes || undefined, _id:x.id, _banco:true})),
      cf:Object.fromEntries((cmp.get(i.id) || []).map(x => [x.campo_id, x.valor])),
      criado:diaDe(i.criado_em), iniciado:diaDe(i.iniciado_em), feito:diaDe(i.concluido_em), sprint:i.sprint_id || undefined, marco:i.marco_id || undefined,
      arquivado:i.arquivado_em ? true : undefined, _arq:i.arquivado_em || undefined}; });

  T.ficha_campos.forEach(f => { const k = chave(f.no_id); if (!k) return; const s = d.sheets[k] || (d.sheets[k] = {campos:{}, custom:[], arquivos:[]});
    if (f.personalizado) s.custom.push({nome:f.campo, tipo:'Texto', valor:f.valor || ''}); else s.campos[f.secao + '|' + f.campo] = f.valor || ''; });
  T.anexos.filter(x => x.no_id && !x.item_id).forEach(x => { const k = chave(x.no_id); if (!k) return; const s = d.sheets[k] || (d.sheets[k] = {campos:{}, custom:[], arquivos:[]}); s.arquivos.push({nome:x.nome, tipo:DE_ANEXO[x.tipo] || x.tipo, url:x.url || undefined}); });

  const itensEt = agrupar(T.etapas_modelo_itens.slice().sort(porOrdem), 'etapa_id');
  d.template = T.etapas_modelo.slice().sort(porOrdem).map(e => ({id:e.id, _chave:e.chave, _ordem:e.ordem, nome:e.nome, expl:e.explicacao || '', lente:e.lente || '', entrega:e.entrega || '',
    itens:(itensEt.get(e.id) || []).map(it => ({id:it.id, texto:it.texto, modo:DE_MODO[it.modo] || 'Aviso', obrig:!!it.obrigatorio, prova:DE_PROVA[it.prova_tipo] || 'Nenhuma', quem:DE_QUEM[it.quem_cumpre] || 'Qualquer pessoa do time', terceiros:!!it.so_terceiros}))}));
  const provas = new Map(T.provas.map(p => [p.no_id + '|' + p.item_modelo_id, p]));
  T.etapas_nos.forEach(e => { const k = chave(e.no_id); if (!k) return; const s = d.stages[k] || (d.stages[k] = {});
    if (e.situacao === 'dispensado') s[e.item_modelo_id] = {dispensa:e.motivo_dispensa || 'Dispensado', quem:e.cumprido_por, quando:diaDe(e.cumprido_em)};
    else if (e.situacao === 'cumprido'){ const p = provas.get(e.no_id + '|' + e.item_modelo_id); s[e.item_modelo_id] = {feito:true, quem:e.cumprido_por, quando:diaDe(e.cumprido_em), prova: p ? {tipo:DE_PROVA[p.tipo] || p.tipo, valor:p.valor, _id:p.id} : undefined}; } });

  const fontes = agrupar(T.agentes_fontes, 'agente_id'), ferr = agrupar(T.agentes_ferramentas, 'agente_id');
  d.agents = T.agentes.map(a => ({id:a.id, _codigo:a.codigo, nome:a.nome, papel:a.papel || '', instr:a.instrucoes || '', fontes:(fontes.get(a.id) || []).map(f => f.nome), ferramentas:(ferr.get(a.id) || []).map(f => [f.ferramenta, DE_PERM[f.permissao] || f.permissao]), passa:a.regras_passagem || ''}));

  const msgs = agrupar(T.pedidos_mensagens.slice().sort((a, b) => String(a.criado_em).localeCompare(String(b.criado_em))), 'pedido_id'), anxPed = agrupar(T.anexos.filter(x => x.pedido_id), 'pedido_id');
  d.requests = T.pedidos.slice().sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em))).map(r => ({id:r.id, cliente:acima(r.no_id, 'cliente'), app:r.no_id, tipo:DE_PT[r.tipo] || r.tipo,
    grav:DE_GR[r.gravidade] || r.gravidade, status:DE_PS[r.status] || r.status, titulo:r.titulo, quando:diaDe(r.criado_em), autor:r.autor_id || null,
    anexos:(anxPed.get(r.id) || []).map(x => ({nome:x.nome, tipo:DE_ANEXO[x.tipo] || x.tipo})), contexto:(r.contexto && r.contexto.resumo) || '', issue:r.item_id || null,
    msgs:(msgs.get(r.id) || []).map(m => ({de:m.autor_tipo === 'equipe' ? 'voce' : m.autor_tipo, txt:m.texto, _id:m.id, _banco:true})), _resolvido:r.resolvido_em || undefined}));

  d.notifs = T.notificacoes.map(n => ({id:n.id, pessoa:n.pessoa_id, titulo:n.titulo, txt:n.texto || '', item:n.item_id || '', quando:new Date(n.criado_em).getTime(), lida:!!n.lida_em, _banco:true, _lidaEm:n.lida_em || undefined}));

  const primeiro = papel => (d.people.find(p => p.acesso === (papel === 'master' ? 'owner' : papel)) || {}).id || '';
  EU_IDS = {master:primeiro('master'), dev:primeiro('dev'), stakeholder:primeiro('stakeholder')};
  if (eu && eu.pessoa_id && ['master','dev','stakeholder'].includes(eu.papel)) EU_IDS[eu.papel] = eu.pessoa_id;
  return d;
}

async function carregarDoBanco(eu){
  const sb = window.itiaBanco; if (!sb) return;
  const T = {}; BANCO.erros = [];
  await Promise.all(TABELAS_BANCO.map(async t => { try { T[t] = await lerTabela(sb, t); } catch(e){ T[t] = []; BANCO.erros.push(e.message); } }));
  clearTimeout(SYNC.timer);
  D = montarDados(T, eu);
  const ok = id => D.projects.some(p => 'project:' + p.id === id) || D.products.some(p => 'product:' + p.id === id) || D.apps.some(p => 'app:' + p.id === id) || D.ws.some(p => 'ws:' + p.id === id) || D.clients.some(p => 'client:' + p.id === id);
  if (!ok(UI.sel)) UI.sel = D.projects[0] ? 'project:' + D.projects[0].id : (D.clients[0] ? 'client:' + D.clients[0].id : 'all');
  if (UI.ovSel && UI.ovSel !== 'all' && !ok(UI.ovSel)) UI.ovSel = 'all';
  // a árvore começa aberta até os produtos, como no exemplo (as chaves antigas do exemplo não servem mais)
  const abertos = Object.keys(UI.abertos || {}).filter(k => UI.abertos[k] && ok(k));
  if (!abertos.length){ UI.abertos = {}; D.clients.forEach(x => { UI.abertos['client:' + x.id] = true; }); D.projects.forEach(x => { UI.abertos['project:' + x.id] = true; }); D.products.forEach(x => { UI.abertos['product:' + x.id] = true; }); }
  BANCO.regrasDoBanco = !!(T.regras_calculo && T.regras_calculo.length);
  BANCO.carregado = true; BANCO.quando = new Date(); DOM.cache = null; DOM.aberto = null;
  marcarBase();
  const chip = $('.chip-exemplo'); if (chip){ chip.textContent = 'Dados do banco'; chip.classList.add('do-banco'); chip.title = 'Tudo nesta tela vem do banco (Supabase), lido em ' + BANCO.quando.toLocaleString('pt-BR'); }
  if (BANCO.erros.length){ console.warn('Tabelas que não deu para ler:', BANCO.erros); toast('Algumas partes do banco não puderam ser lidas (' + BANCO.erros.length + '). Veja em Settings.'); }
}
window.itiaCarregarBanco = carregarDoBanco;
window.itiaBancoInfo = () => BANCO;
function painelBanco(){
  const b = BANCO, cont = [['Pessoas', D.people.length], ['Clientes', D.clients.length], ['Projetos', D.projects.length], ['Produtos', D.products.length], ['Aplicações', D.apps.length],
    ['Frentes', D.ws.length], ['Itens', D.issues.length], ['Pedidos', D.requests.length], ['Serviços', D.catalog.length], ['Custos técnicos', D.custos.length],
    ['Custos da operação', D.opCustos.length], ['Receitas', D.receitas.length], ['Agentes', D.agents.length]];
  return '<h2 class="sub">Dados do banco</h2>' +
    '<p class="sec" style="font-size:13px;margin:0 0 10px">Tudo o que aparece no sistema vem do banco (Supabase)' + (b.quando ? ', lido em ' + esc(b.quando.toLocaleString('pt-BR')) : '') + '. Nada de exemplo e nada guardado no navegador.</p>' +
    '<div class="tabela-rolo"><table class="tabela"><thead><tr><th>O quê</th><th>No banco</th></tr></thead><tbody>' + cont.map(([n, q]) => '<tr><td>' + n + '</td><td>' + q + '</td></tr>').join('') + '</tbody></table></div>' +
    (b.erros.length ? '<p class="sec" style="font-size:13px;color:var(--vermelho,#FF0000)">Não deu para ler: ' + b.erros.map(esc).join(' · ') + '</p>' : '') +
    '<div class="acoes"><button class="btn sec" type="button" data-acao="reler-banco">Ler o banco de novo</button><span class="sec" style="font-size:13px">Tudo o que você muda nas telas é gravado no banco na hora (o selo embaixo do menu mostra "Salvando..."). Arquivos (imagem, áudio, vídeo) ainda não vão para o banco; links vão.</span></div>';
}

/* ---------- Clients: ficha completa numa janela (cadastro, projetos e o painel de cada projeto) ---------- */
const FICHA_CLI = [
  ['Identificação', [['razao_social','Razão social','largo'], ['nome_fantasia','Nome fantasia'], ['documento','CNPJ ou CPF'], ['inscricao_estadual','Inscrição estadual'], ['inscricao_municipal','Inscrição municipal'],
    ['data_abertura','Data de abertura','', 'date'], ['natureza_juridica','Natureza jurídica'], ['porte','Porte'],
    ['regime_tributario','Regime tributário','', 'sel', [['','Não informado'],['simples','Simples Nacional'],['mei','MEI'],['presumido','Lucro Presumido'],['real','Lucro Real'],['isento','Isento'],['outro','Outro']]],
    ['cnae_principal','CNAE principal','largo'], ['situacao_cadastral','Situação cadastral']]],
  ['Endereço', [['cep','CEP'], ['logradouro','Rua ou avenida','largo'], ['numero','Número'], ['complemento','Complemento'], ['bairro','Bairro'], ['cidade','Cidade'], ['uf','UF']]],
  ['Contato', [['email','E-mail da empresa','', 'email'], ['telefone','Telefone'], ['site','Site','largo'], ['contato_nome','Pessoa de contato'], ['contato_cargo','Cargo'], ['contato_email','E-mail do contato','', 'email'], ['contato_telefone','Telefone do contato']]],
  ['Observações', [['observacoes','Observações','largo', 'area']]]
];
const CAMPOS_FICHA_CLI = FICHA_CLI.flatMap(s => s[1].map(c => c[0])).filter(k => k !== 'documento');
const FC = {cli:null, aba:'ficha', sel:null, dlg:null};
const fichaDe = c => Object.assign({documento:c.doc || ''}, c.ficha || {});
const somenteNum = v => String(v || '').replace(/\D/g, '');
function fmtDoc(v){ const n = somenteNum(v); if (n.length === 14) return n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5'); if (n.length === 11) return n.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4'); return v || ''; }
const projsDoCliente = id => D.projects.filter(p => p.client === id);

function fcCorpoFicha(c){
  const f = fichaDe(c), m = souMaster(), dis = m ? '' : ' disabled';
  const campo = ([k, rot, larg, tipo, ops]) => {
    const v = f[k] == null ? '' : String(f[k]);
    const ctl = tipo === 'sel' ? '<select class="sel" data-fc="' + k + '"' + dis + '>' + ops.map(([o, n]) => '<option value="' + o + '"' + (v === o ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>'
      : tipo === 'area' ? '<textarea class="campo" data-fc="' + k + '" rows="3"' + dis + '>' + esc(v) + '</textarea>'
      : '<input class="campo" data-fc="' + k + '" type="' + (tipo || 'text') + '" value="' + esc(k === 'documento' ? fmtDoc(v) : v) + '"' + (k === 'uf' ? ' maxlength="2" style="text-transform:uppercase"' : '') + dis + '>';
    return '<label class="lb' + (larg ? ' ' + larg : '') + '">' + rot + ctl + '</label>';
  };
  return '<div class="fc-ficha">' + FICHA_CLI.map(([tit, cs]) => '<section class="fc-sec"><h3>' + tit + '</h3><div class="grade-form">' + cs.map(campo).join('') + '</div></section>').join('') +
    (m ? '<div class="acoes"><button class="btn acento" type="button" data-fc-salvar>Salvar ficha</button>' + (COM_BANCO ? '<span class="sec" style="font-size:13px">Grava direto no banco.</span>' : '') + '</div>' : '') + '</div>';
}
function fcCardProjeto(p){
  const chave = 'project:' + p.id, m = metricas(issuesEm(chave));
  const prods = D.products.filter(x => x.project === p.id).length, apps = D.apps.filter(a => a.project === p.id).length;
  const st = {active:'Ativo', on_hold:'Pausado', done:'Concluído', archived:'Arquivado'}[p.status] || p.status;
  return '<button type="button" class="fc-card" data-fc-ir="' + chave + '"><span class="fc-card-top"><b>' + esc(p.nome) + '</b><span class="fc-st fc-st-' + esc(p.status) + '">' + st + '</span></span>' +
    '<span class="fc-card-num"><span><b>' + prods + '</b> produto' + (prods === 1 ? '' : 's') + '</span><span><b>' + apps + '</b> aplicaç' + (apps === 1 ? 'ão' : 'ões') + '</span><span><b>' + m.n + '</b> ite' + (m.n === 1 ? 'm' : 'ns') + '</span></span>' +
    '<span class="fc-barra"><i style="width:' + m.prog + '%"></i></span><span class="fc-card-rod"><span>' + m.prog + '% concluído</span>' + (m.atr ? '<span class="fc-atr">' + m.atr + ' atrasado' + (m.atr === 1 ? '' : 's') + '</span>' : '') + '</span>' +
    '<span class="fc-card-datas">' + (p.inicio ? 'Início ' + fmtData(p.inicio) : 'Sem data de início') + (p.alvo ? ' · Meta ' + fmtData(p.alvo) : '') + '</span></button>';
}
function fcCorpoProjetos(c){
  const ps = projsDoCliente(c.id);
  if (!FC.sel){
    if (!ps.length) return '<p class="sec" style="margin:0">Este cliente ainda não tem projeto. Crie em Operações, no botão "+ Projeto" da Estrutura.</p>';
    return '<p class="sec" style="margin:0 0 12px">Clique num projeto para abrir o painel dele.</p><div class="fc-cards">' + ps.map(fcCardProjeto).join('') + '</div>';
  }
  const trilha = caminho(FC.sel).filter(([k]) => !k.startsWith('client:'));
  return '<div class="fc-nav"><nav class="fc-trilha" aria-label="Onde você está"><button type="button" data-fc-ir="">Projetos</button>' + trilha.map(([k, n]) => '<span aria-hidden="true">›</span><button type="button" data-fc-ir="' + k + '"' + (k === FC.sel ? ' aria-current="page"' : '') + '>' + esc(n) + '</button>').join('') + '</nav>' +
    '<div class="fc-nav-dir">' + (ps.length > 1 ? '<select class="sel" data-fc-projeto aria-label="Trocar de projeto">' + ps.map(p => '<option value="project:' + p.id + '"' + (trilha[0] && trilha[0][0] === 'project:' + p.id ? ' selected' : '') + '>' + esc(p.nome) + '</option>').join('') + '</select>' : '') +
    '<button class="btn sec peq" type="button" data-fc-operacoes>Abrir em Operações</button></div></div>' +
    '<div class="fc-painel">' + painelHTML(FC.sel) + '</div>';
}
function fcDesenhar(){
  const dlg = FC.dlg; if (!dlg || !dlg.isConnected) return;
  const c = byId('clients', FC.cli); if (!c){ dlg.close(); dlg.remove(); return; }
  const f = fichaDe(c), n = projsDoCliente(c.id).length;
  const tipo = {holding:'Holding', empresa:'Empresa', pessoa:'Pessoa'}[c.tipo] || c.tipo;
  dlg.querySelector('.modal-cab h2').innerHTML = esc(c.nome) + ' <span class="fc-tipo">' + esc(tipo) + '</span>' + (f.documento ? ' <span class="fc-doc">' + esc(fmtDoc(f.documento)) + '</span>' : '');
  const rolo = dlg.querySelector('.modal-corpo'); const topo = rolo.scrollTop;
  rolo.innerHTML = '<div class="views fc-abas" role="tablist"><button class="view-b" type="button" role="tab" data-fc-aba="ficha" aria-selected="' + (FC.aba === 'ficha') + '">Ficha cadastral</button>' +
    '<button class="view-b" type="button" role="tab" data-fc-aba="projetos" aria-selected="' + (FC.aba === 'projetos') + '">Projetos (' + n + ')</button></div>' +
    (FC.aba === 'ficha' ? fcCorpoFicha(c) : fcCorpoProjetos(c));
  rolo.scrollTop = FC.aba === 'projetos' && FC.sel ? 0 : topo;
}
function abrirFichaCliente(id, aba){
  FC.cli = id; FC.aba = aba || 'ficha'; FC.sel = null;
  FC.dlg = modal('', '', []); FC.dlg.classList.add('modal-ficha');
  fcDesenhar();
}
async function fcSalvar(){
  const c = byId('clients', FC.cli); if (!c || !souMaster()) return;
  const dlg = FC.dlg, val = k => { const e = dlg.querySelector('[data-fc="' + k + '"]'); return e ? e.value.trim() : ''; };
  const novo = {}; CAMPOS_FICHA_CLI.forEach(k => { novo[k] = val(k) || null; });
  if (novo.uf) novo.uf = novo.uf.toUpperCase();
  if (novo.uf && !/^[A-Z]{2}$/.test(novo.uf)){ toast('A UF tem 2 letras, como SP'); return; }
  const doc = val('documento'), nd = somenteNum(doc);
  if (doc && nd.length !== 11 && nd.length !== 14){ toast('O CNPJ tem 14 números e o CPF tem 11'); return; }
  const btn = dlg.querySelector('[data-fc-salvar]'); if (btn) btn.disabled = true;
  if (COM_BANCO && window.itiaBanco){
    const {data, error} = await window.itiaBanco.from('clientes').update(Object.assign({documento: doc ? fmtDoc(doc) : null}, novo)).eq('no_id', c.id).select('no_id');
    if (btn) btn.disabled = false;
    if (error){ toast('Não gravou no banco: ' + error.message); return; }
    if (!data || !data.length){ toast('O banco não deixou gravar (confira se você entrou como Master)'); return; }
  } else if (btn) btn.disabled = false;
  c.doc = doc ? fmtDoc(doc) : ''; c.ficha = novo; salvar(); fcDesenhar(); rClientes(); toast('Ficha salva');
}
document.addEventListener('click', ev => {
  const linha = ev.target.closest('[data-ficha-cliente]');
  if (linha && !ev.target.closest('button, a, input, select, .tag, .tags')){ abrirFichaCliente(linha.dataset.fichaCliente); return; }
  const b = ev.target.closest('[data-abrir-ficha]'); if (b){ abrirFichaCliente(b.dataset.abrirFicha); return; }
  if (!FC.dlg || !FC.dlg.contains(ev.target)) return;
  let x;
  if ((x = ev.target.closest('[data-fc-aba]'))){ FC.aba = x.dataset.fcAba; FC.sel = null; fcDesenhar(); return; }
  if ((x = ev.target.closest('[data-fc-ir], .fc-painel [data-ir]'))){ ev.stopPropagation(); FC.sel = (x.dataset.fcIr !== undefined ? x.dataset.fcIr : x.dataset.ir) || null; fcDesenhar(); return; }
  if (ev.target.closest('[data-fc-salvar]')){ fcSalvar(); return; }
  if (ev.target.closest('[data-fc-operacoes]')){ const k = FC.sel; FC.dlg.close(); FC.dlg.remove(); FC.dlg = null; UI.sel = k; UI.view = 'dashboard'; abrirArvore(k); abrirModulo('operacoes'); return; }
}, true);
document.addEventListener('change', ev => { if (FC.dlg && ev.target.matches('[data-fc-projeto]')){ FC.sel = ev.target.value; fcDesenhar(); } });

/* ---------- versão com login: GRAVAR no banco o que muda na tela ----------
   Cada vez que a tela chama salvar(), comparamos os dados da tela (já traduzidos para as tabelas) com a última
   versão gravada e mandamos só a diferença: linha nova vira insert, linha mudada vira update só das colunas que
   mudaram, linha que sumiu vira delete. O banco continua cuidando de automações, datas de início e conclusão e das regras. */
const PARA_ST_NO = inverter(ST_NO), PARA_MOD = inverter(DE_MOD), PARA_VINC = inverter(DE_VINC), PARA_REC = inverter(DE_REC), PARA_FORMA = inverter(DE_FORMA);
const PARA_MODO = inverter(DE_MODO), PARA_PROVA = inverter(DE_PROVA), PARA_QUEM = inverter(DE_QUEM), PARA_PERM = inverter(DE_PERM), PARA_PT = inverter(DE_PT), PARA_GR = inverter(DE_GR);
const PARA_PS = Object.assign(inverter(DE_PS), {'Resolvido pela IA':'resolvido'});
const PARA_ANEXO = {'áudio':'audio', 'vídeo':'video', imagem:'imagem', audio:'audio', video:'video', link:'link'};
// ordem de gravação: quem é pai vem antes; a exclusão segue a ordem contrária
const GRAVAR = [
  ['pessoas',['id']], ['nos',['id']], ['clientes',['no_id']], ['projetos',['no_id']], ['aplicacoes',['no_id']], ['frentes',['no_id']],
  ['participacoes',['pessoa_id','no_id'],1], ['pessoas_custos',['id']], ['etiquetas',['id']], ['etiquetas_nos',['etiqueta_id','no_id'],1], ['status_fluxo',['id']],
  ['requisitos',['id']], ['servicos',['id']], ['servicos_cobranca',['id']], ['servicos_requisitos',['servico_id','requisito_id'],1], ['regras_calculo',['vigente_desde'],1],
  ['custos_operacao',['id']], ['custos_tecnicos',['id']], ['custos_uso',['custo_id','mes'],1], ['receitas',['id']], ['slas',['no_id','gravidade'],1],
  ['sprints',['id']], ['marcos',['id']], ['automacoes',['id']], ['campos_personalizados',['id']],
  ['itens',['id']], ['itens_campos',['item_id','campo_id'],1], ['itens_checklist',['id']], ['itens_ligacoes',['origem_id','destino_id','tipo'],1], ['comentarios',['id']],
  ['blocos_agenda',['id']], ['tempo_registros',['id']], ['anexos',['id']], ['ficha_campos',['no_id','secao','campo'],1],
  ['etapas_modelo',['id']], ['etapas_modelo_itens',['id']], ['etapas_nos',['no_id','item_modelo_id'],1], ['provas',['id']],
  ['agentes',['id']], ['agentes_fontes',['id']], ['agentes_ferramentas',['agente_id','ferramenta'],1], ['pedidos',['id']], ['pedidos_mensagens',['id']], ['notificacoes',['id']]
];
const hex8 = id => String(id).replace(/[^a-f0-9]/g, '').slice(0, 8) || Math.random().toString(16).slice(2, 10);
const semVazio = v => (v === undefined || v === '' ? null : v);
const quando = (dia, hora) => dia ? new Date(dia + 'T' + (hora || '12:00') + ':00').toISOString() : null;
const idNo = chaveNo => chaveNo && chaveNo.includes(':') ? chaveNo.split(':')[1] : null;
const mesUm = off => { const d = new Date(HOJE.getFullYear(), HOJE.getMonth() + off, 1); return iso(d); };
const semPrivado = o => Object.fromEntries(Object.entries(o || {}).filter(([k, v]) => !k.startsWith('_') && v !== undefined));
const garantirId = o => o._id || (o._id = novoUuid());

function linhasDaTela(d){
  const L = Object.fromEntries(GRAVAR.map(([t]) => [t, []]));
  const eu = idEu('master') || null;
  d.people.forEach(p => {
    L.pessoas.push({id:p.id, nome:p.nome, funcao:semVazio(p.funcao), habilidades:p.skills || [], capacidade_h:Math.max(0, Math.min(80, +p.cap || 0)), papel:p.acesso === 'owner' ? 'master' : p.acesso, ativo:p.ativo !== false});
    if (p.acesso === 'stakeholder' && p.escopo && p.escopo !== 'all' && idNo(p.escopo)) L.participacoes.push({pessoa_id:p.id, no_id:idNo(p.escopo), papel:'stakeholder'});
    if (p.custo){ const c = p.custo; L.pessoas_custos.push({id:garantirId(c), pessoa_id:p.id, vinculo:PARA_VINC[c.vinculo] || 'pj', salario:+c.salario || 0, prolabore:+c.prolabore || 0, valor_pj:+c.valorPJ || 0, beneficios:+c.beneficios || 0, vigente_desde:c._desde || (c._desde = iso(HOJE))}); }
  });
  const no = (x, tipo, pai) => ({id:x.id, tipo, pai_id:pai || null, nome:x.nome, status:PARA_ST_NO[x.status] || 'ativo', motivo_pausa:x.status === 'on_hold' ? (x.motivo || 'Sem motivo informado') : semVazio(x.motivo)});
  d.clients.forEach(c => { L.nos.push(no(c, 'cliente', null));
    L.clientes.push(Object.assign({no_id:c.id, tipo_cliente:c.tipo || 'empresa', documento:semVazio(c.doc), holding_id:c.holding || null}, Object.fromEntries(CAMPOS_FICHA_CLI.map(k => [k, semVazio(c.ficha && c.ficha[k])]))));
    Object.entries(c.sla || {}).forEach(([g, v]) => { if (v && +v[0] > 0) L.slas.push({no_id:c.id, gravidade:g, horas_resposta:+v[0], horas_solucao:Math.max(+v[1] || 0, +v[0])}); }); });
  d.projects.forEach(p => { L.nos.push(no(p, 'projeto', p.client)); L.projetos.push({no_id:p.id, origem:p.origem || 'greenfield', inicio:semVazio(p.inicio), alvo:semVazio(p.alvo)}); });
  d.products.forEach(p => L.nos.push(no(p, 'produto', p.project)));
  d.apps.forEach(a => { L.nos.push(no(a, 'aplicacao', a.product || a.project)); L.aplicacoes.push({no_id:a.id, plataforma:a.plataforma || 'web', origem_codigo:a.origemCodigo || 'proprio', servico_id:semVazio(a.servico)}); });
  d.ws.forEach(w => { L.nos.push(no(w, 'frente', w.app)); L.frentes.push({no_id:w.id, wip_limite:+w.wip > 0 ? +w.wip : null}); });
  d.tags.forEach(t => L.etiquetas.push({id:t.id, nome:t.nome, cor:t.cor, categoria:semVazio(t.cat), descricao:semVazio(t.desc)}));
  d.tagLinks.forEach(l => L.etiquetas_nos.push({etiqueta_id:l.tag, no_id:l.id}));
  d.statusCustom.forEach(s => L.status_fluxo.push({id:s.id, no_id:idNo(s.no), chave:s._chave || (s._chave = 'c_' + hex8(s.id)), nome:s.nome, cor:s.cor, grupo:s.grupo}));
  const reqIds = BANCO.reqIds || (BANCO.reqIds = {});
  Object.entries(d.baseline || {}).forEach(([nome, padrao]) => L.requisitos.push({id:reqIds[nome] || (reqIds[nome] = novoUuid()), nome, padrao:!!padrao}));
  d.catalog.forEach(s => {
    L.servicos.push({id:s.id, codigo:s._codigo || (s._codigo = 'sv_' + hex8(s.id)), categoria:s.cat || 'Outro', nome:s.nome, descricao:semVazio(s.desc), entregaveis:s.entrega || [], frentes_padrao:s.frentes || [],
      horas_min:+(s.horas || [])[0] || 0, horas_max:Math.max(+(s.horas || [])[1] || 0, +(s.horas || [])[0] || 0), sla:semVazio(s.sla), checklist_inicio:s.check || [], ativo:s.ativo !== false});
    (s.preco || []).forEach((c, k) => { const par = semPrivado(c); delete par.m; L.servicos_cobranca.push({id:garantirId(c), servico_id:s.id, modelo:PARA_MOD[c.m] || c.m, parametros:par, ordem:k}); });
    (s.req || []).forEach(n => { if (reqIds[n]) L.servicos_requisitos.push({servico_id:s.id, requisito_id:reqIds[n]}); });
  });
  if (BANCO.regrasDoBanco || d.regras._editada){ const R = d.regras, E = R.encargos || {}, I = R.impostos || {};
    L.regras_calculo.push({vigente_desde:R._desde || (R._desde = iso(HOJE)), regime:R.regime, aliq_simples:+I.simples || 0, aliq_presumido:+I.presumido || 0, aliq_real:+I.real || 0, inss_patronal:+E.inss || 0, rat:+E.rat || 0,
      terceiros:+E.terceiros || 0, fgts:+E.fgts || 0, ferias:+E.ferias || 0, terco_ferias:+E.terco || 0, decimo_terceiro:+E.decimo || 0, multa_fgts:+E.multaFgts || 0, horas_mes:+R.horasMes || 168,
      faturavel_pct:Math.min(100, Math.max(1, +R.faturavel || 100)), margem_pct:+R.margem || 0, contingencia_pct:+R.risco || 0, folga_rateio_pct:+R.reservaOverhead || 0, manutencao_pct:+R.manutencaoAnual || 0,
      cambio_usd:+R.cambio > 0 ? +R.cambio : 1, complexidade:R.complexidade || {'Média':1}, urgencia:R.urgencia || {Normal:1}}); }
  d.opCustos.forEach(o => { const rec = PARA_REC[o.rec] || 'mensal';
    L.custos_operacao.push({id:o.id, nome:o.nome, categoria:o.cat || 'Outros', valor:+o.valor || 0, moeda:o.moeda || 'BRL', recorrencia:rec === 'uso' ? 'mensal' : rec, meses_depreciacao:rec === 'depreciacao' ? (+o.meses || 12) : null, inicio:o.inicio || (o.inicio = iso(HOJE)), fim:semVazio(o.fim)}); });
  d.custos.forEach(c => { const u = c.uso || null, rec = PARA_REC[c.rec] || 'mensal';
    L.custos_tecnicos.push({id:c.id, no_id:c.app || c.cliente, fornecedor:c.fornecedor, categoria:c.cat || 'Outros', descricao:semVazio(c.desc), recorrencia:rec === 'depreciacao' ? 'mensal' : rec, moeda:c.moeda || 'BRL', valor:+c.valor || 0,
      unidade:u ? semVazio(u.unidade) : null, limite:u && +u.limite > 0 ? +u.limite : null, plano:u ? semVazio(u.plano) : null, proximo_plano:u && u.prox ? semVazio(u.prox.nome) : null, proximo_valor:u && u.prox && u.prox.valor != null ? +u.prox.valor : null,
      extra_por_unidade:u && u.prox && u.prox.extraUnidade != null ? +u.prox.extraUnidade : null, repasse:!!c.repasse, taxa_repasse_pct:+c.markup || 0, inicio:c.inicio || (c.inicio = iso(HOJE)), fim:semVazio(c.fim)});
    if (u && u.hist) u.hist.forEach((q, k) => { const mes = (u._meses && u._meses.length === u.hist.length) ? u._meses[k] : mesUm(k - u.hist.length + 1); L.custos_uso.push({custo_id:c.id, mes, quantidade:+q || 0}); }); });
  d.receitas.forEach(r => { const forma = PARA_FORMA[r.rec] || 'unica';
    L.receitas.push({id:r.id, no_id:r.app || r.project || r.cliente, servico_id:semVazio(r.servico), descricao:r.desc || 'Receita', modelo:PARA_MOD[r.modelo] || r.modelo || 'fixo', valor:+r.valor || 0, moeda:'BRL', forma, parcelas:forma === 'parcelada' ? (+r.parcelas || 2) : null, inicio:r.inicio || (r.inicio = iso(HOJE)), fim:semVazio(r.fim)}); });
  d.sprints.forEach(s => L.sprints.push({id:s.id, projeto_id:s.project, nome:s.nome, meta:semVazio(s.meta), inicio:s.ini, fim:s.fim, status:s.status || 'planejado'}));
  d.marcos.forEach(m => L.marcos.push({id:m.id, no_id:idNo(m.no), tipo:m.tipo || 'marco', nome:m.nome, descricao:semVazio(m.desc), data:m.data, visivel_cliente:m.vis !== false, entregue_em:m.entregue ? quando(m.entregue) : null}));
  d.automacoes.forEach(a => { const c = a.cond || {}, p = a.param || {};
    L.automacoes.push({id:a.id, no_id:idNo(a.no), nome:a.nome, gatilho:a.gatilho, condicao:semPrivado({tipo:c.tipo || undefined, grupo:c.grupo || undefined, prioridade:c.prio || undefined}), acao:a.acao,
      parametros:semPrivado({para:p.para || undefined, titulo:p.titulo || undefined, texto:p.texto || undefined, pessoa_id:p.pessoa || undefined, prioridade:p.prio || undefined, status:p.status || undefined, visivel_cliente:p.cliente || undefined}), ativa:a.ativa !== false}); });
  d.camposItem.forEach(c => L.campos_personalizados.push({id:c.id, no_id:idNo(c.no), nome:c.nome, tipo:c.tipo, opcoes:c.opcoes || []}));

  const stPad = BANCO.stPadrao || {}, idsCustom = new Set(d.statusCustom.map(s => s.id));
  // referências para o que não existe mais ficam vazias (o banco recusaria)
  const temItem = new Set(d.issues.map(i => i.id)), temSprint = new Set(d.sprints.map(s => s.id)), temMarco = new Set(d.marcos.map(m => m.id)), temPessoa = new Set(d.people.map(p => p.id));
  const ref = (v, conj) => v && conj.has(v) ? v : null;
  const PONTOS = [1, 2, 3, 5, 8, 13, 21];
  d.issues.forEach(i => {
    const st = i.st && idsCustom.has(i.st) ? i.st : idsCustom.has(i.status) ? i.status : stPad[i.status];
    L.itens.push({id:i.id, frente_id:i.ws, pai_id:ref(i.pai, temItem), tipo:i.tipo, titulo:i.titulo, descricao:semVazio(i.desc), status_id:st || null, prioridade:i.prio || 'medium', responsavel_id:ref(i.resp, temPessoa), relator_id:ref(i.rep, temPessoa),
      estimativa_h:i.est == null || i.est === '' ? null : +i.est, pontos:PONTOS.includes(+i.pontos) ? +i.pontos : null, inicio:semVazio(i.ini), prazo:semVazio(i.fim), data_prevista:semVazio(i.alvo),
      visivel_cliente:i.vis === 'cliente', sprint_id:ref(i.sprint, temSprint), marco_id:ref(i.marco, temMarco), arquivado_em:i.arquivado ? (i._arq || (i._arq = new Date().toISOString())) : null});
    Object.entries(i.cf || {}).forEach(([k, v]) => { if (v !== '' && v != null) L.itens_campos.push({item_id:i.id, campo_id:k, valor:String(v)}); });
    (i.check || []).forEach((c, k) => L.itens_checklist.push({id:garantirId(c), item_id:i.id, texto:c.t, feito:!!c.f, ordem:k}));
    (i.links || []).forEach(l => { const t = {'Blocks':'bloqueia', 'Is blocked by':'bloqueia', 'Relates to':'relacionado', 'Duplicates':'duplica'}[l.tipo] || 'relacionado';
      const [o2, d2] = l.tipo === 'Is blocked by' ? [l.alvo, i.id] : [i.id, l.alvo]; if (o2 && d2 && o2 !== d2 && temItem.has(o2) && temItem.has(d2)) L.itens_ligacoes.push({origem_id:o2, destino_id:d2, tipo:t}); });
    (i.coments || []).forEach(c => { if (c.txt && c.txt.trim()) L.comentarios.push({id:garantirId(c), item_id:i.id, autor_id:ref(c.quem, temPessoa), texto:c.txt, visivel_cliente:!!c.cliente}); });
    if (i.bloco && ref(i.resp, temPessoa) && i.bloco.data) L.blocos_agenda.push({id:garantirId(i.bloco), item_id:i.id, pessoa_id:i.resp, inicio:quando(i.bloco.data, i.bloco.ini || '09:00'), fim:quando(i.bloco.data, i.bloco.fim || '10:00')});
    (i.tempo || []).forEach(t => { if (!ref(t.quem, temPessoa) || !t.ini) return; const org = {Timer:'cronometro', Manual:'manual', manual:'manual'}[t.origem] || 'cronometro';
      if (t.fim && t.fim <= t.ini) return; if (org === 'manual' && !t.fim) return;
      L.tempo_registros.push({id:garantirId(t), pessoa_id:t.quem, origem:org, item_id:i.id, inicio:new Date(t.ini).toISOString(), fim:t.fim ? new Date(t.fim).toISOString() : null}); });
    (i.refs || []).forEach(x => { if (x.tipo === 'link' && x.url) L.anexos.push({id:garantirId(x), nome:x.nome || x.url, tipo:'link', url:x.url, item_id:i.id}); else if (!x._banco) BANCO.arquivosFora = true; });
  });
  Object.entries(d.sheets || {}).forEach(([k, s]) => { const nid = idNo(k); if (!nid) return;
    Object.entries(s.campos || {}).forEach(([sc, v]) => { const [secao, campo] = sc.split('|'); if (campo && v !== '' && v != null) L.ficha_campos.push({no_id:nid, secao, campo, valor:String(v), personalizado:false}); });
    (s.custom || []).forEach(c => { if (c.nome) L.ficha_campos.push({no_id:nid, secao:'Custom fields', campo:c.nome, valor:String(c.valor || ''), personalizado:true}); }); });
  const ordens = d.template.map(e => e._ordem).filter(x => x != null); let prox = (ordens.length ? Math.max(...ordens) : -1) + 1;
  d.template.forEach(e => { if (e._ordem == null) e._ordem = prox++;
    L.etapas_modelo.push({id:e.id, chave:e._chave || (e._chave = 'et_' + hex8(e.id)), nome:e.nome, explicacao:semVazio(e.expl), lente:semVazio(e.lente), entrega:semVazio(e.entrega), ordem:e._ordem});
    (e.itens || []).forEach((it, k) => L.etapas_modelo_itens.push({id:it.id, etapa_id:e.id, texto:it.texto, modo:PARA_MODO[it.modo] || 'aviso', obrigatorio:it.obrig !== false, prova_tipo:PARA_PROVA[it.prova] || 'nenhuma',
      quem_cumpre:PARA_QUEM[it.quem] || 'qualquer_um', so_terceiros:!!it.terceiros, ordem:k})); });
  Object.entries(d.stages || {}).forEach(([k, itens]) => { const nid = idNo(k); if (!nid) return;
    Object.entries(itens || {}).forEach(([mid, s]) => { if (!s || !(s.feito || s.dispensa)) return;
      L.etapas_nos.push({no_id:nid, item_modelo_id:mid, situacao:s.dispensa ? 'dispensado' : 'cumprido', cumprido_por:s.quem || eu, cumprido_em:quando(s.quando || iso(HOJE)), motivo_dispensa:s.dispensa || null});
      const p = s.prova, tp = p && PARA_PROVA[p.tipo]; if (p && p.valor && tp && tp !== 'nenhuma') L.provas.push({id:garantirId(p), no_id:nid, item_modelo_id:mid, tipo:tp, valor:String(p.valor), enviado_por:s.quem || eu}); }); });
  const fIds = BANCO.fonteIds || (BANCO.fonteIds = {});
  d.agents.forEach(a => { L.agentes.push({id:a.id, codigo:a._codigo || (a._codigo = 'ag_' + hex8(a.id)), nome:a.nome, papel:semVazio(a.papel), instrucoes:a.instr || '', regras_passagem:semVazio(a.passa)});
    [...new Set(a.fontes || [])].forEach(n => { const k = a.id + '|' + n; L.agentes_fontes.push({id:fIds[k] || (fIds[k] = novoUuid()), agente_id:a.id, nome:n}); });
    (a.ferramentas || []).forEach(([f, p]) => L.agentes_ferramentas.push({agente_id:a.id, ferramenta:f, permissao:PARA_PERM[p] || 'confirmacao'})); });
  const agIA = (d.agents.find(a => /atendimento/i.test(a.nome)) || d.agents[0] || {}).id;
  d.requests.forEach(r => { const st = PARA_PS[r.status] || 'novo', fechado = st === 'resolvido' || st === 'recusado';
    L.pedidos.push({id:r.id, no_id:r.app, autor_id:r.autor || null, tipo:PARA_PT[r.tipo] || 'duvida', gravidade:PARA_GR[r.grav] || 'incomodo', status:st, titulo:r.titulo, contexto:{resumo:r.contexto || ''}, item_id:r.issue || null,
      resolvido_em:fechado ? (r._resolvido || (r._resolvido = new Date().toISOString())) : null});
    (r.msgs || []).forEach(m => { const tipo = m.de === 'voce' ? 'equipe' : m.de; if (tipo === 'ia' && !agIA) return;
      L.pedidos_mensagens.push({id:garantirId(m), pedido_id:r.id, autor_tipo:tipo, pessoa_id:tipo === 'cliente' ? (r.autor || null) : tipo === 'equipe' ? eu : null, agente_id:tipo === 'ia' ? agIA : null, texto:m.txt || null}); }); });
  (d.notifs || []).forEach(n => { if (n._banco) L.notificacoes.push({id:n.id, lida_em:n.lida ? (n._lidaEm || (n._lidaEm = new Date().toISOString())) : null}); });
  // pai antes do filho, dentro das tabelas que se referem a si mesmas
  const prof = {cliente:0, projeto:1, produto:2, aplicacao:3, frente:4}; L.nos.sort((a, b) => prof[a.tipo] - prof[b.tipo]);
  const nivel = id => { let n = 0, i = d.issues.find(x => x.id === id); while (i && i.pai && n < 6){ n++; i = d.issues.find(x => x.id === i.pai); } return n; };
  L.itens.sort((a, b) => nivel(a.id) - nivel(b.id));
  return L;
}

const SYNC = {base:null, rodando:false, deNovo:false, timer:0, erros:[], pendente:false};
const chaveLinha = (row, pk) => pk.map(k => row[k]).join('|');
const indexar = L => Object.fromEntries(GRAVAR.map(([t, pk]) => [t, new Map((L[t] || []).map(r => [chaveLinha(r, pk), r]))]));
const igual = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
function marcarBase(){ SYNC.base = indexar(JSON.parse(JSON.stringify(linhasDaTela(D)))); }
function selo(txt, erro){ const c = $('.chip-exemplo'); if (!c) return; c.textContent = txt; c.classList.toggle('com-erro', !!erro); }

async function gravarNoBanco(){
  const sb = window.itiaBanco; if (!sb || !SYNC.base) return;
  if (SYNC.rodando){ SYNC.deNovo = true; return; }
  SYNC.rodando = true; SYNC.pendente = false; SYNC.erros = []; selo('Salvando...');
  const agora = indexar(JSON.parse(JSON.stringify(linhasDaTela(D))));
  const falha = (t, op, msg) => { SYNC.erros.push(t + ' (' + op + '): ' + msg); console.warn('Banco', t, op, msg); };
  let mexeuItens = false;
  // 1) apagar o que sumiu (filhos primeiro)
  for (const [t, pk] of GRAVAR.slice().reverse()){
    if (t === 'notificacoes') continue;
    for (const [k, row] of [...SYNC.base[t]].reverse()) if (!agora[t].has(k)){
      const filtro = Object.fromEntries(pk.map(c => [c, row[c]]));
      const {error} = await sb.from(t).delete().match(filtro);
      if (error) falha(t, 'apagar', error.message); else { SYNC.base[t].delete(k); if (t === 'itens') mexeuItens = true; }
    }
  }
  // 2) incluir e alterar (pais primeiro)
  for (const [t, pk, natural] of GRAVAR){
    for (const [k, row] of agora[t]){
      const antes = SYNC.base[t].get(k);
      if (!antes){
        if (t === 'notificacoes') continue;
        const {error} = natural ? await sb.from(t).upsert(row, {onConflict:pk.join(',')}) : await sb.from(t).insert(row);
        if (error) falha(t, 'incluir', error.message); else { SYNC.base[t].set(k, row); if (t === 'itens') mexeuItens = true; }
        continue;
      }
      const mud = {}; Object.keys(row).forEach(c => { if (!pk.includes(c) && !igual(row[c], antes[c])) mud[c] = row[c]; });
      if (!Object.keys(mud).length) continue;
      const filtro = Object.fromEntries(pk.map(c => [c, row[c]]));
      const {data, error} = await sb.from(t).update(mud).match(filtro).select(pk[0]);
      if (error) falha(t, 'alterar', error.message);
      else if (!data || !data.length) falha(t, 'alterar', 'o banco não deixou alterar (permissão)');
      else { SYNC.base[t].set(k, row); if (t === 'itens') mexeuItens = true; }
    }
  }
  SYNC.rodando = false;
  if (SYNC.erros.length){ selo('Erro ao salvar', true); const c = $('.chip-exemplo'); if (c) c.title = 'Não gravou: ' + SYNC.erros.join(' · ');
    const txt = SYNC.erros.join('|'); if (txt !== SYNC.ultimoErro) toast('Não deu para gravar tudo no banco: ' + SYNC.erros[0] + (SYNC.erros.length > 1 ? ' (e mais ' + (SYNC.erros.length - 1) + ')' : '')); SYNC.ultimoErro = txt; }
  else { SYNC.ultimoErro = ''; selo('Dados do banco'); const c = $('.chip-exemplo'); if (c) c.title = 'Tudo gravado no banco'; if (BANCO.arquivosFora){ BANCO.arquivosFora = false; toast('Os links foram gravados. Arquivos (imagem, áudio, vídeo) ainda não vão para o banco.'); } }
  if (SYNC.deNovo){ SYNC.deNovo = false; return gravarNoBanco(); }
  // as automações rodam no banco: se mexeu em itens e há automação ligada, relê para mostrar o resultado
  if (mexeuItens && D.automacoes.some(a => a.ativa !== false)) setTimeout(() => { if (!document.querySelector('dialog[open]') && !SYNC.rodando) carregarDoBanco(null).then(render); }, 600);
}
if (COM_BANCO){
  salvar = function(){ if (!BANCO.carregado) return; SYNC.pendente = true; clearTimeout(SYNC.timer); SYNC.timer = setTimeout(gravarNoBanco, 350); };
  rodarAutomacoes = function(){};   // no banco, as automações rodam sozinhas (gatilho itens_automacoes)
  checarPrazosVencidos = function(){};
  window.addEventListener('beforeunload', e => { if (SYNC.rodando || SYNC.pendente){ e.preventDefault(); e.returnValue = ''; } });
}
window.itiaGravarAgora = gravarNoBanco;
window.itiaSync = SYNC;
