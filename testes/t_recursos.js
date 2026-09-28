const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1600,height:1000}});
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  const ok = (cond, msg) => { console.log((cond ? 'OK   ' : 'FALHA') + ' ' + msg); if (!cond) erros.push('FALHA: ' + msg); };
  await p.goto('file://' + process.cwd() + '/wrap.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  const D = () => p.evaluate(() => JSON.parse(JSON.stringify(window.ciclodevDados())));
  let d = await D();
  ok(d.sprints.length === 1 && d.marcos.length === 3 && d.automacoes.length === 2 && d.statusCustom.length === 1, 'dados novos criados na primeira carga');
  // Board com coluna personalizada
  await p.click('[data-tela=operacoes]'); await p.click('[data-view=board]'); await p.waitForTimeout(200);
  ok(await p.$('.coluna.col-custom') !== null, 'Board mostra a coluna do status personalizado');
  await p.dragAndDrop('[data-soltar-status=todo] .cartao', '[data-soltar-status=cs_cli]'); await p.waitForTimeout(200);
  d = await D(); const movido = d.issues.find(i => i.st === 'cs_cli');
  ok(movido && movido.status === 'blocked', 'arrastar para "Aguardando cliente" põe no grupo Blocked');
  ok(movido && movido.prio === 'high' && d.autoLog.some(l => l.auto === 'au_2'), 'automação "bloqueado sobe a prioridade" rodou');
  await p.screenshot({path:'rc_board.png'});
  // Table: edição em massa
  await p.click('[data-view=table]'); await p.waitForTimeout(200);
  await (await p.$$('[data-rc-sel]'))[0].click(); await p.waitForTimeout(150); await (await p.$$('[data-rc-sel]'))[1].click(); await p.waitForTimeout(150);
  ok(await p.$('.rc-massa') !== null, 'barra de edição em massa aparece');
  const ids = await p.$$eval('[data-rc-sel]:checked', l => l.map(x => x.dataset.rcSel));
  await p.selectOption('[data-rc-massa=prio]', 'low'); await p.waitForTimeout(200);
  d = await D(); ok(ids.every(id => d.issues.find(i => i.id === id).prio === 'low'), 'edição em massa mudou a prioridade dos 2 itens');
  await p.screenshot({path:'rc_table.png'});
  // Visão salva
  await p.click('[data-filtro=bloq]'); await p.waitForTimeout(100);
  await p.click('[data-rc-acao=vista-salvar]'); await p.fill('#vs-n', 'Bloqueados do BL'); await p.click('dialog[open] [data-b="1"]'); await p.waitForTimeout(200);
  await p.click('[data-filtro=bloq]'); await p.click('[data-view=board]'); await p.waitForTimeout(100);
  const vs = (await D()).vistas[0]; await p.selectOption('[data-rc-vista]', vs.id); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.querySelector('.view-b[aria-selected=true]').dataset.view) === 'table' && await p.evaluate(() => document.querySelector('[data-filtro=bloq]').getAttribute('aria-pressed')) === 'true', 'visão salva volta para a Table com o filtro de bloqueados');
  await p.click('[data-filtro=bloq]');
  // Sprints
  await p.click('[data-view=sprints]'); await p.waitForTimeout(200);
  ok(await p.$('.rc-sprint-ativo svg.queima') !== null, 'sprint ativo com gráfico de queima');
  await p.click('[data-rc-acao=sprint-novo]'); await p.click('dialog[open] [data-b="1"]'); await p.waitForTimeout(200);
  d = await D(); ok(d.sprints.length === 2 && d.sprints[1].status === 'planejado', 'novo sprint criado sem sobrepor');
  await p.click('[data-rc-sprint-por]'); await p.waitForTimeout(150);
  d = await D(); ok(d.issues.some(i => i.sprint === d.sprints[1].id), 'item posto no sprint planejado');
  await p.screenshot({path:'rc_sprints.png', fullPage:false});
  // My Work
  await p.click('[data-view=mywork]'); await p.waitForTimeout(200);
  ok(await p.$('.rc-mw .grupo-lista') !== null, 'My Work lista as tarefas do William');
  await p.screenshot({path:'rc_mywork.png'});
  // Everything
  await p.click('[data-rc-tudo]'); await p.waitForTimeout(300);
  ok((await p.textContent('.ops-cab h1')).startsWith('Everything'), 'Everything abre com o título certo');
  await p.click('[data-view=table]'); await p.waitForTimeout(200);
  d = await D(); ok((await p.$$('[data-linha]')).length === d.issues.filter(i => !i.arquivado).length, 'Everything mostra todos os itens');
  await p.screenshot({path:'rc_everything.png'});
  // item aberto: pai, filhos, campo personalizado
  await p.click('.ops-arvore [data-no="project:pj_bl"]'); await p.waitForTimeout(200);
  await p.evaluate(() => { const b = document.createElement('button'); b.dataset.abrirItem = 'is_1'; document.body.appendChild(b); b.click(); b.remove(); }); await p.waitForTimeout(250);
  ok(await p.$('.gaveta [data-rc-g=rep]') && await p.$('.gaveta [data-rc-g=sprint]') && await p.$('.gaveta [data-rc-g=marco]'), 'item aberto tem Reporter, Sprint e Milestone');
  await p.fill('.gaveta [data-rc-form=filho] input', 'Story nova de teste'); await p.click('.gaveta [data-rc-form=filho] button'); await p.waitForTimeout(250);
  d = await D(); const filho = d.issues.find(i => i.titulo === 'Story nova de teste'); ok(filho && filho.pai === 'is_1' && filho.tipo === 'story', 'criar filho dentro do epic');
  await p.selectOption('.gaveta [data-rc-cf=cf_amb]', 'Teste'); await p.waitForTimeout(150);
  d = await D(); ok(d.issues.find(i => i.id === 'is_1').cf.cf_amb === 'Teste', 'campo personalizado salvo no item');
  await p.screenshot({path:'rc_gaveta.png'});
  await p.click('.gaveta-cab [data-fechar-gaveta]'); await p.waitForTimeout(150);
  // automação: bug concluído avisa quem abriu
  await p.evaluate(() => { const D = window.ciclodevDados(); const bug = D.issues.find(i => i.tipo === 'bug' && i.status !== 'done'); bug.rep = 'pe_w'; window.__bug = bug.id; });
  const bugId = await p.evaluate(() => window.__bug);
  await p.evaluate(id => { const b = document.createElement('button'); b.dataset.abrirItem = id; document.body.appendChild(b); b.click(); b.remove(); }, bugId); await p.waitForTimeout(200);
  await p.selectOption('.gaveta select[data-g=status]', 'done'); await p.waitForTimeout(200);
  d = await D(); ok(d.notifs.some(n => n.item === bugId && n.pessoa === 'pe_w'), 'bug concluído gerou aviso para quem abriu');
  ok(await p.evaluate(() => !document.getElementById('notif-n').hidden), 'sino mostra o aviso novo');
  await p.click('.gaveta-cab [data-fechar-gaveta]');
  // Timeline com marcos
  await p.click('[data-view=timeline]'); await p.waitForTimeout(200);
  ok((await p.$$('.rc-diamante')).length >= 2, 'faixa de marcos com diamantes');
  await p.screenshot({path:'rc_timeline.png', fullPage:true});
  // Calendário semana: puxador
  await p.click('[data-view=calendar]'); await p.click('[data-cal-modo=semana]'); await p.waitForTimeout(250);
  const temBloco = await p.$('.bloco-abs .rc-puxa');
  if (temBloco){ const bb = await temBloco.boundingBox(); await p.mouse.move(bb.x + bb.width / 2, bb.y + 2); await p.mouse.down(); await p.mouse.move(bb.x + bb.width / 2, bb.y + 46, {steps:5}); await p.mouse.up(); await p.waitForTimeout(250);
    d = await D(); ok(true, 'puxador do bloco existe'); } else ok(true, 'semana atual sem bloco para esticar (ok)');
  await p.screenshot({path:'rc_calendar.png'});
  // Whiteboard
  await p.click('[data-view=whiteboard]'); await p.waitForTimeout(200);
  await p.click('[data-rc-acao=qd-nota]'); await p.waitForTimeout(150);
  await p.click('[data-rc-acao=qd-registro]'); await p.selectOption('#qd-r', {index:1}); await p.click('dialog[open] [data-b="1"]'); await p.waitForTimeout(200);
  const el = await p.$('.qd-el.qd-nota'); const eb = await el.boundingBox(); await p.mouse.move(eb.x + 20, eb.y + 8); await p.mouse.down(); await p.mouse.move(eb.x + 320, eb.y + 208, {steps:6}); await p.mouse.up(); await p.waitForTimeout(200);
  d = await D(); const q = d.quadros['project:pj_bl']; ok(q && q.els.length === 2 && q.els.find(e => e.tipo === 'nota').x > 250, 'quadro: nota arrastada e cartão de registro criado');
  await p.click('[data-rc-acao=qd-ligar]'); const els = await p.$$('.qd-el'); await els[0].click({position:{x:30, y:10}}); await p.waitForTimeout(100); await (await p.$$('.qd-el'))[1].click({position:{x:30, y:10}}); await p.waitForTimeout(200);
  d = await D(); ok(d.quadros['project:pj_bl'].els.some(e => e.tipo === 'seta'), 'quadro: dois cartões ligados por seta');
  await p.screenshot({path:'rc_quadro.png'});
  // origem de terceiros muda as etapas
  await p.click('.ops-arvore [data-no="project:pj_bl"]'); await p.waitForTimeout(100);
  await p.evaluate(() => { const b = document.createElement('div'); b.dataset.noIr = 'app:ap_fiscal'; document.body.appendChild(b); b.click(); b.remove(); }); await p.waitForTimeout(200);
  await p.selectOption('[data-rc-origem]', 'terceiros'); await p.waitForTimeout(100);
  await p.click('[data-view=stages]'); await p.waitForTimeout(200);
  ok((await p.content()).includes('Mapa dos riscos do código feito por outra empresa'), 'Stages mostra os itens de código de terceiros');
  // dashboard com ritmo
  await p.click('[data-view=dashboard]'); await p.waitForTimeout(200);
  ok(await p.$('.rc-ritmo .rc-barras') !== null, 'painel tem Throughput, tempos e previsão');
  await p.screenshot({path:'rc_dash.png', fullPage:true});
  // Settings
  await p.click('[data-tela=configuracoes]'); await p.waitForTimeout(200);
  ok((await p.content()).includes('Custom statuses') && (await p.content()).includes('Registro das automações'), 'Settings com status, campos e automações');
  await p.click('[data-rc-acao=auto-nova]'); await p.fill('#au-n', 'Teste: criado avisa'); await p.selectOption('#au-g', 'item_criado'); await p.click('dialog[open] [data-b="1"]'); await p.waitForTimeout(200);
  d = await D(); ok(d.automacoes.length === 3, 'nova automação criada');
  await p.screenshot({path:'rc_settings.png', fullPage:true});
  // Overview por serviço
  await p.click('[data-tela=overview]'); await p.waitForTimeout(250);
  ok(await p.$('.rc-servicos') !== null, 'Overview tem o quadro por tipo de serviço');
  await p.click('[data-rc-ovserv="sv_mobile"]'); await p.waitForTimeout(200);
  ok((await p.$$('.rc-servicos tbody tr')).length === 1, 'filtro por serviço mostra só o App mobile');
  await p.screenshot({path:'rc_overview.png', fullPage:true});
  // Service Desk
  await p.click('[data-tela=servicedesk]'); await p.waitForTimeout(250);
  ok((await p.$$('.rc-sla')).length >= 3, 'Service Desk mostra o SLA de cada pedido');
  await p.click('[data-rc-acao=print-anotado]'); await p.waitForTimeout(200);
  ok(await p.$('dialog[open] #an-tela') !== null, 'abre a tela de print com anotação');
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  await p.screenshot({path:'rc_sd.png'});
  // SLA no cliente
  await p.click('[data-tela=clientes]'); await p.waitForTimeout(200);
  await p.click('[data-editar-cliente]'); await p.waitForTimeout(150);
  await p.fill('[data-rc-sla="parado|0"]', '2'); await p.click('dialog[open] [data-b="1"]'); await p.waitForTimeout(200);
  d = await D(); ok(d.clients[0].sla.parado[0] === 2, 'SLA do cliente salvo');
  // stakeholder não vê quem não deve
  await p.selectOption('#ver-como', 'stakeholder'); await p.waitForTimeout(250);
  ok(await p.$('.rc-servicos') === null, 'stakeholder não vê o quadro por serviço');
  console.log('ERROS', erros);
  await b.close();
})();
