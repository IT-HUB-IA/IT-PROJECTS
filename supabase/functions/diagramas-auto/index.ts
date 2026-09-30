// Edge Function diagramas-auto (verify_jwt: false). A lógica está em logica.ts e os desenhos em gerar.ts;
// aqui só se ligam o banco do CicloDev (service_role), o leitor de YAML, a conexão de leitura com o banco de cada sistema
// e o segundo plano. Segredos: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (o Supabase já dá), RENDER_URL e RENDER_TOKEN. O código se lê pela conta conectada (parte 32).
import { createClient } from "npm:@supabase/supabase-js@2";
import { parseAllDocuments } from "npm:yaml@2";
import postgres from "npm:postgres@3";
import { tratar } from "./logica.ts";
import { CONSULTA_BANCO } from "./gerar.ts";
import type { Estrutura } from "./gerar.ts";

const env = (n: string) => Deno.env.get(n);
const servico = createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

// só leitura: a sessão abre em read only, cada consulta tem no máximo 20 segundos e a conexão fecha no fim
async function lerBanco(conexao: string, esquemas: string[]): Promise<Estrutura> {
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

Deno.serve((req) => tratar(req, {
  env, buscar: fetch, lerBanco,
  rpc: async (nome, args) => (await servico.rpc(nome, args)) as any,
  yaml: (t) => parseAllDocuments(t).map((d: any) => { if (d.errors && d.errors.length) throw new Error(d.errors[0].message); return d.toJS(); }),
  emSegundoPlano: (p) => { const er = (globalThis as any).EdgeRuntime; if (er && er.waitUntil) er.waitUntil(p); else p.catch(() => {}); },
}));
