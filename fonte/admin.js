/* =====================================================================
   ADMIN (só o dono do sistema) e REGISTRO DE USO (todos os usuários)
   O dono do sistema vê números e o cadastro de cada usuário; nunca o conteúdo dos projetos deles.
   Os números vêm das funções admin_* do banco (banco/16_admin_sistema.sql), que conferem o dono por dentro.
   ===================================================================== */
const ADM = {dono:false, aba:'visao', dias:30, busca:'', ordem:'criado_em', desc:true, resumo:null, usuarios:null, diario:null, telas:null, banco:null, carregando:false, erro:null};
const admBanco = () => (COM_BANCO && window.ciclodevBanco && MU.eu) ? window.ciclodevBanco : null;

/* ---------- registro de uso: entradas, telas, minutos ativos, tempo de carregar e salvar, erros ---------- */
const USO = {chave:'', interagiu:Date.now(), erros:0};
function anotarUso(tipo, extra){
  const sb = admBanco(); if (!sb) return;
  const linha = Object.assign({tipo}, extra || {});
  if (linha.ms != null) linha.ms = Math.max(0, Math.min(600000, Math.round(linha.ms)));
  sb.from('uso_eventos').insert(linha).then(r => { if (r && r.error) console.warn('Uso', tipo, r.error.message); }, () => {});
}
function chaveTela(){ return UI.modulo + (UI.modulo === 'operacoes' && UI.view ? '/' + UI.view : ''); }
function conferirTela(){ const k = chaveTela(); if (k && k !== USO.chave){ USO.chave = k; anotarUso('tela', {tela:k.slice(0, 60)}); } }
if (COM_BANCO){
  const _entrou = window.ciclodevEntrouComo;
  window.ciclodevEntrouComo = function(p){
    const t0 = performance.now();
    const r = _entrou(p);
    Promise.resolve(r).then(async () => {
      if (!admBanco()) return;
      anotarUso('entrou'); anotarUso('carregou', {ms:performance.now() - t0});
      const {data} = await window.ciclodevBanco.rpc('sou_dono_sistema');
      ADM.dono = data === true;
      const li = document.querySelector('.item[data-tela="admin"]'); if (li) li.parentElement.hidden = !ADM.dono;
      USO.chave = ''; conferirTela();
    });
    return r;
  };
  document.addEventListener('click', () => setTimeout(conferirTela, 60), true);
  ['pointerdown','keydown','wheel'].forEach(ev => document.addEventListener(ev, () => { USO.interagiu = Date.now(); }, {passive:true, capture:true}));
  // minutos ativos: a cada 5 minutos com a tela aberta e alguém mexendo nela
  setInterval(() => { if (document.visibilityState === 'visible' && Date.now() - USO.interagiu < 5 * 60000) anotarUso('ativo'); }, 5 * 60000);
  const erroTela = (msg, onde) => { if (USO.erros++ >= 10) return; anotarUso('erro', {tela:onde, detalhe:{msg:String(msg || '').slice(0, 200)}}); };
  window.addEventListener('error', e => erroTela(e.message, 'tela'));
  window.addEventListener('unhandledrejection', e => erroTela(e.reason && (e.reason.message || e.reason), 'tela'));
  const _gravar = gravarNoBanco;
  gravarNoBanco = async function(){
    if (SYNC.rodando || !SYNC.base) return _gravar();
    const t0 = performance.now();
    await _gravar();
    if (SYNC.erros.length) anotarUso('erro', {tela:'salvar', detalhe:{n:SYNC.erros.length, msg:String(SYNC.erros[0]).slice(0, 200)}});
    else anotarUso('salvou', {ms:performance.now() - t0});
  };
}

/* ---------- módulo Admin no menu (escondido para quem não é o dono) ---------- */
{ const li = document.querySelector('.item[data-tela="admin"]'); if (li) li.parentElement.hidden = true; }
const _abrirModulo = abrirModulo;
abrirModulo = function(id){ if (id === 'admin' && !ADM.dono) id = 'overview'; return _abrirModulo(id); };
const _render = render;
render = function(){ if (UI.modulo === 'admin') return rAdmin(); return _render(); };

async function admCarregar(forcar){
  const sb = admBanco(); if (!sb || !ADM.dono || ADM.carregando) return;
  if (ADM.resumo && !forcar) return;
  ADM.carregando = true; ADM.erro = null; rAdmin();
  const [r, u, d, t, b] = await Promise.all([sb.rpc('admin_resumo'), sb.rpc('admin_usuarios'), sb.rpc('admin_uso_diario', {p_dias:ADM.dias}), sb.rpc('admin_telas', {p_dias:ADM.dias}), sb.rpc('admin_banco')]);
  const erro = [r, u, d, t, b].find(x => x.error);
  ADM.carregando = false;
  if (erro){ ADM.erro = erro.error.message; }
  else { ADM.resumo = r.data || {}; ADM.usuarios = u.data || []; ADM.diario = d.data || []; ADM.telas = t.data || []; ADM.banco = b.data || []; }
  if (UI.modulo === 'admin') rAdmin();
}

const admData = v => v ? new Date(v).toLocaleDateString('pt-BR') : '';
const admHora = v => v ? new Date(v).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'}) : '';
const admCpf = v => v ? String(v).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : '';
const admCep = v => v ? String(v).replace(/^(\d{5})(\d{3})$/, '$1-$2') : '';
const ADM_USO = {trabalho:'Trabalho', estudo:'Estudo', pessoal:'Uso pessoal', outro:'Outro'};
const ADM_EV = {entrou:'Entrou no sistema', tela:'Abriu', carregou:'Carregou os dados', salvou:'Salvou', erro:'Erro', saiu:'Saiu'};
const ADM_TELA = {overview:'Overview', operacoes:'Operações', clientes:'Clients', catalog:'Catalog', custos:'Costs', servicedesk:'Service Desk', time:'Team', agentes:'Agent Studio', playbook:'Playbook', configuracoes:'Settings', admin:'Admin'};
const nomeTela = t => { if (!t) return ''; const [m, v] = String(t).split('/'); return (ADM_TELA[m] || m) + (v ? ' › ' + v.charAt(0).toUpperCase() + v.slice(1) : ''); };
function admIdade(iso){ if (!iso) return ''; const n = new Date(iso + 'T00:00:00'), h = new Date(); let a = h.getFullYear() - n.getFullYear(); if (h < new Date(h.getFullYear(), n.getMonth(), n.getDate())) a--; return a + ' anos'; }
function admMs(v){ return v == null ? 'sem dado' : v >= 1000 ? num(v / 1000, 1) + ' s' : v + ' ms'; }

/* gráfico de barras simples (SVG), uma série por dia */
function admBarras(serie, campo, rotulo){
  const W = 640, H = 150, base = 124, n = serie.length || 1, larg = W / n;
  const max = Math.max(1, ...serie.map(s => +s[campo] || 0));
  const barras = serie.map((s, i) => { const v = +s[campo] || 0, h = v / max * (base - 12); return '<rect x="' + (i * larg + larg * 0.18).toFixed(1) + '" y="' + (base - h).toFixed(1) + '" width="' + (larg * 0.64).toFixed(1) + '" height="' + h.toFixed(1) + '" fill="currentColor"><title>' + esc(admData(s.dia + 'T12:00:00')) + ': ' + v + '</title></rect>'; }).join('');
  const marcas = serie.map((s, i) => ((i % Math.ceil(n / 6) === 0 && n - 1 - i >= Math.ceil(n / 12)) || i === n - 1) ? '<text x="' + (i === 0 ? 0 : i === n - 1 ? W : i * larg + larg / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + (i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle') + '" font-size="11" fill="currentColor" opacity=".6">' + esc(new Date(s.dia + 'T12:00:00').toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})) + '</text>' : '').join('');
  return '<svg class="adm-barras" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(rotulo) + ' por dia, máximo ' + max + '"><line x1="0" y1="' + base + '" x2="' + W + '" y2="' + base + '" stroke="currentColor" opacity=".25"/>' + barras + marcas + '</svg>';
}
const admKpi = (v, t, alerta) => '<div class="kpi' + (alerta ? ' alerta' : '') + '"><b>' + v + '</b><span>' + esc(t) + '</span></div>';

function rAdmin(){
  const el = $('#m-admin'); if (!el) return;
  if (!ADM.dono){ el.innerHTML = '<p class="vazio-linha">Só o dono do sistema abre este módulo.</p>'; return; }
  const topo = '<div class="topo-tela"><div><h1><span>Admin</span>' + I('Admin: painel do dono do sistema. Mostra quem usa, quanto usa e como o sistema está respondendo. Não mostra o conteúdo dos projetos de ninguém.') + '</h1><p class="lead">Usuários, cadastro, uso e desempenho do CicloDev.</p></div>' +
    '<div class="acoes"><label class="adm-per">Período <select class="sel peq" data-adm-dias>' + [7, 30, 90].map(d => '<option value="' + d + '"' + (ADM.dias === d ? ' selected' : '') + '>Últimos ' + d + ' dias</option>').join('') + '</select></label><button class="btn sec" type="button" data-adm-atualizar' + (ADM.carregando ? ' disabled' : '') + '>' + (ADM.carregando ? 'Atualizando…' : 'Atualizar') + '</button></div></div>';
  const abas = '<div class="adm-abas" role="tablist">' + [['visao','Visão geral'],['usuarios','Usuários' + (ADM.usuarios ? ' (' + ADM.usuarios.length + ')' : '')],['desempenho','Desempenho']].map(([k, n]) => '<button type="button" role="tab" aria-selected="' + (ADM.aba === k) + '" data-adm-aba="' + k + '">' + esc(n) + '</button>').join('') + '</div>';
  if (!ADM.resumo){
    el.innerHTML = topo + (ADM.erro ? '<p class="entrada-erro">Não foi possível ler os números: ' + esc(ADM.erro) + '</p>' : '<p class="vazio-linha">Lendo os números do banco…</p>');
    if (!ADM.carregando && !ADM.erro) admCarregar();
    return;
  }
  const R = ADM.resumo;
  let corpo = '';
  if (ADM.aba === 'visao'){
    corpo = '<div class="kpis">' + admKpi(num(R.usuarios, 0), 'Usuários') + admKpi(num(R.novos_7d, 0), 'Novos em 7 dias') + admKpi(num(R.ativos_1d, 0), 'Ativos hoje') + admKpi(num(R.ativos_7d, 0), 'Ativos em 7 dias') + admKpi(num(R.ativos_30d, 0), 'Ativos em 30 dias') + admKpi(num(Math.round((R.minutos_ativos_7d || 0) / 60), 0) + 'h', 'Tempo de uso em 7 dias') + '</div>' +
      '<div class="kpis">' + admKpi(num(R.clientes, 0), 'Clientes') + admKpi(num(R.projetos, 0), 'Projetos') + admKpi(num(R.aplicacoes, 0), 'Aplicações') + admKpi(num(R.itens, 0), 'Itens') + admKpi(num(R.compartilhamentos, 0), 'Compartilhamentos') + admKpi(num(R.convites_pendentes, 0), 'Convites pendentes') + '</div>' +
      '<div class="graficos">' +
        '<section class="grafico"><h3>Pessoas ativas por dia</h3>' + admBarras(ADM.diario, 'ativos', 'Pessoas ativas') + '</section>' +
        '<section class="grafico"><h3>Cadastros por dia</h3>' + admBarras(ADM.diario, 'cadastros', 'Cadastros') + '</section>' +
      '</div>' +
      '<div class="graficos"><section class="grafico"><h3>Telas mais usadas</h3>' + (ADM.telas.length ? '<table class="tabela"><thead><tr><th>Tela</th><th>Aberturas</th><th>Pessoas</th></tr></thead><tbody>' + ADM.telas.map(t => '<tr><td>' + esc(nomeTela(t.tela)) + '</td><td>' + num(t.aberturas, 0) + '</td><td>' + num(t.pessoas, 0) + '</td></tr>').join('') + '</tbody></table>' : '<p class="vazio-linha">Ainda sem uso registrado no período.</p>') + '</section>' +
      '<section class="grafico"><h3>Uso por finalidade</h3>' + admFinalidade() + '</section></div>';
  } else if (ADM.aba === 'usuarios'){
    corpo = admTabelaUsuarios();
  } else {
    corpo = '<div class="kpis">' + admKpi(admMs(R.carregar_ms_mediana), 'Carregar (tempo típico)') + admKpi(admMs(R.carregar_ms_p95), 'Carregar (95% abaixo de)', R.carregar_ms_p95 > 5000) + admKpi(admMs(R.salvar_ms_mediana), 'Salvar (tempo típico)') + admKpi(num(R.salvamentos_7d, 0), 'Salvamentos em 7 dias') + admKpi(num(R.erros_7d, 0), 'Erros em 7 dias', R.erros_7d > 0) + admKpi(num(R.banco_mb, 1) + ' MB', 'Tamanho do banco') + '</div>' +
      '<div class="graficos"><section class="grafico"><h3>Erros por dia</h3>' + admBarras(ADM.diario, 'erros', 'Erros') + '</section><section class="grafico"><h3>Tempo típico para carregar, por dia (ms)</h3>' + admBarras(ADM.diario, 'carregar_ms', 'Tempo para carregar') + '</section></div>' +
      '<div class="graficos"><section class="grafico"><h3>Maiores tabelas do banco</h3><table class="tabela"><thead><tr><th>Tabela</th><th>Linhas (aprox.)</th><th>Tamanho</th></tr></thead><tbody>' + ADM.banco.map(t => '<tr><td>' + esc(t.tabela) + '</td><td>' + num(t.linhas, 0) + '</td><td>' + (t.tamanho_kb >= 1024 ? num(t.tamanho_kb / 1024, 1) + ' MB' : num(t.tamanho_kb, 0) + ' KB') + '</td></tr>').join('') + '</tbody></table></section></div>';
  }
  el.innerHTML = topo + abas + (ADM.erro ? '<p class="entrada-erro">Não foi possível atualizar: ' + esc(ADM.erro) + '</p>' : '') + '<div class="adm-corpo">' + corpo + '</div><p class="adm-rodape">Atualizado em ' + esc(admHora(R.gerado_em)) + '. Os números de uso começam a contar a partir desta versão.</p>';
}
function admFinalidade(){
  const us = ADM.usuarios || [], tot = us.length || 1;
  const cont = {}; us.forEach(u => { const k = u.uso || 'sem'; cont[k] = (cont[k] || 0) + 1; });
  const linhas = [...Object.keys(ADM_USO), 'sem'].filter(k => cont[k]).map(k => '<div class="adm-fin"><span>' + (ADM_USO[k] || 'Sem resposta') + '</span><div class="progresso grosso"><i style="width:' + (cont[k] / tot * 100).toFixed(1) + '%"></i></div><b>' + cont[k] + '</b></div>');
  return linhas.length ? linhas.join('') : '<p class="vazio-linha">Sem usuários.</p>';
}
const ADM_COLS = [['nome','Usuário'],['criado_em','Cadastro'],['ultimo_acesso','Último acesso'],['uso','Uso'],['cargo','Cargo'],['cidade','Cidade'],['projetos','Projetos'],['itens','Itens'],['dias_ativos_30d','Dias ativos'],['minutos_ativos_30d','Tempo'],['indice_uso','Índice de uso']];
function admFiltrados(){
  const b = ADM.busca.trim().toLowerCase();
  const lista = (ADM.usuarios || []).filter(u => !b || [u.nome, u.nome_completo, u.email, u.usuario, u.numero, u.cpf, u.cidade, u.cargo, u.empresa].some(v => v != null && String(v).toLowerCase().includes(b)));
  const k = ADM.ordem, d = ADM.desc ? -1 : 1;
  return lista.sort((a, c) => { const x = a[k], y = c[k]; if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR')) * d; });
}
function admTabelaUsuarios(){
  const lista = admFiltrados();
  const seta = k => ADM.ordem === k ? (ADM.desc ? ' ↓' : ' ↑') : '';
  return '<div class="adm-filtros"><input class="campo" type="search" data-adm-busca placeholder="Buscar por nome, e-mail, ID, CPF, cidade, cargo…" value="' + esc(ADM.busca) + '" aria-label="Buscar usuário"><button class="btn sec" type="button" data-adm-csv>Baixar planilha (CSV)</button></div>' +
    '<div class="tabela-rolo"><table class="tabela adm-tab"><thead><tr>' + ADM_COLS.map(([k, n]) => '<th class="ord" data-adm-ordem="' + k + '" aria-sort="' + (ADM.ordem === k ? (ADM.desc ? 'descending' : 'ascending') : 'none') + '">' + esc(n) + seta(k) + '</th>').join('') + '</tr></thead><tbody>' +
    (lista.length ? lista.map(u => '<tr data-adm-pessoa="' + esc(u.pessoa_id) + '" tabindex="0">' +
      '<td><b>' + esc(u.nome_completo || u.nome) + '</b>' + (u.dono_sistema ? ' <span class="pill">Dono do sistema</span>' : '') + '<small class="adm-sub">ID ' + esc(u.numero) + ' · ' + esc(u.email || '') + '</small></td>' +
      '<td>' + esc(admData(u.criado_em)) + (u.email_confirmado ? '' : '<small class="adm-sub">e-mail não confirmado</small>') + '</td>' +
      '<td>' + (u.ultimo_acesso ? esc(admHora(u.ultimo_acesso)) : '<span class="sec">nunca</span>') + '</td>' +
      '<td>' + esc(ADM_USO[u.uso] || '') + '</td><td>' + esc(u.cargo || '') + (u.empresa ? '<small class="adm-sub">' + esc(u.empresa) + '</small>' : '') + '</td>' +
      '<td>' + esc(u.cidade ? u.cidade + (u.uf ? '/' + u.uf : '') : '') + '</td>' +
      '<td>' + num(u.projetos, 0) + '</td><td>' + num(u.itens, 0) + '</td><td>' + num(u.dias_ativos_30d, 0) + '</td><td>' + (u.minutos_ativos_30d >= 60 ? num(u.minutos_ativos_30d / 60, 1) + 'h' : num(u.minutos_ativos_30d, 0) + 'min') + '</td>' +
      '<td><div class="adm-indice"><div class="progresso"><i style="width:' + (u.indice_uso || 0) + '%"></i></div><b>' + (u.indice_uso || 0) + '</b></div></td></tr>').join('')
      : '<tr><td colspan="' + ADM_COLS.length + '" class="vazio-linha">Nenhum usuário encontrado.</td></tr>') +
    '</tbody></table></div><p class="adm-rodape">Dias ativos, tempo e índice contam os últimos 30 dias. Índice de uso (0 a 100): frequência 50%, tempo de uso 30%, volume de trabalho 20%.</p>';
}
function admCsv(){
  const cols = ['numero','nome','nome_completo','email','usuario','criado_em','email_confirmado','ultimo_acesso','data_nascimento','cpf','cep','logradouro','numero_end','complemento','bairro','cidade','uf','uso','cargo','empresa','termos_aceitos_em','clientes','projetos','aplicacoes','itens','itens_concluidos','compartilhou','recebeu','entradas_30d','dias_ativos_30d','minutos_ativos_30d','erros_30d','indice_uso'];
  const cel = v => { const s = v == null ? '' : String(v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const txt = '﻿' + cols.join(';') + '\n' + admFiltrados().map(u => cols.map(c => cel(u[c])).join(';')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], {type:'text/csv;charset=utf-8'})); a.download = 'usuarios-ciclodev-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
async function admFicha(id){
  const u = (ADM.usuarios || []).find(x => x.pessoa_id === id); if (!u) return;
  const lin = (r, v) => '<div class="adm-lin"><span>' + esc(r) + '</span><b>' + (v === '' || v == null ? '<i class="sec">não informado</i>' : esc(v)) + '</b></div>';
  const end = [u.logradouro, u.numero_end, u.complemento].filter(Boolean).join(', ');
  const corpo = '<div class="adm-ficha">' +
    '<section><h4>Conta</h4>' + lin('Número de ID', u.numero) + lin('Nome no sistema', u.nome) + lin('@usuário', u.usuario ? '@' + u.usuario : '') + lin('E-mail', u.email) + lin('E-mail confirmado', u.email_confirmado ? 'Sim' : 'Não') + lin('Cadastro', admHora(u.criado_em)) + lin('Último acesso', admHora(u.ultimo_acesso)) + '</section>' +
    '<section><h4>Dados do cadastro</h4>' + lin('Nome completo', u.nome_completo) + lin('Nascimento', u.data_nascimento ? admData(u.data_nascimento + 'T12:00:00') + ' (' + admIdade(u.data_nascimento) + ')' : '') + lin('CPF', admCpf(u.cpf)) + lin('Endereço', end) + lin('Bairro', u.bairro) + lin('Cidade', u.cidade ? u.cidade + (u.uf ? '/' + u.uf : '') : '') + lin('CEP', admCep(u.cep)) + lin('Uso', ADM_USO[u.uso] || '') + lin(u.uso === 'estudo' ? 'Curso' : 'Cargo', u.cargo) + lin(u.uso === 'estudo' ? 'Instituição' : 'Empresa', u.empresa) + lin('Aceite dos termos', admHora(u.termos_aceitos_em)) + '</section>' +
    '<section><h4>O que tem no espaço</h4>' + lin('Clientes', num(u.clientes, 0)) + lin('Projetos', num(u.projetos, 0)) + lin('Aplicações', num(u.aplicacoes, 0)) + lin('Itens', num(u.itens, 0) + ' (' + num(u.itens_concluidos, 0) + ' concluídos)') + lin('Compartilhou com outros', num(u.compartilhou, 0)) + lin('Recebeu de outros', num(u.recebeu, 0)) + '</section>' +
    '<section><h4>Uso nos últimos 30 dias</h4>' + lin('Entradas', num(u.entradas_30d, 0)) + lin('Dias ativos', num(u.dias_ativos_30d, 0)) + lin('Tempo de uso', num(u.minutos_ativos_30d, 0) + ' min') + lin('Erros', num(u.erros_30d, 0)) + lin('Índice de uso', (u.indice_uso || 0) + ' de 100') + '</section>' +
    '</div><section class="adm-hist"><h4>Histórico de uso</h4><div data-adm-hist><p class="vazio-linha">Lendo…</p></div></section>';
  const dlg = modal(esc(u.nome_completo || u.nome), corpo, [{txt:'Fechar', cls:'sec'}]);
  dlg.classList.add('adm-modal');
  const {data, error} = await window.ciclodevBanco.rpc('admin_historico', {p_pessoa:id, p_limite:200});
  const alvo = dlg.querySelector('[data-adm-hist]'); if (!alvo) return;
  if (error){ alvo.innerHTML = '<p class="entrada-erro">' + esc(error.message) + '</p>'; return; }
  alvo.innerHTML = (data || []).length ? '<table class="tabela"><thead><tr><th>Quando</th><th>O quê</th><th>Detalhe</th></tr></thead><tbody>' + data.map(e => '<tr><td>' + esc(admHora(e.em)) + '</td><td>' + esc(ADM_EV[e.tipo] || e.tipo) + '</td><td>' + esc(e.tipo === 'tela' ? nomeTela(e.tela) : e.ms != null ? admMs(e.ms) : e.detalhe && e.detalhe.msg ? e.detalhe.msg : '') + '</td></tr>').join('') + '</tbody></table>' : '<p class="vazio-linha">Ainda sem uso registrado.</p>';
}

document.addEventListener('click', e => {
  if (!e.target.closest('#m-admin')) return;
  const a = e.target.closest('[data-adm-aba]'); if (a){ ADM.aba = a.dataset.admAba; return rAdmin(); }
  if (e.target.closest('[data-adm-atualizar]')) return admCarregar(true);
  if (e.target.closest('[data-adm-csv]')) return admCsv();
  const o = e.target.closest('[data-adm-ordem]'); if (o){ const k = o.dataset.admOrdem; if (ADM.ordem === k) ADM.desc = !ADM.desc; else { ADM.ordem = k; ADM.desc = !['nome','uso','cargo','cidade'].includes(k); } return rAdmin(); }
  const p = e.target.closest('[data-adm-pessoa]'); if (p) admFicha(p.dataset.admPessoa);
});
document.addEventListener('keydown', e => { const p = e.target.closest && e.target.closest('#m-admin [data-adm-pessoa]'); if (p && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); admFicha(p.dataset.admPessoa); } });
document.addEventListener('change', e => { const s = e.target.closest('#m-admin [data-adm-dias]'); if (s){ ADM.dias = +s.value; admCarregar(true); } });
document.addEventListener('input', e => {
  const b = e.target.closest('#m-admin [data-adm-busca]'); if (!b) return;
  ADM.busca = b.value; const pos = b.selectionStart; rAdmin();
  const n = $('#m-admin [data-adm-busca]'); if (n){ n.focus(); n.setSelectionRange(pos, pos); }
});
