// Infraestrutura: o desenho completo abre de cara (sem cartão de quadro), no projeto, no produto e na aplicação;
// aplicação sem desenho vira só o cartão com o nome; quando um desenho muda no banco, a visão se remonta sozinha.
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
  const APP = '3991414f-b7a6-5abf-a62e-064efa9a9adf', PROD = 'c2c5b9eb-d8ab-5f51-8a45-aae53d38a74a', PJ = 'cea3db88-841f-5511-98d1-3bedcc411131';
  // um desenho automático como o de produção: o quadro principal só com o cartão de quadro, e o quadro com o desenho
  const mod = (id, t, x, y) => ({id, tipo:'modulo', x, y, w:260, cor:'ouro', titulo:t, subtitulo:'3 arquivos', etiquetas:['Java'], topicos:[], nota:''});
  const quadro = {nome:'Software · Blanco-Lisboa/B-L', pai:'raiz', nodes:[
    {id:'tt', tipo:'texto', x:0, y:-240, w:1600, cor:'cinza', texto:'Arquitetura de Software · Blanco-Lisboa/B-L', fonte:'g', negrito:true},
    {id:'rs', tipo:'cartao', x:0, y:-180, w:1100, h:140, cor:'ouro', texto:'27 arquivos de código em 6 módulos.', nota:''},
    {id:'g1', tipo:'grupo', x:0, y:0, w:1060, h:740, cor:'azul', titulo:'bl-sistema-java', nota:''},
    mod('m1', 'painel', 30, 60), mod('m2', 'ui', 400, 320), mod('m3', 'service', 770, 320)],
    edges:[{id:'e1', de:'m1', para:'m2', rotulo:'1 importação', cor:'azul', estilo:'curva', setas:'fim', deLado:'r', paraLado:'l'}, {id:'e2', de:'m2', para:'m3', rotulo:'5 importações', cor:'azul', estilo:'curva', setas:'fim', deLado:'r', paraLado:'l'}]};
  const raiz = {nome:'Quadro principal', pai:null, nodes:[{id:'qc', tipo:'quadro', x:0, y:0, w:260, cor:'ouro', titulo:'Software · Blanco-Lisboa/B-L', quadroId:'autoX', nota:''}], edges:[]};
  psql("insert into public.infra_canvas (no_id, aba, caminho, dados) values ('" + APP + "', 'software', 'quadros/raiz', " + lit(raiz) + "::jsonb), ('" + APP + "', 'software', 'quadros/autoX', " + lit(quadro) + "::jsonb) on conflict do nothing");
  await p.goto('file://' + process.cwd() + '/vercel/index.html'); await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelector('[data-tela="operacoes"]').click()); await p.waitForTimeout(500);
  const abrir = async sel => { await p.evaluate(s => { const U = window.__tf.UI; U.sel = s; U.view = 'infra'; U.infraAba = 'software'; window.__tf.rOperacoes(); }, sel); await p.waitForTimeout(2500); };
  const visao = () => p.evaluate(() => { const d = window.__tf.IFV.doc || {nodes:[], edges:[]}; const f = document.querySelector('#ops-corpo .ifr-frame');
    return { tipos: d.nodes.map(n => n.tipo), titulos: d.nodes.map(n => n.titulo || n.texto || ''), sub: d.nodes.map(n => n.subtitulo || ''), edges: d.edges.length, ids: new Set(d.nodes.map(n => n.id)).size === d.nodes.length,
      ligadas: d.edges.every(e => d.nodes.some(n => n.id === e.de) && d.nodes.some(n => n.id === e.para)), ro: !!(f && /"visao":true/.test(f.srcdoc) && /"ro":true/.test(f.srcdoc)), modo: [...document.querySelectorAll('#ops-corpo [data-ifv-modo]')].map(b => b.textContent + (b.classList.contains('sel') ? '*' : '')).join('|') }; });
  const FOTOS = process.env.FOTOS || '';
  // aplicação: abre direto no desenho, sem o cartão de quadro
  await abrir('app:' + APP); let v = await visao();
  ok(v.ro && !v.tipos.includes('quadro') && v.titulos.includes('painel') && v.titulos.includes('service') && v.edges === 2 && v.ligadas && v.ids, 'aplicação: o desenho abre direto (sem o cartão de quadro), com os módulos e as ligações');
  ok(v.modo === 'Desenho completo*|Editar o quadro', 'em cima do canvas: Desenho completo (escolhido) e Editar o quadro');
  if (FOTOS) await p.locator('#ops-corpo .ifr-canvas').screenshot({ path: FOTOS + '/visao_app.png' });
  // projeto: todos os produtos e aplicações; quem não tem desenho vira só o cartão com o nome
  await abrir('project:' + PJ); v = await visao();
  const semDesenho = v.titulos.filter((t, i) => /Ainda sem desenho/.test(v.sub[i]));
  ok(v.ro && !v.tipos.includes('quadro') && v.titulos.includes('painel') && v.titulos.includes('Java BL') && v.titulos.includes('Blanco & Lisboa'), 'projeto: o desenho da Java BL aparece dentro do grupo dela, dentro do produto Blanco & Lisboa');
  ok(semDesenho.includes('App celular do CEO') && semDesenho.includes('Java Fiscal') && !semDesenho.includes('Java BL'), 'projeto: aplicação sem desenho aparece só com o cartão do nome (' + semDesenho.length + ' cartões)');
  ok(v.ligadas && v.ids, 'projeto: nenhuma ligação solta e nenhum card repetido');
  if (FOTOS) await p.locator('#ops-corpo .ifr-canvas').screenshot({ path: FOTOS + '/visao_projeto.png' });
  // produto
  await abrir('product:' + PROD); v = await visao();
  ok(v.titulos.includes('Java BL') && v.titulos.includes('painel') && semDesenho.length > 1 && v.titulos.includes('App celular do CEO'), 'produto: as aplicações dele, com o desenho de quem tem');
  // o desenho muda no banco (nova publicação): a visão se remonta sozinha
  quadro.nodes.push(mod('m4', 'web', 30, 560)); quadro.edges.push({id:'e3', de:'m4', para:'m3', rotulo:'2 importações', cor:'azul', estilo:'curva', setas:'fim'});
  psql("update public.infra_canvas set dados = " + lit(quadro) + "::jsonb where no_id = '" + APP + "' and aba = 'software' and caminho = 'quadros/autoX'");
  await p.evaluate(() => window.__tf.ifrAtualizarRemoto()); await p.waitForTimeout(800); v = await visao();
  ok(v.titulos.includes('web') && v.edges === 3, 'quando o desenho muda no banco, a visão do produto se remonta sozinha (módulo novo e ligação nova)');
  // editar o quadro: volta ao quadro de sempre, que se pode mexer
  await p.click('#ops-corpo [data-ifv-modo="editar"]'); await p.waitForTimeout(2500);
  ok(await p.evaluate(() => { const f = document.querySelector('#ops-corpo .ifr-frame'); return !!f && !/"visao":true/.test(f.srcdoc) && /"ro":false/.test(f.srcdoc); }) && (await visao()).modo === 'Desenho completo|Editar o quadro*', 'Editar o quadro abre o quadro de sempre, que se pode mexer');
  await p.click('#ops-corpo [data-ifv-modo="ver"]'); await p.waitForTimeout(2500);
  ok((await visao()).ro, 'e volta para o desenho completo');
  ok(!erros.length, 'sem erro na página' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})();
