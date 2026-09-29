// Edge Function git-webhook (verify_jwt: false, porque quem chama é o GitHub ou o GitLab, sem login).
// Endereço que vai no repositório: https://<projeto>.supabase.co/functions/v1/git-webhook?r=<id do repositório>
import { createClient } from "npm:@supabase/supabase-js@2";
import { tratar } from "./logica.ts";

const banco = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve((req) => tratar(req, (args) => banco.rpc("git_receber", args)));
