// Recebe os avisos do GitHub e do GitLab e entrega ao banco, sem abrir o conteúdo.
//   GitHub: todos os avisos chegam pelo app do CicloDev, num endereço só; o banco confere a assinatura com o segredo do app
//           e acha os repositórios pela instalação e pelo número do repositório (git_receber_github, parte 32).
//   GitLab: cada projeto ligado tem o próprio aviso, criado pelo CicloDev, com o id do repositório no endereço (?r=)
//           e um segredo só dele (git_receber_gitlab).
// Aqui só: método certo, de qual provedor veio e tamanho máximo.

export type Chamar = (nome: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMITE = 5 * 1024 * 1024; // 5 MB: o GitHub manda no máximo 25 MB, mas push normal fica bem abaixo disso

const resposta = (corpo: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json; charset=utf-8" } });

export async function tratar(req: Request, chamar: Chamar): Promise<Response> {
  if (req.method === "GET") return resposta({ ok: true, info: "CicloDev: endereço dos avisos do GitHub e do GitLab. Os avisos chegam por POST." }, 200);
  if (req.method !== "POST") return resposta({ ok: false, erro: "use POST" }, 405);
  const github = req.headers.get("x-github-event");
  const gitlab = req.headers.get("x-gitlab-event");
  if (!github && !gitlab) return resposta({ ok: false, erro: "o aviso não veio do GitHub nem do GitLab" }, 400);
  const repo = new URL(req.url).searchParams.get("r") ?? "";
  if (gitlab && !UUID.test(repo)) return resposta({ ok: false, erro: "repositório inválido no endereço" }, 400);
  const tamanho = Number(req.headers.get("content-length") ?? "0");
  if (tamanho > LIMITE) return resposta({ ok: false, erro: "aviso grande demais" }, 413);
  const corpo = await req.text();
  if (corpo.length > LIMITE) return resposta({ ok: false, erro: "aviso grande demais" }, 413);
  const { data, error } = github
    ? await chamar("git_receber_github", { p_evento: github, p_assinatura: req.headers.get("x-hub-signature-256"), p_corpo: corpo })
    : await chamar("git_receber_gitlab", { p_repo: repo, p_evento: gitlab, p_token: req.headers.get("x-gitlab-token"), p_corpo: corpo });
  if (error) return resposta({ ok: false, erro: "não deu para registrar o aviso" }, 500);
  const r = (data ?? {}) as Record<string, unknown>;
  if (r.ok) return resposta(r, 200);
  return resposta({ ok: false, erro: r.erro ?? "recusado" }, r.erro === "repositório não encontrado" ? 404 : r.erro === "app do GitHub não configurado" ? 503 : 401);
}
