// Abas da aplicação: as fixas na ordem certa, o Mais com as abas que cada pessoa fixa, o Calendário abrindo na semana
// e a Fila (e o Painel) se atualizando sozinhos quando outra pessoa muda os itens.
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
  const {t, op, row, filtro, conflito, de, ate, sel, ret, ordem, lim, conta} = p; const T = 'public.' + t;
  const onde = f => { const ks = Object.keys(f); return ks.length ? '(' + ks.join(',') + ') = (select ' + ks.join(',') + ' from json_populate_record(null::' + T + ', ' + lit(f) + '))' : 'true'; };
  try {
    let sql;
    if (op === 'select' && conta){ const n = psql(COMO + 'select count(*) from ' + T).trim(); ops.push('count ' + t); return {data:null, count:Number(n), error:null}; }
    if (op === 'select') sql = 'select coalesce(json_agg(x), \'[]\') from (select * from ' + T + ' order by ' + (ordem ? ordem[0] + (ordem[1] ? ' asc' : ' desc') : '1') + ' offset ' + (de || 0) + ' limit ' + (lim || ((ate || 999) - (de || 0) + 1)) + ') x';
    else if (op === 'insert' || op === 'upsert'){ const cs = Object.keys(Array.isArray(row) ? row[0] : row);
      sql = 'insert into ' + T + ' (' + cs.join(',') + ') select ' + cs.join(',') + ' from ' + (Array.isArray(row) ? 'json_populate_recordset' : 'json_populate_record') + '(null::' + T + ', ' + lit(row) + ')' +
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
    if (k === 'select') return (cols, o) => { if (st.op !== 'select') st.ret = true; if (o && o.count) st.conta = true; return px; };
    if (k === 'order') return (c, o) => { st.ordem = [c, !o || o.ascending !== false]; return px; };
    if (k === 'limit') return n => { st.lim = n; return px; };
    if (k === 'insert') return r => { st.op = 'insert'; st.row = r; return px; };
    if (k === 'upsert') return (r, o) => { st.op = 'upsert'; st.row = r; st.conflito = (o || {}).onConflict; return px; };
    if (k === 'update') return r => { st.op = 'update'; st.row = r; return px; };
    if (k === 'delete') return () => { st.op = 'delete'; return px; };
    if (k === 'match') return f => { Object.assign(st.filtro, f); return px; };
    if (k === 'eq') return (c, v) => { st.filtro[c] = v; return px; };
    return () => px; } }); return px; }
window.supabase = { createClient(){ let sess = {user:{id:window.__login || 'u1', email:'admin@it-ia.tec.br'}}; return { auth:{ async getSession(){ return {data:{session:sess}}; }, onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}}; }, async signOut(){} },
  storage:{ from(){ return { async upload(caminho, blob){ window.__deposito = window.__deposito || {}; window.__deposito[caminho] = blob.size; return {data:{path:caminho}, error:null}; }, async createSignedUrls(ps){ return {data:ps.map(p => ({path:p, signedUrl:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'})), error:null}; }, async createSignedUrl(p, s, o){ window.__baixou = (window.__baixou || []).concat(p + '|' + ((o || {}).download || '')); return {data:{signedUrl:'data:application/octet-stream;base64,SGVsbG8='}, error:null}; } }; } },
  functions:{ async invoke(nome, o){ return JSON.parse(await window.__fn(JSON.stringify(o.body || {}))); } },
  from:q, async rpc(fn, args){ if (/^(ia_|admin_ia_|admin_usuarios|infra_)/.test(fn)) return JSON.parse(await window.__rpc(JSON.stringify({fn, args:args || {}}))); if (fn === 'sou_dono_sistema') return {data:true, error:null}; if (/^admin_/.test(fn)) return {data:fn === 'admin_resumo' ? {gerado_em:new Date().toISOString()} : [], error:null}; if (fn !== 'vincular_meu_login') return {data:null, error:null}; return {data:[{pessoa_id:window.__eu, nome:'William', papel:'master', numero:100001, espaco_id:window.__esp || null}], error:null}; } }; } };`;
(async () => {
  prepararLogin();
  const eu = COMO ? 'd148fdc5-eef3-5398-bf89-f49b55b5cd28' : psql("select id from public.pessoas where papel='master' order by nome limit 1").trim();
  const b = await chromium.launch(); const erros = []; let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', e => { erros.push(e.message); console.log('PAGEERROR', e.stack.split('\n').slice(0,4).join(' | ')); });
  await p.exposeFunction('__bd', s => JSON.stringify(executar(JSON.parse(s))));
  await p.exposeFunction('__rpc', s => JSON.stringify({data:null, error:null}));
  await p.exposeFunction('__fn', s => JSON.stringify({data:{ok:true}, error:null}));
  const conta = sql => psql(sql).trim();
  const esp = COMO ? psql("select id from public.espacos where dono_id = '" + eu + "' and pessoal limit 1").trim() : '';
  await p.addInitScript(([id, e]) => { window.__eu = id; window.__esp = e || null; }, [eu, esp]);
  await p.route('**/supabase-js@*/**', r => r.fulfill({ contentType: 'text/javascript', body: FALSO }));
  await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  await p.goto('file://' + process.cwd() + '/vercel/index.html'); await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelector('[data-tela="operacoes"]').click()); await p.waitForTimeout(400);
  const app = conta("select id from public.nos where tipo = 'aplicacao' and nome = 'Java BL'"), app2 = conta("select id from public.nos where tipo = 'aplicacao' and nome = 'App celular do CEO'");
  const frente = conta("select id from public.nos where tipo = 'frente' and pai_id = '" + app + "' order by nome limit 1") || conta("select id from public.nos where tipo = 'frente' order by nome limit 1");
  const ir = async (sel, view) => { await p.evaluate(([s, v]) => { const U = window.__tf.UI; U.sel = s; if (v) U.view = v; U.semArvore = true; window.__tf.rOperacoes(); }, [sel, view]); await p.waitForTimeout(700); };
  const barra = () => p.evaluate(() => [...document.querySelectorAll('.ops-cab .views .view-casa:not([hidden]) [data-view]')].map(b => b.dataset.view).join(','));
  await ir('app:' + app, 'dashboard');
  ok(await barra() === 'dashboard,calendar,board,table,timeline,infra,sheet,backlog,entregas,seguranca,servidores', 'na aplicação, as abas fixas na ordem pedida: Painel, Calendário, Quadro, Tabela, Linha do tempo, Infraestrutura, Ficha técnica, Fila (e Entregas, Análise e Servidores, que vêm fixadas de começo) (' + await barra() + ')');
  ok(await p.evaluate(() => [...document.querySelectorAll('.ops-cab .views .view-casa:not([hidden]) [data-view]')].slice(0, 8).map(b => b.textContent).join(' · ')) === 'Painel · Calendário · Quadro · Tabela · Linha do tempo · Infraestrutura · Ficha técnica · Fila', 'com os nomes em português');
  ok(await p.evaluate(() => !!document.querySelector('.ops-cab .views [data-sm-mais-abas]') && document.querySelector('.ops-cab .views .view-casa:last-child, .ops-cab .views > :last-child').classList.contains('sm-mais-casa')), 'o Mais fica no fim da barra');
  await ir('ws:' + frente, 'dashboard');
  ok((await barra()).startsWith('dashboard,calendar,board,table,timeline,backlog'), 'na frente, as mesmas fixas que existem nela, na mesma ordem (sem Infraestrutura e Ficha técnica, que não são da frente)');
  // o Mais: fixar e tirar, por pessoa, valendo em todas as aplicações
  await ir('app:' + app, 'dashboard');
  await p.click('[data-sm-mais-abas]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => { const m = document.querySelector('.sm-abas-menu'); return !m.hidden && !!m.querySelector('[data-sm-fixar="list"]') && !m.querySelector('[data-sm-fixar="board"]') && !!m.querySelector('[data-sm-soltar="entregas"]'); }), 'o Mais mostra as outras abas com o alfinete, e as fixadas por você (as fixas não aparecem lá)');
  await p.click('[data-sm-fixar="list"]'); await p.waitForTimeout(400);
  ok(await barra() === 'dashboard,calendar,board,table,timeline,infra,sheet,backlog,entregas,seguranca,servidores,list', 'fixar a Lista põe ela na barra, depois das fixas');
  ok(await p.evaluate(() => JSON.stringify(window.__tf.UI.abasFixas)) === '["entregas","seguranca","servidores","list"]', 'fica guardado nas preferências da pessoa');
  await ir('app:' + app2, 'dashboard');
  ok((await barra()).endsWith('entregas,seguranca,servidores,list'), 'em outra aplicação a Lista fixada também aparece');
  await p.click('[data-sm-mais-abas]'); await p.waitForTimeout(200);
  await p.click('[data-sm-soltar="entregas"]'); await p.waitForTimeout(400);
  ok(await barra() === 'dashboard,calendar,board,table,timeline,infra,sheet,backlog,seguranca,servidores,list', 'tirar Entregas da barra deixa ela só no Mais');
  ok(await p.evaluate(() => !document.querySelector('.sm-abas-menu').hidden && !!document.querySelector('[data-sm-fixar="entregas"]')), 'o Mais continua aberto para fixar ou tirar outras, e Entregas volta para a lista');
  if (process.env.FOTOS) await p.screenshot({path: process.env.FOTOS + '/abas_mais.png'});
  ok(await p.evaluate(() => { const m = document.querySelector('.sm-abas-menu'), r = m.getBoundingClientRect(), a = document.querySelector('.ops-main').getBoundingClientRect(); return r.left >= a.left && r.right <= window.innerWidth; }), 'o menu Mais abre inteiro dentro da área de trabalho (não fica embaixo do menu lateral)');
  await p.click('[data-sm-escolher]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => { const fx = [...document.querySelectorAll('dialog[open] .sm-escolha input')]; const f = fx.filter(i => i.disabled); return f.length === 8 && f.every(i => i.checked) && fx.some(i => i.value === 'list' && i.checked && !i.disabled); }), 'a janela Escolher as abas mostra as 8 fixas marcadas e travadas e as suas para marcar');
  await p.evaluate(() => { const d = document.querySelector('dialog[open]'); d.close(); d.remove(); });
  // o Calendário abre na semana
  await p.evaluate(() => { window.__tf.UI.calModo = 'mes'; });
  await p.click('.ops-cab .views [data-view="calendar"]'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => window.__tf.UI.calModo === 'semana' && document.querySelector('[data-cal-modo="semana"]').getAttribute('aria-pressed') === 'true' && / a /.test(document.querySelector('.cal-cab h3').textContent)), 'o Calendário abre na semana');
  await p.click('[data-cal-modo="mes"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => window.__tf.UI.calModo === 'mes'), 'dentro dele dá para trocar para o mês');
  // a Fila se atualiza sozinha quando outra pessoa cria um item
  await p.click('.ops-cab .views [data-view="backlog"]'); await p.waitForTimeout(600);
  await p.evaluate(() => { window.__tf.SMV.eu = 0; window.__tf.SMV.assin = null; }); await p.evaluate(() => window.__tf.smAoVivo()); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !!window.__tf.SMV.assin && /^\d+\|/.test(window.__tf.SMV.assin)), 'a Fila guarda a assinatura leve dos itens (quantos e a última mudança)');
  const fr = conta("select id from public.nos where tipo = 'frente' and pai_id = '" + app2 + "' order by nome limit 1") || frente;
  const st = conta("select id from public.status_fluxo order by ordem limit 1");
  psql("insert into public.itens (frente_id, tipo, titulo, status_id) values ('" + fr + "', 'task', 'Item criado por outra pessoa agora', '" + st + "')");
  await p.evaluate(() => window.__tf.smAoVivo()); await p.waitForTimeout(2500);
  ok(await p.evaluate(() => /Item criado por outra pessoa agora/.test(document.querySelector('#ops-corpo').textContent) && /A Fila foi atualizada/.test((document.querySelector('#toast') || {}).textContent || '')), 'quando outra pessoa cria um item, a Fila mostra sozinha e avisa');
  psql("update public.itens set titulo = 'Título trocado por outra pessoa' where titulo = 'Item criado por outra pessoa agora'");
  await p.evaluate(() => { window.__tf.SMV.eu = Date.now(); }); await p.evaluate(() => window.__tf.smAoVivo()); await p.waitForTimeout(1500);
  ok(await p.evaluate(() => !/Título trocado por outra pessoa/.test(document.querySelector('#ops-corpo').textContent)), 'logo depois de você mesmo gravar, não relê à toa');
  await p.evaluate(() => { window.__tf.SMV.eu = 0; });
  psql("update public.itens set titulo = 'Título trocado de novo' where titulo = 'Título trocado por outra pessoa'");
  await p.evaluate(() => window.__tf.smAoVivo()); await p.waitForTimeout(2500);
  ok(await p.evaluate(() => /Título trocado de novo/.test(document.querySelector('#ops-corpo').textContent)), 'e a próxima mudança de outra pessoa aparece');
  ok(!erros.length, 'sem erro na página' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})();
