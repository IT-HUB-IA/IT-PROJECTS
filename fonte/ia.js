/* ===== Agente de IA: permissões (Admin) e chat flutuante (parte 25 do banco) =====
   Admin › Permissões de IA: o dono do sistema liga ou desliga a IA de cada usuário. Começa todo mundo desligado.
   Balão no canto de baixo, à direita: só aparece para quem tem a IA ligada. As imagens do balão são as que o William
   mandou, usadas como vieram (publico/agente-fechado.webp e publico/agente-aberto.webp), sem recorte nem ajuste.
   A conversa de cada usuário vai para ia_mensagens, e cada pessoa só lê a própria.
   Ainda não existe agente respondendo: por enquanto o chat só guarda o que o usuário escreve.
   Regra para quando o agente existir: ele só enxerga o que o dono dele enxerga no sistema, e nunca fala de outro projeto. */
const IA = {posso:false, aberto:false, msgs:null, carregando:false, enviando:false, erro:'', perm:null, permErro:'', busca:'', filtro:'todos', mudando:{}};
const iaBanco = () => (COM_BANCO && window.ciclodevBanco && typeof MU !== 'undefined' && MU.eu) ? window.ciclodevBanco : null;
const IA_IMG = {fechado:'agente-fechado.webp', aberto:'agente-aberto.webp'};

/* ---------- Admin › Permissões de IA ---------- */
async function iaPermCarregar(){
  const sb = iaBanco(); if (!sb) return;
  const {data, error} = await sb.rpc('admin_ia_permissoes');
  if (error){ IA.permErro = error.message; IA.perm = {}; }
  else { IA.permErro = ''; IA.perm = {}; (data || []).forEach(r => { IA.perm[r.pessoa_id] = r; }); }
  if (UI.modulo === 'admin' && ADM.aba === 'ia') rAdmin();
}
function iaAdminHTML(){
  if (!IA.perm){ iaPermCarregar(); return '<p class="vazio-linha">Lendo as permissões do banco…</p>'; }
  const todos = ADM.usuarios || [], ligado = u => !!(IA.perm[u.pessoa_id] && IA.perm[u.pessoa_id].ativo);
  const n = todos.filter(ligado).length, b = IA.busca.trim().toLowerCase();
  const lista = todos.filter(u => IA.filtro === 'todos' || (IA.filtro === 'com') === ligado(u))
    .filter(u => !b || [u.nome, u.nome_completo, u.email, u.usuario, u.numero, u.empresa].some(v => v != null && String(v).toLowerCase().includes(b)))
    .sort((a, c) => String(a.nome_completo || a.nome).localeCompare(String(c.nome_completo || c.nome), 'pt-BR'));
  const filtro = [['todos', 'Todos (' + todos.length + ')'], ['com', 'Com IA (' + n + ')'], ['sem', 'Sem IA (' + (todos.length - n) + ')']]
    .map(([k, t]) => '<option value="' + k + '"' + (IA.filtro === k ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
  return '<div class="ia-adm">' +
    '<p class="lead ia-adm-intro">Aqui você escolhe quem pode usar o agente de IA. Todo mundo começa sem IA; só quem estiver ligado aqui vê o balão do chat. O agente de cada pessoa só enxerga o que essa pessoa enxerga no CicloDev.</p>' +
    (IA.permErro ? '<p class="entrada-erro">Não foi possível ler as permissões: ' + esc(IA.permErro) + '</p>' : '') +
    '<div class="adm-filtros"><input class="campo" type="search" data-ia-busca placeholder="Buscar por nome, e-mail, ID, empresa…" value="' + esc(IA.busca) + '" aria-label="Buscar usuário"><select class="sel" data-ia-filtro aria-label="Mostrar">' + filtro + '</select></div>' +
    '<div class="tabela-rolo"><table class="tabela ia-tab"><thead><tr><th>Usuário</th><th>Empresa</th><th>IA</th><th>Última mudança</th></tr></thead><tbody>' +
    (lista.length ? lista.map(u => { const p = IA.perm[u.pessoa_id] || {}, on = !!p.ativo, mud = IA.mudando[u.pessoa_id];
      return '<tr><td><b>' + esc(u.nome_completo || u.nome) + '</b><small class="adm-sub">ID ' + esc(u.numero) + ' · ' + esc(u.email || '') + '</small></td>' +
        '<td>' + esc(u.empresa || '') + '</td>' +
        '<td><button type="button" class="ia-chave' + (on ? ' on' : '') + '" role="switch" aria-checked="' + on + '" data-ia-pessoa="' + esc(u.pessoa_id) + '"' + (mud ? ' disabled' : '') + ' aria-label="IA de ' + esc(u.nome_completo || u.nome) + '"><i></i><span>' + (mud ? 'Gravando…' : on ? 'Ligada' : 'Desligada') + '</span></button></td>' +
        '<td>' + (p.alterado_em ? esc(admHora(p.alterado_em)) + (p.alterado_por ? '<small class="adm-sub">por ' + esc(p.alterado_por) + '</small>' : '') : '<span class="sec">nunca</span>') + '</td></tr>'; }).join('')
      : '<tr><td colspan="4" class="vazio-linha">Nenhum usuário encontrado.</td></tr>') +
    '</tbody></table></div></div>';
}
async function iaDefinir(pessoa, ativo){
  const sb = iaBanco(); if (!sb || IA.mudando[pessoa]) return;
  IA.mudando[pessoa] = true; rAdmin();
  const {data, error} = await sb.rpc('admin_ia_definir', {p_pessoa:pessoa, p_ativo:ativo});
  delete IA.mudando[pessoa];
  if (error){ toast('Não deu para mudar a permissão: ' + error.message); }
  else { await iaPermCarregar(); if (MU.eu && pessoa === MU.eu.pessoa_id) iaConferir(); toast(data ? 'IA ligada.' : 'IA desligada.'); }
  if (UI.modulo === 'admin' && ADM.aba === 'ia') rAdmin();
}
document.addEventListener('click', e => {
  const c = e.target.closest('#m-admin [data-ia-pessoa]'); if (!c) return;
  iaDefinir(c.dataset.iaPessoa, c.getAttribute('aria-checked') !== 'true');
});
document.addEventListener('change', e => { const s = e.target.closest('#m-admin [data-ia-filtro]'); if (s){ IA.filtro = s.value; rAdmin(); } });
document.addEventListener('input', e => {
  const b = e.target.closest('#m-admin [data-ia-busca]'); if (!b) return;
  IA.busca = b.value; const pos = b.selectionStart; rAdmin();
  const n = $('#m-admin [data-ia-busca]'); if (n){ n.focus(); n.setSelectionRange(pos, pos); }
});
{ // o botão Atualizar do Admin também relê as permissões
  const _admCarregarIa = admCarregar;
  admCarregar = function(forcar){ if (forcar) IA.perm = null; return _admCarregarIa.apply(this, arguments); };
}

/* ---------- balão e chat flutuante ---------- */
function iaMontar(){
  let r = $('#ia-raiz');
  if (!IA.posso){ if (r) r.remove(); IA.aberto = false; return; }
  if (!r){
    r = document.createElement('div'); r.id = 'ia-raiz';
    r.innerHTML = '<section class="ia-chat" id="ia-chat" role="dialog" aria-label="Conversa com o agente de IA" hidden>' +
      '<header class="ia-cab"><div><b>Agente de IA</b><small>Só enxerga o que você enxerga no CicloDev</small></div><button type="button" class="ia-fechar" data-ia-fechar aria-label="Fechar a conversa">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"></path></svg></button></header>' +
      '<div class="ia-msgs" data-ia-msgs aria-live="polite"></div>' +
      '<form class="ia-escrever" data-ia-form><textarea class="campo" data-ia-texto rows="2" maxlength="8000" placeholder="Escreva sua mensagem…" aria-label="Mensagem para o agente"></textarea><button class="btn" type="submit" data-ia-enviar>Enviar</button></form>' +
      '</section>' +
      '<button type="button" class="ia-balao" data-ia-balao aria-expanded="false" aria-controls="ia-chat" aria-label="Abrir a conversa com o agente de IA"><img src="' + IA_IMG.fechado + '" alt="" width="1254" height="1254" draggable="false"></button>';
    document.body.appendChild(r);
    new Image().src = IA_IMG.aberto;   // já deixa a imagem do chat aberto pronta, para não piscar
  }
  const chat = $('#ia-chat', r), bal = $('[data-ia-balao]', r), img = $('img', bal);
  chat.hidden = !IA.aberto;
  bal.setAttribute('aria-expanded', String(IA.aberto));
  bal.setAttribute('aria-label', IA.aberto ? 'Fechar a conversa com o agente de IA' : 'Abrir a conversa com o agente de IA');
  img.src = IA.aberto ? IA_IMG.aberto : IA_IMG.fechado;
  bal.classList.toggle('aberto', IA.aberto);
  if (IA.aberto) iaDesenharMsgs();
}
const iaHora = v => { const d = new Date(v), h = new Date(); return d.toDateString() === h.toDateString() ? d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}) : d.toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}); };
function iaDesenharMsgs(){
  const box = $('#ia-raiz [data-ia-msgs]'); if (!box) return;
  let h = '';
  if (IA.carregando && !IA.msgs) h = '<p class="ia-aviso">Lendo a conversa…</p>';
  else if (IA.msgs && !IA.msgs.length) h = '<p class="ia-aviso">Olá! Esta é a sua conversa com o agente de IA. Ela fica guardada só para você.</p>';
  else if (IA.msgs) h = IA.msgs.map(m => '<div class="ia-msg ia-' + (m.autor === 'agente' ? 'agente' : 'usuario') + '"><p>' + esc(m.texto) + '</p><time datetime="' + esc(m.criado_em) + '">' + esc(iaHora(m.criado_em)) + '</time></div>').join('');
  if (IA.msgs && IA.msgs.length && IA.msgs[IA.msgs.length - 1].autor === 'usuario') h += '<p class="ia-aviso">O agente ainda não está ligado. Sua mensagem ficou guardada.</p>';
  if (IA.erro) h += '<p class="ia-aviso erro">' + esc(IA.erro) + '</p>';
  box.innerHTML = h; box.scrollTop = box.scrollHeight;
  const bt = $('#ia-raiz [data-ia-enviar]'); if (bt){ bt.disabled = IA.enviando; bt.textContent = IA.enviando ? 'Enviando…' : 'Enviar'; }
}
async function iaLerConversa(){
  const sb = iaBanco(); if (!sb || IA.carregando) return;
  IA.carregando = true; iaDesenharMsgs();
  const {data, error} = await sb.from('ia_mensagens').select('id, autor, texto, criado_em').order('criado_em', {ascending:false}).limit(200);
  IA.carregando = false;
  if (error){ IA.erro = 'Não deu para ler a conversa: ' + error.message; IA.msgs = IA.msgs || []; }
  else { IA.erro = ''; IA.msgs = (data || []).slice().sort((a, b) => String(a.criado_em).localeCompare(String(b.criado_em))).slice(-200); }
  iaDesenharMsgs();
}
async function iaEnviar(){
  const sb = iaBanco(), t = $('#ia-raiz [data-ia-texto]'); if (!sb || !t || IA.enviando) return;
  const texto = t.value.trim(); if (!texto) return;
  IA.enviando = true; IA.erro = ''; iaDesenharMsgs();
  const {data, error} = await sb.from('ia_mensagens').insert({autor:'usuario', texto}).select('id, autor, texto, criado_em');
  IA.enviando = false;
  const linha = Array.isArray(data) ? data[0] : data;
  if (error || !linha){ IA.erro = 'A mensagem não foi guardada' + (error ? ': ' + error.message : '') + '. Tente de novo.'; }
  else { (IA.msgs = IA.msgs || []).push(linha); t.value = ''; }
  iaDesenharMsgs(); t.focus();
}
function iaAlternar(abrir){
  IA.aberto = abrir === undefined ? !IA.aberto : !!abrir; iaMontar();
  if (IA.aberto){ if (!IA.msgs) iaLerConversa(); setTimeout(() => { const t = $('#ia-raiz [data-ia-texto]'); if (t) t.focus(); }, 30); }
  else { const b = $('#ia-raiz [data-ia-balao]'); if (b) b.focus(); }
}
async function iaConferir(){
  const sb = iaBanco(); if (!sb){ IA.posso = false; return iaMontar(); }
  const {data, error} = await sb.rpc('ia_posso');
  IA.posso = !error && data === true;
  if (!IA.posso){ IA.msgs = null; IA.aberto = false; }
  iaMontar();
}
document.addEventListener('click', e => {
  if (e.target.closest('#ia-raiz [data-ia-balao]')) return iaAlternar();
  if (e.target.closest('#ia-raiz [data-ia-fechar]')) return iaAlternar(false);
});
document.addEventListener('submit', e => { if (e.target.closest('#ia-raiz [data-ia-form]')){ e.preventDefault(); iaEnviar(); } });
document.addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('#ia-raiz [data-ia-texto]') && e.key === 'Enter' && !e.shiftKey && !e.isComposing){ e.preventDefault(); iaEnviar(); }
  else if (e.key === 'Escape' && IA.aberto && e.target.closest && e.target.closest('#ia-raiz')) iaAlternar(false);
});
if (COM_BANCO){
  const _entrouIa = window.ciclodevEntrouComo;
  window.ciclodevEntrouComo = function(){
    const r = _entrouIa.apply(this, arguments);
    Promise.resolve(r).then(() => iaConferir()).catch(e => console.warn('IA', e));
    return r;
  };
}
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {iaAdminHTML, iaConferir, iaAlternar});
