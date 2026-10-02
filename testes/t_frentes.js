// Frentes padrão da aplicação nova e para onde cada item vai sozinho (fonte/frentes.js, sem navegador)
const fs = require('fs'), vm = require('vm'), path = require('path');
let falhas = 0; const ok = (c, m) => { console.log((c ? 'OK    ' : 'FALHA ') + m); if (!c) falhas++; };
let n = 0;
const ctx = {D:{ws:[], issues:[], apps:[{id:'a1', project:'p1'}, {id:'a2', project:'p1'}, {id:'a4', project:'p1', status:'active'}]}, UI:{sel:'app:a1', abertos:{}}, uid:p => p + '_' + (++n), novoItem(){}, $:() => null,
  rOperacoes(){}, podeEditar:() => true, BANCO:{carregado:true}, salvas:0, esc:s => String(s)};
ctx.salvar = () => { ctx.salvas++; };
ctx.primeiroWs = chave => (ctx.D.ws.find(w => w.app === chave.split(':')[1]) || {}).id;
ctx.byId = (k, id) => ctx.D[k].find(x => x.id === id);
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../fonte/frentes.js'), 'utf8') + '\nthis.F = {wsDoAssunto, frWsArvore, frFichaLigacao, rOperacoes:(...a) => rOperacoes(...a), criarFrentesPadrao, frenteSugerida, frAssunto, frChave, frAssuntoInventario, frAssuntoAchado, FRENTES_PADRAO};', ctx);
const F = ctx.F, D = ctx.D;

F.criarFrentesPadrao('a1');
const nomes = D.ws.filter(w => w.app === 'a1').map(w => w.nome);
ok(nomes.join(',') === 'Frontend,Backend,Database,Integrações,Infraestrutura,Segurança,Testes,Design,Documentação', 'aplicação nova nasce com as frentes padrão (' + nomes.join(', ') + ')');
F.criarFrentesPadrao('a1');
ok(D.ws.filter(w => w.app === 'a1').length === 9, 'chamar de novo não duplica');
D.ws.push({id:'w_b_front', app:'a2', nome:'Front', status:'active'}, {id:'w_b_banco', app:'a2', nome:'Banco de dados', status:'active'});
F.criarFrentesPadrao('a2');
ok(D.ws.filter(w => w.app === 'a2').length === 9 && !D.ws.some(w => w.app === 'a2' && w.nome === 'Frontend'), 'aplicação que já tem "Front" e "Banco de dados" ganha só as que faltam');

const fr = t => { const w = F.frenteSugerida('a1', t); return w ? w.nome : null; };
const casos = [
  ['Tela da lista da carteira', 'Frontend'], ['Botão de exportar na página de clientes', 'Frontend'],
  ['Endpoint para listar pedidos', 'Backend'], ['Regra de negócio do desconto', 'Backend'],
  ['Tabela de pagadores com RLS', 'Database'], ['Migration da coluna CPF', 'Database'],
  ['Webhook do Conexa', 'Integrações'], ['Enviar aviso pelo WhatsApp', 'Integrações'], ['Tela de integração com o Gmail', 'Integrações'],
  ['Deploy na VPS com Docker', 'Infraestrutura'], ['Configurar domínio e SSL', 'Infraestrutura'],
  ['Trocar a senha do banco e tirar o segredo do código', 'Segurança'], ['Adequação à LGPD', 'Segurança'],
  ['Testes e2e do cadastro', 'Testes'], ['Protótipo no Figma', 'Design'], ['Changelog da versão', 'Documentação'],
  ['Anúncios publicados e saldo', null], ['Validade dos certificados', null], ['Guia de vencimentos', null]
];
for (const [t, esp] of casos) ok(fr(t) === esp, '"' + t + '" vai para ' + (esp || 'a frente de sempre (texto não diz)') + (fr(t) !== esp ? ' (foi ' + fr(t) + ')' : ''));
ok(F.frenteSugerida('a3', 'Webhook do Conexa') === null, 'aplicação sem a frente do assunto: não inventa (fica na de sempre)');

ok(F.frAssuntoInventario({tipo:'tela', nome:'Tela /carteira'}) === 'frontend' && F.frAssuntoInventario({tipo:'api', nome:'GET /clientes'}) === 'backend' &&
   F.frAssuntoInventario({tipo:'tabela', nome:'Tabela clientes'}) === 'database' && F.frAssuntoInventario({tipo:'api', nome:'POST /webhook/conexa'}) === 'integracoes',
   'o que a análise leu: tela → Frontend, API → Backend, tabela → Database, webhook → Integrações');
ok(F.frAssuntoAchado({regra:'BD-01'}) === 'database' && F.frAssuntoAchado({regra:'SEG-03'}) === 'seguranca' && F.frAssuntoAchado({regra:'QUA-01', onde:'src/Tela.jsx:3'}) === 'frontend' && F.frAssuntoAchado({regra:'QUA-01', onde:'Api.java:3'}) === 'backend',
   'achados: banco → Database, segurança → Segurança, qualidade pelo tipo do arquivo');
// criar rápido: a frente do assunto do título
ctx.UI.sel = 'app:a1';
ok(D.ws.find(w => w.id === F.wsDoAssunto('Webhook do Conexa')).nome === 'Integrações' && D.ws.find(w => w.id === F.wsDoAssunto('Contas a receber')).nome === 'Frontend', 'criar rápido no Quadro: vai para a frente do assunto, ou para a primeira quando o texto não diz');
const wsTestes = D.ws.find(w => w.app === 'a1' && w.nome === 'Testes');
ctx.UI.sel = 'ws:' + wsTestes.id;
ok(F.wsDoAssunto('Webhook do Conexa') === wsTestes.id, 'com uma frente escolhida na Estrutura, fica nela');
// árvore: frentes padrão novas vazias ficam escondidas
ctx.UI.sel = 'app:a1';
let arv = F.frWsArvore('a1');
ok(arv.vis.map(w => w.nome).join(',') === 'Frontend,Backend,Database' && arv.ocultas.length === 6, 'árvore: as frentes novas vazias ficam escondidas (aparecem Frontend, Backend e Database)');
D.issues.push({id:'i1', ws:D.ws.find(w => w.app === 'a1' && w.nome === 'Integrações').id, tipo:'story', status:'done'});
arv = F.frWsArvore('a1');
ok(arv.vis.some(w => w.nome === 'Integrações') && arv.ocultas.length === 5, 'a frente aparece quando entra o primeiro item nela');
ctx.UI.abertos['vazias:a1'] = true;
ok(F.frWsArvore('a1').vis.length === 9, '"+ frentes vazias" mostra todas');
// ficha técnica
const fi = F.frFichaLigacao('Integrations', 'app:a1');
ok(/Integrações/.test(fi) && /1 item \(1 aceitos, 0 em aberto\)/.test(fi) && /data-ir-ops="ws:/.test(fi), 'ficha técnica: a seção Integrações mostra a frente Integrações e os itens dela');
ok(F.frFichaLigacao('Stack', 'app:a1') === '', 'seção sem frente do mesmo assunto não mostra nada');
// aplicações antigas ganham as frentes que faltam ao abrir
D.ws.push({id:'w_v1', app:'a4', nome:'Frontend', status:'active'});
const s0 = ctx.salvas; F.rOperacoes();
ok(D.ws.filter(w => w.app === 'a4').length === 9 && ctx.salvas === s0 + 1, 'aplicação antiga ganha as frentes padrão que faltam (e grava)');
console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
