// Cadastro completo + módulo Admin, contra um Postgres local com as regras de acesso de verdade (papel authenticated).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { execFileSync } = require('child_process');
const BD = process.env.BD || 'ciclodev_m16';
const psqlRaw = sql => execFileSync('psql', ['-h', '/tmp', '-p', '55432', '-U', 'postgres', '-d', BD, '-v', 'ON_ERROR_STOP=1', '-Atq', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const lit = o => '$j$' + JSON.stringify(o) + '$j$';
const ESCALAR = ['admin_resumo', 'sou_dono_sistema'];
function como(uid, email){ return "set role authenticated; set request.jwt.claim.sub = '" + uid + "'; set request.jwt.claims = '" + JSON.stringify({sub:uid, email}).replace(/'/g, "''") + "'; "; }
let QUEM = null;
function executar(p){
  const {t, op, row, filtro, conflito, de, ate, ret, fn, args} = p; const T = 'public.' + t;
  const onde = f => { const ks = Object.keys(f); return ks.length ? '(' + ks.join(',') + ') = (select ' + ks.join(',') + ' from json_populate_record(null::' + T + ', ' + lit(f) + '))' : 'true'; };
  try {
    let sql;
    if (op === 'rpc'){
      const a = Object.entries(args || {}).map(([k, v]) => k + ' => ' + (v === null ? 'null' : typeof v === 'number' ? v : "'" + String(v).replace(/'/g, "''") + "'")).join(', ');
      sql = ESCALAR.includes(fn) ? 'select to_json(public.' + fn + '(' + a + '))' : "select coalesce(json_agg(x), '[]') from public." + fn + '(' + a + ') x';
    }
    else if (op === 'select') sql = "select coalesce(json_agg(x), '[]') from (select * from " + T + ' order by 1 offset ' + (de || 0) + ' limit ' + ((ate || 999) - (de || 0) + 1) + ') x';
    else if (op === 'insert' || op === 'upsert'){ const cs = Object.keys(row);
      sql = 'insert into ' + T + ' (' + cs.join(',') + ') select ' + cs.join(',') + ' from json_populate_record(null::' + T + ', ' + lit(row) + ')' +
        (op === 'upsert' ? ' on conflict (' + conflito + ') do update set ' + (cs.filter(c => !conflito.split(',').includes(c)).map(c => c + '=excluded.' + c).join(',') || conflito.split(',')[0] + '=excluded.' + conflito.split(',')[0]) : '');
      sql = ret ? 'with u as (' + sql + " returning *) select coalesce(json_agg(u), '[]') from u" : sql; }
    else if (op === 'update'){ const cs = Object.keys(row); sql = 'with u as (update ' + T + ' set ' + (cs.length === 1 ? cs[0] + ' = (select ' + cs[0] : '(' + cs.join(',') + ') = (select ' + cs.join(',')) + ' from json_populate_record(null::' + T + ', ' + lit(row) + ')) where ' + onde(filtro) + " returning *) select coalesce(json_agg(u), '[]') from u"; }
    else if (op === 'delete') sql = 'delete from ' + T + ' where ' + onde(filtro);
    const out = psqlRaw(como(QUEM.uid, QUEM.email) + sql).trim();
    const d = out ? JSON.parse(out) : null;
    return {data: (op === 'delete' || (op === 'insert' && !ret)) ? null : d, error: null};
  } catch (e) { const m = String(e.stderr || e.message).split('\n').find(l => /ERROR/.test(l)) || String(e.message); return {data: null, error: {message: m.replace(/^.*ERROR:\s*/, '')}}; }
}
const FALSO = `
function q(t){ const st = {t, op:'select', filtro:{}, de:0, ate:998};
  const px = new Proxy(function(){}, { get(_, k){
    if (k === 'then') return (res, rej) => window.__bd(JSON.stringify(st)).then(r => JSON.parse(r)).then(res, rej);
    if (k === 'range') return (a, b) => { st.de = a; st.ate = b; return px; };
    if (k === 'select') return () => { if (st.op !== 'select') st.ret = true; return px; };
    if (k === 'insert') return r => { st.op = 'insert'; st.row = r; return px; };
    if (k === 'upsert') return (r, o) => { st.op = 'upsert'; st.row = r; st.conflito = (o || {}).onConflict; st.ret = true; return px; };
    if (k === 'update') return r => { st.op = 'update'; st.row = r; return px; };
    if (k === 'delete') return () => { st.op = 'delete'; return px; };
    if (k === 'match') return f => { Object.assign(st.filtro, f); return px; };
    if (k === 'eq') return (c, v) => { st.filtro[c] = v; return px; };
    return () => px; } }); return px; }
window.supabase = { createClient(){ const sess = window.__sessao; return { auth:{ async getSession(){ return {data:{session:sess}}; }, onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}}; }, async signOut(){},
    async signUp(a){ window.__cadastro = a; return {data:{session:null, user:{id:'novo'}}, error:null}; }, async signInWithOAuth(a){ window.__oauth = a; return {data:{}, error:null}; } },
  from:q, rpc(fn, args){ return window.__bd(JSON.stringify({op:'rpc', fn, args})).then(r => JSON.parse(r)); } }; } };`;

(async () => {
  const conta = sql => psqlRaw(sql).trim();
  // limpa o usuário que o próprio teste cria no fim (senão a busca acha dois de São Paulo na próxima vez)
  psqlRaw("delete from public.pessoas where email = 'carlos@teste.com'; delete from auth.users where email = 'carlos@teste.com'");
  const W = {uid: conta("select auth_user_id from pessoas where id = 'd148fdc5-eef3-5398-bf89-f49b55b5cd28'"), email: 'william@teste.com'};
  const M = {uid: '00000000-0000-0000-0000-0000000000b1', email: 'maria@teste.com'};
  const b = await chromium.launch(); let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
  async function abrir(quem, sessao, largura){
    QUEM = quem || W;
    const p = await b.newPage({ viewport: { width: largura || 1440, height: 900 } });
    p.on('pageerror', e => { falhas++; console.log('PAGEERROR', e.stack.split('\n').slice(0, 4).join(' | ')); });
    await p.exposeFunction('__bd', s => JSON.stringify(executar(JSON.parse(s))));
    await p.addInitScript(s => { window.__sessao = s; }, sessao);
    await p.route('**/supabase-js@*/**', r => r.fulfill({ contentType: 'text/javascript', body: FALSO }));
    await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
    await p.route(/auth\/v1\/settings/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({external:{google:true, github:true, apple:false, azure:true}}) }));
    await p.route(/viacep\.com\.br\/ws\/01310100/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({cep:'01310-100', logradouro:'Avenida Paulista', bairro:'Bela Vista', localidade:'São Paulo', uf:'SP'}) }));
    await p.goto('file://' + process.cwd() + '/vercel/index.html'); await p.waitForTimeout(2500);
    return p;
  }

  // Maria entrou pelo Google e ainda não tem CPF, nascimento nem endereço
  psqlRaw("delete from public.pessoas_privado where pessoa_id = (select id from public.pessoas where email = 'maria@teste.com')");
  let p = await abrir(M, {user:{id:M.uid, email:M.email, user_metadata:{full_name:'Maria Souza Lima'}, app_metadata:{provider:'google'}}});
  const cad = '[data-etapa="cadastro"]';
  ok(await p.isVisible(cad) && !(await p.evaluate(() => document.body.classList.contains('logado'))), 'quem entra pelo Google sem os dados vê "Complete o seu cadastro" antes do sistema');
  ok(/Google/.test(await p.innerText(cad + ' .entrada-sub')), 'o texto diz que a conta Google não informa esses dados');
  ok(await p.inputValue(cad + ' [name=nome]') === 'Maria Souza Lima', 'nome vem da conta Google');
  ok(!(await p.isVisible(cad + ' [name=email]')) && !(await p.isVisible(cad + ' [data-sociais]')), 'não pede e-mail nem mostra os botões de login');
  await p.screenshot({ path: 'comp_1.png' });
  await p.fill(cad + ' [name=nascimento]', '1992-07-01'); await p.type(cad + ' [name=cpf]', '39053344705');
  await p.click(cad + ' .entrada-botao'); ok(await p.isVisible(cad + ' [data-passo="2"]'), 'passa sem pedir e-mail');
  await p.type(cad + ' [name=cep]', '01310100'); await p.waitForTimeout(400); await p.fill(cad + ' [name=numero]', '10');
  await p.click(cad + ' .entrada-botao'); await p.click(cad + ' .entrada-opcoes input[value=estudo]'); await p.fill(cad + ' [name=cargo]', 'Sistemas de Informação');
  await p.click(cad + ' .entrada-botao');
  ok(!(await p.isVisible(cad + ' [name=senha]')) && await p.innerText(cad + ' .entrada-botao') === 'Salvar e entrar', 'último passo só confirma (sem senha)');
  await p.screenshot({ path: 'comp_4.png' });
  await p.click(cad + ' .entrada-botao'); ok(/concordância/.test(await p.innerText(cad + ' [data-erro]')), 'pede a concordância');
  await p.check(cad + ' [name=termos]'); await p.click(cad + ' .entrada-botao');
  await p.waitForFunction(() => document.body.classList.contains('logado'), null, {timeout: 15000}).catch(() => {});
  ok(await p.evaluate(() => document.body.classList.contains('logado')), 'depois de salvar, abre o sistema');
  ok(conta("select cpf || '|' || cidade || '|' || uso || '|' || (termos_aceitos_em is not null) from pessoas_privado pp join pessoas x on x.id = pp.pessoa_id where x.email = 'maria@teste.com'") === '39053344705|São Paulo|estudo|true', 'dados gravados na tabela privada');
  ok(conta("select nome from pessoas where email = 'maria@teste.com'") === 'Maria Souza Lima', 'nome completo atualizado no perfil');
  await p.close();
  p = await abrir(M, {user:{id:M.uid, email:M.email}});
  ok(await p.evaluate(() => document.body.classList.contains('logado')), 'na próxima vez entra direto, sem pedir de novo');
  await p.close();
  psqlRaw("update public.pessoas set nome = 'Maria Souza' where email = 'maria@teste.com'");

  // CPF que já é de outra conta
  psqlRaw("delete from public.pessoas_privado where pessoa_id = (select id from public.pessoas where email = 'maria@teste.com')");
  p = await abrir(M, {user:{id:M.uid, email:M.email, app_metadata:{provider:'github'}}});
  await p.fill(cad + ' [name=nome]', 'Maria Souza'); await p.fill(cad + ' [name=nascimento]', '1992-07-01'); await p.type(cad + ' [name=cpf]', '52998224725');
  await p.click(cad + ' .entrada-botao'); await p.type(cad + ' [name=cep]', '01310100'); await p.waitForTimeout(400); await p.fill(cad + ' [name=numero]', '10');
  await p.click(cad + ' .entrada-botao'); await p.click(cad + ' .entrada-opcoes input[value=pessoal]'); await p.click(cad + ' .entrada-botao');
  await p.check(cad + ' [name=termos]'); await p.click(cad + ' .entrada-botao'); await p.waitForTimeout(800);
  ok(/já está em outra conta/.test(await p.innerText(cad + ' [data-erro]')), 'CPF de outra conta é recusado com aviso claro');
  await p.close();
  psqlRaw("delete from public.pessoas_privado where pessoa_id = (select id from public.pessoas where email = 'maria@teste.com')");   // volta ao estado inicial

  // dono do sistema entra direto, sem completar
  p = await abrir(W, {user:{id:W.uid, email:W.email}});
  ok(await p.evaluate(() => document.body.classList.contains('logado')), 'o dono do sistema entra direto, sem pedir dados');
  await p.close();

  // botões de login com as outras contas
  p = await abrir(W, null);
  ok(await p.$$eval('[data-etapa="login"] [data-provedor]', b => b.map(x => x.innerText).join(',')) === 'Google,GitHub,Apple,Microsoft', 'tela de entrar tem Google, GitHub, Apple e Microsoft');
  await p.screenshot({ path: 'soc_login.png' });
  await p.click('[data-etapa="login"] [data-provedor=google]'); await p.waitForTimeout(200);
  const oa = await p.evaluate(() => window.__oauth);
  ok(oa && oa.provider === 'google' && /index\.html$/.test(oa.options.redirectTo), 'Google chama o login do Supabase e volta para o sistema');
  await p.click('[data-etapa="login"] [data-provedor=azure]'); await p.waitForTimeout(200);
  ok((await p.evaluate(() => window.__oauth)).provider === 'azure' && (await p.evaluate(() => window.__oauth.options.scopes)) === 'email', 'Microsoft pede o e-mail');
  await p.click('[data-etapa="login"] [data-provedor=apple]'); await p.waitForTimeout(200);
  ok(/Apple ainda não foi ativado/.test(await p.innerText('[data-etapa="login"] [data-erro]')), 'provedor desligado no Supabase avisa em vez de dar erro');
  await p.click('text=Criar conta grátis'); await p.waitForTimeout(200);
  ok(await p.isVisible('[data-etapa="cadastro"] [data-sociais]'), 'cadastro também oferece as contas no primeiro passo');
  await p.screenshot({ path: 'soc_cadastro.png' });
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no celular sem rolar para o lado');
  await p.close();
  await b.close();
  console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK');
  process.exit(falhas ? 1 : 0);
})();
