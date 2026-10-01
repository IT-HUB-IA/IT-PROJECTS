// O inventário do que já existe no sistema, lido do código e da estrutura do banco, sem IA:
// telas, APIs, tarefas agendadas e tabelas, cada uma com o grupo (o épico sugerido) e os sinais de pronto ou inacabado.
// A tela do CicloDev importa como épicos e itens: o que parece pronto vai para "Pronto para testar" (o P.O. confirma),
// o que tem sinal de inacabado entra como "Precisa análise", com o motivo.
import { SERVICOS_SDK, type Arquivos, type Estrutura } from './gerar.ts';
import { empacotado, dependenciasDe } from './seguranca.ts';

export type Sinais = { arquivo?: string; todo?: number; teste?: boolean; inacabado?: string; usada?: boolean | null; rls?: boolean; colunas?: number };
export type ItemInv = { tipo: 'tela' | 'api' | 'job' | 'tabela' | 'integracao' | 'infra' | 'teste'; chave: string; grupo: string; nome: string; onde: string; sinais: Sinais };

const CODIGO = /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte|py|java|kt|go|cs|php|rb)$/i;
const TESTE = /(^|\/)(test|tests|testes?|__tests__|spec|e2e|cypress)\/|\.(test|spec)\.[a-z]+$|Tests?\.(java|kt|cs)$/i;
const linhaDe = (t: string, i: number) => t.slice(0, i).split('\n').length;
const titulo = (s: string) => s.replace(/[-_]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim().replace(/^./, c => c.toUpperCase());
const base = (c: string) => c.split('/').pop()!.replace(/\.[^.]+$/, '');
const pasta = (c: string) => { const p = c.split('/'); p.pop(); const fora = new Set(['src', 'app', 'main', 'java', 'resources', 'static', 'public', 'pages', 'routes', 'views', 'screens', 'components', 'lib', 'web', 'frontend', 'backend', 'server', 'client', 'controllers', 'controller', 'api', 'com', 'br', 'org']);
  const nomes = p.filter(x => x && !fora.has(x.toLowerCase()) && !/^[a-z]{2,4}$/.test(x)); return nomes.length ? titulo(nomes[nomes.length - 1]) : 'Geral'; };
// o que diz que não está pronto: TODO, "não implementado", função vazia que só devolve nulo
function sinaisDoArquivo(txt: string, caminho: string, testes: string[]): Sinais {
  const todo = (txt.match(/(?:\/\/|#|\/\*|\*)\s*(?:TODO|FIXME|HACK)\b/g) || []).length;
  const inac = /not\s+implemented|não\s+implementad|nao\s+implementad|em\s+construção|em\s+construcao|coming\s+soon|UnsupportedOperationException\(\s*"?(?:TODO|Not)/i.exec(txt);
  const b = base(caminho).replace(/(Controller|Service|Resource|Page|Screen|View|Routes?|Api|Handler)$/i, '').toLowerCase();
  const teste = b.length >= 3 && testes.some(t => t.toLowerCase().includes(b));
  return { arquivo: caminho, todo, teste, inacabado: inac ? inac[0].slice(0, 80) : undefined };
}

export function inventarioDoCodigo(arq: Arquivos, caminhos: string[]): ItemInv[] {
  const out: ItemInv[] = [], ja = new Set<string>();
  const testes = caminhos.filter(c => TESTE.test(c));
  const add = (i: ItemInv) => { if (ja.has(i.chave) || out.length >= 2500) return; ja.add(i.chave); out.push(i); };
  // ---------- testes: um item por arquivo de teste (o que já está coberto) ----------
  for (const c of testes.slice(0, 400)) if (/\.(m?[jt]sx?|cjs|py|java|kt|go|cs|php|rb)$/i.test(c))
    add({ tipo: 'teste', chave: 'teste:' + c, grupo: 'Testes', nome: 'Teste ' + titulo(base(c).replace(/[._-]?(test|spec|tests?)$/i, '').replace(/^test[._-]?/i, '')), onde: c, sinais: { arquivo: c, teste: true } });
  // ---------- infraestrutura: como o sistema é montado e publicado ----------
  const INFRA: [RegExp, (c: string, t: string) => string | null][] = [
    [/(^|\/)(Dockerfile[^/]*|[^/]+\.Dockerfile)$/i, c => 'Imagem Docker (' + c + ')'],
    [/(^|\/)(docker-)?compose[^/]*\.ya?ml$/i, c => 'Docker Compose (' + c + ')'],
    [/^\.github\/workflows\/[^/]+\.ya?ml$/i, (c, t) => 'Automação GitHub Actions: ' + (((t.match(/^name:\s*['"]?([^'"\n]+)/m) || [])[1] || base(c)).trim())],
    [/(^|\/)vercel\.json$/i, () => 'Publicação na Vercel'], [/(^|\/)netlify\.toml$/i, () => 'Publicação na Netlify'],
    [/(^|\/)fly\.toml$/i, () => 'Publicação no Fly.io'], [/(^|\/)render\.ya?ml$/i, () => 'Publicação no Render'],
    [/\.tf$/i, c => 'Terraform (' + c + ')'], [/\.ya?ml$/i, (c, t) => /^\s*kind:\s*(Deployment|Service|Ingress|StatefulSet|CronJob)\b/m.test(t) && /^\s*apiVersion:/m.test(t) ? 'Kubernetes (' + c + ')' : null]
  ];
  for (const [c, t] of arq) for (const [re, nome] of INFRA) if (re.test(c)) { const n = nome(c, t); if (n) add({ tipo: 'infra', chave: 'infra:' + c, grupo: 'Infraestrutura', nome: n.slice(0, 300), onde: c, sinais: { arquivo: c } }); break; }
  // ---------- integrações: sistemas de fora que o código chama, e bibliotecas de serviços conhecidos ----------
  for (const [c, txt] of arq) {
    if (!CODIGO.test(c) || TESTE.test(c) || empacotado(txt)) continue;
    for (const m of txt.matchAll(/(?:fetch|axios(?:\.\w+)?|requests\.\w+|httpx\.\w+|getForObject|postForObject|getForEntity|postForEntity|exchange|WebClient\.create|baseUrl|URI\.create|http\.(?:get|post|request)|NewRequest\([^,]*,)\(?\s*[`'"]https?:\/\/([^/`'"$\s:]+)/g)) {
      const h = m[1].toLowerCase(); if (/^(localhost|127\.|0\.0\.0\.0)/.test(h) || /\.(local|test|example)$/.test(h) || /(^|\.)example\.(com|org)$/.test(h)) continue;
      add({ tipo: 'integracao', chave: 'int:' + h, grupo: 'Integrações', nome: 'Integração com ' + h, onde: c + ':' + linhaDe(txt, m.index!), sinais: sinaisDoArquivo(txt, c, testes) });
    }
  }
  const deps = dependenciasDe(arq).map(d => d.nome);
  for (const [re, n] of SERVICOS_SDK) { const d = deps.find(x => re.test(x)); if (d) add({ tipo: 'integracao', chave: 'sdk:' + n, grupo: 'Integrações', nome: 'Integração com ' + n, onde: 'biblioteca ' + d, sinais: {} }); }
  for (const [c, txt] of arq) {
    if (TESTE.test(c) || empacotado(txt)) continue;
    const sin = () => sinaisDoArquivo(txt, c, testes);
    // ---------- APIs ----------
    if (/\.(java|kt)$/i.test(c) && /@(Rest)?Controller\b/.test(txt)) {
      const prefixo = ((txt.match(/@RequestMapping\(\s*(?:value\s*=\s*|path\s*=\s*)?"([^"]*)"/) || [])[1] || '').replace(/\/$/, '');
      const classe = (txt.match(/class\s+(\w+)/) || [])[1] || base(c);
      for (const m of txt.matchAll(/@(Get|Post|Put|Delete|Patch)Mapping\b(?:\(\s*(?:value\s*=\s*|path\s*=\s*)?(?:\{?\s*"([^"]*)")?)?/g)) {
        const rota = (prefixo + '/' + (m[2] || '')).replace(/\/+/g, '/').replace(/(.)\/$/, '$1') || '/';
        const metodo = m[1].toUpperCase();
        add({ tipo: 'api', chave: 'api:' + metodo + ' ' + rota, grupo: titulo(classe.replace(/(Rest)?Controller$/, '')) || 'APIs', nome: metodo + ' ' + rota, onde: c + ':' + linhaDe(txt, m.index!), sinais: sin() });
      }
    }
    if (/\.(m?[jt]sx?|cjs)$/i.test(c)) {
      for (const m of txt.matchAll(/\b(?:app|router|server|api|rotas?)\.(get|post|put|delete|patch)\(\s*['"`](\/[^'"`]*)['"`]/g))
        add({ tipo: 'api', chave: 'api:' + m[1].toUpperCase() + ' ' + m[2], grupo: pasta(c) === 'Geral' ? titulo(base(c)) : pasta(c), nome: m[1].toUpperCase() + ' ' + m[2], onde: c + ':' + linhaDe(txt, m.index!), sinais: sin() });
      // telas do React Router e do Vue Router
      for (const m of txt.matchAll(/<Route\b[^>]*\bpath\s*=\s*["'{`]+(\/?[^"'}`]*)/g))
        add({ tipo: 'tela', chave: 'tela:' + m[1], grupo: pasta(c), nome: 'Tela ' + (m[1] || '/'), onde: c + ':' + linhaDe(txt, m.index!), sinais: sin() });
      for (const m of txt.matchAll(/\{\s*path\s*:\s*['"`](\/[^'"`]*)['"`]\s*,\s*(?:name\s*:\s*['"`][^'"`]*['"`]\s*,\s*)?component/g))
        add({ tipo: 'tela', chave: 'tela:' + m[1], grupo: pasta(c), nome: 'Tela ' + m[1], onde: c + ':' + linhaDe(txt, m.index!), sinais: sin() });
    }
    // Next.js: pages/ e app/ (page = tela, route = API) e funções do Supabase
    const next = c.match(/(?:^|\/)(?:src\/)?(pages|app)\/(.+?)\.(tsx?|jsx?)$/);
    if (next && !/(^|\/)(_app|_document|_error|layout|loading|error|not-found|middleware)\./.test(c)) {
      const ehApi = next[1] === 'pages' ? next[2].startsWith('api/') : /(^|\/)route$/.test(next[2]);
      const ehTela = next[1] === 'pages' ? !ehApi : /(^|\/)page$/.test(next[2]);
      const rota = '/' + next[2].replace(/(^|\/)(index|page|route)$/, '').replace(/^api\/?/, ehApi && next[1] === 'pages' ? 'api/' : '').replace(/\([^)]*\)\//g, '').replace(/\[([^\]]+)\]/g, ':$1');
      if (ehApi) add({ tipo: 'api', chave: 'api:ANY ' + rota, grupo: pasta(c), nome: 'API ' + rota, onde: c, sinais: sin() });
      else if (ehTela) add({ tipo: 'tela', chave: 'tela:' + rota, grupo: pasta(c), nome: 'Tela ' + rota, onde: c, sinais: sin() });
    }
    const fn = c.match(/(?:^|\/)supabase\/functions\/([^/_][^/]*)\/index\.ts$/);
    if (fn) add({ tipo: 'api', chave: 'fn:' + fn[1], grupo: 'Funções do Supabase', nome: 'Função ' + fn[1], onde: c, sinais: sin() });
    // telas em HTML (o arquivo é a tela)
    if (/\.html?$/i.test(c) && !/(^|\/)(test|node_modules|coverage|docs?)\//.test(c) && /<(form|main|body|section)\b/i.test(txt)) {
      const t = (txt.match(/<title>([^<]{1,120})<\/title>/i) || [])[1];
      add({ tipo: 'tela', chave: 'tela:' + c, grupo: pasta(c), nome: 'Tela ' + (t ? t.trim() : base(c)), onde: c, sinais: sin() });
    }
    // tarefas agendadas
    if (CODIGO.test(c)) for (const m of txt.matchAll(/@Scheduled\([^)]*\)\s*(?:public\s+)?(?:\w+\s+)*?(\w+)\s*\(|cron\.schedule\(\s*['"`]([^'"`]+)['"`]/g))
      add({ tipo: 'job', chave: 'job:' + c + ':' + (m[1] || m[2]), grupo: 'Tarefas agendadas', nome: 'Tarefa ' + (m[1] ? titulo(m[1]) : m[2]), onde: c + ':' + linhaDe(txt, m.index!), sinais: sin() });
  }
  return out;
}

// as tabelas: agrupadas pelo começo do nome (chat_*, cliente_*) quando três ou mais dividem o prefixo
export function inventarioDoBanco(e: Estrutura, palavras?: Set<string> | null): ItemInv[] {
  const tabs = e.tabelas.filter(t => ['r', 'p'].includes(t.tipo));
  const pref = (n: string) => n.includes('_') ? n.split('_')[0] : n;
  const conta = new Map<string, number>(); tabs.forEach(t => conta.set(t.esquema + '.' + pref(t.nome), (conta.get(t.esquema + '.' + pref(t.nome)) || 0) + 1));
  return tabs.slice(0, 2500).map(t => {
    const p = pref(t.nome), grupoP = (conta.get(t.esquema + '.' + p) || 0) >= 3;
    return { tipo: 'tabela', chave: 'tabela:' + t.esquema + '.' + t.nome, grupo: 'Banco: ' + (grupoP ? titulo(p) : (t.esquema === 'public' ? 'outras tabelas' : t.esquema)),
      nome: 'Tabela ' + t.nome, onde: t.esquema + '.' + t.nome,
      sinais: { rls: t.rls, colunas: t.colunas.length, usada: palavras ? palavras.has(t.nome.toLowerCase()) : null } } as ItemInv;
  });
}
// as palavras do código (para saber se uma tabela é usada por ele)
export function palavrasDoCodigo(arq: Arquivos): Set<string> {
  const s = new Set<string>();
  for (const [c, t] of arq) { if (!CODIGO.test(c) && !/\.(sql|xml|prisma)$/i.test(c)) continue; for (const m of t.matchAll(/[A-Za-z_][A-Za-z0-9_]{2,63}/g)) { s.add(m[0].toLowerCase()); if (s.size > 400_000) return s; } }
  return s;
}
// o que a tela mostra como motivo de "Precisa análise" (vazio = parece pronto)
export function motivosInacabado(i: ItemInv): string[] {
  const m: string[] = [], s = i.sinais || {};
  if (s.todo) m.push(s.todo + (s.todo === 1 ? ' marca TODO/FIXME no arquivo' : ' marcas TODO/FIXME no arquivo'));
  if (s.inacabado) m.push('o código diz "' + s.inacabado + '"');
  if (i.tipo === 'tabela' && s.usada === false) m.push('o código não usa esta tabela');
  return m;
}
