// Edge Function supabase-conectar (verify_jwt: true). A lógica está em logica.ts; a conversa com o Supabase em _shared/supabase.ts.
// Dois clientes do banco: o da pessoa logada (o que é dela, com as regras de acesso) e o de serviço (só os segredos do app e das chaves).
// Não precisa de chave própria: o app OAuth do Supabase fica no banco (interno.supa_app), cadastrado pela tela Admin.
import { createClient } from "npm:@supabase/supabase-js@2";
import { tratar } from "./logica.ts";
import { lerBanco } from "../_shared/ler_banco.ts";

const env = (n: string) => Deno.env.get(n);
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, x-client-info, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS" };
const servico = createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const usuario = createClient(env("SUPABASE_URL")!, env("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("authorization") || "" } }, auth: { persistSession: false } });
  const r = await tratar(req, {
    buscar: fetch, lerBanco,
    rpc: async (nome, args) => (await servico.rpc(nome, args)) as any,
    rpcUsuario: async (nome, args) => (await usuario.rpc(nome, args)) as any,
    ler: async (tabela, id) => { const { data } = await usuario.from(tabela).select("*").eq("id", id).maybeSingle(); return data; },
  });
  Object.entries(cors).forEach(([k, v]) => r.headers.set(k, v));
  return r;
});
