// Portal do stakeholder pela tela: criar, convidar, gerar chave, perguntar no épico, resposta do sistema de fora voltando para a tela.
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
    if (k === 'select') return () => { if (st.op !== 'select') st.ret = true; return px; };
    if (k === 'insert') return r => { st.op = 'insert'; st.row = r; return px; };
    if (k === 'upsert') return (r, o) => { st.op = 'upsert'; st.row = r; st.conflito = (o || {}).onConflict; return px; };
    if (k === 'update') return r => { st.op = 'update'; st.row = r; return px; };
    if (k === 'delete') return () => { st.op = 'delete'; return px; };
    if (k === 'match') return f => { Object.assign(st.filtro, f); return px; };
    if (k === 'eq') return (c, v) => { st.filtro[c] = v; return px; };
    return () => px; } }); return px; }
window.supabase = { createClient(){ let sess = {user:{id:'u1', email:'admin@it-ia.tec.br'}}; return { auth:{ async getSession(){ return {data:{session:sess}}; }, onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}}; }, async signOut(){} },
  from:q, async rpc(fn, args){ if (/^(portal_|pergunta_|portais_)/.test(fn)) return JSON.parse(await window.__rpc(JSON.stringify({fn, args:args || {}}))); if (fn === 'sou_dono_sistema') return {data:true, error:null}; if (fn !== 'vincular_meu_login') return {data:null, error:null}; return {data:[{pessoa_id:window.__eu, nome:'William', papel:'master', numero:100001, espaco_id:window.__esp || null}], error:null}; } }; } };`;
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
    const sql = fn === 'portais_clientes' ? "select coalesce(jsonb_agg(x), '[]') from public.portais_clientes() x" : 'select to_jsonb(public.' + fn + '(' + lista + '))';
    try { const out = psql(COMO + sql).trim(); ops.push('rpc ' + fn); return JSON.stringify({data: out ? JSON.parse(out) : null, error: null}); }
    catch (e) { const m = String(e.stderr || e.message).split('\n').find(l => /ERROR/.test(l)) || String(e.message); ops.push('ERRO rpc ' + fn + ': ' + m); return JSON.stringify({data: null, error: {message: m.replace(/^.*ERROR:\s*/, '')}}); } });
  const esp = COMO ? psql("select id from public.espacos where dono_id = '" + eu + "' and pessoal limit 1").trim() : '';
  await p.addInitScript(([id, e]) => { window.__eu = id; window.__esp = e || null; }, [eu, esp]);
  await p.route('**/supabase-js@*/**', r => r.fulfill({ contentType: 'text/javascript', body: FALSO }));
  await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  await p.goto('file://' + process.cwd() + '/vercel/index.html'); await p.waitForTimeout(2500);
  ok(await p.evaluate(() => document.body.classList.contains('logado') && window.ciclodevBancoInfo().carregado), 'entrou e leu o banco local');
  const espera = async () => { await p.waitForTimeout(500); await p.waitForFunction(() => !window.ciclodevSync.rodando && !window.ciclodevSync.pendente, null, {timeout: 20000}); };
  const semErro = async m => { const e = await p.evaluate(() => window.ciclodevSync.erros); ok(!e.length, m + (e.length ? ' ' + JSON.stringify(e.slice(0, 3)) : '')); };
  const conta = sql => psql(sql).trim();
  const bl = conta("select id from public.nos where tipo = 'cliente' and nome = 'Blanco & Lisboa'");
  const epico = conta("select i.id from public.itens i join public.nos_ancestrais a on a.no_id = i.frente_id and a.ancestral_id = '" + bl + "' where i.tipo = 'epic' and i.arquivado_em is null order by i.criado_em limit 1");
  const stAntes = conta("select status_id from public.itens where id = '" + epico + "'");
  await p.evaluate(() => document.querySelector('[data-tela="operacoes"]').click()); await p.waitForTimeout(400);
  await p.evaluate(k => { __tf.UI.sel = 'client:' + k; __tf.UI.view = 'portal'; __tf.rOperacoes(); }, bl); await p.waitForTimeout(1500);
  ok(await p.evaluate(() => !!document.querySelector('[data-pt-criar]')), 'no cliente sem portal aparece "Criar o portal"');
  await p.click('[data-pt-criar]'); await p.waitForTimeout(2500);
  await p.evaluate(k => { __tf.UI.sel = 'client:' + k; __tf.UI.view = 'portal'; __tf.rOperacoes(); }, bl); await p.waitForTimeout(2000);
  ok(conta("select count(*) from public.portais where no_id = '" + bl + "'") === '1', 'o portal foi criado no banco');
  ok(await p.evaluate(() => !!document.querySelector('[data-pt-convidar]') && !!document.querySelector('[data-pt-chave]')), 'a tela do portal mostra convidados, chave e webhook');
  await p.fill('[data-pt-convidar] [name="nome"]', 'Lucas'); await p.fill('[data-pt-convidar] [name="email"]', 'Lucas@BlancoLisboa.com'); await p.click('[data-pt-convidar] button'); await p.waitForTimeout(1500);
  ok(conta("select nome || '/' || email from public.portais_membros") === 'Lucas/lucas@blancolisboa.com', 'Lucas foi convidado (e-mail guardado em minúsculas)');
  await p.click('[data-pt-chave]'); await p.waitForTimeout(300); await p.click('dialog.modal .modal-rod .btn:not(.sec)'); await p.waitForTimeout(1500);
  const chave = await p.evaluate(() => { const c = document.querySelector('.pt-segredo code'); return c ? c.textContent : ''; });
  ok(/^cdp_[A-Za-z0-9_-]{40,}$/.test(chave), 'a chave aparece uma vez para copiar');
  ok(conta("select count(*) from public.portais_chaves where revogada_em is null") === '1', 'e fica no banco só pelo resumo');
  await p.evaluate(() => { const d = [...document.querySelectorAll('dialog.modal')].pop(); if (d) d.querySelector('.modal-rod .btn:not(.sec)').click(); });
  // perguntar pelo ⋯ do épico
  await p.evaluate(id => __tf.abrirItem(id), epico); await p.waitForTimeout(500);
  await p.click('[data-tf-acoes-item]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => [...document.querySelectorAll('#tf-menu button')].some(b => /Perguntar ao stakeholder/.test(b.textContent))), 'o ⋯ do épico tem "Perguntar ao stakeholder"');
  await p.click('#tf-menu button:has-text("Perguntar ao stakeholder")'); await p.waitForTimeout(300);
  await p.fill('#pt-q', 'O layout novo pode ir para o ar na sexta?'); await p.click('dialog.modal .modal-rod .btn:not(.sec)');
  await p.waitForFunction(() => { const s = document.querySelector('#gaveta-wrap .pt-sec'); return s && /Esperando resposta/.test(s.innerText); }, null, {timeout:20000}).catch(() => {});
  ok(conta("select sf.chave from public.itens i join public.status_fluxo sf on sf.id = i.status_id where i.id = '" + epico + "'") === 'aguardando_stakeholder', 'no banco, o épico foi para Aguardando stakeholder');
  ok(await p.evaluate(id => { const i = window.ciclodevDados().issues.find(x => x.id === id); const s = i && window.ciclodevDados().statusCustom.find(c => c.id === i.st); return s ? s.nome : ''; }, epico) === 'Aguardando stakeholder', 'na tela também');
  ok(await p.evaluate(() => { const s = document.querySelector('#gaveta-wrap .pt-sec'); return s ? s.textContent : ''; }).then(t => /Esperando resposta/.test(t) && /sexta/.test(t)), 'dentro do épico aparece a pergunta esperando');
  // o Java responde (pela função, como service_role)
  const pid = conta("select id from public.portais where no_id = '" + bl + "'"), qid = conta("select id from public.perguntas_stakeholder limit 1");
  psql("set role service_role; select public.portal_responder('" + pid + "', '" + qid + "', 'lucas@blancolisboa.com', 'Pode sim, já aprovamos.')");
  await p.evaluate(() => __tf.ptResumo()); await p.waitForTimeout(4000);
  ok(await p.evaluate(id => { const i = window.ciclodevDados().issues.find(x => x.id === id); return i && !window.ciclodevDados().statusCustom.some(c => c.id === i.st && c.nome === 'Aguardando stakeholder'); }, epico), 'depois da resposta, a tela relê e o épico sai de Aguardando stakeholder');
  ok(conta("select status_id from public.itens where id = '" + epico + "'") === stAntes, 'e volta para o status que tinha');
  ok(await p.evaluate(() => { const s = document.querySelector('#gaveta-wrap .pt-sec'); return s ? s.textContent : ''; }).then(t => /Lucas/.test(t) && /Pode sim/.test(t)), 'a resposta aparece dentro do épico');
  // no painel do cliente
  await p.evaluate(() => __tf.fecharItem());
  await p.evaluate(k => { __tf.UI.sel = 'client:' + k; __tf.UI.view = 'dashboard'; __tf.rOperacoes(); }, bl); await p.waitForTimeout(800);
  ok(await p.evaluate(() => { const s = document.querySelector('.pt-painel'); return s ? s.textContent : ''; }).then(t => /Perguntas ao stakeholder/.test(t) && /respondeu/.test(t)), 'o painel do cliente mostra a resposta');
  if (process.env.FOTOS){ await p.screenshot({path:process.env.FOTOS + '/pt_painel.png'}); await p.evaluate(k => { __tf.UI.view = 'portal'; __tf.rOperacoes(); }, bl); await p.waitForTimeout(2500); await p.screenshot({path:process.env.FOTOS + '/pt_tela.png', fullPage:true}); await p.evaluate(id => __tf.abrirItem(id), epico); await p.waitForTimeout(2500); await p.evaluate(() => { const s = document.querySelector('.pt-sec'); if (s) s.scrollIntoView(); }); await p.screenshot({path:process.env.FOTOS + '/pt_item.png'}); await p.evaluate(() => __tf.fecharItem()); }
  ops.length = 0; await p.evaluate(() => { window.ciclodevGravarAgora(); }); await espera();
  ok(!ops.some(o => !o.startsWith('select') && !/uso_eventos|pessoas_preferencias/.test(o)), 'e nada fica pendente (' + ops.filter(o => !o.startsWith('select') && !/uso_eventos|pessoas_preferencias/.test(o)).join(', ') + ')');
  const errosRpc = ops.filter(o => o.startsWith('ERRO'));
  ok(!erros.length && !errosRpc.length, 'sem erro na página nem no banco ' + JSON.stringify(erros.concat(errosRpc).slice(0, 3)));
  console.log(falhas ? falhas + ' FALHAS' : 'TUDO OK'); await b.close();
})();
