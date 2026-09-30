// Edge Function diagramas (verify_jwt: true). A lógica está em logica.ts; aqui só se ligam o banco, o DevIT e o segundo plano.
// Segredos: SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY (o Supabase já dá), RENDER_URL e RENDER_TOKEN
// (o conversor da VPS), ANTHROPIC_API_KEY (o DevIT), GITHUB_TOKEN e FIGMA_TOKEN. Opcional: DEVIT_MODELO (padrão claude-opus-5-5).
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";
import { tratar } from "./logica.ts";
import type { Banco } from "./logica.ts";

const env = (n: string) => Deno.env.get(n);
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, x-client-info, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS" };

// o DevIT: uma chamada com saída em JSON no formato pedido; se a IA recusar, o servidor tenta outro modelo sozinho
async function devit(sistema: string, pedido: string, esquema: Record<string, unknown>): Promise<unknown> {
  const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
  const stream = client.beta.messages.stream({
    model: env("DEVIT_MODELO") || "claude-opus-5-5",
    max_tokens: 64000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: { type: "json_schema", schema: esquema } },
    system: sistema,
    messages: [{ role: "user", content: pedido }],
  } as any);
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("O DevIT recusou este pedido" + (msg.stop_details && (msg.stop_details as any).explanation ? ": " + (msg.stop_details as any).explanation : ""));
  if (msg.stop_reason === "max_tokens") throw new Error("A resposta do DevIT ficou grande demais; tente de novo numa parte menor");
  const texto = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
  try { return JSON.parse(texto); } catch { throw new Error("O DevIT não devolveu o formato combinado"); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const auth = req.headers.get("authorization") || "";
  const usuario = createClient(env("SUPABASE_URL")!, env("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const servico = createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const r = await tratar(req, {
    env, buscar: fetch, devit,
    usuario: usuario as unknown as Banco, servico: servico as unknown as Banco,
    emSegundoPlano: (p) => { const er = (globalThis as any).EdgeRuntime; if (er && er.waitUntil) er.waitUntil(p); else p.catch(() => {}); },
  });
  Object.entries(cors).forEach(([k, v]) => r.headers.set(k, v));
  return r;
});
