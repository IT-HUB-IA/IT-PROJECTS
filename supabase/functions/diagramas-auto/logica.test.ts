// Testes da função diagramas-auto com GitHub, conversor e banco de mentira. Rodar da raiz do repositório:
//   NODE_PATH=<pasta com o pacote yaml> node --experimental-strip-types supabase/functions/diagramas-auto/logica.test.ts
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { tratar, rodar, limparErro } from './logica.ts';
import type { DepsAuto } from './logica.ts';
import type { Estrutura } from './gerar.ts';

const YAML = createRequire(import.meta.url)('yaml');
let falhas = 0;
const ok = (c: unknown, m: string) => { console.log((c ? 'OK    ' : 'FALHA ') + m); if (!c) falhas++; };

// um repositório de verdade empacotado como o GitHub entrega (dono-repo-commit/...)
const pasta = mkdtempSync(tmpdir() + '/repo-');
const raiz = pasta + '/it-hub-loja-abc1234';
const arquivos: Record<string, string> = {
  'package.json': JSON.stringify({ name: 'loja', dependencies: { next: '15', react: '19' } }),
  'app/page.tsx': "import { a } from '../lib/a';\nimport React from 'react';",
  'app/conta/page.tsx': "import { a } from '../../lib/a';",
  'lib/a.ts': 'export const a = 1;',
  'docker-compose.yml': 'services:\n  web:\n    build: .\n    depends_on: [banco]\n  banco:\n    image: postgres:16\n',
};
for (const [k, v] of Object.entries(arquivos)) { mkdirSync((raiz + '/' + k).replace(/\/[^/]+$/, ''), { recursive: true }); writeFileSync(raiz + '/' + k, v); }
execFileSync('tar', ['-czf', pasta + '/pacote.tgz', '-C', pasta, 'it-hub-loja-abc1234']);
const pacote = readFileSync(pasta + '/pacote.tgz');

const ESTR: Estrutura = { papeis: [{ nome: 'authenticated', ignora_rls: false }], tabelas: [
  { esquema: 'public', nome: 'clientes', tipo: 'r', rls: true, rls_forcado: false, nota: null, colunas: [{ nome: 'id', tipo: 'uuid', nao_nulo: true, padrao: null, nota: null }],
    restricoes: [{ nome: 'pk', tipo: 'p', cols: ['id'], ref_esquema: null, ref_tabela: null, ref_cols: null }], permissoes: [{ papel: 'authenticated', privs: ['SELECT'] }], regras: [] }] };
const CONEXAO = 'postgresql://leitor:SenhaSecreta123@db.exemplo.com:5432/postgres';
const SEGREDO = 'a'.repeat(64);

type Chamada = { nome: string; args: any };
function montar(o: { fila?: any[][]; devidos?: any[]; env?: Record<string, string>; banco?: () => Promise<Estrutura>; render?: (u: string) => Response; hashAnterior?: string; agora?: () => number; orcamentoMs?: number } = {}) {
  const chamadas: Chamada[] = [], buscas: string[] = [], fundo: Promise<unknown>[] = [];
  const fila = (o.fila || []).slice(); let n = 0, hash = o.hashAnterior || null;
  const env = Object.assign({ GITHUB_TOKEN: 'gh-teste', RENDER_URL: 'https://conversor.exemplo' }, o.env || {});
  const d: DepsAuto = {
    env: k => env[k as keyof typeof env],
    rpc: async (nome, args) => {
      chamadas.push({ nome, args });
      if (nome === 'infra_auto_confere') return { data: args.p_segredo === SEGREDO, error: null };
      if (nome === 'infra_auto_proximos') return { data: fila.shift() || [], error: null };
      if (nome === 'infra_auto_bancos_devidos') return { data: o.devidos || [], error: null };
      if (nome === 'infra_auto_gravar') return { data: { id: 'd' + (++n), renderizar: true }, error: null };
      if (nome === 'infra_auto_quadro_ler') return { data: null, error: null };
      if (nome === 'infra_auto_quadro') return { data: 'quadros/auto' + args.p_chave.length, error: null };
      if (nome === 'infra_auto_banco_lido') { const mudou = args.p_hash && args.p_hash !== hash; if (args.p_hash) hash = args.p_hash; return { data: mudou && args.p_abrir ? 'pedido-banco' : null, error: null }; }
      return { data: null, error: null };
    },
    buscar: (async (u: string, init?: RequestInit) => {
      buscas.push(String(u));
      if (String(u).startsWith('https://api.github.com/')) return new Response(new Blob([pacote]).stream(), { status: 200 });
      if (o.render) return o.render(String(u));
      return new Response('<svg xmlns="http://www.w3.org/2000/svg"><script>x</script><text>ok</text></svg>', { status: 200 });
    }) as typeof fetch,
    yaml: t => YAML.parseAllDocuments(t).map((x: any) => x.toJS()),
    lerBanco: o.banco || (async () => ESTR),
    emSegundoPlano: p => { fundo.push(p); },
    agora: o.agora, orcamentoMs: o.orcamentoMs,
  };
  return { d, chamadas, buscas, fundo, de: (nome: string) => chamadas.filter(c => c.nome === nome) };
}
const pedir = (headers: Record<string, string> = {}, metodo = 'POST') => new Request('https://x.supabase.co/functions/v1/diagramas-auto', { method: metodo, headers });

// ---------- quem pode chamar ----------
{
  const t = montar();
  ok((await tratar(pedir(), t.d)).status === 401, 'sem segredo: 401');
  ok((await tratar(pedir({ 'x-diagramas-segredo': 'b'.repeat(64) }), t.d)).status === 401, 'segredo errado: 401');
  ok((await tratar(pedir({ 'x-diagramas-segredo': 'curto' }), t.d)).status === 401 && t.de('infra_auto_confere').length === 1, 'segredo curto nem chega a ser conferido no banco');
  ok((await tratar(pedir({}, 'GET'), t.d)).status === 405, 'só POST');
  ok(t.fundo.length === 0 && !t.de('infra_auto_proximos').length, 'sem autorização, nada roda');
}
{
  const t = montar({ fila: [[{ id: 'p1', no_id: 'prod', origem: 'github', referencia: 'abc1234def', repositorios: [{ id: 'r', nome: 'it-hub/loja', branch: 'main', provedor: 'github' }], banco: null }]] });
  const r = await tratar(pedir({ 'x-diagramas-segredo': SEGREDO }), t.d);
  ok(r.status === 202, 'segredo certo: responde 202 na hora e trabalha em segundo plano');
  await Promise.all(t.fundo);
  ok(t.buscas[0] === 'https://api.github.com/repos/it-hub/loja/tarball/abc1234def', 'baixa o código do commit que foi publicado');
  const g = t.de('infra_auto_gravar');
  ok(g.map(x => x.args.p_chave).join(',') === 'github:it-hub/loja:software,github:it-hub/loja:infra,github:it-hub/loja:rotas', 'grava software, infraestrutura e rotas com a chave do repositório (' + g.length + ' desenhos)');
  ok(g.every(x => x.args.p_no === 'prod' && x.args.p_origem === 'github' && x.args.p_referencia === 'abc1234def'), 'no produto certo, com a origem e o commit');
  ok(g.find(x => x.args.p_chave.endsWith(':rotas'))!.args.p_aba === 'ux' && g.find(x => x.args.p_chave.endsWith(':infra'))!.args.p_aba === 'infra', 'cada desenho na sub-aba certa');
  const qd = t.de('infra_auto_quadro');
  ok(qd.length === 3 && qd.every((x, i) => x.args.p_diagrama === 'd' + (i + 1) && x.args.p_chave === g[i].args.p_chave && Array.isArray(x.args.p_doc.nodes) && x.args.p_doc.nodes.length > 2 && x.args.p_doc.pai === 'raiz'), 'monta o quadro de cada desenho no canvas (cards, grupos e ligações), ligado ao desenho');
  const sw = qd[0].args.p_doc;
  ok(sw.nodes.some((n: any) => n.tipo === 'modulo' && n.titulo === 'app') && sw.nodes.some((n: any) => n.tipo === 'grupo') && sw.edges.some((e: any) => /importaç/.test(e.rotulo)), 'o quadro de software tem os módulos, o grupo e as setas com o número de importações');
  ok(sw.nodes.some((n: any) => n.tipo === 'cartao' && /commit abc1234/.test(n.texto)), 'e diz de qual commit saiu');
  const im = t.de('infra_auto_imagem');
  ok(im.length === 3 && im.every(x => x.args.p_svg && !/<script/i.test(x.args.p_svg) && !x.args.p_erro), 'gera também a imagem de cada um pelo conversor (para baixar), sem script dentro');
  ok(t.buscas.filter(u => u.startsWith('https://conversor.exemplo/')).sort().join(',') === 'https://conversor.exemplo/graphviz/svg,https://conversor.exemplo/mermaid/svg,https://conversor.exemplo/plantuml/svg', 'chama o conversor no formato de cada desenho');
  const c = t.de('infra_auto_concluir')[0].args;
  ok(c.p_id === 'p1' && c.p_status === 'pronto' && c.p_diagramas.length === 3 && c.p_prefixos.join() === 'github:it-hub/loja:', 'fecha o pedido com os desenhos e a família do repositório (para arquivar o que sumiu)');
  ok(c.p_resumo[0].commit === 'abc1234def' && c.p_resumo[0].arquivos === 5, 'o resumo diz o commit e quantos arquivos leu');
}

// ---------- "Atualizar agora": branch principal, GitLab avisado, banco lido junto ----------
{
  const t = montar({ fila: [[{ id: 'm1', no_id: 'prod', origem: 'manual', referencia: null, repositorios: [
    { id: 'r1', nome: 'it-hub/loja', branch: 'producao', provedor: 'github' }, { id: 'r2', nome: 'it-hub/antigo', branch: 'main', provedor: 'gitlab' }], banco: { esquemas: ['public'], conexao: CONEXAO } }]] });
  const r = await rodar(t.d);
  ok(r.pedidos === 1 && t.buscas[0].endsWith('/tarball/producao'), 'Atualizar agora baixa o branch principal do repositório');
  ok(t.de('infra_auto_gravar').find(x => x.args.p_chave === 'github:it-hub/loja:software')!.args.p_referencia === 'abc1234', 'e guarda o commit que veio no pacote');
  const c = t.de('infra_auto_concluir')[0].args;
  ok(c.p_resumo.some((x: any) => x.repositorio === 'it-hub/antigo' && /GitLab/.test(x.aviso)) && !t.buscas.some(u => /antigo/.test(u)), 'repositório do GitLab é avisado e não é baixado');
  ok(t.de('infra_auto_banco_lido')[0].args.p_abrir === false, 'o banco lido dentro do pedido não abre outro pedido');
  ok(t.de('infra_auto_gravar').some(x => x.args.p_chave === 'banco:der:public' && x.args.p_aba === 'der' && x.args.p_origem === 'banco') && t.de('infra_auto_gravar').some(x => x.args.p_chave === 'banco:acesso' && x.args.p_aba === 'seguranca'), 'o banco dá o DER e o mapa de acesso');
  const der = t.de('infra_auto_quadro').find(x => x.args.p_chave === 'banco:der:public')!.args.p_doc;
  ok(der.nodes.some((n: any) => n.tipo === 'tabela' && n.titulo === 'clientes' && n.linhas.some((l: any) => l.nome === 'id' && l.chave === 'pk')), 'o quadro do DER tem a tabela com a coluna PK');
  ok(c.p_status === 'pronto' && c.p_prefixos.join() === 'github:it-hub/loja:,banco:', 'fecha pronto, com as duas famílias');
}

// ---------- erros: sem chave, banco fora do ar (a senha nunca aparece), conversor fora ----------
{
  const t = montar({ env: { GITHUB_TOKEN: '' }, fila: [[{ id: 'p2', no_id: 'prod', origem: 'github', referencia: 'x', repositorios: [{ id: 'r', nome: 'it-hub/loja', branch: 'main', provedor: 'github' }], banco: null }]] });
  await rodar(t.d);
  const c = t.de('infra_auto_concluir')[0].args;
  ok(c.p_status === 'erro' && /GITHUB_TOKEN/.test(c.p_erro) && !t.buscas.length, 'sem a chave do GitHub: o pedido fecha com erro dizendo qual chave falta');
}
{
  const t = montar({ banco: async () => { throw new Error('connection to ' + CONEXAO + ' failed: password authentication failed'); },
    fila: [[{ id: 'm2', no_id: 'prod', origem: 'manual', referencia: null, repositorios: [], banco: { esquemas: ['public'], conexao: CONEXAO } }]] });
  await rodar(t.d);
  const c = t.de('infra_auto_concluir')[0].args, lido = t.de('infra_auto_banco_lido')[0].args;
  ok(c.p_status === 'erro' && /password authentication failed/.test(c.p_erro), 'banco com senha errada: o pedido fecha com erro');
  ok(!JSON.stringify(t.chamadas).includes('SenhaSecreta123') && /\[endereço do banco\]/.test(lido.p_erro), 'e a senha do banco nunca é gravada no erro');
}
ok(limparErro(new Error('falhou em postgres://u:p@h/db agora')) === 'falhou em [endereço do banco] agora', 'qualquer endereço postgres:// sai da mensagem');
{
  const t = montar({ env: { RENDER_URL: '' }, fila: [[{ id: 'p3', no_id: 'prod', origem: 'github', referencia: 'abc', repositorios: [{ id: 'r', nome: 'it-hub/loja', branch: 'main', provedor: 'github' }], banco: null }]] });
  await rodar(t.d);
  const im = t.de('infra_auto_imagem');
  ok(im.length === 3 && im.every(x => !x.args.p_svg && /RENDER_URL/.test(x.args.p_erro)) && t.de('infra_auto_concluir')[0].args.p_status === 'pronto', 'sem o conversor: os desenhos (texto) são gravados e cada um avisa que falta RENDER_URL');
}
{
  const t = montar({ render: () => new Response('Error 400: Syntax error in line 3', { status: 400 }), fila: [[{ id: 'p4', no_id: 'prod', origem: 'github', referencia: 'abc', repositorios: [{ id: 'r', nome: 'it-hub/loja', branch: 'main', provedor: 'github' }], banco: null }]] });
  await rodar(t.d);
  ok(t.de('infra_auto_imagem').every(x => /400/.test(x.args.p_erro)), 'conversor recusou: o erro dele fica no desenho');
}

// ---------- banco de hora em hora ----------
{
  const t = montar({ devidos: [{ no_id: 'prod', esquemas: ['public'], conexao: CONEXAO }] });
  await rodar(t.d);
  ok(t.de('infra_auto_banco_lido')[0].args.p_abrir === true && t.de('infra_auto_gravar').length === 2 && t.de('infra_auto_concluir')[0].args.p_id === 'pedido-banco', 'estrutura nova: abre o pedido de banco e desenha');
}
{
  const t0 = montar({ devidos: [{ no_id: 'prod', esquemas: ['public'], conexao: CONEXAO }] });
  await rodar(t0.d);
  const hash = t0.de('infra_auto_banco_lido')[0].args.p_hash;
  const t = montar({ hashAnterior: hash, devidos: [{ no_id: 'prod', esquemas: ['public'], conexao: CONEXAO }] });
  await rodar(t.d);
  ok(t.de('infra_auto_banco_lido').length === 1 && !t.de('infra_auto_gravar').length && !t.de('infra_auto_concluir').length, 'estrutura igual: só marca que leu, não redesenha');
}

// ---------- tempo: não começa pedido novo depois do limite ----------
{
  let relogio = 0;
  const p = (id: string) => [{ id, no_id: 'prod', origem: 'manual', referencia: null, repositorios: [], banco: null }];
  const t = montar({ fila: [p('a'), p('b'), p('c')], agora: () => (relogio += 40_000), orcamentoMs: 110_000 });
  const r = await rodar(t.d);
  ok(r.pedidos === 2 && t.de('infra_auto_proximos').length === 2, 'passou do tempo: para de pegar pedido (o resto fica para a próxima chamada)');
}

console.log(falhas ? falhas + ' FALHAS' : 'TUDO OK');
if (falhas) process.exit(1);
