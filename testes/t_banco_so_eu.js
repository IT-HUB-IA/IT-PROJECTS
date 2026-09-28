const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const B = JSON.parse(fs.readFileSync('banco_local.json', 'utf8'));
// prova: muda o banco falso para ter coisas que NÃO existem no exemplo, e tira coisas do exemplo
const ana = B.pessoas.find(p => p.nome.startsWith('Ana'));
B.pessoas = B.pessoas.filter(p => p.nome === 'William'); const tem = id => B.pessoas.some(p => p.id === id);
B.participacoes = B.participacoes.filter(x => tem(x.pessoa_id)); B.pessoas_custos = B.pessoas_custos.filter(x => tem(x.pessoa_id)); B.blocos_agenda = B.blocos_agenda.filter(x => tem(x.pessoa_id)); B.tempo_registros = B.tempo_registros.filter(x => tem(x.pessoa_id));
B.itens.forEach(i => { if (!tem(i.responsavel_id)) i.responsavel_id = null; if (!tem(i.relator_id)) i.relator_id = null; }); B.comentarios.forEach(c => { if (!tem(c.autor_id)) c.autor_id = null; }); B.pedidos.forEach(c => { if (!tem(c.autor_id)) c.autor_id = null; });

const wil = B.pessoas.find(p => p.nome === 'William');
B.nos.find(n => n.tipo === 'aplicacao').nome = 'App Só No Banco';
['convites','espacos'].forEach(t => { if (!B[t]) B[t] = []; });   // tabelas da parte 15 (muitos usuários)
const FALSO = `const BANCO = ${JSON.stringify(B)};
function q(t){ const st = {de:0, ate:1e9}; const px = new Proxy(function(){}, { get(_, k){
  if (k === 'then') return (res, rej) => { const l = BANCO[t]; return Promise.resolve(l ? {data:l.slice(st.de, st.ate+1), error:null} : {data:null, error:{message:'permission denied for table '+t}}).then(res, rej); };
  if (k === 'range') return (a, b) => { st.de = a; st.ate = b; return px; };
  return () => px; } }); return px; }
window.supabase = { createClient(){ let sess = JSON.parse(localStorage.getItem('falso-sess')||'null'); const ouv=[];
  return { auth: { async getSession(){ return {data:{session:sess}}; },
    async signInWithPassword({email}){ sess={user:{id:'u1',email}}; localStorage.setItem('falso-sess',JSON.stringify(sess)); return {data:{session:sess},error:null}; },
    async signOut(){ sess=null; localStorage.removeItem('falso-sess'); ouv.forEach(f=>f('SIGNED_OUT',null)); return {}; },
    onAuthStateChange(f){ ouv.push(f); return {data:{subscription:{unsubscribe(){}}}}; } },
    from: q,
    async rpc(){ return {data:[{pessoa_id:'${wil.id}',nome:'William',papel:'master'}],error:null}; } }; } };`;
(async () => {
  const b = await chromium.launch(); const erros = []; let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
  const p = await b.newPage({ viewport: { width: 1366, height: 800 } });
  p.on('pageerror', e => erros.push(e.message));
  await p.route('**/supabase-js@*/**', r => r.fulfill({ contentType: 'text/javascript', body: FALSO }));
  await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  await p.goto('file://' + process.cwd() + '/vercel/index.html');
  // simula navegador que já tinha os dados de exemplo guardados
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('ciclodev-dados-v1', JSON.stringify({v:2, people:[{id:'x', nome:'Fantasma do Navegador'}]})); });
  await p.reload(); await p.waitForTimeout(300);
  await p.fill('[data-etapa=login] [name=email]', 'admin@it-ia.tec.br'); await p.fill('[data-etapa=login] [name=senha]', 'x');
  await p.click('[data-etapa=login] .entrada-botao'); await p.waitForTimeout(1200);
  ok(await p.evaluate(() => document.body.classList.contains('logado')), 'entrou');
  ok((await p.textContent('.chip-exemplo')).trim() === 'Dados do banco', 'selo diz "Dados do banco"');
  const dados = await p.evaluate(() => window.ciclodevDados());
  ok(dados.people.map(x => x.nome).sort().join('|') === B.pessoas.map(x => x.nome).sort().join('|'), 'pessoas = só as do banco: ' + dados.people.map(x => x.nome).join(', '));
  ok(dados.issues.length === B.itens.length && dados.ws.length === B.frentes.length && dados.apps.length === B.aplicacoes.length && dados.requests.length === B.pedidos.length && dados.catalog.length === B.servicos.length && dados.custos.length === B.custos_tecnicos.length, 'contagens batem com o banco (itens ' + dados.issues.length + ', frentes ' + dados.ws.length + ', apps ' + dados.apps.length + ', pedidos ' + dados.requests.length + ')');
  ok(await p.evaluate(() => localStorage.getItem('ciclodev-dados-v1') === null), 'nada de dados guardado no navegador');
  const mods = ['overview','operacoes','clientes','catalog','custos','servicedesk','time','playbook','configuracoes'];
  for (const m of mods){
    await p.click('.item[data-tela=' + m + ']'); await p.waitForTimeout(250);
    const txt = await p.evaluate(() => document.querySelector('.principal').innerText);
    ok(!/Ana \(exemplo\)|Bruno \(exemplo\)|Fantasma do Navegador/.test(txt), m + ': sem nome que não está no banco');
    if (m === 'time') { ok(!/CEO da B&L|Bruno|Ana /.test(txt) && txt.includes('William'), 'Team só com o William'); await p.screenshot({path:'b_time.png'}); }
    if (m === 'configuracoes') { ok(txt.includes('Dados do banco') && !txt.includes('Restaurar os dados de exemplo'), 'Settings mostra o resumo do banco e não o "restaurar exemplo"'); await p.screenshot({path:'b_config.png', fullPage:true}); }
  }
  await p.click('.item[data-tela=operacoes]'); await p.waitForTimeout(250);
  ok((await p.evaluate(() => document.querySelector('.principal').textContent)).includes('App Só No Banco'), 'Estrutura mostra a aplicação com o nome do banco');
  for (const v of ['board','list','table','timeline','calendar','workload','sheet','stages','whiteboard','dashboard']){
    const bt = p.locator('[data-view=' + v + ']').first(); if (await bt.count()) { await bt.click(); await p.waitForTimeout(200); }
  }
  await p.screenshot({path:'b_ops.png'});
  // um nível só de usuário (parte 15): não existe mais o "Ver como"
  ok(await p.evaluate(() => document.querySelector('#ver-como').hidden), 'sem o "Ver como" (um nível só de usuário)');
  await p.click('.item[data-tela=custos]'); await p.waitForTimeout(200);
  const aba = p.locator('[data-aba-custo=dominios], [data-ct-aba=dominios], button:has-text("Domínios")').first(); if (await aba.count()) { await aba.click(); await p.waitForTimeout(500); }
  ok((await p.evaluate(() => document.querySelector('.principal').innerText)).includes('it-ia.tec.br'), 'Domínios vem do banco');
  await p.reload(); await p.waitForTimeout(1200);
  ok((await p.evaluate(() => window.ciclodevDados().people.length)) === B.pessoas.length, 'recarregar: lê o banco de novo');
  ok(erros.length === 0, 'sem erro na página ' + JSON.stringify(erros.slice(0, 5)));
  console.log(falhas ? falhas + ' FALHAS' : 'TUDO OK'); await b.close();
})();
