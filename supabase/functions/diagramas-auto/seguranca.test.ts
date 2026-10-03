// Testes da análise de segurança. Rodar da raiz do repositório:
//   node --experimental-strip-types supabase/functions/diagramas-auto/seguranca.test.ts
// Opcional: BANCO_URL=postgresql://... (ou BANCO_SOCKET=/tmp:55432/banco) (com o pacote postgres no NODE_PATH) para ler um banco de verdade com falhas plantadas.
import { createRequire } from 'node:module';
import { analisarCodigo, analisarBanco, analisarQualidade, dependenciasDe, analisarDependencias, nota, REGRAS } from './seguranca.ts';
import { CONSULTA_BANCO, interessa } from './gerar.ts';
import type { Estrutura } from './gerar.ts';

let falhas = 0;
const ok = (c: unknown, m: string) => { console.log((c ? 'OK    ' : 'FALHA ') + m); if (!c) falhas++; };
const tem = (l: { regra: string; onde: string }[], regra: string, onde: RegExp) => l.some(a => a.regra === regra && onde.test(a.onde));

// um sistema de exemplo com as falhas mais comuns (e os casos que NÃO podem dar alarme)
const svc = 'eyJhbGciOiJIUzI1NiJ9.' + btoa(JSON.stringify({ role: 'service_role', iss: 'supabase' })).replace(/=+$/, '') + '.assinaturaQualquerComMaisDeVinteLetras';
const anon = 'eyJhbGciOiJIUzI1NiJ9.' + btoa(JSON.stringify({ role: 'anon', iss: 'supabase' })).replace(/=+$/, '') + '.assinaturaQualquerComMaisDeVinteLetras';
const arq = new Map<string, string>([
  ['src/main/java/bl/ClienteDao.java', 'class ClienteDao {\n  List<Cliente> buscar(String cpf) {\n    return stmt.executeQuery("select * from clientes where cpf = \'" + cpf + "\'");\n  }\n  ok(String id){ ps = con.prepareStatement("select * from clientes where id = ?"); }\n  String h = MessageDigest.getInstance("MD5");\n}'],
  ['src/main/resources/application.properties', 'spring.datasource.url=jdbc:postgresql://db:5432/bl\nspring.datasource.password=SenhaReal123\nspring.datasource.username=${DB_USER}\napp.token=${TOKEN}\nspring.datasource.password=COLOQUE_SUA_SENHA_AQUI'],
  ['web/src/supabase.js', "export const sb = createClient(url, '" + svc + "');\nexport const pub = createClient(url, '" + anon + "');\nconst aws = 'AKIAABCDEFGHIJKLMNOP';"],
  ['web/src/tela.js', 'el.innerHTML = "<b>" + nome + "</b>";\nel.innerHTML = "";\nok.textContent = nome;\nconst t = Math.random().toString(36); // token de convite\nfetch("http://api.parceiro.com.br/v1");\nfetch("http://localhost:3000");\nconsole.log("login", senha);\ncors({ origin: "*" });'],
  ['web/src/node.js', 'const https = require("https"); new https.Agent({ rejectUnauthorized: false });\nconst q = await db.query(`select * from pedidos where id = ${id}`);\nconst ok = await db.query("select * from pedidos where id = $1", [id]);\nexec(`ls ${pasta}`);\nconst dados = jwt.decode(token);'],
  ['web/src/__tests__/tela.test.js', 'el.innerHTML = nome; // em teste não conta'],
  ['web/package.json', JSON.stringify({ dependencies: { lodash: '^4.17.15', react: '18.2.0', local: 'file:../x' } })],
  ['pom.xml', '<project><properties><jackson.version>2.9.8</jackson.version></properties><dependencies><dependency><groupId>com.fasterxml.jackson.core</groupId><artifactId>jackson-databind</artifactId><version>${jackson.version}</version></dependency></dependencies></project>'],
]);
const caminhos = [...arq.keys(), '.env', '.env.example', 'certs/servidor.key'];
const ac = analisarCodigo(arq, caminhos);
ok(tem(ac, 'INJ-01', /ClienteDao\.java:3$/) && !tem(ac, 'INJ-01', /ClienteDao\.java:5$/), 'SQL montado com + no Java é achado; o prepareStatement com ? não');
ok(tem(ac, 'INJ-01', /node\.js:2$/) && !tem(ac, 'INJ-01', /node\.js:3$/), 'SQL com ${} no Node é achado; com $1 não');
ok(tem(ac, 'SEG-03', /application\.properties:2$/) && !tem(ac, 'SEG-03', /application\.properties:3$/) && !tem(ac, 'SEG-03', /application\.properties:5$/), 'senha escrita no application.properties é achada; ${DB_USER} e o texto de exemplo COLOQUE_SUA_SENHA_AQUI não');
ok(tem(ac, 'SEG-02', /supabase\.js:1$/) && !tem(ac, 'SEG-02', /supabase\.js:2$/), 'chave service_role do Supabase é achada; a anon (pública) não');
ok(tem(ac, 'SEG-01', /supabase\.js:3$/), 'chave da AWS é achada');
ok(!ac.some(a => a.trecho.includes('AKIAABCDEFGHIJKLMNOP') || a.trecho.includes('SenhaReal123')), 'o segredo nunca aparece inteiro no achado (vem mascarado)');
ok(tem(ac, 'SEG-04', /^\.env$/) && tem(ac, 'SEG-04', /servidor\.key$/) && !tem(ac, 'SEG-04', /example/), '.env e chave privada no repositório são achados; .env.example não');
ok(tem(ac, 'XSS-01', /tela\.js:1$/) && !tem(ac, 'XSS-01', /tela\.js:2$/) && !tem(ac, 'XSS-01', /tela\.test/), 'innerHTML com variável é achado; com texto vazio não; em teste não');
ok(tem(ac, 'CRI-02', /tela\.js:4$/) && tem(ac, 'TLS-02', /tela\.js:5$/) && !tem(ac, 'TLS-02', /tela\.js:6$/), 'Math.random para token e http:// de parceiro são achados; localhost não');
ok(tem(ac, 'LOG-01', /tela\.js:7$/) && tem(ac, 'CFG-01', /tela\.js:8$/), 'senha no console.log e CORS aberto são achados');
ok(tem(ac, 'TLS-01', /node\.js:1$/) && tem(ac, 'INJ-03', /node\.js:4$/) && tem(ac, 'JWT-01', /node\.js:5$/), 'certificado desligado, comando montado e jwt.decode são achados');
ok(tem(ac, 'CRI-01', /ClienteDao\.java:6$/), 'MD5 é achado');
const ac2 = analisarCodigo(new Map([...arq].map(([k, v]) => [k, '\n\n' + v])), caminhos);
ok(ac.every(a => ac2.some(b => b.impressao === a.impressao)), 'o mesmo achado mantém a mesma identidade quando a linha muda de número (a próxima análise reconhece)');
ok(ac.every(a => REGRAS.some(r => r.id === a.regra && r.fonte.startsWith('OWASP') && r.porque && r.correcao)), 'todo achado tem regra com fonte OWASP, o porquê e como corrigir');
ok(interessa('src/main/resources/application.properties', 100) && interessa('.env', 50) && interessa('web/index.html', 100), 'a leitura do código guarda também configurações, .env e HTML');

const deps = dependenciasDe(arq);
ok(deps.some(d => d.nome === 'lodash' && d.versao === '4.17.15') && deps.some(d => d.nome === 'com.fasterxml.jackson.core:jackson-databind' && d.versao === '2.9.8') && !deps.some(d => d.nome === 'local'), 'dependências do package.json e do pom.xml (com ${versão}) são lidas');
// OSV de mentira (a rede pode não estar disponível no teste)
const falso = (async (u: string, o: any) => {
  if (/\/vulns\//.test(u)) return { ok: true, json: async () => ({ id: u.split('/').pop(), aliases: ['CVE-2020-8203'], database_specific: { severity: 'HIGH' }, affected: [{ package: { name: 'lodash' }, ranges: [{ type: 'SEMVER', events: [{ introduced: '0' }, { fixed: '4.17.19' }] }] }] }) };
  const q = JSON.parse(o.body).queries; return { ok: true, json: async () => ({ results: q.map((x: any) => x.package.name === 'lodash' ? { vulns: [{ id: 'GHSA-p6mc-m468-83gw' }, { id: 'GHSA-29mw-wpgm-hmr9' }] } : {}) }) }; }) as unknown as typeof fetch;
const od = await analisarDependencias(deps, falso);
ok(od.achados.length === 1 && od.achados[0].regra === 'DEP-01' && /lodash 4\.17\.15: 2 falhas/.test(od.achados[0].titulo) && /CVE-2020-8203/.test(od.achados[0].trecho), 'biblioteca com falha conhecida vira achado, com os códigos CVE/GHSA');
if (process.env.OSV){ const real = await analisarDependencias(deps, fetch); ok(real.achados.some(a => /lodash/.test(a.titulo)) || !!real.erro, 'OSV de verdade: ' + (real.erro || real.achados.map(a => a.titulo).join(' | '))); }

// banco: estrutura de exemplo (o mesmo formato da CONSULTA_BANCO)
const tab = (nome: string, o: any) => Object.assign({ esquema: 'public', nome, tipo: 'r', rls: false, rls_forcado: false, nota: null, colunas: [{ nome: 'id', tipo: 'uuid', nao_nulo: true, padrao: null, nota: null }], restricoes: [{ nome: nome + '_pkey', tipo: 'p', cols: ['id'], ref_esquema: null, ref_tabela: null, ref_cols: null }], permissoes: [], regras: [] }, o);
const e: Estrutura = { papeis: [], tabelas: [
  tab('clientes', { permissoes: [{ papel: 'anon', privs: ['SELECT', 'INSERT'] }], colunas: [{ nome: 'id', tipo: 'uuid' }, { nome: 'cpf', tipo: 'text' }, { nome: 'senha', tipo: 'text' }] }),
  tab('pedidos', { rls: true, permissoes: [{ papel: 'anon', privs: ['INSERT'] }, { papel: 'authenticated', privs: ['SELECT', 'UPDATE'] }],
    regras: [{ nome: 'qualquer insere', comando: 'a', permissiva: true, papeis: ['anon'], usando: null, checa: 'true' }, { nome: 'dono ve', comando: 'r', permissiva: true, papeis: ['authenticated'], usando: '(dono_id = auth.uid())', checa: null }] }),
  tab('notas', { permissoes: [{ papel: 'authenticated', privs: ['SELECT'] }] }),
  tab('logs', { rls: true, restricoes: [], permissoes: [{ papel: 'authenticated', privs: ['SELECT'] }] }),
  tab('certa', { rls: true, permissoes: [{ papel: 'authenticated', privs: ['SELECT'] }], regras: [{ nome: 'dono', comando: 'r', permissiva: true, papeis: ['authenticated'], usando: '(dono_id = auth.uid())', checa: null }] }),
] } as any;
const ab = analisarBanco(e);
ok(tem(ab, 'BD-01', /clientes$/) && tem(ab, 'BD-04', /clientes$/) && tem(ab, 'BD-07', /clientes$/), 'tabela com anon e sem RLS, com CPF e senha em texto: BD-01, BD-04 e BD-07');
ok(tem(ab, 'BD-03', /pedidos$/) && !tem(ab, 'BD-01', /pedidos$/), 'política de inserir com true para anon: BD-03 (mesmo com RLS ligada)');
ok(tem(ab, 'BD-02', /notas$/), 'tabela de logados sem RLS: BD-02');
ok(tem(ab, 'BD-09', /logs$/) && tem(ab, 'BD-08', /logs$/), 'RLS sem regras e sem chave primária: BD-09 e BD-08');
ok(!ab.some(a => /certa$/.test(a.onde)), 'tabela bem configurada não tem achado');
ok(nota(ab) < nota(ab.filter(a => a.gravidade !== 'critica')), 'a nota cai com achado crítico');

// qualidade do código
{
  const longa = 'function processarTudo(x) {\n' + Array.from({length: 90}, (_, k) => '  const v' + k + ' = x + ' + k + ';').join('\n') + '\n  return x;\n}\n';
  const bloco = Array.from({length: 9}, (_, k) => '  total = total + calcularImpostoDoItem(item' + k + ', aliquota);').join('\n');
  const q = new Map<string, string>([
    ['src/servico.js', longa + 'try { salvar(); } catch (e) {}\n// TODO: falta validar o CPF\nconsole.log(1);\nconsole.log(2);\nconsole.log(3);\n' + bloco],
    ['src/outro.js', 'function a(){\n' + bloco + '\n}'],
    ['src/curto.js', 'export const soma = (a, b) => a + b;'], ['src/c.js', 'x'], ['src/d.js', 'y'], ['src/e.js', 'z'],
  ]);
  const aq = analisarQualidade(q, [...q.keys()]);
  ok(tem(aq, 'QUA-02', /servico\.js:1$/) && !tem(aq, 'QUA-02', /curto/), 'função de mais de 80 linhas é achada; a curta não');
  ok(tem(aq, 'QUA-04', /servico\.js/) && tem(aq, 'QUA-05', /servico\.js/) && tem(aq, 'QUA-06', /servico\.js/), 'catch vazio, TODO e console.log esquecido são achados');
  ok(tem(aq, 'QUA-03', /outro\.js|servico\.js/), 'o mesmo bloco de 8 linhas em dois arquivos é achado como repetição');
  ok(tem(aq, 'QUA-07', /repositório/), 'repositório sem nenhum teste é achado');
  const comTeste = new Map(q); comTeste.set('src/__tests__/servico.test.js', 'test("x", () => {})');
  ok(!tem(analisarQualidade(comTeste, [...comTeste.keys()]), 'QUA-07', /./), 'com um teste, o QUA-07 some');
}
// arquitetura do banco e MySQL
{
  const t2 = (nome: string, o: any) => Object.assign({ esquema: 'public', nome, tipo: 'r', rls: true, rls_forcado: false, nota: null, colunas: [{ nome: 'id', tipo: 'uuid' }], restricoes: [{ nome: nome + '_pkey', tipo: 'p', cols: ['id'], ref_esquema: null, ref_tabela: null, ref_cols: null }], permissoes: [], regras: [], indices: [['id']] }, o);
  const ea = { papeis: [], tabelas: [
    t2('pedidos', { colunas: [{ nome: 'id', tipo: 'uuid' }, { nome: 'cliente_id', tipo: 'uuid' }, { nome: 'loja_id', tipo: 'uuid' }, { nome: 'vendedor_id', tipo: 'uuid' }],
      restricoes: [{ nome: 'pedidos_pkey', tipo: 'p', cols: ['id'] }, { nome: 'fk1', tipo: 'f', cols: ['cliente_id'], ref_tabela: 'clientes' }, { nome: 'fk2', tipo: 'f', cols: ['loja_id'], ref_tabela: 'lojas' }], indices: [['id'], ['loja_id']] }),
  ] } as any;
  const aa = analisarBanco(ea);
  ok(aa.some(a => a.regra === 'ARQ-01' && /cliente_id/.test(a.trecho)) && !aa.some(a => a.regra === 'ARQ-01' && /loja_id/.test(a.trecho)), 'chave estrangeira sem índice é achada; com índice não');
  ok(aa.some(a => a.regra === 'ARQ-02' && /vendedor_id/.test(a.trecho)) && !aa.some(a => a.regra === 'ARQ-02' && /cliente_id/.test(a.trecho)), 'coluna _id sem chave estrangeira é achada');
  const em = { papeis: [], tabelas: [t2('usuarios', { rls: false, restricoes: [], colunas: [{ nome: 'id', tipo: 'int' }, { nome: 'senha', tipo: 'varchar(100)' }], permissoes: [{ papel: 'PUBLIC', privs: ['SELECT'] }], indices: undefined })] } as any;
  const am = analisarBanco(em, { mysql: true });
  ok(tem(am, 'BD-07', /usuarios/) && tem(am, 'BD-08', /usuarios/) && !am.some(a => /^BD-0[1-46]/.test(a.regra)), 'MySQL: senha em texto e falta de chave primária são achadas; as regras de RLS não se aplicam');
}

// banco de verdade: as falhas plantadas no Postgres local
if (process.env.BANCO_URL || process.env.BANCO_SOCKET) {
  const postgres = createRequire(import.meta.url)('postgres');
  // BANCO_SOCKET=/tmp:55432/banco para o Postgres local que só escuta no socket
  const so = (process.env.BANCO_SOCKET || '').match(/^([^:]+):(\d+)\/(.+)$/);
  const sql = so ? postgres({ host: so[1], port: +so[2], database: so[3], username: 'postgres', max: 1, prepare: false }) : postgres(process.env.BANCO_URL, { max: 1, prepare: false });
  try {
    await sql.unsafe(`set client_min_messages = warning; drop schema if exists teste_seg cascade; create schema teste_seg;
      create table teste_seg.aberta (id serial primary key, cpf text, senha text);
      create table teste_seg.protegida (id serial primary key, dono uuid); alter table teste_seg.protegida enable row level security;
      create policy dono on teste_seg.protegida for select to authenticated using (dono = gen_random_uuid());
      create table teste_seg.escancarada (id serial primary key, aberta_id int references teste_seg.aberta(id)); alter table teste_seg.escancarada enable row level security;
      create policy todos on teste_seg.escancarada for insert to anon with check (true);
      do $$ begin if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if; if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if; end $$;
      grant select, insert on teste_seg.aberta to anon; grant select on teste_seg.protegida to authenticated; grant insert on teste_seg.escancarada to anon;`);
    const [l] = await sql.unsafe(CONSULTA_BANCO, [['teste_seg']]);
    const real = analisarBanco(l.estrutura);
    ok(tem(real, 'BD-01', /aberta$/) && tem(real, 'BD-04', /aberta$/) && tem(real, 'BD-03', /escancarada$/) && tem(real, 'ARQ-01', /escancarada$/) && !real.some(a => /protegida$/.test(a.onde)), 'banco de verdade: acha as falhas plantadas e deixa a tabela protegida em paz (' + real.map(a => a.regra + ' ' + a.onde).join(', ') + ')');
    await sql.unsafe('set client_min_messages = warning; drop schema teste_seg cascade');
  } finally { await sql.end(); }
}
console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
