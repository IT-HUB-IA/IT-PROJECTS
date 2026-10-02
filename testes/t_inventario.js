// Inventário de TI por cliente (parte 48): cadastros, movimentações com histórico, termo, estoque, licenças, planilha,
// etiquetas, conferência e as ligações. Rodar de fonte/: node ../testes/t_inventario.js (banco local com a parte 48).
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
  from:q, async rpc(fn, args){ if (/^(ia_|admin_ia_|admin_usuarios|infra_|analise_|inv_)/.test(fn)) return JSON.parse(await window.__rpc(JSON.stringify({fn, args:args || {}}))); if (fn === 'sou_dono_sistema') return {data:true, error:null}; if (/^admin_/.test(fn)) return {data:fn === 'admin_resumo' ? {gerado_em:new Date().toISOString()} : [], error:null}; if (fn !== 'vincular_meu_login') return {data:null, error:null}; return {data:[{pessoa_id:window.__eu, nome:'William', papel:'master', numero:100001, espaco_id:window.__esp || null}], error:null}; } }; } };`;
(async () => {
  prepararLogin();
  const eu = COMO ? 'd148fdc5-eef3-5398-bf89-f49b55b5cd28' : psql("select id from public.pessoas where papel='master' order by nome limit 1").trim();
  const b = await chromium.launch(); const erros = []; let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', e => { erros.push(e.message); console.log('PAGEERROR', e.stack.split('\n').slice(0,4).join(' | ')); });
  await p.exposeFunction('__bd', s => JSON.stringify(executar(JSON.parse(s))));
  const rpcs = [];
  // analise_marcar roda de verdade no banco local, como o usuário logado
  // as funções inv_* rodam de verdade no banco local, como o usuário logado
  const lit2 = v => v == null ? 'null' : typeof v === 'number' || typeof v === 'boolean' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
  await p.exposeFunction('__rpc', s => { const {fn, args} = JSON.parse(s); rpcs.push(fn);
    if (/^inv_/.test(fn)){ try { const a = Object.entries(args || {}).map(([k, v]) => k + ' => ' + lit2(v)).join(', '); return JSON.stringify({data:JSON.parse(psql(COMO + 'select to_jsonb(public.' + fn + '(' + a + '))').trim() || 'null'), error:null}); }
      catch (e) { return JSON.stringify({data:null, error:{message:(String(e.stderr || e.message).split('\n').find(l => /ERROR/.test(l)) || 'erro').replace(/^.*ERROR:\s*/, '')}}); } }
    return JSON.stringify({data:'x', error:null}); });

  await p.exposeFunction('__fn', s => JSON.stringify({data:{ok:true}, error:null}));
  const conta = sql => psql(sql).trim();
  const esp = COMO ? psql("select id from public.espacos where dono_id = '" + eu + "' and pessoal limit 1").trim() : '';
  await p.addInitScript(([id, e]) => { window.__eu = id; window.__esp = e || null; }, [eu, esp]);
  await p.route('**/supabase-js@*/**', r => r.fulfill({ contentType: 'text/javascript', body: FALSO.replace("if (/^(ia_|admin_ia_|admin_usuarios|infra_)/.test(fn))", "if (/^(ia_|admin_ia_|admin_usuarios|infra_)/.test(fn))") }));
  await p.goto('file://' + process.cwd() + '/vercel/index.html'); await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelector('[data-tela="operacoes"]').click()); await p.waitForTimeout(500);

  const F = process.env.FOTOS ? process.env.FOTOS + '/' : '';
  const cli = conta("select n.id from nos n where n.tipo = 'cliente' and exists (select 1 from nos_ancestrais a join nos x on x.id = a.no_id and x.tipo = 'aplicacao' where a.ancestral_id = n.id) order by n.nome limit 1");
  const app = conta("select a.no_id from nos_ancestrais a join nos x on x.id = a.no_id and x.tipo = 'aplicacao' where a.ancestral_id = '" + cli + "' order by x.nome limit 1");
  const ir = async (sel, aba) => { await p.evaluate(([s, a]) => { const U = window.__tf.UI; U.sel = s; U.view = 'inventario'; if (a) window.__tf.INV.aba = a; window.__tf.INV.lido = false; window.__tf.rOperacoes(); }, [sel, aba]); await p.waitForTimeout(3500); };
  const aba = async a => { await p.click('[data-inv-aba="' + a + '"]'); await p.waitForTimeout(300); };
  const gravar = async () => { await p.evaluate(() => [...document.querySelectorAll('dialog.modal[open]')].pop().querySelector('.modal-rod .btn:not(.sec)').click()); await p.waitForTimeout(3500); };
  const aberta = () => p.evaluate(() => !!document.querySelector('dialog.inv-modal[open]'));
  await ir('client:' + cli, 'painel');
  ok(await p.evaluate(() => !!document.querySelector('.view-b[data-view="inventario"]') && /Inventário de/.test(document.querySelector('.inv-tela').textContent)), 'o cliente tem a aba Inventário');
  ok(+conta("select count(*) from inv_categorias where cliente_id = '" + cli + "'") >= 20, 'ao abrir, o cliente ganha as categorias de começo');
  // local
  await aba('locais'); await p.click('[data-inv-novo-local]'); await p.waitForTimeout(300); await p.fill('#il-nome', 'Almoxarifado'); await p.selectOption('#il-tp', 'almoxarifado'); await gravar();
  ok(conta("select nome || ':' || tipo from inv_locais where cliente_id = '" + cli + "'") === 'Almoxarifado:almoxarifado', 'cadastra o local');
  // funcionário (CPF conferido)
  await aba('funcionarios'); await p.click('[data-inv-novo-func]'); await p.waitForTimeout(300);
  await p.fill('#if-nome', 'João Silva'); await p.fill('#if-cpf', '123.456.789-00'); await p.fill('#if-tel', '(11) 99999-0000'); await p.fill('#if-cargo', 'Analista'); await p.fill('#if-dep', 'Financeiro');
  await p.check('[data-if-app="' + app + '"]'); await gravar();
  ok(conta("select count(*) from inv_funcionarios") === '0' && await aberta(), 'CPF inválido não grava (a janela fica aberta)');
  await p.fill('#if-cpf', '529.982.247-25'); await gravar();
  ok(conta("select nome || '|' || cpf || '|' || cargo || '|' || departamento from inv_funcionarios") === 'João Silva|52998224725|Analista|Financeiro', 'cadastra o funcionário (nome, CPF, telefone, cargo, departamento)');
  ok(conta("select count(*) from inv_funcionarios_apps where no_id = '" + app + "'") === '1', 'e marca a aplicação que ele usa');
  ok(await p.evaluate(() => /\*\*\*\.982\.247-\*\*/.test(document.querySelector('.inv-tela').textContent)), 'o CPF aparece mascarado na lista');
  // equipamentos: 3 iguais, com patrimônio em sequência
  await aba('equipamentos'); await p.click('.inv-acoes-topo [data-inv-novo-ativo]'); await p.waitForTimeout(400);
  const catNote = conta("select id from inv_categorias where cliente_id = '" + cli + "' and nome = 'Notebook'");
  await p.selectOption('#ia-cat', catNote); await p.fill('#ia-fab', 'Dell'); await p.fill('#ia-modn', 'Latitude 5440'); await p.fill('#ia-pat', 'PAT-0001'); await p.fill('#ia-serie', 'SN1');
  await p.fill('#ia-copias', '3'); await p.selectOption('#ia-local', {label:'Almoxarifado'}); await p.fill('#ia-dcompra', '2024-01-10'); await p.fill('#ia-vcompra', '5000'); await p.fill('#ia-gar', new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10));
  if (F) await p.screenshot({path:F + 'inv_cadastro.png'});
  await gravar();
  ok(conta("select string_agg(patrimonio || ':' || numero_serie || ':' || situacao, ',' order by patrimonio) from inv_ativos") === 'PAT-0001:SN1:estoque,PAT-0002::estoque,PAT-0003::estoque', 'cadastra 3 iguais, com o patrimônio em sequência (a série só no primeiro)');
  ok(conta("select count(*) from inv_modelos where modelo = 'Latitude 5440'") === '1' && conta("select count(*) from inv_movimentos where tipo = 'cadastro'") === '3', 'cria o modelo novo e o histórico já começa no cadastro');
  const pat = n => conta("select id from inv_ativos where patrimonio = 'PAT-000" + n + "'");
  // entregar ao funcionário, com termo
  await p.evaluate(id => window.__tf.invFichaAtivo(id), pat(1)); await p.waitForTimeout(400);
  await p.click('dialog.inv-modal[open] [data-inv-mov="entrega"]'); await p.waitForTimeout(400);
  await p.selectOption('#im-func', {label:'João Silva · Financeiro'}); await p.fill('#im-motivo', 'Admissão'); await gravar();
  ok(conta("select a.situacao || '|' || f.nome from inv_ativos a join inv_funcionarios f on f.id = a.funcionario_id where a.patrimonio = 'PAT-0001'") === 'uso_funcionario|João Silva', 'entregar: o equipamento fica em uso pelo funcionário');
  ok(conta("select count(*) from inv_termos t join inv_movimentos m on m.termo_id = t.id where t.tipo = 'entrega'") === '1' && await p.evaluate(() => /Termo de responsabilidade/.test(window.__ultimaImpressao || '') && /529\.982\.247-25/.test(window.__ultimaImpressao) && /PAT-0001/.test(window.__ultimaImpressao)), 'gera o termo de responsabilidade, com o CPF e o patrimônio, ligado à movimentação');
  // usar em aplicação e desfazer
  await p.evaluate(() => { document.querySelectorAll('dialog[open]').forEach(d => { d.close(); d.remove(); }); });
  await p.evaluate(id => window.__tf.invFichaAtivo(id), pat(2)); await p.waitForTimeout(400);
  await p.click('dialog.inv-modal[open] [data-inv-mov="uso_aplicacao"]'); await p.waitForTimeout(400); await p.selectOption('#im-app', app); await gravar();
  ok(conta("select situacao || '|' || aplicacao_id from inv_ativos where patrimonio = 'PAT-0002'") === 'uso_aplicacao|' + app, 'em uso por uma aplicação do cliente');
  await p.click('dialog.inv-modal[open] [data-inv-mov="transferencia"]'); await p.waitForTimeout(400); await p.selectOption('#im-local', {label:'Almoxarifado'}); await gravar();
  await p.click('dialog.inv-modal[open] [data-inv-desfazer]'); await p.waitForTimeout(300); await p.fill('#id-motivo', 'Errei'); await gravar();
  ok(conta("select string_agg(tipo, ',' order by em) from inv_movimentos m join inv_ativos a on a.id = m.ativo_id where a.patrimonio = 'PAT-0002'") === 'cadastro,uso_aplicacao,transferencia,estorno', 'desfazer a última grava um estorno (o histórico guarda tudo)');
  await p.evaluate(() => { document.querySelectorAll('dialog[open]').forEach(d => { d.close(); d.remove(); }); });
  // a aplicação vê o que usa
  await ir('app:' + app);
  ok(await p.evaluate(() => { const t = document.querySelector('.inv-tela').textContent; return /Em uso pela aplicação/.test(t) && /PAT-0002/.test(t) && /João Silva/.test(t) && /PAT-0001/.test(t); }), 'na aplicação: o equipamento dela e o do funcionário que a usa');
  await ir('client:' + cli, 'estoque');
  // estoque por quantidade
  await p.click('.inv-acoes-topo [data-inv-novo-item]'); await p.waitForTimeout(300); await p.fill('#it-nome', 'Cabo HDMI 2m'); await p.selectOption('#it-cat', {label:'Cabo'}); await p.fill('#it-min', '10'); await gravar();
  const cabo = conta("select id from inv_itens where nome = 'Cabo HDMI 2m'");
  await p.click('[data-inv-estoque="' + cabo + '"][data-inv-tipo="entrada"]'); await p.waitForTimeout(300); await p.selectOption('#ie-local', {label:'Almoxarifado'}); await p.fill('#ie-q', '30'); await gravar();
  await p.click('[data-inv-estoque="' + cabo + '"][data-inv-tipo="saida"]'); await p.waitForTimeout(300); await p.selectOption('#ie-local', {label:'Almoxarifado'}); await p.fill('#ie-q', '4'); await p.selectOption('#ie-func', {label:'João Silva · Financeiro'}); await gravar();
  ok(conta("select quantidade::int from inv_saldos where item_id = '" + cabo + "'") === '26', 'estoque: entrada 30, saída 4 para o funcionário = 26');
  // licença
  await aba('licencas'); await p.click('[data-inv-nova-lic]'); await p.waitForTimeout(300); await p.fill('#ic2-nome', 'Microsoft 365'); await p.fill('#ic2-q', '2'); await p.fill('#ic2-val', '60'); await gravar();
  const lic = conta("select id from inv_licencas where nome = 'Microsoft 365'");
  await p.click('[data-inv-lic-uso="' + lic + '"]'); await p.waitForTimeout(300); await p.selectOption('#iu-func', {label:'João Silva · Financeiro'}); await gravar();
  ok(conta("select count(*) from inv_licencas_uso where licenca_id = '" + lic + "'") === '1' && await p.evaluate(() => /1 de 2/.test(document.querySelector('.inv-tela').textContent)), 'licença: 1 de 2 em uso');
  // importar planilha (com erro, depois certa)
  await aba('planilha');
  const csv = c => ({name:'eq.csv', mimeType:'text/csv', buffer:Buffer.from(c)});
  await p.setInputFiles('[data-inv-importar="equipamentos"]', csv('patrimonio;serie;categoria;modelo;fabricante;local;funcionario;data_compra;valor_compra\nPAT-0100;S100;Monitor;P2422H;Dell;Sala 2;João Silva;10/02/2025;1.200,50\nPAT-0001;S101;Teclado;;;;;;\nPAT-0102;S102;Gelatina;;;;;;'));
  await p.waitForTimeout(700);
  ok(await p.evaluate(() => { const t = document.querySelector('.inv-previa').textContent; return /2 com erro/.test(t) && /PAT-0001 já existe/.test(t) && /Gelatina/.test(t) && !document.querySelector('[data-inv-importar-ok]'); }), 'prévia da planilha mostra os erros (patrimônio repetido, categoria que não existe) e não deixa importar');
  await p.setInputFiles('[data-inv-importar="equipamentos"]', csv('patrimonio;serie;categoria;modelo;fabricante;local;funcionario;data_compra;valor_compra\nPAT-0100;S100;Monitor;P2422H;Dell;Sala 2;João Silva;10/02/2025;1.200,50\nPAT-0101;S101;Teclado;;;;;;'));
  await p.waitForTimeout(700); await p.click('[data-inv-importar-ok]'); await p.waitForTimeout(4500);
  ok(conta("select a.situacao || '|' || l.nome || '|' || f.nome || '|' || a.valor_compra || '|' || a.data_compra from inv_ativos a join inv_locais l on l.id = a.local_id join inv_funcionarios f on f.id = a.funcionario_id where a.patrimonio = 'PAT-0100'") === 'uso_funcionario|Sala 2|João Silva|1200.50|2025-02-10', 'importa: cria o local que faltava, liga ao funcionário, lê valor e data do jeito brasileiro');
  ok(conta("select count(*) from inv_ativos where patrimonio = 'PAT-0101' and situacao = 'estoque'") === '1', 'e o outro entra em estoque');
  // etiquetas
  await ir('client:' + cli, 'equipamentos');
  await p.check('[data-inv-sel="' + pat(3) + '"]'); await p.click('[data-inv-etiquetas]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => /<svg/.test(window.__ultimaImpressao || '') && /PAT-0003/.test(window.__ultimaImpressao)), 'etiqueta com QR code e o patrimônio');
  // conferência
  await aba('conferencia'); await p.click('[data-inv-nova-conf]'); await p.waitForTimeout(300); await gravar();
  await p.fill('[data-inv-codigo]', 'pat-0003'); await p.press('[data-inv-codigo]', 'Enter'); await p.waitForTimeout(3500);
  ok(conta("select count(*) from inv_conferencias_itens where achado") === '1' && conta("select (proxima_conferencia > current_date)::text from inv_ativos where patrimonio = 'PAT-0003'") === 'true', 'conferir pelo patrimônio (sem diferença de maiúscula) marca achado e a próxima conferência');
  await p.click('[data-inv-concluir-conf]'); await p.waitForTimeout(300); await p.check('#cc-perdidos'); await gravar(); await p.waitForTimeout(1500);
  ok(conta("select string_agg(patrimonio, ',' order by patrimonio) from inv_ativos where situacao = 'perdido'") === 'PAT-0002,PAT-0101', 'concluir: os que faltaram viram perdidos (o que está com o funcionário não é esperado no local)');
  // desligar o funcionário: aviso do que ficou com ele
  await p.evaluate(() => window.__tf.INV.aba = 'painel'); await p.evaluate(f => { const B = window.__tf; }, null);
  psql("update inv_funcionarios set situacao = 'desligado', desligado_em = current_date");
  await ir('client:' + cli, 'painel');
  ok(await p.evaluate(() => /Com funcionário desligado: PAT-0001/.test(document.querySelector('.inv-tela').textContent) && /Garantia vence em/.test(document.querySelector('.inv-tela').textContent)), 'painel avisa: equipamento com funcionário desligado e garantia vencendo');
  if (F) await p.screenshot({path:F + 'inv_painel.png', fullPage:true});
  ok(await p.evaluate(c => /Inventário de TI/.test(window.__tf.invCustosHTML('client:' + c)), cli), 'a aba Custos mostra o valor do inventário do cliente');
  ok(await p.evaluate(() => window.__tf.invLinhasCsv('equipamentos').length >= 5 && window.__tf.invLinhasCsv('historico').length > 8), 'baixar planilha dos equipamentos e do histórico');
  ok(!erros.length, 'sem erro na página' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})();
