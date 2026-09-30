/* =====================================================================
   Contas conectadas: GitHub e GitLab com um clique (parte 32 do banco, função git-conectar).
   - Cada empresa (espaço) conecta a própria conta numa janelinha do GitHub ou do GitLab e
     escolhe qual repositório é de cada projeto, produto ou aplicação.
   - GitHub: pelo app do CicloDev (os avisos chegam sozinhos). GitLab: pelo OAuth (o CicloDev cria o aviso no projeto).
   - O dono do sistema cria o app do GitHub e configura o GitLab uma vez, na tela Admin (aba GitHub e GitLab).
   A janelinha volta para esta mesma página com ?git=...; o script do começo da página (build.py) avisa a janela
   principal pelo BroadcastChannel e pelo localStorage, e a janela principal termina aqui. Prefixo gc.
   ===================================================================== */
const GC = {status:null, conexoes:null, repos:{}, aoConectar:null, feitos:new Set()};
const GC_NOME = {github:'GitHub', gitlab:'GitLab'};
const GC_ESPERA = 'ciclodev-git-espera', GC_VOLTA = 'ciclodev-git-volta';
const gcSb = () => COM_BANCO ? window.ciclodevBanco : null;
const gcRetorno = git => location.origin + location.pathname + '?git=' + git;

async function gcFuncao(corpo){
  const sb = gcSb();
  if (!sb || !sb.functions) return {ok:false, erro:'Conectar o GitHub e o GitLab só funciona no CicloDev com login'};
  try {
    const {data, error} = await sb.functions.invoke('git-conectar', {body:corpo});
    if (error){
      let msg = error.message || String(error);
      try { const j = error.context && typeof error.context.json === 'function' ? await error.context.json() : null; if (j && j.erro) msg = j.erro; } catch(e){}
      return {ok:false, erro:msg};
    }
    return data || {};
  } catch(e){ return {ok:false, erro:e.message || String(e)}; }
}
async function gcCarregar(forcar){
  const sb = gcSb(); if (!sb) { GC.status = {github:{pronto:false}, gitlab:{pronto:false}}; GC.conexoes = []; return; }
  if (GC.status && GC.conexoes && !forcar) return;
  const [s, c] = await Promise.all([sb.rpc('git_apps_status'), sb.from('git_conexoes').select('*').order('criado_em')]);
  GC.status = s.data || {github:{pronto:false}, gitlab:{pronto:false}};
  GC.conexoes = (c.data || []).filter(x => !x.removida_em);
  if (s.error || c.error) GC.erro = tfErro(s.error || c.error); else GC.erro = null;
}
function gcGuardar(k, v){ try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
function gcLer(k){ try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch(e){ return null; } }
function gcJanela(url){
  const w = window.open(url, 'ciclodev-git', 'width=1020,height=780');
  if (!w){ toast('O navegador bloqueou a janelinha. Permita janelas deste site e clique de novo.'); return null; }
  try { w.focus(); } catch(e){}
  return w;
}

/* ---------- conectar uma conta (abre a janelinha) ---------- */
async function gcConectar(provedor, aoTerminar){
  await gcCarregar();
  const st = GC.status[provedor] || {};
  if (!st.pronto){ toast(provedor === 'github' ? 'O app do GitHub ainda não foi criado. O dono do sistema cria em Admin, aba GitHub e GitLab.' : 'O GitLab ainda não foi configurado. O dono do sistema configura em Admin, aba GitHub e GitLab.'); return; }
  const {data:estado, error} = await gcSb().rpc('git_estado_novo', {p_provedor:provedor});
  if (error){ toast('Não deu para começar: ' + tfErro(error)); return; }
  gcGuardar(GC_ESPERA, {provedor, estado, client_id:provedor === 'github' ? st.client_id : null, t:Date.now()});
  GC.aoConectar = aoTerminar || null;
  const url = provedor === 'github'
    ? 'https://github.com/apps/' + encodeURIComponent(st.slug) + '/installations/new?state=' + encodeURIComponent(estado)
    : st.base + '/oauth/authorize?' + new URLSearchParams({client_id:st.client_id, redirect_uri:st.retorno, response_type:'code', state:estado, scope:'api'}).toString();
  gcJanela(url);
}

/* ---------- a volta da janelinha ---------- */
async function gcVolta(d){
  if (!d || !d.git) return;
  const chave = (d.code || '') + '|' + (d.state || '') + '|' + (d.installation_id || '') + '|' + (d.error || '');
  if (GC.feitos.has(chave)) return; GC.feitos.add(chave);
  const espera = gcLer(GC_ESPERA);
  gcGuardar(GC_VOLTA, null);
  if (!espera || Date.now() - (espera.t || 0) > 30 * 60000) return;
  if (d.error){ gcGuardar(GC_ESPERA, null); toast((d.git === 'gitlab' ? 'O GitLab' : 'O GitHub') + ' não conectou: ' + (d.error_description || d.error)); return; }
  if (!d.code) return;
  gcGuardar(GC_ESPERA, null);
  if (d.git === 'app'){
    const r = await gcFuncao({acao:'app_concluir', code:d.code, estado:d.state || espera.estado, retorno:espera.retorno});
    if (!r.ok){ toast('Não deu para criar o app: ' + r.erro); return; }
    GC.status = null; await gcCarregar(true);
    tfAviso('App do GitHub criado: ' + (r.app && r.app.slug) + '. Agora cada empresa conecta a conta dela em Entregas, Ligar repositório.', [], 7000);
    if (UI.modulo === 'admin') rAdmin();
    return;
  }
  const r = await gcFuncao({acao:'concluir', provedor:d.git, code:d.code, estado:d.state || espera.estado});
  if (!r.ok){ toast('Não deu para conectar: ' + r.erro); return; }
  await gcCarregar(true);
  if (r.instalar){ tfAviso('A conta foi confirmada, mas o app do CicloDev ainda não está instalado nela. Clique em Conectar ao GitHub de novo e escolha a conta.', [], 7000); }
  else tfAviso((d.git === 'gitlab' ? 'GitLab' : 'GitHub') + ' conectado.', [], 3000);
  if (GC.aoConectar) GC.aoConectar();
}
try { const bc = new BroadcastChannel('ciclodev-git'); bc.onmessage = e => gcVolta(e.data); } catch(e){}
window.addEventListener('storage', e => { if (e.key === GC_VOLTA && e.newValue){ try { gcVolta(JSON.parse(e.newValue).dados); } catch(x){} } });

/* ---------- Ligar repositório (aba Entregas) ---------- */
function gcOnde(){
  // só o ponto aberto e o que está dentro dele: um repositório nunca fica ligado a um lugar que você não está vendo
  const suf = {project:' (projeto inteiro)', product:' (só este produto)', app:' (só esta aplicação)'};
  return nosDentro(UI.sel).filter(k => !k.startsWith('client')).map(k => [k, nomeDe(k) + (suf[k.split(':')[0]] || '')]);
}
function gcLigarRepo(){
  if (!COM_BANCO){ modal('Ligar repositório', '<p style="margin:0">No modo de exemplo não dá para conectar o GitHub ou o GitLab. Entre no CicloDev com login para ligar os repositórios.</p>', [{txt:'Entendi'}]); return; }
  const onde = gcOnde();
  const dlg = modal('Ligar repositório', '<div class="grade-form"><label class="lb largo">Ligar a<select class="sel" id="gc-onde">' + onde.map(([k, n]) => '<option value="' + k + '"' + (k === UI.sel ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select></label></div>' +
    '<div class="tf-opcoes"><label><input type="checkbox" id="gc-mover" checked> Mudar o status dos itens sozinho (branch: Em andamento, PR: Em revisão, PR mesclado: Concluído)</label></div>' +
    '<div id="gc-corpo"><p class="sec">Lendo as contas conectadas…</p></div>', [{txt:'Fechar', cls:'sec'}]);
  dlg.classList.add('gc-modal');
  const pintar = async forcar => { await gcCarregar(forcar); if (dlg.isConnected) $('#gc-corpo', dlg).innerHTML = gcContasHTML(); };
  pintar(true);
  dlg.addEventListener('click', async e => {
    let b;
    if ((b = e.target.closest('[data-gc-conectar]'))){ gcConectar(b.dataset.gcConectar, () => pintar(true)); return; }
    if ((b = e.target.closest('[data-gc-ver]'))){ gcMostrarRepos(dlg, b.dataset.gcVer); return; }
    if ((b = e.target.closest('[data-gc-desconectar]'))){ gcDesconectar(b.dataset.gcDesconectar, () => pintar(true)); return; }
    if ((b = e.target.closest('[data-gc-ligar]'))){
      const [con, ext] = b.dataset.gcLigar.split('|'), no = $('#gc-onde', dlg).value.split(':')[1];
      b.disabled = true; b.textContent = 'Ligando…';
      const r = await gcFuncao({acao:'ligar', no_id:no, conexao_id:con, externo_id:ext, mover:$('#gc-mover', dlg).checked});
      if (!r.ok){ b.disabled = false; b.textContent = 'Ligar'; toast('Não deu para ligar: ' + r.erro); return; }
      EN.repos = (EN.repos || []).filter(x => x.id !== r.repositorio.id).concat(r.repositorio);
      b.textContent = 'Ligado'; b.classList.add('gc-ok');
      if (UI.view === 'entregas') rView();
      if (typeof ifrAutoCarregar === 'function' && UI.view === 'infra'){ await ifrAutoCarregar(); ifrLado(); }
      tfAviso('Repositório ' + r.repositorio.nome + ' ligado. Os desenhos do código já foram pedidos.', [], 5000);
    }
  });
  dlg.addEventListener('input', e => { if (e.target.matches('[data-gc-busca]')) gcFiltrar(dlg, e.target.value); });
  dlg.addEventListener('change', e => { if (e.target.id === 'gc-onde') $$('[data-gc-lista] [data-gc-ligar]', dlg).forEach(x => gcMarcarLigado(x, dlg)); });
}
function gcContasHTML(){
  const st = GC.status || {}, cs = GC.conexoes || [];
  const botao = p => st[p] && st[p].pronto
    ? '<button type="button" class="btn ' + (cs.some(c => c.provedor === p) ? 'sec' : 'acento') + '" data-gc-conectar="' + p + '">' + EN_ICO[p] + (cs.some(c => c.provedor === p) ? 'Conectar outra conta do ' : 'Conectar ao ') + GC_NOME[p] + '</button>'
    : '<span class="gc-nao">' + EN_ICO[p] + GC_NOME[p] + ': ainda não ativado pelo dono do sistema</span>';
  const conta = c => '<li class="gc-conta">' + (c.avatar_url ? '<img src="' + esc(c.avatar_url) + '" alt="" width="28" height="28">' : EN_ICO[c.provedor]) +
    '<div><b>' + esc(c.conta) + '</b><small>' + GC_NOME[c.provedor] + (c.conta_tipo === 'Organization' ? ' · organização' : '') + (c.ultimo_erro ? ' · <span class="en2-erro">' + esc(c.ultimo_erro) + '</span>' : '') + '</small></div>' +
    '<div class="gc-conta-a"><button type="button" class="btn peq" data-gc-ver="' + c.id + '">Escolher repositório</button>' +
    (c.provedor === 'github' && c.url ? '<a class="btn fant peq" href="' + esc(c.url) + '" target="_blank" rel="noopener noreferrer" title="Escolher no GitHub quais repositórios o CicloDev vê">Mudar acesso no GitHub</a>' : '') +
    '<button type="button" class="btn fant peq" data-gc-desconectar="' + c.id + '">Desconectar</button></div>' +
    '<div class="gc-repos" data-gc-repos="' + c.id + '" hidden></div></li>';
  return (GC.erro ? '<p class="entrada-erro">' + esc(GC.erro) + '</p>' : '') +
    '<h3 class="gc-t">Contas conectadas' + I('Contas conectadas: as contas do GitHub e do GitLab que a sua empresa ligou ao CicloDev. Valem para todos os projetos do espaço. Cada repositório escolhido fica ligado só ao ponto que você escolher acima.') + '</h3>' +
    (cs.length ? '<ul class="gc-contas">' + cs.map(conta).join('') + '</ul>' : '<p class="sec">Nenhuma conta conectada ainda. Clique abaixo: abre uma janelinha do GitHub ou do GitLab para você autorizar e escolher os repositórios.</p>') +
    '<div class="gc-botoes">' + botao('github') + botao('gitlab') + '</div>';
}
async function gcMostrarRepos(dlg, conexao){
  const alvo = $('[data-gc-repos="' + conexao + '"]', dlg); if (!alvo) return;
  if (!alvo.hidden && alvo.dataset.cheio){ alvo.hidden = true; return; }
  alvo.hidden = false; alvo.innerHTML = '<p class="sec">Lendo os repositórios…</p>';
  const r = await gcFuncao({acao:'repos', conexao_id:conexao});
  if (!r.ok){ alvo.innerHTML = '<p class="entrada-erro">' + esc(r.erro) + '</p>'; return; }
  alvo.dataset.cheio = '1';
  const lista = r.repos || [];
  alvo.innerHTML = lista.length
    ? (lista.length > 6 ? '<input class="campo" data-gc-busca placeholder="Procurar repositório" aria-label="Procurar repositório">' : '') +
      '<ul class="gc-lista" data-gc-lista>' + lista.map(x => '<li data-gc-nome="' + esc(x.nome.toLowerCase()) + '"><span><b>' + esc(x.nome) + '</b><small>' + (x.privado ? 'privado · ' : '') + 'branch ' + esc(x.branch) + '</small></span>' +
        '<button type="button" class="btn sec peq" data-gc-ligar="' + conexao + '|' + esc(x.externo_id) + '" data-gc-repo-nome="' + esc(x.nome) + '">Ligar</button></li>').join('') + '</ul>'
    : '<p class="sec">Esta conta não deixou o CicloDev ver nenhum repositório.' + ((GC.conexoes || []).find(c => c.id === conexao && c.provedor === 'github') ? ' Use "Mudar acesso no GitHub" para escolher quais.' : ' No GitLab, a conta precisa ser Maintainer do projeto.') + '</p>';
  $$('[data-gc-ligar]', alvo).forEach(x => gcMarcarLigado(x, dlg));
}
function gcMarcarLigado(b, dlg){
  const no = $('#gc-onde', dlg).value.split(':')[1], nome = b.dataset.gcRepoNome;
  const ja = (EN.repos || []).some(r => r.no_id === no && r.nome.toLowerCase() === String(nome).toLowerCase());
  b.textContent = ja ? 'Ligado' : 'Ligar'; b.classList.toggle('gc-ok', ja); b.disabled = false;
}
function gcFiltrar(dlg, txt){ const t = txt.trim().toLowerCase(); $$('[data-gc-lista] li', dlg).forEach(li => { li.hidden = !!t && !li.dataset.gcNome.includes(t); }); }
function gcDesconectar(id, depois){
  const c = (GC.conexoes || []).find(x => x.id === id); if (!c) return;
  tfExcluirPerguntaSimples('Desconectar a conta ' + esc(c.conta) + ' do ' + GC_NOME[c.provedor] + '?', 'Ela sai do espaço. Desligue antes os repositórios que vieram dela.' + (c.provedor === 'github' ? ' Para tirar o app do CicloDev da conta, use também "Mudar acesso no GitHub".' : ' A chave do GitLab é devolvida.'), async () => {
    const r = await gcFuncao({acao:'desconectar', conexao_id:id});
    if (!r.ok){ toast('Não deu para desconectar: ' + r.erro); return; }
    if (depois) depois(); tfAviso('Conta ' + c.conta + ' desconectada.', [], 3000);
  });
}
function gcDesligarRepo(id){
  const r = (EN.repos || []).find(x => x.id === id); if (!r) return;
  tfExcluirPerguntaSimples('Desligar o repositório ' + esc(r.nome) + '?', 'Os branches, commits e pull requests que vieram dele saem dos itens. As publicações registradas continuam no histórico.' + (r.provedor === 'gitlab' ? ' O aviso que o CicloDev criou no projeto do GitLab sai junto.' : ''), async () => {
    const res = COM_BANCO ? await gcFuncao({acao:'desligar', repo_id:id}) : {ok:await enApagar('repositorios', id)};
    if (!res.ok){ toast('Não deu para desligar: ' + (res.erro || 'sem permissão')); return; }
    EN.repos = EN.repos.filter(x => x.id !== id); if (UI.view === 'entregas') rView();
    tfAviso('Repositório ' + r.nome + ' desligado.' + (res.aviso ? ' ' + res.aviso : ''), [], res.aviso ? 8000 : 4000);
  });
}

/* ---------- Admin: o app do GitHub e o GitLab (só o dono do sistema) ---------- */
function gcAdminHTML(){
  if (!GC.status){ gcCarregar(true).then(() => { if (UI.modulo === 'admin' && ADM.aba === 'git') rAdmin(); }); return '<p class="vazio-linha">Lendo…</p>'; }
  const gh = GC.status.github || {}, gl = GC.status.gitlab || {};
  const hook = (window.ciclodevBanco && window.ciclodevBanco.supabaseUrl || '').replace(/\/$/, '') + '/functions/v1/git-webhook';
  return '<div class="graficos"><section class="grafico gc-adm"><h3>' + EN_ICO.github + 'App do GitHub</h3>' +
    (gh.pronto
      ? '<p>Pronto: <a href="' + esc(gh.html_url || '') + '" target="_blank" rel="noopener noreferrer"><b>' + esc(gh.nome || gh.slug) + '</b></a>' + (gh.dono ? ' (da conta ' + esc(gh.dono) + ')' : '') + '. As empresas conectam a conta delas em Entregas, Ligar repositório.</p>' +
        '<p class="sec">Os avisos chegam em <code>' + esc(hook) + '</code>. A volta das janelinhas vai para <code>' + esc(gh.retorno || '') + '</code>: o app só funciona neste endereço do CicloDev.</p>'
      : '<p>Cria, com um clique, o app do CicloDev no GitHub. Ele é o que as empresas instalam para ligar os repositórios delas. As chaves do app ficam guardadas no banco; ninguém precisa copiar nada.</p>' +
        '<div class="grade-form"><label class="lb">Nome do app<input class="campo" id="gc-app-nome" value="CicloDev"></label><label class="lb">Organização no GitHub (opcional)<input class="campo" id="gc-app-org" placeholder="deixe vazio para a sua conta"></label></div>' +
        '<p class="sec">Crie a partir do endereço principal do CicloDev (' + esc(location.origin) + '): é para ele que o GitHub devolve as janelinhas. O nome do app precisa ser único no GitHub; se já existir, troque na tela do GitHub.</p>' +
        '<button type="button" class="btn acento" data-gc-criar-app>' + EN_ICO.github + 'Criar o app do GitHub</button>') +
    '</section><section class="grafico gc-adm"><h3>' + EN_ICO.gitlab + 'GitLab</h3>' +
    (gl.pronto ? '' : '<ol class="gc-passos">' +
      '<li>Se a sua empresa usa um GitLab próprio (não o gitlab.com), troque primeiro o <b>Endereço do GitLab</b> lá embaixo.</li>' +
      '<li>Abra a página de aplicativos do GitLab, já logado com a conta da empresa: <a href="' + esc((gl.base || 'https://gitlab.com').replace(/\/$/, '')) + '/-/user_settings/applications" target="_blank" rel="noopener noreferrer"><b>abrir no GitLab</b></a>. (Caminho pelo menu: sua foto, <b>Edit profile</b>, <b>Applications</b>.)</li>' +
      '<li>Clique em <b>Add new application</b> e preencha:<ul>' +
        '<li><b>Name</b>: CicloDev</li>' +
        '<li><b>Redirect URI</b>: <code>' + esc(gcRetorno('gitlab')) + '</code> <button type="button" class="btn sec mini" data-gc-copiar="' + esc(gcRetorno('gitlab')) + '">Copiar</button></li>' +
        '<li><b>Confidential</b>: deixe marcado</li>' +
        '<li><b>Scopes</b>: marque só <b>api</b></li></ul></li>' +
      '<li>Clique em <b>Save application</b>. O GitLab mostra dois códigos: <b>Application ID</b> e <b>Secret</b>. Copie cada um para os campos abaixo. O Secret só aparece uma vez: se fechar a página, use <b>Renew secret</b>.</li>' +
      '<li>Clique em <b>Salvar o GitLab</b>.</li></ol>') +
    '<p class="sec">Os campos abaixo não são o seu login. São os códigos que o GitLab gera no passo 4. Se o navegador oferecer para preencher com seu e-mail ou senha, recuse.</p>' +
    '<div class="grade-form"><label class="lb">Application ID<input class="campo" id="gc-gl-id" name="gc-gitlab-application-id" value="' + esc(gl.client_id || '') + '" autocomplete="off" spellcheck="false" data-lpignore="true" data-1p-ignore placeholder="código longo do GitLab"></label>' +
    '<label class="lb">Secret<input class="campo gc-oculto" id="gc-gl-seg" name="gc-gitlab-secret" type="text" autocomplete="off" spellcheck="false" data-lpignore="true" data-1p-ignore placeholder="' + (gl.pronto ? 'deixe vazio para manter' : 'começa com gloas-') + '"></label>' +
    '<label class="lb largo">Endereço do GitLab<input class="campo" id="gc-gl-base" name="gc-gitlab-base" value="' + esc(gl.base || 'https://gitlab.com') + '" autocomplete="off" spellcheck="false"></label></div>' +
    '<p class="sec">' + (gl.pronto ? 'Pronto. As empresas conectam a conta delas em Entregas, Ligar repositório.' : 'Ainda não configurado.') + '</p>' +
    '<button type="button" class="btn ' + (gl.pronto ? 'sec' : 'acento') + '" data-gc-gitlab>' + (gl.pronto ? 'Salvar mudanças' : 'Salvar o GitLab') + '</button></section></div>';
}
async function gcCriarApp(){
  const nome = ($('#gc-app-nome') || {}).value || 'CicloDev', org = (($('#gc-app-org') || {}).value || '').trim();
  if (org && !/^[A-Za-z0-9-]{1,39}$/.test(org)){ toast('Nome de organização inválido'); return; }
  const sb = gcSb();
  const {data:estado, error} = await sb.rpc('git_estado_novo', {p_provedor:'github-app'});
  if (error){ toast('Não deu para começar: ' + tfErro(error)); return; }
  const hook = (sb.supabaseUrl || '').replace(/\/$/, '') + '/functions/v1/git-webhook';
  const manifesto = {
    name:nome.trim().slice(0, 34) || 'CicloDev', url:location.origin, description:'Liga os repositórios ao CicloDev: branches, commits e pull requests nos itens, publicações e os desenhos do sistema.',
    hook_attributes:{url:hook, active:true}, redirect_url:gcRetorno('app'), callback_urls:[gcRetorno('github')], setup_url:gcRetorno('github'),
    setup_on_update:true, request_oauth_on_install:true, public:true,
    default_permissions:{contents:'read', metadata:'read', pull_requests:'read', deployments:'read'},
    default_events:['push', 'create', 'delete', 'pull_request', 'release', 'deployment_status'],
  };
  gcGuardar(GC_ESPERA, {provedor:'app', estado, retorno:gcRetorno('github'), t:Date.now()});
  const f = document.createElement('form');
  f.method = 'post'; f.target = 'ciclodev-git';
  f.action = (org ? 'https://github.com/organizations/' + encodeURIComponent(org) + '/settings/apps/new' : 'https://github.com/settings/apps/new') + '?state=' + encodeURIComponent(estado);
  const i = document.createElement('input'); i.type = 'hidden'; i.name = 'manifest'; i.value = JSON.stringify(manifesto); f.appendChild(i);
  document.body.appendChild(f);
  if (!gcJanela('about:blank')){ f.remove(); return; }
  f.submit(); f.remove();
}
async function gcSalvarGitlab(){
  const d = {client_id:$('#gc-gl-id').value.trim(), client_secret:$('#gc-gl-seg').value.trim(), base:$('#gc-gl-base').value.trim(), retorno:gcRetorno('gitlab')};
  if (!d.client_id || /@|\s/.test(d.client_id)){ toast('O Application ID é o código longo que o GitLab mostra depois de salvar o aplicativo, não o seu e-mail'); return; }
  if (!d.client_secret && !(GC.status && GC.status.gitlab && GC.status.gitlab.pronto)){ toast('Cole o Secret que o GitLab mostrou junto com o Application ID'); return; }
  const {error} = await gcSb().rpc('git_app_gravar', {p_provedor:'gitlab', p_dados:d});
  if (error){ toast('Não deu para salvar: ' + tfErro(error)); return; }
  GC.status = null; await gcCarregar(true); rAdmin(); tfAviso('GitLab configurado.', [], 3000);
}
document.addEventListener('click', e => {
  if (!e.target.closest('#m-admin')) return;
  if (e.target.closest('[data-gc-criar-app]')){ gcCriarApp(); return; }
  if (e.target.closest('[data-gc-gitlab]')){ gcSalvarGitlab(); return; }
  const cp = e.target.closest('[data-gc-copiar]'); if (cp){ enCopiar(cp.dataset.gcCopiar, cp); return; }
});
// voltou da janelinha com a janela principal fechada (ou recarregada): termina agora
(function(){ const v = gcLer(GC_VOLTA); if (v && v.dados && Date.now() - (v.t || 0) < 10 * 60000) setTimeout(() => gcVolta(v.dados), 1500); })();
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {marcosDoEscopo, enNos, gcOnde, enHTML, enNovaVersao, formMarco, exNoMd, noDono, nosDentro});
