const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1440,height:900}}); const erros = []; p.on('pageerror', e => erros.push(e.message)); await p.route(/fonts\./, r => r.abort());
  const ok = (c, m) => console.log((c ? 'OK   ' : 'FALHA') + ' ' + m);
  await p.goto('file://' + process.cwd() + '/wrap.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  await p.click('[data-tela=operacoes]'); await p.waitForTimeout(400);
  const img = await p.evaluate(() => ({prod: document.querySelector('.no-arv[data-no^="product:"]').style.backgroundImage, app: document.querySelector('.no-arv[data-no^="app:"]').style.backgroundImage}));
  const verm = s => (s.match(/#FF0000|rgb\(255, 0, 0\)/gi) || []).length, pret = s => (s.match(/#050506|rgb\(5, 5, 6\)/gi) || []).length;
  ok(verm(img.prod) > 0 && pret(img.prod) === 0, 'linha das empresas em vermelho');
  ok(pret(img.app) > 0, 'linha das aplicações em preto (' + pret(img.app) + ' preto, ' + verm(img.app) + ' vermelho da linha das empresas que passa ao lado)');
  await p.locator('.ops-arvore').screenshot({path:'../arvore5.png'});
  console.log('ERROS', erros); await b.close();
})();
