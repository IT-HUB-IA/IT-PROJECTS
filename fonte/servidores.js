/* ===== Servidores: cadastro de VPS, dedicado e nuvem (parte 47) =====
   A máquina (provedor, plano, sistema, CPU, memória, disco, rede, contrato, backup, monitoramento e ONDE fica o acesso,
   nunca a senha), onde ela se aplica (cliente, projeto ou produto valem para todas as aplicações de dentro; aplicação,
   só para ela), o que roda nela (cada serviço com a aplicação que atende) e os custos, divididos entre as aplicações
   atendidas (por igual ou por peso). Aparece também em Custos, na Ficha técnica (Ambientes) e vira item na frente
   Infraestrutura quando a renovação está chegando. Tudo direto no banco, com as regras de acesso da parte 47. */
const SRV = {lido:false, carregando:null, erro:'', lista:[], alcance:[], servicos:[], custos:[]};
const SV_TIPOS = [['vps','VPS'],['dedicado','Dedicado'],['nuvem','Máquina na nuvem'],['container','Container gerenciado'],['fisico','Servidor físico'],['outro','Outro']];
const SV_AMB = [['producao','Produção'],['homologacao','Homologação'],['desenvolvimento','Desenvolvimento'],['backup','Backup'],['outro','Outro']];
const SV_STATUS = [['ativo','Ativo'],['pausado','Pausado'],['desligado','Desligado']];
const SV_SERV = [['aplicacao','Aplicação'],['api','API'],['site','Site'],['banco','Banco de dados'],['proxy','Proxy / servidor web'],['container','Container'],['fila','Fila'],['cache','Cache'],['agendada','Rotina agendada'],['monitoramento','Monitoramento'],['backup','Backup'],['painel','Painel'],['outro','Outro']];
const SV_REC = [['mensal','Mensal'],['anual','Anual'],['unico','Único']];
const SV_DISCO = [['','—'],['ssd','SSD'],['nvme','NVMe'],['hdd','HDD']];
const svNome = (lista, k) => (lista.find(x => x[0] === k) || [k, k])[1];
const svPodeTer = sel => /^(client|project|product|app):/.test(sel || '');
const svBanco = () => (typeof COM_BANCO !== 'undefined' && COM_BANCO && window.ciclodevBanco && typeof BANCO !== 'undefined' && BANCO.carregado) ? window.ciclodevBanco : null;
const svBRL = (v, moeda) => moeda === 'EUR' ? v * ((D.regras && (D.regras.cambioEur || D.regras.cambio * 1.08)) || 1) : paraBRL(v, moeda);
const svDia = s => s ? String(s).slice(8, 10) + '/' + String(s).slice(5, 7) + '/' + String(s).slice(0, 4) : '';

/* ---------- a árvore: de ponto (chave da tela) para o id do banco e de volta ---------- */
function svChaveDe(id){
  if (byId('apps', id)) return 'app:' + id; if (byId('products', id)) return 'product:' + id;
  if (byId('projects', id)) return 'project:' + id; if (byId('clients', id)) return 'client:' + id; return null;
}
const svIdDe = chave => String(chave || '').split(':')[1];
// o ponto e os de cima (cliente, projeto, produto)
function svAcima(sel){ const c = cadeia(sel); return [c.app, c.product, c.project, c.client].filter(Boolean).map(o => o.id); }
// o ponto e todos os de dentro
function svDentro(sel){
  const [t, id] = String(sel).split(':');
  if (t === 'app') return [id];
  if (t === 'product') return [id].concat(D.apps.filter(a => a.product === id).map(a => a.id));
  if (t === 'project') return [id].concat(D.products.filter(p => p.project === id).map(p => p.id), D.apps.filter(a => a.project === id).map(a => a.id));
  if (t === 'client'){ const pjs = D.projects.filter(p => p.client === id).map(p => p.id); return [id].concat(pjs, D.products.filter(p => pjs.includes(p.project)).map(p => p.id), D.apps.filter(a => pjs.includes(a.project)).map(a => a.id)); }
  return [];
}
// as aplicações que um ponto cobre (projeto e produto: todas as de dentro)
function svAppsDe(id){ const k = svChaveDe(id); return k ? svDentro(k).filter(x => byId('apps', x)) : []; }

/* ---------- dados ---------- */
async function svCarregar(forcar){
  const sb = svBanco(); if (!sb){ SRV.lido = true; return; }
  if (SRV.carregando && !forcar) return SRV.carregando;
  SRV.carregando = (async () => {
    try {
      const [s, a, v, c] = await Promise.all([sb.from('servidores').select('*').order('nome').limit(2000), sb.from('servidores_alcance').select('*').limit(10000),
        sb.from('servidores_servicos').select('*').order('ordem').limit(20000), sb.from('servidores_custos').select('*').limit(20000)]);
      const e = [s, a, v, c].find(x => x.error); if (e) throw e.error;
      SRV.lista = s.data || []; SRV.alcance = a.data || []; SRV.servicos = v.data || []; SRV.custos = c.data || []; SRV.erro = '';
    } catch (e){ SRV.erro = e.message || String(e); }
    SRV.lido = true; SRV.carregando = null;
  })();
  return SRV.carregando;
}
const svAlcanceDe = s => SRV.alcance.filter(a => a.servidor_id === s.id);
const svServicosDe = s => SRV.servicos.filter(a => a.servidor_id === s.id).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
const svCustosDe = s => SRV.custos.filter(a => a.servidor_id === s.id);
// como o servidor chega neste ponto: aplicado aqui, herdado de cima, ou atende parte do que está dentro
function svRelacao(s, sel){
  const acima = svAcima(sel), dentro = svDentro(sel), al = svAlcanceDe(s).map(a => a.no_id), aqui = svIdDe(sel);
  if (al.includes(aqui)) return {tipo:'aqui'};
  const de = al.find(x => acima.includes(x)); if (de) return {tipo:'herdado', de};
  const parte = al.filter(x => dentro.includes(x)); if (parte.length) return {tipo:'parte', nos:parte};
  if (s.no_id === aqui || dentro.includes(s.no_id)) return {tipo:'dono'};
  return null;
}
const svDoPonto = sel => SRV.lista.filter(s => svRelacao(s, sel));

/* ---------- custos e divisão ---------- */
const svMesAtual = () => iso(HOJE).slice(0, 7);
function svCustoMensal(s){
  const m = svMesAtual();
  return svCustosDe(s).reduce((t, c) => { if (String(c.inicio).slice(0, 7) > m || (c.fim && String(c.fim).slice(0, 7) < m)) return t;
    const v = svBRL(+c.valor || 0, c.moeda); return t + (c.recorrencia === 'mensal' ? v : c.recorrencia === 'anual' ? v / 12 : 0); }, 0);
}
const svCustoUnico = s => svCustosDe(s).filter(c => c.recorrencia === 'unico').reduce((t, c) => t + svBRL(+c.valor || 0, c.moeda), 0);
// a parte de cada aplicação: por igual entre as atendidas, ou pelo peso de cada ponto (o peso do ponto se divide entre as aplicações dele)
function svDivisao(s){
  const pesos = new Map();
  for (const a of svAlcanceDe(s)){ const apps = svAppsDe(a.no_id); if (!apps.length) continue;
    apps.forEach(x => pesos.set(x, s.rateio === 'peso' ? (pesos.get(x) || 0) + (+a.peso || 1) / apps.length : 1)); }
  const total = [...pesos.values()].reduce((t, v) => t + v, 0);
  return [...pesos.entries()].map(([app, p]) => ({app, fracao:total ? p / total : 0}));
}
// quanto do custo mensal cai neste ponto
function svParte(s, sel){
  const div = svDivisao(s), mensal = svCustoMensal(s); if (!mensal) return 0;
  if (!div.length){ const r = svRelacao(s, sel); return r && r.tipo !== 'herdado' ? mensal : 0; }
  const dentro = new Set(svDentro(sel)); return div.filter(d => dentro.has(d.app)).reduce((t, d) => t + d.fracao * mensal, 0);
}
const svDiasAte = d => d ? Math.round((parse(String(d).slice(0, 10)) - HOJE) / 86400000) : null;

/* ---------- a tela ---------- */
function svTelaHTML(){
  const sb = svBanco(), pode = podeEditar(), sel = UI.sel;
  if (!sb) return '<div class="sv-tela"><p class="sv-vazio">O cadastro de servidores precisa do banco do CicloDev ligado.</p></div>';
  if (!SRV.lido) return '<div class="sv-tela"><p class="sv-vazio">Carregando os servidores…</p></div>';
  if (SRV.erro) return '<div class="sv-tela"><p class="entrada-erro">Não deu para ler os servidores: ' + esc(SRV.erro) + '</p></div>';
  const lista = svDoPonto(sel), ativos = lista.filter(s => s.status !== 'desligado');
  const mensal = ativos.reduce((t, s) => t + svCustoMensal(s), 0), parte = ativos.reduce((t, s) => t + svParte(s, sel), 0);
  const renov = ativos.filter(s => { const d = svDiasAte(s.renova_em); return d != null && d <= 30; });
  return '<div class="sv-tela">' +
    '<header class="sv-topo"><div><h2>Servidores</h2><p class="lead">As máquinas que rodam ' + esc(nomeDe(sel)) + ': o que roda em cada uma, onde se aplica e quanto custa. Servidor ligado a um projeto vale para todas as aplicações de dentro; ligado a uma aplicação, só para ela.</p></div>' +
      (pode ? '<button type="button" class="btn" data-sv-novo>Cadastrar servidor</button>' : '') + '</header>' +
    '<div class="sv-kpis"><div class="sv-kpi"><b>' + ativos.length + '</b><span>' + (ativos.length === 1 ? 'servidor atende' : 'servidores atendem') + ' este ponto</span></div>' +
      '<div class="sv-kpi"><b>' + brl(mensal) + '</b><span>custo mensal desses servidores</span></div>' +
      '<div class="sv-kpi"><b>' + brl(parte) + '</b><span>parte de ' + esc(nomeDe(sel)) + ' por mês (divisão)</span></div>' +
      '<div class="sv-kpi' + (renov.length ? ' sv-alerta' : '') + '"><b>' + renov.length + '</b><span>' + (renov.length === 1 ? 'renovação' : 'renovações') + ' nos próximos 30 dias</span></div></div>' +
    (lista.length ? lista.map(s => svCardHTML(s, sel, pode)).join('') : '<p class="sv-vazio">Nenhum servidor atende este ponto ainda.' + (pode ? ' Cadastre a VPS ou a máquina onde o sistema roda.' : '') + '</p>') +
  '</div>';
}
function svCardHTML(s, sel, pode){
  const r = svRelacao(s, sel), al = svAlcanceDe(s), sv = svServicosDe(s), cs = svCustosDe(s), div = svDivisao(s), mensal = svCustoMensal(s), unico = svCustoUnico(s);
  const rel = r.tipo === 'aqui' ? 'Aplicado aqui' : r.tipo === 'herdado' ? 'Herdado de ' + nomeDe(svChaveDe(r.de) || '') : r.tipo === 'parte' ? 'Atende parte do que está dentro' : 'Cadastrado aqui, sem onde se aplica';
  const dias = svDiasAte(s.renova_em), pess = s.responsavel_id && pessoa(s.responsavel_id);
  const espec = [s.cpu != null ? s.cpu + ' vCPU' : '', s.memoria_gb != null ? (+s.memoria_gb) + ' GB de memória' : '', s.disco_gb != null ? (+s.disco_gb) + ' GB ' + (s.disco_tipo ? s.disco_tipo.toUpperCase() : 'de disco') : '', s.banda_tb != null ? (+s.banda_tb) + ' TB de tráfego' : ''].filter(Boolean);
  const lin = (rot, v) => v ? '<div class="sv-lin"><dt>' + rot + '</dt><dd>' + v + '</dd></div>' : '';
  return '<article class="sv-card sv-st-' + esc(s.status) + '" data-sv="' + esc(s.id) + '">' +
    '<header class="sv-cab"><div class="sv-tit"><h3>' + esc(s.nome) + '</h3><p>' + esc([s.provedor, s.plano, s.regiao].filter(Boolean).join(' · ') || 'Provedor não informado') + '</p></div>' +
      '<div class="sv-chips"><span class="sv-chip">' + esc(svNome(SV_TIPOS, s.tipo)) + '</span><span class="sv-chip sv-amb-' + esc(s.ambiente) + '">' + esc(svNome(SV_AMB, s.ambiente)) + '</span><span class="sv-chip sv-chip-st">' + esc(svNome(SV_STATUS, s.status)) + '</span><span class="sv-chip sv-rel">' + esc(rel) + '</span></div></header>' +
    (espec.length || s.sistema ? '<p class="sv-espec">' + esc([s.sistema].concat(espec).filter(Boolean).join(' · ')) + '</p>' : '') +
    '<div class="sv-grade">' +
      '<section><h4>Onde se aplica</h4>' + (al.length ? '<ul class="sv-onde">' + al.map(a => { const k = svChaveDe(a.no_id), n = svAppsDe(a.no_id).length;
          return '<li><b>' + esc(k ? nomeDe(k) : 'Ponto sem acesso') + '</b><small>' + esc(k ? ({client:'cliente', project:'projeto', product:'produto', app:'aplicação'})[k.split(':')[0]] : '') + (k && !k.startsWith('app:') ? ' · vale para ' + n + (n === 1 ? ' aplicação' : ' aplicações') : '') + (s.rateio === 'peso' ? ' · peso ' + (+a.peso) : '') + '</small></li>'; }).join('') + '</ul>' : '<p class="sv-vazio">Não diz onde se aplica.</p>') + '</section>' +
      '<section><h4>Custos</h4>' + (cs.length ? '<table class="sv-tab"><tbody>' + cs.map(c => '<tr><td>' + esc(c.descricao) + (c.fim ? '<small> até ' + svDia(c.fim) + '</small>' : '') + '</td><td>' + esc(svNome(SV_REC, c.recorrencia)) + '</td><td class="sv-num">' + esc((c.moeda !== 'BRL' ? c.moeda + ' ' : '') + (+c.valor).toLocaleString('pt-BR', {minimumFractionDigits:2})) + '</td></tr>').join('') + '</tbody></table>' +
          '<p class="sv-total">' + brl(mensal) + ' por mês' + (unico ? ' · ' + brl(unico) + ' em custo único' : '') + '</p>' : '<p class="sv-vazio">Sem custo cadastrado.</p>') +
        (div.length && mensal ? '<h5>Divisão (' + (s.rateio === 'peso' ? 'por peso' : 'por igual') + ')</h5><ul class="sv-div">' + div.map(d => '<li><span>' + esc((byId('apps', d.app) || {}).nome || '') + '</span><b>' + brl(d.fracao * mensal) + '</b><small>' + Math.round(d.fracao * 100) + '%</small></li>').join('') + '</ul>' : '') + '</section>' +
    '</div>' +
    '<section><h4>O que roda nela' + (sv.length ? ' <small>' + sv.length + '</small>' : '') + '</h4>' + (sv.length ? '<div class="tabela-rolo"><table class="sv-tab sv-tab-l"><thead><tr><th>Serviço</th><th>Tipo</th><th>Tecnologia</th><th>Porta</th><th>Endereço</th><th>Atende</th></tr></thead><tbody>' +
        sv.map(x => '<tr><td><b>' + esc(x.nome) + '</b>' + (x.caminho ? '<small>' + esc(x.caminho) + '</small>' : '') + '</td><td>' + esc(svNome(SV_SERV, x.tipo)) + '</td><td>' + esc([x.tecnologia, x.versao].filter(Boolean).join(' ')) + '</td><td class="sv-num">' + (x.porta || '') + '</td><td>' + esc(x.endereco) + '</td><td>' + esc(x.no_id && svChaveDe(x.no_id) ? nomeDe(svChaveDe(x.no_id)) : '') + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="sv-vazio">Nada cadastrado ainda.</p>') + '</section>' +
    '<dl class="sv-info">' + lin('Endereço', esc([s.hostname, s.ip_publico].filter(Boolean).join(' · '))) + lin('IP interno', esc(s.ip_privado)) +
      lin('Painel', s.painel_url ? '<a href="' + esc(s.painel_url) + '" target="_blank" rel="noopener">' + esc(s.painel_url.replace(/^https?:\/\//, '')) + '</a>' : '') +
      lin('Onde fica o acesso', esc(s.acesso_onde)) + lin('Backup', esc(s.backup)) + lin('Monitoramento', esc(s.monitoramento)) + lin('Responsável', esc(pess ? pess.nome : '')) +
      lin('Contrato', esc([s.contratado_em ? 'desde ' + svDia(s.contratado_em) : '', s.renova_em ? 'renova em ' + svDia(s.renova_em) + (dias != null ? (dias < 0 ? ' (venceu há ' + -dias + ' dias)' : ' (em ' + dias + ' dias)') : '') : ''].filter(Boolean).join(', '))) +
      lin('Anotações', esc(s.notas).replace(/\n/g, '<br>')) + '</dl>' +
    (pode && svPodeMudar(s) ? '<footer class="sv-bts"><button type="button" class="btn sec peq" data-sv-editar="' + esc(s.id) + '">Editar</button>' +
      (dias != null && dias <= 45 ? '<button type="button" class="btn sec peq" data-sv-renovar="' + esc(s.id) + '">Criar item de renovação</button>' : '') +
      '<button type="button" class="btn fant peq" data-sv-apagar="' + esc(s.id) + '">Excluir</button></footer>' : '') +
  '</article>';
}
// muda quem edita o ponto dono (o banco confere de novo)
const svPodeMudar = s => { const k = svChaveDe(s.no_id); return !!k && podeEditar(); };

/* ---------- cadastrar e editar ---------- */
// os pontos do cliente, em árvore, para marcar onde o servidor se aplica
function svPontosDoCliente(sel){
  const c = cadeia(sel).client; if (!c) return [];
  const out = [{id:c.id, nome:c.nome, nivel:0, tipo:'cliente'}];
  D.projects.filter(p => p.client === c.id && p.status !== 'archived').forEach(p => { out.push({id:p.id, nome:p.nome, nivel:1, tipo:'projeto'});
    D.products.filter(x => x.project === p.id && x.status !== 'archived').forEach(x => { out.push({id:x.id, nome:x.nome, nivel:2, tipo:'produto'}); D.apps.filter(a => a.product === x.id && a.status !== 'archived').forEach(a => out.push({id:a.id, nome:a.nome, nivel:3, tipo:'aplicação'})); });
    D.apps.filter(a => a.project === p.id && !a.product && a.status !== 'archived').forEach(a => out.push({id:a.id, nome:a.nome, nivel:2, tipo:'aplicação'})); });
  return out;
}
const svOpts = (lista, v) => lista.map(([k, n]) => '<option value="' + esc(k) + '"' + (k === (v == null ? '' : String(v)) ? ' selected' : '') + '>' + esc(n) + '</option>').join('');
const svCampo = (rot, html, largo) => '<label class="lb' + (largo ? ' largo' : '') + '">' + rot + html + '</label>';
const svIn = (id, v, extra) => '<input class="campo" id="' + id + '" value="' + esc(v == null ? '' : v) + '"' + (extra || '') + '>';
function svLinhaServico(x, apps){
  return '<div class="sv-ed-lin" data-sv-serv><input class="campo" data-k="nome" placeholder="Nome (ex.: API Java)" value="' + esc(x.nome || '') + '"><select class="sel" data-k="tipo">' + svOpts(SV_SERV, x.tipo || 'aplicacao') + '</select>' +
    '<input class="campo" data-k="tecnologia" placeholder="Tecnologia (ex.: Java 21, Nginx)" value="' + esc(x.tecnologia || '') + '"><input class="campo" data-k="versao" placeholder="Versão" value="' + esc(x.versao || '') + '">' +
    '<input class="campo" data-k="porta" type="number" min="1" max="65535" placeholder="Porta" value="' + esc(x.porta || '') + '"><input class="campo" data-k="endereco" placeholder="Endereço (domínio ou URL)" value="' + esc(x.endereco || '') + '">' +
    '<select class="sel" data-k="no_id"><option value="">Atende: nenhuma em especial</option>' + apps.map(a => '<option value="' + esc(a.id) + '"' + (a.id === x.no_id ? ' selected' : '') + '>Atende: ' + esc(a.nome) + '</option>').join('') + '</select>' +
    '<input class="campo" data-k="caminho" placeholder="Pasta ou compose (ex.: /opt/bl/docker-compose.yml)" value="' + esc(x.caminho || '') + '"><button type="button" class="ico-btn" data-sv-tirar aria-label="Tirar">' + ICO.fechar + '</button></div>';
}
function svLinhaCusto(x){
  return '<div class="sv-ed-lin sv-ed-custo" data-sv-custo><input class="campo" data-k="descricao" placeholder="O quê (ex.: Plano KVM 4, Backup, IP extra)" value="' + esc(x.descricao || '') + '">' +
    '<input class="campo" data-k="valor" type="number" min="0" step="0.01" placeholder="Valor" value="' + esc(x.valor == null ? '' : x.valor) + '"><select class="sel" data-k="moeda">' + svOpts([['BRL','R$'],['USD','US$'],['EUR','€']], x.moeda || 'BRL') + '</select>' +
    '<select class="sel" data-k="recorrencia">' + svOpts(SV_REC, x.recorrencia || 'mensal') + '</select><input class="campo" data-k="inicio" type="date" value="' + esc(x.inicio || iso(HOJE)) + '"><input class="campo" data-k="fim" type="date" value="' + esc(x.fim || '') + '" title="Fim (vazio: sem fim)">' +
    '<button type="button" class="ico-btn" data-sv-tirar aria-label="Tirar">' + ICO.fechar + '</button></div>';
}
function svEditar(id){
  if (!svBanco()){ toast('Precisa do banco do CicloDev ligado.'); return; }
  const s = id ? SRV.lista.find(x => x.id === id) : {tipo:'vps', ambiente:'producao', status:'ativo', rateio:'igual', disco_tipo:''};
  if (!s) return;
  const base = id ? (svChaveDe(s.no_id) || UI.sel) : UI.sel, pontos = svPontosDoCliente(base), apps = pontos.filter(p => p.tipo === 'aplicação');
  const al = id ? svAlcanceDe(s) : [{no_id:svIdDe(UI.sel), peso:1}], marcado = new Map(al.map(a => [a.no_id, a]));
  const pessoas = D.people.filter(p => p.acesso !== 'stakeholder');
  const corpo = '<div class="sv-form">' +
    '<fieldset><legend>Identificação</legend><div class="grade-form">' + svCampo('Nome', svIn('sv-nome', s.nome, ' maxlength="120" placeholder="Ex.: VPS produção BL"')) +
      svCampo('Tipo', '<select class="sel" id="sv-tipo">' + svOpts(SV_TIPOS, s.tipo) + '</select>') + svCampo('Ambiente', '<select class="sel" id="sv-amb">' + svOpts(SV_AMB, s.ambiente) + '</select>') +
      svCampo('Situação', '<select class="sel" id="sv-status">' + svOpts(SV_STATUS, s.status) + '</select>') + svCampo('Responsável', '<select class="sel" id="sv-resp"><option value="">Ninguém</option>' + pessoas.map(p => '<option value="' + esc(p.id) + '"' + (p.id === s.responsavel_id ? ' selected' : '') + '>' + esc(p.nome) + '</option>').join('') + '</select>') + '</div></fieldset>' +
    '<fieldset><legend>Provedor e máquina</legend><div class="grade-form">' + svCampo('Provedor', svIn('sv-prov', s.provedor, ' maxlength="80" list="sv-provs" placeholder="Hostinger, Contabo, AWS..."') + '<datalist id="sv-provs">' + ['Hostinger','Contabo','Hetzner','DigitalOcean','Vultr','Linode','Locaweb','KingHost','AWS','Google Cloud','Azure','Oracle Cloud','OVHcloud'].map(x => '<option value="' + x + '">').join('') + '</datalist>') +
      svCampo('Plano', svIn('sv-plano', s.plano, ' maxlength="120" placeholder="Ex.: KVM 4"')) + svCampo('Região', svIn('sv-reg', s.regiao, ' maxlength="80" placeholder="Ex.: São Paulo"')) + svCampo('Sistema', svIn('sv-so', s.sistema, ' maxlength="120" placeholder="Ex.: Ubuntu 24.04"')) +
      svCampo('vCPU', svIn('sv-cpu', s.cpu, ' type="number" min="0"')) + svCampo('Memória (GB)', svIn('sv-mem', s.memoria_gb, ' type="number" min="0" step="0.5"')) + svCampo('Disco (GB)', svIn('sv-disco', s.disco_gb, ' type="number" min="0"')) +
      svCampo('Tipo do disco', '<select class="sel" id="sv-dt">' + svOpts(SV_DISCO, s.disco_tipo) + '</select>') + svCampo('Tráfego (TB)', svIn('sv-banda', s.banda_tb, ' type="number" min="0" step="0.5"')) + '</div></fieldset>' +
    '<fieldset><legend>Rede e acesso</legend><div class="grade-form">' + svCampo('Hostname', svIn('sv-host', s.hostname, ' maxlength="255" placeholder="Ex.: srv1.blancoelisboa.com.br"')) + svCampo('IP público', svIn('sv-ip', s.ip_publico, ' maxlength="64"')) + svCampo('IP interno', svIn('sv-ipi', s.ip_privado, ' maxlength="64"')) +
      svCampo('Painel do provedor', svIn('sv-painel', s.painel_url, ' maxlength="500" placeholder="https://"')) +
      svCampo('Onde fica o acesso (nunca a senha)', svIn('sv-acesso', s.acesso_onde, ' maxlength="300" placeholder="Ex.: cofre 1Password, item VPS BL; chave SSH do William"'), true) +
      svCampo('Backup', svIn('sv-backup', s.backup, ' maxlength="500" placeholder="Como, onde e de quanto em quanto tempo"'), true) + svCampo('Monitoramento', svIn('sv-mon', s.monitoramento, ' maxlength="500" placeholder="Ex.: Uptime Kuma avisa no WhatsApp"'), true) + '</div></fieldset>' +
    '<fieldset><legend>Contrato</legend><div class="grade-form">' + svCampo('Contratado em', svIn('sv-desde', s.contratado_em, ' type="date"')) + svCampo('Renova em', svIn('sv-renova', s.renova_em, ' type="date"')) +
      svCampo('Divisão do custo', '<select class="sel" id="sv-rateio">' + svOpts([['igual','Por igual entre as aplicações atendidas'],['peso','Por peso de cada ponto']], s.rateio) + '</select>') + '</div>' +
      '<div class="sv-ed-lista" data-sv-custos>' + svCustosDe(s).map(svLinhaCusto).join('') + '</div><button type="button" class="btn sec peq" data-sv-mais-custo>+ Custo</button></fieldset>' +
    '<fieldset><legend>Onde se aplica</legend><p class="sv-ajuda">Marcar um projeto ou produto vale para todas as aplicações de dentro. Marque só a aplicação quando o servidor é só dela.</p><div class="sv-ed-onde">' +
      pontos.map(p => { const a = marcado.get(p.id); return '<label class="sv-ed-no" style="padding-left:' + (p.nivel * 18) + 'px"><input type="checkbox" data-sv-no="' + esc(p.id) + '"' + (a ? ' checked' : '') + '> <b>' + esc(p.nome) + '</b> <small>' + esc(p.tipo) + '</small><input class="campo sv-peso" type="number" min="0.1" step="0.1" data-sv-peso="' + esc(p.id) + '" value="' + esc(a ? +a.peso : 1) + '" title="Peso na divisão do custo"></label>'; }).join('') + '</div></fieldset>' +
    '<fieldset><legend>O que roda nela</legend><div class="sv-ed-lista" data-sv-servs>' + svServicosDe(s).map(x => svLinhaServico(x, apps)).join('') + '</div><button type="button" class="btn sec peq" data-sv-mais-serv>+ Serviço</button></fieldset>' +
    '<fieldset><legend>Anotações</legend><textarea class="campo" id="sv-notas" rows="3" maxlength="4000">' + esc(s.notas || '') + '</textarea></fieldset>' +
  '</div>';
  const dlg = modal(id ? 'Editar servidor' : 'Cadastrar servidor', corpo, [{txt:'Cancelar', cls:'sec'}, {txt:id ? 'Salvar' : 'Cadastrar', acao:d => { svSalvar(d, s, base); return false; }}]);
  dlg.classList.add('sv-modal');
  const pesoVis = () => dlg.classList.toggle('sv-com-peso', dlg.querySelector('#sv-rateio').value === 'peso'); pesoVis();
  dlg.addEventListener('change', e => { if (e.target.id === 'sv-rateio') pesoVis(); });
  dlg.addEventListener('click', e => {
    if (e.target.closest('[data-sv-mais-serv]')) dlg.querySelector('[data-sv-servs]').insertAdjacentHTML('beforeend', svLinhaServico({}, apps));
    if (e.target.closest('[data-sv-mais-custo]')) dlg.querySelector('[data-sv-custos]').insertAdjacentHTML('beforeend', svLinhaCusto({}));
    const t = e.target.closest('[data-sv-tirar]'); if (t) t.closest('.sv-ed-lin').remove();
  });
}
const svNum = v => v === '' || v == null ? null : +v;
async function svSalvar(dlg, antigo, base){
  const sb = svBanco(); if (!sb) return;
  const v = id => dlg.querySelector('#' + id).value.trim();
  const nome = v('sv-nome'); if (!nome){ toast('Escreva o nome do servidor'); return; }
  const acesso = v('sv-acesso'); if (/(senha|password|passwd|pwd|token|secret)\s*[:=]\s*\S/i.test(acesso)){ toast('Em "Onde fica o acesso" vai só onde ela está guardada, nunca a senha.'); return; }
  const painel = v('sv-painel'); if (painel && !/^https?:\/\//i.test(painel)){ toast('O painel precisa começar com https://'); return; }
  const id = antigo.id || novoUuid();
  const row = {nome, tipo:v('sv-tipo'), ambiente:v('sv-amb'), status:v('sv-status'), responsavel_id:v('sv-resp') || null, provedor:v('sv-prov'), plano:v('sv-plano'), regiao:v('sv-reg'), sistema:v('sv-so'),
    cpu:svNum(v('sv-cpu')), memoria_gb:svNum(v('sv-mem')), disco_gb:svNum(v('sv-disco')), disco_tipo:v('sv-dt'), banda_tb:svNum(v('sv-banda')), hostname:v('sv-host'), ip_publico:v('sv-ip'), ip_privado:v('sv-ipi'),
    painel_url:painel, acesso_onde:acesso, backup:v('sv-backup'), monitoramento:v('sv-mon'), contratado_em:v('sv-desde') || null, renova_em:v('sv-renova') || null, rateio:v('sv-rateio'), notas:dlg.querySelector('#sv-notas').value.trim()};
  const alcance = [...dlg.querySelectorAll('[data-sv-no]:checked')].map(c => ({servidor_id:id, no_id:c.dataset.svNo, peso:Math.max(0.1, +dlg.querySelector('[data-sv-peso="' + c.dataset.svNo + '"]').value || 1)}));
  if (!alcance.length){ toast('Marque onde o servidor se aplica (o projeto inteiro ou as aplicações)'); return; }
  const linhas = sel => [...dlg.querySelectorAll(sel)].map(l => Object.fromEntries([...l.querySelectorAll('[data-k]')].map(i => [i.dataset.k, i.value.trim()])));
  const servicos = linhas('[data-sv-serv]').filter(x => x.nome).map((x, i) => ({servidor_id:id, nome:x.nome.slice(0, 120), tipo:x.tipo, tecnologia:x.tecnologia, versao:x.versao, porta:x.porta ? Math.min(65535, Math.max(1, +x.porta)) : null, endereco:x.endereco, no_id:x.no_id || null, caminho:x.caminho, ordem:i}));
  const custos = linhas('[data-sv-custo]').filter(x => x.descricao && x.valor !== '');
  const ruim = custos.find(x => x.fim && x.fim < (x.inicio || iso(HOJE))); if (ruim){ toast('O fim do custo "' + ruim.descricao + '" está antes do início'); return; }
  const cRows = custos.map(x => ({servidor_id:id, descricao:x.descricao.slice(0, 200), valor:Math.max(0, +x.valor || 0), moeda:x.moeda, recorrencia:x.recorrencia, inicio:x.inicio || iso(HOJE), fim:x.fim || null}));
  const botao = dlg.querySelector('.modal-rod .btn:not(.sec)'); if (botao) botao.disabled = true;
  try {
    if (antigo.id){ const {data, error} = await sb.from('servidores').update(row).eq('id', id).select('id'); if (error) throw error; if (!data || !data.length) throw new Error('o banco não deixou mudar este servidor (só quem edita o ponto dono muda)'); }
    else { const {error} = await sb.from('servidores').insert(Object.assign({id, no_id:svIdDe(base)}, row)); if (error) throw error; }
    // o que está dentro é regravado inteiro (onde se aplica, o que roda e os custos)
    for (const t of ['servidores_alcance', 'servidores_servicos', 'servidores_custos']){ const {error} = await sb.from(t).delete().eq('servidor_id', id); if (error) throw error; }
    for (const [t, rows] of [['servidores_alcance', alcance], ['servidores_servicos', servicos], ['servidores_custos', cRows]]) if (rows.length){ const {error} = await sb.from(t).insert(rows); if (error) throw error; }
  } catch (e){ if (botao) botao.disabled = false; toast('Não deu para gravar: ' + (e.message || e)); return; }
  dlg.close(); dlg.remove();
  await svCarregar(true); rView(); toast(antigo.id ? 'Servidor salvo' : 'Servidor cadastrado');
}
function svApagar(id){
  const s = SRV.lista.find(x => x.id === id); if (!s) return;
  modal('Excluir servidor', '<p>Excluir <b>' + esc(s.nome) + '</b>, com o que roda nela, onde se aplica e os custos? Para só parar de contar, troque a situação para Desligado.</p>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Excluir', acao:() => { (async () => { const {data, error} = await svBanco().from('servidores').delete().eq('id', id).select('id');
      if (error || !data || !data.length){ toast('Não deu para excluir: ' + (error ? error.message : 'o banco não deixou')); return; } await svCarregar(true); rView(); toast('Servidor excluído'); })(); }}]);
}
// renovação chegando: vira item na frente Infraestrutura de uma aplicação atendida
function svRenovar(id){
  const s = SRV.lista.find(x => x.id === id); if (!s) return;
  const apps = svDivisao(s).map(d => d.app).concat(svAlcanceDe(s).flatMap(a => svAppsDe(a.no_id)));
  const app = apps[0] || (UI.sel.startsWith('app:') ? svIdDe(UI.sel) : null);
  const w = app && ((typeof frenteSugerida === 'function' && frenteSugerida(app, '', 'infraestrutura')) || byId('ws', primeiroWs('app:' + app)));
  if (!w){ toast('Não achei uma aplicação com frente para criar o item'); return; }
  const titulo = 'Renovar o servidor ' + s.nome + (s.renova_em ? ' (vence em ' + svDia(s.renova_em) + ')' : '');
  if (D.issues.some(i => !i.arquivado && i.titulo === titulo)){ toast('O item de renovação já existe'); return; }
  const ni = novoIssue({titulo, ws:w.id, tipo:'task', status:'todo', prio:'high', fim:s.renova_em || iso(HOJE), alvo:s.renova_em || iso(HOJE), resp:s.responsavel_id || null});
  ni.desc = 'Renovação do servidor ' + s.nome + ' (' + [s.provedor, s.plano].filter(Boolean).join(' · ') + '). Custo mensal hoje: ' + brl(svCustoMensal(s)) + '.';
  ni.crit = [{t:'Contrato renovado e a nova data de renovação anotada no cadastro do servidor', f:false}];
  D.issues.push(ni); registrar('criou', ni); salvar(); toast('Item criado na frente ' + w.nome);
}

/* ---------- ligações com o resto do sistema ---------- */
// Custos: a parte dos servidores neste ponto
function svCustosHTML(chave){
  if (!svBanco() || !svPodeTer(chave)) return '';
  if (!SRV.lido){ svCarregar().then(() => { if (UI.view === 'custos') rView(); }); return ''; }
  const lista = svDoPonto(chave).filter(s => s.status !== 'desligado'); if (!lista.length) return '';
  return '<h2 class="sub">Servidores <span class="rotulo-mini">' + lista.length + '</span></h2><div class="tabela-rolo"><table class="tabela"><thead><tr><th>Servidor</th><th>Onde se aplica</th><th>Custo do servidor por mês</th><th>Parte deste ponto por mês</th></tr></thead><tbody>' +
    lista.map(s => '<tr><th scope="row">' + esc(s.nome) + '<div class="sec" style="font-family:var(--font-body);font-size:12px;font-weight:400">' + esc([s.provedor, s.plano].filter(Boolean).join(' · ')) + '</div></th><td>' + esc(svAlcanceDe(s).map(a => svChaveDe(a.no_id) ? nomeDe(svChaveDe(a.no_id)) : '').filter(Boolean).join(', ')) + '</td><td>' + brl(svCustoMensal(s)) + '</td><td><b>' + brl(svParte(s, chave)) + '</b></td></tr>').join('') +
    '</tbody></table></div><p class="sec" style="font-size:12.5px">A parte deste ponto segue a divisão de cada servidor (por igual entre as aplicações atendidas, ou por peso). O cadastro fica na aba Servidores.</p>';
}
// Ficha técnica: a seção Ambientes mostra os servidores que atendem o ponto
function svFichaLigacao(sec, chave){
  if (sec !== 'Environments' || !svBanco()) return '';
  if (!SRV.lido){ svCarregar().then(() => { if (UI.view === 'sheet') rView(); }); return ''; }
  const lista = svDoPonto(chave).filter(s => s.status !== 'desligado'); if (!lista.length) return '';
  return '<ul class="sv-ficha">' + lista.map(s => '<li><b>' + esc(svNome(SV_AMB, s.ambiente)) + ':</b> ' + esc(s.nome) + ' <span>' + esc([s.provedor, s.plano, s.sistema, s.hostname].filter(Boolean).join(' · ')) + '</span>' +
    (svServicosDe(s).length ? '<small>roda: ' + esc(svServicosDe(s).map(x => x.nome).join(', ')) + '</small>' : '') + '</li>').join('') + '</ul>';
}

/* ---------- aba ---------- */
const _rViewSv = rView;
rView = function(){
  const c = $('#ops-corpo');
  if (c && UI.view === 'servidores'){
    if (!svPodeTer(UI.sel)){ UI.view = 'dashboard'; return _rViewSv.apply(this, arguments); }
    c.innerHTML = svTelaHTML(); if (typeof smAgruparAbas === 'function') smAgruparAbas();
    if (!SRV.lido || SRV.chave !== UI.sel){ SRV.chave = UI.sel; svCarregar(true).then(() => { if (UI.view === 'servidores') { const c2 = $('#ops-corpo'); if (c2){ c2.innerHTML = svTelaHTML(); if (typeof smAgruparAbas === 'function') smAgruparAbas(); } } }); }
    return;
  }
  return _rViewSv.apply(this, arguments);
};
const _rOperacoesSv = rOperacoes;
rOperacoes = function(){
  _rOperacoesSv.apply(this, arguments);
  if (!svPodeTer(UI.sel)){ const b = $('.view-b[data-view="servidores"]'); if (b) (b.closest('.view-casa') || b).remove(); if (UI.view === 'servidores'){ UI.view = 'dashboard'; rView(); } }
};
if (typeof vCustosEscopo === 'function'){ const _vCustosSv = vCustosEscopo; vCustosEscopo = function(chave){ return _vCustosSv.apply(this, arguments) + svCustosHTML(chave); }; }
VIEWS.push(['servidores', 'Servidores', 'cadastro das VPS e máquinas: o que roda, onde se aplica e quanto custa']);
if (typeof SM_ABAS !== 'undefined') SM_ABAS.servidores = ['Servidores', 'O cadastro das VPS e máquinas onde o sistema roda: provedor, plano, CPU, memória, disco, rede, onde fica o acesso (nunca a senha), o que roda em cada uma, onde se aplica (o projeto inteiro ou só uma aplicação) e os custos, divididos entre as aplicações.'];
if (typeof SM_DICA !== 'undefined') SM_DICA.servidores = 'cadastro das VPS e máquinas';
if (typeof EXPL_VIEW !== 'undefined') EXPL_VIEW.servidores = 'Cadastro das VPS e máquinas: o que roda, onde se aplica e quanto custa.';
if (typeof SM_EXTRAS_PADRAO !== 'undefined' && !SM_EXTRAS_PADRAO.includes('servidores')){ SM_EXTRAS_PADRAO.push('servidores'); if (typeof SM_PRINCIPAIS !== 'undefined' && !SM_PRINCIPAIS.includes('servidores')) SM_PRINCIPAIS.push('servidores'); }

document.addEventListener('click', e => {
  if (!e.target.closest('#ops-corpo .sv-tela')) return;
  if (e.target.closest('[data-sv-novo]')) return svEditar(null);
  const ed = e.target.closest('[data-sv-editar]'); if (ed) return svEditar(ed.dataset.svEditar);
  const ap = e.target.closest('[data-sv-apagar]'); if (ap) return svApagar(ap.dataset.svApagar);
  const rn = e.target.closest('[data-sv-renovar]'); if (rn) return svRenovar(rn.dataset.svRenovar);
});
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {SRV, svCarregar, svDivisao, svParte, svCustoMensal, svDoPonto, svRelacao, svFichaLigacao, svCustosHTML});
