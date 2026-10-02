// Busca dos itens acha pelo código (BL-123 ou só 123) e pela descrição, além do título. Rodar de fonte/: node ../testes/t_busca_chave.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const erros = []; let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); p.on('pageerror', e => erros.push(e.message));
  await p.goto('file://' + process.cwd() + '/sistema.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
  await p.click('.item[data-tela=operacoes]'); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('.view-b[data-view=board]').click()); await p.waitForTimeout(400);
  const chave = (await p.locator('.bj-cartao .bj-chave').first().textContent()).trim();
  const num = chave.split('-').pop();
  const buscar = async t => { await p.fill('#busca-itens', t); await p.waitForTimeout(600); return p.locator('.bj-cartao .bj-chave').allTextContents(); };
  let r = await buscar(chave);
  ok(r.map(x => x.trim()).includes(chave), 'buscar "' + chave + '" traz o cartão');
  r = await buscar(num);
  ok(r.map(x => x.trim()).includes(chave), 'buscar só o número "' + num + '" traz o cartão');
  const desc = await p.evaluate(() => { const i = window.ciclodevDados().issues.find(x => x.tipo !== 'epic' && !x.arquivado); if (!i) return null; i.desc = (i.desc || '') + ' palavraunicadescricao'; return i.id; });
  if (desc){ r = await buscar('palavraunicadescricao'); ok(await p.locator('.bj-cartao[data-item="' + desc + '"]').count() === 1, 'buscar texto da descrição traz o cartão'); }
  r = await buscar('zzz-nao-existe-999');
  ok(r.length === 0, 'busca sem resultado deixa o quadro vazio');
  ok(!erros.length, 'sem erros na página ' + erros.join(' | '));
  await b.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})();
