const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const erros = [];
  for (const [w,h] of [[1440,900],[1366,768]]){
    const p = await b.newPage({viewport:{width:w,height:h}}); p.on('pageerror', e => erros.push(e.message)); await p.route(/fonts\./, r => r.abort());
    await p.goto('file://' + process.cwd() + '/wrap.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
    await p.click('[data-tela=operacoes]'); await p.waitForTimeout(300);
    const medir = () => p.evaluate(() => { const r = document.querySelector('.ops-arvore').getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom), innerHeight]; });
    const a = await medir();
    await p.evaluate(() => { document.querySelector('.principal').scrollTop = 2000; }); await p.waitForTimeout(200);
    const d = await medir();
    await p.locator('.no-arv', {hasText:'Java Financ'}).first().click(); await p.waitForTimeout(300); await p.evaluate(() => { document.querySelector('.principal').scrollTop = 0; }); await p.waitForTimeout(200);
    const c = await medir();
    const bom = x => x[0] === 0 && x[1] === x[2];
    console.log(w + 'x' + h, 'início', a, 'rolado', d, 'tela curta', c, (bom(a) && bom(d) && bom(c)) ? 'OK vai de cima até embaixo e fica fixa' : 'VERIFICAR');
    if (w === 1440) await p.screenshot({path:'../fixo2.png'});
    await p.close();
  }
  console.log('ERROS', erros); await b.close();
})();
