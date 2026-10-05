// Função mapa-trabalho (verify_jwt: false): a única porta do trabalhador do Mapa do Sistema (worker/mapa) para o CicloDev.
// O trabalhador roda fora do Supabase (num servidor com Docker) e NUNCA recebe chave nenhuma: nem do banco do CicloDev,
// nem do GitHub/GitLab, nem do banco do cliente. Ele só tem o segredo dele (Vault, ciclodev_mapa_segredo), que vai no
// cabeçalho x-mapa-segredo, e pede por aqui, sempre com POST e JSON {acao}:
//   proximo   o próximo pedido: o repositório (nome, branch, commit) e, para cada banco ligado, só a ESTRUTURA
//             (tabelas, colunas, regras), as regras de valor (check) e as palavras usadas nas funções e visões. Nunca o endereço do banco.
//   pacote    o código do pedido (o .tar.gz do commit), passado adiante sem guardar; a chave do GitHub fica aqui dentro.
//   resultado grava o mapa montado (mapa_gravar).
//   falhou    marca o pedido com erro (mapa_falhou).
import { acessoDaConexao, cabecalhos, urlPacote } from '../_shared/git.ts';
import type { Estrutura } from '../_shared/estrutura.ts';
import { tokenSupabase, consultar, literalEsquemas, lerEstrutura as lerEstruturaSupabase } from '../_shared/supabase.ts';
import { CONSULTA_EXTRA } from '../_shared/mapa_consultas.ts';
import type { Extra } from '../_shared/mapa_consultas.ts';

export type Rpc = (nome: string, args: Record<string, unknown>) => Promise<{ data: any; error: { message?: string } | null }>;
export interface DepsMapa {
  rpc: Rpc;
  buscar: typeof fetch;
  lerBanco: (conexao: string, esquemas: string[], motor: 'postgres' | 'mysql') => Promise<Estrutura>;
  lerExtra: (conexao: string, motor: 'postgres' | 'mysql') => Promise<Extra>;
  env?: (nome: string) => string | undefined;
}

const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
async function chamar(d: DepsMapa, nome: string, args: Record<string, unknown>) {
  const r = await d.rpc(nome, args);
  if (r.error) throw new Error(nome + ': ' + (r.error.message || 'erro'));
  return r.data;
}
type Banco = { id: string; nome: string; provedor: string; motor: 'postgres' | 'mysql'; esquemas: string[]; conexao: string | null; supa_conexao_id?: string | null; supa_projeto?: string | null };
// a mensagem de erro nunca leva o endereço do banco (com a senha)
export const limparErro = (e: unknown, conexao?: string) => {
  let m = String((e as Error)?.message || e || 'erro sem detalhe');
  if (conexao) m = m.split(conexao).join('[endereço do banco]');
  return m.replace(/(postgres(ql)?|mysql):\/\/[^\s'"]+/gi, '[endereço do banco]').slice(0, 500);
};
// a estrutura: pelo modo só leitura do Supabase (sem senha, só consultas fixas no catálogo) ou pelo endereço guardado
async function lerEstruturaDe(d: DepsMapa, b: Banco): Promise<Estrutura> {
  if (b.supa_conexao_id && b.supa_projeto) {
    const token = await tokenSupabase(d as any, b.supa_conexao_id);
    return (await lerEstruturaSupabase(d as any, token, b.supa_projeto, b.esquemas)).estrutura;
  }
  if (!b.conexao) throw new Error('Este banco não tem endereço nem autorização do Supabase. Use Trocar em Ligações para ligar de novo.');
  return d.lerBanco(b.conexao, b.esquemas, b.motor || 'postgres');
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function extraDe(d: DepsMapa, b: Banco): Promise<Extra> {
  if (b.supa_conexao_id && b.supa_projeto) {
    const token = await tokenSupabase(d as any, b.supa_conexao_id);
    const l = await consultar(d as any, token, b.supa_projeto, CONSULTA_EXTRA);
    let x = l[0]?.extra; if (typeof x === 'string') { try { x = JSON.parse(x); } catch { x = null; } }
    return { palavras: Array.isArray(x?.palavras) ? x.palavras.map(String) : [], checagens: Array.isArray(x?.checagens) ? x.checagens : [], funcoes: Array.isArray(x?.funcoes) ? x.funcoes : [] };
  }
  return b.conexao ? d.lerExtra(b.conexao, b.motor || 'postgres') : { palavras: [], checagens: [] };
}

// o pedido como o trabalhador recebe: sem conexao_id, sem endereço de banco, sem nada que dê acesso
export async function proximo(d: DepsMapa) {
  const p = await chamar(d, 'mapa_proximo', {});
  if (!p) return null;
  const bancos: Record<string, unknown>[] = [];
  for (const b of (p.bancos || []) as Banco[]) {
    const item: Record<string, unknown> = { nome: b.nome, motor: b.motor, provedor: b.provedor, esquemas: b.esquemas };
    try {
      literalEsquemas(b.esquemas || ['public']);
      item.estrutura = await lerEstruturaDe(d as any, b);
      try { const x = await extraDe(d, b); item.palavras = x.palavras; item.checagens = x.checagens; item.funcoes = x.funcoes || []; } catch { item.palavras = null; item.checagens = null; item.funcoes = null; }
    } catch (e) { item.erro = limparErro(e, b.conexao || undefined); }
    bancos.push(item);
  }
  const r = p.repositorio || {};
  return { id: p.id, no_id: p.no_id, no_nome: p.no_nome, referencia: p.referencia,
    repositorio: { nome: r.nome, branch: r.branch, provedor: r.provedor }, bancos, usadas_por_outras: p.usadas_por_outras || [] };
}

// o código do pedido: baixa do GitHub/GitLab com a chave da conta conectada e passa o .tar.gz adiante
export async function pacote(d: DepsMapa, analise: string): Promise<Response> {
  const repo = await chamar(d, 'mapa_repo_da_analise', { p_analise: analise });
  if (!repo) return resposta({ ok: false, erro: 'Esta análise não está rodando' }, 409);
  const a = await acessoDaConexao(d as any, repo.conexao_id);
  const ref = repo.referencia || repo.branch || 'main';
  const r = await d.buscar(urlPacote(a, repo, ref), { headers: cabecalhos(a), redirect: 'follow' });
  if (!r.ok || !r.body) {
    const onde = repo.provedor === 'gitlab' ? 'O GitLab' : 'O GitHub';
    return resposta({ ok: false, erro: onde + ' respondeu ' + r.status + ' ao baixar ' + repo.nome + (r.status === 404 ? ' (o repositório ou o commit não existe, ou a conta não dá mais acesso a ele)' : '') }, 502);
  }
  return new Response(r.body, { status: 200, headers: { 'content-type': 'application/gzip', 'cache-control': 'no-store', 'x-mapa-referencia': ref.slice(0, 200) } });
}

export async function tratar(req: Request, d: DepsMapa): Promise<Response> {
  if (req.method !== 'POST') return resposta({ ok: false, erro: 'Use POST' }, 405);
  const segredo = req.headers.get('x-mapa-segredo') || '';
  if (segredo.length < 32) return resposta({ ok: false, erro: 'não autorizado' }, 401);
  const c = await d.rpc('mapa_confere', { p_segredo: segredo });
  if (c.error || c.data !== true) return resposta({ ok: false, erro: 'não autorizado' }, 401);
  let corpo: any;
  try { corpo = await req.json(); } catch { return resposta({ ok: false, erro: 'Corpo inválido' }, 400); }
  const acao = String(corpo?.acao || '');
  const analise = String(corpo?.analise || '');
  if (acao !== 'proximo' && !UUID.test(analise)) return resposta({ ok: false, erro: 'Análise inválida' }, 400);
  try {
    if (acao === 'proximo') return resposta({ ok: true, pedido: await proximo(d) });
    if (acao === 'pacote') return await pacote(d, analise);
    if (acao === 'resultado') {
      if (!corpo.resultado || typeof corpo.resultado !== 'object') return resposta({ ok: false, erro: 'Resultado inválido' }, 400);
      return resposta({ ok: true, gravado: await chamar(d, 'mapa_gravar', { p_analise: analise, p_resultado: corpo.resultado }) });
    }
    if (acao === 'falhou') { await chamar(d, 'mapa_falhou', { p_analise: analise, p_erro: String(corpo.erro || '').slice(0, 2000) }); return resposta({ ok: true }); }
    return resposta({ ok: false, erro: 'Ação desconhecida' }, 400);
  } catch (e) { return resposta({ ok: false, erro: limparErro(e) }, 500); }
}
