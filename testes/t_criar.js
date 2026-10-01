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
  const FOTOS = process.env.FOTOS || '';
  const app = conta("select id from public.nos where tipo = 'aplicacao' and nome like 'Sistema%' order by nome limit 1") || conta("select id from public.nos where tipo = 'aplicacao' order by nome limit 1");
  const ver = v => p.evaluate(([v, a]) => { const U = window.__tf.UI; U.sel = 'app:' + a; U.view = v; window.__tf.rOperacoes(); const c = document.querySelector('#ops-corpo'); const b = document.querySelector('#m-operacoes .ops-cab .views > .cria-barra'); const ac = b && b.parentElement;
    return { tem: !!b, primeiro: (() => { if (!b || c.querySelector('.cria-barra')) return false; const rb = b.getBoundingClientRect(), abas = [...ac.querySelectorAll('.view-casa')].filter(x => x.offsetParent); return abas.length > 0 && abas.every(x => { const r = x.getBoundingClientRect(); return r.right <= rb.left + 1 || r.bottom <= rb.top + 1; }) && Math.abs(rb.right - ac.getBoundingClientRect().right) < 4; })(), botoes: b ? [...b.querySelectorAll('button')].map(x => x.textContent.trim()).join('|') : '', novoItemFora: c ? [...c.querySelectorAll('[data-acao="novo-item"]')].filter(x => !x.closest('.cria-barra')).length : -1, epicoFora: c ? [...c.querySelectorAll('[data-bj-acao="novo-epic"]')].filter(x => !x.closest('.cria-barra')).length : -1 }; }, [v, app]);
  for (const v of ['dashboard', 'board', 'table', 'calendar', 'timeline', 'backlog']) {
    const r = await ver(v); await p.waitForTimeout(150);
    if (!(r.tem && r.primeiro && r.botoes === 'Item|Épico|Em lote|Editar em lote|IA' && r.novoItemFora === 0 && r.epicoFora === 0)) console.log('DEBUG', v, JSON.stringify(r));
    ok(r.tem && r.primeiro && r.botoes === 'Item|Épico|Em lote|Editar em lote|IA' && r.novoItemFora === 0 && r.epicoFora === 0, 'aba ' + v + ': os botões de criar ficam na linha das abas, depois delas e alinhados à direita (Item, Épico, Em lote, Editar em lote e IA), sem botão repetido em outro lugar' + (r.tem ? '' : ' (sem barra)'));
    if (v === 'calendar' && FOTOS) await p.screenshot({ path: FOTOS + '/criar_cab.png', clip: {x: 0, y: 0, width: 1440, height: 380} });
  }
  for (const v of ['sheet']) { const r = await ver(v); ok(!r.tem, 'aba ' + v + ': sem barra Criar (não mostra itens)'); }
  // criar de outra aba, não só da Fila
  await ver('table'); await p.waitForTimeout(200);
  const antes = Number(conta("select count(*) from public.itens where tipo = 'epic'") || 0);
  await p.click('.cria-barra [data-bj-acao="novo-epic"]'); await p.waitForTimeout(300);
  await p.fill('#bj-ep-n', 'Épico criado pela Tabela'); await p.click('dialog.modal[open] .modal-rod .btn:not(.sec)'); await p.waitForTimeout(1500);
  ok(/Épico criado pela Tabela/.test(await p.evaluate(() => document.body.textContent)) || Number(conta("select count(*) from public.itens where tipo = 'epic'") || 0) > antes, 'o + Épico da Tabela cria o épico (a mesma tabela de itens)');
  await ver('calendar'); await p.waitForTimeout(200);
  await p.click('.cria-barra [data-lt-abrir]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !!document.querySelector('dialog.lt-modal [data-lt-ia-baixar]') && !!document.querySelector('dialog.lt-modal [data-lt-ia-copiar]')), 'o Em lote abre do Calendário, com Baixar e Copiar instruções para IA');
  if (FOTOS) await p.locator('dialog.lt-modal').screenshot({ path: FOTOS + '/criar_lote.png' });
  const baixar = async sel => { const [d] = await Promise.all([p.waitForEvent('download'), p.click(sel)]); const fs = require('fs'); return { nome: d.suggestedFilename(), md: fs.readFileSync(await d.path(), 'utf8') }; };
  const lote = await baixar('dialog.lt-modal [data-lt-ia-baixar]');
  const frentes = psql("select string_agg(nome, '|') from public.nos where tipo = 'frente'").trim().split('|').filter(Boolean);
  ok(/\| `aceite` \|/.test(lote.md) && /\| `prioridade` \|/.test(lote.md) && /\| `pontos` \| Estimativa \| 1, 2, 3, 5, 8, 13 ou 20/.test(lote.md) && /Exemplo completo/.test(lote.md) && /aquele item não é criado/.test(lote.md) && /não é duplicado/.test(lote.md), 'o arquivo do Criar em lote traz a tabela dos campos de detalhe, os valores aceitos, o exemplo completo e as regras');
  ok(/\.md$/.test(lote.nome) && /Linha sem traço\*\* vira um \*\*épico/.test(lote.md) && /`- `\*\* vira um \*\*item/.test(lote.md) && /```\n[\s\S]+\n```/.test(lote.md) && /Roteiro para o agente/.test(lote.md) && /só o texto no formato acima/.test(lote.md), 'o arquivo do Criar em lote explica o formato, traz o exemplo e o roteiro para o agente (' + lote.nome + ')');
  ok(frentes.some(f => lote.md.includes('- ' + f)), 'as instruções levam os nomes das frentes que existem de verdade');
  await p.evaluate(() => { window.__copiado = ''; navigator.clipboard.writeText = t => { window.__copiado = t; return Promise.resolve(); }; });
  await p.click('dialog.lt-modal [data-lt-ia-copiar]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => /Formato do Criar em lote/.test(window.__copiado)), 'Copiar instruções copia o mesmo texto, para colar direto no chat do agente');
  // o texto que um agente devolveria, colado na caixa, vira a prévia certa
  const exemplo = await p.evaluate(() => { const m = document.querySelector('dialog.lt-modal'); const t = m.querySelector('#lt-t'); const f = (window.__tf.ciContexto().frentes[0] || {}).nome || ''; t.value = 'Módulo gerado pelo agente' + (f ? ' [' + f + ']' : '') + '\n- Primeira tarefa\n- Segunda tarefa'; t.dispatchEvent(new Event('input')); return m.querySelector('.lt-previa').textContent; });
  ok(/1 épico novo/.test(exemplo) && /2 itens/.test(exemplo) && !/não existe aqui/.test(exemplo), 'o texto no formato das instruções entra certo na prévia (1 épico e 2 itens, frente reconhecida)');
  await p.evaluate(() => document.querySelectorAll('dialog.modal').forEach(d => { d.close(); d.remove(); }));
  const geral = await baixar('.cria-barra [data-ia-instrucoes]');
  ok(/Cliente › Projeto › Produto › Aplicação › Frente de trabalho/.test(geral.md) && /Tipos de item:\*\*\n- \*\*/.test(geral.md) && /Situações \(status\):\*\*\n- \*\*/.test(geral.md) && /Prioridade \(classe MoSCoW\):\*\*\n- \*\*Deve/.test(geral.md) && /Nível de prioridade \(de 1 a 5\):\*\*\n- \*\*1/.test(geral.md) && /O método do Product Owner/.test(geral.md) && /Linha do tempo/.test(geral.md) && /Formato do Criar em lote/.test(geral.md) && /Criar › Em lote/.test(geral.md), 'Instruções para IA baixa o funcionamento do CicloDev (estrutura, tipos, situações, prioridade MoSCoW e nível, método do P.O., abas) com o formato em lote junto');
  ok(!/—/.test(geral.md) && !/—/.test(lote.md), 'nenhum travessão nas instruções');
  ok(!erros.length, 'sem erro na página' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})();
