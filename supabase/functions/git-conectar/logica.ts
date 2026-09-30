// Função git-conectar (verify_jwt: true, quem chama é a pessoa logada): o vai e volta com o GitHub e o GitLab.
//   app_concluir: o dono do sistema criou o app no GitHub (manifesto); troca o código pelos dados do app e guarda.
//   concluir:     a pessoa voltou da janelinha do GitHub ou do GitLab; confere que é ela e guarda a conta no espaço dela.
//   repos:        os repositórios que uma conta conectada deixa ver, para escolher.
//   ligar:        liga um deles a um projeto, produto ou aplicação (no GitLab cria o aviso no projeto, sozinho).
//   desligar:     desliga o repositório (no GitLab tira o aviso também).
//   desconectar:  tira a conta do espaço (no GitLab devolve a chave).
// Quem a pessoa é e o que ela pode fica com o banco: tudo o que é dela passa pelo cliente com o login dela (RLS);
// só os segredos (dados do app e chaves) passam pelo cliente de serviço.
import { GH_API, ghCabecalhos, acessoDaConexao, listarRepos, lerRepo, cabecalhos } from '../_shared/git.ts';
import type { Rpc, DepsGit } from '../_shared/git.ts';

export interface DepsCon {
  env: (n: string) => string | undefined;
  buscar: typeof fetch;
  rpc: Rpc;                       // serviço (service_role): segredos
  rpcUsuario: Rpc;                // a pessoa logada
  ler: (tabela: string, id: string) => Promise<any | null>;          // como a pessoa (RLS)
  apagar: (tabela: string, id: string) => Promise<boolean>;          // como a pessoa (RLS), confere que apagou
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
class Recusa extends Error { status: number; constructor(m: string, s = 400) { super(m); this.status = s; } }

async function chamar(rpc: Rpc, nome: string, args: Record<string, unknown>) {
  const r = await rpc(nome, args);
  if (r.error) throw new Recusa(r.error.message || 'erro no banco', 403);
  return r.data;
}
const deps = (d: DepsCon): DepsGit => ({ rpc: d.rpc, buscar: d.buscar });

async function appConcluir(d: DepsCon, c: any) {
  if (!c.code || !c.estado || !/^https:\/\//.test(c.retorno || '')) throw new Recusa('Faltam dados da volta do GitHub');
  await chamar(d.rpcUsuario, 'git_estado_usar', { p_estado: c.estado, p_provedor: 'github-app' });
  const r = await d.buscar(GH_API + '/app-manifests/' + encodeURIComponent(c.code) + '/conversions', { method: 'POST', headers: { accept: 'application/vnd.github+json', 'user-agent': 'CicloDev' } });
  if (!r.ok) throw new Recusa('O GitHub não confirmou o app (' + r.status + '). Tente criar de novo.');
  const j = await r.json();
  const pub = await chamar(d.rpcUsuario, 'git_app_gravar', { p_provedor: 'github', p_dados: {
    app_id: String(j.id), slug: j.slug, client_id: j.client_id, client_secret: j.client_secret, webhook_secret: j.webhook_secret, pem: j.pem,
    nome: j.name, html_url: j.html_url, dono: j.owner?.login, retorno: c.retorno } });
  return { ok: true, app: pub };
}

async function concluir(d: DepsCon, c: any) {
  if (!['github', 'gitlab'].includes(c.provedor) || !c.code || !c.estado) throw new Recusa('Faltam dados da volta');
  const est = await chamar(d.rpcUsuario, 'git_estado_usar', { p_estado: c.estado, p_provedor: c.provedor });
  const app = await chamar(d.rpc, 'git_app_ler', { p_provedor: c.provedor });
  if (!app) throw new Recusa(c.provedor === 'github' ? 'O app do GitHub ainda não foi criado' : 'O GitLab ainda não foi configurado');
  const ids: string[] = [];
  if (c.provedor === 'github') {
    // prova de quem é: a chave da pessoa no GitHub lista só as instalações do app a que ela tem acesso
    const t = await d.buscar('https://github.com/login/oauth/access_token', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'CicloDev' },
      body: JSON.stringify({ client_id: app.client_id, client_secret: app.client_secret, code: c.code }) });
    const tj = t.ok ? await t.json() : {};
    if (!tj.access_token) throw new Recusa('O GitHub não confirmou a conta' + (tj.error_description ? ': ' + tj.error_description : '') + '. Tente de novo.');
    const r = await d.buscar(GH_API + '/user/installations?per_page=100', { headers: ghCabecalhos(tj.access_token) });
    if (!r.ok) throw new Recusa('O GitHub respondeu ' + r.status + ' ao listar as contas');
    const lista = ((await r.json()).installations || []) as any[];
    for (const i of lista) ids.push(await chamar(d.rpc, 'git_conexao_gravar', { p_espaco: est.espaco_id, p_pessoa: est.pessoa_id, p_provedor: 'github',
      p_externo: String(i.id), p_conta: i.account?.login || String(i.id), p_tipo: i.account?.type || null, p_avatar: i.account?.avatar_url || null, p_url: i.html_url || null, p_tokens: null }));
    // a chave da pessoa não fica guardada: devolve ao GitHub
    await d.buscar(GH_API + '/applications/' + encodeURIComponent(app.client_id) + '/token', { method: 'DELETE',
      headers: { ...ghCabecalhos(''), authorization: 'Basic ' + btoa(app.client_id + ':' + app.client_secret) }, body: JSON.stringify({ access_token: tj.access_token }) }).catch(() => null);
    return { ok: true, conexoes: ids, instalar: ids.length ? null : 'https://github.com/apps/' + app.slug + '/installations/new' };
  }
  const t = await d.buscar(app.base + '/oauth/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: c.code, client_id: app.client_id, client_secret: app.client_secret, redirect_uri: app.retorno }).toString() });
  const tj = t.ok ? await t.json() : {};
  if (!tj.access_token) throw new Recusa('O GitLab não confirmou a conta' + (tj.error_description ? ': ' + tj.error_description : '') + '. Tente de novo.');
  const u = await d.buscar(app.base + '/api/v4/user', { headers: { authorization: 'Bearer ' + tj.access_token } });
  if (!u.ok) throw new Recusa('O GitLab respondeu ' + u.status + ' ao ler a conta');
  const uj = await u.json();
  ids.push(await chamar(d.rpc, 'git_conexao_gravar', { p_espaco: est.espaco_id, p_pessoa: est.pessoa_id, p_provedor: 'gitlab', p_externo: String(uj.id),
    p_conta: uj.username, p_tipo: 'User', p_avatar: uj.avatar_url || null, p_url: uj.web_url || null,
    p_tokens: { acesso: tj.access_token, renovacao: tj.refresh_token || null, expira_em: tj.expires_in ? new Date(Date.now() + tj.expires_in * 1000).toISOString() : null } }));
  return { ok: true, conexoes: ids };
}

async function conexaoMinha(d: DepsCon, id: string) {
  if (!UUID.test(id || '')) throw new Recusa('Conta inválida');
  const c = await d.ler('git_conexoes', id);
  if (!c) throw new Recusa('Esta conta não está conectada ao seu espaço', 403);
  return c;
}

async function repos(d: DepsCon, c: any) {
  await conexaoMinha(d, c.conexao_id);
  const a = await acessoDaConexao(deps(d), c.conexao_id);
  return { ok: true, repos: await listarRepos(deps(d), a) };
}

async function ligar(d: DepsCon, c: any) {
  if (!UUID.test(c.no_id || '')) throw new Recusa('Diga onde ligar o repositório');
  const con = await conexaoMinha(d, c.conexao_id);
  const a = await acessoDaConexao(deps(d), c.conexao_id);
  const info = await lerRepo(deps(d), a, String(c.externo_id || ''));
  const r = await chamar(d.rpcUsuario, 'git_repo_ligar', { p_no: c.no_id, p_conexao: con.id, p_externo: info.externo_id, p_nome: info.nome, p_url: info.url, p_branch: info.branch, p_mover: c.mover !== false });
  if (con.provedor === 'gitlab' && !r.webhook_id) {
    const segredo = await chamar(d.rpc, 'git_repo_segredo', { p_repo: r.id });
    const h = await d.buscar(a.base + '/projects/' + encodeURIComponent(info.externo_id) + '/hooks', { method: 'POST', headers: { ...cabecalhos(a), 'content-type': 'application/json' },
      body: JSON.stringify({ url: (d.env('SUPABASE_URL') || '').replace(/\/$/, '') + '/functions/v1/git-webhook?r=' + r.id, token: segredo,
        push_events: true, merge_requests_events: true, releases_events: true, deployment_events: true, tag_push_events: false, enable_ssl_verification: true }) });
    if (!h.ok) {
      await d.apagar('repositorios', r.id);
      throw new Recusa('O GitLab não deixou criar o aviso no projeto (' + h.status + ')' + (h.status === 403 ? ': a conta precisa ser Maintainer do projeto' : ''), 403);
    }
    const hj = await h.json();
    await chamar(d.rpc, 'git_repo_gancho', { p_repo: r.id, p_gancho: String(hj.id) });
    r.webhook_id = String(hj.id);
  }
  // os desenhos automáticos do código saem na hora (se o ponto for um projeto ou produto)
  await d.rpcUsuario('infra_auto_pedir', { p_no: c.no_id }).catch(() => null);
  return { ok: true, repositorio: r };
}

async function desligar(d: DepsCon, c: any) {
  if (!UUID.test(c.repo_id || '')) throw new Recusa('Repositório inválido');
  const r = await d.ler('repositorios', c.repo_id);
  if (!r) throw new Recusa('Repositório não encontrado', 404);
  if (!await d.apagar('repositorios', r.id)) throw new Recusa('Você não pode desligar este repositório', 403);
  let aviso: string | null = null;
  if (r.provedor === 'gitlab' && r.webhook_id && r.conexao_id) {
    try {
      const a = await acessoDaConexao(deps(d), r.conexao_id);
      const h = await d.buscar(a.base + '/projects/' + encodeURIComponent(r.externo_id) + '/hooks/' + encodeURIComponent(r.webhook_id), { method: 'DELETE', headers: cabecalhos(a) });
      if (!h.ok && h.status !== 404) aviso = 'Não deu para tirar o aviso do projeto no GitLab (' + h.status + '). Ele pode ser apagado lá em Settings, Webhooks.';
    } catch (e) { aviso = 'Não deu para tirar o aviso do projeto no GitLab: ' + (e as Error).message; }
  }
  return { ok: true, aviso };
}

async function desconectar(d: DepsCon, c: any) {
  const con = await conexaoMinha(d, c.conexao_id);
  const cheio = con.provedor === 'gitlab' ? await chamar(d.rpc, 'git_conexao_ler', { p_id: con.id }) : null;
  await chamar(d.rpcUsuario, 'git_conexao_remover', { p_id: con.id });
  if (cheio?.tokens?.acesso) {
    const app = await chamar(d.rpc, 'git_app_ler', { p_provedor: 'gitlab' }).catch(() => null);
    if (app) await d.buscar(app.base + '/oauth/revoke', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: app.client_id, client_secret: app.client_secret, token: cheio.tokens.acesso }).toString() }).catch(() => null);
  }
  return { ok: true };
}

const ACOES: Record<string, (d: DepsCon, c: any) => Promise<unknown>> = { app_concluir: appConcluir, concluir, repos, ligar, desligar, desconectar };

export async function tratar(req: Request, d: DepsCon): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return resposta({ ok: false, erro: 'Use POST' }, 405);
  let corpo: any = {};
  try { corpo = await req.json(); } catch { return resposta({ ok: false, erro: 'O corpo precisa ser JSON' }, 400); }
  const acao = ACOES[corpo.acao];
  if (!acao) return resposta({ ok: false, erro: 'Ação desconhecida' }, 400);
  try { return resposta(await acao(d, corpo)); }
  catch (e) { return resposta({ ok: false, erro: String((e as Error).message || e).slice(0, 500) }, (e as Recusa).status || 502); }
}
