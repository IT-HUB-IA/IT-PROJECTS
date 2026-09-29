// Manda por e-mail os avisos do CicloDev: os de "na hora" (a cada 5 minutos), o resumo do dia e o relatório da semana.
// Quem chama é a rotina agendada do banco (pg_cron + pg_net), com o segredo AVISOS_SEGREDO no cabeçalho x-avisos-segredo.
// O banco escolhe o que sai (parte 20: avisos_email_lote, avisos_email_marcar, relatorio_semanal_lote); aqui só monta e envia.

export type Rpc = (nome: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
export type Enviar = (m: { para: string; assunto: string; html: string; texto: string }) => Promise<boolean>;
export type Config = { segredo: string; site: string };

type Aviso = { id: string; tipo: string; titulo: string; texto: string | null; item_id: string | null; quando: string };
type Grupo = { pessoa_id: string; nome: string; email: string; avisos: Aviso[] };
type Linha = { chave: string | null; titulo: string; prazo?: string };
type Semana = { pessoa_id: string; nome: string; email: string; feitos: Linha[]; atrasados: Linha[]; proximos: Linha[]; nao_lidos: number };

const resposta = (corpo: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json; charset=utf-8" } });

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const primeiroNome = (n: string) => (n || "").trim().split(/\s+/)[0] || "";
const dataBR = (d?: string) => (d ? d.slice(8, 10) + "/" + d.slice(5, 7) : "");

function iguais(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const moldura = (titulo: string, corpo: string, site: string) =>
  '<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F4F4F5;font-family:Arial,Helvetica,sans-serif;color:#050506">' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">' +
  '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #E3E3E7">' +
  '<tr><td style="background:#050506;padding:18px 24px;color:#FFFFFF;font-size:20px;font-weight:bold">Ciclo<span style="color:#FF0000">Dev</span></td></tr>' +
  '<tr><td style="padding:24px"><h1 style="margin:0 0 16px;font-size:20px">' + esc(titulo) + "</h1>" + corpo +
  '<p style="margin:24px 0 0"><a href="' + esc(site) + '" style="display:inline-block;background:#050506;color:#FFFFFF;text-decoration:none;padding:12px 18px;font-weight:bold">Abrir o CicloDev</a></p></td></tr>' +
  '<tr><td style="padding:16px 24px;border-top:1px solid #E3E3E7;font-size:12px;color:#55555C">Você recebe este e-mail porque tem avisos no CicloDev, da IT.IA. Para mudar, abra o CicloDev, clique no sininho e em Preferências.</td></tr>' +
  "</table></td></tr></table></body></html>";

export function montarAvisos(g: Grupo, modo: "imediato" | "diario", site: string) {
  const n = g.avisos.length;
  const assunto = modo === "imediato"
    ? (n === 1 ? g.avisos[0].titulo : n + " avisos novos no CicloDev")
    : "Seu resumo do dia no CicloDev: " + n + (n === 1 ? " aviso" : " avisos");
  const lista = g.avisos.map((a) => '<li style="margin:0 0 12px"><b>' + esc(a.titulo) + "</b>" + (a.texto ? '<br><span style="color:#55555C">' + esc(a.texto) + "</span>" : "") + "</li>").join("");
  const html = moldura("Olá, " + primeiroNome(g.nome) + ".", '<ul style="margin:0;padding-left:18px">' + lista + "</ul>", site);
  const texto = "Olá, " + primeiroNome(g.nome) + ".\n\n" + g.avisos.map((a) => "- " + a.titulo + (a.texto ? "\n  " + a.texto : "")).join("\n") + "\n\nAbrir o CicloDev: " + site;
  return { para: g.email, assunto, html, texto };
}

export function montarSemana(s: Semana, site: string) {
  const bloco = (tit: string, l: Linha[], vazio: string, prazo: boolean) =>
    '<h2 style="margin:20px 0 8px;font-size:15px">' + esc(tit) + " (" + l.length + ")</h2>" +
    (l.length ? '<ul style="margin:0;padding-left:18px">' + l.slice(0, 15).map((x) => "<li>" + (x.chave ? "<b>" + esc(x.chave) + "</b> " : "") + esc(x.titulo) + (prazo && x.prazo ? ' <span style="color:#55555C">(prazo ' + esc(dataBR(x.prazo)) + ")</span>" : "") + "</li>").join("") + (l.length > 15 ? "<li>e mais " + (l.length - 15) + "</li>" : "") + "</ul>" : '<p style="margin:0;color:#55555C">' + esc(vazio) + "</p>");
  const corpo = bloco("Você concluiu", s.feitos, "Nada concluído nesta semana.", false) +
    bloco("Atrasados com você", s.atrasados, "Nada atrasado. Muito bem.", true) +
    bloco("Vencem nos próximos 7 dias", s.proximos, "Nada vence nos próximos 7 dias.", true) +
    (s.nao_lidos ? '<p style="margin:20px 0 0">Você tem <b>' + s.nao_lidos + "</b> " + (s.nao_lidos === 1 ? "aviso não lido" : "avisos não lidos") + " no sininho.</p>" : "");
  const txt = (tit: string, l: Linha[]) => tit + " (" + l.length + ")\n" + l.slice(0, 15).map((x) => "- " + (x.chave ? x.chave + " " : "") + x.titulo + (x.prazo ? " (prazo " + dataBR(x.prazo) + ")" : "")).join("\n");
  return {
    para: s.email,
    assunto: "Sua semana no CicloDev: " + s.feitos.length + " concluídos, " + s.atrasados.length + " atrasados",
    html: moldura("Sua semana, " + primeiroNome(s.nome) + ".", corpo, site),
    texto: [txt("Você concluiu", s.feitos), txt("Atrasados com você", s.atrasados), txt("Vencem nos próximos 7 dias", s.proximos)].join("\n\n") + "\n\nAbrir o CicloDev: " + site,
  };
}

export async function tratar(req: Request, rpc: Rpc, enviar: Enviar, cfg: Config): Promise<Response> {
  if (req.method !== "POST") return resposta({ ok: false, erro: "use POST" }, 405);
  if (!cfg.segredo || !iguais(req.headers.get("x-avisos-segredo") ?? "", cfg.segredo)) return resposta({ ok: false, erro: "não autorizado" }, 401);
  const modo = new URL(req.url).searchParams.get("modo") ?? "";
  if (modo === "semanal") {
    const { data, error } = await rpc("relatorio_semanal_lote");
    if (error) return resposta({ ok: false, erro: "não deu para ler o banco" }, 500);
    let enviados = 0, falhas = 0;
    for (const s of (data ?? []) as Semana[]) { let foi = false; try { foi = await enviar(montarSemana(s, cfg.site)); } catch { foi = false; } if (foi) enviados++; else falhas++; }
    return resposta({ ok: true, modo, enviados, falhas }, 200);
  }
  if (modo !== "imediato" && modo !== "diario") return resposta({ ok: false, erro: "modo inválido" }, 400);
  const { data, error } = await rpc("avisos_email_lote", { p_modo: modo, p_limite: 300 });
  if (error) return resposta({ ok: false, erro: "não deu para ler o banco" }, 500);
  const certos: string[] = [], errados: string[] = [];
  for (const g of (data ?? []) as Grupo[]) {
    const ids = g.avisos.map((a) => a.id);
    let foi = false;
    try { foi = await enviar(montarAvisos(g, modo, cfg.site)); } catch { foi = false; }
    (foi ? certos : errados).push(...ids);
  }
  if (certos.length) await rpc("avisos_email_marcar", { p_ids: certos, p_ok: true });
  if (errados.length) await rpc("avisos_email_marcar", { p_ids: errados, p_ok: false });
  return resposta({ ok: true, modo, enviados: certos.length, falhas: errados.length }, 200);
}

// envio pelo Resend (https://resend.com): uma chamada por e-mail
export const enviarPeloResend = (chave: string, remetente: string, buscar: typeof fetch = fetch): Enviar => async (m) => {
  if (!chave || !remetente) return false;
  const r = await buscar("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: "Bearer " + chave, "content-type": "application/json" },
    body: JSON.stringify({ from: remetente, to: [m.para], subject: m.assunto, html: m.html, text: m.texto }),
  });
  return r.ok;
};
