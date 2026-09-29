// Tabela dentro de uma aplicação: responsável em lote pelo botão do cabeçalho da coluna Responsável.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const erros = []; let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); p.on('pageerror', e => erros.push(e.message));
  await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  await p.goto('file://' + process.cwd() + '/sistema.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate(() => document.querySelector('[data-tela="operacoes"]').click()); await p.waitForTimeout(400);
  await p.evaluate(() => { const U = window.__tf.UI; U.sel = 'app:ap_javabl'; U.view = 'table'; window.__tf.rOperacoes(); }); await p.waitForTimeout(500);
  const linhas = () => p.$$eval('table.itens tbody tr[data-linha]', l => l.map(t => t.dataset.linha));
  const antes = await linhas(), ordem0 = await p.evaluate(() => JSON.stringify(window.__tf.UI.ordem));
  ok(!!(await p.$('th[data-ordem="resp"] [data-rl-abrir]')), 'o botão fica no cabeçalho da coluna Responsável');
  ok(!(await p.$('.ferramentas [data-rl-abrir]')), 'não tem botão solto ao lado de Novo item');
  await p.click('th[data-ordem="resp"] [data-rl-abrir]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => JSON.stringify(window.__tf.UI.ordem)) === ordem0, 'clicar no botão não ordena a coluna');
  ok(await p.evaluate(() => { const d = document.querySelector('dialog.modal'); return !!d && d.querySelector('[value="todos"]').checked && d.querySelector('[value="sel"]').disabled; }), 'sem nada marcado, a janela já vem em "Todos os itens desta lista"');
  const pessoaId = await p.evaluate(() => { const o = [...document.querySelectorAll('#rl-pessoa option')].find(x => x.value && x.value !== '-' && /Ana/.test(x.textContent)); return o && o.value; });
  await p.selectOption('#rl-pessoa', pessoaId); await p.click('dialog.modal .modal-rod .btn:not(.sec)'); await p.waitForTimeout(400);
  ok(await p.evaluate(([ids, pid]) => ids.every(id => window.__tf.byId('issues', id).resp === pid), [antes, pessoaId]), 'todos os ' + antes.length + ' itens da lista ficaram com a mesma responsável');
  ok(await p.evaluate(() => (window.__tf.D.eventos || [])[0].txt.includes('de uma vez')), 'a mudança fica no histórico');
  // só os marcados
  const l2 = await linhas();
  await p.check('[data-rc-sel="' + l2[0] + '"]'); await p.waitForTimeout(200); await p.check('[data-rc-sel="' + l2[1] + '"]'); await p.waitForTimeout(200);
  await p.click('th[data-ordem="resp"] [data-rl-abrir]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelector('dialog.modal [value="sel"]').checked && /2 itens/.test(document.querySelector('dialog.modal [value="sel"]').closest('label').textContent)), 'com 2 marcados, a janela vem em "Só os marcados (2 itens)"');
  const outro = await p.evaluate(() => { const o = [...document.querySelectorAll('#rl-pessoa option')].find(x => x.value && x.value !== '-' && /William/.test(x.textContent)); return o && o.value; });
  await p.selectOption('#rl-pessoa', outro); await p.click('dialog.modal .modal-rod .btn:not(.sec)'); await p.waitForTimeout(400);
  const r = await p.evaluate(([ids, a, bb]) => ids.map(id => window.__tf.byId('issues', id).resp === a ? 'A' : window.__tf.byId('issues', id).resp === bb ? 'W' : '?').join(''), [l2, pessoaId, outro]);
  ok(/^WWA+$/.test(r.replace(/(.)(.)/, '$1$2')) && r.slice(0, 2) === 'WW' && !r.slice(2).includes('W'), 'só os 2 marcados mudaram (' + r + ')');
  // tirar o responsável de todos
  await p.click('th[data-ordem="resp"] [data-rl-abrir]'); await p.waitForTimeout(300);
  await p.check('dialog.modal [value="todos"]'); await p.selectOption('#rl-pessoa', '-'); await p.click('dialog.modal .modal-rod .btn:not(.sec)'); await p.waitForTimeout(400);
  ok(await p.evaluate(ids => ids.every(id => !window.__tf.byId('issues', id).resp), l2), 'dá para tirar o responsável de todos de uma vez');
  if (process.argv[2]) await p.screenshot({path: process.argv[2] + '/tabela_lote.png'});
  ok(!erros.length, 'sem erro na página ' + erros.join(' | '));
  await b.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK');
})();
