// Edge Function diagramas-auto (verify_jwt: false). A lógica está em logica.ts e os desenhos em gerar.ts;
// aqui só se ligam o banco do CicloDev (service_role), o leitor de YAML, a conexão de leitura com o banco de cada sistema
// e o segundo plano. Segredos: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (o Supabase já dá), RENDER_URL e RENDER_TOKEN. O código se lê pela conta conectada (parte 32).
import { createClient } from "npm:@supabase/supabase-js@2";
import { parseAllDocuments } from "npm:yaml@2";
import postgres from "npm:postgres@3";
import mysql from "npm:mysql2@3/promise";
import { tratar } from "./logica.ts";
import { CONSULTA_BANCO, CONSULTAS_MYSQL, estruturaMysql } from "./gerar.ts";
import type { Estrutura } from "./gerar.ts";

const env = (n: string) => Deno.env.get(n);
const servico = createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

// só leitura: a sessão abre em read only, cada consulta tem no máximo 20 segundos e a conexão fecha no fim
async function lerBanco(conexao: string, esquemas: string[], motor: "postgres" | "mysql"): Promise<Estrutura> {
  if (motor === "mysql") return lerMysql(conexao, esquemas);
  const sql = postgres(conexao, {
    max: 1, connect_timeout: 10, idle_timeout: 2, prepare: false,
    ssl: /sslmode=/.test(conexao) ? undefined : "prefer",
    connection: { default_transaction_read_only: "on", statement_timeout: "20000", application_name: "ciclodev-diagramas" },
  } as any);
  try {
    const linhas = await sql.unsafe(CONSULTA_BANCO, [esquemas]);
    return (linhas[0] as any).estrutura as Estrutura;
  } finally { await sql.end({ timeout: 2 }).catch(() => {}); }
}

// MySQL (AWS RDS e Aurora MySQL): sessão só leitura, 20 segundos por consulta, e só o information_schema
async function lerMysql(conexao: string, esquemas: string[]): Promise<Estrutura> {
  const url = new URL(conexao), aws = /\.rds\.amazonaws\.com$/i.test(url.hostname) || url.searchParams.has("ssl");
  const c = await mysql.createConnection({
    host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)) || undefined, connectTimeout: 10000,
    ssl: aws ? { minVersion: "TLSv1.2", rejectUnauthorized: false } : undefined,
  });
  try {
    await c.query("SET SESSION TRANSACTION READ ONLY");
    await c.query("SET SESSION max_execution_time = 20000").catch(() => null);   // no MariaDB o nome é outro: segue sem
    const [t] = await c.query(CONSULTAS_MYSQL.tabelas, [esquemas]);
    const [co] = await c.query(CONSULTAS_MYSQL.colunas, [esquemas]);
    const [r] = await c.query(CONSULTAS_MYSQL.restricoes, [esquemas]);
    return estruturaMysql(t as any[], co as any[], r as any[]);
  } finally { await c.end().catch(() => {}); }
}

Deno.serve((req) => tratar(req, {
  env, buscar: fetch, lerBanco,
  rpc: async (nome, args) => (await servico.rpc(nome, args)) as any,
  yaml: (t) => parseAllDocuments(t).map((d: any) => { if (d.errors && d.errors.length) throw new Error(d.errors[0].message); return d.toJS(); }),
  emSegundoPlano: (p) => { const er = (globalThis as any).EdgeRuntime; if (er && er.waitUntil) er.waitUntil(p); else p.catch(() => {}); },
}));
