/* =====================================================================
   MUITOS USUÁRIOS: cada conta tem o próprio espaço; compartilhar cliente, projeto ou aplicação por número de ID.
   Um nível só de usuário. Como Trello, Jira, Notion e Google Drive (ver docs/ARQUITETURA-MULTIUSUARIO.md).
   ===================================================================== */
const MU = {eu:null};

/* ---------- entrar: guarda quem sou eu (número de ID e espaço) e tira o "Ver como" ---------- */
if (COM_BANCO){
  const _entrouComo = window.ciclodevEntrouComo;
  window.ciclodevEntrouComo = function(p){
    MU.eu = p || null;
    if (p) p.papel = 'master';          // um nível só: todo usuário tem o sistema inteiro no próprio espaço
    const r = _entrouComo(p);
    const s = $('#ver-como'); if (s){ s.hidden = true; const rod = s.closest('.menu-rodape'); if (rod){ const l = rod.querySelector('label[for=ver-como]'); if (l) l.hidden = true; } }
    mostrarMeuId();
    return r;
  };
}
function mostrarMeuId(){
  const rod = $('.menu-rodape .rodape-txt'); if (!rod || !MU.eu) return;
  let b = $('.mu-meu-id', rod);
  if (!b){ b = document.createElement('button'); b.type = 'button'; b.className = 'mu-meu-id'; b.dataset.muCopiar = '1'; rod.insertBefore(b, rod.firstChild); }
  const ini2 = String(MU.eu.nome || '?').trim().split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
  b.innerHTML = '<span class="mu-avatar" aria-hidden="true">' + esc(ini2) + '</span><span class="mu-txt"><span class="mu-nome">' + esc(MU.eu.nome || '') + '</span><b>ID ' + esc(MU.eu.numero || '') + '</b></span>';
  const rodape = rod.closest('.menu-rodape'); if (rodape) rodape.classList.add('com-conta');
  b.title = 'Seu número de ID. Passe para quem vai compartilhar algo com você. Clique para copiar.';
}

/* ---------- ler do banco: espaço de cada ponto, compartilhamentos e convites ---------- */
TABELAS_BANCO.push('convites', 'espacos');
(function(){ const k = GRAVAR.findIndex(g => g[0] === 'participacoes'); if (k >= 0) GRAVAR.splice(k, 1);   // compartilhar grava direto (janela Compartilhar)
  const r = GRAVAR.find(g => g[0] === 'regras_calculo'); if (r) r[1] = ['espaco_id', 'vigente_desde']; })();
const _montarDadosMU = montarDados;
montarDados = function(T, eu){
  const d = _montarDadosMU(T, eu);
  const esp = new Map((T.nos || []).map(n => [n.id, n.espaco_id]));
  ['clients','projects','products','apps','ws'].forEach(k => d[k].forEach(x => { x._espaco = esp.get(x.id) || null; }));
  const tipoNo = {cliente:'client', projeto:'project', produto:'product', aplicacao:'app', frente:'ws'};
  const nos = new Map((T.nos || []).map(n => [n.id, n]));
  const chaveNo = id => { const n = nos.get(id); return n ? tipoNo[n.tipo] + ':' + n.id : null; };
  d.compartilhamentos = (T.participacoes || []).map(p => ({pessoa:p.pessoa_id, no:chaveNo(p.no_id), papel:p.papel, por:p.criado_por || null})).filter(x => x.no);
  d.convites = (T.convites || []).filter(c => !c.aceito_em).map(c => ({id:c.id, no:chaveNo(c.no_id), email:c.email, por:c.criado_por})).filter(x => x.no);
  d.espacos = (T.espacos || []).map(e => ({id:e.id, nome:e.nome, dono:e.dono_id}));
  const pT = new Map((T.pessoas || []).map(p => [p.id, p]));
  d.people.forEach(p => { const r = pT.get(p.id) || {}; p.numero = r.numero || null; p.usuario = r.usuario || null; p._login = !!r.auth_user_id; });
  d.meuEspaco = (MU.eu && MU.eu.espaco_id) || null;
  if (d.regras) d.regras._espaco = d.meuEspaco;
  return d;
};
const _linhasDaTelaMU = linhasDaTela;
linhasDaTela = function(d){
  const L = _linhasDaTelaMU(d);
  delete L.participacoes;
  // só gravo o meu perfil e as pessoas sem login do meu espaço (as outras contas são de cada um)
  const euId = MU.eu && MU.eu.pessoa_id;
  const alheias = new Set(d.people.filter(p => (p._login && p.id !== euId) || p._externa).map(p => p.id));
  L.pessoas = (L.pessoas || []).filter(r => !alheias.has(r.id));
  L.pessoas_custos = (L.pessoas_custos || []).filter(r => !d.people.some(p => p.id === r.pessoa_id && p._externa));
  (L.regras_calculo || []).forEach(r => { r.espaco_id = (d.regras && d.regras._espaco) || d.meuEspaco; });
  if (L.regras_calculo && !d.meuEspaco) L.regras_calculo = [];
  return L;
};

/* ---------- o que é meu e o que foi compartilhado comigo ---------- */
const objDoNo = chave => { const [t, id] = String(chave || '').split(':'); const m = {client:'clients', project:'projects', product:'products', app:'apps', ws:'ws'}[t]; return m ? byId(m, id) : null; };
function ehMeu(chave){ const o = objDoNo(chave); return !COM_BANCO || !o || !o._espaco || !D.meuEspaco || o._espaco === D.meuEspaco; }
function compartilhadoComigo(chave){
  if (ehMeu(chave)) return null;
  const eu = MU.eu && MU.eu.pessoa_id, acima = new Set(caminho(chave).map(p => p[0]));
  return (D.compartilhamentos || []).find(c => c.pessoa === eu && acima.has(c.no)) || null;
}
const soParaSituar = chave => !ehMeu(chave) && !compartilhadoComigo(chave);
function donoDoNo(chave){ const o = objDoNo(chave); const e = o && (D.espacos || []).find(x => x.id === o._espaco); return e ? pessoa(e.dono) : null; }

/* ---------- marca na Estrutura (como "Compartilhados comigo" do Drive) ---------- */
function marcarCompartilhados(){
  if (!COM_BANCO) return;
  document.querySelectorAll('.ops-arvore .no-arv[data-no]').forEach(n => {
    const k = n.dataset.no; if (k === 'all') return;
    const cam = soParaSituar(k), rec = !ehMeu(k) && !cam;
    n.classList.toggle('mu-recebido', rec); n.classList.toggle('mu-caminho', cam);
    if ((rec || cam) && !n.querySelector('.mu-selo')){ const dono = donoDoNo(k);
      n.querySelector('.nome') && n.querySelector('.nome').insertAdjacentHTML('afterend', '<span class="mu-selo" title="' + esc(cam ? 'Só o nome, para situar: você recebeu algo dentro dele' : 'Compartilhado com você' + (dono ? ' por ' + dono.nome : '')) + '">' + (cam ? '·' : SV('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>')) + '</span>'); }
  });
}
let muPedido = 0;
new MutationObserver(() => { cancelAnimationFrame(muPedido); muPedido = requestAnimationFrame(() => { marcarCompartilhados(); botaoCompartilhar(); }); }).observe(document.querySelector('.principal') || document.body, {childList:true, subtree:true});

/* ---------- botão Compartilhar no topo de Operações (e na ficha do cliente) ---------- */
function botaoCompartilhar(){
  const t = $('#m-operacoes .ops-titulo'); if (!t || UI.sel === 'all' || t.querySelector('.mu-compartilhar')) return;
  const cam = COM_BANCO && soParaSituar(UI.sel);
  t.insertAdjacentHTML('beforeend', '<div class="mu-comp-box">' + (compartilhadoComigo(UI.sel) ? '<span class="mu-recebido-txt">Compartilhado com você' + (donoDoNo(UI.sel) ? ' por ' + esc(donoDoNo(UI.sel).nome) : '') + '</span>' : '') +
    (cam ? '<span class="mu-recebido-txt">Só o nome, para situar</span>' : '<button type="button" class="btn sec peq mu-compartilhar" data-mu-compartilhar="' + esc(UI.sel) + '">' + SV('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>') + 'Compartilhar</button>') + '</div>');
}

/* ---------- janela Compartilhar (como a do Google Drive, do Trello e do Notion) ---------- */
async function abrirCompartilhar(chave){
  const nome = nomeDe(chave), tipoTxt = ({client:'o cliente', project:'o projeto', product:'o produto', app:'a aplicação', ws:'a frente'})[chave.split(':')[0]] || 'isto';
  const dl = modal('Compartilhar ' + esc(nome), '', [{txt:'Pronto'}]);
  dl.classList.add('mu-modal');
  const desenhar = () => {
    const acima = caminho(chave).map(p => p[0]);
    const diretos = (D.compartilhamentos || []).filter(c => c.no === chave);
    const herdados = (D.compartilhamentos || []).filter(c => c.no !== chave && acima.includes(c.no));
    const equipes = (D.equipes || []).filter(q => q.ativa !== false && q.nos.some(n => acima.includes(n.no)));
    const conv = (D.convites || []).filter(c => c.no === chave);
    const dono = donoDoNo(chave) || (MU.eu ? {nome:MU.eu.nome, numero:MU.eu.numero, id:MU.eu.pessoa_id} : null);
    const lin = (p, papel, extra) => '<li class="mu-pessoa">' + (p && p.id ? avatar(p.id) : '<span class="avatar">?</span>') + '<div class="mu-p-nome"><b>' + esc((p && p.nome) || 'Pessoa') + '</b>' + (p && p.numero ? '<small>ID ' + esc(p.numero) + (p.usuario ? ' · @' + esc(p.usuario) : '') + '</small>' : '') + '</div><span class="mu-papel">' + papel + '</span>' + (extra || '') + '</li>';
    $('.modal-corpo', dl).innerHTML =
      '<p class="sec" style="margin:0">Quem recebe trabalha junto em ' + tipoTxt + ' e em tudo o que está dentro dele, no próprio sistema. O resto do seu espaço continua só seu.</p>' +
      (COM_BANCO ? '<form class="mu-add" data-mu-add><input class="campo" name="q" placeholder="Número de ID (ex.: 100002), @usuário ou e-mail" autocomplete="off" aria-label="Com quem compartilhar"><button class="btn" type="submit">Compartilhar</button></form><p class="mu-msg" data-mu-msg hidden></p>'
        : '<p class="mu-msg">Na demonstração não há outros usuários. Entre no sistema publicado para compartilhar pelo número de ID.</p>') +
      '<h3 class="mu-tit">Quem tem acesso</h3><ul class="mu-lista">' +
        (dono ? lin(dono, 'Dono') : '') +
        diretos.map(c => lin(pessoa(c.pessoa), 'Pode trabalhar', '<button type="button" class="ico-btn perigo" data-mu-tirar="' + c.pessoa + '" aria-label="Tirar o acesso">' + ICO.fechar + '</button>')).join('') +
        herdados.map(c => lin(pessoa(c.pessoa), 'Pelo ' + esc(nomeDe(c.no)))).join('') +
        equipes.map(q => '<li class="mu-pessoa"><span class="avatar" style="background:' + esc(q.cor) + '">' + esc(ini(q.nome)) + '</span><div class="mu-p-nome"><b>Equipe ' + esc(q.nome) + '</b><small>' + q.membros.length + ' pessoa' + (q.membros.length === 1 ? '' : 's') + '</small></div><span class="mu-papel">Pela equipe</span></li>').join('') +
        conv.map(c => '<li class="mu-pessoa"><span class="avatar">@</span><div class="mu-p-nome"><b>' + esc(c.email) + '</b><small>Convite enviado: vira acesso quando a pessoa criar a conta</small></div><span class="mu-papel">Convidado</span><button type="button" class="ico-btn perigo" data-mu-tirar-convite="' + c.id + '" aria-label="Cancelar o convite">' + ICO.fechar + '</button></li>').join('') +
      '</ul>' + (MU.eu ? '<p class="sec mu-meu">Seu número de ID é <b>' + esc(MU.eu.numero) + '</b>. Passe para quem for compartilhar algo com você.</p>' : '');
  };
  const msg = (t, erro) => { const m = $('[data-mu-msg]', dl); if (!m) return; m.hidden = !t; m.textContent = t || ''; m.classList.toggle('erro', !!erro); };
  const noId = chave.split(':')[1];
  dl.addEventListener('submit', async e => {
    const f = e.target.closest('[data-mu-add]'); if (!f) return; e.preventDefault();
    const q = f.q.value.trim(); if (!q) return; const sb = window.ciclodevBanco; if (!sb) return;
    const btn = f.querySelector('button'); btn.disabled = true; msg('');
    try {
      const {data:achou, error:e1} = await sb.rpc('buscar_pessoa', {p_busca:q});
      if (e1) throw e1;
      const p = achou && achou[0];
      if (p){
        if (MU.eu && p.id === MU.eu.pessoa_id){ msg('Esse é o seu próprio ID.', true); return; }
        if ((D.compartilhamentos || []).some(c => c.no === chave && c.pessoa === p.id)){ msg(p.nome + ' já tem acesso.', true); return; }
        const {data, error} = await sb.from('participacoes').insert({pessoa_id:p.id, no_id:noId, papel:'owner', criado_por:MU.eu && MU.eu.pessoa_id}).select('pessoa_id');
        if (error) throw error; if (!data || !data.length) throw new Error('o banco não deixou compartilhar');
        if (!pessoa(p.id)) D.people.push({id:p.id, nome:p.nome, numero:p.numero, usuario:p.usuario, funcao:'', skills:[], cap:0, acesso:'dev', _externa:true});
        else Object.assign(pessoa(p.id), {numero:p.numero, usuario:p.usuario});
        D.compartilhamentos.push({pessoa:p.id, no:chave, papel:'owner', por:MU.eu && MU.eu.pessoa_id});
        f.q.value = ''; desenhar(); toast('Compartilhado com ' + p.nome);
      } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q)){
        const {data, error} = await sb.from('convites').insert({no_id:noId, email:q.toLowerCase(), criado_por:MU.eu && MU.eu.pessoa_id}).select('id');
        if (error) throw /duplicate|unique/i.test(error.message) ? new Error('esse e-mail já foi convidado') : error;
        D.convites.push({id:data[0].id, no:chave, email:q.toLowerCase()}); f.q.value = ''; desenhar();
        toast('Convite guardado. Quando ' + q + ' criar a conta, o acesso aparece sozinho.');
      } else msg('Nenhuma conta com esse número de ID ou @usuário. Para quem ainda não tem conta, use o e-mail.', true);
    } catch (err){ msg('Não deu para compartilhar: ' + (err.message || err), true); }
    finally { btn.disabled = false; }
  });
  dl.addEventListener('click', async e => {
    const x = e.target.closest('[data-mu-tirar],[data-mu-tirar-convite]'); if (!x) return; const sb = window.ciclodevBanco; if (!sb) return;
    if (x.dataset.muTirar){
      const {error} = await sb.from('participacoes').delete().match({pessoa_id:x.dataset.muTirar, no_id:noId});
      if (error){ msg('Não deu para tirar o acesso: ' + error.message, true); return; }
      D.compartilhamentos = D.compartilhamentos.filter(c => !(c.no === chave && c.pessoa === x.dataset.muTirar)); desenhar(); toast('Acesso retirado');
    } else {
      const {error} = await sb.from('convites').delete().eq('id', x.dataset.muTirarConvite);
      if (error){ msg('Não deu para cancelar: ' + error.message, true); return; }
      D.convites = D.convites.filter(c => c.id !== x.dataset.muTirarConvite); desenhar();
    }
  });
  desenhar();
  const i = $('[data-mu-add] input', dl); if (i) setTimeout(() => i.focus(), 30);
}
document.addEventListener('click', e => {
  const x = e.target.closest('[data-mu-compartilhar]'); if (x){ abrirCompartilhar(x.dataset.muCompartilhar); return; }
  const c = e.target.closest('[data-mu-copiar]'); if (c && MU.eu){ try { navigator.clipboard.writeText(String(MU.eu.numero)); toast('Seu ID ' + MU.eu.numero + ' foi copiado'); } catch (er){ toast('Seu ID é ' + MU.eu.numero); } }
});

/* ---------- ficha do cliente: botão Compartilhar ---------- */
const _fcDesenharMU = fcDesenhar;
fcDesenhar = function(){
  _fcDesenharMU();
  const h = FC.dlg && FC.dlg.querySelector('.modal-cab h2'); if (!h || h.querySelector('.mu-compartilhar')) return;
  h.insertAdjacentHTML('beforeend', '<button type="button" class="btn sec peq mu-compartilhar" data-mu-compartilhar="client:' + esc(FC.cli) + '">Compartilhar</button>');
};

/* ---------- Settings: Minha conta (nome, @usuário, número de ID e espaço) ---------- */
const _rConfigMU = rConfig;
rConfig = function(){
  _rConfigMU();
  const el = $('#m-configuracoes'); if (!el || !COM_BANCO || !MU.eu) return;
  const eu = pessoa(MU.eu.pessoa_id) || {};
  el.insertAdjacentHTML('afterbegin', '<section class="mu-conta"><h2 class="sub">Minha conta</h2><div class="grade-form">' +
    '<label class="lb">Nome<input class="campo" data-mu-perfil="nome" value="' + esc(eu.nome || MU.eu.nome || '') + '"></label>' +
    '<label class="lb">@usuário' + I('Um nome curto para outras pessoas acharem você ao compartilhar (como no Trello). Só letras minúsculas, números, ponto e sublinhado.') + '<input class="campo" data-mu-perfil="usuario" value="' + esc(eu.usuario || '') + '" placeholder="ex.: william"></label>' +
    '<div class="lb"><span>Número de ID</span><button type="button" class="btn sec" data-mu-copiar>ID ' + esc(MU.eu.numero) + ' · copiar</button></div>' +
    '<div class="lb"><span>Espaço</span><span class="sec" style="padding-top:8px">' + esc(MU.eu.espaco_nome || '') + '</span></div></div>' +
    '<div class="acoes"><button class="btn" type="button" data-mu-salvar-perfil>Salvar minha conta</button></div></section>');
};
document.addEventListener('click', async e => {
  if (!e.target.closest('[data-mu-salvar-perfil]') || !MU.eu) return;
  const nome = ($('[data-mu-perfil=nome]') || {}).value.trim(), usuario = (($('[data-mu-perfil=usuario]') || {}).value || '').trim().toLowerCase().replace(/^@/, '');
  if (nome.length < 2){ toast('Escreva o seu nome'); return; }
  if (usuario && !/^[a-z0-9_.]{3,30}$/.test(usuario)){ toast('O @usuário tem de 3 a 30 letras minúsculas, números, ponto ou sublinhado'); return; }
  const {data, error} = await window.ciclodevBanco.from('pessoas').update({nome, usuario:usuario || null}).eq('id', MU.eu.pessoa_id).select('id');
  if (error){ toast(/duplicate|unique/i.test(error.message) ? 'Esse @usuário já está em uso' : 'Não gravou: ' + error.message); return; }
  if (!data || !data.length){ toast('O banco não deixou gravar'); return; }
  const p = pessoa(MU.eu.pessoa_id); if (p){ p.nome = nome; p.usuario = usuario || null; }
  MU.eu.nome = nome; mostrarMeuId(); salvar(); toast('Conta salva');
});
