// Descobre sozinho quantas aplicações um repositório tem e de que tipo, sem perguntar a ninguém:
//   node      package.json com um framework de tela (React, Vue, Svelte, Angular, Next, Nuxt, Astro, Solid, Preact, Vite...)
//   estatico  pasta publicada com .html (vercel.json, netlify.toml, firebase.json, ou uma pasta com index.html)
//   servidor  Java, PHP, Python, Ruby, .NET, Go: lido só pelo código (telas pelos modelos de página)
// A pessoa pode corrigir depois (o que vale é o que ela marcar); aqui é o melhor palpite com prova (o arquivo que decidiu).
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, basename } from 'node:path';

export const IGNORAR = new Set(['node_modules', '.git', '.next', '.nuxt', '.svelte-kit', '.output', 'dist', 'build', 'out', 'coverage', 'vendor', 'target', '.venv', 'venv', '__pycache__', '.turbo', '.cache', 'bin', 'obj', '.idea', '.vscode']);
const FRAMEWORKS = [['next', 'Next.js'], ['nuxt', 'Nuxt'], ['@angular/core', 'Angular'], ['@sveltejs/kit', 'SvelteKit'], ['svelte', 'Svelte'], ['astro', 'Astro'], ['@remix-run/react', 'Remix'],
  ['vue', 'Vue'], ['solid-js', 'Solid'], ['preact', 'Preact'], ['react', 'React'], ['vite', 'Vite'], ['react-scripts', 'Create React App'], ['@builder.io/qwik', 'Qwik']];
const SERVIDORES = [['pom.xml', 'Java (Maven)'], ['build.gradle', 'Java (Gradle)'], ['build.gradle.kts', 'Kotlin (Gradle)'], ['composer.json', 'PHP'], ['manage.py', 'Python (Django)'],
  ['requirements.txt', 'Python'], ['pyproject.toml', 'Python'], ['Gemfile', 'Ruby'], ['go.mod', 'Go'], ['mix.exs', 'Elixir']];

export function lerJson(f) { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } }
export function andar(raiz, cada, fundo = 0) {
  if (fundo > 12) return;
  let itens; try { itens = readdirSync(raiz, { withFileTypes: true }); } catch { return; }
  for (const i of itens) {
    if (i.name.startsWith('.') && i.name !== '.env.example') { if (i.isDirectory()) continue; }
    const c = join(raiz, i.name);
    if (i.isDirectory()) { if (!IGNORAR.has(i.name)) andar(c, cada, fundo + 1); }
    else if (i.isFile()) cada(c, i.name);
  }
}
const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'app';
const tituloHtml = (f) => { try { const m = /<title[^>]*>([^<]{1,120})<\/title>/i.exec(readFileSync(f, 'utf8').slice(0, 20000)); return m ? m[1].trim() : null; } catch { return null; } };

export function detectar(raiz) {
  const pacotes = [], htmls = [], servidores = [];
  andar(raiz, (c, nome) => {
    if (nome === 'package.json') pacotes.push(c);
    else if (/\.html?$/i.test(nome)) htmls.push(c);
    else if (SERVIDORES.some(([f]) => f === nome)) servidores.push(c);
  });
  const apps = [];
  // 1. aplicações node com framework de tela
  for (const p of pacotes) {
    const j = lerJson(p); if (!j) continue;
    const deps = { ...(j.dependencies || {}), ...(j.devDependencies || {}) };
    const fw = FRAMEWORKS.find(([k]) => deps[k]);
    if (!fw) continue;
    const scripts = j.scripts || {};
    if (!scripts.build && !scripts.dev && !scripts.start && !scripts.serve) continue;
    const pasta = dirname(p);
    // monorepo: a raiz com workspaces e sem tela própria não é uma aplicação
    if (j.workspaces && !existsSync(join(pasta, 'index.html')) && !existsSync(join(pasta, 'src')) && !existsSync(join(pasta, 'app')) && !existsSync(join(pasta, 'pages'))) continue;
    apps.push({ tipo: 'node', pasta, rel: relative(raiz, pasta) || '.', framework: fw[1], nome: j.name || basename(pasta), prova: relative(raiz, p) + ' (' + fw[0] + ')', scripts });
  }
  const dentroDeNode = (f) => apps.some(a => f.startsWith(a.pasta + '/'));
  // 2. pastas publicadas com .html
  const publicadas = new Set();
  const v = lerJson(join(raiz, 'vercel.json')); if (v?.outputDirectory) publicadas.add(join(raiz, v.outputDirectory));
  try { const n = readFileSync(join(raiz, 'netlify.toml'), 'utf8'); const m = /publish\s*=\s*["']([^"']+)["']/.exec(n); if (m) publicadas.add(join(raiz, m[1])); } catch { /* sem netlify */ }
  const fb = lerJson(join(raiz, 'firebase.json')); if (fb?.hosting?.public) publicadas.add(join(raiz, fb.hosting.public));
  for (const pasta of publicadas) if (existsSync(pasta) && !dentroDeNode(pasta + '/x')) {
    const tem = htmls.filter(h => dirname(h) === pasta);
    if (tem.length) apps.push({ tipo: 'estatico', pasta, rel: relative(raiz, pasta) || '.', framework: 'HTML', nome: tituloHtml(join(pasta, 'index.html')) || basename(pasta), prova: 'pasta publicada (' + relative(raiz, pasta) + ')', paginas: tem.map(h => basename(h)) });
  }
  if (!apps.length) {
    // sem nada declarado: cada pasta com index.html fora de node_modules e das apps node
    for (const h of htmls) if (basename(h).toLowerCase() === 'index.html' && !dentroDeNode(h) && !/(^|\/)(docs?|test|tests|exemplos?|examples?|fixtures?|templates?)\//i.test(relative(raiz, h))) {
      const pasta = dirname(h);
      if (apps.some(a => pasta.startsWith(a.pasta + '/') || a.pasta === pasta)) continue;
      apps.push({ tipo: 'estatico', pasta, rel: relative(raiz, pasta) || '.', framework: 'HTML', nome: tituloHtml(h) || basename(pasta), prova: relative(raiz, h), paginas: htmls.filter(x => dirname(x) === pasta).map(x => basename(x)) });
    }
  }
  // 3. sistemas de servidor (lidos pelo código)
  for (const s of servidores) {
    const pasta = dirname(s), nome = basename(s);
    if (apps.some(a => a.pasta === pasta || pasta.startsWith(a.pasta + '/'))) continue;
    if (nome === 'requirements.txt' || nome === 'pyproject.toml') { try { if (!/django|flask|fastapi/i.test(readFileSync(s, 'utf8'))) continue; } catch { continue; } }
    const tipo = SERVIDORES.find(([f]) => f === nome)[1];
    if (apps.some(a => a.tipo === 'servidor' && a.pasta === pasta)) continue;
    apps.push({ tipo: 'servidor', pasta, rel: relative(raiz, pasta) || '.', framework: tipo, nome: basename(pasta), prova: relative(raiz, s) });
  }
  const usados = new Set();
  for (const a of apps) { let k = slug(a.rel === '.' ? a.nome : a.rel); while (usados.has(k)) k += '-2'; usados.add(k); a.chave = 'app:' + k; }
  return apps;
}

// as variáveis de ambiente que o código lê (para dar valores falsos na construção, sem nenhum segredo de verdade)
export function variaveisDoCodigo(pasta) {
  const nomes = new Set();
  andar(pasta, (c, nome) => {
    if (!/\.(m?[jt]sx?|vue|svelte|astro|html)$|^\.env\.(example|sample|template)$/i.test(nome)) return;
    let t; try { if (statSync(c).size > 800_000) return; t = readFileSync(c, 'utf8'); } catch { return; }
    for (const m of t.matchAll(/(?:import\.meta\.env|process\.env)\.([A-Z][A-Z0-9_]{2,60})/g)) nomes.add(m[1]);
    for (const m of t.matchAll(/^([A-Z][A-Z0-9_]{2,60})=/gm)) nomes.add(m[1]);
  });
  const env = {};
  for (const n of nomes) {
    if (/SUPABASE.*URL|URL.*SUPABASE/.test(n)) env[n] = 'https://mapafalso.supabase.co';
    else if (/(ANON|PUBLISHABLE|PUBLIC).*KEY|KEY.*(ANON|PUBLIC)|SUPABASE.*KEY/.test(n)) env[n] = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.mapa-falso';
    else if (/(URL|ENDPOINT|HOST|BASE)$/.test(n) || /_URL_/.test(n)) env[n] = 'https://api.mapa-falso.local';
    else if (/(SECRET|PASSWORD|SENHA|TOKEN|PRIVATE|SERVICE_ROLE)/.test(n)) env[n] = 'mapa-falso';
    else env[n] = 'mapa-falso';
  }
  return env;
}
