// Segunda leva do P.O. (parte 53): as 14 melhorias, gravando no banco local de verdade.
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
  await p.goto('file://' + process.cwd() + '/vercel/index.html'); await p.waitForTimeout(3000);
  await p.evaluate(() => document.querySelector('[data-tela="operacoes"]').click()); await p.waitForTimeout(500);
  const F = process.env.FOTOS ? process.env.FOTOS + '/' : '';
  const dorme = ms => p.waitForTimeout(ms);
  // uma aplicação com duas frentes, dentro de um projeto
  const par = conta("select f1.id || '|' || f2.id || '|' || a.id || '|' || pj.id from nos a join nos f1 on f1.pai_id = a.id and f1.tipo = 'frente' join nos f2 on f2.pai_id = a.id and f2.tipo = 'frente' and f2.id > f1.id join nos_ancestrais na on na.no_id = a.id join nos pj on pj.id = na.ancestral_id and pj.tipo = 'projeto' where a.tipo = 'aplicacao' and a.excluido_em is null and f1.excluido_em is null and f2.excluido_em is null order by a.nome limit 1").split('|');
  const [W1, W2, APP, PJ] = par; ok(par.length === 4, 'achou uma aplicação com duas frentes');
  const ids = await p.evaluate(([w1, w2, pj]) => { const T = window.__tf, D = T.D;
    const ni = o => { const i = window.__tf.novoIssue(o); i.ordem = 9000 + D.issues.length; D.issues.push(i); return i; };
    const m = {id:window.__tf.novoUuid(), no:'project:' + pj, tipo:'release', nome:'vL2', data:'2026-10-10', vis:true, entregue:null}; D.marcos.push(m);
    const E = ni({titulo:'Destino da cobrança e quem trata', tipo:'epic', ws:w1, status:'todo', fim:'2026-12-01'});
    const S = ni({titulo:'Guardar o destino da cobrança', tipo:'story', ws:w2, status:'backlog', pai:E.id, fim:'2026-10-15'}); S.marco = m.id; S.pontos = 5;
    const Tt = ni({titulo:'Subtarefa do destino', tipo:'task', ws:w2, status:'backlog', pai:S.id, fim:'2026-10-09'});
    const X = ni({titulo:'BL: marcar o vínculo', tipo:'task', ws:w2, status:'todo', fim:'2026-10-09'}); X.externa = true; X.marco = m.id; X.pontos = 3;
    const Dc = ni({titulo:'Arredondamento dos valores', tipo:'task', ws:w2, status:'todo', fim:'2026-10-09'}); Dc.decisao = true; Dc.desc = 'Arredondar para cima, duas casas.';
    S.links = [{tipo:'Is blocked by', alvo:X.id}, {tipo:'Is blocked by', alvo:Dc.id}];
    const A = ni({titulo:'Item com prazo automático', tipo:'task', ws:w2, status:'backlog'});
    window.__tf.salvar(); return {M:m.id, E:E.id, S:S.id, T:Tt.id, X:X.id, Dc:Dc.id, A:A.id, autoA:A.autoOrigem}; }, [W1, W2, PJ]);
  await dorme(4000);
  ok(conta("select count(*) from itens where id in ('" + [ids.E, ids.S, ids.T, ids.X, ids.Dc, ids.A].join("','") + "')") === '6', 'os itens do teste foram para o banco');
  // 5a: prazo automático tem origem registrada
  ok(ids.autoA && /padrão de 7 dias/.test(ids.autoA.prazo || '') && /padrão de 7 dias/.test(conta("select auto_origem->>'prazo' from itens where id = '" + ids.A + "'")), 'o prazo preenchido sozinho guarda de onde veio');
  ok(/Preenchido automaticamente ao criar/.test(conta("select string_agg(texto, ' ') from itens_historico where item_id = '" + ids.A + "'")), 'o histórico do item mostra o preenchimento automático');
  ok(conta("select count(*) from itens_historico where item_id = '" + ids.S + "' and texto like 'Preenchido automaticamente%'") === '0', 'quem teve prazo escrito não ganha a marca de automático');
  // 1: exportação da frente Database (W2): o item cujo épico é da outra frente aparece dentro do épico, com selo; netos incluídos; sem duplicar
  const md = await p.evaluate(w => window.__tf.exNoMd('ws:' + w), W2);
  const semEp = (md.split('## Itens sem épico')[1] || '').split('\n## ')[0];
  ok(/épico de outra frente/.test(md) && md.includes('Destino da cobrança e quem trata') && !semEp.includes('Guardar o destino da cobrança'), 'exportação da frente: o item do épico de outra frente fica no grupo do épico, com o selo');
  ok(md.includes('Subtarefa do destino') && (md.match(/Guardar o destino da cobrança/g) || []).length <= 3, 'o subitem (neto do épico) aparece e o item não se repete');
  ok(/Itens nesta frente:\*\* \d+ \(\d+ aceitos; 1 é tarefa externa e fica fora dos totais\)/.test(md), 'a contagem diz o que conta (nesta frente, aceitos) e separa a tarefa externa');
  // 1: Lista agrupada por épico
  await p.evaluate(w => { const U = window.__tf.UI; U.sel = 'ws:' + w; U.view = 'list'; U.lv2PorEpico = true; window.__tf.rOperacoes(); }, W2); await dorme(800);
  ok(await p.evaluate(() => /épico de outra frente/.test(document.querySelector('#ops-corpo').textContent) && /Agrupar pela situação/.test(document.querySelector('#ops-corpo').textContent)), 'a Lista agrupa por épico, com o selo do épico de outra frente');
  ok(await p.evaluate(() => /itens na lista nesta frente/.test(document.querySelector('.lv2-conta').textContent)), 'o cabeçalho da Lista diz o que conta');
  if (F) await p.screenshot({path:F + 'lv2_lista.png', fullPage:false});
  // 3: tarefa externa fora do progresso, em linha à parte, e bloqueio por terceiro
  const and = await p.evaluate(m => window.__tf.poAndamentoVersao(window.__tf.D.marcos.find(x => x.id === m)), ids.M);
  ok(and.n === 1 && and.ext === 1 && and.extPts === 3, 'progresso da versão conta só o time; aguardando terceiros: 1 item, 3 pontos');
  ok(await p.evaluate(() => /bloqueado por terceiro/.test(document.querySelector('#ops-corpo').innerHTML)), 'o item que depende da tarefa externa mostra "bloqueado por terceiro"');
  await p.evaluate(() => { window.__tf.UI.filtros.terceiro = true; window.__tf.rView(); }); await dorme(300);
  ok(await p.evaluate(s => [...document.querySelectorAll('#ops-corpo [data-abrir-item]')].map(x => x.dataset.abrirItem).filter(x => x !== s).every(x => document.querySelector('.lv2-ep-tit[data-abrir-item="' + x + '"]')), ids.S), 'o filtro "Bloqueados por terceiro" deixa só os bloqueados');
  await p.evaluate(() => { window.__tf.UI.filtros.terceiro = false; }); 
  // 5b e 5c: avisos no "O que fazer hoje"
  const acoes = await p.evaluate(pj => window.__tf.pgAcoes('project:' + pj).map(a => a.k.split(':')[0]), PJ);
  ok(acoes.includes('tarde') && acoes.includes('terceiro'), 'avisos: prazo depois da entrega da versão e bloqueio por terceiro (' + acoes.filter(a => ['tarde','terceiro','semresp'].includes(a)).join(', ') + ')');
  // 6: Criar em lote com situação
  const r1 = await p.evaluate(w => { window.__tf.UI.sel = 'ws:' + w; const r = window.__tf.ltLer('Cobrança já feita\n- Enviar o aviso de atraso\n  situação: Pronto para testar\n- Outro item\n  situação: Aceito\nsituação: Aceito'); return {erros:r.erros.map(e => e.msg), grupos:r.grupos.map(g => g.titulo), det:r.grupos[0].itens[0].det}; }, W2);
  ok(r1.det.situacao === 'review', 'o Criar em lote aceita "situação: Pronto para testar"');
  ok(r1.erros.filter(m => /Aceito não vale no Criar em lote/.test(m)).length === 2 && !r1.grupos.some(t => /situa/i.test(t || '')), '"situação: Aceito" é recusado (com recuo ou sem), e a linha sem recuo não vira épico');
  const nov = await p.evaluate(([w, det]) => { const x = window.__tf.ltNovo('Enviar o aviso de atraso', w, 'task', 'backlog', null, null); window.__tf.ltAplicar(x, det); window.__tf.salvar(); return {id:x.id, st:x.status, ao:x.autoOrigem}; }, [W2, r1.det]);
  await dorme(3000);
  ok(nov.st === 'review' && /criado já em Pronto para testar, por lote/.test(nov.ao.situacao) && conta("select s.chave from itens i join status_fluxo s on s.id = i.status_id where i.id = '" + nov.id + "'") === 'review', 'o item nasce em Pronto para testar e o banco guarda isso');
  ok(/criado já em Pronto para testar, por lote/.test(conta("select string_agg(texto, ' ') from itens_historico where item_id = '" + nov.id + "'")), 'o histórico registra "criado já nesta situação, por lote"');
  // 7: prévia do Editar em lote com as contas
  const pv = await p.evaluate(([s, x]) => window.__tf.lePreviaHTML({blocos:[{erros:[], alvos:[1, 2], linha:1, ref:'BL-1', sim:[{x:window.__tf.byId('issues', s), mud:[['Prazo', '01/10', '05/10']]}, {x:window.__tf.byId('issues', x), mud:[]}]}], erros:[], avisos:[], afetados:2}), [ids.S, ids.X]);
  ok(/<b>1<\/b> muda/.test(pv) && /<b>1<\/b> não muda/.test(pv) && !/com erro/.test(pv), 'a prévia do Editar em lote mostra quantos mudam, não mudam e dão erro');
  // 8: prova por critério
  await p.evaluate(s => { const S = window.__tf.byId('issues', s); S.crit = [{t:'Grava o destino', f:true}, {t:'Mostra no extrato', f:false}]; window.__tf.salvar(); }, ids.S); await dorme(2500);
  ok(await p.evaluate(s => window.__tf.lv2SemProva(window.__tf.byId('issues', s)).length === 1, ids.S), 'critério marcado sem prova gera aviso (não bloqueio)');
  await p.evaluate(s => window.__tf.abrirItem(s), ids.S); await dorme(800);
  ok(await p.evaluate(() => /marcado sem prova/.test(document.querySelector('#gaveta-wrap').textContent)), 'a janela do item mostra o critério marcado sem prova');
  await p.click('[data-lv2-prova="0"]'); await dorme(300);
  await p.selectOption('#lv2-pr-res', 'passou'); await p.fill('#lv2-pr-txt', 'Teste com 3 cobranças: destino gravado em todas');
  await p.evaluate(() => [...document.querySelectorAll('dialog.modal[open] .modal-rod .btn')].pop().click()); await dorme(3000);
  ok(conta("select prova_resultado || '|' || prova || '|' || (prova_quem is not null) from itens_criterios where item_id = '" + ids.S + "' and texto = 'Grava o destino'") === 'passou|Teste com 3 cobranças: destino gravado em todas|true', 'a prova vai para o banco com resultado e quem testou');
  ok(/prova: passou/.test(conta("select string_agg(texto, ' ') from itens_historico where item_id = '" + ids.S + "' and tipo = 'criterio'")), 'a prova entra no histórico');
  // 10: Dado / Quando / Então
  await p.evaluate(() => { document.querySelector('.lv2-gherkin').open = true; });
  await p.fill('[data-lv2-gk="dado"]', 'uma fatura vencida há 10 dias'); await p.fill('[data-lv2-gk="quando"]', 'a cobrança do dia roda'); await p.fill('[data-lv2-gk="entao"]', 'o cliente recebe o aviso');
  await p.click('[data-lv2-gk-add]'); await dorme(500);
  ok(await p.evaluate(s => window.__tf.byId('issues', s).crit.some(c => c.t === 'Dado uma fatura vencida há 10 dias, quando a cobrança do dia roda, então o cliente recebe o aviso.'), ids.S), 'critério no modelo Dado / Quando / Então');
  if (F) await p.screenshot({path:F + 'lv2_item.png', fullPage:false});
  await p.evaluate(() => window.__tf.fecharItem());
  // 9: decisão fechada; se mudar, os afetados ficam para revisar
  await p.evaluate(d => { const x = window.__tf.byId('issues', d); window.__tf.mudarStatus(x, 'done'); window.__tf.salvar(); }, ids.Dc); await dorme(3000);
  ok(conta("select decisao_texto || '|' || (decisao_em is not null) from itens where id = '" + ids.Dc + "'") === 'Arredondar para cima, duas casas.|true', 'a decisão fechada guarda o texto e quando');
  await p.evaluate(d => { const x = window.__tf.byId('issues', d); x.desc = 'Arredondar para baixo, duas casas.'; window.__tf.salvar(); }, ids.Dc); await dorme(3000);
  ok(/A decisão "Arredondamento dos valores" mudou/.test(conta("select revisar->>'motivo' from itens where id = '" + ids.S + "'")), 'alterar a decisão marca o item afetado para revisar, com o motivo');
  ok(/Marcado para revisar/.test(conta("select string_agg(texto, ' ') from itens_historico where item_id = '" + ids.S + "'")) && /Decisão mudou/.test(conta("select string_agg(texto, ' ') from itens_historico where item_id = '" + ids.Dc + "'")), 'o histórico registra a mudança da decisão e a marca de revisar');
  await p.evaluate(s => window.__tf.abrirItem(s), ids.S); await dorme(800); await p.click('[data-lv2-revisado]'); await dorme(3000);
  ok(conta("select coalesce(revisar::text, 'nada') from itens where id = '" + ids.S + "'") === 'nada' && /Revisado/.test(conta("select string_agg(texto, ' ') from itens_historico where item_id = '" + ids.S + "'")), 'marcar como revisado tira a marca e registra quem revisou');
  await p.evaluate(() => window.__tf.fecharItem());
  // 4: Definição de Pronto por frente, com aviso de repetida
  ok(await p.evaluate(() => window.__tf.lv2Repetidas(['Sem bugs conhecidos', 'Valor em R$ exato com duas casas', 'Sem bugs conhecidos no fluxo'], ['Valor em reais exato com duas casas decimais']).length >= 1), 'linhas repetidas ou muito parecidas são apontadas');
  await p.evaluate(w => { window.__tf.lv2EditarDodFrente(window.__tf.byId('ws', w)); }, W2); await dorme(300);
  await p.fill('#lv2-dod', '- Consulta com índice conferido\n- Consulta com índice conferido');
  await p.evaluate(() => [...document.querySelectorAll('dialog.modal[open] .modal-rod .btn')].pop().click()); await dorme(300);
  ok(await p.evaluate(() => !!document.querySelector('dialog.modal[open] .lv2-dod-aviso')), 'ao guardar, avisa a linha repetida (sem gravar)');
  await p.fill('#lv2-dod', '- Consulta com índice conferido\n- Política de acesso testada com dois usuários');
  await p.evaluate(() => [...document.querySelectorAll('dialog.modal[open] .modal-rod .btn')].pop().click()); await dorme(3000);
  ok(/Política de acesso testada/.test(conta("select definicao_pronto from frentes where no_id = '" + W2 + "'")), 'a Definição de Pronto da frente vai para o banco');
  const mdW = await p.evaluate(w => window.__tf.exNoMd('ws:' + w), W2);
  // 11 e 12: mapa e pirâmide
  await p.evaluate(pj => { const U = window.__tf.UI; U.sel = 'project:' + pj; U.view = 'mapa'; window.__tf.rOperacoes(); }, PJ); await dorme(800);
  ok(await p.evaluate(() => { const t = document.querySelector('#ops-corpo').textContent; return /Mapa de histórias/.test(t) && /vL2/.test(t) && /Destino da cobrança e quem trata/.test(t) && /Pirâmide do backlog/.test(t); }), 'o mapa de histórias mostra versões × épicos e a pirâmide');
  ok(await p.evaluate(s => !!document.querySelector('.lv2-mapa [data-abrir-item="' + s + '"]'), ids.S), 'a história aparece na célula da sua versão e do seu épico');
  if (F) await p.screenshot({path:F + 'lv2_mapa.png', fullPage:false});
  // 13: o que mudou desde
  await p.evaluate(() => { const T = window.__tf; T.LV2.mudouRef = 'dias:1'; T.LV2.hist = null; T.UI.view = 'mudou'; T.rOperacoes(); }); await dorme(2500);
  ok(await p.evaluate(() => { const t = document.querySelector('#ops-corpo').textContent; return /O que mudou desde/.test(t) && /mudanças desde/.test(t) && /Guardar o destino da cobrança/.test(t); }), 'o que mudou desde ontem lista as mudanças dos itens');
  ok(await p.evaluate(s => window.__tf.lv2Mudancas().filter(h => h.item_id === s).length >= 3, ids.S), 'a lista bate com o histórico do item');
  if (F) await p.screenshot({path:F + 'lv2_mudou.png', fullPage:false});
  // as escolhas da tela vão para o banco (pessoas_preferencias.tela)
  await p.selectOption('[data-lv2-mudou="ref"]', 'dias:30'); await dorme(500);
  await p.evaluate(w => { const U = window.__tf.UI; U.sel = 'ws:' + w; U.view = 'list'; U.lv2PorEpico = false; window.__tf.rOperacoes(); }, W2); await dorme(600);
  await p.click('[data-lv2-agrupar]'); await dorme(3500);
  const tela = JSON.parse(conta("select coalesce(tela::text, '{}') from pessoas_preferencias where pessoa_id = '" + eu + "'") || '{}');
  ok(tela.lv2PorEpico === true && tela.lv2Mudou && tela.lv2Mudou.ref === 'dias:30', '"Agrupar por épico" e os filtros do "O que mudou" ficam guardados no banco da pessoa');
  const est = JSON.parse(conta("select coalesce(estado::text, '{}') from pessoas_preferencias where pessoa_id = '" + eu + "'") || '{}');
  await p.evaluate(pj => { const k = window.__tf.pgAcoes('project:' + pj)[0]; if (k) window.__tf.pgSilenciarL2(k.k); }, PJ); await dorme(2500);
  const est2 = JSON.parse(conta("select coalesce(estado::text, '{}') from pessoas_preferencias where pessoa_id = '" + eu + "'") || '{}');
  ok(Object.keys(est2.po_silenciados || {}).length > Object.keys(est.po_silenciados || {}).length, 'silenciar um aviso fica guardado no banco da pessoa (pessoas_preferencias.estado)');
  // 14: épico com todas as frentes e o projeto inteiro
  await p.evaluate(() => window.__tf.LV2 && 0);
  const ep = await p.evaluate(async e => { await window.__tf.lv2LerHistorico(true); return window.__tf.lv2EpicoMd(window.__tf.byId('issues', e)); }, ids.E);
  ok(ep.includes('Guardar o destino da cobrança') && ep.includes('Subtarefa do destino') && /Provas dos critérios/.test(ep) && /## Histórico|### Histórico|#### Histórico/.test(ep), 'o épico exportado traz os filhos de todas as frentes, critérios, provas e histórico');
  const pjMd = await p.evaluate(pj => window.__tf.lv2ProjetoMd(window.__tf.byId('projects', pj)), PJ);
  ok(/Épicos, com os itens de todas as frentes/.test(pjMd) && pjMd.includes('Guardar o destino da cobrança') && /## Frentes/.test(pjMd), 'o projeto inteiro sai num arquivo só, com todas as frentes');
  ok(/Definição de Pronto da frente/.test(mdW) || /Política de acesso testada/.test(pjMd), 'a exportação traz a Definição de Pronto da frente');
  ok(!erros.length, 'sem erro na página' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})();
