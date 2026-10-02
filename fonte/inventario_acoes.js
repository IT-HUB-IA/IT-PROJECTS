/* ===== Inventário: cadastros e movimentações =====
   Formulários (equipamento, funcionário, local, categoria, modelo, item de estoque, licença), a ficha do equipamento
   com as ações (entregar, emprestar, usar em aplicação, devolver, transferir, manutenção, defeito, perda, baixa) e o
   desfazer da última movimentação. Tudo grava direto no banco; a situação só muda pelas funções do banco. */

/* ---------- gravar ---------- */
async function invGravar(tabela, row, id){
  const sb = invBanco(); if (!sb) throw new Error('banco desligado');
  if (id){ const {data, error} = await sb.from(tabela).update(row).eq('id', id).select('id'); if (error) throw error; if (!data || !data.length) throw new Error('o banco não deixou mudar (sem acesso a este cliente)'); return id; }
  const novo = Object.assign({id:novoUuid(), cliente_id:INV.cli}, row); const {error} = await sb.from(tabela).insert(novo); if (error) throw error; return novo.id;
}
async function invRpc(fn, args){ const {data, error} = await invBanco().rpc(fn, args); if (error) throw error; return data; }
const invErro = e => { const m = String(e && e.message || e); toast('Não deu para gravar: ' + (/inv_ativos_patrimonio_uq/.test(m) ? 'este patrimônio já existe neste cliente' : /inv_funcionarios_cpf_uq/.test(m) ? 'este CPF já está cadastrado neste cliente' : /cpf_check|cpf_valido/.test(m) ? 'CPF inválido' : /acesso_onde_check/.test(m) ? 'em "onde fica o acesso" vai só onde ela está, nunca a senha' : m)); };
// janela de formulário: os botões não fecham sozinhos (só quando grava)
function invForm(titulo, corpo, gravar, extra){
  const dlg = modal(titulo, corpo, [{txt:'Cancelar', cls:'sec'}].concat(extra || [], [{txt:'Gravar', acao:d => { const b = d.querySelector('.modal-rod .btn:not(.sec)'); if (b) b.disabled = true;
    Promise.resolve().then(() => gravar(d)).then(ok => { if (ok === false){ if (b) b.disabled = false; return; } d.close(); d.remove(); invRecarregar(); }).catch(e => { if (b) b.disabled = false; invErro(e); }); return false; }}]));
  dlg.classList.add('inv-modal'); return dlg;
}
const invV = (d, id) => { const x = d.querySelector('#' + id); return x ? (x.type === 'checkbox' ? x.checked : x.value.trim()) : ''; };
const invCampo = (rot, html, cls) => '<label class="lb' + (cls ? ' ' + cls : '') + '">' + rot + html + '</label>';
const invIn = (id, v, extra) => '<input class="campo" id="' + id + '" value="' + esc(v == null ? '' : v) + '"' + (extra || '') + '>';
const invFuncOpts = (v, todos) => invOpts((INV.d.funcionarios || []).filter(f => todos || f.situacao !== 'desligado' || f.id === v).sort((a, b) => a.nome.localeCompare(b.nome)).map(f => [f.id, f.nome + (f.departamento ? ' · ' + f.departamento : '')]), v, 'Escolha o funcionário');
const invLocalOpts = (v, vazio) => invOpts((INV.d.locais || []).filter(l => l.ativo || l.id === v).map(l => [l.id, invLocalNome(l.id)]).sort((a, b) => a[1].localeCompare(b[1])), v, vazio == null ? 'Sem local' : vazio);
const invAppOpts = v => invOpts(invAppsDoCliente(INV.cli).map(a => [a.id, a.nome]), v, 'Escolha a aplicação');

/* ---------- equipamento: cadastrar e editar ---------- */
function invProximoPatrimonio(){
  const nums = (INV.d.ativos || []).map(a => (a.patrimonio.match(/^(.*?)(\d+)$/) || [])).filter(m => m.length);
  if (!nums.length) return 'PAT-0001';
  const m = nums.sort((a, b) => +b[2] - +a[2])[0]; return m[1] + String(+m[2] + 1).padStart(m[2].length, '0');
}
function invFormAtivo(id){
  const a = id ? invAchar('ativos', id) : {situacao:'estoque', propriedade:'proprio', patrimonio:invProximoPatrimonio()}, novo = !id;
  const cats = (INV.d.categorias || []).filter(c => c.controle === 'unidade' && (c.ativo || c.id === a.categoria_id));
  const modelos = INV.d.modelos || [];
  const corpo = '<div class="inv-form">' +
    '<fieldset><legend>O equipamento</legend><div class="grade-form">' + invCampo('Categoria', '<select class="sel" id="ia-cat">' + invOpts(cats.map(c => [c.id, c.nome]), a.categoria_id, 'Escolha') + '</select>') +
      invCampo('Modelo', '<select class="sel" id="ia-mod">' + invOpts(modelos.map(m => [m.id, [m.fabricante, m.modelo].filter(Boolean).join(' ')]), a.modelo_id, 'Sem modelo (ou cadastre ao lado)') + '</select>') +
      invCampo('Novo modelo: fabricante', invIn('ia-fab', '', ' placeholder="Ex.: Dell"')) + invCampo('Novo modelo: nome', invIn('ia-modn', '', ' placeholder="Ex.: Latitude 5440"')) +
      invCampo('Patrimônio (plaqueta)', invIn('ia-pat', a.patrimonio, ' maxlength="60"')) + invCampo('Número de série', invIn('ia-serie', a.numero_serie, ' maxlength="120"')) +
      invCampo('Descrição', invIn('ia-desc', a.descricao, ' maxlength="300" placeholder="Ex.: Notebook do financeiro, i7, 16 GB"'), 'largo') +
      (novo ? invCampo('Cadastrar quantos iguais', invIn('ia-copias', 1, ' type="number" min="1" max="200"') + '<small class="inv-ajuda">Com o patrimônio em sequência e a série em branco</small>') : '') + '</div></fieldset>' +
    (novo ? '<fieldset><legend>Onde começa</legend><div class="grade-form">' + invCampo('Situação', '<select class="sel" id="ia-sit">' + invOpts([['estoque','Em estoque'],['uso_funcionario','Em uso por funcionário'],['uso_aplicacao','Em uso por aplicação'],['uso_local','Em uso no local'],['aguardando','Aguardando'],['defeito','Com defeito']], a.situacao) + '</select>') +
      invCampo('Local', '<select class="sel" id="ia-local">' + invLocalOpts(a.local_id) + '</select>') + invCampo('Funcionário', '<select class="sel" id="ia-func">' + invFuncOpts(a.funcionario_id) + '</select>', 'ia-so-func') +
      invCampo('Aplicação', '<select class="sel" id="ia-app">' + invAppOpts(a.aplicacao_id) + '</select>', 'ia-so-app') + '</div></fieldset>' : '') +
    '<fieldset><legend>De quem é e a compra</legend><div class="grade-form">' + invCampo('Propriedade', '<select class="sel" id="ia-prop">' + invOpts(INV_PROP, a.propriedade) + '</select>') +
      invCampo('Locadora', invIn('ia-loc', a.locadora, ' maxlength="120"'), 'ia-so-alug') + invCampo('Fim do contrato', invIn('ia-cfim', a.contrato_fim, ' type="date"'), 'ia-so-alug') + invCampo('Aluguel por mês (R$)', invIn('ia-vmes', a.valor_mensal, ' type="number" min="0" step="0.01"'), 'ia-so-alug') +
      invCampo('Fornecedor', invIn('ia-forn', a.fornecedor, ' maxlength="120"')) + invCampo('Nota fiscal', invIn('ia-nf', a.nota_fiscal, ' maxlength="60"')) + invCampo('Chave da nota (44 dígitos)', invIn('ia-nfc', a.nf_chave, ' maxlength="44" inputmode="numeric"')) +
      invCampo('Data da compra', invIn('ia-dcompra', a.data_compra, ' type="date"')) + invCampo('Valor de compra (R$)', invIn('ia-vcompra', a.valor_compra, ' type="number" min="0" step="0.01"')) + invCampo('Garantia até', invIn('ia-gar', a.garantia_ate, ' type="date"')) +
      invCampo('Depreciação própria (% ao ano)', invIn('ia-dep', a.depreciacao_pct_ano, ' type="number" min="0" max="100" step="0.5" placeholder="vazio: a da categoria"')) + '</div></fieldset>' +
    '<fieldset><legend>Rede e sistema</legend><div class="grade-form">' + invCampo('Hostname', invIn('ia-host', a.hostname, ' maxlength="120"')) + invCampo('IP', invIn('ia-ip', a.ip, ' maxlength="64"')) + invCampo('MAC', invIn('ia-mac', a.mac, ' maxlength="64"')) +
      invCampo('Sistema', invIn('ia-so', a.sistema, ' maxlength="120" placeholder="Ex.: Windows 11 Pro"')) + invCampo('Onde fica o acesso (nunca a senha)', invIn('ia-acesso', a.acesso_onde, ' maxlength="300" placeholder="Ex.: cofre de senhas, item Notebook João"'), 'largo') + '</div></fieldset>' +
    '<fieldset><legend>Anotações</legend><textarea class="campo" id="ia-notas" rows="3" maxlength="4000">' + esc(a.notas || '') + '</textarea></fieldset></div>';
  const dlg = invForm(novo ? 'Cadastrar equipamento' : 'Editar ' + invNomeAtivo(a), corpo, d => invSalvarAtivo(d, a));
  const vis = () => { const s = invV(dlg, 'ia-sit'), p = invV(dlg, 'ia-prop'); dlg.querySelectorAll('.ia-so-func').forEach(x => x.hidden = s !== 'uso_funcionario'); dlg.querySelectorAll('.ia-so-app').forEach(x => x.hidden = s !== 'uso_aplicacao'); dlg.querySelectorAll('.ia-so-alug').forEach(x => x.hidden = p !== 'alugado'); };
  vis(); dlg.addEventListener('change', vis);
}
async function invSalvarAtivo(d, a){
  const v = id => invV(d, id);
  if (!v('ia-cat')){ toast('Escolha a categoria'); return false; }
  const nfc = v('ia-nfc').replace(/\D/g, ''); if (nfc && nfc.length !== 44){ toast('A chave da nota tem 44 dígitos'); return false; }
  if (/(senha|password|passwd|pwd|token|secret|pin)\s*[:=]\s*\S/i.test(v('ia-acesso'))){ toast('Em "Onde fica o acesso" vai só onde ela está, nunca a senha'); return false; }
  if (v('ia-prop') === 'alugado' && !v('ia-loc')){ toast('Diga a locadora'); return false; }
  let modelo = v('ia-mod') || null;
  if (!modelo && v('ia-modn')) modelo = await invGravar('inv_modelos', {categoria_id:v('ia-cat'), fabricante:v('ia-fab'), modelo:v('ia-modn')});
  const row = {categoria_id:v('ia-cat'), modelo_id:modelo, patrimonio:v('ia-pat'), numero_serie:v('ia-serie'), descricao:v('ia-desc'), propriedade:v('ia-prop'),
    locadora:v('ia-prop') === 'alugado' ? v('ia-loc') : '', contrato_fim:v('ia-prop') === 'alugado' ? v('ia-cfim') || null : null, valor_mensal:v('ia-prop') === 'alugado' ? invNum(v('ia-vmes')) : null,
    fornecedor:v('ia-forn'), nota_fiscal:v('ia-nf'), nf_chave:nfc, data_compra:v('ia-dcompra') || null, valor_compra:invNum(v('ia-vcompra')), garantia_ate:v('ia-gar') || null,
    depreciacao_pct_ano:invNum(v('ia-dep')), hostname:v('ia-host'), ip:v('ia-ip'), mac:v('ia-mac'), sistema:v('ia-so'), acesso_onde:v('ia-acesso'), notas:d.querySelector('#ia-notas').value.trim()};
  if (a.id){ await invGravar('inv_ativos', row, a.id); toast('Equipamento salvo'); return; }
  const sit = v('ia-sit');
  if (sit === 'uso_funcionario' && !v('ia-func')){ toast('Escolha o funcionário'); return false; }
  if (sit === 'uso_aplicacao' && !v('ia-app')){ toast('Escolha a aplicação'); return false; }
  Object.assign(row, {situacao:sit, local_id:v('ia-local') || null, funcionario_id:sit === 'uso_funcionario' ? v('ia-func') : null, aplicacao_id:sit === 'uso_aplicacao' ? v('ia-app') : null});
  const n = Math.max(1, Math.min(200, +v('ia-copias') || 1)), pm = (row.patrimonio.match(/^(.*?)(\d+)$/) || []);
  for (let i = 0; i < n; i++){
    const r = Object.assign({}, row);
    if (i > 0){ r.numero_serie = ''; r.patrimonio = pm.length ? pm[1] + String(+pm[2] + i).padStart(pm[2].length, '0') : (row.patrimonio ? row.patrimonio + '-' + (i + 1) : ''); }
    await invGravar('inv_ativos', r);
  }
  toast(n === 1 ? 'Equipamento cadastrado' : n + ' equipamentos cadastrados');
}

/* ---------- a ficha do equipamento ---------- */
const INV_ACOES = {
  estoque:['entrega','emprestimo','uso_aplicacao','uso_local','transferencia','manutencao','aguardando','defeito','perda','baixa'],
  uso_funcionario:['devolucao','transferencia','manutencao','defeito','perda'], emprestado:['devolucao','transferencia','manutencao','defeito','perda'],
  uso_aplicacao:['devolucao','transferencia','manutencao','defeito','perda'], uso_local:['devolucao','entrega','uso_aplicacao','transferencia','manutencao','defeito','perda'],
  manutencao:['retorno_manutencao','defeito','baixa'], aguardando:['devolucao','entrega','uso_aplicacao','uso_local','defeito','baixa'],
  defeito:['manutencao','devolucao','baixa'], perdido:['devolucao','baixa'], baixado:[]};
const INV_ACAO_NOME = {entrega:'Entregar a funcionário', emprestimo:'Emprestar', uso_aplicacao:'Usar em aplicação', uso_local:'Deixar em uso no local', devolucao:'Devolver ao estoque', transferencia:'Mudar de local',
  manutencao:'Mandar para manutenção', retorno_manutencao:'Voltou da manutenção', aguardando:'Aguardando', defeito:'Marcar com defeito', perda:'Marcar como perdido', baixa:'Dar baixa'};
function invFichaAtivo(id){
  const a = invAchar('ativos', id); if (!a) return;
  const pode = podeEditar(), m = invModelo(a), movs = (INV.d.movs || []).filter(x => x.ativo_id === id), ult = movs[0];
  const lig = (INV.d.ligacoes || []).filter(l => l.ativo_id === id || l.alvo_id === id), lics = (INV.d.lusos || []).filter(u => u.ativo_id === id);
  const man = (INV.d.manut || []).filter(x => x.ativo_id === id).sort((x, y) => String(y.aberta_em).localeCompare(String(x.aberta_em))), anex = (INV.d.anexos || []).filter(x => x.ativo_id === id);
  const bx = (INV.d.baixas || []).find(b => b.ativo_id === id), v = invValorAtual(a), g = invDias(a.garantia_ate);
  const srv = typeof SRV !== 'undefined' && a.hostname ? (SRV.lista || []).find(s => s.hostname && s.hostname.toLowerCase() === a.hostname.toLowerCase()) : null;
  const lin = (r, x) => x ? '<div class="inv-lin"><dt>' + r + '</dt><dd>' + x + '</dd></div>' : '';
  const corpo = '<div class="inv-ficha">' +
    '<div class="inv-ficha-topo">' + invSitHTML(a.situacao) + '<span class="inv-onde">' + esc(invOnde(a)) + '</span></div>' +
    (pode && INV_ACOES[a.situacao] && INV_ACOES[a.situacao].length ? '<div class="inv-acoes-mov">' + INV_ACOES[a.situacao].map(t => '<button type="button" class="btn ' + (['entrega','devolucao','uso_aplicacao'].includes(t) ? '' : 'sec ') + 'peq" data-inv-mov="' + t + '">' + esc(INV_ACAO_NOME[t]) + '</button>').join('') + '</div>' : '') +
    '<dl class="inv-dl">' + lin('Categoria', esc(invCat(a).nome)) + lin('Modelo', esc(m ? [m.fabricante, m.modelo, m.numero_modelo].filter(Boolean).join(' ') : '')) + lin('Patrimônio', esc(a.patrimonio)) + lin('Série', esc(a.numero_serie)) +
      lin('Propriedade', esc(svNomeInv(INV_PROP, a.propriedade) + (a.propriedade === 'alugado' ? ' · ' + a.locadora + (a.contrato_fim ? ' até ' + invDia(a.contrato_fim) : '') + (a.valor_mensal ? ' · ' + brl(+a.valor_mensal) + ' por mês' : '') : ''))) +
      lin('Compra', esc([a.data_compra ? invDia(a.data_compra) : '', a.valor_compra != null ? brl(+a.valor_compra) : '', a.fornecedor, a.nota_fiscal ? 'NF ' + a.nota_fiscal : ''].filter(Boolean).join(' · '))) +
      lin('Valor atual', v != null ? brl(v) + ' <small>(depreciação de ' + (a.depreciacao_pct_ano != null ? +a.depreciacao_pct_ano : +invCat(a).depreciacao_pct_ano) + '% ao ano)</small>' : '') +
      lin('Garantia', a.garantia_ate ? invDia(a.garantia_ate) + (g < 0 ? ' <b class="inv-venc">(vencida)</b>' : g <= 30 ? ' <b class="inv-quase">(vence em ' + g + ' dias)</b>' : '') : '') +
      lin('Rede', esc([a.hostname, a.ip, a.mac].filter(Boolean).join(' · '))) + lin('Sistema', esc(a.sistema)) + lin('Onde fica o acesso', esc(a.acesso_onde)) +
      lin('Conferência', esc([a.ultima_conferencia ? 'última em ' + invDia(a.ultima_conferencia) : '', a.proxima_conferencia ? 'próxima em ' + invDia(a.proxima_conferencia) : ''].filter(Boolean).join(' · '))) +
      lin('Servidor', srv ? 'é o servidor <b>' + esc(srv.nome) + '</b> da aba Servidores' : '') + lin('Anotações', esc(a.notas).replace(/\n/g, '<br>')) +
      (bx ? lin('Baixa', esc([invDia(bx.data), {venda:'Venda', doacao:'Doação', sucata:'Sucata', perda:'Perda', roubo:'Roubo', devolucao_locadora:'Devolvido à locadora', outro:'Outro'}[bx.motivo], bx.metodo_apagamento ? 'apagamento: ' + {clear:'sobrescrita (Clear)', purge:'apagamento seguro (Purge)', destroy:'destruição (Destroy)', sem_dados:'sem dados'}[bx.metodo_apagamento] : '', bx.recicladora, bx.cdf ? 'CDF ' + bx.cdf : '', bx.boletim ? 'BO ' + bx.boletim : ''].filter(Boolean).join(' · '))) : '') + '</dl>' +
    '<section><h4>Ligações</h4>' + (lig.length ? '<ul class="inv-lista">' + lig.map(l => { const outro = invAchar('ativos', l.ativo_id === id ? l.alvo_id : l.ativo_id);
        return '<li>' + (l.tipo === 'instalado' ? (l.ativo_id === id ? 'Instalado em ' : 'Tem instalado ') : (l.ativo_id === id ? 'Conectado a ' : 'Recebe ')) + '<button type="button" class="inv-link" data-inv-abrir="' + esc(outro ? outro.id : '') + '">' + esc(outro ? invNomeAtivo(outro) : '?') + '</button>' + (pode ? ' <button type="button" class="btn fant peq" data-inv-desligar="' + esc(l.id) + '">Tirar</button>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="inv-vazio">Nenhuma.</p>') +
      (pode ? '<button type="button" class="btn sec peq" data-inv-ligar>Conectar a outro equipamento</button>' : '') + '</section>' +
    (lics.length ? '<section><h4>Licenças nesta máquina</h4><ul class="inv-lista">' + lics.map(u => '<li>' + esc((invAchar('licencas', u.licenca_id) || {}).nome || '') + '</li>').join('') + '</ul></section>' : '') +
    '<section><h4>Manutenções</h4>' + (man.length ? '<ul class="inv-lista">' + man.map(x => '<li><b>' + esc({corretiva:'Corretiva', preventiva:'Preventiva', upgrade:'Upgrade', garantia:'Garantia'}[x.tipo]) + '</b> ' + invDia(x.aberta_em) + (x.concluida_em ? ' a ' + invDia(x.concluida_em) : ' (aberta)') + (x.custo != null ? ' · ' + brl(+x.custo) : '') + (x.fornecedor ? ' · ' + esc(x.fornecedor) : '') + (x.na_garantia ? ' · na garantia' : '') + (x.descricao ? '<small>' + esc(x.descricao) + '</small>' : '') +
        (pode ? ' <button type="button" class="btn fant peq" data-inv-editar-man="' + esc(x.id) + '">Editar</button>' : '') + '</li>').join('') + '</ul>' : '<p class="inv-vazio">Nenhuma.</p>') + (pode ? '<button type="button" class="btn sec peq" data-inv-nova-man>Registrar manutenção</button>' : '') + '</section>' +
    '<section><h4>Arquivos</h4>' + (anex.length ? '<ul class="inv-lista">' + anex.map(x => '<li><button type="button" class="inv-link" data-inv-baixar-anexo="' + esc(x.id) + '">' + esc(x.nome) + '</button> <small>' + esc({foto:'foto', nota_fiscal:'nota fiscal', termo:'termo', certificado_apagamento:'certificado de apagamento', cdf:'CDF', garantia:'garantia', contrato:'contrato', outro:'arquivo'}[x.papel]) + ' · ' + invDia(String(x.enviado_em).slice(0, 10)) + '</small></li>').join('') + '</ul>' : '<p class="inv-vazio">Nenhum.</p>') +
      (pode ? '<label class="btn sec peq inv-enviar">Anexar foto, nota ou certificado<input type="file" hidden data-inv-anexar="' + esc(id) + '" accept="image/*,.pdf,.xml,.doc,.docx,.xls,.xlsx,.txt"></label><select class="sel peq" data-inv-papel>' + invOpts([['foto','Foto'],['nota_fiscal','Nota fiscal'],['garantia','Garantia'],['contrato','Contrato'],['certificado_apagamento','Certificado de apagamento'],['cdf','CDF (descarte)'],['outro','Outro']], 'foto') + '</select>' : '') + '</section>' +
    '<section><h4>Histórico</h4>' + (movs.length ? '<ol class="inv-hist">' + movs.map((x, i) => { const p = x.feito_por && pessoa(x.feito_por);
        const para = x.funcionario_para ? (invFunc(x.funcionario_para) || {}).nome : x.aplicacao_para ? invAppNome(x.aplicacao_para) : x.local_para ? invLocalNome(x.local_para) : '';
        return '<li' + (x.tipo === 'estorno' ? ' class="inv-estorno"' : '') + '><span class="inv-num">' + invDia(x.data) + '</span><b>' + esc(INV_MOV[x.tipo] || x.tipo) + '</b>' + (para ? ' · ' + esc(para) : '') + (x.motivo ? ' · ' + esc(x.motivo) : '') + '<small>' + esc(p ? p.nome : '') + '</small>' +
          (pode && i === 0 && !['cadastro','estorno'].includes(x.tipo) ? ' <button type="button" class="btn fant peq" data-inv-desfazer="' + esc(x.id) + '">Desfazer</button>' : '') + '</li>'; }).join('') + '</ol>' : '') + '</section>' +
  '</div>';
  const bts = [{txt:'Fechar', cls:'sec'}, {txt:'Etiqueta', cls:'sec', acao:() => { if (typeof invImprimirEtiquetas === 'function') invImprimirEtiquetas([id]); return false; }}];
  if (pode) bts.push({txt:'Editar', acao:() => { setTimeout(() => invFormAtivo(id), 0); }});
  const dlg = modal(esc(invNomeAtivo(a)), corpo, bts); dlg.classList.add('inv-modal'); dlg.dataset.invAtivo = id; INV.ficha = dlg;
  dlg.addEventListener('click', e => {
    const mv = e.target.closest('[data-inv-mov]'); if (mv) return invMovimentar([id], mv.dataset.invMov);
    const df = e.target.closest('[data-inv-desfazer]'); if (df) return invDesfazer(df.dataset.invDesfazer);
    const ab = e.target.closest('[data-inv-abrir]'); if (ab && ab.dataset.invAbrir){ dlg.close(); dlg.remove(); return invFichaAtivo(ab.dataset.invAbrir); }
    if (e.target.closest('[data-inv-ligar]')) return invLigar(id);
    const dl = e.target.closest('[data-inv-desligar]'); if (dl) return invApagar('inv_ligacoes', dl.dataset.invDesligar, 'Tirar esta ligação?');
    if (e.target.closest('[data-inv-nova-man]')) return invFormManutencao(id, null);
    const em = e.target.closest('[data-inv-editar-man]'); if (em) return invFormManutencao(id, em.dataset.invEditarMan);
    const ba = e.target.closest('[data-inv-baixar-anexo]'); if (ba) return invAbrirAnexo(ba.dataset.invBaixarAnexo);
  });
  dlg.addEventListener('change', e => { const f = e.target.closest('[data-inv-anexar]'); if (f && f.files[0]) invAnexar(f.files[0], {ativo_id:id, papel:(dlg.querySelector('[data-inv-papel]') || {}).value || 'outro'}); });
}
// a ficha aberta é redesenhada quando os dados mudam
const _invRecarregarFicha = invRecarregar;
invRecarregar = async function(){ await _invRecarregarFicha(); const f = INV.ficha; if (f && f.isConnected && f.dataset.invAtivo){ const id = f.dataset.invAtivo; f.close(); f.remove(); invFichaAtivo(id); } };

/* ---------- movimentar (um ou vários) ---------- */
function invMovimentar(ids, tipo){
  const ativos = ids.map(i => invAchar('ativos', i)).filter(Boolean); if (!ativos.length) return;
  const um = ativos.length === 1, a = ativos[0];
  const precisaFunc = ['entrega','emprestimo'].includes(tipo), precisaApp = tipo === 'uso_aplicacao', precisaLocal = tipo === 'transferencia';
  const corpo = '<div class="grade-form">' + (um ? '' : '<p class="largo inv-ajuda">' + ativos.length + ' equipamentos: ' + esc(ativos.slice(0, 8).map(invNomeAtivo).join(', ')) + (ativos.length > 8 ? '…' : '') + '</p>') +
    (precisaFunc ? invCampo('Funcionário', '<select class="sel" id="im-func">' + invFuncOpts(null) + '</select>') : '') +
    (precisaApp ? invCampo('Aplicação', '<select class="sel" id="im-app">' + invAppOpts(null) + '</select>') : '') +
    (tipo !== 'baixa' ? invCampo(precisaLocal ? 'Para o local' : 'Local', '<select class="sel" id="im-local">' + invLocalOpts(['devolucao','retorno_manutencao'].includes(tipo) ? (a.local_id || '') : '', precisaLocal ? 'Escolha o local' : 'Sem local') + '</select>') : '') +
    (tipo === 'emprestimo' ? invCampo('Volta em', invIn('im-volta', iso(dAdd(HOJE, 7)), ' type="date"')) : '') +
    (tipo === 'retorno_manutencao' ? invCampo('Voltou para', '<select class="sel" id="im-sit">' + invOpts([['estoque','Estoque'],['defeito','Ainda com defeito']], 'estoque') + '</select>') : '') +
    invCampo('Data', invIn('im-data', invHoje(), ' type="date"')) + invCampo('Motivo', invIn('im-motivo', '', ' maxlength="500" placeholder="Ex.: admissão, troca, home office"'), 'largo') +
    (['entrega','emprestimo','devolucao'].includes(tipo) ? '<label class="cm-ck largo"><input type="checkbox" id="im-termo" checked> Gerar o termo de responsabilidade para assinar</label>' : '') + '</div>' +
    (tipo === 'baixa' ? '<div class="grade-form inv-baixa"><p class="largo inv-ajuda">A baixa tira o equipamento de circulação para sempre. Anote o motivo e, se tinha dados, como foram apagados (NIST 800-88) e o certificado de descarte (CDF).</p>' +
      invCampo('Motivo', '<select class="sel" id="ib-motivo">' + invOpts([['sucata','Sucata'],['venda','Venda'],['doacao','Doação'],['perda','Perda'],['roubo','Roubo'],['devolucao_locadora','Devolvido à locadora'],['outro','Outro']], 'sucata') + '</select>') +
      invCampo('Apagamento dos dados', '<select class="sel" id="ib-apag">' + invOpts([['','Não informado'],['sem_dados','Não guarda dados'],['clear','Sobrescrita (Clear)'],['purge','Apagamento seguro (Purge)'],['destroy','Destruição física (Destroy)']], '') + '</select>') +
      invCampo('Quem apagou', invIn('ib-quem', '', ' maxlength="160"')) + invCampo('Recicladora', invIn('ib-rec', '', ' maxlength="160"')) + invCampo('MTR', invIn('ib-mtr', '', ' maxlength="60"')) + invCampo('CDF', invIn('ib-cdf', '', ' maxlength="60"')) +
      invCampo('Boletim de ocorrência', invIn('ib-bo', '', ' maxlength="60"')) + invCampo('Valor da venda (R$)', invIn('ib-venda', '', ' type="number" min="0" step="0.01"')) + '</div>' : '');
  const titulo = (INV_ACAO_NOME[tipo] || tipo) + (um ? ': ' + invNomeAtivo(a) : ' (' + ativos.length + ')');
  invForm(esc(titulo), corpo, async d => {
    const v = id => invV(d, id);
    if (precisaFunc && !v('im-func')){ toast('Escolha o funcionário'); return false; }
    if (precisaApp && !v('im-app')){ toast('Escolha a aplicação'); return false; }
    if (precisaLocal && !v('im-local')){ toast('Escolha o local'); return false; }
    if (tipo === 'emprestimo' && !v('im-volta')){ toast('Diga quando volta'); return false; }
    if (tipo === 'baixa' && ['roubo','perda'].includes(v('ib-motivo')) && !v('ib-bo')) toast('Dica: guarde o número do boletim de ocorrência');
    const funcAntes = ativos.map(x => x.funcionario_id).find(Boolean);
    let termo = null;
    const querTermo = d.querySelector('#im-termo') && d.querySelector('#im-termo').checked, funcTermo = tipo === 'devolucao' ? funcAntes : v('im-func');
    if (querTermo && funcTermo && typeof invCriarTermo === 'function') termo = await invCriarTermo(funcTermo, tipo === 'devolucao' ? 'devolucao' : 'entrega', ativos.map(x => x.id));
    for (const x of ativos){
      if (tipo === 'baixa') await invGravar('inv_baixas', {ativo_id:x.id, motivo:v('ib-motivo'), data:v('im-data') || invHoje(), metodo_apagamento:v('ib-apag'), apagamento_por:v('ib-quem'), recicladora:v('ib-rec'), mtr:v('ib-mtr'), cdf:v('ib-cdf'), boletim:v('ib-bo'), valor_venda:invNum(v('ib-venda'))})
        .catch(e => { if (!/duplicate|unique/i.test(String(e.message))) throw e; });
      await invRpc('inv_movimentar', {p_ativo:x.id, p_tipo:tipo, p_situacao:v('im-sit') || null, p_local:v('im-local') || null, p_funcionario:v('im-func') || null, p_aplicacao:v('im-app') || null,
        p_devolucao:v('im-volta') || null, p_motivo:v('im-motivo'), p_data:v('im-data') || null, p_termo:termo});
    }
    toast(ativos.length === 1 ? 'Movimentação gravada' : ativos.length + ' movimentações gravadas');
    if (termo && typeof invImprimirTermo === 'function') invImprimirTermo(termo);
  });
}
function invDesfazer(movId){
  modal('Desfazer a última movimentação', '<p>O equipamento volta para como estava antes. Nada some: fica registrado um estorno no histórico.</p><label class="lb">Por quê<input class="campo" id="id-motivo" maxlength="300" placeholder="Ex.: registrei o funcionário errado"></label>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Desfazer', acao:d => { const m = d.querySelector('#id-motivo').value.trim(); const mv = invAchar('movs', movId); invRpc('inv_estornar', {p_mov:movId, p_motivo:m}).then(async () => { if (mv && mv.tipo === 'baixa'){ await invBanco().from('inv_baixas').delete().eq('ativo_id', mv.ativo_id); } toast('Desfeito'); invRecarregar(); }).catch(invErro); }}]);
}
function invLigar(id){
  const outros = (INV.d.ativos || []).filter(a => a.id !== id && a.situacao !== 'baixado');
  invForm('Conectar a outro equipamento', '<div class="grade-form">' + invCampo('Como', '<select class="sel" id="il-tipo">' + invOpts([['conectado','Conectado a (monitor no computador, dock)'],['instalado','Instalado em (memória, disco dentro do equipamento)']], 'conectado') + '</select>') +
    invCampo('Equipamento', '<select class="sel" id="il-alvo">' + invOpts(outros.map(a => [a.id, invNomeAtivo(a)]), '', 'Escolha') + '</select>', 'largo') + '</div>', async d => {
      if (!invV(d, 'il-alvo')){ toast('Escolha o equipamento'); return false; }
      await invGravar('inv_ligacoes', {ativo_id:id, alvo_id:invV(d, 'il-alvo'), tipo:invV(d, 'il-tipo')}); toast('Ligação gravada'); });
}
function invApagar(tabela, id, pergunta){
  modal('Confirmar', '<p>' + esc(pergunta) + '</p>', [{txt:'Cancelar', cls:'sec'}, {txt:'Sim', acao:() => { invBanco().from(tabela).delete().eq('id', id).select('id').then(({data, error}) => {
    if (error || !data || !data.length){ toast('Não deu: ' + (error ? error.message : 'o banco não deixou (ainda é usado ou tem histórico)')); return; } toast('Feito'); invRecarregar(); }); }}]);
}

/* ---------- manutenção ---------- */
function invFormManutencao(ativo, id){
  const x = id ? invAchar('manut', id) : {tipo:'corretiva', aberta_em:invHoje()}, a = invAchar('ativos', ativo), g = invDias(a.garantia_ate);
  invForm(id ? 'Editar manutenção' : 'Registrar manutenção', '<div class="grade-form">' + invCampo('Tipo', '<select class="sel" id="ix-tipo">' + invOpts([['corretiva','Corretiva'],['preventiva','Preventiva'],['upgrade','Upgrade'],['garantia','Garantia']], x.tipo) + '</select>') +
    invCampo('Aberta em', invIn('ix-ab', x.aberta_em, ' type="date"')) + invCampo('Concluída em', invIn('ix-co', x.concluida_em, ' type="date"')) + invCampo('Fornecedor', invIn('ix-forn', x.fornecedor, ' maxlength="120"')) +
    invCampo('Custo (R$)', invIn('ix-custo', x.custo, ' type="number" min="0" step="0.01"')) + '<label class="cm-ck"><input type="checkbox" id="ix-gar"' + ((id ? x.na_garantia : g != null && g >= 0) ? ' checked' : '') + '> Na garantia</label>' +
    invCampo('O que foi feito', '<textarea class="campo" id="ix-desc" rows="3" maxlength="2000">' + esc(x.descricao || '') + '</textarea>', 'largo') + '</div>' +
    (!id ? '<p class="inv-ajuda">Para o equipamento sair de circulação enquanto conserta, use também "Mandar para manutenção".</p>' : ''), async d => {
      const co = invV(d, 'ix-co'); if (co && co < invV(d, 'ix-ab')){ toast('A conclusão é antes da abertura'); return false; }
      await invGravar('inv_manutencoes', {ativo_id:ativo, tipo:invV(d, 'ix-tipo'), aberta_em:invV(d, 'ix-ab') || invHoje(), concluida_em:co || null, fornecedor:invV(d, 'ix-forn'), custo:invNum(invV(d, 'ix-custo')), na_garantia:invV(d, 'ix-gar'), descricao:invV(d, 'ix-desc')}, id);
      toast('Manutenção gravada'); });
}

/* ---------- funcionários ---------- */
function invFormFunc(id){
  const f = id ? invAchar('funcionarios', id) : {situacao:'ativo'}, apps = invAppsDoCliente(INV.cli), usa = new Set((INV.d.fapps || []).filter(x => x.funcionario_id === id).map(x => x.no_id));
  const corpo = '<div class="grade-form">' + invCampo('Nome', invIn('if-nome', f.nome, ' maxlength="160"'), 'largo') + invCampo('CPF', invIn('if-cpf', invCpf(f.cpf), ' maxlength="14" inputmode="numeric" placeholder="000.000.000-00"')) +
    invCampo('Telefone', invIn('if-tel', f.telefone, ' maxlength="30"')) + invCampo('Cargo', invIn('if-cargo', f.cargo, ' maxlength="120"')) +
    invCampo('Departamento', invIn('if-dep', f.departamento, ' maxlength="120" list="if-deps"') + '<datalist id="if-deps">' + [...new Set((INV.d.funcionarios || []).map(x => x.departamento).filter(Boolean))].map(x => '<option value="' + esc(x) + '">').join('') + '</datalist>') +
    invCampo('Situação', '<select class="sel" id="if-sit">' + invOpts([['ativo','Ativo'],['afastado','Afastado'],['desligado','Desligado']], f.situacao) + '</select>') + invCampo('Desligado em', invIn('if-desl', f.desligado_em, ' type="date"')) +
    (apps.length ? '<fieldset class="largo"><legend>Usa as aplicações</legend>' + apps.map(a => '<label class="cm-ck"><input type="checkbox" data-if-app="' + esc(a.id) + '"' + (usa.has(a.id) ? ' checked' : '') + '> ' + esc(a.nome) + '</label>').join('') + '</fieldset>' : '') +
    invCampo('Anotações', '<textarea class="campo" id="if-notas" rows="2" maxlength="1000">' + esc(f.notas || '') + '</textarea>', 'largo') + '</div>' +
    '<p class="inv-ajuda">Só cadastro de controle: o funcionário não entra no sistema. Guarde só o necessário (LGPD).</p>';
  invForm(id ? 'Editar ' + esc(f.nome) : 'Cadastrar funcionário', corpo, async d => {
    const nome = invV(d, 'if-nome'), cpf = invV(d, 'if-cpf').replace(/\D/g, '');
    if (!nome){ toast('Escreva o nome'); return false; }
    if (cpf && !invCpfValido(cpf)){ toast('CPF inválido'); return false; }
    const sit = invV(d, 'if-sit');
    const fid = await invGravar('inv_funcionarios', {nome, cpf, telefone:invV(d, 'if-tel'), cargo:invV(d, 'if-cargo'), departamento:invV(d, 'if-dep'), situacao:sit, desligado_em:sit === 'desligado' ? (invV(d, 'if-desl') || invHoje()) : null, notas:invV(d, 'if-notas')}, id);
    const sb = invBanco(), marc = [...d.querySelectorAll('[data-if-app]')].filter(x => x.checked).map(x => x.dataset.ifApp);
    for (const no of [...usa].filter(x => !marc.includes(x))){ const {error} = await sb.from('inv_funcionarios_apps').delete().eq('funcionario_id', fid).eq('no_id', no); if (error) throw error; }
    const novos = marc.filter(x => !usa.has(x)).map(no => ({funcionario_id:fid, cliente_id:INV.cli, no_id:no}));
    if (novos.length){ const {error} = await sb.from('inv_funcionarios_apps').insert(novos); if (error) throw error; }
    toast('Funcionário salvo');
    if (sit === 'desligado' && (INV.d.ativos || []).some(a => a.funcionario_id === fid)) setTimeout(() => invFichaFunc(fid), 400);
  });
}
function invCpfValido(d){
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +d[9] && dv(10) === +d[10];
}
function invFichaFunc(id){
  const f = invAchar('funcionarios', id); if (!f) return;
  const eq = (INV.d.ativos || []).filter(a => a.funcionario_id === id), lics = (INV.d.lusos || []).filter(u => u.funcionario_id === id), pode = podeEditar();
  const movs = (INV.d.movs || []).filter(m => m.funcionario_para === id || m.funcionario_de === id), termos = (INV.d.termos || []).filter(t => t.funcionario_id === id);
  const apps = (INV.d.fapps || []).filter(x => x.funcionario_id === id).map(x => invAppNome(x.no_id)).filter(Boolean);
  const corpo = '<div class="inv-ficha"><dl class="inv-dl"><div class="inv-lin"><dt>Cargo</dt><dd>' + esc([f.cargo, f.departamento].filter(Boolean).join(' · ')) + '</dd></div><div class="inv-lin"><dt>CPF</dt><dd>' + esc(invCpfMasc(f.cpf)) + '</dd></div>' +
      '<div class="inv-lin"><dt>Telefone</dt><dd>' + esc(f.telefone) + '</dd></div><div class="inv-lin"><dt>Situação</dt><dd>' + esc({ativo:'Ativo', afastado:'Afastado', desligado:'Desligado' + (f.desligado_em ? ' em ' + invDia(f.desligado_em) : '')}[f.situacao]) + '</dd></div>' +
      (apps.length ? '<div class="inv-lin"><dt>Usa</dt><dd>' + esc(apps.join(', ')) + '</dd></div>' : '') + '</dl>' +
    (f.situacao === 'desligado' && (eq.length || lics.length) ? '<p class="inv-aviso">Desligado e ainda com ' + eq.length + (eq.length === 1 ? ' equipamento' : ' equipamentos') + (lics.length ? ' e ' + lics.length + (lics.length === 1 ? ' licença' : ' licenças') : '') + ' para recolher.</p>' : '') +
    '<section><h4>Com ele agora</h4>' + (eq.length ? invTabelaAtivos(eq, false) : '<p class="inv-vazio">Nada.</p>') +
      (pode && eq.length ? '<button type="button" class="btn sec peq" data-iff-devolver>Devolver tudo ao estoque</button>' : '') + (pode && eq.length && typeof invCriarTermo === 'function' ? '<button type="button" class="btn sec peq" data-iff-termo>Gerar termo do que está com ele</button>' : '') + '</section>' +
    (lics.length ? '<section><h4>Licenças</h4><ul class="inv-lista">' + lics.map(u => '<li>' + esc((invAchar('licencas', u.licenca_id) || {}).nome || '') + (pode ? ' <button type="button" class="btn fant peq" data-iff-tirar-lic="' + esc(u.id) + '">Liberar</button>' : '') + '</li>').join('') + '</ul></section>' : '') +
    (termos.length ? '<section><h4>Termos</h4><ul class="inv-lista">' + termos.map(t => '<li>' + esc(t.tipo === 'entrega' ? 'Entrega' : 'Devolução') + ' de ' + invDia(String(t.gerado_em).slice(0, 10)) + ' · ' + (t.assinado_em ? 'assinado em ' + invDia(t.assinado_em) : '<b class="inv-quase">falta a assinatura</b>') +
      ' <button type="button" class="btn fant peq" data-iff-ver-termo="' + esc(t.id) + '">Abrir</button>' + (pode && !t.assinado_em ? '<label class="btn fant peq inv-enviar">Anexar assinado<input type="file" hidden accept=".pdf,image/*" data-iff-assinado="' + esc(t.id) + '"></label>' : '') + '</li>').join('') + '</ul></section>' : '') +
    '<section><h4>Histórico</h4>' + invMovsHTML(movs.slice(0, 50)) + '</section></div>';
  const bts = [{txt:'Fechar', cls:'sec'}]; if (pode) bts.push({txt:'Editar', acao:() => { setTimeout(() => invFormFunc(id), 0); }});
  const dlg = modal(esc(f.nome), corpo, bts); dlg.classList.add('inv-modal');
  dlg.addEventListener('click', e => {
    if (e.target.closest('[data-iff-devolver]')){ dlg.close(); dlg.remove(); return invMovimentar(eq.map(a => a.id), 'devolucao'); }
    if (e.target.closest('[data-iff-termo]')) return invCriarTermo(id, 'entrega', eq.map(a => a.id)).then(t => { invImprimirTermo(t); invRecarregar(); }).catch(invErro);
    const tl = e.target.closest('[data-iff-tirar-lic]'); if (tl){ dlg.close(); dlg.remove(); return invApagar('inv_licencas_uso', tl.dataset.iffTirarLic, 'Liberar esta licença?'); }
    const vt = e.target.closest('[data-iff-ver-termo]'); if (vt) return invImprimirTermo(vt.dataset.iffVerTermo);
    const ab = e.target.closest('[data-inv-abrir]'); if (ab){ dlg.close(); dlg.remove(); return invFichaAtivo(ab.dataset.invAbrir); }
  });
  dlg.addEventListener('change', e => { const f2 = e.target.closest('[data-iff-assinado]'); if (f2 && f2.files[0]) invAnexar(f2.files[0], {termo_id:f2.dataset.iffAssinado, papel:'termo'}).then(() => invGravar('inv_termos', {assinado_em:invHoje()}, f2.dataset.iffAssinado)).then(() => { dlg.close(); dlg.remove(); invRecarregar(); }).catch(invErro); });
}

/* ---------- locais, categorias, modelos ---------- */
function invFormLocal(id){
  const l = id ? invAchar('locais', id) : {tipo:'sala', ativo:true};
  invForm(id ? 'Editar local' : 'Novo local', '<div class="grade-form">' + invCampo('Nome', invIn('il-nome', l.nome, ' maxlength="120" placeholder="Ex.: Matriz, Sala 3, Almoxarifado"')) +
    invCampo('Tipo', '<select class="sel" id="il-tp">' + invOpts([['unidade','Unidade (matriz, filial)'],['predio','Prédio'],['andar','Andar'],['sala','Sala'],['armario','Armário'],['almoxarifado','Almoxarifado'],['remoto','Remoto (home office)'],['outro','Outro']], l.tipo) + '</select>') +
    invCampo('Dentro de', '<select class="sel" id="il-pai">' + invOpts((INV.d.locais || []).filter(x => x.id !== id).map(x => [x.id, invLocalNome(x.id)]), l.pai_id, 'Nenhum') + '</select>') +
    invCampo('Endereço', invIn('il-end', l.endereco, ' maxlength="300"'), 'largo') + '<label class="cm-ck"><input type="checkbox" id="il-at"' + (l.ativo ? ' checked' : '') + '> Em uso</label></div>', async d => {
      if (!invV(d, 'il-nome')){ toast('Escreva o nome'); return false; }
      await invGravar('inv_locais', {nome:invV(d, 'il-nome'), tipo:invV(d, 'il-tp'), pai_id:invV(d, 'il-pai') || null, endereco:invV(d, 'il-end'), ativo:invV(d, 'il-at')}, id); toast('Local salvo'); },
    id ? [{txt:'Excluir', cls:'sec', acao:d => { d.close(); d.remove(); invApagar('inv_locais', id, 'Excluir este local? Só dá se nada estiver nele.'); return false; }}] : []);
}
function invFormCat(id){
  const c = id ? invAchar('categorias', id) : {grupo:'outro', controle:'unidade', depreciacao_pct_ano:20, conferencia_meses:12, ativo:true};
  invForm(id ? 'Editar categoria' : 'Nova categoria', '<div class="grade-form">' + invCampo('Nome', invIn('ic-nome', c.nome, ' maxlength="80"')) + invCampo('Grupo', '<select class="sel" id="ic-grupo">' + invOpts(INV_GRUPOS, c.grupo) + '</select>') +
    invCampo('Controle', '<select class="sel" id="ic-ctrl"' + (id ? ' disabled' : '') + '>' + invOpts([['unidade','Um a um (com patrimônio e série)'],['quantidade','Por quantidade (cabos, fontes)']], c.controle) + '</select>') +
    invCampo('Depreciação (% ao ano)', invIn('ic-dep', c.depreciacao_pct_ano, ' type="number" min="0" max="100" step="0.5"')) + invCampo('Vida útil (meses)', invIn('ic-vida', c.vida_util_meses, ' type="number" min="1" max="600"')) +
    invCampo('Conferir a cada (meses)', invIn('ic-conf', c.conferencia_meses, ' type="number" min="1" max="120"')) + '<label class="cm-ck"><input type="checkbox" id="ic-at"' + (c.ativo ? ' checked' : '') + '> Em uso</label></div>', async d => {
      if (!invV(d, 'ic-nome')){ toast('Escreva o nome'); return false; }
      await invGravar('inv_categorias', Object.assign({nome:invV(d, 'ic-nome'), grupo:invV(d, 'ic-grupo'), depreciacao_pct_ano:invNum(invV(d, 'ic-dep')) || 0, vida_util_meses:invNum(invV(d, 'ic-vida')), conferencia_meses:invNum(invV(d, 'ic-conf')) || 12, ativo:invV(d, 'ic-at')}, id ? {} : {controle:invV(d, 'ic-ctrl')}), id); toast('Categoria salva'); });
}
function invFormModelo(id){
  const m = id ? invAchar('modelos', id) : {ativo:true};
  invForm(id ? 'Editar modelo' : 'Novo modelo', '<div class="grade-form">' + invCampo('Categoria', '<select class="sel" id="io-cat">' + invOpts((INV.d.categorias || []).map(c => [c.id, c.nome]), m.categoria_id, 'Escolha') + '</select>') +
    invCampo('Fabricante', invIn('io-fab', m.fabricante, ' maxlength="80"')) + invCampo('Modelo', invIn('io-mod', m.modelo, ' maxlength="120"')) + invCampo('Número do modelo', invIn('io-num', m.numero_modelo, ' maxlength="80"')) +
    invCampo('Fim de vida (meses)', invIn('io-fim', m.fim_vida_meses, ' type="number" min="1" max="600"')) + invCampo('Especificações', '<textarea class="campo" id="io-esp" rows="3" maxlength="2000">' + esc(m.especificacoes || '') + '</textarea>', 'largo') + '</div>', async d => {
      if (!invV(d, 'io-cat') || !invV(d, 'io-mod')){ toast('Escolha a categoria e escreva o modelo'); return false; }
      await invGravar('inv_modelos', {categoria_id:invV(d, 'io-cat'), fabricante:invV(d, 'io-fab'), modelo:invV(d, 'io-mod'), numero_modelo:invV(d, 'io-num'), fim_vida_meses:invNum(invV(d, 'io-fim')), especificacoes:invV(d, 'io-esp')}, id); toast('Modelo salvo'); });
}

/* ---------- estoque por quantidade ---------- */
function invFormItem(id){
  const i = id ? invAchar('itens', id) : {unidade:'un', estoque_minimo:0, ativo:true}, cats = (INV.d.categorias || []).filter(c => c.controle === 'quantidade');
  invForm(id ? 'Editar item' : 'Novo item de estoque', '<div class="grade-form">' + invCampo('Nome', invIn('it-nome', i.nome, ' maxlength="160" placeholder="Ex.: Cabo HDMI 2 m"'), 'largo') +
    invCampo('Categoria', '<select class="sel" id="it-cat">' + invOpts(cats.map(c => [c.id, c.nome]), i.categoria_id, 'Escolha') + '</select>') + invCampo('Unidade', '<select class="sel" id="it-un">' + invOpts([['un','unidade'],['m','metro'],['cx','caixa'],['pct','pacote'],['kit','kit']], i.unidade) + '</select>') +
    invCampo('Estoque mínimo', invIn('it-min', i.estoque_minimo, ' type="number" min="0"')) + invCampo('Valor unitário (R$)', invIn('it-val', i.valor_unitario, ' type="number" min="0" step="0.01"')) +
    '<label class="cm-ck"><input type="checkbox" id="it-at"' + (i.ativo ? ' checked' : '') + '> Em uso</label>' + invCampo('Anotações', invIn('it-notas', i.notas, ' maxlength="1000"'), 'largo') + '</div>', async d => {
      if (!invV(d, 'it-nome') || !invV(d, 'it-cat')){ toast('Escreva o nome e escolha a categoria'); return false; }
      await invGravar('inv_itens', {nome:invV(d, 'it-nome'), categoria_id:invV(d, 'it-cat'), unidade:invV(d, 'it-un'), estoque_minimo:invNum(invV(d, 'it-min')) || 0, valor_unitario:invNum(invV(d, 'it-val')), ativo:invV(d, 'it-at'), notas:invV(d, 'it-notas')}, id); toast('Item salvo'); });
}
function invEstoqueMov(id, tipo){
  const i = invAchar('itens', id); if (!i) return;
  if (!(INV.d.locais || []).length){ toast('Cadastre antes um local (aba Locais)'); return; }
  const nome = {entrada:'Entrada', saida:'Saída', transferencia:'Transferir', ajuste:'Ajustar saldo'}[tipo];
  const dlg = invForm(nome + ': ' + esc(i.nome), '<div class="grade-form">' + invCampo(tipo === 'entrada' ? 'Entra no local' : 'Do local', '<select class="sel" id="ie-local">' + invLocalOpts('', 'Escolha') + '</select>') +
    (tipo === 'transferencia' ? invCampo('Para o local', '<select class="sel" id="ie-para">' + invLocalOpts('', 'Escolha') + '</select>') : '') +
    invCampo(tipo === 'ajuste' ? 'Saldo certo (conferido)' : 'Quantidade', invIn('ie-q', '', ' type="number" min="0" step="1"')) +
    (tipo === 'saida' ? invCampo('Para o funcionário', '<select class="sel" id="ie-func">' + invFuncOpts(null) + '</select>') + invCampo('Ou para a aplicação', '<select class="sel" id="ie-app">' + invAppOpts(null) + '</select>') : '') +
    invCampo('Data', invIn('ie-data', invHoje(), ' type="date"')) + invCampo('Motivo', invIn('ie-motivo', '', ' maxlength="500" placeholder="' + (tipo === 'entrada' ? 'Ex.: compra NF 123' : 'Ex.: sala de reunião') + '"'), 'largo') + '</div>' +
    '<p class="inv-ajuda" data-ie-saldo></p>', async d => {
      const q = +invV(d, 'ie-q'); if (!invV(d, 'ie-local') || (!q && tipo !== 'ajuste') || q < 0){ toast('Escolha o local e a quantidade'); return false; }
      await invRpc('inv_estoque', {p_item:id, p_tipo:tipo, p_local:invV(d, 'ie-local'), p_quantidade:q, p_local_para:invV(d, 'ie-para') || null, p_funcionario:invV(d, 'ie-func') || null, p_aplicacao:invV(d, 'ie-app') || null, p_motivo:invV(d, 'ie-motivo'), p_data:invV(d, 'ie-data') || null});
      toast('Estoque atualizado'); });
  const mostrar = () => { const l = invV(dlg, 'ie-local'), p = dlg.querySelector('[data-ie-saldo]'); if (p) p.textContent = l ? 'Saldo neste local: ' + invSaldoItem(i, l) + ' ' + i.unidade : ''; };
  if (dlg){ dlg.addEventListener('change', mostrar); mostrar(); }
}

/* ---------- licenças ---------- */
function invFormLic(id){
  const l = id ? invAchar('licencas', id) : {tipo:'assinatura', quantidade:1, moeda:'BRL', recorrencia:'mensal'};
  invForm(id ? 'Editar licença' : 'Nova licença', '<div class="grade-form">' + invCampo('Nome', invIn('ic2-nome', l.nome, ' maxlength="160" placeholder="Ex.: Microsoft 365 Business Standard"'), 'largo') +
    invCampo('Fornecedor', invIn('ic2-forn', l.fornecedor, ' maxlength="120"')) + invCampo('Tipo', '<select class="sel" id="ic2-tipo">' + invOpts([['assinatura','Assinatura'],['perpetua','Perpétua'],['oem','OEM (veio com a máquina)']], l.tipo) + '</select>') +
    invCampo('Quantidade', invIn('ic2-q', l.quantidade, ' type="number" min="1"')) + invCampo('Onde fica a chave (não a chave)', invIn('ic2-chave', l.chave_onde, ' maxlength="300" placeholder="Ex.: portal Microsoft, conta ti@cliente"'), 'largo') +
    invCampo('Início', invIn('ic2-ini', l.inicio, ' type="date"')) + invCampo('Vence em', invIn('ic2-vence', l.vence_em, ' type="date"')) + invCampo('Valor', invIn('ic2-val', l.valor, ' type="number" min="0" step="0.01"')) +
    invCampo('Moeda', '<select class="sel" id="ic2-moeda">' + invOpts([['BRL','R$'],['USD','US$'],['EUR','€']], l.moeda) + '</select>') + invCampo('Cobrança', '<select class="sel" id="ic2-rec">' + invOpts([['mensal','Mensal'],['anual','Anual'],['unico','Única']], l.recorrencia) + '</select>') +
    '<label class="cm-ck"><input type="checkbox" id="ic2-auto"' + (l.renovacao_automatica ? ' checked' : '') + '> Renovação automática</label></div>', async d => {
      if (!invV(d, 'ic2-nome')){ toast('Escreva o nome'); return false; }
      const q = Math.max(1, +invV(d, 'ic2-q') || 1); if (id && q < invUsosLicenca(l).length){ toast('Já há ' + invUsosLicenca(l).length + ' em uso: libere antes de diminuir'); return false; }
      await invGravar('inv_licencas', {nome:invV(d, 'ic2-nome'), fornecedor:invV(d, 'ic2-forn'), tipo:invV(d, 'ic2-tipo'), quantidade:q, chave_onde:invV(d, 'ic2-chave'), inicio:invV(d, 'ic2-ini') || null, vence_em:invV(d, 'ic2-vence') || null,
        valor:invNum(invV(d, 'ic2-val')), moeda:invV(d, 'ic2-moeda'), recorrencia:invV(d, 'ic2-rec'), renovacao_automatica:invV(d, 'ic2-auto')}, id); toast('Licença salva'); },
    id ? [{txt:'Excluir', cls:'sec', acao:d => { d.close(); d.remove(); invApagar('inv_licencas', id, 'Excluir esta licença e as atribuições dela?'); return false; }}] : []);
}
function invLicUso(id){
  const l = invAchar('licencas', id), us = invUsosLicenca(l); if (us.length >= l.quantidade){ toast('Esta licença já está toda em uso (' + us.length + ' de ' + l.quantidade + ')'); return; }
  invForm('Atribuir: ' + esc(l.nome), '<div class="grade-form">' + invCampo('Para o funcionário', '<select class="sel" id="iu-func">' + invFuncOpts(null) + '</select>') +
    invCampo('Ou para o equipamento', '<select class="sel" id="iu-at">' + invOpts((INV.d.ativos || []).filter(a => a.situacao !== 'baixado').map(a => [a.id, invNomeAtivo(a)]), '', 'Nenhum') + '</select>') + '</div>' +
    '<p class="inv-ajuda">' + us.length + ' de ' + l.quantidade + ' em uso.</p>', async d => {
      const f = invV(d, 'iu-func'), a = invV(d, 'iu-at'); if (!!f === !!a){ toast('Escolha um funcionário ou um equipamento (só um)'); return false; }
      await invGravar('inv_licencas_uso', {licenca_id:id, funcionario_id:f || null, ativo_id:a || null}); toast('Licença atribuída'); });
}

/* ---------- arquivos (bucket privado "inventario") ---------- */
async function invAnexar(arquivo, ref){
  const sb = invBanco(); if (!sb) return;
  if (arquivo.size > 25 * 1024 * 1024){ toast('O arquivo passa de 25 MB'); return; }
  const caminho = INV.cli + '/' + novoUuid() + '-' + arquivo.name.replace(/[^\w.\-]+/g, '_').slice(-120);
  const {error} = await sb.storage.from('inventario').upload(caminho, arquivo, {contentType:arquivo.type || 'application/octet-stream', upsert:false});
  if (error){ toast('Não deu para enviar: ' + error.message); throw error; }
  await invGravar('inv_anexos', Object.assign({nome:arquivo.name.slice(0, 200), storage_path:caminho, mime:arquivo.type || '', tamanho:arquivo.size}, ref));
  toast('Arquivo anexado'); invRecarregar();
}
async function invAbrirAnexo(id){
  const x = invAchar('anexos', id), sb = invBanco(); if (!x || !sb) return;
  const {data, error} = await sb.storage.from('inventario').createSignedUrl(x.storage_path, 600);
  if (error || !data){ toast('Não deu para abrir o arquivo'); return; }
  const a = document.createElement('a'); a.href = data.signedUrl; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
}

/* ---------- cliques da tela ---------- */
function invClique(e){
  const t = s => e.target.closest(s);
  let x;
  if ((x = t('[data-inv-abrir]')) && x.dataset.invAbrir) return invFichaAtivo(x.dataset.invAbrir);
  if ((x = t('[data-inv-func]'))) return invFichaFunc(x.dataset.invFunc);
  if (t('[data-inv-novo-ativo]')) return invFormAtivo(null);
  if (t('[data-inv-novo-func]')) return invFormFunc(null);
  if (t('[data-inv-novo-item]')) return invFormItem(null);
  if ((x = t('[data-inv-editar-item]'))) return invFormItem(x.dataset.invEditarItem);
  if ((x = t('[data-inv-estoque]'))) return invEstoqueMov(x.dataset.invEstoque, x.dataset.invTipo);
  if (t('[data-inv-nova-lic]')) return invFormLic(null);
  if ((x = t('[data-inv-editar-lic]'))) return invFormLic(x.dataset.invEditarLic);
  if ((x = t('[data-inv-lic-uso]'))) return invLicUso(x.dataset.invLicUso);
  if (t('[data-inv-novo-local]')) return invFormLocal(null);
  if ((x = t('[data-inv-editar-local]'))) return invFormLocal(x.dataset.invEditarLocal);
  if (t('[data-inv-nova-cat]')) return invFormCat(null);
  if ((x = t('[data-inv-editar-cat]'))) return invFormCat(x.dataset.invEditarCat);
  if (t('[data-inv-novo-modelo]')) return invFormModelo(null);
  if ((x = t('[data-inv-editar-modelo]'))) return invFormModelo(x.dataset.invEditarModelo);
  const marcados = () => $$('#ops-corpo [data-inv-sel]:checked').map(c => c.dataset.invSel);
  if (t('[data-inv-etiquetas]')){ const m = marcados(); if (!m.length){ toast('Marque os equipamentos na lista'); return; } return typeof invImprimirEtiquetas === 'function' && invImprimirEtiquetas(m); }
  if (t('[data-inv-lote-mov]')){ const m = marcados(); if (!m.length){ toast('Marque os equipamentos na lista'); return; } return invLoteMov(m); }
  if ((x = t('[data-inv-csv]')) && typeof invBaixarCsv === 'function') return invBaixarCsv(x.dataset.invCsv);
  if ((x = t('[data-inv-item-trabalho]')) && typeof invCriarItemTrabalho === 'function') return invCriarItemTrabalho(x.dataset.invItemTrabalho, x.dataset.invItemTxt);
  if (typeof invCliqueExtra === 'function') invCliqueExtra(e);
}
// movimentar vários: as ações que valem para todos os marcados
function invLoteMov(ids){
  const sits = [...new Set(ids.map(i => (invAchar('ativos', i) || {}).situacao))], comuns = Object.keys(INV_ACAO_NOME).filter(t => sits.every(s => (INV_ACOES[s] || []).includes(t)));
  if (!comuns.length){ toast('Os marcados estão em situações diferentes: nenhuma ação vale para todos'); return; }
  modal('Movimentar ' + ids.length + ' equipamentos', '<div class="inv-acoes-mov">' + comuns.map(c => '<button type="button" class="btn sec peq" data-lm="' + c + '">' + esc(INV_ACAO_NOME[c]) + '</button>').join('') + '</div>', [{txt:'Cancelar', cls:'sec'}])
    .addEventListener('click', function(e){ const b = e.target.closest('[data-lm]'); if (b){ this.close(); this.remove(); invMovimentar(ids, b.dataset.lm); } });
}
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {invFormAtivo, invFichaAtivo, invMovimentar, invFormFunc, invCpfValido, invProximoPatrimonio});
