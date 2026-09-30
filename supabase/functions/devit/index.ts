// Edge Function devit (verify_jwt: true). A lógica está em logica.ts; aqui só se ligam o banco e a IA.
// Segredos: SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY (o Supabase já dá) e ANTHROPIC_API_KEY
// (opcional: sem ela o DevIT conduz o guia e responde pelas perguntas frequentes). Opcional: DEVIT_MODELO.
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";
import { tratar } from "./logica.ts";
import type { Banco } from "./logica.ts";

const env = (n: string) => Deno.env.get(n);
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, x-client-info, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS" };
const ESQUEMA = { type: "object", additionalProperties: false, required: ["resposta", "avancar"], properties: { resposta: { type: "string" }, avancar: { type: "boolean" } } };

async function ia(sistema: string, conversa: { role: "user" | "assistant"; content: string }[]) {
  const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
  const stream = client.beta.messages.stream({
    model: env("DEVIT_MODELO") || "claude-opus-5-5",
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
    system: sistema,
    messages: conversa,
  } as any);
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal" || msg.stop_reason === "max_tokens") throw new Error("sem resposta da IA");
  const texto = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
  return JSON.parse(texto) as { resposta: string; avancar: boolean };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const auth = req.headers.get("authorization") || "";
  const usuario = createClient(env("SUPABASE_URL")!, env("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const servico = createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const r = await tratar(req, { env, usuario: usuario as unknown as Banco, servico: servico as unknown as Banco, ia });
  Object.entries(cors).forEach(([k, v]) => r.headers.set(k, v));
  return r;
});
