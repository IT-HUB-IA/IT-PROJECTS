// Falar com o GitHub e com o GitLab em nome de uma conta conectada (parte 32), sem chave de pessoa nenhuma.
//   GitHub: o app do CicloDev assina um JWT (RS256, vale 9 minutos) e troca por uma chave da instalação (vale 1 hora).
//   GitLab: a chave OAuth da conexão; quando está para vencer, renova com a chave de renovação e guarda a nova.
// Usado pelas funções git-conectar (listar e ligar repositórios), diagramas-auto (baixar o código) e diagramas (o DevIT ler o código).
// Os segredos só chegam aqui pelas funções do banco que o papel service_role chama (git_app_ler, git_conexao_ler).

export type Rpc = (nome: string, args: Record<string, unknown>) => Promise<{ data: any; error: { message?: string } | null }>;
export interface DepsGit { rpc: Rpc; buscar: typeof fetch; agora?: () => number }
export type Acesso = { provedor: 'github' | 'gitlab'; token: string; base: string; conta: string };
export type RepoGit = { nome: string; externo_id?: string | null };
export type RepoInfo = { externo_id: string; nome: string; url: string; branch: string; privado: boolean };

export const GH_API = 'https://api.github.com';
export const ghCabecalhos = (tk: string) => ({ authorization: 'Bearer ' + tk, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'CicloDev' });
export const cabecalhos = (a: Acesso): Record<string, string> => a.provedor === 'github' ? ghCabecalhos(a.token) : { authorization: 'Bearer ' + a.token, 'user-agent': 'CicloDev' };
const agoraDe = (d: DepsGit) => (d.agora ? d.agora() : Date.now());

async function chamar(d: DepsGit, nome: string, args: Record<string, unknown>) {
  const r = await d.rpc(nome, args);
  if (r.error) throw new Error(nome + ': ' + (r.error.message || 'erro'));
  return r.data;
}

// ---------- JWT do app do GitHub ----------
const tamanhoDer = (n: number): number[] => { if (n < 128) return [n]; const b: number[] = []; while (n > 0) { b.unshift(n & 255); n >>= 8; } return [0x80 | b.length, ...b]; };
// o GitHub entrega a chave no formato PKCS#1 ("BEGIN RSA PRIVATE KEY"); o WebCrypto só importa PKCS#8: embrulha
export function pemParaPkcs8(pem: string): Uint8Array<ArrayBuffer> {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (/BEGIN PRIVATE KEY/.test(pem)) return der;
  const algoritmo = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const versao = [0x02, 0x01, 0x00];
  const octeto = [0x04, ...tamanhoDer(der.length)];
  const corpo = versao.length + algoritmo.length + octeto.length + der.length;
  const cab = [0x30, ...tamanhoDer(corpo)];
  const out = new Uint8Array(cab.length + corpo);
  out.set([...cab, ...versao, ...algoritmo, ...octeto], 0);
  out.set(der, cab.length + versao.length + algoritmo.length + octeto.length);
  return out;
}
const b64url = (b: Uint8Array | string) => {
  const bytes = typeof b === 'string' ? new TextEncoder().encode(b) : b;
  let s = ''; for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export async function jwtDoApp(appId: string | number, pem: string, agora = Date.now()): Promise<string> {
  const s = Math.floor(agora / 1000);
  const txt = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64url(JSON.stringify({ iat: s - 60, exp: s + 540, iss: String(appId) }));
  const chave = await crypto.subtle.importKey('pkcs8', pemParaPkcs8(pem) as Uint8Array<ArrayBuffer>, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const assinatura = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', chave, new TextEncoder().encode(txt)));
  return txt + '.' + b64url(assinatura);
}
export async function tokenDaInstalacao(d: DepsGit, app: any, instalacao: string): Promise<string> {
  const jwt = await jwtDoApp(app.app_id, app.pem, agoraDe(d));
  const r = await d.buscar(GH_API + '/app/installations/' + encodeURIComponent(instalacao) + '/access_tokens', { method: 'POST', headers: ghCabecalhos(jwt) });
  if (!r.ok) throw new Error('O GitHub não deu acesso à conta (' + r.status + ')' + (r.status === 404 ? ': o app do CicloDev foi removido dessa conta' : ''));
  return (await r.json()).token;
}

// ---------- GitLab: a chave da conexão, renovada quando precisa ----------
export async function tokenGitlab(d: DepsGit, app: any, c: any): Promise<string> {
  const t = c.tokens;
  if (!t || !t.acesso) throw new Error('A conta ' + c.conta + ' do GitLab está sem chave. Conecte de novo.');
  if (!t.renovacao || !t.expira_em || Date.parse(t.expira_em) - agoraDe(d) > 120000) return t.acesso;
  const r = await d.buscar(app.base + '/oauth/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.renovacao, client_id: app.client_id, client_secret: app.client_secret, redirect_uri: app.retorno }).toString(),
  });
  if (!r.ok) {
    await chamar(d, 'git_conexao_erro', { p_conexao: c.id, p_erro: 'Conta desconectada: o GitLab não renovou o acesso. Conecte de novo.' }).catch(() => null);
    throw new Error('O GitLab não renovou o acesso da conta ' + c.conta + ' (' + r.status + '). Conecte a conta de novo.');
  }
  const j = await r.json();
  await chamar(d, 'git_tokens_gravar', { p_conexao: c.id, p_acesso: j.access_token, p_renovacao: j.refresh_token || null,
    p_expira: j.expires_in ? new Date(agoraDe(d) + j.expires_in * 1000).toISOString() : null });
  return j.access_token;
}

// a chave certa para a conta conectada
export async function acessoDaConexao(d: DepsGit, conexaoId: string): Promise<Acesso> {
  const c = await chamar(d, 'git_conexao_ler', { p_id: conexaoId });
  if (!c) throw new Error('A conta conectada não existe mais');
  if (c.removida_em) throw new Error('A conta ' + c.conta + ' foi desconectada no ' + (c.provedor === 'github' ? 'GitHub' : 'GitLab'));
  const app = await chamar(d, 'git_app_ler', { p_provedor: c.provedor });
  if (!app) throw new Error(c.provedor === 'github' ? 'O app do GitHub ainda não foi criado (tela Admin)' : 'O GitLab ainda não foi configurado (tela Admin)');
  if (c.provedor === 'github') return { provedor: 'github', token: await tokenDaInstalacao(d, app, c.externo_id), base: GH_API, conta: c.conta };
  return { provedor: 'gitlab', token: await tokenGitlab(d, app, c), base: app.base + '/api/v4', conta: c.conta };
}

// ---------- o que se faz com a chave ----------
const caminhoGh = (nome: string) => nome.split('/').map(encodeURIComponent).join('/');
const projetoGl = (r: RepoGit) => encodeURIComponent(r.externo_id || r.nome);

export function urlPacote(a: Acesso, repo: RepoGit, ref: string): string {
  return a.provedor === 'github'
    ? a.base + '/repos/' + caminhoGh(repo.nome) + '/tarball/' + encodeURIComponent(ref)
    : a.base + '/projects/' + projetoGl(repo) + '/repository/archive.tar.gz?sha=' + encodeURIComponent(ref);
}

const infoGh = (x: any): RepoInfo => ({ externo_id: String(x.id), nome: x.full_name, url: x.html_url, branch: x.default_branch || 'main', privado: !!x.private });
const infoGl = (x: any): RepoInfo => ({ externo_id: String(x.id), nome: x.path_with_namespace, url: x.web_url, branch: x.default_branch || 'main', privado: x.visibility !== 'public' });

async function json(d: DepsGit, a: Acesso, url: string, oque: string) {
  const r = await d.buscar(url, { headers: cabecalhos(a) });
  if (!r.ok) throw new Error('O ' + (a.provedor === 'github' ? 'GitHub' : 'GitLab') + ' respondeu ' + r.status + ' ao ' + oque);
  return r.json();
}

// os repositórios que a conta deixou o CicloDev ver (GitHub: os escolhidos na instalação; GitLab: onde a pessoa é Maintainer ou dona)
export async function listarRepos(d: DepsGit, a: Acesso): Promise<RepoInfo[]> {
  const out: RepoInfo[] = [];
  for (let p = 1; p <= 10; p++) {
    if (a.provedor === 'github') {
      const j = await json(d, a, a.base + '/installation/repositories?per_page=100&page=' + p, 'listar os repositórios');
      out.push(...(j.repositories || []).map(infoGh));
      if ((j.repositories || []).length < 100) break;
    } else {
      const j = await json(d, a, a.base + '/projects?membership=true&min_access_level=40&simple=true&order_by=last_activity_at&per_page=100&page=' + p, 'listar os projetos');
      out.push(...(j || []).map(infoGl));
      if ((j || []).length < 100) break;
    }
  }
  return out;
}
// um repositório só, pelo número (confere que a conta tem acesso a ele)
export async function lerRepo(d: DepsGit, a: Acesso, externo: string): Promise<RepoInfo> {
  if (!/^[0-9]+$/.test(String(externo))) throw new Error('Repositório inválido');
  return a.provedor === 'github'
    ? infoGh(await json(d, a, a.base + '/repositories/' + externo, 'ler o repositório'))
    : infoGl(await json(d, a, a.base + '/projects/' + externo, 'ler o projeto'));
}
// a lista de arquivos de um branch ou commit
export async function listarCaminhos(d: DepsGit, a: Acesso, repo: RepoGit, ref: string): Promise<string[]> {
  if (a.provedor === 'github') {
    const j = await json(d, a, a.base + '/repos/' + caminhoGh(repo.nome) + '/git/trees/' + encodeURIComponent(ref) + '?recursive=1', 'ler a árvore de arquivos');
    return (j.tree || []).filter((x: any) => x.type === 'blob').map((x: any) => x.path);
  }
  const out: string[] = [];
  for (let p = 1; p <= 20; p++) {
    const j = await json(d, a, a.base + '/projects/' + projetoGl(repo) + '/repository/tree?recursive=true&per_page=100&ref=' + encodeURIComponent(ref) + '&page=' + p, 'ler a árvore de arquivos');
    out.push(...(j || []).filter((x: any) => x.type === 'blob').map((x: any) => x.path));
    if ((j || []).length < 100) break;
  }
  return out;
}
export async function lerArquivo(d: DepsGit, a: Acesso, repo: RepoGit, caminho: string, ref: string): Promise<string | null> {
  const url = a.provedor === 'github'
    ? a.base + '/repos/' + caminhoGh(repo.nome) + '/contents/' + caminho.split('/').map(encodeURIComponent).join('/') + '?ref=' + encodeURIComponent(ref)
    : a.base + '/projects/' + projetoGl(repo) + '/repository/files/' + encodeURIComponent(caminho) + '/raw?ref=' + encodeURIComponent(ref);
  const r = await d.buscar(url, { headers: a.provedor === 'github' ? { ...cabecalhos(a), accept: 'application/vnd.github.raw+json' } : cabecalhos(a) });
  return r.ok ? await r.text() : null;
}

// ---------- histórico: quando cada arquivo nasceu e quando foi publicado pela última vez, e as publicações (releases) ----------
export type Historico = { criado: string; publicado: string; commits: number };
export type Publicacao = { tag: string; nome: string; data: string; notas: string };
// para cada arquivo, o primeiro e o último commit na branch (até `limite` arquivos, de 6 em 6 ao mesmo tempo)
export async function historicoDosArquivos(d: DepsGit, a: Acesso, repo: RepoGit, ref: string, caminhos: string[], limite = 250): Promise<Map<string, Historico>> {
  const out = new Map<string, Historico>(), fila = [...new Set(caminhos)].slice(0, limite);
  const um = async (c: string) => {
    const url = a.provedor === 'github'
      ? a.base + '/repos/' + caminhoGh(repo.nome) + '/commits?per_page=100&sha=' + encodeURIComponent(ref) + '&path=' + encodeURIComponent(c)
      : a.base + '/projects/' + projetoGl(repo) + '/repository/commits?per_page=100&ref_name=' + encodeURIComponent(ref) + '&path=' + encodeURIComponent(c);
    const r = await d.buscar(url, { headers: cabecalhos(a) }); if (!r.ok) return;
    const lista = await r.json(); if (!Array.isArray(lista) || !lista.length) return;
    const dataDe = (x: any) => String(a.provedor === 'github' ? (x.commit?.committer?.date || x.commit?.author?.date || '') : (x.committed_date || x.created_at || ''));
    let primeiro = dataDe(lista[lista.length - 1]), n = lista.length;
    // mais de 100 commits no arquivo: a última página tem o primeiro (GitHub diz pelo Link; o GitLab, pelo x-total-pages)
    const ultima = a.provedor === 'github' ? ((r.headers.get('link') || '').match(/[?&]page=(\d+)>;\s*rel="last"/) || [])[1] : r.headers.get('x-total-pages');
    if (ultima && +ultima > 1) {
      const r2 = await d.buscar(url + '&page=' + ultima, { headers: cabecalhos(a) });
      if (r2.ok) { const l2 = await r2.json(); if (Array.isArray(l2) && l2.length) { primeiro = dataDe(l2[l2.length - 1]); n = (+ultima - 1) * 100 + l2.length; } }
    }
    out.set(c, { criado: primeiro, publicado: dataDe(lista[0]), commits: n });
  };
  for (let i = 0; i < fila.length; i += 6) await Promise.all(fila.slice(i, i + 6).map(c => um(c).catch(() => null)));
  return out;
}
// as publicações do repositório (releases), da mais antiga para a mais nova
export async function listarPublicacoes(d: DepsGit, a: Acesso, repo: RepoGit): Promise<Publicacao[]> {
  const url = a.provedor === 'github' ? a.base + '/repos/' + caminhoGh(repo.nome) + '/releases?per_page=100' : a.base + '/projects/' + projetoGl(repo) + '/releases?per_page=100';
  const r = await d.buscar(url, { headers: cabecalhos(a) }); if (!r.ok) return [];
  const l = await r.json(); if (!Array.isArray(l)) return [];
  return l.filter((x: any) => !x.draft).map((x: any) => ({ tag: String(x.tag_name || ''), nome: String(x.name || x.tag_name || ''), data: String(x.published_at || x.released_at || x.created_at || ''), notas: String(x.body || x.description || '').slice(0, 1500) }))
    .filter(p => p.tag && p.data).sort((x, y) => x.data.localeCompare(y.data));
}
