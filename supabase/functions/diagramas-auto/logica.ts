// Função diagramas-auto (verify_jwt: false): quem chama é o próprio banco (pg_net), a cada publicação em produção, a cada
// "Atualizar agora" e de hora em hora (pg_cron), com o segredo do Vault no cabeçalho x-diagramas-segredo.
// Ela não recebe nada no corpo: lê a fila (infra_automacoes) e os bancos ligados (infra_bancos) pelas funções do banco
// que só o papel service_role chama, e monta os desenhos sem IA (gerar.ts).
//   Do código: baixa o pacote do commit publicado (ou do branch principal, no "Atualizar agora") pelo GitHub ou pelo GitLab,
//   com a chave da conta conectada do espaço (parte 32): a chave temporária do app no GitHub, a chave OAuth no GitLab.
//   Do banco: conecta só para ler (sessão read only e tempo máximo por consulta) e lê o catálogo.
// Segredos (variáveis da função, nunca no código): RENDER_URL e RENDER_TOKEN (o conversor). O acesso ao código vem da conta conectada.
// O endereço de cada banco fica em interno.infra_bancos_conexao e só chega aqui pela função infra_auto_proximos.
import { renderizar, KROKI } from '../diagramas/logica.ts';
import { lerTarGz, gerarDoCodigo, gerarDoBanco, resumoEstrutura, fichaDoCodigo, fichaDoBanco } from './gerar.ts';
import type { Desenho, Estrutura, LerYaml, Pacote } from './gerar.ts';
import { montarQuadro, manterPosicoes } from '../_shared/quadro.ts';
import { analisarCodigo, analisarBanco, analisarQualidade, dependenciasDe, analisarDependencias } from './seguranca.ts';
import type { Achado } from './seguranca.ts';
import { inventarioDoCodigo, inventarioDoBanco, palavrasDoCodigo, arquivoDe } from './inventario.ts';
import type { ItemInv } from './inventario.ts';
import { acessoDaConexao, cabecalhos, urlPacote, historicoDosArquivos, listarPublicacoes } from '../_shared/git.ts';

export type Rpc = (nome: string, args: Record<string, unknown>) => Promise<{ data: any; error: { message?: string } | null }>;
export interface DepsAuto {
  env: (nome: string) => string | undefined;
  rpc: Rpc;                                   // cliente de serviço (service_role)
  buscar: typeof fetch;
  yaml: LerYaml;
  lerBanco: (conexao: string, esquemas: string[], motor: 'postgres' | 'mysql') => Promise<Estrutura>;
  emSegundoPlano: (p: Promise<unknown>) => void;
  agora?: () => number;
  orcamentoMs?: number;                       // depois disso não começa pedido novo (o resto fica para a próxima chamada)
}
type Repo = { id: string; nome: string; branch: string; provedor: 'github' | 'gitlab'; conexao_id: string; externo_id: string | null };
export type Banco = { id: string; no_id?: string; nome: string; provedor: string; motor: 'postgres' | 'mysql'; esquemas: string[]; conexao: string };
type Pedido = { id: string; no_id: string; origem: 'github' | 'gitlab' | 'banco' | 'manual'; referencia: string | null; repositorios: Repo[]; bancos: Banco[] };

const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
// a mensagem de erro nunca leva o endereço do banco (com a senha)
export const limparErro = (e: unknown, conexao?: string) => {
  let m = String((e as Error)?.message || e || 'erro sem detalhe');
  if (conexao) m = m.split(conexao).join('[endereço do banco]');
  return m.replace(/(postgres(ql)?|mysql):\/\/[^\s'"]+/gi, '[endereço do banco]').slice(0, 500);
};
async function chamar(d: DepsAuto, nome: string, args: Record<string, unknown>) {
  const r = await d.rpc(nome, args);
  if (r.error) throw new Error(nome + ': ' + (r.error.message || 'erro'));
  return r.data;
}

export async function baixarRepo(d: DepsAuto, repo: Repo, ref: string): Promise<Pacote> {
  const a = await acessoDaConexao(d, repo.conexao_id);
  const r = await d.buscar(urlPacote(a, repo, ref), { headers: cabecalhos(a), redirect: 'follow' });
  const onde = repo.provedor === 'gitlab' ? 'O GitLab' : 'O GitHub';
  if (!r.ok || !r.body) throw new Error(onde + ' respondeu ' + r.status + ' ao baixar ' + repo.nome + (r.status === 404 ? ' (o repositório ou o commit não existe, ou a conta não dá mais acesso a ele)' : ''));
  return await lerTarGz(r.body);
}

// grava cada desenho (a próxima rodada atualiza o mesmo, pela chave), monta o quadro dele no canvas e gera a imagem quando o texto mudou
export async function gravarTodos(d: DepsAuto, no: string, desenhos: Desenho[], prefixo: string, origem: 'github' | 'gitlab' | 'banco', referencia: string): Promise<string[]> {
  const ids: string[] = [];
  for (const des of desenhos) {
    const chave = prefixo + des.tipo;
    const r = await chamar(d, 'infra_auto_gravar', { p_no: no, p_aba: des.aba, p_chave: chave, p_nome: des.nome, p_formato: des.formato, p_fonte: des.fonte,
      p_origem: origem, p_referencia: referencia, p_evidencias: des.evidencias, p_lacunas: des.lacunas });
    ids.push(r.id);
    // o quadro: o jeito como o desenho aparece no CicloDev (cards, grupos e ligações do canvas)
    const antigo = await chamar(d, 'infra_auto_quadro_ler', { p_no: no, p_aba: des.aba, p_chave: chave }).catch(() => null);
    const aviso = origem !== 'banco' ? 'Montado sozinho do código publicado em produção' + (referencia ? ' (commit ' + referencia.slice(0, 7) + ')' : '') + '. A próxima publicação refaz este quadro.'
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

// a ficha técnica automática (parte 34): um erro aqui não atrapalha os desenhos, só fica no resumo do pedido
async function gravarFicha(d: DepsAuto, no: string, de: { repositorio?: string; banco?: string }, rotulo: string, referencia: string, campos: () => unknown[]): Promise<string> {
  try {
    const lista = campos();
    const n = await chamar(d, 'infra_ficha_gravar', { p_no: no, p_repositorio: de.repositorio || null, p_banco: de.banco || null, p_rotulo: rotulo, p_referencia: referencia || null, p_campos: lista });
    return plural(lista.length, 'campo', 'campos') + (n ? ' (' + n + (n === 1 ? ' mudou)' : ' mudaram)') : '');
  } catch (e) { return 'não gravou: ' + limparErro(e); }
}
// a análise de segurança (parte 43): como a ficha, um erro aqui não atrapalha os desenhos; vai para o resumo do pedido
async function gravarAnalise(d: DepsAuto, no: string, de: { repositorio?: string; banco?: string }, rotulo: string, referencia: string, arquivos: number, achar: () => Promise<{ achados: Achado[]; avisos?: string }>): Promise<string> {
  try {
    const r = await achar();
    const g = await chamar(d, 'analise_gravar', { p_no: no, p_repositorio: de.repositorio || null, p_banco: de.banco || null, p_rotulo: rotulo, p_referencia: referencia || null, p_arquivos: arquivos, p_achados: r.achados, p_avisos: r.avisos || null });
    if (!g) return 'não gravou: o repositório ou o banco não é deste ponto';
    return plural(g.abertos, 'achado aberto', 'achados abertos') + (g.novos ? ', ' + g.novos + ' novo' + (g.novos === 1 ? '' : 's') : '') + (g.corrigidos ? ', ' + g.corrigidos + ' corrigido' + (g.corrigidos === 1 ? '' : 's') : '') + (r.avisos ? ' (' + r.avisos + ')' : '');
  } catch (e) { return 'não gravou: ' + limparErro(e); }
}
// o inventário do que já existe (parte 44): para a tela importar como épicos e itens; um erro aqui não atrapalha o resto
async function gravarInventario(d: DepsAuto, no: string, de: { repositorio?: string; banco?: string }, rotulo: string, itens: () => ItemInv[] | Promise<ItemInv[]>): Promise<string> {
  try { const n = await chamar(d, 'analise_inventario_gravar', { p_no: no, p_repositorio: de.repositorio || null, p_banco: de.banco || null, p_rotulo: rotulo, p_itens: await itens() }); return n == null ? 'não gravou' : plural(n, 'coisa', 'coisas'); }
  catch (e) { return 'não gravou: ' + limparErro(e); }
}
// o inventário do código com as datas de verdade: o primeiro e o último commit de cada arquivo e as publicações (releases),
// para a tela montar o projeto como se o P.O. o tivesse feito no CicloDev (início, prazo e versão de cada item). Sem o histórico, segue sem datas.
async function inventarioComDatas(d: DepsAuto, repo: Repo, ref: string, pac: Pacote): Promise<ItemInv[]> {
  const itens = inventarioDoCodigo(pac.arquivos, pac.caminhos);
  try {
    const a = await acessoDaConexao(d, repo.conexao_id);
    const h = await historicoDosArquivos(d, a, repo, ref, itens.map(arquivoDe).filter(Boolean));
    for (const i of itens) { const x = h.get(arquivoDe(i)); if (x) Object.assign(i.sinais, { criado: x.criado.slice(0, 10), publicado: x.publicado.slice(0, 10), commits: x.commits }); }
    const pubs = await listarPublicacoes(d, a, repo);
    for (const p of pubs.slice(-200)) itens.push({ tipo: 'versao', chave: 'versao:' + p.tag.slice(0, 380), grupo: 'Versões', nome: (p.nome || p.tag).slice(0, 300), onde: p.tag.slice(0, 500), sinais: { data: p.data.slice(0, 10), notas: p.notas.slice(0, 1200) } });
  } catch { /* sem acesso ao histórico: o inventário vai sem datas */ }
  return itens;
}
const plural = (n: number, um: string, varios: string) => n + ' ' + (n === 1 ? um : varios);
const commitDe = (pac: Pacote, pedido: string | null) => pedido || (pac.raiz.match(/-([0-9a-f]{7,40})$/) || [])[1] || '';

export async function processar(d: DepsAuto, p: Pedido): Promise<void> {
  const resumo: Record<string, unknown>[] = [], ids: string[] = [], prefixos: string[] = [];
  let palavras: Set<string> | null = null;   // as palavras do código, para o inventário saber se uma tabela é usada
  let feitos = 0, erros = 0;
  try {
    for (const repo of p.repositorios || []) {
      try {
        const doCommit = p.origem === repo.provedor && p.referencia ? p.referencia : null;
        const pac = await baixarRepo(d, repo, doCommit || repo.branch || 'main');
        const { desenhos, avisos } = gerarDoCodigo(pac, repo.nome, d.yaml);
        const commit = commitDe(pac, doCommit);
        const prefixo = repo.provedor + ':' + repo.nome + ':';
        ids.push(...await gravarTodos(d, p.no_id, desenhos, prefixo, repo.provedor, commit));
        prefixos.push(prefixo);
        const ficha = await gravarFicha(d, p.no_id, { repositorio: repo.id }, repo.nome, commit, () => fichaDoCodigo(pac, { nome: repo.nome, branch: repo.branch }, desenhos));
        const seguranca = await gravarAnalise(d, p.no_id, { repositorio: repo.id }, repo.nome, commit, pac.caminhos.length, async () => {
          const dep = await analisarDependencias(dependenciasDe(pac.arquivos), d.buscar);
          return { achados: analisarCodigo(pac.arquivos, pac.caminhos).concat(dep.achados, analisarQualidade(pac.arquivos, pac.caminhos)), avisos: [dep.erro, pac.cortado ? 'o repositório é grande e parte dos arquivos não foi lida' : ''].filter(Boolean).join('; ') };
        });
        const inventario = await gravarInventario(d, p.no_id, { repositorio: repo.id }, repo.nome, () => inventarioComDatas(d, repo, doCommit || repo.branch || 'main', pac));
        try { const ps = palavrasDoCodigo(pac.arquivos); palavras = palavras ? new Set([...palavras, ...ps]) : ps; } catch { /* sem palavras: a tabela fica sem saber se é usada */ }
        resumo.push({ repositorio: repo.nome, commit, arquivos: pac.caminhos.length, desenhos: desenhos.map(x => x.nome), ficha, seguranca, inventario, avisos, cortado: pac.cortado || undefined });
        feitos++;
      } catch (e) { erros++; resumo.push({ repositorio: repo.nome, erro: limparErro(e) }); }
    }
    const bancos = p.bancos || [];
    for (const b of bancos) {
      try {
        const { ids: novos, e, ds, ficha: fi, seguranca: sg } = await lerEDesenhar(d, p.no_id, b, false, palavras);
        ids.push(...novos); prefixos.push(prefixoBanco(b, bancos.length));
        resumo.push({ banco: b.nome, motor: b.motor, esquemas: b.esquemas.join(', '), tabelas: e.tabelas.length, desenhos: ds.map(x => x.nome), ficha: fi, seguranca: sg });
        feitos++;
      } catch (e) {
        erros++; const m = limparErro(e, b.conexao);
        await chamar(d, 'infra_auto_banco_lido', { p_banco: b.id, p_hash: null, p_erro: m, p_abrir: false }).catch(() => null);
        resumo.push({ banco: b.nome, erro: m });
      }
    }
    if (!(p.repositorios || []).length && !bancos.length) resumo.push({ aviso: 'Nenhum repositório nem banco ligado a este ponto.' });
    const msgErro = erros ? resumo.filter(x => x.erro).map(x => (x.repositorio || ('banco ' + x.banco)) + ': ' + x.erro).join(' · ') : null;
    await chamar(d, 'infra_auto_concluir', { p_id: p.id, p_status: erros && !feitos ? 'erro' : 'pronto', p_erro: msgErro, p_diagramas: ids, p_resumo: resumo, p_prefixos: prefixos });
  } catch (e) {
    await chamar(d, 'infra_auto_concluir', { p_id: p.id, p_status: 'erro', p_erro: limparErro(e, p.bancos?.[0]?.conexao), p_diagramas: ids, p_resumo: resumo, p_prefixos: [] }).catch(() => null);
  }
}

// cada banco tem a própria família de desenhos: banco:<id>:der:public, banco:<id>:acesso...
const prefixoBanco = (b: Banco, _n?: number) => 'banco:' + b.id + ':';
// lê a estrutura de um banco, guarda o resumo e grava os desenhos dele
async function lerEDesenhar(d: DepsAuto, no: string, b: Banco, abrir: boolean, palavras: Set<string> | null = null) {
  const e = await d.lerBanco(b.conexao, b.esquemas, b.motor || 'postgres');
  const hash = await resumoEstrutura(e);
  const pedido = await chamar(d, 'infra_auto_banco_lido', { p_banco: b.id, p_hash: hash, p_erro: null, p_abrir: abrir });
  if (abrir && !pedido) return { ids: [] as string[], e, ds: [], pedido: null, ficha: null, seguranca: null };
  const info = { nome: b.nome, motor: b.motor, provedor: b.provedor };
  const ds = gerarDoBanco(e, b.esquemas, info);
  const ids = await gravarTodos(d, no, ds, prefixoBanco(b), 'banco', hash.slice(0, 16));
  const ficha = await gravarFicha(d, no, { banco: b.id }, b.nome, hash.slice(0, 16), () => fichaDoBanco(e, b.esquemas, info));
  const seguranca = await gravarAnalise(d, no, { banco: b.id }, b.nome, hash.slice(0, 16), e.tabelas.length, async () => ({ achados: analisarBanco(e, { mysql: b.motor === 'mysql' }) }));
  await gravarInventario(d, no, { banco: b.id }, b.nome, () => inventarioDoBanco(e, palavras));
  return { ids, e, ds, pedido, ficha, seguranca };
}
// o banco de hora em hora: só redesenha quando a estrutura mudou
export async function lerBancoDevido(d: DepsAuto, b: Banco & { no_id: string }): Promise<void> {
  let r: Awaited<ReturnType<typeof lerEDesenhar>>;
  try { r = await lerEDesenhar(d, b.no_id, b, true); }
  catch (x) { await chamar(d, 'infra_auto_banco_lido', { p_banco: b.id, p_hash: null, p_erro: limparErro(x, b.conexao), p_abrir: true }).catch(() => null); return; }
  if (!r.pedido) return;
  await chamar(d, 'infra_auto_concluir', { p_id: r.pedido, p_status: 'pronto', p_erro: null, p_diagramas: r.ids, p_resumo: [{ banco: b.nome, motor: b.motor, tabelas: r.e.tabelas.length, desenhos: r.ds.map(x => x.nome) }], p_prefixos: [prefixoBanco(b)] })
    .catch(() => null);
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
    const devidos = (await chamar(d, 'infra_auto_bancos_devidos', { p_limite: 3 })) as (Banco & { no_id: string })[];
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
