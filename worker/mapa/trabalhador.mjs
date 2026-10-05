#!/usr/bin/env node
// Trabalhador do Mapa do Sistema (CicloDev). Fica rodando num servidor com Docker e, sem login em sistema nenhum e sem IA:
//   1. pede o próximo pedido à função mapa-trabalho (só com o segredo dele, MAPA_SEGREDO);
//   2. baixa o código pela mesma função (a chave do GitHub/GitLab nunca chega aqui);
//   3. constrói uma cópia do sistema numa pasta temporária e percorre com cada papel, com o banco de mentira;
//   4. devolve o mapa (peças, ligações, alertas) e apaga a pasta.
// Uso:
//   MAPA_URL=https://<projeto>.supabase.co/functions/v1/mapa-trabalho MAPA_SEGREDO=... node trabalhador.mjs          (fica rodando)
//   ... node trabalhador.mjs --uma-vez                                                                                (um pedido e sai)
//   node trabalhador.mjs --pasta <repositório> [--banco estrutura.json] [--saida mapa.json]                         (local, sem servidor)
import { mkdtempSync, rmSync, writeFileSync, readFileSync, createWriteStream, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { analisar } from './lib/analisar.mjs';

const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const tem = (n) => process.argv.includes(n);
const log = (m) => console.log(new Date().toISOString().slice(11, 19) + ' ' + m);
const URL_F = process.env.MAPA_URL, SEGREDO = process.env.MAPA_SEGREDO;
// o segredo fica só na memória deste processo: o código analisado roda como outro usuário e sem estas variáveis
delete process.env.MAPA_SEGREDO;
const esperar = (ms) => new Promise(r => setTimeout(r, ms));

async function chamar(corpo, bruto = false) {
  const r = await fetch(URL_F, { method: 'POST', headers: { 'content-type': 'application/json', 'x-mapa-segredo': SEGREDO }, body: JSON.stringify(corpo) });
  if (bruto) return r;
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error('mapa-trabalho (' + corpo.acao + ') respondeu ' + r.status + ': ' + (j.erro || 'sem detalhe'));
  return j;
}

async function umPedido() {
  const { pedido } = await chamar({ acao: 'proximo' });
  if (!pedido) return false;
  log('pedido ' + pedido.id + ': ' + pedido.repositorio.nome + ' (' + (pedido.referencia || pedido.repositorio.branch) + ')');
  const pasta = mkdtempSync(join(tmpdir(), 'mapa-'));
  try {
    const r = await chamar({ acao: 'pacote', analise: pedido.id }, true);
    if (!r.ok || !r.body) { const j = await r.json().catch(() => ({})); throw new Error(j.erro || ('não baixou o código (' + r.status + ')')); }
    await pipeline(Readable.fromWeb(r.body), createWriteStream(join(pasta, 'codigo.tar.gz')));
    execFileSync('mkdir', ['-p', join(pasta, 'repo')]);
    execFileSync('tar', ['-xzf', join(pasta, 'codigo.tar.gz'), '-C', join(pasta, 'repo'), '--strip-components=1', '--no-same-owner']);
    rmSync(join(pasta, 'codigo.tar.gz'));
    try { execFileSync('chown', ['-R', 'caixa:caixa', pasta]); } catch { /* fora do contêiner: sem o usuário caixa */ }
    chmodSync(pasta, 0o755);
    const res = await analisar(join(pasta, 'repo'), { bancos: pedido.bancos, usadasPorOutras: pedido.usadas_por_outras, nome: pedido.no_nome, log });
    const g = await chamar({ acao: 'resultado', analise: pedido.id, resultado: res });
    log('pronto: ' + g.gravado.pecas + ' peças, ' + g.gravado.ligacoes + ' ligações, ' + g.gravado.alertas + ' alertas');
  } catch (e) {
    log('erro: ' + (e.message || e));
    await chamar({ acao: 'falhou', analise: pedido.id, erro: String(e.message || e).slice(0, 1900) }).catch(() => null);
  } finally { rmSync(pasta, { recursive: true, force: true }); }
  return true;
}

if (arg('--pasta')) {
  const bancos = arg('--banco') ? JSON.parse(readFileSync(arg('--banco'), 'utf8')) : [];
  const res = await analisar(arg('--pasta'), { bancos: Array.isArray(bancos) ? bancos : [bancos], log, tempoPapelMs: Number(arg('--tempo') || 0) * 1000 || undefined, soApps: arg('--apps') ? arg('--apps').split(',') : null });
  const saida = arg('--saida') || 'mapa.json';
  writeFileSync(saida, JSON.stringify(res, null, 1));
  log('gravado em ' + saida + ': ' + res.pecas.length + ' peças, ' + res.ligacoes.length + ' ligações, ' + res.alertas.length + ' alertas');
} else {
  if (!URL_F || !SEGREDO || SEGREDO.length < 32) { console.error('Faltam MAPA_URL e MAPA_SEGREDO (o segredo tem pelo menos 32 letras).'); process.exit(2); }
  for (;;) {
    let fez = false;
    try { fez = await umPedido(); } catch (e) { log('não falou com o CicloDev: ' + (e.message || e)); }
    if (tem('--uma-vez')) break;
    await esperar(fez ? 2000 : 30_000);
  }
}
