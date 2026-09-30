// Guia de ligar banco (Supabase e AWS): abre pelo botão, troca de aba, copia o comando, "Ligar banco agora" já vem com o provedor
// certo, e a janela de ligar recusa os erros mais comuns do endereço do Supabase antes de salvar.
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
  await p.goto('file://' + process.cwd() + '/vercel/index.html'); await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelector('[data-tela="operacoes"]').click()); await p.waitForTimeout(400);
  const FOTOS = process.env.FOTOS || '';
  // o bloco Bancos de dados tem o botão do guia
  const bloco = await p.evaluate(() => { const T = window.__tf; T.IFR_AUTO.repos = []; T.IFR_AUTO.bancos = []; T.IFR_AUTO.pedidos = []; return T.ifrAutoHTML(); });
  ok(/data-ifr-guia>Guia passo a passo</.test(bloco), 'o bloco Bancos de dados tem o botão Guia passo a passo');
  // lista estreita (a lateral da Infraestrutura): o nome do banco não pode virar uma letra por linha
  const alt = await p.evaluate(() => { const T = window.__tf; T.IFR_AUTO.bancos = [{id:'b1', nome:'Banco de produção', provedor:'supabase', motor:'postgres', esquemas:['public'], servidor:'aws-1-sa-east-1.pooler.supabase.com', ativo:true, ultima_leitura_em:new Date(Date.now() - 37 * 60000).toISOString(), ultimo_erro:'password authentication failed for user "leitura_ciclodev"'}]; T.IFR_AUTO.repos = [{id:'r1', nome:'Blanco-Lisboa/B-L', provedor:'github', branch_principal:'main'}]; T.IFR_AUTO.pedidos = [{status:'pronto', origem:'manual', concluido_em:new Date(Date.now() - 37 * 60000).toISOString(), diagramas:['a','b','c'], resumo:[{banco:'Banco de produção', erro:'password authentication failed for user "leitura_ciclodev"'}]}];
    const d = document.createElement('div'); d.className = 'ifr-lado-teste'; d.style.cssText = 'position:fixed;left:0;top:0;width:260px;background:#fff;z-index:99999;padding:12px'; d.innerHTML = T.ifrAutoHTML(); document.body.appendChild(d);
    const sp = [...d.querySelectorAll('.ifr-fonte-cab b')].find(x => /Banco de produção/.test(x.textContent)); return sp.getBoundingClientRect().height; });
  if (FOTOS) await p.locator('.ifr-lado-teste').screenshot({path: FOTOS + '/lista_bancos.png'});
  ok(alt < 40, 'na lateral estreita o nome do banco fica numa linha só (' + Math.round(alt) + ' px de altura)');
  const painel = await p.evaluate(() => { const d = document.querySelector('.ifr-lado-teste'); return {t:d.textContent, erros:(d.textContent.match(/password authentication failed/g) || []).length}; });
  ok(/A senha do usuário do CicloDev não confere/.test(painel.t) && /Não conectou/.test(painel.t) && !/Lido há/.test(painel.t) && /Resolver com o DevIT/.test(painel.t), 'banco com erro: selo Não conectou, explicação em português e botão para resolver com o DevIT (sem dizer Lido)');
  ok(painel.erros === 1 && /1 fonte com problema: veja acima/.test(painel.t) && /Concluída com problema/.test(painel.t) && /Pedida pelo botão Atualizar agora/.test(painel.t), 'o erro aparece uma vez só; a última atualização diz o porquê e aponta para a fonte com problema');
  await p.evaluate(() => { document.querySelector('.ifr-lado-teste').remove(); window.__tf.IFR_AUTO.bancos = []; window.__tf.IFR_AUTO.repos = []; window.__tf.IFR_AUTO.pedidos = []; });
  // abre o guia do Supabase
  await p.evaluate(() => window.__tf.ifrGuiaAbrir('supabase')); await p.waitForTimeout(300);
  const g1 = await p.evaluate(() => { const d = document.querySelector('dialog.ifr-gp-dlg'); return d && {t:d.textContent, passos:d.querySelectorAll('.ifr-gp-passo').length, aba:d.querySelector('[data-ifr-gp].sel').textContent}; });
  ok(g1 && g1.aba === 'Supabase' && g1.passos === 6, 'o guia abre na aba Supabase com 6 passos');
  ok(g1 && /Session pooler/.test(g1.t) && /leitura_ciclodev\./.test(g1.t) && /default_transaction_read_only/.test(g1.t) && /Tenant or user not found/.test(g1.t), 'o guia do Supabase explica o usuário de leitura, o Session pooler e os erros comuns');
  ok(g1 && !/grant usage/.test(g1.t), 'o Supabase não pede permissão em tabela nenhuma (a estrutura já é visível)');
  if (FOTOS) await p.locator('dialog.ifr-gp-dlg').screenshot({path: FOTOS + '/guia_supabase.png'});
  await p.evaluate(() => { window.__copiado = ''; navigator.clipboard.writeText = t => { window.__copiado = t; return Promise.resolve(); }; });
  await p.locator('dialog.ifr-gp-dlg [data-ifr-copiar]').first().click(); await p.waitForTimeout(200);
  ok(await p.evaluate(() => /^create role leitura_ciclodev with login/.test(window.__copiado)), 'Copiar copia o comando inteiro');
  // aba AWS
  await p.locator('dialog.ifr-gp-dlg [data-ifr-gp="aws"]').click(); await p.waitForTimeout(200);
  const g2 = await p.evaluate(() => document.querySelector('dialog.ifr-gp-dlg #ifr-gp-corpo').textContent);
  ok(/Publicly accessible/.test(g2) && /Inbound rules/.test(g2) && /Reader/.test(g2) && /require ssl/.test(g2) && /0\.0\.0\.0\/0/.test(g2), 'a aba AWS explica acesso público, security group, endpoint Reader do Aurora e o usuário do MySQL');
  if (FOTOS) await p.locator('dialog.ifr-gp-dlg').screenshot({path: FOTOS + '/guia_aws.png'});
  // "Ligar banco agora" abre a janela de ligar já na AWS
  await p.locator('dialog.ifr-gp-dlg .modal-rod button', {hasText: 'Ligar banco agora'}).click(); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !document.querySelector('dialog.ifr-gp-dlg') && [...document.querySelectorAll('dialog.modal')].some(d => /Ligar um banco de dados/.test(d.textContent) && d.querySelector('input[name="ifr-b-prov"][value="aws"]').checked && d.querySelector('#ifr-b-host'))), 'Ligar banco agora fecha o guia e abre a janela de ligar já na AWS');
  await p.evaluate(() => document.querySelectorAll('dialog.modal').forEach(d => { d.close(); d.remove(); }));
  // janela de ligar (Supabase): o link do guia abre por cima, e o endereço é conferido antes de salvar
  await p.evaluate(() => window.__tf.ifrBancoModal(null, 'supabase')); await p.waitForTimeout(200);
  await p.locator('dialog.modal [data-ifr-guia-abrir]').click(); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.querySelectorAll('dialog[open]').length === 2 && document.querySelector('dialog.ifr-gp-dlg [data-ifr-gp="supabase"].sel')), 'dentro da janela de ligar, o link abre o guia por cima, na aba do provedor escolhido');
  await p.locator('dialog.ifr-gp-dlg .modal-rod button', {hasText: 'Fechar'}).click(); await p.waitForTimeout(200);
  const salvar = async url => { await p.evaluate(u => { document.querySelector('#ifr-b-url').value = u; document.querySelectorAll('.toast').forEach(t => t.remove()); }, url);
    await p.locator('dialog.modal .modal-rod button', {hasText: 'Salvar'}).click(); await p.waitForTimeout(250);
    return p.evaluate(() => ({toast:[...document.querySelectorAll('.toast, [class*="toast"]')].map(t => t.textContent).join(' | '), aberta:!!document.querySelector('#ifr-b-url')})); };
  const ruins = [
    ['postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres', /YOUR-PASSWORD/],
    ['postgresql://postgres.abcdefghijklmnop:Senha123@aws-0-sa-east-1.pooler.supabase.com:5432/postgres', /não o postgres/],
    ['postgresql://leitura_ciclodev:Senha123@aws-0-sa-east-1.pooler.supabase.com:5432/postgres', /código do projeto/],
    ['postgresql://postgres:Senha123@db.abcdefghijklmnop.supabase.co:5432/postgres', /conexão direta/]];
  for (const [u, re] of ruins){ const r = await salvar(u); ok(r.aberta && re.test(r.toast) && !rpcs.includes('infra_banco_salvar'), 'recusa antes de salvar: ' + (r.toast || '(sem aviso)')); }
  const r = await salvar('postgresql://leitura_ciclodev.abcdefghijklmnop:SenhaForte123@aws-0-sa-east-1.pooler.supabase.com:5432/postgres');
  ok(!r.aberta && rpcs.includes('infra_banco_salvar'), 'o endereço certo do Session pooler salva');
  ok(!erros.length, 'sem erro na página' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})();
