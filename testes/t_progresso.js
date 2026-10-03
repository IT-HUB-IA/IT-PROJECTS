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
    return {titulo:s.querySelector('h3').textContent, total:!!s.querySelector('.pg2-lin.total'), linhas:s.querySelectorAll('.pg2-lista > .pg2-lin').length, faixas:s.querySelectorAll('.pg2-bar i').length,
      num:(s.querySelector('.pg2-lin:not(.total) .pg2-num') || {}).textContent || '', leg:s.querySelector('.pg2-leg').textContent}; });
  ok(t && /Progresso por frente/.test(t.titulo) && t.linhas > 0 && t.faixas > 0, 'a aplicação mostra o progresso por frente com barras empilhadas (' + (t && t.linhas) + ' frentes com itens)');
  ok(t && /aceito/.test(t.num) && /construído/.test(t.num), 'cada frente mostra % aceito e % construído');
  ok(t && /Aceito/.test(t.leg) && /Pronto, falta aceitar/.test(t.leg) && /Em andamento/.test(t.leg) && /Bloqueado/.test(t.leg) && /A fazer/.test(t.leg), 'a legenda tem as cinco faixas com o total de cada uma');
  const F = process.env.FOTOS; if (F) await p.locator('.pg2', {hasText:'Progresso por frente'}).screenshot({path: F + '/progresso.png'});
  // clique numa faixa abre a lista filtrada
  const alvo = await p.evaluate(() => { const i = [...document.querySelectorAll('.pg2')].find(x => /por frente/.test(x.textContent)).querySelector('.pg2-lista .pg2-bar i:not(.pg2-afazer)'); return i ? {no:i.dataset.pg2No, st:i.dataset.pg2St} : null; });
  if (alvo){ await p.locator('.pg2', {hasText:'Progresso por frente'}).locator('.pg2-lista .pg2-bar i[data-pg2-st="' + alvo.st + '"]').first().click(); await p.waitForTimeout(500);
    const d = await p.evaluate(() => ({sel:window.__tf.UI.sel, view:window.__tf.UI.view, busca:window.__tf.UI.busca}));
    ok(d.sel === alvo.no && d.view === 'table' && /^status = /.test(d.busca), 'clicar na faixa abre a lista daquela frente filtrada na situação (' + d.busca + ')'); }
  ok(!erros.length, 'sem erro na página ' + erros.join(' | '));
  await b.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})();
