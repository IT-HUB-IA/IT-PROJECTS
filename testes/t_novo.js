const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1600,height:950}});
  const erros=[]; p.on('pageerror', e => erros.push('PAGEERR ' + e.message));
  await p.goto('file://' + process.cwd() + '/wrap.html'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  const dados = () => p.evaluate(()=>JSON.parse(localStorage.getItem('ciclodev-dados-v1')));
  const shot = async n => { await p.waitForTimeout(200); await p.screenshot({path:'n_'+n+'.png'}); };
  await p.click('[data-tela=operacoes]'); await p.click('[data-view=board]'); await shot('board');
  // novo item com referencia
  await p.click('[data-acao=novo-item]'); await p.fill('#ni-t','Item com referência'); await p.setInputFiles('#ni-refs','ref_teste.png'); await p.fill('#ni-link','figma.com/arquivo'); await shot('novo_item'); await p.click('dialog [data-b="1"]'); await p.waitForTimeout(300);
  let d = await dados(); const it = d.issues.find(i=>i.titulo==='Item com referência'); console.log('novo item refs', it.refs.map(r=>r.tipo+(r.url?'+url':'')).join(','));
  // abrir gaveta de um item e adicionar link
  await p.click('.cartao'); await shot('gaveta');
  await p.fill('[data-form=ref-link] input','https://exemplo.com/ref'); await p.press('[data-form=ref-link] input','Enter'); await p.waitForTimeout(200);
  await p.setInputFiles('[data-refs-add]','ref_teste.png'); await p.waitForTimeout(300); await shot('gaveta_refs');
  await p.click('[data-ver-ref]'); await p.waitForTimeout(200); await shot('ver_ref'); await p.click('dialog [data-b="0"]');
  await p.keyboard.press('Escape');
  // service desk
  await p.click('[data-tela=servicedesk]'); await shot('sd');
  await p.setInputFiles('[data-refs-add]','ref_teste.png'); await p.waitForTimeout(300);
  await p.click('[data-acao=novo-pedido]'); await p.click('.tile:nth-child(4)'); await p.fill('#fp-tit','Pedido de teste'); await p.setInputFiles('#fp-arq','ref_teste.png'); await shot('novo_pedido'); await p.click('dialog [data-b="1"]'); await p.waitForTimeout(300);
  d = await dados(); const r = d.requests.find(x=>x.titulo==='Pedido de teste'); console.log('pedido', r.tipo, r.anexos.length);
  await shot('sd2');
  // team
  await p.click('[data-tela=time]'); await shot('team');
  await p.click('[data-excluir-pessoa="pe_b"]'); await p.click('dialog [data-b="1"]'); d = await dados(); console.log('pessoas', d.people.length, 'itens sem resp', d.issues.filter(i=>i.resp==='pe_b').length);
  await p.click('[data-acao=nova-pessoa]'); await shot('nova_pessoa'); await p.fill('#fpe-nome','Carla'); await p.click('dialog [data-b="1"]');
  // clients / tags
  await p.click('[data-tela=clientes]'); await shot('clients'); await p.click('[data-acao=cli-tags]'); await shot('tags'); await p.click('.nav-niveis .btn');
  console.log('clients volta', await p.evaluate(()=>document.querySelector('#m-clientes h1').textContent));
  console.log('ERROS', erros); await b.close();
})();
