// Edge Function git-conectar (verify_jwt: true). A lógica está em logica.ts.
// Dois clientes do banco: o da pessoa logada (o que é dela, com as regras de acesso) e o de serviço (só os segredos do app e das contas).
// Não precisa de chave própria: o app do GitHub e o do GitLab ficam no banco (interno.git_apps), criados pela tela Admin.
import { createClient } from "npm:@supabase/supabase-js@2";
import { tratar } from "./logica.ts";

const env = (n: string) => Deno.env.get(n);
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, x-client-info, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS" };
const servico = createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const usuario = createClient(env("SUPABASE_URL")!, env("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("authorization") || "" } }, auth: { persistSession: false } });
  const r = await tratar(req, {
    env, buscar: fetch,
    // o cliente do Supabase devolve um "thenable" sem catch: vira promessa de verdade aqui
    rpc: async (nome, args) => (await servico.rpc(nome, args)) as any,
    rpcUsuario: async (nome, args) => (await usuario.rpc(nome, args)) as any,
    ler: async (tabela, id) => { const { data } = await usuario.from(tabela).select("*").eq("id", id).maybeSingle(); return data; },
    apagar: async (tabela, id) => { const { data, error } = await usuario.from(tabela).delete().eq("id", id).select("id"); return !error && !!data && data.length > 0; },
  });
  Object.entries(cors).forEach(([k, v]) => r.headers.set(k, v));
  return r;
});
