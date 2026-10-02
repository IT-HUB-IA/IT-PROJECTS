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
    sb.from('infra_bancos').select('id, no_id, nome, provedor, motor, esquemas, servidor, ativo, ultima_leitura_em, ultima_mudanca_em, ultimo_erro, conexao_trocada_em, supa_conexao_id, supa_projeto, validado_em, validacao').eq('no_id', no),
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

// erro técnico do banco em português, com o que fazer (o texto original fica embaixo, pequeno)
function ifrErroAmigavel(m){
  const t = String(m || '').toLowerCase();
  if (/autorização do supabase|conecte de novo/.test(t)) return 'A autorização do Supabase foi tirada ou venceu. Clique em Trocar e conecte de novo ao Supabase.';
  if (/não está em modo só leitura/.test(t)) return 'A leitura não estava em modo só leitura: por segurança, o CicloDev não leu.';
  if (/password authentication|access denied/.test(t)) return 'A senha do usuário do CicloDev não confere. Crie uma senha nova (só letras e números) e use Trocar.';
  if (/tenant or user not found/.test(t)) return 'Falta o código do projeto no usuário: o certo é leitura_ciclodev.codigodoprojeto.';
  if (/timeout|timed out|etimedout|econnrefused|enotfound|getaddrinfo|could not connect|connection refused/.test(t)) return 'O CicloDev não conseguiu alcançar o banco pela internet.';
  if (/permission denied/.test(t)) return 'O usuário do CicloDev não tem permissão para ler a estrutura.';
  if (/does not exist|não existe/.test(t)) return 'O banco ou o esquema informado não existe.';
  return 'Não deu para ler o banco.';
}
const ifrSelo = (tipo, txt) => '<span class="ifr-selo ifr-selo-' + tipo + '">' + esc(txt) + '</span>';
function ifrAutoHTML(){
  const pode = podeEditar(), fonte = IFR_AUTO_FONTE[IFR.aba], repos = IFR_AUTO.repos, bs = IFR_AUTO.bancos, ult = IFR_AUTO.pedidos[0];
  const eProd = /^product:/.test(UI.sel || '');
  const resumo = (ult && ult.resumo) || [];
  const erroRepo = nome => (resumo.find(x => x.repositorio === nome && x.erro) || {}).erro;
  let h = '<section class="ifr-auto" aria-label="Desenhos automáticos"><div class="ifr-auto-cab"><h3>Automático</h3>' +
    (pode ? '<button type="button" class="btn sec peq" data-ifr-atualizar' + (IFR_AUTO.atualizando ? ' disabled' : '') + '>' + (IFR_AUTO.atualizando ? 'Atualizando…' : 'Atualizar agora') + '</button>' : '') + '</div>';
  h += '<p class="ifr-auto-como">' + (fonte === 'codigo' ? 'Esta parte sai <b>sozinha do código</b> a cada publicação em produção.'
    : fonte === 'banco' ? 'Esta parte sai <b>sozinha do banco de dados</b> ligado: quando a estrutura muda, o desenho é refeito.'
    : 'Esta parte é feita pelo <b>DevIT</b>, usando os desenhos automáticos como base.') + '</p>';
  // código
  h += '<div class="ifr-auto-bloco"><h4 class="ifr-auto-tit">Código</h4>' + (repos.length
    ? repos.map(r => { const er = erroRepo(r.nome);
        return '<div class="ifr-fonte' + (er ? ' com-erro' : '') + '"><div class="ifr-fonte-cab"><b>' + esc(r.nome) + '</b>' + (er ? ifrSelo('erro', 'Com problema') : ifrSelo('ok', 'Ligado')) + '</div>' +
          '<p class="ifr-fonte-meta">' + esc((r.provedor === 'gitlab' ? 'GitLab' : 'GitHub') + ' · branch ' + (r.branch_principal || 'main')) + '</p>' +
          (er ? '<p class="ifr-fonte-erro">' + esc(er) + '</p>' : '') +
          (pode ? '<div class="ifr-fonte-acoes"><button type="button" class="ifr-lnk" data-ifr-repo-trocar="' + r.id + '">Trocar</button><button type="button" class="ifr-lnk" data-ifr-repo-tirar="' + r.id + '">Desligar</button></div>' : '') + '</div>'; }).join('')
    : '<p class="ifr-vazio">Nenhum repositório ligado ' + (/^app:/.test(UI.sel || '') ? 'a esta aplicação' : eProd ? 'a este produto' : 'direto neste projeto') + '.</p>') +
    (pode ? '<div class="ifr-auto-add"><button type="button" class="btn sec peq" data-ifr-repo>+ ' + (repos.length ? 'Ligar outro repositório' : 'Ligar repositório') + '</button></div>' : '') + '</div>';
  // bancos
  const qual = x => (IFR_PROV[x.provedor] || 'Outro') + (x.supa_conexao_id ? ' · sem senha' : '') + ' · ' + (x.motor === 'mysql' ? 'MySQL' : 'PostgreSQL') + ' · ' + (x.motor === 'mysql' ? 'banco ' : 'esquema' + ((x.esquemas || []).length > 1 ? 's ' : ' ')) + (x.esquemas || []).join(', ');
  h += '<div class="ifr-auto-bloco"><h4 class="ifr-auto-tit">Bancos de dados</h4>' + (bs.length
    ? bs.map(x => {
        const selo = !x.ativo ? ifrSelo('cinza', 'Desligado') : x.ultimo_erro ? ifrSelo('erro', 'Não conectou') : x.ultima_leitura_em ? ifrSelo('ok', 'Lido ' + ifrQuando(x.ultima_leitura_em)) : ifrSelo('cinza', 'Aguardando leitura');
        return '<div class="ifr-fonte' + (x.ultimo_erro ? ' com-erro' : '') + '"><div class="ifr-fonte-cab"><b>' + esc(x.nome) + '</b>' + selo + '</div>' +
          '<p class="ifr-fonte-meta">' + esc(qual(x)) + '</p>' + (x.servidor ? '<p class="ifr-fonte-host" title="Servidor">' + esc(x.servidor) + '</p>' : '') +
          (x.supa_conexao_id && x.validado_em ? '<p class="ifr-fonte-meta" data-ifr-conferido>Ligado pelo Supabase, sem senha. Conferido em ' + esc(fmtData(x.validado_em.slice(0, 10))) + ' às ' + esc(new Date(x.validado_em).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})) + (x.validacao ? ': ' + esc((x.validacao.tabelas || 0) + ' tabelas, ' + (x.validacao.regras || 0) + ' regras de acesso') : '') + '</p>' : '') +
          (!x.supa_conexao_id && x.conexao_trocada_em ? '<p class="ifr-fonte-meta" data-ifr-trocado>Endereço salvo em ' + esc(fmtData(x.conexao_trocada_em.slice(0, 10))) + ' às ' + esc(new Date(x.conexao_trocada_em).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})) + '</p>' : '') +
          (x.ultimo_erro ? '<div class="ifr-fonte-erro"><b>' + esc(ifrErroAmigavel(x.ultimo_erro)) + '</b><small>' + esc(x.ultimo_erro) + (x.ultima_leitura_em ? ' · tentativa ' + esc(ifrQuando(x.ultima_leitura_em)) : '') + '</small>' +
            (/password authentication/.test(x.ultimo_erro) && x.conexao_trocada_em && !x.supa_conexao_id ? '<p class="ifr-fonte-dica">O CicloDev ainda usa a senha do endereço salvo em ' + esc(fmtData(x.conexao_trocada_em.slice(0, 10))) + '. Se você criou ou trocou a senha no banco depois disso, clique em <b>Trocar</b> e cole o endereço com a senha nova. Se a data não mudar depois de salvar, a troca não foi gravada.</p>' : '') +
            '<button type="button" class="btn peq" data-ifr-guia>Resolver com o DevIT</button></div>'
            : x.ultima_mudanca_em ? '<p class="ifr-fonte-meta">Estrutura mudou ' + esc(ifrQuando(x.ultima_mudanca_em)) + '</p>' : '') +
          (pode ? '<div class="ifr-fonte-acoes"><button type="button" class="ifr-lnk" data-ifr-banco="' + x.id + '">Trocar</button><button type="button" class="ifr-lnk" data-ifr-banco-tirar="' + x.id + '">Desligar</button></div>' : '') + '</div>'; }).join('')
    : '<p class="ifr-vazio">' + (pode ? 'Nenhum banco ligado.' : 'Só quem pode editar vê os bancos ligados.') + '</p>') +
    '<div class="ifr-auto-add">' + (pode ? '<button type="button" class="btn sec peq" data-ifr-banco="">+ ' + (bs.length ? 'Ligar outro banco' : 'Ligar banco') + '</button>' : '') + '<button type="button" class="ifr-lnk" data-ifr-guia>Guia passo a passo</button></div></div>';
  // última atualização: uma linha; os erros já aparecem na fonte de cada um
  if (ult){
    let ST = {pendente:['cinza', 'Na fila'], rodando:['cinza', 'Montando agora'], pronto:['ok', 'Concluída'], erro:['erro', 'Falhou']}[ult.status] || ['cinza', ult.status];
    const porque = ult.origem === 'manual' ? 'pedida pelo botão Atualizar agora' : ult.origem === 'banco' ? 'porque a estrutura do banco mudou' : (ult.origem === 'github' || ult.origem === 'gitlab') ? 'depois da publicação' + (ult.referencia ? ' do commit ' + String(ult.referencia).slice(0, 7) : '') : '';
    const nd = (ult.diagramas || []).length, nErros = resumo.filter(x => x.erro).length;
    if (ult.status === 'pronto' && nErros) ST[0] = 'aviso', ST[1] = 'Concluída com problema';
    const avisos = resumo.filter(x => x.aviso && !x.erro).map(x => (x.repositorio ? x.repositorio + ': ' : '') + x.aviso);
    h += '<div class="ifr-auto-bloco"><h4 class="ifr-auto-tit">Última atualização</h4><div class="ifr-ult">' + ifrSelo(ST[0], ST[1]) + '<span>' + esc(ifrQuando(ult.concluido_em || ult.criado_em)) + (nd ? ' · ' + nd + (nd === 1 ? ' desenho' : ' desenhos') : '') + '</span></div>' +
      (porque ? '<p class="ifr-fonte-meta">' + esc(porque.charAt(0).toUpperCase() + porque.slice(1)) + '</p>' : '') +
      (nErros ? '<p class="ifr-fonte-meta ifr-ult-erro">' + (nErros === 1 ? '1 fonte com problema' : nErros + ' fontes com problema') + ': veja acima.</p>' : ult.erro ? '<p class="ifr-fonte-erro">' + esc(ult.erro) + '</p>' : '') +
      (avisos.length ? '<ul class="ifr-auto-avisos">' + avisos.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') + '</div>';
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
// resumo curto dentro da janela de ligar; o passo a passo completo fica no guia (botão "Guia passo a passo")
const IFR_GUIA = {
  supabase: '<p class="ifr-meta" style="margin:0">Em resumo: crie no Supabase do sistema um usuário que só enxerga a estrutura, copie o endereço do <b>Session pooler</b> e cole aqui com esse usuário e a senha dele.</p>',
  aws: '<p class="ifr-meta" style="margin:0">Em resumo: deixe o banco acessível pela internet, libere a porta no security group, crie um usuário só de leitura e preencha os campos abaixo.</p>',
  outro: '<p class="ifr-meta" style="margin:0">Crie um usuário que só lê e cole o endereço: <code>postgresql://usuario:senha@servidor:5432/banco</code> ou <code>mysql://usuario:senha@servidor:3306/banco</code>.</p>'
};
/* ---------- guia passo a passo (Supabase e AWS), conferido com a documentação oficial de cada um ---------- */
const ifrCmd = txt => '<div class="ifr-gp-cmd"><pre class="ifr-pre">' + esc(txt) + '</pre><button type="button" class="btn sec peq" data-ifr-copiar="' + esc(txt) + '">Copiar</button></div>';
const ifrPasso = (n, titulo, corpo) => '<li class="ifr-gp-passo"><span class="ifr-gp-num">' + n + '</span><div><h4>' + titulo + '</h4>' + corpo + '</div></li>';
const ifrErros = linhas => '<div class="ifr-gp-erros"><h4>Se aparecer um erro</h4><dl>' + linhas.map(([m, f]) => '<dt>' + m + '</dt><dd>' + f + '</dd>').join('') + '</dl></div>';
// a janela monta o guia da mesma base de conhecimento que o DevIT usa (window.DEVIT_CONHECIMENTO, do build)
const ifrTxt = t => String(t || '').split(/\n{2,}/).map(x => '<p>' + x.split('\n').map(l => esc(l).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>')).join('<br>') + '</p>').join('');
function ifrGuiaHTML(prov){
  const K = window.DEVIT_CONHECIMENTO || {guias:{}, faq:[]}, chave = 'banco-' + prov, g = K.guias[chave];
  if (!g) return '<p class="ifr-meta">Guia indisponível.</p>';
  const intro = g.abertura.split(/\n{2,}/).filter(x => !/Podemos começar/.test(x)).join('\n\n');
  return '<div class="ifr-gp-intro">' + ifrTxt(intro) + '</div><ol class="ifr-gp">' +
    g.passos.map((p, i) => ifrPasso(i + 1, esc(p.titulo), ifrTxt(p.texto) + (p.comando ? ifrCmd(p.comando) : '') + (p.texto2 ? ifrTxt(p.texto2) : '') + (p.comando2 ? ifrCmd(p.comando2) : '') + (p.nota ? '<div class="ifr-gp-dica">' + ifrTxt(p.nota) + '</div>' : ''))).join('') +
    '</ol>' + ifrErros(K.faq.filter(f => f.guias.includes(chave)).map(f => [esc(f.titulo), ifrTxt(f.resposta.replace(/```\n?/g, ''))]));
}
const IFR_GUIA_COMPLETO = {supabase: () => ifrGuiaHTML('supabase'), aws: () => ifrGuiaHTML('aws')};
// botão de guia: abre o chat do DevIT conduzindo o passo a passo; sem o DevIT ligado para a pessoa, abre a janela
async function ifrGuiar(prov){
  const guia = prov ? 'banco-' + prov : 'banco';
  if (typeof iaGuiar === 'function' && await iaGuiar(guia)) return;
  ifrGuiaAbrir(prov || 'supabase');
}
function ifrGuiaAbrir(provInicial){
  let prov = provInicial === 'aws' ? 'aws' : 'supabase';
  const dlg = modal('Guia: como ligar um banco de dados', '<div class="ifr-gp-abas" role="tablist"><button type="button" role="tab" data-ifr-gp="supabase">Supabase</button><button type="button" role="tab" data-ifr-gp="aws">AWS (RDS e Aurora)</button></div><div id="ifr-gp-corpo"></div>',
    [{txt:'Fechar', cls:'sec'}].concat(podeEditar() ? [{txt:'Ligar banco agora', acao:() => { setTimeout(() => ifrBancoModal(null, prov), 0); }}] : []));
  dlg.classList.add('ifr-gp-dlg');
  const pintar = () => {
    $$('[data-ifr-gp]', dlg).forEach(b => { const on = b.dataset.ifrGp === prov; b.classList.toggle('sel', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    $('#ifr-gp-corpo', dlg).innerHTML = IFR_GUIA_COMPLETO[prov]();
  };
  dlg.addEventListener('click', e => {
    const t = e.target.closest('[data-ifr-gp]'); if (t){ prov = t.dataset.ifrGp; pintar(); $('.modal-corpo', dlg).scrollTop = 0; return; }
    const c = e.target.closest('[data-ifr-copiar]'); if (c) enCopiar(c.dataset.ifrCopiar, c);
  });
  pintar();
  return dlg;
}
// senha com símbolos (@ # / : ? espaço) quebra o endereço: codifica só a senha, entre o primeiro : do usuário e o ÚLTIMO @
function ifrCodificarSenha(url){
  const m = String(url).match(/^([a-z][a-z0-9+.-]*:\/\/)([^:@\/]+):(.*)@([^@]+)$/i); if (!m) return url;
  const jaCodificada = /%[0-9a-f]{2}/i.test(m[3]) && !/[@#?\/:\s\[\]]/.test(m[3]);
  return m[1] + m[2] + ':' + (jaCodificada ? m[3] : encodeURIComponent(m[3])) + '@' + m[4];
}
// confere o endereço colado do Supabase antes de salvar (os erros mais comuns do passo a passo)
function ifrConferirSupabase(url){
  if (/\[YOUR-PASSWORD\]/i.test(url)) return 'Troque [YOUR-PASSWORD] pela senha do usuário leitura_ciclodev (sem os colchetes).';
  let u; try { u = new URL(url.replace(/^postgres(ql)?:/, 'http:')); } catch (e){ return 'O endereço não está no formato certo. Copie de novo do botão Connect do Supabase.'; }
  const usu = decodeURIComponent(u.username || '');
  if (/pooler\.supabase\.com$/i.test(u.hostname)){
    if (!usu.includes('.')) return 'No pooler do Supabase o usuário leva o código do projeto: leitura_ciclodev.codigo-do-projeto (com o ponto).';
    if (/^postgres\./i.test(usu)) return 'Use o usuário leitura_ciclodev (passo 2 do guia), não o postgres: o postgres é o dono do banco e pode tudo.';
  } else if (/^db\.[a-z0-9]+\.supabase\.co$/i.test(u.hostname)) return 'Este é o endereço de conexão direta, que só funciona com IPv6. Use o do Session pooler (Connect, Session pooler).';
  if (!u.password) return 'Falta a senha no endereço.';
  return '';
}
function ifrBancoModal(id, provInicial, soEndereco){
  const b = id ? IFR_AUTO.bancos.find(x => x.id === id) : null;
  // Supabase: o jeito sem senha (com conferência antes de ligar) é o padrão; o endereço fica como segunda opção
  if (!soEndereco && COM_BANCO && typeof scLigarModal === 'function' && ((b && b.supa_conexao_id) || (!b && (provInicial || 'supabase') === 'supabase'))) return scLigarModal(id);
  let prov = b ? b.provedor : (IFR_PROV[provInicial] ? provInicial : 'supabase'), motor = b ? b.motor : 'postgres';
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
    if (url && prov === 'supabase'){ const erro = ifrConferirSupabase(url); if (erro){ toast(erro); return false; } }
    if (url){ const sm = String(url).match(/^[a-z][a-z0-9+.-]*:\/\/[^:@\/]+:(.*)@[^@]+$/i), senha = sm ? sm[1] : ''; let real = senha; try { real = decodeURIComponent(senha); } catch(e){}
      if (sm && real.length < 8){ toast('A senha no endereço tem só ' + real.length + (real.length === 1 ? ' caractere' : ' caracteres') + '. Use a mesma senha que você criou para o usuário leitura_ciclodev no banco (pelo menos 8). Nada foi salvo.'); return false; } }
    if (url && prov !== 'aws') url = ifrCodificarSenha(url);
    const esq = $('#ifr-b-esq', dl).value.split(',').map(s => s.trim()).filter(Boolean);
    if (!esq.length){ toast(motor === 'mysql' ? 'Diga qual banco (database) ler.' : 'Diga quais esquemas ler.'); return false; }
    const args = {p_no:IFR.no, p_id:b ? b.id : null, p_nome:$('#ifr-b-nome', dl).value.trim(), p_provedor:prov, p_motor:motor, p_esquemas:esq, p_conexao:url || null, p_ativo:true};
    const salvar = (teste) => sb.rpc('infra_banco_salvar', args).then(async ({error}) => {
      if (error){ toast('Não deu para salvar o banco: ' + (error.message || error)); return; }
      if (document.body.contains(dl)){ dl.close(); dl.remove(); }
      await ifrAutoCarregar(); ifrLado();
      toast('Banco salvo' + (teste ? ' e testado (' + teste.tabelas + ' tabelas, ' + teste.regras + ' regras de acesso)' : '') + '. Em alguns minutos o DER' + (motor === 'postgres' ? ' e o mapa de acesso aparecem nas sub-abas DER e Segurança.' : ' aparece na sub-aba DER.'));
    });
    // endereço novo: testa de verdade antes de salvar (só leitura); se não passar, não salva e diz por quê
    if (!url || typeof scTestarEndereco !== 'function'){ salvar(null); return; }
    const bt = $$('.modal-rod .btn', dl).pop(); if (bt){ bt.disabled = true; bt.textContent = 'Testando…'; }
    scTestarEndereco(url, motor, esq).then(r => {
      if (bt){ bt.disabled = false; bt.textContent = 'Salvar'; }
      const s = $('#ifr-b-teste', dl); if (s) s.innerHTML = scTesteHTML(r);
      if (r.ok) salvar(r.resultado); else if (s && s.scrollIntoView) s.scrollIntoView({block:'nearest'});
    });
    return false;
  }}]);
  const pintar = () => {
    const c = $('#ifr-b-corpo', dlg); if (!c) return;
    const nome = ($('#ifr-b-nome', c) || {}).value, esq = ($('#ifr-b-esq', c) || {}).value;
    c.innerHTML = '<p class="ifr-meta" style="margin:0">O DER' + (motor === 'postgres' ? ' e o mapa de acesso passam' : ' passa') + ' a sair sozinho' + (motor === 'postgres' ? 's' : '') + ' deste banco. O robô só lê a estrutura (tabelas, colunas, chaves' + (motor === 'postgres' ? ', RLS e permissões' : '') + '), nunca os dados, e a conexão abre em modo somente leitura. Dá para ligar vários bancos no mesmo lugar.</p>' +
      '<div class="ifr-prov" role="radiogroup" aria-label="Onde o banco está">' + Object.entries(IFR_PROV).map(([k, n]) => '<label class="ifr-prov-op' + (prov === k ? ' sel' : '') + '"><input type="radio" name="ifr-b-prov" value="' + k + '"' + (prov === k ? ' checked' : '') + '> ' + n + '</label>').join('') + '</div>' +
      (prov !== 'supabase' ? '<label class="lb">Motor<select class="sel" id="ifr-b-motor"><option value="postgres"' + (motor === 'postgres' ? ' selected' : '') + '>PostgreSQL (RDS, Aurora PostgreSQL)</option><option value="mysql"' + (motor === 'mysql' ? ' selected' : '') + '>MySQL (RDS, Aurora MySQL)</option></select></label>' : '') +
      (prov === 'supabase' && typeof scLigarModal === 'function' ? '<div class="sc-recomenda"><b>Mais fácil e sem senha:</b> autorize o CicloDev no próprio Supabase. A leitura é conferida antes de ligar. <button type="button" class="btn acento peq" data-sc-sem-senha>Conectar ao Supabase</button></div>' : '') +
      IFR_GUIA[prov] + (prov !== 'outro' ? '<p style="margin:0"><button type="button" class="ifr-lnk" data-ifr-guia-abrir>' + (typeof IA !== 'undefined' && IA.posso ? 'Fazer o passo a passo com o DevIT' : 'Ver o guia passo a passo') + (prov === 'aws' ? ' (AWS)' : ' (Supabase)') + '</button></p>' : '') +
      '<div class="ifr-ed-linha"><label class="lb">Nome<input class="campo" id="ifr-b-nome" value="' + esc(nome != null ? nome : b ? b.nome : 'Banco de produção') + '"></label>' +
      '<label class="lb">' + (motor === 'mysql' ? 'Bancos (databases)' : 'Esquemas') + '<input class="campo" id="ifr-b-esq" value="' + esc(esq != null ? esq : b ? (b.esquemas || []).join(', ') : motor === 'mysql' ? '' : 'public') + '" placeholder="' + (motor === 'mysql' ? 'nome_do_banco' : 'public') + '"></label></div>' +
      (prov === 'aws'
        ? '<div class="ifr-ed-linha"><label class="lb">Endpoint<input class="campo" id="ifr-b-host" autocomplete="off" spellcheck="false" placeholder="meu-banco.abc123.us-east-1.rds.amazonaws.com"></label><label class="lb">Porta<input class="campo" id="ifr-b-porta" inputmode="numeric" placeholder="' + (motor === 'mysql' ? '3306' : '5432') + '"></label></div>' +
          '<div class="ifr-ed-linha"><label class="lb">Banco (database)<input class="campo" id="ifr-b-base" autocomplete="off" spellcheck="false" placeholder="' + (motor === 'mysql' ? 'nome_do_banco' : 'postgres') + '"></label><label class="lb">Usuário<input class="campo" id="ifr-b-usu" autocomplete="off" spellcheck="false" value="leitura_ciclodev"></label>' +
          '<label class="lb">Senha<input class="campo gc-oculto" id="ifr-b-senha" type="text" autocomplete="off" spellcheck="false" data-lpignore="true" data-1p-ignore></label></div>' + (b ? '<p class="ifr-meta">Deixe os campos de conexão vazios para manter os atuais.</p>' : '')
        : '<label class="lb">Endereço de conexão' + (b ? ' (deixe vazio para manter o atual)' : '') + '<input class="campo gc-oculto" id="ifr-b-url" type="text" autocomplete="off" spellcheck="false" data-lpignore="true" data-1p-ignore placeholder="' + (prov === 'supabase' ? 'postgresql://leitura_ciclodev.xxxx:senha@aws-0-sa-east-1.pooler.supabase.com:5432/postgres' : motor === 'mysql' ? 'mysql://usuario:senha@servidor:3306/banco' : 'postgresql://usuario:senha@servidor:5432/banco') + '"></label>') +
      '<p class="ifr-meta">O endereço e a senha ficam numa área do banco do CicloDev que nenhuma tela lê; só o robô usa. Ninguém consegue ver a senha depois de salvar. Antes de salvar, o CicloDev testa a conexão de verdade (só leitura).</p><div id="ifr-b-teste"></div>';
  };
  dlg.addEventListener('click', e => { if (e.target.closest('[data-sc-sem-senha]')){ dlg.close(); dlg.remove(); scLigarModal(id); return; } if (e.target.closest('[data-ifr-guia-abrir]')){ if (typeof IA !== 'undefined' && IA.posso){ dlg.close(); dlg.remove(); } ifrGuiar(prov === 'aws' ? 'aws' : 'supabase'); } });
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
  { if (e.target.closest('[data-ifr-guia]')) return ifrGuiar(null); }
  { const bt = e.target.closest('[data-ifr-banco-tirar]'); if (bt) return ifrBancoTirar(bt.dataset.ifrBancoTirar); }
  if (e.target.closest('[data-ifr-repo]')){ if (typeof gcLigarRepo === 'function') gcLigarRepo(); return; }
  let rb = e.target.closest('[data-ifr-repo-tirar]'); if (rb){ gcDesligarRepo(rb.dataset.ifrRepoTirar); return; }
  rb = e.target.closest('[data-ifr-repo-trocar]'); if (rb){ gcDesligarRepo(rb.dataset.ifrRepoTrocar, true); return; }
  const q = e.target.closest('[data-ifr-quadro]'); if (q){ const dl = q.closest('dialog'); if (dl){ dl.close(); dl.remove(); } ifrAbrirQuadro(q.dataset.ifrQuadro); }
});
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {IFR_AUTO, ifrAutoCarregar, ifrAutoAtualizar, ifrAbrirQuadro, ifrLado, ifrAutoHTML, ifrGuiaAbrir, ifrBancoModal, ifrGuiar, ifrGuiaHTML});
