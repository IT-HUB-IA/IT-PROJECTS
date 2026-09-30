// Testes dos desenhos automáticos. Rodar da raiz do repositório:
//   NODE_PATH=<pasta com o pacote yaml instalado> node --experimental-strip-types supabase/functions/diagramas-auto/gerar.test.ts
// Opcional: REPOS="caminho1 caminho2" para ler também o código real de outros repositórios (empacotado com git archive,
// igual ao que o GitHub entrega), SAIDA=<pasta> para gravar os desenhos gerados e validar com as ferramentas de verdade,
// e BANCO_URL=postgresql://... para ler a estrutura de um banco Postgres (com o pacote postgres no NODE_PATH).
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { lerTarGz, gerarDoCodigo, gerarSoftware, gerarInfra, gerarRotas, gerarPrisma, gerarDer, gerarAcesso, gerarDoBanco, resumoEstrutura, interessa, CONSULTA_BANCO } from './gerar.ts';
import type { Estrutura, Desenho } from './gerar.ts';

const req = createRequire(import.meta.url);
const YAML = req('yaml');
const yaml = (t: string) => YAML.parseAllDocuments(t).map((d: any) => d.toJS());
let falhas = 0;
const ok = (c: unknown, m: string) => { console.log((c ? 'OK    ' : 'FALHA ') + m); if (!c) falhas++; };
const SAIDA = process.env.SAIDA;
const guardar = (prefixo: string, d: Desenho) => { if (!SAIDA) return; mkdirSync(SAIDA, { recursive: true }); writeFileSync(SAIDA + '/' + prefixo + '__' + d.tipo.replace(/[^\w-]/g, '_') + '.' + ({ plantuml: 'puml', graphviz: 'dot', mermaid: 'mmd', dbml: 'dbml' } as Record<string, string>)[d.formato], d.fonte); };

/* ---------- um projeto de exemplo de cada tipo ---------- */
const exemplo = new Map<string, string>(Object.entries({
  'package.json': JSON.stringify({ name: 'loja', workspaces: ['apps/*', 'packages/*'] }),
  'apps/web/package.json': JSON.stringify({ name: 'web', dependencies: { next: '15', react: '19', '@loja/ui': '*', zod: '3' } }),
  'apps/web/tsconfig.json': '{ // comentário\n "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["./src/*"] } } }',
  'apps/web/src/app/page.tsx': "import { Botao } from '@loja/ui';\nimport { buscar } from '@/lib/api';\nexport default function P(){ return null }",
  'apps/web/src/app/(loja)/produtos/[id]/page.tsx': "import { z } from 'zod';\nimport { buscar } from '../../../../lib/api';",
  'apps/web/src/app/api/pedidos/route.ts': "import { NextResponse } from 'next/server';\nimport { gravar } from '@/lib/api';",
  'apps/web/src/app/conta/page.tsx': "import React from 'react';",
  'apps/web/src/lib/api.ts': "import fs from 'node:fs';\nimport path from 'path';\nexport const buscar = 1, gravar = 2;",
  'packages/ui/package.json': JSON.stringify({ name: '@loja/ui', dependencies: { react: '19' } }),
  'packages/ui/src/index.ts': "export * from './Botao';",
  'packages/ui/src/Botao.tsx': "import React from 'react';\nexport const Botao = () => null;",
  'services/api/pom.xml': '<project/>',
  'services/api/src/main/java/com/loja/api/Aplicacao.java': 'package com.loja.api;\nimport org.springframework.boot.SpringApplication;\nimport com.loja.api.pedido.PedidoController;',
  'services/api/src/main/java/com/loja/api/pedido/PedidoController.java': 'package com.loja.api.pedido;\nimport com.loja.api.pagamento.Cobranca;\nimport org.springframework.web.bind.annotation.*;\n@RestController\n@RequestMapping("/pedidos")\nclass PedidoController {\n @GetMapping("/{id}") void um(){}\n @PostMapping void novo(){}\n}',
  'services/api/src/main/java/com/loja/api/pagamento/Cobranca.java': 'package com.loja.api.pagamento;\nimport java.util.List;\nimport jakarta.persistence.Entity;',
  'services/ml/pyproject.toml': '[project]\nname="ml"',
  'services/ml/app/main.py': 'from fastapi import FastAPI\nfrom .modelos import prever\nimport numpy as np\nimport os\napp = FastAPI()\n@app.get("/previsao")\ndef p(): pass\n@app.post("/treino")\ndef t(): pass',
  'services/ml/app/modelos.py': 'import json\ndef prever(): pass',
  'services/fila/go.mod': 'module github.com/loja/fila\n\ngo 1.22',
  'services/fila/main.go': 'package main\nimport (\n  "fmt"\n  "github.com/loja/fila/interno/trabalho"\n  "github.com/redis/go-redis/v9"\n)',
  'services/fila/interno/trabalho/trabalho.go': 'package trabalho\nimport "time"',
  'docker-compose.yml': 'services:\n  web:\n    build: ./apps/web\n    ports: ["3000:3000"]\n    depends_on: [api, banco]\n  api:\n    build:\n      context: services/api\n    depends_on:\n      banco:\n        condition: service_healthy\n  banco:\n    image: postgres:16\n    volumes:\n      - dados:/var/lib/postgresql/data\nvolumes:\n  dados: {}\n',
  'services/api/Dockerfile': 'FROM maven:3 AS build\nRUN mvn package\nFROM eclipse-temurin:21-jre\nEXPOSE 8080\n',
  'infra/main.tf': 'resource "aws_s3_bucket" "arquivos" {\n  bucket = "loja-arquivos" # {não conta}\n}\nresource "aws_cloudfront_distribution" "cdn" {\n  origin { domain_name = aws_s3_bucket.arquivos.bucket_regional_domain_name }\n}\nmodule "rede" {\n  source = "./rede"\n}\nresource "aws_db_instance" "banco" {\n  subnet = module.rede.id\n}\n',
  'k8s/app.yaml': 'apiVersion: apps/v1\nkind: Deployment\nmetadata: {name: web}\nspec:\n  template:\n    metadata:\n      labels: {app: web}\n---\napiVersion: v1\nkind: Service\nmetadata: {name: web-svc}\nspec:\n  selector: {app: web}\n---\napiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata: {name: entrada}\nspec:\n  rules:\n  - host: loja.com\n    http:\n      paths:\n      - path: /\n        backend: {service: {name: web-svc}}\n',
  'vercel.json': JSON.stringify({ framework: 'nextjs', crons: [{ path: '/api/limpar', schedule: '0 3 * * *' }], rewrites: [{ source: '/pag/(.*)', destination: 'https://pagamentos.exemplo.com/$1' }] }),
  'supabase/config.toml': 'project_id = "abcdef"\n',
  'supabase/functions/avisar/index.ts': "import { createClient } from 'npm:@supabase/supabase-js@2';\nconst s = createClient('', '');\nawait fetch('https://api.resend.com/emails');",
  '.github/workflows/publicar.yml': 'name: Publicar\non:\n  push:\n    branches: [main]\njobs:\n  web:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: amondnet/vercel-action@v25\n      - run: supabase functions deploy avisar\n      - uses: hashicorp/setup-terraform@v3\n',
  'prisma/schema.prisma': 'model Usuario {\n  id    Int     @id @default(autoincrement())\n  email String  @unique\n  nome  String?\n  papel Papel   @default(CLIENTE)\n  pedidos Pedido[]\n  @@map("usuarios")\n}\nmodel Pedido {\n  id Int @id @default(autoincrement())\n  usuarioId Int @map("usuario_id")\n  usuario Usuario @relation(fields: [usuarioId], references: [id])\n  total Decimal @default(0)\n  @@map("pedidos")\n}\nenum Papel {\n  CLIENTE\n  ADMIN\n}\n',
}));
const caminhosEx = [...exemplo.keys(), 'supabase/migrations/001_inicio.sql', 'supabase/migrations/002_pedidos.sql', 'public/logo.png'].sort();

const sw = gerarSoftware(exemplo, 'loja/monorepo')!;
ok(sw && sw.formato === 'plantuml' && sw.fonte.startsWith('@startuml') && sw.fonte.trim().endsWith('@enduml'), 'software: sai um PlantUML');
ok(/package "apps\/web"/.test(sw.fonte) && /package "packages\/ui"/.test(sw.fonte) && /package "services\/api"/.test(sw.fonte), 'software: cada pacote do monorepo vira um grupo');
const idDe = (rot: string) => (sw.fonte.match(new RegExp('component "' + rot.replace(/[/.]/g, '\\$&') + '\\\\n[^"]*" as (M\\d+)')) || [])[1];
ok(idDe('apps/web/app') && idDe('apps/web/lib') && new RegExp(idDe('apps/web/app') + ' --> ' + idDe('apps/web/lib') + ' : 3').test(sw.fonte), 'software: app → lib com 3 imports (relativo e pelo apelido @/ do tsconfig)');
ok(new RegExp(idDe('apps/web/app') + ' --> ' + idDe('packages/ui') ).test(sw.fonte), 'software: o pacote do próprio monorepo (@loja/ui) liga como módulo, não como biblioteca');
ok(idDe('services/api/pedido') && new RegExp(idDe('services/api/pedido') + ' --> ' + idDe('services/api/pagamento')).test(sw.fonte), 'software: Java liga pelo pacote declarado (pedido → pagamento)');
ok(new RegExp(idDe('services/fila') + ' --> ' + idDe('services/fila/interno')).test(sw.fonte), 'software: Go liga pelo go.mod');
ok(/component "services\/ml\/app\\n2 arquivos"/.test(sw.fonte), 'software: Python junta a pasta app');
ok(/"react"/.test(sw.fonte) && /"zod"/.test(sw.fonte) && /"org.springframework"/.test(sw.fonte) && /"numpy"/.test(sw.fonte) && /"github.com\/redis\/go-redis"/.test(sw.fonte), 'software: as bibliotecas de fora aparecem (npm, Maven, pip, Go)');
ok(!/"(fs|path|node:fs|os|json|fmt|time|java\.util)"/.test(sw.fonte), 'software: o que é da própria linguagem não aparece como biblioteca');
ok(gerarSoftware(exemplo, 'loja/monorepo')!.fonte === sw.fonte, 'software: a mesma entrada dá sempre o mesmo texto (não sobe versão à toa)');
ok(sw.evidencias.some(e => /apps\/web\/src\/app\/.+page\.tsx$/.test(e.fonte) && /lib\/api/.test(e.trecho)), 'software: cada ligação mostra o arquivo e a linha de onde veio');
guardar('exemplo', sw);

const inf = gerarInfra(exemplo, caminhosEx, 'loja/monorepo', yaml)!;
ok(inf && inf.formato === 'graphviz' && /^digraph infraestrutura \{/.test(inf.fonte), 'infraestrutura: sai um Graphviz');
// o id do nó cujo rótulo começa com t (no DOT a quebra de linha é o texto \n)
const rot = (t: string) => (inf.fonte.match(new RegExp('(n\\d+) \\[label="' + t.split('\n').map(x => x.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('\\\\n'))) || [])[1];
ok(rot('web') && rot('api') && new RegExp(rot('web') + ' -> ' + rot('api') + ' \\[label="depende de"\\]').test(inf.fonte), 'infraestrutura: Docker Compose com depends_on (lista)');
ok(new RegExp(rot('api') + ' -> ' + rot('banco') + ' \\[label="depende de"\\]').test(inf.fonte), 'infraestrutura: depends_on em forma de mapa também liga (api depende do banco)');
ok(/volume dados/.test(inf.fonte) && /grava em/.test(inf.fonte), 'infraestrutura: volume nomeado');
ok(/Imagem Docker\\nservices\/api\/Dockerfile\\nbase eclipse-temurin:21-jre\\nporta 8080/.test(inf.fonte) && /monta/.test(inf.fonte), 'infraestrutura: Dockerfile (último FROM) liga no serviço que ele monta');
ok(/Terraform · AWS/.test(inf.fonte) && rot('aws_cloudfront_distribution\ncdn') && new RegExp(rot('aws_cloudfront_distribution\ncdn') + ' -> ' + rot('aws_s3_bucket\narquivos') + ' ').test(inf.fonte) && new RegExp(rot('aws_db_instance\nbanco') + ' -> ' + rot('módulo rede') + ' ').test(inf.fonte), 'infraestrutura: Terraform com as referências entre recursos e módulos');
ok(/módulo rede/.test(inf.fonte), 'infraestrutura: módulo do Terraform');
ok(/Ingress\\nentrada/.test(inf.fonte) && /encaminha/.test(inf.fonte) && /loja\.com\//.test(inf.fonte), 'infraestrutura: Kubernetes (Ingress → Service → Deployment)');
ok(/rotina 0 3 \* \* \*/.test(inf.fonte) && /pagamentos\.exemplo\.com/.test(inf.fonte), 'infraestrutura: Vercel com rotina e repasse para fora');
ok(/Edge Function\\navisar/.test(inf.fonte) && /Postgres\\n2 migrações/.test(inf.fonte) && /api\.resend\.com/.test(inf.fonte) && /lê e grava/.test(inf.fonte), 'infraestrutura: Supabase (função, banco, migrações e a API que a função chama)');
ok(/GitHub Actions\\nPublicar\\nquando: push/.test(inf.fonte) && (inf.fonte.match(/publica em", lhead=cluster_\d+/g) || []).length === 3, 'infraestrutura: o fluxo do GitHub Actions publica na Vercel, no Supabase e no Terraform (a seta vai para o grupo inteiro)');
guardar('exemplo', inf);

const rt = gerarRotas(exemplo, caminhosEx, 'loja/monorepo')!;
ok(rt && rt.aba === 'ux' && rt.formato === 'mermaid' && rt.fonte.startsWith('flowchart LR'), 'rotas: sai um Mermaid na sub-aba Fluxos de Usuário');
ok(/\["\/produtos …"\]:::pasta/.test(rt.fonte) && /\["\/:id"\]/.test(rt.fonte) && /\["\/conta"\]/.test(rt.fonte) && !/\(loja\)/.test(rt.fonte), 'rotas: Next.js app router (grupo (loja) some, [id] vira :id)');
ok(/\["\/api\/pedidos"\]/.test(rt.fonte), 'rotas: rota de API do Next');
ok(/\["GET \/pedidos\/\{id\}"\]/.test(rt.fonte) && /\["POST \/pedidos"\]/.test(rt.fonte), 'rotas: Spring com o prefixo do @RequestMapping');
ok(/\["GET \/previsao"\]/.test(rt.fonte) && /\["POST \/treino"\]/.test(rt.fonte), 'rotas: FastAPI');
guardar('exemplo', rt);

const pr = gerarPrisma(exemplo, 'loja/monorepo')!;
ok(pr && /Table "usuarios" \{/.test(pr.fonte) && /"email" string \[unique, not null\]/.test(pr.fonte) && /"nome" string$/m.test(pr.fonte), 'Prisma: tabela com @@map, unique e campo opcional');
ok(/Ref: "pedidos"\."usuario_id" > "usuarios"\."id"/.test(pr.fonte), 'Prisma: a relação vira Ref, com o nome de coluna do @map');
ok(/Enum "Papel"/.test(pr.fonte) && /"papel" Papel \[not null, default: `CLIENTE`\]/.test(pr.fonte), 'Prisma: enum');
guardar('exemplo', pr);

const tudo = gerarDoCodigo({ arquivos: exemplo, caminhos: caminhosEx }, 'loja/monorepo', yaml);
ok(tudo.desenhos.map(d => d.tipo).join(',') === 'software,infra,rotas,prisma' && !tudo.avisos.length, 'do código: os 4 desenhos saem juntos, sem aviso');
const vazio = gerarDoCodigo({ arquivos: new Map([['README.md', '# oi']]), caminhos: ['README.md'] }, 'x/y', yaml);
ok(vazio.desenhos.length === 0 && !vazio.avisos.length, 'repositório sem código: nenhum desenho, sem erro');
const quebrado = gerarDoCodigo({ arquivos: new Map([['docker-compose.yml', 'services: [: :'], ['a.ts', "import x from 'y'"]]), caminhos: ['a.ts', 'docker-compose.yml'] }, 'x/y', yaml);
ok(quebrado.desenhos.some(d => d.tipo === 'software'), 'arquivo YAML quebrado não impede os outros desenhos');

ok(interessa('src/a.ts', 10) && !interessa('node_modules/x/a.js', 10) && !interessa('a/dist/b.js', 10) && !interessa('src/a.ts', 500_000) && !interessa('logo.png', 10) && interessa('.github/workflows/ci.yml', 10) && interessa('k8s/web.yaml', 10), 'só lê os arquivos que interessam (código e configuração, sem node_modules nem arquivos grandes)');

/* ---------- o pacote de verdade (tar.gz), igual ao do GitHub ---------- */
async function pacoteDe(repo: string) {
  const sha = execFileSync('git', ['-C', repo, 'rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8' }).trim();
  const arq = '/tmp/pacote-' + sha + '.tar.gz';
  execFileSync('sh', ['-c', 'git -C "' + repo + '" archive --format=tar --prefix=dono-repo-' + sha + '/ HEAD | gzip > ' + arq]);
  const t0 = Date.now();
  const p = await lerTarGz(Readable.toWeb(createReadStream(arq)) as unknown as ReadableStream<Uint8Array>);
  return { p, sha, ms: Date.now() - t0, n: Number(execFileSync('sh', ['-c', 'git -C "' + repo + '" ls-files | wc -l'], { encoding: 'utf8' }).trim()) };
}
const repos = (process.env.REPOS || '').split(/\s+/).filter(Boolean);
for (const r of repos) {
  const { p, sha, ms, n } = await pacoteDe(r);
  const nome = r.split('/').pop()!;
  ok(p.raiz === 'dono-repo-' + sha && p.caminhos.length === n, nome + ': o pacote foi lido inteiro (' + p.caminhos.length + ' de ' + n + ' arquivos, ' + Math.round(p.bytes / 1e6) + ' MB, ' + ms + ' ms), sem a pasta do commit no começo');
  ok(p.arquivos.size > 0 && [...p.arquivos.keys()].every(k => interessa(k, 0)), nome + ': guardou o texto só do que interessa (' + p.arquivos.size + ' arquivos)');
  const g = gerarDoCodigo(p, 'org/' + nome, yaml);
  ok(g.desenhos.length > 0 && !g.avisos.length, nome + ': saíram ' + g.desenhos.map(d => d.tipo).join(', ') + (g.avisos.length ? ' · avisos: ' + g.avisos.join('; ') : ''));
  const g2 = gerarDoCodigo(p, 'org/' + nome, yaml);
  ok(g.desenhos.every((d, i) => d.fonte === g2.desenhos[i].fonte), nome + ': rodar de novo dá o mesmo texto');
  g.desenhos.forEach(d => guardar(nome, d));
}

/* ---------- banco ---------- */
const est: Estrutura = {
  papeis: [{ nome: 'anon', ignora_rls: false }, { nome: 'authenticated', ignora_rls: false }, { nome: 'service_role', ignora_rls: true }],
  tabelas: [
    { esquema: 'public', nome: 'clientes', tipo: 'r', rls: true, rls_forcado: false, nota: "Quem compra (com 'aspas')", colunas: [
        { nome: 'id', tipo: 'uuid', nao_nulo: true, padrao: 'gen_random_uuid()', nota: null }, { nome: 'nome', tipo: 'text', nao_nulo: true, padrao: null, nota: 'nome completo' },
        { nome: 'criado_em', tipo: 'timestamp with time zone', nao_nulo: true, padrao: 'now()', nota: null }, { nome: 'dono', tipo: 'uuid', nao_nulo: false, padrao: null, nota: null }],
      restricoes: [{ nome: 'clientes_pkey', tipo: 'p', cols: ['id'], ref_esquema: null, ref_tabela: null, ref_cols: null }, { nome: 'clientes_dono_fkey', tipo: 'f', cols: ['dono'], ref_esquema: 'auth', ref_tabela: 'users', ref_cols: ['id'] }],
      permissoes: [{ papel: 'authenticated', privs: ['DELETE', 'INSERT', 'SELECT', 'UPDATE'] }, { papel: 'service_role', privs: ['DELETE', 'INSERT', 'SELECT', 'UPDATE'] }],
      regras: [{ nome: 'dono_ve', comando: 'r', permissiva: true, papeis: ['authenticated'], usando: '(dono = auth.uid())', checa: null }] },
    { esquema: 'public', nome: 'pedidos', tipo: 'r', rls: false, rls_forcado: false, nota: null, colunas: [
        { nome: 'cliente_id', tipo: 'uuid', nao_nulo: true, padrao: null, nota: null }, { nome: 'numero', tipo: 'integer', nao_nulo: true, padrao: null, nota: null },
        { nome: 'valor', tipo: 'numeric(10,2)', nao_nulo: false, padrao: "'0'::numeric", nota: null }, { nome: 'etiquetas', tipo: 'text[]', nao_nulo: false, padrao: null, nota: null }],
      restricoes: [{ nome: 'pedidos_pkey', tipo: 'p', cols: ['cliente_id', 'numero'], ref_esquema: null, ref_tabela: null, ref_cols: null }, { nome: 'pedidos_cliente_id_fkey', tipo: 'f', cols: ['cliente_id'], ref_esquema: 'public', ref_tabela: 'clientes', ref_cols: ['id'] }],
      permissoes: [{ papel: 'anon', privs: ['SELECT'] }], regras: [] },
    { esquema: 'public', nome: 'resumo', tipo: 'v', rls: false, rls_forcado: false, nota: null, colunas: [], restricoes: [], permissoes: [{ papel: 'authenticated', privs: ['SELECT'] }], regras: [] },
    { esquema: 'auth', nome: 'users', tipo: 'r', rls: false, rls_forcado: false, nota: null, colunas: [{ nome: 'id', tipo: 'uuid', nao_nulo: true, padrao: null, nota: null }], restricoes: [], permissoes: [], regras: [] },
  ] };
const der = gerarDer(est, 'public')!;
ok(der && der.formato === 'dbml' && der.aba === 'der', 'banco: DER em DBML');
ok(/Table "public"\."clientes" \[note: 'Quem compra \(com \\'aspas\\'\)'\] \{/.test(der.fonte) && /"id" uuid \[pk, not null, default: `gen_random_uuid\(\)`\]/.test(der.fonte), 'banco: tabela com nota, chave e valor padrão');
ok(/"criado_em" "timestamp with time zone"/.test(der.fonte) && /"valor" "numeric\(10,2\)"/.test(der.fonte) && /"etiquetas" "text\[\]"/.test(der.fonte), 'banco: tipos com espaço, parênteses e lista ficam entre aspas');
ok(/\("cliente_id", "numero"\) \[pk\]/.test(der.fonte), 'banco: chave composta');
ok(/Ref: "public"\."pedidos"\."cliente_id" > "public"\."clientes"\."id"/.test(der.fonte), 'banco: ligação entre tabelas');
ok(/Table "auth"\."users" \[headercolor: #9AA0A6/.test(der.fonte) && /Ref: "public"\."clientes"\."dono" > "auth"\."users"\."id"/.test(der.fonte), 'banco: tabela de outro esquema entra só com a coluna ligada');
ok(!/resumo/.test(der.fonte) && der.lacunas.some(l => /resumo/.test(l)), 'banco: visão fica fora do DER e é avisada');
const ac = gerarAcesso(est, ['public'])!;
ok(ac && ac.aba === 'seguranca' && /^digraph acesso/.test(ac.fonte), 'banco: mapa de acesso em Graphviz na sub-aba Segurança');
ok(/label="clientes\\nRLS ligado · 1 regra"/.test(ac.fonte) && /label="pedidos\\nRLS desligado"/.test(ac.fonte) && /fillcolor="#fde8e8"/.test(ac.fonte), 'banco: RLS ligado e desligado (desligado com acesso fica em vermelho)');
ok(/service_role\\nignora o RLS/.test(ac.fonte) && /label="ler"/.test(ac.fonte) && /label="ler, criar, mudar, apagar"/.test(ac.fonte), 'banco: papéis e o que cada um pode');
ok(ac.lacunas.some(l => /public\.pedidos/.test(l)) && ac.evidencias.some(e => /dono = auth\.uid\(\)/.test(e.trecho)), 'banco: avisa a tabela sem RLS e mostra o texto da regra');
ok(gerarDoBanco(est, ['public', 'auth']).map(d => d.tipo).join(',') === 'der:auth,der:public,acesso', 'banco: um DER por esquema e um mapa de acesso');
ok((await resumoEstrutura(est)) === (await resumoEstrutura(JSON.parse(JSON.stringify(est)))) && (await resumoEstrutura(est)) !== (await resumoEstrutura({ ...est, papeis: [] })), 'banco: o resumo da estrutura só muda quando a estrutura muda');
guardar('exemplo', der); guardar('exemplo', ac);

if (process.env.BANCO_URL) {
  const postgres = req('postgres');
  const sql = postgres(process.env.BANCO_URL, { max: 1, connection: { default_transaction_read_only: 'on', statement_timeout: 20000 } });
  const esquemas = (process.env.BANCO_ESQUEMAS || 'public').split(',');
  const [linha] = await sql.unsafe(CONSULTA_BANCO, [esquemas]);
  await sql.end();
  const e: Estrutura = linha.estrutura;
  ok(e.tabelas.length > 0, 'banco de verdade: leu ' + e.tabelas.length + ' tabelas e visões de ' + esquemas.join(', ') + ' (' + e.tabelas.filter(t => t.rls).length + ' com RLS, ' + e.tabelas.reduce((s, t) => s + t.regras.length, 0) + ' regras, papéis: ' + e.papeis.map(p => p.nome).join(', ') + ')');
  const ds = gerarDoBanco(e, esquemas);
  ok(ds.length === esquemas.length + 1, 'banco de verdade: saíram ' + ds.map(d => d.tipo).join(', '));
  ds.forEach(d => guardar('banco', d));
}

console.log(falhas ? falhas + ' FALHAS' : 'TUDO OK');
if (falhas) process.exit(1);
