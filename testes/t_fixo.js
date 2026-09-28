const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1440,height:800}}); const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route(/fonts\./, r => r.abort());
  await p.goto('file://' + process.cwd() + '/wrap.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  await p.click('[data-tela=operacoes]'); await p.waitForTimeout(300);
  const antes = await p.evaluate(() => document.querySelector('.ops-arvore').getBoundingClientRect().top);
  const rolou = await p.evaluate(() => { const els = [...document.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 50 && /(auto|scroll)/.test(getComputedStyle(e).overflowY) && !e.closest('.ops-arvore') && !e.closest('.menu')); const e = els.sort((a,b)=>b.scrollHeight-a.scrollHeight)[0]; e.scrollTop = 1500; return [e.className, e.scrollTop]; });
  await p.waitForTimeout(200);
  const depois = await p.evaluate(() => { const r = document.querySelector('.ops-arvore').getBoundingClientRect(); return [r.top, r.height, getComputedStyle(document.querySelector('.ops-arvore')).position]; });
  console.log('rolou', rolou, 'topo antes', antes, 'depois', depois);
  console.log((depois[0] >= -1 && depois[0] <= antes + 1) ? 'OK    Estrutura continua visível depois de rolar' : 'FALHA Estrutura sumiu ao rolar');
  await p.screenshot({path:'../fixo.png'});
  await p.setViewportSize({width:390,height:800}); await p.waitForTimeout(200); const m = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth, getComputedStyle(document.querySelector('.ops-arvore')).position]); console.log('celular', m);
  console.log('ERROS', erros); await b.close();
})();
