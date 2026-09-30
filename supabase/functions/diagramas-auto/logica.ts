// Função diagramas-auto (verify_jwt: false): quem chama é o próprio banco (pg_net), a cada publicação em produção, a cada
// "Atualizar agora" e de hora em hora (pg_cron), com o segredo do Vault no cabeçalho x-diagramas-segredo.
// Ela não recebe nada no corpo: lê a fila (infra_automacoes) e os bancos ligados (infra_bancos) pelas funções do banco
// que só o papel service_role chama, e monta os desenhos sem IA (gerar.ts).
//   Do código: baixa o pacote do commit publicado (ou do branch principal, no "Atualizar agora") pela API do GitHub.
//   Do banco: conecta só para ler (sessão read only e tempo máximo por consulta) e lê o catálogo.
// Segredos (variáveis da função, nunca no código): GITHUB_TOKEN (ler o código), RENDER_URL e RENDER_TOKEN (o conversor).
// O endereço de cada banco fica em interno.infra_bancos_conexao e só chega aqui pela função infra_auto_proximos.
import { renderizar, KROKI } from '../diagramas/logica.ts';
import { lerTarGz, gerarDoCodigo, gerarDoBanco, resumoEstrutura } from './gerar.ts';
import type { Desenho, Estrutura, LerYaml, Pacote } from './gerar.ts';
import { montarQuadro, manterPosicoes } from '../_shared/quadro.ts';

export type Rpc = (nome: string, args: Record<string, unknown>) => Promise<{ data: any; error: { message?: string } | null }>;
export interface DepsAuto {
  env: (nome: string) => string | undefined;
  rpc: Rpc;                                   // cliente de serviço (service_role)
  buscar: typeof fetch;
  yaml: LerYaml;
  lerBanco: (conexao: string, esquemas: string[]) => Promise<Estrutura>;
  emSegundoPlano: (p: Promise<unknown>) => void;
  agora?: () => number;
  orcamentoMs?: number;                       // depois disso não começa pedido novo (o resto fica para a próxima chamada)
}
type Repo = { id: string; nome: string; branch: string; provedor: string };
type Pedido = { id: string; no_id: string; origem: 'github' | 'banco' | 'manual'; referencia: string | null; repositorios: Repo[]; banco: { esquemas: string[]; conexao: string } | null };

const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
// a mensagem de erro nunca leva o endereço do banco (com a senha)
export const limparErro = (e: unknown, conexao?: string) => {
  let m = String((e as Error)?.message || e || 'erro sem detalhe');
  if (conexao) m = m.split(conexao).join('[endereço do banco]');
  return m.replace(/postgres(ql)?:\/\/[^\s'"]+/gi, '[endereço do banco]').slice(0, 500);
};
async function chamar(d: DepsAuto, nome: string, args: Record<string, unknown>) {
  const r = await d.rpc(nome, args);
  if (r.error) throw new Error(nome + ': ' + (r.error.message || 'erro'));
  return r.data;
}

export async function baixarRepo(d: DepsAuto, nome: string, ref: string): Promise<Pacote> {
  const tk = d.env('GITHUB_TOKEN');
  if (!tk) throw new Error('Falta a chave GITHUB_TOKEN da função diagramas-auto para baixar o código');
  const r = await d.buscar('https://api.github.com/repos/' + nome.split('/').map(encodeURIComponent).join('/') + '/tarball/' + encodeURIComponent(ref), {
    headers: { authorization: 'Bearer ' + tk, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'CicloDev-diagramas' }, redirect: 'follow' });
  if (!r.ok || !r.body) throw new Error('O GitHub respondeu ' + r.status + ' ao baixar ' + nome + (r.status === 404 ? ' (o repositório ou o commit não existe, ou a chave não tem acesso)' : ''));
  return await lerTarGz(r.body);
}

// grava cada desenho (a próxima rodada atualiza o mesmo, pela chave), monta o quadro dele no canvas e gera a imagem quando o texto mudou
export async function gravarTodos(d: DepsAuto, no: string, desenhos: Desenho[], prefixo: string, origem: 'github' | 'banco', referencia: string): Promise<string[]> {
  const ids: string[] = [];
  for (const des of desenhos) {
    const chave = prefixo + des.tipo;
    const r = await chamar(d, 'infra_auto_gravar', { p_no: no, p_aba: des.aba, p_chave: chave, p_nome: des.nome, p_formato: des.formato, p_fonte: des.fonte,
      p_origem: origem, p_referencia: referencia, p_evidencias: des.evidencias, p_lacunas: des.lacunas });
    ids.push(r.id);
    // o quadro: o jeito como o desenho aparece no CicloDev (cards, grupos e ligações do canvas)
    const antigo = await chamar(d, 'infra_auto_quadro_ler', { p_no: no, p_aba: des.aba, p_chave: chave }).catch(() => null);
    const aviso = origem === 'github' ? 'Montado sozinho do código publicado em produção' + (referencia ? ' (commit ' + referencia.slice(0, 7) + ')' : '') + '. A próxima publicação refaz este quadro.'
      : 'Montado sozinho da estrutura do banco. Quando a estrutura mudar, este quadro é refeito.';
    const doc = manterPosicoes(montarQuadro(des.modelo, { nome: des.nome, aviso }), antigo);
    await chamar(d, 'infra_auto_quadro', { p_no: no, p_aba: des.aba, p_chave: chave, p_nome: des.nome, p_doc: doc, p_diagrama: r.id });
    if (r.renderizar && KROKI[des.formato]) {
      try { await chamar(d, 'infra_auto_imagem', { p_id: r.id, p_svg: await renderizar(des.fonte, des.formato, d), p_erro: null }); }
      catch (e) { await chamar(d, 'infra_auto_imagem', { p_id: r.id, p_svg: null, p_erro: limparErro(e) }); }
    }
  }
  return ids;
}

const commitDe = (pac: Pacote, pedido: string | null) => pedido || (pac.raiz.match(/-([0-9a-f]{7,40})$/) || [])[1] || '';

export async function processar(d: DepsAuto, p: Pedido): Promise<void> {
  const resumo: Record<string, unknown>[] = [], ids: string[] = [], prefixos: string[] = [];
  let feitos = 0, erros = 0;
  try {
    for (const repo of p.repositorios || []) {
      if (repo.provedor !== 'github') { resumo.push({ repositorio: repo.nome, aviso: 'Repositório do GitLab: o robô ainda não lê. Os desenhos dele não saem sozinhos.' }); continue; }
      try {
        const ref = p.origem === 'github' && p.referencia ? p.referencia : repo.branch || 'main';
        const pac = await baixarRepo(d, repo.nome, ref);
        const { desenhos, avisos } = gerarDoCodigo(pac, repo.nome, d.yaml);
        const commit = commitDe(pac, p.origem === 'github' ? p.referencia : null);
        ids.push(...await gravarTodos(d, p.no_id, desenhos, 'github:' + repo.nome + ':', 'github', commit));
        prefixos.push('github:' + repo.nome + ':');
        resumo.push({ repositorio: repo.nome, commit, arquivos: pac.caminhos.length, desenhos: desenhos.map(x => x.nome), avisos, cortado: pac.cortado || undefined });
        feitos++;
      } catch (e) { erros++; resumo.push({ repositorio: repo.nome, erro: limparErro(e) }); }
    }
    if (p.banco) {
      try {
        const e = await d.lerBanco(p.banco.conexao, p.banco.esquemas);
        const hash = await resumoEstrutura(e);
        await chamar(d, 'infra_auto_banco_lido', { p_no: p.no_id, p_hash: hash, p_erro: null, p_abrir: false });
        const ds = gerarDoBanco(e, p.banco.esquemas);
        ids.push(...await gravarTodos(d, p.no_id, ds, 'banco:', 'banco', hash.slice(0, 16)));
        prefixos.push('banco:');
        resumo.push({ banco: p.banco.esquemas.join(', '), tabelas: e.tabelas.length, desenhos: ds.map(x => x.nome) });
        feitos++;
      } catch (e) {
        erros++; const m = limparErro(e, p.banco.conexao);
        await chamar(d, 'infra_auto_banco_lido', { p_no: p.no_id, p_hash: null, p_erro: m, p_abrir: false }).catch(() => null);
        resumo.push({ banco: p.banco.esquemas.join(', '), erro: m });
      }
    }
    if (!(p.repositorios || []).length && !p.banco) resumo.push({ aviso: 'Nenhum repositório nem banco ligado a este projeto ou produto.' });
    const msgErro = erros ? resumo.filter(x => x.erro).map(x => (x.repositorio || 'banco') + ': ' + x.erro).join(' · ') : null;
    await chamar(d, 'infra_auto_concluir', { p_id: p.id, p_status: erros && !feitos ? 'erro' : 'pronto', p_erro: msgErro, p_diagramas: ids, p_resumo: resumo, p_prefixos: prefixos });
  } catch (e) {
    await chamar(d, 'infra_auto_concluir', { p_id: p.id, p_status: 'erro', p_erro: limparErro(e, p.banco?.conexao), p_diagramas: ids, p_resumo: resumo, p_prefixos: [] }).catch(() => null);
  }
}

// o banco de hora em hora: só redesenha quando a estrutura mudou
export async function lerBancoDevido(d: DepsAuto, b: { no_id: string; esquemas: string[]; conexao: string }): Promise<void> {
  let e: Estrutura;
  try { e = await d.lerBanco(b.conexao, b.esquemas); }
  catch (x) { await chamar(d, 'infra_auto_banco_lido', { p_no: b.no_id, p_hash: null, p_erro: limparErro(x, b.conexao), p_abrir: true }).catch(() => null); return; }
  const hash = await resumoEstrutura(e);
  const id = await chamar(d, 'infra_auto_banco_lido', { p_no: b.no_id, p_hash: hash, p_erro: null, p_abrir: true });
  if (!id) return;
  try {
    const ds = gerarDoBanco(e, b.esquemas);
    const ids = await gravarTodos(d, b.no_id, ds, 'banco:', 'banco', hash.slice(0, 16));
    await chamar(d, 'infra_auto_concluir', { p_id: id, p_status: 'pronto', p_erro: null, p_diagramas: ids, p_resumo: [{ banco: b.esquemas.join(', '), tabelas: e.tabelas.length, desenhos: ds.map(x => x.nome) }], p_prefixos: ['banco:'] });
  } catch (x) { await chamar(d, 'infra_auto_concluir', { p_id: id, p_status: 'erro', p_erro: limparErro(x, b.conexao), p_diagramas: [], p_resumo: [], p_prefixos: [] }).catch(() => null); }
}

export async function rodar(d: DepsAuto): Promise<{ pedidos: number; bancos: number }> {
  const agora = d.agora || Date.now, t0 = agora(), orc = d.orcamentoMs ?? 110_000;
  let pedidos = 0, bancos = 0;
  while (agora() - t0 < orc) {
    const lista = (await chamar(d, 'infra_auto_proximos', { p_limite: 1 })) as Pedido[];
    if (!lista || !lista.length) break;
    for (const p of lista) { await processar(d, p); pedidos++; }
  }
  if (agora() - t0 < orc) {
    const devidos = (await chamar(d, 'infra_auto_bancos_devidos', { p_limite: 3 })) as { no_id: string; esquemas: string[]; conexao: string }[];
    for (const b of devidos || []) { if (agora() - t0 >= orc) break; await lerBancoDevido(d, b); bancos++; }
  }
  return { pedidos, bancos };
}

export async function tratar(req: Request, d: DepsAuto): Promise<Response> {
  if (req.method !== 'POST') return resposta({ ok: false, erro: 'Use POST' }, 405);
  const segredo = req.headers.get('x-diagramas-segredo') || '';
  if (segredo.length < 32) return resposta({ ok: false, erro: 'não autorizado' }, 401);
  const r = await d.rpc('infra_auto_confere', { p_segredo: segredo });
  if (r.error || r.data !== true) return resposta({ ok: false, erro: 'não autorizado' }, 401);
  // responde na hora e trabalha em segundo plano (o banco não fica esperando)
  d.emSegundoPlano(rodar(d).catch(() => null));
  return resposta({ ok: true }, 202);
}
