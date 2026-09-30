// Os desenhos que saem sozinhos, sem IA: tudo aqui é leitura direta do código ou do banco, sempre igual para a mesma entrada.
// Nada de data, commit ou ordem aleatória dentro do texto do desenho: se o sistema não mudou, o desenho não muda
// (e não sobe versão à toa). O commit e o resumo do banco ficam fora, na coluna referencia.
//
//   Do código (um repositório, no commit publicado):
//     software  módulos do código e quem importa quem (PlantUML). JS/TS, Python, Go, Java/Kotlin e C#.
//     infra     Docker Compose, Dockerfile, Terraform, Kubernetes, Vercel, Netlify, Fly, Render, Supabase e GitHub Actions (Graphviz)
//     rotas     mapa de telas e rotas: Next.js, SvelteKit, Nuxt, Remix, React Router, Vue Router, Angular, páginas HTML,
//               e as rotas de API (Next, Express, Fastify, Spring, FastAPI, Flask) (Mermaid)
//     prisma    modelos do Prisma (DBML)
//   Do banco (Postgres, só leitura):
//     der       tabelas, colunas, chaves e ligações, um desenho por esquema (DBML)
//     acesso    quem acessa cada tabela, RLS ligado ou não e quantas regras (Graphviz)

export type Arquivos = Map<string, string>;
export type Evidencia = { fonte: string; trecho: string };
import type { Modelo, CardQ, LigQ, Linha } from '../_shared/quadro.ts';
// cada desenho sai de dois jeitos: o texto (a fonte de verdade, no formato padrão da ferramenta: PlantUML, Graphviz, Mermaid, DBML)
// e o modelo do quadro (cards, grupos e ligações), que é como ele aparece no canvas do CicloDev
export type Desenho = { tipo: string; aba: string; nome: string; formato: string; fonte: string; evidencias: Evidencia[]; lacunas: string[]; modelo: Modelo };
export type LerYaml = (texto: string) => unknown[];   // devolve os documentos do arquivo (YAML pode ter vários, separados por ---)

/* ================= leitor do pacote do GitHub (tar.gz) ================= */
const PASTAS_FORA = /(^|\/)(node_modules|bower_components|dist|build|out|\.next|\.nuxt|\.svelte-kit|\.output|\.vercel|\.turbo|\.cache|coverage|vendor|target|bin|obj|__pycache__|\.venv|venv|env|\.git|\.idea|\.vscode|\.gradle|Pods|DerivedData)\//;
const CODIGO = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|vue|svelte|py|go|java|kt|kts|cs)$/i;
const CONFIG = /(^|\/)(package\.json|tsconfig[^/]*\.json|jsconfig\.json|deno\.jsonc?|go\.mod|pom\.xml|build\.gradle(\.kts)?|settings\.gradle(\.kts)?|pyproject\.toml|setup\.py|[^/]+\.csproj|docker-compose[^/]*\.ya?ml|compose[^/]*\.ya?ml|Dockerfile[^/]*|[^/]+\.Dockerfile|[^/]+\.tf|vercel\.json|netlify\.toml|fly\.toml|render\.ya?ml|config\.toml|[^/]+\.prisma)$/i;
const YAML_K8S = /(^|\/)(k8s|kubernetes|kube|manifests|deploy|deployment|charts?)\/.*\.ya?ml$/i;
const WORKFLOW = /^\.github\/workflows\/[^/]+\.ya?ml$/i;

export function interessa(caminho: string, tamanho: number): boolean {
  if (tamanho > 400_000 || PASTAS_FORA.test(caminho)) return false;
  if (/\.min\.(js|css)$/i.test(caminho) || /(^|\/)(package-lock|yarn|pnpm-lock)\./i.test(caminho)) return false;
  return CODIGO.test(caminho) || CONFIG.test(caminho) || YAML_K8S.test(caminho) || WORKFLOW.test(caminho);
}

export type Pacote = { arquivos: Arquivos; caminhos: string[]; raiz: string; bytes: number; cortado: boolean };

// lê o tar.gz aos pedaços (sem pôr o pacote inteiro na memória) e guarda só o texto dos arquivos que interessam
export async function lerTarGz(corpo: ReadableStream<Uint8Array>, opcoes: { maxBytes?: number; maxArquivos?: number; maxTexto?: number } = {}): Promise<Pacote> {
  const maxBytes = opcoes.maxBytes ?? 400_000_000, maxArquivos = opcoes.maxArquivos ?? 6000, maxTexto = opcoes.maxTexto ?? 60_000_000;
  const leitor = corpo.pipeThrough(new DecompressionStream('gzip') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>).getReader();
  let pedacos: Uint8Array[] = [], tem = 0, bytes = 0, fim = false;
  const puxar = async () => { const r = await leitor.read(); if (r.done) { fim = true; return; } pedacos.push(r.value); tem += r.value.length; bytes += r.value.length; };
  const ler = async (n: number): Promise<Uint8Array | null> => {
    while (tem < n && !fim) await puxar();
    if (tem < n) return null;
    const out = new Uint8Array(n); let i = 0;
    while (i < n) { const p = pedacos[0], k = Math.min(p.length, n - i); out.set(p.subarray(0, k), i); i += k; if (k === p.length) pedacos.shift(); else pedacos[0] = p.subarray(k); }
    tem -= n; return out;
  };
  const pular = async (n: number) => {
    while (n > 0) { if (!pedacos.length) { await puxar(); if (fim && !pedacos.length) return; continue; } const p = pedacos[0], k = Math.min(p.length, n); if (k === p.length) pedacos.shift(); else pedacos[0] = p.subarray(k); tem -= k; n -= k; }
  };
  const txt = (b: Uint8Array, a: number, z: number) => { let e = a; while (e < z && b[e] !== 0) e++; return new TextDecoder().decode(b.subarray(a, e)); };
  const dec = new TextDecoder('utf-8', { fatal: true });
  const arquivos: Arquivos = new Map(), caminhos: string[] = [];
  let nomeLongo: string | null = null, raiz = '', texto = 0, cortado = false;
  while (true) {
    const h = await ler(512); if (!h) break;
    if (h.every(x => x === 0)) break;
    const tamanho = parseInt(txt(h, 124, 136).trim() || '0', 8) || 0, tipo = String.fromCharCode(h[156] || 48);
    const conteudo = Math.ceil(tamanho / 512) * 512;
    if (tipo === 'x' || tipo === 'L') {   // PAX ou GNU: o nome completo vem no bloco seguinte
      const b = await ler(conteudo); if (!b) break;
      const s = new TextDecoder().decode(b.subarray(0, tamanho));
      if (tipo === 'L') nomeLongo = s.replace(/\0+$/, ''); else { const m = s.match(/\d+ path=([^\n]*)\n/); if (m) nomeLongo = m[1]; }
      continue;
    }
    let nome = nomeLongo ?? ((txt(h, 257, 263).startsWith('ustar') && txt(h, 345, 500) ? txt(h, 345, 500) + '/' : '') + txt(h, 0, 100));
    nomeLongo = null;
    if (tipo === 'g') { await pular(conteudo); continue; }
    const barra = nome.indexOf('/');
    if (!raiz && barra > 0) raiz = nome.slice(0, barra);
    nome = barra >= 0 ? nome.slice(barra + 1) : nome;   // o GitHub põe tudo dentro de dono-repo-commit/
    if ((tipo === '0' || tipo === '\0') && nome) {
      if (caminhos.length < 60000) caminhos.push(nome);
      if (!cortado && interessa(nome, tamanho) && arquivos.size < maxArquivos && texto + tamanho <= maxTexto) {
        const b = await ler(conteudo); if (!b) break;
        try { const s = dec.decode(b.subarray(0, tamanho)); if (!s.includes('\0')) { arquivos.set(nome, s); texto += s.length; } } catch { /* não é texto */ }
      } else await pular(conteudo);
    } else await pular(conteudo);
    if (bytes > maxBytes) { cortado = true; break; }
  }
  try { await leitor.cancel(); } catch { /* já acabou */ }
  caminhos.sort();
  return { arquivos, caminhos, raiz, bytes, cortado };
}

/* ================= ajudas ================= */
const ordena = <T>(l: T[], f: (x: T) => string) => l.slice().sort((a, b) => { const x = f(a), y = f(b); return x < y ? -1 : x > y ? 1 : 0; });
const dirDe = (p: string) => p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
const juntar = (...ps: string[]) => { const out: string[] = []; for (const s of ps.join('/').split('/')) { if (!s || s === '.') continue; if (s === '..') out.pop(); else out.push(s); } return out.join('/'); };
const semComentariosJson = (s: string) => s.replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m, str) => str ?? '').replace(/,(\s*[}\]])/g, '$1');
function lerJson(s: string | undefined): any { if (!s) return null; try { return JSON.parse(s); } catch { try { return JSON.parse(semComentariosJson(s)); } catch { return null; } } }
const aspasPuml = (s: string) => String(s).replace(/"/g, "'").replace(/[\r\n]+/g, ' ');
const aspasDot = (s: string) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ');
const aspasMmd = (s: string) => String(s).replace(/"/g, '#quot;').replace(/[\r\n]+/g, ' ');
const plural = (n: number, um: string, varios: string) => n + ' ' + (n === 1 ? um : varios);
const curto = (s: string, n = 200) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const linhaCom = (conteudo: string, i: number) => { const a = conteudo.lastIndexOf('\n', i) + 1, z = conteudo.indexOf('\n', i); return curto(conteudo.slice(a, z < 0 ? undefined : z)); };

/* ================= 1. software: módulos e dependências ================= */
const RAIZ_PACOTE = /(^|\/)(package\.json|go\.mod|pom\.xml|build\.gradle(\.kts)?|pyproject\.toml|setup\.py|[^/]+\.csproj|deno\.jsonc?)$/i;
const NODE_NATIVOS = new Set('assert async_hooks buffer child_process cluster console constants crypto dgram diagnostics_channel dns domain events fs http http2 https inspector module net os path perf_hooks process punycode querystring readline repl stream string_decoder sys timers tls trace_events tty url util v8 vm wasi worker_threads zlib test'.split(' '));
const PY_NATIVOS = new Set('__future__ abc argparse array ast asyncio base64 bisect builtins bz2 calendar codecs collections concurrent configparser contextlib contextvars copy csv ctypes dataclasses datetime decimal difflib email enum errno fnmatch fractions functools gc getpass gettext glob gzip hashlib heapq hmac html http importlib inspect io ipaddress itertools json keyword locale logging lzma math mimetypes multiprocessing numbers operator os pathlib pickle platform pprint queue random re secrets select selectors shlex shutil signal socket sqlite3 ssl stat statistics string struct subprocess sys tarfile tempfile textwrap threading time timeit traceback types typing unicodedata unittest urllib uuid warnings weakref xml zipfile zoneinfo'.split(' '));

type Modulo = { id: string; nome: string; pacote: string; arquivos: number };

function raizesDePacote(arq: Arquivos): string[] {
  const r = new Set<string>(['']);
  for (const p of arq.keys()) if (RAIZ_PACOTE.test(p)) r.add(dirDe(p));
  for (const p of arq.keys()) { const m = p.match(/^(.*\/)?supabase\/functions\/([^/_][^/]*)\//); if (m) r.add((m[1] || '') + 'supabase/functions/' + m[2]); }
  return [...r].sort((a, b) => b.length - a.length);   // a mais funda primeiro
}
const raizDe = (p: string, raizes: string[]) => raizes.find(r => r === '' || p === r || p.startsWith(r + '/')) ?? '';
const tirarRaiz = (p: string, r: string) => r ? p.slice(r.length + 1) : p;
const PREFIXOS_FONTE = [/^src\/main\/(java|kotlin|scala)\//, /^src\/test\/(java|kotlin|scala)\//, /^src\//, /^lib\//];

// cada arquivo cai num módulo: a raiz do pacote (se houver mais de uma) + a primeira pasta que separa os arquivos dele
function montarModulos(fontes: string[], raizes: string[], agrupar: boolean): Map<string, Modulo> {
  const porRaiz = new Map<string, string[]>();
  for (const p of fontes) { const r = raizDe(p, raizes); (porRaiz.get(r) || porRaiz.set(r, []).get(r)!).push(p); }
  const usadas = [...porRaiz.keys()], varias = usadas.length > 1;
  const mapa = new Map<string, Modulo>();
  for (const [r, lista] of porRaiz) {
    const rel = lista.map(p => { let x = tirarRaiz(p, r); for (const re of PREFIXOS_FONTE) if (re.test(x)) { x = x.replace(re, ''); break; } return x; });
    // o começo de pasta comum a todos (no Java, com/empresa/app) não separa nada
    const dirs = rel.map(x => dirDe(x).split('/').filter(Boolean));
    let comum: string[] = dirs.length ? dirs[0].slice() : [];
    for (const d of dirs) { let i = 0; while (i < comum.length && i < d.length && comum[i] === d[i]) i++; comum = comum.slice(0, i); }
    if (dirs.every(d => d.length === comum.length) && comum.length) comum = comum.slice(0, -1);
    lista.forEach((p, i) => {
      const resto = dirs[i].slice(comum.length);
      const grupo = agrupar ? (resto[0] || '') : '';
      // as Edge Functions do Supabase ficam juntas numa caixa só, cada uma com o próprio nome
      const funcao = r.match(/^(.*\/)?supabase\/functions\/([^/]+)$/);
      const nomeRaiz = funcao ? (funcao[1] || '') + 'supabase/functions' : r || '(raiz)';
      const nome = funcao ? funcao[2] + (grupo ? '/' + grupo : '') : !varias || !r ? (grupo || (comum.length ? comum[comum.length - 1] : '(raiz)')) : grupo ? r + '/' + grupo : r;
      const id = (r || '.') + '|' + grupo;
      const m = mapa.get(id) || { id, nome, pacote: nomeRaiz, arquivos: 0 };
      m.arquivos++; mapa.set(id, m); mapa.set('arq:' + p, m);
    });
  }
  return mapa;
}

function aliasesDe(arq: Arquivos, raiz: string): [string, string][] {
  const out: [string, string][] = [];
  for (const n of ['tsconfig.json', 'jsconfig.json', 'tsconfig.app.json', 'tsconfig.base.json']) {
    const j = lerJson(arq.get(juntar(raiz, n))); const co = j && j.compilerOptions; if (!co) continue;
    const base = juntar(raiz, co.baseUrl || '.');
    for (const [k, v] of Object.entries(co.paths || {})) { const alvo = Array.isArray(v) ? String(v[0] || '') : ''; if (!alvo) continue; out.push([k.replace(/\*$/, ''), juntar(base, alvo.replace(/\*$/, ''))]); }
  }
  if (!out.some(([k]) => k === '@/')) out.push(['@/', juntar(raiz, arq.has(juntar(raiz, 'src')) || [...arq.keys()].some(p => p.startsWith(juntar(raiz, 'src') + '/')) ? 'src' : '')]);
  if (!out.some(([k]) => k === '~/')) out.push(['~/', juntar(raiz, 'src')]);
  return out.sort((a, b) => b[0].length - a[0].length);
}
const EXT_JS = ['', '.ts', '.tsx', '.mts', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte', '/index.ts', '/index.tsx', '/index.js', '/index.jsx', '/index.mjs'];
function resolverJs(alvo: string, arq: Arquivos): string | null {
  for (const e of EXT_JS) if (arq.has(alvo + e)) return alvo + e;
  const semExt = alvo.replace(/\.(js|jsx|mjs|cjs)$/, '');
  if (semExt !== alvo) for (const e of EXT_JS) if (arq.has(semExt + e)) return semExt + e;
  return null;
}
function nomeBiblioteca(spec: string): string | null {
  let s = spec.trim();
  if (/^(node:|bun:|data:|#|\$|virtual:|\\0)/.test(s)) return null;
  if (/^(npm|jsr):/.test(s)) s = s.replace(/^(npm|jsr):\/?/, '');
  else if (/^https?:\/\//.test(s)) {
    const u = s.replace(/^https?:\/\//, '').split('/');
    if (/deno\.land$/.test(u[0]) && u[1] === 'x') return (u[2] || '').split('@')[0] || null;
    if (/deno\.land$/.test(u[0]) && u[1]?.startsWith('std')) return 'deno std';
    if (/^(esm\.sh|cdn\.skypack\.dev|unpkg\.com|cdn\.jsdelivr\.net)$/.test(u[0])) { const r = u[0] === 'cdn.jsdelivr.net' ? u.slice(2) : u.slice(1); s = r.join('/'); }
    else return u[0];
  }
  const partes = s.split('/');
  const limpo = s.startsWith('@') ? (partes[1] ? partes[0] + '/' + partes[1].split('@')[0] : '') : partes[0].split('@')[0];
  if (!limpo || NODE_NATIVOS.has(limpo)) return null;
  return limpo;
}

type Ligacao = { de: string; para: string; exemplo: Evidencia };
export function gerarSoftware(arq: Arquivos, repo: string): Desenho | null {
  const fontes = [...arq.keys()].filter(p => CODIGO.test(p) && !/\.(d\.ts)$/.test(p) && !/(^|\/)(__tests__|tests?|spec|e2e|cypress|playwright)\//i.test(p) && !/\.(test|spec)\.[a-z]+$/i.test(p)).sort();
  if (!fontes.length) return null;
  const raizes = raizesDePacote(arq);
  let mods = montarModulos(fontes, raizes, true);
  let qtd = new Set([...mods.entries()].filter(([k]) => !k.startsWith('arq:')).map(([, m]) => m.id)).size;
  let agrupado = false;
  if (qtd > 45) { mods = montarModulos(fontes, raizes, false); agrupado = true; qtd = new Set([...mods.entries()].filter(([k]) => !k.startsWith('arq:')).map(([, m]) => m.id)).size; }
  const modDe = (p: string) => mods.get('arq:' + p);
  // nomes de pacote do monorepo (package.json "name") apontam para a raiz dele
  const pacotesJs = new Map<string, string>();
  for (const r of raizes) { const j = lerJson(arq.get(juntar(r, 'package.json'))); if (j && typeof j.name === 'string' && r) pacotesJs.set(j.name, r); }
  const goMods: [string, string][] = [];
  for (const r of raizes) { const g = arq.get(juntar(r, 'go.mod')); const m = g && g.match(/^module\s+(\S+)/m); if (m) goMods.push([m[1], r]); }
  // Java, Kotlin e C#: o pacote (ou namespace) declarado em cada arquivo
  const pacoteJava = new Map<string, string>();
  for (const p of fontes) {
    const c = arq.get(p)!;
    if (/\.(java|kt|kts)$/i.test(p)) { const m = c.match(/^\s*package\s+([\w.]+)/m); if (m && !pacoteJava.has(m[1])) pacoteJava.set(m[1], p); }
    if (/\.cs$/i.test(p)) for (const m of c.matchAll(/^\s*namespace\s+([\w.]+)/gm)) if (!pacoteJava.has(m[1])) pacoteJava.set(m[1], p);
  }
  const ligacoes = new Map<string, Ligacao & { n: number }>();
  const libs = new Map<string, { usos: number; modulos: Set<string>; exemplo: Evidencia }>();
  const ligar = (de: Modulo | undefined, para: Modulo | undefined, arquivo: string, trecho: string) => {
    if (!de || !para || de.id === para.id) return;
    const k = de.id + '→' + para.id, l = ligacoes.get(k);
    if (l) l.n++; else ligacoes.set(k, { de: de.id, para: para.id, n: 1, exemplo: { fonte: repo + '/' + arquivo, trecho } });
  };
  const usarLib = (de: Modulo | undefined, nome: string, arquivo: string, trecho: string) => {
    if (!de) return; const l = libs.get(nome) || { usos: 0, modulos: new Set<string>(), exemplo: { fonte: repo + '/' + arquivo, trecho } };
    l.usos++; l.modulos.add(de.id); libs.set(nome, l);
  };
  for (const p of fontes) {
    const c = arq.get(p)!, de = modDe(p), raiz = raizDe(p, raizes);
    if (/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|vue|svelte)$/i.test(p)) {
      const als = aliasesDe(arq, raiz);
      const res = [/(?:^|[;\s}])import\s+(?:type\s+)?(?:[\w*{}\s,$]+?\s+from\s+)?['"]([^'"\n]+)['"]/g, /(?:^|[;\s])export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s*(?:as\s+\w+\s*)?from\s+['"]([^'"\n]+)['"]/g,
                   /\bimport\(\s*['"]([^'"\n]+)['"]\s*\)/g, /\brequire\(\s*['"]([^'"\n]+)['"]\s*\)/g];
      for (const re of res) for (const m of c.matchAll(re)) {
        const spec = m[1], trecho = linhaCom(c, m.index! + m[0].indexOf(spec));
        let alvo: string | null = null;
        if (spec.startsWith('.')) alvo = resolverJs(juntar(dirDe(p), spec), arq);
        else { const a = als.find(([k]) => spec.startsWith(k) && k); if (a) alvo = resolverJs(juntar(a[1], spec.slice(a[0].length)), arq); }
        if (alvo) { ligar(de, modDe(alvo), p, trecho); continue; }
        if (spec.startsWith('.') || spec.startsWith('/')) continue;
        const lib = nomeBiblioteca(spec); if (!lib) continue;
        const interno = pacotesJs.get(lib);
        if (interno !== undefined) { const alvoMod = fontes.find(f => f.startsWith(interno + '/')); ligar(de, alvoMod ? modDe(alvoMod) : undefined, p, trecho); continue; }
        usarLib(de, lib, p, trecho);
      }
    } else if (/\.py$/i.test(p)) {
      for (const m of c.matchAll(/^[ \t]*from\s+(\.*)([\w.]*)\s+import\s+([\w*, ()]+)/gm)) {
        const pontos = m[1].length, mod = m[2], trecho = linhaCom(c, m.index!);
        const cand: string[] = [];
        if (pontos) { let base = dirDe(p); for (let i = 1; i < pontos; i++) base = dirDe(base); cand.push(juntar(base, mod.replace(/\./g, '/'))); }
        else for (const b of [dirDe(p), raiz, juntar(raiz, 'src'), '']) cand.push(juntar(b, mod.replace(/\./g, '/')));
        const achou = cand.map(x => arq.has(x + '.py') ? x + '.py' : arq.has(x + '/__init__.py') ? x + '/__init__.py' : null).find(Boolean);
        if (achou) ligar(de, modDe(achou), p, trecho);
        else if (!pontos) { const top = mod.split('.')[0]; if (top && !PY_NATIVOS.has(top)) usarLib(de, top, p, trecho); }
      }
      for (const m of c.matchAll(/^[ \t]*import\s+([\w., \t]+)$/gm)) for (const nome of m[1].split(',').map(x => x.trim().split(/\s+/)[0]).filter(Boolean)) {
        const trecho = linhaCom(c, m.index!);
        const achou = [dirDe(p), raiz, juntar(raiz, 'src'), ''].map(b => juntar(b, nome.replace(/\./g, '/'))).map(x => arq.has(x + '.py') ? x + '.py' : arq.has(x + '/__init__.py') ? x + '/__init__.py' : null).find(Boolean);
        if (achou) ligar(de, modDe(achou), p, trecho); else { const top = nome.split('.')[0]; if (!PY_NATIVOS.has(top)) usarLib(de, top, p, trecho); }
      }
    } else if (/\.go$/i.test(p)) {
      const specs: [string, number][] = [];
      for (const m of c.matchAll(/^import\s+(?:[\w.]+\s+)?"([^"]+)"/gm)) specs.push([m[1], m.index!]);
      for (const b of c.matchAll(/^import\s*\(([\s\S]*?)\)/gm)) for (const m of b[1].matchAll(/(?:[\w.]+\s+)?"([^"]+)"/g)) specs.push([m[1], b.index! + (m.index || 0)]);
      for (const [spec, i] of specs) {
        const trecho = linhaCom(c, i);
        const gm = goMods.find(([mod]) => spec === mod || spec.startsWith(mod + '/'));
        if (gm) { const dir = juntar(gm[1], spec.slice(gm[0].length)); const alvo = fontes.find(f => dirDe(f) === dir && f.endsWith('.go')); ligar(de, alvo ? modDe(alvo) : undefined, p, trecho); }
        else if (spec.includes('.')) usarLib(de, spec.split('/').slice(0, 3).join('/'), p, trecho);
      }
    } else if (/\.(java|kt|kts|cs)$/i.test(p)) {
      const cs = /\.cs$/i.test(p);
      const re = cs ? /^\s*using\s+(?:static\s+)?([\w.]+)\s*;/gm : /^\s*import\s+(?:static\s+)?([\w.]+)(?:\.\*)?\s*;?\s*$/gm;
      for (const m of c.matchAll(re)) {
        let nome = m[1]; const trecho = linhaCom(c, m.index!);
        if (cs ? /^System(\.|$)/.test(nome) : /^(java|kotlin)\./.test(nome)) continue;
        let alvo: string | undefined; let x = nome;
        while (x && !(alvo = pacoteJava.get(x))) x = x.includes('.') ? x.slice(0, x.lastIndexOf('.')) : '';
        if (alvo && x.split('.').length >= 2) ligar(de, modDe(alvo), p, trecho);
        else { const partes = nome.split('.'); usarLib(de, partes.slice(0, Math.min(partes.length - (/^[A-Z]/.test(partes[partes.length - 1]) ? 1 : 0), 2)).join('.') || partes[0], p, trecho); }
      }
    }
  }
  const lista = ordena([...new Map([...mods.entries()].filter(([k]) => !k.startsWith('arq:')).map(([, m]) => [m.id, m])).values()], m => m.pacote + '|' + m.nome);
  const idPuml = new Map(lista.map((m, i) => [m.id, 'M' + (i + 1)]));
  const topLibs = ordena([...libs.entries()], ([n]) => n).sort((a, b) => b[1].modulos.size - a[1].modulos.size || b[1].usos - a[1].usos).slice(0, 15);
  const ligLibs = topLibs.reduce((s, [, l]) => s + l.modulos.size, 0);
  const pacotes = ordena([...new Set(lista.map(m => m.pacote))], x => x);
  const varios = pacotes.length > 1;
  const L: string[] = ['@startuml', 'left to right direction', 'skinparam componentStyle rectangle', 'skinparam shadowing false', 'skinparam packageStyle rectangle',
    'title Arquitetura de Software · ' + aspasPuml(repo)];
  for (const pc of pacotes) {
    const doPacote = lista.filter(m => m.pacote === pc);
    if (varios) L.push('package "' + aspasPuml(pc) + '" {');
    for (const m of doPacote) L.push((varios ? '  ' : '') + 'component "' + aspasPuml(m.nome) + '\\n' + plural(m.arquivos, 'arquivo', 'arquivos') + '" as ' + idPuml.get(m.id));
    if (varios) L.push('}');
  }
  if (topLibs.length) {
    L.push('package "Bibliotecas de fora" {');
    topLibs.forEach(([n], i) => L.push('  component "' + aspasPuml(n) + '" as L' + (i + 1)));
    L.push('}');
  }
  const ligs = ordena([...ligacoes.values()], l => idPuml.get(l.de)! + idPuml.get(l.para)!);
  for (const l of ligs) L.push(idPuml.get(l.de) + ' --> ' + idPuml.get(l.para) + ' : ' + l.n);
  if (topLibs.length && ligLibs <= 40) topLibs.forEach(([, l], i) => ordena([...l.modulos], x => idPuml.get(x)!).forEach(m => L.push(idPuml.get(m) + ' ..> L' + (i + 1))));
  else if (topLibs.length) L.push('note bottom of L1', '  As ligações com as bibliotecas foram omitidas (são muitas).', 'end note');
  L.push('@enduml');
  const evid: Evidencia[] = [{ fonte: repo, trecho: fontes.length + ' arquivos de código lidos em ' + plural(lista.length, 'módulo', 'módulos') + (agrupado ? ' (juntados por pacote: eram mais de 45 pastas)' : '') }];
  ligs.slice().sort((a, b) => b.n - a.n).slice(0, 30).forEach(l => evid.push({ fonte: l.exemplo.fonte, trecho: l.exemplo.trecho }));
  topLibs.slice(0, 10).forEach(([n, l]) => evid.push({ fonte: l.exemplo.fonte, trecho: n + ': usado em ' + plural(l.modulos.size, 'módulo', 'módulos') }));
  const lac: string[] = [];
  if (!ligs.length) lac.push('Não achei nenhum módulo importando outro: pode ser um projeto de um arquivo só ou uma linguagem que o robô ainda não lê.');
  if (fontes.some(p => /\.(rb|php|rs|swift|dart|scala)$/i.test(p))) lac.push('Há arquivos numa linguagem que o robô ainda não lê as ligações (Ruby, PHP, Rust, Swift, Dart ou Scala).');
  // no quadro: cada pacote é um grupo, cada módulo um card (com a linguagem e quantos arquivos), a seta diz quantas importações
  const LINGUA: Record<string, string> = { ts: 'TypeScript', tsx: 'TypeScript', mts: 'TypeScript', cts: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', vue: 'Vue', svelte: 'Svelte', py: 'Python', go: 'Go', java: 'Java', kt: 'Kotlin', kts: 'Kotlin', cs: 'C#' };
  const lingua = new Map<string, Map<string, number>>();
  for (const p of fontes) { const m = modDe(p); if (!m) continue; const lg = LINGUA[(p.split('.').pop() || '').toLowerCase()] || ''; const mm = lingua.get(m.id) || new Map<string, number>(); mm.set(lg, (mm.get(lg) || 0) + 1); lingua.set(m.id, mm); }
  const linguaDe = (id: string) => { const mm = lingua.get(id); return mm ? [...mm.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0] : ''; };
  const comLibs = topLibs.length > 0 && ligLibs <= 40;
  const modelo: Modelo = {
    titulo: 'Arquitetura de Software · ' + repo, layout: 'camadas',
    resumo: fontes.length + ' arquivos de código em ' + plural(lista.length, 'módulo', 'módulos') + (agrupado ? ' (juntados por pacote: eram mais de 45 pastas)' : '') + '. Cada seta é um módulo que importa outro; o número é quantas importações.',
    legenda: ['Seta cheia: importa (o número é quantas importações)', 'Seta tracejada: usa a biblioteca de fora', 'Card de módulo: a pasta do código, com a linguagem e o número de arquivos'],
    grupos: [...pacotes.map(pc => ({ id: 'pc:' + pc, titulo: pc === '(raiz)' && !varios ? repo : pc })), ...(topLibs.length ? [{ id: 'libs', titulo: 'Bibliotecas de fora', cor: 'cinza' }] : [])],
    cards: [...lista.map(m => ({ id: m.id, grupo: 'pc:' + m.pacote, tipo: 'modulo' as const, titulo: m.nome, subtitulo: plural(m.arquivos, 'arquivo', 'arquivos'), etiquetas: linguaDe(m.id) ? [linguaDe(m.id)] : [],
        topicos: comLibs ? [] : topLibs.filter(([, l]) => l.modulos.has(m.id)).map(([n]) => 'usa ' + n).slice(0, 6) })),
      ...topLibs.map(([n, l]) => ({ id: 'lib:' + n, grupo: 'libs', tipo: 'servico' as const, icone: 'api', rotuloTipo: 'BIBLIOTECA', titulo: n, subtitulo: 'usada em ' + plural(l.modulos.size, 'módulo', 'módulos'), cor: 'cinza' }))],
    ligacoes: [...ligs.map(l => ({ de: l.de, para: l.para, rotulo: l.n + (l.n === 1 ? ' importação' : ' importações') })),
      ...(comLibs ? topLibs.flatMap(([n, l]) => ordena([...l.modulos], x => x).map(m => ({ de: m, para: 'lib:' + n, tracejada: true, fim: 'aberta' as const }))) : [])],
  };
  return { tipo: 'software', aba: 'software', nome: 'Software · ' + repo, formato: 'plantuml', fonte: L.join('\n') + '\n', evidencias: evid, lacunas: lac, modelo };
}

/* ================= 2. infraestrutura ================= */
type NoInfra = { id: string; rotulo: string; forma?: string; grupo: string; cor?: string };
type LigInfra = { de: string; para: string; rotulo: string };
function blocosTerraform(c: string): { tipo: string; nome: string; corpo: string; i: number }[] {
  const out: { tipo: string; nome: string; corpo: string; i: number }[] = [];
  const re = /^(resource|data)\s+"([\w-]+)"\s+"([\w-]+)"\s*\{|^module\s+"([\w-]+)"\s*\{/gm;
  for (const m of c.matchAll(re)) {
    let prof = 1, j = m.index! + m[0].length, dentro: string | null = null;
    for (; j < c.length && prof > 0; j++) {
      const ch = c[j];
      if (dentro) { if (ch === '\\') { j++; continue; } if (ch === dentro) dentro = null; continue; }
      if (ch === '"') dentro = '"'; else if (ch === '#' || (ch === '/' && c[j + 1] === '/')) { const z = c.indexOf('\n', j); j = z < 0 ? c.length : z; }
      else if (ch === '{') prof++; else if (ch === '}') prof--;
    }
    const corpo = c.slice(m.index! + m[0].length, j - 1);
    if (m[4]) out.push({ tipo: 'module', nome: m[4], corpo, i: m.index! });
    else out.push({ tipo: (m[1] === 'data' ? 'data.' : '') + m[2], nome: m[3], corpo, i: m.index! });
  }
  return out;
}
const PROVEDORES_TF: [RegExp, string][] = [[/^(data\.)?aws_/, 'AWS'], [/^(data\.)?google_/, 'Google Cloud'], [/^(data\.)?azurerm_/, 'Azure'], [/^(data\.)?cloudflare_/, 'Cloudflare'], [/^(data\.)?vercel_/, 'Vercel'],
  [/^(data\.)?supabase_/, 'Supabase'], [/^(data\.)?digitalocean_/, 'DigitalOcean'], [/^(data\.)?kubernetes_/, 'Kubernetes'], [/^(data\.)?helm_/, 'Kubernetes'], [/^(data\.)?github_/, 'GitHub'], [/^module$/, 'Módulos']];
const ALVOS_ACAO: [RegExp, string][] = [
  [/amondnet\/vercel-action|\bvercel\s+(deploy|--prod|build)/i, 'Vercel'], [/supabase\/setup-cli|\bsupabase\s+(functions\s+deploy|db\s+push|link)/i, 'Supabase'],
  [/docker\/build-push-action|\bdocker\s+push\b/i, 'Registro de imagens'], [/aws-actions\/|\baws\s+(s3|ecs|lambda|deploy|cloudformation)\b/i, 'AWS'],
  [/google-github-actions\/|\bgcloud\s+(run|app|functions)\s+deploy/i, 'Google Cloud'], [/azure\/(webapps-deploy|login|functions-action)/i, 'Azure'],
  [/hashicorp\/setup-terraform|\bterraform\s+apply\b/i, 'Terraform'], [/superfly\/flyctl-actions|\bflyctl\s+deploy|\bfly\s+deploy/i, 'Fly.io'],
  [/cloudflare\/(wrangler-action|pages-action)|\bwrangler\s+(deploy|publish|pages)/i, 'Cloudflare'], [/peaceiris\/actions-gh-pages|actions\/deploy-pages/i, 'GitHub Pages'],
  [/appleboy\/(ssh|scp)-action|\b(ssh|rsync|scp)\s+[^\n]*@/i, 'Servidor (SSH)'], [/netlify\/actions|\bnetlify\s+deploy/i, 'Netlify'], [/render-deploy|api\.render\.com\/deploy/i, 'Render'],
  [/\bkubectl\s+(apply|set|rollout)|azure\/k8s-deploy|helm\s+upgrade/i, 'Kubernetes'], [/\bnpm\s+publish\b|JS-DevTools\/npm-publish/i, 'npm']];

export function gerarInfra(arq: Arquivos, caminhos: string[], repo: string, yaml: LerYaml): Desenho | null {
  const nos = new Map<string, NoInfra>(), ligs: LigInfra[] = [], evid: Evidencia[] = [], lac: string[] = [];
  const no = (id: string, rotulo: string, grupo: string, forma?: string, cor?: string) => { if (!nos.has(id)) nos.set(id, { id, rotulo, grupo, forma, cor }); return id; };
  const liga = (de: string, para: string, rotulo: string) => { if (de !== para && !ligs.some(l => l.de === de && l.para === para && l.rotulo === rotulo)) ligs.push({ de, para, rotulo }); };
  const paths = [...arq.keys()].sort();
  const repoNo = no('repo', 'Repositório\n' + repo, '', 'folder');
  // Docker Compose
  for (const p of paths.filter(x => /(^|\/)(docker-)?compose[^/]*\.ya?ml$/i.test(x))) {
    let doc: any; try { doc = yaml(arq.get(p)!)[0]; } catch (e) { lac.push('Não deu para ler ' + p + ': ' + (e as Error).message); continue; }
    const svcs = doc && typeof doc === 'object' ? doc.services : null; if (!svcs || typeof svcs !== 'object') continue;
    const g = 'Docker Compose (' + p + ')';
    evid.push({ fonte: repo + '/' + p, trecho: 'serviços: ' + Object.keys(svcs).sort().join(', ') });
    for (const nome of Object.keys(svcs).sort()) {
      const s = svcs[nome] || {};
      const img = typeof s.image === 'string' ? s.image : s.build ? 'build: ' + (typeof s.build === 'string' ? s.build : s.build.context || '.') : '';
      const portas = Array.isArray(s.ports) ? s.ports.map((x: any) => typeof x === 'object' ? (x.published ?? '') + ':' + (x.target ?? '') : String(x)).join(', ') : '';
      no('svc:' + p + ':' + nome, nome + (img ? '\n' + img : '') + (portas ? '\nportas ' + portas : ''), g, 'box3d');
      const dep = Array.isArray(s.depends_on) ? s.depends_on : s.depends_on && typeof s.depends_on === 'object' ? Object.keys(s.depends_on) : [];
      for (const d of dep.map(String).sort()) liga('svc:' + p + ':' + nome, 'svc:' + p + ':' + d, 'depende de');
      for (const d of (Array.isArray(s.links) ? s.links : []).map((x: string) => String(x).split(':')[0]).sort()) liga('svc:' + p + ':' + nome, 'svc:' + p + ':' + d, 'usa');
      for (const v of (Array.isArray(s.volumes) ? s.volumes : [])) {
        const origem = typeof v === 'string' ? v.split(':')[0] : v && v.source; if (!origem || /^[./~$]/.test(origem)) continue;
        liga('svc:' + p + ':' + nome, no('vol:' + p + ':' + origem, 'volume ' + origem, g, 'cylinder'), 'grava em');
      }
      if (s.build) { const ctx = juntar(dirDe(p), typeof s.build === 'string' ? s.build : s.build.context || '.'); const df = juntar(ctx, typeof s.build === 'object' && s.build.dockerfile ? s.build.dockerfile : 'Dockerfile'); if (arq.has(df)) liga('img:' + df, 'svc:' + p + ':' + nome, 'monta'); }
    }
  }
  // Dockerfile
  for (const p of paths.filter(x => /(^|\/)(Dockerfile[^/]*|[^/]+\.Dockerfile)$/i.test(x))) {
    const c = arq.get(p)!, froms = [...c.matchAll(/^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)/gim)].map(m => m[1]);
    const expo = [...c.matchAll(/^\s*EXPOSE\s+(.+)$/gim)].map(m => m[1].trim()).join(' ');
    if (!froms.length) continue;
    no('img:' + p, 'Imagem Docker\n' + p + '\nbase ' + froms[froms.length - 1] + (expo ? '\nporta ' + expo : ''), 'Docker', 'box3d');
    evid.push({ fonte: repo + '/' + p, trecho: 'FROM ' + froms.join(' → ') + (expo ? ' · EXPOSE ' + expo : '') });
  }
  // Terraform
  const tfs = paths.filter(x => x.endsWith('.tf'));
  if (tfs.length) {
    const blocos = tfs.flatMap(p => blocosTerraform(arq.get(p)!).map(b => ({ ...b, p })));
    const ids = new Map(blocos.map(b => [b.tipo === 'module' ? 'module.' + b.nome : b.tipo + '.' + b.nome, b]));
    for (const [id, b] of ids) {
      const prov = (PROVEDORES_TF.find(([re]) => re.test(b.tipo)) || [null, 'Terraform'])[1];
      const src = b.tipo === 'module' ? (b.corpo.match(/^\s*source\s*=\s*"([^"]+)"/m) || [])[1] : '';
      no('tf:' + id, (b.tipo === 'module' ? 'módulo ' + b.nome + (src ? '\n' + src : '') : b.tipo.replace(/^data\./, 'dado ') + '\n' + b.nome), 'Terraform · ' + prov, b.tipo.startsWith('data.') ? 'note' : 'box');
    }
    for (const [id, b] of ids) for (const m of b.corpo.matchAll(/\b((?:data\.)?[a-z][a-z0-9_]*\.[A-Za-z_][\w-]*|module\.[\w-]+)\b/g)) if (ids.has(m[1]) && m[1] !== id) liga('tf:' + id, 'tf:' + m[1], 'usa');
    evid.push({ fonte: repo, trecho: 'Terraform: ' + plural(blocos.length, 'bloco', 'blocos') + ' em ' + tfs.join(', ') });
  }
  // Kubernetes
  const k8sObjs: any[] = [];
  for (const p of paths.filter(x => YAML_K8S.test(x))) { let docs: unknown[] = []; try { docs = yaml(arq.get(p)!); } catch { continue; } for (const d of docs as any[]) if (d && typeof d === 'object' && d.kind && d.metadata?.name) k8sObjs.push({ ...d, __p: p }); }
  for (const o of ordena(k8sObjs, o => o.kind + o.metadata.name)) if (/^(Deployment|StatefulSet|DaemonSet|Service|Ingress|CronJob|Job)$/.test(o.kind)) no('k8s:' + o.kind + ':' + o.metadata.name, o.kind + '\n' + o.metadata.name, 'Kubernetes', o.kind === 'Service' ? 'ellipse' : 'box');
  for (const s of k8sObjs.filter(o => o.kind === 'Service' && o.spec?.selector)) for (const d of k8sObjs.filter(o => /^(Deployment|StatefulSet|DaemonSet)$/.test(o.kind)))
    if (Object.entries(s.spec.selector).every(([k, v]) => d.spec?.template?.metadata?.labels?.[k] === v)) liga('k8s:Service:' + s.metadata.name, 'k8s:' + d.kind + ':' + d.metadata.name, 'encaminha');
  for (const i of k8sObjs.filter(o => o.kind === 'Ingress')) for (const r of (i.spec?.rules || [])) for (const pa of (r.http?.paths || [])) { const sv = pa.backend?.service?.name || pa.backend?.serviceName; if (sv) liga('k8s:Ingress:' + i.metadata.name, 'k8s:Service:' + sv, (r.host || '') + (pa.path || '')); }
  if (k8sObjs.length) evid.push({ fonte: repo, trecho: 'Kubernetes: ' + k8sObjs.map(o => o.kind + ' ' + o.metadata.name).sort().join(', ') });
  // Vercel, Netlify, Fly, Render
  for (const p of paths.filter(x => /(^|\/)vercel\.json$/.test(x))) {
    const j = lerJson(arq.get(p)) || {}, id = no('vercel:' + p, 'Vercel' + (dirDe(p) ? '\n' + dirDe(p) : '') + (j.framework ? '\n' + j.framework : ''), 'Vercel', 'box');
    for (const c of (Array.isArray(j.crons) ? j.crons : [])) liga(no('vcron:' + p + c.path, 'rotina ' + c.schedule + '\n' + c.path, 'Vercel', 'note'), id, 'chama');
    for (const r of [...(Array.isArray(j.rewrites) ? j.rewrites : []), ...(Array.isArray(j.redirects) ? j.redirects : [])]) { const m = String(r.destination || '').match(/^https?:\/\/([^/]+)/); if (m) liga(id, no('ext:' + m[1], m[1], 'Serviços de fora', 'oval'), 'repassa ' + (r.source || '')); }
    evid.push({ fonte: repo + '/' + p, trecho: curto(arq.get(p)!, 300) });
  }
  for (const [re, nome] of [[/(^|\/)netlify\.toml$/, 'Netlify'], [/(^|\/)fly\.toml$/, 'Fly.io'], [/(^|\/)render\.ya?ml$/, 'Render']] as [RegExp, string][]) for (const p of paths.filter(x => re.test(x))) {
    const c = arq.get(p)!, app = (c.match(/^\s*app\s*=\s*["']([^"']+)/m) || [])[1];
    no('host:' + p, nome + (app ? '\n' + app : '') + (dirDe(p) ? '\n' + dirDe(p) : ''), nome, 'box');
    if (nome === 'Render') { try { const d: any = yaml(c)[0]; for (const s of (d?.services || [])) no('render:' + s.name, 'Render ' + (s.type || '') + '\n' + s.name, 'Render', 'box'); } catch { /* segue */ } }
    evid.push({ fonte: repo + '/' + p, trecho: curto(c, 200) });
  }
  // Supabase
  const funcoes = [...new Set(caminhos.map(x => x.match(/^(?:.*\/)?supabase\/functions\/([^/_][^/]*)\/index\.(ts|js)$/)).filter(Boolean).map(m => m![0]))].sort();
  const migr = caminhos.filter(x => /(^|\/)supabase\/migrations\/[^/]+\.sql$/.test(x));
  const cfg = paths.find(x => /(^|\/)supabase\/config\.toml$/.test(x));
  if (funcoes.length || migr.length || cfg) {
    const pid = cfg ? (arq.get(cfg)!.match(/^\s*project_id\s*=\s*"([^"]+)"/m) || [])[1] : '';
    const pg = no('sb:pg', 'Postgres' + (migr.length ? '\n' + plural(migr.length, 'migração', 'migrações') : ''), 'Supabase' + (pid ? ' · ' + pid : ''), 'cylinder');
    for (const f of funcoes) {
      const nome = f.replace(/^(?:.*\/)?supabase\/functions\//, '').replace(/\/index\.(ts|js)$/, ''), c = arq.get(f) || '';
      const id = no('sb:fn:' + nome, 'Edge Function\n' + nome, 'Supabase' + (pid ? ' · ' + pid : ''), 'component');
      if (/createClient\s*\(|\.from\(\s*['"]|\.rpc\(\s*['"]/.test(c)) liga(id, pg, 'lê e grava');
      for (const m of c.matchAll(/fetch\(\s*[`'"]https?:\/\/([^/`'"$]+)/g)) liga(id, no('ext:' + m[1], m[1], 'Serviços de fora', 'oval'), 'chama');
    }
    evid.push({ fonte: repo, trecho: 'Supabase: ' + plural(funcoes.length, 'Edge Function', 'Edge Functions') + (migr.length ? ', ' + plural(migr.length, 'migração', 'migrações') : '') + (cfg ? ', ' + cfg : '') });
  }
  // GitHub Actions: para onde cada fluxo publica
  for (const p of paths.filter(x => WORKFLOW.test(x))) {
    let w: any; try { w = yaml(arq.get(p)!)[0]; } catch { continue; } if (!w || typeof w !== 'object') continue;
    const c = arq.get(p)!, alvos = ALVOS_ACAO.filter(([re]) => re.test(c)).map(([, n]) => n);
    const gat = w.on ?? w[true as unknown as string];
    const quando = typeof gat === 'string' ? gat : Array.isArray(gat) ? gat.join(', ') : gat && typeof gat === 'object' ? Object.keys(gat).join(', ') : '';
    const id = no('gha:' + p, 'GitHub Actions\n' + (w.name || p.split('/').pop()) + (quando ? '\nquando: ' + quando : ''), 'GitHub Actions', 'box');
    liga(repoNo, id, 'dispara');
    for (const a of [...new Set(alvos)].sort()) {
      const grupo = ordena([...new Set([...nos.values()].map(n => n.grupo))], x => x).find(g => g === a || g.startsWith(a + ' ') || (a === 'Terraform' && g.startsWith('Terraform · ')));
      liga(id, grupo ? 'grupo:' + grupo : no('alvo:' + a, a, 'Destinos', 'box'), 'publica em');
    }
    evid.push({ fonte: repo + '/' + p, trecho: (w.name || p) + (alvos.length ? ' → ' + [...new Set(alvos)].join(', ') : ' (sem passo de publicação reconhecido)') });
  }
  if (nos.size <= 1) return null;
  if (!paths.some(x => WORKFLOW.test(x))) lac.push('Não há fluxo do GitHub Actions: se a publicação é feita por integração do próprio serviço (Vercel, Netlify), ela não aparece no código.');
  if (!tfs.length) lac.push('Sem Terraform: a nuvem configurada à mão (fora do código) não aparece aqui.');
  // DOT
  const ids = new Map([...nos.keys()].sort().map((k, i) => [k, 'n' + (i + 1)]));
  const grupos = ordena([...new Set([...nos.values()].map(n => n.grupo))], x => x);
  const L = ['digraph infraestrutura {', '  graph [rankdir=LR, fontname="Helvetica", fontsize=12, label="Arquitetura de Infraestrutura · ' + aspasDot(repo) + '", labelloc=t, compound=true, nodesep=0.35, ranksep=0.7];',
    '  node [shape=box, style="rounded", fontname="Helvetica", fontsize=10];', '  edge [fontname="Helvetica", fontsize=9, color="#555555"];'];
  const noDot = (n: NoInfra, ind: string) => ind + ids.get(n.id) + ' [label="' + n.rotulo.split('\n').map(aspasDot).join('\\n') + '"' + (n.forma ? ', shape=' + n.forma : '') + '];';
  grupos.forEach((g, i) => {
    const doGrupo = ordena([...nos.values()].filter(n => n.grupo === g), n => n.id);
    if (!g) { doGrupo.forEach(n => L.push(noDot(n, '  '))); return; }
    L.push('  subgraph cluster_' + (i + 1) + ' {', '    label="' + aspasDot(g) + '"; style="rounded,dashed"; color="#999999";');
    doGrupo.forEach(n => L.push(noDot(n, '    ')));
    L.push('  }');
  });
  // seta para um grupo inteiro (ex.: publica no Supabase): aponta para o primeiro do grupo e a ponta encosta na caixa do grupo
  const alvoDe = (k: string) => { if (!k.startsWith('grupo:')) return { id: ids.get(k), extra: '' }; const g = k.slice(6), i = grupos.indexOf(g), n1 = ordena([...nos.values()].filter(n => n.grupo === g), n => n.id)[0]; return { id: n1 && ids.get(n1.id), extra: g ? ', lhead=cluster_' + (i + 1) : '' }; };
  for (const x of ordena(ligs.map(l => ({ l, a: ids.get(l.de), b: alvoDe(l.para) })).filter(x => x.a && x.b.id), x => x.a! + '>' + x.b.id! + x.l.rotulo))
    L.push('  ' + x.a + ' -> ' + x.b.id + ' [label="' + aspasDot(x.l.rotulo) + '"' + x.b.extra + '];');
  L.push('}');
  // no quadro: cada provedor ou arquivo é um grupo; cada recurso um card com o tipo dele (como o nó do Terraform graph ou do Compose)
  const cardInfra = (n: NoInfra): CardQ => {
    const [l1, ...resto] = n.rotulo.split('\n'), g = n.grupo || undefined, pref = n.id.split(':')[0];
    const base = { id: n.id, grupo: g ? 'g:' + g : undefined, topicos: resto };
    if (pref === 'repo') return { ...base, tipo: 'empresa', icone: 'git', rotuloTipo: 'REPOSITÓRIO', titulo: resto[0] || repo, topicos: [] };
    if (pref === 'svc') return { ...base, tipo: 'servico', icone: 'container', rotuloTipo: 'SERVIÇO DO COMPOSE', titulo: l1 };
    if (pref === 'vol') return { ...base, tipo: 'banco', icone: 'volume', rotuloTipo: 'VOLUME', titulo: l1.replace(/^volume /, '') };
    if (pref === 'img') return { ...base, tipo: 'servico', icone: 'container', rotuloTipo: 'IMAGEM DOCKER', titulo: resto[0] || l1, topicos: resto.slice(1) };
    if (pref === 'tf') { if (l1.startsWith('módulo ')) return { ...base, tipo: 'modulo', rotuloTipo: 'MÓDULO TERRAFORM', titulo: l1.slice(7) };
      return { ...base, tipo: 'servico', icone: l1.startsWith('dado ') ? 'chave' : 'nuvem', rotuloTipo: (l1.startsWith('dado ') ? 'DADO · ' + l1.slice(5) : l1).toUpperCase().slice(0, 40), titulo: resto[0] || l1, topicos: resto.slice(1) }; }
    if (pref === 'k8s') return { ...base, tipo: 'servico', icone: l1 === 'Service' ? 'api' : l1 === 'Ingress' ? 'globo' : 'container', rotuloTipo: l1.toUpperCase(), titulo: resto[0] || l1, topicos: resto.slice(1) };
    if (pref === 'vercel' || pref === 'host' || pref === 'render') return { ...base, tipo: 'empresa', icone: 'nuvem', rotuloTipo: l1.toUpperCase().slice(0, 30), titulo: resto[0] || l1, topicos: resto.slice(1) };
    if (pref === 'vcron') return { ...base, tipo: 'servico', icone: 'relogio', rotuloTipo: 'ROTINA', titulo: resto[0] || l1, topicos: [l1.replace(/^rotina /, 'quando: ')] };
    if (pref === 'ext') return { ...base, tipo: 'empresa', icone: 'globo', rotuloTipo: 'SERVIÇO DE FORA', titulo: l1, cor: 'cinza' };
    if (pref === 'sb') return n.id === 'sb:pg' ? { ...base, tipo: 'banco', rotuloTipo: 'POSTGRES', titulo: 'Banco do Supabase' } : { ...base, tipo: 'servico', icone: 'funcao', rotuloTipo: 'EDGE FUNCTION', titulo: resto[0] || l1, topicos: [] };
    if (pref === 'gha') return { ...base, tipo: 'servico', icone: 'relogio', rotuloTipo: 'GITHUB ACTIONS', titulo: resto[0] || l1, topicos: resto.slice(1) };
    return { ...base, tipo: 'empresa', icone: 'nuvem', rotuloTipo: 'DESTINO', titulo: l1, topicos: resto };
  };
  const primeiroDoGrupo = (g: string) => ordena([...nos.values()].filter(n => n.grupo === g), n => n.id)[0]?.id;
  const modelo: Modelo = {
    titulo: 'Arquitetura de Infraestrutura · ' + repo, layout: 'grade',
    resumo: 'Lido do código de ' + repo + ': ' + grupos.filter(Boolean).map(g => g + ' (' + plural([...nos.values()].filter(n => n.grupo === g).length, 'item', 'itens') + ')').join(' · ') + '.' + (lac.length ? ' ' + lac.join(' ') : ''),
    legenda: ['Grupo: o provedor ou o arquivo de onde o recurso veio (Compose, Terraform, Kubernetes, Vercel, Supabase, GitHub Actions)', 'O texto pequeno no topo do card é o tipo do recurso', 'O rótulo da seta diz a ligação: depende de, usa, grava em, monta, chama, publica em'],
    grupos: grupos.filter(Boolean).map(g => ({ id: 'g:' + g, titulo: g })),
    cards: ordena([...nos.values()], n => n.id).map(cardInfra),
    ligacoes: ligs.map(l => ({ de: l.de, para: l.para.startsWith('grupo:') ? (primeiroDoGrupo(l.para.slice(6)) || '') : l.para, rotulo: l.rotulo, tracejada: l.rotulo === 'publica em' || l.rotulo === 'dispara' })).filter(l => l.para),
  };
  return { tipo: 'infra', aba: 'infra', nome: 'Infraestrutura · ' + repo, formato: 'graphviz', fonte: L.join('\n') + '\n', evidencias: evid.slice(0, 60), lacunas: lac, modelo };
}

/* ================= 3. mapa de telas e rotas ================= */
function depsDe(arq: Arquivos, raiz: string): Set<string> {
  const j = lerJson(arq.get(juntar(raiz, 'package.json'))) || {};
  return new Set([...Object.keys(j.dependencies || {}), ...Object.keys(j.devDependencies || {})]);
}
const segNext = (s: string) => s.startsWith('[[...') ? '*' + s.slice(5, -2) : s.startsWith('[...') ? '*' + s.slice(4, -1) : s.startsWith('[') ? ':' + s.slice(1, -1) : s;
export function gerarRotas(arq: Arquivos, caminhos: string[], repo: string): Desenho | null {
  const telas = new Map<string, string>(), apis = new Map<string, string>(), evid: Evidencia[] = [], lac: string[] = [], quadros = new Set<string>();
  const htmls: string[] = []; let filhas = false;
  const tela = (rota: string, fonte: string) => { const r = ('/' + rota.split('/').filter(Boolean).join('/')).replace(/\/+/g, '/'); if (!telas.has(r)) telas.set(r, fonte); };
  const api = (metodo: string, rota: string, fonte: string) => { const k = metodo.toUpperCase() + ' ' + ('/' + rota.split('/').filter(Boolean).join('/')); if (!apis.has(k)) apis.set(k, fonte); };
  const raizes = raizesDePacote(arq);
  for (const p of caminhos) {
    if (PASTAS_FORA.test(p)) continue;
    const r = raizDe(p, raizes), rel = tirarRaiz(p, r), deps = depsDe(arq, r);
    let m: RegExpMatchArray | null;
    if (deps.has('next') && (m = rel.match(/^(?:src\/)?app\/(.*?)(?:^|\/)?(page|route)\.(tsx|jsx|ts|js|mdx)$/))) {
      const segs = m[1].split('/').filter(s => s && !/^\(.*\)$/.test(s) && !s.startsWith('@') && !/^\(\.+\)/.test(s)).map(segNext);
      if (m[2] === 'page') tela(segs.join('/'), p); else api('*', segs.join('/'), p);
      quadros.add('Next.js'); continue;
    }
    if (deps.has('next') && (m = rel.match(/^(?:src\/)?pages\/(.+)\.(tsx|jsx|ts|js|mdx)$/))) {
      if (/^_(app|document|error)$/.test(m[1])) continue;
      const segs = m[1].split('/').map(segNext); if (segs[segs.length - 1] === 'index') segs.pop();
      if (segs[0] === 'api') api('*', segs.join('/'), p); else tela(segs.join('/'), p);
      quadros.add('Next.js'); continue;
    }
    if (deps.has('@sveltejs/kit') && (m = rel.match(/^src\/routes\/(.*?)\/?\+(page|server)\.(svelte|ts|js)$/))) {
      const segs = m[1].split('/').filter(s => s && !/^\(.*\)$/.test(s)).map(s => s.startsWith('[...') ? '*' + s.slice(4, -1) : s.startsWith('[') ? ':' + s.replace(/^\[+|\]+$/g, '') : s);
      if (m[2] === 'page') tela(segs.join('/'), p); else api('*', segs.join('/'), p);
      quadros.add('SvelteKit'); continue;
    }
    if (deps.has('nuxt') && (m = rel.match(/^(?:app\/)?pages\/(.+)\.vue$/))) {
      const segs = m[1].split('/').map(s => s.startsWith('[...') ? '*' + s.slice(4, -1) : s.startsWith('[') ? ':' + s.slice(1, -1) : s); if (segs[segs.length - 1] === 'index') segs.pop();
      tela(segs.join('/'), p); quadros.add('Nuxt'); continue;
    }
    if (deps.has('nuxt') && (m = rel.match(/^server\/api\/(.+)\.(ts|js)$/))) { api('*', 'api/' + m[1].replace(/\.(get|post|put|patch|delete)$/, ''), p); continue; }
    if ([...deps].some(d => d.startsWith('@remix-run/') || d === '@react-router/dev') && (m = rel.match(/^app\/routes\/([^/]+?)(?:\/route)?\.(tsx|jsx|ts|js)$/))) {
      const segs = m[1].split('.').filter(s => s !== '_index' && !s.startsWith('_')).map(s => s.startsWith('$') ? (s === '$' ? '*' : ':' + s.slice(1)) : s.replace(/_$/, ''));
      tela(segs.join('/'), p); quadros.add('Remix'); continue;
    }
    if (/\.html?$/i.test(p) && !/(^|\/)(node_modules|test|tests|fixtures|coverage|docs?\/api)\//i.test(p)) htmls.push(p);
  }
  // rotas escritas no código
  for (const [p, c] of ordena([...arq.entries()], ([k]) => k)) {
    if (/\.(tsx|jsx|ts|js|vue|mjs)$/.test(p) && /from\s+['"](react-router|react-router-dom|vue-router|@angular\/router|@tanstack\/react-router)['"]/.test(c)) {
      for (const m of c.matchAll(/<Route\b[^>]*?\bpath=\{?["'`]([^"'`]+)["'`]/g)) { tela(m[1], p); evid.push({ fonte: repo + '/' + p, trecho: linhaCom(c, m.index!) }); }
      for (const m of c.matchAll(/\bpath\s*:\s*["'`]([^"'`]*)["'`]/g)) { tela(m[1], p); }
      if ([...c.matchAll(/\bpath(?:\s*:\s*|=\{?)["'`]([^"'`/*][^"'`]*)["'`]/g)].length) filhas = true;
      quadros.add(/vue-router/.test(c) ? 'Vue Router' : /@angular\/router/.test(c) ? 'Angular' : 'React Router');
    }
    if (/\.(ts|js|mjs|cjs)$/.test(p) && /from\s+['"](express|fastify|hono|koa-router|@koa\/router)['"]|require\(\s*['"](express|fastify|koa-router)['"]\s*\)/.test(c))
      for (const m of c.matchAll(/\b(?:app|router|server|api|fastify|r)\.(get|post|put|patch|delete|all)\(\s*["'`]([^"'`]+)["'`]/g)) { api(m[1] === 'all' ? '*' : m[1], m[2], p); quadros.add('API em Node'); }
    if (/\.(java|kt)$/.test(p) && /@(Rest)?Controller\b/.test(c)) {
      // o @RequestMapping antes da classe é o prefixo; as anotações depois dela são as rotas (com ou sem caminho)
      const iClasse = c.search(/\bclass\s+\w+/), cab = iClasse < 0 ? '' : c.slice(0, iClasse), corpoCl = iClasse < 0 ? c : c.slice(iClasse);
      const caminhoDe = (args: string | undefined) => { const m = (args || '').match(/^\(\s*(?:(?:value|path)\s*=\s*)?\{?\s*"([^"]*)"/); return m ? m[1] : ''; };
      const base = caminhoDe((cab.match(/@RequestMapping\b(\([^)]*\))?/) || [])[1]);
      for (const m of corpoCl.matchAll(/@(Get|Post|Put|Patch|Delete|Request)Mapping\b(\([^)]*\))?/g)) {
        const rota = juntarRota(base, caminhoDe(m[2]));
        if (/@RestController\b/.test(c)) api(m[1] === 'Request' ? '*' : m[1], rota, p); else tela(rota, p);
        quadros.add('Spring');
      }
    }
    if (/\.py$/.test(p) && /from\s+(fastapi|flask)\b|import\s+(fastapi|flask)\b/.test(c)) {
      for (const m of c.matchAll(/@\w+\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/g)) { api(m[1], m[2], p); quadros.add('FastAPI'); }
      for (const m of c.matchAll(/@\w+\.route\(\s*["']([^"']+)["'](?:[^)]*methods\s*=\s*\[([^\]]*)\])?/g)) { const ms = (m[2] || "'GET'").match(/\w+/g) || ['GET']; ms.forEach(x => api(x, m[1], p)); quadros.add('Flask'); }
    }
  }
  if (!telas.size && htmls.length){ for (const p of htmls) tela(p.replace(/(^|\/)index\.html?$/i, '$1').replace(/\.html?$/i, ''), p); quadros.add('páginas HTML'); }
  if (!telas.size && !apis.size) return null;
  // árvore das telas (até 80), rotas de API à parte (até 60)
  const listaT = [...telas.keys()].sort().slice(0, 80), listaA = [...apis.keys()].sort((a, b) => a.split(' ')[1].localeCompare(b.split(' ')[1]) || a.localeCompare(b)).slice(0, 60);
  const ids = new Map<string, string>(); let n = 0; const id = (k: string) => { if (!ids.has(k)) ids.set(k, 'r' + (++n)); return ids.get(k)!; };
  const L = ['flowchart LR'];
  if (listaT.length) {
    L.push('  subgraph telas["Telas"]', '    direction LR');
    const todos = new Set<string>(['/']); listaT.forEach(r => { const s = r.split('/').filter(Boolean); for (let i = 1; i <= s.length; i++) todos.add('/' + s.slice(0, i).join('/')); });
    for (const r of [...todos].sort()) L.push('    ' + id(r) + '["' + aspasMmd(r === '/' ? '/' : '/' + r.split('/').pop()) + (telas.has(r) ? '' : ' …') + '"]' + (telas.has(r) ? '' : ':::pasta'));
    for (const r of [...todos].sort()) if (r !== '/') { const pai = dirDe(r.slice(1)); L.push('    ' + id(pai ? '/' + pai : '/') + ' --> ' + id(r)); }
    L.push('  end');
  }
  if (listaA.length) {
    L.push('  subgraph api["Rotas de API"]', '    direction TB');
    for (const a of listaA) L.push('    ' + id('api ' + a) + '["' + aspasMmd(a.replace(/^\* /, '')) + '"]');
    L.push('  end');
  }
  L.push('  classDef pasta fill:#f4f4f4,stroke:#bbbbbb,color:#666666');
  for (const r of listaT.slice(0, 20)) evid.push({ fonte: repo + '/' + telas.get(r)!, trecho: 'tela ' + r });
  for (const a of listaA.slice(0, 20)) evid.push({ fonte: repo + '/' + apis.get(a)!, trecho: 'rota ' + a });
  if (telas.size > 80) lac.push('Há ' + telas.size + ' telas; o desenho mostra as 80 primeiras.');
  if (apis.size > 60) lac.push('Há ' + apis.size + ' rotas de API; o desenho mostra as 60 primeiras.');
  if (filhas) lac.push('Há rotas filhas (caminho sem / no começo): elas aparecem ligadas ao começo do site, porque o robô não monta o encaixe entre as rotas.');
  lac.push('Este é o mapa das rotas que existem no código. A jornada (o que a pessoa faz em que ordem) depende de interpretação: peça ao DevIT.');
  // no quadro: a árvore das telas (da raiz para as filhas) e as rotas de API juntas por recurso, com o método HTTP
  const todasT = new Set<string>(listaT.length ? ['/'] : []); listaT.forEach(r => { const sg = r.split('/').filter(Boolean); for (let i = 1; i <= sg.length; i++) todasT.add('/' + sg.slice(0, i).join('/')); });
  const recurso = (rota: string) => '/' + rota.split('/').filter(Boolean).slice(0, rota.startsWith('/api/') ? 2 : 1).join('/');
  const porRecurso = new Map<string, string[]>(); listaA.forEach(a => { const [m, r] = [a.slice(0, a.indexOf(' ')), a.slice(a.indexOf(' ') + 1)]; const k = recurso(r); (porRecurso.get(k) || porRecurso.set(k, []).get(k)!).push((m === '*' ? 'TODOS' : m) + ' ' + r); });
  const modelo: Modelo = {
    titulo: 'Telas e rotas · ' + repo, layout: 'camadas',
    resumo: 'Lido de: ' + ([...quadros].sort().join(', ') || 'páginas HTML') + '. ' + plural(telas.size, 'tela', 'telas') + (apis.size ? ' e ' + plural(apis.size, 'rota de API', 'rotas de API') : '') + '. A seta vai da rota para as rotas dentro dela.',
    legenda: ['Card de tela: uma rota que abre uma página', 'Card cinza: parte do caminho, sem página própria', 'Rotas de API: juntas por recurso, com o método HTTP (GET, POST, PUT, PATCH, DELETE)'],
    grupos: [...(todasT.size ? [{ id: 'telas', titulo: 'Telas', cor: 'azul' }] : []), ...(porRecurso.size ? [{ id: 'api', titulo: 'Rotas de API', cor: 'roxo' }] : [])],
    cards: [...[...todasT].sort().map(r => ({ id: 'tela:' + r, grupo: 'telas', tipo: 'modulo' as const, icone: telas.has(r) ? 'tela' : 'quadro', rotuloTipo: telas.has(r) ? 'TELA' : 'CAMINHO', titulo: r === '/' ? '/' : '/' + r.split('/').pop(), subtitulo: r, cor: telas.has(r) ? 'azul' : 'cinza' })),
      ...[...porRecurso.keys()].sort().map(k => ({ id: 'api:' + k, grupo: 'api', tipo: 'servico' as const, icone: 'api', rotuloTipo: 'API', titulo: k, topicos: porRecurso.get(k)! }))],
    ligacoes: [...todasT].sort().filter(r => r !== '/').map(r => { const pai = dirDe(r.slice(1)); return { de: 'tela:' + (pai ? '/' + pai : '/'), para: 'tela:' + r }; }),
  };
  return { modelo, tipo: 'rotas', aba: 'ux', nome: 'Telas e rotas · ' + repo, formato: 'mermaid', fonte: L.join('\n') + '\n', evidencias: [{ fonte: repo, trecho: 'Lido de: ' + ([...quadros].sort().join(', ') || 'páginas HTML') }, ...evid].slice(0, 60), lacunas: lac };
}
const juntarRota = (a: string, b: string) => '/' + [a, b].join('/').split('/').filter(Boolean).join('/');

/* ================= 4. Prisma ================= */
const idDbml = (s: string) => '"' + String(s).replace(/"/g, '') + '"';
const notaDbml = (s: string) => "'" + curto(s, 500).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
const tipoDbml = (t: string) => /^[A-Za-z_][\w]*$/.test(t) ? t : '"' + t.replace(/"/g, '') + '"';
export function gerarPrisma(arq: Arquivos, repo: string): Desenho | null {
  const arquivos = [...arq.keys()].filter(p => p.endsWith('.prisma')).sort(); if (!arquivos.length) return null;
  const texto = arquivos.map(p => arq.get(p)!).join('\n');
  const modelos: { nome: string; tabela: string; campos: { nome: string; coluna: string; tipo: string; opc: string[] }[]; ids: string[]; unicos: string[][]; nota: string }[] = [];
  const enums: { nome: string; valores: string[] }[] = [];
  for (const m of texto.matchAll(/^\s*enum\s+(\w+)\s*\{([\s\S]*?)^\s*\}/gm)) enums.push({ nome: m[1], valores: m[2].split('\n').map(l => l.replace(/\/\/.*/, '').trim().split(/\s+/)[0]).filter(v => v && !v.startsWith('@')) });
  for (const m of texto.matchAll(/^\s*model\s+(\w+)\s*\{([\s\S]*?)^\s*\}/gm)) modelos.push({ nome: m[1], tabela: (m[2].match(/@@map\(\s*"([^"]+)"/) || [])[1] || m[1], campos: [], ids: (m[2].match(/@@id\(\s*\[([^\]]+)\]/) || [])[1]?.split(',').map(x => x.trim()) || [], unicos: [...m[2].matchAll(/@@unique\(\s*\[([^\]]+)\]/g)].map(u => u[1].split(',').map(x => x.trim())), nota: m[2] });
  const nomes = new Set(modelos.map(x => x.nome)), enumNomes = new Set(enums.map(e => e.nome));
  const refs: string[] = [], refsQ: { de: string; dc: string; para: string; pc: string; nulo: boolean }[] = [], fks = new Map<string, Set<string>>();
  for (const md of modelos) for (const l of md.nota.split('\n')) {
    const x = l.replace(/\/\/.*/, '').trim(); if (!x || x.startsWith('@@')) continue;
    const m = x.match(/^(\w+)\s+([\w.]+)(\[\])?(\?)?\s*(.*)$/); if (!m) continue;
    const [, nome, tipo, lista, opcional, attrs] = m;
    if (nomes.has(tipo)) {
      const rel = attrs.match(/@relation\(([^)]*)\)/); if (!rel) continue;
      const f = (rel[1].match(/fields:\s*\[([^\]]+)\]/) || [])[1], r = (rel[1].match(/references:\s*\[([^\]]+)\]/) || [])[1];
      if (f && r) { const alvo = modelos.find(y => y.nome === tipo)!; const col = (n: string, mdl: typeof md) => { const c = mdl.nota.match(new RegExp('^\\s*' + n + '\\s+[^\\n]*@map\\(\\s*"([^"]+)"', 'm')); return c ? c[1] : n; };
        const fs = f.split(',').map(s => col(s.trim(), md)), rs = r.split(',').map(s => col(s.trim(), alvo));
        refs.push('Ref: ' + idDbml(md.tabela) + '.' + (fs.length > 1 ? '(' + fs.map(idDbml).join(', ') + ')' : idDbml(fs[0])) + ' > ' + idDbml(alvo.tabela) + '.' + (rs.length > 1 ? '(' + rs.map(idDbml).join(', ') + ')' : idDbml(rs[0])));
        const s = fks.get(md.tabela) || new Set<string>(); fs.forEach(x => s.add(x)); fks.set(md.tabela, s);
        refsQ.push({ de: md.tabela, dc: fs[0], para: alvo.tabela, pc: rs[0], nulo: !!opcional }); }
      continue;
    }
    const opc: string[] = [];
    if (/@id\b/.test(attrs)) opc.push('pk'); if (/@unique\b/.test(attrs)) opc.push('unique'); if (!opcional && !lista) opc.push('not null');
    const pd = attrs.match(/@default\(((?:[^()]|\([^()]*\))*)\)/); if (pd) opc.push(/^".*"$/.test(pd[1]) ? 'default: ' + notaDbml(pd[1].slice(1, -1)) : /^-?\d+(\.\d+)?$|^(true|false)$/.test(pd[1]) ? 'default: ' + pd[1] : 'default: `' + pd[1].replace(/`/g, '') + '`');
    md.campos.push({ nome, coluna: (attrs.match(/@map\(\s*"([^"]+)"/) || [])[1] || nome, tipo: (enumNomes.has(tipo) ? tipo : tipo.toLowerCase()) + (lista ? '[]' : ''), opc });
  }
  if (!modelos.length) return null;
  const L: string[] = [];
  for (const e of enums) L.push('Enum ' + idDbml(e.nome) + ' {', ...e.valores.map(v => '  ' + idDbml(v)), '}', '');
  for (const md of modelos) {
    L.push('Table ' + idDbml(md.tabela) + ' {');
    for (const c of md.campos) L.push('  ' + idDbml(c.coluna) + ' ' + tipoDbml(c.tipo) + (c.opc.length ? ' [' + c.opc.join(', ') + ']' : ''));
    const idx = [...(md.ids.length ? [md.ids.map(n => (md.campos.find(c => c.nome === n) || { coluna: n }).coluna)] : []).map(cs => '    (' + cs.map(idDbml).join(', ') + ') [pk]'),
      ...md.unicos.map(u => '    (' + u.map(n => idDbml((md.campos.find(c => c.nome === n) || { coluna: n }).coluna)).join(', ') + ') [unique]')];
    if (idx.length) L.push('  indexes {', ...idx, '  }');
    L.push('}', '');
  }
  L.push(...refs.sort());
  const modelo: Modelo = {
    titulo: 'DER do Prisma · ' + repo, layout: 'grade', resumo: plural(modelos.length, 'modelo', 'modelos') + (enums.length ? ' e ' + plural(enums.length, 'enum', 'enums') : '') + ' em ' + arquivos.join(', ') + '.',
    legenda: LEGENDA_DER, grupos: [{ id: 'prisma', titulo: 'Modelos do Prisma', cor: 'ciano' }, ...(enums.length ? [{ id: 'enums', titulo: 'Enums', cor: 'amarelo' }] : [])],
    cards: [...ordenarPorLigacao(modelos.map(md => md.tabela), refsQ.map(r => [r.de, r.para] as [string, string])).map(tb => { const md = modelos.find(x => x.tabela === tb)!, fk = fks.get(tb) || new Set<string>(), idsC = md.ids.map(n => (md.campos.find(c => c.nome === n) || { coluna: n }).coluna);
        return { id: 't:' + tb, grupo: 'prisma', tipo: 'tabela' as const, estilo: 'der' as const, titulo: tb, subtitulo: md.nome !== tb ? 'model ' + md.nome : '',
          linhas: md.campos.map(c => ({ nome: c.coluna, tipo: c.tipo, chave: chaveDe(c.opc.includes('pk') || idsC.includes(c.coluna), fk.has(c.coluna), c.opc.includes('unique')), nulo: !c.opc.includes('not null') })) }; }),
      ...enums.map(e => ({ id: 'e:' + e.nome, grupo: 'enums', tipo: 'modulo' as const, rotuloTipo: 'ENUM', icone: 'lista', titulo: e.nome, topicos: e.valores, cor: 'amarelo' }))],
    ligacoes: refsQ.map(r => ligFk('t:' + r.de, r.dc, 't:' + r.para, r.pc, r.nulo, false)),
  };
  return { modelo, tipo: 'prisma', aba: 'der', nome: 'Banco (Prisma) · ' + repo, formato: 'dbml', fonte: L.join('\n').trim() + '\n', evidencias: arquivos.map(p => ({ fonte: repo + '/' + p, trecho: plural(modelos.length, 'modelo', 'modelos') + (enums.length ? ', ' + plural(enums.length, 'enum', 'enums') : '') })), lacunas: [] };
}

/* ================= ajudas do DER no quadro ================= */
const LEGENDA_DER = ['PK chave primária · FK chave estrangeira · UQ único · ? aceita vazio', 'A linha sai da coluna FK e chega na coluna que ela aponta',
  'Pontas (pé de galinha): || exatamente um · o| zero ou um · o< zero ou muitos'];
function chaveDe(pk: boolean, fk: boolean, uq: boolean): Linha['chave'] { return pk && fk ? 'pkfk' : pk ? 'pk' : fk ? 'fk' : uq ? 'uq' : ''; }
// a ligação da chave estrangeira: do lado da tabela filha "zero ou muitos" (ou "zero ou um" se a FK for única);
// do lado da tabela apontada "exatamente um" (ou "zero ou um" se a FK aceita vazio)
function ligFk(de: string, dc: string, para: string, pc: string, nulo: boolean, unico: boolean, rotulo = ''): LigQ {
  return { de, para, deLinha: dc, paraLinha: pc, inicio: unico ? 'zeroum' : 'zeromuitos', fim: nulo ? 'zeroum' : 'umum', rotulo };
}
// tabelas ligadas ficam perto: começa pela mais ligada e vai puxando as vizinhas
function ordenarPorLigacao(ids: string[], pares: [string, string][]): string[] {
  const viz = new Map(ids.map(i => [i, new Set<string>()]));
  for (const [a, b] of pares) if (viz.has(a) && viz.has(b) && a !== b) { viz.get(a)!.add(b); viz.get(b)!.add(a); }
  const grau = (i: string) => viz.get(i)!.size, feito = new Set<string>(), out: string[] = [];
  const resto = () => ids.filter(i => !feito.has(i)).sort((a, b) => grau(b) - grau(a) || a.localeCompare(b));
  while (feito.size < ids.length) {
    const fila = [resto()[0]]; feito.add(fila[0]);
    while (fila.length) { const v = fila.shift()!; out.push(v); for (const w of [...viz.get(v)!].sort((a, b) => grau(b) - grau(a) || a.localeCompare(b))) if (!feito.has(w)) { feito.add(w); fila.push(w); } }
  }
  return out;
}

/* ================= do código: junta tudo ================= */
export function gerarDoCodigo(pac: Pick<Pacote, 'arquivos' | 'caminhos'>, repo: string, yaml: LerYaml): { desenhos: Desenho[]; avisos: string[] } {
  const desenhos: Desenho[] = [], avisos: string[] = [];
  const tentar = (nome: string, f: () => Desenho | null) => { try { const d = f(); if (d) desenhos.push(d); } catch (e) { avisos.push(nome + ': ' + (e as Error).message); } };
  tentar('software', () => gerarSoftware(pac.arquivos, repo));
  tentar('infraestrutura', () => gerarInfra(pac.arquivos, pac.caminhos, repo, yaml));
  tentar('rotas', () => gerarRotas(pac.arquivos, pac.caminhos, repo));
  tentar('prisma', () => gerarPrisma(pac.arquivos, repo));
  return { desenhos, avisos };
}

/* ================= do banco ================= */
// uma consulta só, que qualquer usuário de leitura consegue rodar (usa o catálogo, não information_schema)
export const CONSULTA_BANCO = `
with esq as (select unnest($1::text[]) as n),
tab as (
  select c.oid, n.nspname as esquema, c.relname as nome, c.relkind::text as tipo, c.relrowsecurity as rls, c.relforcerowsecurity as rls_forcado,
         obj_description(c.oid, 'pg_class') as nota, c.relowner, c.relacl
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in (select n from esq) and c.relkind in ('r','p','v','m','f') and not c.relispartition),
perm as (
  select t.oid, coalesce(r.rolname, 'PUBLIC') as papel, array_agg(distinct a.privilege_type order by a.privilege_type) as privs
    from tab t cross join lateral aclexplode(coalesce(t.relacl, acldefault('r', t.relowner))) a
    left join pg_roles r on r.oid = a.grantee
   where a.grantee <> t.relowner and (r.oid is null or (not r.rolsuper and r.rolname !~ '^(pg_|supabase_)' and r.rolname not in ('postgres','dashboard_user','pgbouncer','authenticator')))
     and a.privilege_type in ('SELECT','INSERT','UPDATE','DELETE')
   group by 1, 2)
select json_build_object(
  'tabelas', coalesce((select json_agg(json_build_object(
      'esquema', t.esquema, 'nome', t.nome, 'tipo', t.tipo, 'rls', t.rls, 'rls_forcado', t.rls_forcado, 'nota', t.nota,
      'colunas', (select coalesce(json_agg(json_build_object('nome', a.attname, 'tipo', format_type(a.atttypid, a.atttypmod), 'nao_nulo', a.attnotnull,
                    'padrao', pg_get_expr(d.adbin, d.adrelid), 'nota', col_description(a.attrelid, a.attnum)) order by a.attnum), '[]')
                    from pg_attribute a left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
                   where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped),
      'restricoes', (select coalesce(json_agg(json_build_object('nome', k.conname, 'tipo', k.contype::text,
                    'cols', (select json_agg(a.attname order by x.i) from unnest(k.conkey) with ordinality x(n, i) join pg_attribute a on a.attrelid = k.conrelid and a.attnum = x.n),
                    'ref_esquema', (select n2.nspname from pg_class c2 join pg_namespace n2 on n2.oid = c2.relnamespace where c2.oid = k.confrelid),
                    'ref_tabela', (select c2.relname from pg_class c2 where c2.oid = k.confrelid),
                    'ref_cols', (select json_agg(a.attname order by x.i) from unnest(k.confkey) with ordinality x(n, i) join pg_attribute a on a.attrelid = k.confrelid and a.attnum = x.n)
                  ) order by k.conname), '[]') from pg_constraint k where k.conrelid = t.oid and k.contype in ('p','u','f')),
      'permissoes', (select coalesce(json_agg(json_build_object('papel', p.papel, 'privs', p.privs) order by p.papel), '[]') from perm p where p.oid = t.oid),
      'regras', (select coalesce(json_agg(json_build_object('nome', po.polname, 'comando', po.polcmd::text, 'permissiva', po.polpermissive,
                    'usando', pg_get_expr(po.polqual, po.polrelid), 'checa', pg_get_expr(po.polwithcheck, po.polrelid),
                    'papeis', (select coalesce(json_agg(coalesce(r.rolname, 'PUBLIC') order by 1), '[]') from unnest(po.polroles) pr left join pg_roles r on r.oid = pr)) order by po.polname), '[]')
                  from pg_policy po where po.polrelid = t.oid)
    ) order by t.esquema, t.nome)
    from tab t), '[]'),
  'papeis', coalesce((select json_agg(json_build_object('nome', r.rolname, 'ignora_rls', r.rolbypassrls) order by r.rolname) from pg_roles r
                        where r.rolname in (select distinct papel from perm)), '[]')
) as estrutura`;

export type Coluna = { nome: string; tipo: string; nao_nulo: boolean; padrao: string | null; nota: string | null };
export type Restricao = { nome: string; tipo: string; cols: string[]; ref_esquema: string | null; ref_tabela: string | null; ref_cols: string[] | null };
export type Tabela = { esquema: string; nome: string; tipo: string; rls: boolean; rls_forcado: boolean; nota: string | null; colunas: Coluna[]; restricoes: Restricao[];
  permissoes: { papel: string; privs: string[] }[]; regras: { nome: string; comando: string; permissiva: boolean; papeis: string[]; usando?: string | null; checa?: string | null }[] };
export type Estrutura = { tabelas: Tabela[]; papeis: { nome: string; ignora_rls: boolean }[] };

export async function resumoEstrutura(e: Estrutura): Promise<string> {
  const b = new TextEncoder().encode(JSON.stringify(e));
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', b));
  return [...h].map(x => x.toString(16).padStart(2, '0')).join('');
}

export function gerarDer(e: Estrutura, esquema: string): Desenho | null {
  const tabs = e.tabelas.filter(t => t.esquema === esquema && ['r', 'p', 'f'].includes(t.tipo));
  if (!tabs.length) return null;
  const visoes = e.tabelas.filter(t => t.esquema === esquema && ['v', 'm'].includes(t.tipo));
  const q = (s: string, t: string) => idDbml(s) + '.' + idDbml(t);
  const L: string[] = [], refs: string[] = [], fora = new Map<string, Set<string>>();
  for (const t of tabs) {
    const pks = t.restricoes.filter(r => r.tipo === 'p'), uqs = t.restricoes.filter(r => r.tipo === 'u');
    const pk1 = pks.length === 1 && pks[0].cols.length === 1 ? pks[0].cols[0] : null;
    const uq1 = new Set(uqs.filter(r => r.cols.length === 1).map(r => r.cols[0]));
    L.push('Table ' + q(t.esquema, t.nome) + (t.nota ? ' [note: ' + notaDbml(t.nota) + ']' : '') + ' {');
    for (const c of t.colunas) {
      const o: string[] = [];
      if (c.nome === pk1) o.push('pk'); if (uq1.has(c.nome) && c.nome !== pk1) o.push('unique'); if (c.nao_nulo) o.push('not null');
      if (c.padrao && !c.padrao.includes('`') && c.padrao.length <= 120) o.push('default: `' + c.padrao + '`');
      if (c.nota) o.push('note: ' + notaDbml(c.nota));
      L.push('  ' + idDbml(c.nome) + ' ' + tipoDbml(c.tipo) + (o.length ? ' [' + o.join(', ') + ']' : ''));
    }
    const idx = [...pks.filter(r => r.cols.length > 1).map(r => '    (' + r.cols.map(idDbml).join(', ') + ') [pk]'), ...uqs.filter(r => r.cols.length > 1).map(r => '    (' + r.cols.map(idDbml).join(', ') + ') [unique]')];
    if (idx.length) L.push('  indexes {', ...idx, '  }');
    L.push('}', '');
    for (const f of t.restricoes.filter(r => r.tipo === 'f' && r.ref_tabela && r.ref_cols)) {
      const alvo = tabs.find(x => x.esquema === f.ref_esquema && x.nome === f.ref_tabela);
      if (!alvo) { const k = f.ref_esquema + '.' + f.ref_tabela; const s = fora.get(k) || new Set(); f.ref_cols!.forEach(c => s.add(c)); fora.set(k, s); }
      const lado = (s: string, t2: string, cs: string[]) => q(s, t2) + '.' + (cs.length > 1 ? '(' + cs.map(idDbml).join(', ') + ')' : idDbml(cs[0]));
      refs.push('Ref: ' + lado(t.esquema, t.nome, f.cols) + ' > ' + lado(f.ref_esquema!, f.ref_tabela!, f.ref_cols!));
    }
  }
  // tabelas de outro esquema que recebem ligação: entram só com as colunas ligadas, para o desenho fechar
  for (const k of [...fora.keys()].sort()) {
    const [s, t] = [k.slice(0, k.indexOf('.')), k.slice(k.indexOf('.') + 1)];
    const real = e.tabelas.find(x => x.esquema === s && x.nome === t);
    L.push('Table ' + q(s, t) + " [headercolor: #9AA0A6, note: 'de outro esquema: só as colunas ligadas'] {");
    for (const c of [...fora.get(k)!].sort()) L.push('  ' + idDbml(c) + ' ' + tipoDbml((real?.colunas.find(x => x.nome === c)?.tipo) || 'uuid'));
    L.push('}', '');
  }
  L.push(...[...new Set(refs)].sort());
  const lac: string[] = [];
  if (visoes.length) lac.push('As visões (' + visoes.map(v => v.nome).join(', ') + ') não aparecem no DER, porque não guardam dados.');
  // no quadro: uma tabela por card (PK, FK, UQ, tipo e ? para o que aceita vazio); a linha sai da coluna FK e chega na coluna
  // referenciada, com a cardinalidade nas pontas (pé de galinha). As tabelas ligadas ficam perto umas das outras.
  const fkQ: LigQ[] = [], pares: [string, string][] = [];
  for (const t of tabs) for (const f of t.restricoes.filter(r => r.tipo === 'f' && r.ref_tabela && r.ref_cols)) {
    const unico = t.restricoes.some(r => (r.tipo === 'p' || r.tipo === 'u') && r.cols.length === f.cols.length && r.cols.every(c => f.cols.includes(c)));
    const nulo = f.cols.some(c => !t.colunas.find(x => x.nome === c)?.nao_nulo);
    const para = (f.ref_esquema === esquema ? 't:' : 'fora:') + f.ref_esquema + '.' + f.ref_tabela;
    fkQ.push(ligFk('t:' + t.esquema + '.' + t.nome, f.cols[0], para, f.ref_cols![0], nulo, unico, f.cols.length > 1 ? '(' + f.cols.join(', ') + ')' : ''));
    pares.push(['t:' + t.esquema + '.' + t.nome, para]);
  }
  const cardTabela = (t: Tabela, grupo: string, soCols?: Set<string>): CardQ => {
    const pk = new Set(t.restricoes.filter(r => r.tipo === 'p').flatMap(r => r.cols)), fk = new Set(t.restricoes.filter(r => r.tipo === 'f').flatMap(r => r.cols)), uq = new Set(t.restricoes.filter(r => r.tipo === 'u' && r.cols.length === 1).flatMap(r => r.cols));
    const comp = t.restricoes.filter(r => (r.tipo === 'p' || r.tipo === 'u') && r.cols.length > 1).map(r => (r.tipo === 'p' ? 'Chave composta: (' : 'Único junto: (') + r.cols.join(', ') + ')');
    return { id: (soCols ? 'fora:' : 't:') + t.esquema + '.' + t.nome, grupo, tipo: 'tabela', estilo: 'der', titulo: t.nome, subtitulo: 'esquema ' + t.esquema + (soCols ? ' · colunas ligadas' : ''),
      etiquetas: soCols ? [] : [t.rls ? 'RLS' : 'SEM RLS'], cor: soCols ? 'cinza' : undefined, nota: [t.nota || '', ...comp].filter(Boolean).join('\n'),
      linhas: t.colunas.filter(c => !soCols || soCols.has(c.nome)).map(c => ({ nome: c.nome, tipo: c.tipo, chave: chaveDe(pk.has(c.nome), fk.has(c.nome), uq.has(c.nome)), nulo: !c.nao_nulo })) };
  };
  const ordem = ordenarPorLigacao(tabs.map(t => 't:' + t.esquema + '.' + t.nome), pares);
  const modelo: Modelo = {
    titulo: 'DER · esquema ' + esquema, layout: 'grade', legenda: LEGENDA_DER,
    resumo: plural(tabs.length, 'tabela', 'tabelas') + ' e ' + plural(fkQ.length, 'ligação', 'ligações') + ' (chaves estrangeiras), lidas direto do banco.' + (visoes.length ? ' As visões ficam fora do DER, porque não guardam dados.' : ''),
    grupos: [{ id: 'e:' + esquema, titulo: 'esquema ' + esquema, cor: 'ciano' }, ...(fora.size ? [{ id: 'fora', titulo: 'De outros esquemas', cor: 'cinza' }] : [])],
    cards: [...ordem.map(k => cardTabela(tabs.find(t => 't:' + t.esquema + '.' + t.nome === k)!, 'e:' + esquema)),
      ...[...fora.keys()].sort().map(k => { const [s2, t2] = [k.slice(0, k.indexOf('.')), k.slice(k.indexOf('.') + 1)]; const real = e.tabelas.find(x => x.esquema === s2 && x.nome === t2);
        return cardTabela(real || { esquema: s2, nome: t2, tipo: 'r', rls: false, rls_forcado: false, nota: null, colunas: [...fora.get(k)!].map(c => ({ nome: c, tipo: 'uuid', nao_nulo: true, padrao: null, nota: null })), restricoes: [], permissoes: [], regras: [] }, 'fora', fora.get(k)!); })],
    ligacoes: fkQ,
  };
  return { modelo, tipo: 'der:' + esquema, aba: 'der', nome: 'DER · esquema ' + esquema, formato: 'dbml', fonte: L.join('\n').trim() + '\n',
    evidencias: [{ fonte: 'banco · esquema ' + esquema, trecho: plural(tabs.length, 'tabela', 'tabelas') + ', ' + plural(refs.length, 'ligação', 'ligações') + ' (chaves estrangeiras)' }, ...tabs.slice(0, 40).map(t => ({ fonte: 'banco · ' + t.esquema + '.' + t.nome, trecho: plural(t.colunas.length, 'coluna', 'colunas') + (t.nota ? ' · ' + curto(t.nota, 120) : '') }))],
    lacunas: lac };
}

const PRIV_PT: Record<string, string> = { SELECT: 'ler', INSERT: 'criar', UPDATE: 'mudar', DELETE: 'apagar' };
const CMD_PT: Record<string, string> = { r: 'ler', a: 'criar', w: 'mudar', d: 'apagar', '*': 'tudo' };
export function gerarAcesso(e: Estrutura, esquemas: string[]): Desenho | null {
  const tabs = e.tabelas.filter(t => esquemas.includes(t.esquema) && ['r', 'p', 'v', 'm', 'f'].includes(t.tipo));
  if (!tabs.length) return null;
  const papeis = ordena([...new Set(tabs.flatMap(t => t.permissoes.map(p => p.papel)))], x => x);
  const ignora = new Set(e.papeis.filter(p => p.ignora_rls).map(p => p.nome));
  const idT = new Map(tabs.map((t, i) => [t.esquema + '.' + t.nome, 't' + (i + 1)])), idP = new Map(papeis.map((p, i) => [p, 'p' + (i + 1)]));
  const L = ['digraph acesso {', '  graph [rankdir=LR, fontname="Helvetica", fontsize=12, label="Acesso ao banco: quem lê e grava cada tabela, e onde o RLS está ligado", labelloc=t, compound=true, nodesep=0.2, ranksep=1.2];',
    '  node [fontname="Helvetica", fontsize=10];', '  edge [fontname="Helvetica", fontsize=9, color="#666666"];'];
  L.push('  subgraph cluster_papeis {', '    label="Papéis"; style="rounded"; color="#999999";');
  for (const p of papeis) L.push('    ' + idP.get(p) + ' [shape=ellipse, label="' + aspasDot(p) + (ignora.has(p) ? '\\nignora o RLS' : '') + '"' + (ignora.has(p) ? ', style=filled, fillcolor="#fff4e0"' : '') + '];');
  L.push('  }');
  const semRls = tabs.filter(t => ['r', 'p'].includes(t.tipo) && !t.rls && t.permissoes.some(p => !ignora.has(p.papel)));
  const esqs = ordena([...new Set(tabs.map(t => t.esquema))], x => x);
  esqs.forEach((s, i) => {
    L.push('  subgraph cluster_e' + (i + 1) + ' {', '    label="esquema ' + aspasDot(s) + '"; style="rounded,dashed"; color="#999999";');
    for (const t of tabs.filter(x => x.esquema === s)) {
      const visao = ['v', 'm'].includes(t.tipo), rls = t.rls ? 'RLS ligado · ' + plural(t.regras.length, 'regra', 'regras') : visao ? 'visão' : 'RLS desligado';
      const perigo = !visao && !t.rls && t.permissoes.some(p => !ignora.has(p.papel));
      L.push('    ' + idT.get(t.esquema + '.' + t.nome) + ' [shape=box, style="rounded' + (perigo ? ',filled' : '') + '"' + (perigo ? ', fillcolor="#fde8e8", color="#c0392b"' : t.rls ? ', color="#1e8449"' : '') +
        ', label="' + aspasDot(t.nome) + '\\n' + aspasDot(rls) + '"];');
    }
    L.push('  }');
  });
  // um papel com as mesmas permissões em todas as tabelas do esquema vira uma seta só para o esquema
  const setas: string[] = [];
  esqs.forEach((s, i) => {
    const doEsq = tabs.filter(x => x.esquema === s);
    for (const p of papeis) {
      const porTab = doEsq.map(t => { const tem = new Set(t.permissoes.find(x => x.papel === p)?.privs || []); return { t, privs: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'].filter(x => tem.has(x)).map(x => PRIV_PT[x]).join(', ') }; });
      const com = porTab.filter(x => x.privs);
      if (!com.length) continue;
      if (com.length === doEsq.length && doEsq.length > 3 && com.every(x => x.privs === com[0].privs))
        setas.push('  ' + idP.get(p) + ' -> ' + idT.get(com[0].t.esquema + '.' + com[0].t.nome) + ' [lhead=cluster_e' + (i + 1) + ', label="' + aspasDot(com[0].privs) + ' (todas as ' + doEsq.length + ')"];');
      else for (const x of com) setas.push('  ' + idP.get(p) + ' -> ' + idT.get(x.t.esquema + '.' + x.t.nome) + ' [label="' + aspasDot(x.privs) + '"];');
    }
  });
  L.push(...setas, '}');
  const evid: Evidencia[] = [{ fonte: 'banco', trecho: plural(tabs.length, 'tabela', 'tabelas') + ' em ' + esqs.join(', ') + '; ' + plural(tabs.filter(t => t.rls).length, 'com RLS ligado', 'com RLS ligado') + '; papéis: ' + papeis.join(', ') }];
  for (const t of tabs.filter(t => t.regras.length).slice(0, 40)) evid.push({ fonte: 'banco · ' + t.esquema + '.' + t.nome, trecho: curto(t.regras.map(r => r.nome + ' (' + (CMD_PT[r.comando] || r.comando) + ', ' + r.papeis.join('/') + (r.permissiva ? '' : ', restritiva') + ')' + (r.usando ? ': ' + r.usando : '') + (r.checa ? ' · confere: ' + r.checa : '')).join('; '), 600) });
  const lac: string[] = [];
  if (semRls.length) lac.push('Tabelas sem RLS e com acesso de algum papel: ' + semRls.map(t => t.esquema + '.' + t.nome).join(', ') + '. Confira se é de propósito.');
  lac.push('O desenho mostra o que o banco permite. As regras (RLS) dizem quais linhas cada pessoa vê; o texto de cada regra está em "De onde veio".');
  // no quadro: os papéis (quem acessa) à esquerda, as tabelas de cada esquema com o RLS e as regras, e o que cada papel pode
  const ligA: LigQ[] = [], cardsA: CardQ[] = [];
  esqs.forEach(s => {
    const doEsq = tabs.filter(x => x.esquema === s);
    for (const p of papeis) {
      const porTab = doEsq.map(t => { const tem = new Set(t.permissoes.find(x => x.papel === p)?.privs || []); return { t, privs: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'].filter(x => tem.has(x)).map(x => PRIV_PT[x]).join(', ') }; });
      const com = porTab.filter(x => x.privs); if (!com.length) continue;
      if (com.length === doEsq.length && doEsq.length > 3 && com.every(x => x.privs === com[0].privs)) {
        const id = 'todas:' + s + ':' + com[0].privs;
        if (!cardsA.some(c => c.id === id)) cardsA.push({ id, grupo: 'e:' + s, tipo: 'cartao', titulo: 'Todas as ' + doEsq.length + ' tabelas do esquema ' + s, subtitulo: 'O mesmo acesso em todas: ' + com[0].privs + '. Quais linhas cada pessoa vê é o RLS de cada tabela.', cor: 'cinza' });
        ligA.push({ de: 'papel:' + p, para: id, rotulo: com[0].privs });
      } else for (const x of com) ligA.push({ de: 'papel:' + p, para: 'tab:' + x.t.esquema + '.' + x.t.nome, rotulo: x.privs });
    }
  });
  const modelo: Modelo = {
    titulo: 'Acesso ao banco: quem lê e grava cada tabela, e onde o RLS está ligado', layout: 'grade',
    resumo: evid[0].trecho + '.' + (semRls.length ? ' Atenção: ' + plural(semRls.length, 'tabela sem RLS com acesso', 'tabelas sem RLS com acesso') + ' (em vermelho).' : ''),
    legenda: ['Card de pessoa: o papel do banco (anon, authenticated...), com o aviso quando ignora o RLS', 'Verde: RLS ligado (os tópicos são as regras: nome, comando, papéis e condição)', 'Vermelho: RLS desligado e algum papel tem acesso', 'O rótulo da seta é o que o papel pode: ler, criar, mudar, apagar'],
    grupos: [{ id: 'papeis', titulo: 'Papéis', cor: 'laranja' }, ...esqs.map(s => ({ id: 'e:' + s, titulo: 'esquema ' + s, cor: 'ciano' }))],
    cards: [...papeis.map(p => ({ id: 'papel:' + p, grupo: 'papeis', tipo: 'departamento' as const, icone: 'pessoa', rotuloTipo: 'PAPEL', titulo: p, topicos: ignora.has(p) ? ['ignora o RLS (vê e grava tudo)'] : [], cor: ignora.has(p) ? 'amarelo' : 'laranja' })),
      ...cardsA,
      ...tabs.map(t => { const visao = ['v', 'm'].includes(t.tipo), perigo = !visao && !t.rls && t.permissoes.some(p => !ignora.has(p.papel));
        return { id: 'tab:' + t.esquema + '.' + t.nome, grupo: 'e:' + t.esquema, tipo: 'banco' as const, icone: t.rls ? 'escudo' : visao ? 'tabela' : 'cadeado', rotuloTipo: visao ? 'VISÃO' : 'TABELA', titulo: t.nome,
          etiquetas: [visao ? 'visão' : t.rls ? 'RLS ligado' : 'RLS desligado'], cor: perigo ? 'vermelho' : t.rls ? 'verde' : 'cinza',
          topicos: t.regras.map(r => r.nome + ' · ' + (CMD_PT[r.comando] || r.comando) + ' · ' + r.papeis.join(', ') + (r.permissiva ? '' : ' · restritiva')),
          nota: t.regras.map(r => r.nome + ': ' + (r.usando || 'sem condição') + (r.checa ? ' · confere ao gravar: ' + r.checa : '')).join('\n') }; })],
    ligacoes: ligA,
  };
  return { tipo: 'acesso', aba: 'seguranca', nome: 'Acesso ao banco (RLS e permissões)', formato: 'graphviz', fonte: L.join('\n') + '\n', evidencias: evid, lacunas: lac, modelo };
}

export function gerarDoBanco(e: Estrutura, esquemas: string[]): Desenho[] {
  const out: Desenho[] = [];
  for (const s of [...esquemas].sort()) { const d = gerarDer(e, s); if (d) out.push(d); }
  const a = gerarAcesso(e, esquemas); if (a) out.push(a);
  return out;
}
