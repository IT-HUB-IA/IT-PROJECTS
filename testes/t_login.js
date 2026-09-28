const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const FALSO = `window.supabase = { createClient(){ let sess = JSON.parse(localStorage.getItem('falso-sess')||'null'); const ouv=[];
  return { auth: {
    async getSession(){ return {data:{session:sess}}; },
    async signInWithPassword({email,password}){ await new Promise(r=>setTimeout(r,150)); if (password!=='certa123') return {data:{},error:{message:'Invalid login credentials'}}; sess={user:{id:'u1',email}}; localStorage.setItem('falso-sess',JSON.stringify(sess)); return {data:{session:sess},error:null}; },
    async resetPasswordForEmail(){ return {error:null}; },
    async updateUser(){ return {data:{user:sess&&sess.user},error:null}; },
    async signOut(){ sess=null; localStorage.removeItem('falso-sess'); ouv.forEach(f=>f('SIGNED_OUT',null)); return {}; },
    onAuthStateChange(f){ ouv.push(f); return {data:{subscription:{unsubscribe(){}}}}; } },
    async rpc(nome){ const e=(sess&&sess.user.email)||''; if (e.startsWith('william')) return {data:[{pessoa_id:'p1',nome:'William',papel:'master'}],error:null}; if (e.startsWith('ana')) return {data:[{pessoa_id:'p2',nome:'Ana',papel:'dev'}],error:null}; return {data:[],error:null}; } }; } };`;
(async () => {
  const b = await chromium.launch(); const erros = []; const ok = (c, m) => console.log((c ? 'OK   ' : 'FALHA') + ' ' + m);
  for (const [w, h] of [[1366, 800], [390, 800]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    p.on('pageerror', e => erros.push(e.message));
    await p.route('**/supabase-js@*/**', r => r.fulfill({ contentType: 'text/javascript', body: FALSO }));
    await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
    await p.goto('file://' + process.cwd() + '/vercel/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(400);
    const vis = s => p.locator(s).first().isVisible();
    ok(await vis('[data-etapa=login]') && !(await vis('.menu-lateral, nav')), w + ' sem login: só a tela de entrar aparece');
    await p.screenshot({ path: '../login_' + w + '.png' });
    const larg = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); ok(larg[0] <= larg[1], w + ' sem rolagem para o lado ' + larg);
    await p.click('[data-etapa=login] .entrada-botao'); ok((await p.textContent('[data-etapa=login] [data-erro]')).includes('e-mail válido'), w + ' e-mail vazio avisa');
    await p.fill('[data-etapa=login] [name=email]', 'william@teste.com'); await p.fill('[data-etapa=login] [name=senha]', 'errada');
    await p.click('[data-etapa=login] .entrada-botao'); await p.waitForTimeout(300);
    ok((await p.textContent('[data-etapa=login] [data-erro]')) === 'E-mail ou senha incorretos.', w + ' senha errada avisa em português');
    await p.click('[data-ver-senha]'); ok(await p.getAttribute('[data-etapa=login] [name=senha]', 'type') === 'text', w + ' mostrar senha');
    await p.fill('[data-etapa=login] [name=senha]', 'certa123'); await p.click('[data-etapa=login] .entrada-botao'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => document.body.classList.contains('logado')) && !(await vis('#entrada')), w + ' senha certa entra no sistema');
    ok(await p.isVisible('#ver-como'), w + ' master continua com o "ver como"');
    await p.screenshot({ path: '../login_dentro_' + w + '.png' });
    await p.reload(); await p.waitForTimeout(500); ok(await p.evaluate(() => document.body.classList.contains('logado')), w + ' recarregar mantém o login');
    if (w > 800) await p.click('.menu-sair'); else await p.evaluate(() => document.querySelector('.menu-sair').click());
    await p.waitForTimeout(500); ok(await vis('[data-etapa=login]'), w + ' sair volta para a tela de entrar');
    await p.fill('[data-etapa=login] [name=email]', 'ana@teste.com'); await p.fill('[data-etapa=login] [name=senha]', 'certa123'); await p.click('[data-etapa=login] .entrada-botao'); await p.waitForTimeout(500);
    ok(!(await p.isVisible('#ver-como')) && await p.evaluate(() => document.body.classList.contains('modo-dev')), w + ' dev entra sem o "ver como" e em modo dev');
    await p.evaluate(() => document.querySelector('.menu-sair').click()); await p.waitForTimeout(400);
    await p.fill('[data-etapa=login] [name=email]', 'outro@teste.com'); await p.fill('[data-etapa=login] [name=senha]', 'certa123'); await p.click('[data-etapa=login] .entrada-botao'); await p.waitForTimeout(500);
    ok(await vis('[data-etapa=sem-acesso]') && (await p.textContent('[data-email]')) === 'outro@teste.com', w + ' e-mail sem pessoa: acesso não liberado');
    await p.click('[data-etapa=sem-acesso] [data-sair]'); await p.waitForTimeout(500);
    await p.click('[data-ir=esqueci]'); await p.fill('[data-etapa=esqueci] [name=email]', 'william@teste.com'); await p.click('[data-etapa=esqueci] .entrada-botao'); await p.waitForTimeout(200);
    ok(!(await p.isHidden('[data-etapa=esqueci] [data-ok]')), w + ' esqueci a senha confirma o envio');
    await p.close();
  }
  console.log('ERROS', erros); await b.close();
})();
