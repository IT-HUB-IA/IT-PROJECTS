// Infraestrutura: o botão Ligações abre a janela flutuante com código e bancos (o DevIT fica por cima). Rodar de fonte/: BD=<banco> node ../testes/t_ligacoes.js
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
  psql("insert into public.repositorios (no_id, provedor, nome, branch_principal) values ('" + pj + "', 'github', 'it-hub/teste-ligacoes', 'main')");
  psql("insert into public.infra_bancos (no_id, nome, provedor, motor, esquemas, servidor, ativo, ultimo_erro) values ('" + pj + "', 'Banco de produção', 'supabase', 'postgres', array['public'], 'db.exemplo', true, 'password authentication failed for user \"leitura\"')");
  await abrir();
  const FOTOS = process.env.FOTOS;
  // 1. a lateral não tem mais o painel: só o botão na barra de cima, com o resumo
  const bt = await p.evaluate(() => { const b = document.querySelector('#ops-corpo .ifv-modo [data-ifr-lig]'); return b ? {t:b.textContent, erro:b.classList.contains('com-erro')} : null; });
  ok(await p.evaluate(() => !document.querySelector('[data-ifr-lado] .ifr-auto')), 'a lateral da Infraestrutura não mostra mais o painel de código e bancos');
  ok(bt && /Ligações/.test(bt.t) && /1 código · 1 banco/.test(bt.t) && bt.erro, 'o botão Ligações fica na barra de cima, com o resumo (1 código · 1 banco) e o aviso de problema (' + (bt && bt.t) + ')');
  // o DevIT (robozinho do canto) aparece para quem pode usar; aqui ele é ligado à mão
  await p.evaluate(() => { const T = window.__tf; T.IA.posso = true; T.iaMontar(); }); await p.waitForTimeout(300);
  // visões: saíram de cima e ficaram no cartão ao lado, com o que cada uma analisa em linguagem simples
  const vis = await p.evaluate(() => { const l = document.querySelector('[data-ifr-lado]'); return {abasEmCima:!!document.querySelector('#ops-corpo .ifr-abas'), n:l.querySelectorAll('.ifr-vis-b').length,
    sel:(l.querySelector('.ifr-vis-b[aria-selected="true"]') || {}).textContent || '', foco:(l.querySelector('.ifr-foco') || {}).textContent || '', desenhosNoLado:!!l.querySelector('[data-ifr-novo], [data-ifr-zip]')}; });
  ok(!vis.abasEmCima && vis.n === 10 && /Arquitetura de Solução/.test(vis.sel), 'as 10 visões saíram de cima e viraram opções no cartão ao lado (' + vis.n + ')');
  ok(/O que esta visão analisa/.test(vis.foco) && /visto de cima/.test(vis.foco) && !vis.desenhosNoLado, 'embaixo das opções, o que a visão analisa em linguagem simples; os botões de desenho saíram do cartão');
  await p.click('[data-ifr-lado] .ifr-vis-b[data-ifr-aba="der"]'); await p.waitForTimeout(1500);
  ok(await p.evaluate(() => /DER/.test(document.querySelector('.ifr-cab h2').textContent) && /tabelas do banco/.test(document.querySelector('[data-ifr-lado] .ifr-foco').textContent)), 'escolher outra visão troca o canvas, o título e a explicação');
  await p.click('[data-ifr-lado] .ifr-vis-b[data-ifr-aba="solucao"]'); await p.waitForTimeout(1500);
  // 2. abre a janela flutuante, sem travar a tela, e o DevIT fica por cima
  const anim = await p.evaluate(() => { document.querySelector('#ops-corpo [data-ifr-lig]').click(); const w = document.getElementById('ifr-lig'); return w ? w.getAnimations().map(a => a.animationName).join(',') : ''; });
  ok(/jf-entrar/.test(anim), 'a janela entra com transição, não aparece do nada (' + anim + ')');
  await p.waitForTimeout(400);
  const j = await p.evaluate(() => { const w = document.getElementById('ifr-lig'); if (!w) return null; const r = w.getBoundingClientRect(), ia = document.getElementById('ia-raiz');
    const iaB = ia && [...ia.querySelectorAll('button')].find(x => x.offsetParent); let iaClicavel = null;
    if (iaB){ const rb = iaB.getBoundingClientRect(); const el = document.elementFromPoint(rb.left + rb.width / 2, rb.top + rb.height / 2); iaClicavel = !!el && ia.contains(el); }
    return {fixa:getComputedStyle(w).position === 'fixed', modal:!!document.querySelector('dialog[open]'), z:+getComputedStyle(w).zIndex, ziA:ia ? +getComputedStyle(ia).zIndex : null, iaClicavel,
      cols:w.querySelectorAll('.ifr-lig-col').length, t:w.textContent, dentro:r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, expandido:document.querySelector('[data-ifr-lig]').getAttribute('aria-expanded')}; });
  ok(j && j.fixa && !j.modal && j.dentro, 'Ligações abre uma janela flutuante, dentro da tela, sem travar o resto');
  ok(await p.evaluate(() => { const r = document.getElementById('ifr-lig').getBoundingClientRect(); return Math.abs(r.left - (innerWidth - r.right)) < 4 && Math.abs(r.top - (innerHeight - r.bottom)) < 4; }), 'a janela fica centralizada na tela');
  ok(await p.evaluate(() => { const w = document.getElementById('ifr-lig'); return /Desenhos de Arquitetura de Solução/.test(w.textContent) && !!w.querySelector('[data-ifr-novo]') && !!w.querySelector('[data-ifr-zip]'); }), 'os desenhos da visão (novo, gerar com o DevIT, baixar tudo) ficam dentro da janela Ligações');
  ok(j && j.cols === 2 && /Código[\s\S]*it-hub\/teste-ligacoes[\s\S]*Bancos de dados[\s\S]*Banco de produção/.test(j.t) && /Usar para/.test(j.t) && /Última atualização/.test(j.t), 'a janela mostra Código e Bancos lado a lado, cada ligação com "Usar para" e a última atualização no topo');
  ok(j && /A senha do usuário do CicloDev não confere/.test(j.t) && /Resolver com o DevIT/.test(j.t), 'o banco com problema aparece explicado, com o botão para resolver com o DevIT');
  ok(j && j.ziA !== null && j.ziA > j.z && j.iaClicavel !== false, 'o DevIT fica por cima da janela e continua clicável (z ' + (j && j.ziA) + ' > ' + (j && j.z) + ')');
  ok(await p.evaluate(() => { const ia = document.getElementById('ia-raiz'), c = document.getElementById('ia-chat'); return !!c && ia.contains(c) && getComputedStyle(ia).position === 'fixed'; }), 'a conversa do DevIT mora no mesmo bloco do robozinho (acima da janela), então abre por cima dela, sem ficar para trás');
  if (FOTOS) await p.screenshot({path: FOTOS + '/ligacoes_devit.png'});
  await p.evaluate(() => { const T = window.__tf; if (T.IA.aberto) T.iaAlternar(); }); await p.waitForTimeout(300);
  if (FOTOS) await p.screenshot({path: FOTOS + '/ligacoes.png'});
  // 3. os botões de dentro funcionam: Ligar banco abre a janela de ligar; ao fechar ela, Ligações continua aberta
  await p.click('#ifr-lig [data-ifr-banco=""]'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => /Ligar um banco/.test((document.querySelector('dialog[open] h2') || {}).textContent || '')), 'Ligar banco, dentro da janela, abre o passo de ligar o banco');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !document.querySelector('dialog[open]') && !!document.getElementById('ifr-lig')), 'Esc fecha só a janela de ligar; Ligações continua aberta');
  // 4. a chave "Desenhos" responde dentro da janela (desligar pede confirmação; o resto do fluxo é conferido em t_integrar)
  const rid = conta("select id from public.repositorios where nome = 'it-hub/teste-ligacoes'");
  await p.click('#ifr-lig [data-ifr-chave="desenhos"][data-ifr-id="' + rid + '"]'); await p.waitForTimeout(600);
  ok(await p.evaluate(() => !!document.querySelector('dialog[open]')), 'desmarcar "Desenhos" dentro da janela abre a confirmação');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok(await p.evaluate(id => !document.querySelector('dialog[open]') && document.querySelector('#ifr-lig [data-ifr-chave="desenhos"][data-ifr-id="' + id + '"]').checked && !!document.getElementById('ifr-lig'), rid), 'cancelar deixa a chave como estava e a janela de Ligações aberta');
  // 5. Esc fecha; o X fecha; sair da Infraestrutura fecha
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !document.getElementById('ifr-lig') && document.querySelector('[data-ifr-lig]').getAttribute('aria-expanded') === 'false'), 'Esc fecha a janela de Ligações');
  await p.evaluate(() => document.querySelector('#ops-corpo [data-ifr-lig]').click()); await p.waitForTimeout(300); await p.click('#ifr-lig [data-ifr-lig-fechar]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !document.getElementById('ifr-lig')), 'o X fecha a janela');
  await p.evaluate(() => document.querySelector('#ops-corpo [data-ifr-lig]').click()); await p.waitForTimeout(300);
  await p.evaluate(() => { const v = [...document.querySelectorAll('.view-b')].find(b => b.dataset.view !== 'infra'); v.click(); }); await p.waitForTimeout(600);
  ok(await p.evaluate(() => !document.getElementById('ifr-lig')), 'trocar de aba (sair da Infraestrutura) fecha a janela');
  // 6. no celular a janela ocupa a largura toda, sem passar da tela
  await p.setViewportSize({width:390, height:800}); await p.evaluate(k => { const U = window.__tf.UI; U.view = 'infra'; window.__tf.rOperacoes(); }); await p.waitForTimeout(1500);
  await p.evaluate(() => document.querySelector('#ops-corpo [data-ifr-lig]').click()); await p.waitForTimeout(400);
  ok(await p.evaluate(() => { const r = document.getElementById('ifr-lig').getBoundingClientRect(); return r.left >= 8 && r.right <= innerWidth - 8 && document.documentElement.scrollWidth <= innerWidth; }), 'no celular a janela cabe na tela, sem rolagem para o lado');
  if (FOTOS) await p.screenshot({path: FOTOS + '/ligacoes_cel.png'});
  ok(!erros.length, 'sem erro na página' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close();
  console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})();
