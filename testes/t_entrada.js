const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const FALSO = `window.supabase = { createClient(){ return { auth:{ async getSession(){ return {data:{session:null}}; }, onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}}; } }, from(){ return {}; }, async rpc(){ return {data:null}; } }; } };`;
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[1920, 1080], [2560, 1300], [1440, 900], [1366, 768], [1280, 640], [390, 844]]){
    const p = await b.newPage({ viewport: { width: w, height: h } });
    const erros = []; p.on('pageerror', e => erros.push(e.message));
    await p.route('**/supabase-js@*/**', r => r.fulfill({ contentType: 'text/javascript', body: FALSO }));
    await p.goto('file://' + process.cwd() + '/vercel/index.html'); await p.waitForTimeout(1500);
    const m = await p.evaluate(() => { const a = document.querySelector('.entrada-marca'); return {sobra: a.scrollHeight - a.clientHeight, rolaLado: document.documentElement.scrollWidth > innerWidth + 1}; });
    console.log(w + 'x' + h, JSON.stringify(m), 'erros', erros.length);
    await p.screenshot({ path: 'ent_' + w + '.png' }); await p.close();
  }
  await b.close();
})();
