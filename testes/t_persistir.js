// Quadro livre e visões salvas: gravam no banco local e voltam iguais depois de recarregar.
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
    if (op === 'select') sql = 'select coalesce(json_agg(linha_lida), \'[]\') from (select * from ' + T + ' order by 1 offset ' + (de || 0) + ' limit ' + ((ate || 999) - (de || 0) + 1) + ') linha_lida';   // o quadro tem uma coluna x: o apelido da linha não pode ser x
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
  const r = await p.evaluate(() => { const D = window.ciclodevDados(); const a = D.apps[0], i = D.issues.find(x => !x.arquivado); return {app:a.id, item:i.id}; });
  // monta um quadro: uma nota, um cartão do item, um cartão da aplicação e uma seta
  await p.evaluate(r => { const D = window.ciclodevDados(); const k = 'app:' + r.app; const u = () => crypto.randomUUID();
    const n1 = u(), c1 = u(), c2 = u();
    D.quadros[k] = {els:[{id:n1, tipo:'nota', texto:'Nota do teste', x:40, y:40, w:220}, {id:c1, tipo:'registro', ref:'issue:' + r.item, x:300, y:40, w:220}, {id:c2, tipo:'registro', ref:'app:' + r.app, x:560, y:40, w:220}, {id:u(), tipo:'seta', de:n1, para:c1}]};
    D.vistas.push({id:u(), nome:'Visão do teste', pessoa:window.__eu, sel:'app:' + r.app, view:'board', filtros:{meus:true}, busca:'login', raias:'nenhuma'});
    D.vistas.push({id:u(), nome:'Painel do teste', pessoa:window.__eu, sel:'app:' + r.app, view:'dashboard', filtros:{}, busca:''});
    window.ciclodevGravarAgora(); }, r);
  await espera(); await semErro('gravar quadro e visões sem erro');
  ok(conta("select count(*) from public.quadro_elementos where quadro_id = '" + r.app + "'") === '4', 'os 4 elementos do quadro estão no banco');
  ok(conta("select texto from public.quadro_elementos where quadro_id = '" + r.app + "' and tipo = 'texto'") === 'Nota do teste', 'com o texto da nota');
  ok(conta("select count(*) from public.visoes_salvas where nome in ('Visão do teste', 'Painel do teste')") === '2', 'as duas visões estão no banco');
  // mexe: move a nota e muda o texto
  await p.evaluate(r => { const q = window.ciclodevDados().quadros['app:' + r.app]; const n = q.els.find(e => e.tipo === 'nota'); n.x = 120; n.texto = 'Nota mudada'; window.ciclodevGravarAgora(); }, r);
  await espera(); await semErro('alterar sem erro');
  ok(conta("select texto || '/' || x from public.quadro_elementos where quadro_id = '" + r.app + "' and tipo = 'texto'") === 'Nota mudada/120', 'a mudança chegou no banco');
  await p.reload(); await p.waitForFunction(() => window.ciclodevBancoInfo && window.ciclodevBancoInfo().carregado && window.ciclodevDados && window.ciclodevDados().quadros, null, {timeout:30000}); await p.waitForTimeout(800);
  const volta = await p.evaluate(r => { const D = window.ciclodevDados(); const q = D.quadros['app:' + r.app] || {els:[]}; const v = D.vistas.find(x => x.nome === 'Visão do teste'), v2 = D.vistas.find(x => x.nome === 'Painel do teste');
    return q.els.map(e => e.tipo + (e.texto ? ':' + e.texto : '') + (e.ref ? ':' + e.ref.split(':')[0] : '')).sort().join(',') + ' | ' + (v ? v.view + ':' + v.busca + ':' + !!(v.filtros || {}).meus : 'sem') + ' | ' + (v2 ? v2.view : 'sem'); }, r);
  ok(volta === 'nota:Nota mudada,registro:app,registro:issue,seta | board:login:true | dashboard', 'depois de recarregar, quadro e visões voltam iguais: ' + volta);
  ops.length = 0; await p.evaluate(() => { window.ciclodevGravarAgora(); }); await espera();
  ok(!ops.some(o => !o.startsWith('select') && !/uso_eventos|pessoas_preferencias/.test(o)), 'e nada fica pendente (' + ops.filter(o => !o.startsWith('select') && !/uso_eventos|pessoas_preferencias/.test(o)).join(', ') + ')');
  // apagar a nota leva a seta junto
  await p.evaluate(r => { const q = window.ciclodevDados().quadros['app:' + r.app]; const n = q.els.find(e => e.tipo === 'nota'); q.els = q.els.filter(e => e.id !== n.id && e.de !== n.id && e.para !== n.id); window.ciclodevGravarAgora(); }, r);
  await espera(); await semErro('apagar sem erro');
  ok(conta("select count(*) from public.quadro_elementos where quadro_id = '" + r.app + "'") === '2', 'sobram os 2 cartões');
  ok(!erros.length, 'sem erro na página ' + JSON.stringify(erros));
  console.log(falhas ? falhas + ' FALHAS' : 'TUDO OK'); await b.close();
})();
