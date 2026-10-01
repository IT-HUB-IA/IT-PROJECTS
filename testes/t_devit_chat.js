// DevIT conduzindo o guia de ligar banco no chat: a tela de verdade, o banco local de verdade e a lógica de verdade da
// função devit (supabase/functions/devit/logica.ts). Rodar com: node --experimental-strip-types testes/t_devit_chat.js
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
  // a função devit de verdade, falando com o banco local: como a pessoa logada (RLS) e como o papel de serviço
  const { tratar } = await import('../supabase/functions/devit/logica.ts');
  const q = s => "'" + String(s).replace(/'/g, "''") + "'";
  const bancoDe = papel => ({
    rpc: async fn => fn === 'ia_posso' ? { data: psql(COMO + 'select public.ia_posso()').trim() === 't', error: null } : { data: null, error: { message: 'rpc ' + fn } },
    from: t => { const st = { f: [], lim: 40, cont: false, ins: null };
      const px = { select: (c, o) => { if (o && o.count) st.cont = true; return px; }, order: () => px, limit: n => { st.lim = n; return px; },
        eq: (c, v) => { st.f.push(c + ' = ' + q(v)); return px; }, gte: (c, v) => { st.f.push(c + ' >= ' + q(v)); return px; }, contains: (c, v) => { st.f.push(c + ' @> ' + q(JSON.stringify(v)) + '::jsonb'); return px; },
        insert: r => { st.ins = r; return px; },
        then: (res, rej) => { try {
          const pre = papel === 'usuario' ? COMO : '';
          let out;
          if (st.ins) out = { data: JSON.parse(psql("with u as (insert into public." + t + " (pessoa_id, autor, texto, contexto) values (" + q(st.ins.pessoa_id) + ", 'agente', " + q(st.ins.texto) + ", " + q(JSON.stringify(st.ins.contexto)) + "::jsonb) returning id, autor, texto, anexos, contexto, criado_em) select json_agg(u) from u").trim()), error: null };
          else if (t === 'ia_permissoes') out = { data: JSON.parse(psql(pre + "select coalesce(json_agg(x), '[]') from (select pessoa_id from public.ia_permissoes limit 1) x").trim()), error: null };
          else if (st.cont) out = { data: null, count: Number(psql(pre + 'select count(*) from public.' + t + (st.f.length ? ' where ' + st.f.join(' and ') : '')).trim()), error: null };
          else out = { data: JSON.parse(psql(pre + "select coalesce(json_agg(x), '[]') from (select id, autor, texto, contexto, criado_em from public." + t + " order by criado_em desc, id desc limit " + st.lim + ") x").trim()), error: null };
          return Promise.resolve(out).then(res, rej);
        } catch (e) { return Promise.resolve({ data: null, error: { message: String(e.stderr || e.message) } }).then(res, rej); } } };
      return px; } });
  const chamadas = [];
  await p.exposeFunction('__devit', async s => { chamadas.push(JSON.parse(s)); const at = await p.evaluate(() => window.__atraso || 0).catch(() => 0); if (at) await new Promise(r => setTimeout(r, at)); const r = await tratar(new Request('http://x/devit', { method: 'POST', body: s }), { env: () => undefined, usuario: bancoDe('usuario'), servico: bancoDe('servico') }); return JSON.stringify({ data: await r.json(), error: null }); });
  psql("update public.ia_permissoes set ativo = true where pessoa_id = " + q(eu));
  await p.goto('file://' + process.cwd() + '/vercel/index.html'); await p.waitForTimeout(2500);
  await p.evaluate(() => { const sb = window.ciclodevBanco; sb.functions.invoke = async (nome, o) => nome === 'devit' ? JSON.parse(await window.__devit(JSON.stringify(o.body || {}))) : {data:null, error:{message:'?'}};
    const rpc0 = sb.rpc.bind(sb); sb.rpc = async (fn, a) => fn === 'ia_posso' ? {data:true, error:null} : fn === 'ia_novidades' ? {data:0, error:null} : fn === 'ia_marcar_visto' ? {data:null, error:null} : rpc0(fn, a); });
  await p.evaluate(() => window.__tf.iaConferir()); await p.waitForTimeout(400);
  const FOTOS = process.env.FOTOS || '';
  const chat = () => p.evaluate(() => { const c = document.querySelector('#ia-chat'); const ms = [...c.querySelectorAll('.ia-msg')]; const u = ms[ms.length - 1];
    return { aberto: !c.hidden, n: ms.length, ultima: u ? u.textContent : '', botoes: [...c.querySelectorAll('[data-ia-botao]')].map(b => b.textContent), codigos: c.querySelectorAll('.ia-cod pre').length, aviso: [...c.querySelectorAll('.ia-aviso')].map(a => a.textContent).join(' | ') }; });
  const clicar = async rotulo => { await p.locator('#ia-chat [data-ia-botao]', { hasText: rotulo }).first().click(); await p.waitForTimeout(700); };
  // o botão Guia passo a passo da Infraestrutura abre o chat do DevIT (não a janela)
  await p.evaluate(() => { const T = window.__tf; T.IFR_AUTO.repos = []; T.IFR_AUTO.bancos = []; T.IFR_AUTO.pedidos = []; const d = document.createElement('div'); d.id = 'ops-corpo'; d.innerHTML = '<div class="ifr-tela">' + T.ifrAutoHTML() + '</div>'; document.body.appendChild(d); });
  await p.locator('#ops-corpo [data-ifr-guia]').click(); await p.waitForTimeout(900);
  let c = await chat();
  ok(c.aberto && !document_temJanela(await p.evaluate(() => !!document.querySelector('dialog.ifr-gp-dlg'))) && /onde o seu banco está/.test(c.ultima) && c.botoes.join('|') === 'Supabase|AWS (RDS ou Aurora)', 'Guia passo a passo abre o chat do DevIT perguntando onde o banco está, com os botões Supabase e AWS');
  await clicar('Supabase'); c = await chat();
  const av = await p.evaluate(() => { const ms = [...document.querySelectorAll('#ia-chat .ia-msg')]; return ms.map(m => m.classList.contains('ia-agente') ? (m.querySelector('.ia-av-agente img') ? 'robo' : 'sem') : (m.querySelector('.ia-av-usuario') || {}).textContent || 'sem'); });
  ok(av.length >= 3 && av.every(x => x === 'robo' || /^[A-Z]$/.test(x)) && av.includes('robo') && av.some(x => /^[A-Z]$/.test(x)), 'cada balão tem a fotinha: o robozinho do DevIT ou a inicial de quem está logado (' + av.join(',') + ')');
  ok(!/^Oi/.test((await p.evaluate(() => [...document.querySelectorAll('#ia-chat .ia-agente .ia-texto')].pop().textContent)).trim()), 'depois da primeira fala, o DevIT não cumprimenta de novo');
  ok(/banco do Supabase/.test(c.ultima) && c.botoes[0] === 'Vamos começar', 'escolher Supabase: o DevIT explica o que vai acontecer e pergunta se pode começar');
  ok(conta("select count(*) from public.ia_mensagens where autor = 'usuario' and texto = 'Supabase' and contexto->>'valor' = 'guia:banco-supabase'") === '1', 'o clique vira uma fala da pessoa guardada na conversa');
  await clicar('Vamos começar'); await clicar('Feito'); c = await chat();
  ok(/Passo 2 de 6/.test(c.ultima) && c.codigos === 1 && c.botoes.join('|') === 'Feito, próximo passo|Tenho uma dúvida|Deu erro', 'o passo 2 aparece com o comando num bloco e os botões Feito, dúvida e erro');
  if (FOTOS) await p.locator('#ia-chat').screenshot({ path: FOTOS + '/devit_passo2.png' });
  await p.evaluate(() => { window.__copiado = ''; navigator.clipboard.writeText = t => { window.__copiado = t; return Promise.resolve(); }; });
  await p.locator('#ia-chat [data-ia-copiar]').last().click(); await p.waitForTimeout(200);
  ok(await p.evaluate(() => /^create role leitura_ciclodev with login password/.test(window.__copiado)), 'o botão Copiar do chat copia o comando inteiro');
  // dúvida escrita (sem chave de IA: responde pela base)
  await clicar('Tenho uma dúvida');
  await p.fill('#ia-raiz [data-ia-texto]', 'apareceu role leitura_ciclodev already exists, e agora?'); await p.press('#ia-raiz [data-ia-texto]', 'Enter'); await p.waitForTimeout(900); c = await chat();
  ok(/já existia/.test(c.ultima) && /Passo/.test(await p.evaluate(() => document.querySelector('#ia-chat').textContent)) && c.botoes[0] === 'Feito, próximo passo', 'a dúvida escrita é respondida e o DevIT continua no mesmo passo');
  // senha no chat: a tela não deixa mandar
  const antes = conta("select count(*) from public.ia_mensagens");
  await p.fill('#ia-raiz [data-ia-texto]', 'postgresql://leitura_ciclodev.abc:SenhaSecreta1@aws-0-sa-east-1.pooler.supabase.com:5432/postgres'); await p.press('#ia-raiz [data-ia-texto]', 'Enter'); await p.waitForTimeout(500); c = await chat();
  ok(conta("select count(*) from public.ia_mensagens") === antes && /Não mande senha/.test(c.aviso) && conta("select count(*) from public.ia_mensagens where texto like '%SenhaSecreta1%'") === '0', 'endereço com senha não é enviado nem guardado; a tela avisa');
  await p.fill('#ia-raiz [data-ia-texto]', '');
  for (const r of ['Feito', 'Feito', 'Feito']) await clicar(r);
  c = await chat();
  ok(/Passo 5 de 6/.test(c.ultima) && c.botoes[0] === 'Abrir a janela de ligar banco', 'o passo de colar o endereço oferece o botão de abrir a janela de ligar banco');
  await clicar('Feito'); await clicar('Feito'); c = await chat();
  ok(/banco está ligado/.test(c.ultima) && !c.botoes.length, 'no fim, o DevIT encerra o guia sem botões');
  const n = chamadas.length;
  await p.fill('#ia-raiz [data-ia-texto]', 'obrigado!'); await p.press('#ia-raiz [data-ia-texto]', 'Enter'); await p.waitForTimeout(600);
  ok(chamadas.length === n, 'com o guia encerrado, a mensagem fica guardada e o DevIT não é chamado');
  if (FOTOS) await p.locator('#ia-chat').screenshot({ path: FOTOS + '/devit_fim.png' });
  ok(conta("select count(*) from public.ia_mensagens where autor = 'agente' and contexto ? 'guia'") >= '10', 'as falas do DevIT ficam guardadas na conversa, com o guia e o passo');
  // Encerrar no meio do guia, com o DevIT digitando antes de responder (atraso de mentira para ver os pontinhos)
  await p.evaluate(() => { window.__atraso = 700; });
  await p.locator('#ops-corpo [data-ifr-guia]').click(); await p.waitForTimeout(1200);
  await clicar('AWS (RDS ou Aurora)'); await p.waitForTimeout(900);
  ok(await p.evaluate(() => !document.querySelector('#ia-raiz [data-ia-encerrar]').hidden), 'com um guia em andamento aparece Encerrar conversa no topo do chat');
  await p.locator('#ia-chat [data-ia-botao]', { hasText: 'Vamos começar' }).first().click(); await p.waitForTimeout(250);
  const dig = await p.evaluate(() => { const d = document.querySelector('#ia-chat .ia-pensando'); return !!(d && d.querySelectorAll('.ia-dig i').length === 3 && d.querySelector('.ia-av-agente')); });
  if (FOTOS) await p.locator('#ia-chat').screenshot({ path: FOTOS + '/devit_digitando.png' });
  ok(dig, 'enquanto o DevIT pensa, aparecem os três pontinhos animados com a fotinha dele');
  await p.waitForTimeout(900);
  ok(await p.evaluate(() => { const ms = [...document.querySelectorAll('#ia-chat .ia-msg')]; return ms[ms.length - 1].classList.contains('ia-nova') && getComputedStyle(ms[ms.length - 1]).animationName === 'ia-msg-entrar'; }), 'a mensagem nova entra com transição');
  await p.click('#ia-raiz [data-ia-encerrar]'); await p.waitForTimeout(1800); c = await chat();
  ok(/encerrei por aqui/.test(c.ultima) && !c.botoes.length && await p.evaluate(() => document.querySelector('#ia-raiz [data-ia-encerrar]').hidden), 'Encerrar conversa corta o guia no meio: o DevIT se despede e o botão some');
  ok(conta("select count(*) from public.ia_mensagens where autor = 'usuario' and contexto->>'valor' = 'parar'") === '1', 'o encerrar fica registrado na conversa, para o DevIT saber que a pessoa quis parar');
  await p.evaluate(() => { window.__atraso = 0; });
  await p.click('#ia-raiz [data-ia-fechar]'); await p.waitForTimeout(60);
  const saindo = await p.evaluate(() => { const c = document.querySelector('#ia-chat'); return !c.hidden && c.classList.contains('ia-saindo'); });
  await p.waitForTimeout(300);
  ok(saindo && await p.evaluate(() => document.querySelector('#ia-chat').hidden), 'fechar o chat tem transição e depois ele some');
  await p.click('#ia-raiz [data-ia-balao]'); await p.waitForTimeout(40);
  ok(await p.evaluate(() => document.querySelector('#ia-chat').classList.contains('ia-entrando')), 'abrir o chat tem transição');
  ok(!erros.length, 'sem erro na página' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})();
function document_temJanela(x){ return x; }
