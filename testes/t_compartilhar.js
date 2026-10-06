// Compartilhar pelo ID (fonte/multiusuario.js): busca, mostra quem é e só grava ao confirmar. Base copiada do t_cofre.js.: duas pessoas, cada uma com a sua tela, no banco local.
// O banco grava os avisos em realtime.messages (simulação da parte 00); o teste entrega cada aviso só para quem
// entrou naquele canal (a lista de canais vem de ao_vivo_topicos(), como a pessoa logada), igual ao Realtime do Supabase.
// Rodar de fonte/: BD=<banco local com as partes 67 e 68> node ../testes/t_cofre.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { execFileSync } = require('child_process');
const BD = process.env.BD || 'ciclodev_grava';
const psql = sql => execFileSync('psql', ['-h', '/tmp', '-p', '55432', '-U', 'postgres', '-d', BD, '-v', 'ON_ERROR_STOP=1', '-Atq', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const lit = o => '$j$' + JSON.stringify(o) + '$j$';
const conta = sql => psql(sql).trim();
const comoDe = pessoa => { const uid = conta("select auth_user_id from public.pessoas where id = '" + pessoa + "'");
  return "set role authenticated; set request.jwt.claim.sub = '" + uid + "'; set request.jwt.claims = '{\"sub\":\"" + uid + "\",\"role\":\"authenticated\"}'; "; };

function executar(p, COMO){
  const {t, op, row, filtro, dentro, conflito, de, ate, sel, ret, ordem, lim, conta: cnt} = p; const T = 'public.' + t;
  const onde = f => { const ks = Object.keys(f || {}); return ks.length ? '(' + ks.join(',') + ') = (select ' + ks.join(',') + ' from json_populate_record(null::' + T + ', ' + lit(f) + '))' : 'true'; };
  const ondeSel = () => [onde(filtro), dentro ? '(' + dentro[0] + ')::text in (select json_array_elements_text(' + lit(dentro[1]) + '))' : 'true'].join(' and ');
  try {
    let sql;
    if (op === 'select' && cnt){ const n = psql(COMO + 'select count(*) from ' + T + ' where ' + ondeSel()).trim(); return {data:null, count:Number(n), error:null}; }
    if (op === 'select') sql = 'select coalesce(json_agg(x), \'[]\') from (select * from ' + T + ' where ' + ondeSel() + ' order by ' + (ordem ? ordem[0] + (ordem[1] ? ' asc' : ' desc') : '1') + ' offset ' + (de || 0) + ' limit ' + (lim || ((ate || 999) - (de || 0) + 1)) + ') x';
    else if (op === 'insert' || op === 'upsert'){ const cs = Object.keys(Array.isArray(row) ? row[0] : row);
      sql = 'insert into ' + T + ' (' + cs.join(',') + ') select ' + cs.join(',') + ' from ' + (Array.isArray(row) ? 'json_populate_recordset' : 'json_populate_record') + '(null::' + T + ', ' + lit(row) + ')' +
        (op === 'upsert' ? ' on conflict (' + conflito + ') do update set ' + (cs.filter(c => !conflito.split(',').includes(c)).map(c => c + '=excluded.' + c).join(',') || conflito.split(',')[0] + '=excluded.' + conflito.split(',')[0]) : '');
      sql = ret ? 'with u as (' + sql + ' returning *) select coalesce(json_agg(u), \'[]\') from u' : sql; }
    else if (op === 'update'){ const cs = Object.keys(row); sql = 'with u as (update ' + T + ' set ' + (cs.length === 1 ? cs[0] + ' = (select ' + cs[0] : '(' + cs.join(',') + ') = (select ' + cs.join(',')) + ' from json_populate_record(null::' + T + ', ' + lit(row) + ')) where ' + onde(filtro) + ' returning *) select coalesce(json_agg(u), \'[]\') from u'; }
    else if (op === 'delete') sql = 'delete from ' + T + ' where ' + onde(filtro);
    const out = psql(COMO + sql).trim();
    return {data: op === 'delete' ? [] : ((op === 'insert' || op === 'upsert') && !ret) ? null : JSON.parse(out || '[]'), error: null};
  } catch (e) { const m = String(e.stderr || e.message).split('\n').find(l => /ERROR/.test(l)) || String(e.message); return {data: null, error: {message: m.replace(/^.*ERROR:\s*/, '')}}; }
}
const naTelaTem = `(t => document.body.textContent.includes(t) || [...document.querySelectorAll('input, textarea')].some(x => (x.value || '').includes(t)))`;
const FALSO = `
function q(t){ const st = {t, op:'select', filtro:{}, de:0, ate:998};
  const px = new Proxy(function(){}, { get(_, k){
    if (k === 'then') return (res, rej) => window.__bd(JSON.stringify(st)).then(r => JSON.parse(r)).then(res, rej);
    if (k === 'range') return (a, b) => { st.de = a; st.ate = b; return px; };
    if (k === 'select') return (cols, o) => { if (st.op !== 'select') st.ret = true; if (o && o.count) st.conta = true; return px; };
    if (k === 'order') return (c, o) => { st.ordem = [c, !o || o.ascending !== false]; return px; };
    if (k === 'limit') return n => { st.lim = n; return px; };
    if (k === 'insert') return r => { st.op = 'insert'; st.row = r; return px; };
    if (k === 'upsert') return (r, o) => { st.op = 'upsert'; st.row = r; st.conflito = (o || {}).onConflict; return px; };
    if (k === 'update') return r => { st.op = 'update'; st.row = r; return px; };
    if (k === 'delete') return () => { st.op = 'delete'; return px; };
    if (k === 'match') return f => { Object.assign(st.filtro, f); return px; };
    if (k === 'eq') return (c, v) => { st.filtro[c] = v; return px; };
    if (k === 'in') return (c, vs) => { st.dentro = [c, vs]; return px; };
    return () => px; } }); return px; }
window.__canais = [];
window.__entregar = (topico, payload) => { window.__canais.filter(c => c.nome === topico && c.ok).forEach(c => c.hs.forEach(h => h({payload}))); };
window.__derrubar = () => { window.__canais.forEach(c => { c.ok = false; c.cb && c.cb('CHANNEL_ERROR'); }); };
window.supabase = { createClient(){ let sess = {access_token:'x', user:{id:'u1', email:'p@teste.com'}}; return { auth:{ async getSession(){ return {data:{session:sess}}; }, onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}}; }, async signOut(){} },
  storage:{ from(){ return { async upload(c){ return {data:{path:c}, error:null}; }, async createSignedUrls(ps){ return {data:ps.map(p => ({path:p, signedUrl:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'})), error:null}; }, async createSignedUrl(){ return {data:{signedUrl:'data:,'}, error:null}; } }; } },
  functions:{ async invoke(){ return {data:{ok:true}, error:null}; } },
  realtime:{ setAuth(){ } },
  channel(nome, o){ const c = {nome, privado:!!(o && o.config && o.config.private), hs:[], ok:false,
      on(tipo, f, h){ if (tipo === 'broadcast' && f && f.event === 'mudou') this.hs.push(h); return this; },
      subscribe(cb){ this.cb = cb; window.__canais.push(this); setTimeout(() => { this.ok = true; cb('SUBSCRIBED'); }, 20); return this; } }; return c; },
  removeChannel(c){ window.__canais = window.__canais.filter(x => x !== c); c.ok = false; c.cb && c.cb('CLOSED'); },
  from:q, async rpc(fn, args){ if (fn === 'ao_vivo_topicos') return JSON.parse(await window.__rpc(JSON.stringify({fn}))); if (fn === 'sou_dono_sistema') return {data:true, error:null}; if (/^admin_/.test(fn)) return {data:[], error:null}; if (fn !== 'vincular_meu_login') return {data:null, error:null}; return {data:[{pessoa_id:window.__eu, nome:window.__nome, papel:window.__papel, numero:100001, espaco_id:null}], error:null}; } }; } };`;

(async () => {
  const will = 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', ana = conta("select id from public.pessoas where nome = 'Ana (exemplo)'");
  const anaNum = conta("select numero from public.pessoas where id = '" + ana + "'");
  const COMO = {[will]: comoDe(will), [ana]: comoDe(ana)};
  const cli = conta("select n.id from public.nos n join public.espaco_membros m on m.espaco_id = n.espaco_id where m.pessoa_id = '" + will + "' and n.tipo = 'cliente' order by n.nome limit 1");
  psql("delete from public.participacoes where pessoa_id = '" + ana + "' and no_id = '" + cli + "'");
  const b = await chromium.launch(); const erros = []; let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
  const lit2 = v => v === null || v === undefined ? 'null' : typeof v === 'boolean' ? String(v) : typeof v === 'object' ? lit(v) + '::jsonb' : "'" + String(v).replace(/'/g, "''") + "'";
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const A = await ctx.newPage();
  A.on('pageerror', e => { erros.push(e.message); console.log('PAGEERROR', e.stack.split('\n').slice(0, 4).join(' | ')); });
  await A.exposeFunction('__bd', s => JSON.stringify(executar(JSON.parse(s), COMO[will])));
  await A.exposeFunction('__rpc', s => { const {fn, args} = JSON.parse(s);
    const a = Object.entries(args || {}).map(([k, v]) => k + ' => ' + lit2(v)).join(', ');
    const sql = fn === 'buscar_pessoa' ? "select coalesce(json_agg(x), '[]') from public.buscar_pessoa(" + a + ") x" : 'select to_json(public.' + fn + '(' + a + '))';
    try { const r = psql(COMO[will] + sql).trim(); return JSON.stringify({data: r ? JSON.parse(r) : null, error:null}); }
    catch(e){ const m = String(e.stderr || e.message).split('\n').find(l => /ERROR/.test(l)) || 'erro'; return JSON.stringify({data:null, error:{message:m.replace(/^.*ERROR:\s*/, '')}}); } });
  await A.addInitScript(([id]) => { window.__eu = id; window.__nome = 'William'; window.__papel = 'master'; }, [will]);
  await A.route('**/supabase-js@*/**', r => r.fulfill({ contentType: 'text/javascript', body: FALSO.replace("if (fn === 'ao_vivo_topicos') return", "if (fn === 'ao_vivo_topicos' || fn === 'buscar_pessoa') return").replace("JSON.stringify({fn})", "JSON.stringify({fn, args})") }));
  await A.goto('file://' + process.cwd() + '/vercel/index.html'); await A.waitForTimeout(2500);
  await A.evaluate(() => document.querySelector('[data-tela="operacoes"]').click()); await A.waitForTimeout(500);
  await A.evaluate(c => { const b = document.createElement('button'); b.dataset.muCompartilhar = 'client:' + c; document.body.appendChild(b); b.click(); b.remove(); }, cli); await A.waitForTimeout(500);
  const dlg = 'dialog.mu-modal[open]';
  ok(await A.evaluate(d => /Buscar/.test(document.querySelector(d + ' [data-mu-add] button').textContent), dlg), 'a janela tem Buscar (não compartilha direto)');
  // digitar o ID: busca sozinha e mostra quem é
  await A.fill(dlg + ' [data-mu-add] input', anaNum); await A.waitForTimeout(1200);
  const card = await A.evaluate(d => { const c = document.querySelector(d + ' .mu-achado-cartao'); return c ? c.textContent : ''; }, dlg);
  ok(/Ana \(exemplo\)/.test(card) && card.includes('ID ' + anaNum) && /Compartilhar com Ana/.test(card) && /Cancelar/.test(card), 'ao digitar o ID, aparece quem é (nome e ID) com Compartilhar e Cancelar: ' + card.slice(0, 80));
  if (process.env.FOTOS) await A.locator(dlg).screenshot({path: process.env.FOTOS + '/compartilhar.png'});
  ok(conta("select count(*) from public.participacoes where pessoa_id = '" + ana + "' and no_id = '" + cli + "'") === '0', 'buscar não compartilha nada');
  // Pronto sem confirmar: avisa e não fecha
  await A.evaluate(d => [...document.querySelectorAll(d + ' .modal-rod .btn')].pop().click(), dlg); await A.waitForTimeout(300);
  ok(await A.evaluate(d => !!document.querySelector(d) && /ainda não confirmou/.test(document.querySelector(d + ' [data-mu-msg]').textContent), dlg), 'clicar em Pronto sem confirmar avisa e não fecha');
  // Cancelar
  await A.evaluate(d => document.querySelector(d + ' [data-mu-cancelar]').click(), dlg); await A.waitForTimeout(200);
  ok(await A.evaluate(d => !document.querySelector(d + ' .mu-achado-cartao') && document.querySelector(d + ' [data-mu-add] input').value === '', dlg), 'Cancelar limpa a busca');
  // ID que não existe
  await A.fill(dlg + ' [data-mu-add] input', '999999'); await A.waitForTimeout(1200);
  ok(await A.evaluate(d => /Nenhuma conta com esse número/.test(document.querySelector(d + ' [data-mu-msg]').textContent) && !document.querySelector(d + ' .mu-achado-cartao'), dlg), 'ID que não existe: avisa que não achou');
  // buscar de novo pelo botão e confirmar
  await A.fill(dlg + ' [data-mu-add] input', anaNum); await A.evaluate(d => document.querySelector(d + ' [data-mu-add] button').click(), dlg); await A.waitForTimeout(1200);
  await A.evaluate(d => document.querySelector(d + ' [data-mu-confirmar]').click(), dlg); await A.waitForTimeout(1200);
  ok(conta("select count(*) from public.participacoes where pessoa_id = '" + ana + "' and no_id = '" + cli + "'") === '1', 'confirmar grava o compartilhamento no banco');
  ok(await A.evaluate(d => /Ana \(exemplo\)/.test(document.querySelector(d + ' .mu-lista').textContent) && !document.querySelector(d + ' .mu-achado-cartao'), dlg), 'a Ana aparece em Quem tem acesso');
  ok(await A.evaluate(d => (document.querySelector(d + ' .mu-lista').textContent.match(/William/g) || []).length === 1 && /trabalha junto no cliente/.test(document.querySelector(d).textContent), dlg), 'o dono aparece uma vez só; o texto diz "trabalha junto no cliente"');
  // a Ana vê o cliente e tudo o que está dentro
  const viu = conta(comoDe(ana) + "select count(*) from public.nos where id = '" + cli + "' or id in (select no_id from public.nos_ancestrais where ancestral_id = '" + cli + "')");
  const total = conta("select count(*) from public.nos where id = '" + cli + "' or id in (select no_id from public.nos_ancestrais where ancestral_id = '" + cli + "')");
  ok(+viu > 1 && viu === total, 'a Ana vê o cliente e tudo o que está dentro (' + viu + ' de ' + total + ')');
  // buscar de novo a mesma pessoa: já tem acesso
  await A.fill(dlg + ' [data-mu-add] input', anaNum); await A.waitForTimeout(1200);
  ok(await A.evaluate(d => /já tem acesso/.test(document.querySelector(d + ' [data-mu-msg]').textContent), dlg), 'buscar quem já tem acesso avisa');
  psql("delete from public.participacoes where pessoa_id = '" + ana + "' and no_id = '" + cli + "'");
  ok(!erros.length, 'sem erro na página' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})();
