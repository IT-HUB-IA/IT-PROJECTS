const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1700,height:1000}});
  const erros=[]; p.on('pageerror', e => erros.push('PAGEERR ' + e.message));
  await p.goto('file://' + process.cwd() + '/wrap.html'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  await p.click('#alternar');
  const shot = async n => { await p.waitForTimeout(250); await p.screenshot({path:'c_'+n+'.png'}); };
  const txt = s => p.evaluate(s => (document.querySelector(s)||{}).textContent, s);
  await p.click('[data-tela=catalog]'); await shot('lista');
  await p.click('.nome-tab[data-servico=sv_sistema]'); await shot('servico');
  console.log('preço antes', await txt('table.calc tr.total td'));
  await p.fill('[data-ctx=horas]','1200'); await p.press('[data-ctx=horas]','Tab'); console.log('preço 1200h', await txt('table.calc tr.total td'));
  await p.selectOption('[data-ctx=compl]','Alta'); console.log('alta', await txt('table.calc tr.total td'));
  await p.selectOption('[data-comp-m="1"]','banco'); await p.waitForTimeout(100); console.log('comp1', await txt('.comp:nth-child(3) .comp-val'));
  await p.click('[data-acao=add-comp]');
  for (const a of ['descricao','frentes','requisitos']){ await p.click('[data-sv-aba='+a+']'); await shot('sv_'+a); }
  await p.click('[data-acao=catalog-lista]');
  await p.click('[data-tela=custos]'); await shot('custos_visao');
  await p.click('[data-ct-aba=clientes]'); await shot('custos_clientes');
  await p.click('.nome-tab[data-ct-cliente=cl_bl]'); await shot('custos_bl');
  await p.click('[data-acao=novo-custo]'); await p.fill('#fc2-for','Cloudflare'); await p.fill('#fc2-desc','CDN'); await p.fill('#fc2-valor','20'); await p.fill('#fc2-lim','100'); await p.fill('#fc2-atual','95'); await p.fill('#fc2-un','GB'); await p.click('dialog [data-b="1"]');
  await p.click('[data-ct-aba=equipe]'); await shot('custos_equipe');
  await p.click('[data-ct-aba=operacao]'); await shot('custos_op');
  await p.click('[data-ct-aba=regras]'); await shot('custos_regras');
  const antes = await txt('#m-custos .kpis .kpi:nth-child(3) b');
  await p.fill('[data-regra=margem]','30'); await p.press('[data-regra=margem]','Tab'); await p.waitForTimeout(100);
  console.log('preço hora', antes, '->', await txt('#m-custos .kpis .kpi:nth-child(3) b'));
  await p.selectOption('[data-regra=regime]','presumido'); console.log('presumido', await txt('#m-custos .kpis .kpi:nth-child(3) b'));
  await p.setViewportSize({width:400,height:800});
  for (const m of ['catalog','custos']){ await p.click('[data-tela='+m+']'); const r = await p.evaluate(()=>{const m=document.querySelector('.principal');return [m.scrollWidth,m.clientWidth]}); console.log('mobile', m, r); }
  console.log('ERROS', erros); await b.close();
})();
