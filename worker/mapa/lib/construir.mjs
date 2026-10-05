// Constrói e serve a cópia de uma aplicação numa pasta temporária, como uma pessoa sem acesso a nada faria:
// instala (só aqui há rede, para baixar as bibliotecas), constrói com variáveis falsas e sobe num endereço local.
// O código do cliente roda como o usuário "caixa" (sem o segredo do trabalhador e sem nada do ambiente dele).
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { servirPasta } from './servir.mjs';
import { variaveisDoCodigo, lerJson } from './detectar.mjs';

let CAIXA; // {uid, gid} do usuário sem privilégio, quando existe
function usuarioCaixa() {
  if (CAIXA !== undefined) return CAIXA;
  CAIXA = null;
  if (process.getuid && process.getuid() === 0) { try { const uid = Number(execFileSync('id', ['-u', 'caixa']).toString().trim()); const gid = Number(execFileSync('id', ['-g', 'caixa']).toString().trim()); CAIXA = { uid, gid }; } catch { CAIXA = null; } }
  return CAIXA;
}
const ENV_BASE = () => ({ PATH: process.env.PATH, HOME: '/tmp', LANG: 'C.UTF-8', CI: '1', NODE_ENV: 'production', npm_config_audit: 'false', npm_config_fund: 'false', npm_config_update_notifier: 'false', BROWSER: 'none', NEXT_TELEMETRY_DISABLED: '1' });

export function rodar(cmd, args, { cwd, env = {}, tempoMs = 600_000, saida } = {}) {
  return new Promise((ok) => {
    const c = usuarioCaixa();
    const p = spawn(cmd, args, { cwd, env: { ...ENV_BASE(), ...env }, stdio: ['ignore', 'pipe', 'pipe'], ...(c ? { uid: c.uid, gid: c.gid } : {}), detached: true });
    let log = '';
    const pegar = (d) => { const t = d.toString(); log = (log + t).slice(-20000); if (saida) saida(t); };
    p.stdout.on('data', pegar); p.stderr.on('data', pegar);
    const fim = setTimeout(() => { try { process.kill(-p.pid, 'SIGKILL'); } catch { /* já saiu */ } }, tempoMs);
    p.on('close', (codigo) => { clearTimeout(fim); ok({ codigo, log }); });
    p.on('error', (e) => { clearTimeout(fim); ok({ codigo: -1, log: String(e) }); });
  });
}
function gerenciador(pasta) {
  if (existsSync(join(pasta, 'pnpm-lock.yaml'))) return { cmd: 'npx', inst: ['--yes', 'pnpm@9', 'install', '--frozen-lockfile=false'], run: (s) => ['--yes', 'pnpm@9', 'run', s] };
  if (existsSync(join(pasta, 'yarn.lock'))) return { cmd: 'npx', inst: ['--yes', 'yarn@1', 'install', '--non-interactive'], run: (s) => ['--yes', 'yarn@1', 'run', s] };
  if (existsSync(join(pasta, 'package-lock.json'))) return { cmd: 'npm', inst: ['ci', '--include=dev'], run: (s) => ['run', s], reserva: ['install', '--include=dev'] };
  return { cmd: 'npm', inst: ['install', '--include=dev'], run: (s) => ['run', s] };
}
const SAIDAS = ['dist', 'build', 'out', 'public/build', '.output/public', 'dist/browser', 'www', '_site'];
function pastaPronta(pasta) {
  for (const s of SAIDAS) { const c = join(pasta, s); if (existsSync(join(c, 'index.html'))) return c; }
  // Angular: dist/<nome>/browser
  try { const ang = lerJson(join(pasta, 'angular.json')); const proj = ang && Object.values(ang.projects || {})[0]; const o = proj?.architect?.build?.options?.outputPath; if (o) { const c = typeof o === 'string' ? join(pasta, o) : join(pasta, o.base || 'dist'); for (const x of [c, join(c, 'browser')]) if (existsSync(join(x, 'index.html'))) return x; } } catch { /* sem angular */ }
  return null;
}
const esperar = (ms) => new Promise(r => setTimeout(r, ms));
async function responde(url, tempoMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < tempoMs) { try { const r = await fetch(url, { redirect: 'manual' }); if (r.status < 500) return true; } catch { /* ainda subindo */ } await esperar(700); }
  return false;
}
const portaLivre = () => new Promise((ok) => { import('node:net').then(({ createServer }) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); }); });

// devolve {url, parar(), como, log} ou lança erro com o que deu errado (vai para as lacunas)
export async function subir(app, { log = () => {} } = {}) {
  if (app.tipo === 'estatico') { const s = await servirPasta(app.pasta); return { ...s, como: 'arquivos publicados' }; }
  if (app.tipo !== 'node') throw new Error('Esta aplicação (' + app.framework + ') é lida só pelo código: o trabalhador não roda servidores ' + app.framework + '.');
  const g = gerenciador(app.pasta), env = variaveisDoCodigo(app.pasta);
  log('instalando as bibliotecas de ' + app.rel);
  let r = await rodar(g.cmd, g.inst, { cwd: app.pasta, env });
  if (r.codigo !== 0 && g.reserva) r = await rodar(g.cmd, g.reserva, { cwd: app.pasta, env });
  if (r.codigo !== 0) throw new Error('não instalou as bibliotecas: ' + ultimaLinha(r.log));
  const s = app.scripts || {};
  if (s.build && app.framework !== 'Next.js' && app.framework !== 'Nuxt' && app.framework !== 'Remix' && app.framework !== 'SvelteKit') {
    log('construindo ' + app.rel);
    const b = await rodar(g.cmd, g.run('build'), { cwd: app.pasta, env });
    const pronta = b.codigo === 0 ? pastaPronta(app.pasta) : null;
    if (pronta) { const sv = await servirPasta(pronta, { spa: true }); return { ...sv, como: 'construída (' + pronta.slice(app.pasta.length + 1) + ')' }; }
    log('a construção não gerou páginas prontas; tentando o modo de desenvolvimento');
  }
  // servidor do próprio framework (Next, Nuxt...) ou modo de desenvolvimento
  const porta = await portaLivre();
  const roteiro = s.build && /Next|Nuxt|Remix|SvelteKit/.test(app.framework) ? 'build+start' : (s.dev ? 'dev' : s.start ? 'start' : 'serve');
  if (roteiro === 'build+start') { const b = await rodar(g.cmd, g.run('build'), { cwd: app.pasta, env }); if (b.codigo !== 0) throw new Error('não construiu: ' + ultimaLinha(b.log)); }
  const script = roteiro === 'build+start' ? (s.start ? 'start' : 'dev') : roteiro;
  const c = usuarioCaixa();
  const extra = /Next/.test(app.framework) ? ['--', '-p', String(porta), '-H', '127.0.0.1'] : /Vite|Vue|React|Svelte|Solid|Preact|Astro/.test(app.framework) ? ['--', '--port', String(porta), '--host', '127.0.0.1'] : [];
  const p = spawn(g.cmd, [...g.run(script), ...extra], { cwd: app.pasta, env: { ...ENV_BASE(), ...env, PORT: String(porta), HOST: '127.0.0.1', NODE_ENV: script === 'dev' ? 'development' : 'production' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true, ...(c ? { uid: c.uid, gid: c.gid } : {}) });
  let saida = ''; p.stdout.on('data', d => { saida = (saida + d).slice(-20000); }); p.stderr.on('data', d => { saida = (saida + d).slice(-20000); });
  const url = 'http://127.0.0.1:' + porta + '/';
  const parar = async () => { try { process.kill(-p.pid, 'SIGKILL'); } catch { /* já saiu */ } };
  if (!(await responde(url, 180_000))) { await parar(); throw new Error('a aplicação não subiu (' + script + '): ' + ultimaLinha(saida)); }
  return { url, parar, como: 'rodando (' + script + ')' };
}
const ultimaLinha = (t) => String(t || '').trim().split('\n').filter(l => l.trim()).slice(-3).join(' / ').replace(/\s+/g, ' ').slice(0, 400) || 'sem detalhe';
export { pastaPronta };
