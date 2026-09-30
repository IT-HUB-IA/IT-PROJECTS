// Função devit: o DevIT conduzindo um guia no chat (hoje: ligar banco do Supabase ou da AWS) e tirando dúvidas.
// - O passo a passo é fixo e sai da base de conhecimento (../_shared/devit_conhecimento.json), então funciona mesmo sem IA.
// - Dúvida escrita: com ANTHROPIC_API_KEY, o modelo responde usando só a base de conhecimento; sem a chave (ou se a IA
//   falhar), responde pelas perguntas frequentes da base.
// - Só responde a quem tem a IA ligada (ia_posso). Lê a conversa pelo login da pessoa (RLS) e grava a resposta do
//   agente com o papel de serviço, sempre na conversa da própria pessoa.
// - Nunca manda senha para a IA: endereço de conexão com senha é mascarado antes, e a pessoa é avisada.
import BASE from "../_shared/devit_conhecimento.json" with { type: "json" };

export type Botao = { rotulo: string; valor: string };
export type Contexto = { guia?: string; passo?: number; botoes?: Botao[]; fim?: boolean; valor?: string; ia?: boolean };
export type Msg = { id?: string; autor: "usuario" | "agente"; texto: string; contexto?: Contexto | null; criado_em?: string };
export type Banco = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }>;
  from: (t: string) => any;
};
export type Deps = {
  env: (n: string) => string | undefined;
  usuario: Banco;
  servico: Banco;
  ia?: (sistema: string, conversa: { role: "user" | "assistant"; content: string }[]) => Promise<{ resposta: string; avancar: boolean }>;
};
type Passo = { titulo: string; texto: string; comando?: string; texto2?: string; comando2?: string; nota?: string; pergunta: string; abrir?: string };
type Guia = { titulo: string; abertura: string; passos: Passo[]; fim: string };
type Faq = { guias: string[]; chaves: string[]; titulo: string; resposta: string };

const K = BASE as unknown as { guias: Record<string, Guia>; faq: Faq[]; base: string };
export const GUIAS = K.guias;
const LIMITE_IA_HORA = 40;

export const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const norm = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// endereço de conexão com senha (postgresql://usuario:senha@servidor): nunca vai para a IA
export const SENHA_NO_ENDERECO = /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@\/]+:[^\s]+@[^\s]+/i;
export const mascarar = (t: string) => String(t || "").replace(/\b([a-z][a-z0-9+.-]*:\/\/[^\s:@\/]+):[^\s]+@([^\s@]+)/gi, "$1:***@$2");

const BOTOES_PASSO = (p: Passo, guia: string): Botao[] => [
  ...(p.abrir ? [{ rotulo: "Abrir a janela de ligar banco", valor: "local:abrir:" + p.abrir }] : []),
  { rotulo: "Feito, próximo passo", valor: "feito" },
  { rotulo: "Tenho uma dúvida", valor: "duvida" },
  { rotulo: "Deu erro", valor: "erro" },
];
const BOTOES_ESCOLHA: Botao[] = [{ rotulo: "Supabase", valor: "guia:banco-supabase" }, { rotulo: "AWS (RDS ou Aurora)", valor: "guia:banco-aws" }];

export function textoPasso(g: Guia, i: number): string {
  const p = g.passos[i];
  return ["**Passo " + (i + 1) + " de " + g.passos.length + ": " + p.titulo + "**", p.texto,
    p.comando ? "```\n" + p.comando + "\n```" : "", p.texto2 || "", p.comando2 ? "```\n" + p.comando2 + "\n```" : "",
    p.nota || "", p.pergunta].filter(Boolean).join("\n\n");
}

// perguntas frequentes: a que tiver mais palavras-chave batendo no texto
export function acharFaq(texto: string, guia: string): Faq | null {
  const t = norm(texto);
  let melhor: Faq | null = null, pontos = 0;
  for (const f of K.faq) {
    if (!f.guias.includes(guia)) continue;
    const n = f.chaves.filter((c) => t.includes(norm(c))).length;
    if (n > pontos) { pontos = n; melhor = f; }
  }
  return melhor;
}
const AFIRMA = /^(sim|feito|pronto|ok|okay|consegui|foi|deu certo|certo|apareceu|beleza|blz|salvei|salvo|success)\b/;
const NEGA_OU_ERRO = /\b(nao|erro|error|falhou|failed|denied|nada|problema)\b/;

export function sistemaIa(guia: string, passo: number): string {
  const g = GUIAS[guia];
  return "Você é o DevIT, o assistente do CicloDev (sistema de gestão de projetos da IT.IA). Agora você está conduzindo a pessoa pelo guia \"" + g.titulo + "\", um passo por vez.\n\n" +
    "Não cumprimente nem se apresente de novo: a conversa já está acontecendo. Vá direto ao ponto.\n\n" +
    "Responda SEMPRE em português do Brasil, com linguagem simples, curta e acolhedora, como um colega paciente. Nunca use travessão. Formato permitido: **negrito**, `código` e blocos ``` para comandos. Nada de títulos com #.\n\n" +
    "Use APENAS o que está na base de conhecimento abaixo. Se a resposta não estiver nela, diga que não tem certeza e sugira o que a pessoa pode conferir; nunca invente botão, menu ou comando.\n\n" +
    "Nunca peça senha, chave ou endereço de conexão. Se a pessoa colar um, diga que a senha ficou registrada na conversa e recomende trocar a senha.\n\n" +
    "A pessoa está no passo " + (passo + 1) + " de " + g.passos.length + (passo >= 0 ? " (" + g.passos[passo].titulo + ")" : " (ainda não começou)") + ". Responda a dúvida dela e, no fim, pergunte se pode seguir. " +
    "Devolva avancar = true SOMENTE se a mensagem dela disser claramente que já concluiu o passo atual com sucesso; senão, false.\n\n" +
    "# Passos do guia\n" + g.passos.map((p, i) => (i + 1) + ". " + p.titulo + ": " + p.texto.replace(/\n+/g, " ") + (p.comando ? " Comando: " + p.comando.replace(/\n/g, " ") : "") + (p.comando2 ? " Comando (MySQL): " + p.comando2.replace(/\n/g, " ") : "") + (p.nota ? " Observação: " + p.nota : "")).join("\n") +
    "\n\n# Perguntas frequentes\n" + K.faq.filter((f) => f.guias.includes(guia)).map((f) => "- " + f.titulo + ": " + f.resposta.replace(/\n+/g, " ")).join("\n") +
    "\n\n" + K.base;
}

async function lerMensagens(d: Deps): Promise<Msg[]> {
  const { data, error } = await d.usuario.from("ia_mensagens").select("id, autor, texto, contexto, criado_em").order("criado_em", { ascending: false }).limit(40);
  if (error) throw new Error("Não deu para ler a conversa: " + (error.message || error));
  return ((data || []) as Msg[]).slice().reverse();
}

async function gravar(d: Deps, pessoa: string, texto: string, ctx: Contexto): Promise<Msg> {
  const { data, error } = await d.servico.from("ia_mensagens").insert({ pessoa_id: pessoa, autor: "agente", texto: texto.slice(0, 7900), contexto: ctx }).select("id, autor, texto, anexos, contexto, criado_em");
  if (error) throw new Error("Não deu para gravar a resposta: " + (error.message || error));
  return (Array.isArray(data) ? data[0] : data) as Msg;
}

async function usosDaIa(d: Deps, pessoa: string): Promise<number> {
  const desde = new Date(Date.now() - 3600e3).toISOString();
  const { count } = await d.servico.from("ia_mensagens").select("id", { count: "exact", head: true }).eq("pessoa_id", pessoa).eq("autor", "agente").gte("criado_em", desde).contains("contexto", { ia: true });
  return count || 0;
}

// decide a próxima fala do DevIT a partir da última mensagem da pessoa
export async function responderGuia(d: Deps, pessoa: string, msgs: Msg[]): Promise<{ texto: string; ctx: Contexto } | null> {
  const agenteIdx = msgs.map((m) => m.autor).lastIndexOf("agente");
  const ult = agenteIdx >= 0 ? msgs[agenteIdx] : null, uc = (ult && ult.contexto) || {};
  if (!ult || !uc.guia || uc.fim) return null;                  // não há guia em andamento: o DevIT fica quieto
  const eu = msgs.slice(agenteIdx + 1).filter((m) => m.autor === "usuario").pop();
  if (!eu) return null;
  const valor = (eu.contexto && eu.contexto.valor) || "", texto = String(eu.texto || "").trim();
  const guia = uc.guia, passo = typeof uc.passo === "number" ? uc.passo : -1;

  // 1) escolha do guia (Supabase ou AWS)
  if (guia === "banco") {
    const escolhido = valor.startsWith("guia:") ? valor.slice(5) : /aws|rds|aurora|amazon/.test(norm(texto)) ? "banco-aws" : /supa/.test(norm(texto)) ? "banco-supabase" : "";
    if (!GUIAS[escolhido]) return { texto: "Não entendi onde o banco está. É no **Supabase** ou na **AWS**?", ctx: { guia: "banco", passo: -1, botoes: BOTOES_ESCOLHA } };
    return { texto: GUIAS[escolhido].abertura, ctx: { guia: escolhido, passo: -1, botoes: [{ rotulo: "Vamos começar", valor: "feito" }, { rotulo: "Tenho uma dúvida", valor: "duvida" }] } };
  }
  const g = GUIAS[guia]; if (!g) return null;
  const doPasso = (i: number): { texto: string; ctx: Contexto } => i >= g.passos.length
    ? { texto: g.fim, ctx: { guia, passo: g.passos.length, fim: true, botoes: [] } }
    : { texto: textoPasso(g, i), ctx: { guia, passo: i, botoes: BOTOES_PASSO(g.passos[i], guia) } };
  const botoesAtuais = passo >= 0 ? BOTOES_PASSO(g.passos[passo], guia) : [{ rotulo: "Vamos começar", valor: "feito" }, { rotulo: "Tenho uma dúvida", valor: "duvida" }];

  // 2) botões
  if (valor === "feito") return doPasso(passo + 1);
  if (valor === "duvida") return { texto: "Claro! Escreva a sua dúvida aqui embaixo, do seu jeito, que eu te explico. Só não cole senha nem o endereço de conexão.", ctx: { guia, passo, botoes: [{ rotulo: "Deixa pra lá, seguir", valor: "feito" }] } };
  if (valor === "erro") return { texto: "Sem problema, a gente resolve. Me conte o que apareceu: pode copiar a mensagem de erro aqui (ela não tem senha). Se o erro mostrar o endereço de conexão, tire a senha antes de colar.", ctx: { guia, passo, botoes: [{ rotulo: "Repetir o passo", valor: "repetir" }] } };
  if (valor === "repetir") return doPasso(Math.max(0, passo));
  if (valor === "parar") return { texto: "Tudo bem, encerrei por aqui. Quando quiser continuar, é só clicar em **Guia passo a passo** de novo.", ctx: { guia, passo, fim: true, botoes: [] } };

  // 3) texto livre
  if (/^(encerrar|encerra|parar|para|cancelar|cancela|sair|chega|pode encerrar|quero encerrar|quero parar)\b/.test(norm(texto)) && !texto.includes("?")) return { texto: "Tudo bem, encerrei por aqui. Quando quiser continuar, é só clicar em **Guia passo a passo** de novo.", ctx: { guia, passo, fim: true, botoes: [] } };
  if (SENHA_NO_ENDERECO.test(texto))
    return { texto: "Atenção: parece que você colou um endereço com senha aqui no chat. Ele fica registrado na conversa, então o mais seguro é **trocar a senha** do usuário leitura_ciclodev:\n\n```\nalter role leitura_ciclodev with password 'nova-senha-forte';\n```\n\nDepois cole o endereço com a senha nova direto na janela de ligar banco (botão **Trocar** ao lado do banco). Nunca aqui no chat.", ctx: { guia, passo, botoes: botoesAtuais } };

  const temIa = !!d.ia && !!d.env("ANTHROPIC_API_KEY");
  if (temIa && (await usosDaIa(d, pessoa)) < LIMITE_IA_HORA) {
    try {
      const conversa = msgs.slice(-16).filter((m) => String(m.texto || "").trim()).map((m) => ({ role: (m.autor === "agente" ? "assistant" : "user") as "user" | "assistant", content: mascarar(m.texto) }));
      while (conversa.length && conversa[0].role === "assistant") conversa.shift();   // a conversa para a IA começa pela pessoa
      const r = await d.ia!(sistemaIa(guia, passo), conversa);
      const resp = String(r.resposta || "").trim();
      if (resp) {
        if (r.avancar) { const prox = doPasso(passo + 1); return { texto: resp + "\n\n" + prox.texto, ctx: { ...prox.ctx, ia: true } }; }
        return { texto: resp, ctx: { guia, passo, botoes: botoesAtuais, ia: true } };
      }
    } catch (_) { /* a IA falhou: cai para as perguntas frequentes */ }
  }
  const n = norm(texto);
  if (AFIRMA.test(n) && !NEGA_OU_ERRO.test(n) && !texto.includes("?")) return doPasso(passo + 1);
  const f = acharFaq(texto, guia);
  if (f) return { texto: f.resposta + "\n\nResolveu? Quando estiver certo, clique em **Feito** para seguir.", ctx: { guia, passo, botoes: botoesAtuais } };
  const temas = K.faq.filter((x) => x.guias.includes(guia)).slice(0, 8).map((x) => "- " + x.titulo).join("\n");
  return { texto: "Não tenho certeza de ter entendido. Você pode me mandar a mensagem de erro exatamente como apareceu, ou clicar num dos botões aqui embaixo.\n\nEstes são os assuntos que eu sei explicar neste passo:\n" + temas, ctx: { guia, passo, botoes: botoesAtuais } };
}

export async function tratar(req: Request, d: Deps): Promise<Response> {
  if (req.method !== "POST") return resposta({ ok: false, erro: "Use POST" }, 405);
  let corpo: any = {};
  try { corpo = await req.json(); } catch { return resposta({ ok: false, erro: "Pedido inválido" }, 400); }
  const pode = await d.usuario.rpc("ia_posso");
  if (pode.error || pode.data !== true) return resposta({ ok: false, erro: "O DevIT não está ligado para você. Peça ao dono do sistema para ligar em Admin, Permissões de IA." }, 403);
  const perm = await d.usuario.from("ia_permissoes").select("pessoa_id").limit(1);
  const pessoa = perm.data && perm.data[0] && perm.data[0].pessoa_id;
  if (!pessoa) return resposta({ ok: false, erro: "Não achei o seu cadastro." }, 403);
  try {
    if (corpo.acao === "guia") {
      const guia = String(corpo.guia || "banco");
      if (guia === "banco") return resposta({ ok: true, mensagens: [await gravar(d, pessoa, "Oi! Vou te guiar para ligar o banco de dados no CicloDev, um passo por vez. Para começar: **onde o seu banco está?**", { guia: "banco", passo: -1, botoes: BOTOES_ESCOLHA })] });
      const g = GUIAS[guia]; if (!g) return resposta({ ok: false, erro: "Guia desconhecido" }, 400);
      return resposta({ ok: true, mensagens: [await gravar(d, pessoa, g.abertura, { guia, passo: -1, botoes: [{ rotulo: "Vamos começar", valor: "feito" }, { rotulo: "Tenho uma dúvida", valor: "duvida" }] })] });
    }
    if (corpo.acao === "responder") {
      const r = await responderGuia(d, pessoa, await lerMensagens(d));
      if (!r) return resposta({ ok: true, mensagens: [] });
      return resposta({ ok: true, mensagens: [await gravar(d, pessoa, r.texto, r.ctx)] });
    }
    return resposta({ ok: false, erro: "Ação desconhecida" }, 400);
  } catch (e) {
    return resposta({ ok: false, erro: String((e as Error).message || e).slice(0, 300) }, 500);
  }
}
