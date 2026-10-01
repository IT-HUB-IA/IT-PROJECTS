// Agent Studio (só o dono do sistema), contra um Postgres local com as regras de acesso de verdade (papel authenticated).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { execFileSync } = require('child_process');
const BD = process.env.BD || 'ciclodev_m17';
const psqlRaw = sql => execFileSync('psql', ['-h', '/tmp', '-p', '55432', '-U', 'postgres', '-d', BD, '-v', 'ON_ERROR_STOP=1', '-Atq', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const lit = o => '$j$' + JSON.stringify(o) + '$j$';
const ESCALAR = ['admin_resumo', 'sou_dono_sistema'];
function como(uid, email){ return "set role authenticated; set request.jwt.claim.sub = '" + uid + "'; set request.jwt.claims = '" + JSON.stringify({sub:uid, email}).replace(/'/g, "''") + "'; "; }
let QUEM = null;
function executar(p){
  const {t, op, row, filtro, conflito, de, ate, ret, fn, args} = p; const T = 'public.' + t;
  const onde = f => { const ks = Object.keys(f); return ks.length ? '(' + ks.join(',') + ') = (select ' + ks.join(',') + ' from json_populate_record(null::' + T + ', ' + lit(f) + '))' : 'true'; };
  try {
    let sql;
    if (op === 'rpc'){
      const a = Object.entries(args || {}).map(([k, v]) => k + ' => ' + (v === null ? 'null' : typeof v === 'number' ? v : "'" + String(v).replace(/'/g, "''") + "'")).join(', ');
      sql = ESCALAR.includes(fn) ? 'select to_json(public.' + fn + '(' + a + '))' : "select coalesce(json_agg(x), '[]') from public." + fn + '(' + a + ') x';
    }
    else if (op === 'select') sql = "select coalesce(json_agg(x), '[]') from (select * from " + T + ' order by 1 offset ' + (de || 0) + ' limit ' + ((ate || 999) - (de || 0) + 1) + ') x';
    else if (op === 'insert' || op === 'upsert'){ const cs = Object.keys(Array.isArray(row) ? row[0] : row);
      sql = 'insert into ' + T + ' (' + cs.join(',') + ') select ' + cs.join(',') + ' from ' + (Array.isArray(row) ? 'json_populate_recordset' : 'json_populate_record') + '(null::' + T + ', ' + lit(row) + ')' +
        (op === 'upsert' ? ' on conflict (' + conflito + ') do update set ' + (cs.filter(c => !conflito.split(',').includes(c)).map(c => c + '=excluded.' + c).join(',') || conflito.split(',')[0] + '=excluded.' + conflito.split(',')[0]) : '');
      sql = ret ? 'with u as (' + sql + " returning *) select coalesce(json_agg(u), '[]') from u" : sql; }
    else if (op === 'update'){ const cs = Object.keys(row); sql = 'with u as (update ' + T + ' set ' + (cs.length === 1 ? cs[0] + ' = (select ' + cs[0] : '(' + cs.join(',') + ') = (select ' + cs.join(',')) + ' from json_populate_record(null::' + T + ', ' + lit(row) + ')) where ' + onde(filtro) + " returning *) select coalesce(json_agg(u), '[]') from u"; }
    else if (op === 'delete') sql = 'delete from ' + T + ' where ' + onde(filtro);
    const out = psqlRaw(como(QUEM.uid, QUEM.email) + sql).trim();
    const d = out ? JSON.parse(out) : null;
    return {data: (op === 'delete' || (op === 'insert' && !ret)) ? null : d, error: null};
  } catch (e) { const m = String(e.stderr || e.message).split('\n').find(l => /ERROR/.test(l)) || String(e.message); return {data: null, error: {message: m.replace(/^.*ERROR:\s*/, '')}}; }
}
const FALSO = `
function q(t){ const st = {t, op:'select', filtro:{}, de:0, ate:998};
  const px = new Proxy(function(){}, { get(_, k){
    if (k === 'then') return (res, rej) => window.__bd(JSON.stringify(st)).then(r => JSON.parse(r)).then(res, rej);
    if (k === 'range') return (a, b) => { st.de = a; st.ate = b; return px; };
    if (k === 'select') return () => { if (st.op !== 'select') st.ret = true; return px; };
    if (k === 'insert') return r => { st.op = 'insert'; st.row = r; return px; };
    if (k === 'upsert') return (r, o) => { st.op = 'upsert'; st.row = r; st.conflito = (o || {}).onConflict; st.ret = true; return px; };
    if (k === 'update') return r => { st.op = 'update'; st.row = r; return px; };
    if (k === 'delete') return () => { st.op = 'delete'; return px; };
    if (k === 'match') return f => { Object.assign(st.filtro, f); return px; };
    if (k === 'eq') return (c, v) => { st.filtro[c] = v; return px; };
    return () => px; } }); return px; }
window.supabase = { createClient(){ const sess = window.__sessao; return { auth:{ async getSession(){ return {data:{session:sess}}; }, onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}}; }, async signOut(){},
    async signUp(a){ window.__cadastro = a; return {data:{session:null, user:{id:'novo'}}, error:null}; } },
  from:q, rpc(fn, args){ return window.__bd(JSON.stringify({op:'rpc', fn, args})).then(r => JSON.parse(r)); } }; } };`;

(async () => {
  const conta = sql => psqlRaw(sql).trim();
  const W = {uid: conta("select auth_user_id from pessoas where id = 'd148fdc5-eef3-5398-bf89-f49b55b5cd28'"), email: 'william@teste.com'};
  const M = {uid: '00000000-0000-0000-0000-0000000000b1', email: 'maria@teste.com'};
  const b = await chromium.launch(); let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
  async function abrir(quem, sessao, largura){
    QUEM = quem || W;
    const p = await b.newPage({ viewport: { width: largura || 1440, height: 900 } });
    p.on('pageerror', e => { falhas++; console.log('PAGEERROR', e.stack.split('\n').slice(0, 4).join(' | ')); });
    await p.exposeFunction('__bd', s => JSON.stringify(executar(JSON.parse(s))));
    await p.addInitScript(s => { window.__sessao = s; }, sessao);
    await p.route('**/supabase-js@*/**', r => r.fulfill({ contentType: 'text/javascript', body: FALSO }));
    await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
    await p.route(/viacep\.com\.br\/ws\/01310100/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({cep:'01310-100', logradouro:'Avenida Paulista', bairro:'Bela Vista', localidade:'São Paulo', uf:'SP'}) }));
    await p.goto('file://' + process.cwd() + '/vercel/index.html'); await p.waitForTimeout(2500);
    return p;
  }
  const AG = '5f0c1d2e-0000-4000-8000-00000000c1c0';
  const limpar = () => psqlRaw("delete from studio_conhecimento; delete from studio_funcoes; update studio_agentes set instrucoes = '', nome = 'Assistente CicloDev' where id = '" + AG + "'; delete from studio_instrucoes_versoes;");
  limpar();
  const fs = require('fs'), path = require('path');
  const livro = path.join(process.cwd(), 'livro_teste.md');
  fs.writeFileSync(livro, '# Gestão Ágil na Prática\n\n## Prioridade\n\nA priorização por valor ajuda o time a escolher o que entregar primeiro.\n\n## Estimativa\n\nEstimativas ficam melhores quando o time compara com entregas passadas.\n');
  const livro2 = path.join(process.cwd(), 'livro_teste2.md');
  fs.writeFileSync(livro2, '# Gestão Ágil na Prática\n\n## Prioridade\n\nTexto novo sobre priorização.\n\n## Riscos\n\nRiscos se tratam cedo.\n\n## Ritmo\n\nRitmo sustentável.\n');

  // ===== 1) William, dono do sistema =====
  let p = await abrir(W, {user:{id:W.uid, email:W.email}});
  await p.waitForTimeout(800);
  ok(await p.isVisible('.item[data-tela="agentes"]'), 'William vê o Agent Studio no menu');
  await p.click('.item[data-tela="agentes"]'); await p.waitForSelector('#m-agentes .st-kpis', {timeout: 8000});
  ok(await p.$eval('#m-agentes [data-st-instr]', t => t.value === ''), 'o agente nasce em branco (instruções vazias)');
  ok(/Nenhum documento ainda/.test(await p.innerText('#m-agentes')) && /Nenhuma função ainda/.test(await p.innerText('#m-agentes')), 'sem documentos e sem funções');
  ok(!/AI PO|Billy|Agente de atendimento/.test(await p.innerText('#m-agentes')), 'os agentes antigos não aparecem');
  await p.fill('#m-agentes [data-st-instr]', 'Você é o assistente do CicloDev. Versão 1.'); await p.click('[data-st-salvar-instr]'); await p.waitForTimeout(600);
  await p.fill('#m-agentes [data-st-instr]', 'Você é o assistente do CicloDev. Versão 2.'); await p.click('[data-st-salvar-instr]'); await p.waitForTimeout(600);
  ok(conta("select instrucoes from studio_agentes where id = '" + AG + "'") === 'Você é o assistente do CicloDev. Versão 2.', 'instruções gravadas no banco');
  ok(await p.isVisible('[data-st-versoes]') && /\(1\)/.test(await p.innerText('[data-st-versoes]')), 'aparece 1 versão anterior');
  await p.click('[data-st-versoes]'); await p.click('dialog [data-st-voltar="0"]'); await p.waitForTimeout(800);
  ok(conta("select instrucoes from studio_agentes where id = '" + AG + "'") === 'Você é o assistente do CicloDev. Versão 1.' && +conta('select count(*) from studio_instrucoes_versoes') === 2, 'voltar para a versão anterior (e a de agora fica guardada)');
  await p.fill('#m-agentes [data-st-ag="nome"]', 'Assistente Teste'); await p.press('#m-agentes [data-st-ag="nome"]', 'Tab'); await p.waitForTimeout(500);
  ok(conta("select nome from studio_agentes where id = '" + AG + "'") === 'Assistente Teste', 'nome do agente gravado');

  // documentos
  await p.setInputFiles('#st-arq', livro); await p.waitForSelector('#m-agentes .st-docs', {timeout: 8000});
  const lin = await p.$$eval('#m-agentes .st-docs tbody tr', rs => rs.map(r => r.innerText.replace(/\s+/g, ' ')));
  ok(lin.length === 1 && /Gestão Ágil na Prática/.test(lin[0]) && /livro_teste\.md/.test(lin[0]) && /Fundamental/.test(lin[0]), 'livro entrou com o título do arquivo: ' + lin[0]);
  ok(+conta('select count(*) from studio_trechos') === 2, 'o livro virou 2 trechos no banco');
  await p.screenshot({ path: 'st_tela.png', fullPage: true });
  await p.fill('#m-agentes [data-st-buscar] input', 'como priorizar entregas'); await p.click('#m-agentes [data-st-buscar] button'); await p.waitForSelector('#m-agentes .st-achados li', {timeout: 8000});
  ok(/Prioridade/.test(await p.innerText('#m-agentes .st-achados li')), 'a busca acha o capítulo certo');
  await p.click('#m-agentes [data-st-ver]'); await p.waitForSelector('dialog .st-texto', {timeout: 8000});
  ok(/Estimativas ficam melhores/.test(await p.innerText('dialog .st-texto')), 'Ver mostra o texto do livro');
  await p.screenshot({ path: 'st_ver.png' });
  await p.keyboard.press('Escape');
  await p.click('#m-agentes [data-st-editar]'); await p.fill('#st-d-t', 'Livro 1'); await p.selectOption('#st-d-p', 'apoio'); await p.click('dialog [data-b="1"]'); await p.waitForTimeout(800);
  ok(conta("select titulo || '|' || peso from studio_conhecimento") === 'Livro 1|apoio', 'editar título e peso');
  const doc = conta('select id from studio_conhecimento');
  await p.evaluate(id => { document.querySelector('[data-st-trocar="' + id + '"]').click(); }, doc);
  await p.setInputFiles('#st-arq', livro2); await p.waitForTimeout(1200);
  ok(conta("select versao || '|' || titulo from studio_conhecimento") === '2|Livro 1' && +conta('select count(*) from studio_trechos') === 3, 'trocar o arquivo sobe a versão, mantém o título e refaz os trechos');
  await p.click('#m-agentes [data-st-ligar]'); await p.waitForTimeout(800);
  ok(conta('select ativo from studio_conhecimento') === 'f' && await p.$('#m-agentes .st-desligado') !== null, 'desligar o documento');
  await p.click('#m-agentes [data-st-ligar]'); await p.waitForTimeout(800);

  // funções
  await p.fill('#m-agentes [data-st-fn-nova] [name=nome]', 'Criar tarefa'); await p.fill('#m-agentes [data-st-fn-nova] [name=descricao]', 'Cria uma tarefa no projeto'); await p.selectOption('#m-agentes [data-st-fn-nova] [name=acao]', 'criar');
  await p.click('#m-agentes [data-st-fn-nova] button'); await p.waitForTimeout(800);
  ok(conta("select nome || '|' || acao || '|' || pede_confirmacao || '|' || ativo from studio_funcoes") === 'Criar tarefa|criar|true|false', 'função nova entra desligada e pedindo confirmação');
  ok(/Pede confirmação/.test(await p.innerText('#m-agentes')), 'tabela de funções aparece');
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no celular não sobra rolagem de lado');
  await p.screenshot({ path: 'st_celular.png', fullPage: true });
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.click('#m-agentes [data-st-apagar]'); await p.click('dialog [data-b="1"]'); await p.waitForTimeout(800);
  ok(+conta('select count(*) from studio_conhecimento') === 0 && +conta('select count(*) from studio_trechos') === 0, 'apagar o documento (com confirmação) tira os trechos junto');
  await p.click('.item[data-tela="servicedesk"]'); await p.waitForTimeout(500);
  ok(await p.isVisible('#m-servicedesk'), 'Service Desk abre sem os agentes antigos');
  await p.close();

  // ===== 2) Maria, usuária comum =====
  p = await abrir(M, {user:{id:M.uid, email:M.email}});
  await p.waitForTimeout(800);
  ok(!(await p.isVisible('.item[data-tela="agentes"]')), 'Maria não vê o Agent Studio no menu');
  await p.evaluate(() => { const b = document.querySelector('.item[data-tela="agentes"]'); if (b) b.click(); });
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelector('#tela-agentes').hidden), 'nem forçando o clique a tela abre para a Maria');
  await p.close();

  if (!process.env.MANTER) limpar(); fs.unlinkSync(livro); fs.unlinkSync(livro2);
  await b.close();
  console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK');
  process.exit(falhas ? 1 : 0);
})();
