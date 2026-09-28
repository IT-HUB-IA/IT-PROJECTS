const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'); const base = fs.readFileSync('t_login.js','utf8'); const FALSO = base.match(/const FALSO = `([\s\S]*?)`;/)[1];
(async () => {
  const b = await chromium.launch(); const erros = []; const ok = (c, m) => console.log((c ? 'OK   ' : 'FALHA') + ' ' + m);
  const abre = async hash => { const p = await b.newPage({viewport:{width:1366,height:800}}); p.on('pageerror', e => erros.push(e.message));
    await p.route('**/supabase-js@*/**', r => r.fulfill({contentType:'text/javascript', body: FALSO})); await p.route(/fonts\./, r => r.abort());
    await p.goto('file://' + process.cwd() + '/vercel/index.html' + hash); await p.waitForTimeout(400); return p; };
  let p = await abre('#access_token=x&type=invite');
  ok(await p.isVisible('[data-etapa=trocar]') && (await p.textContent('[data-etapa=trocar] h1')).includes('Bem-vindo'), 'link de convite abre "criar sua senha"');
  await p.fill('[data-etapa=trocar] [name=senha]', 'curta'); await p.fill('[data-etapa=trocar] [name=senha2]', 'curta'); await p.click('[data-etapa=trocar] .entrada-botao');
  ok((await p.textContent('[data-etapa=trocar] [data-erro]')).includes('8 caracteres'), 'senha curta é recusada');
  await p.fill('[data-etapa=trocar] [name=senha]', 'senhaboa1'); await p.fill('[data-etapa=trocar] [name=senha2]', 'senhaboa2'); await p.click('[data-etapa=trocar] .entrada-botao');
  ok((await p.textContent('[data-etapa=trocar] [data-erro]')).includes('não estão iguais'), 'senhas diferentes são recusadas'); await p.close();
  p = await abre('#access_token=x&type=recovery');
  ok(await p.isVisible('[data-etapa=trocar]') && (await p.textContent('[data-etapa=trocar] h1')) === 'Criar a senha nova', 'link de esqueci a senha abre "criar a senha nova"'); await p.close();
  p = await abre('#error=access_denied&error_code=otp_expired');
  ok(await p.isVisible('[data-etapa=login]') && (await p.textContent('[data-etapa=login] [data-erro]')).includes('venceu'), 'link vencido avisa e volta para entrar'); await p.close();
  console.log('ERROS', erros); await b.close();
})();
