// Busca no desenho e linhas em foco; e a tela cheia do canvas da Infraestrutura, na visão completa (só leitura, a que abre primeiro) e no modo de editar.
// Aba Infraestrutura pela tela: sub-abas, canvas no banco, card Desenho, editor, versões, imagem, macro e zip.
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
window.supabase = { createClient(){ let sess = {user:{id:window.__login || 'u1', email:'admin@it-ia.tec.br'}}; return { auth:{ async getSession(){ return {data:{session:sess}}; }, onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}}; }, async signOut(){} },
  storage:{ from(){ return { async upload(caminho, blob){ window.__deposito = window.__deposito || {}; window.__deposito[caminho] = blob.size; return {data:{path:caminho}, error:null}; }, async createSignedUrls(ps){ return {data:ps.map(p => ({path:p, signedUrl:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'})), error:null}; }, async createSignedUrl(p, s, o){ window.__baixou = (window.__baixou || []).concat(p + '|' + ((o || {}).download || '')); return {data:{signedUrl:'data:application/octet-stream;base64,SGVsbG8='}, error:null}; } }; } },
  functions:{ async invoke(nome, o){ return JSON.parse(await window.__fn(JSON.stringify(o.body || {}))); } },
  from:q, async rpc(fn, args){ if (/^(ia_|admin_ia_|admin_usuarios|infra_)/.test(fn)) return JSON.parse(await window.__rpc(JSON.stringify({fn, args:args || {}}))); if (fn === 'sou_dono_sistema') return {data:true, error:null}; if (/^admin_/.test(fn)) return {data:fn === 'admin_resumo' ? {gerado_em:new Date().toISOString()} : [], error:null}; if (fn !== 'vincular_meu_login') return {data:null, error:null}; return {data:[{pessoa_id:window.__eu, nome:'William', papel:'master', numero:100001, espaco_id:window.__esp || null}], error:null}; } }; } };`;
(async () => {
  prepararLogin();
  const eu = COMO ? 'd148fdc5-eef3-5398-bf89-f49b55b5cd28' : psql("select id from public.pessoas where papel='master' order by nome limit 1").trim();
  const b = await chromium.launch(); const erros = []; let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  p.on('pageerror', e => { erros.push(e.message); console.log('PAGEERROR', e.stack.split('\n').slice(0,4).join(' | ')); });
  await p.exposeFunction('__bd', s => JSON.stringify(executar(JSON.parse(s))));
  // as funções infra_* rodam de verdade no Postgres local, como a pessoa logada
  const litSql = v => v === null || v === undefined ? 'null' : typeof v === 'number' || typeof v === 'boolean' ? String(v) : Array.isArray(v) ? '$l$' + '{' + v.map(x => '"' + String(x).replace(/"/g, '') + '"').join(',') + '}' + '$l$' : typeof v === 'object' ? '$l$' + JSON.stringify(v) + '$l$' : '$l$' + v + '$l$';
  await p.exposeFunction('__rpc', s => { const {fn, args} = JSON.parse(s);
    if (!/^infra_/.test(fn)) return JSON.stringify({data:null, error:null});
    try { const out = psql(COMO + 'select to_json(public.' + fn + '(' + Object.entries(args).map(([k, v]) => k + ' => ' + litSql(v)).join(', ') + '))').trim(); return JSON.stringify({data:out ? JSON.parse(out) : null, error:null}); }
    catch (e) { const m = String(e.stderr || e.message).split('\n').find(l => /ERROR/.test(l)) || String(e.message); return JSON.stringify({data:null, error:{message:m.replace(/^.*ERROR:\s*/, '')}}); } });
  const conta = sql => psql(sql).trim();
  // a função diagramas de mentira: o "conversor" devolve um SVG com o nome do desenho
  const chamadas = [];
  await p.exposeFunction('__fn', s => { const o = JSON.parse(s); chamadas.push(o.acao);
    if (o.acao === 'config') return JSON.stringify({data:{ok:true, conversor:true, devit:false, github:false, figma:false}, error:null});
    if (o.acao === 'renderizar'){ const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><rect width="200" height="60" fill="#dfe"/><text x="10" y="35">renderizado</text></svg>';
      psql(COMO + "update public.infra_diagramas set svg = $v$" + svg + "$v$, erro = null, renderizado_em = now() where id = '" + o.id + "'");
      return JSON.stringify({data:{ok:true, diagrama:JSON.parse(conta("select row_to_json(d) from public.infra_diagramas d where id = '" + o.id + "'"))}, error:null}); }
    return JSON.stringify({data:null, error:{message:'Falta configurar o DevIT: a variável ANTHROPIC_API_KEY da função diagramas'}}); });
  const esp = COMO ? psql("select id from public.espacos where dono_id = '" + eu + "' and pessoal limit 1").trim() : '';
  await p.addInitScript(([id, e]) => { window.__eu = id; window.__esp = e || null; }, [eu, esp]);
  await p.route('**/supabase-js@*/**', r => r.fulfill({ contentType: 'text/javascript', body: FALSO }));
  await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  const pj = conta("select id from public.nos where tipo = 'projeto' and nome = 'BL'");
  const abrir = async () => { await p.goto('file://' + process.cwd() + '/vercel/index.html'); await p.waitForTimeout(2500);
    await p.evaluate(() => document.querySelector('[data-tela="operacoes"]').click()); await p.waitForTimeout(400);
    await p.evaluate(k => { const U = window.__tf.UI; U.sel = 'project:' + k; U.view = 'infra'; U.semArvore = true; window.__tf.rOperacoes(); }, pj); await p.waitForTimeout(3000); };
  await abrir();
  const fr = () => p.frames().find(f => f !== p.mainFrame());
  const F = process.env.FOTOS;
  await p.click('#ops-corpo [data-ifv-modo="editar"]'); await p.waitForTimeout(3000);
  // monta um quadro com tabelas e um módulo de código, e um segundo quadro com outra tabela
  await fr().evaluate(() => { const {Q, quadros, render} = window.__cvTeste;
    Q.nodes.push({id:'tb1', tipo:'tabela', titulo:'clientes', x:100, y:100, cor:'ciano', linhas:[{id:'l1', nome:'id', tipo:'uuid', chave:'pk'}, {id:'l2', nome:'cpf_cliente', tipo:'text'}, {id:'l3', nome:'nome', tipo:'text'}]},
      {id:'tb2', tipo:'tabela', titulo:'pedidos', x:500, y:100, cor:'ciano', linhas:[{id:'l4', nome:'cliente_id', tipo:'uuid', chave:'fk'}]},
      {id:'md1', tipo:'modulo', titulo:'cadastro', x:100, y:500, cor:'ouro', topicos:[{id:'t1', texto:'src/clientes/CadastroCpf.java'}, {id:'t2', texto:'src/clientes/Tela.java'}]});
    Q.edges.push({id:'e1', de:'tb2', para:'tb1', deLado:'l', paraLado:'r'});
    quadros['q2'] = {nome:'Banco financeiro', pai:'raiz', nodes:[{id:'tb9', tipo:'tabela', titulo:'cobrancas_cpf', x:0, y:0, cor:'ciano', linhas:[{id:'l9', nome:'valor', tipo:'numeric'}]}], edges:[]};
    render();
  });
  await fr().click('#b-busca'); await p.waitForTimeout(200);
  await fr().fill('#busca-in', 'cpf'); await p.waitForTimeout(800);
  const r = await fr().evaluate(() => ({
    itens:[...document.querySelectorAll('#busca-lista .br-it')].map(b => b.textContent),
    grupos:[...document.querySelectorAll('#busca-lista .br-grupo')].map(g => g.textContent),
    brilha:!!document.querySelector('.no[data-id="tb1"].achado') && !!document.querySelector('.no[data-id="md1"].achado'),
    apagado:getComputedStyle(document.querySelector('.no[data-id="tb2"]')).opacity < 0.5,
    linha:!!document.querySelector('.no[data-id="tb1"] li[data-lid="l2"].linha-achada') && !document.querySelector('.no[data-id="tb1"] li[data-lid="l3"].linha-achada'),
    arquivo:!!document.querySelector('.no[data-id="md1"] li[data-tid="t1"].linha-achada')}));
  ok(r.itens.length === 3 && r.itens.some(t => /clientes/.test(t) && /coluna: cpf_cliente/.test(t)) && r.itens.some(t => /arquivo: src\/clientes\/CadastroCpf/.test(t)) && r.itens.some(t => /cobrancas_cpf/.test(t)), 'a lista traz a tabela (com a coluna), o módulo (com o arquivo) e a tabela do outro quadro: ' + r.itens.length);
  ok(r.grupos.includes('Neste quadro') && r.grupos.includes('Em Banco financeiro'), 'resultados separados por quadro');
  ok(r.brilha && r.apagado, 'os cards achados brilham e os outros apagam');
  ok(r.linha && r.arquivo, 'a coluna e o arquivo que bateram ficam marcados dentro do card');
  if (F) await p.screenshot({path: F + '/busca_canvas.png'});
  await fr().evaluate(() => [...document.querySelectorAll('#busca-lista .br-it')].find(b => /cobrancas_cpf/.test(b.textContent)).click()); await p.waitForTimeout(900);
  ok(await fr().evaluate(() => window.__cvTeste.atualId === 'q2' && !!document.querySelector('.no[data-id="tb9"].achado') && !document.querySelector('#busca').hidden), 'clicar num resultado de outro quadro abre o quadro e foca o card, com a busca aberta');
  await fr().evaluate(() => { const b = document.querySelector('#busca-x'); b.click(); window.__cvTeste.entrarNoQuadro('raiz'); });
  await p.waitForTimeout(300);
  // linhas: passar o mouse acende as do card e apaga as outras
  ok(await fr().evaluate(() => getComputedStyle(document.querySelector('#svg-fantasma .aresta')).opacity >= 0.5), 'as linhas por cima dos cards ficam bem visíveis (não mais 16%)');
  await fr().hover('.no[data-id="tb2"]'); await p.waitForTimeout(300);
  ok(await fr().evaluate(() => document.body.classList.contains('foco-no') && !!document.querySelector('#g-arestas g[data-aresta="e1"].foco')), 'passar o mouse no card acende as linhas dele');
  if (F) await p.screenshot({path: F + '/linhas_foco.png'});
  ok(!erros.length, 'sem erro na página' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})();
