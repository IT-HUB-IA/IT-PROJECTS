// Aba Servidores (parte 47): cadastrar a VPS, onde se aplica, o que roda, custos e divisão, e as ligações com Custos,
// Ficha técnica e a frente Infraestrutura. Rodar de fonte/: node ../testes/t_servidores.js (banco local com a parte 47).
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
  from:q, async rpc(fn, args){ if (/^(ia_|admin_ia_|admin_usuarios|infra_|analise_|servidores_)/.test(fn)) return JSON.parse(await window.__rpc(JSON.stringify({fn, args:args || {}}))); if (fn === 'sou_dono_sistema') return {data:true, error:null}; if (/^admin_/.test(fn)) return {data:fn === 'admin_resumo' ? {gerado_em:new Date().toISOString()} : [], error:null}; if (fn !== 'vincular_meu_login') return {data:null, error:null}; return {data:[{pessoa_id:window.__eu, nome:'William', papel:'master', numero:100001, espaco_id:window.__esp || null}], error:null}; } }; } };`;
(async () => {
  prepararLogin();
  const eu = COMO ? 'd148fdc5-eef3-5398-bf89-f49b55b5cd28' : psql("select id from public.pessoas where papel='master' order by nome limit 1").trim();
  const b = await chromium.launch(); const erros = []; let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', e => { erros.push(e.message); console.log('PAGEERROR', e.stack.split('\n').slice(0,4).join(' | ')); });
  await p.exposeFunction('__bd', s => JSON.stringify(executar(JSON.parse(s))));
  const rpcs = [];
  // analise_marcar roda de verdade no banco local, como o usuário logado
  await p.exposeFunction('__rpc', s => { const {fn, args} = JSON.parse(s); rpcs.push(fn);
    if (fn === 'analise_inventario_ligar'){ try { return JSON.stringify({data:+psql(COMO + "select public.analise_inventario_ligar($j$" + JSON.stringify(args.p_pares) + "$j$::jsonb)").trim(), error:null}); } catch (e) { return JSON.stringify({data:null, error:{message:String(e.stderr || e.message).slice(0, 200)}}); } }
    if (fn === 'analise_marcar'){ const v = x => x == null ? 'null' : "'" + String(x).replace(/'/g, "''") + "'"; try { const r = psql(COMO + "select row_to_json(public.analise_marcar(" + v(args.p_id) + "::uuid, " + v(args.p_status) + "::text, " + v(args.p_motivo) + "::text, " + v(args.p_item) + "::uuid))").trim(); return JSON.stringify({data:JSON.parse(r), error:null}); }
      catch (e) { return JSON.stringify({data:null, error:{message:String(e.stderr || e.message).split('\n').find(l => /ERROR/.test(l)) || 'erro'}}); } }
    if (fn === 'servidores_lancar'){ try { return JSON.stringify({data:+psql(COMO + "select public.servidores_lancar('" + args.p_servidor + "'::uuid)").trim(), error:null}); } catch (e) { return JSON.stringify({data:null, error:{message:String(e.stderr || e.message).slice(0, 200)}}); } }
    return JSON.stringify({data:'x', error:null}); });

  await p.exposeFunction('__fn', s => JSON.stringify({data:{ok:true}, error:null}));
  const conta = sql => psql(sql).trim();
  const esp = COMO ? psql("select id from public.espacos where dono_id = '" + eu + "' and pessoal limit 1").trim() : '';
  await p.addInitScript(([id, e]) => { window.__eu = id; window.__esp = e || null; }, [eu, esp]);
  await p.route('**/supabase-js@*/**', r => r.fulfill({ contentType: 'text/javascript', body: FALSO.replace("if (/^(ia_|admin_ia_|admin_usuarios|infra_)/.test(fn))", "if (/^(ia_|admin_ia_|admin_usuarios|infra_|servidores_)/.test(fn))") }));
  await p.goto('file://' + process.cwd() + '/vercel/index.html'); await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelector('[data-tela="operacoes"]').click()); await p.waitForTimeout(500);

  const F = process.env.FOTOS ? process.env.FOTOS + '/' : '';
  // um projeto com duas ou mais aplicações
  const proj = conta("select p.id from nos p join nos_ancestrais a on a.ancestral_id = p.id join nos n on n.id = a.no_id and n.tipo = 'aplicacao' where p.tipo = 'projeto' group by p.id having count(*) >= 2 order by p.id limit 1");
  const apps = conta("select string_agg(n.id::text, ',' order by n.nome) from nos_ancestrais a join nos n on n.id = a.no_id and n.tipo = 'aplicacao' where a.ancestral_id = '" + proj + "'").split(',');
  ok(!!proj && apps.length >= 2, 'achou um projeto com ' + apps.length + ' aplicações');
  const ir = async (sel, view) => { await p.evaluate(([s, v]) => { const U = window.__tf.UI; U.sel = s; U.view = v; window.__tf.SRV.lido = false; window.__tf.rOperacoes(); }, [sel, view]); await p.waitForTimeout(2000); };
  await ir('project:' + proj, 'servidores');
  ok(await p.evaluate(() => !!document.querySelector('.view-b[data-view="servidores"]') && /Nenhum servidor/.test(document.querySelector('.sv-tela').textContent)), 'o projeto tem a aba Servidores, ainda vazia');
  // cadastrar a VPS do projeto inteiro
  await p.click('[data-sv-novo]'); await p.waitForTimeout(300);
  await p.fill('#sv-nome', 'VPS produção BL'); await p.fill('#sv-prov', 'Hostinger'); await p.fill('#sv-plano', 'KVM 4'); await p.fill('#sv-so', 'Ubuntu 24.04');
  await p.fill('#sv-cpu', '4'); await p.fill('#sv-mem', '16'); await p.fill('#sv-disco', '200'); await p.selectOption('#sv-dt', 'nvme'); await p.fill('#sv-host', 'srv1.bl.com.br'); await p.fill('#sv-ip', '177.10.20.30');
  await p.fill('#sv-acesso', 'senha: abc123');
  // cascata: o projeto aberto já vem marcado com todas as aplicações; desmarcar uma desmarca o projeto; marcar o projeto marca tudo
  const marcadas = () => p.evaluate(() => [...document.querySelectorAll('[data-sv-no]')].filter(c => c.checked).map(c => c.dataset.svNo));
  ok(await marcadas().then(m => m.includes(proj) && apps.every(a => m.includes(a))), 'cadastrar no projeto já marca o projeto e tudo o que está dentro');
  await p.click('[data-sv-no="' + apps[0] + '"]'); ok(!(await marcadas()).includes(proj) && !(await marcadas()).includes(apps[0]), 'desmarcar uma aplicação desmarca o projeto (ele não vale mais para tudo)');
  await p.click('[data-sv-no="' + proj + '"]'); ok(await marcadas().then(m => m.includes(proj) && apps.every(a => m.includes(a))), 'marcar o projeto marca de novo todas as aplicações');
  ok(await p.evaluate(() => !document.querySelector('#sv-renova') && !!document.querySelector('#sv-valor') && !document.querySelectorAll('[data-sv-custo]').length && !document.querySelector('[data-sv-custo] [data-k="inicio"]')), 'o contrato tem o valor do plano, sem repetir o nome do plano nem a data (a renovação é calculada)');
  await p.fill('#sv-valor', '100'); ok(await p.evaluate(() => /Próxima renovação/.test(document.querySelector('#sv-prox').textContent)), 'a próxima renovação aparece calculada pela recorrência'); await p.click('[data-sv-mais-custo]');
  const custos = await p.$$('[data-sv-custo]');
  ok(custos.length === 1, 'custo extra com só o que é dele (o quê, valor, recorrência)');
  await (await custos[0].$('[data-k="descricao"]')).fill('Backup anual'); await (await custos[0].$('[data-k="valor"]')).fill('240'); await (await custos[0].$('[data-k="recorrencia"]')).selectOption('anual');
  await p.click('[data-sv-mais-serv]'); const sv1 = await p.$('[data-sv-serv]');
  await (await sv1.$('[data-k="nome"]')).fill('API Java'); await (await sv1.$('[data-k="tipo"]')).selectOption('api'); await (await sv1.$('[data-k="tecnologia"]')).fill('Java 21'); await (await sv1.$('[data-k="porta"]')).fill('8080'); await (await sv1.$('[data-k="no_id"]')).selectOption(apps[0]);
  const salvarModal = async () => { await p.evaluate(() => [...document.querySelectorAll('dialog.modal[open] .modal-rod .btn')].pop().click()); await p.waitForTimeout(2500); };
  if (F) await p.screenshot({path:F + 'sv_cadastro.png', fullPage:false});
  await salvarModal();
  ok(conta("select count(*) from servidores") === '0' && await p.evaluate(() => !!document.querySelector('dialog.sv-modal[open]')), 'senha escrita em "Onde fica o acesso" não grava (só onde ela está guardada)');
  await p.fill('#sv-acesso', 'cofre 1Password, item VPS BL'); await salvarModal();
  ok(conta("select nome || '|' || provedor || '|' || cpu || '|' || memoria_gb::int || '|' || disco_tipo || '|' || acesso_onde from servidores") === 'VPS produção BL|Hostinger|4|16|nvme|cofre 1Password, item VPS BL', 'cadastra a máquina: provedor, CPU, memória, disco e onde fica o acesso');
  ok(conta("select count(*) from servidores_alcance where no_id = '" + proj + "'") === '1' && apps.every(a => conta("select count(*) from servidores_alcance where no_id = '" + a + "'") === '1'), 'onde se aplica: o projeto e cada aplicação de dentro');
  ok(conta("select count(*) || '|' || string_agg(distinct descricao, ',' order by descricao) from servidores_lancamentos") === '2|Backup anual,Plano KVM 4', 'salvar já gera o lançamento do período de cada custo');
  ok(conta("select string_agg(nome || ':' || tipo || ':' || porta || ':' || no_id, ',') from servidores_servicos") === 'API Java:api:8080:' + apps[0], 'o que roda nela, com a aplicação que o serviço atende');
  ok(conta("select string_agg(descricao || ':' || valor::int || ':' || recorrencia, ',' order by descricao) from servidores_custos") === 'Backup anual:240:anual,Plano KVM 4:100:mensal', 'os custos, mensal e anual');
  ok(await p.evaluate(() => /R\$\s?120,00 por mês/.test(document.querySelector('.sv-card').textContent)), 'custo mensal: 100 por mês mais 240 por ano (20 por mês) = 120');
  // cada aplicação do projeto vê a VPS herdada e a parte dela no custo (por igual)
  await ir('app:' + apps[0], 'servidores');
  const parte = (120 / apps.length).toFixed(2).replace('.', ',');
  ok(await p.evaluate(pt => { const t = document.querySelector('.sv-tela').textContent; return /Aplicado aqui/.test(t) && t.includes(pt); }, parte), 'a aplicação vê a VPS do projeto (marcada nela pela cascata) e a parte dela no custo (' + parte + ' por mês)');
  // uma segunda máquina só para uma aplicação, com divisão por peso não muda nada para as outras
  await p.click('[data-sv-novo]'); await p.waitForTimeout(300);
  await p.fill('#sv-nome', 'Banco MySQL dedicado'); await p.selectOption('#sv-tipo', 'dedicado'); await p.fill('#sv-desde', new Date(Date.now() - 65 * 86400000).toISOString().slice(0, 10));
  await p.fill('#sv-valor', '300');
  await salvarModal();
  ok(conta("select string_agg(a.no_id::text, ',') from servidores_alcance a join servidores s on s.id = a.servidor_id where s.nome = 'Banco MySQL dedicado'") === apps[0], 'a máquina cadastrada dentro da aplicação vale só para ela');
  ok(await p.evaluate(() => document.querySelectorAll('.sv-card').length === 2), 'a aplicação vê as duas máquinas');
  if (F) await p.screenshot({path:F + 'sv_tela.png', fullPage:true});
  await ir('app:' + apps[1], 'servidores');
  ok(await p.evaluate(() => document.querySelectorAll('.sv-card').length === 1), 'a outra aplicação vê só a VPS do projeto');
  ok(await p.evaluate(a => Math.round(window.__tf.svParte(window.__tf.SRV.lista.find(s => s.nome === 'Banco MySQL dedicado'), 'project:' + a)) === 300, proj), 'no projeto, a parte da máquina dedicada é inteira');
  // ligações: Custos e Ficha técnica
  ok(await p.evaluate(a => /Servidores/.test(window.__tf.svCustosHTML('app:' + a)) && /VPS produção BL/.test(window.__tf.svCustosHTML('app:' + a)), apps[0]), 'a aba Custos mostra os servidores e a parte deste ponto');
  ok(await p.evaluate(a => /Produção:.*VPS produção BL/.test(window.__tf.svFichaLigacao('Environments', 'app:' + a)) && /roda: API Java/.test(window.__tf.svFichaLigacao('Environments', 'app:' + a)), apps[0]), 'a Ficha técnica (Ambientes) mostra a VPS e o que roda nela');
  // renovação chegando: vira item na frente Infraestrutura
  await ir('project:' + proj, 'servidores');
  await p.click('[data-sv-renovar="' + conta("select id from servidores where nome = 'VPS produção BL'") + '"]'); await p.waitForTimeout(3000);
  ok(conta("select f.nome || '|' || i.tipo || '|' || (i.prazo is not null) from itens i join nos f on f.id = i.frente_id where i.titulo like 'Renovar o servidor VPS produção BL%'") === 'Infraestrutura|task|true', 'a renovação vira item na frente Infraestrutura, com prazo na data da renovação');
  // editar: troca para divisão por peso
  const vps = conta("select id from servidores where nome = 'VPS produção BL'");
  await p.click('[data-sv-editar="' + vps + '"]'); await p.waitForTimeout(300); await p.selectOption('#sv-rateio', 'peso'); await p.fill('#sv-plano', 'KVM 8'); await salvarModal();
  ok(conta("select plano || '|' || rateio from servidores where nome = 'VPS produção BL'") === 'KVM 8|peso' && conta("select count(*) from servidores_servicos") === '1' && conta("select count(*) from servidores_custos s join servidores v on v.id = s.servidor_id where v.nome = 'VPS produção BL'") === '2', 'editar grava e mantém o que roda e os custos');
  const idsAntes = conta("select string_agg(c.id::text, ',' order by c.id) from servidores_custos c where c.servidor_id = '" + vps + "'");
  // divisão por percentual: 60% para uma, o resto por igual nas outras, com a conta do que falta na hora
  await p.click('[data-sv-editar="' + vps + '"]'); await p.waitForTimeout(300); await p.selectOption('#sv-rateio', 'percentual');
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.sv-in-pct')).display !== 'none' && getComputedStyle(document.querySelector('.sv-in-peso')).display === 'none'), 'por percentual: aparece o campo de % de cada aplicação');
  await p.fill('[data-sv-pct="' + apps[0] + '"]', '60');
  ok(await p.evaluate(() => /Restando:\s*R\$\s?48,00 \(40%\)/.test(document.querySelector('[data-sv-resumo]').textContent)), 'a conta mostra o que falta: 40% de 120 = 48 por mês');
  ok(await p.evaluate(a => /72,00 \(60%\)/.test(document.querySelector('[data-sv-calc="' + a + '"]').textContent), apps[0]), 'cada aplicação mostra quanto paga (60% = 72 por mês)');
  await p.click('[data-sv-igualar]');
  ok(await p.evaluate(() => /Restando:\s*R\$\s?0,00/.test(document.querySelector('[data-sv-resumo]').textContent)), '"Dividir o que falta por igual" fecha 100%');
  await p.selectOption('#sv-rateio', 'valor'); await p.fill('[data-sv-val="' + apps[0] + '"]', '30');
  ok(await p.evaluate(() => /Restando:\s*R\$\s?90,00/.test(document.querySelector('[data-sv-resumo]').textContent)), 'por valor: 30 de 120 deixa 90 restando');
  await p.selectOption('#sv-rateio', 'percentual');
  // um custo extra trimestral: pega a moeda e a cobrança do contrato e começa hoje
  await p.click('[data-sv-mais-custo]'); const c3 = (await p.$$('[data-sv-custo]')).pop();
  await (await c3.$('[data-k="descricao"]')).fill('Licença painel'); await (await c3.$('[data-k="valor"]')).fill('90'); await (await c3.$('[data-k="recorrencia"]')).selectOption('trimestral');
  if (F) await p.screenshot({path:F + 'sv_rateio.png', fullPage:false});
  if (F){ await p.evaluate(() => document.querySelector('[data-sv-resumo]').scrollIntoView({block:'end'})); await p.screenshot({path:F + 'sv_rateio2.png', fullPage:false}); }
  await salvarModal();
  ok(conta("select rateio from servidores where id = '" + vps + "'") === 'percentual' && conta("select sum(percentual)::int from servidores_alcance where servidor_id = '" + vps + "'") === '100' && conta("select percentual::int from servidores_alcance where servidor_id = '" + vps + "' and no_id = '" + apps[0] + "'") === '60', 'grava o percentual de cada aplicação (fecha 100%)');
  ok(conta("select string_agg(c.id::text, ',' order by c.id) from servidores_custos c where c.servidor_id = '" + vps + "' and descricao <> 'Licença painel'") === idsAntes, 'editar mantém os custos (os lançamentos continuam ligados a eles)');
  ok(conta("select descricao || '|' || principal from servidores_custos where servidor_id = '" + vps + "' and principal") === 'Plano KVM 8|true', 'o custo do plano leva o nome do plano do cadastro (sem digitar de novo)');
  ok(conta("select recorrencia || '|' || moeda || '|' || (inicio = current_date) || '|' || coalesce(fim::text, 'sem fim') from servidores_custos where descricao = 'Licença painel'") === 'trimestral|BRL|true|sem fim' && conta("select count(*) from servidores_lancamentos where descricao = 'Licença painel'") === '1', 'extra trimestral: começa hoje, renova até cancelar e já tem o 1º lançamento');
  ok(await p.evaluate(v => /renova até cancelar/.test(document.querySelector('.sv-card[data-sv="' + v + '"]').textContent) && /Divisão \(por percentual\)/.test(document.querySelector('.sv-card[data-sv="' + v + '"]').textContent), vps), 'o cartão diz o que renova até cancelar e a divisão por percentual');
  ok(await p.evaluate(v => /R\$\s?150,00 por mês/.test(document.querySelector('.sv-card[data-sv="' + v + '"]').textContent), vps), 'custo mensal com o trimestral: 100 + 20 + 30 = 150');
  // a máquina dedicada contratada há uns 2 meses: 3 lançamentos mensais
  ok(conta("select count(*) from servidores_lancamentos l join servidores s on s.id = l.servidor_id where s.nome = 'Banco MySQL dedicado'") === '3', 'contrato com data no passado lança cada mês desde a contratação (3)');
  // cancelar um custo que renova: para de cobrar hoje
  const plano = conta("select id from servidores_custos where servidor_id = '" + vps + "' and principal");
  await p.click('[data-sv-cancelar="' + plano + '"]'); await p.waitForTimeout(300); await salvarModal();
  ok(conta("select fim = current_date from servidores_custos where id = '" + plano + "'") === 't' && conta("select count(*) from servidores_lancamentos where custo_id = '" + plano + "'") === '1', 'cancelar para de cobrar hoje e o lançamento que já foi fica');
  // o contrato para numa data: os extras param junto
  const fim3 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  await p.click('[data-sv-editar="' + vps + '"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelector('#sv-ate').value === 'data' && !document.querySelector('#sv-fim-lb').hidden), 'o contrato cancelado abre como "Para numa data"');
  await p.fill('#sv-fim', fim3); await salvarModal();
  ok(conta("select string_agg(distinct coalesce(fim::text, '-'), ',') from servidores_custos where servidor_id = '" + vps + "' and recorrencia <> 'unico'") === fim3, 'para numa data: o plano e os extras param de cobrar no mesmo dia');
  ok(await p.evaluate(v => /para de cobrar em/.test(document.querySelector('.sv-card[data-sv="' + v + '"]').textContent), vps), 'o cartão mostra a data em que para de cobrar');
  ok(await p.evaluate(() => window.__tf.svPeriodos({inicio:'2026-01-31', recorrencia:'mensal', fim:'2026-04-30'}).join(',') === '2026-01-31,2026-02-28,2026-03-31,2026-04-30' && window.__tf.svPeriodos({inicio:'2025-01-10', recorrencia:'semestral', fim:'2026-02-01'}).length === 3), 'períodos: fim de mês e semestral contados certo');
  // excluir
  await p.click('[data-sv-apagar="' + vps + '"]'); await p.waitForTimeout(300); await salvarModal();
  ok(conta("select count(*) from servidores where nome = 'VPS produção BL'") === '0' && conta("select count(*) from servidores_custos") === '1' && conta("select count(*) from servidores_lancamentos l where not exists (select 1 from servidores s where s.id = l.servidor_id)") === '0', 'excluir tira a máquina com tudo o que é dela');
  // divisão por peso: 3 para uma aplicação e 1 para a outra = 75% e 25%
  ok(await p.evaluate(([a0, a1]) => { const S = window.__tf.SRV; const s = {id:'peso-teste', rateio:'peso'}; S.alcance.push({servidor_id:'peso-teste', no_id:a0, peso:3}, {servidor_id:'peso-teste', no_id:a1, peso:1});
    const d = window.__tf.svDivisao(s); S.alcance = S.alcance.filter(x => x.servidor_id !== 'peso-teste');
    return d.length === 2 && Math.abs(d.find(x => x.app === a0).fracao - 0.75) < 1e-9 && Math.abs(d.find(x => x.app === a1).fracao - 0.25) < 1e-9; }, [apps[0], apps[1]]), 'divisão por peso: peso 3 e peso 1 dão 75% e 25%');
  ok(!erros.length, 'sem erro na página' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})();
