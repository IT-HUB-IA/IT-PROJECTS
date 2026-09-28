const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1600,height:1000}});
  const erros=[]; p.on('pageerror', e => erros.push('PAGEERR ' + e.message));
  await p.goto('file://' + process.cwd() + '/wrap.html'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  await p.click('#alternar'); await p.waitForTimeout(300);
  await p.screenshot({path:'pc_all.png'});
  await p.click('[data-tela=operacoes]'); await p.waitForTimeout(200); await p.screenshot({path:'pc_proj.png'});
  await p.click('[data-no="app:ap_javabl"]'); await p.waitForTimeout(200); await p.screenshot({path:'pc_app.png'});
  // mudar status e ver em mudanças
  await p.click('[data-view=board]'); await p.dragAndDrop('[data-soltar-status=todo] .cartao', '[data-soltar-status=doing]'); await p.click('[data-view=dashboard]');
  console.log('mudança registrada', await p.evaluate(()=>[...document.querySelectorAll('#ops-corpo .pc-l4 section:nth-child(3) li span')].slice(0,1).map(s=>s.textContent)));
  await p.click('#ops-corpo .pp-lin'); await p.waitForTimeout(150); console.log('drill ->', await p.evaluate(()=>document.querySelector('.ops-titulo h1').textContent));
  await p.selectOption('#ver-como','stakeholder'); await p.waitForTimeout(200); await p.screenshot({path:'pc_stake.png'});
  await p.setViewportSize({width:400,height:800}); await p.selectOption('#ver-como','master'); await p.click('[data-tela=overview]');
  console.log('mobile', await p.evaluate(()=>{const m=document.querySelector('.principal');return [m.scrollWidth,m.clientWidth]}));
  console.log('ERROS', erros); await b.close();
})();
