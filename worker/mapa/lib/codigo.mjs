// Leitura do código, sem rodar nada, em qualquer linguagem (texto puro, sem IA):
//   * onde cada texto da tela está escrito (arquivo e linha), para cada peça do mapa;
//   * o que o código lê e grava no banco: Supabase (.from('t').insert({...})), SQL escrito à mão (insert into t (a, b)),
//     e o que guarda só no navegador (localStorage, sessionStorage, IndexedDB, cookie);
//   * as telas de quem não dá para rodar (modelos de página de Java, PHP, Python, Ruby, .NET): botões, links, campos e formulários.
import { readFileSync, statSync } from 'node:fs';
import { relative, extname } from 'node:path';
import { andar } from './detectar.mjs';

const TEXTO = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.vue', '.svelte', '.astro', '.html', '.htm', '.java', '.kt', '.kts', '.scala', '.groovy', '.php', '.py', '.rb', '.erb', '.cs',
  '.cshtml', '.razor', '.go', '.rs', '.dart', '.swift', '.m', '.jsp', '.ftl', '.twig', '.blade', '.hbs', '.handlebars', '.mustache', '.ejs', '.pug', '.liquid', '.njk', '.sql', '.xml', '.json', '.yaml', '.yml', '.properties', '.ex', '.exs', '.heex', '.lua', '.pl']);
const MODELO = /\.(html?|jsp|ftl|twig|blade\.php|php|erb|cshtml|razor|hbs|handlebars|mustache|ejs|liquid|njk|heex|vue|svelte|jsx|tsx)$/i;
const limpar = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const norm = (s) => limpar(s).toLowerCase();

export function lerCodigo(raiz, { saida = null } = {}) {
  const arquivos = [];
  andar(raiz, (c, nome) => {
    const ext = extname(nome).toLowerCase();
    if (!TEXTO.has(ext) && !/\.blade\.php$/.test(nome)) return;
    if (/\.min\.(js|css)$|\.map$|package-lock\.json$|yarn\.lock$|pnpm-lock\.yaml$/.test(nome)) return;
    let st; try { st = statSync(c); } catch { return; }
    if (st.size > 3_000_000) return;
    let t; try { t = readFileSync(c, 'utf8'); } catch { return; }
    if (t.indexOf('\u0000') >= 0) return;
    arquivos.push({ caminho: relative(raiz, c), texto: t, grande: st.size > 400_000, saida: !!saida && c.startsWith(saida + '/') });
  });
  // a pasta publicada só conta como "gerada" quando existe código-fonte de tela fora dela (ex.: fonte/*.js que um build.py junta)
  const fonteFora = arquivos.some(a => !a.saida && /\.(m?[jt]sx?|vue|svelte|py)$/.test(a.caminho) && !/(^|\/)(test|tests|testes|worker|scripts?)\//.test(a.caminho));
  if (!fonteFora) for (const a of arquivos) a.saida = false;
  // índice dos textos: tudo o que está entre aspas ou entre > e < (o que aparece na tela), por texto normalizado
  const indice = new Map();
  const peso = (a) => (a.saida || a.grande ? 4 : 0) + (/(^|\/)(test|tests|testes|__tests__|spec|e2e|fixtures?|mocks?)\//i.test(a.caminho) || /\.(test|spec)\./.test(a.caminho) ? 2 : 0) + (/\.(json|ya?ml|xml|properties|sql)$/i.test(a.caminho) ? 8 : 0);
  for (const a of arquivos) {
    const linhas = a.texto.split('\n'), pw = peso(a);
    for (let i = 0; i < linhas.length && i < 60000; i++) {
      const l = linhas[i]; if (l.length > 4000) continue;
      const add = (s) => {
        const orig = limpar(s.replace(/\\n/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')), k = orig.toLowerCase(); if (k.length < 2 || k.length > 140) return;
        const o = indice.get(k), p = pw * 2 + (/^[a-z_]+$/.test(orig) && orig.length > 3 ? 1 : 0);   // nome de coluna/variável perde para o texto da tela
        if (!o || o.peso > p) indice.set(k, { arquivo: a.caminho, linha: i + 1, trecho: limpar(l).slice(0, 240), peso: p });
      };
      for (const m of l.matchAll(/'((?:[^'\\\n]|\\.){2,140})'|"((?:[^"\\\n]|\\.){2,140})"|`([^`$\n]{2,140})`/g)) add(m[1] || m[2] || m[3]);
      for (const m of l.matchAll(/>([^<>{}\n]{2,140})</g)) add(m[1]);
      for (const m of l.matchAll(/(?:title|aria-label|placeholder|label|alt|data-nome)\s*=\s*["']([^"'\n]{2,140})["']/g)) add(m[1]);
    }
  }
  const onde = (rotulo) => {
    const k = norm(rotulo); if (!k) return null;
    const e = indice.get(k); if (e) return e;
    if (k.length >= 4) { // rótulo com contagem/ícone junto ("Clientes 12"): tenta sem números e símbolos
      const k2 = k.replace(/[\d•·|]+/g, ' ').replace(/\s+/g, ' ').trim(); if (k2 && k2 !== k && indice.get(k2)) return indice.get(k2);
    }
    return null;
  };
  // o que o código lê e grava no banco, e o que guarda no navegador
  const acessos = [], navegador = [], telasEstaticas = [];
  for (const a of arquivos) {
    if (a.saida && arquivos.some(b => !b.saida && /\.(m?[jt]sx?|vue|svelte)$/.test(b.caminho))) continue; // o que foi gerado pela construção: vale o código-fonte
    if (/(^|\/)(test|tests|testes|__tests__|spec|e2e|fixtures?|mocks?)\//i.test(a.caminho) || /\.(test|spec)\./.test(a.caminho)) continue; // testes não são a aplicação
    const t = a.texto;
    const linhaDe = (i) => { let n = 1; for (let k = 0; k < i && k < t.length; k++) if (t.charCodeAt(k) === 10) n++; return n; };
    const emComentario = (i) => /^\s*(\/\/|\*|\/\*|#|--|<!--)/.test(t.slice(t.lastIndexOf('\n', i) + 1, i));
    const trechoDe = (i) => limpar(t.slice(t.lastIndexOf('\n', i) + 1, (t.indexOf('\n', i) + 1 || t.length + 1) - 1)).slice(0, 240);
    for (const m of t.matchAll(/\.from\(\s*['"`]([A-Za-z_][\w]*)['"`]\s*\)/g)) {
      const antes = t.slice(Math.max(0, m.index - 40), m.index);
      if (/storage\s*$/.test(antes)) continue;                                   // storage.from('balde'): depósito de arquivos, não tabela
      if (emComentario(m.index)) continue;                                        // comentário
      // só a própria corrente de chamadas: termina no ";", na linha seguinte que não continua com "." ou no próximo .from(
      const i = m.index, bruto = t.slice(i, i + 1500);
      const fim = Math.min(...[bruto.indexOf(';'), bruto.search(/\n\s*(?![.\s])/), bruto.slice(6).search(/\.from\(/) + (bruto.slice(6).search(/\.from\(/) < 0 ? 0 : 6)].map(x => x < 0 ? bruto.length : x));
      const resto = bruto.slice(0, fim);
      const op = /^[^;]*?\.(select|insert|update|upsert|delete)\s*\(/.exec(resto.replace(/\n/g, ' '));
      const modo = !op ? 'le' : op[1] === 'select' ? 'le' : 'grava';
      let colunas = [];
      if (op && op[1] === 'select') {
        const s = /\.select\(\s*['"`]([^'"`]*)['"`]/.exec(resto);
        if (s) {
          let sel = s[1]; for (let k = 0; k < 5; k++) sel = sel.replace(/[\w:!.\s]+\([^()]*\)/g, '');   // tirar as tabelas embutidas: cliente:clientes(nome)
          colunas = sel.split(',').map(x => x.trim()).map(x => x.includes(':') && !x.includes('::') ? x.split(':')[1] : x).map(x => x.split(/::|->|!/)[0].trim()).filter(x => x && x !== '*' && /^\w+$/.test(x));
        }
      }
      if (op && op[1] !== 'select' && op[1] !== 'delete') { const k = /\.(insert|update|upsert)\(\s*\[?\s*\{([^{}]{0,1200})\}/.exec(resto); if (k) colunas = [...k[2].matchAll(/(?:^|,|\{)\s*['"]?([A-Za-z_]\w*)['"]?\s*(?::|,|$)/g)].map(x => x[1]).filter(x => !['true', 'false', 'null'].includes(x)); }
      for (const f of resto.matchAll(/\.(eq|neq|gt|gte|lt|lte|like|ilike|is|in|contains|order)\(\s*['"`](\w+)['"`]\s*(,\s*\{[^}]*(foreignTable|referencedTable)[^}]*\})?/g)) if (!f[3]) colunas.push(f[2]);
      const mt = /\.match\(\s*\{([^{}]{0,600})\}/.exec(resto); if (mt) colunas.push(...[...mt[1].matchAll(/(?:^|,)\s*['"]?([A-Za-z_]\w*)['"]?\s*:/g)].map(x => x[1]));
      const oc = /onConflict\s*:\s*['"`]([\w,\s]+)['"`]/.exec(resto); if (oc) colunas.push(...oc[1].split(',').map(x => x.trim()).filter(Boolean));
      acessos.push({ via: 'supabase', tabela: m[1], modo, colunas: [...new Set(colunas)], arquivo: a.caminho, linha: linhaDe(i), trecho: trechoDe(i) });
    }
    const ehSql = /\.sql$/i.test(a.caminho) || /(^|\/)(migrations?|seeds?|sementes?|banco|database|db)\//i.test(a.caminho);   // migrations e scripts do banco são o banco, não a aplicação
    if (!ehSql) for (const m of t.matchAll(/\binsert\s+into\s+["`]?(\w+)["`]?(?:\.["`]?(\w+)["`]?)?\s*\(([^)]{1,800})\)/gi)) {
      if (emComentario(m.index)) continue;
      const tab = m[2] || m[1]; const cols = m[3].split(',').map(x => x.trim().replace(/["`]/g, '')).filter(x => /^\w+$/.test(x));
      acessos.push({ via: 'sql', tabela: tab, modo: 'grava', colunas: cols, arquivo: a.caminho, linha: linhaDe(m.index), trecho: trechoDe(m.index) });
    }
    if (!ehSql) for (const m of t.matchAll(/\bupdate\s+["`]?(\w+)["`]?(?:\.["`]?(\w+)["`]?)?\s+set\s+([^;'"`]{1,800}?)(?:\bwhere\b|;|['"`]|$)/gi)) {
      if (!/=/.test(m[3]) || emComentario(m.index)) continue;
      const tab = m[2] || m[1]; const cols = [...m[3].matchAll(/["`]?(\w+)["`]?\s*=/g)].map(x => x[1]);
      acessos.push({ via: 'sql', tabela: tab, modo: 'grava', colunas: cols, arquivo: a.caminho, linha: linhaDe(m.index), trecho: trechoDe(m.index) });
    }
    for (const m of t.matchAll(/\b(localStorage|sessionStorage)\s*\.\s*setItem\(\s*([^,]{1,160}),/g)) {
      const k = /^['"`]([^'"`]+)['"`]$/.exec(m[2].trim()); navegador.push({ area: m[1], chave: k ? k[1] : m[2].trim().slice(0, 120), arquivo: a.caminho, linha: linhaDe(m.index), trecho: trechoDe(m.index) });
    }
    for (const m of t.matchAll(/\b(localStorage|sessionStorage)\s*\[\s*['"`]([^'"`]+)['"`]\s*\]\s*=(?!=)/g)) navegador.push({ area: m[1], chave: m[2], arquivo: a.caminho, linha: linhaDe(m.index), trecho: trechoDe(m.index) });
    for (const m of t.matchAll(/\bindexedDB\s*\.\s*open\(\s*['"`]([^'"`]+)/g)) navegador.push({ area: 'IndexedDB', chave: m[1], arquivo: a.caminho, linha: linhaDe(m.index), trecho: trechoDe(m.index) });
    for (const m of t.matchAll(/document\.cookie\s*=(?!=)/g)) navegador.push({ area: 'cookie', chave: '', arquivo: a.caminho, linha: linhaDe(m.index), trecho: trechoDe(m.index) });
    // modelos de página (para sistemas que não dá para rodar): botões, links, campos e formulários
    if (MODELO.test(a.caminho) && !/\.(jsx|tsx|vue|svelte)$/.test(a.caminho)) {
      const el = [];
      for (const m of t.matchAll(/<(button|a|input|select|textarea|form)\b([^>]*)>([^<]{0,140})/gi)) {
        const tag = m[1].toLowerCase(), at = m[2];
        const attr = (n) => { const x = new RegExp('\\b' + n + '\\s*=\\s*["\']([^"\']*)["\']', 'i').exec(at); return x ? x[1] : null; };
        const tipo = (attr('type') || '').toLowerCase();
        if (tag === 'input' && ['hidden'].includes(tipo)) continue;
        const rot = limpar(m[3]) || attr('aria-label') || attr('title') || attr('placeholder') || attr('value') || attr('name') || '';
        el.push({ tag, tipo, rotulo: rot.slice(0, 120), nome: attr('name'), destino: attr('href') || attr('action') || null, linha: linhaDe(m.index) });
      }
      if (el.length) telasEstaticas.push({ arquivo: a.caminho, titulo: (/<title[^>]*>([^<]{1,120})</i.exec(t) || /<h1[^>]*>([^<]{1,120})</i.exec(t) || [])[1] || a.caminho.split('/').pop(), elementos: el.slice(0, 300) });
    }
  }
  return { onde, acessos, navegador, telasEstaticas, arquivos: arquivos.length };
}
