/* ===== Infraestrutura automática (parte 30 do banco, função diagramas-auto) =====
   Os desenhos que saem sozinhos, sem IA:
   - do código: a cada publicação em produção de um repositório do GitHub ligado a este produto (cada produto tem os dele;
     o projeto tem os que estão ligados direto nele), o robô baixa o código daquele commit e refaz Software, Infraestrutura
     e o mapa de telas (Fluxos de Usuário); com Prisma, também o DER;
   - do banco: o produto liga o banco de dados do sistema (só leitura) e o DER e o mapa de acesso (Segurança) são refeitos
     sempre que a estrutura muda (o robô olha de hora em hora).
   Todo desenho (do robô e do DevIT) aparece como um quadro do canvas, montado com os cards, grupos e ligações dele.
   Aqui ficam a seção "Automático" do lado, ligar o banco, "Atualizar agora" e abrir o quadro de um desenho. */
const IFR_AUTO_FONTE = {software:'codigo', infra:'codigo', ux:'codigo', der:'banco', seguranca:'banco'};
const IFR_AUTO = {no:null, repos:[], banco:null, pedidos:[], carregado:false, atualizando:null};

// os nós cujos repositórios alimentam este projeto ou produto (o produto e as aplicações dele; o projeto e as aplicações soltas nele)
function ifrNosDoCodigo(sel){
  const id = ifrNoDe(sel), eProd = /^product:/.test(sel || '');
  return [id].concat(D.apps.filter(a => eProd ? a.product === id : (a.project === id && !a.product)).map(a => a.id));
}
async function ifrAutoCarregar(){
  const sb = ifrBanco(), no = IFR.no;
  IFR_AUTO.no = no;
  if (!sb){ IFR_AUTO.repos = []; IFR_AUTO.banco = null; IFR_AUTO.pedidos = []; IFR_AUTO.carregado = true; return; }
  const nos = ifrNosDoCodigo(UI.sel);
  const [rp, bc, pd] = await Promise.all([
    sb.from('repositorios').select('id, no_id, provedor, nome, branch_principal, ativo').in('no_id', nos),
    sb.from('infra_bancos').select('*').eq('no_id', no),
    sb.from('infra_automacoes').select('id, origem, status, referencia, criado_em, concluido_em, erro, resumo, diagramas').eq('no_id', no).order('criado_em', {ascending:false}).limit(5)
  ]);
  if (IFR_AUTO.no !== no) return;
  IFR_AUTO.repos = (rp.data || []).filter(r => nos.includes(r.no_id) && r.ativo !== false);
  IFR_AUTO.banco = (bc.data || []).find(b => b.no_id === no) || null;
  IFR_AUTO.pedidos = (pd.data || []).filter(p => !p.no_id || p.no_id === no).sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
  IFR_AUTO.carregado = true;
}
const ifrQuando = ts => { if (!ts) return ''; const m = Math.round((Date.now() - new Date(ts).getTime()) / 60000); if (m < 1) return 'agora'; if (m < 60) return 'há ' + m + ' min'; const h = Math.round(m / 60); if (h < 24) return 'há ' + h + ' h'; const d = Math.round(h / 24); return d === 1 ? 'ontem' : 'há ' + d + ' dias'; };
const IFR_ORIGEM = {github:'publicação em produção', banco:'mudança no banco', manual:'Atualizar agora'};
const IFR_STATUS = {pendente:'na fila', rodando:'montando agora', pronto:'pronto', erro:'com erro'};

function ifrAutoHTML(){
  const pode = podeEditar(), fonte = IFR_AUTO_FONTE[IFR.aba], repos = IFR_AUTO.repos, b = IFR_AUTO.banco, ult = IFR_AUTO.pedidos[0];
  const eProd = /^product:/.test(UI.sel || '');
  let h = '<section class="ifr-auto" aria-label="Desenhos automáticos"><div class="ifr-auto-cab"><h3>Automático</h3>' +
    (pode ? '<button type="button" class="btn sec peq" data-ifr-atualizar' + (IFR_AUTO.atualizando ? ' disabled' : '') + '>' + (IFR_AUTO.atualizando ? 'Atualizando…' : 'Atualizar agora') + '</button>' : '') + '</div>';
  h += '<p class="ifr-auto-como">' + (fonte === 'codigo' ? 'Esta parte sai <b>sozinha do código</b> a cada publicação em produção no GitHub. O DevIT completa o que precisa de interpretação.'
    : fonte === 'banco' ? 'Esta parte sai <b>sozinha do banco de dados</b> ligado (e do Prisma, no código): quando a estrutura muda, o desenho é refeito.'
    : 'Esta parte depende de interpretação: é feita pelo <b>DevIT</b>, que usa os desenhos automáticos como evidência.') + '</p>';
  h += '<div class="ifr-auto-bloco"><b>Código (GitHub)</b>' + (repos.length
    ? '<ul class="ifr-auto-lista">' + repos.map(r => '<li><span>' + esc(r.nome) + '</span><small>' + esc(r.provedor === 'github' ? 'branch ' + (r.branch_principal || 'main') : 'GitLab: ainda não é lido') + '</small></li>').join('') + '</ul>'
    : '<p class="ifr-vazio">Nenhum repositório ligado ' + (eProd ? 'a este produto' : 'direto neste projeto') + '.</p>') +
    (pode ? '<button type="button" class="ifr-lnk" data-ifr-repo>' + (repos.length ? 'Ligar outro repositório' : 'Ligar repositório') + '</button>' : '') + '</div>';
  h += '<div class="ifr-auto-bloco"><b>Banco de dados</b>' + (b
    ? '<p class="ifr-auto-linha">' + esc(b.nome) + ' · esquemas ' + esc((b.esquemas || []).join(', ')) + '</p><p class="ifr-meta">' + (b.ultima_leitura_em ? 'Lido ' + esc(ifrQuando(b.ultima_leitura_em)) : 'Ainda não lido') + (b.ultima_mudanca_em ? ' · estrutura mudou ' + esc(ifrQuando(b.ultima_mudanca_em)) : '') + (b.ativo ? '' : ' · desligado') + '</p>' + (b.ultimo_erro ? '<p class="ifr-auto-erro">' + esc(b.ultimo_erro) + '</p>' : '')
    : '<p class="ifr-vazio">' + (pode ? 'Nenhum banco ligado.' : 'Só quem pode editar vê o banco ligado.') + '</p>') +
    (pode ? '<div class="ifr-auto-acoes"><button type="button" class="ifr-lnk" data-ifr-banco>' + (b ? 'Trocar' : 'Ligar banco') + '</button>' + (b ? '<button type="button" class="ifr-lnk" data-ifr-banco-tirar>Desligar</button>' : '') + '</div>' : '') + '</div>';
  if (ult){
    const res = (ult.resumo || []).map(x => x.erro ? (x.repositorio || 'banco') + ': ' + x.erro : x.aviso ? (x.repositorio ? x.repositorio + ': ' : '') + x.aviso : '').filter(Boolean);
    h += '<div class="ifr-auto-bloco"><b>Última atualização</b><p class="ifr-auto-linha ifr-st-' + esc(ult.status) + '">' + esc(IFR_STATUS[ult.status] || ult.status) + ' · ' + esc(IFR_ORIGEM[ult.origem] || ult.origem) + (ult.referencia && ult.origem === 'github' ? ' · commit ' + esc(String(ult.referencia).slice(0, 7)) : '') + '</p><p class="ifr-meta">' + esc(ifrQuando(ult.concluido_em || ult.criado_em)) + ((ult.diagramas || []).length ? ' · ' + ult.diagramas.length + (ult.diagramas.length === 1 ? ' desenho' : ' desenhos') : '') + '</p>' +
      (ult.erro ? '<p class="ifr-auto-erro">' + esc(ult.erro) + '</p>' : '') + (res.length && !ult.erro ? '<ul class="ifr-auto-avisos">' + res.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') + '</div>';
  }
  return h + '</section>';
}
const _ifrLadoBase = ifrLado;
ifrLado = function(){
  _ifrLadoBase();
  const el = $('#ops-corpo [data-ifr-lado]'); if (!el) return;
  if (IFR_AUTO.no !== IFR.no){ IFR_AUTO.carregado = false; ifrAutoCarregar().then(() => { if (UI.view === 'infra') ifrLado(); }); }
  el.insertAdjacentHTML('afterbegin', IFR_AUTO.carregado ? ifrAutoHTML() : '<section class="ifr-auto"><p class="vazio-linha">Lendo os desenhos automáticos…</p></section>');
};

/* ---------- "Atualizar agora" ---------- */
async function ifrAutoAtualizar(){
  const sb = ifrBanco(); if (!sb){ toast('Os desenhos automáticos precisam do banco ligado.'); return; }
  if (IFR_AUTO.atualizando) return;
  const no = IFR.no;
  const {data, error} = await sb.rpc('infra_auto_pedir', {p_no:no});
  if (error){ toast('Não deu para pedir: ' + (error.message || error)); return; }
  const id = (Array.isArray(data) ? data[0] : data || {}).id;
  IFR_AUTO.atualizando = id || true; ifrLado();
  toast('O robô está baixando o código e lendo o banco. Pode seguir usando o sistema; aviso quando terminar.');
  const t0 = Date.now(); let p = null;
  while (id && Date.now() - t0 < 8 * 60000){
    await new Promise(ok => setTimeout(ok, 5000));
    const r = await sb.from('infra_automacoes').select('id, status, erro, diagramas, resumo, origem, referencia, criado_em, concluido_em').eq('id', id);
    p = (r.data || []).find(x => x.id === id) || null;
    if (p && (p.status === 'pronto' || p.status === 'erro')) break;
  }
  IFR_AUTO.atualizando = null;
  if (IFR.no === no){ await Promise.all([ifrAutoCarregar(), ifrCarregar()]); await ifrAtualizarRemoto(); ifrLado(); ifrAvisarCanvas(); }
  if (!p || (p.status !== 'pronto' && p.status !== 'erro')) toast('O robô ainda está trabalhando. Os desenhos aparecem aqui quando ele terminar.');
  else if (p.status === 'erro') toast('Não deu para atualizar: ' + (p.erro || 'erro sem detalhe'));
  else toast((p.diagramas || []).length ? 'Pronto: ' + p.diagramas.length + (p.diagramas.length === 1 ? ' desenho atualizado' : ' desenhos atualizados') + ' (cada um no seu quadro).' : 'Pronto, mas não havia código nem banco para desenhar.' + (p.erro ? ' ' + p.erro : ''));
}

/* ---------- ligar o banco de dados do sistema (só leitura) ---------- */
function ifrBancoModal(){
  const b = IFR_AUTO.banco;
  const corpo = '<div class="ifr-ed"><p class="ifr-meta" style="margin:0">O DER e o mapa de acesso passam a sair sozinhos do banco deste ' + (/^product:/.test(UI.sel) ? 'produto' : 'projeto') + '. O robô só lê a estrutura (tabelas, colunas, chaves, RLS e permissões), nunca os dados, e a conexão abre em modo somente leitura.</p>' +
    '<div class="ifr-ed-linha"><label class="lb">Nome<input class="campo" id="ifr-b-nome" value="' + esc(b ? b.nome : 'Banco de produção') + '"></label>' +
    '<label class="lb">Esquemas<input class="campo" id="ifr-b-esq" value="' + esc(b ? (b.esquemas || []).join(', ') : 'public') + '"></label></div>' +
    '<label class="lb">Endereço de conexão' + (b ? ' (deixe vazio para manter o atual)' : '') + '<input class="campo" id="ifr-b-url" type="password" autocomplete="off" spellcheck="false" placeholder="postgresql://usuario_leitura:senha@servidor:5432/postgres"></label>' +
    '<p class="ifr-meta">Use um usuário que só lê. No Supabase do sistema, rode no SQL Editor (troque a senha):</p>' +
    '<pre class="ifr-pre">create role leitura_ciclodev login password \'troque-esta-senha\';\ngrant usage on schema public to leitura_ciclodev;</pre>' +
    '<p class="ifr-meta">O endereço fica guardado numa área do banco do CicloDev que nenhuma tela lê; só o robô usa. Ninguém consegue ver a senha depois de salvar.</p></div>';
  // a conferência é na hora (a janela fica aberta se faltar algo); a gravação segue depois de fechar
  modal(b ? 'Trocar o banco ligado' : 'Ligar o banco de dados', corpo, [{txt:'Cancelar', cls:'sec'}, {txt:'Salvar', acao:dl => {
    const sb = ifrBanco(); if (!sb){ toast('Precisa do banco do CicloDev ligado.'); return false; }
    const url = $('#ifr-b-url', dl).value.trim();
    if (!b && !url){ toast('Cole o endereço de conexão.'); return false; }
    if (url && !/^postgres(ql)?:\/\//.test(url)){ toast('O endereço precisa começar com postgresql://'); return false; }
    const args = {p_no:IFR.no, p_nome:$('#ifr-b-nome', dl).value.trim(), p_esquemas:$('#ifr-b-esq', dl).value.split(',').map(s => s.trim()).filter(Boolean), p_conexao:url || null, p_ativo:true};
    sb.rpc('infra_banco_definir', args).then(async ({error}) => {
      if (error){ toast('Não deu para salvar o banco: ' + (error.message || error)); return; }
      await ifrAutoCarregar(); ifrLado();
      toast('Banco ligado. Em alguns minutos o DER e o mapa de acesso aparecem nas sub-abas DER e Segurança.');
    });
  }}]);
}
function ifrBancoTirar(){
  modal('Desligar o banco', '<p style="margin:0">O robô para de ler este banco e o endereço guardado é apagado. Os desenhos que já saíram continuam.</p>', [{txt:'Cancelar', cls:'sec'}, {txt:'Desligar', cls:'perigo', acao:() => {
    ifrBanco().rpc('infra_banco_remover', {p_no:IFR.no}).then(async ({error}) => {
      if (error){ toast('Não deu para desligar: ' + (error.message || error)); return; }
      await ifrAutoCarregar(); ifrLado(); toast('Banco desligado.');
    });
  }}]);
}

/* ---------- abrir o quadro de um desenho no canvas ---------- */
function ifrAbrirQuadro(caminho){
  if (!caminho) return;
  const id = String(caminho).split('/')[1];
  if (!IFR.docs[caminho]){ ifrAtualizarRemoto().then(() => ifrFalar({tipo:'abrir-quadro', dados:{id}})); return; }
  ifrFalar({tipo:'abrir-quadro', dados:{id}});
  const c = $('#ops-corpo .ifr-canvas'); if (c && c.scrollIntoView) c.scrollIntoView({block:'nearest'});
}

document.addEventListener('click', e => {
  if (!e.target.closest('#ops-corpo .ifr-tela') && !e.target.closest('dialog.ifr-modal')) return;
  if (e.target.closest('[data-ifr-atualizar]')) return ifrAutoAtualizar();
  if (e.target.closest('[data-ifr-banco]')) return ifrBancoModal();
  if (e.target.closest('[data-ifr-banco-tirar]')) return ifrBancoTirar();
  if (e.target.closest('[data-ifr-repo]')){ if (typeof enNovoRepo === 'function') enNovoRepo(); return; }
  const q = e.target.closest('[data-ifr-quadro]'); if (q){ const dl = q.closest('dialog'); if (dl){ dl.close(); dl.remove(); } ifrAbrirQuadro(q.dataset.ifrQuadro); }
});
// um repositório ligado pela janela de repositórios aparece aqui sem recarregar
if (typeof enInserir === 'function'){ const _enInserirIfr = enInserir; enInserir = async function(tabela){ const r = await _enInserirIfr.apply(this, arguments); if (tabela === 'repositorios' && UI.view === 'infra'){ await ifrAutoCarregar(); ifrLado(); } return r; }; }
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {IFR_AUTO, ifrAutoCarregar, ifrAutoAtualizar, ifrAbrirQuadro, ifrLado});
