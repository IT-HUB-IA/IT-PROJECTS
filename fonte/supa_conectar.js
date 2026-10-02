/* =====================================================================
   Ligar um banco do Supabase sem senha (parte 54 do banco, função supabase-conectar). Prefixo sc.
   1. Conectar ao Supabase: janelinha do Supabase (OAuth com PKCE). A volta chega pelo mesmo caminho do GitHub
      (?git=supabase no endereço; o script do começo da página avisa esta janela) e termina em scVolta.
   2. Escolher o projeto e os esquemas.
   3. Conferir e ligar: a função lê DE VERDADE a estrutura, em só leitura, e só devolve a prova quando leu tudo
      (esquemas, tabelas, colunas, chaves, ligações, regras de acesso, permissões, papéis). Sem prova o banco não liga.
   Admin: o dono do sistema cadastra o app OAuth do CicloDev no Supabase (aba GitHub, GitLab e Supabase).
   ===================================================================== */
const SC = {status:null, conexoes:null, projetos:{}, aoConectar:null};
const scRetorno = () => location.origin + location.pathname + '?git=supabase';
async function scFuncao(corpo){
  const sb = COM_BANCO ? window.ciclodevBanco : null;
  if (!sb || !sb.functions) return {ok:false, erro:'Conectar o Supabase só funciona no CicloDev com login'};
  try {
    const {data, error} = await sb.functions.invoke('supabase-conectar', {body:corpo});
    if (error){
      let msg = error.message || String(error);
      try { const j = error.context && typeof error.context.json === 'function' ? await error.context.json() : null; if (j && (j.erro || j.falhas)) return Object.assign({ok:false}, j); } catch(e){}
      return {ok:false, erro:msg};
    }
    return data || {};
  } catch(e){ return {ok:false, erro:e.message || String(e)}; }
}
async function scCarregar(forcar){
  const sb = COM_BANCO ? window.ciclodevBanco : null;
  if (!sb){ SC.status = {pronto:false}; SC.conexoes = []; return; }
  if (SC.status && SC.conexoes && !forcar) return;
  const [s, c] = await Promise.all([sb.rpc('supa_app_status'), sb.from('supa_conexoes').select('*').order('criado_em')]);
  SC.status = s.data || {pronto:false}; SC.conexoes = c.data || [];
}

/* ---------- a janelinha do Supabase ---------- */
async function scConectar(aoTerminar){
  await scCarregar(true);
  if (!SC.status.pronto){ toast('O Supabase ainda não foi configurado. O dono do sistema configura em Admin, aba GitHub, GitLab e Supabase.'); return; }
  const {data, error} = await window.ciclodevBanco.rpc('supa_estado_novo');
  if (error || !data){ toast('Não deu para começar: ' + tfErro(error)); return; }
  gcGuardar(GC_ESPERA, {provedor:'supabase', estado:data.estado, t:Date.now()});
  SC.aoConectar = aoTerminar || null;
  gcJanela('https://api.supabase.com/v1/oauth/authorize?' + new URLSearchParams({client_id:SC.status.client_id, redirect_uri:SC.status.retorno, response_type:'code', state:data.estado, code_challenge:data.desafio, code_challenge_method:'S256'}).toString());
}
async function scVolta(d, espera){
  if (d.error){ toast('O Supabase não conectou: ' + (d.error_description || d.error)); return; }
  if (!d.code) return;
  const r = await scFuncao({acao:'concluir', code:d.code, estado:d.state || (espera && espera.estado)});
  if (!r.ok){ toast('Não deu para conectar o Supabase: ' + (r.erro || 'erro')); return; }
  SC.projetos[r.conexao_id] = r.projetos || [];
  await scCarregar(true);
  tfAviso('Supabase conectado (' + (r.conta || 'Supabase') + '). Agora escolha o projeto.', [], 3500);
  if (SC.aoConectar) SC.aoConectar(r.conexao_id);
}

/* ---------- Ligar banco pelo Supabase ---------- */
const SC_ITENS = [['so_leitura', 'Leitura em modo só leitura', c => c.so_leitura ? 'sim (o Supabase não deixa mudar nada)' : 'não'],
  ['tabelas', 'Tabelas', c => c.tabelas], ['colunas', 'Colunas', c => c.colunas], ['chaves', 'Chaves primárias', c => c.chaves], ['ligacoes', 'Ligações entre tabelas', c => c.ligacoes],
  ['regras', 'Regras de acesso (RLS)', c => c.regras + (c.tabelas ? ' (' + c.com_rls + ' de ' + c.tabelas + ' tabelas com RLS ligado)' : '')], ['permissoes', 'Permissões por papel', c => c.permissoes],
  ['papeis', 'Papéis', c => c.papeis], ['migracoes', 'Histórico de migrations', c => c.migracoes == null ? 'não tem (as tabelas ficam sem data)' : c.migracoes + ' migrations']];
function scConferenciaHTML(r){
  if (!r) return '';
  const c = r.conferencia;
  return '<div class="sc-conf ' + (r.ok ? 'ok' : 'erro') + '" data-sc-resultado><h4>' + (r.ok ? 'Conferido: dá para ler tudo' : 'Não ligou: a leitura não está completa') + '</h4>' +
    ((r.falhas || []).length ? '<ul class="sc-falhas">' + r.falhas.map(f => '<li>' + esc(f) + '</li>').join('') + '</ul>' : '') +
    (c ? '<dl class="sc-itens">' + SC_ITENS.map(([k, n, f]) => '<dt>' + esc(n) + '</dt><dd>' + esc(String(f(c))) + '</dd>').join('') + '</dl>' : '') +
    (c && (c.avisos || []).length ? '<p class="ifr-meta">' + c.avisos.map(esc).join(' ') + '</p>' : '') +
    (r.ok ? '' : '<p class="ifr-meta">Nada foi ligado. Corrija o que está acima e clique em Conferir e ligar de novo.</p>') + '</div>';
}
function scLigarModal(id){
  const b = id ? IFR_AUTO.bancos.find(x => x.id === id) : null;
  const st = {con:b ? b.supa_conexao_id : null, projeto:b ? b.supa_projeto : '', resultado:null, ocupado:false, carregando:false, erro:''};
  const dlg = modal(b ? 'Trocar o banco ' + esc(b.nome) : 'Ligar um banco do Supabase', '<div class="ifr-ed sc-corpo" id="sc-corpo"></div>', [{txt:'Cancelar', cls:'sec'}, {txt:'Conferir e ligar', acao:() => { scConferirLigar(dlg, st, b); return false; }}]);
  dlg.classList.add('sc-dlg');
  const nomeV = () => ($('#sc-nome', dlg) || {}).value, esqV = () => ($('#sc-esq', dlg) || {}).value;
  const pintar = async () => {
    const c = $('#sc-corpo', dlg); if (!c) return;
    const nome = nomeV(), esq = esqV();
    if (!SC.conexoes) await scCarregar();
    const contas = SC.conexoes || [];
    if (!st.con && contas.length === 1) st.con = contas[0].id;
    if (st.con && !SC.projetos[st.con] && !st.carregando){
      st.carregando = true; st.erro = '';
      scFuncao({acao:'projetos', conexao_id:st.con}).then(r => { st.carregando = false; if (r.ok) SC.projetos[st.con] = r.projetos || []; else st.erro = r.erro || 'Não deu para ler os projetos'; pintar(); });
    }
    const projs = st.con ? SC.projetos[st.con] : null;
    if (projs && projs.length === 1 && !st.projeto) st.projeto = projs[0].ref;
    c.innerHTML = '<p class="ifr-meta" style="margin:0">Sem senha: você autoriza o CicloDev no próprio Supabase. Antes de ligar, o CicloDev <b>confere de verdade</b> que consegue ler a estrutura inteira (tabelas, colunas, chaves, ligações, regras de acesso e permissões) e que a leitura é só leitura. Se faltar alguma coisa, não liga e diz o quê. O CicloDev nunca lê o conteúdo das tabelas, só a estrutura.</p>' +
      '<div class="sc-passo"><h4>1. Conta do Supabase</h4>' + (contas.length
        ? '<label class="lb">Conta<select class="sel" id="sc-con">' + (contas.length > 1 && !st.con ? '<option value="">Escolha…</option>' : '') + contas.map(x => '<option value="' + x.id + '"' + (x.id === st.con ? ' selected' : '') + '>' + esc(x.conta) + (x.ultimo_erro ? ' (precisa conectar de novo)' : '') + '</option>').join('') + '</select></label>' : '<p class="ifr-meta">Nenhuma conta do Supabase conectada ainda.</p>') +
        '<button type="button" class="btn ' + (contas.length ? 'sec' : 'acento') + ' peq" data-sc-conectar>' + (contas.length ? 'Conectar outra conta' : 'Conectar ao Supabase') + '</button></div>' +
      (st.con ? '<div class="sc-passo"><h4>2. Projeto e esquemas</h4>' + (st.erro ? '<p class="ifr-fonte-erro">' + esc(st.erro) + '</p>' : '') +
        (projs ? (projs.length ? '<label class="lb">Projeto<select class="sel" id="sc-proj">' + (!st.projeto ? '<option value="">Escolha…</option>' : '') + projs.map(p => '<option value="' + esc(p.ref) + '"' + (p.ref === st.projeto ? ' selected' : '') + '>' + esc(p.nome) + ' (' + esc(p.ref) + (p.regiao ? ', ' + esc(p.regiao) : '') + ')</option>').join('') + '</select></label>'
              : '<p class="ifr-meta">Esta autorização não alcança nenhum projeto. Conecte de novo escolhendo a organização certa.</p>')
          : st.erro ? '' : '<p class="vazio-linha">Lendo os projetos…</p>') +
        '<div class="ifr-ed-linha"><label class="lb">Nome<input class="campo" id="sc-nome" value="' + esc(nome != null ? nome : b ? b.nome : 'Banco de produção') + '"></label>' +
        '<label class="lb">Esquemas<input class="campo" id="sc-esq" value="' + esc(esq != null ? esq : b ? (b.esquemas || []).join(', ') : 'public') + '" placeholder="public"></label></div></div>' : '') +
      '<div data-sc-saida>' + scConferenciaHTML(st.resultado) + '</div>' +
      '<p style="margin:0"><button type="button" class="ifr-lnk" data-sc-endereco>Prefiro colar o endereço com usuário e senha</button></p>';
  };
  dlg.addEventListener('change', e => {
    if (e.target.id === 'sc-con'){ st.con = e.target.value || null; st.projeto = ''; st.resultado = null; pintar(); }
    else if (e.target.id === 'sc-proj'){ st.projeto = e.target.value; st.resultado = null; const s = $('[data-sc-saida]', dlg); if (s) s.innerHTML = ''; }
  });
  dlg.addEventListener('click', e => {
    if (e.target.closest('[data-sc-conectar]')){ scConectar(cid => { st.con = cid; st.projeto = ''; st.resultado = null; if (document.body.contains(dlg)) pintar(); }); return; }
    if (e.target.closest('[data-sc-endereco]')){ dlg.close(); dlg.remove(); ifrBancoModal(id, 'supabase', true); }
  });
  st.pintar = pintar;
  pintar();
  return dlg;
}
async function scConferirLigar(dlg, st, b){
  if (st.ocupado) return;
  const nome = (($('#sc-nome', dlg) || {}).value || '').trim(), esq = (($('#sc-esq', dlg) || {}).value || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!st.con){ toast('Conecte uma conta do Supabase primeiro.'); return; }
  if (!st.projeto){ toast('Escolha o projeto do Supabase.'); return; }
  if (!esq.length){ toast('Diga quais esquemas ler.'); return; }
  const btn = $$('.modal-rod .btn', dlg).pop(); st.ocupado = true; if (btn){ btn.disabled = true; btn.textContent = 'Conferindo…'; }
  const fim = () => { st.ocupado = false; if (btn){ btn.disabled = false; btn.textContent = 'Conferir e ligar'; } };
  const r = await scFuncao({acao:'conferir', conexao_id:st.con, projeto:st.projeto, esquemas:esq});
  st.resultado = r.erro && !r.falhas ? {ok:false, falhas:[r.erro]} : r;
  const s = $('[data-sc-saida]', dlg); if (s) s.innerHTML = scConferenciaHTML(st.resultado);
  if (!r.ok || !r.prova){ fim(); if (s && s.scrollIntoView) s.scrollIntoView({block:'nearest'}); return; }
  const {data, error} = await window.ciclodevBanco.rpc('infra_banco_supabase_ligar', {p_no:IFR.no, p_id:b ? b.id : null, p_nome:nome, p_prova:r.prova});
  fim();
  if (error || !data){ if (s) s.insertAdjacentHTML('beforeend', '<p class="ifr-fonte-erro">Conferiu, mas não deu para ligar: ' + esc(tfErro(error)) + '</p>'); return; }
  dlg.close(); dlg.remove();
  await ifrAutoCarregar(); ifrLado();
  const c = r.conferencia;
  tfAviso('Banco ' + (data.nome || '') + ' ligado sem senha. Conferido: ' + c.tabelas + ' tabelas, ' + c.colunas + ' colunas, ' + c.regras + ' regras de acesso. Em alguns minutos o DER e o mapa de acesso aparecem nas sub-abas DER e Segurança.', [], 7000);
}

/* ---------- o jeito antigo: Testar antes de salvar ---------- */
async function scTestarEndereco(conexao, motor, esquemas){
  return scFuncao({acao:'testar_endereco', no_id:IFR.no, conexao, motor, esquemas});
}
function scTesteHTML(r){
  if (!r) return '';
  const x = r.resultado;
  return '<div class="sc-conf ' + (r.ok ? 'ok' : 'erro') + '" data-sc-teste><h4>' + (r.ok ? 'Testado: conectou e leu a estrutura' : 'Não salvou: o teste não passou') + '</h4>' +
    (!r.ok ? '<p><b>' + esc(ifrErroAmigavel((r.falhas || [r.erro]).join(' '))) + '</b></p><ul class="sc-falhas">' + (r.falhas || [r.erro]).map(f => '<li>' + esc(f) + '</li>').join('') + '</ul>' : '') +
    (x ? '<dl class="sc-itens"><dt>Tabelas</dt><dd>' + x.tabelas + '</dd><dt>Colunas</dt><dd>' + x.colunas + '</dd><dt>Chaves primárias</dt><dd>' + x.chaves + '</dd><dt>Ligações</dt><dd>' + x.ligacoes + '</dd><dt>Regras de acesso (RLS)</dt><dd>' + x.regras + '</dd><dt>Permissões</dt><dd>' + x.permissoes + '</dd></dl>' : '') + '</div>';
}

/* ---------- Admin: o app do CicloDev no Supabase (só o dono do sistema) ---------- */
function scAdminHTML(){
  if (!SC.status){ scCarregar(true).then(() => { if (UI.modulo === 'admin' && ADM.aba === 'git') rAdmin(); }); return '<p class="vazio-linha">Lendo…</p>'; }
  const s = SC.status, ret = scRetorno();
  return '<section class="grafico gc-adm"><h3>Supabase (ligar banco sem senha)</h3>' +
    (s.pronto ? '' : '<ol class="gc-passos">' +
      '<li>Abra o Supabase com a conta da sua empresa, vá na organização e em <b>OAuth Apps</b>: <a href="https://supabase.com/dashboard/org/_/apps" target="_blank" rel="noopener noreferrer"><b>abrir no Supabase</b></a>.</li>' +
      '<li>Clique em <b>Add application</b> e preencha:<ul>' +
        '<li><b>Name</b>: CicloDev</li>' +
        '<li><b>Website URL</b>: <code>' + esc(location.origin) + '</code></li>' +
        '<li><b>Authorization callback URL</b>: <code>' + esc(ret) + '</code> <button type="button" class="btn sec mini" data-gc-copiar="' + esc(ret) + '">Copiar</button></li>' +
        '<li><b>Permissões</b>: marque só leitura (<b>Read</b>) em <b>Projects</b>, <b>Organizations</b> e <b>Database</b>. Não marque nada de escrita. Se a conferência disser que falta a permissão de banco, volte aqui e veja a mensagem.</li></ul></li>' +
      '<li>Confirme. O Supabase mostra o <b>Client ID</b> e o <b>Client Secret</b>. Copie cada um para os campos abaixo. O Secret só aparece uma vez.</li>' +
      '<li>Clique em <b>Salvar o Supabase</b>.</li></ol>') +
    '<p class="sec">O CicloDev só usa essa autorização para ler a <b>estrutura</b> do banco (pelo modo só leitura do Supabase, com consultas fixas no catálogo) e confere isso antes de ligar. Nunca lê o conteúdo das tabelas. Os campos abaixo não são o seu login: recuse se o navegador oferecer para preencher.</p>' +
    '<div class="grade-form"><label class="lb">Client ID<input class="campo" id="sc-adm-id" value="' + esc(s.client_id || '') + '" autocomplete="off" spellcheck="false" data-lpignore="true" data-1p-ignore></label>' +
    '<label class="lb">Client Secret<input class="campo gc-oculto" id="sc-adm-seg" type="text" autocomplete="off" spellcheck="false" data-lpignore="true" data-1p-ignore placeholder="' + (s.pronto ? 'deixe vazio para manter' : '') + '"></label></div>' +
    '<p class="sec">' + (s.pronto ? 'Pronto. As empresas ligam o banco delas em Infraestrutura, Ligar banco, Conectar ao Supabase.' : 'Ainda não configurado.') + '</p>' +
    '<button type="button" class="btn ' + (s.pronto ? 'sec' : 'acento') + '" data-sc-adm-salvar>' + (s.pronto ? 'Salvar mudanças' : 'Salvar o Supabase') + '</button></section>';
}
const _gcAdminHTMLSc = gcAdminHTML;
gcAdminHTML = function(){ const h = _gcAdminHTMLSc(); return h.endsWith('</div>') && GC.status ? h.slice(0, -6) + scAdminHTML() + '</div>' : h; };
async function scAdminSalvar(){
  const id = ($('#sc-adm-id') || {}).value.trim(), seg = ($('#sc-adm-seg') || {}).value.trim();
  if (!id){ toast('Cole o Client ID que o Supabase mostrou.'); return; }
  if (!seg && !(SC.status && SC.status.pronto)){ toast('Cole o Client Secret que o Supabase mostrou junto com o Client ID.'); return; }
  const {error} = await window.ciclodevBanco.rpc('supa_app_gravar', {p_client_id:id, p_client_secret:seg || null, p_retorno:scRetorno()});
  if (error){ toast('Não deu para salvar: ' + tfErro(error)); return; }
  SC.status = null; await scCarregar(true); rAdmin(); tfAviso('Supabase configurado.', [], 3000);
}
document.addEventListener('click', e => { if (e.target.closest('#m-admin [data-sc-adm-salvar]')) scAdminSalvar(); });
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {SC, scLigarModal, scConferenciaHTML, scTesteHTML, scAdminHTML, scVolta, scCarregar});
