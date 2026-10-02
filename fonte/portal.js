/* ===== Portal do stakeholder (parte 23 do banco, função portal-api) =====
   No CicloDev:
   - no cliente da Estrutura, a aba "Portal do stakeholder" (no Mais), só para o dono: criar o portal, convidar quem responde,
     gerar a chave do sistema de fora, ligar o webhook, e ver as perguntas e os avisos;
   - no ⋯ de cada item e épico de um cliente com portal: "Perguntar ao stakeholder" (o item vai para "Aguardando stakeholder");
   - dentro do item: as perguntas com as respostas;
   - no painel do cliente e das partes dele: um aviso com as perguntas esperando e as últimas respostas.
   Tudo é lido e gravado direto no banco (nada fica só na tela). O sistema de fora lê e responde pela portal-api. */
const PT = {clientes:new Set(), portal:null, carregando:false, ultimaResposta:null, perguntasItem:{}, resumo:{}};
const ptSb = () => (COM_BANCO && window.ciclodevBanco && BANCO.carregado) ? window.ciclodevBanco : null;
const ptErro = e => (typeof tfErro === 'function' ? tfErro(e) : ((e && e.message) || String(e)));
const ptQuando = t => t ? new Date(t).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'}) : '';
const ptClienteDe = chave => { const c = cadeia(chave); return c && c.client ? c.client.id : null; };
const ptItemNoPortal = i => { const c = i && cadeia('ws:' + i.ws); return !!(c && c.client && PT.clientes.has(c.client.id)); };
const ptCopiar = t => { if (typeof enCopiar === 'function') enCopiar(t); else if (navigator.clipboard) navigator.clipboard.writeText(t).catch(() => {}); };
const PT_URL_API = 'https://tfcvoszeewmpghgxztuy.supabase.co/functions/v1/portal-api';

async function ptCarregarClientes(){
  const sb = ptSb(); if (!sb) return;
  const {data, error} = await sb.rpc('portais_clientes');
  if (!error) PT.clientes = new Set((data || []).map(x => typeof x === 'string' ? x : x.portais_clientes || Object.values(x)[0]));
  ptResumo();
}
// as perguntas esperando e as últimas respostas (para o aviso no painel e para saber quando chegou resposta nova)
async function ptResumo(){
  const sb = ptSb(); if (!sb || !PT.clientes.size) return;
  const {data} = await sb.from('perguntas_stakeholder').select('id, item_id, pergunta, status, resposta, respondida_por_nome, respondida_em, criada_em').neq('status', 'cancelada').order('criada_em', {ascending:false}).limit(200);
  const L = data || [];
  const ultima = L.filter(q => q.respondida_em).map(q => q.respondida_em).sort().pop() || null;
  const novas = PT.ultimaResposta && ultima && ultima > PT.ultimaResposta ? L.filter(q => q.respondida_em && q.respondida_em > PT.ultimaResposta) : [];
  PT.lista = L; if (!PT.ultimaResposta || ultima > PT.ultimaResposta) PT.ultimaResposta = ultima || PT.ultimaResposta || new Date(0).toISOString();
  if (novas.length){
    const q = novas[0], i = byId('issues', q.item_id);
    tfAviso((q.respondida_por_nome || 'O stakeholder') + ' respondeu' + (i ? ' em ' + i.titulo : '') + '.', i ? [{txt:'Abrir', acao:() => abrirItem(i.id)}] : [], 12000);
    // o item voltou de status no banco: relê em silêncio, se ninguém estiver no meio de algo
    if (!document.querySelector('dialog[open]') && !(window.ciclodevSync && (window.ciclodevSync.rodando || window.ciclodevSync.pendente))) {
      const aberto = itemAberto; await window.ciclodevCarregarBanco(null); render(); if (aberto && byId('issues', aberto)) abrirItem(aberto);
    }
  }
  if (UI.modulo === 'operacoes' && UI.view === 'dashboard') ptAvisoPainel();
}

/* ---------- perguntar a partir do item ou épico ---------- */
function ptPerguntar(i){
  if (!ptSb()) { toast('Precisa estar com login para mandar pergunta ao stakeholder.'); return; }
  modal('Perguntar ao stakeholder', '<p class="sec tf-nota" style="margin-top:0">Vai para quem foi convidado no portal do cliente. Enquanto não responderem, o ' + (i.tipo === 'epic' ? 'épico' : 'item') + ' fica em <b>Aguardando stakeholder</b>; a resposta volta ele para o status de agora e vira comentário aqui.</p>' +
    '<div class="grade-form"><label class="lb largo">' + esc((chaveDe(i) ? chaveDe(i) + ' · ' : '') + i.titulo) + '<textarea class="campo" id="pt-q" rows="5" maxlength="4000" placeholder="Escreva a pergunta de um jeito que dê para responder sem precisar de mais explicação."></textarea></label></div>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Mandar pergunta', acao:dl => {
      const t = $('#pt-q', dl).value.trim(); if (!t){ toast('Escreva a pergunta'); return false; }
      (async () => {
        if (window.ciclodevSync && (window.ciclodevSync.rodando || window.ciclodevSync.pendente)) await window.ciclodevGravarAgora();
        const {error} = await ptSb().rpc('pergunta_criar', {p_item:i.id, p_texto:t});
        if (error){ toast('Não deu para mandar: ' + ptErro(error)); return; }
        await window.ciclodevCarregarBanco(null); render(); abrirItem(i.id); toast('Pergunta mandada ao stakeholder');
        PT.perguntasItem[i.id] = null; ptResumo();
      })();
    }}]);
  setTimeout(() => { const t = $('#pt-q'); if (t) t.focus(); }, 30);
}
async function ptCancelar(id, itemId){
  const {error} = await ptSb().rpc('pergunta_cancelar', {p_pergunta:id});
  if (error){ toast('Não deu para cancelar: ' + ptErro(error)); return; }
  await window.ciclodevCarregarBanco(null); render(); if (byId('issues', itemId)) abrirItem(itemId); toast('Pergunta cancelada'); ptResumo();
}

/* ---------- dentro do item: as perguntas e as respostas ---------- */
async function ptSecaoItem(i){
  if (!$('#gaveta-wrap .gaveta') || !ptItemNoPortal(i)) return;
  const sb = ptSb(); if (!sb) return;
  const {data} = await sb.from('perguntas_stakeholder').select('id, pergunta, status, resposta, respondida_por_nome, respondida_em, criada_em').eq('item_id', i.id).neq('status', 'cancelada').order('criada_em', {ascending:false});
  if (itemAberto !== i.id) return;
  // a janela pode ter sido redesenhada enquanto lia: usa a de agora
  const pri = $('#gaveta-wrap .gaveta .g-principal'); if (!pri) return;
  const velho = $('.pt-sec', pri); if (velho) velho.remove();
  const L = data || [], pode = podeEditar();
  const html = '<section class="g-sec pt-sec"><h4>Perguntas ao stakeholder' + (pode ? '<span class="tf-h4-acoes"><button type="button" class="btn fant peq" data-pt-perguntar="' + i.id + '">' + ICO.mais + 'Nova pergunta</button></span>' : '') + '</h4>' +
    (L.length ? '<ul class="pt-lista">' + L.map(q => '<li class="pt-q pt-' + q.status + '"><div class="pt-q-cab"><span class="pt-st">' + (q.status === 'aguardando' ? 'Esperando resposta' : 'Respondida') + '</span><small>' + esc(ptQuando(q.criada_em)) + '</small>' +
      (q.status === 'aguardando' && pode ? '<button type="button" class="btn fant peq" data-pt-cancelar="' + q.id + '">Cancelar</button>' : '') + '</div><p class="pt-pergunta">' + esc(q.pergunta) + '</p>' +
      (q.status === 'respondida' ? '<blockquote class="pt-resposta"><b>' + esc(q.respondida_por_nome || 'Stakeholder') + '</b> · ' + esc(ptQuando(q.respondida_em)) + '<br>' + esc(q.resposta || '').replace(/\n/g, '<br>') + '</blockquote>' : '') + '</li>').join('') + '</ul>'
      : '<p class="pt-vazio">Nenhuma pergunta ainda. Use o ⋯ ou o botão acima para mandar uma ao stakeholder.</p>') + '</section>';
  const antes = $(':scope > .dc-sec', pri) || $(':scope > .tf-desc', pri);
  if (antes) antes.insertAdjacentHTML('afterend', html); else pri.insertAdjacentHTML('beforeend', html);
}
const _abrirItemPt = abrirItem;
abrirItem = function(id){ const r = _abrirItemPt.apply(this, arguments); const i = byId('issues', id); if (i && ptItemNoPortal(i)) ptSecaoItem(i); return r; };

/* ---------- no painel: aviso das perguntas esperando e das últimas respostas ---------- */
function ptAvisoPainel(){
  const c = $('#ops-corpo'); if (!c || UI.view !== 'dashboard') return;
  const velho = $('.pt-painel', c); if (velho) velho.remove();
  const cl = ptClienteDe(UI.sel); if (!cl || !PT.clientes.has(cl) || !PT.lista) return;
  const aqui = new Set(issuesEm(UI.sel).map(i => i.id));
  const L = PT.lista.filter(q => aqui.has(q.item_id));
  const esp = L.filter(q => q.status === 'aguardando'), resp = L.filter(q => q.status === 'respondida').sort((a, b) => String(b.respondida_em).localeCompare(String(a.respondida_em))).slice(0, 4);
  if (!esp.length && !resp.length) return;
  const nome = q => { const i = byId('issues', q.item_id); return i ? (chaveDe(i) ? chaveDe(i) + ' · ' : '') + i.titulo : 'Item'; };
  c.insertAdjacentHTML('afterbegin', '<section class="pt-painel" aria-label="Perguntas ao stakeholder"><div class="pt-painel-cab"><b>Perguntas ao stakeholder</b><span>' + (esp.length ? esp.length + ' esperando resposta' : 'nenhuma esperando resposta') + '</span></div>' +
    '<ul>' + esp.slice(0, 4).map(q => '<li><button type="button" class="pt-lnk" data-abrir-item="' + q.item_id + '">' + esc(nome(q)) + '</button><span class="pt-st">esperando</span><small>' + esc(q.pergunta.slice(0, 120)) + '</small></li>').join('') +
    resp.map(q => '<li class="pt-ok"><button type="button" class="pt-lnk" data-abrir-item="' + q.item_id + '">' + esc(nome(q)) + '</button><span class="pt-st">' + esc(q.respondida_por_nome || '') + ' respondeu</span><small>' + esc((q.resposta || '').slice(0, 120)) + '</small></li>').join('') + '</ul></section>');
}
const _rViewPt = rView;
rView = function(){
  const c = $('#ops-corpo');
  if (c && UI.view === 'portal'){ ptTela(c); if (typeof smAgruparAbas === 'function') smAgruparAbas(); return; }
  const r = _rViewPt.apply(this, arguments);
  if (UI.view === 'dashboard') ptAvisoPainel();
  return r;
};

/* ---------- a aba Portal do stakeholder, no cliente ---------- */
VIEWS.push(['portal', 'Portal do stakeholder', 'quem de fora lê e responde']);
SM_ABAS.portal = ['Portal do stakeholder', 'O portal deste cliente para um sistema de fora: quem pode responder, a chave, o webhook, as perguntas e os avisos.'];
SM_DICA.portal = 'quem de fora lê e responde';
EXPL_VIEW.portal = SM_ABAS.portal[1];
const _rOperacoesPt = rOperacoes;
rOperacoes = function(){
  _rOperacoesPt.apply(this, arguments);
  const tipo = (UI.sel || '').split(':')[0];
  if (tipo !== 'client' || !podeEditar() || !COM_BANCO){ const b = $('.view-b[data-view="portal"]'); if (b) (b.closest('.view-casa') || b).remove(); if (UI.view === 'portal'){ UI.view = 'dashboard'; rView(); } }
};
async function ptTela(c){
  const sb = ptSb(); const cl = (UI.sel || '').split(':')[1];
  if (!sb){ c.innerHTML = '<p class="sec" style="padding:24px">O portal do stakeholder funciona com login, direto no banco.</p>'; return; }
  c.innerHTML = '<p class="sec" style="padding:24px">Lendo o portal...</p>';
  const {data:ps, error} = await sb.from('portais').select('id, nome, ativo, webhook_url, criado_em, dono_id').eq('no_id', cl);
  if (UI.view !== 'portal') return;
  if (error){ c.innerHTML = '<p class="aviso-faixa">Não deu para ler o portal: ' + esc(ptErro(error)) + '</p>'; return; }
  const p = (ps || [])[0];
  if (!p){
    c.innerHTML = '<div class="pt-tela"><h2 class="sub">Portal do stakeholder</h2><p class="lead">Um portal deixa um sistema de fora (por exemplo, o sistema próprio do cliente) ler o andamento de <b>' + esc(nomeDe(UI.sel)) + '</b> e responder as perguntas que a equipe mandar. Só você vê e mexe no portal; quem responde é quem você convidar.</p>' +
      '<button type="button" class="btn" data-pt-criar="' + cl + '">' + ICO.mais + 'Criar o portal de ' + esc(nomeDe(UI.sel)) + '</button></div>';
    return;
  }
  const [m, k, q, e] = await Promise.all([
    sb.from('portais_membros').select('email, nome, ativo, convidado_em').eq('portal_id', p.id).order('nome'),
    sb.from('portais_chaves').select('id, nome, prefixo, criada_em, usada_em, revogada_em').eq('portal_id', p.id).order('criada_em', {ascending:false}),
    sb.from('perguntas_stakeholder').select('id, item_id, pergunta, status, resposta, respondida_por_nome, respondida_em, criada_em').eq('portal_id', p.id).order('criada_em', {ascending:false}).limit(50),
    sb.from('portais_eventos').select('id, tipo, criado_em, entregue_em, tentativas, ultimo_erro').eq('portal_id', p.id).order('id', {ascending:false}).limit(20)]);
  if (UI.view !== 'portal') return;
  PT.portal = p;
  const nomeItem = id => { const i = byId('issues', id); return i ? (chaveDe(i) ? chaveDe(i) + ' · ' : '') + i.titulo : 'Item'; };
  const TIPO_EV = {pergunta_criada:'Pergunta nova', pergunta_respondida:'Pergunta respondida', pergunta_cancelada:'Pergunta cancelada'};
  c.innerHTML = '<div class="pt-tela">' +
    '<div class="pt-topo"><div><h2 class="sub" style="margin:0">Portal do stakeholder</h2><p class="sec" style="margin:4px 0 0">Criado em ' + esc(ptQuando(p.criado_em)) + '. O sistema de fora chama <code>' + esc(PT_URL_API) + '</code>.</p></div>' +
      '<label class="rc-liga"><input type="checkbox" data-pt-ativo="' + p.id + '"' + (p.ativo ? ' checked' : '') + '> ' + (p.ativo ? 'Ligado' : 'Desligado') + '</label></div>' +
    '<section class="pt-caixa"><h3>Quem pode responder</h3><p class="sec">O sistema de fora diz o e-mail de quem está respondendo; só os e-mails desta lista passam.</p>' +
      '<div class="tabela-rolo"><table class="tabela"><thead><tr><th>Nome</th><th>E-mail</th><th>Convidado em</th><th>Situação</th><th></th></tr></thead><tbody>' +
      ((m.data || []).map(x => '<tr><th scope="row">' + esc(x.nome) + '</th><td>' + esc(x.email) + '</td><td>' + esc(ptQuando(x.convidado_em)) + '</td><td><label class="rc-liga"><input type="checkbox" data-pt-membro-ativo="' + esc(x.email) + '"' + (x.ativo ? ' checked' : '') + '> ' + (x.ativo ? 'Pode responder' : 'Pausado') + '</label></td><td><button type="button" class="btn fant peq" data-pt-membro-tirar="' + esc(x.email) + '">Tirar</button></td></tr>').join('') || '<tr><td colspan="5" class="sec">Ninguém convidado ainda.</td></tr>') +
      '</tbody></table></div><form class="pt-convidar" data-pt-convidar><input class="campo" name="nome" placeholder="Nome (ex.: Lucas)" required maxlength="120"><input class="campo" name="email" type="email" placeholder="E-mail (ex.: lucas@blancolisboa.com)" required><button class="btn sec" type="submit">' + ICO.mais + 'Convidar</button></form></section>' +
    '<section class="pt-caixa"><h3>Chave do sistema de fora</h3><p class="sec">O sistema de fora manda a chave em cada chamada (<code>Authorization: Bearer ...</code>). Ela só aparece uma vez, na hora de gerar: guarde no cofre de segredos de lá.</p>' +
      '<ul class="pt-chaves">' + ((k.data || []).map(x => '<li><b>' + esc(x.nome) + '</b> <code>' + esc(x.prefixo) + '…</code><small>criada ' + esc(ptQuando(x.criada_em)) + (x.usada_em ? ' · usada ' + esc(ptQuando(x.usada_em)) : ' · ainda não usada') + '</small>' + (x.revogada_em ? '<span class="pt-st">revogada</span>' : '<button type="button" class="btn fant peq" data-pt-revogar="' + x.id + '">Revogar</button>') + '</li>').join('') || '<li class="sec">Nenhuma chave ainda.</li>') + '</ul>' +
      '<button type="button" class="btn sec" data-pt-chave="' + p.id + '">' + ICO.mais + 'Gerar chave</button></section>' +
    '<section class="pt-caixa"><h3>Aviso automático (webhook)</h3><p class="sec">Quando alguém manda, responde ou cancela uma pergunta, o CicloDev avisa neste endereço em até 1 minuto, assinado com um segredo. Se o aviso não chegar, o sistema de fora também busca a mesma lista pela função.</p>' +
      '<form class="pt-convidar" data-pt-webhook="' + p.id + '"><input class="campo" name="url" type="url" placeholder="https://..." value="' + esc(p.webhook_url || '') + '"><button class="btn sec" type="submit">Salvar e gerar segredo</button></form></section>' +
    '<section class="pt-caixa"><h3>Perguntas</h3>' + ((q.data || []).length ? '<ul class="pt-lista">' + q.data.map(x => '<li class="pt-q pt-' + x.status + '"><div class="pt-q-cab"><button type="button" class="pt-lnk" data-abrir-item="' + x.item_id + '">' + esc(nomeItem(x.item_id)) + '</button><span class="pt-st">' + ({aguardando:'Esperando', respondida:'Respondida', cancelada:'Cancelada'}[x.status]) + '</span><small>' + esc(ptQuando(x.criada_em)) + '</small></div><p class="pt-pergunta">' + esc(x.pergunta) + '</p>' +
      (x.resposta ? '<blockquote class="pt-resposta"><b>' + esc(x.respondida_por_nome || '') + '</b> · ' + esc(ptQuando(x.respondida_em)) + '<br>' + esc(x.resposta).replace(/\n/g, '<br>') + '</blockquote>' : '') + '</li>').join('') + '</ul>' : '<p class="sec">Nenhuma pergunta ainda. No ⋯ de qualquer item ou épico deste cliente, use "Perguntar ao stakeholder".</p>') + '</section>' +
    '<section class="pt-caixa"><h3>Avisos enviados</h3>' + ((e.data || []).length ? '<ul class="pt-eventos">' + e.data.map(x => '<li><b>' + esc(TIPO_EV[x.tipo] || x.tipo) + '</b><small>' + esc(ptQuando(x.criado_em)) + '</small><span class="pt-st' + (x.entregue_em ? ' ok' : '') + '">' + (x.entregue_em ? 'entregue' : p.webhook_url ? (x.ultimo_erro ? esc(x.ultimo_erro) : 'na fila') + (x.tentativas ? ' · ' + x.tentativas + (x.tentativas === 1 ? ' tentativa' : ' tentativas') : '') : 'sem webhook: o sistema de fora busca pela função') + '</span></li>').join('') + '</ul>' : '<p class="sec">Nenhum aviso ainda.</p>') + '</section>' +
    '</div>';
}
function ptMostrarUmaVez(titulo, texto, valor){
  modal(titulo, '<p style="margin-top:0">' + texto + '</p><div class="pt-segredo"><code>' + esc(valor) + '</code></div><p class="sec tf-nota">Esta é a única vez que aparece. Se perder, gere outro.</p>',
    [{txt:'Copiar', cls:'sec', acao:() => { ptCopiar(valor); toast('Copiado'); return false; }}, {txt:'Já guardei'}]);
}
document.addEventListener('click', e => {
  let b;
  if ((b = e.target.closest('[data-pt-perguntar]'))){ e.preventDefault(); const i = byId('issues', b.dataset.ptPerguntar); if (i) ptPerguntar(i); return; }
  if ((b = e.target.closest('[data-pt-cancelar]'))){ e.preventDefault(); const id = b.dataset.ptCancelar, it = itemAberto; modal('Cancelar a pergunta?', '<p style="margin:0">O item volta para o status de antes, se não houver outra pergunta esperando. O sistema de fora recebe o aviso.</p>', [{txt:'Voltar', cls:'sec'}, {txt:'Cancelar a pergunta', cls:'acento', acao:() => { ptCancelar(id, it); }}]); return; }
  if ((b = e.target.closest('[data-pt-criar]'))){ const cl = b.dataset.ptCriar; (async () => { const {error} = await ptSb().rpc('portal_criar', {p_no:cl, p_nome:nomeDe('client:' + cl)}); if (error){ toast('Não deu para criar: ' + ptErro(error)); return; } await window.ciclodevCarregarBanco(null); await ptCarregarClientes(); render(); toast('Portal criado'); })(); return; }
  if ((b = e.target.closest('[data-pt-chave]'))){ const id = b.dataset.ptChave; modal('Gerar chave', '<label class="lb">Para que sistema é esta chave<input class="campo" id="pt-k-n" value="Sistema do cliente" maxlength="80"></label>', [{txt:'Cancelar', cls:'sec'}, {txt:'Gerar', acao:dl => { const n = $('#pt-k-n', dl).value.trim() || 'Chave';
    (async () => { const {data, error} = await ptSb().rpc('portal_gerar_chave', {p_portal:id, p_nome:n}); if (error){ toast('Não deu para gerar: ' + ptErro(error)); return; } rView(); ptMostrarUmaVez('Chave do portal', 'Copie e guarde no cofre de segredos do sistema de fora. Ele manda assim em cada chamada: <code>Authorization: Bearer &lt;chave&gt;</code>.', data); })(); }}]); return; }
  if ((b = e.target.closest('[data-pt-revogar]'))){ const id = b.dataset.ptRevogar; modal('Revogar a chave?', '<p style="margin:0">O sistema que usa esta chave para de conseguir ler e responder na hora.</p>', [{txt:'Voltar', cls:'sec'}, {txt:'Revogar', cls:'acento', acao:() => { (async () => { const {error} = await ptSb().rpc('portal_revogar_chave', {p_chave:id}); if (error) toast('Não deu: ' + ptErro(error)); else { toast('Chave revogada'); rView(); } })(); }}]); return; }
  if ((b = e.target.closest('[data-pt-membro-tirar]'))){ const em = b.dataset.ptMembroTirar; (async () => { const {data, error} = await ptSb().from('portais_membros').delete().eq('portal_id', PT.portal.id).eq('email', em).select('email'); if (error || !data || !data.length) toast('Não deu para tirar: ' + ptErro(error || 'sem permissão')); else { toast(em + ' não pode mais responder'); rView(); } })(); return; }
}, true);
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset && t.dataset.ptMembroAtivo !== undefined){ (async () => { const {data, error} = await ptSb().from('portais_membros').update({ativo:t.checked}).eq('portal_id', PT.portal.id).eq('email', t.dataset.ptMembroAtivo).select('email'); if (error || !data || !data.length){ toast('Não deu para mudar: ' + ptErro(error || 'sem permissão')); t.checked = !t.checked; } else rView(); })(); return; }
  if (t.dataset && t.dataset.ptAtivo){ (async () => { const {data, error} = await ptSb().from('portais').update({ativo:t.checked}).eq('id', t.dataset.ptAtivo).select('id'); if (error || !data || !data.length){ toast('Não deu para mudar: ' + ptErro(error || 'sem permissão')); t.checked = !t.checked; } else { await ptCarregarClientes(); rView(); } })(); }
});
document.addEventListener('submit', e => {
  const f = e.target;
  if (f.matches && f.matches('[data-pt-convidar]') && !f.dataset.ptWebhook){ e.preventDefault(); e.stopImmediatePropagation();
    const nome = f.nome.value.trim(), email = f.email.value.trim().toLowerCase(); if (!nome || !/^[^@\s]+@[^@\s]+$/.test(email)){ toast('Escreva o nome e um e-mail válido'); return; }
    (async () => { const {data, error} = await ptSb().from('portais_membros').upsert({portal_id:PT.portal.id, email, nome, ativo:true}, {onConflict:'portal_id,email'}).select('email'); if (error || !data || !data.length) toast('Não deu para convidar: ' + ptErro(error || 'sem permissão')); else { toast(nome + ' pode responder pelo portal'); rView(); } })(); return; }
  if (f.matches && f.matches('[data-pt-webhook]')){ e.preventDefault(); e.stopImmediatePropagation();
    const url = f.url.value.trim(); if (url && !/^https:\/\/\S+$/.test(url)){ toast('O endereço precisa começar com https://'); return; }
    (async () => { const {data, error} = await ptSb().rpc('portal_webhook', {p_portal:f.dataset.ptWebhook, p_url:url}); if (error){ toast('Não deu para salvar: ' + ptErro(error)); return; } rView(); if (data) ptMostrarUmaVez('Segredo do webhook', 'Com ele o sistema de fora confere que o aviso veio mesmo do CicloDev: calcula HMAC-SHA256 do corpo recebido com este segredo e compara com o cabeçalho <code>X-CicloDev-Assinatura</code>.', data); else toast('Webhook desligado'); })(); }
}, true);

// o painel redesenha o conteúdo depois de pronto: o aviso volta sozinho quando some; e a seção do item também
let ptObs = 0;
new MutationObserver(() => { cancelAnimationFrame(ptObs); ptObs = requestAnimationFrame(() => {
  if (UI.modulo === 'operacoes' && UI.view === 'dashboard' && PT.lista && $('#ops-corpo') && !$('#ops-corpo .pt-painel')) ptAvisoPainel();
  if (itemAberto && $('#gaveta-wrap .gaveta .g-principal') && !$('#gaveta-wrap .pt-sec')){ const i = byId('issues', itemAberto); if (i && ptItemNoPortal(i) && !PT.lendoItem){ PT.lendoItem = true; ptSecaoItem(i).finally(() => { PT.lendoItem = false; }); } }
}); }).observe(document.body, {childList:true, subtree:true});

// liga depois de ler o banco, e confere respostas novas a cada minuto
if (COM_BANCO){
  const _carregarPt = carregarDoBanco;
  carregarDoBanco = async function(){ const r = await _carregarPt.apply(this, arguments); if (!PT.carregando){ PT.carregando = true; ptCarregarClientes().finally(() => { PT.carregando = false; }); } return r; };
  window.ciclodevCarregarBanco = carregarDoBanco;
  setInterval(() => { if (document.visibilityState === 'visible') ptResumo(); }, 60000);
}
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {PT, ptResumo, ptCarregarClientes, ptPerguntar});
