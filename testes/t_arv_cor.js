const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1440,height:900}}); const erros = []; p.on('pageerror', e => erros.push(e.message)); await p.route(/fonts\./, r => r.abort());
  await p.goto('file://' + process.cwd() + '/wrap.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  await p.click('[data-tela=operacoes]'); await p.waitForTimeout(200);
  // recolhe tudo menos o projeto, como no print
  await p.evaluate(() => { document.querySelectorAll('.no-arv[data-no^="product:"].aberto .seta').forEach(s => s.click()); }); await p.waitForTimeout(300);
  const r = await p.evaluate(() => [...document.querySelectorAll('.no-arv[data-no]')].map(n => { const s = n.querySelector('.seta'); const antes = getComputedStyle(n, '::before'); return [n.dataset.no.split(':')[0], n.querySelector('.nome').textContent.trim().slice(0,12), getComputedStyle(n).backgroundColor, antes.content !== 'none' ? antes.backgroundColor : '-', s ? getComputedStyle(s).color : '-']; }));
  r.forEach(x => console.log(x.join(' | ')));
  await p.locator('.ops-arvore').screenshot({path:'../arvore2.png'}); await p.locator('.no-arv', {hasText:'YOU Cont'}).first().locator('.seta').click(); await p.waitForTimeout(300); await p.locator('.no-arv', {hasText:'Java Financ'}).first().locator('.seta').click(); await p.waitForTimeout(300); await p.locator('.ops-arvore').screenshot({path:'../arvore3.png'});
  console.log('ERROS', erros); await b.close();
})();
