// Testes do inventário do que já existe. Rodar da raiz: node --experimental-strip-types supabase/functions/diagramas-auto/inventario.test.ts
import { inventarioDoCodigo, inventarioDoBanco, palavrasDoCodigo, motivosInacabado, arquivoDe } from './inventario.ts';
import { datasDasMigracoes, estruturaMysql } from './gerar.ts';
import { historicoDosArquivos, listarPublicacoes } from '../_shared/git.ts';
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
  ['api/conexa.js', 'export const cobrar = () => fetch("https://api.conexa.app/v2/charges", {method:"POST"});\nconst x = fetch("http://localhost:3000/teste");'],
  ['package.json', '{"dependencies":{"stripe":"14.1.0","express":"4.19.2"}}'],
  ['Dockerfile', 'FROM node:20'],
  ['.github/workflows/deploy.yml', 'name: Publicar na VPS\non: push'],
  ['vercel.json', '{}'],
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
ok(!inv.some(i => i.tipo !== 'teste' && /Test\.java/.test(i.onde)), 'arquivo de teste não vira tela nem API (só item em Testes)');
ok(motivosInacabado(ch('api:POST /clientes/{id}/bloquear')!).length === 1 && motivosInacabado(ch('tela:/carteira')!).length === 0, 'o motivo de "Precisa análise" sai dos sinais; sem sinal, parece pronto');
const e: any = { papeis: [], tabelas: ['chat_mensagens', 'chat_salas', 'chat_membros', 'clientes', 'logs_antigos'].map(n => ({ esquema: 'public', nome: n, tipo: 'r', rls: true, colunas: [{ nome: 'id' }], restricoes: [], permissoes: [], regras: [] })) };
const pal = palavrasDoCodigo(new Map([['a.js', 'select * from clientes; supabase.from("chat_salas")']]));
const ib = inventarioDoBanco(e, pal);
ok(ib.filter(i => i.grupo === 'Banco: Chat').length === 3 && ib.find(i => i.nome === 'Tabela clientes')!.grupo === 'Banco: outras tabelas', 'tabelas agrupadas pelo prefixo (3 ou mais), as outras juntas');
ok(ib.find(i => i.nome === 'Tabela clientes')!.sinais.usada === true && ib.find(i => i.nome === 'Tabela logs_antigos')!.sinais.usada === false && motivosInacabado(ib.find(i => i.nome === 'Tabela logs_antigos')!).length === 1, 'sabe se o código usa a tabela; a que não é usada precisa de análise');
ok(inventarioDoBanco(e, null)[0].sinais.usada === null, 'sem o código junto, não diz se a tabela é usada');
ok(ch('int:api.conexa.app') && ch('int:api.conexa.app')!.tipo === 'integracao' && ch('int:api.conexa.app')!.grupo === 'Integrações' && !inv.some(i => i.chave === 'int:localhost'), 'integrações: o sistema de fora que o código chama (e não o localhost)');
ok(ch('sdk:Stripe') && ch('sdk:Stripe')!.tipo === 'integracao', 'integrações: a biblioteca de um serviço conhecido (Stripe)');
ok(ch('infra:Dockerfile') && ch('infra:.github/workflows/deploy.yml')!.nome === 'Automação GitHub Actions: Publicar na VPS' && ch('infra:vercel.json')!.nome === 'Publicação na Vercel' && inv.filter(i => i.tipo === 'infra').every(i => i.grupo === 'Infraestrutura'), 'infraestrutura: Docker, GitHub Actions e Vercel');
ok(ch('teste:src/test/java/bl/ClienteControllerTest.java') && ch('teste:src/test/java/bl/ClienteControllerTest.java')!.grupo === 'Testes', 'testes: cada arquivo de teste vira item em Testes');
// ---------- datas de verdade ----------
const dm = datasDasMigracoes([
  { versao: '20250110120000', sql: 'create table public.clientes (id uuid);\ncreate table if not exists "pedidos" (id int)' },
  { versao: '20250305090000', sql: 'alter table public.clientes add column cpf text' }], ['public']);
ok(dm['public.clientes']?.criado === '2025-01-10' && dm['public.clientes']?.mudou === '2025-03-05' && dm['public.pedidos']?.criado === '2025-01-10', 'Supabase: a tabela nasce na migration que a criou e muda na última que mexeu nela');
const em = estruturaMysql([{ esquema: 'loja', nome: 'vendas', tipo: 'BASE TABLE', nota: '', criado: '2024-11-02 10:00:00', mudou: null }], [], []);
ok(em.datas?.['loja.vendas']?.criado === '2024-11-02' && em.datas?.['loja.vendas']?.mudou === '2024-11-02', 'MySQL: a data de criação da tabela vem do próprio banco');
const eD = { tabelas: [{ esquema: 'public', nome: 'clientes', tipo: 'r', rls: true, rls_forcado: false, nota: null, colunas: [], restricoes: [], permissoes: [], regras: [] }], papeis: [], datas: dm } as any;
ok(inventarioDoBanco(eD, null)[0].sinais.criado === '2025-01-10' && inventarioDoBanco(eD, null)[0].sinais.publicado === '2025-03-05', 'a tabela no inventário leva as datas');
ok(arquivoDe(ch('api:GET /clientes')!) === 'src/main/java/bl/ClienteController.java' && arquivoDe(ch('sdk:Stripe')!) === 'package.json', 'cada coisa sabe de que arquivo veio (para buscar as datas)');
// GitHub de mentira: commits por arquivo (com mais de 100, na última página) e as publicações
const chamadas: string[] = [];
const commit = (d: string) => ({ commit: { committer: { date: d } } });
const buscarGh = async (u: string) => { chamadas.push(u); const url = new URL(u);
  if (url.pathname.endsWith('/releases')) return new Response(JSON.stringify([{ tag_name: 'v1.1', name: 'Versão 1.1', published_at: '2025-05-01T10:00:00Z', body: 'b' }, { tag_name: 'v1.0', name: '', published_at: '2025-02-01T10:00:00Z' }, { tag_name: 'x', draft: true, published_at: '2025-01-01T00:00:00Z' }]));
  const path = url.searchParams.get('path');
  if (path === 'A.java') return new Response(JSON.stringify([commit('2025-06-01T00:00:00Z'), commit('2025-01-01T00:00:00Z')]));
  if (path === 'B.java' && url.searchParams.get('page') === '3') return new Response(JSON.stringify([commit('2024-05-05T00:00:00Z')]));
  if (path === 'B.java') return new Response(JSON.stringify(Array.from({ length: 100 }, (_, i) => commit(i ? '2025-01-01T00:00:00Z' : '2025-07-07T00:00:00Z'))), { headers: { link: '<https://api.github.com/x?page=2>; rel="next", <https://api.github.com/x?page=3>; rel="last"' } });
  return new Response('[]', { status: 404 }); };
const acesso = { provedor: 'github' as const, token: 't', base: 'https://api.github.com', conta: 'c' };
const h = await historicoDosArquivos({ rpc: async () => ({ data: null, error: null }), buscar: buscarGh as any }, acesso, { nome: 'it/bl' }, 'main', ['A.java', 'B.java', 'C.java']);
ok(h.get('A.java')?.criado.startsWith('2025-01-01') && h.get('A.java')?.publicado.startsWith('2025-06-01') && h.get('A.java')?.commits === 2, 'histórico: o primeiro e o último commit do arquivo');
ok(h.get('B.java')?.criado.startsWith('2024-05-05') && h.get('B.java')?.publicado.startsWith('2025-07-07') && h.get('B.java')?.commits === 201 && !h.has('C.java'), 'arquivo com mais de 100 commits: o primeiro vem da última página; sem histórico, fica sem data');
const pubs = await listarPublicacoes({ rpc: async () => ({ data: null, error: null }), buscar: buscarGh as any }, acesso, { nome: 'it/bl' });
ok(pubs.map(p => p.tag + ':' + p.nome + ':' + p.data.slice(0, 10)).join(',') === 'v1.0:v1.0:2025-02-01,v1.1:Versão 1.1:2025-05-01', 'publicações (releases): da mais antiga para a mais nova, sem rascunho');
console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
