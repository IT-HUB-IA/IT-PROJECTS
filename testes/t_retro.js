const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1700,height:1000}});
  const erros=[]; p.on('pageerror', e => erros.push('PAGEERR ' + e.message));
  await p.goto('file://' + process.cwd() + '/wrap.html'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  await p.click('#alternar'); await p.click('[data-tela=operacoes]'); await p.click('[data-view=custos]'); await p.waitForTimeout(200);
  const kpi = () => p.evaluate(()=>[...document.querySelectorAll('#ops-corpo .kpi')].map(k=>k.querySelector('span').textContent.replace(/i$/,'')+': '+k.querySelector('b').textContent).join(' | '));
  console.log('BL', await kpi()); await p.screenshot({path:'r_bl.png'});
  // custo retroativo: começou em 01/01/2025, R$ 100 por mês
  await p.click('[data-acao=novo-custo-escopo]'); await p.fill('#fc2-for','Teste retro'); await p.fill('#fc2-desc','Custo antigo'); await p.fill('#fc2-valor','100'); await p.fill('#fc2-ini','2025-01-01'); await p.click('dialog [data-b="1"]'); await p.waitForTimeout(200);
  const d = await p.evaluate(()=>JSON.parse(localStorage.getItem('itia-sistema-dados-v1')));
  const hoje = new Date(); const meses = (hoje.getFullYear()*12+hoje.getMonth()) - (2025*12+0) + 1;
  console.log('meses esperados', meses, 'R$ esperado', meses*100);
  console.log('linha', await p.evaluate(()=>[...document.querySelectorAll('#ops-corpo tbody tr')].find(t=>t.textContent.includes('Teste retro')).textContent.replace(/\s+/g,' ').slice(0,160)));
  // receita retroativa parcelada
  await p.click('[data-acao=nova-receita]'); await p.fill('#fr-desc','Receita retro'); await p.selectOption('#fr-rec','Parcelado'); await p.fill('#fr-val','12000'); await p.fill('#fr-parc','12'); await p.fill('#fr-ini','2026-03-10'); await p.click('dialog [data-b="1"]'); await p.waitForTimeout(200);
  console.log('receita linha', await p.evaluate(()=>[...document.querySelectorAll('#ops-corpo tbody tr')].find(t=>t.textContent.includes('Receita retro')).textContent.replace(/\s+/g,' ').slice(0,160)));
  console.log('BL depois', await kpi());
  await p.screenshot({path:'r_bl2.png', fullPage:false});
  await p.click('[data-no="app:ap_fiscal"]'); await p.click('[data-view=custos]'); console.log('Java Fiscal', await kpi());
  await p.click('[data-tela=custos]'); await p.click('[data-ct-aba=clientes]'); await p.screenshot({path:'r_cli.png'});
  await p.selectOption('#ver-como','dev'); await p.click('[data-tela=operacoes]'); console.log('dev vê custos?', await p.evaluate(()=>!!document.querySelector('[data-view=custos]')));
  console.log('ERROS', erros); await b.close();
})();
