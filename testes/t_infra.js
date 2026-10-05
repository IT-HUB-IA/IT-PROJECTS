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
    await p.evaluate(k => { const U = window.__tf.UI; U.sel = 'project:' + k; U.view = 'infra'; U.infraModo = 'desenhos'; U.semArvore = true; window.__tf.rOperacoes(); }, pj); await p.waitForTimeout(3000); };
  await abrir();
  ok(await p.evaluate(() => document.querySelectorAll('.ifr-vis-b').length === 10 && !!document.querySelector('.view-b[data-view="infra"]')), 'o projeto tem a aba Infraestrutura com as 10 sub-abas');
  const fr = () => p.frames().find(f => f !== p.mainFrame());
  ok(!!fr() && await fr().evaluate(() => !!window.__PONTE && document.querySelectorAll('#barra [data-criar]').length === 12 && !!document.querySelector('#barra [data-criar="tabela"]') && !!document.querySelector('#barra [data-criar="fluxo"]')), 'o canvas abre dentro da aba, com a barra de criar (inclusive tabela e passo de processo)');
  ok(await fr().evaluate(() => !!document.querySelector('#barra [data-criar="diagrama"]')), 'a barra do canvas tem o card "Desenho do sistema"');
  // criar o card Desenho pelo canvas: pede para escolher, cria um desenho novo e liga no card
  await fr().click('#barra [data-criar="diagrama"]'); await p.waitForTimeout(800);
  ok(await p.evaluate(() => /Qual desenho/.test((document.querySelector('dialog.modal[open] h2') || {}).textContent || '')), 'ao criar o card, o CicloDev pergunta qual desenho vai nele');
  await p.click('dialog.modal[open] .modal-rod .btn.sec:nth-child(2)'); await p.waitForTimeout(500);
  await p.fill('#ifr-n-nome', 'Contexto do sistema'); await p.click('dialog.modal[open] .modal-rod .btn:not(.sec)'); await p.waitForTimeout(2500);
  ok(conta("select count(*) || '/' || max(formato) || '/' || max(versao) from public.infra_diagramas where no_id = '" + pj + "' and aba = 'solucao'") === '1/structurizr/1', 'o desenho novo foi para o banco, com o formato da sub-aba (Structurizr)');
  ok(conta("select (fonte like 'workspace%')::text from public.infra_diagramas where no_id = '" + pj + "'") === 'true', 'e já começa com um modelo pronto do formato');
  await p.waitForTimeout(1500);
  ok(conta("select count(*) from public.infra_canvas c, jsonb_array_elements(c.dados -> 'nodes') n where c.no_id = '" + pj + "' and c.aba = 'solucao' and c.caminho = 'quadros/raiz' and n ->> 'tipo' = 'diagrama' and n ->> 'diagramaId' = (select id::text from public.infra_diagramas where no_id = '" + pj + "')") === '1', 'o card do canvas ficou ligado ao desenho, gravado no banco (infra_canvas)');
  // editar o código e gerar a imagem
  ok(await p.evaluate(() => !!document.querySelector('dialog.ifr-modal[open] #ifr-fonte')), 'o editor do desenho abre com o código');
  await p.fill('dialog.ifr-modal[open] #ifr-fonte', 'workspace { model { u = person "Usuário" s = softwareSystem "CicloDev" u -> s "Usa" } views { systemContext s { include * autolayout } } }');
  await p.click('dialog.ifr-modal[open] .modal-rod button:has-text("Salvar e gerar imagem")'); await p.waitForTimeout(2500);
  ok(conta("select versao || '/' || (svg is not null)::text from public.infra_diagramas where no_id = '" + pj + "'") === '2/true', 'salvar o código sobe a versão e a imagem é gerada pelo conversor');
  ok(conta("select count(*) || '/' || max(versao) from public.infra_diagramas_versoes") === '1/1', 'a versão anterior ficou guardada');
  ok(chamadas.includes('renderizar'), 'a tela chamou a função diagramas para gerar a imagem');
  await p.waitForTimeout(800);
  ok(await fr().evaluate(() => !!document.querySelector('.t-diagrama .dg-img img') && /Contexto do sistema/.test(document.querySelector('.t-diagrama .dg-titulo').textContent)), 'o card do canvas mostra a imagem do desenho');
  if (process.env.FOTOS) await p.screenshot({path: process.env.FOTOS + '/infra_canvas.png'});
  // DevIT sem chave: avisa qual falta
  await p.click('[data-ifr-gerar]'); await p.waitForTimeout(1500);
  ok(/ANTHROPIC_API_KEY/.test(await p.evaluate(() => (document.querySelector('#toast') || {}).textContent || '')), 'Gerar com o DevIT sem a chave avisa qual chave falta');
  ok(await p.evaluate(() => /DevIT \(inteligência artificial\)falta configurar/.test(document.querySelector('[data-ifr-lado]').textContent) && /Conversor de imagensligado/.test(document.querySelector('[data-ifr-lado]').textContent) && /de 5 ligados/.test(document.querySelector('[data-ifr-lado]').textContent)), 'o lado mostra quais chaves já estão prontas e quais faltam');
  // recarregar: tudo volta do banco
  await abrir();
  await p.waitForTimeout(1000);
  ok(await fr().evaluate(() => !!document.querySelector('.t-diagrama .dg-img img')), 'depois de recarregar, o canvas volta do banco com o card e a imagem');
  ok(await p.evaluate(() => /Contexto do sistema/.test(document.querySelector('[data-ifr-lado]').textContent)), 'e a lista mostra o desenho');
  // um desenho no produto aparece no projeto (macro)
  const pr = conta("select id from public.nos where tipo = 'produto' and pai_id = '" + pj + "' order by nome limit 1");
  psql(COMO + "insert into public.infra_diagramas (no_id, aba, nome, formato, fonte) values ('" + pr + "', 'solucao', 'Contexto do produto', 'mermaid', 'flowchart LR\nA-->B')");
  await abrir();
  ok(await p.evaluate(() => /Dos produtos deste projeto[\s\S]*Contexto do produto/.test(document.querySelector('[data-ifr-lado]').textContent)), 'no projeto (macro), aparecem também os desenhos dos produtos');
  // baixar tudo na estrutura docs/diagrams
  const [dl] = await Promise.all([p.waitForEvent('download', {timeout:8000}).catch(() => null), p.click('[data-ifr-zip]')]);
  let lista = '';
  if (dl){ const cam = require('path').join(require('os').tmpdir(), 'infra.zip'); await dl.saveAs(cam); lista = require('child_process').execFileSync('unzip', ['-l', cam], {encoding:'utf8'}); }
  ok(/docs\/diagrams\/README\.md/.test(lista) && /docs\/diagrams\/manifest\.json/.test(lista) && /docs\/diagrams\/architecture\/contexto-do-sistema\.dsl/.test(lista) && /architecture\/rendered\/contexto-do-sistema\.svg/.test(lista) && /produtos\/[a-z0-9-]+\/architecture\/contexto-do-produto\.mmd/.test(lista) && /docs\/diagrams\/navegar\.html/.test(lista), 'Baixar tudo gera o zip na estrutura docs/diagrams (código, imagem, manifesto, produtos e o arquivo navegável)');
  // outra sub-aba: outro canvas
  await p.click('[data-ifr-aba="der"]'); await p.waitForTimeout(2500);
  ok(await p.evaluate(() => /DER \/ Banco de Dados/.test(document.querySelector('.ifr-cab h2').textContent)) && await fr().evaluate(() => window.__PONTE.init.ns.endsWith('|der') && !document.querySelector('.t-diagrama')), 'cada sub-aba tem o próprio canvas');
  if (process.env.FOTOS) await p.screenshot({path: process.env.FOTOS + '/infra_der.png'});
  // ---------- automático: o desenho que o robô grava, com o quadro dele no canvas ----------
  const DOC = {nome:'Software · it-hub/bl', pai:'raiz', nodes:[{id:'nt', tipo:'texto', x:0, y:-100, w:800, texto:'Arquitetura de Software · it-hub/bl', fonte:'g', negrito:true},
    {id:'ng', tipo:'grupo', x:0, y:0, w:700, h:260, cor:'azul', titulo:'fonte', nota:''},
    {id:'n1', tipo:'modulo', x:30, y:50, w:260, cor:'ouro', titulo:'app', subtitulo:'12 arquivos', etiquetas:['JavaScript'], topicos:[], nota:''},
    {id:'n2', tipo:'modulo', x:400, y:50, w:260, cor:'ouro', titulo:'lib', subtitulo:'3 arquivos', etiquetas:['JavaScript'], topicos:[], nota:''}],
    edges:[{id:'a1', de:'n1', deLado:'r', para:'n2', paraLado:'l', rotulo:'5 importações', cor:'azul', estilo:'curva', tracejada:false, setas:'fim', nota:''}]};
  psql("set role service_role; select public.infra_auto_gravar('" + pj + "', 'software', 'github:it-hub/bl:software', 'Software · it-hub/bl', 'plantuml', '@startuml\n[app] --> [lib] : 5\n@enduml', 'github', 'abc1234def')");
  psql("set role service_role; select public.infra_auto_quadro('" + pj + "', 'software', 'github:it-hub/bl:software', 'Software · it-hub/bl', $j$" + JSON.stringify(DOC) + "$j$, (select id from public.infra_diagramas where chave_auto = 'github:it-hub/bl:software'))");
  await p.click('[data-ifr-aba="software"]'); await p.waitForTimeout(3000);
  // as ligações (código e bancos) ficam na janela do botão Ligações; o lado tem só os desenhos
  const abrirLig = () => p.evaluate(() => { if (!document.getElementById('ifr-lig')) document.querySelector('#ops-corpo [data-ifr-lig]').click(); });
  const lado = async () => { await abrirLig(); return p.evaluate(() => document.querySelector('[data-ifr-lado]').textContent + ' ' + document.getElementById('ifr-lig').textContent); };
  ok(/Automático/.test(await lado()) && /sai sozinha do código/.test(await lado()) && /Nenhum repositório ligado direto neste projeto/.test(await lado()), 'a sub-aba mostra de onde o desenho sai sozinho e que falta ligar um repositório a este projeto');
  ok(await p.evaluate(() => { const li = [...document.querySelectorAll('.ifr-item')].find(x => /Software · it-hub\/bl/.test(x.textContent)); return !!li && /automático do código/.test(li.textContent) && !!li.querySelector('[data-ifr-quadro]'); }), 'o desenho automático aparece na lista, dizendo de onde veio, com o botão de abrir o quadro');
  ok(await fr().evaluate(() => [...document.querySelectorAll('.t-quadro')].some(x => /Software · it-hub\/bl/.test(x.textContent))), 'o quadro principal da sub-aba tem o card que abre o quadro do desenho');
  await p.click('.ifr-item.auto [data-ifr-quadro]'); await p.waitForTimeout(1500);
  ok(await fr().evaluate(() => /Software · it-hub\/bl/.test(document.querySelector('#trilha').textContent) && document.querySelectorAll('.t-modulo').length === 2 && !!document.querySelector('.t-grupo') && /5 importações/.test(document.querySelector('#camada-rotulos').textContent)), 'Abrir leva ao quadro do desenho no canvas, com os cards, o grupo e a ligação com o número');
  if (process.env.FOTOS) await p.screenshot({path: process.env.FOTOS + '/infra_auto_quadro.png'});
  // ---------- baixar o quadro aberto (SVG, PNG, PDF), tela cheia e arquivo navegável ----------
  const os = require('os'), path = require('path'), fs = require('fs');
  const baixarDoCanvas = async texto => { await fr().click('#b-baixar'); await p.waitForTimeout(250);
    const [d] = await Promise.all([p.waitForEvent('download', {timeout:15000}).catch(() => null), fr().click('#menu button:has-text("' + texto + '")')]);
    if (!d) return null; const cam = path.join(os.tmpdir(), 'q-' + Date.now() + '-' + d.suggestedFilename()); await d.saveAs(cam); return {nome:d.suggestedFilename(), cam, buf:fs.readFileSync(cam)}; };
  ok(await fr().evaluate(() => !!document.querySelector('#b-baixar') && !!document.querySelector('#b-cheia')), 'a barra do canvas tem Baixar e Tela cheia');
  const svgQ = await baixarDoCanvas('Imagem vetorial (SVG)');
  const txtSvg = svgQ ? svgQ.buf.toString('utf8') : '';
  ok(!!svgQ && /\.svg$/.test(svgQ.nome) && /^<\?xml/.test(txtSvg) && /<foreignObject/.test(txtSvg) && /5 importações/.test(txtSvg) && /t-modulo/.test(txtSvg) && !/class="aresta-hit"|id="caixa-sel"|class="alca/.test(txtSvg), 'o quadro sai em SVG com os cards, o grupo e a ligação, sem seleção nem alças');
  const q2 = await b.newPage({viewport:{width:1200, height:800}});
  ok(!!svgQ && await q2.goto('file://' + svgQ.cam).then(() => q2.evaluate(() => { const r = document.documentElement.getBoundingClientRect(); return r.width > 700 && r.height > 250; })), 'o SVG abre sozinho no navegador, no tamanho do quadro');
  if (process.env.FOTOS && svgQ) await q2.screenshot({path: process.env.FOTOS + '/infra_quadro_svg.png'});
  const pngQ = await baixarDoCanvas('Imagem PNG (alta resolução)');
  const W = txtSvg.match(/width="(\d+)"/), largPng = pngQ && pngQ.buf.length > 24 ? pngQ.buf.readUInt32BE(16) : 0;
  ok(!!pngQ && pngQ.buf.slice(1, 4).toString() === 'PNG' && W && largPng === Number(W[1]) * 2, 'o PNG sai com o dobro da resolução da tela (' + largPng + ' px de largura)');
  if (pngQ) { await q2.goto('about:blank'); await q2.setContent('<img id="i" src="data:image/png;base64,' + pngQ.buf.toString('base64') + '">'); await q2.waitForTimeout(300); }
  ok(!!pngQ && await q2.evaluate(() => { const i = document.getElementById('i'), c = document.createElement('canvas'); c.width = 200; c.height = 200; const g = c.getContext('2d'); g.drawImage(i, 0, 0, 200, 200); const d = g.getImageData(0, 0, 200, 200).data; const cores = new Set(); for (let k = 0; k < d.length; k += 16) cores.add(d[k] >> 4 << 8 | d[k + 1] >> 4 << 4 | d[k + 2] >> 4); return cores.size > 8; }), 'o PNG tem o desenho de verdade (não sai em branco)');
  const pdfQ = await baixarDoCanvas('PDF');
  let pdfOk = '';
  if (pdfQ){ fs.writeFileSync(path.join(os.tmpdir(), 'q.pdf'), pdfQ.buf);
    try { pdfOk = execFileSync('python3', ['-c', 'import sys; sys.modules["cryptography"] = None; sys.path.insert(0, sys.argv[1]); import pypdf; r = pypdf.PdfReader(sys.argv[2], strict=True); pg = r.pages[0]; im = list(pg.images); print(len(r.pages), round(float(pg.mediabox.width)), len(im), im[0].image.size[0] if im else 0, r.metadata.title)', process.env.PYPDF || '', path.join(os.tmpdir(), 'q.pdf')], {encoding:'utf8'}).trim(); } catch(e){ pdfOk = 'erro ' + String(e.stderr || e.message).split('\n').slice(-2).join(' '); } }
  ok(!!pdfQ && /^1 \d+ 1 \d+ /.test(pdfOk) && W && pdfOk.split(' ')[1] == Math.round(Number(W[1]) * 0.75) && /Software · it-hub\/bl/.test(pdfOk), 'o PDF abre num leitor de PDF (pypdf, modo estrito): 1 página do tamanho do quadro com a imagem (' + pdfOk + ')');
  // tela cheia: de verdade (Fullscreen), com o botão de sair visível, e volta
  await fr().click('#b-cheia'); await p.waitForTimeout(700);
  ok(await p.evaluate(() => { const c = document.querySelector('.ifr-canvas'); return (document.fullscreenElement === c || c.classList.contains('ifr-cheia')) && !c.querySelector('.ifr-sair-cheia').hidden && /Sair/.test(document.querySelector('.ifr-cheia-b').textContent); }) && await fr().evaluate(() => document.querySelector('#b-cheia').classList.contains('ativo')), 'Tela cheia no canvas abre o quadro na tela inteira, com o botão de sair à vista');
  if (process.env.FOTOS) await p.screenshot({path: process.env.FOTOS + '/infra_tela_cheia.png'});
  await p.click('.ifr-sair-cheia'); await p.waitForTimeout(600);
  ok(await p.evaluate(() => { const c = document.querySelector('.ifr-canvas'); return document.fullscreenElement !== c && !c.classList.contains('ifr-cheia') && c.querySelector('.ifr-sair-cheia').hidden; }) && await fr().evaluate(() => !document.querySelector('#b-cheia').classList.contains('ativo')), 'Sair da tela cheia volta ao normal');
  await p.click('.ifr-cheia-b'); await p.waitForTimeout(600);
  ok(await p.evaluate(() => { const c = document.querySelector('.ifr-canvas'); return document.fullscreenElement === c || c.classList.contains('ifr-cheia'); }), 'o botão Tela cheia do cabeçalho também abre');
  await p.click('.ifr-cheia-b').catch(() => p.click('.ifr-sair-cheia')); await p.waitForTimeout(500);
  // arquivo navegável: todas as partes, os quadros e os desenhos, aberto sem o CicloDev
  const nav = await baixarDoCanvas('Arquivo navegável (HTML)');
  ok(!!nav && /^desenhos-bl\.html$/.test(nav.nome) && nav.buf.length > 150000, 'o arquivo navegável sai num .html só (' + (nav ? Math.round(nav.buf.length / 1024) : 0) + ' KB)');
  const n3 = await b.newPage({viewport:{width:1366, height:860}, acceptDownloads:true}); const errNav = [];
  n3.on('pageerror', e => errNav.push(e.message));
  if (nav) { await n3.goto('file://' + nav.cam); await n3.waitForTimeout(2500); }
  const frN = () => n3.frames().find(f => f !== n3.mainFrame());
  ok(!!nav && await n3.evaluate(() => document.querySelectorAll('.n-aba').length === 10 && /BL/.test(document.querySelector('h1').textContent) && /partes? com conteúdo/.test(document.querySelector('#n-resumo').textContent)), 'o arquivo abre com as 10 partes em abas e o resumo');
  ok(!!nav && await n3.evaluate(() => document.querySelector('.n-aba[aria-selected="true"]').dataset.aba === 'solucao' && /Contexto do sistema/.test(document.querySelector('#n-lado').textContent)), 'começa na primeira parte com conteúdo, com os desenhos dela ao lado');
  ok(!!nav && !!frN() && await frN().evaluate(() => window.__PONTE.init.ro === true && window.__PONTE.init.exportado === true && !!document.querySelector('.t-diagrama')), 'o canvas de verdade abre dentro do arquivo, só leitura, com o card do desenho');
  if (nav) { await n3.click('.n-aba[data-aba="software"]'); await n3.waitForTimeout(2000); }
  ok(!!nav && /Software · it-hub\/bl/.test(await n3.evaluate(() => document.querySelector('#n-lado').textContent)), 'trocar de parte mostra os quadros daquela parte');
  if (nav) { await n3.click('.n-q:has-text("Software · it-hub/bl")'); await n3.waitForTimeout(1200); }
  ok(!!nav && await frN().evaluate(() => /Software · it-hub\/bl/.test(document.querySelector('#trilha').textContent) && document.querySelectorAll('.t-modulo').length === 2), 'clicar num quadro da árvore leva até ele no canvas');
  if (process.env.FOTOS && nav) await n3.screenshot({path: process.env.FOTOS + '/infra_navegavel.png'});
  let dlN = null;
  if (nav) { await frN().click('#b-baixar'); await n3.waitForTimeout(250);
    ok(await frN().evaluate(() => !/Arquivo navegável/.test(document.querySelector('#menu').textContent)), 'dentro do arquivo, o menu Baixar não oferece baixar o arquivo de novo');
    [dlN] = await Promise.all([n3.waitForEvent('download', {timeout:10000}).catch(() => null), frN().click('#menu button:has-text("Imagem vetorial (SVG)")')]); }
  ok(!!dlN && /\.svg$/.test(dlN.suggestedFilename()), 'dentro do arquivo navegável também dá para baixar o quadro em SVG');
  if (nav) { await n3.click('.n-aba[data-aba="solucao"]'); await n3.waitForTimeout(1800); await n3.click('.n-d:has-text("Contexto do sistema")'); await n3.waitForTimeout(400); }
  ok(!!nav && await n3.evaluate(() => document.querySelector('#n-dlg').open && !!document.querySelector('#n-dlg .n-img img') && /workspace/.test(document.querySelector('#n-dlg .n-cod').textContent)), 'abrir um desenho no arquivo mostra a imagem e o código');
  ok(!errNav.length, 'o arquivo navegável abre sem erro' + (errNav.length ? ': ' + errNav.join(' | ') : ''));
  await q2.close(); await n3.close();
  await p.click('.ifr-item.auto [data-ifr-abrir]'); await p.waitForTimeout(1200);
  ok(await p.evaluate(() => document.querySelector('dialog.ifr-modal[open] #ifr-fonte').readOnly && /sai sozinho do código publicado/.test(document.querySelector('dialog.ifr-modal[open]').textContent) && /commit abc1234/.test(document.querySelector('dialog.ifr-modal[open]').textContent)), 'o editor do desenho automático é só leitura e diz de qual commit saiu');
  await p.click('dialog.ifr-modal[open] .modal-rod button:has-text("Copiar para editar à mão")'); await p.waitForTimeout(2000);
  ok(conta("select count(*) || '/' || max(origem) || '/' || count(chave_auto) from public.infra_diagramas where no_id = '" + pj + "' and aba = 'software' and nome like '%(cópia)'") === '1/manual/0', 'Copiar para editar à mão cria um desenho feito à mão (o automático segue sendo refeito)');
  await p.evaluate(() => { const d = document.querySelector('dialog.modal[open]'); if (d){ d.close(); d.remove(); } });
  // Atualizar agora
  ok(await p.evaluate(() => !document.querySelector('[data-ifr-lado] .ifr-auto') && !!document.querySelector('#ops-corpo .ifv-modo [data-ifr-lig]')), 'a lateral não tem mais o painel de ligações: ele virou o botão Ligações na barra de cima');
  await abrirLig(); await p.waitForTimeout(200);
  ok(await p.evaluate(() => { const w = document.getElementById('ifr-lig'), r = w.getBoundingClientRect(), ia = document.getElementById('ia-raiz');
    return !!w.querySelector('.ifr-lig-cols') && getComputedStyle(w).position === 'fixed' && (!ia || +getComputedStyle(ia).zIndex > +getComputedStyle(w).zIndex) && !document.querySelector('dialog[open]'); }),
    'Ligações abre uma janela flutuante (sem travar a tela) com Código e Bancos lado a lado, e o DevIT fica por cima dela');
  await p.click('#ifr-lig [data-ifr-atualizar]'); await p.waitForTimeout(1500);
  ok(conta("select count(*) from public.infra_automacoes where no_id = '" + pj + "' and origem = 'manual' and status = 'pendente'") === '1', 'Atualizar agora põe o pedido na fila do robô');
  psql("update public.infra_automacoes set status = 'pronto', concluido_em = now(), diagramas = array[(select id from public.infra_diagramas where chave_auto = 'github:it-hub/bl:software')] where origem = 'manual'");
  await p.waitForTimeout(7000);
  ok(/Pronto: 1 desenho atualizado/.test(await p.evaluate(() => (document.querySelector('#toast') || {}).textContent || '')) && /Última atualização[\s\S]*Concluída[\s\S]*Pedida pelo botão Atualizar agora/.test(await lado()), 'quando o robô termina, a tela avisa e mostra a última atualização');
  // ligar o banco do sistema
  await abrirLig(); await p.click('#ifr-lig [data-ifr-banco]'); await p.waitForTimeout(600);
  await p.fill('#ifr-b-url', 'mysql://errado'); await p.click('dialog.modal[open] .modal-rod .btn:not(.sec)'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !!document.querySelector('dialog.modal[open] #ifr-b-url')), 'endereço que não é postgresql:// não fecha a janela');
  await p.fill('#ifr-b-url', 'postgresql://leitura_ciclodev:senha-de-teste@db.exemplo:5432/postgres'); await p.fill('#ifr-b-esq', 'public, app');
  await p.click('dialog.modal[open] .modal-rod .btn:not(.sec)'); await p.waitForTimeout(2500);
  ok(conta("select count(*) || '/' || max(array_to_string(esquemas, ',')) from public.infra_bancos where no_id = '" + pj + "'") === '1/app,public' && conta("select count(*) from interno.infra_bancos_conexao where conexao like 'postgresql://leitura_ciclodev:%'") === '1', 'ligar o banco guarda o endereço na área protegida do banco');
  ok(/Banco de produção[\s\S]*Supabase · PostgreSQL · esquemas app, public[\s\S]*db\.exemplo/.test(await lado()) && !/senha-de-teste/.test(await p.evaluate(() => document.body.innerHTML)), 'a tela mostra o banco ligado (Supabase, esquemas e servidor) e nunca mostra a senha');
  // um segundo banco: MySQL na AWS, pelos campos (endpoint, banco, usuário e senha)
  await abrirLig(); await p.click('#ifr-lig [data-ifr-banco=""]'); await p.waitForTimeout(600);
  await p.click('dialog.modal[open] input[name="ifr-b-prov"][value="aws"]'); await p.waitForTimeout(200);
  await p.selectOption('#ifr-b-motor', 'mysql'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => { const d = document.querySelector('dialog.modal[open]'); const l = d.querySelector('[data-ifr-guia-abrir]'); return /security group/.test(d.textContent) && l && /\(AWS\)/.test(l.textContent); }), 'escolher AWS mostra o resumo e o link para o guia passo a passo da AWS');
  await p.fill('#ifr-b-nome', 'Relatórios'); await p.fill('#ifr-b-esq', 'relatorios');
  await p.fill('#ifr-b-host', 'rel.abc123.us-east-1.rds.amazonaws.com'); await p.fill('#ifr-b-base', 'relatorios'); await p.fill('#ifr-b-senha', 's3nh@ de teste');
  await p.click('dialog.modal[open] .modal-rod .btn:not(.sec)'); await p.waitForTimeout(2500);
  ok(conta("select count(*) from public.infra_bancos where no_id = '" + pj + "'") === '2' && conta("select provedor || '/' || motor || '/' || servidor from public.infra_bancos where nome = 'Relatórios'") === 'aws/mysql/rel.abc123.us-east-1.rds.amazonaws.com', 'o segundo banco (MySQL na AWS) fica ligado junto com o primeiro');
  ok(conta("select c.conexao from interno.infra_bancos_conexao c join public.infra_bancos b on b.id = c.banco_id where b.nome = 'Relatórios'") === 'mysql://leitura_ciclodev:s3nh%40%20de%20teste@rel.abc123.us-east-1.rds.amazonaws.com:3306/relatorios', 'o endereço é montado dos campos, com a senha protegida (caracteres especiais escapados)');
  ok(/Relatórios[\s\S]*AWS · MySQL · banco relatorios/.test(await lado()), 'a lista mostra os dois bancos');
  await abrirLig(); await p.click('#ifr-lig [data-ifr-banco-tirar]'); await p.waitForTimeout(400); await p.click('dialog.modal[open] .modal-rod .btn.perigo'); await p.waitForTimeout(1500);
  ok(conta("select count(*) from public.infra_bancos where no_id = '" + pj + "'") === '1', 'Desligar tira só aquele banco');
  // no cliente não há aba Infraestrutura
  await p.evaluate(() => { const U = window.__tf.UI; const c = window.__tf.D.clients[0]; U.sel = 'client:' + c.id; window.__tf.rOperacoes(); }); await p.waitForTimeout(800);
  ok(await p.evaluate(() => !document.querySelector('.view-b[data-view="infra"]')), 'cliente não tem a aba Infraestrutura (só projeto e produto)');
  ok(!erros.length, 'sem erro na página' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})();
