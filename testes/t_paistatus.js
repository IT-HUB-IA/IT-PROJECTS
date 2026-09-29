// Status do épico acompanha os subitens (sem banco, dados de exemplo).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const erros = []; let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); p.on('pageerror', e => erros.push(e.message));
  await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  await p.goto('file://' + process.cwd() + '/sistema.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1200);
  // monta um épico novo com 3 subitens, todos em A fazer
  const ids = await p.evaluate(() => { const T = window.__tf, D = T.D, ws = D.issues.find(i => i.ws).ws;
    const ep = {id:'ep_t', tipo:'epic', titulo:'Épico de teste', status:'todo', ws, pai:null, check:[], links:[], coments:[], tempo:[], refs:[], prio:'medium'};
    const f = [1, 2, 3].map(n => ({id:'sb_t' + n, tipo:'task', titulo:'Subitem ' + n, status:'todo', ws, pai:'ep_t', check:[], links:[], coments:[], tempo:[], refs:[], prio:'medium'}));
    D.issues.push(ep, ...f); return f.map(x => x.id); });
  const st = id => p.evaluate(i => window.__tf.byId('issues', i).status, id);
  await p.evaluate(i => window.__tf.mudarStatus(window.__tf.byId('issues', i), 'doing'), ids[0]);
  ok(await st('ep_t') === 'doing', 'um subitem em Fazendo: o épico vai para Fazendo');
  ok(await p.evaluate(() => (document.querySelector('#toast') || {}).textContent || '').then(t => /foi junto para/.test(t)), 'aparece o aviso de que o épico foi junto');
  await p.evaluate(ids => ids.forEach(i => window.__tf.mudarStatus(window.__tf.byId('issues', i), 'done')), ids);
  ok(await st('ep_t') === 'done', 'todos os subitens feitos: o épico vai para Feito');
  await p.evaluate(i => window.__tf.mudarStatus(window.__tf.byId('issues', i), 'todo'), ids[2]);
  ok(await st('ep_t') === 'doing', 'um subitem reaberto: o épico volta para Fazendo');
  await p.evaluate(() => window.__tf.mudarStatus(window.__tf.byId('issues', 'ep_t'), 'blocked'));
  await p.evaluate(i => window.__tf.mudarStatus(window.__tf.byId('issues', i), 'review'), ids[2]);
  ok(await st('ep_t') === 'blocked', 'épico Travado à mão não é trocado por Fazendo');
  // só um subitem feito, com o épico ainda em A fazer
  await p.evaluate(() => { const D = window.__tf.D, ws = D.issues.find(i => i.ws).ws;
    D.issues.push({id:'ep_u', tipo:'epic', titulo:'Outro épico', status:'todo', ws, pai:null, check:[], links:[], coments:[], tempo:[], refs:[]}, {id:'sb_u1', tipo:'task', titulo:'A', status:'todo', ws, pai:'ep_u', check:[], links:[], coments:[], tempo:[], refs:[]}, {id:'sb_u2', tipo:'task', titulo:'B', status:'todo', ws, pai:'ep_u', check:[], links:[], coments:[], tempo:[], refs:[]}); });
  await p.evaluate(() => window.__tf.mudarStatus(window.__tf.byId('issues', 'sb_u1'), 'done'));
  ok(await st('ep_u') === 'doing', 'um subitem já Feito (e outro não): o épico vai para Fazendo');
  // histórico registra a mudança do épico
  ok(await p.evaluate(() => (window.__tf.D.eventos || []).some(e => e.item === 'ep_u' && /Outro épico/.test(e.txt))), 'a mudança do épico fica no histórico');
  // acerto ao abrir: épico com tudo feito parado em A fazer
  await p.evaluate(() => { const D = window.__tf.D, ws = D.issues.find(i => i.ws).ws;
    D.issues.push({id:'ep_v', tipo:'epic', titulo:'Épico parado', status:'todo', ws, pai:null, check:[], links:[], coments:[], tempo:[], refs:[]}, {id:'sb_v1', tipo:'task', titulo:'X', status:'done', ws, pai:'ep_v', check:[], links:[], coments:[], tempo:[], refs:[]}, {id:'sb_v2', tipo:'task', titulo:'Y', status:'done', ws, pai:'ep_v', check:[], links:[], coments:[], tempo:[], refs:[]}); });
  const n = await p.evaluate(() => window.__tf.psAcertarTodos());
  ok(n >= 1 && await st('ep_v') === 'done', 'ao abrir, o épico com tudo feito é acertado para Feito (' + n + ' acertados)');
  ok(await p.evaluate(() => window.__tf.psAcertarTodos()) === 0, 'rodar de novo não muda mais nada');
  ok(!erros.length, 'sem erro na página ' + erros.join(' | '));
  await b.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK');
})();
