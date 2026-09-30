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
const IFR_AUTO = {no:null, repos:[], bancos:[], pedidos:[], carregado:false, atualizando:null};

// os nós cujos repositórios alimentam este ponto: a aplicação, só ela; o produto e as aplicações dele; o projeto e as aplicações soltas nele
function ifrNosDoCodigo(sel){
  const id = ifrNoDe(sel), eProd = /^product:/.test(sel || '');
  if (/^app:/.test(sel || '')) return [id];
  return [id].concat(D.apps.filter(a => eProd ? a.product === id : (a.project === id && !a.product)).map(a => a.id));
}
async function ifrAutoCarregar(){
  const sb = ifrBanco(), no = IFR.no;
  IFR_AUTO.no = no;
  if (!sb){ IFR_AUTO.repos = []; IFR_AUTO.bancos = []; IFR_AUTO.pedidos = []; IFR_AUTO.carregado = true; return; }
  const nos = ifrNosDoCodigo(UI.sel);
  const [rp, bc, pd] = await Promise.all([
    sb.from('repositorios').select('id, no_id, provedor, nome, branch_principal, ativo').in('no_id', nos),
    sb.from('infra_bancos').select('id, no_id, nome, provedor, motor, esquemas, servidor, ativo, ultima_leitura_em, ultima_mudanca_em, ultimo_erro').eq('no_id', no),
    sb.from('infra_automacoes').select('id, origem, status, referencia, criado_em, concluido_em, erro, resumo, diagramas').eq('no_id', no).order('criado_em', {ascending:false}).limit(5)
  ]);
  if (IFR_AUTO.no !== no) return;
  IFR_AUTO.repos = (rp.data || []).filter(r => nos.includes(r.no_id) && r.ativo !== false);
  IFR_AUTO.bancos = (bc.data || []).filter(b => b.no_id === no).sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
  IFR_AUTO.pedidos = (pd.data || []).filter(p => !p.no_id || p.no_id === no).sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
  IFR_AUTO.carregado = true;
}
const ifrQuando = ts => { if (!ts) return ''; const m = Math.round((Date.now() - new Date(ts).getTime()) / 60000); if (m < 1) return 'agora'; if (m < 60) return 'há ' + m + ' min'; const h = Math.round(m / 60); if (h < 24) return 'há ' + h + ' h'; const d = Math.round(h / 24); return d === 1 ? 'ontem' : 'há ' + d + ' dias'; };
const IFR_ORIGEM = {github:'publicação em produção', gitlab:'publicação em produção', banco:'mudança no banco', manual:'Atualizar agora'};
const IFR_STATUS = {pendente:'na fila', rodando:'montando agora', pronto:'pronto', erro:'com erro'};

function ifrAutoHTML(){
  const pode = podeEditar(), fonte = IFR_AUTO_FONTE[IFR.aba], repos = IFR_AUTO.repos, ult = IFR_AUTO.pedidos[0];
  const eProd = /^product:/.test(UI.sel || '');
  let h = '<section class="ifr-auto" aria-label="Desenhos automáticos"><div class="ifr-auto-cab"><h3>Automático</h3>' +
    (pode ? '<button type="button" class="btn sec peq" data-ifr-atualizar' + (IFR_AUTO.atualizando ? ' disabled' : '') + '>' + (IFR_AUTO.atualizando ? 'Atualizando…' : 'Atualizar agora') + '</button>' : '') + '</div>';
  h += '<p class="ifr-auto-como">' + (fonte === 'codigo' ? 'Esta parte sai <b>sozinha do código</b> a cada publicação em produção no GitHub. O DevIT completa o que precisa de interpretação.'
    : fonte === 'banco' ? 'Esta parte sai <b>sozinha do banco de dados</b> ligado (e do Prisma, no código): quando a estrutura muda, o desenho é refeito.'
    : 'Esta parte depende de interpretação: é feita pelo <b>DevIT</b>, que usa os desenhos automáticos como evidência.') + '</p>';
  h += '<div class="ifr-auto-bloco"><b>Código (GitHub e GitLab)</b>' + (repos.length
    ? '<ul class="ifr-auto-lista">' + repos.map(r => '<li><span>' + esc(r.nome) + '</span><small>' + esc((r.provedor === 'gitlab' ? 'GitLab' : 'GitHub') + ' · branch ' + (r.branch_principal || 'main')) + '</small>' +
        (pode ? '<span class="ifr-repo-b"><button type="button" class="ifr-lnk" data-ifr-repo-trocar="' + r.id + '">Trocar</button><button type="button" class="ifr-lnk" data-ifr-repo-tirar="' + r.id + '">Desligar</button></span>' : '') + '</li>').join('') + '</ul>'
    : '<p class="ifr-vazio">Nenhum repositório ligado ' + (/^app:/.test(UI.sel || '') ? 'a esta aplicação' : eProd ? 'a este produto' : 'direto neste projeto') + '.</p>') +
    (pode ? '<button type="button" class="ifr-lnk" data-ifr-repo>' + (repos.length ? 'Ligar outro repositório' : 'Ligar repositório') + '</button>' : '') + '</div>';
  const bs = IFR_AUTO.bancos, qual = x => (IFR_PROV[x.provedor] || 'Outro') + ' · ' + (x.motor === 'mysql' ? 'MySQL' : 'PostgreSQL');
  h += '<div class="ifr-auto-bloco"><b>Bancos de dados</b>' + (bs.length
    ? '<ul class="ifr-auto-lista">' + bs.map(x => '<li><span>' + esc(x.nome) + '</span><small>' + esc(qual(x) + ' · ' + (x.motor === 'mysql' ? 'bancos ' : 'esquemas ') + (x.esquemas || []).join(', ') + (x.servidor ? ' · ' + x.servidor : '')) + '</small>' +
        '<small class="ifr-meta">' + (x.ultima_leitura_em ? 'Lido ' + esc(ifrQuando(x.ultima_leitura_em)) : 'Ainda não lido') + (x.ultima_mudanca_em ? ' · estrutura mudou ' + esc(ifrQuando(x.ultima_mudanca_em)) : '') + (x.ativo ? '' : ' · desligado') + '</small>' +
        (x.ultimo_erro ? '<small class="ifr-auto-erro">' + esc(x.ultimo_erro) + '</small>' : '') +
        (pode ? '<span class="ifr-repo-b"><button type="button" class="ifr-lnk" data-ifr-banco="' + x.id + '">Trocar</button><button type="button" class="ifr-lnk" data-ifr-banco-tirar="' + x.id + '">Desligar</button></span>' : '') + '</li>').join('') + '</ul>'
    : '<p class="ifr-vazio">' + (pode ? 'Nenhum banco ligado.' : 'Só quem pode editar vê os bancos ligados.') + '</p>') +
    (pode ? '<button type="button" class="ifr-lnk" data-ifr-banco="">' + (bs.length ? 'Ligar outro banco' : 'Ligar banco') + '</button>' : '') + '</div>';
  if (ult){
    const res = (ult.resumo || []).map(x => x.erro ? (x.repositorio || 'banco') + ': ' + x.erro : x.aviso ? (x.repositorio ? x.repositorio + ': ' : '') + x.aviso : '').filter(Boolean);
    h += '<div class="ifr-auto-bloco"><b>Última atualização</b><p class="ifr-auto-linha ifr-st-' + esc(ult.status) + '">' + esc(IFR_STATUS[ult.status] || ult.status) + ' · ' + esc(IFR_ORIGEM[ult.origem] || ult.origem) + (ult.referencia && (ult.origem === 'github' || ult.origem === 'gitlab') ? ' · commit ' + esc(String(ult.referencia).slice(0, 7)) : '') + '</p><p class="ifr-meta">' + esc(ifrQuando(ult.concluido_em || ult.criado_em)) + ((ult.diagramas || []).length ? ' · ' + ult.diagramas.length + (ult.diagramas.length === 1 ? ' desenho' : ' desenhos') : '') + '</p>' +
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

/* ---------- ligar os bancos de dados do sistema (só leitura): Supabase, AWS (RDS e Aurora) ou outro ---------- */
const IFR_PROV = {supabase:'Supabase', aws:'AWS', outro:'Outro'};
const IFR_GUIA = {
  supabase: '<ol class="ifr-guia"><li>No Supabase do sistema, abra o <b>SQL Editor</b> e crie um usuário que só lê (troque a senha):<pre class="ifr-pre">create role leitura_ciclodev login password \'troque-esta-senha\';\ngrant usage on schema public to leitura_ciclodev;</pre></li>' +
    '<li>Clique em <b>Connect</b> (no alto do painel do projeto) e copie a <b>Connection string</b> do tipo <b>Session pooler</b>.</li>' +
    '<li>Cole abaixo e troque o usuário <code>postgres.xxxx</code> por <code>leitura_ciclodev.xxxx</code> (o mesmo xxxx) e a senha pela do passo 1.</li></ol>',
  aws: '<ol class="ifr-guia"><li>No console da AWS, abra <b>RDS</b>, <b>Databases</b>, clique no banco e copie o <b>Endpoint</b> e a <b>Port</b> (aba Connectivity &amp; security).</li>' +
    '<li>Confira que o banco aceita conexão de fora: <b>Publicly accessible</b> = Yes e o <b>security group</b> com entrada na porta liberada. O CicloDev lê pela internet, com SSL.</li>' +
    '<li>Crie um usuário que só lê. PostgreSQL:<pre class="ifr-pre">create user leitura_ciclodev with password \'troque-esta-senha\';\ngrant connect on database NOME_DO_BANCO to leitura_ciclodev;\ngrant usage on schema public to leitura_ciclodev;</pre>MySQL:<pre class="ifr-pre">create user \'leitura_ciclodev\'@\'%\' identified by \'troque-esta-senha\';\ngrant select, show view on NOME_DO_BANCO.* to \'leitura_ciclodev\'@\'%\';</pre></li>' +
    '<li>Preencha os campos abaixo.</li></ol>',
  outro: '<ol class="ifr-guia"><li>Crie um usuário que só lê no banco.</li><li>Cole o endereço de conexão: <code>postgresql://usuario:senha@servidor:5432/banco</code> ou <code>mysql://usuario:senha@servidor:3306/banco</code>.</li></ol>'
};
function ifrBancoModal(id){
  const b = id ? IFR_AUTO.bancos.find(x => x.id === id) : null;
  let prov = b ? b.provedor : 'supabase', motor = b ? b.motor : 'postgres';
  const dlg = modal(b ? 'Trocar o banco ' + esc(b.nome) : 'Ligar um banco de dados', '<div class="ifr-ed" id="ifr-b-corpo"></div>', [{txt:'Cancelar', cls:'sec'}, {txt:'Salvar', acao:dl => {
    const sb = ifrBanco(); if (!sb){ toast('Precisa do banco do CicloDev ligado.'); return false; }
    let url = ($('#ifr-b-url', dl) || {}).value ? $('#ifr-b-url', dl).value.trim() : '';
    if (prov === 'aws'){
      const host = $('#ifr-b-host', dl).value.trim(), porta = $('#ifr-b-porta', dl).value.trim(), base = $('#ifr-b-base', dl).value.trim(), usu = $('#ifr-b-usu', dl).value.trim(), senha = $('#ifr-b-senha', dl).value;
      if (host || usu || senha){
        if (!host || !base || !usu || !senha){ toast('Preencha endpoint, banco, usuário e senha.'); return false; }
        url = (motor === 'mysql' ? 'mysql://' : 'postgresql://') + encodeURIComponent(usu) + ':' + encodeURIComponent(senha) + '@' + host + ':' + (porta || (motor === 'mysql' ? '3306' : '5432')) + '/' + encodeURIComponent(base) + (motor === 'postgres' ? '?sslmode=require' : '');
      }
    }
    if (!b && !url){ toast(prov === 'aws' ? 'Preencha os dados de conexão.' : 'Cole o endereço de conexão.'); return false; }
    if (url && motor === 'postgres' && !/^postgres(ql)?:\/\//.test(url)){ toast('O endereço precisa começar com postgresql://'); return false; }
    if (url && motor === 'mysql' && !/^mysql:\/\//.test(url)){ toast('O endereço precisa começar com mysql://'); return false; }
    const esq = $('#ifr-b-esq', dl).value.split(',').map(s => s.trim()).filter(Boolean);
    if (!esq.length){ toast(motor === 'mysql' ? 'Diga qual banco (database) ler.' : 'Diga quais esquemas ler.'); return false; }
    const args = {p_no:IFR.no, p_id:b ? b.id : null, p_nome:$('#ifr-b-nome', dl).value.trim(), p_provedor:prov, p_motor:motor, p_esquemas:esq, p_conexao:url || null, p_ativo:true};
    sb.rpc('infra_banco_salvar', args).then(async ({error}) => {
      if (error){ toast('Não deu para salvar o banco: ' + (error.message || error)); return; }
      await ifrAutoCarregar(); ifrLado();
      toast('Banco salvo. Em alguns minutos o DER' + (motor === 'postgres' ? ' e o mapa de acesso aparecem nas sub-abas DER e Segurança.' : ' aparece na sub-aba DER.'));
    });
  }}]);
  const pintar = () => {
    const c = $('#ifr-b-corpo', dlg); if (!c) return;
    const nome = ($('#ifr-b-nome', c) || {}).value, esq = ($('#ifr-b-esq', c) || {}).value;
    c.innerHTML = '<p class="ifr-meta" style="margin:0">O DER' + (motor === 'postgres' ? ' e o mapa de acesso passam' : ' passa') + ' a sair sozinho' + (motor === 'postgres' ? 's' : '') + ' deste banco. O robô só lê a estrutura (tabelas, colunas, chaves' + (motor === 'postgres' ? ', RLS e permissões' : '') + '), nunca os dados, e a conexão abre em modo somente leitura. Dá para ligar vários bancos no mesmo lugar.</p>' +
      '<div class="ifr-prov" role="radiogroup" aria-label="Onde o banco está">' + Object.entries(IFR_PROV).map(([k, n]) => '<label class="ifr-prov-op' + (prov === k ? ' sel' : '') + '"><input type="radio" name="ifr-b-prov" value="' + k + '"' + (prov === k ? ' checked' : '') + '> ' + n + '</label>').join('') + '</div>' +
      (prov !== 'supabase' ? '<label class="lb">Motor<select class="sel" id="ifr-b-motor"><option value="postgres"' + (motor === 'postgres' ? ' selected' : '') + '>PostgreSQL (RDS, Aurora PostgreSQL)</option><option value="mysql"' + (motor === 'mysql' ? ' selected' : '') + '>MySQL (RDS, Aurora MySQL)</option></select></label>' : '') +
      IFR_GUIA[prov] +
      '<div class="ifr-ed-linha"><label class="lb">Nome<input class="campo" id="ifr-b-nome" value="' + esc(nome != null ? nome : b ? b.nome : 'Banco de produção') + '"></label>' +
      '<label class="lb">' + (motor === 'mysql' ? 'Bancos (databases)' : 'Esquemas') + '<input class="campo" id="ifr-b-esq" value="' + esc(esq != null ? esq : b ? (b.esquemas || []).join(', ') : motor === 'mysql' ? '' : 'public') + '" placeholder="' + (motor === 'mysql' ? 'nome_do_banco' : 'public') + '"></label></div>' +
      (prov === 'aws'
        ? '<div class="ifr-ed-linha"><label class="lb">Endpoint<input class="campo" id="ifr-b-host" autocomplete="off" spellcheck="false" placeholder="meu-banco.abc123.us-east-1.rds.amazonaws.com"></label><label class="lb">Porta<input class="campo" id="ifr-b-porta" inputmode="numeric" placeholder="' + (motor === 'mysql' ? '3306' : '5432') + '"></label></div>' +
          '<div class="ifr-ed-linha"><label class="lb">Banco (database)<input class="campo" id="ifr-b-base" autocomplete="off" spellcheck="false" placeholder="' + (motor === 'mysql' ? 'nome_do_banco' : 'postgres') + '"></label><label class="lb">Usuário<input class="campo" id="ifr-b-usu" autocomplete="off" spellcheck="false" value="leitura_ciclodev"></label>' +
          '<label class="lb">Senha<input class="campo gc-oculto" id="ifr-b-senha" type="text" autocomplete="off" spellcheck="false" data-lpignore="true" data-1p-ignore></label></div>' + (b ? '<p class="ifr-meta">Deixe os campos de conexão vazios para manter os atuais.</p>' : '')
        : '<label class="lb">Endereço de conexão' + (b ? ' (deixe vazio para manter o atual)' : '') + '<input class="campo gc-oculto" id="ifr-b-url" type="text" autocomplete="off" spellcheck="false" data-lpignore="true" data-1p-ignore placeholder="' + (prov === 'supabase' ? 'postgresql://leitura_ciclodev.xxxx:senha@aws-0-sa-east-1.pooler.supabase.com:5432/postgres' : motor === 'mysql' ? 'mysql://usuario:senha@servidor:3306/banco' : 'postgresql://usuario:senha@servidor:5432/banco') + '"></label>') +
      '<p class="ifr-meta">O endereço e a senha ficam numa área do banco do CicloDev que nenhuma tela lê; só o robô usa. Ninguém consegue ver a senha depois de salvar.</p>';
  };
  dlg.addEventListener('change', e => {
    if (e.target.name === 'ifr-b-prov'){ prov = e.target.value; if (prov === 'supabase') motor = 'postgres'; pintar(); }
    else if (e.target.id === 'ifr-b-motor'){ motor = e.target.value; pintar(); }
  });
  pintar();
}
function ifrBancoTirar(id){
  const b = IFR_AUTO.bancos.find(x => x.id === id); if (!b) return;
  modal('Desligar o banco ' + esc(b.nome), '<p style="margin:0">O robô para de ler este banco e o endereço guardado é apagado. Os desenhos que já saíram continuam; os outros bancos seguem ligados.</p>', [{txt:'Cancelar', cls:'sec'}, {txt:'Desligar', cls:'perigo', acao:() => {
    ifrBanco().rpc('infra_banco_remover', {p_id:id}).then(async ({error}) => {
      if (error){ toast('Não deu para desligar: ' + (error.message || error)); return; }
      await ifrAutoCarregar(); ifrLado(); toast('Banco ' + b.nome + ' desligado.');
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
  { const bb = e.target.closest('[data-ifr-banco]'); if (bb) return ifrBancoModal(bb.dataset.ifrBanco || null); }
  { const bt = e.target.closest('[data-ifr-banco-tirar]'); if (bt) return ifrBancoTirar(bt.dataset.ifrBancoTirar); }
  if (e.target.closest('[data-ifr-repo]')){ if (typeof gcLigarRepo === 'function') gcLigarRepo(); return; }
  let rb = e.target.closest('[data-ifr-repo-tirar]'); if (rb){ gcDesligarRepo(rb.dataset.ifrRepoTirar); return; }
  rb = e.target.closest('[data-ifr-repo-trocar]'); if (rb){ gcDesligarRepo(rb.dataset.ifrRepoTrocar, true); return; }
  const q = e.target.closest('[data-ifr-quadro]'); if (q){ const dl = q.closest('dialog'); if (dl){ dl.close(); dl.remove(); } ifrAbrirQuadro(q.dataset.ifrQuadro); }
});
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {IFR_AUTO, ifrAutoCarregar, ifrAutoAtualizar, ifrAbrirQuadro, ifrLado});
