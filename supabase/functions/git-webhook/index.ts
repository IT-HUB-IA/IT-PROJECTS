// Edge Function git-webhook (verify_jwt: false, porque quem chama é o GitHub ou o GitLab, sem login).
// GitHub: o endereço vai no app do CicloDev (criado pela tela Admin): https://<projeto>.supabase.co/functions/v1/git-webhook
// GitLab: o CicloDev cria o aviso em cada projeto ligado, com ?r=<id do repositório>.
import { createClient } from "npm:@supabase/supabase-js@2";
import { tratar } from "./logica.ts";

const banco = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve((req) => tratar(req, (nome, args) => banco.rpc(nome, args)));
