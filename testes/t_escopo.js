// Cada ponto vê só o que é dele e o que está dentro dele: versões, repositórios e publicações de um projeto ou de
// outro produto nunca aparecem dentro de um app. A visão do projeto junta tudo e diz de onde é cada versão.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const erros = []; let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); p.on('pageerror', e => erros.push(e.message));
  await p.goto('file://' + process.cwd() + '/vercel/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
  // um projeto com dois apps diferentes; uma versão no projeto e uma em cada app
  const C = await p.evaluate(() => {
    const D = window.ciclodevDados();
    D.clients.push({id:'c-t', nome:'Cliente T'}); const pj = {id:'pj-t', nome:'Projeto T', client:'c-t', status:'active'}; D.projects.push(pj);
    D.products.push({id:'pr-t1', nome:'Produto Um', project:'pj-t'}, {id:'pr-t2', nome:'Produto Dois', project:'pj-t'});
    const a1 = {id:'ap-t1', nome:'App Java', project:'pj-t', product:'pr-t1'}, a2 = {id:'ap-t2', nome:'App Outro', project:'pj-t', product:'pr-t2'}; D.apps.push(a1, a2);
    const w1 = {id:'ws-t1', nome:'Backend', app:'ap-t1'}; D.ws.push(w1);
    const mk = (no, nome) => { const m = {id:'mc-t-' + nome, no, tipo:'release', nome, desc:'', data:'2030-01-01', vis:true, entregue:null, notas:''}; D.marcos.push(m); return m.id; };
    return {pj:'project:' + pj.id, pjId:pj.id, a1:'app:' + a1.id, a1Id:a1.id, a2:'app:' + a2.id, a2Id:a2.id, w1:'ws:' + w1.id,
      mP:mk('project:' + pj.id, 'vProjeto'), m1:mk('app:' + a1.id, 'vApp1'), m2:mk('app:' + a2.id, 'vApp2'), n1:a1.nome, n2:a2.nome};
  });
  const nomes = ch => p.evaluate(ch => __tf.marcosDoEscopo(ch).filter(m => m.id.startsWith('mc-t-')).map(m => m.nome).sort().join(','), ch);
  ok(await nomes(C.a1) === 'vApp1', 'dentro do app só aparece a versão do app (nem a do projeto, nem a do outro app)');
  ok(await nomes(C.a2) === 'vApp2', 'no outro app, só a dele');
  ok(await nomes(C.w1) === 'vApp1', 'numa frente do app aparece a versão do app (a frente é parte do app)');
  ok(await nomes(C.pj) === 'vApp1,vApp2,vProjeto', 'no projeto (visão macro) aparecem todas');
  const nos = await p.evaluate(ch => [...__tf.enNos(ch)], C.a1);
  ok(nos.includes(C.a1Id) && !nos.includes(C.pjId) && !nos.includes(C.a2Id), 'repositórios e publicações do app: nem do projeto, nem do outro app');
  ok(await p.evaluate(ch => { __tf.UI.sel = ch; return __tf.gcOnde().map(x => x[0]).join(','); }, C.a1) === C.a1, 'Ligar repositório dentro do app só oferece o próprio app');
  ok(await p.evaluate(ch => { __tf.UI.sel = ch; const o = __tf.gcOnde().map(x => x[0]); return o[0] === ch && o.length > 2; }, C.pj), 'no projeto oferece o projeto e o que está dentro dele');
  // a tela de Entregas
  const tela = async ch => { await p.evaluate(ch => { __tf.UI.sel = ch; __tf.UI.view = 'entregas'; __tf.EN.repos = __tf.EN.repos || []; __tf.EN.pubs = __tf.EN.pubs || []; const c = document.createElement('div'); c.id = 't-en'; document.body.appendChild(c); c.innerHTML = __tf.enHTML(ch); }, ch);
    const t = await p.evaluate(() => { const c = document.getElementById('t-en'); const r = [...c.querySelectorAll('.en2-v')].map(li => li.querySelector('b').textContent + (li.querySelector('.en2-onde') ? '@' + li.querySelector('.en2-onde').textContent : '')); c.remove(); return r; }); return t.filter(x => x.startsWith('v')); };
  const tA = await tela(C.a1);
  ok(tA.includes('vApp1') && !tA.some(x => x.startsWith('vProjeto') || x.startsWith('vApp2')), 'Entregas do app lista só a versão dele');
  const tP = await tela(C.pj);
  ok(tP.includes('vProjeto') && tP.includes('vApp1@' + C.n1) && tP.includes('vApp2@' + C.n2), 'Entregas do projeto lista todas, cada uma com o nome de onde é');
  // Nova versão criada dentro do app fica no app
  await p.evaluate(ch => { __tf.UI.sel = ch; __tf.enNovaVersao(); }, C.a1); await p.waitForTimeout(200);
  await p.evaluate(() => { document.querySelector('#en-v-n').value = 'vNovaNoApp'; [...document.querySelectorAll('dialog[open] button')].find(x => /Criar versão/.test(x.textContent)).click(); }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => (window.ciclodevDados().marcos.find(m => m.nome === 'vNovaNoApp') || {}).no) === C.a1, 'Nova versão feita dentro do app é salva no app (antes ia para o projeto)');
  await p.evaluate(() => { const d = document.querySelector('dialog[open]'); if (d) d.close(); });
  // formulário de marco dentro do app: só o app
  await p.evaluate(ch => { __tf.UI.sel = ch; __tf.formMarco(); }, C.a1); await p.waitForTimeout(200);
  ok(await p.evaluate(() => [...document.querySelectorAll('dialog[open] #mc-o option')].map(o => o.value).join(',')) === C.a1, 'Novo marco dentro do app só deixa salvar no app');
  await p.evaluate(() => { const d = document.querySelector('dialog[open]'); if (d) d.close(); });
  // exportar o app não leva as versões do projeto
  const md = await p.evaluate(ch => typeof __tf.exNoMd === 'function' ? __tf.exNoMd(ch) : null, C.a1);
  if (md !== null) ok(!/vProjeto|vApp2/.test(md), 'o .md do app não leva versões do projeto nem do outro app');
  ok(!erros.length, 'sem erro de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close(); console.log(falhas ? falhas + ' FALHAS' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})();
