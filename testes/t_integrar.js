// Antes de ligar repositório ou banco: a janela de confirmação (integrar.js) e as chaves Desenhos / Épicos e histórias (parte 65).
// Rodar de fonte/: BD=<banco local com a parte 65> node ../testes/t_integrar.js
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
  const eu = 'd148fdc5-eef3-5398-bf89-f49b55b5cd28';
  const b = await chromium.launch(); const erros = []; let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', e => { erros.push(e.message); console.log('PAGEERROR', e.stack.split('\n').slice(0,4).join(' | ')); });
  await p.exposeFunction('__bd', s => JSON.stringify(executar(JSON.parse(s))));
  const conta = sql => psql(sql).trim();
  const app = conta("select id from public.nos where nome = 'Java BL' and tipo = 'aplicacao'");
  const REPO = conta("insert into public.repositorios (no_id, provedor, nome) values ('" + app + "', 'github', 'dono/teste-chaves') returning id");
  // fonte_opcoes roda de verdade no banco local, como o usuário logado
  await p.exposeFunction('__rpc', s => { const {fn, args} = JSON.parse(s);
    if (fn === 'fonte_opcoes'){ try { const r = psql(COMO + "select public.fonte_opcoes('" + args.p_tipo + "', '" + args.p_id + "'::uuid, " + args.p_desenhos + ", " + args.p_itens + ", " + !!args.p_lixeira + ")"); return JSON.stringify({data:JSON.parse(r), error:null}); }
      catch (e) { return JSON.stringify({data:null, error:{message:(String(e.stderr || e.message).split('\n').find(l => /ERROR/.test(l)) || 'erro').replace(/^.*ERROR:\s*/, '')}}); } }
    return JSON.stringify({data:null, error:null}); });
  await p.exposeFunction('__fn', s => JSON.stringify({data:{ok:true}, error:null}));
  const esp = conta("select id from public.espacos where dono_id = '" + eu + "' and pessoal limit 1");
  await p.addInitScript(([id, e]) => { window.__eu = id; window.__esp = e || null; }, [eu, esp]);
  await p.route('**/supabase-js@*/**', r => r.fulfill({ contentType: 'text/javascript', body: FALSO.replace("if (/^(ia_|admin_ia_|admin_usuarios|infra_)/.test(fn))", "if (/^(ia_|admin_ia_|admin_usuarios|infra_|fonte_)/.test(fn))") }));
  await p.goto('file://' + process.cwd() + '/vercel/index.html'); await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelector('[data-tela="operacoes"]').click()); await p.waitForTimeout(400);
  const caixa = () => p.evaluate(() => { const d = [...document.querySelectorAll('dialog.modal[open]')].pop(); return d ? d.textContent : ''; });
  const F = process.env.FOTOS ? process.env.FOTOS + '/' : '';

  // 1. a janela antes de ligar: onde, o que vai acontecer, o que já existe, e as duas escolhas
  await p.evaluate(a => { window.__res = undefined; window.__tf.integrarConfirmar({tipo:'repo', nome:'dono/outro-repo', noId:a, provedor:'github', mover:true}).then(r => { window.__res = r; }); }, app); await p.waitForTimeout(500);
  let t = await caixa();
  ok(/Ligar o repositório\?/.test(t) && /dono\/outro-repo/.test(t) && /vai ser ligado em .*Java BL/.test(t), 'a janela diz qual repositório e o caminho completo de onde vai ligar');
  ok(/O que vai acontecer/.test(t) && /Software/.test(t) && /Ficha técnica/.test(t) && /Criar épicos e histórias/.test(t), 'e o que o robô vai fazer');
  const n = await p.evaluate(a => window.__tf.igSituacao('app:' + a).n, app);
  ok(n > 0 && /já tem \d+ itens/.test(t) && /em andamento/.test(t) && /pode ficar repetido/.test(t), 'avisa o que já existe no ponto (' + n + ' itens) e o risco de repetir');
  const marc = await p.evaluate(() => ({ d:document.querySelector('#ig-desenhos').checked, i:document.querySelector('#ig-itens').checked }));
  ok(marc.d && !marc.i && /Esta aplicação já tem/.test(t) && await p.evaluate(() => [...document.querySelectorAll('.ig-lista li[data-ig="itens"]')].every(x => x.classList.contains('ig-off'))), 'com trabalho já existente, Épicos e histórias vem desmarcado e já riscado (Desenhos marcado)');
  if (F) await p.screenshot({path: F + 'integrar.png'});
  // confirmar sem marcar "Conferi" não deixa
  await p.evaluate(() => [...document.querySelectorAll('dialog.modal[open] .modal-rod .btn')].pop().click()); await p.waitForTimeout(300);
  ok(await p.evaluate(() => window.__res === undefined && !!document.querySelector('dialog.modal[open] #ig-conferi')), 'sem marcar Conferi, não liga');
  await p.evaluate(() => { document.querySelector('#ig-desenhos').click(); }); await p.waitForTimeout(100);
  ok(await p.evaluate(() => [...document.querySelectorAll('.ig-lista li[data-ig="desenhos"]')].every(x => x.classList.contains('ig-off'))), 'desmarcar Desenhos risca o que não vai acontecer');
  await p.evaluate(() => { document.querySelector('#ig-itens').click(); document.querySelector('#ig-desenhos').click(); document.querySelector('#ig-conferi').click(); [...document.querySelectorAll('dialog.modal[open] .modal-rod .btn')].pop().click(); }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => window.__res && window.__res.desenhos === true && window.__res.itens === true), 'confirmando, devolve as escolhas (os dois)');
  // cancelar pelo X
  await p.evaluate(a => { window.__res = 'x'; window.__tf.integrarConfirmar({tipo:'banco', nome:'Banco Y', noId:a}).then(r => { window.__res = r; }); }, app); await p.waitForTimeout(400);
  t = await caixa();
  ok(/Ligar o banco\?/.test(t) && /DER/.test(t) && /nunca os dados/.test(t), 'para banco a janela fala de DER e que nunca lê os dados');
  await p.evaluate(() => [...document.querySelectorAll('dialog.modal[open] [data-fechar]')].pop().click()); await p.waitForTimeout(300);
  ok(await p.evaluate(() => window.__res === null), 'fechar no X cancela (não liga)');

  // 2. as chaves no painel Automático: mudam sem desligar
  await p.evaluate(([a, r]) => { const T = window.__tf; T.IFR.no = a; T.IFR_AUTO.no = a; T.IFR_AUTO.repos = [{id:r, no_id:a, provedor:'github', nome:'dono/teste-chaves', branch_principal:'main', ativo:true, gera_desenhos:true, gera_itens:true}]; T.IFR_AUTO.bancos = []; T.IFR_AUTO.pedidos = []; T.IFR_AUTO.carregado = true;
    const div = document.createElement('div'); div.id = 'teste-auto'; div.innerHTML = T.ifrAutoHTML(); document.body.appendChild(div); }, [app, REPO]);
  ok(await p.evaluate(() => document.querySelectorAll('#teste-auto [data-ifr-chave]').length === 2 && /Desenhos/.test(document.querySelector('#teste-auto .ifr-chaves').textContent)), 'cada repositório mostra as chaves Desenhos e Épicos e histórias');
  await p.evaluate(() => document.querySelector('#teste-auto [data-ifr-chave="itens"]').click()); await p.waitForTimeout(400);
  t = await caixa();
  ok(/Desligar épicos e histórias/.test(t) && /continua ligado/.test(t) && /ninguém mexeu/.test(t), 'desligar épicos e histórias pergunta o que fazer com os já criados');
  await p.evaluate(() => [...document.querySelectorAll('dialog.modal[open] .modal-rod .btn')].find(x => /Deixar como estão/.test(x.textContent)).click()); await p.waitForTimeout(1500);
  ok(conta("select gera_desenhos::text || '|' || gera_itens::text from repositorios where id = '" + REPO + "'") === 'true|false', 'gravou: desenhos ligados, épicos e histórias desligados, repositório continua');
  const repor = () => p.evaluate(([a, r, d, i]) => { const T = window.__tf; T.IFR.no = a; T.IFR_AUTO.no = a; T.IFR_AUTO.repos = [{id:r, no_id:a, provedor:'github', nome:'dono/teste-chaves', branch_principal:'main', ativo:true, gera_desenhos:d, gera_itens:i}];
    document.querySelector('#teste-auto').innerHTML = T.ifrAutoHTML(); }, [app, REPO, ...conta("select gera_desenhos::text || '|' || gera_itens::text from repositorios where id = '" + REPO + "'").split('|').map(x => x === 'true')]);
  await repor();
  await p.evaluate(() => document.querySelector('#teste-auto [data-ifr-chave="desenhos"]').click()); await p.waitForTimeout(400);
  await p.evaluate(() => [...document.querySelectorAll('dialog.modal[open] [data-fechar]')].pop().click()); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelector('#teste-auto [data-ifr-chave="desenhos"]').checked) && conta("select gera_desenhos::text from repositorios where id = '" + REPO + "'") === 'true', 'fechar no X não desliga (a chave volta)');
  await repor();
  await p.evaluate(() => document.querySelector('#teste-auto [data-ifr-chave="itens"]').click()); await p.waitForTimeout(1500);
  ok(conta("select gera_itens::text from repositorios where id = '" + REPO + "'") === 'true', 'ligar de novo é na hora, sem pergunta');
  conta("delete from public.repositorios where id = '" + REPO + "'");
  // 3. um banco ligado no PROJETO aparece no painel da aplicação ("Ligados acima deste ponto"), com as mesmas chaves
  const proj = conta("select x.ancestral_id from nos_ancestrais x join nos n on n.id = x.ancestral_id where x.no_id = '" + app + "' and n.tipo = 'projeto'");
  const BHER = conta("insert into public.infra_bancos (no_id, nome, provedor) values ('" + proj + "', 'Banco do projeto', 'supabase') returning id");
  await p.evaluate(async a => { const T = window.__tf; T.UI.sel = 'app:' + a; T.IFR.no = a; await T.ifrAutoCarregar(); document.querySelector('#teste-auto').innerHTML = T.ifrAutoHTML(); }, app);
  t = await p.evaluate(() => document.querySelector('#teste-auto').textContent);
  ok(/Ligados acima deste ponto/.test(t) && /Banco do projeto/.test(t) && /\(projeto\)/.test(t) && await p.evaluate(b => document.querySelectorAll('#teste-auto [data-ifr-id="' + b + '"][data-ifr-chave]').length === 2, BHER),
    'o banco ligado no projeto aparece na aplicação, dizendo onde está ligado, com as chaves Desenhos e Épicos e histórias');
  await p.evaluate(b => document.querySelector('#teste-auto [data-ifr-id="' + b + '"][data-ifr-chave="itens"]').click(), BHER); await p.waitForTimeout(400);
  t = await caixa();
  ok(/vale para tudo o que está dentro dele/.test(t), 'desligar uma fonte do projeto avisa que vale para o projeto inteiro');
  await p.evaluate(() => [...document.querySelectorAll('dialog.modal[open] .modal-rod .btn')].find(x => /Deixar como estão/.test(x.textContent)).click()); await p.waitForTimeout(1500);
  ok(conta("select gera_itens::text from infra_bancos where id = '" + BHER + "'") === 'false', 'e grava na fonte do projeto');
  conta("delete from public.infra_bancos where id = '" + BHER + "'");
  ok(!erros.length, 'sem erro na página' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})();
