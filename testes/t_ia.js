// Agente de IA pela tela: aba Permissões de IA no Admin, balão, chat e conversa guardada no banco.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { execFileSync } = require('child_process');
const BD = process.env.BD || 'ciclodev_grava';
const psql = sql => execFileSync('psql', ['-h', '/tmp', '-p', '55432', '-U', 'postgres', '-d', BD, '-v', 'ON_ERROR_STOP=1', '-Atq', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const lit = o => '$j$' + JSON.stringify(o) + '$j$';
// com a parte 15 (muitos usuários), a tela grava como o usuário logado (papel authenticated), igual ao Supabase
let COMO = '';
function prepararLogin(){
  if (psql("select to_regclass('public.espacos') is not null").trim() !== 't') return;
  const uid = psql("select auth_user_id from public.pessoas where id = 'd148fdc5-eef3-5398-bf89-f49b55b5cd28'").trim();
  COMO = "set role authenticated; set request.jwt.claim.sub = '" + uid + "'; set request.jwt.claims = '{\"sub\":\"" + uid + "\",\"email\":\"william@teste.com\"}'; ";
}
const ops = [];   // uso_eventos (registro de uso) e pessoas_preferencias (arrumação da tela) gravam sozinhos: não contam como pendência
function executar(p){
  const {t, op, row, filtro, conflito, de, ate, sel, ret} = p; const T = 'public.' + t;
  const onde = f => { const ks = Object.keys(f); return ks.length ? '(' + ks.join(',') + ') = (select ' + ks.join(',') + ' from json_populate_record(null::' + T + ', ' + lit(f) + '))' : 'true'; };
  try {
    let sql;
    if (op === 'select') sql = 'select coalesce(json_agg(x), \'[]\') from (select * from ' + T + ' order by 1 offset ' + (de || 0) + ' limit ' + ((ate || 999) - (de || 0) + 1) + ') x';
    else if (op === 'insert' || op === 'upsert'){ const cs = Object.keys(row);
      sql = 'insert into ' + T + ' (' + cs.join(',') + ') select ' + cs.join(',') + ' from json_populate_record(null::' + T + ', ' + lit(row) + ')' +
        (op === 'upsert' ? ' on conflict (' + conflito + ') do update set ' + (cs.filter(c => !conflito.split(',').includes(c)).map(c => c + '=excluded.' + c).join(',') || conflito.split(',')[0] + '=excluded.' + conflito.split(',')[0]) : '') ;
      // como o supabase-js: só devolve a linha quando a tela pede (.select); senão grava sem ler de volta
      sql = ret ? 'with u as (' + sql + ' returning *) select coalesce(json_agg(u), \'[]\') from u' : sql; }
    else if (op === 'update'){ const cs = Object.keys(row); sql = 'with u as (update ' + T + ' set ' + (cs.length === 1 ? cs[0] + ' = (select ' + cs[0] : '(' + cs.join(',') + ') = (select ' + cs.join(',')) + ' from json_populate_record(null::' + T + ', ' + lit(row) + ')) where ' + onde(filtro) + ' returning *) select coalesce(json_agg(u), \'[]\') from u'; }
    else if (op === 'delete') sql = 'delete from ' + T + ' where ' + onde(filtro);
    const out = psql(COMO + sql).trim(); ops.push(op + ' ' + t);
    return {data: op === 'delete' ? [] : ((op === 'insert' || op === 'upsert') && !ret) ? null : JSON.parse(out || '[]'), error: null};
  } catch (e) { const m = String(e.stderr || e.message).split('\n').find(l => /ERROR/.test(l)) || String(e.message); ops.push('ERRO ' + op + ' ' + t + ': ' + m); return {data: null, error: {message: m.replace(/^.*ERROR:\s*/, '')}}; }
}
const FALSO = `
function q(t){ const st = {t, op:'select', filtro:{}, de:0, ate:998};
  const px = new Proxy(function(){}, { get(_, k){
    if (k === 'then') return (res, rej) => window.__bd(JSON.stringify(st)).then(r => JSON.parse(r)).then(res, rej);
    if (k === 'range') return (a, b) => { st.de = a; st.ate = b; return px; };
    if (k === 'select') return () => { if (st.op !== 'select') st.ret = true; return px; };
    if (k === 'insert') return r => { st.op = 'insert'; st.row = r; return px; };
    if (k === 'upsert') return (r, o) => { st.op = 'upsert'; st.row = r; st.conflito = (o || {}).onConflict; return px; };
    if (k === 'update') return r => { st.op = 'update'; st.row = r; return px; };
    if (k === 'delete') return () => { st.op = 'delete'; return px; };
    if (k === 'match') return f => { Object.assign(st.filtro, f); return px; };
    if (k === 'eq') return (c, v) => { st.filtro[c] = v; return px; };
    return () => px; } }); return px; }
window.supabase = { createClient(){ let sess = {user:{id:'u1', email:'admin@it-ia.tec.br'}}; return { auth:{ async getSession(){ return {data:{session:sess}}; }, onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}}; }, async signOut(){} },
  from:q, async rpc(fn, args){ if (/^(ia_|admin_ia_|admin_usuarios)/.test(fn)) return JSON.parse(await window.__rpc(JSON.stringify({fn, args:args || {}}))); if (fn === 'sou_dono_sistema') return {data:true, error:null}; if (/^admin_/.test(fn)) return {data:fn === 'admin_resumo' ? {gerado_em:new Date().toISOString()} : [], error:null}; if (fn !== 'vincular_meu_login') return {data:null, error:null}; return {data:[{pessoa_id:window.__eu, nome:'William', papel:'master', numero:100001, espaco_id:window.__esp || null}], error:null}; } }; } };`;
(async () => {
  prepararLogin();
  const eu = COMO ? 'd148fdc5-eef3-5398-bf89-f49b55b5cd28' : psql("select id from public.pessoas where papel='master' order by nome limit 1").trim();
  const b = await chromium.launch(); const erros = []; let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', e => { erros.push(e.message); console.log('PAGEERROR', e.stack.split('\n').slice(0,4).join(' | ')); });
  await p.exposeFunction('__bd', s => JSON.stringify(executar(JSON.parse(s))));
  await p.exposeFunction('__rpc', s => { const {fn, args} = JSON.parse(s);
    const valor = v => v === null || v === undefined ? 'null' : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? String(v) : '$v$' + String(v) + '$v$';
    const lista = Object.entries(args).map(([k, v]) => k + ' => ' + valor(v)).join(', ');
    const sql = ['admin_usuarios', 'admin_ia_permissoes'].includes(fn) ? "select coalesce(jsonb_agg(x), '[]') from public." + fn + "() x" : 'select to_jsonb(public.' + fn + '(' + lista + '))';
    try { const out = psql(COMO + sql).trim(); ops.push('rpc ' + fn); return JSON.stringify({data: out ? JSON.parse(out) : null, error: null}); }
    catch (e) { const m = String(e.stderr || e.message).split('\n').find(l => /ERROR/.test(l)) || String(e.message); ops.push('ERRO rpc ' + fn + ': ' + m); return JSON.stringify({data: null, error: {message: m.replace(/^.*ERROR:\s*/, '')}}); } });
  const esp = COMO ? psql("select id from public.espacos where dono_id = '" + eu + "' and pessoal limit 1").trim() : '';
  await p.addInitScript(([id, e]) => { window.__eu = id; window.__esp = e || null; }, [eu, esp]);
  await p.route('**/supabase-js@*/**', r => r.fulfill({ contentType: 'text/javascript', body: FALSO }));
  await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  await p.route(/agente-(fechado|aberto)\.webp$/, r => r.fulfill({ contentType: 'image/webp', body: require('fs').readFileSync('../publico/' + r.request().url().match(/agente-\w+\.webp/)[0]) }));
  const abrir = async () => { await p.goto('file://' + process.cwd() + '/vercel/index.html'); await p.waitForTimeout(2500); };
  await abrir();
  const conta = sql => psql(sql).trim();
  ok(await p.evaluate(() => document.body.classList.contains('logado') && window.ciclodevBancoInfo().carregado), 'entrou e leu o banco local');
  ok(!(await p.$('#ia-raiz')), 'sem permissão, o balão não aparece');
  // Admin › Permissões de IA
  await p.evaluate(() => document.querySelector('[data-tela="admin"]').click()); await p.waitForTimeout(1200);
  await p.click('[data-adm-aba="ia"]'); await p.waitForTimeout(1500);
  const linhas = await p.$$eval('#m-admin .ia-tab tbody tr', t => t.length);
  const nPessoas = +conta('select count(*) from public.pessoas');
  ok(linhas === nPessoas, 'a aba Permissões de IA lista todos os usuários (' + linhas + ' de ' + nPessoas + ')');
  ok(await p.$$eval('#m-admin [data-ia-pessoa]', b => b.every(x => x.getAttribute('aria-checked') === 'false')), 'todo mundo começa com a IA desligada');
  if (process.env.FOTOS) await p.screenshot({path: process.env.FOTOS + '/ia_admin.png'});
  await p.click('#m-admin [data-ia-pessoa="' + eu + '"]'); await p.waitForTimeout(2000);
  ok(conta("select ativo from public.ia_permissoes where pessoa_id = '" + eu + "'") === 't', 'ligar a IA do William grava no banco');
  ok(await p.getAttribute('#m-admin [data-ia-pessoa="' + eu + '"]', 'aria-checked') === 'true', 'a chave mostra "Ligada"');
  ok(conta("select alterado_por from public.ia_permissoes where pessoa_id = '" + eu + "'") === eu, 'o banco guarda quem mudou');
  ok(!!(await p.$('#ia-raiz [data-ia-balao]')), 'com permissão, o balão aparece');
  const bal = await p.$eval('#ia-raiz [data-ia-balao]', b => { const r = b.getBoundingClientRect(); return {d: innerWidth - r.right, b: innerHeight - r.bottom, src: b.querySelector('img').getAttribute('src')}; });
  ok(bal.d >= 12 && bal.d <= 24 && bal.b >= 12 && bal.b <= 24 && bal.src === 'agente-fechado.webp', 'o balão fica no canto de baixo, à direita, com a imagem de chat fechado');
  if (process.env.FOTOS) await p.screenshot({path: process.env.FOTOS + '/ia_fechado.png'});
  // abrir e conversar
  await p.click('#ia-raiz [data-ia-balao]'); await p.waitForTimeout(1500);
  ok(await p.evaluate(() => !document.querySelector('#ia-chat').hidden && document.querySelector('#ia-raiz [data-ia-balao] img').getAttribute('src') === 'agente-aberto.webp'), 'ao clicar, o chat abre e a imagem troca para a de chat aberto');
  await p.fill('#ia-raiz [data-ia-texto]', 'Oi, agente! Quais épicos estão atrasados?'); await p.press('#ia-raiz [data-ia-texto]', 'Enter'); await p.waitForTimeout(1500);
  ok(conta("select count(*) || '/' || max(autor) || '/' || max(texto) from public.ia_mensagens where pessoa_id = '" + eu + "'") === '1/usuario/Oi, agente! Quais épicos estão atrasados?', 'a mensagem foi para o banco, na conversa do William');
  ok(await p.evaluate(() => document.querySelectorAll('#ia-raiz .ia-msg.ia-usuario').length === 1 && document.querySelector('#ia-raiz [data-ia-texto]').value === ''), 'a mensagem aparece no chat e a caixa esvazia');
  await p.fill('#ia-raiz [data-ia-texto]', 'Segunda mensagem'); await p.click('#ia-raiz [data-ia-enviar]'); await p.waitForTimeout(1500);
  ok(conta("select count(*) from public.ia_mensagens") === '2', 'o botão Enviar também grava');
  if (process.env.FOTOS) await p.screenshot({path: process.env.FOTOS + '/ia_aberto.png'});
  await p.press('#ia-raiz [data-ia-texto]', 'Escape'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelector('#ia-chat').hidden && document.querySelector('#ia-raiz [data-ia-balao] img').getAttribute('src') === 'agente-fechado.webp'), 'Esc fecha o chat e volta a imagem de chat fechado');
  // recarregar: a conversa volta do banco
  await abrir();
  await p.click('#ia-raiz [data-ia-balao]'); await p.waitForTimeout(1500);
  ok(await p.evaluate(() => [...document.querySelectorAll('#ia-raiz .ia-msg p')].map(x => x.textContent).join('|')) === 'Oi, agente! Quais épicos estão atrasados?|Segunda mensagem', 'depois de recarregar, a conversa volta do banco na ordem');
  // celular
  await p.setViewportSize({width: 390, height: 780}); await p.waitForTimeout(400);
  ok(await p.evaluate(() => { const r = document.querySelector('#ia-chat').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth; }), 'no celular o chat cabe na tela');
  if (process.env.FOTOS) await p.screenshot({path: process.env.FOTOS + '/ia_celular.png'});
  // desligar a IA: o balão some
  await p.setViewportSize({width: 1440, height: 900});
  await p.evaluate(() => document.querySelector('[data-tela="admin"]').click()); await p.waitForTimeout(1200);
  await p.click('[data-adm-aba="ia"]'); await p.waitForTimeout(1500);
  await p.click('#m-admin [data-ia-pessoa="' + eu + '"]'); await p.waitForTimeout(2000);
  ok(conta("select ativo from public.ia_permissoes where pessoa_id = '" + eu + "'") === 'f' && !(await p.$('#ia-raiz')), 'desligar a IA grava no banco e o balão some');
  ok(conta("select count(*) from public.ia_mensagens") === '2', 'desligar não apaga a conversa');
  ok(!erros.length, 'sem erro na página' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close();
  console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK');
  process.exit(falhas ? 1 : 0);
})();
