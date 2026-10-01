// Testes da análise de segurança. Rodar da raiz do repositório:
//   node --experimental-strip-types supabase/functions/diagramas-auto/seguranca.test.ts
// Opcional: BANCO_URL=postgresql://... (ou BANCO_SOCKET=/tmp:55432/banco) (com o pacote postgres no NODE_PATH) para ler um banco de verdade com falhas plantadas.
import { createRequire } from 'node:module';
import { analisarCodigo, analisarBanco, dependenciasDe, analisarDependencias, nota, REGRAS } from './seguranca.ts';
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
  ['src/main/resources/application.properties', 'spring.datasource.url=jdbc:postgresql://db:5432/bl\nspring.datasource.password=SenhaReal123\nspring.datasource.username=${DB_USER}\napp.token=${TOKEN}'],
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
ok(tem(ac, 'SEG-03', /application\.properties:2$/) && !tem(ac, 'SEG-03', /application\.properties:3$/), 'senha escrita no application.properties é achada; ${DB_USER} não');
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
const falso = (async (_u: string, o: any) => { const q = JSON.parse(o.body).queries; return { ok: true, json: async () => ({ results: q.map((x: any) => x.package.name === 'lodash' ? { vulns: [{ id: 'GHSA-p6mc-m468-83gw' }, { id: 'CVE-2020-8203' }] } : {}) }) }; }) as unknown as typeof fetch;
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
      create table teste_seg.escancarada (id serial primary key); alter table teste_seg.escancarada enable row level security;
      create policy todos on teste_seg.escancarada for insert to anon with check (true);
      do $$ begin if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if; if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if; end $$;
      grant select, insert on teste_seg.aberta to anon; grant select on teste_seg.protegida to authenticated; grant insert on teste_seg.escancarada to anon;`);
    const [l] = await sql.unsafe(CONSULTA_BANCO, [['teste_seg']]);
    const real = analisarBanco(l.estrutura);
    ok(tem(real, 'BD-01', /aberta$/) && tem(real, 'BD-04', /aberta$/) && tem(real, 'BD-03', /escancarada$/) && !real.some(a => /protegida$/.test(a.onde)), 'banco de verdade: acha as falhas plantadas e deixa a tabela protegida em paz (' + real.map(a => a.regra + ' ' + a.onde).join(', ') + ')');
    await sql.unsafe('set client_min_messages = warning; drop schema teste_seg cascade');
  } finally { await sql.end(); }
}
console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
