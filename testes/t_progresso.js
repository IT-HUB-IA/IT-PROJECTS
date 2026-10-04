// Progresso por frente (progresso.js): sem épicos, pesado por pontos, cinco faixas, aceito e construído, vazias recolhidas,
// clique na faixa abre a lista filtrada. Rodar de fonte/: node ../testes/t_progresso.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const erros = []; let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } }); p.on('pageerror', e => erros.push(e.message));
  await p.goto('file://' + process.cwd() + '/sistema.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
  await p.click('.item[data-tela=operacoes]'); await p.waitForTimeout(300);
  // conta pura: épico não conta, pontos pesam, sem pontos vale a média
  const c = await p.evaluate(() => { const P = window.__tf.progressoDe;
    const r = P([{tipo:'epic', status:'doing'}, {tipo:'story', status:'done', pontos:8}, {tipo:'story', status:'review', pontos:2}, {tipo:'task', status:'todo'}, {tipo:'bug', status:'blocked', pontos:5}]);
    return {n:r.n, total:r.total, aceito:r.aceito, construido:r.construido, doing:r.faixas.doing.n, sem:r.semPontos}; });
  ok(c.n === 4 && c.doing === 0 && c.total === 20 && c.aceito === 40 && c.construido === 50 && c.sem === 1, 'épico não conta; pontos pesam; item sem pontos vale a média (5): 8 de 20 aceito = 40%, construído 50%');
  // a tela de uma aplicação com frentes
  const app = await p.evaluate(() => { const D = window.ciclodevDados(); const a = D.apps.find(x => D.ws.filter(w => w.app === x.id).length >= 3) || D.apps[0]; const T = window.__tf; T.UI.sel = 'app:' + a.id; T.UI.view = 'dashboard'; T.rOperacoes(); return a.id; });
  await p.waitForTimeout(600);
  const t = await p.evaluate(() => { const s = [...document.querySelectorAll('.pg2')].find(x => /Progresso por frente/.test(x.querySelector('h3').textContent)); if (!s) return null;
    const ws = window.ciclodevDados().ws.filter(w => 'app:' + w.app === window.__tf.UI.sel).length;
    const r = s.getBoundingClientRect(), g = s.parentElement.getBoundingClientRect();
    return {linhas:s.querySelectorAll('.pp > .pp-lin').length, ws, faixas:s.querySelectorAll('.pg2-bar i').length, num:(s.querySelector('.pp-lin:not(.vazia) b') || {}).textContent || '', leg:s.querySelector('.pg2-leg').textContent,
      largura:Math.round(r.width), pai:Math.round(g.width), ocupaTudo:Math.abs(r.width - g.width) < 4}; });
  ok(t && t.linhas === t.ws && t.faixas > 0, 'o cartão mantém uma linha por frente, como antes (' + (t && t.linhas) + ' de ' + (t && t.ws) + '), com barras em faixas');
  ok(t && !t.ocupaTudo, 'o cartão continua do tamanho de antes, ao lado dos outros, sem ocupar a largura toda (' + (t && t.largura) + ' de ' + (t && t.pai) + ' px)');
  ok(t && /%/.test(t.num) && /aceito/.test(t.num), 'cada frente mostra o % de progresso com o % aceito embaixo');
  ok(t && /Aceito/.test(t.leg) && /Pronto, falta aceitar/.test(t.leg) && /Em andamento/.test(t.leg) && /Bloqueado/.test(t.leg) && /A fazer/.test(t.leg) && /Total: \d+% de progresso · \d+% aceito/.test(t.leg), 'a legenda tem as cinco faixas e o total');
  // a conta: em andamento conta, pronto vale 90%, aceito 100%, a fazer 0%
  const conta = await p.evaluate(() => { const f = window.__tf, D = window.ciclodevDados(), id = 'tst_' + Date.now();
    const mk = (st, extra) => Object.assign({id:id + st, tipo:'task', status:st, pontos:1, pai:null, check:[]}, extra || {});
    const r = {done:f.pg2Avanco(mk('done')), review:f.pg2Avanco(mk('review')), doing:f.pg2Avanco(mk('doing')), todo:f.pg2Avanco(mk('todo')),
      doingCk:f.pg2Avanco(mk('doing', {check:[{t:'a', f:true}, {t:'b', f:false}]})), so_andamento:f.progressoPct([mk('doing'), mk('doing')]), vazio:f.progressoPct([])};
    return r; });
  ok(conta.done === 1 && conta.review === 0.9 && conta.doing === 0.5 && conta.todo === 0 && conta.doingCk === 0.5 && conta.so_andamento === 50 && conta.vazio === 0,
    'a conta: aceito 100%, pronto 90%, em andamento conta (metade, ou a parte feita da checklist), a fazer 0%; só itens em andamento nunca dá 0% (' + JSON.stringify(conta) + ')');
  const F = process.env.FOTOS; if (F){ await p.locator('.pg2', {hasText:'Progresso por frente'}).screenshot({path: F + '/progresso.png'}); await p.locator('.pg2', {hasText:'Progresso por frente'}).evaluate(e => e.parentElement.scrollIntoView()); await p.screenshot({path: F + '/painel.png'}); }
  const alvo = await p.evaluate(() => { const i = [...document.querySelectorAll('.pg2')].find(x => /por frente/.test(x.textContent)).querySelector('.pg2-bar i'); return i ? {no:i.dataset.pg2No, st:i.dataset.pg2St} : null; });
  if (alvo){ await p.locator('.pg2', {hasText:'Progresso por frente'}).locator('.pg2-bar i[data-pg2-st="' + alvo.st + '"]').first().click(); await p.waitForTimeout(500);
    const d = await p.evaluate(() => ({sel:window.__tf.UI.sel, view:window.__tf.UI.view, busca:window.__tf.UI.busca}));
    ok(d.sel === alvo.no && d.view === 'table' && (alvo.st === 'afazer' || /^status = /.test(d.busca)), 'clicar numa cor abre a lista daquela frente filtrada (' + (d.busca || 'sem filtro') + ')'); }
  ok(!erros.length, 'sem erro na página ' + erros.join(' | '));
  await b.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})();
