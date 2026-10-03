// Função portal-api (verify_jwt: false): o que um sistema de fora (o Java da Blanco & Lisboa) chama para ler um portal
// do stakeholder e responder as perguntas. Quem chama se identifica com a chave do portal (Authorization: Bearer cdp_...),
// gerada no CicloDev. Tudo o que volta sai das funções da parte 23 do banco, sempre só do cliente daquele portal.
//
//   GET  /painel?no=<id>            os números do painel (do cliente todo, ou de uma parte dele)
//   GET  /estrutura                 as partes do cliente (projetos, produtos, aplicações, frentes) com o andamento
//   GET  /quadro?no=<id>            o quadro analítico: colunas do fluxo com os épicos em cartões
//   GET  /itens/<id>                um item ou épico em modo apresentação, com os itens de dentro e as perguntas
//   GET  /perguntas?status=aguardando|respondida|todas
//   POST /perguntas/<id>/resposta   {"texto": "..."}, com o cabeçalho X-Portal-Usuario: <e-mail do convidado>
//   GET  /eventos?depois=<id>       a fila de avisos (a mesma que vai pelo webhook), para buscar o que faltou
//   GET  /membros                   quem pode responder (e-mail e nome)
// Limite: 120 chamadas por minuto por chave; passou disso, 429 com Retry-After: 60.
// Quem responde (X-Portal-Usuario): a chave é do sistema do cliente, que responde pelos usuários dele; o banco só aceita
// e-mail que é membro ativo DAQUELE portal (portal_responder) e grava quem foi no comentário do item.

export type Rpc = (nome: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;
export type Tabela = (nome: string, portal: string) => Promise<{ data: unknown; error: { message?: string } | null }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cab = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
export const resposta = (corpo: unknown, status = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(corpo), { status, headers: Object.assign({}, cab, extra) });
const erro = (status: number, mensagem: string) => resposta({ ok: false, erro: mensagem }, status);

// o caminho depois de /portal-api (o Supabase manda /functions/v1/portal-api/... ou só /portal-api/...)
export function rota(url: string): string[] {
  const p = new URL(url).pathname.split("/").filter(Boolean);
  const i = p.indexOf("portal-api");
  return i >= 0 ? p.slice(i + 1) : p;
}

function erroDoBanco(e: { message?: string; code?: string }) {
  const m = e.message || "erro no banco";
  if (e.code === "42501" || /não é membro|Fora do portal/i.test(m)) return erro(403, m);
  if (e.code === "P0002" || /não encontrada/i.test(m)) return erro(404, m);
  if (e.code === "22023") return erro(409, m);
  return erro(500, "Não deu para ler o banco");
}

export async function tratar(req: Request, rpc: Rpc, membros: Tabela): Promise<Response> {
  const auth = req.headers.get("authorization") || "";
  const chave = /^Bearer\s+(cdp_[A-Za-z0-9_-]{20,})$/.exec(auth.trim());
  if (!chave) return erro(401, "Falta a chave do portal (Authorization: Bearer cdp_...)");
  const { data: achou, error: eChave } = await rpc("portal_por_chave", { p_chave: chave[1] });
  // limite de chamadas por chave (parte 61 do banco): 120 por minuto
  if (eChave) return eChave.code === "53400" ? resposta({ ok: false, erro: eChave.message || "Muitas chamadas com esta chave. Espere um minuto." }, 429, { "retry-after": "60" }) : erro(500, "Não deu para conferir a chave");
  const portal = Array.isArray(achou) ? achou[0] : null;
  if (!portal || !(portal as { portal_id?: string }).portal_id) return erro(401, "Chave inválida ou revogada");
  const pid = (portal as { portal_id: string }).portal_id;

  const url = new URL(req.url), r = rota(req.url), m = req.method;
  const no = url.searchParams.get("no");
  if (no && !UUID.test(no)) return erro(400, "O parâmetro no precisa ser um id");
  const ler = async (nome: string, args: Record<string, unknown>) => {
    const { data, error } = await rpc(nome, Object.assign({ p_portal: pid }, args));
    return error ? erroDoBanco(error) : resposta({ ok: true, portal: { id: pid, nome: (portal as { nome?: string }).nome }, dados: data ?? null });
  };

  if (m === "GET" && r[0] === "painel" && r.length === 1) return ler("portal_painel", { p_no: no });
  if (m === "GET" && r[0] === "estrutura" && r.length === 1) return ler("portal_estrutura", {});
  if (m === "GET" && r[0] === "quadro" && r.length === 1) return ler("portal_quadro", { p_no: no });
  if (m === "GET" && r[0] === "itens" && r.length === 2) {
    if (!UUID.test(r[1])) return erro(400, "Id de item inválido");
    const { data, error } = await rpc("portal_item", { p_portal: pid, p_item: r[1] });
    if (error) return erroDoBanco(error);
    if (!data) return erro(404, "Item não encontrado neste portal");
    return resposta({ ok: true, portal: { id: pid }, dados: data });
  }
  if (m === "GET" && r[0] === "perguntas" && r.length === 1) {
    const st = url.searchParams.get("status") || "aguardando";
    if (!["aguardando", "respondida", "cancelada", "todas"].includes(st)) return erro(400, "status: aguardando, respondida, cancelada ou todas");
    return ler("portal_perguntas", { p_status: st });
  }
  if (m === "GET" && r[0] === "eventos" && r.length === 1) {
    const depois = Number(url.searchParams.get("depois") || 0);
    if (!Number.isInteger(depois) || depois < 0) return erro(400, "depois: o id do último aviso recebido");
    return ler("portal_eventos_lista", { p_depois: depois, p_limite: 200 });
  }
  if (m === "GET" && r[0] === "membros" && r.length === 1) {
    const { data, error } = await membros("portais_membros", pid);
    return error ? erro(500, "Não deu para ler os membros") : resposta({ ok: true, portal: { id: pid }, dados: data ?? [] });
  }
  if (m === "POST" && r[0] === "perguntas" && r.length === 3 && r[2] === "resposta") {
    if (!UUID.test(r[1])) return erro(400, "Id de pergunta inválido");
    const quem = (req.headers.get("x-portal-usuario") || "").trim();
    if (!/^[^@\s]+@[^@\s]+$/.test(quem)) return erro(400, "Falta o cabeçalho X-Portal-Usuario com o e-mail de quem responde");
    let corpo: { texto?: unknown } = {};
    try { corpo = await req.json(); } catch { return erro(400, "O corpo precisa ser JSON: {\"texto\": \"...\"}"); }
    const texto = typeof corpo.texto === "string" ? corpo.texto.trim() : "";
    if (!texto) return erro(400, "Escreva a resposta em texto");
    if (texto.length > 8000) return erro(413, "Resposta longa demais (até 8000 letras)");
    const { data, error } = await rpc("portal_responder", { p_portal: pid, p_pergunta: r[1], p_email: quem, p_texto: texto });
    return error ? erroDoBanco(error) : resposta({ ok: true, portal: { id: pid }, dados: data });
  }
  if (!["GET", "POST"].includes(m)) return erro(405, "Use GET ou POST");
  return erro(404, "Endereço desconhecido. Veja a lista no começo do arquivo logica.ts da função portal-api");
}
