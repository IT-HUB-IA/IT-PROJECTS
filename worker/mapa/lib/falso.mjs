// O "banco de mentira" do Mapa do Sistema: responde a cópia do sistema como se fosse o banco e a API de verdade,
// com dados de exemplo no formato das tabelas reais (lidas pela função mapa-trabalho, só a estrutura).
// Nada sai daqui para o mundo: toda chamada é respondida aqui e anotada (o que leu, o que gravou, o que chamou).
//   * Supabase (REST, RPC, Auth, Storage, Functions, Realtime) em qualquer endereço: *.supabase.co ou /rest/v1, /auth/v1...
//   * API própria (/api/clientes, https://api.empresa.com/pedidos): se o caminho bate com o nome de uma tabela, conta como a tabela.
// Cada valor de texto é um marcador único (ex.: mq0a3k): se aparecer na tela, sabemos qual coluna a tela mostra.
import { createHash } from 'node:crypto';

const NOMES_PAPEL = /^(nivel|nível|papel|role|roles|perfil|cargo|tipo_usuario|tipo_acesso|tipo_perfil|permissao|permissão|funcao|função|acesso|grupo|nivel_acesso|user_role|access_level)$/i;
const TABELA_PESSOA = /(usuari|user|pessoa|perfil|profile|membro|member|colaborador|funcionari|conta|account|equipe|staff|admin)/i;
export const ESPECIAIS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns', 'or', 'and', 'not']);

const b64url = (s) => Buffer.from(typeof s === 'string' ? s : JSON.stringify(s)).toString('base64url');
export function jwtFalso(claims) { return b64url({ alg: 'HS256', typ: 'JWT' }) + '.' + b64url(claims) + '.' + b64url('assinatura-do-mapa-falso'); }
const uuidDe = (txt) => { const h = createHash('sha1').update(txt).digest('hex'); return h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-8' + h.slice(17, 20) + '-' + h.slice(20, 32); };

// os papéis do sistema, pelas regras de valor do banco (ex.: pessoas.nivel in ('colaborador','gerente','diretor'))
export function papeisDoBanco(bancos) {
  const achados = [];
  for (const b of bancos || []) for (const c of b.checagens || []) {
    const r = String(c.regra || '');
    let col = null, valores = [];
    let m = /\(?\(?"?(\w+)"?\)?(?:::\w+)?\s*=\s*ANY\s*\(\s*\(?ARRAY\s*\[([^\]]*)\]/i.exec(r);
    if (m) { col = m[1]; valores = [...m[2].matchAll(/'((?:[^']|'')*)'/g)].map(x => x[1]); }
    else if ((m = /"?(\w+)"?\s+IN\s*\(([^)]*)\)/i.exec(r))) { col = m[1]; valores = [...m[2].matchAll(/'((?:[^']|'')*)'/g)].map(x => x[1]); }
    if (!col || valores.length < 2 || valores.length > 8 || !NOMES_PAPEL.test(col)) continue;
    achados.push({ tabela: c.tabela, coluna: col, valores, peso: (TABELA_PESSOA.test(c.tabela) ? 2 : 0) + (/^(nivel|papel|role|perfil|cargo)$/i.test(col) ? 1 : 0) });
  }
  achados.sort((a, b) => b.peso - a.peso);
  return achados[0] || null;
}

// do papel mais alto para o mais baixo (para responder as perguntas de sim ou não do banco, como "sou_dono_sistema")
const ORDEM_PAPEIS = ['ceo', 'dono', 'owner', 'master', 'super', 'admin', 'diretor', 'director', 'gerente', 'manager', 'coordenador', 'supervisor', 'lider', 'líder', 'dev', 'desenvolvedor',
  'colaborador', 'funcionario', 'funcionário', 'atendente', 'operador', 'vendedor', 'user', 'usuario', 'usuário', 'membro', 'cliente', 'stakeholder', 'convidado', 'guest', 'leitor', 'viewer'];
export function papelMaisAlto(valores) {
  const nota = (v) => { const i = ORDEM_PAPEIS.findIndex(k => String(v).toLowerCase().includes(k)); return i < 0 ? 99 : i; };
  return [...(valores || [])].sort((a, b) => nota(a) - nota(b))[0] || null;
}

export class Falso {
  // bancos: [{estrutura, checagens}] · papel: o papel desta volta (ou null) · regraPapel: o que papeisDoBanco achou
  constructor({ bancos = [], papel = null, regraPapel = null, logado = true } = {}) {
    this.tabelas = new Map();            // "esquema.nome" e "nome" -> tabela
    this.funcoes = new Map();            // nome -> {devolve, varias} (public primeiro)
    this.checks = new Map();             // "tabela.coluna" -> valores permitidos
    for (const b of bancos) {
      for (const t of b.estrutura?.tabelas || []) { this.tabelas.set(t.esquema + '.' + t.nome, t); if (!this.tabelas.has(t.nome)) this.tabelas.set(t.nome, t); }
      for (const f of b.funcoes || []) if (!this.funcoes.has(f.nome) || f.esquema === 'public') this.funcoes.set(f.nome, f);
      for (const c of b.checagens || []) {
        const r = String(c.regra || ''); const m = /"?(\w+)"?\)?(?:::\w+)?\s*=\s*ANY\s*\(\s*\(?ARRAY\s*\[([^\]]*)\]/i.exec(r) || /"?(\w+)"?\s+IN\s*\(([^)]*)\)/i.exec(r);
        if (m) { const v = [...m[2].matchAll(/'((?:[^']|'')*)'/g)].map(x => x[1]); if (v.length) this.checks.set(c.tabela + '.' + m[1], v); }
      }
    }
    this.papel = papel; this.regraPapel = regraPapel; this.logado = logado;
    this.eventos = [];                   // tudo o que o sistema pediu
    this.marcas = new Map();             // marcador -> {tabela, coluna}
    this.porColuna = new Map();          // "tabela.coluna" -> marcador
    this.numeros = new Map();            // número marcado (texto dos dígitos) -> {tabela, coluna}
    this.porNumero = new Map();          // "tabela.coluna" -> número
    this.usuario = { id: uuidDe('pessoa-do-mapa-' + (papel || 'logado')), email: 'pessoa.mapa@exemplo.com' };
    this.n = 0;
  }
  get temBanco() { return this.tabelas.size > 0; }
  tabela(nome, esquema) { return this.tabelas.get((esquema || 'public') + '.' + nome) || this.tabelas.get(nome) || null; }

  marcador(tabela, coluna) {
    const k = tabela + '.' + coluna;
    let m = this.porColuna.get(k);
    if (!m) { m = 'mq' + (this.porColuna.size + 1296).toString(36).padStart(3, '0').slice(-3) + 'k'; this.porColuna.set(k, m); this.marcas.set(m, { tabela, coluna }); }
    return m;
  }
  // números marcados: 48 mil e pouco, um por coluna (aparecem como 48007, 48.007 ou 48.007,00 na tela)
  numero(tabela, coluna) {
    const k = tabela + '.' + coluna; let v = this.porNumero.get(k);
    if (v === undefined) { v = 48000 + (this.porNumero.size + 1) * 7; this.porNumero.set(k, v); this.numeros.set(String(v), { tabela, coluna }); }
    return v;
  }
  // as colunas cujos marcadores aparecem num texto da tela
  colunasNoTexto(txt) {
    const out = [];
    for (const m of new Set(String(txt || '').match(/mq[0-9a-z]{3}k/g) || [])) { const x = this.marcas.get(m); if (x) out.push(x); }
    for (const m of String(txt || '').matchAll(/\b4[89][\d.,\s]{3,9}/g)) { const d = m[0].replace(/[.,\s]\d{2}$/, '').replace(/\D/g, ''); const x = this.numeros.get(d); if (x) out.push(x); }
    return out;
  }
  sessao() {
    const agora = Math.floor(Date.now() / 1000);
    const meta = this.papel && this.regraPapel ? { [this.regraPapel.coluna]: this.papel, role: this.papel, papel: this.papel } : {};
    const user = { id: this.usuario.id, aud: 'authenticated', role: 'authenticated', email: this.usuario.email, email_confirmed_at: '2026-01-01T00:00:00Z',
      app_metadata: { provider: 'email', ...meta }, user_metadata: { nome: 'Pessoa do Mapa', name: 'Pessoa do Mapa', ...meta }, created_at: '2026-01-01T00:00:00Z' };
    const access_token = jwtFalso({ sub: user.id, aud: 'authenticated', role: 'authenticated', email: user.email, exp: agora + 86400 * 30, iat: agora, app_metadata: user.app_metadata, user_metadata: user.user_metadata });
    return { access_token, token_type: 'bearer', expires_in: 86400 * 30, expires_at: agora + 86400 * 30, refresh_token: 'renovar-mapa-falso', user };
  }

  valor(t, col, i, filtros) {
    const f = filtros ? filtros[col.nome] : undefined;
    if (f !== undefined) return f;
    const tipo = String(col.tipo || '').toLowerCase(), nome = col.nome;
    if (this.regraPapel && this.papel && this.regraPapel.tabela === t.nome && this.regraPapel.coluna === nome) return this.papel;
    const permitido = this.checks.get(t.nome + '.' + nome);
    if (permitido) return (this.papel && permitido.includes(this.papel)) ? this.papel : permitido[i % permitido.length];
    const fk = (t.restricoes || []).find(r => r.tipo === 'f' && r.cols?.length === 1 && r.cols[0] === nome);
    if (tipo.endsWith('[]')) return [];
    if (tipo === 'uuid') {
      if (fk) return uuidDe(fk.ref_tabela + ':' + i);
      if (/^(auth_)?user_id|auth_user_id|usuario_id|owner_id|criado_por$/i.test(nome)) return this.usuario.id;
      return uuidDe(t.nome + ':' + i);
    }
    if (/^(smallint|integer|bigint|int|int2|int4|int8|serial|bigserial)/.test(tipo)) return fk || nome === 'id' || /(^|_)(ordem|posicao|nivel|versao|ano|mes|dia)$/.test(nome) ? i + 1 : this.numero(t.nome, nome) + i * 0;
    if (/^(numeric|decimal|real|double|float|money)/.test(tipo)) return this.numero(t.nome, nome);
    if (tipo === 'boolean' || tipo === 'bool') return i % 2 === 0;
    if (/^timestamp|^timestamptz/.test(tipo)) return new Date(Date.UTC(2026, 8, 1 + i, 12)).toISOString();
    if (tipo === 'date') return new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10);
    if (/^time/.test(tipo)) return '09:3' + (i % 10) + ':00';
    if (/^jsonb?$/.test(tipo)) return col.nao_nulo ? (/s$/.test(nome) ? [] : {}) : null;
    if (/^(text|character|varchar|citext|name|char|bpchar)/.test(tipo) || tipo === '') {
      const m = this.marcador(t.nome, nome);
      if (/e-?mail/i.test(nome)) return m + (i ? i : '') + '@exemplo.com';
      if (/(url|link|site|foto|imagem|avatar|logo)/i.test(nome)) return 'https://exemplo.com/' + m;
      if (/(cor|color)$/i.test(nome)) return '#3366cc';
      return m + (i ? ' ' + (i + 1) : '');
    }
    return null;
  }
  linha(t, i, filtros) { const o = {}; for (const c of t.colunas || []) o[c.nome] = this.valor(t, c, i, filtros); return o; }

  // select=*,cliente:clientes(nome),itens(*) -> árvore
  static lerSelect(s) {
    const out = []; let i = 0; s = String(s || '*');
    const item = () => {
      let tok = ''; while (i < s.length && !',()'.includes(s[i])) tok += s[i++];
      tok = tok.trim(); const n = { campo: tok, filhos: null };
      if (s[i] === '(') { i++; n.filhos = lista(); if (s[i] === ')') i++; }
      return n;
    };
    const lista = () => { const l = [item()]; while (s[i] === ',') { i++; l.push(item()); } return l; };
    out.push(...lista());
    return out.filter(x => x.campo);
  }
  montar(t, i, sel, filtros, usadas) {
    const tudo = sel.some(x => x.campo === '*' && !x.filhos);
    const base = this.linha(t, i, filtros), o = {};
    for (const x of sel) {
      if (x.campo === '*' && !x.filhos) continue;
      let campo = x.campo.replace(/::\w+$/, ''), alias = null;
      if (campo.includes(':')) { [alias, campo] = campo.split(':'); }
      const nome = campo.split('!')[0].replace(/^\.\.\./, '');
      if (x.filhos) {
        const alvo = this.tabela(nome);
        if (!alvo) { usadas.push({ tabela: nome, coluna: null, embutida: true }); o[alias || nome] = null; continue; }
        const fk = (t.restricoes || []).find(r => r.tipo === 'f' && r.ref_tabela === alvo.nome);
        const filhos = (k) => this.montar(alvo, k, x.filhos, null, usadas);
        o[alias || nome] = fk ? filhos(i) : [filhos(0), filhos(1)];
        usadas.push({ tabela: alvo.nome, coluna: '*embutida', embutida: true });
        continue;
      }
      const col = nome.split('->')[0];
      usadas.push({ tabela: t.nome, coluna: col });
      o[alias || col] = col in base ? base[col] : null;
    }
    return tudo ? { ...base, ...o } : o;
  }

  // filtros do PostgREST: col=eq.x, col=in.(a,b), col=is.null
  static filtros(params) {
    const f = {}, cols = [];
    for (const [k, v] of params) {
      if (ESPECIAIS.has(k)) continue;
      cols.push(k.split('->')[0]);
      const m = /^(eq|is|in)\.(.*)$/.exec(v);
      if (!m) continue;
      if (m[1] === 'eq') f[k] = m[2] === 'true' ? true : m[2] === 'false' ? false : (/^-?\d+$/.test(m[2]) ? Number(m[2]) : decodeURIComponent(m[2]));
      else if (m[1] === 'is') f[k] = m[2] === 'null' ? null : m[2] === 'true';
      else { const l = m[2].replace(/^\(|\)$/g, '').split(','); f[k] = l[0].replace(/^"|"$/g, ''); }
    }
    return { f, cols };
  }

  anotar(e) { e.n = ++this.n; this.eventos.push(e); return e; }

  // responde uma chamada; devolve null quando não é com o banco/API (o navegador segue normal)
  responder({ url, metodo, cabecalhos = {}, corpo }) {
    const u = new URL(url), p = u.pathname, h = Object.fromEntries(Object.entries(cabecalhos).map(([k, v]) => [k.toLowerCase(), v]));
    const json = (status, obj, extra = {}) => ({ status, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', ...extra }, body: obj === undefined ? '' : JSON.stringify(obj) });
    let dados = null; try { dados = corpo ? JSON.parse(corpo) : null; } catch { dados = null; }
    if (metodo === 'OPTIONS') return { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: '' };
    let m;
    // ---------- Supabase Auth ----------
    if ((m = /\/auth\/v1\/(.*)$/.exec(p))) {
      const acao = m[1];
      this.anotar({ tipo: 'auth', acao, metodo, corpo: String(corpo || '').slice(0, 2000) });
      if (/^token/.test(acao)) return json(200, this.sessao());
      if (acao === 'user') return this.logado ? json(200, this.sessao().user) : json(401, { msg: 'sem sessão' });
      if (acao === 'logout') return json(204, undefined);
      if (acao === 'settings') return json(200, { external: { email: true }, disable_signup: false });
      return json(200, {});
    }
    // ---------- Supabase Storage ----------
    if ((m = /\/storage\/v1\/(.*)$/.exec(p))) {
      this.anotar({ tipo: 'storage', acao: m[1].split('/').slice(0, 3).join('/'), metodo });
      if (/^object\/list\//.test(m[1])) return json(200, []);
      if (/^object\/sign\//.test(m[1])) return json(200, { signedURL: '/storage/v1/object/sign/mapa?token=x', signedUrl: '/storage/v1/object/sign/mapa?token=x' });
      if (metodo === 'GET') return { status: 200, headers: { 'content-type': 'application/octet-stream', 'access-control-allow-origin': '*' }, body: '' };
      return json(200, { Key: m[1], Id: uuidDe(m[1]) });
    }
    // ---------- Supabase Edge Functions ----------
    if ((m = /\/functions\/v1\/([^/?]+)/.exec(p))) {
      this.anotar({ tipo: 'funcao', nome: m[1], metodo, chaves: dados && typeof dados === 'object' ? Object.keys(dados).slice(0, 50) : [], corpo: String(corpo || '').slice(0, 4000) });
      return json(200, {});
    }
    // ---------- Supabase REST: RPC ----------
    if ((m = /\/rest\/v1\/rpc\/([^/?]+)/.exec(p))) {
      const f = this.funcoes.get(m[1]);
      this.anotar({ tipo: 'rpc', nome: m[1], metodo, existe: this.funcoes.size ? !!f : null, chaves: dados && typeof dados === 'object' ? Object.keys(dados).slice(0, 50) : [], corpo: String(corpo || '').slice(0, 4000) });
      if (!f && this.funcoes.size) return json(404, { code: 'PGRST202', message: 'Could not find the function public.' + m[1] + ' (mapa: a função não existe no banco ligado)' });
      return json(200, f ? this.respostaFuncao(f, /vnd\.pgrst\.object/.test(h['accept'] || '')) : null);
    }
    // ---------- Supabase REST: tabelas ----------
    if ((m = /\/rest\/v1\/([^/?]+)/.exec(p))) return this.tabelaRest(m[1], u, metodo, h, dados, corpo, json, 'supabase');
    // ---------- API própria: o caminho bate com uma tabela? ----------
    if (h['x-mapa-tipo'] === 'fetch' || h['x-mapa-tipo'] === 'xhr') {
      const partes = p.split('/').filter(Boolean).map(x => decodeURIComponent(x));
      const nomeT = partes.slice().reverse().find(x => this.tabela(x) || this.tabela(x + 's') || this.tabela(x.replace(/s$/, '')));
      if (nomeT && this.temBanco) {
        const t = this.tabela(nomeT) || this.tabela(nomeT + 's') || this.tabela(nomeT.replace(/s$/, ''));
        return this.tabelaRest(t.nome, u, metodo, h, dados, corpo, json, 'api');
      }
      this.anotar({ tipo: 'api', metodo, host: u.host, caminho: p.slice(0, 300), chaves: dados && typeof dados === 'object' && !Array.isArray(dados) ? Object.keys(dados).slice(0, 50) : [], corpo: String(corpo || '').slice(0, 4000) });
      return json(200, metodo === 'GET' ? [] : {});
    }
    return null;
  }

  // o que uma função devolve, no formato da assinatura dela (TABLE(...), SETOF tabela, tabela, json, boolean, número, texto...)
  respostaFuncao(f, um) {
    const dev = String(f.devolve || '').trim(), tipo = dev.toLowerCase();
    let m;
    if ((m = /^table\s*\((.*)\)$/is.exec(dev))) {
      const cols = m[1].split(/,(?![^(]*\))/).map(x => x.trim()).filter(Boolean).map(x => { const k = /^"?([\w]+)"?\s+(.*)$/.exec(x); return k ? { nome: k[1], tipo: k[2], nao_nulo: false } : null; }).filter(Boolean);
      const t = { nome: 'fn_' + f.nome, colunas: cols, restricoes: [] };
      const linhas = [0, 1].map(i => { const o = this.linha(t, i, null); if (this.regraPapel && this.papel) for (const c of cols) if (c.nome === this.regraPapel.coluna) o[c.nome] = this.papel; return o; });
      return um || !f.varias ? linhas[0] : linhas;
    }
    const nomeT = (/^setof\s+(.*)$/i.exec(dev) || [, dev])[1].replace(/^public\./, '').replace(/"/g, '');
    const t = this.tabela(nomeT.split('.').pop());
    if (t) { const linhas = [0, 1].map(i => this.linha(t, i, null)); return um || !f.varias ? linhas[0] : linhas; }
    if (/^setof/.test(tipo)) return [];
    if (tipo === 'void') return null;
    if (/^(boolean|bool)$/.test(tipo)) { this.simNao = true; return !this.papel || !this.regraPapel || this.papel === papelMaisAlto(this.regraPapel.valores); }
    if (/^(integer|bigint|smallint|numeric|real|double)/.test(tipo)) return 1;
    if (tipo === 'uuid') return uuidDe('fn:' + f.nome);
    if (/^jsonb?$/.test(tipo)) return {};
    if (/\[\]$/.test(tipo)) return [];
    if (/^(text|character|varchar)/.test(tipo)) return this.marcador('fn_' + f.nome, 'resultado');
    if (/^timestamp|^date/.test(tipo)) return new Date(Date.UTC(2026, 8, 1)).toISOString();
    return null;
  }

  tabelaRest(nome, u, metodo, h, dados, corpoTxt, json, via) {
    const esquema = h['accept-profile'] || h['content-profile'] || 'public';
    const t = this.tabela(nome, esquema);
    const { f, cols } = Falso.filtros(u.searchParams);
    const ev = this.anotar({ tipo: metodo === 'GET' || metodo === 'HEAD' ? 'le' : 'grava', via, metodo, tabela: nome, esquema, existe: !!t, colunas: [], filtros: cols, corpo: String(corpoTxt || '').slice(0, 8000) });
    if (!t) {
      if (via === 'supabase') return json(404, { code: '42P01', message: 'relation "' + nome + '" does not exist (mapa: a tabela não existe no banco ligado)' });
      return json(200, metodo === 'GET' ? [] : {});
    }
    const usadas = [];
    const sel = Falso.lerSelect(u.searchParams.get('select') || '*');
    if (metodo === 'GET' || metodo === 'HEAD') {
      const lim = Math.min(Number(u.searchParams.get('limit') || 3) || 3, 3);
      const linhas = Array.from({ length: lim }, (_, i) => this.montar(t, i, sel, f, usadas));
      ev.colunas = [...new Set(usadas.filter(x => x.tabela === t.nome).map(x => x.coluna))];
      ev.embutidas = usadas.filter(x => x.embutida).map(x => x.tabela);
      ev.tudo = sel.some(x => x.campo === '*' && !x.filhos);
      const um = /vnd\.pgrst\.object/.test(h['accept'] || '');
      const extra = { 'content-range': '0-' + (lim - 1) + '/' + lim };
      if (metodo === 'HEAD') return json(200, undefined, extra);
      return json(200, um ? linhas[0] : linhas, extra);
    }
    // grava: as chaves do corpo são as colunas
    const lista = Array.isArray(dados) ? dados : (dados && typeof dados === 'object' ? [dados] : []);
    ev.colunas = [...new Set(lista.flatMap(x => Object.keys(x || {})))];
    ev.valores = lista.slice(0, 20).map(x => Object.fromEntries(Object.entries(x || {}).map(([k, v]) => [k, typeof v === 'string' ? v.slice(0, 200) : v])));
    const prefer = h['prefer'] || '';
    if (metodo === 'DELETE' || !/return=representation/.test(prefer)) return json(metodo === 'POST' ? 201 : 204, undefined);
    const linhas = (lista.length ? lista : [{}]).map((x, i) => ({ ...this.linha(t, i, f), ...x }));
    return json(metodo === 'POST' ? 201 : 200, /vnd\.pgrst\.object/.test(h['accept'] || '') ? linhas[0] : linhas);
  }
}
