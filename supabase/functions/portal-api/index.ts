// Edge Function portal-api (verify_jwt: false; quem chama se identifica com a chave do portal, conferida no banco).
// Usa só os segredos que o Supabase já dá a toda função: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from "npm:@supabase/supabase-js@2";
import { tratar } from "./logica.ts";

const banco = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const rpc = (nome: string, args?: Record<string, unknown>) => banco.rpc(nome, args);
const membros = (tabela: string, portal: string) => banco.from(tabela).select("email, nome, ativo").eq("portal_id", portal).order("nome");

Deno.serve((req) => tratar(req, rpc, membros));
