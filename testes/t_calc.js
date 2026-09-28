const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
const e=[]; p.on('pageerror', x=>e.push(x.message));
await p.goto('file://' + process.cwd() + '/wrap.html'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
const r = await p.evaluate(()=>{ const D = window.ciclodevDados(), C = window.ciclodevCalc; return {c: D.custos.map(x => [x.id, x.fornecedor, +C.custoNoMes(x,0,false).toFixed(2), +C.gastoAteHoje(x).toFixed(2), C.inicioCusto(x)]), r: D.receitas.map(x => [x.id, +C.cobradoAteHoje(x).toFixed(2)])}; });
console.log(JSON.stringify(r)); console.log(e); await b.close(); })();
