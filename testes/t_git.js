// Contas conectadas pela tela (fonte/git.js): o dono cria o app do GitHub no Admin, a empresa conecta a conta pela janelinha,
// escolhe o repositório e liga ao projeto; desliga depois. O GitHub e a função git-conectar são de mentira; o banco é o Postgres local.
// Rodar: BD=<banco com as partes até a 32> node testes/t_git.js   (depois de python3 fonte/build.py)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { execFileSync } = require('child_process');
const BD = process.env.BD || 'ciclodev_grava';
const psql = sql => execFileSync('psql', ['-h', '/tmp', '-p', '55432', '-U', 'postgres', '-d', BD, '-v', 'ON_ERROR_STOP=1', '-Atq', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const uid = psql("select auth_user_id from public.pessoas where id = 'd148fdc5-eef3-5398-bf89-f49b55b5cd28'").trim();
const COMO = "set role authenticated; set request.jwt.claim.sub = '" + uid + "'; set request.jwt.claims = '{\"sub\":\"" + uid + "\",\"email\":\"william@teste.com\"}'; ";
const lit = v => v === null || v === undefined ? 'null' : typeof v === 'number' || typeof v === 'boolean' ? String(v) : typeof v === 'object' ? '$l$' + JSON.stringify(v) + '$l$' : '$l$' + v + '$l$';
const chamar = (fn, args, como = COMO) => { try { const out = psql(como + 'select to_json(public.' + fn + '(' + Object.entries(args).map(([k, v]) => k + ' => ' + lit(v)).join(', ') + '))').trim(); return { data: out ? JSON.parse(out) : null, error: null }; }
  catch (e) { const m = String(e.stderr || e.message).split('\n').find(l => /ERROR/.test(l)) || String(e.message); return { data: null, error: { message: m.replace(/^.*ERROR:\s*/, '') } }; } };
const tabela = (t, onde) => { const out = psql(COMO + 'select coalesce(json_agg(x), \'[]\') from (select * from public.' + t + (onde ? ' where ' + onde : '') + ' order by 1) x').trim(); return JSON.parse(out || '[]'); };

const FALSO = `
function q(t){ const st = {t, filtro:{}, op:'select'};
  const px = new Proxy(function(){}, { get(_, k){
    if (k === 'then') return (res, rej) => window.__bd(JSON.stringify(st)).then(r => JSON.parse(r)).then(res, rej);
    if (k === 'eq') return (c, v) => { st.filtro[c] = v; return px; };
    if (k === 'delete') return () => { st.op = 'delete'; return px; };
    return () => px; } }); return px; }
window.supabase = { createClient(){ const sess = {user:{id:'u1', email:'admin@it-ia.tec.br'}}; return { supabaseUrl:'https://proj.supabase.co',
  auth:{ async getSession(){ return {data:{session:sess}}; }, onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}}; }, async signOut(){} },
  storage:{ from(){ return {}; } },
  functions:{ async invoke(nome, o){ return JSON.parse(await window.__fn(JSON.stringify({nome, corpo:o.body || {}}))); } },
  from:q, async rpc(fn, args){ if (/^(git_|infra_)/.test(fn)) return JSON.parse(await window.__rpc(JSON.stringify({fn, args:args || {}}))); if (fn === 'sou_dono_sistema') return {data:true, error:null}; if (/^admin_/.test(fn)) return {data:fn === 'admin_resumo' ? {gerado_em:new Date().toISOString()} : [], error:null}; if (fn !== 'vincular_meu_login') return {data:null, error:null}; return {data:[{pessoa_id:window.__eu, nome:'William', papel:'master', numero:100001, espaco_id:window.__esp || null}], error:null}; } }; } };`;

(async () => {
  const eu = 'd148fdc5-eef3-5398-bf89-f49b55b5cd28';
  const esp = psql("select id from public.espacos where dono_id = '" + eu + "' and pessoal limit 1").trim();
  const pj = psql("select id from public.nos where tipo = 'projeto' and nome = 'BL'").trim();
  const b = await chromium.launch(); let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); };
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const erros = [];
  const fn = [];   // o que a tela pediu à função git-conectar
  await ctx.exposeFunction('__bd', s => { const st = JSON.parse(s);
    if (st.op === 'delete'){ const r = psql(COMO + 'with d as (delete from public.' + st.t + " where id = '" + st.filtro.id + "' returning id) select count(*) from d").trim(); return JSON.stringify({ data: +r ? [{ id: st.filtro.id }] : [], error: null }); }
    return JSON.stringify({ data: tabela(st.t, Object.entries(st.filtro).map(([k, v]) => k + " = '" + v + "'").join(' and ')), error: null }); });
  await ctx.exposeFunction('__rpc', s => { const { fn: f, args } = JSON.parse(s); return JSON.stringify(chamar(f, args)); });
  await ctx.exposeFunction('__fn', s => { const { nome, corpo: c } = JSON.parse(s); fn.push(nome + ':' + c.acao);
    const r = (d) => JSON.stringify({ data: d, error: null });
    if (nome !== 'git-conectar') return r({ ok: true });
    if (c.acao === 'app_concluir'){
      const e = chamar('git_estado_usar', { p_estado: c.estado, p_provedor: 'github-app' }); if (e.error) return r({ ok: false, erro: e.error.message });
      const g = chamar('git_app_gravar', { p_provedor: 'github', p_dados: { app_id: '123', slug: 'ciclodev-teste', client_id: 'Iv1.abc', client_secret: 's', webhook_secret: 'w', pem: '-----BEGIN RSA PRIVATE KEY-----\nx\n-----END RSA PRIVATE KEY-----', nome: 'CicloDev', html_url: 'https://github.com/apps/ciclodev-teste', dono: 'it-hub-ia', retorno: c.retorno } });
      return r(g.error ? { ok: false, erro: g.error.message } : { ok: true, app: g.data });
    }
    if (c.acao === 'concluir'){
      const e = chamar('git_estado_usar', { p_estado: c.estado, p_provedor: c.provedor }); if (e.error) return r({ ok: false, erro: e.error.message });
      if (c.code !== 'bom') return r({ ok: false, erro: 'O GitHub não confirmou a conta' });
      const id = chamar('git_conexao_gravar', { p_espaco: e.data.espaco_id, p_pessoa: e.data.pessoa_id, p_provedor: 'github', p_externo: '9001', p_conta: 'it-hub-ia', p_tipo: 'Organization', p_avatar: null, p_url: 'https://github.com/organizations/it-hub-ia/settings/installations/9001', p_tokens: null }, '');
      psql("select public.git_conexao_repos('" + id.data + "', array['555', '556'])");   // como a função: só os repositórios que a pessoa acessa
      return r({ ok: true, conexoes: [id.data] });
    }
    if (c.acao === 'repos') return r({ ok: true, repos: [{ externo_id: '555', nome: 'it-hub-ia/portal', url: 'https://github.com/it-hub-ia/portal', branch: 'main', privado: true }, { externo_id: '556', nome: 'it-hub-ia/site', url: 'https://github.com/it-hub-ia/site', branch: 'main', privado: false }] });
    if (c.acao === 'ligar'){
      const x = chamar('git_repo_ligar', { p_no: c.no_id, p_conexao: c.conexao_id, p_externo: c.externo_id, p_nome: c.externo_id === '555' ? 'it-hub-ia/portal' : 'it-hub-ia/site', p_url: 'https://github.com/x', p_branch: 'main', p_mover: c.mover });
      return r(x.error ? { ok: false, erro: x.error.message } : { ok: true, repositorio: x.data });
    }
    if (c.acao === 'desligar'){ const n = psql(COMO + "with d as (delete from public.repositorios where id = '" + c.repo_id + "' returning id) select count(*) from d").trim(); return r(+n ? { ok: true, aviso: null } : { ok: false, erro: 'sem permissão' }); }
    if (c.acao === 'desconectar'){ const x = chamar('git_conexao_remover', { p_id: c.conexao_id }); return r(x.error ? { ok: false, erro: x.error.message } : { ok: true }); }
    return r({ ok: false, erro: 'ação desconhecida' });
  });
  await ctx.addInitScript(([id, e]) => { window.__eu = id; window.__esp = e; }, [eu, esp]);
  await ctx.route('**/supabase-js@*/**', r => r.fulfill({ contentType: 'text/javascript', body: FALSO }));
  await ctx.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  const idas = [];   // para onde as janelinhas foram
  await ctx.route(/^https:\/\/github\.com\//, r => { idas.push(r.request().method() + ' ' + r.request().url() + (r.request().postData() ? ' ' + r.request().postData() : '')); r.fulfill({ contentType: 'text/html', body: '<p>GitHub de mentira</p>' }); });
  const URL0 = 'file://' + process.cwd() + '/vercel/index.html';
  const p = await ctx.newPage(); p.on('pageerror', e => { erros.push(e.message); console.log('PAGEERROR', e.message); });
  // a janela de confirmação antes de ligar (integrar.js): marca Conferi e confirma
  const confirmarLigar = async () => { await p.waitForTimeout(600); return p.evaluate(() => { const c = document.querySelector('dialog.modal[open] #ig-conferi'); if (!c) return false; c.click(); [...document.querySelectorAll('dialog.modal[open] .modal-rod .btn')].pop().click(); return true; }); };
  await p.goto(URL0); await p.waitForTimeout(2500);
  // uma janelinha que "volta" do GitHub para o CicloDev com os parâmetros dados
  const voltar = async (janela, busca) => { await janela.goto(URL0 + busca).catch(() => null); await p.waitForTimeout(1500); };
  const janelaNova = () => ctx.waitForEvent('page', { timeout: 5000 });

  // ---------- Admin: o dono cria o app do GitHub ----------
  await p.evaluate(() => document.querySelector('[data-tela="admin"]').click()); await p.waitForTimeout(600);
  await p.click('[data-adm-aba="git"]'); await p.waitForTimeout(800);
  ok(await p.isVisible('[data-gc-criar-app]'), 'Admin, aba GitHub e GitLab: sem app, aparece o botão Criar o app do GitHub');
  ok(/Redirect URI/.test(await p.textContent('#m-admin')) && /api/.test(await p.textContent('#m-admin')), 'e as instruções do GitLab (endereço de volta e escopo)');
  let janela = janelaNova(); await p.click('[data-gc-criar-app]'); janela = await janela; await p.waitForTimeout(800);
  const manif = idas.find(x => /^POST https:\/\/github\.com\/settings\/apps\/new\?state=/.test(x));
  const m = manif && JSON.parse(decodeURIComponent(manif.split(' manifest=')[1].replace(/\+/g, ' ')));
  ok(m && m.public === true && m.request_oauth_on_install && m.default_permissions.contents === 'read' && m.default_events.includes('deployment_status') && /\/functions\/v1\/git-webhook$/.test(m.hook_attributes.url),
    'o manifesto vai ao GitHub com o endereço dos avisos, só leitura do código e os eventos certos');
  const estadoApp = manif.match(/state=([0-9a-f]+)/)[1];
  await voltar(janela, '?git=app&code=codigo-app&state=' + estadoApp);
  await p.waitForTimeout(1500);
  ok(fn.includes('git-conectar:app_concluir') && psql("select publico->>'slug' from interno.git_apps where provedor = 'github'").trim() === 'ciclodev-teste', 'a volta da janelinha termina a criação e o app fica guardado no banco');
  if (process.env.FOTOS) await p.screenshot({ path: process.env.FOTOS + '/git_admin.png' });
  ok(/Pronto/.test(await p.textContent('#m-admin')) && !(await p.isVisible('[data-gc-criar-app]')), 'o Admin mostra o app pronto');
  ok(janela.isClosed() || /Pronto\. Pode fechar/.test(await janela.textContent('body').catch(() => 'Pronto. Pode fechar')), 'a janelinha avisa e fecha');

  // ---------- Entregas: a empresa conecta a conta e liga o repositório ----------
  await p.evaluate(() => document.querySelector('[data-tela="operacoes"]').click()); await p.waitForTimeout(400);
  await p.evaluate(k => { const U = window.__tf.UI; U.sel = 'project:' + k; U.view = 'entregas'; U.semArvore = true; window.__tf.rOperacoes(); }, pj); await p.waitForTimeout(1500);
  await p.click('[data-en-novo-repo]'); await p.waitForTimeout(1200);
  ok(await p.isVisible('.gc-modal [data-gc-conectar="github"]') && /Nenhuma conta conectada/.test(await p.textContent('.gc-modal')), 'Ligar repositório: sem conta, mostra Conectar ao GitHub');
  ok(await p.isVisible('.gc-modal [data-gc-autorizar]') && /installations\/new/.test(await p.textContent('.gc-modal .gc-dica')), 'e explica o caso do colaborador: o link para o dono instalar e o botão de só autorizar');
  ok(/ainda não ativado/.test(await p.textContent('.gc-modal')), 'o GitLab, ainda sem configurar, aparece como não ativado');
  janela = janelaNova(); await p.click('.gc-modal [data-gc-conectar="github"]'); janela = await janela; await p.waitForTimeout(800);
  const inst = idas.find(x => /apps\/ciclodev-teste\/installations\/new\?state=/.test(x));
  ok(!!inst, 'a janelinha abre na instalação do app do CicloDev no GitHub');
  const estado = inst.match(/state=([0-9a-f]+)/)[1];
  // o app já estava instalado: o GitHub volta sem código; a janelinha pede a confirmação da conta
  await janela.goto(URL0 + '?git=github&installation_id=9001&setup_action=update&state=' + estado).catch(() => null); await p.waitForTimeout(1200);
  ok(idas.some(x => x.startsWith('GET https://github.com/login/oauth/authorize?client_id=Iv1.abc&state=' + estado)), 'volta sem código (app já instalado): a janelinha pede a confirmação da conta no GitHub');
  await voltar(janela, '?git=github&code=bom&state=' + estado);
  await p.waitForTimeout(1500);
  ok(fn.includes('git-conectar:concluir') && +psql("select count(*) from public.git_conexoes where conta = 'it-hub-ia'").trim() === 1, 'a conta volta conectada no espaço');
  ok(/it-hub-ia/.test(await p.textContent('.gc-modal')) && await p.isVisible('.gc-modal [data-gc-ver]'), 'a janela mostra a conta, com Escolher repositório');
  await p.click('.gc-modal [data-gc-ver]'); await p.waitForTimeout(1000);
  if (process.env.FOTOS) await p.locator('.gc-modal').screenshot({ path: process.env.FOTOS + '/git_ligar.png' });
  ok(await p.locator('.gc-modal [data-gc-ligar]').count() === 2, 'lista os repositórios que a conta deixou ver');
  await p.click('.gc-modal [data-gc-ligar$="|555"]');
  ok(await confirmarLigar(), 'antes de ligar o repositório, aparece a janela de confirmação'); await p.waitForTimeout(1500);
  ok(+psql("select count(*) from public.repositorios where nome = 'it-hub-ia/portal' and conexao_id is not null and externo_id = '555'").trim() === 1, 'Ligar grava o repositório pela conta conectada');
  ok((await p.textContent('.gc-modal [data-gc-ligar$="|555"]')).trim() === 'Ligado', 'e o botão vira Ligado');
  await p.click('.gc-modal [data-fechar]'); await p.waitForTimeout(800);
  ok(/it-hub-ia\/portal/.test(await p.textContent('#ops-corpo')) && !/Como ligar/.test(await p.textContent('#ops-corpo')), 'a aba Entregas mostra o repositório, sem instruções de webhook');
  ok(await p.isVisible('[data-en-trocar-repo]') && await p.isVisible('[data-en-excluir-repo]') && /Desligar/.test(await p.textContent('[data-en-excluir-repo]')), 'cada repositório tem os botões Trocar e Desligar escritos');
  // desconectar com repositório ligado é recusado
  await p.click('[data-en-novo-repo]'); await p.waitForTimeout(1200);
  await p.click('.gc-modal [data-gc-desconectar]'); await p.waitForTimeout(400);
  await p.click('dialog:last-of-type .modal-rod .btn:last-child'); await p.waitForTimeout(800);
  ok(+psql("select count(*) from public.git_conexoes where conta = 'it-hub-ia'").trim() === 1, 'desconectar a conta com repositório ligado é recusado (pede para desligar antes)');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // desligar o repositório
  await p.evaluate(() => { window.__tf.UI.view = 'entregas'; window.__tf.rOperacoes(); }); await p.waitForTimeout(1200);
  await p.click('[data-en-excluir-repo]'); await p.waitForTimeout(400);
  await p.click('dialog:last-of-type .modal-rod .btn:last-child'); await p.waitForTimeout(1200);
  ok(fn.includes('git-conectar:desligar') && +psql("select count(*) from public.repositorios where nome = 'it-hub-ia/portal'").trim() === 0, 'Desligar tira o repositório (pela função, que também tira o aviso no GitLab)');
  ok(!erros.length, 'sem erro de JavaScript na tela' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close();
  console.log(falhas ? 'FALHAS: ' + falhas : 'TUDO OK');
  process.exit(falhas ? 1 : 0);
})();
