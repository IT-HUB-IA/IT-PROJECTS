// Parte 52: o que estava só no navegador vai para o banco da pessoa, juntando com o que o banco já tinha, sem perder nada.
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
  const F = process.env.FOTOS ? process.env.FOTOS + '/' : '';
  const pp = c => conta("select coalesce(" + c + "::text, '') from pessoas_preferencias where pessoa_id = '" + eu + "'");
  // o banco já tem coisas desta pessoa (não podem sumir)
  psql("insert into pessoas_preferencias (pessoa_id, estado) values ('" + eu + "', '{\"ficha_vistos\":{\"no-banco\":\"B\",\"comum\":\"do-banco\"},\"guia_passos\":{\"pj-x\":5}}') on conflict (pessoa_id) do update set estado = excluded.estado");
  // e este navegador tem as cópias antigas
  const silAte = Date.now() + 3 * 864e5;
  const lote = {tipo:'Editar em lote', resumo:'3 itens', quando:'2026-09-30T10:00:00.000Z', projeto:'pj-y', antes:{'is-1':{titulo:'Título antigo'}}, criados:[]};
  const bruto = JSON.stringify({v:2, clients:[{id:'cl_velho', nome:'Cliente que só existia no navegador'}]});
  await p.addInitScript(([sil, lt, br]) => { if (sessionStorage.getItem('__semeado')) return; sessionStorage.setItem('__semeado', '1');
    localStorage.setItem('ciclodev-ficha-vista:no-local', 'L'); localStorage.setItem('ciclodev-ficha-vista:comum', 'do-navegador');
    localStorage.setItem('ciclodev-guia-projeto-pj-y', '2'); localStorage.setItem('ciclodev-guia-projeto-pj-x', '1');
    localStorage.setItem('ciclodev-po-silenciados', JSON.stringify({'aviso-1':sil}));
    localStorage.setItem('ciclodev-ultimo-lote', JSON.stringify(lt)); localStorage.setItem('ciclodev-dados-v1', br); }, [silAte, lote, bruto]);
  await p.goto('file://' + process.cwd() + '/vercel/index.html'); await p.waitForTimeout(5000);
  const est = JSON.parse(pp('estado') || '{}');
  ok(est.ficha_vistos && est.ficha_vistos['no-banco'] === 'B' && est.ficha_vistos['no-local'] === 'L', 'fichas vistas: o que estava no banco ficou e o do navegador entrou');
  ok(est.ficha_vistos && est.ficha_vistos.comum === 'do-banco', 'no que existia dos dois lados, o banco não foi sobrescrito');
  ok(est.guia_passos && est.guia_passos['pj-x'] === 5 && est.guia_passos['pj-y'] === 2, 'guia do P.O.: passos do banco mantidos e do navegador incluídos');
  ok(est.po_silenciados && +est.po_silenciados['aviso-1'] === silAte, 'avisos silenciados foram para o banco com o prazo');
  ok(est.lote_desfazer && est.lote_desfazer.antes && est.lote_desfazer.antes['is-1'].titulo === 'Título antigo', 'o Desfazer do último lote foi para o banco inteiro');
  const ant = JSON.parse(pp('navegador_antigo') || '[]');
  ok(ant.length === 1 && ant[0].bruto === bruto, 'a cópia antiga de todos os dados do navegador foi guardada inteira no banco da pessoa');
  const sobrou = await p.evaluate(() => Object.keys(localStorage).filter(k => /^ciclodev-(ficha-vista:|guia-projeto-|po-silenciados|ultimo-lote|dados-v1)/.test(k)));
  ok(!sobrou.length, 'depois de conferido no banco, as cópias saíram do navegador' + (sobrou.length ? ' (sobrou: ' + sobrou.join(', ') + ')' : ''));
  // daqui para frente vai direto para o banco
  const ws = conta("select n.id from nos n where n.tipo = 'frente' and n.excluido_em is null order by n.nome limit 1");
  await p.evaluate(w => { window.__tf.D; esFoco({ws:w, desde:Date.now(), hist:[]}); faGravarVisto('no-novo', 'N'); pgSilenciar('aviso-2');
    esLoteGuardar({tipo:'Criar em lote', resumo:'2 itens', quando:new Date().toISOString(), projeto:'pj-z', antes:{}, criados:['a','b']}); }, ws);
  await p.waitForTimeout(2500);
  const est2 = JSON.parse(pp('estado') || '{}');
  ok(est2.foco && est2.foco.ws === ws, 'a frente em foco fica no banco');
  ok(est2.ficha_vistos['no-novo'] === 'N' && est2.ficha_vistos['no-banco'] === 'B' && est2.po_silenciados['aviso-2'] > Date.now(), 'ficha vista e aviso silenciado novos vão para o banco sem apagar os antigos');
  ok(est2.lote_desfazer && est2.lote_desfazer.resumo === '2 itens' && await p.evaluate(() => localStorage.getItem('ciclodev-ultimo-lote') === null), 'o Desfazer novo vai para o banco e não fica no navegador');
  // recarregar: tudo volta do banco
  await p.reload(); await p.waitForTimeout(5000);
  ok(await p.evaluate(w => window.__tf.D.focus && window.__tf.D.focus.ws === w && leUltimo() && leUltimo().resumo === '2 itens' && faLerVisto('no-local') === 'L' && esGuiaPasso('pj-y') === 2, ws), 'ao recarregar, foco, Desfazer, fichas vistas e guia voltam do banco');
  // registro das automações vem do banco
  const au = conta("select id from automacoes limit 1");
  psql("insert into automacoes_execucoes (automacao_id, resultado, detalhe) values ('" + au + "', 'erro', 'teste do registro')");
  await p.evaluate(() => window.ciclodevCarregarBanco()); await p.waitForTimeout(3000);
  ok(await p.evaluate(a => (window.__tf.D.autoLog || []).some(r => r.auto === a && r.det === 'teste do registro' && r.ok === false), au), 'o registro das automações vem do banco');
  // se o banco não aceitar, nada sai do navegador
  psql("alter table pessoas_preferencias rename column estado to estado_x");
  const fic = await p.evaluate(async () => { localStorage.setItem('ciclodev-ficha-vista:falha', 'F'); const E = window.ciclodevEstado; E.pronto = false; E.semColuna = false; await esCarregar(); return localStorage.getItem('ciclodev-ficha-vista:falha'); });
  ok(fic === 'F', 'se o banco não aceitar gravar, a cópia do navegador fica onde está (nada se perde)');
  psql("alter table pessoas_preferencias rename column estado_x to estado");
  ok(!erros.length, 'sem erro na página' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})();
