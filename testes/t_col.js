const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const erros = [];
  for (const [w,h] of [[1687,990],[1366,768],[1920,1080]]){
    const p = await b.newPage({viewport:{width:w,height:h}}); p.on('pageerror', e => erros.push(e.message)); await p.route(/fonts\./, r => r.abort());
    await p.goto('file://' + process.cwd() + '/wrap.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
    await p.click('[data-tela=operacoes]'); await p.waitForTimeout(200); await p.locator('.no-arv', {hasText:'Java Financ'}).first().click(); await p.waitForTimeout(300); await p.click('[data-view=board]'); await p.waitForTimeout(400);
    const r = await p.evaluate(() => { const c = [...document.querySelectorAll('.board > .coluna')]; return {n:c.length, fundo:Math.max(...c.map(x => x.getBoundingClientRect().bottom)), iguais:new Set(c.map(x => Math.round(x.getBoundingClientRect().height))).size, tela:innerHeight}; });
    console.log(w + 'x' + h, JSON.stringify(r), (r.tela - r.fundo >= 0 && r.tela - r.fundo <= 40 && r.iguais === 1) ? 'OK colunas até o fim da tela' : 'VERIFICAR');
    if (w === 1687) await p.screenshot({path:'../colunas.png'});
    await p.close();
  }
  console.log('ERROS', erros); await b.close();
})();
