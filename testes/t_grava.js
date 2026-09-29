// A tela grava num Postgres local de verdade (mesmas tabelas, regras e gatilhos do Supabase).
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
    if (k === 'select') return () => { if (st.op !== 'select') st.ret = true; return px; };
    if (k === 'insert') return r => { st.op = 'insert'; st.row = r; return px; };
    if (k === 'upsert') return (r, o) => { st.op = 'upsert'; st.row = r; st.conflito = (o || {}).onConflict; return px; };
    if (k === 'update') return r => { st.op = 'update'; st.row = r; return px; };
    if (k === 'delete') return () => { st.op = 'delete'; return px; };
    if (k === 'match') return f => { Object.assign(st.filtro, f); return px; };
    if (k === 'eq') return (c, v) => { st.filtro[c] = v; return px; };
    return () => px; } }); return px; }
window.supabase = { createClient(){ let sess = {user:{id:'u1', email:'admin@it-ia.tec.br'}}; return { auth:{ async getSession(){ return {data:{session:sess}}; }, onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}}; }, async signOut(){} },
  from:q, async rpc(fn){ if (fn === 'sou_dono_sistema') return {data:true, error:null}; if (fn !== 'vincular_meu_login') return {data:null, error:null}; return {data:[{pessoa_id:window.__eu, nome:'William', papel:'master', numero:100001, espaco_id:window.__esp || null}], error:null}; } }; } };`;
(async () => {
  prepararLogin();
  const eu = COMO ? 'd148fdc5-eef3-5398-bf89-f49b55b5cd28' : psql("select id from public.pessoas where papel='master' order by nome limit 1").trim();
  const b = await chromium.launch(); const erros = []; let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', e => { erros.push(e.message); console.log('PAGEERROR', e.stack.split('\n').slice(0,4).join(' | ')); });
  await p.exposeFunction('__bd', s => JSON.stringify(executar(JSON.parse(s))));
  const esp = COMO ? psql("select id from public.espacos where dono_id = '" + eu + "' and pessoal limit 1").trim() : '';
  await p.addInitScript(([id, e]) => { window.__eu = id; window.__esp = e || null; }, [eu, esp]);
  await p.route('**/supabase-js@*/**', r => r.fulfill({ contentType: 'text/javascript', body: FALSO }));
  await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  await p.goto('file://' + process.cwd() + '/vercel/index.html'); await p.waitForTimeout(2500);
  ok(await p.evaluate(() => document.body.classList.contains('logado') && window.ciclodevBancoInfo().carregado), 'entrou e leu o banco local');
  const espera = async () => { await p.waitForTimeout(500); await p.waitForFunction(() => !window.ciclodevSync.rodando && !window.ciclodevSync.pendente, null, {timeout: 20000}); };
  const semErro = async m => { const e = await p.evaluate(() => window.ciclodevSync.erros); ok(!e.length, m + (e.length ? ' ' + JSON.stringify(e.slice(0, 3)) : '')); };
  const conta = sql => psql(sql).trim();

  // 1) nada muda: salvar sem mudança não manda nada
  ops.length = 0; await p.evaluate(() => { window.ciclodevGravarAgora(); }); await espera();
  ok(!ops.some(o => !o.startsWith('select') && !/uso_eventos|pessoas_preferencias/.test(o)), 'salvar sem mudança não grava nada (' + ops.filter(o => !o.startsWith('select') && !/uso_eventos|pessoas_preferencias/.test(o)).length + ' operações)');

  // 2) cria cliente, projeto, produto, aplicação, frente e item pela própria estrutura de dados da tela
  const ids = await p.evaluate(() => { const D = window.ciclodevDados(); const u = () => crypto.randomUUID();
    const c = {id:u(), nome:'Cliente Teste', tipo:'empresa', holding:null, doc:'', status:'active', motivo:''}; D.clients.push(c);
    const pj = {id:u(), client:c.id, nome:'Projeto Teste', status:'active', motivo:'', origem:'greenfield', inicio:'2026-10-01', alvo:'2026-12-01'}; D.projects.push(pj);
    const pr = {id:u(), project:pj.id, client:c.id, nome:'Produto Teste', status:'active', motivo:''}; D.products.push(pr);
    const ap = {id:u(), project:pj.id, product:pr.id, nome:'App Teste', plataforma:'web', status:'active', motivo:'', servico:'', origemCodigo:'proprio'}; D.apps.push(ap);
    const ws = {id:u(), app:ap.id, nome:'Frontend', status:'active', wip:3}; D.ws.push(ws);
    const ep = {id:u(), ws:ws.id, tipo:'epic', titulo:'Epic teste', desc:'', status:'todo', prio:'high', resp:null, rep:null, ini:'2026-10-01', fim:'2026-11-01', alvo:'2026-11-01', est:10, vis:'interno', pai:null, check:[], links:[], coments:[], tempo:[], refs:[], bloco:null};
    const it = Object.assign({}, ep, {id:u(), tipo:'story', titulo:'História teste', pai:ep.id, check:[{t:'Passo 1', f:false}], coments:[{quem:window.ciclodevDados().people[0].id, txt:'Primeiro comentário', quando:'2026-10-01', cliente:false}], refs:[{nome:'Figma', tipo:'link', url:'https://figma.com/x'}], links:[]});
    D.issues.push(ep, it);
    const sp = {id:u(), project:pj.id, nome:'Sprint 1', meta:'Meta', ini:'2026-10-01', fim:'2026-10-14', status:'planejado'}; D.sprints.push(sp); it.sprint = sp.id;
    D.marcos.push({id:u(), no:'project:' + pj.id, tipo:'release', nome:'v1', desc:'', data:'2026-11-01', vis:true, entregue:null});
    D.tags.push({id:u(), nome:'Tag teste', cor:'#FF0000', cat:'Teste', desc:''}); D.tagLinks.push({tag:D.tags[D.tags.length - 1].id, tipo:'client', id:c.id});
    D.statusCustom.push({id:u(), no:'project:' + pj.id, nome:'Aguardando teste', cor:'#123456', grupo:'blocked'});
    D.camposItem.push({id:u(), no:'project:' + pj.id, nome:'Ambiente teste', tipo:'lista', opcoes:['A','B']});
    D.custos.push({id:u(), cliente:c.id, app:ap.id, fornecedor:'Vercel', cat:'Hospedagem', desc:'Plano Pro', rec:'Mensal', moeda:'USD', valor:20, uso:null, repasse:true, markup:10, inicio:'2026-10-01', fim:''});
    D.opCustos.push({id:u(), nome:'Notebook', cat:'Equipamento', valor:8000, moeda:'BRL', rec:'Depreciação', meses:36});
    D.receitas.push({id:u(), cliente:c.id, project:pj.id, app:'', servico:'', desc:'Implantação', modelo:'fixo', valor:5000, rec:'Parcelado', parcelas:3, inicio:'2026-10-01', fim:''});
    D.people.push({id:u(), nome:'Pessoa Teste', funcao:'Dev', skills:['JS'], cap:30, acesso:'dev', custo:{vinculo:'PJ', salario:0, valorPJ:7000, beneficios:0}});
    window.ciclodevGravarAgora(); return {c:c.id, pj:pj.id, ap:ap.id, ws:ws.id, ep:ep.id, it:it.id, sp:sp.id}; });
  await espera(); await semErro('criar cliente, projeto, produto, app, frente, épico, história, sprint, marco, tag, status, campo, custos, receita e pessoa sem erro');
  ok(conta("select count(*) from public.nos where id in ('" + [ids.c, ids.pj, ids.ap, ids.ws].join("','") + "')") === '4', 'estrutura gravada no banco');
  ok(conta("select titulo || '|' || coalesce(sprint_id::text,'') from public.itens where id='" + ids.it + "'") === 'História teste|' + ids.sp, 'item gravado com o sprint');
  ok(conta("select count(*) from public.comentarios where item_id='" + ids.it + "'") === '1' && conta("select count(*) from public.itens_checklist where item_id='" + ids.it + "'") === '1' && conta("select count(*) from public.anexos where item_id='" + ids.it + "'") === '1', 'comentário, checklist e link gravados');
  ok(conta("select count(*) from public.pessoas_custos c join public.pessoas p on p.id=c.pessoa_id where p.nome='Pessoa Teste' and c.valor_pj=7000") === '1', 'pessoa e custo dela gravados');

  // 3) alterar só o que mudou
  ops.length = 0;
  await p.evaluate(ids => { const D = window.ciclodevDados(); const i = D.issues.find(x => x.id === ids.it); i.titulo = 'História alterada'; i.status = 'doing'; i.check[0].f = true; window.ciclodevGravarAgora(); }, ids);
  await espera(); await semErro('alterar título, status e checklist sem erro');
  const esc = ops.filter(o => !o.startsWith('select') && !/uso_eventos|pessoas_preferencias/.test(o));
  ok(esc.length === 2 && esc.includes('update itens') && esc.includes('update itens_checklist'), 'mandou só 2 alterações: ' + JSON.stringify(esc));
  ok(conta("select titulo || '|' || (iniciado_em is not null) from public.itens where id='" + ids.it + "'") === 'História alterada|true', 'título mudou e o banco marcou o início sozinho');

  // 4) status personalizado e concluir
  await p.evaluate(ids => { const D = window.ciclodevDados(); const i = D.issues.find(x => x.id === ids.it); const s = D.statusCustom.find(x => x.nome === 'Aguardando teste'); i.st = s.id; i.status = 'blocked'; window.ciclodevGravarAgora(); }, ids);
  await espera(); await semErro('status personalizado grava');
  await p.evaluate(ids => { const D = window.ciclodevDados(); const i = D.issues.find(x => x.id === ids.it); delete i.st; i.status = 'done'; window.ciclodevGravarAgora(); }, ids);
  await espera(); ok(conta("select concluido_em is not null from public.itens where id='" + ids.it + "'") === 't', 'concluir: o banco grava a data de conclusão');

  // 5) recarregar e conferir que a tela volta igual (ida e volta)
  const antes = await p.evaluate(() => JSON.stringify(window.ciclodevDados().issues.map(i => [i.id, i.titulo, i.status, i.sprint, i.check.length, i.coments.length]).sort()));
  await p.reload(); await p.waitForTimeout(2500);
  const depois = await p.evaluate(() => JSON.stringify(window.ciclodevDados().issues.map(i => [i.id, i.titulo, i.status, i.sprint, i.check.length, i.coments.length]).sort()));
  ok(antes === depois, 'depois de recarregar, os itens voltam iguais do banco');
  ops.length = 0; await p.evaluate(() => window.ciclodevGravarAgora()); await espera();
  ok(!ops.some(o => !o.startsWith('select') && !/uso_eventos|pessoas_preferencias/.test(o)), 'depois de recarregar, nada fica "pendente" para gravar');

  // 6) pela tela: criar item pelo Quick add do Board
  await p.evaluate(ids => { const UI = null; }, ids);
  await p.evaluate(ids => { document.querySelector('.item[data-tela=operacoes]').click(); }, ids); await p.waitForTimeout(300);
  await p.evaluate(ws => { const n = document.querySelector('.no-arv[data-no="ws:' + ws + '"]'); if (n) n.click(); }, ids.ws); await p.waitForTimeout(300);
  await p.evaluate(() => { const b = document.querySelector('.view-b[data-view=board]'); if (b) b.click(); }); await p.waitForTimeout(300);
  const qa = p.locator('form[data-add-status] input, [data-add-status] input').first();
  if (await qa.count()) { await qa.fill('Criado pelo quick add'); await qa.press('Enter'); await espera(); await semErro('quick add grava sem erro');
    ok(conta("select count(*) from public.itens where titulo='Criado pelo quick add'") === '1', 'item do quick add está no banco (' + conta("select count(*) from public.itens where titulo='Criado pelo quick add'") + ')'); }
  else ok(false, 'não achei o quick add');

  // 6b) alterar um registro de cada tipo (todas as tabelas) e recarregar
  ops.length = 0;
  await p.evaluate(() => { const D = window.ciclodevDados(); const um = l => l && l[0];
    um(D.clients).nome += ' ✓'; um(D.clients).sla = {parado:[2, 10]};
    um(D.projects).alvo = '2027-03-01'; um(D.products).nome += ' ✓'; um(D.apps).plataforma = 'mobile'; um(D.ws).wip = 5;
    const pe = D.people.find(x => x.acesso !== 'owner') || D.people[0]; pe.cap = 25; pe.skills = ['A', 'B']; if (pe.custo) pe.custo.beneficios = 123;
    const st = D.people.find(x => x.acesso === 'stakeholder'); if (st) st.escopo = 'project:' + D.projects[0].id;
    um(D.tags).desc = 'mudou'; um(D.statusCustom) && (um(D.statusCustom).nome = 'Status mudou');
    D.baseline[Object.keys(D.baseline)[0]] = !D.baseline[Object.keys(D.baseline)[0]];
    const s = um(D.catalog); s.horas = [10, 50]; s.preco[0] && (s.preco[0].pct = 12); s.req = s.req.slice(0, 1);
    D.regras.margem = 22;
    um(D.opCustos).valor = 999; const c = D.custos.find(x => x.uso) || um(D.custos); c.valor = 30; if (c.uso) c.uso.hist[c.uso.hist.length - 1] = 9.9;
    um(D.receitas).valor = 12345; um(D.sprints).meta = 'Meta nova'; um(D.marcos).entregue = '2026-09-20';
    um(D.automacoes).ativa = false; um(D.camposItem) && (um(D.camposItem).opcoes = ['X', 'Y']);
    const it = D.issues.find(i => i.check.length && i.coments.length) || um(D.issues); it.prio = 'low'; it.pontos = 8; it.check[0] && (it.check[0].t = 'mudou'); it.coments[0] && (it.coments[0].txt = 'mudou');
    const cf = D.camposItem.find(c => c.no === 'project:' + (D.apps.find(a => a.id === (D.ws.find(w => w.id === it.ws) || {}).app) || {}).project); if (cf) it.cf = {[cf.id]: cf.opcoes[0] || 'X'};
    const outro = D.issues.find(i => i.id !== it.id && i.ws === it.ws); if (outro) it.links = [{tipo:'Relates to', alvo:outro.id}];
    const comB = D.issues.find(i => i.bloco); if (comB) comB.bloco.fim = '12:15';
    const comT = D.issues.find(i => i.tempo && i.tempo.length); if (comT) comT.tempo.push({ini:Date.now() - 3600e3, fim:Date.now(), quem:D.people[0].id, origem:'Timer'});
    const sh = Object.values(D.sheets)[0]; if (sh){ sh.campos['Stack|Frameworks'] = 'React'; sh.custom.push({nome:'Novo campo', tipo:'Texto', valor:'v'}); }
    const et = um(D.template); et.expl = 'mudou'; et.itens[0].modo = 'Trava';
    const k = Object.keys(D.stages)[0]; if (k){ const s2 = D.stages[k]; const mid = D.template[1].itens[0].id; s2[mid] = {feito:true, quem:D.people[0].id, quando:'2026-09-28', prova:{tipo:'Texto', valor:'ok'}}; }
    const r = um(D.requests); if (r){ r.status = 'Resolvido'; r.msgs.push({de:'voce', txt:'Resolvido, obrigado'}); }
    window.ciclodevGravarAgora(); });
  await espera(); await semErro('alterar um registro de cada tabela sem erro');
  const tabs = [...new Set(ops.filter(o => /^(update|insert|upsert|delete) /.test(o)).map(o => o.split(' ')[1]))].sort();
  console.log('     tabelas gravadas:', tabs.join(', '));
  ok(tabs.length >= 25, 'gravou em ' + tabs.length + ' tabelas diferentes');
  const snap = () => p.evaluate(() => { const D = window.ciclodevDados(); return JSON.stringify([D.clients[0].nome, D.clients[0].sla, D.apps[0].plataforma, D.ws[0].wip, D.regras.margem, D.opCustos[0].valor, D.receitas[0] && D.receitas[0].valor, D.sprints[0] && D.sprints[0].meta, D.template[0].expl, D.requests[0] && D.requests[0].status, D.catalog[0].horas]); });
  const a1 = await snap(); await p.reload(); await p.waitForTimeout(2500); const a2 = await snap();
  if (a1 !== a2) console.log('ANTES ', a1, '\nDEPOIS', a2);
  ok(a1 === a2, 'depois de recarregar, tudo o que mudou voltou do banco');
  if (a1 !== a2) console.log('     antes ', a1, '\n     depois', a2);
  ops.length = 0; await p.evaluate(() => window.ciclodevGravarAgora()); await espera();
  ok(!ops.some(o => !o.startsWith('select') && !/uso_eventos|pessoas_preferencias/.test(o)), 'e nada fica pendente depois de recarregar ' + JSON.stringify(ops.filter(o => !o.startsWith('select') && !/uso_eventos|pessoas_preferencias/.test(o)).slice(0, 6)));

  // 6c) Board no formato Jira: sinal, pessoas, etiquetas, ordem, colunas e equipes
  await p.evaluate(() => { const D = window.ciclodevDados(); const i = D.issues[0], pj = D.projects[0];
    i.sinal = new Date().toISOString(); i.motivoSinal = 'Esperando acesso'; i.membros = [D.people[0].id]; i.observadores = [D.people[0].id]; i.votos = [D.people[0].id];
    i.etiquetas = [D.tags[0].id]; i.ordem = 12.5; i.restante = 3; i.resolucao = 'feito'; if (i.check[0]){ i.check[0].grupo = 'Revisão'; i.check[0].prazo = '2026-10-10'; }
    D.boards['project:' + pj.id] = {tipo:'scrum', estimativa:'horas', backlog:true, subtarefas:false, colunas:[{id:crypto.randomUUID(), nome:'A fazer', ordem:0, min:null, max:5, status:['backlog','todo']}, {id:crypto.randomUUID(), nome:'Fazendo', ordem:1, min:1, max:3, status:['doing','review','blocked']}, {id:crypto.randomUUID(), nome:'Pronto', ordem:2, min:null, max:null, status:['done']}]};
    D.equipes.push({id:crypto.randomUUID(), nome:'Time do teste', desc:'teste', cor:'#123456', ativa:true, membros:[{pessoa:D.people[0].id, papel:'lider'}], nos:[{no:'project:' + pj.id, papel:'dev'}]});
    window.ciclodevGravarAgora(); });
  await espera(); await semErro('gravar sinal, pessoas, etiquetas, ordem, colunas do Board e equipe sem erro');
  const s1 = await p.evaluate(() => { const D = window.ciclodevDados(); const i = D.issues.find(x => x.sinal); const b = Object.values(D.boards)[0]; const q = D.equipes.find(x => x.nome === 'Time do teste');
    return JSON.stringify([i && i.motivoSinal, i && i.membros.length, i && i.observadores.length, i && i.votos.length, i && i.etiquetas.length, i && i.ordem, i && i.restante, i && i.resolucao, b && b.tipo, b && b.colunas.map(c => c.nome + ':' + c.status.join('+') + ':' + c.max).join('|'), q && q.membros.length, q && q.nos.length]); });
  await p.reload(); await p.waitForTimeout(2500);
  const s2 = await p.evaluate(() => { const D = window.ciclodevDados(); const i = D.issues.find(x => x.sinal); const b = Object.values(D.boards)[0]; const q = D.equipes.find(x => x.nome === 'Time do teste');
    return JSON.stringify([i && i.motivoSinal, i && i.membros.length, i && i.observadores.length, i && i.votos.length, i && i.etiquetas.length, i && i.ordem, i && i.restante, i && i.resolucao, b && b.tipo, b && b.colunas.map(c => c.nome + ':' + c.status.join('+') + ':' + c.max).join('|'), q && q.membros.length, q && q.nos.length]); });
  ok(s1 === s2, 'Board no formato Jira volta igual do banco: ' + s2);
  ops.length = 0; await p.evaluate(() => window.ciclodevGravarAgora()); await espera();
  ok(!ops.some(o => !o.startsWith('select') && !/uso_eventos|pessoas_preferencias/.test(o)), 'e nada fica pendente ' + JSON.stringify(ops.filter(o => !o.startsWith('select') && !/uso_eventos|pessoas_preferencias/.test(o)).slice(0, 5)));
  ok(await p.evaluate(() => window.ciclodevDados().issues.every(i => !!i.chave)), 'todo item tem chave vinda do banco (BL-123)');
  await p.evaluate(() => { const D = window.ciclodevDados(); const ws = D.ws[0]; const ni = {id:crypto.randomUUID(), ws:ws.id, tipo:'task', titulo:'Item com chave nova', desc:'', status:'todo', prio:'lowest', resp:null, rep:null, ini:null, fim:null, alvo:null, est:null, vis:'interno', pai:null, check:[], links:[], coments:[], tempo:[], refs:[], bloco:null, membros:[], observadores:[], votos:[], etiquetas:[], ordem:1}; D.issues.push(ni); window.ciclodevGravarAgora(); });
  await espera(); await semErro('criar item com prioridade Lowest');
  ok(await p.evaluate(() => /^[A-Z0-9]+-\d+$/.test((window.ciclodevDados().issues.find(i => i.titulo === 'Item com chave nova') || {}).chave || '')), 'o item novo recebe a chave do banco na hora: ' + await p.evaluate(() => (window.ciclodevDados().issues.find(i => i.titulo === 'Item com chave nova') || {}).chave));

  // 7) apagar: item, frente e cliente somem do banco
  await p.evaluate(ids => { const D = window.ciclodevDados(); D.issues = D.issues.filter(i => ![ids.it, ids.ep].includes(i.id) && i.ws !== ids.ws);
    D.ws = D.ws.filter(w => w.id !== ids.ws); window.ciclodevGravarAgora(); }, ids);
  await espera(); await semErro('apagar itens e frente sem erro');
  ok(conta("select count(*) from public.itens where id in ('" + ids.it + "','" + ids.ep + "')") === '0' && conta("select count(*) from public.nos where id='" + ids.ws + "'") === '0', 'itens e frente apagados no banco');
  ok(erros.length === 0, 'sem erro na página ' + JSON.stringify(erros.slice(0, 3)));
  console.log(ops.filter(o => o.startsWith('ERRO')).slice(0, 5).join('\n'));
  console.log(falhas ? falhas + ' FALHAS' : 'TUDO OK'); await b.close();
})();
