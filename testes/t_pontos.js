const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1440,height:900}}); const erros = []; p.on('pageerror', e => erros.push(e.message)); await p.route(/fonts\./, r => r.abort());
  await p.goto('file://' + process.cwd() + '/wrap.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  await p.click('[data-tela=operacoes]'); await p.waitForTimeout(400);
  const img = await p.evaluate(() => document.querySelector('.no-arv[data-no^="product:"]').style.backgroundImage);
  console.log(/#FF0000|rgb\(255, 0, 0\)/i.test(img) ? 'OK    pontinhos no vermelho da borda' : 'FALHA ' + img.slice(0, 120));
  await p.locator('.ops-arvore').screenshot({path:'../arvore4.png'});
  console.log('ERROS', erros); await b.close();
})();
