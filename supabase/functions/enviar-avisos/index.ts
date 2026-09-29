// Edge Function enviar-avisos (verify_jwt: false; quem chama é a rotina do banco, com o segredo AVISOS_SEGREDO).
// Segredos da função (Supabase > Edge Functions > Secrets): AVISOS_SEGREDO, RESEND_API_KEY, AVISOS_REMETENTE
// (ex.: CicloDev <avisos@it-ia.tec.br>) e, se quiser, CICLODEV_SITE (padrão https://ciclodev.it-ia.tec.br/entrar).
import { createClient } from "npm:@supabase/supabase-js@2";
import { enviarPeloResend, tratar } from "./logica.ts";

const banco = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const enviar = enviarPeloResend(Deno.env.get("RESEND_API_KEY") ?? "", Deno.env.get("AVISOS_REMETENTE") ?? "");
const cfg = { segredo: Deno.env.get("AVISOS_SEGREDO") ?? "", site: Deno.env.get("CICLODEV_SITE") ?? "https://ciclodev.it-ia.tec.br/entrar",
  envioPronto: !!Deno.env.get("RESEND_API_KEY") && !!Deno.env.get("AVISOS_REMETENTE") };

Deno.serve((req) => tratar(req, (nome, args) => banco.rpc(nome, args), enviar, cfg));
