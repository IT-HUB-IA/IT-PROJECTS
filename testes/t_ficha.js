// Ficha técnica automática pela tela: o que veio do repositório e do banco aparece em cada campo, com de onde veio,
// o que a pessoa escreve fica por cima, e a ficha aberta se atualiza sozinha e avisa o que mudou.
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
  const rpcs = [];
  await p.exposeFunction('__rpc', s => { rpcs.push(JSON.parse(s).fn); return JSON.stringify({data:'x', error:null}); });
  await p.exposeFunction('__fn', s => JSON.stringify({data:{ok:true}, error:null}));
  const conta = sql => psql(sql).trim();
  const esp = COMO ? psql("select id from public.espacos where dono_id = '" + eu + "' and pessoal limit 1").trim() : '';
  await p.addInitScript(([id, e]) => { window.__eu = id; window.__esp = e || null; }, [eu, esp]);
  await p.route('**/supabase-js@*/**', r => r.fulfill({ contentType: 'text/javascript', body: FALSO.replace("if (/^(ia_|admin_ia_|admin_usuarios|infra_)/.test(fn))", "if (/^(ia_|admin_ia_|admin_usuarios|infra_)/.test(fn))") }));
  await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  const app = conta("select id from public.nos where tipo = 'aplicacao' and nome = 'Java BL'");
  psql("insert into public.git_conexoes (espaco_id, provedor, externo_id, conta) select espaco_id, 'github', '91', 'blanco' from public.nos where id = '" + app + "'");
  const repo = conta("insert into public.repositorios (no_id, provedor, nome, conexao_id, branch_principal) select '" + app + "', 'github', 'Blanco-Lisboa/B-L', (select id from public.git_conexoes where externo_id = '91'), 'main' returning id");
  const banco = conta("insert into public.infra_bancos (no_id, nome, provedor, motor, esquemas) values ('" + app + "', 'Produção', 'supabase', 'postgres', '{public}') returning id");
  const grava = (de, campos, ref) => psql("set role service_role; select public.infra_ficha_gravar('" + app + "', " + (de.repo ? "'" + de.repo + "'" : 'null') + ", " + (de.banco ? "'" + de.banco + "'" : 'null') + ", '" + (de.repo ? 'Blanco-Lisboa/B-L' : 'Produção') + "', '" + ref + "', $j$" + JSON.stringify(campos) + "$j$)");
  grava({repo}, [{secao:'Stack', campo:'Frameworks', valor:'Spring Boot 3.3.2'}, {secao:'Stack', campo:'Linguagens e versões', valor:'Java 21 (40 arquivos)'}, {secao:'Secrets catalog', campo:'Nome de cada segredo e onde fica', valor:'DB_URL (.env.example)\nJWT_SECRET (bl-sistema-java)'}], 'abc1234def');
  grava({banco}, [{secao:'Database', campo:'Banco e schema', valor:'Supabase · PostgreSQL · esquemas public · 12 tabelas'},
    {secao:'Database', campo:'Tabelas principais', valor:'clientes (12 colunas, 3 tabelas apontam para ela), pedidos (8 colunas, 1 tabela aponta para ela), log (4 colunas) e mais 9'}], 'h1');
  // uma coisa escrita à mão no mesmo campo que o código também preenche
  psql(COMO + "insert into public.ficha_campos (no_id, secao, campo, valor) values ('" + app + "', 'Stack', 'Linguagens e versões', 'Java (escrito à mão)')");
  await p.goto('file://' + process.cwd() + '/vercel/index.html'); await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelector('[data-tela="operacoes"]').click()); await p.waitForTimeout(400);
  await p.evaluate(a => { const U = window.__tf.UI; U.sel = 'app:' + a; U.view = 'sheet'; U.semArvore = true; window.__tf.rOperacoes(); }, app); await p.waitForTimeout(2500);
  const campo = k => p.evaluate(k => { const t = document.querySelector('textarea[data-ficha="' + k + '"]'); if (!t) return null; const a = t.parentElement.querySelector('.fa-auto'); return {escondido:t.classList.contains('fa-escondido'), manual:t.value, auto:a ? a.textContent : '', sob:!!(a && a.classList.contains('fa-sob'))}; }, k);
  const fw = await campo('Stack|Frameworks');
  ok(fw && fw.escondido && /Automático/.test(fw.auto) && /Spring Boot 3\.3\.2/.test(fw.auto) && /do repositório Blanco-Lisboa\/B-L/.test(fw.auto) && /commit abc1234/.test(fw.auto), 'o campo vazio mostra o valor que veio do repositório, com de onde veio e o commit');
  const lg = await campo('Stack|Linguagens e versões');
  ok(lg && !lg.escondido && lg.manual === 'Java (escrito à mão)' && lg.sob && /O código diz agora/.test(lg.auto) && /Java 21/.test(lg.auto), 'o que a pessoa escreveu fica por cima; embaixo aparece o que o código diz agora');
  const db = await campo('Database|Banco e schema');
  ok(db && /do banco Produção/.test(db.auto) && /12 tabelas/.test(db.auto), 'o banco preenche o campo dele');
  ok(/DB_URL/.test((await campo('Secrets catalog|Nome de cada segredo e onde fica')).auto), 'o catálogo de segredos mostra os nomes');
  ok(await p.evaluate(() => { const t = document.querySelector('textarea[data-ficha="Database|Tabelas principais"]'); const pl = t && t.parentElement.querySelector('.fa-auto table.planilha'); if (!pl) return false;
      const cab = [...pl.querySelectorAll('thead th')].map(x => x.textContent.trim()).join('|'), ls = [...pl.querySelectorAll('tbody tr')].map(r => [...r.children].map(c => c.textContent.trim()).join('|'));
      return cab === '#|Tabela|Colunas|Tabelas que apontam para ela' && ls.join(';') === '1|clientes|12|3;2|pedidos|8|1;3|log|4|0' && /E mais 9 tabelas/.test(t.parentElement.querySelector('.fa-auto').textContent); }),
    'Tabelas principais do banco aparecem em planilha (tabela, colunas, quantas apontam para ela) e diz quantas faltam');
  ok(await p.evaluate(() => /Preenchida sozinha:/.test(document.querySelector('.fa-faixa').textContent) && /do código \(Blanco-Lisboa\/B-L\)/.test(document.querySelector('.fa-faixa').textContent) && /do banco \(Produção\)/.test(document.querySelector('.fa-faixa').textContent)), 'a faixa do alto diz de onde a ficha se preenche');
  if (process.env.FOTOS) await p.screenshot({path: process.env.FOTOS + '/ficha_auto.png', fullPage: false});
  if (process.env.FOTOS){ await p.evaluate(() => document.querySelector('textarea[data-ficha="Stack|Frameworks"]').closest('.ficha-sec').scrollIntoView()); await p.waitForTimeout(200); await p.screenshot({path: process.env.FOTOS + '/ficha_stack.png'}); }
  // escrever à mão por cima
  await p.click('textarea[data-ficha="Stack|Frameworks"] ~ [data-fa-escrever]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => { const t = document.querySelector('textarea[data-ficha="Stack|Frameworks"]'); return !t.classList.contains('fa-escondido') && document.activeElement === t && t.parentElement.querySelector('.fa-auto').classList.contains('fa-sob'); }), 'Escrever à mão abre o campo, e o automático fica embaixo');
  await p.fill('textarea[data-ficha="Stack|Frameworks"]', 'Spring Boot (à mão)'); await p.dispatchEvent('textarea[data-ficha="Stack|Frameworks"]', 'change'); await p.waitForTimeout(1500);
  ok(conta("select valor from public.ficha_campos where no_id = '" + app + "' and campo = 'Frameworks'") === 'Spring Boot (à mão)' && conta("select valor from public.ficha_auto where no_id = '" + app + "' and campo = 'Frameworks'") === 'Spring Boot 3.3.2', 'o que foi escrito vai para a ficha da pessoa; o automático continua separado');
  // o código muda: a ficha aberta se atualiza sozinha e avisa
  grava({repo}, [{secao:'Stack', campo:'Frameworks', valor:'Spring Boot 3.4.0'}, {secao:'Stack', campo:'Linguagens e versões', valor:'Java 21 (40 arquivos)'}, {secao:'Stack', campo:'Plataformas', valor:'Docker, Supabase'}], 'fff9999aaa');
  await p.evaluate(() => { document.activeElement && document.activeElement.blur(); return window.__tf.faConferir(); }); await p.waitForTimeout(1200);
  const fw2 = await campo('Stack|Frameworks');
  ok(/Spring Boot 3\.4\.0/.test(fw2.auto) && /Mudou em .*Antes: Spring Boot 3\.3\.2/.test(fw2.auto) && /commit fff9999/.test(fw2.auto), 'quando o código muda, o campo se atualiza sozinho e mostra o valor anterior');
  ok(/A ficha técnica mudou sozinha: 2 campos/.test(await p.evaluate(() => (document.querySelector('#toast') || {}).textContent || '')), 'e avisa o que mudou');
  ok(/Docker, Supabase/.test((await campo('Stack|Plataformas')).auto) && !/DB_URL/.test((await campo('Secrets catalog|Nome de cada segredo e onde fica')).auto), 'campo novo aparece; o que o código não trouxe mais some');
  ok(await p.evaluate(() => /O que mudou nos últimos 7 dias \(1\)/.test(document.querySelector('.fa-mudancas summary').textContent) && document.querySelector('.fa-mudancas').open), 'a faixa lista o que mudou nos últimos 7 dias, aberta quando tem novidade');
  await p.click('[data-fa-atualizar]'); await p.waitForTimeout(500);
  ok(rpcs.includes('infra_auto_pedir'), 'Atualizar agora pede a leitura de novo');
  // outra aplicação: a ficha dela não mostra nada desta
  const outro = conta("select id from public.nos where tipo = 'aplicacao' and nome = 'App celular do CEO'");
  await p.evaluate(a => { const U = window.__tf.UI; U.sel = 'app:' + a; U.view = 'sheet'; window.__tf.rOperacoes(); }, outro); await p.waitForTimeout(2000);
  ok(await p.evaluate(() => !document.querySelector('.fa-auto') && /A ficha pode se preencher sozinha/.test(document.querySelector('.fa-faixa').textContent)), 'em outra aplicação, nada desta aparece; a faixa explica como ligar');
  ok(!erros.length, 'sem erro na página' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})();
