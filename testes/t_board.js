const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const erros = []; let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); p.on('pageerror', e => erros.push(e.message));
  await p.goto('file://' + process.cwd() + '/sistema.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
  await p.click('.item[data-tela=operacoes]'); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('.view-b[data-view=board]').click()); await p.waitForTimeout(400);
  ok(await p.locator('.bj-cartao .bj-chave').count() > 10, 'cartões mostram a chave BL-123');
  // arrastar um cartão de To Do para In Progress, antes do primeiro cartão de lá
  const id = await p.getAttribute('[data-bj-coluna="auto:todo"] .bj-cartao', 'data-item');
  const alvo = p.locator('[data-bj-coluna="auto:doing"] .bj-cartao').first();
  await p.locator('[data-item="' + id + '"]').dragTo(alvo, { targetPosition: { x: 20, y: 5 } }); await p.waitForTimeout(300);
  ok(await p.evaluate(id => window.ciclodevDados().issues.find(i => i.id === id).status, id) === 'doing', 'arrastar muda o status');
  ok(await p.getAttribute('[data-bj-coluna="auto:doing"] .bj-cartao', 'data-item') === id, 'e o cartão fica na posição onde foi solto (primeiro da coluna)');
  // sinalizar pelo item aberto
  await p.click('[data-item="' + id + '"]'); await p.waitForTimeout(300);
  await p.click('.bj-sinal-btn'); await p.fill('#bj-motivo', 'Esperando cliente'); await p.click('dialog[open] [data-b="1"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(id => !!window.ciclodevDados().issues.find(i => i.id === id).sinal, id), 'sinalizar marca o item');
  await p.keyboard.press('Escape'); await p.evaluate(() => { const f = document.querySelector('[data-fechar-gaveta]'); if (f) f.click(); }); await p.waitForTimeout(300);
  ok(await p.locator('[data-item="' + id + '"].sinalizado').count() === 1, 'o cartão aparece sinalizado');
  // configurar colunas: juntar In Review em In Progress com máximo 2
  await p.click('.ferramentas [data-bj-acao=config]'); await p.waitForTimeout(300);
  const nCols = await p.locator('.bj-cfg-col').count();
  await p.locator('.bj-cfg-col').nth(2).locator('[data-bjcol-st="review"]').check(); await p.waitForTimeout(100);
  await p.locator('.bj-cfg-col').nth(2).locator('[data-bjcol=max]').fill('2');
  await p.click('dialog[open] [data-b="1"]'); await p.waitForTimeout(400);
  ok(await p.locator('.bj-coluna').count() === nCols && await p.locator('.bj-coluna.cheia').count() >= 1, 'coluna com dois status e máximo fica vermelha ao passar do limite');
  // backlog: criar item e marcar vários
  await p.evaluate(() => document.querySelector('.view-b[data-view=backlog]').click()); await p.waitForTimeout(300);
  await p.fill('[data-bj-criar=""] input', 'Item criado pelo backlog'); await p.press('[data-bj-criar=""] input', 'Enter'); await p.waitForTimeout(300);
  ok(await p.locator('.bj-linha-tit:has-text("Item criado pelo backlog")').count() === 1, 'criar item pelo backlog');
  await p.locator('[data-bj-marca]').first().check(); await p.waitForTimeout(200); await p.locator('[data-bj-marca]').nth(1).check(); await p.waitForTimeout(200);
  ok((await p.textContent('.bj-massa')).includes('2 selecionados'), 'marcar vários mostra a barra de ações em massa');
  await p.click('[data-bj-acao=limpar-sel]'); await p.waitForTimeout(200);
  // equipes
  await p.click('.item[data-tela=time]'); await p.waitForTimeout(300);
  await p.click('[data-bj-equipe=""]'); await p.fill('[data-eq=nome]', 'Time Java'); await p.locator('[data-eq-pessoa]').first().check(); await p.waitForTimeout(100); await p.locator('[data-eq-no]').nth(1).check(); await p.waitForTimeout(100);
  await p.click('dialog[open] [data-b]:last-child'); await p.waitForTimeout(300);
  ok((await p.textContent('.bj-equipes')).includes('Time Java') && await p.evaluate(() => window.ciclodevDados().equipes[0].membros.length === 1 && window.ciclodevDados().equipes[0].nos.length === 1), 'criar equipe com membro e ponto da estrutura');
  const larg = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); ok(larg[0] <= larg[1], 'sem rolagem da página para o lado');
  ok(erros.length === 0, 'sem erro ' + JSON.stringify(erros.slice(0, 3)));
  console.log(falhas ? falhas + ' FALHAS' : 'TUDO OK'); await b.close();
})();
