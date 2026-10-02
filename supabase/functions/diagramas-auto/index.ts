// Edge Function diagramas-auto (verify_jwt: false). A lógica está em logica.ts e os desenhos em gerar.ts;
// aqui só se ligam o banco do CicloDev (service_role), o leitor de YAML, a conexão de leitura com o banco de cada sistema
// e o segundo plano. Segredos: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (o Supabase já dá), RENDER_URL e RENDER_TOKEN. O código se lê pela conta conectada (parte 32).
import { createClient } from "npm:@supabase/supabase-js@2";
import { parseAllDocuments } from "npm:yaml@2";
import { tratar } from "./logica.ts";
import { lerBanco } from "../_shared/ler_banco.ts";

const env = (n: string) => Deno.env.get(n);
const servico = createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve((req) => tratar(req, {
  env, buscar: fetch, lerBanco,
  rpc: async (nome, args) => (await servico.rpc(nome, args)) as any,
  yaml: (t) => parseAllDocuments(t).map((d: any) => { if (d.errors && d.errors.length) throw new Error(d.errors[0].message); return d.toJS(); }),
  emSegundoPlano: (p) => { const er = (globalThis as any).EdgeRuntime; if (er && er.waitUntil) er.waitUntil(p); else p.catch(() => {}); },
}));
