// Testes do inventário do que já existe. Rodar da raiz: node --experimental-strip-types supabase/functions/diagramas-auto/inventario.test.ts
import { inventarioDoCodigo, inventarioDoBanco, palavrasDoCodigo, motivosInacabado } from './inventario.ts';
let falhas = 0;
const ok = (c: unknown, m: string) => { console.log((c ? 'OK    ' : 'FALHA ') + m); if (!c) falhas++; };
const arq = new Map<string, string>([
  ['src/main/java/bl/ClienteController.java', '@RestController\n@RequestMapping("/clientes")\nclass ClienteController {\n  @GetMapping\n  List<Cliente> listar(){ return repo.findAll(); }\n  @PostMapping("/{id}/bloquear")\n  void bloquear(){ // TODO: falta avisar o financeiro\n  }\n}'],
  ['src/main/java/bl/RelatorioJob.java', 'class RelatorioJob { @Scheduled(cron = "0 0 8 * * *") public void gerarRelatorioDiario(){ } }'],
  ['api/server.js', 'router.get("/pedidos", listar);\napp.post("/pedidos/:id/pagar", pagar);\nthrow new Error("not implemented")'],
  ['web/src/App.jsx', '<Routes><Route path="/" element={<Inicio/>}/><Route path="/carteira" element={<Carteira/>}/></Routes>'],
  ['web/pages/relatorios/index.tsx', 'export default function P(){ return <div/> }'],
  ['web/pages/api/saldo.ts', 'export default function h(req, res){ res.json({}) }'],
  ['web/pages/_app.tsx', 'x'],
  ['supabase/functions/enviar-avisos/index.ts', 'Deno.serve(() => new Response("ok"))'],
  ['public/login.html', '<html><head><title>Entrar no BL</title></head><body><form></form></body></html>'],
  ['src/test/java/bl/ClienteControllerTest.java', '@Test void listar(){}'],
]);
const inv = inventarioDoCodigo(arq, [...arq.keys()]);
const ch = (k: string) => inv.find(i => i.chave === k);
ok(ch('api:GET /clientes') && ch('api:POST /clientes/{id}/bloquear') && ch('api:GET /clientes')!.grupo === 'Cliente', 'Spring: as APIs do controlador, com o prefixo, no épico do controlador');
ok(ch('api:GET /clientes')!.sinais.teste === true && ch('api:POST /clientes/{id}/bloquear')!.sinais.todo === 1, 'sinais: o controlador tem teste e tem um TODO');
ok(ch('job:src/main/java/bl/RelatorioJob.java:gerarRelatorioDiario') && ch('job:src/main/java/bl/RelatorioJob.java:gerarRelatorioDiario')!.grupo === 'Tarefas agendadas', 'tarefa agendada (@Scheduled) entra');
ok(ch('api:GET /pedidos') && ch('api:POST /pedidos/:id/pagar') && /not implemented/.test(ch('api:GET /pedidos')!.sinais.inacabado || ''), 'Express: as rotas, com o sinal "not implemented"');
ok(ch('tela:/') && ch('tela:/carteira'), 'React Router: as telas');
ok(ch('tela:/relatorios') && ch('api:ANY /api/saldo') && !inv.some(i => /_app/.test(i.onde)), 'Next.js: página vira tela, pages/api vira API, _app não entra');
ok(ch('fn:enviar-avisos') && ch('tela:public/login.html')!.nome === 'Tela Entrar no BL', 'função do Supabase e tela HTML (com o título)');
ok(!inv.some(i => /Test\.java/.test(i.onde)), 'arquivo de teste não vira item');
ok(motivosInacabado(ch('api:POST /clientes/{id}/bloquear')!).length === 1 && motivosInacabado(ch('tela:/carteira')!).length === 0, 'o motivo de "Precisa análise" sai dos sinais; sem sinal, parece pronto');
const e: any = { papeis: [], tabelas: ['chat_mensagens', 'chat_salas', 'chat_membros', 'clientes', 'logs_antigos'].map(n => ({ esquema: 'public', nome: n, tipo: 'r', rls: true, colunas: [{ nome: 'id' }], restricoes: [], permissoes: [], regras: [] })) };
const pal = palavrasDoCodigo(new Map([['a.js', 'select * from clientes; supabase.from("chat_salas")']]));
const ib = inventarioDoBanco(e, pal);
ok(ib.filter(i => i.grupo === 'Banco: Chat').length === 3 && ib.find(i => i.nome === 'Tabela clientes')!.grupo === 'Banco: outras tabelas', 'tabelas agrupadas pelo prefixo (3 ou mais), as outras juntas');
ok(ib.find(i => i.nome === 'Tabela clientes')!.sinais.usada === true && ib.find(i => i.nome === 'Tabela logs_antigos')!.sinais.usada === false && motivosInacabado(ib.find(i => i.nome === 'Tabela logs_antigos')!).length === 1, 'sabe se o código usa a tabela; a que não é usada precisa de análise');
ok(inventarioDoBanco(e, null)[0].sinais.usada === null, 'sem o código junto, não diz se a tabela é usada');
console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
