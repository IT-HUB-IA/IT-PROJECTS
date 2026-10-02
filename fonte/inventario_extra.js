/* ===== Inventário: termo, etiquetas, planilha, conferência e ligações com o resto do sistema =====
   Termo de responsabilidade (impresso para assinar; o assinado volta como anexo), etiquetas com QR code (o QR abre o
   equipamento no CicloDev), planilha para baixar e para importar (com prévia dos erros), conferência física (por
   patrimônio, série ou câmera), e as ligações: Custos, Ficha técnica, ficha do cliente e itens na frente Infraestrutura. */

/* ---------- imprimir (num quadro escondido, sem abrir outra janela) ---------- */
function invImprimir(html){
  if (location.protocol === 'file:' && window.__tf){ window.__ultimaImpressao = html; return; }   // nos testes, só guarda
  const f = document.createElement('iframe'); f.setAttribute('aria-hidden', 'true'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f); const doc = f.contentDocument; doc.open(); doc.write(html); doc.close();
  setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {} setTimeout(() => f.remove(), 60000); }, 350);
}
const INV_PAPEL = '<style>body{font:13px/1.5 Arial,Helvetica,sans-serif;color:#111;margin:28px}h1{font-size:18px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 6px}table{width:100%;border-collapse:collapse;margin:8px 0}' +
  'td,th{border:1px solid #999;padding:5px 6px;text-align:left;font-size:12px}th{background:#eee}.peq{font-size:11px;color:#444}.ass{display:flex;gap:40px;margin-top:48px}.ass div{flex:1;border-top:1px solid #111;padding-top:4px;text-align:center;font-size:12px}' +
  'ol li{margin:3px 0}@page{margin:14mm}</style>';

/* ---------- termo de responsabilidade ---------- */
INV.termosHtml = {};
function invTermoHtml(func, tipo, ativos, quando){
  const c = byId('clients', INV.cli) || {}, fi = c.ficha || {}, doc = fi.documento || c.doc || '';
  const entrega = tipo === 'entrega';
  return '<!doctype html><html><head><meta charset="utf-8"><title>Termo de ' + (entrega ? 'responsabilidade' : 'devolução') + '</title>' + INV_PAPEL + '</head><body>' +
    '<h1>' + (entrega ? 'Termo de responsabilidade pelo uso de equipamentos' : 'Termo de devolução de equipamentos') + '</h1>' +
    '<p class="peq">' + esc(fi.razao_social || c.nome || '') + (doc ? ' · CNPJ/CPF ' + esc(doc) : '') + '</p>' +
    '<h2>Funcionário</h2><p><b>' + esc(func.nome) + '</b>' + (func.cpf ? ' · CPF ' + esc(invCpf(func.cpf)) : '') + (func.cargo ? ' · ' + esc(func.cargo) : '') + (func.departamento ? ' · ' + esc(func.departamento) : '') + '</p>' +
    '<h2>Equipamentos</h2><table><thead><tr><th>Patrimônio</th><th>Equipamento</th><th>Série</th><th>Estado</th></tr></thead><tbody>' +
      ativos.map(a => '<tr><td>' + esc(a.patrimonio || '') + '</td><td>' + esc(a.descricao || (invModelo(a) ? [invModelo(a).fabricante, invModelo(a).modelo].filter(Boolean).join(' ') : invCat(a).nome)) + '</td><td>' + esc(a.numero_serie || '') + '</td><td>' + (a.situacao === 'defeito' ? 'Com defeito' : 'Funcionando') + '</td></tr>').join('') + '</tbody></table>' +
    (entrega ? '<h2>Compromissos</h2><ol><li>Usar os equipamentos só para o trabalho, com cuidado, e não emprestar a terceiros.</li><li>Avisar logo em caso de defeito, perda, furto ou roubo (com boletim de ocorrência).</li>' +
      '<li>Devolver tudo no desligamento ou quando a empresa pedir, no estado em que recebeu, fora o desgaste normal do uso.</li><li>Desconto por dano só nos casos do art. 462, § 1º, da CLT (dolo, ou culpa quando previamente acordado).</li></ol>'
      : '<p>A empresa recebeu de volta os equipamentos acima, conferidos na data abaixo.</p>') +
    '<p>' + esc(c.ficha && c.ficha.cidade ? c.ficha.cidade + ', ' : '') + esc(invDia(quando || invHoje())) + '</p>' +
    '<div class="ass"><div>' + esc(func.nome) + '<br>Funcionário</div><div>' + esc(fi.razao_social || c.nome || 'Empresa') + '<br>Empresa</div></div></body></html>';
}
async function invCriarTermo(funcId, tipo, ativoIds){
  const f = invAchar('funcionarios', funcId), ativos = ativoIds.map(i => invAchar('ativos', i)).filter(Boolean); if (!f || !ativos.length) return null;
  const html = invTermoHtml(f, tipo, ativos);
  const id = await invGravar('inv_termos', {funcionario_id:funcId, tipo, ativos:ativos.map(a => a.id), texto:html.slice(0, 20000)});
  INV.termosHtml[id] = html; return id;
}
function invImprimirTermo(id){
  const t = invAchar('termos', id), html = INV.termosHtml[id] || (t && t.texto); if (!html){ toast('Termo não encontrado'); return; }
  invImprimir(html); toast('Termo pronto para imprimir: depois de assinado, anexe na ficha do funcionário');
}

/* ---------- etiquetas com QR code ---------- */
const invLinkAtivo = id => location.origin + location.pathname + '#inv:' + id;
function invQrSvg(texto){
  if (typeof qrcode !== 'function') return '';
  const q = qrcode(0, 'M'); q.addData(texto); q.make(); return q.createSvgTag({cellSize:3, margin:0, scalable:true});
}
function invImprimirEtiquetas(ids){
  const c = byId('clients', INV.cli) || {}, ativos = ids.map(i => invAchar('ativos', i)).filter(Boolean); if (!ativos.length) return;
  const html = '<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas</title><style>body{margin:8mm;font:11px Arial,Helvetica,sans-serif}.g{display:grid;grid-template-columns:repeat(3,62mm);gap:4mm}' +
    '.e{border:1px dashed #999;padding:3mm;display:grid;grid-template-columns:22mm 1fr;gap:3mm;align-items:center;height:26mm;overflow:hidden;break-inside:avoid}.e svg{width:22mm;height:22mm}.p{font:700 15px Arial;letter-spacing:.5px}.c{font-size:9px;color:#444}@page{margin:6mm}</style></head><body><div class="g">' +
    ativos.map(a => '<div class="e">' + invQrSvg(invLinkAtivo(a.id)) + '<div><div class="p">' + esc(a.patrimonio || 'sem patrimônio') + '</div><div>' + esc((a.descricao || invCat(a).nome).slice(0, 48)) + '</div>' + (a.numero_serie ? '<div class="c">S/N ' + esc(a.numero_serie) + '</div>' : '') + '<div class="c">' + esc(c.nome || '') + '</div></div></div>').join('') +
    '</div></body></html>';
  invImprimir(html); toast(ativos.length === 1 ? 'Etiqueta pronta para imprimir' : ativos.length + ' etiquetas prontas para imprimir');
}
// o QR (ou o link) abre o equipamento: #inv:<id>
async function invAbrirPeloLink(){
  const m = /^#inv:([0-9a-f-]{36})$/.exec(location.hash || ''); if (!m) return;
  const t0 = Date.now(); while (!invBanco() && Date.now() - t0 < 30000) await new Promise(r => setTimeout(r, 500));
  const sb = invBanco(); if (!sb) return;
  const {data} = await sb.from('inv_ativos').select('id, cliente_id').eq('id', m[1]).limit(1);
  const a = (data || []).find(x => x.id === m[1]); if (!a){ toast('Equipamento não encontrado (ou sem acesso a este cliente)'); return; }
  UI.sel = 'client:' + a.cliente_id; UI.view = 'inventario'; if (typeof abrirArvore === 'function') abrirArvore(UI.sel);
  if (typeof abrirModulo === 'function') abrirModulo('operacoes'); rOperacoes();
  await invCarregar(true); invRender(); invFichaAtivo(a.id);
  history.replaceState(null, '', location.pathname + location.search);
}
window.addEventListener('hashchange', invAbrirPeloLink); setTimeout(invAbrirPeloLink, 1500);

/* ---------- planilha: baixar ---------- */
const invCsvCel = v => { const s = v == null ? '' : String(v); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const invCsv = linhas => '﻿' + linhas.map(l => l.map(invCsvCel).join(';')).join('\r\n');
function invBaixar(nome, texto){ const b = new Blob([texto], {type:'text/csv;charset=utf-8'}), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
const invMoeda = v => v == null ? '' : (+v).toFixed(2).replace('.', ',');
function invLinhasCsv(qual){
  if (qual === 'equipamentos') return [['Patrimônio','Série','Categoria','Fabricante','Modelo','Descrição','Situação','Funcionário','Departamento','Aplicação','Local','Propriedade','Locadora','Fornecedor','Nota fiscal','Data da compra','Valor de compra','Valor atual','Garantia até','Hostname','IP','MAC','Sistema','Notas']].concat(
    invFiltrar(INV.d.ativos || []).map(a => { const m = invModelo(a), f = invFunc(a.funcionario_id);
      return [a.patrimonio, a.numero_serie, invCat(a).nome, m ? m.fabricante : '', m ? m.modelo : '', a.descricao, (INV_SIT[a.situacao] || [a.situacao])[0], f ? f.nome : '', f ? f.departamento : '', invAppNome(a.aplicacao_id), invLocalNome(a.local_id),
        svNomeInv(INV_PROP, a.propriedade), a.locadora, a.fornecedor, a.nota_fiscal, invDia(a.data_compra), invMoeda(a.valor_compra), invMoeda(invValorAtual(a)), invDia(a.garantia_ate), a.hostname, a.ip, a.mac, a.sistema, a.notas]; }));
  if (qual === 'funcionarios') return [['Nome','CPF','Telefone','Cargo','Departamento','Situação','Equipamentos com ele']].concat((INV.d.funcionarios || []).map(f => [f.nome, invCpf(f.cpf), f.telefone, f.cargo, f.departamento, f.situacao, (INV.d.ativos || []).filter(a => a.funcionario_id === f.id).length]));
  if (qual === 'estoque') return [['Item','Categoria','Unidade','Local','Quantidade','Mínimo (total)']].concat((INV.d.saldos || []).filter(s => +s.quantidade > 0).map(s => { const i = invAchar('itens', s.item_id) || {}; return [i.nome, (invAchar('categorias', i.categoria_id) || {}).nome, i.unidade, invLocalNome(s.local_id), +s.quantidade, +i.estoque_minimo || '']; }));
  if (qual === 'historico') return [['Data','Movimentação','Equipamento ou item','Quantidade','Para','Motivo','Quem']].concat((INV.d.movs || []).map(m => { const a = m.ativo_id && invAchar('ativos', m.ativo_id), it = m.item_id && invAchar('itens', m.item_id), p = m.feito_por && pessoa(m.feito_por);
    return [invDia(m.data), INV_MOV[m.tipo] || m.tipo, a ? invNomeAtivo(a) : it ? it.nome : '', m.quantidade != null ? +m.quantidade : '', m.funcionario_para ? (invFunc(m.funcionario_para) || {}).nome : m.aplicacao_para ? invAppNome(m.aplicacao_para) : invLocalNome(m.local_para), m.motivo, p ? p.nome : '']; }));
  return [];
}
function invBaixarCsv(qual){
  const c = byId('clients', INV.cli) || {nome:'cliente'}, l = invLinhasCsv(qual);
  invBaixar('inventario-' + qual + '-' + c.nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-') + '-' + invHoje() + '.csv', invCsv(l));
}

/* ---------- planilha: importar ---------- */
const INV_MODELO_EQ = ['patrimonio','serie','categoria','fabricante','modelo','descricao','situacao','local','funcionario','aplicacao','propriedade','locadora','fornecedor','nota_fiscal','data_compra','valor_compra','garantia_ate','hostname','ip','mac','sistema','notas'];
const INV_MODELO_FU = ['nome','cpf','telefone','cargo','departamento','situacao'];
const invChaveCol = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const INV_ALIAS = {numero_de_serie:'serie', n_serie:'serie', serial:'serie', s_n:'serie', patrimonio_plaqueta:'patrimonio', plaqueta:'patrimonio', tag:'patrimonio', nf:'nota_fiscal', nota:'nota_fiscal',
  data_de_compra:'data_compra', compra:'data_compra', valor:'valor_compra', valor_de_compra:'valor_compra', garantia:'garantia_ate', garantia_ate:'garantia_ate', usuario:'funcionario', responsavel:'funcionario', setor:'departamento', fone:'telefone', celular:'telefone', app:'aplicacao', sistema_operacional:'sistema', so:'sistema', observacoes:'notas', obs:'notas'};
function invLerCsv(texto){
  texto = texto.replace(/^﻿/, ''); const prim = texto.split(/\r?\n/)[0] || '';
  const sep = [';', '\t', ','].sort((a, b) => prim.split(b).length - prim.split(a).length)[0];
  const linhas = []; let lin = [], cel = '', aspas = false;
  for (let i = 0; i < texto.length; i++){ const ch = texto[i];
    if (aspas){ if (ch === '"'){ if (texto[i + 1] === '"'){ cel += '"'; i++; } else aspas = false; } else cel += ch; continue; }
    if (ch === '"'){ aspas = true; continue; }
    if (ch === sep){ lin.push(cel); cel = ''; continue; }
    if (ch === '\n' || ch === '\r'){ if (ch === '\r' && texto[i + 1] === '\n') i++; lin.push(cel); cel = ''; if (lin.some(x => x.trim())) linhas.push(lin); lin = []; continue; }
    cel += ch; }
  lin.push(cel); if (lin.some(x => x.trim())) linhas.push(lin);
  if (!linhas.length) return [];
  const cab = linhas[0].map(h => { const k = invChaveCol(h); return INV_ALIAS[k] || k; });
  return linhas.slice(1).map((l, n) => { const o = {_linha:n + 2}; cab.forEach((k, i) => { o[k] = (l[i] || '').trim(); }); return o; });
}
const invData = s => { s = String(s || '').trim(); let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s); if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'); m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? m[0] : (s ? 'ruim' : null); };
const invValor = s => { s = String(s || '').replace(/[R$\s]/g, ''); if (!s) return null; if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); const n = +s; return isFinite(n) ? n : NaN; };
const invAcha = (lista, campo, v) => { const n = invChaveCol(v); return n ? lista.find(x => invChaveCol(x[campo]) === n) : null; };
function invPrepararEquipamentos(linhas){
  const cats = (INV.d.categorias || []).filter(c => c.controle === 'unidade'), apps = invAppsDoCliente(INV.cli), pats = new Set((INV.d.ativos || []).map(a => a.patrimonio.toLowerCase()).filter(Boolean)), noArq = new Set();
  return linhas.map(l => {
    const erros = [], r = {linha:l._linha, dados:l};
    r.cat = invAcha(cats, 'nome', l.categoria); if (!r.cat) erros.push(l.categoria ? 'categoria "' + l.categoria + '" não existe' : 'falta a categoria');
    const pat = (l.patrimonio || '').trim(); if (pat){ if (pats.has(pat.toLowerCase())) erros.push('patrimônio ' + pat + ' já existe'); else if (noArq.has(pat.toLowerCase())) erros.push('patrimônio ' + pat + ' repetido na planilha'); noArq.add(pat.toLowerCase()); }
    if (l.funcionario){ const cpf = l.funcionario.replace(/\D/g, ''); r.func = (INV.d.funcionarios || []).find(f => (cpf.length === 11 && f.cpf === cpf) || invChaveCol(f.nome) === invChaveCol(l.funcionario)); if (!r.func) erros.push('funcionário "' + l.funcionario + '" não cadastrado'); }
    if (l.aplicacao){ r.app = invAcha(apps, 'nome', l.aplicacao); if (!r.app) erros.push('aplicação "' + l.aplicacao + '" não é deste cliente'); }
    if (r.func && r.app) erros.push('ou funcionário ou aplicação, não os dois');
    r.local = l.local ? invAcha(INV.d.locais || [], 'nome', l.local) : null; r.localNovo = l.local && !r.local ? l.local.trim() : '';
    const sitTxt = invChaveCol(l.situacao);
    r.sit = r.func ? 'uso_funcionario' : r.app ? 'uso_aplicacao' : ({'':'estoque', estoque:'estoque', em_estoque:'estoque', disponivel:'estoque', em_uso_no_local:'uso_local', uso_local:'uso_local', no_local:'uso_local', aguardando:'aguardando', defeito:'defeito', com_defeito:'defeito', quebrado:'defeito'})[sitTxt];
    if (!r.sit) erros.push('situação "' + l.situacao + '" (use: estoque, no local, aguardando, defeito; em uso: preencha o funcionário ou a aplicação)');
    const prop = invChaveCol(l.propriedade); r.prop = ({'':'proprio', proprio:'proprio', alugado:'alugado', locado:'alugado', comodato:'comodato', byod:'byod', do_funcionario:'byod'})[prop]; if (!r.prop) erros.push('propriedade "' + l.propriedade + '"');
    if (r.prop === 'alugado' && !l.locadora) erros.push('alugado precisa da locadora');
    r.dc = invData(l.data_compra); r.ga = invData(l.garantia_ate); if (r.dc === 'ruim') erros.push('data da compra (use dia/mês/ano)'); if (r.ga === 'ruim') erros.push('garantia (use dia/mês/ano)');
    r.vc = invValor(l.valor_compra); if (Number.isNaN(r.vc)) erros.push('valor de compra');
    r.modeloNovo = !l.modelo ? null : ((INV.d.modelos || []).find(m => invChaveCol(m.modelo) === invChaveCol(l.modelo) && invChaveCol(m.fabricante) === invChaveCol(l.fabricante || m.fabricante)) || {novo:true, fabricante:l.fabricante || '', modelo:l.modelo});
    r.erros = erros; return r;
  });
}
function invPrepararFuncionarios(linhas){
  const cpfs = new Set((INV.d.funcionarios || []).map(f => f.cpf).filter(Boolean)), noArq = new Set();
  return linhas.map(l => { const erros = [], cpf = (l.cpf || '').replace(/\D/g, '');
    if (!l.nome) erros.push('falta o nome');
    if (cpf){ if (!invCpfValido(cpf)) erros.push('CPF inválido'); else if (cpfs.has(cpf)) erros.push('CPF já cadastrado'); else if (noArq.has(cpf)) erros.push('CPF repetido na planilha'); noArq.add(cpf); }
    const sit = ({'':'ativo', ativo:'ativo', afastado:'afastado', desligado:'desligado'})[invChaveCol(l.situacao)]; if (!sit) erros.push('situação "' + l.situacao + '"');
    return {linha:l._linha, dados:l, cpf, sit, erros}; });
}
function invPlanilhaHTML(){
  const pv = INV.previa, pode = podeEditar();
  const bloco = (qual, tit, txt) => '<section class="inv-quadro"><h4>' + tit + '</h4><p class="inv-ajuda">' + txt + '</p><div class="inv-acoes-topo"><button type="button" class="btn sec peq" data-inv-modelo-csv="' + qual + '">Baixar o modelo da planilha</button>' +
    '<button type="button" class="btn sec peq" data-inv-csv="' + qual + '">Baixar o que já existe</button>' + (pode ? '<label class="btn peq inv-enviar">Escolher a planilha (CSV)<input type="file" hidden accept=".csv,.txt,text/csv" data-inv-importar="' + qual + '"></label>' : '') + '</div>' +
    (pv && pv.qual === qual ? invPreviaHTML(pv) : '') + '</section>';
  return '<p class="inv-ajuda">Planilha no formato CSV (no Excel: Salvar como, CSV separado por ponto e vírgula). A primeira linha tem os nomes das colunas. Antes de gravar aparece a prévia, com os erros de cada linha: nada é gravado enquanto houver erro.</p>' +
    bloco('funcionarios', 'Funcionários', 'Colunas: nome, cpf, telefone, cargo, departamento, situacao (ativo, afastado ou desligado). Importe os funcionários antes dos equipamentos que estão com eles.') +
    bloco('equipamentos', 'Equipamentos', 'Colunas: patrimonio, serie, categoria (igual a uma das categorias), fabricante, modelo, descricao, situacao, local, funcionario (nome ou CPF), aplicacao, propriedade, locadora, fornecedor, nota_fiscal, data_compra, valor_compra, garantia_ate, hostname, ip, mac, sistema, notas. Local e modelo que não existem são criados.') +
    bloco('estoque', 'Estoque (baixar)', 'O saldo de cada item em cada local.');
}
function invPreviaHTML(pv){
  const ruins = pv.linhas.filter(l => l.erros.length);
  return '<div class="inv-previa"><p><b>' + pv.linhas.length + ' linhas</b> · ' + (ruins.length ? '<b class="inv-venc">' + ruins.length + ' com erro</b>' : 'nenhum erro') + '</p>' +
    (ruins.length ? '<ul class="inv-erros">' + ruins.slice(0, 50).map(l => '<li>Linha ' + l.linha + ': ' + esc(l.erros.join('; ')) + '</li>').join('') + '</ul>' : '') +
    (!ruins.length && pv.linhas.length ? '<button type="button" class="btn" data-inv-importar-ok>Importar ' + pv.linhas.length + (pv.qual === 'equipamentos' ? ' equipamentos' : ' funcionários') + '</button>' : '') + '<button type="button" class="btn fant peq" data-inv-previa-limpar>Limpar</button></div>';
}
async function invImportarAgora(){
  const pv = INV.previa; if (!pv || pv.linhas.some(l => l.erros.length)) return;
  const btn = $('#ops-corpo [data-inv-importar-ok]'); if (btn) btn.disabled = true;
  let n = 0;
  try {
    if (pv.qual === 'funcionarios'){
      for (const r of pv.linhas){ const d = r.dados; await invGravar('inv_funcionarios', {nome:d.nome, cpf:r.cpf, telefone:d.telefone || '', cargo:d.cargo || '', departamento:d.departamento || '', situacao:r.sit, desligado_em:r.sit === 'desligado' ? invHoje() : null}); n++; }
    } else {
      const locais = {}, modelos = {};
      for (const r of pv.linhas){
        const d = r.dados; let local = r.local ? r.local.id : null;
        if (r.localNovo){ const k = invChaveCol(r.localNovo); local = locais[k] || (locais[k] = await invGravar('inv_locais', {nome:r.localNovo, tipo:'sala'})); }
        let modelo = r.modeloNovo && r.modeloNovo.id ? r.modeloNovo.id : null;
        if (r.modeloNovo && r.modeloNovo.novo){ const k = invChaveCol(r.modeloNovo.fabricante + '|' + r.modeloNovo.modelo); modelo = modelos[k] || (modelos[k] = await invGravar('inv_modelos', {categoria_id:r.cat.id, fabricante:r.modeloNovo.fabricante, modelo:r.modeloNovo.modelo})); }
        await invGravar('inv_ativos', {categoria_id:r.cat.id, modelo_id:modelo, patrimonio:d.patrimonio || '', numero_serie:d.serie || '', descricao:d.descricao || '', situacao:r.sit, local_id:local,
          funcionario_id:r.func ? r.func.id : null, aplicacao_id:r.app ? r.app.id : null, propriedade:r.prop, locadora:d.locadora || '', fornecedor:d.fornecedor || '', nota_fiscal:d.nota_fiscal || '',
          data_compra:r.dc, valor_compra:r.vc, garantia_ate:r.ga, hostname:d.hostname || '', ip:d.ip || '', mac:d.mac || '', sistema:d.sistema || '', notas:d.notas || ''});
        n++;
      }
    }
  } catch (e){ invErro(e); }
  INV.previa = null; toast(n + (n === 1 ? ' linha importada' : ' linhas importadas')); invRecarregar();
}

/* ---------- conferência física ---------- */
function invConferenciaHTML(){
  const C = (INV.d.conferencias || []).slice().sort((a, b) => String(b.iniciada_em).localeCompare(String(a.iniciada_em))), pode = podeEditar();
  const ab = INV.confAberta && invAchar('conferencias', INV.confAberta);
  if (ab) return invConferenciaAbertaHTML(ab);
  return '<div class="inv-acoes-topo">' + (pode ? '<button type="button" class="btn" data-inv-nova-conf>Nova conferência</button>' : '') + '</div>' +
    '<p class="inv-ajuda">Vá ao local, leia a etiqueta (câmera do celular ou leitor) ou digite o patrimônio. O que não for achado aparece no fim, para marcar como perdido ou procurar.</p>' +
    (C.length ? '<div class="tabela-rolo"><table class="inv-tab"><thead><tr><th>Conferência</th><th>Local</th><th>Começou</th><th class="inv-num">Achados</th><th>Situação</th><th></th></tr></thead><tbody>' + C.map(c => {
      const it = (INV.d.citens || []).filter(x => x.conferencia_id === c.id);
      return '<tr><td><b>' + esc(c.nome) + '</b></td><td>' + esc(c.local_id ? invLocalNome(c.local_id) : 'Todos') + '</td><td>' + invDia(String(c.iniciada_em).slice(0, 10)) + '</td><td class="inv-num">' + it.filter(x => x.achado).length + '</td>' +
        '<td>' + (c.concluida_em ? 'Concluída em ' + invDia(String(c.concluida_em).slice(0, 10)) : '<b>Aberta</b>') + '</td><td><button type="button" class="btn fant peq" data-inv-abrir-conf="' + esc(c.id) + '">Abrir</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="inv-vazio">Nenhuma conferência ainda.</p>');
}
// o que deve estar no local: menos o que está com uma pessoa (fica com ela, não no local)
function invEsperados(c){ return (INV.d.ativos || []).filter(a => !['baixado','uso_funcionario','emprestado','perdido'].includes(a.situacao) && (!c.local_id || a.local_id === c.local_id)); }
function invConferenciaAbertaHTML(c){
  const it = (INV.d.citens || []).filter(x => x.conferencia_id === c.id), marc = new Map(it.map(x => [x.ativo_id, x])), esp = invEsperados(c), aberta = !c.concluida_em && podeEditar();
  const achados = esp.filter(a => marc.has(a.id) && marc.get(a.id).achado), faltam = esp.filter(a => !marc.has(a.id) || !marc.get(a.id).achado), fora = it.filter(x => x.achado && !esp.some(a => a.id === x.ativo_id));
  const linha = (a, ok) => '<li><button type="button" class="inv-link" data-inv-abrir="' + esc(a.id) + '">' + esc(invNomeAtivo(a)) + '</button> <small>' + esc(invOnde(a)) + '</small>' +
    (aberta ? (ok ? '' : ' <button type="button" class="btn fant peq" data-inv-achei="' + esc(a.id) + '">Achei</button>') + (marc.has(a.id) && !marc.get(a.id).achado ? ' <small class="inv-venc">não achado</small>' : aberta && !ok ? ' <button type="button" class="btn fant peq" data-inv-nao-achei="' + esc(a.id) + '">Não achei</button>' : '') : '') + '</li>';
  return '<div class="inv-acoes-topo"><button type="button" class="btn fant" data-inv-fechar-conf>Voltar</button><b>' + esc(c.nome) + '</b> <span class="inv-conta">' + esc(c.local_id ? invLocalNome(c.local_id) : 'todos os locais') + '</span></div>' +
    (aberta ? '<div class="inv-ler"><input class="campo" data-inv-codigo placeholder="Patrimônio, série ou leitura do QR (Enter confirma)" autocomplete="off"><button type="button" class="btn" data-inv-ler-ok>Conferir</button>' +
      ('BarcodeDetector' in window && navigator.mediaDevices ? '<button type="button" class="btn sec" data-inv-camera>Ler com a câmera</button>' : '') + '</div>' : '') +
    '<div class="inv-kpis">' + invKpi(esp.length, 'esperados') + invKpi(achados.length, 'achados') + invKpi(faltam.length, 'faltando', faltam.length ? 'inv-alerta' : '') + invKpi(fora.length, 'achados fora do esperado') + '</div>' +
    '<div class="inv-grade2"><section class="inv-quadro"><h4>Faltando</h4>' + (faltam.length ? '<ul class="inv-lista">' + faltam.map(a => linha(a, false)).join('') + '</ul>' : '<p class="inv-vazio">Nada faltando.</p>') + '</section>' +
      '<section class="inv-quadro"><h4>Achados</h4>' + (achados.length || fora.length ? '<ul class="inv-lista">' + achados.map(a => linha(a, true)).join('') + fora.map(x => { const a = invAchar('ativos', x.ativo_id); return a ? '<li>' + esc(invNomeAtivo(a)) + ' <small class="inv-quase">achado aqui, mas devia estar em ' + esc(invOnde(a) || 'outro lugar') + '</small></li>' : ''; }).join('') + '</ul>' : '<p class="inv-vazio">Nada ainda.</p>') + '</section></div>' +
    (aberta ? '<div class="inv-acoes-topo"><button type="button" class="btn" data-inv-concluir-conf>Concluir a conferência</button>' + (faltam.length ? '<span class="inv-ajuda">Ao concluir, dá para marcar os ' + faltam.length + ' que faltam como perdidos.</span>' : '') + '</div>' : '');
}
function invAcharPorCodigo(txt){
  txt = String(txt || '').trim(); if (!txt) return null;
  const m = /#inv:([0-9a-f-]{36})/.exec(txt); if (m) return invAchar('ativos', m[1]);
  const n = txt.toLowerCase(); return (INV.d.ativos || []).find(a => a.patrimonio && a.patrimonio.toLowerCase() === n) || (INV.d.ativos || []).find(a => a.numero_serie && a.numero_serie.toLowerCase() === n);
}
async function invConferirCodigo(txt){
  const c = invAchar('conferencias', INV.confAberta), a = invAcharPorCodigo(txt);
  if (!a){ toast('Não achei nenhum equipamento com "' + txt + '"'); return; }
  await invRpc('inv_conferir', {p_conferencia:c.id, p_ativo:a.id, p_achado:true, p_local:c.local_id || a.local_id || null, p_notas:''}).then(() => toast('Conferido: ' + invNomeAtivo(a))).catch(invErro);
  await invRecarregar(); const i = $('#ops-corpo [data-inv-codigo]'); if (i) i.focus();
}
async function invCamera(){
  let video, parar = false, stream;
  const dlg = modal('Ler a etiqueta', '<video class="inv-video" autoplay playsinline muted></video><p class="inv-ajuda">Aponte para o QR ou o código de barras.</p>', [{txt:'Fechar', cls:'sec', acao:() => { parar = true; }}]);
  dlg.addEventListener('close', () => { parar = true; if (stream) stream.getTracks().forEach(t => t.stop()); });
  try {
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}); video = dlg.querySelector('video'); video.srcObject = stream;
    const det = new BarcodeDetector({formats:['qr_code','code_128','code_39','ean_13']});
    while (!parar && dlg.isConnected){ const r = await det.detect(video).catch(() => []); if (r.length){ parar = true; stream.getTracks().forEach(t => t.stop()); dlg.close(); dlg.remove(); await invConferirCodigo(r[0].rawValue); return; } await new Promise(x => setTimeout(x, 250)); }
  } catch (e){ toast('A câmera não abriu aqui: digite o patrimônio'); if (dlg.isConnected){ dlg.close(); dlg.remove(); } }
}
function invNovaConferencia(){
  invForm('Nova conferência', '<div class="grade-form">' + invCampo('Nome', invIn('ic3-nome', 'Conferência de ' + invDia(invHoje()), ' maxlength="160"')) + invCampo('Local', '<select class="sel" id="ic3-local">' + invLocalOpts('', 'Todos os locais') + '</select>') + '</div>', async d => {
    const id = await invGravar('inv_conferencias', {nome:invV(d, 'ic3-nome') || 'Conferência', local_id:invV(d, 'ic3-local') || null}); INV.confAberta = id; toast('Conferência aberta'); });
}
function invConcluirConferencia(){
  const c = invAchar('conferencias', INV.confAberta), it = (INV.d.citens || []).filter(x => x.conferencia_id === c.id), faltam = invEsperados(c).filter(a => !it.some(x => x.ativo_id === a.id && x.achado));
  modal('Concluir a conferência', '<p>' + (faltam.length ? faltam.length + (faltam.length === 1 ? ' equipamento não foi achado.' : ' equipamentos não foram achados.') : 'Tudo achado.') + '</p>' + (faltam.length ? '<label class="cm-ck"><input type="checkbox" id="cc-perdidos"> Marcar os que faltam como perdidos (dá para desfazer depois)</label>' : ''),
    [{txt:'Cancelar', cls:'sec'}, {txt:'Concluir', acao:d => { const perd = d.querySelector('#cc-perdidos') && d.querySelector('#cc-perdidos').checked; (async () => {
      await invGravar('inv_conferencias', {concluida_em:new Date().toISOString()}, c.id);
      if (perd) for (const a of faltam.filter(x => (INV_ACOES[x.situacao] || []).includes('perda'))) await invRpc('inv_movimentar', {p_ativo:a.id, p_tipo:'perda', p_situacao:null, p_local:null, p_funcionario:null, p_aplicacao:null, p_devolucao:null, p_motivo:'Não achado na ' + c.nome, p_data:null, p_termo:null});
      toast('Conferência concluída'); invRecarregar(); })().catch(invErro); }}]);
}

/* ---------- item de trabalho na frente Infraestrutura ---------- */
function invCriarItemTrabalho(ativoId, texto){
  const a = invAchar('ativos', ativoId), apps = invAppsDoCliente(INV.cli), app = (a && a.aplicacao_id) || (apps[0] && apps[0].id);
  const w = app && ((typeof frenteSugerida === 'function' && frenteSugerida(app, '', 'infraestrutura')) || byId('ws', primeiroWs('app:' + app)));
  if (!w){ toast('Este cliente ainda não tem aplicação com frente para receber o item'); return; }
  const titulo = String(texto || 'Inventário').slice(0, 280);
  if (D.issues.some(i => !i.arquivado && i.titulo === titulo)){ toast('Este item já existe'); return; }
  const ni = novoIssue({titulo, ws:w.id, tipo:'task', status:'todo', prio:'high'});
  ni.desc = 'Aviso do inventário de ' + ((byId('clients', INV.cli) || {}).nome || '') + (a ? ': ' + invNomeAtivo(a) + (invOnde(a) ? ' (' + invOnde(a) + ')' : '') : '') + '.';
  D.issues.push(ni); registrar('criou', ni); salvar(); toast('Item criado na frente ' + w.nome);
}

/* ---------- cliques desta parte ---------- */
function invCliqueExtra(e){
  const t = s => e.target.closest(s); let x;
  if ((x = t('[data-inv-modelo-csv]'))){ const q = x.dataset.invModeloCsv, cab = q === 'funcionarios' ? INV_MODELO_FU : INV_MODELO_EQ;
    const ex = q === 'funcionarios' ? ['Maria Souza','111.444.777-35','(11) 99999-0000','Analista','Financeiro','ativo'] : ['PAT-0001','5CD1234XYZ','Notebook','Dell','Latitude 5440','Notebook do financeiro','','Sala TI','Maria Souza','','proprio','','Loja X','12345','15/03/2025','5.200,00','15/03/2028','NB-MARIA','','','Windows 11 Pro',''];
    return invBaixar('modelo-' + q + '.csv', invCsv([cab, ex])); }
  if (t('[data-inv-importar-ok]')) return invImportarAgora();
  if (t('[data-inv-previa-limpar]')){ INV.previa = null; return invRender(); }
  if (t('[data-inv-nova-conf]')) return invNovaConferencia();
  if ((x = t('[data-inv-abrir-conf]'))){ INV.confAberta = x.dataset.invAbrirConf; return invRender(); }
  if (t('[data-inv-fechar-conf]')){ INV.confAberta = null; return invRender(); }
  if ((x = t('[data-inv-achei]'))) return invConferirCodigo('#inv:' + x.dataset.invAchei);
  if ((x = t('[data-inv-nao-achei]'))) return invRpc('inv_conferir', {p_conferencia:INV.confAberta, p_ativo:x.dataset.invNaoAchei, p_achado:false, p_local:null, p_notas:''}).then(invRecarregar).catch(invErro);
  if (t('[data-inv-ler-ok]')){ const i = $('#ops-corpo [data-inv-codigo]'); return invConferirCodigo(i ? i.value : ''); }
  if (t('[data-inv-camera]')) return invCamera();
  if (t('[data-inv-concluir-conf]')) return invConcluirConferencia();
}
document.addEventListener('keydown', e => { const i = e.target.closest && e.target.closest('#ops-corpo [data-inv-codigo]'); if (i && e.key === 'Enter'){ e.preventDefault(); invConferirCodigo(i.value); } });
document.addEventListener('change', e => {
  const f = e.target.closest && e.target.closest('#ops-corpo [data-inv-importar]'); if (!f || !f.files[0]) return;
  const qual = f.dataset.invImportar, r = new FileReader();
  r.onload = () => { const linhas = invLerCsv(String(r.result || '')); INV.previa = {qual, linhas:qual === 'funcionarios' ? invPrepararFuncionarios(linhas) : invPrepararEquipamentos(linhas)}; invRender(); };
  r.readAsText(f.files[0], 'utf-8');
});

/* ---------- ligações com o resto do sistema ---------- */
// Custos: o patrimônio do cliente (ou só o da aplicação) e o que custa por mês
function invCustosHTML(chave){
  if (!invBanco() || !invPodeTer(chave) || UI.sel !== chave) return '';
  const cli = invCliDe(chave); if (!cli) return '';
  if (INV.cli !== cli || !INV.lido){ invCarregar(true).then(() => { if (UI.view === 'custos') rView(); }); return ''; }
  const ativos = invAtivosDoEscopo(chave).filter(a => a.situacao !== 'baixado'); if (!ativos.length && !(INV.d.licencas || []).length) return '';
  const compra = ativos.reduce((t, a) => t + (+a.valor_compra || 0), 0), atual = ativos.reduce((t, a) => t + (invValorAtual(a) || 0), 0), aluguel = ativos.filter(a => a.propriedade === 'alugado').reduce((t, a) => t + (+a.valor_mensal || 0), 0);
  const lic = invEscopoApps(chave) ? 0 : (INV.d.licencas || []).reduce((t, l) => t + invMensalLicenca(l), 0);
  const ids = new Set(ativos.map(a => a.id)), um = new Date(HOJE); um.setFullYear(um.getFullYear() - 1);
  const manut = (INV.d.manut || []).filter(m => ids.has(m.ativo_id) && String(m.aberta_em) >= iso(um)).reduce((t, m) => t + (+m.custo || 0), 0);
  return '<h2 class="sub">Inventário de TI</h2><div class="kpis" style="margin-top:8px"><div class="kpi"><b>' + brl(compra) + '</b><span>Valor de compra (' + ativos.length + ' equipamentos)</span></div><div class="kpi"><b>' + brl(atual) + '</b><span>Valor atual (depreciação)</span></div>' +
    '<div class="kpi"><b>' + brl(aluguel + lic) + '</b><span>Por mês: aluguéis' + (lic ? ' e licenças' : '') + '</span></div><div class="kpi"><b>' + brl(manut) + '</b><span>Manutenções nos últimos 12 meses</span></div></div>' +
    '<p class="sec" style="font-size:12.5px">Do inventário (aba Inventário do cliente).' + (invEscopoApps(chave) ? ' Aqui entram os equipamentos em uso pela aplicação e os dos funcionários que a usam.' : '') + '</p>';
}
if (typeof vCustosEscopo === 'function'){ const _vCustosInv = vCustosEscopo; vCustosEscopo = function(chave){ return _vCustosInv.apply(this, arguments) + invCustosHTML(chave); }; }
// Ficha técnica (Ambientes): os equipamentos que a aplicação usa
function invFichaLigacao(sec, chave){
  if (sec !== 'Environments' || !invBanco() || !/^app:/.test(chave)) return '';
  const cli = invCliDe(chave); if (INV.cli !== cli || !INV.lido){ invCarregar(true).then(() => { if (UI.view === 'sheet') rView(); }); return ''; }
  const app = chave.slice(4), lista = (INV.d.ativos || []).filter(a => a.aplicacao_id === app && a.situacao !== 'baixado'); if (!lista.length) return '';
  return '<ul class="sv-ficha"><li><b>Equipamentos em uso pela aplicação:</b> ' + esc(lista.map(invNomeAtivo).join(', ')) + '</li></ul>';
}
(function(){ const v = typeof svFichaLigacao === 'function' ? svFichaLigacao : null; if (!v) return; svFichaLigacao = function(sec, chave){ return v.apply(this, arguments) + invFichaLigacao(sec, chave); }; })();
// ficha do cliente: aba que leva ao inventário
if (typeof fcDesenhar === 'function'){
  const _fcDesenharInv = fcDesenhar;
  fcDesenhar = function(){
    _fcDesenharInv.apply(this, arguments);
    const abas = FC.dlg && FC.dlg.querySelector('.fc-abas'); if (!abas || abas.querySelector('[data-fc-inv]') || UI.verComo === 'stakeholder') return;
    abas.insertAdjacentHTML('beforeend', '<button class="view-b" type="button" data-fc-inv>Inventário de TI</button>');
  };
  document.addEventListener('click', e => { const b = e.target.closest('[data-fc-inv]'); if (!b) return; const id = FC.cli; if (FC.dlg){ FC.dlg.close(); FC.dlg.remove(); }
    UI.sel = 'client:' + id; UI.view = 'inventario'; if (typeof abrirArvore === 'function') abrirArvore(UI.sel); if (typeof abrirModulo === 'function') abrirModulo('operacoes'); salvarUI(); rOperacoes(); });
}
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {invLerCsv, invPrepararEquipamentos, invPrepararFuncionarios, invImportarAgora, invTermoHtml, invImprimirEtiquetas, invQrSvg, invCustosHTML, invFichaLigacao, invAcharPorCodigo, invLinhasCsv});
