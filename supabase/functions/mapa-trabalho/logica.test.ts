// Testes da função mapa-trabalho com GitHub, banco do cliente e CicloDev de mentira. Rodar da raiz do repositório:
//   node --experimental-strip-types supabase/functions/mapa-trabalho/logica.test.ts
import { generateKeyPairSync } from 'node:crypto';
import { tratar } from './logica.ts';
import type { DepsMapa } from './logica.ts';
import type { Estrutura } from '../diagramas-auto/gerar.ts';

let falhas = 0;
const ok = (c: unknown, m: string) => { console.log((c ? 'OK    ' : 'FALHA ') + m); if (!c) falhas++; };
const SEGREDO = 's'.repeat(48), ENDERECO = 'postgres://dono:SENHA-SECRETA@banco.cliente:5432/app';
const pem = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
const estrutura: Estrutura = { tabelas: [{ esquema: 'public', nome: 'clientes', tipo: 'r', rls: true, rls_forcado: false, nota: null, colunas: [{ nome: 'id', tipo: 'uuid' } as any, { nome: 'nome', tipo: 'text' } as any], restricoes: [], permissoes: [], regras: [] }], papeis: [] };
const ANALISE = '11111111-2222-3333-4444-555555555555';

function deps(opc: { fila?: boolean; quebraBanco?: boolean } = {}) {
  const chamadas: { nome: string; args: any }[] = [], urls: string[] = [];
  let status = 'fila';
  const d: DepsMapa = {
    rpc: async (nome, args) => {
      chamadas.push({ nome, args });
      if (nome === 'mapa_confere') return { data: args.p_segredo === SEGREDO, error: null };
      if (nome === 'mapa_proximo') {
        if (opc.fila === false || status !== 'fila') return { data: null, error: null };
        status = 'rodando';
        return { data: { id: ANALISE, no_id: 'no-1', no_nome: 'Painel', referencia: 'abc1234', usadas_por_outras: ['pedidos.total'],
          repositorio: { id: 'r1', nome: 'it-hub/painel', branch: 'main', provedor: 'github', conexao_id: 'c1', externo_id: '99' },
          bancos: [{ id: 'b1', nome: 'Produção', provedor: 'supabase', motor: 'postgres', esquemas: ['public'], conexao: ENDERECO }] }, error: null };
      }
      if (nome === 'mapa_repo_da_analise') return { data: status === 'rodando' ? { id: 'r1', nome: 'it-hub/painel', branch: 'main', provedor: 'github', conexao_id: 'c1', externo_id: '99', referencia: 'abc1234' } : null, error: null };
      if (nome === 'git_conexao_ler') return { data: { id: 'c1', provedor: 'github', externo_id: '777', conta: 'it-hub' }, error: null };
      if (nome === 'git_app_ler') return { data: { app_id: 1, pem }, error: null };
      if (nome === 'mapa_gravar') { if (status !== 'rodando') return { data: null, error: { message: 'Esta análise não está rodando (pronto)' } }; status = 'pronto'; return { data: { pecas: args.p_resultado.pecas.length, ligacoes: 0, alertas: 0 }, error: null }; }
      if (nome === 'mapa_falhou') { status = 'erro'; return { data: null, error: null }; }
      return { data: null, error: { message: 'função inesperada ' + nome } };
    },
    buscar: (async (url: string, init?: any) => {
      urls.push(String(url));
      if (String(url).endsWith('/access_tokens')) return new Response(JSON.stringify({ token: 'ghs_CHAVE_DA_INSTALACAO' }), { status: 201 });
      if (String(url).includes('/tarball/')) return new Response(new Uint8Array([0x1f, 0x8b, 8, 0, 1, 2, 3]), { status: 200, headers: { 'content-type': 'application/x-gzip' } });
      return new Response('não', { status: 404 });
    }) as any,
    lerBanco: async (conexao) => { if (opc.quebraBanco) throw new Error('falhou ao conectar em ' + conexao); return estrutura; },
    lerExtra: async () => ({ palavras: ['clientes', 'nome', 'calcular_total'], checagens: [{ esquema: 'public', tabela: 'pessoas', regra: "CHECK ((nivel = ANY (ARRAY['gerente'::text, 'diretor'::text])))" }] }),
  };
  return { d, chamadas, urls, status: () => status };
}
const pedir = (corpo: unknown, segredo = SEGREDO, metodo = 'POST') => new Request('https://x/functions/v1/mapa-trabalho', { method: metodo, headers: { 'x-mapa-segredo': segredo, 'content-type': 'application/json' }, body: metodo === 'POST' ? JSON.stringify(corpo) : undefined });

// 1. porta fechada sem o segredo certo
{
  const { d } = deps();
  ok((await tratar(pedir({ acao: 'proximo' }, ''), d)).status === 401, 'sem segredo: não autorizado');
  ok((await tratar(pedir({ acao: 'proximo' }, 'x'.repeat(48)), d)).status === 401, 'segredo errado: não autorizado');
  ok((await tratar(pedir(null, SEGREDO, 'GET'), d)).status === 405, 'só POST');
  ok((await tratar(pedir({ acao: 'pacote', analise: 'nao-e-uuid' }), d)).status === 400, 'análise que não é um id é recusada');
}
// 2. proximo: estrutura e palavras, sem endereço, sem chave
{
  const { d } = deps();
  const r = await tratar(pedir({ acao: 'proximo' }), d), txt = await r.text(), j = JSON.parse(txt);
  ok(r.status === 200 && j.pedido.id === ANALISE && j.pedido.repositorio.nome === 'it-hub/painel' && j.pedido.referencia === 'abc1234', 'entrega o próximo pedido com o repositório e o commit');
  ok(j.pedido.bancos[0].estrutura.tabelas[0].nome === 'clientes' && j.pedido.bancos[0].palavras.includes('calcular_total') && /gerente/.test(j.pedido.bancos[0].checagens[0].regra), 'com a estrutura do banco, as regras de valor e as palavras das funções');
  ok(!txt.includes('SENHA-SECRETA') && !txt.includes('banco.cliente') && !txt.includes('conexao') && !txt.includes('ghs_'), 'nunca entrega endereço do banco, conexão nem chave');
  ok(j.pedido.usadas_por_outras[0] === 'pedidos.total', 'entrega as colunas que outras aplicações usam');
  const vazio = JSON.parse(await (await tratar(pedir({ acao: 'proximo' }), d)).text());
  ok(vazio.ok && vazio.pedido === null, 'fila vazia: pedido nulo');
}
// 3. banco que não conecta: o erro vai sem o endereço
{
  const { d } = deps({ quebraBanco: true });
  const txt = await (await tratar(pedir({ acao: 'proximo' }), d)).text();
  ok(JSON.parse(txt).pedido.bancos[0].erro && !txt.includes('SENHA-SECRETA'), 'banco que não conecta: avisa o erro, sem o endereço');
}
// 4. pacote: passa o código adiante com a chave da instalação, sem a chave sair daqui
{
  const { d, urls } = deps();
  await tratar(pedir({ acao: 'proximo' }), d);
  const r = await tratar(pedir({ acao: 'pacote', analise: ANALISE }), d);
  const b = new Uint8Array(await r.arrayBuffer());
  ok(r.status === 200 && r.headers.get('content-type') === 'application/gzip' && b[0] === 0x1f && b[1] === 0x8b, 'pacote: entrega o .tar.gz do commit');
  ok(urls.some(u => u.includes('/repos/it-hub/painel/tarball/abc1234')), 'baixa exatamente o commit publicado');
  ok(![...r.headers.values()].some(v => v.includes('ghs_')), 'a chave do GitHub não sai na resposta');
}
{
  const { d } = deps();
  ok((await tratar(pedir({ acao: 'pacote', analise: ANALISE }), d)).status === 409, 'pacote de análise que não está rodando: recusado');
}
// 5. resultado e falhou
{
  const { d, status } = deps();
  await tratar(pedir({ acao: 'proximo' }), d);
  ok((await tratar(pedir({ acao: 'resultado', analise: ANALISE }), d)).status === 400, 'resultado sem conteúdo: recusado');
  const j = JSON.parse(await (await tratar(pedir({ acao: 'resultado', analise: ANALISE, resultado: { pecas: [{ chave: 'app', tipo: 'aplicacao', nome: 'Painel' }] } }), d)).text());
  ok(j.ok && j.gravado.pecas === 1 && status() === 'pronto', 'resultado: grava o mapa');
  const de2 = await tratar(pedir({ acao: 'resultado', analise: ANALISE, resultado: { pecas: [] } }), d);
  ok(de2.status === 500 && /não está rodando/.test(await de2.text()), 'não grava duas vezes');
}
{
  const { d, status } = deps();
  await tratar(pedir({ acao: 'proximo' }), d);
  ok((await tratar(pedir({ acao: 'falhou', analise: ANALISE, erro: 'não construiu' }), d)).status === 200 && status() === 'erro', 'falhou: marca o erro');
  ok((await tratar(pedir({ acao: 'apagar_tudo', analise: ANALISE }), d)).status === 400, 'ação desconhecida: recusada');
}
console.log(falhas ? falhas + ' FALHA(S)' : 'tudo OK');
if (falhas) process.exit(1);
