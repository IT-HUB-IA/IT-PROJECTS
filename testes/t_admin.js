// Cadastro completo + módulo Admin, contra um Postgres local com as regras de acesso de verdade (papel authenticated).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { execFileSync } = require('child_process');
const BD = process.env.BD || 'ciclodev_m16';
const psqlRaw = sql => execFileSync('psql', ['-h', '/tmp', '-p', '55432', '-U', 'postgres', '-d', BD, '-v', 'ON_ERROR_STOP=1', '-Atq', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const lit = o => '$j$' + JSON.stringify(o) + '$j$';
const ESCALAR = ['admin_resumo', 'sou_dono_sistema'];
function como(uid, email){ return "set role authenticated; set request.jwt.claim.sub = '" + uid + "'; set request.jwt.claims = '" + JSON.stringify({sub:uid, email}).replace(/'/g, "''") + "'; "; }
let QUEM = null;
function executar(p){
  const {t, op, row, filtro, conflito, de, ate, ret, fn, args} = p; const T = 'public.' + t;
  const onde = f => { const ks = Object.keys(f); return ks.length ? '(' + ks.join(',') + ') = (select ' + ks.join(',') + ' from json_populate_record(null::' + T + ', ' + lit(f) + '))' : 'true'; };
  try {
    let sql;
    if (op === 'rpc'){
      const a = Object.entries(args || {}).map(([k, v]) => k + ' => ' + (v === null ? 'null' : typeof v === 'number' ? v : "'" + String(v).replace(/'/g, "''") + "'")).join(', ');
      sql = ESCALAR.includes(fn) ? 'select to_json(public.' + fn + '(' + a + '))' : "select coalesce(json_agg(x), '[]') from public." + fn + '(' + a + ') x';
    }
    else if (op === 'select') sql = "select coalesce(json_agg(x), '[]') from (select * from " + T + ' order by 1 offset ' + (de || 0) + ' limit ' + ((ate || 999) - (de || 0) + 1) + ') x';
    else if (op === 'insert' || op === 'upsert'){ const cs = Object.keys(row);
      sql = 'insert into ' + T + ' (' + cs.join(',') + ') select ' + cs.join(',') + ' from json_populate_record(null::' + T + ', ' + lit(row) + ')' +
        (op === 'upsert' ? ' on conflict (' + conflito + ') do update set ' + (cs.filter(c => !conflito.split(',').includes(c)).map(c => c + '=excluded.' + c).join(',') || conflito.split(',')[0] + '=excluded.' + conflito.split(',')[0]) : '');
      sql = ret ? 'with u as (' + sql + " returning *) select coalesce(json_agg(u), '[]') from u" : sql; }
    else if (op === 'update'){ const cs = Object.keys(row); sql = 'with u as (update ' + T + ' set ' + (cs.length === 1 ? cs[0] + ' = (select ' + cs[0] : '(' + cs.join(',') + ') = (select ' + cs.join(',')) + ' from json_populate_record(null::' + T + ', ' + lit(row) + ')) where ' + onde(filtro) + " returning *) select coalesce(json_agg(u), '[]') from u"; }
    else if (op === 'delete') sql = 'delete from ' + T + ' where ' + onde(filtro);
    const out = psqlRaw(como(QUEM.uid, QUEM.email) + sql).trim();
    const d = out ? JSON.parse(out) : null;
    return {data: (op === 'delete' || (op === 'insert' && !ret)) ? null : d, error: null};
  } catch (e) { const m = String(e.stderr || e.message).split('\n').find(l => /ERROR/.test(l)) || String(e.message); return {data: null, error: {message: m.replace(/^.*ERROR:\s*/, '')}}; }
}
const FALSO = `
function q(t){ const st = {t, op:'select', filtro:{}, de:0, ate:998};
  const px = new Proxy(function(){}, { get(_, k){
    if (k === 'then') return (res, rej) => window.__bd(JSON.stringify(st)).then(r => JSON.parse(r)).then(res, rej);
    if (k === 'range') return (a, b) => { st.de = a; st.ate = b; return px; };
    if (k === 'select') return () => { if (st.op !== 'select') st.ret = true; return px; };
    if (k === 'insert') return r => { st.op = 'insert'; st.row = r; return px; };
    if (k === 'upsert') return (r, o) => { st.op = 'upsert'; st.row = r; st.conflito = (o || {}).onConflict; st.ret = true; return px; };
    if (k === 'update') return r => { st.op = 'update'; st.row = r; return px; };
    if (k === 'delete') return () => { st.op = 'delete'; return px; };
    if (k === 'match') return f => { Object.assign(st.filtro, f); return px; };
    if (k === 'eq') return (c, v) => { st.filtro[c] = v; return px; };
    return () => px; } }); return px; }
window.supabase = { createClient(){ const sess = window.__sessao; return { auth:{ async getSession(){ return {data:{session:sess}}; }, onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}}; }, async signOut(){},
    async signUp(a){ window.__cadastro = a; return {data:{session:null, user:{id:'novo'}}, error:null}; } },
  from:q, rpc(fn, args){ return window.__bd(JSON.stringify({op:'rpc', fn, args})).then(r => JSON.parse(r)); } }; } };`;

(async () => {
  const conta = sql => psqlRaw(sql).trim();
  // limpa o usuário que o próprio teste cria no fim (senão a busca acha dois de São Paulo na próxima vez)
  psqlRaw("delete from public.pessoas where email = 'carlos@teste.com'; delete from auth.users where email = 'carlos@teste.com'");
  const W = {uid: conta("select auth_user_id from pessoas where id = 'd148fdc5-eef3-5398-bf89-f49b55b5cd28'"), email: 'william@teste.com'};
  const M = {uid: '00000000-0000-0000-0000-0000000000b1', email: 'maria@teste.com'};
  const b = await chromium.launch(); let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
  async function abrir(quem, sessao, largura){
    QUEM = quem || W;
    const p = await b.newPage({ viewport: { width: largura || 1440, height: 900 } });
    p.on('pageerror', e => { falhas++; console.log('PAGEERROR', e.stack.split('\n').slice(0, 4).join(' | ')); });
    await p.exposeFunction('__bd', s => JSON.stringify(executar(JSON.parse(s))));
    await p.addInitScript(s => { window.__sessao = s; }, sessao);
    await p.route('**/supabase-js@*/**', r => r.fulfill({ contentType: 'text/javascript', body: FALSO }));
    await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
    await p.route(/viacep\.com\.br\/ws\/01310100/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({cep:'01310-100', logradouro:'Avenida Paulista', bairro:'Bela Vista', localidade:'São Paulo', uf:'SP'}) }));
    await p.goto('file://' + process.cwd() + '/vercel/index.html'); await p.waitForTimeout(2500);
    return p;
  }

  // ===== 1) dono do sistema =====
  const antes = +conta("select count(*) from uso_eventos where pessoa_id = 'd148fdc5-eef3-5398-bf89-f49b55b5cd28'");
  let p = await abrir(W, {user:{id:W.uid, email:W.email}});
  ok(await p.evaluate(() => document.body.classList.contains('logado')), 'William entrou');
  ok(await p.isVisible('.item[data-tela="admin"]'), 'William vê o módulo Admin no menu');
  await p.click('.item[data-tela="admin"]'); await p.waitForSelector('#m-admin .kpis', {timeout: 8000});
  const kpis = await p.$$eval('#m-admin .kpi', els => els.map(e => e.innerText.replace(/\s+/g, ' ')));
  ok(kpis.some(k => /Usuários/i.test(k)) && kpis.some(k => /Projetos/i.test(k)), 'Visão geral mostra os números: ' + kpis.slice(0, 4).join(' | '));
  ok(await p.$$eval('#m-admin svg.adm-barras', s => s.length) === 2, 'mostra os 2 gráficos por dia');
  await p.screenshot({ path: 'adm_visao.png', fullPage: true });
  await p.click('[data-adm-aba="usuarios"]');
  const linhas = await p.$$eval('#m-admin .adm-tab tbody tr', rs => rs.map(r => r.innerText.replace(/\s+/g, ' ')));
  ok(linhas.some(l => /Ana Lima Costa/.test(l)) && linhas.some(l => /Maria Souza/.test(l)), 'lista de usuários tem Ana e Maria (' + linhas.length + ' linhas)');
  ok(linhas.some(l => /William.*Dono do sistema/.test(l)), 'William aparece marcado como dono do sistema');
  await p.fill('[data-adm-busca]', 'paulo'); ok(await p.$$eval('#m-admin .adm-tab tbody tr', rs => rs.length === 1 && /Ana Lima/.test(rs[0].innerText)), 'busca por cidade acha a Ana');
  ok(await p.evaluate(() => document.activeElement && document.activeElement.matches('[data-adm-busca]')), 'a busca não perde o foco ao digitar');
  await p.screenshot({ path: 'adm_usuarios.png', fullPage: true });
  await p.click('#m-admin .adm-tab tbody tr'); await p.waitForSelector('dialog.adm-modal [data-adm-hist] table, dialog.adm-modal [data-adm-hist] .vazio-linha:not(:has-text("Lendo"))', {timeout: 8000});
  const ficha = await p.$eval('dialog.adm-modal', d => d.innerText.replace(/\s+/g, ' '));
  ok(/529\.982\.247-25/.test(ficha) && /Avenida Paulista|Av\. Paulista/.test(ficha) && /Diretora/.test(ficha) && /anos/.test(ficha), 'ficha mostra CPF, endereço, cargo e idade');
  await p.screenshot({ path: 'adm_ficha.png' });
  await p.keyboard.press('Escape');
  await p.click('[data-adm-aba="desempenho"]');
  ok(/Tamanho do banco/i.test(await p.innerText('#m-admin')) && await p.$$eval('#m-admin .tabela tbody tr', r => r.length) > 5, 'Desempenho mostra tempos, erros e as tabelas do banco');
  await p.screenshot({ path: 'adm_desempenho.png', fullPage: true });
  await p.click('.item[data-tela="operacoes"]'); await p.waitForTimeout(1200);
  const tipos = conta("select string_agg(distinct tipo, ',' order by tipo) from uso_eventos where pessoa_id = 'd148fdc5-eef3-5398-bf89-f49b55b5cd28'");
  const telas = conta("select string_agg(tela, ',' order by id) from uso_eventos where pessoa_id = 'd148fdc5-eef3-5398-bf89-f49b55b5cd28' and tipo = 'tela'");
  ok(/entrou/.test(tipos) && /carregou/.test(tipos) && /tela/.test(tipos), 'registrou entrada, tempo de carregar e telas (' + tipos + ')');
  ok(/admin/.test(telas) && /operacoes/.test(telas), 'registrou as telas abertas: ' + telas);
  ok(+conta("select count(*) from uso_eventos where pessoa_id = 'd148fdc5-eef3-5398-bf89-f49b55b5cd28'") > antes, 'eventos novos gravados no banco');
  await p.setViewportSize({ width: 390, height: 844 }); await p.click('.item[data-tela="admin"]').catch(() => p.evaluate(() => document.querySelector('.item[data-tela="admin"]').click())); await p.waitForTimeout(500);
  await p.evaluate(() => { const b = document.querySelector('[data-adm-aba="usuarios"]'); b && b.click(); }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no celular a página não rola para o lado');
  await p.screenshot({ path: 'adm_celular.png' });
  await p.close();

  // ===== 2) usuário comum não vê o Admin =====
  // a Maria já completou o cadastro (senão a tela pede os dados antes de abrir o sistema)
  psqlRaw("insert into public.pessoas_privado (pessoa_id, nome_completo, data_nascimento, cpf, cep, logradouro, numero, bairro, cidade, uf, uso, termos_aceitos_em) select id, 'Maria Souza', '1992-07-01', '39053344705', '80010000', 'Rua XV', '10', 'Centro', 'Curitiba', 'PR', 'pessoal', now() from public.pessoas where email = 'maria@teste.com' on conflict (pessoa_id) do nothing");
  p = await abrir(M, {user:{id:M.uid, email:M.email}});
  ok(await p.evaluate(() => document.body.classList.contains('logado')), 'Maria entrou');
  ok(!(await p.isVisible('.item[data-tela="admin"]')), 'Maria NÃO vê o módulo Admin');
  await p.evaluate(() => { const b = document.querySelector('.item[data-tela="admin"]'); b.click(); });
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelector('#tela-admin').hidden), 'mesmo forçando, a tela do Admin não abre para a Maria');
  await p.close();

  psqlRaw("delete from public.pessoas_privado where pessoa_id = (select id from public.pessoas where email = 'maria@teste.com')");
  // ===== 3) cadastro completo =====
  p = await abrir(W, null);
  await p.click('text=Criar conta grátis');
  const cad = '[data-etapa="cadastro"]';
  await p.click(cad + ' .entrada-botao');
  ok(/nome completo/.test(await p.innerText(cad + ' [data-erro]')), 'pede o nome completo');
  await p.fill(cad + ' [name=nome]', 'Carlos Pereira Dias'); await p.fill(cad + ' [name=nascimento]', '1988-03-15');
  await p.fill(cad + ' [name=cpf]', '12345678900'); await p.fill(cad + ' [name=email]', 'carlos@teste.com');
  await p.click(cad + ' .entrada-botao');
  ok(/CPF não é válido/.test(await p.innerText(cad + ' [data-erro]')), 'recusa CPF inválido');
  await p.fill(cad + ' [name=cpf]', ''); await p.type(cad + ' [name=cpf]', '11144477735');
  ok(await p.inputValue(cad + ' [name=cpf]') === '111.444.777-35', 'máscara do CPF');
  await p.screenshot({ path: 'cad_1.png' });
  await p.click(cad + ' .entrada-botao');
  ok(await p.isVisible(cad + ' [data-passo="2"]'), 'passa para o endereço');
  await p.type(cad + ' [name=cep]', '01310100'); await p.waitForTimeout(400);
  ok(await p.inputValue(cad + ' [name=logradouro]') === 'Avenida Paulista' && await p.inputValue(cad + ' [name=uf]') === 'SP' && await p.inputValue(cad + ' [name=cidade]') === 'São Paulo', 'CEP preenche rua, cidade e UF sozinho');
  await p.click(cad + ' .entrada-botao');
  ok(/número/.test(await p.innerText(cad + ' [data-erro]')), 'pede o número da casa');
  await p.fill(cad + ' [name=numero]', '900');
  await p.screenshot({ path: 'cad_2.png' });
  await p.click(cad + ' .entrada-botao');
  ok(await p.isVisible(cad + ' [data-passo="3"]'), 'passa para o uso');
  await p.click(cad + ' .entrada-opcoes input[value=trabalho]');
  await p.click(cad + ' .entrada-botao');
  ok(/cargo/.test(await p.innerText(cad + ' [data-erro]')), 'para trabalho, pede o cargo');
  await p.fill(cad + ' [name=cargo]', 'Analista'); await p.fill(cad + ' [name=empresa]', 'Empresa X');
  await p.screenshot({ path: 'cad_3.png' });
  await p.click(cad + ' .entrada-botao');
  ok(await p.isVisible(cad + ' [data-passo="4"]') && await p.innerText(cad + ' .entrada-botao') === 'Criar minha conta', 'passa para a senha');
  await p.fill(cad + ' [name=senha]', 'senhafraca');
  ok(await p.$$eval(cad + ' [data-regras] li.ok', l => l.map(x => x.dataset.r).join()) === 'tam', 'lista da senha marca só o que já cumpriu');
  await p.fill(cad + ' [name=senha2]', 'senhafraca'); await p.check(cad + ' [name=termos]');
  await p.click(cad + ' .entrada-botao');
  ok(/regras/.test(await p.innerText(cad + ' [data-erro]')), 'recusa senha sem maiúscula, número e caractere especial');
  await p.fill(cad + ' [name=senha]', 'Senha@2026'); await p.fill(cad + ' [name=senha2]', 'Senha@2026');
  ok(await p.$$eval(cad + ' [data-regras] li.ok', l => l.length) === 4, 'senha forte cumpre as 4 regras');
  await p.screenshot({ path: 'cad_4.png' });
  await p.click(cad + ' .entrada-botao'); await p.waitForTimeout(300);
  const env = await p.evaluate(() => window.__cadastro);
  ok(env && env.email === 'carlos@teste.com' && env.password === 'Senha@2026' && env.options.data.cpf === '11144477735' && env.options.data.cep === '01310100' && env.options.data.uso === 'trabalho' && env.options.data.termos === 'sim', 'envia o cadastro completo para o Supabase');
  ok(/Conta criada/.test(await p.innerText(cad + ' [data-ok]')), 'mostra "Conta criada"');
  // o que o Supabase faria: cria o login com esses dados, e o gatilho guarda na tabela privada
  psqlRaw("insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000c1', 'carlos@teste.com', " + lit(env.options.data) + ')');
  ok(conta("select cpf || '|' || cidade || '|' || cargo from pessoas_privado pp join pessoas p on p.id = pp.pessoa_id where p.email = 'carlos@teste.com'") === '11144477735|São Paulo|Analista', 'o banco guarda o cadastro na tabela privada');
  ok(conta("select raw_user_meta_data ? 'cpf' from auth.users where email = 'carlos@teste.com'") === 'f', 'e tira o CPF dos dados do login');
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'cadastro no celular sem rolar para o lado');
  await p.close();

  // ===== 4) troca de senha com a mesma regra =====
  p = await abrir(W, null);
  await p.evaluate(() => { document.querySelectorAll('[data-etapa]').forEach(e => { e.hidden = e.dataset.etapa !== 'trocar'; }); });
  await p.fill('[data-etapa="trocar"] [name=senha]', 'abcdefgh1'); await p.fill('[data-etapa="trocar"] [name=senha2]', 'abcdefgh1');
  await p.click('[data-etapa="trocar"] .entrada-botao');
  ok(/regras/.test(await p.innerText('[data-etapa="trocar"] [data-erro]')), 'nova senha também exige maiúscula, número e caractere especial');
  await p.close();

  await b.close();
  console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK');
  process.exit(falhas ? 1 : 0);
})();
