// Percorre a cópia rodando como uma pessoa de um papel: abre, clica em cada coisa, abre as janelas, preenche os campos
// e anota tudo (para onde leva, o que abre, o que lê e grava no banco de mentira, o que fica só no navegador).
// Toda chamada para fora vai para o banco de mentira (falso.mjs); nada chega a sistema nenhum de verdade.
// As bibliotecas que a página carrega por <script> (CDN) passam: são só leitura e sem elas a página não abre.
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';

// bibliotecas de CDN (scripts e estilos): baixadas uma vez pelo trabalhador e entregues à página. Com proxy de saída
// (HTTPS_PROXY), o curl usa o proxy; o navegador nunca sai para a rede sozinho.
const CDN = new Map();
let nCdn = 0;
function baixarCdn(url) {
  if (!CDN.has(url)) CDN.set(url, new Promise((ok) => {
    const arq = join(tmpdir(), 'mapa-cdn-' + process.pid + '-' + (++nCdn));
    execFile('curl', ['-sSL', '--max-time', '25', '--max-filesize', '15000000', '-o', arq, '-w', '%{http_code} %{content_type}', url], { encoding: 'utf8' }, (erro, saida) => {
      const [st, ...tp] = String(saida || '').trim().split(' ');
      let body = null; try { body = readFileSync(arq); rmSync(arq, { force: true }); } catch { /* não baixou */ }
      ok(!erro && body && Number(st) >= 200 && Number(st) < 300 ? { status: 200, contentType: tp.join(' ') || 'application/javascript', body } : null);
    });
  }));
  return CDN.get(url);
}

const FOTO = readFileSync(new URL('./foto.js', import.meta.url), 'utf8');
const SAIR = /^(sair|logout|log out|sign out|desconectar|encerrar sess[aã]o|deslogar)$/i;
const ENVIAR = /^(salvar|gravar|criar|enviar|confirmar|adicionar|cadastrar|ok|concluir|registrar|atualizar|aplicar|guardar|incluir|inserir|publicar|save|submit|create|add|send|confirm|update|apply|entrar|continuar)\b/i;
const FECHAR = /^(fechar|cancelar|close|cancel|voltar|×|✕|x|não|nao)$/i;
const MARCA = /mq[0-9a-z]{3}k/g;
const esperar = (ms) => new Promise(r => setTimeout(r, ms));
const DEP = process.env.MAPA_DEPURAR ? (...a) => console.log('   ·', ...a) : () => {};
export const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'sem-nome';

// valores que passam nas conferências mais comuns (CPF, CNPJ, CEP, telefone, endereço, e-mail), cada um único para achar depois
function dv(n, pesos) { const s = n.reduce((a, d, i) => a + d * pesos[i], 0) % 11; return s < 2 ? 0 : 11 - s; }
export function valorPara(c, k) {
  const d = String(c.rotulo || '') + ' ' + String(c.dica || '') + ' ' + String(c.nome || ''), t = c.tipoCampo;
  const semente = String(10000000 + k * 7919).slice(-8);
  if (t === 'number' || t === 'range') { const mn = Number(c.min), mx = Number(c.max); const v = Number.isFinite(mn) && Number.isFinite(mx) ? Math.round(mn + (mx - mn) * ((k % 7) + 1) / 9) : 70000 + k; return { v: String(v) }; }
  if (t === 'date') return { v: '2031-' + String(1 + (k % 12)).padStart(2, '0') + '-' + String(1 + (k % 28)).padStart(2, '0') };
  if (t === 'time') return { v: String(8 + (k % 10)).padStart(2, '0') + ':' + String(k % 60).padStart(2, '0') };
  if (t === 'datetime-local') return { v: '2031-03-' + String(1 + (k % 28)).padStart(2, '0') + 'T10:' + String(k % 60).padStart(2, '0') };
  if (t === 'email' || /e-?mail/i.test(d)) return { v: 'mqf' + k + 'z@exemplo.com' };
  if (t === 'password' || /senha|password/i.test(d)) return { v: 'Mqf' + k + 'z!Senha9' };
  if (t === 'url' || /\b(url|site|link|endere[cç]o \(site|https?)\b/i.test(d)) return { v: 'https://mqf' + k + 'z.exemplo.com' };
  if (/\bcpf\b/i.test(d)) { const n = ('3' + semente).slice(0, 9).split('').map(Number); n.push(dv(n, [10, 9, 8, 7, 6, 5, 4, 3, 2])); n.push(dv(n, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])); const x = n.join(''); return { v: x.slice(0, 3) + '.' + x.slice(3, 6) + '.' + x.slice(6, 9) + '-' + x.slice(9), busca: x }; }
  if (/\bcnpj\b/i.test(d)) { const n = (semente + '0001').split('').map(Number); n.push(dv(n, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])); n.push(dv(n, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])); const x = n.join(''); return { v: x.slice(0, 2) + '.' + x.slice(2, 5) + '.' + x.slice(5, 8) + '/' + x.slice(8, 12) + '-' + x.slice(12), busca: x }; }
  if (/\bcep\b/i.test(d)) { const x = ('0' + semente).slice(0, 8); return { v: x.slice(0, 5) + '-' + x.slice(5), busca: x }; }
  if (t === 'tel' || /telefone|celular|whats|fone|phone/i.test(d)) { const x = '119' + semente; return { v: '(11) 9' + semente.slice(0, 4) + '-' + semente.slice(4), busca: x }; }
  if (/\buf\b|estado \(uf\)/i.test(d) && (!c.maxlength || c.maxlength <= 2)) return { v: 'SP', busca: null };
  const v = 'mqf' + k + 'z';
  return { v: c.maxlength && c.maxlength < v.length ? v.slice(0, c.maxlength) : v };
}

export async function percorrer({ navegador, url, paginas = [], falso, papel, rotuloPapel, tempoMs = 360_000, maxTelas = 60, maxCliques = 30, log = () => {} }) {
  const t0 = Date.now(), base = new URL(url), cedo = () => Date.now() - t0 > tempoMs;
  const ctx = await navegador.newContext({ viewport: { width: 1366, height: 860 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', serviceWorkers: 'block', acceptDownloads: false, permissions: ['clipboard-read', 'clipboard-write'] });
  const r = { telas: [], janelas: [], eventos: [], guardados: [], erros: [], externos: [], lacunas: [], campos: [], cliques: [] };
  let acao = null, pendentes = 0;
  const sessao = falso.logado ? falso.sessao() : null;
  await ctx.exposeBinding('__mapaAnota', (_s, x) => { r.guardados.push({ ...x, acao }); });
  await ctx.addInitScript(({ sessao }) => {
    try {
      if (sessao) {
        const ref = (location.hostname && 'mapafalso');
        const guardar = (k) => { try { localStorage.setItem(k, JSON.stringify(sessao)); } catch (e) { /* sem storage */ } };
        window.__mapaSessao = sessao; window.__mapaGuardarSessao = guardar;
        // a chave de sessão do Supabase usa o código do projeto (sb-<código>-auth-token): grava para os endereços que o código citar
        const orig = Object.getOwnPropertyDescriptor(Storage.prototype, 'getItem');
        Storage.prototype.getItem = function (k) { const v = orig.value.call(this, k); if (v == null && /^sb-[a-z0-9]+-auth-token$/.test(String(k))) return JSON.stringify(sessao); return v; };
        guardar('sb-' + ref + '-auth-token');
      }
      const anota = (x) => { try { window.__mapaAnota(x); } catch (e) { /* ainda não ligou */ } };
      // os valores de teste (mqf12z, CPF, telefone...) procurados no valor INTEIRO aqui dentro: só a lista vai para fora
      const marcasDe = (v) => { const t = String(v); return [...new Set((t.match(/mqf\d+z|\d{8,14}/g) || []))].slice(0, 400); };
      const SET = Storage.prototype.setItem, DEL = Storage.prototype.removeItem;
      Storage.prototype.setItem = function (k, v) { if (!/^(sb-|supabase\.|lswt-|lock:|__|_ga|_gid|amplitude|mp_|ajs_|intercom|hubspot|debug$|loglevel|ally-supports|i18next|plausible)/i.test(String(k))) anota({ area: this === window.sessionStorage ? 'sessionStorage' : 'localStorage', chave: String(k).slice(0, 200), valor: String(v).slice(0, 2000), marcas: marcasDe(v) }); return SET.call(this, k, v); };
      Storage.prototype.removeItem = function (k) { return DEL.call(this, k); };
      if (window.IDBObjectStore) for (const m of ['put', 'add']) { const o = IDBObjectStore.prototype[m]; IDBObjectStore.prototype[m] = function (v, k) { try { const j = JSON.stringify(v); anota({ area: 'IndexedDB', chave: this.name, valor: j.slice(0, 2000), marcas: marcasDe(j) }); } catch (e) { anota({ area: 'IndexedDB', chave: this.name, valor: '' }); } return o.apply(this, arguments); }; }
      const ck = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
      if (ck) Object.defineProperty(document, 'cookie', { get() { return ck.get.call(document); }, set(v) { anota({ area: 'cookie', chave: String(v).split('=')[0].slice(0, 200), valor: String(v).slice(0, 2000) }); ck.set.call(document, v); }, configurable: true });
      window.open = function (u) { anota({ area: 'abrir', chave: String(u || '').slice(0, 500), valor: '' }); return null; };
      window.alert = function () {}; window.confirm = function () { return true; }; window.prompt = function () { return 'mqprk'; };
    } catch (e) { /* segue sem a anotação */ }
  }, { sessao });
  // todo pedido para fora: banco de mentira; bibliotecas por <script>/css/fonte/imagem passam; páginas de outro endereço viram "saiu do sistema"
  await ctx.route('**/*', async (rota) => {
    const q = rota.request(), u = new URL(q.url()), tipo = q.resourceType();
    if (u.protocol === 'data:' || u.protocol === 'blob:') return rota.continue();
    if (u.origin === base.origin) return rota.continue();
    // imagens, fontes e mídia de fora: respondidas vazias na hora (não mudam o que a tela faz e só atrasariam)
    if (['image', 'font', 'media'].includes(tipo)) return rota.fulfill({ status: 204, body: '' });
    const conta = ['fetch', 'xhr', 'document', 'eventsource', 'other'].includes(tipo);
    if (conta) pendentes++;
    try {
      const resp = falso.responder({ url: q.url(), metodo: q.method(), cabecalhos: { ...q.headers(), 'x-mapa-tipo': tipo }, corpo: q.postData() });
      if (resp) { const ultimo = falso.eventos[falso.eventos.length - 1]; if (ultimo && !ultimo.acao) ultimo.acao = acao; return await rota.fulfill(resp); }
      if (q.method() === 'GET' && ['script', 'stylesheet'].includes(tipo)) {
        const b = await baixarCdn(q.url());
        return b ? await rota.fulfill({ status: 200, contentType: b.contentType, body: b.body, headers: { 'access-control-allow-origin': '*' } }) : await rota.fulfill({ status: 404, body: '' });
      }
      if (tipo === 'document') { r.externos.push({ url: q.url().slice(0, 500), acao }); return await rota.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>fora</title><body data-mapa-fora>fora do sistema</body>' }); }
      r.externos.push({ url: q.url().slice(0, 500), acao, tipo });
      return await rota.fulfill({ status: 204, body: '' });
    } finally { if (conta) pendentes--; }
  });
  // conexões ao vivo (Realtime do Supabase e outras): aceitas e respondidas aqui, sem sair
  try {
    await ctx.routeWebSocket(/.*/, (ws) => {
      if (new URL(ws.url()).host === base.host) { ws.connectToServer(); return; }
      ws.onMessage((m) => {
        try {
          const j = JSON.parse(String(m));
          if (Array.isArray(j)) { const [jr, ref, topico, ev] = j; if (ev === 'phx_join' || ev === 'heartbeat' || ev === 'access_token') ws.send(JSON.stringify([jr, ref, topico, 'phx_reply', { status: 'ok', response: { postgres_changes: [] } }])); }
          else if (j && j.event) ws.send(JSON.stringify({ topic: j.topic, event: 'phx_reply', ref: j.ref, payload: { status: 'ok', response: { postgres_changes: [] } } }));
        } catch { /* mensagem que não é JSON */ }
      });
    });
  } catch { /* Playwright sem routeWebSocket: segue */ }

  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => r.erros.push({ msg: String(e.message || e).slice(0, 300), acao }));
  pg.on('dialog', (d) => d.accept().catch(() => {}));
  const quieto = async (max = 3500) => { const t = Date.now(); await esperar(120); let calmo = 0; while (Date.now() - t < max) { if (pendentes === 0) { if (++calmo >= 3) break; } else calmo = 0; await esperar(100); } };
  const limite = (p, ms) => Promise.race([p, new Promise((_, n) => setTimeout(() => n(new Error('demorou demais')), ms))]);
  const foto = async () => { try { return await limite(pg.evaluate(FOTO), 15_000); } catch { await esperar(300); return await limite(pg.evaluate(FOTO), 15_000).catch(() => null); } };
  const digital = (f) => createHash('sha1').update([f.caminho, f.titulo, f.janelas.join('|'), f.elementos.filter(e => e.zona !== 'menu' && e.tipo !== 'campo').slice(0, 40).map(e => e.rotulo).join('|'), f.elementos.filter(e => e.zona === 'menu' && e.ativo).map(e => e.rotulo).join('|')].join('#')).digest('hex').slice(0, 16);
  const passoDe = (e) => ({ rotulo: e.rotulo, zona: e.zona, tag: e.tag, href: e.href });
  async function clicar(e) {
    const alvo = pg.locator('[data-mapa-id="' + e.id + '"]');
    try { await limite(alvo.click({ timeout: 2500, noWaitAfter: true }), 8000); return true; }
    catch { try { await limite(alvo.click({ timeout: 1500, force: true, noWaitAfter: true }), 6000); return true; } catch { return false; } }
  }
  async function repetir(p) {
    const f = await foto(); if (!f) return false;
    const cands = f.elementos.filter(x => x.tipo === 'clique' && x.rotulo === p.rotulo && x.tag === p.tag);
    const e = cands.find(x => x.zona === p.zona) || cands[0];
    if (!e) return false;
    if (!(await clicar(e))) return false;
    await quieto(); return true;
  }
  async function ir(entrada, passos, onde) {
    const ini = falso.eventos.length;
    const ok = await irDe(entrada, passos);
    // o que se carrega ao refazer o caminho já foi anotado na primeira vez: não conta de novo
    for (const ev of falso.eventos.slice(ini)) if (!ev.acao) ev.acao = onde === '__primeira' ? null : { recarga: true };
    return ok;
  }
  async function irDe(entrada, passos) {
    DEP('ir', entrada, passos.map(p => p.rotulo).join(' > '));
    try { await limite(pg.goto(new URL(entrada, base).href, { waitUntil: 'domcontentloaded', timeout: 30_000 }), 35_000); } catch { return false; }
    await quieto(6000);
    if (falso.logado) await entrarSePreciso();
    for (const p of passos) if (!(await repetir(p))) return false;
    return true;
  }
  // volta rápida: na mesma página, fecha as janelas e refaz os cliques pelo menu, sem recarregar (bem mais rápido);
  // se não chegar na mesma tela, recarrega como antes
  async function restaurar(st, alvo) {
    const ini = falso.eventos.length;
    let ok = false;
    try {
      if (st.passos.length && st.passos[0].zona === 'menu' && new URL(pg.url()).pathname === new URL(st.entrada, base).pathname) {
        await pg.keyboard.press('Escape').catch(() => {}); await quieto(400);
        let deu = true; for (const p of st.passos) if (!(await repetir(p))) { deu = false; break; }
        const f = deu ? await foto() : null;
        ok = !!f && digital(f) === alvo;
      }
    } catch { ok = false; }
    for (const ev of falso.eventos.slice(ini)) if (!ev.acao) ev.acao = { recarga: true };
    return ok || ir(st.entrada, st.passos);
  }
  let tentouEntrar = false;
  async function entrarSePreciso() {
    const senha = pg.locator('input[type="password"]:visible');
    if (!(await senha.count().catch(() => 0))) return;
    try {
      const email = pg.locator('input[type="email"]:visible, input[name*="mail" i]:visible, input[name*="user" i]:visible, input[name*="login" i]:visible, input[autocomplete="username"]:visible, input[type="text"]:visible').first();
      if (await email.count()) await email.fill('pessoa.mapa@exemplo.com', { timeout: 1500 });
      await senha.first().fill('senha-do-mapa-falso', { timeout: 1500 });
      const botao = pg.locator('button[type="submit"]:visible, input[type="submit"]:visible').first();
      if (await botao.count()) await botao.click({ timeout: 2000, noWaitAfter: true }); else await senha.first().press('Enter');
      await quieto(5000);
      if (!tentouEntrar && (await pg.locator('input[type="password"]:visible').count().catch(() => 0))) r.lacunas.push('Papel ' + rotuloPapel + ': a tela de entrar continuou aberta depois de entrar com a sessão de mentira.');
      tentouEntrar = true;
    } catch { /* sem formulário de entrar */ }
  }
  const telaDeFoto = (f, entrada, passos, via) => ({ chave: null, digital: digital(f), titulo: f.titulo || f.tituloPagina || entrada, caminho: f.caminho, entrada, passos, via, elementos: f.elementos, janelas: f.janelas,
    texto: f.texto, vazia: f.vazia, naoAchou: f.naoAchou, papel });

  // testa os campos de um lugar (tela ou janela): preenche com marcadores e envia; vê para onde cada valor foi
  let nCampo = 0;
  async function testarCampos(f, onde, janela) {
    const campos = f.elementos.filter(e => e.tipo === 'campo' && !e.desligado && (janela ? e.janela === janela : e.zona !== 'janela'));
    if (!campos.length) return;
    const valores = [];
    for (const c of campos.slice(0, 25)) {
      const k = ++nCampo, alvo = pg.locator('[data-mapa-id="' + c.id + '"]');
      let v = null, busca = null;
      try {
        if (c.tag === 'select') { const op = (c.opcoes || []).filter(Boolean); if (op.length) { v = op[op.length - 1]; await alvo.selectOption(v, { timeout: 1200 }); } }
        else if (['checkbox', 'radio'].includes(c.tipoCampo)) { await alvo.check({ timeout: 1200 }).catch(() => {}); }
        else { ({ v, busca } = valorPara(c, k)); await alvo.fill(v, { timeout: 1200 }); }
      } catch { v = null; }
      valores.push({ campo: c, valor: v, busca: busca || v });
    }
    const antesEv = falso.eventos.length, antesG = r.guardados.length, antesDig = digital(f);
    const enviar = f.elementos.filter(e => e.tipo === 'clique' && !e.desligado && e.zona !== 'menu' && (janela ? e.janela === janela : e.zona !== 'janela'))
      .find(e => e.submit || ENVIAR.test(e.rotulo));
    acao = { onde, botao: enviar ? enviar.rotulo : null, campos: true };
    if (enviar && !SAIR.test(enviar.rotulo)) { await clicar(enviar); await quieto(); }
    else await quieto(800);
    const ev = falso.eventos.slice(antesEv), gd = r.guardados.slice(antesG);
    // o formulário foi aceito? (algo foi enviado, a janela fechou ou a tela mudou). Se não, não dá para dizer que o campo não tem destino
    const depois = await foto();
    const aceito = ev.some(e => ['grava', 'rpc', 'funcao', 'api', 'auth'].includes(e.tipo)) || gd.length > 0 || (!!depois && (janela ? !depois.janelas.includes(janela) : digital(depois) !== antesDig));
    const tem = (txt, val, bus) => { const t = String(txt); if (t.includes(val)) return true; const d = String(bus || '').replace(/\D/g, ''); return d.length >= 8 && t.replace(/\D/g, '').includes(d); };
    for (const { campo, valor, busca } of valores) {
      const destino = { banco: [], navegador: [], filtro: [], chamada: [] };
      if (valor && valor.length >= 5) {
        for (const e of ev) {
          if (e.tipo === 'grava' && e.valores) for (const linha of e.valores) for (const [col, x] of Object.entries(linha)) if (tem(x, valor, busca)) destino.banco.push({ tabela: e.tabela, coluna: col, existe: e.existe });
          if (e.tipo === 'le' && String(e.filtros || '') && tem(decodeURIComponent(JSON.stringify(e)), valor, busca)) destino.filtro.push({ tabela: e.tabela });
          if (['rpc', 'funcao', 'api', 'auth'].includes(e.tipo) && tem(e.corpo || '', valor, busca)) destino.chamada.push({ tipo: e.tipo, nome: e.tipo === 'auth' ? 'entrar (login)' : (e.nome || e.caminho) });
        }
        const so = String(busca || '').replace(/\D/g, '');
        for (const g of gd) if (tem(g.valor, valor, busca) || (g.marcas || []).includes(valor) || (so.length >= 8 && (g.marcas || []).some(m => m.includes(so)))) destino.navegador.push({ area: g.area, chave: g.chave });
      }
      r.campos.push({ onde, janela, campo: campo.rotulo, nome: campo.nome, tipo: campo.tipoCampo, valor, enviou: enviar ? enviar.rotulo : null, aceito, destino, papel });
    }
    acao = null;
  }

  async function abrirJanela(tela, e, f2) {
    for (const titulo of f2.janelas) {
      if (r.janelas.some(j => j.tela === tela.digital && j.titulo === titulo)) continue;
      const j = { tela: tela.digital, titulo, botao: e.rotulo, elementos: f2.elementos.filter(x => x.janela === titulo), texto: f2.textoJanelas[f2.janelas.indexOf(titulo)] || '', papel };
      r.janelas.push(j);
      await testarCampos(f2, tela.digital + '|' + titulo, titulo);
    }
  }
  async function fecharJanelas() {
    await pg.keyboard.press('Escape').catch(() => {}); await quieto(600);
    let f = await foto(); if (!f || !f.janelas.length) return true;
    const x = f.elementos.find(e => e.tipo === 'clique' && e.zona === 'janela' && FECHAR.test(e.rotulo));
    if (x) { await clicar(x); await quieto(600); f = await foto(); }
    return !!f && !f.janelas.length;
  }

  // ---------- a volta ----------
  const entradas = ['/', ...paginas.filter(p => !/^index\.html?$/i.test(p)).map(p => '/' + p.replace(/\.html?$/i, ''))];
  const fila = entradas.map(en => ({ entrada: en, passos: [], via: null }));
  const vistas = new Map();
  let inicio = null;
  while (fila.length && !cedo() && r.telas.length < maxTelas) {
    const st = fila.shift();
    const evIni = falso.eventos.length;
    if (!(await ir(st.entrada, st.passos, st.passos.length ? null : '__primeira'))) { if (st.via) r.lacunas.push('Papel ' + rotuloPapel + ': não deu para refazer o caminho até "' + st.via.rotulo + '".'); continue; }
    let f = await foto(); if (!f) continue;
    if (f.janelas.length && st.passos.length === 0) { await fecharJanelas(); f = await foto() || f; }
    const tela = telaDeFoto(f, st.entrada, st.passos, st.via);
    if (vistas.has(tela.digital)) { if (st.via) r.cliques.push({ de: st.via.de, rotulo: st.via.rotulo, zona: st.via.zona, tag: st.via.tag, para: vistas.get(tela.digital), papel }); continue; }
    vistas.set(tela.digital, tela.digital); r.telas.push(tela);
    if (st.via) r.cliques.push({ de: st.via.de, rotulo: st.via.rotulo, zona: st.via.zona, tag: st.via.tag, ajuda: st.via.ajuda, eventos: st.via.eventos || [], para: tela.digital, papel });
    for (const ev of falso.eventos.slice(evIni)) if (!ev.acao) ev.acao = st.passos.length ? { recarga: true } : { onde: tela.digital, carregou: true };
    if (!inicio) inicio = tela;
    log(rotuloPapel + ': ' + (tela.titulo || tela.caminho) + ' (' + r.telas.length + ')');
    // os campos da tela
    await testarCampos(f, tela.digital, null);
    if (!(await restaurar(st, tela.digital))) continue;
    f = await foto(); if (!f) continue;
    // o menu só se percorre a partir da primeira tela de cada entrada; nas outras, só o que é da tela
    const ehInicio = st.passos.length === 0;
    const cands = f.elementos.filter(e => e.tipo === 'clique' && !e.desligado && e.rotulo && e.zona !== 'janela' && (ehInicio || e.zona !== 'menu') && !(e.href && /^(mailto:|tel:|javascript:void)/i.test(e.href)));
    const vistosAqui = new Set();
    let feitos = 0;
    for (const e of cands) {
      if (cedo() || feitos >= maxCliques) { if (feitos >= maxCliques) r.lacunas.push('Papel ' + rotuloPapel + ': na tela "' + tela.titulo + '" ficaram coisas sem clicar (limite de ' + maxCliques + ' por tela).'); break; }
      const k = e.zona + '|' + e.rotulo; if (vistosAqui.has(k)) continue; vistosAqui.add(k);
      if (SAIR.test(e.rotulo)) { r.cliques.push({ de: tela.digital, rotulo: e.rotulo, zona: e.zona, tag: e.tag, para: 'sair', papel }); continue; }
      if (e.href && /^https?:/i.test(e.href) && new URL(e.href, base).origin !== base.origin) { r.cliques.push({ de: tela.digital, rotulo: e.rotulo, zona: e.zona, tag: e.tag, para: 'externo:' + new URL(e.href).origin, papel }); continue; }
      feitos++;
      DEP('clique', e.zona, e.rotulo);
      const antes = await foto(); if (!antes) break;
      const atual = antes.elementos.find(x => x.tipo === 'clique' && x.rotulo === e.rotulo && x.zona === e.zona && x.tag === e.tag);
      if (!atual) continue;
      const evAntes = falso.eventos.length, erAntes = r.erros.length, extAntes = r.externos.length;
      acao = { onde: tela.digital, botao: e.rotulo, zona: e.zona };
      const urlAntes = pg.url();
      if (!(await clicar(atual))) { acao = null; continue; }
      await quieto();
      if (pg.url() !== urlAntes) { await limite(pg.waitForLoadState('domcontentloaded', { timeout: 15_000 }), 16_000).catch(() => {}); await quieto(4000); }
      let depois = await foto();
      if (depois && (depois.vazia || depois.naoAchou)) { await esperar(1500); await quieto(3000); depois = await foto() || depois; }
      acao = null;
      if (!depois) { await restaurar(st, tela.digital); continue; }
      const evs = falso.eventos.slice(evAntes).map(x => ({ tipo: x.tipo, tabela: x.tabela, nome: x.nome, existe: x.existe, colunas: x.colunas }));
      const errou = r.erros.slice(erAntes), saiu = r.externos.slice(extAntes).find(x => !x.tipo);
      const clique = { de: tela.digital, rotulo: e.rotulo, zona: e.zona, tag: e.tag, ajuda: e.ajuda, papel, eventos: evs, erro: errou[0]?.msg || null, para: null };
      if (saiu || (await pg.locator('[data-mapa-fora]').count().catch(() => 0))) { clique.para = 'externo:' + (saiu ? new URL(saiu.url).origin : '?'); r.cliques.push(clique); await restaurar(st, tela.digital); continue; }
      const novas = depois.janelas.filter(j => !antes.janelas.includes(j));
      if (novas.length) {
        clique.para = 'janela:' + novas[0]; r.cliques.push(clique);
        await abrirJanela(tela, e, depois);
        if (!(await fecharJanelas())) await restaurar(st, tela.digital);
        else if (digital(await foto() || antes) !== tela.digital) await restaurar(st, tela.digital);
        continue;
      }
      const dg = digital(depois);
      if (dg !== tela.digital) {
        if (depois.naoAchou || depois.vazia) { clique.para = 'sem_fim'; clique.motivo = depois.naoAchou ? 'página não encontrada' : 'tela em branco'; r.cliques.push(clique); await restaurar(st, tela.digital); continue; }
        if (e.zona === 'aba') { // aba: fica como parte da tela
          clique.para = 'aba'; clique.texto = depois.texto; clique.elementos = depois.elementos.filter(x => x.zona !== 'menu' && x.zona !== 'janela').map(x => ({ tipo: x.tipo, rotulo: x.rotulo, zona: x.zona, tipoCampo: x.tipoCampo, ajuda: x.ajuda }));
          r.cliques.push(clique);
          await restaurar(st, tela.digital); continue;
        }
        // tela já vista: o clique leva a ela; tela nova: entra na fila e o clique se registra quando ela abrir
        if (vistas.has(dg)) { clique.para = vistas.get(dg); r.cliques.push(clique); }
        else if (!fila.some(x => x.via && x.via.de === tela.digital && x.via.rotulo === e.rotulo)) fila.push({ entrada: st.entrada, passos: [...st.passos, passoDe(e)], via: { de: tela.digital, rotulo: e.rotulo, zona: e.zona, tag: e.tag, ajuda: e.ajuda, eventos: evs } });
        await restaurar(st, tela.digital); continue;
      }
      if (errou.length) clique.para = 'sem_fim', clique.motivo = 'a tela deu erro: ' + errou[0].msg;
      r.cliques.push(clique);
      if (pg.url() !== urlAntes) await restaurar(st, tela.digital);
    }
  }
  if (fila.length && r.telas.length >= maxTelas) r.lacunas.push('Papel ' + rotuloPapel + ': parou em ' + maxTelas + ' telas (o limite desta volta); ' + fila.length + ' caminho(s) ficaram para a próxima.');
  if (fila.length && cedo()) r.lacunas.push('Papel ' + rotuloPapel + ': o tempo desta volta acabou com ' + fila.length + ' caminho(s) por abrir.');
  r.eventos = falso.eventos.slice();
  await ctx.close().catch(() => {});
  return r;
}
