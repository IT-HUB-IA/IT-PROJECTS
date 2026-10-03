// Ligar banco do Supabase sem senha (parte 54): abre por padrão, conecta pela janelinha (PKCE), escolhe o projeto,
// só liga quando a conferência passa; o jeito do endereço testa antes de salvar. Rodar de fonte/: node ../testes/t_supa_conectar.js (banco local com a parte 54).
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
  const esp = conta("select id from public.espacos where dono_id = '" + eu + "' and pessoal limit 1");
  const app = conta("select n.id from public.nos n where n.tipo = 'aplicacao' and n.espaco_id = '" + esp + "' order by n.nome limit 1");
  const CON = conta("insert into public.supa_conexoes (espaco_id, conta, criado_por) values ('" + esp + "', 'Empresa X', '" + eu + "') returning id");
  const CON2 = conta("insert into public.supa_conexoes (espaco_id, conta, criado_por) values ('" + esp + "', 'Empresa Y', '" + eu + "') returning id");
  conta("delete from public.supa_conexoes where id in ('" + CON + "', '" + CON2 + "')");   // começa sem conta; volta pela janelinha
  let segunda = false;
  const fns = []; let modo = 'falha', prova = null;
  await p.exposeFunction('__rpc', s => { const {fn, args} = JSON.parse(s);
    if (fn === 'supa_app_status') return JSON.stringify({data:{pronto:true, client_id:'cli-123456', retorno:'https://ciclodev.app/entrar.html?git=supabase'}, error:null});
    if (fn === 'supa_estado_novo') return JSON.stringify({data:{estado:'est-1', desafio:'d'.repeat(43)}, error:null});
    if (fn === 'infra_banco_supabase_ligar'){ try { const r = psql(COMO + "select row_to_json(public.infra_banco_supabase_ligar('" + args.p_no + "'::uuid, null, " + (args.p_nome ? "'" + args.p_nome.replace(/'/g, "''") + "'" : 'null') + ", '" + args.p_prova + "'::uuid))"); return JSON.stringify({data:JSON.parse(r), error:null}); }
      catch (e) { return JSON.stringify({data:null, error:{message:(String(e.stderr || e.message).split('\n').find(l => /ERROR/.test(l)) || 'erro').replace(/^.*ERROR:\s*/, '')}}); } }
    if (fn === 'infra_banco_salvar') return JSON.stringify({data:{id:'x'}, error:null});
    return JSON.stringify({data:null, error:null}); });
  const CONF = {so_leitura:true, tabelas:12, colunas:80, chaves:12, ligacoes:9, regras:20, permissoes:30, papeis:2, com_rls:12, migracoes:7, avisos:[], falhas:[], esquemas:['public']};
  await p.exposeFunction('__fn', s => { const c = JSON.parse(s); fns.push(c.acao);
    if (c.acao === 'concluir' && segunda){ conta("insert into public.supa_conexoes (id, espaco_id, conta, criado_por) values ('" + CON2 + "', '" + esp + "', 'Empresa Y', '" + eu + "') on conflict do nothing"); return JSON.stringify({data:{ok:true, conexao_id:CON2, conta:'Empresa Y', projetos:[{ref:'yyyyyyyyyyyyyyyyyyyy', nome:'Financeiro Y', regiao:'us-east-1'}]}, error:null}); }
    if (c.acao === 'concluir'){ conta("insert into public.supa_conexoes (id, espaco_id, conta, criado_por) values ('" + CON + "', '" + esp + "', 'Empresa X', '" + eu + "') on conflict do nothing"); return JSON.stringify({data:{ok:true, conexao_id:CON, conta:'Empresa X', projetos:[{ref:'abcdefghijklmnopqrst', nome:'Produção', regiao:'sa-east-1'}, {ref:'zyxwvutsrqponmlkjihg', nome:'Testes', regiao:'sa-east-1'}]}, error:null}); }
    if (c.acao === 'projetos') return JSON.stringify({data:{ok:true, projetos:c.conexao_id === CON2 ? [{ref:'yyyyyyyyyyyyyyyyyyyy', nome:'Financeiro Y'}] : [{ref:'abcdefghijklmnopqrst', nome:'Produção'}, {ref:'zyxwvutsrqponmlkjihg', nome:'Testes'}]}, error:null});
    if (c.acao === 'conferir'){
      if (modo === 'falha') return JSON.stringify({data:{ok:false, falhas:['Não deu para ler todas as regras de acesso (RLS): o banco tem 20 e vieram 0.'], conferencia:Object.assign({}, CONF, {regras:0})}, error:null});
      prova = conta("insert into interno.supa_provas (conexao_id, projeto, nome_projeto, esquemas, pessoa_id, resultado) values ('" + CON + "', '" + c.projeto + "', 'Produção', '{public}', '" + eu + "', '" + JSON.stringify(Object.assign({ok:true}, CONF)) + "') returning id");
      return JSON.stringify({data:{ok:true, prova, projeto:{ref:c.projeto, nome:'Produção'}, conferencia:CONF}, error:null}); }
    if (c.acao === 'testar_endereco') return JSON.stringify({data:modo === 'falha' ? {ok:false, falhas:['connect failed: password authentication failed for user "leitura_ciclodev"']} : {ok:true, resultado:{tabelas:5, colunas:20, chaves:5, ligacoes:3, regras:4, permissoes:6, papeis:1}}, error:null});
    return JSON.stringify({data:{ok:false, erro:'?'}, error:null}); });
  await p.addInitScript(([id, e]) => { window.__eu = id; window.__esp = e || null; window.open = u => { window.__aberto = u; return {focus(){}}; }; }, [eu, esp]);
  await p.route('**/supabase-js@*/**', r => r.fulfill({ contentType: 'text/javascript', body: FALSO.replace("if (/^(ia_|admin_ia_|admin_usuarios|infra_)/.test(fn))", "if (/^(ia_|admin_ia_|admin_usuarios|infra_|supa_)/.test(fn))") }));
  await p.goto('file://' + process.cwd() + '/vercel/index.html'); await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelector('[data-tela="operacoes"]').click()); await p.waitForTimeout(400);
  await p.evaluate(a => { window.__tf.IFR.no = a; window.__tf.IFR_AUTO.bancos = []; window.__tf.IFR_AUTO.repos = []; window.__tf.IFR_AUTO.pedidos = []; }, app);
  const FOTOS = process.env.FOTOS || '';
  const caixa = () => p.evaluate(() => { const d = [...document.querySelectorAll('dialog.modal[open]')].pop(); return d ? d.textContent : ''; });
  // a janela de confirmação antes de ligar (integrar.js): marca Conferi e confirma
  const confirmarLigar = async () => { await p.waitForTimeout(600); return p.evaluate(() => { const c = document.querySelector('dialog.modal[open] #ig-conferi'); if (!c) return false; c.click(); [...document.querySelectorAll('dialog.modal[open] .modal-rod .btn')].pop().click(); return true; }); };


  // 1. Ligar banco (Supabase) abre o jeito sem senha
  await p.evaluate(() => window.__tf.ifrBancoModal(null)); await p.waitForTimeout(500);
  let t = await caixa();
  ok(/Ligar um banco do Supabase/.test(t) && /confere de verdade/.test(t) && /nunca lê o conteúdo das tabelas/.test(t) && /Nenhuma organização do Supabase/.test(t) && /uma organização por vez/.test(t), 'Ligar banco abre o jeito sem senha, explica a conferência e mostra que falta conectar a conta');
  ok(/Prefiro colar o endereço/.test(t), 'o jeito do endereço continua como segunda opção');
  // 2. a janelinha do Supabase, com PKCE
  await p.click('dialog.modal[open] [data-sc-conectar]'); await p.waitForTimeout(500);
  const url = await p.evaluate(() => window.__aberto || '');
  ok(/^https:\/\/api\.supabase\.com\/v1\/oauth\/authorize\?/.test(url) && /code_challenge=d{43}/.test(url) && /code_challenge_method=S256/.test(url) && /state=est-1/.test(url) && /client_id=cli-123456/.test(url), 'Conectar abre a janelinha do Supabase com o desafio PKCE e o estado');
  await p.evaluate(() => new BroadcastChannel('ciclodev-git').postMessage({git:'supabase', code:'cod-1', state:'est-1'})); await p.waitForTimeout(1500);
  t = await caixa();
  ok(fns.includes('concluir') && /Empresa X/.test(t) && await p.evaluate(() => !!document.querySelector('dialog.modal[open] #sc-proj')), 'a volta da janelinha guarda a conta e mostra os projetos para escolher');
  // segunda organização: o Supabase autoriza uma por vez; a lista junta os projetos das duas
  segunda = true;
  await p.click('dialog.modal[open] [data-sc-conectar]'); await p.waitForTimeout(400);
  // a volta vale mesmo sem o registro de espera desta aba (foi o que perdia a autorização) e a janelinha recebe a resposta
  await p.evaluate(() => { localStorage.removeItem('ciclodev-git-espera'); window.__respostas = []; const c = new BroadcastChannel('ciclodev-git'); c.onmessage = m => { if (m.data && m.data.resposta) window.__respostas.push(m.data); }; window.__canal = c;
    new BroadcastChannel('ciclodev-git').postMessage({git:'supabase', code:'cod-2', state:'est-2'}); }); await p.waitForTimeout(1500);
  const resp = await p.evaluate(() => window.__respostas);
  ok(fns.filter(x => x === 'concluir').length === 2 && resp.length === 1 && resp[0].ok && resp[0].resposta === 'est-2' && /Empresa Y/.test(resp[0].texto), 'sem o registro de espera, a volta ainda conclui e a janelinha recebe "organização Empresa Y conectada"');
  const grupos = await p.evaluate(() => [...document.querySelectorAll('dialog.modal[open] #sc-proj optgroup')].map(g => g.label + ':' + g.querySelectorAll('option').length));
  t = await caixa();
  ok(grupos.join() === 'Empresa X:2,Empresa Y:1' && /Conectar outra organização/.test(t), 'duas organizações conectadas: os projetos das duas aparecem juntos, separados pela organização (' + grupos.join(' | ') + ')');
  await p.selectOption('dialog.modal[open] #sc-proj', CON + '|abcdefghijklmnopqrst');
  // 3. conferência que não passa: não liga
  await p.click('dialog.modal[open] .modal-rod .btn:not(.sec)'); await p.waitForTimeout(800);
  t = await caixa();
  ok(/Não ligou: a leitura não está completa/.test(t) && /regras de acesso \(RLS\)/.test(t) && /Nada foi ligado/.test(t), 'conferência incompleta: mostra o que faltou e não liga');
  ok(conta("select count(*) from public.infra_bancos where supa_conexao_id is not null") === '0', 'e nada foi gravado no banco');
  if (FOTOS) await p.locator('dialog.modal[open]').screenshot({path: FOTOS + '/sc_falhou.png'});
  // 4. conferência completa: liga de verdade, com a prova
  modo = 'ok';
  await p.click('dialog.modal[open] .modal-rod .btn:not(.sec)');
  const viu = await confirmarLigar(); await p.waitForTimeout(1500);
  ok(viu, 'antes de ligar, aparece a janela de confirmação (onde, o que vai acontecer, o que montar)');
  ok(conta("select count(*) || '/' || max(supa_projeto) || '/' || max((validacao->>'tabelas')) from public.infra_bancos where supa_conexao_id = '" + CON + "'") === '1/abcdefghijklmnopqrst/12', 'conferência completa: liga pelo Supabase, com o resultado da conferência guardado');
  ok(conta("select count(*) from interno.infra_bancos_conexao c join public.infra_bancos b on b.id = c.banco_id where b.supa_conexao_id = '" + CON + "'") === '0', 'sem endereço nem senha guardados');
  ok(!(await p.evaluate(() => [...document.querySelectorAll('dialog.modal[open]')].length)), 'a janela fecha depois de ligar');
  const card = await p.evaluate(() => window.__tf.ifrAutoHTML());
  ok(/sem senha/.test(card) && /Ligado pelo Supabase, sem senha\. Conferido em/.test(card) && /12 tabelas, 20 regras de acesso/.test(card), 'o card do banco diz que foi ligado sem senha e o que a conferência achou');
  // 5. jeito antigo: o endereço é testado antes de salvar
  modo = 'falha';
  await p.evaluate(() => window.__tf.ifrBancoModal(null, 'aws')); await p.waitForTimeout(300);
  await p.fill('#ifr-b-host', 'meu.abc.us-east-1.rds.amazonaws.com'); await p.fill('#ifr-b-base', 'postgres'); await p.fill('#ifr-b-senha', 'SenhaBoa123');
  await p.click('dialog.modal[open] .modal-rod .btn:not(.sec)'); await p.waitForTimeout(800);
  t = await caixa();
  ok(/Não salvou: o teste não passou/.test(t) && /A senha do usuário do CicloDev não confere/.test(t) && !fns.slice(-1).includes('x'), 'endereço com senha errada: o teste mostra o motivo e não salva');
  modo = 'ok';
  await p.click('dialog.modal[open] .modal-rod .btn:not(.sec)'); await confirmarLigar(); await p.waitForTimeout(1200);
  ok(!(await p.evaluate(() => [...document.querySelectorAll('dialog.modal[open]')].length)) && fns.filter(x => x === 'testar_endereco').length === 2, 'endereço que passa no teste: salva e fecha');
  // 6. Admin: o passo a passo do app no Supabase
  const adm = await p.evaluate(() => { window.__tf.SC.status = {pronto:false}; return window.__tf.scAdminHTML(); });
  ok(/OAuth Apps/.test(adm) && /\?git=supabase/.test(adm) && /só leitura/.test(adm) && /Não marque nada de escrita/.test(adm), 'Admin: passo a passo do app do Supabase, com o endereço de volta e só permissões de leitura');
  ok(!erros.length, 'sem erro na página' + (erros.length ? ': ' + erros.join(' | ') : ''));
  conta("delete from public.infra_bancos where supa_conexao_id = '" + CON + "'"); conta("delete from public.supa_conexoes where id in ('" + CON + "', '" + CON2 + "')");
  await b.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})();
