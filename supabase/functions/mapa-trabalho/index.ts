// Edge Function mapa-trabalho (verify_jwt: false). A lógica está em logica.ts; aqui só se ligam o banco do CicloDev
// (service_role) e a leitura só leitura dos bancos ligados. Quem chama é o trabalhador do Mapa (worker/mapa), com o
// segredo do Vault ciclodev_mapa_segredo no cabeçalho x-mapa-segredo. Segredos: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (o Supabase já dá).
import { createClient } from "npm:@supabase/supabase-js@2";
import { tratar } from "./logica.ts";
import { lerBanco, lerExtra } from "../_shared/ler_banco.ts";

const env = (n: string) => Deno.env.get(n);
const servico = createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve((req) => tratar(req, {
  env, buscar: fetch, lerBanco, lerExtra,
  rpc: async (nome, args) => (await servico.rpc(nome, args)) as any,
}));
