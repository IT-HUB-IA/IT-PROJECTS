const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({viewport:{width:1600,height:950}});
  const p = await ctx.newPage();
  const erros=[]; p.on('pageerror', e => erros.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type()==='error' && !/fonts|ERR_CERT|net::/.test(m.text())) erros.push('CONSOLE ' + m.text()); });
  await p.goto('file://' + process.cwd() + '/wrap.html');
  await p.waitForTimeout(600);
  const shot = async n => { await p.waitForTimeout(150); await p.screenshot({path:'f_' + n + '.png'}); };
  await shot('overview');
  await p.click('#m-overview [data-ir]'); await shot('overview_drill');
  await p.click('[data-tela=operacoes]'); await shot('ops_board');
  for (const v of ['table','list','calendar','timeline','workload','whiteboard','dashboard','sheet','stages']){ await p.click('[data-view='+v+']'); await shot('ops_'+v); }
  // calendar modes
  await p.click('[data-view=calendar]');
  for (const m of ['semana','dia','agenda','mes']){ await p.click('[data-cal-modo='+m+']'); await shot('cal_'+m); }
  // drag card in board
  await p.click('[data-view=board]');
  const card = await p.$('.cartao');
  const tit = await card.evaluate(e => e.querySelector('.tt').textContent);
  await p.dragAndDrop('.cartao', '[data-soltar-status=done]'); await p.waitForTimeout(200);
  const st = await p.evaluate(t => { const d = JSON.parse(localStorage.getItem('ciclodev-dados-v1')); return d.issues.find(i=>i.titulo===t).status; }, tit);
  console.log('drag', tit, '->', st);
  // quick add
  await p.fill('[data-add-status=todo] input', 'Item criado pelo teste'); await p.press('[data-add-status=todo] input', 'Enter');
  console.log('quick add', await p.evaluate(() => !!JSON.parse(localStorage.getItem('ciclodev-dados-v1')).issues.find(i=>i.titulo==='Item criado pelo teste')));
  // open drawer
  await p.click('.cartao'); await shot('gaveta');
  await p.click('[data-acao=cron]'); await p.waitForTimeout(1200); await p.click('[data-acao=cron]');
  await p.fill('[data-form=check] input', 'Checar teste'); await p.press('[data-form=check] input','Enter');
  await p.fill('[data-form=coment] input', 'Comentário teste'); await p.press('[data-form=coment] input','Enter');
  await p.keyboard.press('Escape');
  // tree: create app in product
  await p.hover('[data-no="product:pr_you"]'); await p.click('[data-criar="product:pr_you"]');
  await p.fill('#cd-n','Java RH'); await p.click('dialog [data-b="1"]'); await shot('nova_app');
  // stages: cumprir item with text proof
  await p.click('[data-no="project:pj_bl"]'); await p.click('[data-view=stages]');
  await p.click('[data-cumprir]'); await shot('cumprir'); await p.click('dialog [data-b="1"]');
  // modules
  for (const m of ['clientes','servicedesk','time','playbook','configuracoes']){ await p.click('[data-tela='+m+']'); await shot('mod_'+m); }
  await p.click('[data-tela=clientes]'); await p.click('[data-acao=cli-tags]'); await p.click('[data-acao=nova-tag]'); await p.fill('#ft-nome','Tag teste'); await p.click('dialog [data-b="1"]');
  await p.click('[data-tela=servicedesk]'); await p.click('[data-acao=virar-issue]'); await p.click('dialog [data-b="1"]'); await shot('sd_issue');
  // stakeholder
  await p.selectOption('#ver-como','stakeholder'); await shot('stake_overview');
  await p.click('[data-tela=servicedesk]'); await shot('stake_sd');
  await p.selectOption('#ver-como','master');
  // mobile
  await p.setViewportSize({width:400,height:800});
  for (const m of ['overview','operacoes','clientes','servicedesk','time','configuracoes']){ await p.click('[data-tela='+m+']'); const r = await p.evaluate(()=>{const m=document.querySelector('.principal');return [m.scrollWidth,m.clientWidth]}); console.log('mobile',m,r); }
  console.log('ERROS', erros.slice(0,20));
  await b.close();
})();
