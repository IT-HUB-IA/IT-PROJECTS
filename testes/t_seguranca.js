// Aba Segurança: os achados da análise automática (parte 43), criar o item, ignorar com motivo e o corrigido sozinho.
// estimativa e critérios, Entregas com andamento por pontos, exportação, janela do item (história, critérios, desenho, histórico)
// e o fluxo do P.O. (aceitar, devolver, melhoria). Rodar de fonte/: node ../testes/t_po.js (banco local com a parte 38).
// Barra Criar no topo de todas as abas de itens (mesmos botões, mesmo lugar) e as instruções para IA: o arquivo geral
// da barra e o do Criar em lote, com as frentes, versões e épicos de verdade do ponto escolhido.
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
  from:q, async rpc(fn, args){ if (/^(ia_|admin_ia_|admin_usuarios|infra_|analise_)/.test(fn)) return JSON.parse(await window.__rpc(JSON.stringify({fn, args:args || {}}))); if (fn === 'sou_dono_sistema') return {data:true, error:null}; if (/^admin_/.test(fn)) return {data:fn === 'admin_resumo' ? {gerado_em:new Date().toISOString()} : [], error:null}; if (fn !== 'vincular_meu_login') return {data:null, error:null}; return {data:[{pessoa_id:window.__eu, nome:'William', papel:'master', numero:100001, espaco_id:window.__esp || null}], error:null}; } }; } };`;
(async () => {
  prepararLogin();
  const eu = COMO ? 'd148fdc5-eef3-5398-bf89-f49b55b5cd28' : psql("select id from public.pessoas where papel='master' order by nome limit 1").trim();
  const b = await chromium.launch(); const erros = []; let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', e => { erros.push(e.message); console.log('PAGEERROR', e.stack.split('\n').slice(0,4).join(' | ')); });
  await p.exposeFunction('__bd', s => JSON.stringify(executar(JSON.parse(s))));
  const rpcs = [];
  // analise_marcar roda de verdade no banco local, como o usuário logado
  await p.exposeFunction('__rpc', s => { const {fn, args} = JSON.parse(s); rpcs.push(fn);
    if (fn === 'analise_marcar'){ const v = x => x == null ? 'null' : "'" + String(x).replace(/'/g, "''") + "'"; try { const r = psql(COMO + "select row_to_json(public.analise_marcar(" + v(args.p_id) + "::uuid, " + v(args.p_status) + "::text, " + v(args.p_motivo) + "::text, " + v(args.p_item) + "::uuid))").trim(); return JSON.stringify({data:JSON.parse(r), error:null}); }
      catch (e) { return JSON.stringify({data:null, error:{message:String(e.stderr || e.message).split('\n').find(l => /ERROR/.test(l)) || 'erro'}}); } }
    return JSON.stringify({data:'x', error:null}); });

  await p.exposeFunction('__fn', s => JSON.stringify({data:{ok:true}, error:null}));
  const conta = sql => psql(sql).trim();
  const esp = COMO ? psql("select id from public.espacos where dono_id = '" + eu + "' and pessoal limit 1").trim() : '';
  await p.addInitScript(([id, e]) => { window.__eu = id; window.__esp = e || null; }, [eu, esp]);
  await p.route('**/supabase-js@*/**', r => r.fulfill({ contentType: 'text/javascript', body: FALSO.replace("if (/^(ia_|admin_ia_|admin_usuarios|infra_)/.test(fn))", "if (/^(ia_|admin_ia_|admin_usuarios|infra_)/.test(fn))") }));
  await p.goto('file://' + process.cwd() + '/vercel/index.html'); await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelector('[data-tela="operacoes"]').click()); await p.waitForTimeout(500);
  const app = conta("select id from public.nos where tipo = 'aplicacao' order by nome limit 1");
  const F = process.env.FOTOS ? process.env.FOTOS + '/' : '';
  // o robô gravou a análise de um repositório desta aplicação (pela mesma função que ele usa)
  psql("insert into public.repositorios (id, no_id, nome, provedor) values ('aaaaaaaa-0000-0000-0000-000000000001', '" + app + "', 'it-hub/bl-java', 'github') on conflict do nothing");
  const ach = [{regra:'SEG-02', gravidade:'critica', titulo:'Chave de administrador do Supabase (service_role) no código', onde:'web/src/supabase.js:1', trecho:"createClient(url, 'eyJh…******xx')", impressao:'0000000a'},
    {regra:'INJ-01', gravidade:'critica', titulo:'SQL montado juntando texto (risco de SQL Injection)', onde:'src/main/java/bl/ClienteDao.java:3', trecho:'stmt.executeQuery("select * from clientes where cpf = \'" + cpf + "\'")', impressao:'0000000b'},
    {regra:'XSS-01', gravidade:'alta', titulo:'HTML montado com dado direto na tela (risco de XSS)', onde:'web/src/tela.js:1', trecho:'el.innerHTML = "<b>" + nome + "</b>";', impressao:'0000000c'},
    {regra:'TLS-02', gravidade:'media', titulo:'Chamada para endereço sem HTTPS', onde:'web/src/tela.js:5', trecho:'fetch("http://api.parceiro.com.br/v1")', impressao:'0000000d'}];
  psql("select public.analise_gravar('" + app + "', 'aaaaaaaa-0000-0000-0000-000000000001', null, 'it-hub/bl-java', 'abc1234', 120, $j$" + JSON.stringify(ach) + "$j$::jsonb)");
  const ver = async () => { await p.evaluate(a => { const U = window.__tf.UI; U.sel = 'app:' + a; U.view = 'seguranca'; window.__tf.SG.chave = null; window.__tf.rOperacoes(); }, app); await p.waitForTimeout(2500); };
  await ver();
  const r = await p.evaluate(() => ({ aba:!!document.querySelector('.view-b[data-view="seguranca"]'), nota:(document.querySelector('.sg-nota b') || {}).textContent, n:document.querySelectorAll('.sg-ach').length,
    crit:(document.querySelector('.sg-conta.sg-g-critica b') || {}).textContent, porque:/Por que importa\./.test((document.querySelector('.sg-ach .sg-det') || {}).textContent || '') && /OWASP Secrets Management Cheat Sheet/.test(document.querySelector('.sg-tela').textContent),
    fonte:/it-hub\/bl-java/.test((document.querySelector('.sg-fontes') || {}).textContent || '') }));
  ok(r.aba, 'a aplicação tem a aba Segurança');
  ok(r.n === 4 && r.crit === '2' && r.nota === '36', 'a aba mostra os 4 achados, 2 críticos e a nota (' + r.nota + ')');
  ok(r.porque && r.fonte, 'cada achado diz por que importa, como corrigir e a fonte OWASP; e o que foi lido aparece');
  if (F) await p.screenshot({path: F + 'seguranca.png', fullPage:true});
  // criar o item de um achado
  await p.evaluate(() => document.querySelector('[data-sg-item]').click()); await p.waitForTimeout(4000);
  ok(conta("select count(*) from itens where tipo = 'bug' and titulo like 'Segurança: SQL montado%' and moscow = 'deve' and descricao like '%Como corrigir%'") === '1', 'Criar item para corrigir cria o Bug com o que achou, por que importa e como corrigir');
  ok(conta("select count(*) from analise_achados a join itens i on i.id = a.item_id where a.impressao = '0000000b'") === '1', 'e o achado fica ligado ao item');
  ok(await p.evaluate(() => /Abrir/.test(document.querySelector('.sg-ach .sg-bts').textContent)), 'o achado passa a mostrar Abrir o item');
  // ignorar com motivo
  await p.evaluate(() => [...document.querySelectorAll('[data-sg-ignorar]')].pop().click()); await p.waitForTimeout(300);
  await p.fill('#sg-motivo', 'é um parceiro interno, sem dado sensível'); await p.evaluate(() => [...document.querySelectorAll('dialog.modal[open] .modal-rod .btn')].pop().click()); await p.waitForTimeout(1500);
  ok(conta("select status || '|' || motivo from analise_achados where impressao = '0000000d'") === 'ignorado|é um parceiro interno, sem dado sensível', 'Ignorar com motivo grava no banco');
  // a próxima análise não acha mais o XSS: ele aparece como corrigido sozinho
  psql("select public.analise_gravar('" + app + "', 'aaaaaaaa-0000-0000-0000-000000000001', null, 'it-hub/bl-java', 'def5678', 120, $j$" + JSON.stringify(ach.filter(a => a.regra !== 'XSS-01')) + "$j$::jsonb)");
  await ver(); await p.evaluate(() => document.querySelector('[data-sg-filtro="corrigido"]').click()); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelectorAll('.sg-ach').length === 1 && /Corrigido/.test(document.querySelector('.sg-ach').textContent)), 'o achado que sumiu do código aparece em Corrigidos, sozinho');
  ok(await p.evaluate(a => { const U = window.__tf.UI; U.sel = 'ws:' + window.__tf.D.ws.find(w => w.app === a).id; window.__tf.rOperacoes(); return !document.querySelector('.view-b[data-view="seguranca"]'); }, app), 'numa frente a aba Segurança não aparece (fica no projeto, produto e aplicação)');
  ok(!erros.length, 'sem erro na página' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})();
