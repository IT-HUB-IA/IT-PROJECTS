// Rodar com: node --experimental-strip-types supabase/functions/git-webhook/logica.test.ts
import { tratar } from "./logica.ts";
let falhas = 0;
const ok = (c: boolean, m: string) => { if (!c) falhas++; console.log((c ? "OK    " : "FALHA ") + m); };
const R = "0b7a8e84-3f7c-4a8b-9c0d-1e2f3a4b5c6d";
let ultimo: { nome: string; a: Record<string, unknown> } | null = null;
const banco = (resposta: unknown, erro: unknown = null) => async (nome: string, a: Record<string, unknown>) => { ultimo = { nome, a }; return { data: resposta, error: erro as null }; };
const pedido = (h: Record<string, string>, corpo = "{}", metodo = "POST", r: string | null = null) =>
  new Request("https://x.supabase.co/functions/v1/git-webhook" + (r ? "?r=" + r : ""), { method: metodo, headers: h, body: metodo === "POST" ? corpo : undefined });

let res = await tratar(pedido({}, "", "GET"), banco({}));
ok(res.status === 200, "GET explica o endereço");
res = await tratar(pedido({ "x-github-event": "push" }, "{}", "PUT"), banco({}));
ok(res.status === 405, "outro método é recusado");
res = await tratar(pedido({ "content-type": "application/json" }), banco({ ok: true }));
ok(res.status === 400, "sem o cabeçalho do GitHub ou do GitLab é recusado");
ultimo = null;
res = await tratar(pedido({ "x-github-event": "push", "x-hub-signature-256": "sha256=abc" }, '{"ref":"refs/heads/BL-1"}'), banco({ ok: true, repositorios: 1 }));
ok(res.status === 200 && ultimo!.nome === "git_receber_github" && ultimo!.a.p_evento === "push" && ultimo!.a.p_assinatura === "sha256=abc" && ultimo!.a.p_corpo === '{"ref":"refs/heads/BL-1"}',
  "GitHub: um endereço só (o do app), repassa evento, assinatura e o corpo exato");
res = await tratar(pedido({ "x-gitlab-event": "Push Hook", "x-gitlab-token": "t0k" }), banco({ ok: true }));
ok(res.status === 400, "GitLab sem o repositório no endereço é recusado");
res = await tratar(pedido({ "x-gitlab-event": "Push Hook", "x-gitlab-token": "t0k" }, "{}", "POST", R), banco({ ok: true }));
ok(res.status === 200 && ultimo!.nome === "git_receber_gitlab" && ultimo!.a.p_token === "t0k" && ultimo!.a.p_evento === "Push Hook" && ultimo!.a.p_repo === R, "GitLab: repassa repositório, evento e segredo");
res = await tratar(pedido({ "x-github-event": "push" }), banco({ ok: false, erro: "assinatura inválida" }));
ok(res.status === 401, "segredo errado: 401 (o GitHub mostra como falha)");
res = await tratar(pedido({ "x-github-event": "push" }), banco({ ok: false, erro: "app do GitHub não configurado" }));
ok(res.status === 503, "app ainda não criado: 503");
res = await tratar(pedido({ "x-gitlab-event": "Push Hook" }, "{}", "POST", R), banco({ ok: false, erro: "repositório não encontrado" }));
ok(res.status === 404, "repositório apagado: 404");
res = await tratar(pedido({ "x-github-event": "push" }), banco(null, { message: "boom" }));
const txt = await res.text();
ok(res.status === 500 && !txt.includes("boom"), "erro do banco: 500 sem mostrar detalhe interno");
res = await tratar(pedido({ "x-github-event": "push", "content-length": String(6 * 1024 * 1024) }), banco({ ok: true }));
ok(res.status === 413, "aviso grande demais é recusado");
console.log(falhas ? "FALHAS: " + falhas : "TUDO OK");
if (falhas) process.exit(1);
