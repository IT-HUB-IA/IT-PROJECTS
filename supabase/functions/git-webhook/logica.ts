// Recebe o aviso (webhook) do GitHub ou do GitLab e entrega ao banco, sem abrir o conteúdo.
// Quem confere o segredo e lê o evento é a função git_receber no banco (parte 19).
// Aqui só: método certo, repositório no endereço, de qual provedor veio e tamanho máximo.

export type Chamar = (args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMITE = 5 * 1024 * 1024; // 5 MB: o GitHub manda no máximo 25 MB, mas push normal fica bem abaixo disso

const resposta = (corpo: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json; charset=utf-8" } });

export async function tratar(req: Request, chamar: Chamar): Promise<Response> {
  if (req.method === "GET") return resposta({ ok: true, info: "CicloDev: endereço dos avisos do GitHub e do GitLab. Os avisos chegam por POST." }, 200);
  if (req.method !== "POST") return resposta({ ok: false, erro: "use POST" }, 405);
  const repo = new URL(req.url).searchParams.get("r") ?? "";
  if (!UUID.test(repo)) return resposta({ ok: false, erro: "repositório inválido no endereço" }, 400);
  const github = req.headers.get("x-github-event");
  const gitlab = req.headers.get("x-gitlab-event");
  const provedor = github ? "github" : gitlab ? "gitlab" : "";
  if (!provedor) return resposta({ ok: false, erro: "o aviso não veio do GitHub nem do GitLab" }, 400);
  const tamanho = Number(req.headers.get("content-length") ?? "0");
  if (tamanho > LIMITE) return resposta({ ok: false, erro: "aviso grande demais" }, 413);
  const corpo = await req.text();
  if (corpo.length > LIMITE) return resposta({ ok: false, erro: "aviso grande demais" }, 413);
  const { data, error } = await chamar({
    p_repo: repo, p_provedor: provedor, p_evento: github ?? gitlab,
    p_assinatura: req.headers.get("x-hub-signature-256"), p_token: req.headers.get("x-gitlab-token"), p_corpo: corpo,
  });
  if (error) return resposta({ ok: false, erro: "não deu para registrar o aviso" }, 500);
  const r = (data ?? {}) as Record<string, unknown>;
  if (r.ok) return resposta(r, 200);
  return resposta({ ok: false, erro: r.erro ?? "recusado" }, r.erro === "repositório não encontrado" ? 404 : 401);
}
