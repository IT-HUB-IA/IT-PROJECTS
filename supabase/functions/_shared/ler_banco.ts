// Ler a estrutura de um banco pelo endereço (usuário e senha), só leitura: usado pelo robô (diagramas-auto) e pelo botão
// Testar da tela de ligar banco (supabase-conectar). A sessão abre em read only, cada consulta tem no máximo 20 segundos.
import postgres from "npm:postgres@3";
import mysql from "npm:mysql2@3/promise";
import { CONSULTA_BANCO, CONSULTA_MIGRACOES, CONSULTAS_MYSQL, datasDasMigracoes, estruturaMysql } from "./estrutura.ts";
import type { Estrutura } from "./estrutura.ts";
import { CONSULTA_EXTRA } from "./mapa_consultas.ts";
import type { Extra } from "./mapa_consultas.ts";

// só leitura: a sessão abre em read only, cada consulta tem no máximo 20 segundos e a conexão fecha no fim
export async function lerBanco(conexao: string, esquemas: string[], motor: "postgres" | "mysql"): Promise<Estrutura> {
  if (motor === "mysql") return lerMysql(conexao, esquemas);
  const sql = postgres(conexao, {
    max: 1, connect_timeout: 10, idle_timeout: 2, prepare: false,
    ssl: /sslmode=/.test(conexao) ? undefined : "prefer",
    connection: { default_transaction_read_only: "on", statement_timeout: "20000", application_name: "ciclodev-diagramas" },
  } as any);
  try {
    const linhas = await sql.unsafe(CONSULTA_BANCO, [esquemas]);
    const e = (linhas[0] as any).estrutura as Estrutura;
    // as datas de cada tabela, pelas migrations do Supabase (sem elas, o banco segue sem datas)
    try { const m = await sql.unsafe(CONSULTA_MIGRACOES); const d = datasDasMigracoes(m as any[], esquemas); if (Object.keys(d).length) e.datas = d; } catch { /* banco sem migrations do Supabase */ }
    return e;
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


// o que o Mapa do Sistema lê além da estrutura: as palavras das funções, gatilhos e visões e as regras de valor (check). Só leitura, só o catálogo.
export async function lerExtra(conexao: string, motor: "postgres" | "mysql"): Promise<Extra> {
  if (motor === "mysql") {
    const url = new URL(conexao), aws = /\.rds\.amazonaws\.com$/i.test(url.hostname) || url.searchParams.has("ssl");
    const c = await mysql.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.slice(1)) || undefined, connectTimeout: 10000, ssl: aws ? { minVersion: "TLSv1.2", rejectUnauthorized: false } : undefined });
    try {
      await c.query("SET SESSION TRANSACTION READ ONLY");
      const [l] = await c.query(`select routine_definition as t from information_schema.routines where routine_schema not in ('mysql','sys','information_schema','performance_schema')
        union all select action_statement from information_schema.triggers where trigger_schema not in ('mysql','sys')
        union all select view_definition from information_schema.views where table_schema not in ('mysql','sys') limit 5000`);
      const s = new Set<string>();
      for (const x of l as any[]) for (const w of String(x.t || "").split(/[^A-Za-z0-9_]+/)) if (w.length >= 2 && w.length <= 63 && /[A-Za-z_]/.test(w)) s.add(w.toLowerCase());
      let checagens: Extra["checagens"] = [];
      try { const [k] = await c.query(`select tc.constraint_schema as esquema, tc.table_name as tabela, cc.check_clause as regra from information_schema.table_constraints tc
          join information_schema.check_constraints cc on cc.constraint_schema = tc.constraint_schema and cc.constraint_name = tc.constraint_name where tc.constraint_type = 'CHECK' limit 5000`);
        checagens = (k as any[]).map(x => ({ esquema: String(x.esquema), tabela: String(x.tabela), regra: String(x.regra).slice(0, 2000) })); } catch { /* MySQL antigo: sem check */ }
      return { palavras: [...s].slice(0, 60000), checagens };
    } finally { await c.end().catch(() => {}); }
  }
  const sql = postgres(conexao, { max: 1, connect_timeout: 10, idle_timeout: 2, prepare: false, ssl: /sslmode=/.test(conexao) ? undefined : "prefer",
    connection: { default_transaction_read_only: "on", statement_timeout: "20000", application_name: "ciclodev-mapa" } } as any);
  try { const l = await sql.unsafe(CONSULTA_EXTRA); const x = (l[0] as any)?.extra || {}; return { palavras: (x.palavras || []).map(String), checagens: x.checagens || [], funcoes: x.funcoes || [] }; }
  finally { await sql.end({ timeout: 2 }).catch(() => {}); }
}
