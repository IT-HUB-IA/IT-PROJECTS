// Rodar com: node --experimental-strip-types supabase/functions/git-conectar/logica.test.ts
// O GitHub e o GitLab são simulados; a assinatura do app é conferida com uma chave RSA de verdade.
import { generateKeyPairSync, createVerify } from "node:crypto";
import { tratar } from "./logica.ts";
import { jwtDoApp, pemParaPkcs8, acessoDaConexao, urlPacote, listarCaminhos, lerArquivo } from "../_shared/git.ts";

let falhas = 0;
const ok = (c: boolean, m: string) => { if (!c) falhas++; console.log((c ? "OK    " : "FALHA ") + m); };

// ---------- a chave do app (o GitHub entrega em PKCS#1) ----------
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PEM = privateKey.export({ type: "pkcs1", format: "pem" }).toString();
ok(/BEGIN RSA PRIVATE KEY/.test(PEM) && pemParaPkcs8(PEM)[0] === 0x30, "a chave PKCS#1 do GitHub vira PKCS#8");
const jwt = await jwtDoApp("123", PEM, Date.UTC(2026, 8, 30, 12));
const [h, p, s] = jwt.split(".");
const dec = (x: string) => JSON.parse(Buffer.from(x, "base64url").toString());
const v = createVerify("RSA-SHA256"); v.update(h + "." + p);
ok(v.verify(publicKey, Buffer.from(s, "base64url")), "o JWT do app é assinado com a chave do app (RS256)");
ok(dec(h).alg === "RS256" && dec(p).iss === "123" && dec(p).exp - dec(p).iat <= 600, "o JWT diz qual é o app e vale menos de 10 minutos");

// ---------- banco e internet de mentira ----------
const E1 = "00000000-0000-4000-8000-000000000001", NO = "00000000-0000-4000-8000-0000000000aa", C_GH = "00000000-0000-4000-8000-0000000000c1", C_GL = "00000000-0000-4000-8000-0000000000c2";
const APP_GH = { app_id: "123", slug: "ciclodev", client_id: "Iv1.x", client_secret: "cs", webhook_secret: "ws", pem: PEM };
const APP_GL = { client_id: "gl", client_secret: "gls", base: "https://gitlab.com", retorno: "https://ciclodev.it-ia.tec.br/entrar?git=gitlab" };
const conexoes: Record<string, any> = {
  // a instalação tem 555 e 556, mas quem conectou só é colaborador do 555 (e o 666 foi apagado no GitHub depois)
  [C_GH]: { id: C_GH, provedor: "github", externo_id: "9001", conta: "it-hub-ia", removida_em: null, repos_permitidos: ["555", "666"] },
  [C_GL]: { id: C_GL, provedor: "gitlab", externo_id: "77", conta: "william", removida_em: null, tokens: { acesso: "velha", renovacao: "renova", expira_em: "2020-01-01T00:00:00Z" } },
};
const chamadas: string[] = [];
let permitidosGravados: any = null;
let estadoValido = true, gravadas: any[] = [], tokensGravados: any = null, ganchoGravado: any = null, apagados: string[] = [], appGravado: any = null, ligado: any = null;
const rpc = async (nome: string, a: any) => {
  chamadas.push("srv:" + nome);
  if (nome === "git_app_ler") return { data: a.p_provedor === "github" ? APP_GH : APP_GL, error: null };
  if (nome === "git_conexao_ler") return { data: conexoes[a.p_id] || null, error: null };
  if (nome === "git_conexao_gravar") { gravadas.push(a); return { data: "nova-" + gravadas.length, error: null }; }
  if (nome === "git_tokens_gravar") { tokensGravados = a; return { data: null, error: null }; }
  if (nome === "git_conexao_repos") { permitidosGravados = a; return { data: null, error: null }; }
  if (nome === "git_repo_segredo") return { data: "segredo-do-aviso", error: null };
  if (nome === "git_repo_gancho") { ganchoGravado = a; return { data: null, error: null }; }
  return { data: null, error: null };
};
const rpcUsuario = async (nome: string, a: any) => {
  chamadas.push("usr:" + nome);
  if (nome === "git_estado_usar") return estadoValido ? { data: { espaco_id: E1, pessoa_id: "p1" }, error: null } : { data: null, error: { message: "A conexão expirou ou não é sua. Tente de novo." } };
  if (nome === "git_app_gravar") { appGravado = a; return { data: { slug: a.p_dados.slug, pronto: true }, error: null }; }
  if (nome === "git_repo_ligar") { ligado = a; return { data: { id: "00000000-0000-4000-8000-0000000000r1".replace("r1", "b1"), provedor: a.p_conexao === C_GL ? "gitlab" : "github", webhook_id: null }, error: null }; }
  if (nome === "git_conexao_remover") return { data: null, error: null };
  return { data: null, error: null };
};
const visiveis = new Set([C_GH, C_GL]);
let repoLido: any = null;
const ler = async (t: string, id: string) => t === "git_conexoes" ? (visiveis.has(id) ? conexoes[id] : null) : repoLido;
const apagar = async (_t: string, id: string) => { apagados.push(id); return true; };
let ganchoStatus = 201;
const buscar = (async (url: string, op: any = {}) => {
  const u = String(url), m = (op.method || "GET"), auth = (op.headers || {}).authorization || "";
  chamadas.push(m + " " + u.replace(/\?.*$/, ""));
  const j = (x: unknown, st = 200) => new Response(JSON.stringify(x), { status: st, headers: { "content-type": "application/json" } });
  if (u.endsWith("/app-manifests/codigo-app/conversions")) return j({ id: 123, slug: "ciclodev", client_id: "Iv1.x", client_secret: "cs", webhook_secret: "ws", pem: PEM, name: "CicloDev", html_url: "https://github.com/apps/ciclodev", owner: { login: "it-hub-ia" } }, 201);
  if (u === "https://github.com/login/oauth/access_token") return JSON.parse(op.body).code === "bom" ? j({ access_token: "gho_pessoa" }) : j({ error: "bad_verification_code", error_description: "código inválido" });
  if (u.startsWith("https://api.github.com/user/installations/9001/repositories")) return auth === "Bearer gho_pessoa" ? j({ repositories: [{ id: 555 }] }) : j({}, 401);
  if (u.startsWith("https://api.github.com/user/installations")) return auth === "Bearer gho_pessoa" ? j({ installations: [{ id: 9001, html_url: "https://github.com/organizations/it-hub-ia/settings/installations/9001", account: { login: "it-hub-ia", type: "Organization", avatar_url: "https://a/1" } }] }) : j({}, 401);
  if (u.includes("/applications/Iv1.x/token")) return new Response(null, { status: 204 });
  if (u.endsWith("/app/installations/9001/access_tokens")) return /^Bearer eyJ/.test(auth) ? j({ token: "ghs_instalacao" }, 201) : j({}, 401);
  if (u.startsWith("https://api.github.com/installation/repositories")) return auth === "Bearer ghs_instalacao" ? j({ repositories: [{ id: 555, full_name: "it-hub-ia/portal", html_url: "https://github.com/it-hub-ia/portal", default_branch: "main", private: true }, { id: 556, full_name: "outra-pessoa/privado", html_url: "https://github.com/outra-pessoa/privado", default_branch: "main", private: true }] }) : j({}, 401);
  if (u === "https://api.github.com/repositories/555") return j({ id: 555, full_name: "it-hub-ia/portal", html_url: "https://github.com/it-hub-ia/portal", default_branch: "main", private: true });
  if (u === "https://api.github.com/repositories/666") return j({ message: "Not Found" }, 404);
  if (u.includes("/git/trees/")) return j({ tree: [{ type: "blob", path: "src/a.ts" }, { type: "tree", path: "src" }] });
  if (u.includes("/contents/src/a.ts")) return new Response("export const a = 1;");
  if (u === "https://gitlab.com/oauth/token") {
    const b = new URLSearchParams(op.body);
    if (b.get("grant_type") === "authorization_code") return b.get("code") === "bom" ? j({ access_token: "glat", refresh_token: "glr", expires_in: 7200 }) : j({ error: "invalid_grant" }, 400);
    return b.get("refresh_token") === "renova" ? j({ access_token: "nova", refresh_token: "renova2", expires_in: 7200 }) : j({}, 400);
  }
  if (u === "https://gitlab.com/api/v4/user") return j({ id: 77, username: "william", web_url: "https://gitlab.com/william" });
  if (u.startsWith("https://gitlab.com/api/v4/projects?")) return auth === "Bearer nova" ? j([{ id: 888, path_with_namespace: "it-hub-ia/grupo/app", web_url: "https://gitlab.com/it-hub-ia/grupo/app", default_branch: "main", visibility: "private" }]) : j({}, 401);
  if (u === "https://gitlab.com/api/v4/projects/888") return j({ id: 888, path_with_namespace: "it-hub-ia/grupo/app", web_url: "https://gitlab.com/it-hub-ia/grupo/app", default_branch: "main", visibility: "private" });
  if (u === "https://gitlab.com/api/v4/projects/888/hooks" && m === "POST") return ganchoStatus === 201 ? j({ id: 4242, url: JSON.parse(op.body).url, body: op.body }, 201) : j({ message: "403 Forbidden" }, 403);
  if (u.includes("/hooks/4242") && m === "DELETE") return new Response(null, { status: 204 });
  if (u.includes("/repository/tree")) return j([{ type: "blob", path: "app/main.py" }]);
  if (u.includes("/repository/files/app%2Fmain.py/raw")) return new Response("print(1)");
  if (u === "https://gitlab.com/oauth/revoke") return j({});
  return j({ message: "não esperado " + u }, 599);
}) as typeof fetch;
const D = { env: (n: string) => (n === "SUPABASE_URL" ? "https://proj.supabase.co" : undefined), buscar, rpc, rpcUsuario, ler, apagar };
const pedir = async (corpo: unknown) => { const r = await tratar(new Request("https://x/functions/v1/git-conectar", { method: "POST", body: JSON.stringify(corpo) }), D as any); return { st: r.status, j: await r.json() }; };

// ---------- o dono do sistema cria o app do GitHub ----------
let r = await pedir({ acao: "app_concluir", code: "codigo-app", estado: "e1", retorno: "https://ciclodev.it-ia.tec.br/entrar?git=github" });
ok(r.st === 200 && r.j.app.slug === "ciclodev" && appGravado.p_dados.pem === PEM && appGravado.p_dados.webhook_secret === "ws" && appGravado.p_dados.app_id === "123", "criar o app: troca o código pelos dados do app e guarda tudo no banco");
ok(!JSON.stringify(r.j).includes("BEGIN RSA"), "a chave do app não volta para a tela");
estadoValido = false;
r = await pedir({ acao: "app_concluir", code: "codigo-app", estado: "roubado", retorno: "https://x/entrar?git=github" });
ok(r.st === 403 && /expirou/.test(r.j.erro), "volta com vai e volta de outra pessoa é recusada");
estadoValido = true;

// ---------- a empresa conecta o GitHub ----------
gravadas = [];
r = await pedir({ acao: "concluir", provedor: "github", code: "bom", estado: "e2" });
ok(r.st === 200 && gravadas.length === 1 && gravadas[0].p_externo === "9001" && gravadas[0].p_conta === "it-hub-ia" && gravadas[0].p_espaco === E1, "GitHub: guarda no espaço da pessoa as instalações do app a que ela tem acesso");
ok(permitidosGravados?.p_conexao === "nova-1" && JSON.stringify(permitidosGravados.p_repos) === '["555"]', "GitHub: guarda só os repositórios que a pessoa pode acessar nessa instalação (ela pode ser só colaboradora)");
ok(chamadas.some((c) => c.startsWith("DELETE https://api.github.com/applications/Iv1.x/token")), "a chave da pessoa no GitHub é devolvida, não fica guardada");
r = await pedir({ acao: "concluir", provedor: "github", code: "ruim", estado: "e3" });
ok(r.st === 400 && /não confirmou/.test(r.j.erro), "código inválido do GitHub é recusado");

// ---------- a empresa conecta o GitLab ----------
gravadas = [];
r = await pedir({ acao: "concluir", provedor: "gitlab", code: "bom", estado: "e4" });
ok(r.st === 200 && gravadas[0].p_externo === "77" && gravadas[0].p_tokens.acesso === "glat" && gravadas[0].p_tokens.renovacao === "glr", "GitLab: guarda a conta e as chaves no espaço da pessoa");

// ---------- escolher o repositório ----------
r = await pedir({ acao: "repos", conexao_id: C_GH });
ok(r.st === 200 && r.j.repos.length === 1 && r.j.repos[0].externo_id === "555" && r.j.repos[0].nome === "it-hub-ia/portal", "GitHub: lista só os repositórios da instalação que quem conectou pode acessar (o 556 do dono não aparece)");
r = await pedir({ acao: "repos", conexao_id: C_GL });
ok(r.st === 200 && r.j.repos[0].externo_id === "888" && tokensGravados?.p_acesso === "nova" && tokensGravados?.p_renovacao === "renova2", "GitLab: chave vencida é renovada e a nova fica guardada");
visiveis.delete(C_GH);
r = await pedir({ acao: "repos", conexao_id: C_GH });
ok(r.st === 403, "conta de outro espaço não lista nada");
visiveis.add(C_GH);

// ---------- ligar e desligar ----------
r = await pedir({ acao: "ligar", no_id: NO, conexao_id: C_GH, externo_id: "555" });
ok(r.st === 200 && ligado.p_nome === "it-hub-ia/portal" && ligado.p_externo === "555" && ligado.p_branch === "main" && ganchoGravado === null, "GitHub: liga com o nome e o branch que vêm do GitHub, sem criar aviso (o app já avisa)");
ok(chamadas.includes("usr:infra_auto_pedir"), "ligar já pede os desenhos do código");
r = await pedir({ acao: "ligar", no_id: NO, conexao_id: C_GH, externo_id: "666" });
ok(r.st === 502 && /404/.test(r.j.erro), "repositório que sumiu do GitHub não liga");
ligado = null;
r = await pedir({ acao: "ligar", no_id: NO, conexao_id: C_GH, externo_id: "556" });
ok(r.st === 403 && /não tem acesso/.test(r.j.erro) && ligado === null, "repositório da instalação a que quem conectou não tem acesso não liga (nem chega no banco)");
conexoes[C_GL].tokens = { acesso: "nova", renovacao: "renova2", expira_em: "2099-01-01T00:00:00Z" };
r = await pedir({ acao: "ligar", no_id: NO, conexao_id: C_GL, externo_id: "888" });
const gancho = chamadas.includes("POST https://gitlab.com/api/v4/projects/888/hooks");
ok(r.st === 200 && gancho && ganchoGravado?.p_gancho === "4242", "GitLab: cria o aviso no projeto sozinho e guarda qual é");
ganchoStatus = 403; apagados = [];
r = await pedir({ acao: "ligar", no_id: NO, conexao_id: C_GL, externo_id: "888" });
ok(r.st === 403 && /Maintainer/.test(r.j.erro) && apagados.length === 1, "GitLab sem permissão de criar o aviso: explica e não deixa o repositório pela metade");
ganchoStatus = 201; apagados = [];
repoLido = { id: "00000000-0000-4000-8000-0000000000b1", provedor: "gitlab", webhook_id: "4242", externo_id: "888", conexao_id: C_GL };
r = await pedir({ acao: "desligar", repo_id: repoLido.id });
ok(r.st === 200 && apagados.length === 1 && chamadas.some((c) => c.includes("DELETE https://gitlab.com/api/v4/projects/888/hooks/4242")), "desligar tira o repositório e o aviso do GitLab");
r = await pedir({ acao: "desconectar", conexao_id: C_GL });
ok(r.st === 200 && chamadas.includes("usr:git_conexao_remover") && chamadas.includes("POST https://gitlab.com/oauth/revoke"), "desconectar o GitLab tira a conta e devolve a chave");
r = await pedir({ acao: "outra" });
ok(r.st === 400, "ação desconhecida é recusada");

// ---------- o que as funções dos desenhos usam ----------
const dg = { rpc, buscar };
const aGh = await acessoDaConexao(dg, C_GH), aGl = await acessoDaConexao(dg, C_GL);
ok(aGh.token === "ghs_instalacao" && urlPacote(aGh, { nome: "it-hub-ia/portal" }, "abc") === "https://api.github.com/repos/it-hub-ia/portal/tarball/abc", "GitHub: pacote do commit com a chave da instalação");
ok(urlPacote(aGl, { nome: "it-hub-ia/grupo/app", externo_id: "888" }, "abc") === "https://gitlab.com/api/v4/projects/888/repository/archive.tar.gz?sha=abc", "GitLab: pacote do commit pelo número do projeto");
ok((await listarCaminhos(dg, aGh, { nome: "it-hub-ia/portal" }, "main")).join() === "src/a.ts" && (await lerArquivo(dg, aGh, { nome: "it-hub-ia/portal" }, "src/a.ts", "main")) === "export const a = 1;", "GitHub: lista e lê os arquivos");
ok((await listarCaminhos(dg, aGl, { nome: "x", externo_id: "888" }, "main")).join() === "app/main.py" && (await lerArquivo(dg, aGl, { nome: "x", externo_id: "888" }, "app/main.py", "main")) === "print(1)", "GitLab: lista e lê os arquivos");
conexoes[C_GH].removida_em = "2026-09-30";
let erro = ""; try { await acessoDaConexao(dg, C_GH); } catch (e) { erro = (e as Error).message; }
ok(/desconectada/.test(erro), "conta desconectada não dá acesso");

console.log(falhas ? "FALHAS: " + falhas : "TUDO OK");
if (falhas) process.exit(1);
