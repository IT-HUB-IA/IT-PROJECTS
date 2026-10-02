// Função supabase-conectar (verify_jwt: true, quem chama é a pessoa logada): ligar um banco do Supabase sem senha (parte 54).
//   concluir:    a pessoa voltou da janelinha do Supabase; confere que é ela (estado + PKCE) e guarda a autorização no espaço dela.
//   projetos:    os projetos que essa autorização alcança, para escolher.
//   conferir:    lê DE VERDADE a estrutura do projeto escolhido (só leitura) e só devolve uma prova quando deu para ler tudo
//                o que o CicloDev usa: esquemas, tabelas, colunas, chaves, ligações, regras de acesso (RLS), permissões e papéis.
//                Sem a prova, o banco do CicloDev não aceita ligar (infra_banco_supabase_ligar).
//   desconectar: tira a autorização do espaço e devolve ao Supabase.
//   testar_endereco: o jeito antigo (endereço com usuário e senha, Supabase, AWS ou outro): lê a estrutura de verdade, em só leitura,
//                antes de salvar, e diz o que achou ou por que não deu. Não guarda nada.
// O que é da pessoa passa pelo cliente com o login dela (RLS); só os segredos passam pelo cliente de serviço.
// Nunca lê o conteúdo das tabelas: só as consultas fixas de _shared/supabase.ts, no catálogo.
import { trocarCodigo, tokenSupabase, listarProjetos, listarOrganizacoes, conferir, revogar, ErroSupabase, ESQUEMA_OK } from '../_shared/supabase.ts';
import type { Rpc } from '../_shared/supabase.ts';
import type { Estrutura } from '../diagramas-auto/gerar.ts';

export interface DepsSc {
  buscar: typeof fetch;
  rpc: Rpc;                       // serviço (service_role): segredos
  rpcUsuario: Rpc;                // a pessoa logada
  ler: (tabela: string, id: string) => Promise<any | null>;   // como a pessoa (RLS)
  lerBanco?: (conexao: string, esquemas: string[], motor: 'postgres' | 'mysql') => Promise<Estrutura>;   // só leitura (_shared/ler_banco.ts)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REF = /^[a-z0-9]{8,40}$/;
const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

async function chamar(rpc: Rpc, nome: string, args: Record<string, unknown>) {
  const r = await rpc(nome, args);
  if (r.error) throw new ErroSupabase(r.error.message || 'erro no banco', 403);
  return r.data;
}
const sb = (d: DepsSc) => ({ rpc: d.rpc, buscar: d.buscar });

async function conexaoMinha(d: DepsSc, id: string) {
  if (!UUID.test(id || '')) throw new ErroSupabase('Conta inválida');
  const c = await d.ler('supa_conexoes', id);
  if (!c) throw new ErroSupabase('Esta conta do Supabase não está conectada ao seu espaço', 403);
  return c;
}

async function concluir(d: DepsSc, c: any) {
  if (!c.code || !c.estado) throw new ErroSupabase('Faltam dados da volta do Supabase');
  const est = await chamar(d.rpcUsuario, 'supa_estado_usar', { p_estado: String(c.estado) });
  const app = await chamar(d.rpc, 'supa_app_ler', {});
  if (!app) throw new ErroSupabase('O Supabase ainda não foi configurado no CicloDev', 503);
  const t = await trocarCodigo(sb(d), app, String(c.code), est.verificador);
  // a autorização precisa ao menos listar os projetos; se não lista, nem guarda
  const projetos = await listarProjetos(sb(d), t.acesso);
  const orgs = await listarOrganizacoes(sb(d), t.acesso).catch(() => [] as string[]);
  const id = await chamar(d.rpc, 'supa_conexao_gravar', { p_espaco: est.espaco_id, p_pessoa: est.pessoa_id, p_conta: orgs.join(', ') || 'Supabase',
    p_acesso: t.acesso, p_renovacao: t.renovacao, p_expira: t.expira_em });
  return { ok: true, conexao_id: id, conta: orgs.join(', ') || 'Supabase', projetos };
}

async function projetos(d: DepsSc, c: any) {
  const con = await conexaoMinha(d, c.conexao_id);
  const token = await tokenSupabase(sb(d), con.id);
  return { ok: true, projetos: await listarProjetos(sb(d), token) };
}

async function conferirAcao(d: DepsSc, c: any) {
  const con = await conexaoMinha(d, c.conexao_id);
  const ref = String(c.projeto || '');
  if (!REF.test(ref)) throw new ErroSupabase('Escolha o projeto do Supabase');
  const esquemas = [...new Set((Array.isArray(c.esquemas) ? c.esquemas : ['public']).map((x: unknown) => String(x).trim()).filter(Boolean))] as string[];
  if (!esquemas.length) throw new ErroSupabase('Diga quais esquemas ler');
  if (esquemas.length > 20 || esquemas.some(e => !ESQUEMA_OK.test(e))) throw new ErroSupabase('Nome de esquema inválido');
  const token = await tokenSupabase(sb(d), con.id);
  // o projeto tem que ser um dos que a autorização alcança
  const lista = await listarProjetos(sb(d), token);
  const p = lista.find(x => x.ref === ref);
  if (!p) throw new ErroSupabase('Este projeto não aparece na autorização do Supabase. Confira se quem autorizou tem acesso a ele.', 403);
  let conf;
  try { conf = await conferir(sb(d), token, ref, esquemas); }
  catch (e) { return { ok: false, falhas: [(e as Error).message], conferencia: null }; }
  if (!conf.ok) return { ok: false, falhas: conf.falhas, conferencia: conf };
  const prova = await chamar(d.rpc, 'supa_prova_gravar', { p_conexao: con.id, p_pessoa: await quemSou(d), p_projeto: ref, p_nome: p.nome, p_esquemas: esquemas, p_resultado: conf });
  return { ok: true, prova, projeto: p, conferencia: conf };
}
// a prova é de quem está logado agora (não de quem conectou a conta)
async function quemSou(d: DepsSc): Promise<string> {
  const r = await d.rpcUsuario('supa_eu', {});
  if (r.error || !r.data) throw new ErroSupabase('Entre no CicloDev primeiro', 401);
  return String(r.data);
}

async function desconectar(d: DepsSc, c: any) {
  const con = await conexaoMinha(d, c.conexao_id);
  const cheio = await chamar(d.rpc, 'supa_conexao_ler', { p_id: con.id });
  await chamar(d.rpcUsuario, 'supa_conexao_remover', { p_id: con.id });
  const app = await chamar(d.rpc, 'supa_app_ler', {}).catch(() => null);
  const devolveu = app ? await revogar(sb(d), app, cheio?.tokens?.renovacao || null) : false;
  return { ok: true, devolvida: devolveu };
}

// o erro nunca leva o endereço (com a senha)
const semEndereco = (m: string, con: string) => m.split(con).join('[endereço do banco]').replace(/(postgres(ql)?|mysql):\/\/[^\s'"]+/gi, '[endereço do banco]').slice(0, 500);
async function testarEndereco(d: DepsSc, c: any) {
  if (!UUID.test(c.no_id || '')) throw new ErroSupabase('Diga onde o banco vai ser ligado');
  const pode = await chamar(d.rpcUsuario, 'supa_pode_editar', { p_no: c.no_id });
  if (pode !== true) throw new ErroSupabase('Você não pode mudar este ponto', 403);
  const con = String(c.conexao || '').trim(), motor = c.motor === 'mysql' ? 'mysql' : 'postgres';
  if (!(motor === 'mysql' ? /^mysql:\/\//.test(con) : /^postgres(ql)?:\/\//.test(con)) || con.length > 1000) throw new ErroSupabase('Endereço inválido');
  const esquemas = [...new Set((Array.isArray(c.esquemas) ? c.esquemas : []).map((x: unknown) => String(x).trim()).filter(Boolean))] as string[];
  if (!esquemas.length || esquemas.length > 20 || esquemas.some(e => !ESQUEMA_OK.test(e))) throw new ErroSupabase('Nome de esquema inválido');
  if (!d.lerBanco) throw new ErroSupabase('Teste indisponível', 503);
  let e: Estrutura;
  try { e = await d.lerBanco(con, esquemas, motor); }
  catch (x) { return { ok: false, falhas: [semEndereco(String((x as Error).message || x), con)] }; }
  const ts = e.tabelas || [];
  const r = { tabelas: ts.length, colunas: ts.reduce((s, t) => s + (t.colunas || []).length, 0), chaves: ts.reduce((s, t) => s + (t.restricoes || []).filter(k => k.tipo === 'p').length, 0),
    ligacoes: ts.reduce((s, t) => s + (t.restricoes || []).filter(k => k.tipo === 'f').length, 0), regras: ts.reduce((s, t) => s + (t.regras || []).length, 0),
    permissoes: ts.reduce((s, t) => s + (t.permissoes || []).length, 0), papeis: (e.papeis || []).length };
  if (!r.tabelas) return { ok: false, falhas: ['Conectou, mas não achei nenhuma tabela ' + (esquemas.length === 1 ? 'no esquema ' : 'nos esquemas ') + esquemas.join(', ') + '. Confira o nome do esquema e se o usuário tem permissão de ler a estrutura.'], resultado: r };
  return { ok: true, resultado: r };
}

const ACOES: Record<string, (d: DepsSc, c: any) => Promise<unknown>> = { concluir, projetos, conferir: conferirAcao, desconectar, testar_endereco: testarEndereco };

export async function tratar(req: Request, d: DepsSc): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return resposta({ ok: false, erro: 'Use POST' }, 405);
  let corpo: any = {};
  try { corpo = await req.json(); } catch { return resposta({ ok: false, erro: 'O corpo precisa ser JSON' }, 400); }
  const acao = ACOES[corpo.acao];
  if (!acao) return resposta({ ok: false, erro: 'Ação desconhecida' }, 400);
  try { return resposta(await acao(d, corpo)); }
  catch (e) { return resposta({ ok: false, erro: String((e as Error).message || e).slice(0, 500) }, (e as ErroSupabase).status || 502); }
}
