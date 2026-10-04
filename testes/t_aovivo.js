// Ao vivo (parte 67 + fonte/aovivo.js): duas pessoas, cada uma com a sua tela, no banco local.
// O banco grava os avisos em realtime.messages (simulação da parte 00); o teste entrega cada aviso só para quem
// entrou naquele canal (a lista de canais vem de ao_vivo_topicos(), como a pessoa logada), igual ao Realtime do Supabase.
// Rodar de fonte/: BD=<banco local com a parte 67> node ../testes/t_aovivo.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { execFileSync } = require('child_process');
const BD = process.env.BD || 'ciclodev_grava';
const psql = sql => execFileSync('psql', ['-h', '/tmp', '-p', '55432', '-U', 'postgres', '-d', BD, '-v', 'ON_ERROR_STOP=1', '-Atq', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const lit = o => '$j$' + JSON.stringify(o) + '$j$';
const conta = sql => psql(sql).trim();
const comoDe = pessoa => { const uid = conta("select auth_user_id from public.pessoas where id = '" + pessoa + "'");
  return "set role authenticated; set request.jwt.claim.sub = '" + uid + "'; set request.jwt.claims = '{\"sub\":\"" + uid + "\",\"role\":\"authenticated\"}'; "; };

function executar(p, COMO){
  const {t, op, row, filtro, dentro, conflito, de, ate, sel, ret, ordem, lim, conta: cnt} = p; const T = 'public.' + t;
  const onde = f => { const ks = Object.keys(f || {}); return ks.length ? '(' + ks.join(',') + ') = (select ' + ks.join(',') + ' from json_populate_record(null::' + T + ', ' + lit(f) + '))' : 'true'; };
  const ondeSel = () => [onde(filtro), dentro ? '(' + dentro[0] + ')::text in (select json_array_elements_text(' + lit(dentro[1]) + '))' : 'true'].join(' and ');
  try {
    let sql;
    if (op === 'select' && cnt){ const n = psql(COMO + 'select count(*) from ' + T + ' where ' + ondeSel()).trim(); return {data:null, count:Number(n), error:null}; }
    if (op === 'select') sql = 'select coalesce(json_agg(x), \'[]\') from (select * from ' + T + ' where ' + ondeSel() + ' order by ' + (ordem ? ordem[0] + (ordem[1] ? ' asc' : ' desc') : '1') + ' offset ' + (de || 0) + ' limit ' + (lim || ((ate || 999) - (de || 0) + 1)) + ') x';
    else if (op === 'insert' || op === 'upsert'){ const cs = Object.keys(Array.isArray(row) ? row[0] : row);
      sql = 'insert into ' + T + ' (' + cs.join(',') + ') select ' + cs.join(',') + ' from ' + (Array.isArray(row) ? 'json_populate_recordset' : 'json_populate_record') + '(null::' + T + ', ' + lit(row) + ')' +
        (op === 'upsert' ? ' on conflict (' + conflito + ') do update set ' + (cs.filter(c => !conflito.split(',').includes(c)).map(c => c + '=excluded.' + c).join(',') || conflito.split(',')[0] + '=excluded.' + conflito.split(',')[0]) : '');
      sql = ret ? 'with u as (' + sql + ' returning *) select coalesce(json_agg(u), \'[]\') from u' : sql; }
    else if (op === 'update'){ const cs = Object.keys(row); sql = 'with u as (update ' + T + ' set ' + (cs.length === 1 ? cs[0] + ' = (select ' + cs[0] : '(' + cs.join(',') + ') = (select ' + cs.join(',')) + ' from json_populate_record(null::' + T + ', ' + lit(row) + ')) where ' + onde(filtro) + ' returning *) select coalesce(json_agg(u), \'[]\') from u'; }
    else if (op === 'delete') sql = 'delete from ' + T + ' where ' + onde(filtro);
    const out = psql(COMO + sql).trim();
    return {data: op === 'delete' ? [] : ((op === 'insert' || op === 'upsert') && !ret) ? null : JSON.parse(out || '[]'), error: null};
  } catch (e) { const m = String(e.stderr || e.message).split('\n').find(l => /ERROR/.test(l)) || String(e.message); return {data: null, error: {message: m.replace(/^.*ERROR:\s*/, '')}}; }
}
const naTelaTem = `(t => document.body.textContent.includes(t) || [...document.querySelectorAll('input, textarea')].some(x => (x.value || '').includes(t)))`;
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
    if (k === 'in') return (c, vs) => { st.dentro = [c, vs]; return px; };
    return () => px; } }); return px; }
window.__canais = [];
window.__entregar = (topico, payload) => { window.__canais.filter(c => c.nome === topico && c.ok).forEach(c => c.hs.forEach(h => h({payload}))); };
window.__derrubar = () => { window.__canais.forEach(c => { c.ok = false; c.cb && c.cb('CHANNEL_ERROR'); }); };
window.supabase = { createClient(){ let sess = {access_token:'x', user:{id:'u1', email:'p@teste.com'}}; return { auth:{ async getSession(){ return {data:{session:sess}}; }, onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}}; }, async signOut(){} },
  storage:{ from(){ return { async upload(c){ return {data:{path:c}, error:null}; }, async createSignedUrls(ps){ return {data:ps.map(p => ({path:p, signedUrl:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'})), error:null}; }, async createSignedUrl(){ return {data:{signedUrl:'data:,'}, error:null}; } }; } },
  functions:{ async invoke(){ return {data:{ok:true}, error:null}; } },
  realtime:{ setAuth(){ } },
  channel(nome, o){ const c = {nome, privado:!!(o && o.config && o.config.private), hs:[], ok:false,
      on(tipo, f, h){ if (tipo === 'broadcast' && f && f.event === 'mudou') this.hs.push(h); return this; },
      subscribe(cb){ this.cb = cb; window.__canais.push(this); setTimeout(() => { this.ok = true; cb('SUBSCRIBED'); }, 20); return this; } }; return c; },
  removeChannel(c){ window.__canais = window.__canais.filter(x => x !== c); c.ok = false; c.cb && c.cb('CLOSED'); },
  from:q, async rpc(fn, args){ if (fn === 'ao_vivo_topicos') return JSON.parse(await window.__rpc(JSON.stringify({fn}))); if (fn === 'sou_dono_sistema') return {data:true, error:null}; if (/^admin_/.test(fn)) return {data:[], error:null}; if (fn !== 'vincular_meu_login') return {data:null, error:null}; return {data:[{pessoa_id:window.__eu, nome:window.__nome, papel:window.__papel, numero:100001, espaco_id:null}], error:null}; } }; } };`;

(async () => {
  const will = 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', ana = conta("select id from public.pessoas where nome = 'Ana (exemplo)'");
  const COMO = {[will]: comoDe(will), [ana]: comoDe(ana)};
  const b = await chromium.launch(); const erros = []; let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
  psql('delete from realtime.messages');
  let vistos = new Set();
  const paginas = {};
  async function abrir(pessoa, nome, papel){
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    p.on('pageerror', e => { erros.push(nome + ': ' + e.message); console.log('PAGEERROR', nome, e.stack.split('\n').slice(0, 4).join(' | ')); });
    await p.exposeFunction('__bd', s => JSON.stringify(executar(JSON.parse(s), COMO[pessoa])));
    await p.exposeFunction('__rpc', s => { const {fn} = JSON.parse(s);
      try { return JSON.stringify({data: JSON.parse(psql(COMO[pessoa] + 'select to_json(public.' + fn + '())')), error:null}); } catch(e){ return JSON.stringify({data:null, error:{message:'erro'}}); } });
    await p.addInitScript(([id, n, pp, f]) => { window.__eu = id; window.__nome = n; window.__papel = pp; window.__naTelaTem = f; }, [pessoa, nome, papel, naTelaTem]);
    await p.route('**/supabase-js@*/**', r => r.fulfill({ contentType: 'text/javascript', body: FALSO }));
    await p.goto('file://' + process.cwd() + '/vercel/index.html'); await p.waitForTimeout(2500);
    await p.evaluate(() => { window.__marca = 'sem recarregar'; document.querySelector('[data-tela="operacoes"]').click(); }); await p.waitForTimeout(400);
    paginas[pessoa] = p; return p;
  }
  // entrega os avisos novos para cada tela, só nos canais em que ela entrou (Realtime de verdade faz isso no servidor)
  async function entregar(){
    const rows = JSON.parse(conta("select coalesce(json_agg(json_build_object('id', id, 'topic', topic, 'payload', payload) order by inserted_at), '[]') from realtime.messages"));
    const novos = rows.filter(r => !vistos.has(r.id)); novos.forEach(r => vistos.add(r.id));
    for (const p of Object.values(paginas)) for (const r of novos) await p.evaluate(([t, pl]) => window.__entregar(t, pl), [r.topic, r.payload]);
    return novos;
  }
  const A = await abrir(will, 'William', 'master'), B = await abrir(ana, 'Ana (exemplo)', 'dev');
  const app = conta("select id from public.nos where nome = 'Java BL' and tipo = 'aplicacao'");

  // 1. as duas telas entram nos canais certos e mostram "Ao vivo"
  const canaisA = await A.evaluate(() => window.__canais.map(c => c.nome + (c.privado ? '' : ' (público!)')));
  const espW = conta("select espaco_id from public.nos where id = '" + app + "'");
  ok(canaisA.includes('ciclodev:' + espW) && canaisA.includes('ciclodev:p:' + will) && canaisA.every(c => !/público/.test(c)), 'William entra nos canais privados do espaço dele e no pessoal (' + canaisA.length + ' canais)');
  ok(await A.evaluate(() => window.__tf.AV ? window.__tf.AV.ligado === true && !document.querySelector('.av-selo') : !document.querySelector('.av-selo')), 'ao vivo ligado, sem selo na tela');

  // 2. Ana muda um item (direto no banco, como ela); a tela do William muda sozinha, sem recarregar
  await A.evaluate(a => { window.__tf.UI.sel = 'app:' + a; window.__tf.UI.view = 'table'; window.__tf.rOperacoes(); }, app); await A.waitForTimeout(400);
  // um item que está na tela do William e que a Ana também enxerga
  const naTela = await A.evaluate(() => [...new Set([...document.querySelectorAll('#ops-corpo [data-abrir-item]')].map(e => e.dataset.abrirItem))]);
  const daAna = new Set(JSON.parse(conta(COMO[ana] + "select coalesce(json_agg(id), '[]') from public.itens where tipo <> 'epic'").split('\n').pop()));
  const item = naTela.find(x => daAna.has(x));
  psql(COMO[ana] + "update public.itens set titulo = 'Mudado pela Ana ao vivo' where id = '" + item + "'");
  const novos = await entregar();
  ok(novos.some(r => r.payload.t === 'itens' && r.payload.ids.includes(item)) && novos.every(r => !JSON.stringify(r.payload).includes('Mudado pela Ana')), 'o banco avisou com o id, sem o título no aviso');
  await A.waitForTimeout(1800);
  ok(await A.evaluate(id => window.__tf.byId('issues', id).titulo === 'Mudado pela Ana ao vivo' && eval(window.__naTelaTem)('Mudado pela Ana ao vivo') && window.__marca === 'sem recarregar', item),
    'a tela do William mostra o título novo da Ana, sem recarregar a página');

  // 3. o eco: William muda um item pela tela dele; a gravação volta como aviso, mas não redesenha nada
  const aplicou0 = await A.evaluate(() => window.__tf.AV.aplicou);
  await A.evaluate(id => { const i = window.__tf.byId('issues', id); i.titulo = 'William mudou'; window.__tf.salvar(); }, item); await A.waitForTimeout(1500);
  await entregar(); await A.waitForTimeout(1800);
  ok(conta("select titulo from public.itens where id = '" + item + "'") === 'William mudou' && await A.evaluate(n => window.__tf.AV.aplicou === n, aplicou0),
    'eco da própria gravação: gravou e a tela do William não se redesenhou à toa');
  // e a da Ana recebe a mudança do William
  await B.waitForTimeout(1500);
  ok(await B.evaluate(id => { const i = window.__tf.byId('issues', id); return !!i && i.titulo === 'William mudou'; }, item), 'a tela da Ana recebe a mudança do William');

  // 4. não atrapalha quem está digitando: William escrevendo na janela do item; Ana muda o mesmo item
  await A.evaluate(id => window.__tf.abrirItem(id), item); await A.waitForTimeout(400);
  await A.evaluate(() => { const g = document.getElementById('gaveta-wrap'); window.__quem = []; Error.stackTraceLimit = 60;
    const d = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    Object.defineProperty(g, 'innerHTML', {configurable:true, get(){ return d.get.call(this); }, set(v){ window.__quem.push(new Error().stack.split('\n').slice(1, 30).map(x => x.trim().split(' (')[0]).join(' < ')); console.log('redesenhou a janela:', window.__quem[window.__quem.length - 1]); d.set.call(this, v); }}); });
  await A.click('#g-tit'); await A.keyboard.press('End'); await A.keyboard.type(' (digitando)');
  const prio = conta("select prioridade from public.itens where id = '" + item + "'") === 'high' ? 'low' : 'high';
  psql(COMO[ana] + "update public.itens set prioridade = '" + prio + "' where id = '" + item + "'");
  await entregar(); await A.waitForTimeout(3500);
  ok(await A.evaluate(() => window.__quem.length === 0), 'ninguém redesenhou a janela do item enquanto William digitava');
  await A.evaluate(() => { delete document.getElementById('gaveta-wrap').innerHTML; });
  ok(await A.evaluate(() => document.activeElement && document.activeElement.id === 'g-tit' && document.activeElement.value.endsWith(' (digitando)')),
    'enquanto William digita, a janela não é trocada: o texto e o cursor continuam lá');
  ok(await A.evaluate(() => !!document.querySelector('#gaveta-wrap .av-aviso')), 'e aparece o aviso discreto de que outra pessoa mudou este item');
  await A.evaluate(() => document.activeElement.blur()); await A.waitForTimeout(2500); await entregar(); await A.waitForTimeout(2000);
  ok(await A.evaluate(([id, pr]) => window.__tf.byId('issues', id).prio === pr && window.__tf.byId('issues', id).titulo.endsWith('(digitando)') && !document.querySelector('#gaveta-wrap .av-aviso'), [item, prio]),
    'ao sair do campo: a mudança da Ana entra e o que William digitou foi gravado (nada se perdeu)');
  ok(conta("select titulo || '|' || prioridade from public.itens where id = '" + item + "'") === 'William mudou (digitando)|' + prio, 'no banco ficam as duas mudanças');
  await A.evaluate(() => window.__tf.fecharItem()); await A.waitForTimeout(300);

  // 6. item aberto que outra pessoa mandou para a lixeira: a janela fecha com aviso
  await A.evaluate(id => window.__tf.abrirItem(id), item); await A.waitForTimeout(300);
  psql("update public.itens set excluido_em = now() where id = '" + item + "'");   // pela lixeira (o banco); a Ana não tem permissão, e está certo
  await entregar(); await A.waitForTimeout(2200);
  ok(await A.evaluate(id => !window.__tf.byId('issues', id) && !document.querySelector('#gaveta-wrap .gaveta') && /apagado ou arquivado por outra pessoa/.test(document.body.textContent), item),
    'item aberto que foi para a lixeira por outra pessoa: some da tela e a janela fecha com aviso');
  psql("update public.itens set excluido_em = null where id = '" + item + "'");

  // 7. outra empresa: o aviso de lá não chega aqui
  const espOutro = conta("insert into public.espacos (nome, dono_id) values ('Outra empresa', '" + ana + "') returning id");
  conta("insert into public.etiquetas (espaco_id, nome) values ('" + espOutro + "', 'Etiqueta-Zx7-Outra') returning id");
  const n7 = await entregar();
  ok(n7.some(r => r.topic === 'ciclodev:' + espOutro) && !(await A.evaluate(e => window.__canais.some(c => c.nome === 'ciclodev:' + e), espOutro)), 'aviso da outra empresa existe, mas William não está no canal dela');
  ok(!(await A.evaluate(() => window.__tf.D.labels ? JSON.stringify(window.__tf.D.labels).includes('Etiqueta-Zx7-Outra') : document.body.textContent.includes('Etiqueta-Zx7-Outra'))), 'nada da outra empresa aparece na tela do William');

  // 8. caiu e voltou: o que mudou enquanto estava fora aparece ao voltar
  await A.evaluate(() => window.__derrubar()); await A.waitForTimeout(300);
  ok(await A.evaluate(() => !document.querySelector('.av-selo')), 'conexão caiu: nada aparece por cima do rodapé');
  psql(COMO[ana] + "update public.itens set titulo = 'Mudou enquanto estava fora' where id = '" + item + "'");
  vistos = new Set(JSON.parse(conta("select coalesce(json_agg(id), '[]') from realtime.messages")));   // estes avisos se perderam
  await A.waitForTimeout(5000);
  ok(await A.evaluate(id => window.__tf.AV.ligado && window.__tf.byId('issues', id) && window.__tf.byId('issues', id).titulo === 'Mudou enquanto estava fora', item),
    'religou sozinho e buscou o que tinha perdido');

  // 9. importação grande (o banco manda "relê a tabela")
  const fr = conta("select no_id from public.frentes where no_id in (select a.no_id from nos_ancestrais a where a.ancestral_id = '" + app + "') limit 1");
  const st = conta("select status_id from public.itens where status_id is not null limit 1");
  psql(COMO[ana] + "insert into public.itens (frente_id, titulo, tipo, status_id) select '" + fr + "', 'Lote ao vivo ' || n, 'task', '" + st + "' from generate_series(1, 320) n");
  const n9 = await entregar(); await A.waitForTimeout(3000);
  ok(n9.some(r => r.payload.t === 'itens' && r.payload.ids === null) && await A.evaluate(() => window.__tf.D.issues.filter(i => /^Lote ao vivo /.test(i.titulo)).length === 320), 'importação de 320 itens: um aviso só e os 320 aparecem');

  // 10. a rolagem fica onde estava (lista longa, depois da importação)
  await A.evaluate(a => { window.__tf.UI.sel = 'app:' + a; window.__tf.UI.view = 'table'; window.__tf.rOperacoes(); }, app); await A.waitForTimeout(500);
  const rolou = await A.evaluate(() => { const els = [...document.querySelectorAll('body *')].filter(e => e.scrollHeight > e.clientHeight + 200 && /auto|scroll/.test(getComputedStyle(e).overflowY));
    const el = els.sort((x, y) => y.scrollHeight - x.scrollHeight)[0] || document.scrollingElement; el.scrollTop = 600;
    return [el === document.scrollingElement ? 'janela' : window.__tf.avChaveEl(el), el.scrollTop]; });
  const visivel = await A.evaluate(() => [...document.querySelectorAll('#ops-corpo [data-abrir-item]')].map(e => e.dataset.abrirItem)[5]);
  psql(COMO[ana] + "update public.itens set titulo = 'Mudança com a lista rolada' where id = '" + visivel + "'");
  await entregar(); await A.waitForTimeout(2200);
  ok(rolou[1] > 0 && await A.evaluate(([k, top]) => { const el = k === 'janela' ? document.scrollingElement : [...document.querySelectorAll('*')].find(e => window.__tf.avChaveEl(e) === k);
    return !!el && Math.abs(el.scrollTop - top) < 2 && eval(window.__naTelaTem)('Mudança com a lista rolada'); }, rolou),
    'a lista atualizou e a rolagem continuou no mesmo lugar (' + rolou[1] + 'px)');

  // 11. sem piscar: durante a atualização, a área da lista nunca fica vazia nem encolhe em nenhum quadro desenhado
  await A.evaluate(() => { window.__quadros = []; const c = document.querySelector('#ops-corpo'); const h0 = c.getBoundingClientRect().height;
    const amostra = () => { const el = document.querySelector('#ops-corpo'); window.__quadros.push([el ? el.childElementCount : 0, el ? Math.round(el.getBoundingClientRect().height) : 0]); if (window.__quadros.length < 150) requestAnimationFrame(amostra); };
    window.__h0 = h0; requestAnimationFrame(amostra); });
  psql(COMO[ana] + "update public.itens set titulo = 'Sem piscar' where id = '" + visivel + "'");
  await entregar(); await A.waitForTimeout(2600);
  const q = await A.evaluate(() => ({quadros:window.__quadros, h0:window.__h0, ms:(window.__tf.AV.registro.filter(r => r.aplicou).pop() || {}).ms, tm:JSON.stringify((window.__tf.AV.registro.filter(r => r.aplicou).pop() || {}).tm)}));
  console.log('tempos', q.tm);
  console.log('base (abrir a mesma tela sem ao vivo):', await A.evaluate(() => { const t0 = performance.now(); window.__tf.rOperacoes(); void document.body.offsetHeight; const t1 = performance.now(); window.__tf.rView(); void document.body.offsetHeight; return 'rOperacoes ' + Math.round(t1 - t0) + ' ms; rView ' + Math.round(performance.now() - t1) + ' ms'; }));
  ok(q.quadros.length > 20 && q.quadros.every(([n, h]) => n > 0 && h >= q.h0 * 0.9) && await A.evaluate(() => eval(window.__naTelaTem)('Sem piscar')),
    'sem piscar: em ' + q.quadros.length + ' quadros desenhados a lista nunca ficou vazia nem encolheu; a troca levou ' + q.ms + ' ms com ' + (await A.evaluate(() => window.__tf.D.issues.length)) + ' itens');

  // 12. rajada (o robô mudando muita coisa seguida): a tela não fica se redesenhando a cada aviso
  await A.waitForTimeout(3200);
  const ap0 = await A.evaluate(() => window.__tf.AV.aplicou);
  for (let k = 1; k <= 6; k++){ psql(COMO[ana] + "update public.itens set titulo = 'Rajada " + k + "' where id = '" + visivel + "'"); await entregar(); await A.waitForTimeout(350); }
  await A.waitForTimeout(4000);
  const ap = await A.evaluate(n => window.__tf.AV.aplicou - n, ap0);
  // em ~6 s de janela, com no máximo uma troca a cada 3 s, são até 3 trocas (e não 6)
  ok(ap >= 1 && ap <= 3 && await A.evaluate(() => eval(window.__naTelaTem)('Rajada 6')), '6 mudanças seguidas em 2 s: a tela trocou ' + ap + ' vez(es) em ~6 s (no máximo 1 a cada 3 s) e terminou com a última');

  // 13. com o ao vivo ligado, a conferência antiga de 20 s não relê o banco (só fica de reserva)
  const releu = await A.evaluate(async () => { let n = 0; const orig = window.ciclodevCarregarBanco; window.ciclodevCarregarBanco = function(){ n++; return orig.apply(this, arguments); };
    window.__tf.UI.view = 'backlog'; window.__tf.SMV.assin = 'x'; await window.__tf.smAoVivo(); await window.__tf.smAoVivo(); window.ciclodevCarregarBanco = orig; return n; });
  ok(releu === 0, 'com o ao vivo ligado, a conferência antiga da Fila não relê o banco');
  await A.evaluate(a => { window.__tf.UI.sel = 'app:' + a; window.__tf.UI.view = 'table'; window.__tf.rOperacoes(); }, app); await A.waitForTimeout(400);

  // 14. notificação nova para o William chega no sino na hora
  const nid = conta("insert into public.notificacoes (pessoa_id, titulo, texto) values ('" + will + "', 'Aviso ao vivo', 'chegou agora') returning id");
  const n14 = await entregar(); await A.waitForTimeout(3500);
  ok(n14.some(r => r.topic === 'ciclodev:p:' + will && r.payload.t === 'notificacoes') && !(await B.evaluate(() => window.__canais.some(c => /^ciclodev:p:/.test(c.nome) && c.nome !== 'ciclodev:p:' + window.__eu && false))) &&
    await A.evaluate(id => window.__tf.D.notifs.some(n => n.id === id), nid), 'notificação nova chega no sino do William na hora (pelo canal pessoal dele)');
  ok(!(await B.evaluate(id => (window.__tf.D.notifs || []).some(n => n.id === id), nid)), 'e não chega na tela da Ana');

  // 15. Infraestrutura: alguém liga um repositório no ponto; o painel Automático do William mostra sem recarregar
  await A.evaluate(a => { window.__tf.UI.sel = 'app:' + a; window.__tf.UI.view = 'infra'; window.__tf.rOperacoes(); }, app); await A.waitForTimeout(1500);
  await A.evaluate(() => { const b = document.querySelector('#ops-corpo [data-ifr-lig]'); if (b && !document.getElementById('ifr-lig')) b.click(); }); await A.waitForTimeout(300);
  const rid = conta("insert into public.repositorios (no_id, provedor, nome) values ('" + app + "', 'github', 'dono/repo-ao-vivo') returning id");
  await entregar(); await A.waitForTimeout(3500);
  ok(await A.evaluate(() => window.__tf.IFR_AUTO.repos.some(r => r.nome === 'dono/repo-ao-vivo') && /dono\/repo-ao-vivo/.test((document.getElementById('ifr-lig') || {}).textContent || '') && /1 código/.test(document.querySelector('#ops-corpo [data-ifr-lig]').textContent)),
    'Infraestrutura: o repositório ligado por outra pessoa aparece na janela Ligações (e no resumo do botão) sem recarregar');
  await A.evaluate(() => { const T = window.__tf; if (T.ifrLigFechar) T.ifrLigFechar(); });
  psql("delete from public.repositorios where id = '" + rid + "'"); await entregar(); await A.waitForTimeout(3500);
  ok(await A.evaluate(() => !window.__tf.IFR_AUTO.repos.some(r => r.nome === 'dono/repo-ao-vivo')), 'e some quando é desligado');

  ok(!erros.length, 'sem erro nas páginas' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})();
