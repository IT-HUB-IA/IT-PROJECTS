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
    async signUp(a){ window.__cadastro = a; return {data:{session:null, user:{id:'novo'}}, error:null}; } },
  from:q, rpc(fn, args){ return window.__bd(JSON.stringify({op:'rpc', fn, args})).then(r => JSON.parse(r)); } }; } };`;

(async () => {
  const conta = sql => psqlRaw(sql).trim();
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
    await p.route(/viacep\.com\.br\/ws\/01310100/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({cep:'01310-100', logradouro:'Avenida Paulista', bairro:'Bela Vista', localidade:'São Paulo', uf:'SP'}) }));
    await p.goto('file://' + process.cwd() + '/vercel/index.html'); await p.waitForTimeout(2500);
    return p;
  }

  let p = await abrir(W, {user:{id:W.uid, email:W.email}});
  const foto = async (n) => { const r = await p.locator('.menu-rodape').boundingBox(); await p.screenshot({ path: n, clip: {x: r.x, y: r.y - 10, width: r.width + 20, height: r.height + 10} }); };
  await p.waitForTimeout(500);
  const med = () => p.evaluate(() => { const r = document.querySelector('.menu-rodape'), q = s => { const e = r.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return {vis: !!(b.width && b.height) && getComputedStyle(e).display !== 'none', x: Math.round(b.left), d: Math.round(b.right), y: Math.round(b.top + b.height / 2)}; };
    const rb = r.getBoundingClientRect(); return {rodape: {x: Math.round(rb.left), d: Math.round(rb.right)}, id: q('.mu-meu-id'), sino: q('.rc-sino'), sair: q('.menu-sair'), selo: q('.chip-exemplo'), sel: q('#ver-como'), nomeCortado: (() => { const n = r.querySelector('.mu-nome'); return n ? n.scrollWidth > n.clientWidth : null; })()}; });
  let m = await med(); console.log('ABERTO', JSON.stringify(m));
  ok(m.sair.vis && m.sair.d <= m.rodape.d && m.sino.vis && m.id.vis, 'nome, sino e sair aparecem inteiros dentro do menu');
  ok(!m.selo.vis, 'selo "Dados do banco" escondido');
  ok(Math.abs(m.id.y - m.sair.y) <= 2 && Math.abs(m.sino.y - m.sair.y) <= 2, 'tudo na mesma linha');
  await foto('rod_aberto.png');
  await p.evaluate(() => { const n = document.querySelector('.mu-nome'); n.textContent = 'Maria Aparecida dos Santos Albuquerque'; });
  m = await med(); ok(m.nomeCortado && m.sair.d <= m.rodape.d, 'nome longo termina com reticências sem empurrar o sair'); await foto('rod_longo.png');
  await p.evaluate(() => { const c = document.querySelector('.chip-exemplo'); c.textContent = 'Erro ao salvar'; c.classList.add('com-erro'); });
  m = await med(); ok(m.selo.vis, 'erro ao salvar continua aparecendo'); await foto('rod_erro.png');
  await p.evaluate(() => { const c = document.querySelector('.chip-exemplo'); c.classList.remove('com-erro'); });
  await p.click('#alternar'); await p.waitForTimeout(300);
  m = await med(); console.log('RECOLHIDO', JSON.stringify(m)); ok(m.sair.vis && m.id.vis && m.sair.d <= m.rodape.d, 'menu recolhido: iniciais e sair visíveis'); await foto('rod_recolhido.png');
  await p.click('#alternar'); await p.waitForTimeout(200);
  await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(300);
  await p.close();
  await b.close();
  console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK');
  process.exit(falhas ? 1 : 0);
})();
