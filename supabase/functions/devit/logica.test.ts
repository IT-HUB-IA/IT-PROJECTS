// Testes da função devit: node --experimental-strip-types supabase/functions/devit/logica.test.ts
import { tratar, textoPasso, acharFaq, mascarar, SENHA_NO_ENDERECO, GUIAS, sistemaIa } from "./logica.ts";

let falhas = 0;
const ok = (c: unknown, m: string) => { if (!c) falhas++; console.log((c ? "OK   " : "FALHA") + " " + m); };

// banco falso: só o que a função usa (ia_mensagens e ia_permissoes)
function banco(estado: { msgs: any[]; pode: boolean; pessoa: string }, papel: "usuario" | "servico") {
  const tabela = (t: string) => {
    const q: any = { f: [] as ((r: any) => boolean)[], lim: 999, ordem: null as any, cont: false, ins: null as any };
    const linhas = () => (t === "ia_permissoes" ? [{ pessoa_id: estado.pessoa, ativo: estado.pode }] : estado.msgs.filter((m) => papel === "servico" || m.pessoa_id === estado.pessoa));
    const fim = () => {
      if (q.ins) { const r = { id: "m" + (estado.msgs.length + 1), anexos: [], criado_em: new Date(Date.now() + estado.msgs.length * 1000).toISOString(), ...q.ins }; estado.msgs.push(r); return { data: [r], error: null }; }
      let l = linhas().filter((r) => q.f.every((f: any) => f(r)));
      if (q.ordem) l = l.slice().sort((a, b) => (a[q.ordem.c] < b[q.ordem.c] ? -1 : 1) * (q.ordem.asc ? 1 : -1));
      return q.cont ? { data: null, count: l.length, error: null } : { data: l.slice(0, q.lim), error: null };
    };
    const px: any = {
      select: (_c: string, o?: any) => { if (o && o.count) q.cont = true; return px; },
      order: (c: string, o: any) => { q.ordem = { c, asc: o.ascending !== false }; return px; },
      limit: (n: number) => { q.lim = n; return px; },
      eq: (c: string, v: any) => { q.f.push((r: any) => r[c] === v); return px; },
      gte: (c: string, v: any) => { q.f.push((r: any) => r[c] >= v); return px; },
      contains: (c: string, v: any) => { q.f.push((r: any) => Object.entries(v).every(([k, x]) => (r[c] || {})[k] === x)); return px; },
      insert: (r: any) => { if (papel !== "servico") throw new Error("só o serviço grava agente"); q.ins = r; return px; },
      then: (res: any, rej: any) => Promise.resolve(fim()).then(res, rej),
    };
    return px;
  };
  return { rpc: async (fn: string) => (fn === "ia_posso" ? { data: estado.pode, error: null } : { data: null, error: { message: "?" } }), from: tabela };
}
const pedido = (corpo: unknown) => new Request("http://x/devit", { method: "POST", body: JSON.stringify(corpo) });
function montar(opts: { pode?: boolean; chave?: string; ia?: any } = {}) {
  const estado = { msgs: [] as any[], pode: opts.pode !== false, pessoa: "p1" };
  const iaChamadas: any[] = [];
  const d = { env: (n: string) => (n === "ANTHROPIC_API_KEY" ? opts.chave : undefined), usuario: banco(estado, "usuario"), servico: banco(estado, "servico"),
    ia: opts.ia ? async (s: string, c: any) => { iaChamadas.push({ s, c }); return opts.ia(s, c); } : undefined };
  // a pessoa grava a própria fala direto na tabela (como a tela faz); aqui simulado
  const falar = (texto: string, contexto: any = {}) => estado.msgs.push({ id: "u" + estado.msgs.length, pessoa_id: "p1", autor: "usuario", texto, contexto, anexos: [], criado_em: new Date(Date.now() + estado.msgs.length * 1000).toISOString() });
  const chamar = async (corpo: unknown) => { const r = await tratar(pedido(corpo), d as any); return { status: r.status, j: await r.json() }; };
  return { estado, falar, chamar, iaChamadas };
}
const ultimo = (e: any) => e.msgs[e.msgs.length - 1];

(async () => {
  // sem IA ligada para a pessoa
  { const t = montar({ pode: false }); const r = await t.chamar({ acao: "guia", guia: "banco" }); ok(r.status === 403 && /não está ligado/.test(r.j.erro), "sem a IA ligada para a pessoa, o DevIT não fala (403)"); }

  // guia completo do Supabase, só com botões, sem chave de IA
  const t = montar();
  let r = await t.chamar({ acao: "guia", guia: "banco" });
  ok(r.status === 200 && /onde o seu banco está/.test(r.j.mensagens[0].texto) && r.j.mensagens[0].contexto.botoes.map((b: any) => b.valor).join() === "guia:banco-supabase,guia:banco-aws", "o guia começa perguntando onde o banco está (Supabase ou AWS)");
  ok(ultimo(t.estado).autor === "agente" && ultimo(t.estado).pessoa_id === "p1", "a fala do DevIT fica na conversa da própria pessoa");
  t.falar("Supabase", { guia: "banco", valor: "guia:banco-supabase" }); r = await t.chamar({ acao: "responder" });
  ok(/banco do Supabase/.test(r.j.mensagens[0].texto) && !/^Oi/.test(r.j.mensagens[0].texto) && /nunca cole senha/i.test(r.j.mensagens[0].texto) && r.j.mensagens[0].contexto.guia === "banco-supabase", "escolher Supabase abre o guia do Supabase, com o aviso de nunca colar senha");
  t.falar("Vamos começar", { guia: "banco-supabase", valor: "feito" }); r = await t.chamar({ acao: "responder" });
  ok(/^\*\*Passo 1 de 6: Abra o projeto certo\*\*/.test(r.j.mensagens[0].texto) && r.j.mensagens[0].contexto.passo === 0, "Vamos começar mostra o passo 1 de 6");
  ok(r.j.mensagens[0].contexto.botoes.map((b: any) => b.valor).join() === "feito,duvida,erro", "cada passo oferece Feito, Tenho uma dúvida e Deu erro");
  t.falar("Feito, próximo passo", { guia: "banco-supabase", valor: "feito" }); r = await t.chamar({ acao: "responder" });
  ok(/Passo 2 de 6/.test(r.j.mensagens[0].texto) && /```\ncreate role leitura_ciclodev with login/.test(r.j.mensagens[0].texto) && /Success\. No rows returned/.test(r.j.mensagens[0].texto), "o passo 2 traz o comando num bloco e pergunta se apareceu Success");
  // dúvida sem IA: responde pela base
  t.falar("Tenho uma dúvida", { guia: "banco-supabase", valor: "duvida" }); r = await t.chamar({ acao: "responder" });
  ok(/Escreva a sua dúvida/.test(r.j.mensagens[0].texto) && r.j.mensagens[0].contexto.passo === 1, "Tenho uma dúvida pede a dúvida e continua no mesmo passo");
  t.falar("deu role leitura_ciclodev already exists"); r = await t.chamar({ acao: "responder" });
  ok(/já existia/.test(r.j.mensagens[0].texto) && /alter role leitura_ciclodev with password/.test(r.j.mensagens[0].texto) && r.j.mensagens[0].contexto.passo === 1, "sem chave de IA, a dúvida é respondida pelas perguntas frequentes (usuário já existe)");
  t.falar("isso é seguro? ele consegue ler os dados dos clientes?"); r = await t.chamar({ acao: "responder" });
  ok(/É seguro/.test(r.j.mensagens[0].texto), "pergunta de segurança tem resposta da base");
  t.falar("sim, deu certo"); r = await t.chamar({ acao: "responder" });
  ok(/Passo 3 de 6/.test(r.j.mensagens[0].texto), "responder que deu certo, por escrito, também avança");
  // senha colada no chat
  t.falar("meu endereço é postgresql://leitura_ciclodev.abc:MinhaSenha1@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"); r = await t.chamar({ acao: "responder" });
  ok(/trocar a senha/.test(r.j.mensagens[0].texto) && r.j.mensagens[0].contexto.passo === 2, "endereço com senha colado no chat: o DevIT avisa para trocar a senha e não avança");
  // texto que ninguém entende
  t.falar("blablabla xyz"); r = await t.chamar({ acao: "responder" });
  ok(/Não tenho certeza de ter entendido/.test(r.j.mensagens[0].texto) && /Tenant or user not found/.test(r.j.mensagens[0].texto), "quando não entende, diz isso e lista os assuntos que sabe");
  for (let i = 0; i < 3; i++){ t.falar("Feito", { guia: "banco-supabase", valor: "feito" }); r = await t.chamar({ acao: "responder" }); }
  ok(/Passo 6 de 6/.test(r.j.mensagens[0].texto), "os botões levam até o último passo");
  const p5 = t.estado.msgs.filter((m: any) => m.autor === "agente" && m.contexto.passo === 4).pop();
  ok(p5 && p5.contexto.botoes[0].valor === "local:abrir:supabase", "o passo de colar oferece o botão de abrir a janela de ligar banco");
  t.falar("Feito", { guia: "banco-supabase", valor: "feito" }); r = await t.chamar({ acao: "responder" });
  ok(r.j.mensagens[0].contexto.fim === true && /banco está ligado/.test(r.j.mensagens[0].texto), "depois do último passo, o DevIT encerra o guia");
  t.falar("obrigado"); r = await t.chamar({ acao: "responder" });
  ok(r.status === 200 && r.j.mensagens.length === 0, "com o guia encerrado, o DevIT não responde sozinho (fica quieto como antes)");

  // com a chave de IA: a IA responde usando a base, e o avancar leva ao próximo passo
  const t2 = montar({ chave: "x", ia: async (_s: string, c: any) => ({ resposta: "Resposta da IA para: " + c[c.length - 1].content, avancar: /terminei/.test(c[c.length - 1].content) }) });
  await t2.chamar({ acao: "guia", guia: "banco-aws" });
  t2.falar("Vamos", { guia: "banco-aws", valor: "feito" }); await t2.chamar({ acao: "responder" });
  t2.falar("o que é o endpoint reader? minha senha é postgresql://u:SenhaSecreta9@h.rds.amazonaws.com:5432/p");
  r = await t2.chamar({ acao: "responder" });
  ok(t2.iaChamadas.length === 0 && /trocar a senha/.test(r.j.mensagens[0].texto), "com senha no texto, nada vai para a IA");
  t2.falar("o que é o endpoint reader?"); r = await t2.chamar({ acao: "responder" });
  ok(t2.iaChamadas.length === 1 && /^Resposta da IA/.test(r.j.mensagens[0].texto) && r.j.mensagens[0].contexto.ia === true && r.j.mensagens[0].contexto.passo === 0, "com a chave, a dúvida vai para a IA e o passo continua o mesmo");
  const conv = t2.iaChamadas[0].c; const tudo = JSON.stringify(conv);
  ok(conv[0].role === "user" && !/SenhaSecreta9/.test(tudo) && /\*\*\*@/.test(tudo), "a conversa enviada à IA começa pela pessoa e leva as senhas mascaradas");
  ok(/Publicly accessible/.test(t2.iaChamadas[0].s) && /Reader/.test(t2.iaChamadas[0].s) && /Nunca peça senha/.test(t2.iaChamadas[0].s) && /Não cumprimente/.test(t2.iaChamadas[0].s) && /passo 1 de 6/.test(t2.iaChamadas[0].s), "a IA recebe a base de conhecimento inteira, as regras e o passo atual");
  t2.falar("terminei esse passo"); r = await t2.chamar({ acao: "responder" });
  ok(/Resposta da IA/.test(r.j.mensagens[0].texto) && /Passo 2 de 6/.test(r.j.mensagens[0].texto) && r.j.mensagens[0].contexto.passo === 1, "quando a IA entende que o passo foi concluído, o DevIT já mostra o próximo");
  // IA fora do ar: cai para as perguntas frequentes
  const t3 = montar({ chave: "x", ia: async () => { throw new Error("fora do ar"); } });
  await t3.chamar({ acao: "guia", guia: "banco-aws" }); t3.falar("Vamos", { guia: "banco-aws", valor: "feito" }); await t3.chamar({ acao: "responder" });
  t3.falar("deu timeout, tempo esgotado"); r = await t3.chamar({ acao: "responder" });
  ok(/Publicly accessible/.test(r.j.mensagens[0].texto), "se a IA falhar, a resposta vem das perguntas frequentes");

  // encerrar no meio: pelo botão ou escrevendo
  const t4 = montar(); await t4.chamar({ acao: "guia", guia: "banco-supabase" }); t4.falar("Vamos", { guia: "banco-supabase", valor: "feito" }); await t4.chamar({ acao: "responder" });
  t4.falar("Encerrar conversa", { guia: "banco-supabase", valor: "parar" }); r = await t4.chamar({ acao: "responder" });
  ok(r.j.mensagens[0].contexto.fim === true && /encerrei/.test(r.j.mensagens[0].texto), "Encerrar conversa corta o guia no meio e o DevIT se despede");
  t4.falar("mais uma coisa"); r = await t4.chamar({ acao: "responder" });
  ok(r.j.mensagens.length === 0, "depois de encerrar, o DevIT não continua o guia");
  const t5 = montar(); await t5.chamar({ acao: "guia", guia: "banco-aws" }); t5.falar("Vamos", { guia: "banco-aws", valor: "feito" }); await t5.chamar({ acao: "responder" });
  t5.falar("quero parar por hoje"); r = await t5.chamar({ acao: "responder" });
  ok(r.j.mensagens[0].contexto.fim === true, "escrever quero parar também encerra");
  t5.falar("x"); const t6 = montar(); await t6.chamar({ acao: "guia", guia: "banco-aws" }); t6.falar("Vamos", { guia: "banco-aws", valor: "feito" }); await t6.chamar({ acao: "responder" });
  t6.falar("para que serve o endpoint?"); r = await t6.chamar({ acao: "responder" });
  ok(!r.j.mensagens[0].contexto.fim, "uma pergunta que começa com para não encerra");

  // peças
  ok(SENHA_NO_ENDERECO.test("mysql://u:a#b@h:3306/x") && !SENHA_NO_ENDERECO.test("postgresql://leitura_ciclodev.codigodoprojeto@host"), "reconhece endereço com senha");
  ok(mascarar("postgresql://u:Adri@n@h.com:5432/p") === "postgresql://u:***@h.com:5432/p", "mascara a senha até o último @");
  ok(acharFaq("Tenant or user not found", "banco-supabase")?.titulo === "Tenant or user not found" && acharFaq("Tenant or user not found", "banco-aws") === null, "as perguntas frequentes respeitam o guia");
  ok(Object.values(GUIAS).every((g: any) => g.passos.length === 6 && g.passos.every((p: any) => p.titulo && p.texto && p.pergunta)), "os dois guias têm 6 passos completos");
  ok(!/—/.test(JSON.stringify(GUIAS)) && !/—/.test(sistemaIa("banco-supabase", 0)), "nenhum travessão no que o DevIT fala");
  ok(/Passo 4 de 6/.test(textoPasso(GUIAS["banco-aws"], 3)) && /require ssl/.test(textoPasso(GUIAS["banco-aws"], 3)), "o passo do usuário da AWS traz o comando do PostgreSQL e do MySQL");

  console.log(falhas ? falhas + " FALHA(S)" : "TUDO OK"); process.exit(falhas ? 1 : 0);
})();
