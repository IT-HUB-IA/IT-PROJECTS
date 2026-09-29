// Entregas: a tabela de versões cria e edita versões no banco local, e elas voltam iguais depois de recarregar.
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
  from:q, async rpc(fn){ if (fn === 'sou_dono_sistema') return {data:true, error:null}; if (fn !== 'vincular_meu_login') return {data:null, error:null}; return {data:[{pessoa_id:window.__eu, nome:'William', papel:'master', numero:100001, espaco_id:window.__esp || null}], error:null}; } }; } };`;
(async () => {
  prepararLogin();
  const eu = COMO ? 'd148fdc5-eef3-5398-bf89-f49b55b5cd28' : psql("select id from public.pessoas where papel='master' order by nome limit 1").trim();
  const b = await chromium.launch(); const erros = []; let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', e => { erros.push(e.message); console.log('PAGEERROR', e.stack.split('\n').slice(0,4).join(' | ')); });
  await p.exposeFunction('__bd', s => JSON.stringify(executar(JSON.parse(s))));
  const esp = COMO ? psql("select id from public.espacos where dono_id = '" + eu + "' and pessoal limit 1").trim() : '';
  await p.addInitScript(([id, e]) => { window.__eu = id; window.__esp = e || null; }, [eu, esp]);
  await p.route('**/supabase-js@*/**', r => r.fulfill({ contentType: 'text/javascript', body: FALSO }));
  await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  await p.goto('file://' + process.cwd() + '/vercel/index.html'); await p.waitForTimeout(2500);
  ok(await p.evaluate(() => document.body.classList.contains('logado') && window.ciclodevBancoInfo().carregado), 'entrou e leu o banco local');
  const espera = async () => { await p.waitForTimeout(500); await p.waitForFunction(() => !window.ciclodevSync.rodando && !window.ciclodevSync.pendente, null, {timeout: 20000}); };
  const semErro = async m => { const e = await p.evaluate(() => window.ciclodevSync.erros); ok(!e.length, m + (e.length ? ' ' + JSON.stringify(e.slice(0, 3)) : '')); };
  const conta = sql => psql(sql).trim();
  const pj = await p.evaluate(() => window.ciclodevDados().projects[0].id);
  await p.evaluate(() => document.querySelector('[data-tela="operacoes"]').click()); await p.waitForTimeout(400);
  await p.evaluate(k => { __tf.UI.sel = 'project:' + k; __tf.UI.view = 'entregas'; __tf.rOperacoes(); }, pj); await p.waitForTimeout(2000);
  ok(await p.evaluate(() => !!document.querySelector('[data-vs-abrir]')), 'o botão Editar em tabela aparece');
  await p.click('[data-vs-abrir]:not([data-vs-abrir^="m"]), [data-vs-abrir=""]'); await p.waitForTimeout(400);
  const novas = await p.evaluate(() => document.querySelectorAll('.vs-nova').length);
  await p.fill('.vs-nova [data-vs-c="nome"] >> nth=0', 'vTab1'); await p.fill('.vs-nova [data-vs-c="desc"] >> nth=0', 'Primeira');
  if (novas < 2) await p.click('[data-vs-mais]');
  await p.fill('.vs-nova [data-vs-c="nome"] >> nth=1', 'vTab2'); await p.fill('.vs-nova [data-vs-c="data"] >> nth=1', '2027-05-20');
  await p.click('dialog.vs-modal .modal-rod .btn:not(.sec)');
  await espera(); await semErro('criar as versões sem erro');
  ok(conta("select string_agg(nome || '/' || coalesce(descricao, '') , ', ' order by nome) from public.marcos where nome like 'vTab%'") === 'vTab1/Primeira, vTab2/', 'as duas versões novas estão no banco');
  ok(conta("select data from public.marcos where nome = 'vTab2'") === '2027-05-20', 'com a previsão certa');
  // editar pela tabela
  await p.click('[data-vs-abrir]:not([data-vs-abrir^="m"]), [data-vs-abrir=""]'); await p.waitForTimeout(400);
  await p.evaluate(() => { const tr = [...document.querySelectorAll('.vs-linha')].find(t => t.querySelector('[data-vs-c="nome"]').value === 'vTab1'); tr.querySelector('[data-vs-c="nome"]').value = 'vTab1 editada'; tr.querySelector('[data-vs-c="vis"]').checked = false; });
  await p.click('dialog.vs-modal .modal-rod .btn:not(.sec)');
  await espera(); await semErro('editar sem erro');
  ok(conta("select nome || '/' || visivel_cliente from public.marcos where nome like 'vTab1%'") === 'vTab1 editada/false', 'nome e "cliente vê" mudaram no banco');
  await p.reload(); await p.waitForTimeout(2500);
  ok(await p.evaluate(() => window.ciclodevDados().marcos.filter(m => /^vTab/.test(m.nome)).map(m => m.nome).sort().join(',')) === 'vTab1 editada,vTab2', 'depois de recarregar, as versões voltam iguais');
  ops.length = 0; await p.evaluate(() => { window.ciclodevGravarAgora(); }); await espera();
  ok(!ops.some(o => !o.startsWith('select') && !/uso_eventos|pessoas_preferencias/.test(o)), 'e nada fica pendente (' + ops.filter(o => !o.startsWith('select') && !/uso_eventos|pessoas_preferencias/.test(o)).join(', ') + ')');
  ok(!erros.length, 'sem erro na página ' + JSON.stringify(erros));
  console.log(falhas ? falhas + ' FALHAS' : 'TUDO OK'); await b.close();
})();
