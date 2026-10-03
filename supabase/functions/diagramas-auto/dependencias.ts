// Bibliotecas com falha de segurança conhecida (regra DEP-01), para qualquer projeto ligado ao CicloDev.
// Base: OSV.dev (pública, gratuita, sem chave; junta os avisos do GitHub, PyPI, Go, RustSec, RubyGems, Packagist, NuGet e outros).
// Não baixa nada a mais: usa o mesmo pacote do código que o robô já baixa para os desenhos. Os arquivos de travas
// (package-lock.json, pnpm-lock.yaml, poetry.lock...) vêm separados (Pacote.travas), porque são grandes e não são código.
//
// Ordem de confiança da versão: arquivo de travas (versão instalada de verdade) > lista com versão exata (==, pom.xml,
// csproj) > lista com faixa (package.json "^1.2"). Quando só há a faixa, o achado diz "versão aproximada".
// Gravidade: a do próprio aviso (nota CVSS ou a classificação do GitHub), nunca pela quantidade de avisos.
export type Ecossistema = 'npm' | 'PyPI' | 'Maven' | 'Go' | 'Packagist' | 'RubyGems' | 'crates.io' | 'NuGet';
export type Dependencia = { ecossistema: Ecossistema; nome: string; versao: string; arquivo: string; aproximada?: boolean };
type Gravidade = 'critica' | 'alta' | 'media' | 'baixa';
type Achado = { regra: string; gravidade: Gravidade; titulo: string; onde: string; trecho: string; impressao: string };

// os arquivos de travas que o leitor do pacote guarda à parte (até 8 MB cada)
export const TRAVAS = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|poetry\.lock|Pipfile\.lock|uv\.lock|composer\.lock|Gemfile\.lock|Cargo\.lock|go\.sum|packages\.lock\.json|gradle\.lockfile)$/;
export const ehTrava = (caminho: string, tamanho: number) => tamanho <= 8_000_000 && TRAVAS.test(caminho) && !/(^|\/)(node_modules|vendor|\.venv|venv)\//.test(caminho);

const dirDe = (p: string) => p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
const versaoLimpa = (v: string) => (String(v || '').match(/\d+(?:\.\d+){0,3}(?:[-.][0-9A-Za-z.]+)?/) || [''])[0];
const json = (s: string): any => { try { return JSON.parse(s); } catch { return null; } };

function dasTravas(c: string, t: string, add: (d: Dependencia) => void) {
  const base = c.split('/').pop()!;
  if (base === 'package-lock.json' || base === 'npm-shrinkwrap.json') {
    const j = json(t); if (!j) return;
    if (j.packages) for (const [k, v] of Object.entries<any>(j.packages)) {
      if (!k || v?.link || !v?.version) continue;
      const nome = k.slice(k.lastIndexOf('node_modules/') + 13); if (nome) add({ ecossistema: 'npm', nome, versao: v.version, arquivo: c });
    }
    else { const rec = (deps: any) => { for (const [n, v] of Object.entries<any>(deps || {})) { if (v?.version && !/^(file|link|git)/.test(v.version)) add({ ecossistema: 'npm', nome: n, versao: v.version, arquivo: c }); rec(v?.dependencies); } }; rec(j.dependencies); }
  } else if (base === 'pnpm-lock.yaml') {
    const sec = t.split(/\n(?=\S)/).find(s => /^packages:/.test(s)) || '';
    for (const m of sec.matchAll(/^ {2}['"]?\/?((?:@[^/\s'"]+\/)?[^@\s'"(/]+)[@/](\d[^('"\s:_]*)/gm)) add({ ecossistema: 'npm', nome: m[1], versao: m[2], arquivo: c });
  } else if (base === 'yarn.lock') {
    for (const b of t.split(/\n\s*\n/)) {
      const cab = b.split('\n').find(l => /^\S.*:\s*$/.test(l) && !l.startsWith('#') && !l.startsWith('__metadata')); if (!cab) continue;
      const spec = cab.replace(/:\s*$/, '').split(',')[0].trim().replace(/^"|"$/g, '');
      const nome = spec.slice(0, spec.lastIndexOf('@') > 0 ? spec.lastIndexOf('@') : undefined);
      const v = (b.match(/^\s+version:?\s+"?([^"\s]+)"?/m) || [])[1];
      if (nome && v && !/@(workspace|link|file|patch|portal):/.test(spec)) add({ ecossistema: 'npm', nome, versao: v, arquivo: c });
    }
  } else if (base === 'poetry.lock' || base === 'uv.lock' || base === 'Cargo.lock') {
    const eco: Ecossistema = base === 'Cargo.lock' ? 'crates.io' : 'PyPI';
    for (const b of t.split(/\[\[package\]\]/).slice(1)) {
      const n = (b.match(/^name\s*=\s*"([^"]+)"/m) || [])[1], v = (b.match(/^version\s*=\s*"([^"]+)"/m) || [])[1];
      if (n && v && !/^source\s*=\s*\{\s*(editable|virtual|path)/m.test(b)) add({ ecossistema: eco, nome: n, versao: v, arquivo: c });
    }
  } else if (base === 'Pipfile.lock') {
    const j = json(t); if (!j) return;
    for (const s of ['default', 'develop']) for (const [n, v] of Object.entries<any>(j[s] || {})) { const ver = String(v?.version || '').replace(/^==/, ''); if (ver) add({ ecossistema: 'PyPI', nome: n, versao: ver, arquivo: c }); }
  } else if (base === 'composer.lock') {
    const j = json(t); if (!j) return;
    for (const s of ['packages', 'packages-dev']) for (const p of j[s] || []) if (p?.name && p?.version) add({ ecossistema: 'Packagist', nome: p.name, versao: String(p.version).replace(/^v/, ''), arquivo: c });
  } else if (base === 'Gemfile.lock') {
    for (const sec of t.split(/\n(?=\S)/).filter(s => /^GEM\b/.test(s)))
      for (const m of sec.matchAll(/^ {4}([A-Za-z0-9_.-]+) \(([^)\s]+)\)/gm)) add({ ecossistema: 'RubyGems', nome: m[1], versao: m[2].replace(/-[a-z].*$/, ''), arquivo: c });
  } else if (base === 'go.sum') {
    for (const m of t.matchAll(/^(\S+) v([^\s/]+?)(?:\/go\.mod)? h1:/gm)) add({ ecossistema: 'Go', nome: m[1], versao: m[2].replace(/\+incompatible$/, ''), arquivo: c });
  } else if (base === 'packages.lock.json') {
    const j = json(t); if (!j) return;
    for (const fw of Object.values<any>(j.dependencies || {})) for (const [n, v] of Object.entries<any>(fw || {})) if (v?.resolved && v?.type !== 'Project') add({ ecossistema: 'NuGet', nome: n, versao: v.resolved, arquivo: c });
  } else if (base === 'gradle.lockfile') {
    for (const m of t.matchAll(/^([\w.-]+):([\w.-]+):([\w.-]+)=/gm)) add({ ecossistema: 'Maven', nome: m[1] + ':' + m[2], versao: m[3], arquivo: c });
  }
}

// travas: os arquivos de travas (vêm separados do código). Sem travas, lê as listas comuns.
export function dependenciasDe(arq: Map<string, string>, travas: Map<string, string> = new Map()): Dependencia[] {
  const out: Dependencia[] = [], ja = new Set<string>();
  const add = (d: Dependencia) => { const v = String(d.versao || '').trim(), k = d.ecossistema + '|' + d.nome + '|' + v; if (/^\d/.test(v) && !ja.has(k)) { ja.add(k); out.push({ ...d, versao: v }); } };
  // quais pastas têm travas de cada ecossistema (a lista comum dessa pasta não precisa ser lida)
  const travada = new Set<string>();
  for (const [c, t] of travas) {
    dasTravas(c, t, add);
    const b = c.split('/').pop()!; const eco = /package-lock|shrinkwrap|pnpm|yarn/.test(b) ? 'npm' : /poetry|Pipfile|uv\.lock/.test(b) ? 'PyPI' : /composer/.test(b) ? 'Packagist' : /Gemfile/.test(b) ? 'RubyGems' : /Cargo/.test(b) ? 'crates.io' : /go\.sum/.test(b) ? 'Go' : /packages\.lock/.test(b) ? 'NuGet' : 'Maven';
    travada.add(eco + '|' + dirDe(c));
  }
  const tem = (eco: string, c: string) => { let d = dirDe(c); while (true) { if (travada.has(eco + '|' + d)) return true; if (!d) return false; d = dirDe(d); } };
  for (const [c, t] of arq) {
    if (/(^|\/)package\.json$/.test(c)) {
      if (tem('npm', c)) continue;
      const j = json(t); if (!j) continue;
      for (const s of ['dependencies', 'devDependencies', 'optionalDependencies']) for (const [n, v] of Object.entries(j[s] || {}))
        if (typeof v === 'string' && !/^(file:|link:|workspace:|git|http|npm:|\*|latest$)/.test(v)) add({ ecossistema: 'npm', nome: n, versao: versaoLimpa(v), arquivo: c, aproximada: !/^\d[\w.-]*$/.test(v.trim()) });
    } else if (/(^|\/)pom\.xml$/.test(c)) {
      const props: Record<string, string> = {}; for (const m of t.matchAll(/<([\w.-]+)>([^<${}]+)<\/\1>/g)) props[m[1]] = m[2].trim();
      for (const m of t.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
        const g = (m[1].match(/<groupId>([^<]+)</) || [])[1], a = (m[1].match(/<artifactId>([^<]+)</) || [])[1]; let v = (m[1].match(/<version>([^<]+)</) || [])[1] || '';
        const pv = v.match(/^\$\{([^}]+)\}$/); if (pv) v = props[pv[1]] || '';
        if (g && a && /^\d/.test(v)) add({ ecossistema: 'Maven', nome: g.trim() + ':' + a.trim(), versao: v.trim(), arquivo: c });
      }
    } else if (/(^|\/)build\.gradle(\.kts)?$/.test(c)) {
      if (tem('Maven', c)) continue;
      for (const m of t.matchAll(/(?:implementation|api|compile|runtimeOnly|compileOnly|testImplementation)\s*\(?\s*["']([\w.-]+):([\w.-]+):(\d[\w.-]*)["']/g)) add({ ecossistema: 'Maven', nome: m[1] + ':' + m[2], versao: m[3], arquivo: c });
    } else if (/(^|\/)requirements[^/]*\.txt$/.test(c)) {
      if (tem('PyPI', c)) continue;
      for (const m of t.matchAll(/^\s*([A-Za-z0-9_.-]+)(?:\[[^\]]*\])?\s*==\s*([\w.]+)/gm)) add({ ecossistema: 'PyPI', nome: m[1], versao: m[2], arquivo: c });
    } else if (/(^|\/)go\.mod$/.test(c)) {
      if (tem('Go', c)) continue;
      for (const m of t.matchAll(/^\s*(?:require\s+)?([\w.-]+\.[\w.-]+\/[\w./-]+)\s+v([\w.-]+)/gm)) add({ ecossistema: 'Go', nome: m[1], versao: m[2].replace(/\+incompatible$/, ''), arquivo: c });
    } else if (/\.csproj$/.test(c)) {
      if (tem('NuGet', c)) continue;
      for (const m of t.matchAll(/<PackageReference\s+Include="([^"]+)"\s+Version="(\d[^"]*)"/g)) add({ ecossistema: 'NuGet', nome: m[1], versao: m[2], arquivo: c });
    }
  }
  return out;
}

/* ---------- gravidade: nota CVSS 3 calculada pelo vetor (a fórmula oficial do FIRST) ---------- */
export function notaCvss3(vetor: string): number | null {
  const m: Record<string, string> = {}; for (const p of String(vetor || '').split('/')) { const [k, v] = p.split(':'); if (k && v) m[k] = v; }
  if (!/^CVSS:3/.test(vetor) || !m.AV || !m.AC || !m.PR || !m.UI || !m.S || !m.C || !m.I || !m.A) return null;
  const AV = ({ N: 0.85, A: 0.62, L: 0.55, P: 0.2 } as any)[m.AV], AC = ({ L: 0.77, H: 0.44 } as any)[m.AC], UI = ({ N: 0.85, R: 0.62 } as any)[m.UI];
  const mudou = m.S === 'C', PR = ({ N: 0.85, L: mudou ? 0.68 : 0.62, H: mudou ? 0.5 : 0.27 } as any)[m.PR];
  const cia = (x: string) => ({ H: 0.56, L: 0.22, N: 0 } as any)[x];
  if ([AV, AC, UI, PR, cia(m.C), cia(m.I), cia(m.A)].some(x => x === undefined)) return null;
  const iss = 1 - (1 - cia(m.C)) * (1 - cia(m.I)) * (1 - cia(m.A));
  const imp = mudou ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15) : 6.42 * iss;
  if (imp <= 0) return 0;
  const exp = 8.22 * AV * AC * PR * UI;
  const cima = (x: number) => { const i = Math.round(x * 100000); return i % 10000 === 0 ? i / 100000 : (Math.floor(i / 10000) + 1) / 10; };
  return cima(Math.min(mudou ? 1.08 * (imp + exp) : imp + exp, 10));
}
const PESO: Record<Gravidade, number> = { critica: 4, alta: 3, media: 2, baixa: 1 };
export function gravidadeDe(v: any): Gravidade {
  const notas = (v?.severity || []).map((s: any) => /^CVSS:3/.test(s?.score) ? notaCvss3(s.score) : (Number.isFinite(+s?.score) ? +s.score : null)).filter((x: any) => x !== null);
  if (notas.length) { const n = Math.max(...notas); return n >= 9 ? 'critica' : n >= 7 ? 'alta' : n >= 4 ? 'media' : 'baixa'; }
  const rot = String(v?.database_specific?.severity || (v?.affected || []).map((a: any) => a?.ecosystem_specific?.severity || a?.database_specific?.severity).find(Boolean) || '').toUpperCase();
  return rot === 'CRITICAL' ? 'critica' : rot === 'HIGH' ? 'alta' : rot === 'LOW' ? 'baixa' : rot === 'MODERATE' || rot === 'MEDIUM' ? 'media' : 'alta';   // sem nota: trata como alta (melhor avisar)
}

/* ---------- versão que corrige ---------- */
export function cmpVersao(a: string, b: string): number {
  const p = (s: string) => String(s).replace(/^v/, '').split(/[.+-]/).map(x => /^\d+$/.test(x) ? +x : x);
  const x = p(a), y = p(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const u = x[i] ?? 0, w = y[i] ?? 0; if (u === w) continue;
    if (typeof u === 'number' && typeof w === 'number') return u - w;
    if (typeof u === 'number') return 1; if (typeof w === 'number') return -1;   // 1.0.0 > 1.0.0-beta
    return String(u) < String(w) ? -1 : 1;
  }
  return 0;
}
// a menor versão corrigida acima da atual, para este pacote
export function correcaoDe(v: any, d: Dependencia): string | null {
  const fixes: string[] = [];
  for (const a of v?.affected || []) {
    if (String(a?.package?.name || '').toLowerCase() !== d.nome.toLowerCase()) continue;
    for (const r of a?.ranges || []) for (const e of r?.events || []) if (e?.fixed && r.type !== 'GIT') fixes.push(String(e.fixed));
  }
  const acima = fixes.filter(f => cmpVersao(f, d.versao) > 0).sort(cmpVersao);
  return acima[0] || null;
}

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); };

export async function analisarDependencias(deps: Dependencia[], buscar: typeof fetch, opc: { maxDetalhes?: number } = {}): Promise<{ achados: Achado[]; erro?: string; lidas: number }> {
  if (!deps.length) return { achados: [], lidas: 0 };
  try {
    // 1. quais versões têm aviso (até 1000 por chamada, regra da OSV)
    const comAviso: { d: Dependencia; ids: string[] }[] = [];
    for (let i = 0; i < deps.length; i += 1000) {
      const lote = deps.slice(i, i + 1000);
      const r = await buscar('https://api.osv.dev/v1/querybatch', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ queries: lote.map(d => ({ package: { ecosystem: d.ecossistema, name: d.nome }, version: d.versao })) }), signal: AbortSignal.timeout(25000) });
      if (!r.ok) return { achados: [], lidas: deps.length, erro: 'a base de falhas conhecidas (OSV) respondeu ' + r.status };
      const j = await r.json();
      (j.results || []).forEach((res: any, k: number) => { const ids = ((res && res.vulns) || []).map((v: any) => String(v.id)); if (ids.length) comAviso.push({ d: lote[k], ids }); });
    }
    // 2. o detalhe de cada aviso (gravidade, códigos CVE e a versão que corrige), uma vez por aviso
    const todos = [...new Set(comAviso.flatMap(x => x.ids))].slice(0, opc.maxDetalhes ?? 300);
    const det = new Map<string, any>(); let faltou = 0;
    for (let i = 0; i < todos.length; i += 10) await Promise.all(todos.slice(i, i + 10).map(async id => {
      try { const r = await buscar('https://api.osv.dev/v1/vulns/' + encodeURIComponent(id), { signal: AbortSignal.timeout(15000) }); if (r.ok) det.set(id, await r.json()); else faltou++; } catch { faltou++; }
    }));
    // 3. um achado por biblioteca e versão, com a pior gravidade entre os avisos
    const out: Achado[] = [];
    for (const { d, ids } of comAviso) {
      let pior: Gravidade = 'baixa', corrige: string | null = null; const codigos: string[] = [];
      for (const id of ids) {
        const v = det.get(id); const g: Gravidade = v ? gravidadeDe(v) : 'alta';
        if (PESO[g] > PESO[pior]) pior = g;
        const cve = (v?.aliases || []).find((a: string) => /^CVE-/.test(a)); codigos.push(cve ? cve + ' (' + id + ')' : id);
        const f = v ? correcaoDe(v, d) : null; if (f && (!corrige || cmpVersao(f, corrige) > 0)) corrige = f;   // a que corrige TODOS os avisos
      }
      const n = ids.length;
      out.push({ regra: 'DEP-01', gravidade: pior,
        titulo: (d.nome + ' ' + d.versao + ': ' + n + (n === 1 ? ' falha conhecida' : ' falhas conhecidas') + (d.aproximada ? ' (versão aproximada: o projeto não tem arquivo de travas)' : '')).slice(0, 300),
        onde: (d.arquivo + ' · ' + d.ecossistema).slice(0, 500),
        trecho: ((corrige ? 'Corrige na versão ' + corrige + '. ' : 'Ainda sem versão corrigida. ') + codigos.slice(0, 5).join(', ') + (n > 5 ? ' e mais ' + (n - 5) : '') + '. Detalhes em osv.dev').slice(0, 400),
        impressao: hash('DEP-01|' + d.arquivo + '|' + d.ecossistema + d.nome + d.versao) });
    }
    const erro = faltou ? 'não deu para ler o detalhe de ' + faltou + ' aviso(s): a gravidade deles ficou como alta' : todos.length < new Set(comAviso.flatMap(x => x.ids)).size ? 'muitos avisos: só os 300 primeiros têm o detalhe lido' : undefined;
    return { achados: out, erro, lidas: deps.length };
  } catch (e) { return { achados: [], lidas: deps.length, erro: 'não deu para consultar a base de falhas conhecidas: ' + String((e as Error)?.message || e).slice(0, 120) }; }
}
