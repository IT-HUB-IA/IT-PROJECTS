/* ===== Agente de IA: permissões (Admin) e chat flutuante (parte 25 do banco) =====
   Admin › Permissões de IA: o dono do sistema liga ou desliga a IA de cada usuário. Começa todo mundo desligado.
   Balão no canto de baixo, à direita: só aparece para quem tem a IA ligada. As imagens do balão são as que o William
   mandou, usadas como vieram (publico/agente-fechado.webp e publico/agente-aberto.webp), sem recorte nem ajuste.
   A conversa de cada usuário vai para ia_mensagens, e cada pessoa só lê a própria. Nada se apaga: desligar a IA só
   esconde o balão, e o banco também guarda a conversa inteira em .md no agente da pessoa (ia_agentes, parte 26).
   O agente responde nos guias (função devit, parte 37): conduz o passo a passo com botões e tira dúvidas pela base de
   conhecimento (supabase/functions/_shared/devit_conhecimento.json). Fora de um guia, o chat só guarda o que o usuário escreve.
   Regra para quando o agente existir: ele só enxerga o que o dono dele enxerga no sistema, e nunca fala de outro projeto. */
const IA = {posso:false, aberto:false, novas:0, mouse:false, msgs:null, carregando:false, enviando:false, erro:'', perm:null, permErro:'', busca:'', filtro:'todos', mudando:{}};
const iaBanco = () => (COM_BANCO && window.ciclodevBanco && typeof MU !== 'undefined' && MU.eu) ? window.ciclodevBanco : null;
const IA_IMG = {fechado:'agente-fechado.webp', aberto:'agente-aberto.webp', animado:'agente-animado.webp'};   // animado: o robozinho que o William mandou, usado como veio

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
    '<p class="lead ia-adm-intro">Aqui você escolhe quem pode usar o DevIT, o agente de IA do CicloDev. Todo mundo começa sem IA; só quem estiver ligado aqui vê o balão do chat. O agente de cada pessoa só enxerga o que essa pessoa enxerga no CicloDev.</p>' +
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
const IA_NOME = 'DevIT';
const IA_CLIPE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" aria-hidden="true"><path d="M20 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"></path></svg>';
const IA_MAX_ANEXOS = 10;
const IA_BAIXAR = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"></path></svg>';
function iaMontar(){
  let r = $('#ia-raiz');
  if (!IA.posso){ if (r) r.remove(); IA.aberto = false; return; }
  if (!r){
    r = document.createElement('div'); r.id = 'ia-raiz';
    r.innerHTML = '<section class="ia-chat" id="ia-chat" role="dialog" aria-label="Conversa com o ' + IA_NOME + '" hidden>' +
      '<header class="ia-cab"><div><b class="ia-nome">' + IA_NOME + '<i class="ia-ponto" aria-hidden="true"></i></b><small>Só enxerga o que você enxerga no CicloDev</small></div><button type="button" class="ia-encerrar" data-ia-encerrar hidden title="Encerra o guia em andamento">Encerrar conversa</button><button type="button" class="ia-fechar" data-ia-fechar aria-label="Fechar a conversa">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"></path></svg></button></header>' +
      '<div class="ia-msgs" data-ia-msgs aria-live="polite"></div>' +
      '<div class="ia-pendentes" data-ia-pendentes hidden></div>' +
      '<form class="ia-escrever" data-ia-form><button type="button" class="ia-clipe" data-ia-clipe title="Anexar arquivos (também dá para arrastar ou colar)" aria-label="Anexar arquivos">' + IA_CLIPE + '</button>' +
      '<input type="file" data-ia-arquivo multiple hidden>' +
      '<textarea class="campo" data-ia-texto rows="2" maxlength="8000" placeholder="Escreva, cole ou arraste arquivos…" aria-label="Mensagem para o ' + IA_NOME + '"></textarea><button class="btn" type="submit" data-ia-enviar>Enviar</button></form>' +
      '<div class="ia-soltar" data-ia-soltar hidden><span>Solte os arquivos aqui para mandar ao ' + IA_NOME + '</span></div>' +
      '</section>' +
      '<button type="button" class="ia-balao" data-ia-balao aria-expanded="false" aria-controls="ia-chat" aria-label="Abrir a conversa com o ' + IA_NOME + '"><img src="' + IA_IMG.fechado + '" alt="" width="1254" height="1254" draggable="false"></button>';
    document.body.appendChild(r);
    new Image().src = IA_IMG.aberto;   // já deixa as outras imagens prontas, para não piscar
    new Image().src = IA_IMG.animado;
  }
  const chat = $('#ia-chat', r), bal = $('[data-ia-balao]', r), img = $('img', bal);
  // abre e fecha com transição (sem transição para quem pediu menos movimento no sistema)
  clearTimeout(IA.fecharT);
  if (IA.aberto){ if (chat.hidden){ chat.hidden = false; chat.classList.remove('ia-saindo'); chat.classList.add('ia-entrando'); setTimeout(() => chat.classList.remove('ia-entrando'), 260); } }
  else if (!chat.hidden){ chat.classList.remove('ia-entrando'); chat.classList.add('ia-saindo'); IA.fecharT = setTimeout(() => { if (!IA.aberto){ chat.hidden = true; chat.classList.remove('ia-saindo'); } }, 170); }
  bal.setAttribute('aria-expanded', String(IA.aberto));
  bal.setAttribute('aria-label', (IA.aberto ? 'Fechar' : 'Abrir') + ' a conversa com o ' + IA_NOME);
  iaImagemBalao();
  bal.classList.toggle('aberto', IA.aberto);
  if (IA.aberto){ iaDesenharMsgs(); iaDesenharPendentes(); }
}
// imagem do balão: aberto = olhos abertos; mouse em cima ou mensagem nova do DevIT = o robozinho se mexendo;
// com mensagem nova e o chat fechado, o balão também pulsa até a pessoa abrir o chat
function iaImagemBalao(){
  const bal = $('#ia-raiz [data-ia-balao]'); if (!bal) return;
  const img = $('img', bal), aviso = !IA.aberto && IA.novas > 0;
  const src = IA.aberto ? IA_IMG.aberto : (IA.mouse || aviso) ? IA_IMG.animado : IA_IMG.fechado;
  if (img.getAttribute('src') !== src) img.setAttribute('src', src);
  bal.classList.toggle('avisando', aviso);
  bal.setAttribute('aria-label', (IA.aberto ? 'Fechar' : 'Abrir') + ' a conversa com o ' + IA_NOME + (aviso ? ' (' + IA.novas + (IA.novas === 1 ? ' mensagem nova)' : ' mensagens novas)') : ''));
}
// mensagens novas do DevIT que a pessoa ainda não viu (o "visto" fica no banco, parte 28)
async function iaNovidades(){
  const sb = iaBanco(); if (!sb || !IA.posso) return;
  const {data, error} = await sb.rpc('ia_novidades'); if (error) return;
  const n = +data || 0;
  if (IA.aberto){ if (n > 0){ await iaLerConversa(true); iaMarcarVisto(); } return; }
  if (n !== IA.novas){ IA.novas = n; iaImagemBalao(); }
}
async function iaMarcarVisto(){ const sb = iaBanco(); IA.novas = 0; iaImagemBalao(); if (sb) await sb.rpc('ia_marcar_visto'); }
setInterval(() => { if (document.visibilityState === 'visible') iaNovidades(); }, 30000);
document.addEventListener('mouseover', e => { if (e.target.closest && e.target.closest('#ia-raiz [data-ia-balao]') && !IA.mouse){ IA.mouse = true; iaImagemBalao(); } });
document.addEventListener('mouseout', e => { const b = e.target.closest && e.target.closest('#ia-raiz [data-ia-balao]'); if (b && !b.contains(e.relatedTarget) && IA.mouse){ IA.mouse = false; iaImagemBalao(); } });
const iaHora = v => { const d = new Date(v), h = new Date(); return d.toDateString() === h.toDateString() ? d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}) : d.toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}); };
const iaTam = n => n >= 1048576 ? num(n / 1048576, 1) + ' MB' : Math.max(1, Math.ceil(n / 1024)) + ' KB';
const iaEhImagem = a => /^image\/(png|jpe?g|gif|webp|bmp|svg\+xml)$/i.test(a.tipo || '');

/* ---------- anexos: botão, arrastar e soltar, colar ---------- */
IA.pendentes = [];
IA.urls = {};   // caminho no depósito -> endereço assinado (1 hora), para abrir e mostrar a miniatura
function iaAnexar(lista){
  const arqs = [...(lista || [])].filter(f => f && f.size != null);
  if (!arqs.length) return;
  for (const f of arqs){
    if (IA.pendentes.length >= IA_MAX_ANEXOS){ toast('No máximo ' + IA_MAX_ANEXOS + ' arquivos por mensagem.'); break; }
    if (f.size > AQ_LIMITE){ toast('O arquivo ' + (f.name || 'sem nome') + ' passa de 50 MB.'); continue; }
    if (!f.size){ toast('O arquivo ' + (f.name || 'sem nome') + ' está vazio.'); continue; }
    const nome = f.name || ('colado-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + (f.type === 'image/png' ? '.png' : ''));
    IA.pendentes.push({id:novoUuid(), arq:f, nome, tipo:f.type || '', tamanho:f.size, previa:/^image\//.test(f.type || '') ? URL.createObjectURL(f) : ''});
  }
  iaDesenharPendentes();
  const t = $('#ia-raiz [data-ia-texto]'); if (t) t.focus();
}
function iaTirarPendente(id){
  const i = IA.pendentes.findIndex(p => p.id === id); if (i < 0) return;
  if (IA.pendentes[i].previa) URL.revokeObjectURL(IA.pendentes[i].previa);
  IA.pendentes.splice(i, 1); iaDesenharPendentes();
}
function iaDesenharPendentes(){
  const box = $('#ia-raiz [data-ia-pendentes]'); if (!box) return;
  box.hidden = !IA.pendentes.length;
  box.innerHTML = IA.pendentes.map(p => '<span class="ia-pend">' + (p.previa ? '<img src="' + esc(p.previa) + '" alt="">' : '') + '<span class="ia-pend-nome" title="' + esc(p.nome) + '">' + esc(p.nome) + '</span><small>' + iaTam(p.tamanho) + '</small>' +
    (IA.enviando ? '' : '<button type="button" data-ia-tirar="' + esc(p.id) + '" aria-label="Tirar ' + esc(p.nome) + '">×</button>') + '</span>').join('');
}
async function iaLogin(sb){ try { const {data} = await sb.auth.getSession(); return data && data.session && data.session.user && data.session.user.id; } catch(e){ return null; } }
// endereços para abrir os anexos (o depósito é fechado: cada endereço vale 1 hora)
async function iaAssinar(caminhos){
  const sb = iaBanco(), falta = [...new Set(caminhos)].filter(c => c && !(IA.urls[c] && IA.urls[c].ate > Date.now()));
  if (!sb || !sb.storage || !falta.length) return;
  const {data, error} = await sb.storage.from('anexos').createSignedUrls(falta, 3600);
  if (error || !data) return;
  data.forEach(d => { if (d && d.signedUrl) IA.urls[d.path] = {url:d.signedUrl, ate:Date.now() + 50 * 60000}; });
}
const iaAnexosDe = m => Array.isArray(m.anexos) ? m.anexos : [];
function iaAnexosHTML(m){
  const l = iaAnexosDe(m); if (!l.length) return '';
  return '<div class="ia-anexos">' + l.map(a => { const u = IA.urls[a.caminho];
    return '<button type="button" class="ia-anexo' + (iaEhImagem(a) && u ? ' com-foto' : '') + '" data-ia-abrir="' + esc(a.caminho) + '" title="' + (iaEhImagem(a) ? 'Ver ' : 'Baixar ') + esc(a.nome) + '">' +
      (iaEhImagem(a) && u ? '<img src="' + esc(u.url) + '" alt="' + esc(a.nome) + '" loading="lazy">' : '') +
      '<span class="ia-anexo-nome">' + esc(a.nome) + '</span><small>' + (iaEhImagem(a) ? '' : IA_BAIXAR) + iaTam(+a.tamanho || 0) + '</small></button>'; }).join('') + '</div>';
}
const iaAnexoPor = caminho => { for (const m of IA.msgs || []) for (const a of iaAnexosDe(m)) if (a.caminho === caminho) return a; return null; };
// imagem: abre aqui mesmo, grande, com o botão de baixar; outro arquivo: baixa direto no computador
async function iaAbrir(caminho){
  const a = iaAnexoPor(caminho); if (!a) return;
  if (!iaEhImagem(a)) return iaBaixar(a);
  await iaAssinar([caminho]);
  const u = IA.urls[caminho];
  if (!u){ toast('Não deu para abrir a imagem agora. Tente de novo.'); return; }
  const dlg = modal(esc(a.nome), '<figure class="ia-ver"><img src="' + esc(u.url) + '" alt="' + esc(a.nome) + '"><figcaption>' + esc(iaTam(+a.tamanho || 0)) + '</figcaption></figure>',
    [{txt:'Fechar', cls:'sec'}, {txt:'Baixar', acao:() => { iaBaixar(a); return false; }}]);
  dlg.classList.add('ia-ver-modal');
}
// baixa com o nome original: o depósito manda o arquivo como "baixar" (endereço de 1 minuto, só para isso)
async function iaBaixar(a){
  const sb = iaBanco(); if (!sb || !sb.storage) return;
  const {data, error} = await sb.storage.from('anexos').createSignedUrl(a.caminho, 60, {download:a.nome});
  const url = data && data.signedUrl;
  if (error || !url){ toast('Não deu para baixar ' + a.nome + ' agora. Tente de novo.'); return; }
  const l = document.createElement('a'); l.href = url; l.download = a.nome; l.rel = 'noopener'; l.style.display = 'none';
  document.body.appendChild(l); l.click(); setTimeout(() => l.remove(), 500);
  toast('Baixando ' + a.nome + '…');
}

function iaDesenharMsgs(){
  const box = $('#ia-raiz [data-ia-msgs]'); if (!box) return;
  // só as mensagens que ainda não tinham aparecido entram com transição (a conversa lida do banco aparece de uma vez)
  const primeira = !IA.jaVistas; IA.jaVistas = IA.jaVistas || new Set();
  const novas = new Set(primeira ? [] : (IA.msgs || []).filter(m => !IA.jaVistas.has(m.id)).map(m => m.id));
  (IA.msgs || []).forEach(m => IA.jaVistas.add(m.id));
  const enc = $('#ia-raiz [data-ia-encerrar]'); if (enc) enc.hidden = !iaGuiaAtiva() || IA.pensando;
  let h = '';
  if (IA.carregando && !IA.msgs) h = '<p class="ia-aviso">Lendo a conversa…</p>';
  else if (IA.msgs && !IA.msgs.length) h = '<p class="ia-aviso">Olá! Esta é a sua conversa com o ' + IA_NOME + '. Ela fica guardada só para você.</p>';
  else if (IA.msgs) h = (IA.maisAntigas ? '<button type="button" class="ia-antigas" data-ia-antigas' + (IA.carregando ? ' disabled' : '') + '>' + (IA.carregando ? 'Lendo…' : 'Ver mensagens anteriores') + '</button>' : '') +
    IA.msgs.map(m => '<div class="ia-msg ia-' + (m.autor === 'agente' ? 'agente' : 'usuario') + (novas.has(m.id) ? ' ia-nova' : '') + '">' + iaAvatar(m.autor) + '<div class="ia-corpo">' + (String(m.texto || '').trim() ? (m.autor === 'agente' ? '<div class="ia-texto">' + iaFormatar(m.texto) + '</div>' : '<p>' + esc(m.texto) + '</p>') : '') + iaAnexosHTML(m) + '<time datetime="' + esc(m.criado_em) + '">' + esc(iaHora(m.criado_em)) + '</time></div></div>').join('');
  const ultima = IA.msgs && IA.msgs[IA.msgs.length - 1];
  if (IA.pensando) h += '<div class="ia-pensando" role="status"><span class="ia-av ia-av-agente" aria-hidden="true"><img src="' + IA_IMG.fechado + '" alt="" width="28" height="28" draggable="false"></span><span class="ia-dig"><i></i><i></i><i></i></span><span class="ia-aviso">O ' + IA_NOME + ' está escrevendo</span></div>';
  else if (ultima && ultima.autor === 'agente' && ultima.contexto && (ultima.contexto.botoes || []).length)
    h += '<div class="ia-botoes' + (novas.has(ultima.id) ? ' ia-nova' : '') + '" role="group" aria-label="Respostas rápidas">' + ultima.contexto.botoes.map((b, i) => '<button type="button" class="btn ' + (i ? 'sec ' : '') + 'peq" data-ia-botao="' + i + '">' + esc(b.rotulo) + '</button>').join('') + '</div>';
  else if (ultima && ultima.autor === 'usuario' && !iaGuiaAtiva()) h += '<p class="ia-aviso">O ' + IA_NOME + ' ainda não está ligado. Sua mensagem ficou guardada.</p>';
  if (IA.erro) h += '<p class="ia-aviso erro">' + esc(IA.erro) + '</p>';
  const antes = box.scrollHeight - box.scrollTop;
  box.innerHTML = h; box.scrollTop = IA.manterRolagem ? box.scrollHeight - antes : box.scrollHeight; IA.manterRolagem = false;
  const bt = $('#ia-raiz [data-ia-enviar]'); if (bt){ bt.disabled = IA.enviando; bt.textContent = IA.enviando ? 'Enviando…' : 'Enviar'; }
  // miniaturas das imagens que ainda não têm endereço: busca e desenha de novo
  const semUrl = (IA.msgs || []).flatMap(iaAnexosDe).filter(a => iaEhImagem(a) && !IA.urls[a.caminho]).map(a => a.caminho);
  if (semUrl.length && !IA.assinando){ IA.assinando = true; iaAssinar(semUrl).finally(() => { IA.assinando = false; if (semUrl.some(c => IA.urls[c])) iaDesenharMsgs(); }); }
}
const IA_CAMPOS = 'id, autor, texto, anexos, contexto, criado_em';
// a fotinha ao lado de cada balão: o robozinho do DevIT, ou a inicial do nome de quem está logado
function iaAvatar(autor){
  if (autor === 'agente') return '<span class="ia-av ia-av-agente" aria-hidden="true"><img src="' + IA_IMG.fechado + '" alt="" width="28" height="28" draggable="false"></span>';
  const nome = (typeof MU !== 'undefined' && MU.eu && MU.eu.nome) || '';
  return '<span class="ia-av ia-av-usuario" title="' + esc(nome || 'Você') + '" aria-hidden="true">' + esc((nome.trim()[0] || '?').toUpperCase()) + '</span>';
}
/* ---------- guias conduzidos pelo DevIT (função devit, parte 37): passo a passo com botões e dúvidas ---------- */
// texto do DevIT: **negrito**, `código`, blocos ``` com botão de copiar; tudo escapado antes
function iaFormatar(t){
  const linha = x => esc(x).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`\n]+)`/g, '<code>$1</code>');
  return String(t || '').split(/```\n?/).map((parte, i) => i % 2
    ? '<div class="ia-cod"><pre>' + esc(parte.replace(/\n$/, '')) + '</pre><button type="button" class="btn sec peq" data-ia-copiar="' + esc(parte.replace(/\n$/, '')) + '">Copiar</button></div>'
    : parte.split(/\n{2,}/).map(x => x.trim()).filter(Boolean).map(x => '<p>' + x.split('\n').map(linha).join('<br>') + '</p>').join('')).join('');
}
// o guia está em andamento quando a última fala do DevIT tem guia e não encerrou
function iaGuiaAtiva(){
  const a = (IA.msgs || []).filter(m => m.autor === 'agente').pop();
  return a && a.contexto && a.contexto.guia && !a.contexto.fim ? a.contexto : null;
}
const IA_SENHA = /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@\/]+:[^\s]+@[^\s]+/i;   // endereço de conexão com senha: nunca vai para o chat
async function iaChamar(corpo){
  const sb = iaBanco(); if (!sb || !sb.functions) return false;
  IA.pensando = true; IA.erro = ''; iaDesenharMsgs();
  let data = null, error = null;
  try { ({data, error} = await sb.functions.invoke('devit', {body:corpo})); } catch (e){ error = e; }
  IA.pensando = false;
  if (error || !data || !data.ok){ IA.erro = 'O ' + IA_NOME + ' não conseguiu responder agora' + (data && data.erro ? ': ' + data.erro : '') + '. Tente de novo.'; iaDesenharMsgs(); return false; }
  (IA.msgs = IA.msgs || []).push(...(data.mensagens || [])); IA.msgs = iaOrdenar(IA.msgs);
  if ((data.mensagens || []).length && IA.aberto) iaMarcarVisto();
  iaDesenharMsgs(); return true;
}
// abre o chat e começa um guia; devolve false quando o DevIT não está ligado para a pessoa (a tela mostra a janela de guia)
async function iaGuiar(guia){
  if (!IA.posso || !iaBanco()) return false;
  if (!IA.aberto) iaAlternar(true);
  if (!IA.msgs){ for (let i = 0; i < 40 && (IA.carregando || !IA.msgs); i++) await new Promise(r => setTimeout(r, 50)); }
  return iaChamar({acao:'guia', guia:guia || 'banco'});
}
// a pessoa clicou numa resposta rápida: a fala dela vai para a conversa e o DevIT responde
async function iaBotao(i){
  const a = (IA.msgs || [])[IA.msgs.length - 1], b = a && a.contexto && (a.contexto.botoes || [])[i]; if (!b || IA.enviando || IA.pensando) return;
  if (b.valor.startsWith('local:abrir:')){
    if (typeof ifrBancoModal === 'function' && typeof IFR !== 'undefined' && IFR.no && UI.view === 'infra') return ifrBancoModal(null, b.valor.slice(12));
    return toast('Abra a aba Infraestrutura da aplicação e clique em Ligar banco, em Bancos de dados.');
  }
  return iaFalarValor(b.rotulo, b.valor, a.contexto.guia);
}
// a fala da pessoa vai para a conversa com o valor do botão, e o DevIT responde
async function iaFalarValor(rotulo, valor, guia){
  const sb = iaBanco(); if (!sb || IA.enviando || IA.pensando) return;
  IA.enviando = true; iaDesenharMsgs();
  const {data, error} = await sb.from('ia_mensagens').insert({autor:'usuario', texto:rotulo, anexos:[], contexto:{guia, valor}}).select(IA_CAMPOS);
  IA.enviando = false;
  const linha = Array.isArray(data) ? data[0] : data;
  if (error || !linha){ IA.erro = 'A resposta não foi guardada' + (error ? ': ' + error.message : '') + '. Tente de novo.'; iaDesenharMsgs(); return; }
  IA.msgs.push(linha); iaChamar({acao:'responder'});
}
async function iaLerConversa(){
  const sb = iaBanco(); if (!sb || IA.carregando) return;
  IA.carregando = true; iaDesenharMsgs();
  const {data, error} = await sb.from('ia_mensagens').select(IA_CAMPOS).order('criado_em', {ascending:false}).limit(200);
  IA.carregando = false;
  if (error){ IA.erro = 'Não deu para ler a conversa: ' + error.message; IA.msgs = IA.msgs || []; }
  else { IA.erro = ''; IA.msgs = iaOrdenar(data || []); IA.maisAntigas = (data || []).length >= 200; }
  iaDesenharMsgs();
}
// a conversa inteira fica no banco; a tela mostra as últimas 200 e busca as anteriores quando a pessoa pede
const iaOrdenar = l => { const vistos = new Set(); return l.filter(m => !vistos.has(m.id) && vistos.add(m.id)).sort((a, b) => String(a.criado_em).localeCompare(String(b.criado_em)) || String(a.id).localeCompare(String(b.id))); };
async function iaAnteriores(){
  const sb = iaBanco(); if (!sb || IA.carregando || !IA.msgs || !IA.msgs.length) return;
  IA.carregando = true; iaDesenharMsgs();
  const {data, error} = await sb.from('ia_mensagens').select(IA_CAMPOS).lt('criado_em', IA.msgs[0].criado_em).order('criado_em', {ascending:false}).limit(200);
  IA.carregando = false;
  if (error){ IA.erro = 'Não deu para ler as mensagens anteriores: ' + error.message; }
  else { const antes = IA.msgs.length; IA.msgs = iaOrdenar((data || []).concat(IA.msgs)); IA.maisAntigas = (data || []).length >= 200 && IA.msgs.length > antes; IA.manterRolagem = true; }
  iaDesenharMsgs();
}
async function iaEnviar(){
  const sb = iaBanco(), t = $('#ia-raiz [data-ia-texto]'); if (!sb || !t || IA.enviando) return;
  const texto = t.value.trim(); if (!texto && !IA.pendentes.length) return;
  if (IA_SENHA.test(texto)){ IA.erro = 'Não mande senha nem endereço de conexão com senha aqui no chat. Cole direto na janela de ligar banco. Se precisar mostrar o endereço, troque a senha por ***.'; iaDesenharMsgs(); return; }
  const guia = iaGuiaAtiva();
  IA.enviando = true; IA.erro = ''; iaDesenharMsgs(); iaDesenharPendentes();
  // 1) os arquivos vão para o depósito, na pasta <login>/ia/ da pessoa
  const anexos = [];
  if (IA.pendentes.length){
    const login = await iaLogin(sb);
    if (!login || !sb.storage){ IA.enviando = false; IA.erro = 'Sem login, não deu para mandar os arquivos.'; iaDesenharMsgs(); iaDesenharPendentes(); return; }
    for (const p of IA.pendentes){
      if (p.caminho){ anexos.push({nome:p.nome, tipo:p.tipo, tamanho:p.tamanho, caminho:p.caminho}); continue; }   // já subiu numa tentativa anterior
      const caminho = login + '/ia/' + p.id + '-' + aqNomeSeguro(p.nome);
      const {error} = await sb.storage.from('anexos').upload(caminho, p.arq, {contentType:p.tipo || 'application/octet-stream', upsert:false});
      if (error){ IA.enviando = false; IA.erro = 'Não deu para mandar o arquivo ' + p.nome + ': ' + (error.message || error) + '. Tente de novo.'; iaDesenharMsgs(); iaDesenharPendentes(); return; }
      p.caminho = caminho; anexos.push({nome:p.nome, tipo:p.tipo, tamanho:p.tamanho, caminho});
    }
  }
  // 2) a mensagem vai para o banco, com a lista dos arquivos
  const {data, error} = await sb.from('ia_mensagens').insert({autor:'usuario', texto, anexos, contexto:guia ? {guia:guia.guia} : {}}).select(IA_CAMPOS);
  IA.enviando = false;
  const linha = Array.isArray(data) ? data[0] : data;
  if (error || !linha){ IA.erro = 'A mensagem não foi guardada' + (error ? ': ' + error.message : '') + '. Tente de novo.'; }
  else {
    (IA.msgs = IA.msgs || []).push(linha); t.value = '';
    IA.pendentes.forEach(p => { if (p.previa && p.caminho) IA.urls[p.caminho] = {url:p.previa, ate:Date.now() + 50 * 60000}; });
    IA.pendentes = [];
  }
  iaDesenharMsgs(); iaDesenharPendentes(); t.focus();
  if (linha && !error && guia) iaChamar({acao:'responder'});
}
function iaAlternar(abrir){
  IA.aberto = abrir === undefined ? !IA.aberto : !!abrir; iaMontar();
  if (IA.aberto){ if (!IA.msgs || IA.novas > 0) iaLerConversa(); if (IA.novas > 0 || !IA.vistoMarcado){ IA.vistoMarcado = true; iaMarcarVisto(); } setTimeout(() => { const t = $('#ia-raiz [data-ia-texto]'); if (t) t.focus(); }, 30); }
  else { const b = $('#ia-raiz [data-ia-balao]'); if (b) b.focus(); }
}
async function iaConferir(){
  const sb = iaBanco(); if (!sb){ IA.posso = false; return iaMontar(); }
  const {data, error} = await sb.rpc('ia_posso');
  IA.posso = !error && data === true;
  if (!IA.posso){ IA.msgs = null; IA.aberto = false; IA.novas = 0; }
  iaMontar();
  if (IA.posso) iaNovidades();
}
document.addEventListener('click', e => {
  if (e.target.closest('#ia-raiz [data-ia-balao]')) return iaAlternar();
  if (e.target.closest('#ia-raiz [data-ia-fechar]')) return iaAlternar(false);
  if (e.target.closest('#ia-raiz [data-ia-antigas]')) return iaAnteriores();
  if (e.target.closest('#ia-raiz [data-ia-clipe]')) return $('#ia-raiz [data-ia-arquivo]').click();
  const tira = e.target.closest('#ia-raiz [data-ia-tirar]'); if (tira) return iaTirarPendente(tira.dataset.iaTirar);
  const ab = e.target.closest('#ia-raiz [data-ia-abrir]'); if (ab) return iaAbrir(ab.dataset.iaAbrir);
  const bo = e.target.closest('#ia-raiz [data-ia-botao]'); if (bo) return iaBotao(+bo.dataset.iaBotao);
  const cp = e.target.closest('#ia-raiz [data-ia-copiar]'); if (cp) return enCopiar(cp.dataset.iaCopiar, cp);
  if (e.target.closest('#ia-raiz [data-ia-encerrar]')){ const g = iaGuiaAtiva(); if (g) return iaFalarValor('Encerrar conversa', 'parar', g.guia); }
});
document.addEventListener('submit', e => { if (e.target.closest('#ia-raiz [data-ia-form]')){ e.preventDefault(); iaEnviar(); } });
document.addEventListener('change', e => { const f = e.target.closest('#ia-raiz [data-ia-arquivo]'); if (f){ iaAnexar(f.files); f.value = ''; } });
document.addEventListener('paste', e => {
  if (!(e.target.closest && e.target.closest('#ia-chat'))) return;
  const fs = e.clipboardData && e.clipboardData.files;
  if (fs && fs.length){ e.preventDefault(); iaAnexar(fs); }
});
// arrastar e soltar em qualquer parte do chat aberto
{
  let prof = 0;
  const temArquivo = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
  const aviso = v => { const s = $('#ia-raiz [data-ia-soltar]'); if (s) s.hidden = !v; };
  document.addEventListener('dragenter', e => { if (!temArquivo(e) || !(e.target.closest && e.target.closest('#ia-chat'))) return; e.preventDefault(); prof++; aviso(true); });
  document.addEventListener('dragover', e => { if (temArquivo(e) && e.target.closest && e.target.closest('#ia-chat')){ e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  document.addEventListener('dragleave', e => { if (!(e.target.closest && e.target.closest('#ia-chat'))) return; prof = Math.max(0, prof - 1); if (!prof) aviso(false); });
  document.addEventListener('drop', e => { if (!(e.target.closest && e.target.closest('#ia-chat'))) return; e.preventDefault(); prof = 0; aviso(false); if (e.dataTransfer && e.dataTransfer.files) iaAnexar(e.dataTransfer.files); });
}
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
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {iaAdminHTML, iaConferir, iaAlternar, iaAnexar, iaAbrir, iaNovidades, iaGuiar, iaFormatar, IA});
