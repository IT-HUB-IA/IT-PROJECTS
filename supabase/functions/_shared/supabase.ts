// Ligação com o Supabase de outra empresa sem senha (parte 54): a autorização OAuth do app do CicloDev.
// Usado pela função supabase-conectar (conferir antes de ligar) e pelo robô diagramas-auto (ler a estrutura).
// Só roda as consultas FIXAS daqui e de gerar.ts, todas no catálogo do Postgres (a estrutura). Nunca lê o conteúdo das tabelas.
// A leitura vai pelo modo "só leitura" do próprio Supabase (usuário supabase_read_only_user, transação read only),
// e cada leitura confere antes que está mesmo em só leitura.
import { CONSULTA_BANCO, CONSULTA_MIGRACOES, datasDasMigracoes } from '../diagramas-auto/gerar.ts';
import type { Estrutura } from '../diagramas-auto/gerar.ts';

export const SB_API = 'https://api.supabase.com';
export type Rpc = (nome: string, args: Record<string, unknown>) => Promise<{ data: any; error: { message?: string } | null }>;
export type DepsSb = { rpc: Rpc; buscar: typeof fetch };
export class ErroSupabase extends Error { status: number; constructor(m: string, s = 400) { super(m); this.status = s; } }

async function chamar(d: DepsSb, nome: string, args: Record<string, unknown>) {
  const r = await d.rpc(nome, args);
  if (r.error) throw new ErroSupabase(nome + ': ' + (r.error.message || 'erro no banco'), 500);
  return r.data;
}
const basico = (app: any) => 'Basic ' + btoa(app.client_id + ':' + app.client_secret);
const expiraEm = (s: unknown) => (typeof s === 'number' && s > 0 ? new Date(Date.now() + s * 1000).toISOString() : null);

// troca o código da volta da janelinha pelas chaves (com o verificador do PKCE)
export async function trocarCodigo(d: DepsSb, app: any, code: string, verificador: string) {
  const r = await d.buscar(SB_API + '/v1/oauth/token', { method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json', authorization: basico(app) },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: app.retorno, code_verifier: verificador }).toString() });
  const j: any = r.ok ? await r.json().catch(() => ({})) : await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new ErroSupabase('O Supabase não confirmou a autorização' + (j.error_description || j.message ? ': ' + (j.error_description || j.message) : ' (' + r.status + ')') + '. Tente de novo.');
  return { acesso: String(j.access_token), renovacao: j.refresh_token ? String(j.refresh_token) : null, expira_em: expiraEm(j.expires_in) };
}

// a chave de acesso de uma conexão; renova sozinha quando está para vencer (o Supabase troca também a de renovação)
export async function tokenSupabase(d: DepsSb, conexaoId: string, forcar = false): Promise<string> {
  const c = await chamar(d, 'supa_conexao_ler', { p_id: conexaoId });
  if (!c || !c.tokens?.acesso) throw new ErroSupabase('A conta do Supabase não está mais conectada. Conecte de novo.', 403);
  const vence = c.tokens.expira_em ? new Date(c.tokens.expira_em).getTime() : Infinity;
  if (!forcar && vence - Date.now() > 120_000) return c.tokens.acesso;
  if (!c.tokens.renovacao) return c.tokens.acesso;
  const app = await chamar(d, 'supa_app_ler', {});
  if (!app) throw new ErroSupabase('O Supabase ainda não foi configurado no CicloDev', 503);
  const r = await d.buscar(SB_API + '/v1/oauth/token', { method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json', authorization: basico(app) },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: c.tokens.renovacao }).toString() });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    const m = 'A autorização do Supabase foi tirada ou venceu. Conecte de novo em Ligar banco, Conectar ao Supabase.';
    await chamar(d, 'supa_conexao_erro', { p_conexao: conexaoId, p_erro: m }).catch(() => null);
    throw new ErroSupabase(m, 403);
  }
  await chamar(d, 'supa_tokens_gravar', { p_conexao: conexaoId, p_acesso: j.access_token, p_renovacao: j.refresh_token || null, p_expira: expiraEm(j.expires_in) });
  return String(j.access_token);
}

async function api(d: DepsSb, token: string, caminho: string, init: RequestInit = {}) {
  const r = await d.buscar(SB_API + caminho, { ...init, headers: { ...(init.headers || {}), authorization: 'Bearer ' + token, accept: 'application/json' } });
  const t = await r.text();
  let j: any = null; try { j = t ? JSON.parse(t) : null; } catch { j = null; }
  return { status: r.status, ok: r.ok, j, t };
}

export type Projeto = { ref: string; nome: string; regiao: string | null; organizacao: string | null; organizacao_nome: string | null; situacao: string | null };
export async function listarProjetos(d: DepsSb, token: string): Promise<Projeto[]> {
  const r = await api(d, token, '/v1/projects');
  if (r.status === 401) throw new ErroSupabase('A autorização do Supabase foi tirada ou venceu. Conecte de novo.', 403);
  if (r.status === 403) throw new ErroSupabase('A autorização não deixa ver os projetos. No app do CicloDev no Supabase, marque a permissão Projects: Read (veja Admin, aba Supabase).', 403);
  if (!r.ok || !Array.isArray(r.j)) throw new ErroSupabase('O Supabase respondeu ' + r.status + ' ao listar os projetos', 502);
  return r.j.map((p: any) => ({ ref: String(p.ref || p.id), nome: String(p.name || p.ref || p.id), regiao: p.region || null, organizacao: p.organization_id || null, organizacao_nome: p.organization_slug || null, situacao: p.status || null }))
    .filter((p: Projeto) => /^[a-z0-9]{8,40}$/.test(p.ref));
}
export type Organizacao = { id: string; nome: string };
export async function listarOrganizacoes(d: DepsSb, token: string): Promise<Organizacao[]> {
  const r = await api(d, token, '/v1/organizations');
  return r.ok && Array.isArray(r.j) ? r.j.map((o: any) => ({ id: String(o.id || o.slug || ''), nome: String(o.name || o.slug || o.id || '') })).filter((o: Organizacao) => o.id) : [];
}

// uma consulta FIXA no modo só leitura do Supabase
export async function consultar(d: DepsSb, token: string, ref: string, sql: string): Promise<any[]> {
  if (!/^[a-z0-9]{8,40}$/.test(ref)) throw new ErroSupabase('Projeto inválido');
  const r = await api(d, token, '/v1/projects/' + ref + '/database/query/read-only', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: sql }) });
  if (r.status === 401) throw new ErroSupabase('A autorização do Supabase foi tirada ou venceu. Conecte de novo.', 403);
  if (r.status === 403) throw new ErroSupabase('A autorização não dá acesso à leitura da estrutura deste projeto. No app do CicloDev no Supabase, a permissão Database precisa estar marcada (veja Admin, aba Supabase), e quem autorizou precisa ter acesso a este projeto.', 403);
  if (r.status === 404) throw new ErroSupabase('O Supabase não achou este projeto (ou ele está pausado).', 404);
  if (!r.ok) throw new ErroSupabase('O Supabase não leu o banco (' + r.status + ')' + (r.j?.message ? ': ' + String(r.j.message).slice(0, 300) : ''), 502);
  if (!Array.isArray(r.j)) throw new ErroSupabase('O Supabase devolveu uma resposta que o CicloDev não entende', 502);
  return r.j;
}

// os nomes dos esquemas vão dentro da consulta: só letras, números, _ $ e - (o banco do CicloDev já recusa o resto)
export const ESQUEMA_OK = /^[A-Za-z_][A-Za-z0-9_$-]{0,62}$/;
export function literalEsquemas(esq: string[]): string {
  if (!esq.length || esq.some(e => !ESQUEMA_OK.test(e))) throw new ErroSupabase('Nome de esquema inválido');
  return 'array[' + esq.map(e => "'" + e + "'").join(',') + ']::text[]';
}
export const CONSULTA_GARANTIA = `select current_user::text as usuario, current_setting('transaction_read_only') as so_leitura`;
export const consultaEsquemas = (lit: string) => `select x.n as esquema, exists (select 1 from pg_namespace s where s.nspname = x.n) as existe from unnest(${lit}) as x(n)`;
export const consultaRegras = (lit: string) => `select count(*)::int as regras from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace s on s.oid = c.relnamespace
  where s.nspname = any(${lit}) and c.relkind in ('r','p','v','m','f') and not c.relispartition`;

// antes de qualquer leitura: tem que ser só leitura
async function garantirSoLeitura(d: DepsSb, token: string, ref: string) {
  const g = (await consultar(d, token, ref, CONSULTA_GARANTIA))[0] || {};
  if (String(g.so_leitura) !== 'on') throw new ErroSupabase('A leitura deste projeto não está em modo só leitura. Por segurança, o CicloDev não lê assim.', 403);
  return String(g.usuario || '');
}

// a estrutura inteira (o mesmo que o robô lê pelo endereço), com as datas das migrations quando existem
export async function lerEstrutura(d: DepsSb, token: string, ref: string, esquemas: string[]): Promise<{ estrutura: Estrutura; usuario: string; migracoes: number | null }> {
  const lit = literalEsquemas(esquemas);
  const usuario = await garantirSoLeitura(d, token, ref);
  const linhas = await consultar(d, token, ref, CONSULTA_BANCO.split('$1::text[]').join(lit).split('$1').join(lit));
  let e = linhas[0]?.estrutura;
  if (typeof e === 'string') { try { e = JSON.parse(e); } catch { e = null; } }
  if (!e || !Array.isArray(e.tabelas) || !Array.isArray(e.papeis)) throw new ErroSupabase('O Supabase não devolveu a estrutura do banco', 502);
  let migracoes: number | null = null;
  try {
    const m = await consultar(d, token, ref, CONSULTA_MIGRACOES);
    migracoes = m.length;
    const ds = datasDasMigracoes(m as any[], esquemas); if (Object.keys(ds).length) e.datas = ds;
  } catch { /* banco sem o histórico de migrations do Supabase: segue sem datas */ }
  return { estrutura: e as Estrutura, usuario, migracoes };
}

// a conferência antes de ligar: só passa se der para ler TUDO o que o CicloDev usa
export type Conferencia = { ok: boolean; falhas: string[]; avisos: string[]; so_leitura: boolean; usuario?: string; esquemas: string[];
  tabelas: number; colunas: number; chaves: number; ligacoes: number; regras: number; permissoes: number; papeis: number; com_rls: number; migracoes: number | null };
export async function conferir(d: DepsSb, token: string, ref: string, esquemas: string[]): Promise<Conferencia> {
  const c: Conferencia = { ok: false, falhas: [], avisos: [], so_leitura: false, esquemas, tabelas: 0, colunas: 0, chaves: 0, ligacoes: 0, regras: 0, permissoes: 0, papeis: 0, com_rls: 0, migracoes: null };
  const lit = literalEsquemas(esquemas);
  // 1. só leitura
  try { c.usuario = await garantirSoLeitura(d, token, ref); c.so_leitura = true; }
  catch (e) { c.falhas.push((e as Error).message); return c; }
  // 2. os esquemas existem
  const ex = await consultar(d, token, ref, consultaEsquemas(lit));
  const faltam = ex.filter((x: any) => x.existe !== true && x.existe !== 't').map((x: any) => x.esquema);
  if (faltam.length) c.falhas.push((faltam.length === 1 ? 'O esquema ' : 'Os esquemas ') + faltam.join(', ') + (faltam.length === 1 ? ' não existe' : ' não existem') + ' neste projeto.');
  // 3. a estrutura inteira
  let r: Awaited<ReturnType<typeof lerEstrutura>>;
  try { r = await lerEstrutura(d, token, ref, esquemas); }
  catch (e) { c.falhas.push((e as Error).message); return c; }
  const ts = r.estrutura.tabelas;
  c.tabelas = ts.length;
  c.colunas = ts.reduce((s, t) => s + (Array.isArray(t.colunas) ? t.colunas.length : 0), 0);
  c.chaves = ts.reduce((s, t) => s + (t.restricoes || []).filter(k => k.tipo === 'p').length, 0);
  c.ligacoes = ts.reduce((s, t) => s + (t.restricoes || []).filter(k => k.tipo === 'f').length, 0);
  c.regras = ts.reduce((s, t) => s + (Array.isArray(t.regras) ? t.regras.length : 0), 0);
  c.permissoes = ts.reduce((s, t) => s + (Array.isArray(t.permissoes) ? t.permissoes.length : 0), 0);
  c.com_rls = ts.filter(t => t.rls).length;
  c.papeis = r.estrutura.papeis.length;
  c.migracoes = r.migracoes;
  if (!c.tabelas) c.falhas.push('Não achei nenhuma tabela ' + (esquemas.length === 1 ? 'no esquema ' : 'nos esquemas ') + esquemas.join(', ') + '.');
  else {
    if (ts.some(t => !Array.isArray(t.colunas) || !Array.isArray(t.restricoes) || !Array.isArray(t.permissoes) || !Array.isArray(t.regras)))
      c.falhas.push('Faltou uma parte da estrutura de alguma tabela (colunas, chaves, permissões ou regras de acesso).');
    if (!c.colunas) c.falhas.push('Não deu para ler as colunas das tabelas.');
  }
  // 4. as regras de acesso (RLS) vieram todas: confere com a contagem direta no catálogo
  try {
    const n = Number((await consultar(d, token, ref, consultaRegras(lit)))[0]?.regras ?? -1);
    if (n !== c.regras) c.falhas.push('Não deu para ler todas as regras de acesso (RLS): o banco tem ' + n + ' e vieram ' + c.regras + '.');
  } catch (e) { c.falhas.push('Não deu para conferir as regras de acesso (RLS): ' + (e as Error).message); }
  if (c.migracoes === null) c.avisos.push('Sem o histórico de migrations do Supabase: as tabelas ficam sem data de criação.');
  c.usuario = r.usuario || c.usuario;
  c.ok = c.falhas.length === 0;
  return c;
}

// devolve a autorização ao Supabase (ao desconectar); se falhar, a pessoa ainda pode tirar o app lá no Supabase
export async function revogar(d: DepsSb, app: any, renovacao: string | null) {
  if (!renovacao) return false;
  const r = await d.buscar(SB_API + '/v1/oauth/revoke', { method: 'POST', headers: { 'content-type': 'application/json', authorization: basico(app) },
    body: JSON.stringify({ client_id: app.client_id, client_secret: app.client_secret, refresh_token: renovacao }) }).catch(() => null);
  return !!(r && r.ok);
}
