// Rodar com: node --experimental-strip-types supabase/functions/enviar-avisos/logica.test.ts
import { tratar, montarAvisos, enviarPeloResend } from "./logica.ts";
let falhas = 0;
const ok = (c: boolean, m: string) => { if (!c) falhas++; console.log((c ? "OK    " : "FALHA ") + m); };
const cfg = { segredo: "s3gr3do-com-tamanho-bom", site: "https://ciclodev.it-ia.tec.br/entrar" };
const pedido = (modo: string, segredo = cfg.segredo, metodo = "POST") => new Request("https://x.supabase.co/functions/v1/enviar-avisos?modo=" + modo, { method: metodo, headers: { "x-avisos-segredo": segredo } });
const chamadas: Array<[string, Record<string, unknown> | undefined]> = [];
const grupo = (email: string, ids: string[]) => ({ pessoa_id: "p", nome: "William Lisboa", email, avisos: ids.map((id) => ({ id, tipo: "mencao", titulo: "Maria mencionou você", texto: "BL-37 <b>Aprovações</b>: veja", item_id: null, quando: "" })) });
const rpc = (lote: unknown, erro: unknown = null) => async (nome: string, args?: Record<string, unknown>) => { chamadas.push([nome, args]); return { data: nome === "avisos_email_marcar" ? 1 : lote, error: erro as null }; };
const enviados: Array<{ para: string; assunto: string; html: string }> = [];
const enviar = (resultado: (para: string) => boolean) => async (m: { para: string; assunto: string; html: string; texto: string }) => { enviados.push(m); return resultado(m.para); };

let res = await tratar(pedido("imediato", "", "GET"), rpc([]), enviar(() => true), cfg);
ok(res.status === 405, "só POST");
res = await tratar(pedido("imediato", "errado-com-tamanho-bom!"), rpc([]), enviar(() => true), cfg);
ok(res.status === 401, "segredo errado: 401");
res = await tratar(pedido("imediato", ""), rpc([]), enviar(() => true), { ...cfg, segredo: "" });
ok(res.status === 401, "sem segredo configurado, ninguém chama");
res = await tratar(pedido("toda-hora"), rpc([]), enviar(() => true), cfg);
ok(res.status === 400, "modo desconhecido: 400");

chamadas.length = 0; enviados.length = 0;
res = await tratar(pedido("imediato"), rpc([grupo("w@x.com", ["a", "b"]), grupo("m@x.com", ["c"])]), enviar((p) => p === "w@x.com"), cfg);
const corpo = await res.json();
ok(res.status === 200 && corpo.enviados === 2 && corpo.falhas === 1, "manda um e-mail por pessoa e conta os que falharam");
ok(chamadas[0][0] === "avisos_email_lote" && chamadas[0][1]!.p_modo === "imediato", "pede o lote do modo certo");
const marcar = chamadas.filter((c) => c[0] === "avisos_email_marcar");
ok(marcar.length === 2 && JSON.stringify(marcar[0][1]) === JSON.stringify({ p_ids: ["a", "b"], p_ok: true }) && JSON.stringify(marcar[1][1]) === JSON.stringify({ p_ids: ["c"], p_ok: false }), "marca enviados e falhos separado");
ok(enviados[0].assunto === "2 avisos novos no CicloDev" && enviados[1].assunto === "Maria mencionou você", "assunto: um aviso usa o título, vários dizem quantos");
ok(!enviados[0].html.includes("<b>Aprovações</b>") && enviados[0].html.includes("&lt;b&gt;Aprovações"), "texto do aviso vai escapado no HTML");
ok(enviados[0].html.includes("Olá, William."), "chama pelo primeiro nome");

res = await tratar(pedido("diario"), rpc(null, { message: "boom" }), enviar(() => true), cfg);
const t = await res.text();
ok(res.status === 500 && !t.includes("boom"), "erro do banco: 500 sem detalhe interno");

const m = montarAvisos(grupo("w@x.com", ["a"]), "diario", cfg.site);
ok(m.assunto === "Seu resumo do dia no CicloDev: 1 aviso", "resumo do dia tem assunto próprio");

chamadas.length = 0; enviados.length = 0;
res = await tratar(pedido("semanal"), rpc([{ pessoa_id: "p", nome: "Ana", email: "a@x.com", feitos: [{ chave: "BL-1", titulo: "Feito" }], atrasados: [], proximos: [{ chave: "BL-2", titulo: "Vem aí", prazo: "2026-10-02" }], nao_lidos: 3 }]), enviar(() => true), cfg);
ok(res.status === 200 && chamadas[0][0] === "relatorio_semanal_lote" && enviados.length === 1 && enviados[0].assunto === "Sua semana no CicloDev: 1 concluídos, 0 atrasados", "relatório da semana");
ok(enviados[0].html.includes("(prazo 02/10)") && enviados[0].html.includes("<b>3</b>"), "relatório mostra prazo e não lidos");

let pedidoResend: { url: string; init: RequestInit } | null = null;
const falso = (async (url: string, init: RequestInit) => { pedidoResend = { url, init }; return new Response("{}", { status: 200 }); }) as unknown as typeof fetch;
const env = enviarPeloResend("chave-teste", "CicloDev <avisos@it-ia.tec.br>", falso);
ok(await env({ para: "w@x.com", assunto: "a", html: "<p>h</p>", texto: "t" }), "Resend: envio ok");
const b = JSON.parse(String(pedidoResend!.init.body));
ok(pedidoResend!.url === "https://api.resend.com/emails" && b.from === "CicloDev <avisos@it-ia.tec.br>" && b.to[0] === "w@x.com" && b.text === "t", "Resend: remetente, destino e texto certos");
ok(!(await enviarPeloResend("", "x", falso)({ para: "w@x.com", assunto: "a", html: "", texto: "" })), "sem chave do Resend não tenta enviar");

console.log(falhas ? falhas + " FALHA(S)" : "TUDO OK");
if (falhas) process.exit(1);
