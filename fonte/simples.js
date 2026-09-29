/* ================= Simplificar: nomes em português, abas agrupadas e a tela do item organizada =================
   Carrega por último: só troca nomes e reorganiza o que as camadas anteriores montaram, sem mudar dado nenhum. */

/* ---------- vocabulário em português (o id guardado no banco continua o mesmo) ---------- */
[['backlog','Na fila','ainda não planejado'],['todo','A fazer','planejado, ninguém começou'],['doing','Fazendo','alguém está trabalhando nele'],['review','Em revisão','pronto, esperando conferência'],['blocked','Travado','parado, esperando algo'],['done','Feito','concluído']]
  .forEach(([id, nome, expl]) => { const s = STATUS.find(x => x.id === id); if (s){ s.en = s.nome; s.nome = nome; s.expl = expl; } });
[['highest','Urgente','largar o resto e fazer já'],['high','Alta','fazer antes das outras'],['medium','Média','no ritmo normal'],['low','Baixa','quando der']]
  .forEach(([id, nome, expl]) => { const p = PRIOS.find(x => x.id === id); if (p){ p.en = p.nome; p.nome = nome; p.expl = expl; } });
[['epic','Épico','entrega grande, reúne várias histórias'],['story','História','algo que o usuário vai ver ou usar'],['task','Tarefa','trabalho a fazer'],['subtask','Subtarefa','parte de uma tarefa'],['bug','Defeito','algo que não funciona como deveria']]
  .forEach(([id, nome, expl]) => { const t = TIPOS.find(x => x.id === id); if (t){ t.en = t.nome; t.nome = nome; t.expl = expl; } });
[['active','Ativo','em andamento'],['on_hold','Pausado','parado por um motivo'],['done','Concluído','terminado'],['archived','Arquivado','guardado, sai das listas']]
  .forEach(([id, nome, expl]) => { const e = EST.find(x => x.id === id); if (e){ e.nome = nome; e.expl = expl; } });
Object.assign(GRUPO_NOME, {backlog:'Na fila', todo:'A fazer', doing:'Fazendo', review:'Em revisão', blocked:'Travado', done:'Feito'});

/* ---------- nomes do menu ---------- */
const SM_MODULOS = {overview:'Visão geral', clientes:'Clientes', catalog:'Catálogo', custos:'Custos', servicedesk:'Atendimento', time:'Equipe', configuracoes:'Configurações'};
$$('.menu .item[data-tela]').forEach(el => { const n = SM_MODULOS[el.dataset.tela]; if (!n) return; el.dataset.nome = n; const s = el.querySelector('.item-nome'); if (s) s.textContent = n; });

/* ---------- abas da tela de Operações ---------- */
const SM_ABAS = {
  dashboard:['Painel','Resumo do que está escolhido na estrutura: quanto já foi feito, o que está atrasado, os avisos e o que mudou.'],
  board:['Quadro','Os itens em colunas pela situação. Arraste o cartão de uma coluna para outra para mudar a situação.'],
  table:['Tabela','Os itens em linhas e colunas, como numa planilha, para ver e mudar vários campos de uma vez.'],
  calendar:['Calendário','Os itens nos dias do prazo, por mês, semana, dia ou em forma de agenda.'],
  timeline:['Linha do tempo','Cada item vira uma barra do início até o prazo, para ver o que acontece ao mesmo tempo e o que depende do quê.'],
  entregas:['Entregas','As versões, as publicações e o código ligado a este ponto da estrutura.'],
  backlog:['Fila','Tudo o que ainda vai ser feito, em ordem de prioridade, e o planejamento dos sprints.'],
  sprints:['Sprints','Períodos curtos, de 1 ou 2 semanas, com uma meta e os itens escolhidos para aquele período.'],
  list:['Lista','Os itens agrupados por situação, pessoa ou prioridade, para ler rápido tudo o que existe.'],
  workload:['Carga do time','Quantas horas cada pessoa tem em cada dia ou semana, comparado com o quanto ela aguenta.'],
  mywork:['Meu trabalho','Só os itens que estão com você, separados em atrasados, de hoje e próximos.'],
  whiteboard:['Quadro livre','Uma área livre para desenhar, colar notas e ligar ideias. As notas podem virar itens.'],
  custos:['Custos','Quanto este ponto da estrutura já gastou e já cobrou, e a previsão dos próximos meses.'],
  sheet:['Ficha técnica','As informações técnicas guardadas: linguagem, banco, integrações, regras do cliente e arquivos.'],
  stages:['Etapas','As etapas obrigatórias do processo e o que já foi cumprido em cada uma, com a prova.']
};
VIEWS.forEach(v => { const a = SM_ABAS[v[0]]; if (a){ v[1] = a[0]; v[2] = a[1]; EXPL_VIEW[v[0]] = a[1]; } });
Object.keys(SM_ABAS).forEach(k => { EXPL_VIEW[k] = SM_ABAS[k][1]; });
const SM_PRINCIPAIS = ['dashboard','board','table','calendar','timeline','entregas'];
const smFixas = () => Array.isArray(UI.abasFixas) ? UI.abasFixas : SM_PRINCIPAIS;
const SM_PINO = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" aria-hidden="true"><path d="M9 4h6l-1 6 4 3v2H6v-2l4-3z"/><path d="M12 15v6"/></svg>';

/* agrupa as abas que já estão na tela: as fixas ficam à vista, o resto vai para "Mais". Pode rodar várias vezes. */
function smAgruparAbas(){
  const nav = $('.ops-cab .views'); if (!nav) return;
  const casas = $$('.view-casa', nav).filter(c => c.querySelector('[data-view]'));
  if (casas.length < 2) return;
  const fixas = smFixas();
  const ordem = Object.keys(SM_ABAS).concat(VIEWS.map(v => v[0]));
  casas.sort((a, b) => ordem.indexOf(a.querySelector('[data-view]').dataset.view) - ordem.indexOf(b.querySelector('[data-view]').dataset.view));
  const visiveis = [], outras = [];
  casas.forEach(c => { const v = c.querySelector('[data-view]').dataset.view; (fixas.includes(v) || v === UI.view ? visiveis : outras).push(c); c.classList.toggle('sm-temp', !fixas.includes(v)); c.querySelector('[data-view]').setAttribute('aria-selected', String(v === UI.view)); });
  const velho = $('.sm-mais-casa', nav); if (velho) velho.remove();
  casas.forEach(c => nav.appendChild(c));
  visiveis.forEach(c => { c.hidden = false; }); outras.forEach(c => { c.hidden = true; });
  const todas = casas.map(c => { const b = c.querySelector('[data-view]'); return [b.dataset.view, b.textContent]; });
  nav.insertAdjacentHTML('beforeend', '<span class="sm-mais-casa"><button class="view-b sm-mais-b" type="button" aria-haspopup="true" aria-expanded="false" data-sm-mais-abas>Mais<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>' +
    '<div class="sm-abas-menu" role="menu" hidden>' +
    (outras.length ? '<ul>' + todas.filter(([v]) => outras.some(c => c.querySelector('[data-view]').dataset.view === v)).map(([v, n]) => '<li><button type="button" class="sm-aba-ir" role="menuitem" data-view="' + v + '"><b>' + esc(n) + '</b><small>' + esc(SM_DICA[v] || '') + '</small></button></li>').join('') + '</ul>' : '<p class="sm-nada">Todas as abas já estão na barra.</p>') +
    '<button type="button" class="sm-escolher" data-sm-escolher>Escolher as abas da barra</button></div></span>');
}
const SM_DICA = {dashboard:'resumo e números', board:'colunas por situação', table:'planilha dos itens', calendar:'itens por data', timeline:'barras do início ao prazo', entregas:'versões e código', backlog:'o que vem pela frente', sprints:'ciclos de 1 ou 2 semanas', list:'itens agrupados', workload:'horas de cada pessoa', mywork:'só os seus itens', whiteboard:'desenho e notas livres', custos:'gastos e receitas', sheet:'dados técnicos', stages:'etapas obrigatórias', relatorios:'gráficos do andamento', metas:'objetivos e resultados'};
// janela simples: marcar quais abas ficam na barra
function smEscolherAbas(){
  const nav = $('.ops-cab .views'); if (!nav) return;
  const todas = $$('.view-casa [data-view]', nav).map(b => [b.dataset.view, b.textContent]);
  const ordem = Object.keys(SM_ABAS); todas.sort((a, b) => ordem.indexOf(a[0]) - ordem.indexOf(b[0]));
  const fixas = smFixas();
  modal('Abas da barra', '<p style="margin:0 0 12px">Marque as abas que ficam sempre à vista. As outras continuam no botão Mais.</p><ul class="sm-escolha">' + todas.map(([v, n]) => '<li><label><input type="checkbox" value="' + v + '"' + (fixas.includes(v) ? ' checked' : '') + '><span><b>' + esc(n) + '</b><small>' + esc(SM_DICA[v] || '') + '</small></span></label></li>').join('') + '</ul>',
    [{txt:'Voltar ao padrão', cls:'sec', acao:() => { delete UI.abasFixas; salvarUI(); smAgruparAbas(); toast('Abas padrão de volta'); }}, {txt:'Cancelar', cls:'sec'}, {txt:'Salvar', acao:dl => { const f = $$('.sm-escolha input:checked', dl).map(x => x.value); if (!f.length){ toast('Marque pelo menos uma aba'); return false; } UI.abasFixas = f; salvarUI(); smAgruparAbas(); toast('Abas salvas'); }}]);
}
function smFecharMenuAbas(){ const m = $('.sm-abas-menu'); if (m && !m.hidden){ m.hidden = true; const b = $('[data-sm-mais-abas]'); if (b) b.setAttribute('aria-expanded', 'false'); } }
const _rOperacoesSm = rOperacoes;
rOperacoes = function(){ _rOperacoesSm.apply(this, arguments); smAgruparAbas(); };
const _rViewSm = rView;
rView = function(){ const r = _rViewSm.apply(this, arguments); smAgruparAbas(); return r; };
document.addEventListener('click', ev => {
  const t = ev.target;
  const mais = t.closest('[data-sm-mais-abas]');
  if (mais){ const m = mais.nextElementSibling; m.hidden = !m.hidden; mais.setAttribute('aria-expanded', String(!m.hidden)); if (!m.hidden){ const a = m.querySelector('[aria-current]') || m.querySelector('.sm-aba-ir'); if (a) a.focus(); } return; }
  if (t.closest('[data-sm-escolher]')){ smFecharMenuAbas(); smEscolherAbas(); return; }
  if (!t.closest('.sm-mais-casa')) smFecharMenuAbas();
}, true);
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && $('.sm-abas-menu:not([hidden])')){ ev.stopPropagation(); smFecharMenuAbas(); const b = $('[data-sm-mais-abas]'); if (b) b.focus(); } }, true);

/* ---------- cabeçalho do ponto escolhido: só o nome, onde fica, a situação e os botões ---------- */
const SM_TIPO_NO = {Client:'Cliente', Project:'Projeto', Product:'Produto', Application:'Aplicação', Workstream:'Frente de trabalho'};
const SM_ICO_MAIS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
function smCabecalho(){
  const cab = $('.ops-cab'), tit = cab && $('.ops-titulo', cab); if (!tit || tit.dataset.sm) return; tit.dataset.sm = '1';
  const esq = $('.titulo-esq', tit), acoes = $(':scope > .acoes', tit), h1 = esq && $('h1', esq); if (!h1) return;
  // "Projeto em Blanco & Lisboa": o tipo e onde fica, numa linha só (no lugar da trilha, que repetia o nome)
  const pequeno = $('small', h1), tipo = UI.sel === 'all' ? 'Todos os clientes e projetos' : (pequeno && (SM_TIPO_NO[pequeno.textContent.trim()] || pequeno.textContent.trim())) || '';
  if (pequeno) pequeno.remove();
  $$('button.info', h1).forEach(b => b.remove());
  if (UI.sel === 'all') smTrocarTexto(h1, 'Tudo');
  const trilha = $('.ops-trilha', cab), onde = document.createElement('p'); onde.className = 'sm-onde';
  onde.innerHTML = '<span class="sm-tipo">' + esc(tipo) + '</span>';
  if (trilha && UI.sel !== 'all'){
    const bs = $$('button', trilha).slice(0, -1);   // o último é ele mesmo
    if (bs.length){ onde.insertAdjacentHTML('beforeend', ' <span class="sm-em">em</span> '); bs.forEach((b, i) => { if (i) onde.insertAdjacentHTML('beforeend', '<span class="sm-sep" aria-hidden="true">›</span>'); onde.appendChild(b); }); }
  }
  if (trilha) trilha.classList.add('sm-escondida');
  esq.insertBefore(onde, h1);
  // linha do nome: nome, situação, etiquetas
  const linha = document.createElement('div'); linha.className = 'sm-linha'; esq.insertBefore(linha, h1); linha.appendChild(h1);
  const sel = acoes && $('select[data-estado]', acoes);
  if (sel){
    const lab = sel.closest('label'), pilula = document.createElement('span');
    pilula.className = 'sm-status'; pilula.dataset.est = sel.value; pilula.innerHTML = '<span class="sm-bola" aria-hidden="true"></span>';
    sel.setAttribute('aria-label', 'Situação');
    $$('option', sel).forEach(o => { const [n, ...x] = o.textContent.split(' · '); if (x.length){ o.title = x.join(' · '); o.textContent = n; } });
    pilula.appendChild(sel); linha.appendChild(pilula); if (lab) lab.remove();
    sel.addEventListener('change', () => { pilula.dataset.est = sel.value; });
  }
  const orig = acoes && $('select[data-rc-origem]', acoes);
  if (orig){
    const lab = orig.closest('label'), p2 = document.createElement('span'); p2.className = 'sm-status sm-neutro';
    orig.setAttribute('aria-label', 'De quem é o código'); orig.title = 'Nosso: feito pela IT.IA. De terceiros: feito por outra empresa (o Discovery ganha itens a mais).';
    $$('option', orig).forEach(o => { o.textContent = o.value === 'terceiros' ? 'Código de terceiros' : 'Código nosso'; });
    p2.appendChild(orig); linha.appendChild(p2); if (lab) lab.remove();
  }
  const tags = $('.tags', esq);
  if (tags){
    $$('.tag.sistema', tags).forEach(t => t.remove());   // "Holding: ..." repete o que a linha de cima já diz
    const add = $('[data-acao="por-tag"]', tags); if (add){ smTrocarTexto(add, 'Etiqueta'); add.classList.add('sm-add-tag'); add.title = 'Pôr uma etiqueta'; }
    tags.classList.add('sm-tags'); linha.appendChild(tags);
  }
  // botões: Mover já está em "Mais"; Mais e Excluir viram só ícone
  if (acoes){
    const mover = $('[data-acao="mover-app"]', acoes); if (mover) mover.remove();
    const mais = $('.tf-mais-cab', acoes); if (mais){ mais.innerHTML = SM_ICO_MAIS; mais.setAttribute('aria-label', 'Mais ações'); mais.title = 'Mais ações: criar dentro, duplicar, mover, arquivar'; mais.classList.add('sm-so-ico'); }
    const exc = $('.tf-excluir-cab', acoes); if (exc){ const sp = $('span', exc); if (sp) sp.remove(); exc.setAttribute('aria-label', 'Excluir'); exc.title = 'Excluir (vai para a lixeira por 30 dias)'; exc.classList.add('sm-so-ico'); acoes.appendChild(exc); }
  }
  const faixa = $('.aviso-faixa b', cab); if (faixa && /^(On Hold|Pausado)$/.test(faixa.textContent.trim())) faixa.textContent = 'Motivo da pausa:';
  $$('.ops-arvore .rc-tudo .nome').forEach(n => { n.textContent = 'Tudo'; });
  smCompartilharJunto();
}
// o botão Compartilhar chega um instante depois (multiusuario.js); vai para junto dos outros botões
function smCompartilharJunto(){
  const tit = $('#m-operacoes .ops-titulo'), comp = tit && $(':scope > .mu-comp-box', tit), acoes = tit && $(':scope > .acoes', tit);
  if (!comp || !acoes) return;
  const b = $('.mu-compartilhar', comp); if (b) b.classList.remove('peq');
  acoes.insertBefore(comp, acoes.firstChild);
}
new MutationObserver(() => { if ($('#m-operacoes .ops-titulo > .mu-comp-box')) smCompartilharJunto(); }).observe(document.querySelector('.principal') || document.body, {childList:true, subtree:true});
const _rOperacoesSmCab = rOperacoes;
rOperacoes = function(){ const r = _rOperacoesSmCab.apply(this, arguments); smCabecalho(); return r; };

/* ---------- tela do item ---------- */
const SM_ROTULOS = {
  'Priority':['Prioridade','Prioridade: quanto isso é urgente perto dos outros itens.'],
  'Assignee':['Responsável','Responsável: quem vai fazer.'],
  'Tipo':['Tipo','Tipo: épico (entrega grande), história (algo que o usuário vê), tarefa, subtarefa ou defeito.'],
  'Workstream':['Frente','Frente de trabalho: onde o item fica na estrutura.'],
  'Visibility':['Visibilidade','Visibilidade: só a equipe vê, ou o cliente também vê no painel dele.'],
  'Reporter':['Quem pediu','Quem pediu: quem abriu o item. É a pessoa avisada quando uma automação diz "avisar quem abriu".'],
  'Parent':['Item pai','Item pai: o item maior do qual este faz parte.'],
  'Sprint':['Sprint','Sprint: o ciclo curto (1 ou 2 semanas) em que o item vai ser feito.'],
  'Milestone':['Versão','Versão: a versão ou marco em que isto vai ser entregue.'],
  'Story points':['Pontos','Pontos: o tamanho do esforço, comparado com outros itens.'],
  'Start date':['Início','Início: quando o trabalho começa.'],
  'Due date':['Prazo','Prazo: até quando tem que ficar pronto.'],
  'Target date':['Entrega prevista','Entrega prevista: quando se espera entregar ao cliente.'],
  'Estimate':['Estimativa','Estimativa: quantas horas deve levar.']
};
const SM_SECOES = {'References':'Anexos e links','Child issues':'Subitens','Custom fields':'Campos','Links':'Ligações','Comments':'Comentários','Time tracking':'Tempo gasto','Time blocking':'Horário reservado'};
const SM_LIGACAO = {'Blocks':'Bloqueia','Is blocked by':'É bloqueado por','Relates to':'Tem relação com','Duplicates':'Duplica','Is duplicated by':'É duplicado por','Clones':'Copia'};
const smTextoDe = el => { const n = el && [...el.childNodes].find(x => x.nodeType === 3 && x.textContent.trim()); return n ? n.textContent.trim() : ''; };
const smTrocarTexto = (el, novo) => { const n = el && [...el.childNodes].find(x => x.nodeType === 3 && x.textContent.trim()); if (n) n.textContent = novo; };
const smTrocarInfo = (el, txt) => { const b = el && el.querySelector('button.info'); if (b){ b.dataset.info = txt; b.setAttribute('aria-label', 'O que é: ' + txt); } };
function smDobra(chave, titulo, resumo, filhos){
  const d = document.createElement('details'); d.className = 'g-cartao sm-dobra'; d.dataset.smDobra = chave;
  if (UI['smDobra_' + chave]) d.open = true;
  d.innerHTML = '<summary><h4>' + esc(titulo) + '</h4>' + (resumo ? '<span class="sm-resumo">' + resumo + '</span>' : '') + '</summary><div class="sm-dobra-corpo"></div>';
  const corpo = d.querySelector('.sm-dobra-corpo'); filhos.filter(Boolean).forEach(f => corpo.appendChild(f));
  d.addEventListener('toggle', () => { UI['smDobra_' + chave] = d.open; salvarUI(); });
  return d;
}
function smGaveta(i){
  const g = $('#gaveta-wrap .gaveta'); if (!g || !i || g.dataset.sm) return; g.dataset.sm = '1';
  const lat = $('.g-lateral', g), pri = $('.g-principal', g); if (!lat || !pri) return;
  // rótulos e explicações em português
  $$('.d-rot', g).forEach(r => { const k = smTextoDe(r), n = SM_ROTULOS[k]; if (n){ smTrocarTexto(r, n[0]); smTrocarInfo(r, n[1]); } r.closest('.d-lin').dataset.smCampo = k; });
  $$('.g-sec > h4, .g-cartao > h4', g).forEach(h => { const k = smTextoDe(h); if (SM_SECOES[k]){ smTrocarTexto(h, SM_SECOES[k]); smTrocarInfo(h, SM_SECOES[k]); } h.closest('.g-sec, .g-cartao').dataset.smSec = k; });
  $$('.g-lk-tipo', g).forEach(s => { if (SM_LIGACAO[s.textContent]) s.textContent = SM_LIGACAO[s.textContent]; });
  $$('form[data-form="link"] select[name="tipo"] option', g).forEach(o => { if (SM_LIGACAO[o.textContent]){ o.value = o.value || o.textContent; o.textContent = SM_LIGACAO[o.textContent]; } });
  $$('select[data-g="status"] option, select[data-g="prio"] option, select[data-g="tipo"] option', lat).forEach(o => { const [n, ...x] = o.textContent.split(' · '); if (x.length){ o.title = x.join(' · '); o.textContent = n; } });
  $$('input[placeholder]', pri).forEach(inp => { if (/^Novo .+ dentro deste$/.test(inp.placeholder)) inp.placeholder = 'Novo subitem: escreva o título'; });
  // o cartão principal: só o que se mexe todo dia
  const cartoes = $$(':scope > .g-cartao', lat);
  const det = cartoes[0]; if (!det) return;
  const linha = k => $('.d-lin[data-sm-campo="' + k + '"]', lat);
  smTrocarTexto(det.querySelector('h4'), 'Principal');
  ['Status','Priority','Assignee','Due date','Milestone','Sprint'].map(linha).filter(Boolean).forEach(l => det.appendChild(l));
  // "Mais detalhes": o resto, recolhido
  const sobre = document.createElement('section'); sobre.className = 'sm-grupo';
  sobre.innerHTML = '<p class="rotulo-mini">Sobre o item</p>';
  ['Tipo','Workstream','Visibility','Reporter','Parent'].map(linha).filter(Boolean).forEach(l => sobre.appendChild(l));
  $$(':scope > .d-lin', det).forEach(l => { if (!['Status','Priority','Assignee','Due date','Milestone','Sprint'].includes(l.dataset.smCampo)) sobre.appendChild(l); });
  const secao = k => cartoes.find(c => c.dataset.smSec === k || (c.querySelector('h4') && smTextoDe(c.querySelector('h4')) === k));
  const datas = secao('Datas'), estim = secao('Estimativa e conclusão'), pessoas = secao('Pessoas e etiquetas');
  if (datas && estim){ smTrocarTexto(estim.querySelector('h4'), 'Esforço e datas'); $$(':scope > .d-lin', datas).forEach(l => estim.appendChild(l)); datas.remove(); }
  const grupos = [sobre, pessoas, estim || datas].filter(Boolean).map(c => { c.classList.remove('g-cartao'); c.classList.add('sm-grupo'); const h = c.querySelector(':scope > h4'); if (h){ const p = document.createElement('p'); p.className = 'rotulo-mini'; p.innerHTML = h.innerHTML; h.replaceWith(p); } return c; });
  const dev = $(':scope > .en-dev, :scope > .en-dev-lugar', lat);
  const qtdMais = $$('.d-lin', grupos[0]).length + grupos.slice(1).reduce((s, c) => s + $$('.d-lin', c).length, 0);
  (dev || det).after(smDobra('mais', 'Mais detalhes', qtdMais + ' campos', grupos));
  // "Tempo": cronômetro e horário reservado juntos, recolhido
  const cron = secao('Time tracking'), bloco = secao('Time blocking');
  if (cron || bloco){
    const tempo = [cron, bloco].filter(Boolean).map(c => { c.classList.remove('g-cartao'); c.classList.add('sm-grupo'); const h = c.querySelector(':scope > h4'); if (h){ const p = document.createElement('p'); p.className = 'rotulo-mini'; p.innerHTML = h.innerHTML; h.replaceWith(p); } return c; });
    const gasto = $('#g-cron', g);
    const dobraT = smDobra('tempo', 'Tempo', gasto ? '<span class="sm-cron-resumo">' + esc(gasto.textContent) + '</span>' : '', tempo);
    const rod = $(':scope > .tf-rodape-item', lat);
    lat.insertBefore(dobraT, rod || null);
  }
  // corpo: a ordem de leitura do mais usado para o menos usado
  const ordem = ['Checklist','Child issues','References','Links','Custom fields','Comments'];
  const secs = ordem.map(k => $$(':scope > .g-sec', pri).find(s => s.dataset.smSec === k)).filter(Boolean);
  secs.forEach(s => pri.appendChild(s));
  $$(':scope > .g-sec', pri).forEach(s => { if (!ordem.includes(s.dataset.smSec) && !s.classList.contains('tf-desc')) pri.insertBefore(s, secs.find(x => x.dataset.smSec === 'Comments') || null); });
}
const _abrirItemSm = abrirItem;
abrirItem = function(id){ const r = _abrirItemSm.apply(this, arguments); smGaveta(byId('issues', id)); return r; };

if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {abrirItem, rOperacoes, rView, smAgruparAbas, STATUS, VIEWS});
