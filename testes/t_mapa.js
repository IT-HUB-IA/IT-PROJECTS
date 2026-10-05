// Mapa do Sistema (Infraestrutura > Como está): as 6 visões, alertas, colunas sem tela, é de propósito, criar item, busca e o banco ligado ou não.
// O mapa é o que o trabalhador (worker/mapa) gerou do sistema de exemplo, gravado pela função mapa_gravar. Rodar de fonte/: BD=<banco com a parte 69> MAPA=<mapa.json> node ../testes/t_mapa.js
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
  from:q, async rpc(fn, args){ if (/^(ia_|admin_ia_|admin_usuarios|infra_|mapa_)/.test(fn)) return JSON.parse(await window.__rpc(JSON.stringify({fn, args:args || {}}))); if (fn === 'sou_dono_sistema') return {data:true, error:null}; if (/^admin_/.test(fn)) return {data:fn === 'admin_resumo' ? {gerado_em:new Date().toISOString()} : [], error:null}; if (fn !== 'vincular_meu_login') return {data:null, error:null}; return {data:[{pessoa_id:window.__eu, nome:'William', papel:'master', numero:100001, espaco_id:window.__esp || null}], error:null}; } }; } };`;
(async () => {
  prepararLogin();
  const eu = 'd148fdc5-eef3-5398-bf89-f49b55b5cd28';
  const b = await chromium.launch(); const erros = []; let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', e => { erros.push(e.message); console.log('PAGEERROR', e.stack.split('\n').slice(0,4).join(' | ')); });
  await p.exposeFunction('__bd', s => JSON.stringify(executar(JSON.parse(s))));
  const litSql = v => v === null || v === undefined ? 'null' : typeof v === 'number' || typeof v === 'boolean' ? String(v) : typeof v === 'object' ? '$l$' + JSON.stringify(v) + '$l$' : '$l$' + v + '$l$';
  const rpcs = [];
  await p.exposeFunction('__rpc', s => { const {fn, args} = JSON.parse(s); rpcs.push(fn);
    if (!/^(infra_|mapa_)/.test(fn)) return JSON.stringify({data:null, error:null});
    try { const out = psql(COMO + 'select to_json(public.' + fn + '(' + Object.entries(args).map(([k, v]) => k + ' => ' + litSql(v)).join(', ') + '))').trim(); return JSON.stringify({data:out ? JSON.parse(out) : null, error:null}); }
    catch (e) { const m = String(e.stderr || e.message).split('\n').find(l => /ERROR/.test(l)) || String(e.message); return JSON.stringify({data:null, error:{message:m.replace(/^.*ERROR:\s*/, '')}}); } });
  await p.exposeFunction('__fn', () => JSON.stringify({data:{ok:true}, error:null}));
  const esp = psql("select id from public.espacos where dono_id = '" + eu + "' and pessoal limit 1").trim();
  await p.addInitScript(([id, e]) => { window.__eu = id; window.__esp = e || null; }, [eu, esp]);
  await p.route('**/supabase-js@*/**', r => r.fulfill({ contentType: 'text/javascript', body: FALSO }));
  await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  // o mapa que o trabalhador gerou, gravado pela mesma função que a produção usa
  const APP = '3991414f-b7a6-5abf-a62e-064efa9a9adf', PJ = psql("select id from public.nos where tipo = 'projeto' and nome = 'BL'").trim();
  psql("insert into public.git_conexoes (espaco_id, provedor, externo_id, conta) select espaco_id, 'github', '4242', 'it-hub' from public.nos where id = '" + APP + "'");
  psql("insert into public.repositorios (no_id, provedor, nome, branch_principal, conexao_id) select '" + APP + "', 'github', 'it-hub/loja-exemplo', 'main', id from public.git_conexoes where externo_id = '4242'");
  const REPO = psql("select id from public.repositorios where nome = 'it-hub/loja-exemplo'").trim();
  const AN = psql("insert into public.mapa_analises (no_id, repositorio_id, status, iniciado_em, referencia) values ('" + APP + "', '" + REPO + "', 'rodando', now(), 'abc1234def') returning id").trim();
  const mapa = require('fs').readFileSync(process.env.MAPA || '/tmp/claude-0/mapa1.json', 'utf8');
  psql("set client_min_messages = warning; select public.mapa_gravar('" + AN + "', $m$" + mapa + "$m$::jsonb)");
  ok(psql("select status from public.mapa_analises where id = '" + AN + "'").trim() === 'pronto', 'o mapa do trabalhador entrou pelo mapa_gravar e a análise ficou pronta');
  const n = JSON.parse(mapa);
  const abrir = async (sel) => { await p.goto('file://' + process.cwd() + '/vercel/index.html'); await p.waitForTimeout(2500);
    await p.evaluate(() => document.querySelector('[data-tela="operacoes"]').click()); await p.waitForTimeout(400);
    await p.evaluate(k => { const U = window.__tf.UI; U.sel = k; U.view = 'infra'; U.semArvore = true; window.__tf.rOperacoes(); }, sel); await p.waitForTimeout(2500); };
  const txt = async s => (await p.locator(s).first().innerText().catch(() => '')).replace(/\s+/g, ' ');
  const foto = async n => { if (process.env.FOTOS) await p.screenshot({ path: process.env.FOTOS + '/' + n + '.png', fullPage: true }); };
  const clicar = async s => { await p.locator(s).first().click(); await p.waitForTimeout(500); };

  // 1. a Infraestrutura abre no "Como está", com a troca no topo
  await abrir('app:' + APP);
  ok(await p.locator('#ops-corpo .mp-troca [data-mp-modo="mapa"][aria-selected="true"]').count() === 1 && await p.locator('#ops-corpo .mp-troca [data-mp-modo="desenhos"]').count() === 1, 'no topo da Infraestrutura: "Como está" (aberto primeiro) e "Desenhos"');
  ok(/Visões por Aplicação/.test(await txt('#ops-corpo .mp-cab h2')), 'aplicação escolhida: Visões por Aplicação');
  const st = await txt('#ops-corpo .mp-status');
  ok(/Última análise/.test(st) && /abc1234/.test(st) && /HTML/.test(st), 'a linha de cima diz quando foi a última análise, o commit e a tecnologia');
  ok(await p.locator('#ops-corpo .mp-status [data-ifr-lig]').count() === 1 && await p.locator('#ops-corpo [data-mp-pedir]').count() === 1, 'com o botão Ligações e o Analisar agora');
  // 2. macro da aplicação: os módulos com a contagem de alertas e as colunas sem tela
  const cards = await p.locator('#ops-corpo .mp-card.mod h4').allInnerTexts();
  ok(['Clientes', 'Pedidos', 'Ajustes', 'Financeiro'].every(m => cards.includes(m)), 'macro: os módulos do menu viram cartões (' + cards.join(', ') + ')');
  const cartaoClientes = p.locator('#ops-corpo .mp-card.mod', { hasText: 'Clientes' });
  ok(await cartaoClientes.locator('.mp-al-ico.g-erro').count() >= 1 && await cartaoClientes.locator('.mp-al-ico.g-atencao').count() >= 1, 'o cartão de Clientes mostra a contagem: erro (coluna que não existe) e atenção (campo sem destino)');
  const cst = await txt('#ops-corpo .mp-cst');
  ok(/Colunas sem tela/i.test(cst) && /clientes/.test(cst) && /pedidos/.test(cst) && /tabela_esquecida/.test(cst) && /a tabela inteira/.test(cst), 'painel "Colunas sem tela", agrupado por tabela (clientes, pedidos e a tabela que ninguém usa)');
  ok(!(await txt('#ops-corpo .mp-tela')).includes('Ligue o banco desta aplicação'), 'com o banco ligado, sem a linha de "ligue o banco"');
  await foto('1_app_macro');
  // 3. meso: módulos e janelas
  await clicar('#ops-corpo [data-mp-visao="meso"]');
  const meso = await txt('#ops-corpo .mp-colunas');
  ok(/Novo cliente/.test(meso) && /Janela/i.test(meso), 'meso: os módulos e as janelas de cada um (a janela Novo cliente em Clientes)');
  await foto('2_app_meso');
  // 4. micro: alerta ao lado do campo
  await clicar('#ops-corpo [data-mp-visao="micro"]');
  await foto('3_app_micro');
  const obs = p.locator('#ops-corpo .mp-el.t-campo', { hasText: 'Observação' });
  ok(await obs.locator('.mp-al.g-atencao').count() === 1 && /não vai para o banco/.test(await obs.innerText()), 'micro: ao lado do campo Observação, o ícone de atenção com o texto curto');
  const jan = p.locator('#ops-corpo .mp-bloco.t-janela', { hasText: 'Novo cliente' }).first();
  ok(/apelido/.test(await jan.innerText()) && await jan.locator('.mp-al.g-erro').count() >= 1, 'micro: na janela Novo cliente, o erro da coluna "apelido" que não existe');
  ok(/grava em clientes\.nome/.test(await txt('#ops-corpo .mp-el.t-campo:has-text("Nome")')), 'micro: o campo Nome diz para onde vai (clientes.nome)');
  ok(/index\.html:\d+/.test(await txt('#ops-corpo .mp-el.t-botao:has-text("Novo cliente")')) || /index\.html:\d+/.test(await txt('#ops-corpo .mp-bloco')), 'micro: arquivo e linha no código');
  ok(/gerente/.test(await txt('#ops-corpo .mp-bloco:has-text("Financeiro")')) && !/atendente/.test(await txt('#ops-corpo .mp-bloco:has(h4:text-is("Financeiro")) > header')), 'quem vê: Financeiro só para o gerente');
  // busca
  await p.fill('#ops-corpo [data-mp-busca]', 'Tema'); await p.waitForTimeout(500);
  const visiveis = await p.locator('#ops-corpo .mp-bloco.t-tela h4').allInnerTexts();
  ok(visiveis.length === 1 && visiveis[0] === 'Ajustes', 'busca: "Tema" deixa só a tela onde ele está (' + visiveis.join(', ') + ')');
  await p.fill('#ops-corpo [data-mp-busca]', ''); await p.waitForTimeout(400);
  // 5. "é de propósito" com motivo obrigatório
  const so = p.locator('#ops-corpo .mp-al.g-atencao', { hasText: 'Tema da tela' }).first();
  await so.locator('[data-mp-proposito]').click(); await p.waitForTimeout(400);
  await p.locator('dialog.modal [data-b="1"]').click(); await p.waitForTimeout(300);
  ok(await p.locator('dialog.modal #mp-motivo').count() === 1, 'é de propósito sem motivo: a janela não fecha');
  await p.fill('dialog.modal #mp-motivo', 'O tema é escolha de cada pessoa, fica no navegador mesmo'); await p.locator('dialog.modal [data-b="1"]').click(); await p.waitForTimeout(1500);
  ok(psql("select motivo from public.mapa_proposito").trim() === 'O tema é escolha de cada pessoa, fica no navegador mesmo', 'gravado no banco com o motivo (pela função mapa_proposito_marcar)');
  ok(/É de propósito: O tema é escolha/.test(await txt('#ops-corpo .mp-al.proposito')), 'o alerta fica marcado com o motivo, quem e quando');
  await clicar('#ops-corpo [data-mp-visao="macro"]');
  const ajustes = p.locator('#ops-corpo .mp-card.mod', { hasText: 'Ajustes' });
  ok(await ajustes.locator('.mp-al-ico.g-atencao').count() === 0, 'a contagem do módulo Ajustes baixa a zero (o que é de propósito não conta)');
  await clicar('#ops-corpo [data-mp-visao="micro"]');
  await p.locator('#ops-corpo [data-mp-desmarcar]').first().click(); await p.waitForTimeout(1500);
  ok(psql("select count(*) from public.mapa_proposito").trim() === '0', 'e dá para desmarcar');
  // 6. um alerta vira item
  await p.locator('#ops-corpo .mp-el.t-campo:has-text("Observação") [data-mp-item]').click(); await p.waitForTimeout(500);
  const tit = await p.locator('dialog.modal #ni-t').inputValue().catch(() => '');
  const desc = await p.locator('dialog.modal #ni-d').inputValue().catch(() => '');
  ok(/^Campo sem destino: O que se digita em "Observação"/.test(tit) && /Mapa do Sistema/.test(desc) && /index\.html/.test(desc), 'Criar item: abre o Novo item já preenchido (título, de onde veio e onde está no código)');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // 7. sem banco ligado: sem alertas e a linha discreta
  psql("update public.mapa_analises set com_banco = false where id = '" + AN + "'");
  await abrir('app:' + APP);
  ok(/Ligue o banco desta aplicação para conferir onde os dados são salvos/.test(await txt('#ops-corpo .mp-sem-banco')) && await p.locator('#ops-corpo .mp-al-ico').count() === 0 && await p.locator('#ops-corpo .mp-cst').count() === 0, 'sem o banco da aplicação ligado: nenhum alerta, só a linha discreta');
  psql("update public.mapa_analises set com_banco = true where id = '" + AN + "'");
  // 8. visões por projeto: sem alertas
  await abrir('project:' + PJ);
  await foto('4_proj_macro');
  ok(/Visões por Projeto/.test(await txt('#ops-corpo .mp-cab h2')) && await p.locator('#ops-corpo svg.mp-grafo .mp-no').count() >= 1, 'projeto macro: as aplicações no desenho');
  ok(await p.locator('#ops-corpo .mp-al-ico, #ops-corpo .mp-al').count() === 0, 'projeto: nenhum alerta (alertas só nas visões por aplicação)');
  await clicar('#ops-corpo [data-mp-visao="meso"]');
  ok(/Clientes/.test(await txt('#ops-corpo .mp-colunas')) && /Loja Exemplo/.test(await txt('#ops-corpo .mp-colunas')), 'projeto meso: as aplicações e os módulos de cada uma');
  await clicar('#ops-corpo [data-mp-visao="micro"]');
  await p.locator('#ops-corpo .mp-ar-nome:has-text("Financeiro")').first().click(); await p.waitForTimeout(400);
  await foto('5_proj_micro');
  const foco = await txt('#ops-corpo .mp-foco');
  ok(/Financeiro/.test(foco) && /gerente/.test(foco) && /Quem vê/.test(foco), 'projeto micro: foco numa peça mostra quem vê, onde fica e as ligações');
  await p.fill('#ops-corpo [data-mp-busca]', 'Exportar'); await p.waitForTimeout(500);
  ok(/Exportar/.test(await txt('#ops-corpo .mp-arvore')) && !/Pedidos/.test(await txt('#ops-corpo .mp-arvore')), 'projeto micro: a busca filtra a árvore');
  // 9. Desenhos continua igual
  await clicar('#ops-corpo [data-mp-modo="desenhos"]'); await p.waitForTimeout(1500);
  ok(await p.locator('#ops-corpo .ifr-tela').count() === 1 && await p.locator('#ops-corpo .mp-troca [data-mp-modo="desenhos"][aria-selected="true"]').count() === 1, '"Desenhos" mostra as 10 visões de antes, com a troca no topo');
  await clicar('#ops-corpo [data-mp-modo="mapa"]');
  ok(await p.locator('#ops-corpo .mp-tela').count() === 1, 'e volta para o "Como está"');
  // 10. Analisar agora
  await abrir('app:' + APP);
  await clicar('#ops-corpo [data-mp-pedir]'); await p.waitForTimeout(1500);
  ok(psql("select count(*) from public.mapa_analises where status = 'fila' and origem = 'manual'").trim() === '1' && /na fila/i.test(await txt('#ops-corpo .mp-status')), 'Analisar agora: entra um pedido na fila e a linha de cima diz "Na fila"');
  // 11. celular
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(400);
  await foto('6_celular');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no celular (390 px): nada sai para o lado');
  ok(!erros.length, 'nenhum erro na página' + (erros.length ? ': ' + erros[0] : ''));
  await b.close();
  console.log(falhas ? falhas + ' FALHA(S)' : 'tudo OK');
  process.exit(falhas ? 1 : 0);
})();
