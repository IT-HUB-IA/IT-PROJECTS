// Item completo pelo método do P.O. (parte 38): Criar em lote com detalhes e erros por linha, Quadro/Lista/Fila com prioridade,
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
  await p.evaluate(() => document.querySelector('[data-tela="operacoes"]').click()); await p.waitForTimeout(500);
  const app = conta("select id from public.nos where tipo = 'aplicacao' order by nome limit 1");
  const F = process.env.FOTOS ? process.env.FOTOS + '/' : '';
  // ---------- Criar em lote com detalhes ----------
  await (async () => {
  const espera = async () => { await p.waitForTimeout(600); await p.waitForFunction(() => !window.ciclodevSync.rodando && !window.ciclodevSync.pendente, null, {timeout: 20000}); await p.waitForTimeout(300); };
  await p.evaluate(a => { const U = window.__tf.UI; U.sel = 'app:' + a; U.view = 'backlog'; window.__tf.rOperacoes(); }, app); await p.waitForTimeout(400);
  const abrir = async () => { await p.evaluate(() => document.querySelectorAll('dialog.modal').forEach(d => { d.close(); d.remove(); })); await p.click('.cria-barra [data-lt-abrir]'); await p.waitForTimeout(300); };
  const escrever = async t => { await p.evaluate(t => { const ta = document.querySelector('#lt-t'); ta.value = t; ta.dispatchEvent(new Event('input')); }, t); await p.waitForTimeout(150); return p.evaluate(() => document.querySelector('.lt-previa').textContent); };
  const criar = async () => { await p.click('dialog.lt-modal .modal-rod .btn:not(.sec)'); await espera(); };
  // 1. exemplo completo
  await abrir(); await p.click('[data-lt-exemplo-completo]'); await p.waitForTimeout(200);
  const pv = await p.evaluate(() => document.querySelector('.lt-previa').textContent);
  ok(/1 épico novo e 2 itens novos/.test(pv) && /Como lojista, quero cadastrar meus clientes/.test(pv) && /Deve · nível 2/.test(pv) && /valor 8/.test(pv) && /5 pts/.test(pv) && /Avisa quando o CPF já está cadastrado/.test(pv) && /Meta: o lojista cuida/.test(pv) && !/erro/.test(pv), 'a prévia mostra o que cada item vai receber (história, critérios, prioridade, valor, pontos) e a meta do épico');
  if (F) await p.locator('dialog.lt-modal').screenshot({path: F + 'po_lote_ok.png'});
  await criar();
  const r = conta("select historia_quem||'|'||historia_quero||'|'||moscow||'|'||nivel||'|'||prioridade||'|'||valor||'|'||valor_motivo||'|'||pontos||'|'||(select count(*) from itens_criterios c where c.item_id=i.id) from itens i where titulo='Cadastro do cliente'");
  ok(r === 'lojista|cadastrar meus clientes com CPF e telefone|deve|2|high|8|é o que mais gera ligação no suporte|5|3', 'no banco, o item tem a história, a prioridade (e a antiga junto), o valor, os pontos e 3 critérios: ' + r);
  ok(conta("select historia_quem||'|'||historia_para||'|'||moscow||'|'||nivel from itens where titulo='Tela da lista da carteira'") === 'lojista|achar um cliente rápido|deveria|3', 'a história numa frase só (historia: Como..., quero..., para...) é separada nas três partes');
  ok(conta("select meta from itens where titulo='Carteira de clientes' and tipo='epic'") === 'o lojista cuida da própria carteira sem ligar para o suporte', 'o épico recebe a meta');
  // 2. o mesmo texto de novo, com coisa nova: não duplica, atualiza sem apagar
  await abrir();
  const pv2 = await escrever('Carteira de clientes\n- Cadastro do cliente\n  aceite: Salva nome, CPF e telefone\n  aceite: Mostra a data do cadastro\n  pontos: 8\n- Tela da lista da carteira');
  ok(/1 item atualizado/.test(pv2) && /já existe \(.*\): atualiza/.test(pv2) && /já existe: fica como está/.test(pv2) && !/novo/.test(pv2), 'item com o mesmo título num épico que já existe: a prévia diz que atualiza (e o que não muda fica como está)');
  await criar();
  ok(conta("select count(*) from itens where titulo='Cadastro do cliente'") === '1', 'não duplicou o item');
  ok(conta("select pontos||'|'||historia_quem||'|'||moscow||'|'||(select string_agg(texto, ';' order by ordem) from itens_criterios c where c.item_id=i.id) from itens i where titulo='Cadastro do cliente'") === '8|lojista|deve|Salva nome, CPF e telefone;Avisa quando o CPF já está cadastrado;Funciona no celular;Mostra a data do cadastro', 'atualizou os pontos e somou só o critério novo, sem apagar a história, a prioridade e os critérios que já tinha');
  // 3. erros por linha
  await abrir();
  const chave = conta("select chave from itens where titulo='Cadastro do cliente'");
  const pv3 = await escrever('Épico com erros\n- Item bom\n  pontos: 3\n- Item ruim\n  prioridade: Urgentíssima\n  pontos: 4\n  valor: 15\n  cor: azul\n- Bug sem origem\n  tipo: Bug\n- Bug certo\n  tipo: bug\n  origem: ' + chave + '\n  aceite: Avisa do CPF repetido\nnivel: 2');
  if (F) await p.locator('dialog.lt-modal').screenshot({path: F + 'po_lote_erro.png'});
  ok(/Linha 5: prioridade "Urgentíssima" não existe/.test(pv3) && /Linha 6: estimativa "4" fora da sequência/.test(pv3) && /Linha 7: valor "15" não vale/.test(pv3) && /Linha 8: campo "cor" não existe/.test(pv3), 'a prévia aponta cada erro com o número da linha (prioridade, estimativa, valor e campo que não existem)');
  ok(/Linha 9: o Bug "Bug sem origem" precisa da origem/.test(pv3), 'Bug sem origem é erro, na linha dele');
  ok(/2 itens novos/.test(pv3) && /2 itens ficam de fora/.test(pv3), 'os itens com erro ficam de fora; os certos entram: ' + (pv3.match(/\d+ (épico|itens?) [^.]*/g) || []).join(' / '));
  await criar();
  ok(conta("select count(*) from itens where titulo in ('Item ruim','Bug sem origem')") === '0' && conta("select count(*) from itens where titulo in ('Item bom','Bug certo')") === '2', 'no banco: o item errado não foi criado, os certos sim');
  ok(conta("select tipo||'|'||(origem_id = (select id from itens where titulo='Cadastro do cliente'))::text from itens where titulo='Bug certo'") === 'bug|true', 'o Bug fica ligado ao item de origem');
  // 4. o formato antigo, só títulos, continua igual
  await abrir();
  const pv4 = await escrever('Épico só com títulos\n- Primeiro\n- Segundo');
  ok(/1 épico novo e 2 itens novos/.test(pv4) && !/erro/.test(pv4), 'o formato antigo (só títulos) continua igual');
  await p.evaluate(() => document.querySelectorAll('dialog.modal').forEach(d => { d.close(); d.remove(); }));
  })();
  // ---------- Criar em lote: versão com data e meta, ordem, critério repetido, origem no mesmo texto, Definição de Pronto ----------
  await (async () => {
    const espera = async () => { await p.waitForTimeout(600); await p.waitForFunction(() => !window.ciclodevSync.rodando && !window.ciclodevSync.pendente, null, {timeout: 20000}); await p.waitForTimeout(300); };
    const abrir = async () => { await p.evaluate(() => document.querySelectorAll('dialog.modal').forEach(d => { d.close(); d.remove(); })); await p.evaluate(() => window.__tf.ltAbrir()); await p.waitForTimeout(300); };
    const escrever = async t => { await p.evaluate(t => { const ta = document.querySelector('#lt-t'); ta.value = t; ta.dispatchEvent(new Event('input')); }, t); await p.waitForTimeout(150); return p.evaluate(() => document.querySelector('.lt-previa').textContent); };
    await abrir();
    const pvA = await escrever('Ordem teste {vNovaSemData}\n- Primeiro da ordem');
    ok(/precisa da data de entrega/.test(pvA) && /de fora/.test(pvA), 'versão nova sem data de entrega é erro na prévia');
    const pvB = await escrever('versão: vOrdem\n  entrega: 20/12/2026\n  meta: tudo da ordem\npronto: Testado no celular\npronto: Testado no celular\n\nOrdem teste {vOrdem}\n- Primeiro da ordem\n  aceite: Critério A\n  aceite: critério a\n- Segundo da ordem\n  tipo: Bug\n  origem: #1\n- Terceiro da ordem\n  tipo: Melhoria\n  origem: Primeiro da ordem');
    ok(/vOrdem/.test(pvB) && /entrega 20\/12\/2026/.test(pvB) && /Meta: tudo da ordem/.test(pvB) && /Definição de Pronto/.test(pvB) && !/erro/.test(pvB), 'a prévia mostra a versão com data e meta, a Definição de Pronto, e aceita origem pela posição (#1) e pelo título do mesmo texto');
    await p.click('dialog.lt-modal .modal-rod .btn:not(.sec)'); await espera();
    ok(conta("select data::text || '|' || meta from marcos where nome = 'vOrdem'") === '2026-12-20|tudo da ordem', 'a versão nova foi criada com a data de entrega e a meta');
    ok(conta("select string_agg(titulo, ',' order by ordem) from itens where titulo like '% da ordem'") === 'Primeiro da ordem,Segundo da ordem,Terceiro da ordem', 'a ordem das linhas virou a ordem da fila');
    ok(conta("select count(*) from itens_criterios c join itens i on i.id = c.item_id where i.titulo = 'Primeiro da ordem'") === '1', 'critério repetido no mesmo item é ignorado');
    ok(conta("select count(*) from itens b join itens o on o.id = b.origem_id where o.titulo = 'Primeiro da ordem' and b.titulo in ('Segundo da ordem','Terceiro da ordem')") === '2', 'Bug e Melhoria ficaram ligados ao item de origem criado no mesmo lote');
    ok(conta("select count(*) from itens where titulo like '% da ordem' and marco_id = (select id from marcos where nome = 'vOrdem')") === '3', 'os itens entraram na versão declarada');
    ok(/Testado no celular/.test(conta("select string_agg(definicao_pronto, '') from projetos")) && (conta("select string_agg(definicao_pronto, '') from projetos").match(/Testado no celular/g) || []).length === 1, 'a Definição de Pronto recebeu a regra uma vez só');
    await abrir();
    const pvC = await escrever('Ordem teste\n- Primeiro da ordem\n  aceite: Critério A\n  aceite: Critério B');
    await p.click('dialog.lt-modal .modal-rod .btn:not(.sec)'); await espera();
    ok(conta("select string_agg(c.texto, ';' order by c.ordem) from itens_criterios c join itens i on i.id = c.item_id where i.titulo = 'Primeiro da ordem'") === 'Critério A;Critério B', 'colar de novo não duplica o critério igual: só entra o novo');
    await p.evaluate(() => document.querySelectorAll('dialog.modal').forEach(d => { d.close(); d.remove(); }));
  })();
  // ---------- depende: e gravação em blocos ----------
  await (async () => {
    const espera = async () => { await p.waitForTimeout(600); await p.waitForFunction(() => !window.ciclodevSync.rodando && !window.ciclodevSync.pendente, null, {timeout: 30000}); await p.waitForTimeout(300); };
    await p.evaluate(() => document.querySelectorAll('dialog.modal').forEach(d => { d.close(); d.remove(); })); await p.evaluate(() => window.__tf.ltAbrir()); await p.waitForTimeout(300);
    const escrever = async t => { await p.evaluate(t => { const ta = document.querySelector('#lt-t'); ta.value = t; ta.dispatchEvent(new Event('input')); }, t); await p.waitForTimeout(150); return p.evaluate(() => document.querySelector('.lt-previa').textContent); };
    const pv1 = await escrever('Dep teste\n- Dep base\n- Dep depois\n  depende: #1\n- Dep ruim\n  depende: Item que não existe');
    ok(/depende de Dep base/.test(pv1) && /depende "Item que não existe" não existe/.test(pv1), 'a prévia mostra a dependência e aponta erro quando o item não existe');
    let texto = 'Bloco grande\n'; for (let k = 1; k <= 60; k++) texto += '- Bloco item ' + k + '\n  aceite: Critério ' + k + '\n';
    await escrever('Dep teste\n- Dep base\n- Dep depois\n  depende: #1\n  depende: Dep base\n\n' + texto);
    await p.click('dialog.lt-modal .modal-rod .btn:not(.sec)'); await espera();
    ok(conta("select count(*) from itens_ligacoes l join itens a on a.id = l.origem_id join itens b on b.id = l.destino_id where a.titulo = 'Dep base' and b.titulo = 'Dep depois' and l.tipo = 'bloqueia'") === '1', 'depende: grava uma ligação só (Dep base bloqueia Dep depois), mesmo escrito duas vezes');
    ok(conta("select count(*) from itens where titulo like 'Bloco item %'") === '60' && conta("select count(*) from itens_criterios c join itens i on i.id = c.item_id where i.titulo like 'Bloco item %'") === '60', 'um lote grande (60 itens e 60 critérios) grava inteiro em blocos');
    const dep = conta("select id from itens where titulo = 'Dep depois'");
    await p.evaluate(id => window.__tf.abrirItem(id), dep); await p.waitForTimeout(500);
    ok(await p.evaluate(() => { const d = document.querySelector('#gaveta-wrap .po-deps'); return !!d && /Dep base/.test(d.textContent) && d.classList.contains('po-deps-aviso') && /ainda não foi aceito/.test(d.textContent); }), 'a janela do item mostra Depende de, com aviso porque a dependência ainda não foi aceita');
    await p.evaluate(() => { const b = document.querySelector('[data-fechar-gaveta]'); if (b) b.click(); document.querySelectorAll('dialog.modal').forEach(d => { d.close(); d.remove(); }); });
  })();
  // ---------- Editar em lote e Tarefa externa ----------
  await (async () => {
    const espera = async () => { await p.waitForTimeout(600); await p.waitForFunction(() => !window.ciclodevSync.rodando && !window.ciclodevSync.pendente, null, {timeout: 30000}); await p.waitForTimeout(300); };
    const fechar = () => p.evaluate(() => document.querySelectorAll('dialog.modal').forEach(d => { d.close(); d.remove(); }));
    // base: cria pelo lote
    await fechar(); await p.evaluate(() => window.__tf.ltAbrir()); await p.waitForTimeout(300);
    await p.evaluate(t => { const ta = document.querySelector('#lt-t'); ta.value = t; ta.dispatchEvent(new Event('input')); }, 'Ed épico A\n- Ed um\n  aceite: Critério 1\n  aceite: Critério 2\n- Ed dois\n- Ed três\n- Ed repetido\nEd épico B\n- Ed repetido\n- Ed tarefa\n  tipo: Tarefa\n  prazo: 20/10/2026');
    await p.click('dialog.lt-modal .modal-rod .btn:not(.sec)'); await espera();
    ok(conta("select (tipo = 'task' and externa and prazo = '2026-10-20')::text from itens where titulo = 'Ed tarefa'") === 'true', 'tipo: Tarefa cria a tarefa externa, com prazo');
    const ch = t => conta("select chave from itens where titulo = '" + t + "'");
    const abrir = async t => { await fechar(); await p.evaluate(() => window.__tf.leAbrir()); await p.waitForTimeout(300);
      await p.evaluate(t => { const ta = document.querySelector('#le-t'); ta.value = t; ta.dispatchEvent(new Event('input')); }, t); await p.waitForTimeout(400); return p.evaluate(() => document.querySelector('.le-previa').textContent); };
    const gravar = async () => { await p.click('dialog.le-modal .modal-rod .btn:not(.sec)'); await espera(); };
    // erros: ambíguo, não existe, valor inválido
    const pvE = await abrir('editar: Ed repetido\n  pontos: 3\neditar: Item que não existe\n  pontos: 2\neditar: ' + ch('Ed um') + '\n  pontos: 4');
    ok(/ambíguo: 2 itens/.test(pvE) && /não existe neste projeto/.test(pvE) && /fora da sequência/.test(pvE) && /nada é gravado/.test(pvE), 'Editar em lote: título ambíguo, item que não existe e valor inválido são erro, e nada grava');
    // edição completa
    const um = ch('Ed um'), dois = ch('Ed dois'), tres = ch('Ed três');
    const pv = await abrir('editar: ' + um + '\n  titulo: Ed um renomeado\n  prioridade: Deve 2\n  pontos: 8\n  aceite: Critério 3\n  tirar aceite: Critério 1\n\neditar: Ed repetido\n  no épico: Ed épico B\n  épico: Ed épico A\n  posição: topo\n  depende: ' + dois + '\n\neditar: ' + tres + '\n  cancelar: virou parte do outro\n\neditar todos: épico Ed épico A\n  responsavel: William');
    ok(/Antes/.test(pv) && /Ed um renomeado/.test(pv) && /Critério 1 \| Critério 2/.test(pv) && /itens afetados/.test(pv) && !/erro/.test(pv), 'a prévia mostra o antes e o depois e o total de itens afetados: ' + (pv.match(/\d+ itens? afetados?/) || [''])[0]);
    await gravar();
    ok(conta("select titulo || '|' || moscow || '|' || pontos || '|' || (select string_agg(texto, ',' order by ordem) from itens_criterios c where c.item_id = i.id) from itens i where chave = '" + um + "'") === 'Ed um renomeado|deve|8|Critério 2,Critério 3', 'renomeia, troca prioridade e pontos, acrescenta e tira critério');
    ok(conta("select count(*) from itens i join itens e on e.id = i.pai_id where i.titulo = 'Ed repetido' and e.titulo = 'Ed épico A'") === '2', 'move o item de épico (achado pelo título dentro do épico)');
    ok(conta("select count(*) from itens_ligacoes l join itens a on a.id = l.origem_id where a.chave = '" + dois + "' and l.tipo = 'bloqueia'") === '1', 'acrescenta a dependência');
    ok(conta("select (arquivado_em is not null and resolucao = 'nao_sera_feito')::text from itens where chave = '" + tres + "'") === 'true', 'cancela com motivo, sem apagar');
    ok(conta("select count(*) from itens i join itens e on e.id = i.pai_id join pessoas p on p.id = i.responsavel_id where e.titulo = 'Ed épico A' and p.nome = 'William'") >= '4', 'editar todos: épico muda todos os itens dele');
    ok(Number(conta("select count(*) from itens_historico h join itens i on i.id = h.item_id where h.tipo = 'edicao' and i.chave = '" + um + "' and h.texto like '%título:%' and h.pessoa_id is not null")) >= 1, 'o histórico guarda quem e o que mudou (título antes e depois)');
    // item aceito protegido
    psql("update itens set status_id = (select id from status_fluxo where no_id is null and chave = 'done') where chave = '" + dois + "'");
    await p.evaluate(() => window.ciclodevCarregarBanco(null)); await p.waitForTimeout(800);
    const pvA = await abrir('editar: ' + dois + '\n  como: outra pessoa');
    ok(/já foi aceito/.test(pvA), 'item aceito: mudar a história sem pedido explícito é erro');
    const pvB = await abrir('editar: ' + dois + '\n  mudar aceito: sim\n  como: outra pessoa');
    ok(/volta para Priorizado/.test(pvB) && !/já foi aceito: a história/.test(pvB), 'com mudar aceito: sim, a prévia avisa que volta para Priorizado');
    // situação, início, onde e o resto da janela do item
    const pvS = await abrir('editar: ' + um + '\n  situação: Aceito\neditar: ' + dois + '\n  situação: Foguete\n  início: 32/13/2026\neditar: ' + tres + '\n  reabrir: sim\n  início: 20/10/2026\n  prazo: 15/10/2026\neditar: Ed tarefa\n  onde: Lugar que não existe');
    ok(/critérios desmarcados/.test(pvS) && /situação "Foguete" não existe/.test(pvS) && /início "32\/13\/2026" não vale/.test(pvS) && /fica depois do prazo/.test(pvS) && /onde: "Lugar que não existe" não existe/.test(pvS) && /nada é gravado/.test(pvS), 'situação que não existe, Aceito com critério desmarcado, data fora do formato, início depois do prazo e onde que não existe são erro');
    const outra = await p.evaluate(k => { const D = window.__tf.D; const x = D.issues.find(i => i.chave === k); const w = D.ws.find(y => y.id === x.ws); const o = D.ws.find(y => y.app === w.app && y.id !== w.id && y.status !== 'archived'); const a = D.apps.find(y => y.id === w.app); return o ? {txt:a.nome + ' › ' + o.nome, id:o.id} : null; }, um);
    const pvOk = await abrir('editar: ' + um + '\n  situação: Pronto para testar\n  início: 05/10/2026\n  prazo: 15/10/2026\n  horas: 6\n  cliente vê: sim\n  descrição: Tela com filtro por loja' + (outra ? '\n  onde: ' + outra.txt : ''));
    ok(/Situação/.test(pvOk) && /Pronto para testar/.test(pvOk) && /Início/.test(pvOk) && !/erro/.test(pvOk), 'a prévia mostra situação, início e os outros campos com antes e depois');
    await gravar();
    ok(conta("select s.grupo || '|' || i.inicio || '|' || i.prazo || '|' || i.estimativa_h::int || '|' || i.visivel_cliente || '|' || i.descricao from itens i join status_fluxo s on s.id = i.status_id where i.chave = '" + um + "'") === 'review|2026-10-05|2026-10-15|6|true|Tela com filtro por loja', 'grava situação, início, prazo, horas, cliente vê e descrição');
    if (outra) ok(conta("select frente_id from itens where chave = '" + um + "'") === outra.id, 'onde: "Aplicação › Frente" muda o lugar do item');
    ok(Number(conta("select count(*) from itens_historico h join itens i on i.id = h.item_id where i.chave = '" + um + "' and h.tipo = 'edicao' and h.texto like '%início:%' and h.texto like '%horas:%'")) >= 1 && Number(conta("select count(*) from itens_historico h join itens i on i.id = h.item_id where i.chave = '" + um + "' and h.tipo = 'situacao'")) >= 1, 'o histórico guarda o início, as horas e a mudança de situação');
    const pvV = await abrir('editar: ' + um + '\n  situação: Voltou');
    ok(/precisa do motivo/.test(pvV), 'Voltou sem motivo é erro');
    await abrir('editar: ' + um + '\n  situação: Voltou\n  motivo: o filtro não pega a loja'); await gravar();
    ok(conta("select (voltou_em is not null and voltou_motivo = 'o filtro não pega a loja')::text from itens where chave = '" + um + "'") === 'true', 'situação: Voltou com motivo devolve o item (como o botão Devolver)');
    // desfazer o último lote
    await abrir('editar: ' + um + '\n  pontos: 13'); await gravar();
    ok(conta("select pontos from itens where chave = '" + um + "'") === '13', 'gravou 13 pontos');
    await fechar(); await p.evaluate(() => window.__tf.leDesfazer()); await p.waitForTimeout(300);
    await p.evaluate(() => [...document.querySelectorAll('dialog.modal[open] .modal-rod .btn')].pop().click()); await espera();
    ok(conta("select pontos from itens where chave = '" + um + "'") === '8', 'Desfazer o último lote volta os pontos para 8');
    await fechar();
  })();
  // ---------- O CicloDev como P.O.: O que fazer hoje, Preparado, ordem sugerida, previsão ----------
  await (async () => {
    await p.evaluate(() => document.querySelectorAll('dialog.modal').forEach(d => { d.close(); d.remove(); }));
    const r = await p.evaluate(a => { const D = window.__tf.D, U = window.__tf.UI; U.sel = 'app:' + a; U.view = 'dashboard'; window.__tf.rOperacoes();
      const ws = new Set(D.ws.filter(w => w.app === a).map(w => w.id)); const its = D.issues.filter(i => ws.has(i.ws) && i.tipo === 'story' && !i.arquivado && i.status !== 'done');
      const i = its[0]; i.hQuem = 'a'; i.hQuero = 'b'; i.hPara = 'c'; i.crit = [{t:'x', f:false}]; i.moscow = 'deve'; i.valor = 5; i.pontos = 3; const rel = D.marcos.find(m => m.tipo === 'release'); i.marco = rel ? rel.id : i.marco; const semV = Object.assign({}, i, {marco:null}); const j = its[1]; if (j){ j.pontos = 20; j.hQuem = ''; }
      return {ok:window.__tf.pgPreparo(i).ok, semVersao:!window.__tf.pgPreparo(semV).ok, grande:j ? window.__tf.pgPreparo(j).grande : true, hoje:!!document.querySelector('#ops-corpo .pg-hoje'), acoes:window.__tf.pgAcoes('app:' + a).length}; }, app);
    ok(r.ok && r.semVersao && r.grande, 'selo Preparado: item completo fica preparado; sem versão não; item de 20 pontos é grande demais');
    ok(r.hoje && r.acoes > 0, 'o Painel mostra O que fazer hoje com sugestões (' + r.acoes + ')');
    await p.evaluate(a => { const U = window.__tf.UI; U.sel = 'app:' + a; U.view = 'backlog'; window.__tf.rOperacoes(); }, app); await p.waitForTimeout(300);
    await p.click('[data-po-ordenar]'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => /Por que está aqui/.test((document.querySelector('dialog.modal[open]') || {}).textContent || '')), 'Ordenar pela prioridade abre a ordem sugerida com o porquê de cada lugar e o Aplicar');
    await p.evaluate(() => document.querySelectorAll('dialog.modal').forEach(d => { d.close(); d.remove(); }));
    // limites por projeto
    const lim = await p.evaluate(a => { const D = window.__tf.D, U = window.__tf.UI; U.sel = 'app:' + a; const pj = window.__tf.cadeia(U.sel).project; const ws = new Set(D.ws.filter(w => w.app === a).map(w => w.id));
      const j = Object.assign({}, D.issues.find(i => ws.has(i.ws) && i.hQuero === 'b'), {pontos:20}); const antes = window.__tf.pgPreparo(j).grande; pj.poLimites = {grande:21}; const depois = window.__tf.pgPreparo(j).grande; pj.poLimites = {}; return {antes, depois}; }, app);
    ok(lim.antes && !lim.depois, 'limite de pontos por projeto: com limite 21, o item de 20 pontos deixa de ser grande demais');
    // guia Montar o projeto
    await p.evaluate(a => { const U = window.__tf.UI; U.sel = 'app:' + a; U.view = 'dashboard'; window.__tf.rOperacoes(); }, app); await p.waitForTimeout(300);
    await p.click('[data-pg-guia]'); await p.waitForTimeout(400);
    ok(await p.evaluate(() => /9 passos curtos/.test(document.querySelector('dialog.pg-guia-modal[open]').textContent) && document.querySelectorAll('dialog.pg-guia-modal .pg-g-lado li').length === 9), 'o guia Montar o projeto abre com a abertura e os 9 passos');
    await p.evaluate(() => document.querySelector('dialog.pg-guia-modal [data-pg-g-ir="0"]').click()); await p.waitForTimeout(200);
    await p.evaluate(() => { const pj = window.__tf.cadeia(window.__tf.UI.sel).project; pj.visao = ''; document.querySelector('dialog.pg-guia-modal [data-pg-g-campo]').value = ''; document.querySelector('dialog.pg-guia-modal [data-pg-g-feito]').click(); }); await p.waitForTimeout(200);
    ok(await p.evaluate(() => { const t = document.querySelector('#toast'), a = document.querySelector('#tf-aviso'); if (!t || t.hidden || !a || a.hidden) return 'sem os dois'; const r1 = t.getBoundingClientRect(), r2 = a.getBoundingClientRect(); return r1.bottom <= r2.top || r2.bottom <= r1.top; }) === true, 'o aviso comum e o aviso com Desfazer aparecem juntos, um acima do outro, sem se cobrir');
    ok(await p.evaluate(() => /Passo 1 de 9/.test(document.querySelector('dialog.pg-guia-modal .pg-g-meio').textContent)), 'passo 1 sem visão: Feito não avança (o sistema confere)');
    await p.evaluate(() => { document.querySelector('dialog.pg-guia-modal [data-pg-g-campo]').value = 'O analista fecha o mês sem planilha'; document.querySelector('dialog.pg-guia-modal [data-pg-g-feito]').click(); }); await p.waitForTimeout(300);
    const g = await p.evaluate(() => ({txt:document.querySelector('dialog.pg-guia-modal .pg-g-meio').textContent, ok1:document.querySelector('dialog.pg-guia-modal .pg-g-lado li').classList.contains('ok')}));
    ok(/Passo 2 de 9/.test(g.txt) && g.ok1, 'com a visão escrita, passo 1 fica feito e vai ao passo 2');
    await p.evaluate(() => document.querySelector('dialog.pg-guia-modal [data-pg-g-aba="duvida"]').click()); await p.waitForTimeout(200);
    ok(await p.evaluate(() => /O que é Bloqueado/.test(document.querySelector('dialog.pg-guia-modal .pg-g-faq').textContent)), 'Tenho uma dúvida mostra as perguntas frequentes');
    await p.evaluate(() => document.querySelector('dialog.pg-guia-modal [data-pg-g-ir="7"]').click()); await p.waitForTimeout(200);
    await p.evaluate(() => { const c = document.querySelector('dialog.pg-guia-modal [data-pg-g-nenhum]'); c.checked = true; c.dispatchEvent(new Event('change', {bubbles:true})); }); await p.waitForTimeout(200);
    ok(await p.evaluate(() => document.querySelectorAll('dialog.pg-guia-modal .pg-g-lado li')[7].classList.contains('ok')), 'passo 8: marcar que não há riscos confere o passo');
    await p.waitForTimeout(2500);
    ok(conta("select count(*) from projetos where visao = 'O analista fecha o mês sem planilha' and riscos_nenhum") === '1', 'a visão e o "não há riscos" vão para o banco');
    await p.evaluate(() => document.querySelectorAll('dialog.modal').forEach(d => { d.close(); d.remove(); }));
    await p.click('[data-pg-limites]'); await p.waitForTimeout(300);
    await p.fill('#pg-l-grande', '8'); await p.evaluate(() => [...document.querySelectorAll('dialog.modal[open] .modal-rod .btn')].pop().click()); await p.waitForTimeout(2500);
    ok(conta("select count(*) from projetos where po_limites->>'grande' = '8'") === '1', 'a janela Limites guarda o limite do projeto no banco');
  })();
  // ---------- Quadro, Lista e Fila ----------
  await (async () => {
  const ver = async v => { await p.evaluate(([v, a]) => { const U = window.__tf.UI; U.sel = 'app:' + a; U.view = v; window.__tf.rOperacoes(); }, [v, app]); await p.waitForTimeout(500); };
  // dá prioridade a dois itens para aparecer
  await p.evaluate(a => { const D = window.__tf.D; const ws = new Set(D.ws.filter(w => w.app === a).map(w => w.id)); const its = D.issues.filter(i => ['story','task'].includes(i.tipo) && ws.has(i.ws) && !i.arquivado); its.slice(0, 6).forEach((i, k) => { i.moscow = ['deve','poderia','deveria','deve','nao_tera','poderia'][k]; i.nivel = [2,3,1,4,5,3][k]; i.prio = {1:'highest',2:'high',3:'medium',4:'low',5:'low'}[i.nivel]; i.valor = [8,5,9,3,1,5][k]; i.pontos = [5,3,8,2,1,20][k]; i.crit = k < 3 ? [{t:'a', f:true}, {t:'b', f:k === 0}] : []; }); window.__nIts = its.length; }, app);
  await ver('board'); if (F) await p.screenshot({path: F + 'po_quadro.png'});
  ok(await p.evaluate(() => document.querySelectorAll('.bj-cartao .po-chips .po-ck').length >= 2), 'o Quadro mostra quantos critérios estão marcados no cartão');
  ok(await p.evaluate(() => document.querySelectorAll('.bj-cartao .po-m-deve').length >= 1 && !!document.querySelector('.bj-cartao .bj-pts')), 'e a prioridade e a estimativa');
  await ver('list'); if (F) await p.screenshot({path: F + 'po_lista.png', fullPage:true});
  ok(await p.evaluate(() => !!document.querySelector('.po-grupo .po-chips .po-pts') && !!document.querySelector('.po-filtros [data-po-f="ordem"]')), 'a Lista mostra prioridade, estimativa e critérios, com Ordenar');
  await p.selectOption('[data-po-f="moscow"]', 'deve'); await p.waitForTimeout(400);
  const n = await p.evaluate(() => [...document.querySelectorAll('.po-grupo li')].length);
  const nDeve = await p.evaluate(a => window.__tf.D.issues.filter(i => i.moscow === 'deve' && !i.arquivado).length, app);
  ok(n >= 1 && n <= nDeve, 'filtrar pela prioridade Deve deixa só os itens Deve (' + n + ')');
  await p.selectOption('[data-po-f="moscow"]', ''); await p.selectOption('[data-po-f="situ"]', 'doing'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => [...document.querySelectorAll('.po-grupo h3')].every(h => /Em andamento/.test(h.textContent))), 'filtrar pela situação Em andamento');
  await p.selectOption('[data-po-f="situ"]', ''); await p.selectOption('[data-po-f="ordem"]', 'prioridade'); await p.waitForTimeout(300);
  await ver('backlog'); if (F) await p.screenshot({path: F + 'po_fila.png'});
  ok(await p.evaluate(() => !!document.querySelector('[data-po-ordenar]') && document.querySelectorAll('.bj-linha .po-pos, li .po-pos').length >= 1), 'a Fila tem Ordenar pela prioridade e a posição de cada item');
  await p.evaluate(() => { const U = window.__tf.UI; U.poF = {}; });
  })();
  // ---------- Entregas ----------
  await (async () => {
  await p.evaluate(a => { const D = window.__tf.D, U = window.__tf.UI; const ws = new Set(D.ws.filter(w => w.app === a).map(w => w.id));
    const its = D.issues.filter(i => ws.has(i.ws) && i.tipo !== 'epic' && !i.arquivado).slice(0, 3);
    const m = {id:'mc_teste', no:'app:' + a, tipo:'release', nome:'v9.9', desc:'', data:'2026-12-01', vis:true, entregue:null, notas:'', meta:''}; D.marcos.push(m);
    its.forEach((i, k) => { i.marco = m.id; i.pontos = [5, 8, 3][k]; }); its[0].status = 'done';
    U.sel = 'app:' + a; U.view = 'entregas'; window.__tf.rOperacoes(); window.__m = m.id; }, app);
  await p.waitForTimeout(1200);
  if (F) await p.screenshot({path: F + 'po_entregas.png'});
  const t = await p.evaluate(() => document.querySelector('.en2') ? document.querySelector('.en2').textContent : '');
  ok(/itens aceitos/.test(t) && /pontos · faltam/.test(t), 'a versão mostra itens aceitos, pontos e quanto falta');
  ok(/Definição de Pronto/.test(t) && /Escrever a meta|Meta:/.test(t), 'Entregas mostra a Definição de Pronto e a meta da versão');
  })();
  // ---------- Exportação ----------
  await (async () => {
  const r = await p.evaluate(a => { const D = window.__tf.D; const ws = new Set(D.ws.filter(w => w.app === a).map(w => w.id));
    const i = D.issues.find(x => ws.has(x.ws) && x.tipo === 'story'); i.hQuem = 'lojista'; i.hQuero = 'ver o saldo'; i.hPara = 'decidir'; i.moscow = 'deve'; i.valor = 7; i.valorMotivo = 'menos suporte'; i.pontos = 13; i.crit = [{t:'Mostra o saldo', f:true}, {t:'No celular', f:false}];
    const pj = D.projects.find(p => p.id === D.apps.find(x => x.id === a).project); pj.dod = 'Sem bugs conhecidos'; return {item:window.__tf.exItemMd(i), no:window.__tf.exNoMd('project:' + pj.id)}; }, app);
  ok(/## História\n\nComo lojista, quero ver o saldo, para decidir\./.test(r.item) && /- \[x\] Mostra o saldo/.test(r.item) && /- \[ \] No celular/.test(r.item), 'o .md do item traz a história e os critérios com as caixas');
  ok(/Classe \(MoSCoW\):\*\* Deve/.test(r.item) && /Valor de negócio:\*\* 7 de 10 · menos suporte/.test(r.item) && /Critérios de aceite:\*\* 1 de 2/.test(r.item) && /Definição de Pronto do projeto\n\nSem bugs/.test(r.item), 'e a prioridade, o valor, os critérios marcados e a Definição de Pronto');
  ok(/## Método do P\.O\./.test(r.no) && /## Backlog \(na ordem do P\.O\.\)\n\n\| # \| Item/.test(r.no), 'o .md do projeto traz a Definição de Pronto e o backlog na ordem, com os campos novos');
  })();
  // ---------- Janela do item ----------
  await (async () => {
  const it = conta("select i.id from public.itens i join status_fluxo s on s.id=i.status_id where i.tipo='story' and s.grupo<>'done' order by i.criado_em limit 1");
  await p.evaluate(id => window.__tf.abrirItem(id), it); await p.waitForTimeout(800);
  const pg = async (sel, v) => { await p.fill(sel, v); await p.dispatchEvent(sel, 'change'); await p.waitForTimeout(250); };
  await pg('#gaveta-wrap [data-po="hQuem"]', 'lojista');
  await pg('#gaveta-wrap [data-po="hQuero"]', 'ver o saldo de anúncios');
  await pg('#gaveta-wrap [data-po="hPara"]', 'saber quantos ainda posso publicar');
  for (const t of ['Mostra o saldo atualizado', 'Funciona no celular', 'Avisa quando o saldo acaba']) { await p.fill('#gaveta-wrap [data-po-form="crit"] input', t); await p.press('#gaveta-wrap [data-po-form="crit"] input', 'Enter'); await p.waitForTimeout(250); }
  await p.selectOption('#gaveta-wrap [data-po="moscow"]', 'deve'); await p.waitForTimeout(200);
  await p.selectOption('#gaveta-wrap [data-po="nivel"]', '2'); await p.waitForTimeout(200);
  await p.selectOption('#gaveta-wrap [data-po="valor"]', '8'); await p.waitForTimeout(200);
  await p.selectOption('#gaveta-wrap [data-po="pontos"]', '20'); await p.waitForTimeout(200);
  await p.check('#gaveta-wrap [data-po-crit="0"]'); await p.waitForTimeout(4000); 
  const r = psql("select historia_quem||'|'||historia_quero||'|'||moscow||'|'||nivel||'|'||prioridade||'|'||valor||'|'||pontos from itens where id='" + it + "'").trim();
  ok(r === 'lojista|ver o saldo de anúncios|deve|2|high|8|20', 'grava história, prioridade, nível (e a prioridade antiga junto), valor e pontos: ' + r);
  const c = psql("select string_agg(texto||':'||feito||':'||(marcado_por is not null), ',' order by ordem) from itens_criterios where item_id='" + it + "'").trim();
  ok(/^Mostra o saldo atualizado:true:true,Funciona no celular:false:false,Avisa quando o saldo acaba:false:false$/.test(c), 'grava os 3 critérios na ordem, o primeiro marcado com quem marcou: ' + c);
  await p.waitForTimeout(2600);
  if (F) await p.screenshot({path: F + 'po_item1.png'});
  await p.evaluate(() => { const g = document.querySelector('#gaveta-wrap .g-principal'); const s = document.querySelector('[data-po-sec="criterios"]'); s.scrollIntoView(); });
  await p.waitForTimeout(200); if (F) await p.screenshot({path: F + 'po_item2.png'});
  await p.evaluate(() => document.querySelector('[data-po-sec="historico"]').scrollIntoView()); await p.waitForTimeout(200); if (F) await p.screenshot({path: F + 'po_item3.png'});
  })();
  // ---------- Fluxo do P.O. ----------
  await (async () => {
  const it = conta("select i.id from public.itens i join status_fluxo s on s.id=i.status_id where i.tipo='story' and s.grupo<>'done' order by i.criado_em offset 1 limit 1");
  const abrir = async () => { await p.evaluate(id => window.__tf.abrirItem(id), it); await p.waitForTimeout(500); };
  const botao = async txt => { await p.evaluate(t => [...document.querySelectorAll('dialog.modal[open] .modal-rod .btn')].find(b => b.textContent.trim() === t).click(), txt); await p.waitForTimeout(400); };
  await abrir();
  // define o P.O.: William
  await p.click('#gaveta-wrap [data-po-acao="definir-po"]'); await p.waitForTimeout(300);
  const eu = await p.evaluate(() => window.__eu);
  await p.selectOption('#po-quem', eu); await botao('Guardar'); await p.waitForTimeout(1500);
  ok(conta("select count(*) from projetos where po_id = '" + eu + "'") === '1', 'definir o P.O. grava no projeto');
  // a definição de pronto
  await abrir(); await p.click('#gaveta-wrap [data-po-acao="dod"]'); await p.waitForTimeout(300);
  await p.fill('#po-dod', '- Sem bugs conhecidos\n- Testado no computador e no celular\n- Aprovado pelo P.O.'); await botao('Guardar'); await p.waitForTimeout(1200);
  ok(/Sem bugs conhecidos/.test(conta("select definicao_pronto from projetos where po_id = '" + eu + "'")), 'a Definição de Pronto grava no projeto');
  await abrir();
  ok(await p.evaluate(() => /Sem bugs conhecidos/.test(document.querySelector('#gaveta-wrap .po-dod').textContent)), 'e aparece no item como lembrete');
  // critério e Pronto para testar
  await p.fill('#gaveta-wrap [data-po-form="crit"] input', 'Mostra o saldo'); await p.press('#gaveta-wrap [data-po-form="crit"] input', 'Enter'); await p.waitForTimeout(300);
  await p.fill('#gaveta-wrap [data-po-form="crit"] input', 'Funciona no celular'); await p.press('#gaveta-wrap [data-po-form="crit"] input', 'Enter'); await p.waitForTimeout(300);
  await p.selectOption('#gaveta-wrap [data-g="status"]', 'review'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => { const b = document.querySelector('#gaveta-wrap [data-po-acao="aceitar"]'); return !!b && b.disabled; }), 'em Pronto para testar, o P.O. vê Aceitar, travado enquanto tem critério desmarcado');
  await p.evaluate(id => { const i = window.__tf.D.issues.find(x => x.id === id); window.__tf.mudarStatus(i, 'done'); }, it); await p.waitForTimeout(300);
  ok(await p.evaluate(id => window.__tf.D.issues.find(x => x.id === id).status, it) === 'review', 'arrastar ou escolher Aceito com critério desmarcado não muda nada (avisa)');
  // devolver
  await p.click('#gaveta-wrap [data-po-acao="devolver"]'); await p.waitForTimeout(300);
  await p.fill('#po-motivo', 'O saldo não bate com o extrato'); await botao('Devolver'); await p.waitForTimeout(1500);
  ok(conta("select (voltou_em is not null)::text || '|' || voltou_motivo from itens where id = '" + it + "'") === 'true|O saldo não bate com o extrato', 'Devolver grava o Voltou com o motivo');
  ok(await p.evaluate(() => /Voltou/.test(document.querySelector('#gaveta-wrap .po-situ').textContent)), 'a janela mostra Voltou');
  if (F) await p.screenshot({path: F + 'po_voltou.png'});
  // volta, marca tudo e aceita
  await p.selectOption('#gaveta-wrap [data-g="status"]', 'review'); await p.waitForTimeout(400);
  await p.check('#gaveta-wrap [data-po-crit="0"]'); await p.waitForTimeout(300); await p.check('#gaveta-wrap [data-po-crit="1"]'); await p.waitForTimeout(300);
  await p.click('#gaveta-wrap [data-po-acao="aceitar"]'); await p.waitForTimeout(400);
  // aceite guiado: precisa conferir cada ponto
  await p.evaluate(() => [...document.querySelectorAll('dialog.modal[open] .modal-rod .btn')].pop().click()); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !!document.querySelector('dialog.modal[open] [data-pg-conf]')), 'aceite guiado: sem conferir os pontos, não aceita (a janela continua aberta)');
  await p.evaluate(() => document.querySelectorAll('dialog.modal[open] [data-pg-conf]').forEach(x => { x.checked = true; }));
  await p.evaluate(() => [...document.querySelectorAll('dialog.modal[open] .modal-rod .btn')].pop().click()); await p.waitForTimeout(2500);
  ok(conta("select s.grupo from itens i join status_fluxo s on s.id = i.status_id where i.id = '" + it + "'") === 'done', 'com tudo marcado, Aceitar leva para Aceito (no banco)');
  await abrir(); await p.waitForTimeout(3000); await abrir();
  ok(await p.evaluate(() => [...document.querySelectorAll('#gaveta-wrap [data-po-crit]')].every(x => x.disabled) && !document.querySelector('#gaveta-wrap [data-po-form="crit"]') && document.querySelector('#gaveta-wrap [data-po="hQuem"]').disabled), 'item aceito: critérios e história travados');
  const hist = await p.evaluate(() => document.querySelector('#gaveta-wrap .po-hist-lista').textContent);
  ok(/Devolveu: Pronto para testar → Voltou\. Motivo: O saldo não bate/.test(hist) && /Voltou → Pronto para testar/.test(hist) && /Pronto para testar → Aceito/.test(hist) && /Marcou o critério "Funciona no celular"/.test(hist), 'o histórico mostra Voltou com motivo, a volta, o aceite e os critérios marcados');
  if (F) await p.screenshot({path: F + 'po_aceito.png'});
  // criar melhoria
  await p.click('#gaveta-wrap [data-po-acao="melhoria"]'); await p.waitForTimeout(300);
  await p.fill('#po-nt', 'Melhoria: saldo por loja'); await botao('Criar'); await p.waitForTimeout(1800);
  ok(conta("select count(*) from itens where melhoria and origem_id = '" + it + "' and titulo = 'Melhoria: saldo por loja'") === '1', 'Criar melhoria cria um item novo ligado ao antigo (o aceito não muda)');
  // desenho
  await abrir();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await p.setInputFiles('#gaveta-wrap [data-po-des="desenho_celular"]', {name:'celular.png', mimeType:'image/png', buffer:png}); await p.waitForTimeout(2500);
  ok(conta("select count(*) from anexos where item_id = '" + it + "' and papel = 'desenho_celular'") === '1', 'o desenho de celular vai para o banco com o papel certo');
  await abrir();
  ok(await p.evaluate(() => !!document.querySelector('#gaveta-wrap [data-po-des-ver="desenho_celular"] img')), 'e aparece no lugar do celular');
  })();
  ok(!erros.length, 'sem erro na página' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})();
