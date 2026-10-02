/* ===== Servidores: cadastro de VPS, dedicado e nuvem (parte 47) =====
   A máquina (provedor, plano, sistema, CPU, memória, disco, rede, contrato, backup, monitoramento e ONDE fica o acesso,
   nunca a senha), onde ela se aplica (cliente, projeto ou produto valem para todas as aplicações de dentro; aplicação,
   só para ela), o que roda nela (cada serviço com a aplicação que atende) e os custos, divididos entre as aplicações
   atendidas (por igual, por peso, por percentual ou por valor; o que não fecha aparece como restante). Cada custo tem
   recorrência (mensal, trimestral, semestral, anual ou único) e renova até cancelar ou para numa data; o banco gera um
   lançamento por período (parte 50). Aparece também em Custos, na Ficha técnica (Ambientes) e vira item na frente
   Infraestrutura quando a renovação está chegando. Tudo direto no banco, com as regras de acesso da parte 47. */
const SRV = {lido:false, carregando:null, erro:'', lista:[], alcance:[], servicos:[], custos:[], lancamentos:[]};
const SV_TIPOS = [['vps','VPS'],['dedicado','Dedicado'],['nuvem','Máquina na nuvem'],['container','Container gerenciado'],['fisico','Servidor físico'],['outro','Outro']];
const SV_AMB = [['producao','Produção'],['homologacao','Homologação'],['desenvolvimento','Desenvolvimento'],['backup','Backup'],['outro','Outro']];
const SV_STATUS = [['ativo','Ativo'],['pausado','Pausado'],['desligado','Desligado']];
const SV_SERV = [['aplicacao','Aplicação'],['api','API'],['site','Site'],['banco','Banco de dados'],['proxy','Proxy / servidor web'],['container','Container'],['fila','Fila'],['cache','Cache'],['agendada','Rotina agendada'],['monitoramento','Monitoramento'],['backup','Backup'],['painel','Painel'],['outro','Outro']];
const SV_REC = [['mensal','Mensal'],['trimestral','Trimestral'],['semestral','Semestral'],['anual','Anual'],['unico','Único (uma vez)']];
const SV_MESES = {mensal:1, trimestral:3, semestral:6, anual:12};
const SV_RATEIO = [['igual','Por igual entre as aplicações'],['percentual','Por percentual (%) de cada aplicação'],['valor','Por valor (R$ por mês) de cada aplicação'],['peso','Por peso de cada aplicação']];
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
      const [s, a, v, c, l] = await Promise.all([sb.from('servidores').select('*').order('nome').limit(2000), sb.from('servidores_alcance').select('*').limit(10000),
        sb.from('servidores_servicos').select('*').order('ordem').limit(20000), sb.from('servidores_custos').select('*').limit(20000),
        sb.from('servidores_lancamentos').select('*').order('competencia').limit(50000)]);
      const e = [s, a, v, c].find(x => x.error); if (e) throw e.error;
      SRV.lista = s.data || []; SRV.alcance = a.data || []; SRV.servicos = v.data || []; SRV.custos = c.data || []; SRV.lancamentos = l.error ? [] : (l.data || []); SRV.erro = '';
    } catch (e){ SRV.erro = e.message || String(e); }
    SRV.lido = true; SRV.carregando = null;
  })();
  return SRV.carregando;
}
const svAlcanceDe = s => SRV.alcance.filter(a => a.servidor_id === s.id);
const svServicosDe = s => SRV.servicos.filter(a => a.servidor_id === s.id).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
const svCustosDe = s => SRV.custos.filter(a => a.servidor_id === s.id);
const svLancamentosDe = s => SRV.lancamentos.filter(a => a.servidor_id === s.id);
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
// o custo de um item por mês (trimestral /3, semestral /6, anual /12; único não entra no mês)
const svMensalDe = c => SV_MESES[c.recorrencia] ? svBRL(+c.valor || 0, c.moeda) / SV_MESES[c.recorrencia] : 0;
const svCustoVale = (c, m) => !(String(c.inicio).slice(0, 7) > m || (c.fim && String(c.fim).slice(0, 7) < m));
function svCustoMensal(s){ const m = svMesAtual(); return svCustosDe(s).reduce((t, c) => t + (svCustoVale(c, m) ? svMensalDe(c) : 0), 0); }
const svCustoUnico = s => svCustosDe(s).filter(c => c.recorrencia === 'unico').reduce((t, c) => t + svBRL(+c.valor || 0, c.moeda), 0);
// as aplicações atendidas e a parte de cada uma. Igual: o mesmo para todas. Peso, percentual e valor: o da linha da
// própria aplicação; sem linha própria, o do ponto de cima (projeto, produto, cliente) dividido entre as aplicações dele.
// Percentual e valor podem não fechar 100%: o que sobra fica em "restante" (sem dono).
function svDivisao(s, mensal){
  const al = svAlcanceDe(s), modo = s.rateio || 'igual', prop = new Map(), cobre = new Map();
  if (mensal == null) mensal = svCustoMensal(s);
  for (const a of al) for (const x of svAppsDe(a.no_id)) { if (!cobre.has(x)) cobre.set(x, []); cobre.get(x).push(a); }
  const campo = a => modo === 'peso' ? (a.peso == null ? 1 : +a.peso) : modo === 'percentual' ? +a.percentual || 0 : +a.valor || 0;
  for (const [x, linhas] of cobre){
    if (modo === 'igual'){ prop.set(x, 1); continue; }
    const propria = linhas.find(a => a.no_id === x);
    prop.set(x, propria ? campo(propria) : linhas.reduce((t, a) => t + campo(a) / svAppsDe(a.no_id).length, 0));
  }
  const tot = [...prop.values()].reduce((t, v) => t + v, 0);
  const fr = v => modo === 'percentual' ? v / 100 : modo === 'valor' ? (mensal ? v / mensal : 0) : (tot ? v / tot : 0);
  const lista = [...prop.entries()].map(([app, v]) => ({app, fracao:fr(v)}));
  lista.restante = Math.max(0, 1 - lista.reduce((t, d) => t + d.fracao, 0));
  lista.passou = lista.reduce((t, d) => t + d.fracao, 0) > 1.0001;
  return lista;
}
// lançamentos: cada período do custo, do início até hoje (ou até o fim). O banco grava; aqui serve para mostrar e conferir.
function svPeriodos(c, ate){
  const ini = String(c.inicio || '').slice(0, 10); if (!ini) return [];
  const fim = [c.fim ? String(c.fim).slice(0, 10) : null, ate || iso(HOJE)].filter(Boolean).sort()[0];
  if (ini > fim) return []; if (c.recorrencia === 'unico') return [ini];
  const passo = SV_MESES[c.recorrencia] || 1, out = []; const [y, m, d] = ini.split('-').map(Number);
  for (let k = 0; k < 1200; k++){ const dt = new Date(y, m - 1 + k * passo, 1); const ult = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
    const s2 = iso(new Date(dt.getFullYear(), dt.getMonth(), Math.min(d, ult))); if (s2 > fim) break; out.push(s2); }
  return out;
}
function svProximo(c){
  if (c.recorrencia === 'unico') return String(c.inicio) > iso(HOJE) ? String(c.inicio) : null;
  const futuro = svPeriodos(c, iso(new Date(HOJE.getFullYear() + 2, HOJE.getMonth(), HOJE.getDate()))).find(x => x > iso(HOJE));
  return futuro && (!c.fim || futuro <= String(c.fim)) ? futuro : null;
}
// quanto do custo mensal cai neste ponto
function svParte(s, sel){
  const mensal = svCustoMensal(s), div = svDivisao(s, mensal); if (!mensal) return 0;
  if (!div.length){ const r = svRelacao(s, sel); return r && r.tipo !== 'herdado' ? mensal : 0; }
  const dentro = new Set(svDentro(sel)); return div.filter(d => dentro.has(d.app)).reduce((t, d) => t + d.fracao * mensal, 0);
}
// o custo do plano (o contrato) e a próxima renovação, calculada pela recorrência dele
const svPrincipalDe = s => { const cs = svCustosDe(s); return cs.find(c => c.principal) || null; };
function svRenovaEm(s){ const pr = svPrincipalDe(s); if (!pr) return s.renova_em || null; return pr.recorrencia === 'unico' ? null : svProximo(pr); }
const svDiasAte = d => d ? Math.round((parse(String(d).slice(0, 10)) - HOJE) / 86400000) : null;

/* ---------- a tela ---------- */
function svTelaHTML(){
  const sb = svBanco(), pode = podeEditar(), sel = UI.sel;
  if (!sb) return '<div class="sv-tela"><p class="sv-vazio">O cadastro de servidores precisa do banco do CicloDev ligado.</p></div>';
  if (!SRV.lido) return '<div class="sv-tela"><p class="sv-vazio">Carregando os servidores…</p></div>';
  if (SRV.erro) return '<div class="sv-tela"><p class="entrada-erro">Não deu para ler os servidores: ' + esc(SRV.erro) + '</p></div>';
  const lista = svDoPonto(sel), ativos = lista.filter(s => s.status !== 'desligado');
  const mensal = ativos.reduce((t, s) => t + svCustoMensal(s), 0), parte = ativos.reduce((t, s) => t + svParte(s, sel), 0);
  const renov = ativos.filter(s => { const d = svDiasAte(svRenovaEm(s)); return d != null && d <= 30; });
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
  const dias = svDiasAte(svRenovaEm(s)), pess = s.responsavel_id && pessoa(s.responsavel_id);
  const espec = [s.cpu != null ? s.cpu + ' vCPU' : '', s.memoria_gb != null ? (+s.memoria_gb) + ' GB de memória' : '', s.disco_gb != null ? (+s.disco_gb) + ' GB ' + (s.disco_tipo ? s.disco_tipo.toUpperCase() : 'de disco') : '', s.banda_tb != null ? (+s.banda_tb) + ' TB de tráfego' : ''].filter(Boolean);
  const lin = (rot, v) => v ? '<div class="sv-lin"><dt>' + rot + '</dt><dd>' + v + '</dd></div>' : '';
  return '<article class="sv-card sv-st-' + esc(s.status) + '" data-sv="' + esc(s.id) + '">' +
    '<header class="sv-cab"><div class="sv-tit"><h3>' + esc(s.nome) + '</h3><p>' + esc([s.provedor, s.plano, s.regiao].filter(Boolean).join(' · ') || 'Provedor não informado') + '</p></div>' +
      '<div class="sv-chips"><span class="sv-chip">' + esc(svNome(SV_TIPOS, s.tipo)) + '</span><span class="sv-chip sv-amb-' + esc(s.ambiente) + '">' + esc(svNome(SV_AMB, s.ambiente)) + '</span><span class="sv-chip sv-chip-st">' + esc(svNome(SV_STATUS, s.status)) + '</span><span class="sv-chip sv-rel">' + esc(rel) + '</span></div></header>' +
    (espec.length || s.sistema ? '<p class="sv-espec">' + esc([s.sistema].concat(espec).filter(Boolean).join(' · ')) + '</p>' : '') +
    '<div class="sv-grade">' +
      '<section><h4>Onde se aplica</h4>' + (al.length ? '<ul class="sv-onde">' + al.map(a => { const k = svChaveDe(a.no_id), n = svAppsDe(a.no_id).length;
          return '<li><b>' + esc(k ? nomeDe(k) : 'Ponto sem acesso') + '</b><small>' + esc(k ? ({client:'cliente', project:'projeto', product:'produto', app:'aplicação'})[k.split(':')[0]] : '') + (k && !k.startsWith('app:') ? ' · vale para ' + n + (n === 1 ? ' aplicação' : ' aplicações') : '') + (s.rateio === 'peso' && a.no_id && byId('apps', a.no_id) ? ' · peso ' + (+a.peso) : s.rateio === 'percentual' && a.percentual != null ? ' · ' + (+a.percentual).toLocaleString('pt-BR') + '%' : s.rateio === 'valor' && a.valor != null ? ' · ' + brl(+a.valor) + ' por mês' : '') + '</small></li>'; }).join('') + '</ul>' : '<p class="sv-vazio">Não diz onde se aplica.</p>') + '</section>' +
      '<section><h4>Custos</h4>' + (cs.length ? '<table class="sv-tab"><tbody>' + cs.map(c => { const prox = svProximo(c), enc = c.fim && String(c.fim) < iso(HOJE);
          return '<tr data-sv-custo-linha="' + esc(c.id) + '"><td>' + esc(c.descricao) + '<small>' + (c.recorrencia === 'unico' ? 'uma vez em ' + svDia(c.inicio) : enc ? 'encerrado em ' + svDia(c.fim) : c.fim ? 'para de cobrar em ' + svDia(c.fim) : 'renova até cancelar') + (prox ? ' · próximo lançamento ' + svDia(prox) : '') + '</small></td><td>' + esc(svNome(SV_REC, c.recorrencia)) + '</td><td class="sv-num">' + esc((c.moeda !== 'BRL' ? c.moeda + ' ' : 'R$ ') + (+c.valor).toLocaleString('pt-BR', {minimumFractionDigits:2})) + '</td>' +
            (pode && svPodeMudar(s) && c.recorrencia !== 'unico' && !enc && !c.fim ? '<td><button type="button" class="btn fant peq" data-sv-cancelar="' + esc(c.id) + '">Cancelar</button></td>' : '<td></td>') + '</tr>'; }).join('') + '</tbody></table>' +
          '<p class="sv-total">' + brl(mensal) + ' por mês' + (unico ? ' · ' + brl(unico) + ' em custo único' : '') + '</p>' + svLancHTML(s) : '<p class="sv-vazio">Sem custo cadastrado.</p>') +
        (div.length && mensal ? '<h5>Divisão (' + esc(({igual:'por igual', peso:'por peso', percentual:'por percentual', valor:'por valor'})[s.rateio] || 'por igual') + ')</h5><ul class="sv-div">' + div.map(d => '<li><span>' + esc((byId('apps', d.app) || {}).nome || '') + '</span><b>' + brl(d.fracao * mensal) + '</b><small>' + (Math.round(d.fracao * 1000) / 10).toLocaleString('pt-BR') + '%</small></li>').join('') +
          (div.restante > 0.0001 ? '<li class="sv-resta"><span>Sem dono (falta distribuir)</span><b>' + brl(div.restante * mensal) + '</b><small>' + (Math.round(div.restante * 1000) / 10).toLocaleString('pt-BR') + '%</small></li>' : '') +
          (div.passou ? '<li class="sv-resta"><span>A divisão passa do custo do mês</span></li>' : '') + '</ul>' : '') + '</section>' +
    '</div>' +
    '<section><h4>O que roda nela' + (sv.length ? ' <small>' + sv.length + '</small>' : '') + '</h4>' + (sv.length ? '<div class="tabela-rolo"><table class="sv-tab sv-tab-l"><thead><tr><th>Serviço</th><th>Tipo</th><th>Tecnologia</th><th>Porta</th><th>Endereço</th><th>Atende</th></tr></thead><tbody>' +
        sv.map(x => '<tr><td><b>' + esc(x.nome) + '</b>' + (x.caminho ? '<small>' + esc(x.caminho) + '</small>' : '') + '</td><td>' + esc(svNome(SV_SERV, x.tipo)) + '</td><td>' + esc([x.tecnologia, x.versao].filter(Boolean).join(' ')) + '</td><td class="sv-num">' + (x.porta || '') + '</td><td>' + esc(x.endereco) + '</td><td>' + esc(x.no_id && svChaveDe(x.no_id) ? nomeDe(svChaveDe(x.no_id)) : '') + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="sv-vazio">Nada cadastrado ainda.</p>') + '</section>' +
    '<dl class="sv-info">' + lin('Endereço', esc([s.hostname, s.ip_publico].filter(Boolean).join(' · '))) + lin('IP interno', esc(s.ip_privado)) +
      lin('Painel', s.painel_url ? '<a href="' + esc(s.painel_url) + '" target="_blank" rel="noopener">' + esc(s.painel_url.replace(/^https?:\/\//, '')) + '</a>' : '') +
      lin('Onde fica o acesso', esc(s.acesso_onde)) + lin('Backup', esc(s.backup)) + lin('Monitoramento', esc(s.monitoramento)) + lin('Responsável', esc(pess ? pess.nome : '')) +
      lin('Contrato', esc([s.contratado_em ? 'desde ' + svDia(s.contratado_em) : '', svRenovaEm(s) ? 'renova em ' + svDia(svRenovaEm(s)) + (dias != null ? (dias < 0 ? ' (venceu há ' + -dias + ' dias)' : ' (em ' + dias + ' dias)') : '') : ''].filter(Boolean).join(', '))) +
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
// o que já foi lançado (o banco gera um por período; até ele gerar, mostra a conta)
function svLancHTML(s){
  const gravados = svLancamentosDe(s), cs = svCustosDe(s);
  const lista = gravados.length ? gravados.map(l => ({c:l.descricao, d:String(l.competencia), v:svBRL(+l.valor || 0, l.moeda)}))
    : cs.flatMap(c => svPeriodos(c).map(d => ({c:c.descricao, d, v:svBRL(+c.valor || 0, c.moeda)})));
  if (!lista.length) return '';
  lista.sort((a, b) => b.d.localeCompare(a.d)); const total = lista.reduce((t, x) => t + x.v, 0);
  return '<details class="sv-lanc"><summary>' + lista.length + (lista.length === 1 ? ' lançamento' : ' lançamentos') + ' até hoje · ' + brl(total) + '</summary><table class="sv-tab"><tbody>' +
    lista.slice(0, 60).map(x => '<tr><td>' + svDia(x.d) + '</td><td>' + esc(x.c) + '</td><td class="sv-num">' + brl(x.v) + '</td></tr>').join('') + '</tbody></table>' +
    (lista.length > 60 ? '<p class="sv-ajuda">Mostrando os 60 mais recentes.</p>' : '') + '</details>';
}
// custo extra (backup, IP, licença): só o que é dele; a moeda, o começo e a cobrança vêm do contrato
function svLinhaCusto(x){
  return '<div class="sv-ed-lin sv-ed-custo" data-sv-custo' + (x.id ? ' data-id="' + esc(x.id) + '" data-inicio="' + esc(x.inicio || '') + '" data-fim="' + esc(x.fim || '') + '"' : '') + '>' +
    '<label class="sv-c sv-c-desc">O quê<input class="campo" data-k="descricao" placeholder="Ex.: Backup, IP extra, licença do painel" value="' + esc(x.descricao || '') + '"></label>' +
    '<label class="sv-c">Valor<input class="campo" data-k="valor" type="number" min="0" step="0.01" placeholder="0,00" value="' + esc(x.valor == null ? '' : x.valor) + '"></label>' +
    '<label class="sv-c">Recorrência<select class="sel" data-k="recorrencia">' + svOpts(SV_REC, x.recorrencia || 'mensal') + '</select></label>' +
    '<button type="button" class="ico-btn" data-sv-tirar aria-label="Tirar">' + ICO.fechar + '</button></div>';
}
// os custos como estão na tela: o do plano (contrato) e os extras
function svCustosDaTela(dlg, antigo, id){
  const v = k => { const e = dlg.querySelector('#' + k); return e ? e.value.trim() : ''; };
  const desde = v('sv-desde') || iso(HOJE), moeda = v('sv-moeda') || 'BRL', para = v('sv-ate') === 'data', fim = para ? v('sv-fim') : '';
  const out = [], pr = svPrincipalDe(antigo || {});
  if (v('sv-valor') !== '') out.push({id:pr ? pr.id : null, principal:true, descricao:('Plano ' + v('sv-plano')).trim(), valor:v('sv-valor'), moeda, recorrencia:v('sv-rec') || 'mensal', inicio:desde, fim});
  dlg.querySelectorAll('[data-sv-custo]').forEach(l => { const g = k => l.querySelector('[data-k="' + k + '"]').value.trim();
    if (!g('descricao') && g('valor') === '') return;
    // extra novo num servidor que já existe começa hoje; num servidor novo, junto com o contrato
    const ini = l.dataset.inicio || (antigo && antigo.id && desde < iso(HOJE) ? iso(HOJE) : desde);
    out.push({id:l.dataset.id || null, principal:false, descricao:g('descricao'), valor:g('valor'), moeda, recorrencia:g('recorrencia'), inicio:ini, fim:l.dataset.fim || fim}); });
  return out.map(c => Object.assign(c, {fim:c.recorrencia === 'unico' ? '' : c.fim}));
}
function svEditar(id){
  if (!svBanco()){ toast('Precisa do banco do CicloDev ligado.'); return; }
  const s = id ? SRV.lista.find(x => x.id === id) : {tipo:'vps', ambiente:'producao', status:'ativo', rateio:'igual', disco_tipo:''};
  if (!s) return;
  const base = id ? (svChaveDe(s.no_id) || UI.sel) : UI.sel, pontos = svPontosDoCliente(base), apps = pontos.filter(p => p.tipo === 'aplicação');
  // novo: o ponto da tela já vem marcado com tudo o que está dentro dele
  let al = id ? svAlcanceDe(s) : [{no_id:svIdDe(UI.sel), peso:1}];
  if (!id){ const i0 = pontos.findIndex(p => p.id === svIdDe(UI.sel)); if (i0 >= 0) for (let i = i0 + 1; i < pontos.length && pontos[i].nivel > pontos[i0].nivel; i++) al.push({no_id:pontos[i].id, peso:1}); }
  const marcado = new Map(al.map(a => [a.no_id, a]));
  // o que está marcado vale para o que está dentro: abre já com as aplicações de dentro marcadas
  pontos.forEach((p, i) => { if (!marcado.has(p.id)) return; for (let j = i + 1; j < pontos.length && pontos[j].nivel > p.nivel; j++) if (!marcado.has(pontos[j].id)) marcado.set(pontos[j].id, {no_id:pontos[j].id, peso:1, herdado:true}); });
  const custos = svCustosDe(s), pr = svPrincipalDe(s); const pessoas = D.people.filter(p => p.acesso !== 'stakeholder');
  const parteHTML = p => { const a = marcado.get(p.id) || {};
    return p.tipo !== 'aplicação' ? '' : '<span class="sv-parte"><input class="campo sv-in-peso" type="number" min="0.1" step="0.1" data-sv-peso="' + esc(p.id) + '" value="' + esc(a.peso != null ? +a.peso : 1) + '" title="Peso na divisão" aria-label="Peso de ' + esc(p.nome) + '">' +
      '<input class="campo sv-in-pct" type="number" min="0" max="100" step="0.01" data-sv-pct="' + esc(p.id) + '" value="' + esc(a.percentual != null ? +a.percentual : '') + '" placeholder="%" aria-label="Percentual de ' + esc(p.nome) + '"><i class="sv-in-pct">%</i>' +
      '<i class="sv-in-val">R$</i><input class="campo sv-in-val" type="number" min="0" step="0.01" data-sv-val="' + esc(p.id) + '" value="' + esc(a.valor != null ? +a.valor : '') + '" placeholder="0,00" aria-label="Valor por mês de ' + esc(p.nome) + '">' +
      '<output class="sv-calc" data-sv-calc="' + esc(p.id) + '"></output></span>'; };
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
    '<fieldset><legend>Contrato e custo</legend><p class="sv-ajuda">O valor do plano e de quanto em quanto tempo ele é cobrado. "Renova até cancelar" lança o valor todo período até você cancelar; "Para numa data" para de cobrar no dia escolhido. A próxima renovação é calculada sozinha.</p><div class="grade-form">' +
      svCampo('Contratado em', svIn('sv-desde', s.contratado_em || (id ? '' : iso(HOJE)), ' type="date"')) +
      svCampo('Valor do plano', svIn('sv-valor', pr ? pr.valor : '', ' type="number" min="0" step="0.01" placeholder="0,00"')) +
      svCampo('Moeda', '<select class="sel" id="sv-moeda">' + svOpts([['BRL','R$'],['USD','US$'],['EUR','€']], pr ? pr.moeda : (custos[0] || {}).moeda || 'BRL') + '</select>') +
      svCampo('Recorrência', '<select class="sel" id="sv-rec">' + svOpts(SV_REC, pr ? pr.recorrencia : 'mensal') + '</select>') +
      svCampo('Cobrança', '<select class="sel" id="sv-ate">' + svOpts([['sempre','Renova até cancelar'],['data','Para numa data']], pr && pr.fim ? 'data' : 'sempre') + '</select>') +
      '<label class="lb" id="sv-fim-lb"' + (pr && pr.fim ? '' : ' hidden') + '>Para em' + svIn('sv-fim', pr ? pr.fim : '', ' type="date"') + '</label>' +
      '<p class="sv-prox" id="sv-prox" aria-live="polite"></p></div>' +
      '<h5 class="sv-ed-sub">Custos extras <small>backup, IP extra, licença... (opcional)</small></h5>' +
      '<div class="sv-ed-lista" data-sv-custos>' + custos.filter(c => !c.principal).map(svLinhaCusto).join('') + '</div><button type="button" class="btn sec peq" data-sv-mais-custo>+ Custo extra</button></fieldset>' +
    '<fieldset><legend>Onde se aplica e quem paga</legend><p class="sv-ajuda">Marcar o cliente, um projeto ou um produto marca todas as aplicações de dentro. Depois escolha como dividir o custo entre elas.</p>' +
      '<div class="grade-form">' + svCampo('Divisão do custo', '<select class="sel" id="sv-rateio">' + svOpts(SV_RATEIO, s.rateio || 'igual') + '</select>') + '</div>' +
      '<div class="sv-ed-onde">' + pontos.map(p => '<label class="sv-ed-no" style="padding-left:' + (p.nivel * 18) + 'px"><input type="checkbox" data-sv-no="' + esc(p.id) + '" data-nivel="' + p.nivel + '"' + (marcado.has(p.id) ? ' checked' : '') + '> <b>' + esc(p.nome) + '</b> <small>' + esc(p.tipo) + '</small>' + parteHTML(p) + '</label>').join('') + '</div>' +
      '<div class="sv-resumo" data-sv-resumo aria-live="polite"></div>' +
      '<button type="button" class="btn sec peq sv-so-div" data-sv-igualar>Dividir o que falta por igual</button></fieldset>' +
    '<fieldset><legend>O que roda nela</legend><div class="sv-ed-lista" data-sv-servs>' + svServicosDe(s).map(x => svLinhaServico(x, apps)).join('') + '</div><button type="button" class="btn sec peq" data-sv-mais-serv>+ Serviço</button></fieldset>' +
    '<fieldset><legend>Anotações</legend><textarea class="campo" id="sv-notas" rows="3" maxlength="4000">' + esc(s.notas || '') + '</textarea></fieldset>' +
  '</div>';
  const dlg = modal(id ? 'Editar servidor' : 'Cadastrar servidor', corpo, [{txt:'Cancelar', cls:'sec'}, {txt:id ? 'Salvar' : 'Cadastrar', acao:d => { svSalvar(d, s, base); return false; }}]);
  dlg.classList.add('sv-modal');
  const caixas = () => [...dlg.querySelectorAll('[data-sv-no]')];
  // a divisão com o que está na tela agora (mesma conta do cartão)
  const conta = () => {
    const modo = dlg.querySelector('#sv-rateio').value;
    const cs = svCustosDaTela(dlg, s).filter(x => x.valor !== ''), m = svMesAtual();
    const mensal = cs.reduce((t, c) => t + (svCustoVale(Object.assign({}, c, {fim:c.fim || null}), m) ? svMensalDe(c) : 0), 0);
    const pc = cs.find(c => c.principal), px = dlg.querySelector('#sv-prox');
    if (px){ const prox = pc && pc.recorrencia !== 'unico' ? svProximo(Object.assign({}, pc, {fim:pc.fim || null})) : null;
      px.innerHTML = !pc ? 'Coloque o valor do plano para calcular a renovação.' : pc.recorrencia === 'unico' ? 'Pago uma vez, sem renovação.' : (prox ? 'Próxima renovação: <b>' + svDia(prox) + '</b>' : 'Sem próxima renovação') + (pc.fim ? ' · para de cobrar em <b>' + svDia(pc.fim) + '</b>' : ' · renova até cancelar'); }
    const tmp = {id:'__sv_tela', rateio:modo}, guard = SRV.alcance;
    SRV.alcance = guard.filter(a => a.servidor_id !== tmp.id).concat(svAlcanceDaTela(dlg, tmp.id));
    const div = svDivisao(tmp, mensal); SRV.alcance = guard;
    dlg.classList.toggle('sv-modo-peso', modo === 'peso'); dlg.classList.toggle('sv-modo-pct', modo === 'percentual'); dlg.classList.toggle('sv-modo-val', modo === 'valor');
    dlg.querySelectorAll('[data-sv-calc]').forEach(o => { const d = div.find(x => x.app === o.dataset.svCalc); o.textContent = d && mensal ? '= ' + brl(d.fracao * mensal) + ' (' + (Math.round(d.fracao * 1000) / 10).toLocaleString('pt-BR') + '%)' : ''; });
    const dist = div.reduce((t, d) => t + d.fracao, 0);
    dlg.querySelector('[data-sv-resumo]').innerHTML = '<span>Custo por mês: <b>' + brl(mensal) + '</b></span><span>Distribuído: <b>' + brl(Math.min(dist, 9e9) * mensal) + '</b> (' + (Math.round(dist * 1000) / 10).toLocaleString('pt-BR') + '%)</span>' +
      '<span class="' + (div.passou ? 'sv-erro' : div.restante > 0.0001 ? 'sv-falta' : 'sv-ok') + '">' + (div.passou ? 'Passou do custo em <b>' + brl((dist - 1) * mensal) + '</b>' : 'Restando: <b>' + brl(div.restante * mensal) + '</b> (' + (Math.round(div.restante * 1000) / 10).toLocaleString('pt-BR') + '%)') + '</span>' +
      '<span>' + div.length + (div.length === 1 ? ' aplicação atendida' : ' aplicações atendidas') + '</span>';
    return {div, mensal, modo};
  };
  dlg.addEventListener('change', e => {
    const cx = e.target.closest('[data-sv-no]');
    if (cx){ const lista = caixas(), i = lista.indexOf(cx), n = +cx.dataset.nivel;
      // marcar ou desmarcar vale para tudo o que está dentro; desmarcar algo de dentro desmarca os de cima
      for (let j = i + 1; j < lista.length && +lista[j].dataset.nivel > n; j++) lista[j].checked = cx.checked;
      if (!cx.checked){ let nv = n; for (let j = i - 1; j >= 0 && nv > 0; j--) if (+lista[j].dataset.nivel < nv){ lista[j].checked = false; nv = +lista[j].dataset.nivel; } }
    }
    if (e.target.id === 'sv-ate'){ const f = dlg.querySelector('#sv-fim-lb'); f.hidden = e.target.value !== 'data'; if (e.target.value === 'data' && !dlg.querySelector('#sv-fim').value) dlg.querySelector('#sv-fim').value = iso(HOJE); }
    conta();
  });
  dlg.addEventListener('input', () => conta());
  dlg.addEventListener('click', e => {
    if (e.target.closest('[data-sv-mais-serv]')) dlg.querySelector('[data-sv-servs]').insertAdjacentHTML('beforeend', svLinhaServico({}, apps));
    if (e.target.closest('[data-sv-mais-custo]')) dlg.querySelector('[data-sv-custos]').insertAdjacentHTML('beforeend', svLinhaCusto({}));
    const t = e.target.closest('[data-sv-tirar]'); if (t){ t.closest('.sv-ed-lin').remove(); conta(); }
    if (e.target.closest('[data-sv-igualar]')){
      // as aplicações marcadas sem parte ficam com o que falta, em partes iguais
      const {modo, mensal, div} = conta(); if (modo !== 'percentual' && modo !== 'valor') return;
      const sem = caixas().filter(c => c.checked && dlg.querySelector((modo === 'percentual' ? '[data-sv-pct="' : '[data-sv-val="') + c.dataset.svNo + '"]')).map(c => dlg.querySelector((modo === 'percentual' ? '[data-sv-pct="' : '[data-sv-val="') + c.dataset.svNo + '"]')).filter(i => !(+i.value > 0));
      if (!sem.length){ toast('Todas as aplicações marcadas já têm parte'); return; }
      const falta = modo === 'percentual' ? div.restante * 100 : div.restante * mensal; if (falta <= 0.004){ toast('Não falta nada para distribuir'); return; }
      const cada = Math.floor(falta / sem.length * 100) / 100; sem.forEach((i, k) => { i.value = k === sem.length - 1 ? (Math.round((falta - cada * (sem.length - 1)) * 100) / 100) : cada; });
      conta();
    }
  });
  conta();
}
// as linhas de uma lista do formulário (custos, serviços), como objetos
const svLinhasDe = (dlg, sel) => [...dlg.querySelectorAll(sel)].map(l => Object.assign({id:l.dataset.id || null}, Object.fromEntries([...l.querySelectorAll('[data-k]')].map(i => [i.dataset.k, i.value.trim()]))));
// onde se aplica como está na tela (todas as caixas marcadas, com a parte de cada aplicação)
function svAlcanceDaTela(dlg, id){
  const num = (sel, k) => { const i = dlg.querySelector(sel + '="' + k + '"]'); return i && i.value !== '' ? +i.value : null; };
  return [...dlg.querySelectorAll('[data-sv-no]:checked')].map(c => { const k = c.dataset.svNo, pe = num('[data-sv-peso', k);
    return {servidor_id:id, no_id:k, peso:pe != null && pe > 0 ? Math.max(0.1, pe) : 1, percentual:num('[data-sv-pct', k), valor:num('[data-sv-val', k)}; });
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
    painel_url:painel, acesso_onde:acesso, backup:v('sv-backup'), monitoramento:v('sv-mon'), contratado_em:v('sv-desde') || null, renova_em:null, rateio:v('sv-rateio'), notas:dlg.querySelector('#sv-notas').value.trim()};
  const alcance = svAlcanceDaTela(dlg, id).map(a => Object.assign(a, {percentual:row.rateio === 'percentual' && a.percentual != null ? Math.min(100, Math.max(0, a.percentual)) : null, valor:row.rateio === 'valor' && a.valor != null ? Math.max(0, a.valor) : null}));
  if (!alcance.length){ toast('Marque onde o servidor se aplica (o cliente, o projeto inteiro ou as aplicações)'); return; }
  if (row.rateio === 'percentual' && alcance.reduce((t, a) => t + (a.percentual || 0), 0) > 100.0001){ toast('Os percentuais passam de 100%'); return; }
  const linhas = sel => svLinhasDe(dlg, sel);
  const servicos = linhas('[data-sv-serv]').filter(x => x.nome).map((x, i) => ({servidor_id:id, nome:x.nome.slice(0, 120), tipo:x.tipo, tecnologia:x.tecnologia, versao:x.versao, porta:x.porta ? Math.min(65535, Math.max(1, +x.porta)) : null, endereco:x.endereco, no_id:x.no_id || null, caminho:x.caminho, ordem:i}));
  if (v('sv-ate') === 'data' && !v('sv-fim')){ toast('Diga em que data o contrato para de cobrar'); return; }
  if (v('sv-ate') === 'data' && v('sv-fim') < (v('sv-desde') || iso(HOJE))){ toast('A data em que para de cobrar está antes da contratação'); return; }
  const custos = svCustosDaTela(dlg, antigo, id);
  const semNome = custos.find(x => !x.descricao || x.valor === ''); if (semNome){ toast('Cada custo extra precisa do que é e do valor'); return; }
  const cRows = custos.map(x => ({id:x.id || novoUuid(), servidor_id:id, principal:x.principal, descricao:x.descricao.slice(0, 200), valor:Math.max(0, +x.valor || 0), moeda:x.moeda, recorrencia:x.recorrencia, inicio:x.inicio, fim:x.fim && x.fim >= x.inicio ? x.fim : (x.fim ? x.inicio : null)}));
  const pc = cRows.find(c => c.principal); if (pc && pc.recorrencia !== 'unico') row.renova_em = svProximo(pc);
  const botao = dlg.querySelector('.modal-rod .btn:not(.sec)'); if (botao) botao.disabled = true;
  try {
    if (antigo.id){ const {data, error} = await sb.from('servidores').update(row).eq('id', id).select('id'); if (error) throw error; if (!data || !data.length) throw new Error('o banco não deixou mudar este servidor (só quem edita o ponto dono muda)'); }
    else { const {error} = await sb.from('servidores').insert(Object.assign({id, no_id:svIdDe(base)}, row)); if (error) throw error; }
    // onde se aplica e o que roda são regravados inteiros; os custos mudam no lugar (os lançamentos ficam ligados a eles)
    for (const t of ['servidores_alcance', 'servidores_servicos']){ const {error} = await sb.from(t).delete().eq('servidor_id', id); if (error) throw error; }
    for (const [t, rows] of [['servidores_alcance', alcance], ['servidores_servicos', servicos]]) if (rows.length){ const {error} = await sb.from(t).insert(rows); if (error) throw error; }
    const antes = new Set(svCustosDe(antigo).map(c => c.id)), agora = new Set(cRows.map(c => c.id));
    for (const c of svCustosDe(antigo)) if (!agora.has(c.id)){ const {error} = await sb.from('servidores_custos').delete().eq('id', c.id); if (error) throw error; }
    for (const c of cRows){
      if (antes.has(c.id)){ const {id:cid, ...resto} = c; const {data, error} = await sb.from('servidores_custos').update(resto).eq('id', cid).select('id'); if (error) throw error; if (!data || !data.length) throw new Error('o banco não deixou mudar o custo ' + c.descricao); }
      else { const {error} = await sb.from('servidores_custos').insert(c); if (error) throw error; }
    }
    if (cRows.length){ const {error} = await sb.rpc('servidores_lancar', {p_servidor:id}); if (error) console.warn('lançamentos', error.message); }
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
// cancelar um custo que renova: para de cobrar hoje (os lançamentos até aqui ficam)
function svCancelarCusto(cid){
  const c = SRV.custos.find(x => x.id === cid); if (!c) return;
  modal('Cancelar custo', '<p>Parar de cobrar <b>' + esc(c.descricao) + '</b> a partir de hoje (' + svDia(iso(HOJE)) + ')? Os lançamentos até aqui ficam no histórico.</p>',
    [{txt:'Voltar', cls:'sec'}, {txt:'Cancelar o custo', acao:() => { (async () => { const fim = String(c.inicio) > iso(HOJE) ? String(c.inicio) : iso(HOJE);
      const {data, error} = await svBanco().from('servidores_custos').update({fim}).eq('id', cid).select('id');
      if (error || !data || !data.length){ toast('Não deu para cancelar: ' + (error ? error.message : 'o banco não deixou')); return; }
      await svCarregar(true); rView(); toast('Custo cancelado: para de cobrar em ' + svDia(fim)); })(); }}]);
}
// renovação chegando: vira item na frente Infraestrutura de uma aplicação atendida
function svRenovar(id){
  const s = SRV.lista.find(x => x.id === id); if (!s) return;
  const apps = svDivisao(s).map(d => d.app).concat(svAlcanceDe(s).flatMap(a => svAppsDe(a.no_id)));
  const app = apps[0] || (UI.sel.startsWith('app:') ? svIdDe(UI.sel) : null);
  const w = app && ((typeof frenteSugerida === 'function' && frenteSugerida(app, '', 'infraestrutura')) || byId('ws', primeiroWs('app:' + app)));
  if (!w){ toast('Não achei uma aplicação com frente para criar o item'); return; }
  const ren = svRenovaEm(s), titulo = 'Renovar o servidor ' + s.nome + (ren ? ' (vence em ' + svDia(ren) + ')' : '');
  if (D.issues.some(i => !i.arquivado && i.titulo === titulo)){ toast('O item de renovação já existe'); return; }
  const ni = novoIssue({titulo, ws:w.id, tipo:'task', status:'todo', prio:'high', fim:ren || iso(HOJE), alvo:ren || iso(HOJE), resp:s.responsavel_id || null});
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
    '</tbody></table></div><p class="sec" style="font-size:12.5px">A parte deste ponto segue a divisão de cada servidor (por igual, por peso, por percentual ou por valor de cada aplicação). O cadastro fica na aba Servidores.</p>';
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
  const cn = e.target.closest('[data-sv-cancelar]'); if (cn) return svCancelarCusto(cn.dataset.svCancelar);
});
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {SRV, svCarregar, svDivisao, svParte, svCustoMensal, svPeriodos, svProximo, svRenovaEm, svDoPonto, svRelacao, svFichaLigacao, svCustosHTML});
