// Cofre (parte 68 + fonte/cofre.js): duas pessoas, cada uma com a sua tela, no banco local.
// O banco grava os avisos em realtime.messages (simulação da parte 00); o teste entrega cada aviso só para quem
// entrou naquele canal (a lista de canais vem de ao_vivo_topicos(), como a pessoa logada), igual ao Realtime do Supabase.
// Rodar de fonte/: BD=<banco local com as partes 67 e 68> node ../testes/t_cofre.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { execFileSync } = require('child_process');
const BD = process.env.BD || 'ciclodev_grava';
const psql = sql => execFileSync('psql', ['-h', '/tmp', '-p', '55432', '-U', 'postgres', '-d', BD, '-v', 'ON_ERROR_STOP=1', '-Atq', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const lit = o => '$j$' + JSON.stringify(o) + '$j$';
const conta = sql => psql(sql).trim();
const comoDe = pessoa => { const uid = conta("select auth_user_id from public.pessoas where id = '" + pessoa + "'");
  return "set role authenticated; set request.jwt.claim.sub = '" + uid + "'; set request.jwt.claims = '{\"sub\":\"" + uid + "\",\"role\":\"authenticated\"}'; "; };

function executar(p, COMO){
  const {t, op, row, filtro, dentro, conflito, de, ate, sel, ret, ordem, lim, conta: cnt} = p; const T = 'public.' + t;
  const onde = f => { const ks = Object.keys(f || {}); return ks.length ? '(' + ks.join(',') + ') = (select ' + ks.join(',') + ' from json_populate_record(null::' + T + ', ' + lit(f) + '))' : 'true'; };
  const ondeSel = () => [onde(filtro), dentro ? '(' + dentro[0] + ')::text in (select json_array_elements_text(' + lit(dentro[1]) + '))' : 'true'].join(' and ');
  try {
    let sql;
    if (op === 'select' && cnt){ const n = psql(COMO + 'select count(*) from ' + T + ' where ' + ondeSel()).trim(); return {data:null, count:Number(n), error:null}; }
    if (op === 'select') sql = 'select coalesce(json_agg(x), \'[]\') from (select * from ' + T + ' where ' + ondeSel() + ' order by ' + (ordem ? ordem[0] + (ordem[1] ? ' asc' : ' desc') : '1') + ' offset ' + (de || 0) + ' limit ' + (lim || ((ate || 999) - (de || 0) + 1)) + ') x';
    else if (op === 'insert' || op === 'upsert'){ const cs = Object.keys(Array.isArray(row) ? row[0] : row);
      sql = 'insert into ' + T + ' (' + cs.join(',') + ') select ' + cs.join(',') + ' from ' + (Array.isArray(row) ? 'json_populate_recordset' : 'json_populate_record') + '(null::' + T + ', ' + lit(row) + ')' +
        (op === 'upsert' ? ' on conflict (' + conflito + ') do update set ' + (cs.filter(c => !conflito.split(',').includes(c)).map(c => c + '=excluded.' + c).join(',') || conflito.split(',')[0] + '=excluded.' + conflito.split(',')[0]) : '');
      sql = ret ? 'with u as (' + sql + ' returning *) select coalesce(json_agg(u), \'[]\') from u' : sql; }
    else if (op === 'update'){ const cs = Object.keys(row); sql = 'with u as (update ' + T + ' set ' + (cs.length === 1 ? cs[0] + ' = (select ' + cs[0] : '(' + cs.join(',') + ') = (select ' + cs.join(',')) + ' from json_populate_record(null::' + T + ', ' + lit(row) + ')) where ' + onde(filtro) + ' returning *) select coalesce(json_agg(u), \'[]\') from u'; }
    else if (op === 'delete') sql = 'delete from ' + T + ' where ' + onde(filtro);
    const out = psql(COMO + sql).trim();
    return {data: op === 'delete' ? [] : ((op === 'insert' || op === 'upsert') && !ret) ? null : JSON.parse(out || '[]'), error: null};
  } catch (e) { const m = String(e.stderr || e.message).split('\n').find(l => /ERROR/.test(l)) || String(e.message); return {data: null, error: {message: m.replace(/^.*ERROR:\s*/, '')}}; }
}
const naTelaTem = `(t => document.body.textContent.includes(t) || [...document.querySelectorAll('input, textarea')].some(x => (x.value || '').includes(t)))`;
const FALSO = `
function q(t){ const st = {t, op:'select', filtro:{}, de:0, ate:998};
  const px = new Proxy(function(){}, { get(_, k){
    if (k === 'then') return (res, rej) => window.__bd(JSON.stringify(st)).then(r => JSON.parse(r)).then(res, rej);
    if (k === 'range') return (a, b) => { st.de = a; st.ate = b; return px; };
    if (k === 'select') return (cols, o) => { if (st.op !== 'select') st.ret = true; if (o && o.count) st.conta = true; return px; };
    if (k === 'order') return (c, o) => { st.ordem = [c, !o || o.ascending !== false]; return px; };
    if (k === 'limit') return n => { st.lim = n; return px; };
    if (k === 'insert') return r => { st.op = 'insert'; st.row = r; return px; };
    if (k === 'upsert') return (r, o) => { st.op = 'upsert'; st.row = r; st.conflito = (o || {}).onConflict; return px; };
    if (k === 'update') return r => { st.op = 'update'; st.row = r; return px; };
    if (k === 'delete') return () => { st.op = 'delete'; return px; };
    if (k === 'match') return f => { Object.assign(st.filtro, f); return px; };
    if (k === 'eq') return (c, v) => { st.filtro[c] = v; return px; };
    if (k === 'in') return (c, vs) => { st.dentro = [c, vs]; return px; };
    return () => px; } }); return px; }
window.__canais = [];
window.__entregar = (topico, payload) => { window.__canais.filter(c => c.nome === topico && c.ok).forEach(c => c.hs.forEach(h => h({payload}))); };
window.__derrubar = () => { window.__canais.forEach(c => { c.ok = false; c.cb && c.cb('CHANNEL_ERROR'); }); };
window.supabase = { createClient(){ let sess = {access_token:'x', user:{id:'u1', email:'p@teste.com'}}; return { auth:{ async getSession(){ return {data:{session:sess}}; }, onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}}; }, async signOut(){} },
  storage:{ from(){ return { async upload(c){ return {data:{path:c}, error:null}; }, async createSignedUrls(ps){ return {data:ps.map(p => ({path:p, signedUrl:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'})), error:null}; }, async createSignedUrl(){ return {data:{signedUrl:'data:,'}, error:null}; } }; } },
  functions:{ async invoke(){ return {data:{ok:true}, error:null}; } },
  realtime:{ setAuth(){ } },
  channel(nome, o){ const c = {nome, privado:!!(o && o.config && o.config.private), hs:[], ok:false,
      on(tipo, f, h){ if (tipo === 'broadcast' && f && f.event === 'mudou') this.hs.push(h); return this; },
      subscribe(cb){ this.cb = cb; window.__canais.push(this); setTimeout(() => { this.ok = true; cb('SUBSCRIBED'); }, 20); return this; } }; return c; },
  removeChannel(c){ window.__canais = window.__canais.filter(x => x !== c); c.ok = false; c.cb && c.cb('CLOSED'); },
  from:q, async rpc(fn, args){ if (fn === 'ao_vivo_topicos') return JSON.parse(await window.__rpc(JSON.stringify({fn}))); if (fn === 'sou_dono_sistema') return {data:true, error:null}; if (/^admin_/.test(fn)) return {data:[], error:null}; if (fn !== 'vincular_meu_login') return {data:null, error:null}; return {data:[{pessoa_id:window.__eu, nome:window.__nome, papel:window.__papel, numero:100001, espaco_id:null}], error:null}; } }; } };`;

(async () => {
  const will = 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', ana = conta("select id from public.pessoas where nome = 'Ana (exemplo)'");
  const COMO = {[will]: comoDe(will), [ana]: comoDe(ana)};
  const b = await chromium.launch(); const erros = []; let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
  psql('delete from realtime.messages');
  let vistos = new Set(); const paginas = {};
  // as funções rodam de verdade no banco local, como a pessoa logada
  const lit2 = v => v === null || v === undefined ? 'null' : typeof v === 'boolean' ? String(v) : typeof v === 'object' ? lit(v) + '::jsonb' : "'" + String(v).replace(/'/g, "''") + "'";
  async function abrir(pessoa, nome, papel){
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const p = await ctx.newPage();
    p.on('pageerror', e => { erros.push(nome + ': ' + e.message); console.log('PAGEERROR', nome, e.stack.split('\n').slice(0, 4).join(' | ')); });
    await p.exposeFunction('__bd', s => JSON.stringify(executar(JSON.parse(s), COMO[pessoa])));
    await p.exposeFunction('__rpc', s => { const {fn, args} = JSON.parse(s);
      const a = Object.entries(args || {}).map(([k, v]) => k + ' => ' + lit2(v)).join(', ');
      const sql = fn === 'cofre_pessoas' ? "select coalesce(json_agg(x), '[]') from public.cofre_pessoas(" + a + ") x" : 'select to_json(public.' + fn + '(' + a + '))';
      try { const r = psql(COMO[pessoa] + sql).trim(); return JSON.stringify({data: r ? JSON.parse(r) : null, error:null}); }
      catch(e){ const m = String(e.stderr || e.message).split('\n').find(l => /ERROR/.test(l)) || 'erro'; return JSON.stringify({data:null, error:{message:m.replace(/^.*ERROR:\s*/, '')}}); } });
    await p.addInitScript(([id, n, pp, f]) => { window.__eu = id; window.__nome = n; window.__papel = pp; window.__naTelaTem = f; }, [pessoa, nome, papel, naTelaTem]);
    await p.route('**/supabase-js@*/**', r => r.fulfill({ contentType: 'text/javascript', body: FALSO.replace("if (fn === 'ao_vivo_topicos') return", "if (fn === 'ao_vivo_topicos' || /^cofre_/.test(fn)) return").replace("JSON.stringify({fn})", "JSON.stringify({fn, args})") }));
    await p.goto('file://' + process.cwd() + '/vercel/index.html'); await p.waitForTimeout(2500);
    paginas[pessoa] = p; return p;
  }
  async function entregar(){
    const rows = JSON.parse(conta("select coalesce(json_agg(json_build_object('id', id, 'topic', topic, 'payload', payload) order by inserted_at), '[]') from realtime.messages"));
    const novos = rows.filter(r => !vistos.has(r.id)); novos.forEach(r => vistos.add(r.id));
    for (const p of Object.values(paginas)) for (const r of novos) await p.evaluate(([t, pl]) => window.__entregar(t, pl), [r.topic, r.payload]);
    return novos;
  }
  const caixa = p => p.evaluate(() => { const d = [...document.querySelectorAll('dialog.modal[open]')].pop(); return d ? d.textContent : ''; });
  const botao = (p, txt) => p.evaluate(t => { const d = [...document.querySelectorAll('dialog.modal[open]')].pop(); const bt = [...d.querySelectorAll('.modal-rod .btn')].find(x => x.textContent.trim() === t); if (bt) bt.click(); return !!bt; }, txt);
  const A = await abrir(will, 'William', 'master'), B = await abrir(ana, 'Ana (exemplo)', 'dev');
  const abrirCofre = async p => { await p.evaluate(() => document.querySelector('[data-tela="cofre"]').click()); await p.waitForTimeout(1200); };

  // 1. o menu tem o Cofre e ele começa vazio
  await abrirCofre(A);
  ok(await A.evaluate(() => /O cofre está vazio/.test(document.querySelector('#m-cofre').textContent)), 'o menu tem o Cofre; vazio no começo');

  // 2. guardar uma senha pela tela, com o gerador
  await A.evaluate(() => document.querySelector('[data-cf-novo]').click()); await A.waitForTimeout(400);
  await A.fill('dialog.modal[open] [data-cf-m="nome"]', 'Painel AWS');
  await A.fill('dialog.modal[open] [data-cf-m="url"]', 'https://aws.amazon.com');
  await A.fill('dialog.modal[open] [data-cf-seg="usuario"]', 'william@empresa.com');
  await A.evaluate(() => document.querySelector('dialog.modal[open] [data-cf-gerar]').click());
  const senha = await A.evaluate(() => document.querySelector('dialog.modal[open] [data-cf-seg="senha"]').value);
  ok(senha.length === 20 && await A.evaluate(() => new Set(Array.from({length:200}, () => window.__tf.cfSenhaForte(20))).size === 200), 'o gerador cria senhas de 20 caracteres que não se repetem (200 de 200 diferentes)');
  await botao(A, 'Guardar'); await A.waitForTimeout(1500);
  const itemId = conta("select id from public.cofre_itens where nome = 'Painel AWS'");
  ok(!!itemId && await A.evaluate(() => /Painel AWS/.test(document.querySelector('#m-cofre').textContent)), 'guardou; o item aparece na lista');
  ok(conta("select count(*) from vault.secrets where secret like '%" + senha.replace(/'/g, "''") + "%'") === '1', 'a senha está no Vault');
  ok(await A.evaluate(s => !JSON.stringify(window.__tf.CF).includes(s) && !JSON.stringify(window.__tf.D).includes(s) && !JSON.stringify(Object.assign({}, localStorage)).includes(s) && !document.body.innerHTML.includes(s) && !document.querySelector('dialog'), senha),
    'depois de guardar, a senha não fica na página, na lista, nos dados da tela nem no navegador');

  // 3. ver: aparece mascarada; "Mostrar" busca no Vault (e registra)
  await A.evaluate(id => document.querySelector('[data-cf-abrir="' + id + '"]').click(), itemId); await A.waitForTimeout(500);
  ok(await A.evaluate(s => !document.body.innerHTML.includes(s) && /••••/.test(document.querySelector('dialog.modal[open]').textContent), senha), 'ao abrir, o valor vem escondido (nem foi buscado ainda)');
  ok(await A.evaluate(() => [...document.querySelectorAll('dialog.modal[open] .cf-campo .cf-rot')].map(x => x.textContent).join('|') === 'Usuário ou e-mail|Senha'), 'campos vazios (Notas) não aparecem na janela do item');
  ok(conta("select count(*) from public.cofre_registros where item_id = '" + itemId + "' and acao = 'revelou'") === '0', 'abrir não revela nada sozinho');
  await A.evaluate(() => document.querySelector('dialog.modal[open] [data-cf-mostrar="senha"]').click()); await A.waitForTimeout(800);
  ok(await A.evaluate(s => document.querySelector('dialog.modal[open] [data-cf-campo="senha"]').textContent.includes(s), senha), '"Mostrar" mostra a senha');
  ok(conta("select count(*) from public.cofre_registros where item_id = '" + itemId + "' and acao = 'revelou'") === '1', 'e a revelação ficou registrada');
  // 4. copiar
  await A.evaluate(() => document.querySelector('dialog.modal[open] [data-cf-copiar="senha"]').click()); await A.waitForTimeout(800);
  ok(await A.evaluate(() => navigator.clipboard.readText()) === senha && conta("select count(*) from public.cofre_registros where item_id = '" + itemId + "' and acao = 'copiou' and detalhe = 'senha'") === '1',
    '"Copiar" põe a senha na área de transferência e registra (só o nome do campo, nunca o valor)');
  ok(conta("select count(*) from public.cofre_registros where detalhe like '%" + senha.replace(/'/g, "''") + "%'") === '0', 'o valor não vai para o histórico');
  await botao(A, 'Fechar'); await A.waitForTimeout(300);
  ok(await A.evaluate(s => !document.body.innerHTML.includes(s), senha), 'fechou a janela: o valor sumiu da página');

  // 5. Ana (sem acesso) não vê nada
  await abrirCofre(B);
  ok(await B.evaluate(() => !/Painel AWS/.test(document.querySelector('#m-cofre').textContent) && window.__tf.CF.itens.length === 0), 'Ana não vê o item de William');

  // 6. William compartilha com Ana (só ver) pela tela; Ana recebe na hora (ao vivo, canal pessoal dela)
  await A.evaluate(id => document.querySelector('[data-cf-abrir="' + id + '"]').click(), itemId); await A.waitForTimeout(400);
  await botao(A, 'Compartilhar'); await A.waitForTimeout(800);
  ok(await A.evaluate(() => [...document.querySelectorAll('dialog.modal[open] [data-cf-nova] option')].some(o => /Ana/.test(o.textContent))), 'a lista de com quem compartilhar tem a Ana');
  await A.evaluate(() => { const s = document.querySelector('dialog.modal[open] [data-cf-nova]'); s.value = [...s.options].find(o => /Ana/.test(o.textContent)).value; document.querySelector('dialog.modal[open] [data-cf-dar]').click(); }); await A.waitForTimeout(1200);
  ok(conta("select nivel from public.cofre_acessos where item_id = '" + itemId + "'") === 'ver', 'acesso dado (só ver)');
  await botao(A, 'Pronto');
  const n6 = await entregar(); await B.waitForTimeout(3500);
  ok(n6.some(r => r.topic === 'ciclodev:p:' + ana && r.payload.t === 'cofre_acessos') && await B.evaluate(() => /Painel AWS/.test(document.querySelector('#m-cofre').textContent)), 'a tela da Ana mostra o item na hora, sem recarregar');
  await B.evaluate(id => document.querySelector('[data-cf-abrir="' + id + '"]').click(), itemId); await B.waitForTimeout(400);
  const botoesAna = await B.evaluate(() => [...document.querySelectorAll('dialog.modal[open] .modal-rod .btn')].map(x => x.textContent.trim()));
  ok(!botoesAna.includes('Editar') && !botoesAna.includes('Compartilhar') && !botoesAna.some(t => /lixeira|Apagar/.test(t)), 'com "só ver", Ana não tem Editar, Compartilhar nem Lixeira');
  await B.evaluate(() => document.querySelector('dialog.modal[open] [data-cf-mostrar="senha"]').click()); await B.waitForTimeout(800);
  ok(await B.evaluate(s => document.querySelector('dialog.modal[open] [data-cf-campo="senha"]').textContent.includes(s), senha), 'Ana vê a senha');
  await botao(B, 'Fechar');

  // 7. William tira o acesso; some da tela da Ana
  await A.evaluate(id => document.querySelector('[data-cf-abrir="' + id + '"]').click(), itemId); await A.waitForTimeout(400);
  await botao(A, 'Compartilhar'); await A.waitForTimeout(800);
  await A.evaluate(() => document.querySelector('dialog.modal[open] [data-cf-tirar]').click()); await A.waitForTimeout(1200); await botao(A, 'Pronto');
  await entregar(); await B.waitForTimeout(3500);
  ok(await B.evaluate(() => !/Painel AWS/.test(document.querySelector('#m-cofre').textContent)), 'acesso tirado: some da tela da Ana na hora');

  // 8. editar (William): troca a senha; Histórico mostra quem fez o quê
  await A.evaluate(id => document.querySelector('[data-cf-abrir="' + id + '"]').click(), itemId); await A.waitForTimeout(400);
  await botao(A, 'Editar'); await A.waitForTimeout(1200);
  ok(await A.evaluate(s => document.querySelector('dialog.modal[open] [data-cf-seg="senha"]').value === s, senha), 'editar traz o valor atual para o formulário');
  await A.fill('dialog.modal[open] [data-cf-seg="senha"]', 'Senha-Trocada-99');
  await botao(A, 'Salvar'); await A.waitForTimeout(1500);
  ok(conta("select count(*) from vault.secrets where secret like '%Senha-Trocada-99%'") === '1' && conta("select count(*) from vault.secrets where secret like '%" + senha.replace(/'/g, "''") + "%'") === '0', 'a senha trocada substituiu a antiga no Vault');
  await A.evaluate(id => document.querySelector('[data-cf-abrir="' + id + '"]').click(), itemId); await A.waitForTimeout(400);
  await botao(A, 'Histórico'); await A.waitForTimeout(800);
  const hist = await caixa(A);
  ok(/guardou/.test(hist) && /viu o valor/.test(hist) && /copiou/.test(hist) && /deu acesso a/.test(hist) && /tirou o acesso de/.test(hist) && /trocou o valor/.test(hist), 'o histórico mostra guardou, viu, copiou, deu e tirou acesso, trocou');
  await botao(A, 'Fechar'); await A.evaluate(() => document.querySelectorAll('dialog.modal[open]').forEach(d => { d.close(); d.remove(); }));

  // 9. lixeira e apagar de vez (com confirmação pelo nome)
  await A.evaluate(id => document.querySelector('[data-cf-abrir="' + id + '"]').click(), itemId); await A.waitForTimeout(400);
  await botao(A, 'Mandar para a lixeira'); await A.waitForTimeout(1200);
  ok(await A.evaluate(() => !/Painel AWS/.test(document.querySelector('#m-cofre').textContent)), 'foi para a lixeira (sai da lista)');
  await A.evaluate(() => { const c = document.querySelector('[data-cf-lixeira]'); c.checked = true; c.dispatchEvent(new Event('change', {bubbles:true})); }); await A.waitForTimeout(300);
  await A.evaluate(id => document.querySelector('[data-cf-abrir="' + id + '"]').click(), itemId); await A.waitForTimeout(400);
  await botao(A, 'Apagar de vez'); await A.waitForTimeout(300);
  await A.fill('dialog.modal[open] [data-cf-conf]', 'nome errado'); await botao(A, 'Apagar de vez'); await A.waitForTimeout(800);
  ok(conta("select count(*) from public.cofre_itens where id = '" + itemId + "'") === '1', 'nome errado: não apaga');
  await A.fill('dialog.modal[open] [data-cf-conf]', 'Painel AWS'); await botao(A, 'Apagar de vez'); await A.waitForTimeout(1500);
  ok(conta("select count(*) from public.cofre_itens where id = '" + itemId + "'") === '0' && conta("select count(*) from vault.secrets where secret like '%Senha-Trocada-99%'") === '0', 'apagou de vez: some do cofre e do Vault');

  // 10. o valor some sozinho da janela em 60 segundos, mesmo com ela aberta
  const id10 = await A.evaluate(async () => { const r = await window.ciclodevBanco.rpc('cofre_criar', {p_meta:{tipo:'senha', nome:'Some sozinho'}, p_segredo:{senha:'Valor-Que-Some-77'}}); await window.__tf.cfCarregar(); window.__tf.rCofre(); return r.data; });
  await A.evaluate(() => { const c = document.querySelector('[data-cf-lixeira]'); if (c && c.checked){ c.checked = false; c.dispatchEvent(new Event('change', {bubbles:true})); } }); await A.waitForTimeout(300);
  await A.evaluate(id => document.querySelector('[data-cf-abrir="' + id + '"]').click(), id10); await A.waitForTimeout(400);
  await A.evaluate(() => document.querySelector('dialog.modal[open] [data-cf-mostrar="senha"]').click()); await A.waitForTimeout(800);
  const antes10 = await A.evaluate(() => document.body.innerHTML.includes('Valor-Que-Some-77'));
  await A.waitForTimeout(61000);
  ok(antes10 && await A.evaluate(() => !document.body.innerHTML.includes('Valor-Que-Some-77') && !!document.querySelector('dialog.modal[open]')), 'com a janela aberta, o valor some sozinho depois de 60 segundos');
  await botao(A, 'Fechar');

  // 10b. Gerar senha: janela que só gera, com tamanho e tipos de caractere; nada é salvo
  { const antesBD = conta("select (select count(*) from public.cofre_itens) || '|' || (select count(*) from vault.secrets) || '|' || (select count(*) from public.cofre_registros)");
    const lsAntes = await A.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
    await A.evaluate(() => document.querySelector('[data-cf-gerar-senha]').click()); await A.waitForTimeout(400);
    const g = () => A.evaluate(() => { const d = document.querySelector('dialog.cfg-dlg[open]'); return d ? {s:d.querySelector('[data-cfg-senha]').value, forca:d.querySelector('[data-cfg-forca]').textContent, tam:d.querySelector('[data-cfg-tam-txt]').textContent} : null; });
    if (process.env.FOTOS) await A.locator('dialog.cfg-dlg').screenshot({path: process.env.FOTOS + '/gerar_senha.png'});
    let r = await g();
    ok(r && r.s.length === 16 && /[A-Z]/.test(r.s) && /[a-z]/.test(r.s) && /[0-9]/.test(r.s) && /[^A-Za-z0-9]/.test(r.s) && r.forca === 'Forte', 'o botão Gerar senha abre a janela com uma senha de 16 caracteres, com os 4 tipos, Forte (' + (r && r.forca) + ')');
    await A.evaluate(() => { const i = document.querySelector('dialog.cfg-dlg [data-cfg-tam]'); i.value = 32; i.dispatchEvent(new Event('input', {bubbles:true})); }); await A.waitForTimeout(100);
    r = await g(); ok(r.s.length === 32 && r.tam === '32', 'mudar o número de caracteres gera na hora com o tamanho novo');
    await A.evaluate(() => ['mai', 'sim'].forEach(k => document.querySelector('dialog.cfg-dlg [data-cfg-usar="' + k + '"]').click())); await A.waitForTimeout(100);
    r = await g(); ok(/^[a-z0-9]{32}$/.test(r.s) && /[a-z]/.test(r.s) && /[0-9]/.test(r.s), 'desmarcar maiúscula e símbolos: só minúsculas e números');
    await A.evaluate(() => document.querySelector('dialog.cfg-dlg [data-cfg-usar="min"]').click()); await A.waitForTimeout(100);
    await A.evaluate(() => document.querySelector('dialog.cfg-dlg [data-cfg-usar="num"]').click()); await A.waitForTimeout(100);
    r = await g(); ok(/^[0-9]{32}$/.test(r.s) && await A.evaluate(() => document.querySelector('dialog.cfg-dlg [data-cfg-usar="num"]').checked), 'o último tipo marcado não pode ser desmarcado (fica só números)');
    await A.evaluate(() => { const i = document.querySelector('dialog.cfg-dlg [data-cfg-tam]'); i.value = 6; i.dispatchEvent(new Event('input', {bubbles:true})); }); await A.waitForTimeout(100);
    r = await g(); ok(r.s.length === 6 && r.forca === 'Fraca', 'senha curta só de números aparece como Fraca');
    const s1 = r.s; await A.evaluate(() => document.querySelector('dialog.cfg-dlg [data-cfg-nova]').click()); await A.waitForTimeout(100);
    const s2 = (await g()).s; await A.evaluate(() => document.querySelector('dialog.cfg-dlg [data-cfg-nova]').click()); await A.waitForTimeout(100);
    ok(s2.length === 6 && (s1 !== s2 || s2 !== (await g()).s), 'o botão de girar gera outra');
    await A.evaluate(() => document.querySelector('dialog.cfg-dlg [data-cfg-copiar]').click()); await A.waitForTimeout(400);
    ok(await A.evaluate(() => navigator.clipboard.readText()) === (await g()).s, '"Copiar senha" põe a senha na área de transferência');
    ok(await A.evaluate(() => new Set(Array.from({length:300}, () => window.__tf.cfgGerar(20, {mai:true, min:true, num:true, sim:true}))).size === 300), '300 senhas geradas, nenhuma repetida');
    const ult = (await g()).s;
    await A.evaluate(() => [...document.querySelectorAll('dialog.cfg-dlg .modal-rod .btn')].pop().click()); await A.waitForTimeout(300);
    ok(!(await A.evaluate(() => !!document.querySelector('dialog.cfg-dlg'))) && conta("select (select count(*) from public.cofre_itens) || '|' || (select count(*) from vault.secrets) || '|' || (select count(*) from public.cofre_registros)") === antesBD &&
      await A.evaluate(([l, s]) => JSON.stringify(Object.assign({}, localStorage)) === l && !document.body.innerHTML.includes(s) && !JSON.stringify(window.__tf.CF).includes(s), [lsAntes, ult]),
      'fechou: nada foi salvo (nem no banco, nem no Vault, nem no histórico, nem no navegador) e a senha sumiu da página');
  }

  // 10c. campo Token e campo com nome livre: nome e valor vão para o Vault, nunca para a tabela
  { await A.evaluate(() => document.querySelector('[data-cf-novo]').click()); await A.waitForTimeout(400);
    await A.fill('dialog.modal[open] [data-cf-m="nome"]', 'API do Parceiro');
    ok(await A.evaluate(() => !document.querySelector('dialog.modal[open] [data-cf-seg="notas"]') && !!document.querySelector('dialog.modal[open] [data-cf-notas]')), 'Notas começa fechada: só um botão "+ Notas"');
    await A.evaluate(() => document.querySelector('dialog.modal[open] [data-cf-ex-mais="Token"]').click()); await A.waitForTimeout(150);
    ok(await A.evaluate(() => { const f = [...document.querySelectorAll('dialog.modal[open] [data-cf-segs] [data-cf-seg], dialog.modal[open] [data-cf-segs] [data-cf-ex-n]')].map(x => x.dataset.cfSeg || 'extra'); return f.join('|') === 'usuario|senha|extra'; }),
      'o campo novo entra logo depois do último campo do tipo, sem uma Notas vazia no meio');
    ok(await A.evaluate(() => { const n = document.querySelector('dialog.modal[open] [data-cf-ex-n="0"]'), v = document.querySelector('dialog.modal[open] [data-cf-ex-v="0"]'); return n && n.value === 'Token' && v.type === 'password' && document.activeElement === v; }),
      '"+ Token" cria um campo com o nome Token (dá para mudar), valor escondido, e já põe o cursor no valor');
    await A.fill('dialog.modal[open] [data-cf-ex-v="0"]', 'tok-Secreto-123');
    await A.evaluate(() => document.querySelector('dialog.modal[open] [data-cf-ex-mais=""]').click()); await A.waitForTimeout(150);
    await A.fill('dialog.modal[open] [data-cf-ex-n="1"]', 'Client ID do app');
    await A.fill('dialog.modal[open] [data-cf-ex-v="1"]', 'cli-Valor-456');
    ok(await A.evaluate(() => document.querySelector('dialog.modal[open] [data-cf-ex-v="0"]').value === 'tok-Secreto-123'), 'adicionar outro campo não perde o token já digitado');
    await A.evaluate(() => document.querySelector('dialog.modal[open] [data-cf-notas]').click()); await A.waitForTimeout(150);
    ok(await A.evaluate(() => { const n = document.querySelector('dialog.modal[open] [data-cf-seg="notas"]'); return n && document.activeElement === n && !document.querySelector('dialog.modal[open] [data-cf-notas]') && document.querySelector('dialog.modal[open] [data-cf-ex-v="1"]').value === 'cli-Valor-456'; }),
      '"+ Notas" abre a nota (no fim, depois dos campos a mais), põe o cursor nela e não perde o que já foi digitado');
    await A.fill('dialog.modal[open] [data-cf-seg="notas"]', 'usar só no ambiente de teste');
    if (process.env.FOTOS) await A.locator('dialog.modal[open]').screenshot({path: process.env.FOTOS + '/cofre_token.png'});
    await botao(A, 'Guardar'); await A.waitForTimeout(1500);
    const idT = conta("select id from public.cofre_itens where nome = 'API do Parceiro'");
    ok(!!idT && conta("select count(*) from vault.secrets where secret like '%tok-Secreto-123%' and secret like '%cli-Valor-456%' and secret like '%Client ID do app%' and secret like '%\"Token\"%'") === '1',
      'o token e o campo de nome livre (nome e valor) ficaram no Vault');
    ok(conta("select count(*) from public.cofre_itens where id = '" + idT + "' and (to_jsonb(cofre_itens)::text like '%tok-Secreto%' or to_jsonb(cofre_itens)::text like '%Client ID%')") === '0', 'e nada deles fica na tabela do cofre (nem o nome do campo)');
    await A.evaluate(id => document.querySelector('[data-cf-abrir="' + id + '"]').click(), idT); await A.waitForTimeout(500);
    ok(await A.evaluate(() => { const rot = [...document.querySelectorAll('dialog.modal[open] .cf-campo .cf-rot')].map(x => x.textContent).join('|');
        return rot === 'Notas|Token|Client ID do app' && !/tok-Secreto-123|cli-Valor-456|ambiente de teste/.test(document.body.innerHTML); }),
      'ao abrir, aparecem só os campos que têm algo (Notas, Token e Client ID do app; Usuário e Senha vazios não aparecem), sem nenhum valor');
    ok(conta("select count(*) from public.cofre_registros where item_id = '" + idT + "' and acao = 'revelou'") === '0', 'saber os nomes dos campos não conta como revelar');
    await A.evaluate(() => document.querySelector('dialog.modal[open] [data-cf-mostrar="extras.0"]').click()); await A.waitForTimeout(800);
    ok(await A.evaluate(() => { const t = document.querySelector('dialog.modal[open]').textContent; return /Token/.test(t) && /Client ID do app/.test(t); }), 'depois de Mostrar, os campos Token e "Client ID do app" aparecem, cada um com Mostrar e Copiar');
    ok(await A.evaluate(() => document.querySelector('dialog.modal[open] [data-cf-campo="extras.0"] [data-cf-val]').textContent === 'tok-Secreto-123'), 'Mostrar no Token mostra o valor');
    await A.evaluate(() => document.querySelector('dialog.modal[open] [data-cf-copiar="extras.1"]').click()); await A.waitForTimeout(600);
    ok(await A.evaluate(() => navigator.clipboard.readText()) === 'cli-Valor-456', 'Copiar no campo de nome livre copia o valor dele');
    await botao(A, 'Editar'); await A.waitForTimeout(800);
    ok(await A.evaluate(() => { const n = document.querySelector('dialog.modal[open] [data-cf-seg="notas"]'); return n && n.value === 'usar só no ambiente de teste' && !document.querySelector('dialog.modal[open] [data-cf-notas]'); }), 'no Editar, a nota que já existe vem aberta');
    await botao(A, 'Cancelar'); await A.waitForTimeout(300);
    if (await A.evaluate(() => !!document.querySelector('dialog.modal[open]'))) { await botao(A, 'Fechar'); await A.waitForTimeout(300); }
  }

  // 11. recarregar a página já no Cofre: a lista não pode vir vazia (antes ela era lida antes da conexão com o banco ficar pronta)
  psql("insert into public.cofre_itens (espaco_id, dono_id, tipo, nome, atualizado_por) values ((select espaco_id from public.espaco_membros where pessoa_id = '" + will + "' limit 1), '" + will + "', 'chave_api', 'Item Depois Do F5', '" + will + "')");
  await A.reload(); await A.waitForTimeout(3000);
  ok(await A.evaluate(() => /Item Depois Do F5/.test((document.querySelector('#m-cofre') || {}).textContent || '')), 'recarregando a página já no Cofre, a lista vem do banco (não aparece vazia)');

  ok(!erros.length, 'sem erro nas páginas' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})();
