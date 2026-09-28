const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const erros = []; let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
  for (const [w, h] of [[1440, 900], [390, 800]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } }); p.on('pageerror', e => erros.push(e.message));
    await p.goto('file://' + process.cwd() + '/sistema.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(400);
    await p.evaluate(() => document.querySelector('.item[data-tela=clientes]').click()); await p.waitForTimeout(200);
    await p.locator('tr[data-ficha-cliente] td').first().click(); await p.waitForTimeout(300);
    ok(await p.isVisible('dialog.modal-ficha'), w + ' clicar na linha abre a ficha');
    ok(await p.locator('.modal-ficha [data-fc="razao_social"]').count() === 1 && await p.locator('.modal-ficha [data-fc="cep"]').count() === 1, w + ' ficha tem cadastro e endereço');
    await p.fill('.modal-ficha [data-fc="documento"]', '12345678000199'); await p.fill('.modal-ficha [data-fc="razao_social"]', 'Blanco e Lisboa Participações Ltda'); await p.fill('.modal-ficha [data-fc="uf"]', 'sp');
    await p.click('[data-fc-salvar]'); await p.waitForTimeout(200);
    ok((await p.textContent('.modal-ficha .modal-cab h2')).includes('12.345.678/0001-99'), w + ' salvar mostra o CNPJ formatado no topo');
    ok(await p.evaluate(() => window.itiaDados().clients[0].ficha.uf) === 'SP', w + ' UF salva em maiúscula');
    if (w > 800) await p.screenshot({ path: 'ficha_cad.png' });
    await p.click('[data-fc-aba=projetos]'); await p.waitForTimeout(200);
    ok(await p.locator('.fc-card').count() >= 1, w + ' aba Projetos mostra os cards');
    await p.locator('.fc-card').first().click(); await p.waitForTimeout(300);
    ok(await p.locator('.fc-painel .pp-lin, .fc-painel .kpi, .fc-painel').count() > 0 && (await p.textContent('.fc-painel')).length > 50, w + ' card abre o painel do projeto');
    if (w > 800) await p.screenshot({ path: 'ficha_proj.png' });
    const ir = p.locator('.fc-painel [data-ir]').first();
    if (await ir.count()) { const k = await ir.getAttribute('data-ir'); await ir.click(); await p.waitForTimeout(300); ok(await p.locator('.fc-trilha [aria-current]').count() === 1 && await p.isVisible('dialog.modal-ficha'), w + ' clicar num produto navega dentro da janela (' + k + ')'); }
    await p.click('.fc-trilha [data-fc-ir=""]'); await p.waitForTimeout(200); ok(await p.locator('.fc-card').count() >= 1, w + ' voltar para os projetos');
    await p.locator('.fc-card').first().click(); await p.waitForTimeout(200); await p.click('[data-fc-operacoes]'); await p.waitForTimeout(300);
    ok(!(await p.isVisible('dialog.modal-ficha')) && await p.evaluate(() => !document.querySelector('#tela-operacoes').hidden), w + ' "Abrir em Operações" leva para o projeto');
    const larg = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); ok(larg[0] <= larg[1], w + ' sem rolagem para o lado');
    await p.close();
  }
  ok(erros.length === 0, 'sem erro ' + JSON.stringify(erros.slice(0, 3)));
  console.log(falhas ? falhas + ' FALHAS' : 'TUDO OK'); await b.close();
})();
