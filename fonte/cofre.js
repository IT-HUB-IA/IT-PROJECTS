/* =====================================================================
   Cofre (parte 68 do banco): senhas, credenciais, chaves de API, chaves SSH, certificados e notas seguras.
   O que a tela pode ter a qualquer hora: só a lista (nome, tipo, endereço, descrição pública, quem tem acesso).
   O valor (usuário, senha, chave...) vem do Vault só quando a pessoa pede "Mostrar" ou "Copiar", pela função
   cofre_revelar (que confere a permissão e registra). Ele fica só na memória da janela aberta e some:
   - ao fechar a janela, ou em 60 segundos (o que vier primeiro);
   - nunca vai para D, para a gravação geral, para o navegador (localStorage), para exportações ou para o registro de uso.
   Copiar: a área de transferência é limpa depois de 30 s (quando o navegador deixa).
   ===================================================================== */
const CF = {itens:[], acessos:[], lido:false, carregando:null, erro:'', busca:'', tipo:'', lixeira:false};
const CF_VIVE_MS = 60000, CF_COPIA_MS = 30000;
// cada tipo: os campos do segredo [chave, rótulo, oculto, várias linhas]
const CF_TIPOS = {
  senha:       ['Senha', [['usuario', 'Usuário ou e-mail'], ['senha', 'Senha', 1], ['notas', 'Notas', 0, 1]]],
  chave_api:   ['Chave de API', [['chave', 'Chave', 1], ['segredo', 'Segredo (se tiver)', 1], ['notas', 'Notas', 0, 1]]],
  credencial:  ['Credencial', [['usuario', 'Usuário'], ['senha', 'Senha', 1], ['notas', 'Notas', 0, 1]]],
  banco:       ['Banco de dados', [['host', 'Servidor (host)'], ['porta', 'Porta'], ['banco', 'Banco'], ['usuario', 'Usuário'], ['senha', 'Senha', 1], ['notas', 'Notas', 0, 1]]],
  chave_ssh:   ['Chave SSH', [['usuario', 'Usuário'], ['chave_privada', 'Chave privada', 1, 1], ['frase', 'Frase da chave', 1], ['chave_publica', 'Chave pública', 0, 1]]],
  certificado: ['Certificado', [['certificado', 'Certificado', 0, 1], ['chave_privada', 'Chave privada', 1, 1], ['senha', 'Senha do certificado', 1]]],
  nota:        ['Nota segura', [['texto', 'Texto', 1, 1]]],
  outro:       ['Outro', [['valor', 'Valor', 1, 1], ['notas', 'Notas', 0, 1]]]
};
const cfBanco = () => (typeof COM_BANCO !== 'undefined' && COM_BANCO) ? window.ciclodevBanco : null;
const cfEu = () => (typeof MU !== 'undefined' && MU.eu && MU.eu.pessoa_id) || null;
const cfNomePessoa = id => { const p = (D.people || []).find(x => x.id === id); return p ? p.nome : 'Alguém'; };
const cfNivel = it => it.dono_id === cfEu() ? 'dono' : ((CF.acessos.find(a => a.item_id === it.id && a.pessoa_id === cfEu()) || {}).nivel || 'ver');
const cfErro = e => { const m = (e && (e.message || e)) || ''; return /não encontrado/i.test(m) ? 'Item não encontrado ou sem permissão.' : m; };

async function cfCarregar(){
  const sb = cfBanco(); if (!sb){ CF.lido = true; return; }
  if (CF.carregando) return CF.carregando;
  CF.carregando = (async () => {
    try {
      const [i, a] = await Promise.all([
        sb.from('cofre_itens').select('id, espaco_id, dono_id, no_id, tipo, nome, url, descricao, etiquetas, trocar_em, criado_em, atualizado_em, atualizado_por, excluido_em').order('nome'),
        sb.from('cofre_acessos').select('item_id, pessoa_id, nivel, dado_em')]);
      if (i.error) throw i.error; if (a.error) throw a.error;
      CF.itens = i.data || []; CF.acessos = a.data || []; CF.erro = '';
    } catch(e){ CF.erro = cfErro(e); }
    finally { CF.lido = true; CF.carregando = null; }
  })();
  return CF.carregando;
}

/* ---------- lista ---------- */
function rCofre(){
  const el = $('#m-cofre'); if (!el) return;
  if (!CF.lido){ el.innerHTML = '<p class="vazio-linha">Abrindo o cofre…</p>'; cfCarregar().then(() => { if (UI.modulo === 'cofre') rCofre(); }); return; }
  const q = CF.busca.trim().toLowerCase(), hoje = iso(new Date());
  const lista = CF.itens.filter(i => CF.lixeira ? i.excluido_em : !i.excluido_em)
    .filter(i => !CF.tipo || i.tipo === CF.tipo)
    .filter(i => !q || [i.nome, i.url, i.descricao, (i.etiquetas || []).join(' ')].some(x => String(x || '').toLowerCase().includes(q)));
  const vencidos = CF.itens.filter(i => !i.excluido_em && i.trocar_em && i.trocar_em <= hoje).length;
  const tipos = Object.entries(CF_TIPOS).filter(([k]) => CF.itens.some(i => i.tipo === k && !i.excluido_em));
  el.innerHTML = '<div class="topo-tela"><div><h1><span>Cofre</span></h1>' +
      '<p class="lead">Senhas, credenciais, chaves de API e chaves de acesso. O valor fica criptografado no Vault do banco e só aparece quando você pede, para você e para quem você escolher. Cada vez que alguém vê ou copia, fica registrado.</p></div>' +
      '<div class="cf-acoes-topo"><button class="btn acento" type="button" data-cf-novo>' + ICO.mais + 'Guardar novo</button></div></div>' +
    (CF.erro ? '<p class="entrada-erro">Não foi possível abrir o cofre: ' + esc(CF.erro) + '</p>' : '') +
    '<div class="cf-barra"><input class="campo cf-busca" type="search" data-cf-busca placeholder="Buscar por nome, endereço ou etiqueta" value="' + esc(CF.busca) + '" autocomplete="off">' +
      '<div class="cf-chips"><button type="button" class="cf-chip' + (!CF.tipo ? ' ativo' : '') + '" data-cf-tipo="">Todos</button>' +
        tipos.map(([k, [n]]) => '<button type="button" class="cf-chip' + (CF.tipo === k ? ' ativo' : '') + '" data-cf-tipo="' + k + '">' + esc(n) + '</button>').join('') + '</div>' +
      '<label class="cf-lix"><input type="checkbox" data-cf-lixeira' + (CF.lixeira ? ' checked' : '') + '> Lixeira</label></div>' +
    (vencidos && !CF.lixeira ? '<p class="cf-aviso-troca">' + vencidos + (vencidos === 1 ? ' item passou' : ' itens passaram') + ' da data de troca. Troque a senha ou a chave e atualize aqui.</p>' : '') +
    (!lista.length ? '<p class="vazio-linha">' + (CF.lixeira ? 'Nada na lixeira.' : CF.itens.length ? 'Nada com esse filtro.' : 'O cofre está vazio. Use "Guardar novo" para guardar a primeira senha ou chave.') + '</p>' :
      '<div class="tabela-rolo"><table class="tabela cf-tabela"><thead><tr><th>Nome</th><th>Tipo</th><th>Dono</th><th>Quem mais vê</th><th>Trocar em</th><th></th></tr></thead><tbody>' +
      lista.map(i => { const ac = CF.acessos.filter(a => a.item_id === i.id), meu = i.dono_id === cfEu(), venc = i.trocar_em && i.trocar_em <= hoje;
        return '<tr data-cf-item="' + esc(i.id) + '"><td><button type="button" class="cf-nome" data-cf-abrir="' + esc(i.id) + '">' + esc(i.nome) + '</button>' + (i.url ? '<span class="cf-url">' + esc(i.url) + '</span>' : '') +
          ((i.etiquetas || []).length ? '<span class="cf-tags">' + i.etiquetas.map(t => '<span>' + esc(t) + '</span>').join('') + '</span>' : '') + '</td>' +
          '<td>' + esc((CF_TIPOS[i.tipo] || CF_TIPOS.outro)[0]) + '</td><td>' + (meu ? 'Você' : esc(cfNomePessoa(i.dono_id))) + '</td>' +
          '<td>' + (meu ? (ac.length ? ac.length + (ac.length === 1 ? ' pessoa' : ' pessoas') : 'Só você') : (cfNivel(i) === 'editar' ? 'Você (pode editar)' : 'Você (só vê)')) + '</td>' +
          '<td' + (venc ? ' class="cf-venc"' : '') + '>' + (i.trocar_em ? fmtData(i.trocar_em) : '') + '</td>' +
          '<td class="cf-td-acoes"><button type="button" class="btn peq sec" data-cf-abrir="' + esc(i.id) + '">' + (CF.lixeira ? 'Abrir' : 'Ver') + '</button></td></tr>'; }).join('') +
      '</tbody></table></div>');
}

/* ---------- ver um item: o valor só vem quando pede ---------- */
function cfAbrir(id){
  const it = CF.itens.find(x => x.id === id); if (!it) return;
  const nivel = cfNivel(it), tipo = CF_TIPOS[it.tipo] || CF_TIPOS.outro, sb = cfBanco();
  let seg = null, timer = 0;                         // o segredo revelado: só aqui dentro, some sozinho
  const esquecer = () => { seg = null; clearTimeout(timer); };
  const revelar = async () => {
    if (seg) return seg;
    const {data, error} = await sb.rpc('cofre_revelar', {p_id:id, p_motivo:null});
    if (error) throw new Error(cfErro(error));
    seg = data || {}; clearTimeout(timer);
    timer = setTimeout(() => { esquecer(); if (dlg.isConnected) mascarar(); }, CF_VIVE_MS);
    return seg;
  };
  const campos = () => { const s = seg || {}; const base = tipo[1].map(c => c.concat([])); Object.keys(s).filter(k => k !== 'extras' && !base.some(c => c[0] === k)).forEach(k => base.push([k, k, 1, 0]));
    (Array.isArray(s.extras) ? s.extras : []).forEach((x, n) => base.push(['extras.' + n, String(x && x.nome || 'Campo extra'), 1, 0])); return base; };
  const valorDe = k => { if (!seg) return ''; if (k.startsWith('extras.')){ const x = (seg.extras || [])[+k.split('.')[1]]; return x ? String(x.valor || '') : ''; } return seg[k] == null ? '' : String(seg[k]); };
  const linha = ([k, rot, oculto, multi]) => '<div class="cf-campo" data-cf-campo="' + esc(k) + '"><span class="cf-rot">' + esc(rot) + '</span>' +
    '<span class="cf-val' + (multi ? ' cf-multi' : '') + '" data-cf-val>' + (seg ? (oculto ? '••••••••••' : esc(valorDe(k)) || '<span class="sec">(vazio)</span>') : '••••••••••') + '</span>' +
    '<span class="cf-bts">' + (oculto || !seg ? '<button type="button" class="btn peq sec" data-cf-mostrar="' + esc(k) + '">Mostrar</button>' : '') +
    '<button type="button" class="btn peq sec" data-cf-copiar="' + esc(k) + '">Copiar</button></span></div>';
  const corpoSegredo = () => '<div class="cf-segredo">' + campos().map(linha).join('') + '</div>';
  const ac = CF.acessos.filter(a => a.item_id === id);
  const corpo = '<div class="cf-ver">' +
    '<p class="cf-meta">' + esc(tipo[0]) + (it.url ? ' · <a href="' + esc(/^https?:\/\//i.test(it.url) ? it.url : 'https://' + it.url) + '" target="_blank" rel="noopener noreferrer">' + esc(it.url) + '</a>' : '') +
      ' · ' + (it.dono_id === cfEu() ? 'seu' : 'de ' + esc(cfNomePessoa(it.dono_id)) + (nivel === 'editar' ? ' (você pode editar)' : ' (você só vê)')) + '</p>' +
    (it.descricao ? '<p class="cf-desc">' + esc(it.descricao) + '</p>' : '') +
    (it.excluido_em ? '<p class="cf-aviso-troca">Este item está na lixeira. Só você vê; quem tinha acesso não vê mais.</p>' : '') +
    '<div data-cf-area>' + corpoSegredo() + '</div>' +
    '<p class="cf-rodape">Mostrar e copiar ficam registrados. O valor some desta janela em 60 segundos ou ao fechar.' +
      (nivel === 'dono' ? ' ' + (ac.length ? 'Compartilhado com ' + ac.map(a => esc(cfNomePessoa(a.pessoa_id)) + ' (' + (a.nivel === 'editar' ? 'edita' : 'vê') + ')').join(', ') + '.' : 'Só você vê.') : '') + '</p></div>';
  const botoes = [];
  if (!it.excluido_em && nivel !== 'ver') botoes.push({txt:'Editar', cls:'sec', acao:() => { (async () => { try { const s = await revelar(); cfForm(it, s); } catch(e){ toast(e.message); } })(); }});
  if (!it.excluido_em && nivel === 'dono') botoes.push({txt:'Compartilhar', cls:'sec', acao:() => { cfCompartilhar(it); }});
  botoes.push({txt:'Histórico', cls:'sec', acao:() => { cfHistorico(it); }});
  if (nivel === 'dono') botoes.push(it.excluido_em
    ? {txt:'Apagar de vez', cls:'sec', acao:() => { cfApagarDeVez(it); }}
    : {txt:'Mandar para a lixeira', cls:'sec', acao:() => { cfLixeira(it, false); }});
  if (nivel === 'dono' && it.excluido_em) botoes.push({txt:'Trazer de volta', acao:() => { cfLixeira(it, true); }});
  botoes.push({txt:'Fechar'});
  const dlg = modal('Cofre · ' + esc(it.nome), corpo, botoes);
  dlg.classList.add('cf-dlg');
  const area = () => dlg.querySelector('[data-cf-area]');
  const mascarar = () => { const a = area(); if (a) a.innerHTML = corpoSegredo(); };
  dlg.addEventListener('close', esquecer);
  dlg.addEventListener('click', e => {
    const m = e.target.closest('[data-cf-mostrar]'), c = e.target.closest('[data-cf-copiar]');
    if (m){ (async () => { try { await revelar(); const k = m.dataset.cfMostrar, box = m.closest('.cf-campo');
        if (!box) return; const multi = (campos().find(x => x[0] === k) || [])[3];
        box.querySelector('[data-cf-val]').innerHTML = esc(valorDe(k)) || '<span class="sec">(vazio)</span>';
        m.textContent = 'Esconder'; m.dataset.cfEsconder = k; delete m.dataset.cfMostrar;
        if (!box.isConnected) mascarar(); void multi; } catch(err){ toast(err.message); } })(); return; }
    const h = e.target.closest('[data-cf-esconder]');
    if (h){ const box = h.closest('.cf-campo'); box.querySelector('[data-cf-val]').textContent = '••••••••••'; h.textContent = 'Mostrar'; h.dataset.cfMostrar = h.dataset.cfEsconder; delete h.dataset.cfEsconder; return; }
    if (c){ (async () => { try { await revelar(); const k = c.dataset.cfCopiar, v = valorDe(k);
        if (!v){ toast('Este campo está vazio.'); return; }
        await navigator.clipboard.writeText(v);
        sb.rpc('cofre_copiou', {p_id:id, p_campo:k.startsWith('extras.') ? 'extra' : k}).then(() => {}, () => {});
        toast('Copiado. A área de transferência é limpa em 30 segundos.');
        setTimeout(() => { if (navigator.clipboard) navigator.clipboard.readText().then(t => { if (t === v) return navigator.clipboard.writeText(''); }).catch(() => { navigator.clipboard.writeText('').catch(() => {}); }); }, CF_COPIA_MS);
      } catch(err){ toast(/clipboard|permission|denied/i.test(String(err && err.message)) ? 'O navegador não deixou copiar. Use Mostrar e copie à mão.' : err.message); } })(); }
  });
}

/* ---------- guardar novo / editar ---------- */
function cfSenhaForte(n){
  const conj = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*-_=+?';
  const out = [], buf = new Uint32Array(1), lim = Math.floor(4294967296 / conj.length) * conj.length;   // sem viés: descarta o que passaria do múltiplo
  while (out.length < (n || 20)){ crypto.getRandomValues(buf); if (buf[0] < lim) out.push(conj[buf[0] % conj.length]); }
  return out.join('');
}
function cfForm(it, segAtual){
  const novo = !it, tipoIni = (it && it.tipo) || 'senha';
  let extras = segAtual && Array.isArray(segAtual.extras) ? segAtual.extras.map(x => ({nome:String(x.nome || ''), valor:String(x.valor || '')})) : [];
  const campoSeg = ([k, rot, oculto, multi], v) => '<label class="lb largo cf-lb">' + esc(rot) +
    (multi ? '<textarea class="campo cf-in" data-cf-seg="' + k + '" rows="4" spellcheck="false" autocomplete="off"' + (oculto ? ' data-cf-oculto' : '') + '>' + esc(v || '') + '</textarea>'
           : '<span class="cf-in-linha"><input class="campo cf-in" data-cf-seg="' + k + '" type="' + (oculto ? 'password' : 'text') + '" value="' + esc(v || '') + '" autocomplete="' + (oculto ? 'new-password' : 'off') + '" spellcheck="false">' +
             (oculto ? '<button type="button" class="btn peq sec" data-cf-ver-in>Mostrar</button>' + (/senha|frase/.test(k) ? '<button type="button" class="btn peq sec" data-cf-gerar>Gerar</button>' : '') : '') + '</span>') + '</label>';
  const blocoSeg = tipo => (CF_TIPOS[tipo] || CF_TIPOS.outro)[1].map(c => campoSeg(c, segAtual ? segAtual[c[0]] : '')).join('') +
    '<div class="cf-extras" data-cf-extras>' + extras.map((x, n) => '<div class="cf-extra"><input class="campo" data-cf-ex-n="' + n + '" placeholder="Nome do campo" value="' + esc(x.nome) + '" autocomplete="off">' +
      '<input class="campo" data-cf-ex-v="' + n + '" type="password" placeholder="Valor" value="' + esc(x.valor) + '" autocomplete="new-password"><button type="button" class="btn peq sec" data-cf-ex-tirar="' + n + '">Tirar</button></div>').join('') + '</div>' +
    '<button type="button" class="btn peq sec" data-cf-ex-mais>' + ICO.mais + 'Campo extra</button>';
  const opcoesTipo = Object.entries(CF_TIPOS).map(([k, [n]]) => '<option value="' + k + '"' + (k === tipoIni ? ' selected' : '') + '>' + esc(n) + '</option>').join('');
  const corpo = '<form class="cf-form" autocomplete="off" onsubmit="return false"><div class="grade-form">' +
    '<label class="lb">Tipo<select class="sel" data-cf-m="tipo">' + opcoesTipo + '</select></label>' +
    '<label class="lb">Nome<input class="campo" data-cf-m="nome" maxlength="160" value="' + esc((it && it.nome) || '') + '" placeholder="Ex.: Painel AWS da produção"></label>' +
    '<label class="lb largo">Endereço (site, sistema)<input class="campo" data-cf-m="url" maxlength="500" value="' + esc((it && it.url) || '') + '" placeholder="Ex.: https://console.aws.amazon.com"></label>' +
    '<label class="lb largo">Descrição (aparece na lista para quem vê o item: nunca ponha a senha aqui)<textarea class="campo" data-cf-m="descricao" rows="2" maxlength="2000">' + esc((it && it.descricao) || '') + '</textarea></label>' +
    '<label class="lb">Etiquetas (separe por vírgula)<input class="campo" data-cf-m="etiquetas" value="' + esc(((it && it.etiquetas) || []).join(', ')) + '" placeholder="Ex.: produção, AWS"></label>' +
    '<label class="lb">Lembrar de trocar em<input class="campo" type="date" data-cf-m="trocar_em" value="' + esc((it && it.trocar_em) || '') + '"></label></div>' +
    '<h4 class="cf-h">O que fica no cofre (criptografado)</h4><div class="grade-form" data-cf-segs>' + blocoSeg(tipoIni) + '</div></form>';
  const ler = d => {
    const m = {}; $$('[data-cf-m]', d).forEach(x => { m[x.dataset.cfM] = x.value; });
    m.etiquetas = String(m.etiquetas || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 20).map(t => t.slice(0, 40));
    const s = {}; $$('[data-cf-seg]', d).forEach(x => { if (x.value !== '') s[x.dataset.cfSeg] = x.value; });
    const ex = []; $$('[data-cf-ex-n]', d).forEach(x => { const v = $('[data-cf-ex-v="' + x.dataset.cfExN + '"]', d); if ((x.value || '').trim() || (v && v.value)) ex.push({nome:x.value.trim() || 'Campo extra', valor:v ? v.value : ''}); });
    if (ex.length) s.extras = ex;
    return {m, s};
  };
  let salvando = false;
  const dlg = modal(novo ? 'Guardar no cofre' : 'Editar · ' + esc(it.nome), corpo, [
    {txt:'Cancelar', cls:'sec'},
    {txt:novo ? 'Guardar' : 'Salvar', acao:d => {
      if (salvando) return false;
      const {m, s} = ler(d);
      if (!m.nome.trim()){ toast('Dê um nome para encontrar depois.'); return false; }
      if (!Object.keys(s).length){ toast('Preencha pelo menos um campo do que vai ficar guardado.'); return false; }
      salvando = true;
      (async () => {
        const sb = cfBanco();
        const r = novo ? await sb.rpc('cofre_criar', {p_meta:m, p_segredo:s}) : await sb.rpc('cofre_alterar', {p_id:it.id, p_meta:m, p_segredo:s});
        salvando = false;
        if (r.error){ toast('Não deu para guardar: ' + cfErro(r.error)); return; }
        d.close(); d.remove();
        await cfCarregar(); if (UI.modulo === 'cofre') rCofre();
        toast(novo ? 'Guardado no cofre.' : 'Atualizado no cofre.');
      })();
      return false; }}]);
  dlg.classList.add('cf-dlg');
  dlg.addEventListener('close', () => { $$('input, textarea', dlg).forEach(x => { x.value = ''; }); segAtual = null; extras = []; });   // não deixa o valor para trás
  dlg.addEventListener('change', e => { if (e.target.matches('[data-cf-m="tipo"]')){ const {s} = ler(dlg); segAtual = Object.assign({}, segAtual || {}, s); $('[data-cf-segs]', dlg).innerHTML = blocoSeg(e.target.value); } });
  dlg.addEventListener('click', e => {
    const v = e.target.closest('[data-cf-ver-in]'); if (v){ const i = v.parentElement.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; v.textContent = i.type === 'password' ? 'Mostrar' : 'Esconder'; return; }
    const g = e.target.closest('[data-cf-gerar]'); if (g){ const i = g.parentElement.querySelector('input'); i.value = cfSenhaForte(20); i.type = 'text'; const vv = g.parentElement.querySelector('[data-cf-ver-in]'); if (vv) vv.textContent = 'Esconder'; return; }
    if (e.target.closest('[data-cf-ex-mais]')){ const {s} = ler(dlg); extras = (s.extras || []).concat([{nome:'', valor:''}]); segAtual = Object.assign({}, segAtual || {}, s, {extras}); $('[data-cf-segs]', dlg).innerHTML = blocoSeg($('[data-cf-m="tipo"]', dlg).value); return; }
    const t = e.target.closest('[data-cf-ex-tirar]'); if (t){ const {s} = ler(dlg); extras = (s.extras || []).filter((_, n) => n !== +t.dataset.cfExTirar); segAtual = Object.assign({}, segAtual || {}, s, {extras}); $('[data-cf-segs]', dlg).innerHTML = blocoSeg($('[data-cf-m="tipo"]', dlg).value); }
  });
}

/* ---------- compartilhar (só o dono) ---------- */
async function cfCompartilhar(it){
  const sb = cfBanco();
  const {data, error} = await sb.rpc('cofre_pessoas', {p_id:it.id});
  if (error){ toast(cfErro(error)); return; }
  const pessoas = data || [], ac = () => CF.acessos.filter(a => a.item_id === it.id);
  const html = () => '<div class="cf-comp"><p class="sec">Quem você escolher vê o que está guardado (e, com "pode editar", troca a senha). Ninguém mais vê: nem o dono do espaço. Só pessoas do mesmo espaço aparecem aqui.</p>' +
    (ac().length ? '<ul class="cf-quem">' + ac().map(a => '<li><span>' + esc(cfNomePessoa(a.pessoa_id)) + '</span><select class="sel" data-cf-nivel="' + esc(a.pessoa_id) + '"><option value="ver"' + (a.nivel === 'ver' ? ' selected' : '') + '>Só vê</option><option value="editar"' + (a.nivel === 'editar' ? ' selected' : '') + '>Pode editar</option></select>' +
      '<button type="button" class="btn peq sec" data-cf-tirar="' + esc(a.pessoa_id) + '">Tirar acesso</button></li>').join('') + '</ul>' : '<p class="vazio-linha">Ainda só você vê.</p>') +
    '<div class="cf-add"><select class="sel" data-cf-nova><option value="">Escolher pessoa…</option>' + pessoas.filter(p => !ac().some(a => a.pessoa_id === p.id)).map(p => '<option value="' + esc(p.id) + '">' + esc(p.nome) + '</option>').join('') + '</select>' +
    '<select class="sel" data-cf-novo-nivel><option value="ver">Só vê</option><option value="editar">Pode editar</option></select><button type="button" class="btn peq" data-cf-dar>Dar acesso</button></div></div>';
  const dlg = modal('Compartilhar · ' + esc(it.nome), html(), [{txt:'Pronto'}]);
  const mudar = async (pessoa, nivel, msg) => {
    const {error} = await sb.rpc('cofre_compartilhar', {p_id:it.id, p_pessoa:pessoa, p_nivel:nivel});
    if (error){ toast(cfErro(error)); return; }
    await cfCarregar(); $('.modal-corpo', dlg).innerHTML = html(); if (UI.modulo === 'cofre') rCofre(); toast(msg);
  };
  dlg.addEventListener('click', e => {
    if (e.target.closest('[data-cf-dar]')){ const p = $('[data-cf-nova]', dlg).value; if (!p){ toast('Escolha a pessoa.'); return; } mudar(p, $('[data-cf-novo-nivel]', dlg).value, 'Acesso dado.'); return; }
    const t = e.target.closest('[data-cf-tirar]'); if (t) mudar(t.dataset.cfTirar, null, 'Acesso tirado.');
  });
  dlg.addEventListener('change', e => { const s = e.target.closest('[data-cf-nivel]'); if (s) mudar(s.dataset.cfNivel, s.value, 'Acesso mudado.'); });
}

/* ---------- histórico ---------- */
async function cfHistorico(it){
  const {data, error} = await cfBanco().from('cofre_registros').select('pessoa_id, acao, detalhe, em').eq('item_id', it.id).order('em', {ascending:false}).limit(200);
  if (error){ toast(cfErro(error)); return; }
  const nome = {criou:'guardou', revelou:'viu o valor', copiou:'copiou', alterou:'mudou os dados', alterou_segredo:'trocou o valor', compartilhou:'deu acesso a', tirou_acesso:'tirou o acesso de', lixeira:'mandou para a lixeira', restaurou:'trouxe de volta'};
  modal('Histórico · ' + esc(it.nome), (it.dono_id === cfEu() ? '' : '<p class="sec">Você vê só o que você mesmo fez neste item. O histórico completo é do dono.</p>') +
    ((data || []).length ? '<ul class="cf-hist">' + data.map(r => '<li><span class="cf-quando">' + esc(new Date(r.em).toLocaleString('pt-BR')) + '</span> <b>' + esc(cfNomePessoa(r.pessoa_id)) + '</b> ' + esc(nome[r.acao] || r.acao) + (r.detalhe ? ' ' + esc(r.detalhe) : '') + '</li>').join('') + '</ul>' : '<p class="vazio-linha">Nada registrado.</p>'),
    [{txt:'Fechar'}]);
}

/* ---------- lixeira ---------- */
async function cfLixeira(it, voltar){
  const {error} = await cfBanco().rpc('cofre_lixeira', {p_id:it.id, p_restaurar:!!voltar});
  if (error){ toast(cfErro(error)); return; }
  await cfCarregar(); if (UI.modulo === 'cofre') rCofre();
  toast(voltar ? 'Voltou da lixeira; quem tinha acesso volta a ver.' : 'Foi para a lixeira. Quem tinha acesso não vê mais; você ainda pode trazer de volta.');
}
function cfApagarDeVez(it){
  const dlg = modal('Apagar de vez · ' + esc(it.nome), '<p>O que está guardado sai do cofre e do Vault <b>para sempre</b>. Não tem como desfazer.</p><label class="lb">Para confirmar, escreva o nome do item<input class="campo" data-cf-conf autocomplete="off"></label>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Apagar de vez', acao:d => {
      if ($('[data-cf-conf]', d).value.trim() !== it.nome.trim()){ toast('O nome não confere.'); return false; }
      (async () => { const {error} = await cfBanco().rpc('cofre_apagar', {p_id:it.id}); if (error){ toast(cfErro(error)); return; }
        await cfCarregar(); if (UI.modulo === 'cofre') rCofre(); toast('Apagado de vez.'); })();
    }}]);
  void dlg;
}

/* ---------- ligações ---------- */
document.addEventListener('click', e => {
  if (UI.modulo !== 'cofre' || !e.target.closest('#m-cofre')) return;
  if (e.target.closest('[data-cf-novo]')){ cfForm(null, null); return; }
  const a = e.target.closest('[data-cf-abrir]'); if (a){ cfAbrir(a.dataset.cfAbrir); return; }
  const t = e.target.closest('[data-cf-tipo]'); if (t){ CF.tipo = t.dataset.cfTipo; rCofre(); }
});
document.addEventListener('input', e => { if (e.target.matches && e.target.matches('#m-cofre [data-cf-busca]')){ CF.busca = e.target.value; const pos = e.target.selectionStart; rCofre(); const b = $('#m-cofre [data-cf-busca]'); if (b){ b.focus(); b.setSelectionRange(pos, pos); } } });
document.addEventListener('change', e => { if (e.target.matches && e.target.matches('#m-cofre [data-cf-lixeira]')){ CF.lixeira = e.target.checked; rCofre(); } });
const _renderCf = render;
render = function(){ if (UI.modulo === 'cofre'){ rCofre(); return; } return _renderCf.apply(this, arguments); };
// ao vivo: alguém compartilhou com você, ou mudou um item seu (o aviso vem pelo canal pessoal, só com o id)
if (typeof avOuvir === 'function') avOuvir(['cofre_itens', 'cofre_acessos'], () => { if (!CF.lido) return; avQuandoLivre('cofre', async () => { await cfCarregar(); if (UI.modulo === 'cofre') rCofre(); }); });
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {CF, rCofre, cfCarregar, cfAbrir, cfForm, cfSenhaForte, cfCompartilhar});
