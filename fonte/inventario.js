/* ===== Inventário de TI por cliente (parte 48): a base — dados, painel e listas =====
   Cada cliente tem o seu inventário: equipamentos um a um (patrimônio, série, situação, com quem está), itens por
   quantidade (cabos, fontes) com saldo por local, licenças, funcionários do cliente (só cadastro, sem acesso),
   locais, histórico, conferência e cadastros. A situação só muda por movimentação (inv_movimentar no banco), que
   grava o histórico junto. Só o time que edita o cliente vê; stakeholder não vê.
   Arquivos: inventario.js (base), inventario_acoes.js (cadastros e movimentações), inventario_extra.js (termo,
   etiquetas, planilha, conferência e ligações com o resto do sistema). */
const INV = {cli:null, lido:false, carregando:null, erro:'', aba:'painel', d:{}, f:{q:'', sit:'', cat:'', local:'', func:'', dep:''}, preparado:{}};
const INV_TABELAS = [['categorias','inv_categorias'],['modelos','inv_modelos'],['locais','inv_locais'],['funcionarios','inv_funcionarios'],['fapps','inv_funcionarios_apps'],
  ['ativos','inv_ativos'],['ligacoes','inv_ligacoes'],['itens','inv_itens'],['saldos','inv_saldos'],['licencas','inv_licencas'],['lusos','inv_licencas_uso'],
  ['manut','inv_manutencoes'],['baixas','inv_baixas'],['termos','inv_termos'],['conferencias','inv_conferencias'],['citens','inv_conferencias_itens'],['anexos','inv_anexos'],['movs','inv_movimentos']];
const INV_SIT = {estoque:['Em estoque','#0E8A55'], uso_funcionario:['Em uso por funcionário','#3355E0'], uso_aplicacao:['Em uso por aplicação','#7C3AED'], uso_local:['Em uso no local','#0E7490'],
  emprestado:['Emprestado','#C26A00'], manutencao:['Em manutenção','#B45309'], aguardando:['Aguardando','#64748B'], defeito:['Com defeito','#DC2626'], perdido:['Perdido','#991B1B'], baixado:['Baixado','#71717A']};
const INV_MOV = {cadastro:'Cadastro', entrega:'Entregue ao funcionário', uso_aplicacao:'Em uso pela aplicação', uso_local:'Em uso no local', emprestimo:'Emprestado', devolucao:'Devolvido ao estoque',
  transferencia:'Mudou de local', manutencao:'Foi para manutenção', retorno_manutencao:'Voltou da manutenção', aguardando:'Aguardando', defeito:'Com defeito', perda:'Perdido', baixa:'Baixa',
  estorno:'Desfeito (estorno)', entrada:'Entrada no estoque', saida:'Saída do estoque', ajuste:'Ajuste de saldo'};
const INV_GRUPOS = [['computador','Computador'],['monitor','Monitor'],['periferico','Periférico'],['cabo','Cabo'],['energia','Energia'],['rede','Rede'],['telefonia','Telefonia'],['impressao','Impressão'],
  ['componente','Peça interna'],['consumivel','Consumível'],['armazenamento','Armazenamento'],['audio_video','Áudio e vídeo'],['mobiliario','Mobiliário'],['outro','Outro']];
const INV_PROP = [['proprio','Próprio do cliente'],['alugado','Alugado'],['comodato','Comodato'],['byod','Do funcionário (BYOD)']];
const INV_ABAS = [['painel','Painel'],['equipamentos','Equipamentos'],['estoque','Estoque'],['licencas','Licenças'],['funcionarios','Funcionários'],['locais','Locais'],
  ['historico','Histórico'],['conferencia','Conferência'],['cadastros','Categorias e modelos'],['planilha','Importar e exportar']];
const invBanco = () => (typeof COM_BANCO !== 'undefined' && COM_BANCO && window.ciclodevBanco && typeof BANCO !== 'undefined' && BANCO.carregado) ? window.ciclodevBanco : null;
const invPodeTer = sel => /^(client|project|product|app):/.test(sel || '') && UI.verComo !== 'stakeholder';
const invCliDe = sel => { const c = cadeia(sel || '').client; return c ? c.id : null; };
const invDia = s => s ? String(s).slice(8, 10) + '/' + String(s).slice(5, 7) + '/' + String(s).slice(0, 4) : '';
const invHoje = () => iso(HOJE);
const invDias = d => d ? Math.round((parse(String(d).slice(0, 10)) - HOJE) / 86400000) : null;
const invNum = v => v == null || v === '' ? null : +v;
const invCpf = c => c ? c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : '';
const invCpfMasc = c => c ? '***.' + c.slice(3, 6) + '.' + c.slice(6, 9) + '-**' : '';
const invOpts = (lista, v, vazio) => (vazio != null ? '<option value="">' + esc(vazio) + '</option>' : '') + lista.map(([k, n]) => '<option value="' + esc(k) + '"' + (String(k) === String(v == null ? '' : v) ? ' selected' : '') + '>' + esc(n) + '</option>').join('');
const invAchar = (t, id) => (INV.d[t] || []).find(x => x.id === id);

/* ---------- o que vale aqui: o cliente inteiro, ou só as aplicações do ponto escolhido ---------- */
function invEscopoApps(sel){
  const [t, id] = String(sel || '').split(':');
  if (t === 'app') return [id];
  if (t === 'product') return D.apps.filter(a => a.product === id).map(a => a.id);
  if (t === 'project') return D.apps.filter(a => a.project === id).map(a => a.id);
  return null;   // cliente: tudo
}
const invAppsDoCliente = cli => D.apps.filter(a => { const p = byId('projects', a.project); return p && p.client === cli && a.status !== 'archived'; });

/* ---------- dados ---------- */
async function invCarregar(forcar){
  const sb = invBanco(), cli = invCliDe(UI.sel); if (!sb || !cli){ INV.lido = true; return; }
  if (INV.carregando && !forcar && INV.cli === cli) return INV.carregando;
  INV.cli = cli;
  INV.carregando = (async () => {
    try {
      if (!INV.preparado[cli] && podeEditar()){ const {error} = await sb.rpc('inv_preparar', {p_cliente:cli}); if (!error) INV.preparado[cli] = true; }
      const rs = await Promise.all(INV_TABELAS.map(([, t]) => { let q = sb.from(t).select('*').eq('cliente_id', cli); if (t === 'inv_movimentos') q = q.order('em', {ascending:false}).limit(5000); else q = q.limit(20000); return q; }));
      const e = rs.find(r => r.error); if (e) throw e.error;
      if (INV.cli !== cli) return;
      const d = {}; INV_TABELAS.forEach(([k], i) => { d[k] = (rs[i].data || []).filter(x => x.cliente_id === cli); });
      d.movs.sort((a, b) => String(b.em).localeCompare(String(a.em)));
      INV.d = d; INV.erro = '';
    } catch (e){ INV.erro = e.message || String(e); }
    INV.lido = true; INV.carregando = null;
  })();
  return INV.carregando;
}
async function invRecarregar(){ await invCarregar(true); invRender(); }

/* ---------- nomes e contas ---------- */
const invCat = a => invAchar('categorias', a.categoria_id) || {nome:'', grupo:'outro', depreciacao_pct_ano:0};
const invModelo = a => a.modelo_id ? invAchar('modelos', a.modelo_id) : null;
function invNomeAtivo(a){
  const m = invModelo(a), base = a.descricao || (m ? [m.fabricante, m.modelo].filter(Boolean).join(' ') : '') || invCat(a).nome;
  return (a.patrimonio ? a.patrimonio + ' · ' : '') + base;
}
const invFunc = id => invAchar('funcionarios', id);
const invLocal = id => invAchar('locais', id);
function invLocalNome(id){ const l = invLocal(id); if (!l) return ''; const p = l.pai_id && invLocal(l.pai_id); return (p ? p.nome + ' › ' : '') + l.nome; }
const invAppNome = id => (byId('apps', id) || {}).nome || '';
function invOnde(a){
  if (a.situacao === 'uso_funcionario' || a.situacao === 'emprestado'){ const f = invFunc(a.funcionario_id); return (f ? f.nome : 'Funcionário') + (f && f.departamento ? ' · ' + f.departamento : '') + (a.situacao === 'emprestado' && a.devolucao_prevista ? ' · volta ' + invDia(a.devolucao_prevista) : ''); }
  if (a.situacao === 'uso_aplicacao') return invAppNome(a.aplicacao_id) + (a.local_id ? ' · ' + invLocalNome(a.local_id) : '');
  return invLocalNome(a.local_id);
}
const invSitHTML = s => { const x = INV_SIT[s] || [s, '#64748B']; return '<span class="inv-sit" style="--c:' + x[1] + '">' + esc(x[0]) + '</span>'; };
// valor atual pela depreciação em linha reta (taxa do equipamento, senão a da categoria)
function invValorAtual(a){
  if (a.valor_compra == null || !a.data_compra) return a.valor_compra == null ? null : +a.valor_compra;
  const pct = a.depreciacao_pct_ano != null ? +a.depreciacao_pct_ano : +invCat(a).depreciacao_pct_ano || 0;
  const anos = Math.max(0, (HOJE - parse(String(a.data_compra).slice(0, 10))) / (365.25 * 86400000));
  return Math.max(0, +a.valor_compra * (1 - pct / 100 * anos));
}
const invSaldoItem = (it, local) => (INV.d.saldos || []).filter(s => s.item_id === it.id && (!local || s.local_id === local)).reduce((t, s) => t + (+s.quantidade || 0), 0);
const invUsosLicenca = l => (INV.d.lusos || []).filter(u => u.licenca_id === l.id);
function invMensalLicenca(l){ if (l.valor == null) return 0; const v = svBRLInv(+l.valor, l.moeda); return l.recorrencia === 'mensal' ? v : l.recorrencia === 'anual' ? v / 12 : 0; }
const svBRLInv = (v, moeda) => typeof svBRL === 'function' ? svBRL(v, moeda) : paraBRL(v, moeda);
// o que está no escopo (cliente inteiro ou as aplicações do ponto): equipamentos da aplicação e dos funcionários que a usam
function invAtivosDoEscopo(sel){
  const apps = invEscopoApps(sel), lista = (INV.d.ativos || []);
  if (!apps) return lista;
  const funcs = new Set((INV.d.fapps || []).filter(x => apps.includes(x.no_id)).map(x => x.funcionario_id));
  return lista.filter(a => apps.includes(a.aplicacao_id) || (a.funcionario_id && funcs.has(a.funcionario_id)));
}

/* ---------- avisos do painel ---------- */
function invAlertas(){
  const L = [], ativos = (INV.d.ativos || []).filter(a => a.situacao !== 'baixado');
  ativos.forEach(a => {
    const g = invDias(a.garantia_ate); if (a.situacao !== 'perdido' && g != null && g >= 0 && g <= 30) L.push({tipo:'garantia', id:a.id, txt:'Garantia ' + (g ? 'vence em ' + g + ' dias' : 'vence hoje') + ': ' + invNomeAtivo(a), dias:g});
    const e = invDias(a.devolucao_prevista); if (a.situacao === 'emprestado' && e != null && e < 0) L.push({tipo:'emprestimo', id:a.id, txt:'Empréstimo atrasado ' + -e + ' dias: ' + invNomeAtivo(a) + ' (' + invOnde(a) + ')', dias:e});
    const c = invDias(a.contrato_fim); if (a.propriedade === 'alugado' && c != null && c <= 60) L.push({tipo:'aluguel', id:a.id, txt:'Aluguel ' + (c < 0 ? 'terminou há ' + -c + ' dias' : 'termina em ' + c + ' dias') + ': ' + invNomeAtivo(a), dias:c});
    const p = invDias(a.proxima_conferencia); if (p != null && p < 0) L.push({tipo:'conferencia', id:a.id, txt:'Conferência atrasada: ' + invNomeAtivo(a), dias:p});
    const f = a.funcionario_id && invFunc(a.funcionario_id); if (f && f.situacao === 'desligado') L.push({tipo:'desligado', id:a.id, txt:'Com funcionário desligado: ' + invNomeAtivo(a) + ' (' + f.nome + ')', dias:-999});
  });
  (INV.d.itens || []).filter(i => i.ativo && +i.estoque_minimo > 0 && invSaldoItem(i) < +i.estoque_minimo).forEach(i => L.push({tipo:'estoque', item:i.id, txt:'Estoque abaixo do mínimo: ' + i.nome + ' (' + invSaldoItem(i) + ' de ' + (+i.estoque_minimo) + ')', dias:0}));
  (INV.d.licencas || []).forEach(l => { const v = invDias(l.vence_em); if (v != null && v <= 30) L.push({tipo:'licenca', lic:l.id, txt:'Licença ' + (v < 0 ? 'venceu há ' + -v + ' dias' : 'vence em ' + v + ' dias') + ': ' + l.nome, dias:v}); });
  return L.sort((a, b) => a.dias - b.dias);
}

/* ---------- a tela ---------- */
function invTelaHTML(){
  const sb = invBanco(), cli = invCliDe(UI.sel), c = cli && byId('clients', cli);
  if (!sb) return '<div class="inv-tela"><p class="inv-vazio">O inventário precisa do banco do CicloDev ligado.</p></div>';
  if (!c) return '<div class="inv-tela"><p class="inv-vazio">Escolha um cliente.</p></div>';
  if (!INV.lido || INV.cli !== cli) return '<div class="inv-tela"><p class="inv-vazio">Carregando o inventário…</p></div>';
  if (INV.erro) return '<div class="inv-tela"><p class="entrada-erro">Não deu para ler o inventário: ' + esc(INV.erro) + '</p></div>';
  const escopo = invEscopoApps(UI.sel);
  if (escopo) return '<div class="inv-tela">' + invEscopoHTML(escopo) + '</div>';
  const aba = INV_ABAS.some(a => a[0] === INV.aba) ? INV.aba : 'painel';
  const corpo = {painel:invPainelHTML, equipamentos:invEquipamentosHTML, estoque:invEstoqueHTML, licencas:invLicencasHTML, funcionarios:invFuncionariosHTML, locais:invLocaisHTML,
    historico:invHistoricoHTML, conferencia:() => typeof invConferenciaHTML === 'function' ? invConferenciaHTML() : '', cadastros:invCadastrosHTML,
    planilha:() => typeof invPlanilhaHTML === 'function' ? invPlanilhaHTML() : ''}[aba]();
  return '<div class="inv-tela">' +
    '<header class="inv-topo"><div><h2>Inventário de ' + esc(c.nome) + '</h2><p class="lead">Equipamentos, estoque, licenças e funcionários deste cliente. Cada mudança de situação fica no histórico, com quem fez e quando.</p></div></header>' +
    '<nav class="inv-abas" role="tablist">' + INV_ABAS.map(([k, n]) => '<button type="button" role="tab" class="inv-aba" data-inv-aba="' + k + '" aria-selected="' + (k === aba) + '">' + esc(n) + '</button>').join('') + '</nav>' +
    '<div class="inv-corpo">' + corpo + '</div></div>';
}
function invKpi(v, rot, cls){ return '<div class="inv-kpi' + (cls ? ' ' + cls : '') + '"><b>' + v + '</b><span>' + rot + '</span></div>'; }
function invBarras(titulo, linhas){
  const max = Math.max(1, ...linhas.map(l => l[1]));
  return '<section class="inv-quadro"><h4>' + esc(titulo) + '</h4>' + (linhas.length ? '<ul class="inv-barras">' + linhas.map(([n, v, cor]) => '<li><span>' + esc(n) + '</span><i style="--w:' + Math.round(v / max * 100) + '%;--c:' + (cor || 'var(--preto)') + '"></i><b>' + v + '</b></li>').join('') + '</ul>' : '<p class="inv-vazio">Nada ainda.</p>') + '</section>';
}
function invPainelHTML(){
  const ativos = (INV.d.ativos || []).filter(a => a.situacao !== 'baixado'), conta = s => ativos.filter(a => a.situacao === s).length;
  const compra = ativos.reduce((t, a) => t + (+a.valor_compra || 0), 0), atual = ativos.reduce((t, a) => t + (invValorAtual(a) || 0), 0);
  const mensal = ativos.filter(a => a.propriedade === 'alugado').reduce((t, a) => t + (+a.valor_mensal || 0), 0) + (INV.d.licencas || []).reduce((t, l) => t + invMensalLicenca(l), 0);
  const alertas = invAlertas(), pode = podeEditar();
  const porCat = {}; ativos.forEach(a => { const n = invCat(a).nome || 'Sem categoria'; porCat[n] = (porCat[n] || 0) + 1; });
  const porDep = {}; ativos.filter(a => a.funcionario_id).forEach(a => { const f = invFunc(a.funcionario_id), n = (f && f.departamento) || 'Sem departamento'; porDep[n] = (porDep[n] || 0) + 1; });
  return '<div class="inv-kpis">' + invKpi(ativos.length, 'equipamentos') + invKpi(conta('uso_funcionario') + conta('emprestado') + conta('uso_aplicacao') + conta('uso_local'), 'em uso') +
      invKpi(conta('estoque'), 'em estoque') + invKpi(conta('manutencao') + conta('defeito'), 'em manutenção ou com defeito', conta('defeito') ? 'inv-alerta' : '') +
      invKpi(brl(compra), 'valor de compra') + invKpi(brl(atual), 'valor atual (depreciação)') + invKpi(brl(mensal), 'por mês (aluguéis e licenças)') + invKpi(alertas.length, 'avisos', alertas.length ? 'inv-alerta' : '') + '</div>' +
    (pode ? '<div class="inv-acoes-topo"><button type="button" class="btn" data-inv-novo-ativo>Cadastrar equipamento</button><button type="button" class="btn sec" data-inv-novo-func>Cadastrar funcionário</button><button type="button" class="btn sec" data-inv-novo-item>Item de estoque</button><button type="button" class="btn sec" data-inv-aba="planilha">Importar planilha</button></div>' : '') +
    '<section class="inv-quadro"><h4>Avisos</h4>' + (alertas.length ? '<ul class="inv-avisos">' + alertas.slice(0, 40).map(x => '<li class="inv-av-' + x.tipo + '"><span>' + esc(x.txt) + '</span>' +
        (x.id ? '<button type="button" class="btn fant peq" data-inv-abrir="' + esc(x.id) + '">Abrir</button>' : '') + (pode && x.id && typeof invCriarItemTrabalho === 'function' ? '<button type="button" class="btn fant peq" data-inv-item-trabalho="' + esc(x.id) + '" data-inv-item-txt="' + esc(x.txt) + '">Criar item</button>' : '') + '</li>').join('') + '</ul>' : '<p class="inv-vazio">Nada pedindo atenção.</p>') + '</section>' +
    '<div class="inv-grade3">' + invBarras('Por situação', Object.keys(INV_SIT).filter(s => s !== 'baixado').map(s => [INV_SIT[s][0], conta(s), INV_SIT[s][1]]).filter(x => x[1])) +
      invBarras('Por categoria', Object.entries(porCat).sort((a, b) => b[1] - a[1]).slice(0, 12)) + invBarras('Em uso por departamento', Object.entries(porDep).sort((a, b) => b[1] - a[1]).slice(0, 12)) + '</div>' +
    '<section class="inv-quadro"><h4>Últimas movimentações</h4>' + invMovsHTML((INV.d.movs || []).slice(0, 12)) + '</section>';
}
function invMovsHTML(movs){
  if (!movs.length) return '<p class="inv-vazio">Nada ainda.</p>';
  return '<div class="tabela-rolo"><table class="inv-tab"><thead><tr><th>Data</th><th>O quê</th><th>Movimentação</th><th>Para</th><th>Motivo</th><th>Quem</th></tr></thead><tbody>' + movs.map(m => {
    const a = m.ativo_id && invAchar('ativos', m.ativo_id), it = m.item_id && invAchar('itens', m.item_id), p = m.feito_por && pessoa(m.feito_por);
    const para = m.funcionario_para ? (invFunc(m.funcionario_para) || {}).nome : m.aplicacao_para ? invAppNome(m.aplicacao_para) : m.local_para ? invLocalNome(m.local_para) : '';
    return '<tr' + (m.tipo === 'estorno' ? ' class="inv-estorno"' : '') + '><td class="inv-num">' + invDia(m.data) + '</td><td>' + (a ? '<button type="button" class="inv-link" data-inv-abrir="' + esc(a.id) + '">' + esc(invNomeAtivo(a)) + '</button>' : esc(it ? it.nome + ' (' + (+m.quantidade) + ' ' + it.unidade + ')' : '')) + '</td>' +
      '<td>' + esc(INV_MOV[m.tipo] || m.tipo) + '</td><td>' + esc(para || '') + '</td><td>' + esc(m.motivo) + '</td><td>' + esc(p ? p.nome : '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
}

/* ---------- equipamentos ---------- */
function invFiltrar(lista){
  const f = INV.f, q = (f.q || '').toLowerCase().trim();
  return lista.filter(a => (!f.sit ? a.situacao !== 'baixado' : f.sit === 'todos' || a.situacao === f.sit) && (!f.cat || a.categoria_id === f.cat) && (!f.local || a.local_id === f.local) &&
    (!f.func || a.funcionario_id === f.func) && (!f.dep || ((invFunc(a.funcionario_id) || {}).departamento || '') === f.dep) &&
    (!q || [a.patrimonio, a.numero_serie, a.descricao, a.hostname, a.ip, a.mac, invNomeAtivo(a), invOnde(a), invCat(a).nome].join(' ').toLowerCase().includes(q)));
}
function invTabelaAtivos(lista, comSel){
  if (!lista.length) return '<p class="inv-vazio">Nenhum equipamento aqui.</p>';
  return '<div class="tabela-rolo"><table class="inv-tab inv-tab-ativos"><thead><tr>' + (comSel ? '<th><input type="checkbox" data-inv-sel-todos aria-label="Marcar todos"></th>' : '') + '<th>Patrimônio</th><th>Equipamento</th><th>Série</th><th>Situação</th><th>Com quem / onde</th><th>Garantia</th><th class="inv-num">Valor atual</th></tr></thead><tbody>' +
    lista.map(a => { const g = invDias(a.garantia_ate), v = invValorAtual(a);
      return '<tr data-inv-abrir="' + esc(a.id) + '">' + (comSel ? '<td><input type="checkbox" data-inv-sel="' + esc(a.id) + '" aria-label="Marcar"></td>' : '') + '<td class="inv-pat">' + esc(a.patrimonio || '—') + '</td><td><b>' + esc(a.descricao || (invModelo(a) ? [invModelo(a).fabricante, invModelo(a).modelo].filter(Boolean).join(' ') : invCat(a).nome)) + '</b><small>' + esc(invCat(a).nome) + (a.propriedade !== 'proprio' ? ' · ' + svNomeInv(INV_PROP, a.propriedade) : '') + '</small></td>' +
        '<td>' + esc(a.numero_serie) + '</td><td>' + invSitHTML(a.situacao) + '</td><td>' + esc(invOnde(a)) + '</td><td' + (g != null && g < 0 ? ' class="inv-venc"' : g != null && g <= 30 ? ' class="inv-quase"' : '') + '>' + (a.garantia_ate ? invDia(a.garantia_ate) : '') + '</td><td class="inv-num">' + (v != null ? brl(v) : '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
}
const svNomeInv = (lista, k) => (lista.find(x => x[0] === k) || [k, k])[1];
function invEquipamentosHTML(){
  const f = INV.f, cats = (INV.d.categorias || []).filter(c => c.controle === 'unidade'), lista = invFiltrar(INV.d.ativos || []), pode = podeEditar();
  const deps = [...new Set((INV.d.funcionarios || []).map(x => x.departamento).filter(Boolean))].sort();
  return '<div class="inv-filtros"><input class="campo" data-inv-f="q" placeholder="Buscar patrimônio, série, nome, hostname, IP…" value="' + esc(f.q) + '">' +
      '<select class="sel" data-inv-f="sit">' + invOpts([['todos','Todas, até as baixadas']].concat(Object.keys(INV_SIT).map(k => [k, INV_SIT[k][0]])), f.sit, 'Situação: todas menos baixadas') + '</select>' +
      '<select class="sel" data-inv-f="cat">' + invOpts(cats.map(c => [c.id, c.nome]), f.cat, 'Categoria: todas') + '</select>' +
      '<select class="sel" data-inv-f="local">' + invOpts((INV.d.locais || []).map(l => [l.id, invLocalNome(l.id)]), f.local, 'Local: todos') + '</select>' +
      '<select class="sel" data-inv-f="func">' + invOpts((INV.d.funcionarios || []).map(x => [x.id, x.nome]), f.func, 'Funcionário: todos') + '</select>' +
      (deps.length ? '<select class="sel" data-inv-f="dep">' + invOpts(deps.map(x => [x, x]), f.dep, 'Departamento: todos') + '</select>' : '') + '</div>' +
    '<div class="inv-acoes-topo"><span class="inv-conta">' + lista.length + (lista.length === 1 ? ' equipamento' : ' equipamentos') + '</span>' + (pode ? '<button type="button" class="btn" data-inv-novo-ativo>Cadastrar equipamento</button>' : '') +
      '<button type="button" class="btn sec" data-inv-etiquetas>Imprimir etiquetas dos marcados</button>' + (pode ? '<button type="button" class="btn sec" data-inv-lote-mov>Movimentar os marcados</button>' : '') + '<button type="button" class="btn sec" data-inv-csv="equipamentos">Baixar planilha</button></div>' +
    invTabelaAtivos(lista, true);
}

/* ---------- estoque por quantidade ---------- */
function invEstoqueHTML(){
  const itens = INV.d.itens || [], locais = INV.d.locais || [], pode = podeEditar();
  return '<div class="inv-acoes-topo">' + (pode ? '<button type="button" class="btn" data-inv-novo-item>Novo item de estoque</button>' : '') + '<button type="button" class="btn sec" data-inv-csv="estoque">Baixar planilha</button></div>' +
    '<p class="inv-ajuda">Cabos, fontes, adaptadores e consumíveis: controlados por quantidade em cada local. Entrada, saída (para quem foi), transferência e ajuste ficam no histórico.</p>' +
    (itens.length ? '<div class="tabela-rolo"><table class="inv-tab"><thead><tr><th>Item</th><th>Categoria</th><th class="inv-num">Total</th><th class="inv-num">Mínimo</th><th>Por local</th><th></th></tr></thead><tbody>' + itens.map(i => {
      const tot = invSaldoItem(i), baixo = +i.estoque_minimo > 0 && tot < +i.estoque_minimo;
      const porLocal = locais.map(l => [l, invSaldoItem(i, l.id)]).filter(x => x[1] > 0);
      return '<tr' + (i.ativo ? '' : ' class="inv-inativo"') + '><td><b>' + esc(i.nome) + '</b>' + (i.notas ? '<small>' + esc(i.notas) + '</small>' : '') + '</td><td>' + esc((invAchar('categorias', i.categoria_id) || {}).nome || '') + '</td>' +
        '<td class="inv-num' + (baixo ? ' inv-venc' : '') + '"><b>' + tot + '</b> ' + esc(i.unidade) + '</td><td class="inv-num">' + (+i.estoque_minimo || '') + '</td><td>' + esc(porLocal.map(([l, q]) => invLocalNome(l.id) + ': ' + q).join(' · ')) + '</td>' +
        '<td class="inv-bts">' + (pode ? ['entrada','saida','transferencia','ajuste'].map(t => '<button type="button" class="btn fant peq" data-inv-estoque="' + esc(i.id) + '" data-inv-tipo="' + t + '">' + {entrada:'Entrada', saida:'Saída', transferencia:'Transferir', ajuste:'Ajustar'}[t] + '</button>').join('') + '<button type="button" class="btn fant peq" data-inv-editar-item="' + esc(i.id) + '">Editar</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="inv-vazio">Nenhum item de estoque ainda.</p>');
}

/* ---------- licenças ---------- */
function invLicencasHTML(){
  const L = INV.d.licencas || [], pode = podeEditar();
  return '<div class="inv-acoes-topo">' + (pode ? '<button type="button" class="btn" data-inv-nova-lic>Nova licença</button>' : '') + '</div>' +
    (L.length ? '<div class="tabela-rolo"><table class="inv-tab"><thead><tr><th>Licença</th><th class="inv-num">Em uso</th><th>Vence</th><th class="inv-num">Por mês</th><th>Com quem</th><th></th></tr></thead><tbody>' + L.map(l => {
      const us = invUsosLicenca(l), v = invDias(l.vence_em);
      return '<tr><td><b>' + esc(l.nome) + '</b><small>' + esc([l.fornecedor, {assinatura:'Assinatura', perpetua:'Perpétua', oem:'OEM'}[l.tipo], l.chave_onde ? 'chave: ' + l.chave_onde : ''].filter(Boolean).join(' · ')) + '</small></td>' +
        '<td class="inv-num' + (us.length >= l.quantidade ? ' inv-quase' : '') + '">' + us.length + ' de ' + l.quantidade + '</td><td' + (v != null && v < 0 ? ' class="inv-venc"' : v != null && v <= 30 ? ' class="inv-quase"' : '') + '>' + (l.vence_em ? invDia(l.vence_em) + (l.renovacao_automatica ? ' (automática)' : '') : '') + '</td>' +
        '<td class="inv-num">' + (invMensalLicenca(l) ? brl(invMensalLicenca(l)) : '') + '</td><td>' + esc(us.map(u => u.funcionario_id ? (invFunc(u.funcionario_id) || {}).nome : invNomeAtivo(invAchar('ativos', u.ativo_id) || {})).join(', ')) + '</td>' +
        '<td class="inv-bts">' + (pode ? '<button type="button" class="btn fant peq" data-inv-lic-uso="' + esc(l.id) + '">Atribuir</button><button type="button" class="btn fant peq" data-inv-editar-lic="' + esc(l.id) + '">Editar</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="inv-vazio">Nenhuma licença cadastrada.</p>');
}

/* ---------- funcionários ---------- */
function invFuncionariosHTML(){
  const F = (INV.d.funcionarios || []).slice().sort((a, b) => (a.situacao === 'desligado') - (b.situacao === 'desligado') || a.nome.localeCompare(b.nome)), pode = podeEditar();
  return '<div class="inv-acoes-topo">' + (pode ? '<button type="button" class="btn" data-inv-novo-func>Cadastrar funcionário</button>' : '') + '<button type="button" class="btn sec" data-inv-csv="funcionarios">Baixar planilha</button></div>' +
    '<p class="inv-ajuda">Funcionários do cliente: só cadastro de controle, não entram no sistema. O CPF aparece mascarado; ele é usado no termo de responsabilidade.</p>' +
    (F.length ? '<div class="tabela-rolo"><table class="inv-tab"><thead><tr><th>Nome</th><th>Cargo</th><th>Departamento</th><th>CPF</th><th>Telefone</th><th class="inv-num">Equipamentos</th><th>Usa</th><th>Situação</th></tr></thead><tbody>' + F.map(x => {
      const n = (INV.d.ativos || []).filter(a => a.funcionario_id === x.id).length, apps = (INV.d.fapps || []).filter(y => y.funcionario_id === x.id).map(y => invAppNome(y.no_id)).filter(Boolean);
      return '<tr data-inv-func="' + esc(x.id) + '"' + (x.situacao === 'desligado' ? ' class="inv-inativo"' : '') + '><td><b>' + esc(x.nome) + '</b></td><td>' + esc(x.cargo) + '</td><td>' + esc(x.departamento) + '</td><td class="inv-num">' + esc(invCpfMasc(x.cpf)) + '</td><td>' + esc(x.telefone) + '</td>' +
        '<td class="inv-num' + (x.situacao === 'desligado' && n ? ' inv-venc' : '') + '">' + n + '</td><td>' + esc(apps.join(', ')) + '</td><td>' + esc({ativo:'Ativo', afastado:'Afastado', desligado:'Desligado'}[x.situacao]) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="inv-vazio">Nenhum funcionário cadastrado.</p>');
}

/* ---------- locais ---------- */
function invLocaisHTML(){
  const L = INV.d.locais || [], pode = podeEditar();
  const arvore = (pai, nivel) => L.filter(l => (l.pai_id || null) === pai).sort((a, b) => a.nome.localeCompare(b.nome)).map(l => {
    const n = (INV.d.ativos || []).filter(a => a.local_id === l.id && a.situacao !== 'baixado').length, q = (INV.d.saldos || []).filter(s => s.local_id === l.id && +s.quantidade > 0).length;
    return '<li style="padding-left:' + (nivel * 20) + 'px"><b>' + esc(l.nome) + '</b> <small>' + esc({unidade:'unidade', predio:'prédio', andar:'andar', sala:'sala', armario:'armário', almoxarifado:'almoxarifado', remoto:'remoto', outro:'outro'}[l.tipo]) + (l.endereco ? ' · ' + esc(l.endereco) : '') + '</small>' +
      '<span class="inv-conta">' + n + (n === 1 ? ' equipamento' : ' equipamentos') + (q ? ' · ' + q + (q === 1 ? ' item de estoque' : ' itens de estoque') : '') + '</span>' +
      (pode ? '<button type="button" class="btn fant peq" data-inv-editar-local="' + esc(l.id) + '">Editar</button>' : '') + '</li>' + arvore(l.id, nivel + 1); }).join('');
  return '<div class="inv-acoes-topo">' + (pode ? '<button type="button" class="btn" data-inv-novo-local>Novo local</button>' : '') + '</div>' +
    '<p class="inv-ajuda">Matriz, filiais, prédios, salas, armários e almoxarifado. Um local pode ficar dentro de outro.</p>' +
    (L.length ? '<ul class="inv-locais">' + arvore(null, 0) + '</ul>' : '<p class="inv-vazio">Nenhum local cadastrado.</p>');
}

/* ---------- histórico ---------- */
function invHistoricoHTML(){
  const f = INV.f, tipos = Object.keys(INV_MOV);
  let movs = INV.d.movs || [];
  if (f.mtipo) movs = movs.filter(m => m.tipo === f.mtipo);
  if (f.mde) movs = movs.filter(m => String(m.data) >= f.mde);
  if (f.mate) movs = movs.filter(m => String(m.data) <= f.mate);
  return '<div class="inv-filtros"><select class="sel" data-inv-f="mtipo">' + invOpts(tipos.map(t => [t, INV_MOV[t]]), f.mtipo, 'Tipo: todos') + '</select>' +
    '<label class="inv-rot">De <input class="campo" type="date" data-inv-f="mde" value="' + esc(f.mde || '') + '"></label><label class="inv-rot">Até <input class="campo" type="date" data-inv-f="mate" value="' + esc(f.mate || '') + '"></label>' +
    '<button type="button" class="btn sec" data-inv-csv="historico">Baixar planilha</button></div>' +
    '<p class="inv-ajuda">O histórico nunca muda nem some. Um erro se corrige desfazendo a última movimentação do equipamento (fica registrado como estorno).</p>' + invMovsHTML(movs.slice(0, 500));
}

/* ---------- categorias e modelos ---------- */
function invCadastrosHTML(){
  const C = (INV.d.categorias || []).slice().sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome)), M = INV.d.modelos || [], pode = podeEditar();
  return '<div class="inv-grade2"><section class="inv-quadro"><h4>Categorias</h4><p class="inv-ajuda">Cada categoria diz se o controle é um a um (com patrimônio e série) ou por quantidade, a depreciação por ano (tabela da Receita: computadores 20%, impressoras e nobreaks 10%) e de quanto em quanto tempo conferir.</p>' +
      (pode ? '<button type="button" class="btn sec peq" data-inv-nova-cat>Nova categoria</button>' : '') +
      '<div class="tabela-rolo"><table class="inv-tab"><thead><tr><th>Categoria</th><th>Controle</th><th class="inv-num">Depreciação</th><th class="inv-num">Conferir a cada</th><th></th></tr></thead><tbody>' +
      C.map(c => '<tr' + (c.ativo ? '' : ' class="inv-inativo"') + '><td><b>' + esc(c.nome) + '</b><small>' + esc(svNomeInv(INV_GRUPOS, c.grupo)) + '</small></td><td>' + (c.controle === 'unidade' ? 'Um a um' : 'Por quantidade') + '</td><td class="inv-num">' + (+c.depreciacao_pct_ano) + '% ao ano</td><td class="inv-num">' + c.conferencia_meses + ' meses</td>' +
        '<td>' + (pode ? '<button type="button" class="btn fant peq" data-inv-editar-cat="' + esc(c.id) + '">Editar</button>' : '') + '</td></tr>').join('') + '</tbody></table></div></section>' +
    '<section class="inv-quadro"><h4>Modelos</h4><p class="inv-ajuda">Fabricante e modelo, para não digitar de novo a cada equipamento.</p>' + (pode ? '<button type="button" class="btn sec peq" data-inv-novo-modelo>Novo modelo</button>' : '') +
      (M.length ? '<div class="tabela-rolo"><table class="inv-tab"><thead><tr><th>Modelo</th><th>Categoria</th><th class="inv-num">Em uso</th><th></th></tr></thead><tbody>' + M.map(m => '<tr><td><b>' + esc([m.fabricante, m.modelo].filter(Boolean).join(' ')) + '</b>' + (m.especificacoes ? '<small>' + esc(m.especificacoes) + '</small>' : '') + '</td><td>' + esc((invAchar('categorias', m.categoria_id) || {}).nome || '') + '</td>' +
        '<td class="inv-num">' + (INV.d.ativos || []).filter(a => a.modelo_id === m.id && a.situacao !== 'baixado').length + '</td><td>' + (pode ? '<button type="button" class="btn fant peq" data-inv-editar-modelo="' + esc(m.id) + '">Editar</button>' : '') + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="inv-vazio">Nenhum modelo ainda.</p>') + '</section></div>';
}

/* ---------- aplicação, produto ou projeto: o que é usado ali ---------- */
function invEscopoHTML(apps){
  const lista = invAtivosDoEscopo(UI.sel).filter(a => a.situacao !== 'baixado');
  const daApp = lista.filter(a => apps.includes(a.aplicacao_id)), funcs = (INV.d.funcionarios || []).filter(f => (INV.d.fapps || []).some(x => x.funcionario_id === f.id && apps.includes(x.no_id)));
  const c = byId('clients', INV.cli);
  return '<header class="inv-topo"><div><h2>Inventário de ' + esc(nomeDe(UI.sel)) + '</h2><p class="lead">Os equipamentos que esta parte usa, do inventário de ' + esc(c ? c.nome : 'cliente') + ': os que estão em uso pela própria aplicação e os dos funcionários que usam a aplicação.</p></div>' +
      '<button type="button" class="btn sec" data-inv-ir-cliente>Abrir o inventário do cliente</button></header>' +
    '<div class="inv-kpis">' + invKpi(daApp.length, 'em uso pela aplicação') + invKpi(funcs.length, funcs.length === 1 ? 'funcionário usa' : 'funcionários usam') + invKpi(lista.length - daApp.length, 'equipamentos com esses funcionários') + '</div>' +
    '<section class="inv-quadro"><h4>Em uso pela aplicação</h4>' + invTabelaAtivos(daApp, false) + '</section>' +
    '<section class="inv-quadro"><h4>Funcionários que usam e os equipamentos deles</h4>' + (funcs.length ? funcs.map(f => { const eq = lista.filter(a => a.funcionario_id === f.id);
      return '<div class="inv-func-bloco"><p><b>' + esc(f.nome) + '</b> <small>' + esc([f.cargo, f.departamento].filter(Boolean).join(' · ')) + '</small></p>' + (eq.length ? invTabelaAtivos(eq, false) : '<p class="inv-vazio">Sem equipamento.</p>') + '</div>'; }).join('') : '<p class="inv-vazio">Nenhum funcionário marcado como usuário desta aplicação. Marque no cadastro do funcionário.</p>') + '</section>';
}

/* ---------- desenhar e ligar na aba ---------- */
function invRender(){
  const c = $('#ops-corpo'); if (!c || UI.view !== 'inventario') return;
  const rolo = c.scrollTop; c.innerHTML = invTelaHTML(); c.scrollTop = rolo;
  if (typeof smAgruparAbas === 'function') smAgruparAbas();
}
const _rViewInv = rView;
rView = function(){
  const c = $('#ops-corpo');
  if (c && UI.view === 'inventario'){
    if (!invPodeTer(UI.sel)){ UI.view = 'dashboard'; return _rViewInv.apply(this, arguments); }
    const cli = invCliDe(UI.sel);
    if (INV.cli !== cli){ INV.lido = false; INV.f = {q:'', sit:'', cat:'', local:'', func:'', dep:''}; }
    invRender();
    if (!INV.lido || INV.cli !== cli) invCarregar(true).then(invRender);
    return;
  }
  return _rViewInv.apply(this, arguments);
};
const _rOperacoesInv = rOperacoes;
rOperacoes = function(){
  _rOperacoesInv.apply(this, arguments);
  if (!invPodeTer(UI.sel)){ const b = $('.view-b[data-view="inventario"]'); if (b) (b.closest('.view-casa') || b).remove(); if (UI.view === 'inventario'){ UI.view = 'dashboard'; rView(); } }
};
VIEWS.push(['inventario', 'Inventário', 'inventário de TI do cliente: equipamentos, estoque, licenças e funcionários']);
if (typeof SM_ABAS !== 'undefined') SM_ABAS.inventario = ['Inventário', 'O inventário de TI do cliente: cada equipamento com patrimônio, série, situação e com quem está (funcionário, aplicação ou local), o estoque de cabos e acessórios, as licenças, os funcionários, os locais, o histórico de movimentações, a conferência física e as etiquetas.'];
if (typeof SM_DICA !== 'undefined') SM_DICA.inventario = 'inventário de TI do cliente';
if (typeof EXPL_VIEW !== 'undefined') EXPL_VIEW.inventario = 'Inventário de TI do cliente: equipamentos, estoque, licenças, funcionários e histórico.';
if (typeof SM_EXTRAS_PADRAO !== 'undefined' && !SM_EXTRAS_PADRAO.includes('inventario')){ SM_EXTRAS_PADRAO.push('inventario'); if (typeof SM_PRINCIPAIS !== 'undefined' && !SM_PRINCIPAIS.includes('inventario')) SM_PRINCIPAIS.push('inventario'); }

// filtros e abas
document.addEventListener('input', e => { const f = e.target.closest('#ops-corpo .inv-tela [data-inv-f]'); if (!f || f.tagName !== 'INPUT' || f.type === 'date') return; INV.f[f.dataset.invF] = f.value; clearTimeout(INV._t); INV._t = setTimeout(() => { invRender(); const n = $('#ops-corpo [data-inv-f="' + f.dataset.invF + '"]'); if (n){ n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); });
document.addEventListener('change', e => { const f = e.target.closest('#ops-corpo .inv-tela [data-inv-f]'); if (!f || (f.tagName === 'INPUT' && f.type !== 'date')) return; INV.f[f.dataset.invF] = f.value; invRender(); });
document.addEventListener('click', e => {
  if (!e.target.closest('#ops-corpo .inv-tela')) return;
  const ab = e.target.closest('[data-inv-aba]'); if (ab){ INV.aba = ab.dataset.invAba; invRender(); return; }
  if (e.target.closest('[data-inv-ir-cliente]')){ UI.sel = 'client:' + INV.cli; UI.view = 'inventario'; if (typeof abrirArvore === 'function') abrirArvore(UI.sel); salvarUI(); rOperacoes(); return; }
  const st = e.target.closest('[data-inv-sel-todos]'); if (st){ $$('#ops-corpo [data-inv-sel]').forEach(x => { x.checked = st.checked; }); return; }
  if (e.target.closest('input[type="checkbox"]')) return;
  if (typeof invClique === 'function') invClique(e);
});
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {INV, invCarregar, invValorAtual, invAlertas, invAtivosDoEscopo, invRender});
