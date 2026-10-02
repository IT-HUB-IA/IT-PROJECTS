/* ===== Segunda leva do P.O. (pedido-melhorias-ciclodev-2, banco parte 53) =====
   1 épico de outra frente   2 números que dizem o que contam   3 tarefa externa fora dos totais e "bloqueado por terceiro"
   4 Definição de Pronto comum + da frente, com aviso de linha repetida   5 origem do preenchimento automático, prazo depois
   da entrega e item sem responsável   6 situação inicial no Criar em lote   7 contas da prévia do Editar em lote
   8 prova em cada critério   9 decisão que muda marca os itens afetados para revisar   10 critério Dado/Quando/Então
   11 mapa de histórias   12 pirâmide do backlog   13 o que mudou desde   14 exportar o projeto inteiro e o épico com
   todas as frentes. Nada grava sozinho em situação, ordem ou aceite: são avisos com motivo, e todos podem ser silenciados. */
const LV2 = {hist:null, histEm:0};
// as escolhas da tela (agrupar por épico, filtros do "O que mudou") vão para pessoas_preferencias.tela, como as outras (parte 22)
if (typeof PF_CAMPOS !== 'undefined') ['lv2PorEpico', 'lv2Mudou'].forEach(k => { if (!PF_CAMPOS.includes(k)) PF_CAMPOS.push(k); });
const lv2M = () => (UI.lv2Mudou = UI.lv2Mudou && typeof UI.lv2Mudou === 'object' ? UI.lv2Mudou : {ref:'', frente:'', pessoa:''});
Object.defineProperties(LV2, {mudouRef:{get:() => lv2M().ref || '', set:v => { lv2M().ref = v; }}, mudouFrente:{get:() => lv2M().frente || '', set:v => { lv2M().frente = v; }}, mudouPessoa:{get:() => lv2M().pessoa || '', set:v => { lv2M().pessoa = v; }}});
const lv2Data = v => v ? fmtData(String(v).slice(0, 10)) : '';
const lv2Norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^[-*•\s]+/, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const lv2Ws = i => byId('ws', i && i.ws);
const lv2Versao = i => { const m = i.marco ? byId('marcos', i.marco) : null; if (m) return m; const e = epicDe(i); return e && e.marco ? byId('marcos', e.marco) : null; };
const lv2NomeNo = chave => { const t = String(chave || '').split(':')[0]; return {ws:'nesta frente', app:'nesta aplicação', product:'neste produto', project:'no projeto', client:'neste cliente', all:'em tudo'}[t] || 'aqui'; };
const lv2Ext = i => !!i.externa && !i.decisao;
// o item depende de uma tarefa externa que ainda não foi aceita
const lv2Terceiros = i => poDepsAbertas(i).filter(lv2Ext);

/* ---------- banco: os campos novos (parte 53) ---------- */
const _montarDadosLv2 = montarDados;
montarDados = function(T, eu){
  const d = _montarDadosLv2(T, eu);
  const rI = new Map((T.itens || []).map(r => [r.id, r])), rC = new Map((T.itens_criterios || []).map(r => [r.id, r])), rF = new Map((T.frentes || []).map(r => [r.no_id, r]));
  d.issues.forEach(i => { const r = rI.get(i.id) || {};
    i.autoOrigem = r.auto_origem && typeof r.auto_origem === 'object' ? r.auto_origem : null; i.revisar = r.revisar && typeof r.revisar === 'object' ? r.revisar : null;
    i.decTexto = r.decisao_texto || null; i.decPor = r.decisao_por || null; i.decEm = r.decisao_em || null;
    (i.crit || []).forEach(c => { const x = c._id && rC.get(c._id); if (x){ c.prova = x.prova || ''; c.provaQuem = x.prova_quem || null; c.provaEm = x.prova_em || null; c.provaRes = x.prova_resultado || null; } }); });
  d.ws.forEach(w => { const r = rF.get(w.id); w.dod = (r && r.definicao_pronto) || ''; });
  return d;
};
const _linhasDaTelaLv2 = linhasDaTela;
linhasDaTela = function(d){
  const L = _linhasDaTelaLv2(d);
  const porId = new Map(d.issues.map(i => [i.id, i])), temPessoa = new Set(d.people.map(p => p.id));
  (L.itens || []).forEach(r => { const i = porId.get(r.id); if (!i) return;
    r.auto_origem = i.autoOrigem && Object.keys(i.autoOrigem).length ? i.autoOrigem : null;
    r.revisar = i.revisar || null;
    r.decisao_texto = i.decisao && i.decTexto ? String(i.decTexto).slice(0, 4000) : null; });
  const crit = new Map(); d.issues.forEach(i => (i.crit || []).forEach(c => { if (c._id) crit.set(c._id, c); }));
  (L.itens_criterios || []).forEach(r => { const c = crit.get(r.id); if (!c) return;
    r.prova = String(c.prova || '').trim().slice(0, 2000) || null; r.prova_quem = c.provaQuem && temPessoa.has(c.provaQuem) ? c.provaQuem : null;
    r.prova_em = c.provaEm ? String(c.provaEm).slice(0, 10) : null; r.prova_resultado = ['passou','falhou','parcial'].includes(c.provaRes) ? c.provaRes : null; });
  const ws = new Map(d.ws.map(w => [w.id, w]));
  (L.frentes || []).forEach(r => { const w = ws.get(r.no_id); r.definicao_pronto = w && String(w.dod || '').trim() ? String(w.dod).trim().slice(0, 3000) : null; });
  return L;
};

/* ---------- 5a e 6: de onde veio cada preenchimento automático ---------- */
const _novoIssueLv2 = novoIssue;
novoIssue = function(o){
  const n = _novoIssueLv2.apply(this, arguments);
  if (o && o.fim === undefined && n.tipo !== 'epic' && n.fim) n.autoOrigem = Object.assign({}, n.autoOrigem, {prazo:'padrão de 7 dias ao criar (' + fmtData(n.fim) + ')'});
  return n;
};
LT_CAMPOS['situacao'] = 'situacao';
const LV2_SITU_LOTE = {'criado':'backlog', 'priorizado':'todo', 'em andamento':'doing', 'andamento':'doing', 'travado':'blocked', 'pronto para testar':'review', 'pronto pra testar':'review'};
const _ltDetalheLv2 = ltDetalhe;
ltDetalhe = function(campo, v, det, pj){
  if (campo !== 'situacao') return _ltDetalheLv2.apply(this, arguments);
  const n = ltNorm(v); if (!n) return 'falta o valor depois de "situação:"';
  if ('situacao' in det) return '"situação" aparece duas vezes no mesmo item';
  if (n === 'aceito' || n === 'aceita') return 'Aceito não vale no Criar em lote: só o P.O. aceita, com todos os critérios marcados. Use até Pronto para testar';
  const s = LV2_SITU_LOTE[n]; if (!s) return 'situação "' + String(v).trim() + '" não existe: use Criado, Priorizado, Em andamento, Travado ou Pronto para testar';
  det.situacao = s; return '';
};
const _ltNovoLv2 = ltNovo;
ltNovo = function(){ const ni = _ltNovoLv2.apply(this, arguments); Object.defineProperty(ni, '_lv2Novo', {value:true, enumerable:false, configurable:true}); return ni; };
const _ltAplicarLv2 = ltAplicar;
ltAplicar = function(x, det){
  const r = _ltAplicarLv2.apply(this, arguments);
  if (det.prazo && x.autoOrigem && x.autoOrigem.prazo){ const o = Object.assign({}, x.autoOrigem); delete o.prazo; x.autoOrigem = Object.keys(o).length ? o : null; }
  if (det.situacao && x.status !== det.situacao){
    if (x._lv2Novo){ x.status = det.situacao; x.autoOrigem = Object.assign({}, x.autoOrigem, {situacao:'criado já em ' + PO_SITU[det.situacao] + ', por lote'}); }
    else if (x.status !== 'done') mudarStatus(x, det.situacao);
  }
  return r;
};
// a linha "situação: Aceito" sem recuo virava um épico: agora é campo (e o Aceito dá erro claro)

/* ---------- 7: prévia do Editar em lote com as contas ---------- */
const _lePreviaHTMLLv2 = lePreviaHTML;
lePreviaHTML = function(r){
  const h = _lePreviaHTMLLv2.apply(this, arguments); if (!r || !r.blocos || !r.blocos.length) return h;
  let muda = 0, igual = 0, erro = 0; r.blocos.forEach(b => { if (b.erros && b.erros.length){ erro += (b.alvos || []).length || 1; return; } (b.sim || []).forEach(s => { if (s.mud.length) muda++; else igual++; }); });
  const c = '<p class="lt-conta lv2-contas"><span><b>' + muda + '</b> ' + (muda === 1 ? 'muda' : 'mudam') + '</span> · <span><b>' + igual + '</b> ' + (igual === 1 ? 'não muda' : 'não mudam') + '</span>' + (erro ? ' · <span class="lv2-erro"><b>' + erro + '</b> com erro</span>' : '') + '. Nada é gravado antes de confirmar.</p>';
  return h.replace('</p>', '</p>' + c);
};

/* ---------- 4: Definição de Pronto comum ao projeto + a de cada frente ---------- */
function lv2Linhas(txt){ return String(txt || '').split('\n').map(l => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean); }
// pares de linhas iguais ou muito parecidas (mesmas palavras em 80% ou uma dentro da outra)
function lv2Repetidas(linhas, outras){
  const pal = s => new Set(lv2Norm(s).split(' ').filter(w => w.length > 2)), par = [];
  const todas = linhas.map(t => ({t, p:pal(t), n:lv2Norm(t)})), fora = (outras || []).map(t => ({t, p:pal(t), n:lv2Norm(t)}));
  const pareço = (a, b) => { if (!a.n || !b.n) return false; if (a.n === b.n || (a.n.length > 12 && b.n.includes(a.n)) || (b.n.length > 12 && a.n.includes(b.n))) return true;
    const i = [...a.p].filter(w => b.p.has(w)).length, u = new Set([...a.p, ...b.p]).size; return u >= 3 && i / u >= 0.8; };
  todas.forEach((a, k) => { todas.slice(k + 1).forEach(b => { if (pareço(a, b)) par.push([a.t, b.t]); }); fora.forEach(b => { if (pareço(a, b)) par.push([a.t, b.t + ' (já está na comum)']); }); });
  return par;
}
// no modal de Definição de Pronto: antes de guardar, avisa linha repetida ou muito parecida (segundo clique guarda assim mesmo)
function lv2VigiarDod(dl, outras){
  if (!dl || dl.dataset.lv2Dod) return; dl.dataset.lv2Dod = '1';
  const bt = [...dl.querySelectorAll('.modal-rod .btn')].pop(); if (!bt) return;
  dl.addEventListener('click', e => {
    if (!e.target.closest || e.target.closest('.modal-rod .btn') !== bt || dl.dataset.lv2Ok) return;
    const ta = dl.querySelector('#po-dod, #lv2-dod'); const par = ta ? lv2Repetidas(lv2Linhas(ta.value), outras) : [];
    if (!par.length) return;
    e.preventDefault(); e.stopImmediatePropagation(); dl.dataset.lv2Ok = '1';
    const box = dl.querySelector('.lv2-dod-aviso') || (ta.insertAdjacentHTML('afterend', '<div class="lv2-dod-aviso" role="alert"></div>'), dl.querySelector('.lv2-dod-aviso'));
    box.innerHTML = '<b>' + par.length + (par.length === 1 ? ' linha repetida ou muito parecida' : ' linhas repetidas ou muito parecidas') + ':</b><ul>' + par.map(([a, b]) => '<li>"' + esc(a) + '" e "' + esc(b) + '"</li>').join('') + '</ul><small>Junte numa linha só. Para guardar assim mesmo, clique de novo em Guardar.</small>';
  }, true);
}
const _poEditarDodLv2 = poEditarDod;
poEditarDod = function(pj){ const r = _poEditarDodLv2.apply(this, arguments); lv2VigiarDod(document.querySelector('dialog.modal:last-of-type'), []); return r; };
function lv2EditarDodFrente(w, depois){
  const app = byId('apps', w.app), pj = app && byId('projects', app.project);
  const d = modal('Definição de Pronto da frente ' + w.nome, '<p class="sec">Só as regras desta frente. A comum do projeto' + (pj ? ' (' + esc(pj.nome) + ')' : '') + ' continua valendo para todos os itens.</p>' +
    (pj && pj.dod ? '<details class="lv2-dod-comum"><summary>Ver a comum do projeto</summary><p>' + esc(pj.dod).replace(/\n/g, '<br>') + '</p></details>' : '') +
    '<label class="lb">O que todo item desta frente precisa ter, além da comum<textarea class="campo" id="lv2-dod" rows="7" maxlength="3000" placeholder="Ex.:\n- Consulta com índice e plano de execução conferido\n- Política de acesso testada com dois usuários">' + esc(w.dod || '') + '</textarea></label>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Guardar', acao:dl => { w.dod = $('#lv2-dod', dl).value.trim(); salvar(); toast('Definição de Pronto da frente guardada.'); if (depois) depois(); }}]);
  lv2VigiarDod(document.querySelector('dialog.modal:last-of-type'), pj ? lv2Linhas(pj.dod) : []);
  return d;
}

/* ---------- 8 e 10: prova de cada critério e o modelo Dado / Quando / Então ---------- */
const LV2_RES = {passou:'Passou', falhou:'Falhou', parcial:'Passou em parte'};
const lv2SemProva = i => poCrit(i).filter(c => c.f && !String(c.prova || '').trim());
function lv2ProvaTexto(i, c){
  if (!c.prova && !c.provaRes) return '';
  let p = String(c.prova || ''); const an = /^anexo:([^|]+)\|?(.*)$/.exec(p); if (an){ const r = (i.refs || []).find(x => x._id === an[1]); p = 'anexo ' + ((r && r.nome) || an[2] || ''); }
  const q = c.provaQuem && pessoa(c.provaQuem);
  return [c.provaRes ? LV2_RES[c.provaRes] : '', q ? 'testado por ' + q.nome : '', c.provaEm ? 'em ' + lv2Data(c.provaEm) : '', p].filter(Boolean).join(' · ');
}
const _poCriteriosHTMLLv2 = poCriteriosHTML;
poCriteriosHTML = function(i, pode){
  const h = _poCriteriosHTMLLv2.apply(this, arguments), box = document.createElement('div'); box.innerHTML = h;
  const L = poCrit(i), ed = pode && !poAceito(i);
  $$('li.po-crit-lin', box).forEach((li, k) => { const c = L[k]; if (!c) return; const t = lv2ProvaTexto(i, c);
    li.insertAdjacentHTML('beforeend', '<div class="lv2-prova">' + (t ? '<span class="lv2-prova-txt' + (c.provaRes === 'falhou' ? ' lv2-falhou' : '') + '"><b>Prova:</b> ' + esc(t) + '</span>' : c.f ? '<span class="lv2-sem-prova" title="Critério marcado sem o registro do que foi testado. É só um aviso: não impede o aceite.">marcado sem prova</span>' : '') +
      (pode ? '<button type="button" class="po-link" data-lv2-prova="' + k + '">' + (t ? 'mudar a prova' : 'registrar prova') + '</button>' : '') + '</div>'); });
  const sem = lv2SemProva(i).length, abertos = L.filter(c => !String(c.prova || '').trim()).length;
  const caixa = $('.po-crit-caixa', box);
  if (caixa && i.status === 'review' && abertos) caixa.insertAdjacentHTML('afterbegin', '<p class="lv2-aviso">' + abertos + (abertos === 1 ? ' critério ainda sem prova' : ' critérios ainda sem prova') + '. Registre o que foi testado antes de aceitar.</p>');
  else if (caixa && sem) caixa.insertAdjacentHTML('afterbegin', '<p class="lv2-aviso">' + sem + (sem === 1 ? ' critério marcado sem prova' : ' critérios marcados sem prova') + '.</p>');
  const form = $('[data-po-form="crit"]', box);
  if (form && ed) form.insertAdjacentHTML('afterend', '<details class="lv2-gherkin"><summary>Escrever no modelo Dado / Quando / Então (opcional)</summary><div class="lv2-gk-campos">' +
    '<label>Dado<input class="campo" data-lv2-gk="dado" maxlength="160" placeholder="o cliente tem uma fatura vencida há 10 dias"></label>' +
    '<label>Quando<input class="campo" data-lv2-gk="quando" maxlength="160" placeholder="o sistema roda a cobrança do dia"></label>' +
    '<label>Então<input class="campo" data-lv2-gk="entao" maxlength="160" placeholder="o cliente recebe o aviso de atraso"></label>' +
    '<button type="button" class="btn sec peq" data-lv2-gk-add>Adicionar critério</button></div></details>');
  // Definição de Pronto: a comum do projeto e a da frente do item
  const w = lv2Ws(i), dod = $('.po-dod', box);
  if (dod && w) dod.insertAdjacentHTML('beforeend', '<div class="lv2-dod-frente"><b>Da frente ' + esc(w.nome) + '</b>' + (w.dod ? '<p>' + esc(w.dod).replace(/\n/g, '<br>') + '</p>' : '<p class="po-frase-vazia">Sem regras só desta frente.</p>') +
    (pode ? '<button type="button" class="po-link" data-lv2-dod-ws="' + esc(w.id) + '">' + (w.dod ? 'Editar' : 'Escrever') + '</button>' : '') + '</div>');
  return box.innerHTML;
};
function lv2RegistrarProva(i, k){
  const c = poCrit(i)[k]; if (!c) return;
  const an = (i.refs || []).filter(r => r._id && !r.papel), atual = /^anexo:([^|]+)/.exec(c.prova || ''), texto = atual ? '' : (c.prova || '');
  const equipe = D.people.filter(p => p.ativo !== false && p.acesso !== 'stakeholder');
  modal('Prova do critério', '<p class="sec">"' + esc(c.t) + '"</p><div class="grade-form">' +
    '<label class="lb">Resultado<select class="sel" id="lv2-pr-res"><option value="">Sem resultado</option>' + Object.entries(LV2_RES).map(([k2, n]) => '<option value="' + k2 + '"' + (c.provaRes === k2 ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' +
    '<label class="lb">Quem testou<select class="sel" id="lv2-pr-quem">' + equipe.map(p => '<option value="' + esc(p.id) + '"' + ((c.provaQuem || eu()) === p.id ? ' selected' : '') + '>' + esc(p.nome) + '</option>').join('') + '</select></label>' +
    '<label class="lb">Quando<input class="campo" type="date" id="lv2-pr-em" value="' + esc(c.provaEm ? String(c.provaEm).slice(0, 10) : iso(HOJE)) + '"></label>' +
    (an.length ? '<label class="lb">Ou um anexo do item<select class="sel" id="lv2-pr-an"><option value="">Nenhum</option>' + an.map(r => '<option value="' + esc(r._id) + '"' + (atual && atual[1] === r._id ? ' selected' : '') + '>' + esc(r.nome || r.url || 'anexo') + '</option>').join('') + '</select></label>' : '') +
    '<label class="lb largo">A prova: o que foi testado e o resultado, ou um link<textarea class="campo" id="lv2-pr-txt" rows="4" maxlength="2000" placeholder="Ex.: verificador de segurança sem alerta; plano de consulta usa o índice; link do print">' + esc(texto) + '</textarea></label></div>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Guardar', acao:d => {
      const sel = $('#lv2-pr-an', d), anId = sel && sel.value, txt = $('#lv2-pr-txt', d).value.trim(), r = an.find(x => x._id === anId);
      c.prova = anId ? 'anexo:' + anId + '|' + ((r && r.nome) || '') : txt; c.provaRes = $('#lv2-pr-res', d).value || null; c.provaQuem = $('#lv2-pr-quem', d).value || eu(); c.provaEm = $('#lv2-pr-em', d).value || iso(HOJE);
      if (typeof poHistLocal === 'function') poHistLocal(i, {tipo:'criterio', para:c.t, texto:'prova: ' + (lv2ProvaTexto(i, c) || '(sem prova)')});
      salvar(); poReabrir(i); toast('Prova registrada.'); }}]);
}
document.addEventListener('click', e => {
  const t = e.target.closest ? e.target.closest('[data-lv2-prova],[data-lv2-gk-add],[data-lv2-dod-ws],[data-lv2-revisado]') : null; if (!t) return;
  if (t.dataset.lv2DodWs){ const w = byId('ws', t.dataset.lv2DodWs); if (w) lv2EditarDodFrente(w, () => { const i = itemAberto && byId('issues', itemAberto); if (i) poReabrir(i); }); return; }
  const i = itemAberto && byId('issues', itemAberto); if (!i) return;
  if (t.dataset.lv2Prova != null) return lv2RegistrarProva(i, +t.dataset.lv2Prova);
  if (t.dataset.lv2Revisado != null){ const m = i.revisar; i.revisar = null; if (typeof poHistLocal === 'function') poHistLocal(i, {tipo:'edicao', texto:'Revisado (era: ' + ((m && m.motivo) || 'decisão mudou') + ')'}); salvar(); poReabrir(i); rView(); toast('Marcado como revisado.'); return; }
  if (t.dataset.lv2GkAdd != null){
    const caixa = t.closest('.lv2-gherkin'), v = k => (($('[data-lv2-gk="' + k + '"]', caixa) || {}).value || '').trim().replace(/[.;]+$/, '');
    if (!v('dado') || !v('quando') || !v('entao')){ toast('Preencha Dado, Quando e Então'); return; }
    if (poAceito(i)){ toast('Item aceito: os critérios não mudam mais. Use Criar melhoria.'); return; }
    const txt = ('Dado ' + v('dado') + ', quando ' + v('quando') + ', então ' + v('entao') + '.').slice(0, 500);
    i.crit = poCrit(i).concat([{t:txt, f:false}]); if (typeof poHistLocal === 'function') poHistLocal(i, {tipo:'criterio', para:txt, texto:'criou'});
    salvar(); poReabrir(i); rView();
  }
});

/* ---------- 9: decisão fechada guarda o texto; se mudar, os itens afetados ficam para revisar ---------- */
const lv2Afetados = i => D.issues.filter(x => !x.arquivado && x.id !== i.id && poDeps(x).some(d => d.id === i.id));
const lv2TextoDecisao = i => String((i.desc || '').trim() || i.titulo || '').slice(0, 4000);
const _mudarStatusLv2 = mudarStatus;
mudarStatus = function(i, s){
  const r = _mudarStatusLv2.apply(this, arguments);
  if (i && i.decisao && i.status === 'done' && !i.decTexto){ i.decTexto = lv2TextoDecisao(i); i.decEm = new Date().toISOString(); i.decPor = eu(); }
  return r;
};
// a cada gravação: decisão já fechada cujo texto mudou marca os itens afetados (não muda situação, ordem nem aceite)
function lv2ConferirDecisoes(){
  D.issues.filter(i => i.decisao && i.status === 'done' && i.decTexto && !i.arquivado).forEach(i => {
    const agora = lv2TextoDecisao(i); if (agora === i.decTexto) return;
    const af = lv2Afetados(i), quando = new Date().toISOString();
    af.forEach(x => { x.revisar = {motivo:'A decisão "' + i.titulo + '" mudou', decisao:i.id, em:quando, por:eu()}; });
    i.decTexto = agora; i.decEm = quando; i.decPor = eu();
    if (af.length) toast('A decisão mudou: ' + af.length + (af.length === 1 ? ' item ficou' : ' itens ficaram') + ' para revisar.');
  });
}
const _salvarLv2 = salvar;
salvar = function(){ try { lv2ConferirDecisoes(); } catch(e){ console.warn('Decisões', e); } return _salvarLv2.apply(this, arguments); };
// na janela do item: o texto da decisão e os itens afetados; e a marca de revisar
const _abrirItemLv2 = abrirItem;
abrirItem = function(id){
  const r = _abrirItemLv2.apply(this, arguments);
  try {
    const i = byId('issues', id), alvo = $('#gaveta-wrap [data-po-sec="criterios"]') || $('#gaveta-wrap .g-principal'); if (!i || !alvo) return r;
    const pode = podeEditar(); let h = '';
    if (i.revisar) h += '<section class="g-sec jn-sec lv2-revisar"><h4><span class="jn-sec-tit">Para revisar</span></h4><p>' + esc(i.revisar.motivo || 'Uma decisão mudou') + (i.revisar.em ? ' · ' + esc(poDataHora(i.revisar.em)) : '') + '</p>' +
      (i.revisar.decisao && byId('issues', i.revisar.decisao) ? '<p class="sec">Decisão: <button type="button" class="po-link" data-abrir-item="' + esc(i.revisar.decisao) + '">' + esc(byId('issues', i.revisar.decisao).titulo) + '</button></p>' : '') +
      (pode ? '<button type="button" class="btn sec peq" data-lv2-revisado>Marcar como revisado</button>' : '') + '</section>';
    if (i.decisao){ const af = lv2Afetados(i), p = i.decPor && pessoa(i.decPor);
      h += '<section class="g-sec jn-sec lv2-decisao"><h4><span class="jn-sec-tit">Decisão</span>' + (af.length ? '<span class="g-cont">' + af.length + (af.length === 1 ? ' item afetado' : ' itens afetados') + '</span>' : '') + '</h4>' +
        (i.decTexto ? '<p><b>Decidido:</b> ' + esc(i.decTexto).replace(/\n/g, '<br>') + '</p><p class="sec">' + esc([p ? 'por ' + p.nome : '', i.decEm ? 'em ' + poDataHora(i.decEm) : ''].filter(Boolean).join(' ')) + '. Se o texto da decisão mudar, os itens afetados ficam marcados para revisar.</p>' : '<p class="sec">Ainda em aberto. Ao aceitar, o texto (a descrição) fica guardado com quem decidiu e quando.</p>') +
        (af.length ? '<ul class="lv2-afetados">' + af.map(x => '<li><button type="button" class="po-link" data-abrir-item="' + esc(x.id) + '">' + esc(poCh(x) + x.titulo) + '</button> <small>' + esc(PO_SITU[poSituacao(x)] || '') + (x.revisar ? ' · para revisar' : '') + '</small></li>').join('') + '</ul>' : '<p class="sec">Nenhum item depende desta decisão. Para ligar, abra o item e diga que ele depende desta decisão.</p>') + '</section>';
    }
    if (h) alvo.insertAdjacentHTML(alvo.matches('[data-po-sec]') ? 'beforebegin' : 'afterbegin', h);
  } catch(e){ console.warn('Leva 2: janela do item', e); }
  return r;
};

/* ---------- 3, 5 e 9: selos na lista e no quadro, filtros rápidos e avisos no "O que fazer hoje" ---------- */
const _poChipsHTMLLv2 = poChipsHTML;
poChipsHTML = function(i, curto){
  const h = _poChipsHTMLLv2.apply(this, arguments); if (!h) return h;
  const v = lv2Versao(i), tc = lv2Terceiros(i), add = [];
  if (i.revisar) add.push('<span class="po-chip lv2-rev" title="' + esc(i.revisar.motivo || 'Uma decisão mudou') + '">revisar</span>');
  if (tc.length) add.push('<span class="po-chip lv2-terc" title="Bloqueado por terceiro: ' + esc(tc.map(x => poCh(x) + x.titulo + (x.resp && pessoa(x.resp) ? ' (' + pessoa(x.resp).nome + ')' : ' (sem responsável)')).join('; ')) + '">bloqueado por terceiro</span>');
  if (!curto && i.status !== 'done' && v && v.data && i.fim && i.fim > v.data && !v.entregue) add.push('<span class="po-chip lv2-tarde" title="Prazo ' + fmtData(i.fim) + ' depois da entrega da versão ' + esc(v.nome) + ' (' + fmtData(v.data) + ')">prazo depois da entrega</span>');
  if (!curto && i.autoOrigem && i.autoOrigem.prazo && i.fim && i.autoOrigem.prazo.includes(fmtData(i.fim))) add.push('<span class="po-chip lv2-auto" title="Prazo preenchido automaticamente: ' + esc(i.autoOrigem.prazo) + '">prazo automático</span>');
  return add.length ? h.replace(/<\/span>$/, add.join('') + '</span>') : h;
};
const _ferramentasHTMLLv2 = ferramentasHTML;
ferramentasHTML = function(extra){
  const h = _ferramentasHTMLLv2.apply(this, arguments), base = issuesEm(UI.sel).filter(i => !i.arquivado && poTemPO(i));
  const n = {terceiro:base.filter(i => i.status !== 'done' && lv2Terceiros(i).length).length, semresp:base.filter(i => i.status !== 'done' && !i.resp).length, revisar:base.filter(i => i.revisar).length};
  const bts = [['terceiro', 'Bloqueados por terceiro'], ['semresp', 'Sem responsável'], ['revisar', 'Para revisar']].filter(([k]) => n[k] || UI.filtros[k])
    .map(([k, t]) => '<button class="filtro-rap" type="button" data-filtro="' + k + '" aria-pressed="' + !!UI.filtros[k] + '">' + t + ' (' + n[k] + ')</button>').join('');
  return bts ? h.replace(/<\/div>\s*$/, bts + '</div>') : h;
};
const _listaFiltradaLv2 = listaFiltrada;
listaFiltrada = function(){
  let l = _listaFiltradaLv2.apply(this, arguments); const f = UI.filtros || {};
  if (f.terceiro) l = l.filter(i => i.status !== 'done' && lv2Terceiros(i).length);
  if (f.semresp) l = l.filter(i => i.status !== 'done' && !i.resp && poTemPO(i));
  if (f.revisar) l = l.filter(i => i.revisar);
  return l;
};
const _pgAcoesLv2 = pgAcoes;
pgAcoes = function(chave){
  const A = _pgAcoesLv2.apply(this, arguments), sil = pgSil(), its = issuesEm(chave).filter(i => !i.arquivado && poTemPO(i) && i.status !== 'done');
  const add = (k, peso, tit, por, botao) => { if (!sil[k]) A.push({k, peso, tit, por, botao}); };
  const rev = issuesEm(chave).filter(i => !i.arquivado && i.revisar);
  if (rev.length) add('revisar:' + chave + ':' + rev.length, 85, 'Revisar ' + rev.length + (rev.length === 1 ? ' item afetado' : ' itens afetados') + ' por decisão que mudou', rev.slice(0, 3).map(i => i.revisar.motivo).filter((x, k2, a) => a.indexOf(x) === k2).join('. ') + '.', {txt:'Ver na Lista', view:'list'});
  const terc = its.filter(i => lv2Terceiros(i).length);
  if (terc.length) add('terceiro:' + chave + ':' + terc.length, 65, terc.length + (terc.length === 1 ? ' item bloqueado por terceiro' : ' itens bloqueados por terceiro'), 'Dependem de tarefa externa ainda não aceita: ' + [...new Set(terc.flatMap(lv2Terceiros).map(x => x.titulo + (x.resp && pessoa(x.resp) ? ' (' + pessoa(x.resp).nome + ')' : ' (sem responsável)')))].slice(0, 3).join('; ') + '.', {txt:'Ver na Lista', view:'list'});
  const tarde = its.filter(i => { const v = lv2Versao(i); return v && v.data && !v.entregue && i.fim && i.fim > v.data; });
  if (tarde.length) add('tarde:' + chave + ':' + tarde.length, 55, tarde.length + (tarde.length === 1 ? ' item com prazo depois da entrega da versão' : ' itens com prazo depois da entrega da versão'), tarde.slice(0, 3).map(i => leNomePg(i) + ': ' + fmtData(i.fim) + ' (versão ' + lv2Versao(i).nome + ' entrega ' + fmtData(lv2Versao(i).data) + ')').join('; ') + '.', {txt:'Ver na Lista', view:'list'});
  const sr = its.filter(i => !i.resp && ['todo','doing','review','blocked'].includes(i.status));
  if (sr.length) add('semresp:' + chave + ':' + sr.length, 35, sr.length + (sr.length === 1 ? ' item em andamento sem responsável' : ' itens priorizados ou em andamento sem responsável'), 'Sem dono, ninguém responde pelo item: ' + sr.slice(0, 3).map(leNomePg).join(', ') + '.', {txt:'Ver na Lista', view:'list'});
  const semP = its.filter(i => i.status === 'review' && poCrit(i).some(c => !String(c.prova || '').trim()));
  if (semP.length) add('prova:' + chave + ':' + semP.length, 75, semP.length + (semP.length === 1 ? ' item pronto para testar com critério sem prova' : ' itens prontos para testar com critério sem prova'), 'Registre o que foi testado em cada critério: ' + semP.slice(0, 3).map(leNomePg).join(', ') + '.', {txt:'Ver na Lista', view:'list'});
  return A.sort((a, b) => b.peso - a.peso);
};

/* ---------- 2 e 3: Entregas e Lista dizem o que contam; tarefas externas em linha à parte ---------- */
const _poAndamentoVersaoLv2 = poAndamentoVersao;
poAndamentoVersao = function(m){
  const a = _poAndamentoVersaoLv2.apply(this, arguments);
  const ext = issuesEm(m.no || UI.sel).filter(i => i.marco === m.id && !i.arquivado && lv2Ext(i));
  const pend = ext.filter(i => i.status !== 'done');
  return Object.assign(a, {ext:pend.length, extPts:pend.reduce((s, i) => s + (+i.pontos || 0), 0), escopo:lv2NomeNo(m.no || UI.sel)});
};
const _enHTMLLv2 = enHTML;
enHTML = function(chave){
  const h = _enHTMLLv2.apply(this, arguments), box = document.createElement('div'); box.innerHTML = h;
  $$('.en2-v', box).forEach(li => { const b = $('[data-en-notas]', li); const m = b && byId('marcos', b.dataset.enNotas); const prog = $('.en2-prog', li); if (!m || !prog) return;
    const a = poAndamentoVersao(m);
    prog.innerHTML = prog.innerHTML.replace(' itens aceitos</small>', ' itens aceitos ' + esc(a.escopo) + '</small>');
    if (a.ext) prog.insertAdjacentHTML('beforeend', '<small class="lv2-terceiros" title="Tarefas externas não entram no progresso nem na previsão">aguardando terceiros: ' + a.ext + (a.ext === 1 ? ' item' : ' itens') + (a.extPts ? ', ' + a.extPts + ' pontos' : '') + '</small>'); });
  return box.innerHTML;
};

/* ---------- 1 e 2: Lista agrupada por épico (inclusive de outra frente) e a conta do que ficou fora ---------- */
function lv2LinhaLista(i, selo){
  const ch = chaveDe(i);
  return '<li data-abrir-item="' + i.id + '"><span class="po-li-tit">' + tipoHTML(i.tipo) + (ch ? '<span class="bj-chave">' + esc(ch) + '</span>' : '') + '<span class="po-li-nome">' + esc(i.titulo) + '</span>' + (selo || '') + '</span>' +
    '<span class="po-li-dir">' + poChipsHTML(i) + '<span class="sec po-li-onde">' + esc(caminhoTexto(i)) + '</span>' + avatar(i.resp) + '</span></li>';
}
// a conta do cabeçalho: o que está nesta frente/projeto e o que ficou fora da lista, com o motivo
function lv2ContaHTML(l){
  const todos = issuesEm(UI.sel).filter(i => i.tipo !== 'epic'), arq = D.issues.filter(i => i.arquivado && i.tipo !== 'epic' && issuesEmIds().has(i.id));
  const ac = l.filter(i => i.status === 'done').length, fora = todos.length - l.filter(i => i.tipo !== 'epic').length;
  const ext = l.filter(lv2Ext).length;
  return '<p class="lv2-conta"><b>' + l.filter(i => i.tipo !== 'epic').length + '</b> ' + (l.length === 1 ? 'item' : 'itens') + ' na lista ' + esc(lv2NomeNo(UI.sel)) + ' · <b>' + ac + '</b> aceitos' + (ext ? ' · ' + ext + (ext === 1 ? ' tarefa externa (fora dos totais)' : ' tarefas externas (fora dos totais)') : '') +
    (fora > 0 ? ' · <span class="lv2-fora">' + fora + (fora === 1 ? ' item fora da lista' : ' itens fora da lista') + ': filtros ligados</span>' : '') +
    (arq.length ? ' · <span class="lv2-fora">' + arq.length + (arq.length === 1 ? ' arquivado ou cancelado' : ' arquivados ou cancelados') + ' (não aparecem)</span>' : '') + '</p>';
}
function issuesEmIds(){ const [t, id] = UI.sel.split(':'); const ws = t === 'ws' ? [id] : t === 'all' ? D.ws.map(w => w.id) : D.ws.filter(w => { const c = cadeia('ws:' + w.id); return (c.app && c.app.id === id) || (c.product && c.product.id === id) || (c.project && c.project.id === id) || (c.client && c.client.id === id); }).map(w => w.id); const s = new Set(ws); return new Set(D.issues.filter(i => s.has(i.ws)).map(i => i.id)); }
const _vListLv2 = vList;
vList = function(){
  const l = listaFiltrada(), porEpico = !!UI.lv2PorEpico;
  const botao = '<div class="lv2-lista-topo">' + lv2ContaHTML(l) + '<button type="button" class="btn sec peq" data-lv2-agrupar aria-pressed="' + porEpico + '">' + (porEpico ? 'Agrupar pela situação' : 'Agrupar por épico') + '</button></div>';
  if (!porEpico){ const h = _vListLv2.apply(this, arguments); return h.replace('<div class="ferramentas">', botao + '<div class="ferramentas">'); }
  const its = l.filter(i => i.tipo !== 'epic'), grupos = new Map(), sem = [];
  its.forEach(i => { const e = epicDe(i); if (!e){ sem.push(i); return; } if (!grupos.has(e.id)) grupos.set(e.id, {e, its:[]}); grupos.get(e.id).its.push(i); });
  l.filter(i => i.tipo === 'epic').forEach(e => { if (!grupos.has(e.id)) grupos.set(e.id, {e, its:[]}); });
  const fr = UI.sel.startsWith('ws:') ? UI.sel.slice(3) : null;
  const ord = (a, b) => (+a.ordem || 0) - (+b.ordem || 0);
  return ferramentasHTML('').replace('<div class="ferramentas">', botao + '<div class="ferramentas">') + (its.length ? '' : '<p class="vazio-linha">Nenhum item com esses filtros.</p>') +
    [...grupos.values()].sort((a, b) => ord(a.e, b.e)).map(({e, its:g}) => { const outra = fr && e.ws !== fr, we = lv2Ws(e);
      const pts = g.reduce((s, i) => s + (lv2Ext(i) ? 0 : +i.pontos || 0), 0);
      return '<div class="grupo-lista po-grupo"><h3><button type="button" class="po-link lv2-ep-tit" data-abrir-item="' + e.id + '">' + tipoHTML('epic') + esc(e.titulo) + '</button>' + (outra ? '<span class="po-chip lv2-outra" title="Este épico é da frente ' + esc(we ? we.nome : '') + '">épico de outra frente: ' + esc(we ? we.nome : '') + '</span>' : '') +
        '<span class="rotulo-mini">' + g.length + (g.length === 1 ? ' item' : ' itens') + ' · ' + g.filter(i => i.status === 'done').length + ' aceitos' + (pts ? ' · ' + pts + ' pontos' : '') + '</span></h3><ul class="lista">' + g.sort(ord).map(i => lv2LinhaLista(i)).join('') + '</ul></div>'; }).join('') +
    (sem.length ? '<div class="grupo-lista po-grupo"><h3>Itens sem épico<span class="rotulo-mini">' + sem.length + (sem.length === 1 ? ' item' : ' itens') + '</span></h3><ul class="lista">' + sem.sort(ord).map(i => lv2LinhaLista(i)).join('') + '</ul></div>' : '');
};
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-lv2-agrupar]')){ UI.lv2PorEpico = !UI.lv2PorEpico; salvarUI(); rView(); } });

/* ---------- 11 e 12: mapa de histórias e pirâmide do backlog ---------- */
function lv2Piramide(chave){
  const its = issuesEm(chave).filter(i => !i.arquivado && i.status !== 'done');
  const ep = its.filter(i => i.tipo === 'epic').length, abertos = its.filter(i => poTemPO(i) && ['backlog','todo'].includes(i.status) && !lv2Ext(i) && !i.decisao);
  const prontos = abertos.filter(i => { const p = pgPreparo(i); return p && p.ok; }), medios = abertos.length - prontos.length;
  const topo = abertos.slice().sort((a, b) => (+a.ordem || 0) - (+b.ordem || 0)).slice(0, 8), topoOk = topo.filter(i => { const p = pgPreparo(i); return p && p.ok; }).length;
  const max = Math.max(1, ep, medios, prontos.length), lin = (n, t, dica, cls) => '<div class="lv2-pir-lin ' + cls + '" title="' + esc(dica) + '"><div class="lv2-pir-barra" style="width:' + Math.max(8, Math.round(n / max * 100)) + '%"><b>' + n + '</b></div><span>' + t + '</span></div>';
  return '<section class="lv2-piramide en2-caixa"><header><h3>Pirâmide do backlog</h3><p>' + (topo.length ? topoOk + ' dos ' + topo.length + ' primeiros da fila estão prontos para começar' + (topoOk < topo.length ? ': refine os de cima antes de puxar trabalho novo.' : '.') : 'Sem itens abertos na fila.') + '</p></header>' +
    lin(prontos.length, 'prontos para começar (história, critérios, prioridade e estimativa)', 'Itens Criados ou Priorizados que já passam no "Preparado"', 'lv2-pir-pronto') +
    lin(medios, 'médios (falta detalhe)', 'Itens abertos que ainda não passam no "Preparado"', 'lv2-pir-medio') +
    lin(ep, 'épicos (grandes, ainda por quebrar)', 'Épicos abertos', 'lv2-pir-epico') + '</section>';
}
function lv2MapaHTML(chave){
  const pj = cadeia(chave).project, its = issuesEm(chave).filter(i => !i.arquivado && i.tipo !== 'epic');
  const vers = (pj ? enVersoes('project:' + pj.id) : enVersoes(chave)).slice().sort((a, b) => String(a.data || '9').localeCompare(String(b.data || '9')));
  const eps = new Map(); its.forEach(i => { const e = epicDe(i); if (e) eps.set(e.id, e); }); issuesEm(chave).filter(i => i.tipo === 'epic' && !i.arquivado).forEach(e => eps.set(e.id, e));
  const cols = [...eps.values()].sort((a, b) => (+a.ordem || 0) - (+b.ordem || 0)); const temSem = its.some(i => !epicDe(i));
  const linhas = vers.concat(its.some(i => !lv2Versao(i)) ? [{id:'', nome:'Sem versão'}] : []);
  if (!its.length) return '<p class="vazio-linha">Sem histórias aqui ainda.</p>';
  const fr = chave.startsWith('ws:') ? chave.slice(3) : null;
  const cel = (v, e) => its.filter(i => ((lv2Versao(i) || {}).id || '') === v.id && ((epicDe(i) || {}).id || '') === (e ? e.id : '')).sort((a, b) => (+a.ordem || 0) - (+b.ordem || 0))
    .map(i => '<button type="button" class="lv2-mapa-it lv2-st-' + esc(poSituacao(i)) + '" data-abrir-item="' + i.id + '" title="' + esc(PO_SITU[poSituacao(i)] || '') + (lv2Ext(i) ? ' · tarefa externa' : '') + '"><span>' + esc((chaveDe(i) ? chaveDe(i) + ' ' : '') + i.titulo) + '</span><small>' + esc(PO_SITU[poSituacao(i)] || '') + '</small></button>').join('');
  return '<div class="tabela-rolo"><table class="lv2-mapa"><thead><tr><th scope="col">Versão</th>' + cols.map(e => '<th scope="col"><button type="button" class="po-link" data-abrir-item="' + e.id + '">' + esc(e.titulo) + '</button>' + (fr && e.ws !== fr ? '<small>épico de outra frente</small>' : '') + '</th>').join('') + (temSem ? '<th scope="col">Sem épico</th>' : '') + '</tr></thead><tbody>' +
    linhas.map(v => '<tr><th scope="row">' + esc(v.nome) + (v.data ? '<small>' + (v.entregue ? 'no ar ' + fmtData(v.entregue) : 'entrega ' + fmtData(v.data)) + '</small>' : '') + '</th>' + cols.map(e => '<td>' + cel(v, e) + '</td>').join('') + (temSem ? '<td>' + cel(v, null) + '</td>' : '') + '</tr>').join('') + '</tbody></table></div>';
}
function lv2TelaMapa(){
  return '<div class="lv2-tela"><header class="lv2-topo"><div><h2>Mapa de histórias</h2><p class="lead">Versões nas linhas e épicos nas colunas: o que cada versão entrega. Clique numa história para abrir. A cor mostra a situação.</p></div></header>' +
    lv2Piramide(UI.sel) + lv2MapaHTML(UI.sel) + '</div>';
}

/* ---------- 13: o que mudou desde uma data, uma versão ou o último lote ---------- */
async function lv2LerHistorico(forcar){
  const sb = window.ciclodevBanco;
  if (!sb || typeof BANCO === 'undefined' || !BANCO.carregado){ LV2.hist = (D.eventos || []).map(e => ({item_id:e.item, tipo:e.tipo === 'status' ? 'situacao' : 'edicao', texto:e.txt, criado_em:new Date(e.quando).toISOString(), pessoa_id:e.quem || null})); return; }
  if (LV2.hist && !forcar && Date.now() - LV2.histEm < 60000) return;
  const todas = []; for (let de = 0; de < 20000; de += 1000){ const {data, error} = await sb.from('itens_historico').select('*').order('criado_em', {ascending:false}).range(de, de + 999); if (error){ console.warn('Histórico', error.message); break; } todas.push(...(data || [])); if (!data || data.length < 1000) break; }
  LV2.hist = todas; LV2.histEm = Date.now();
}
function lv2Desde(){
  const r = LV2.mudouRef || ('dias:7');
  if (r.startsWith('data:')) return r.slice(5);
  if (r.startsWith('dias:')) return iso(new Date(HOJE.getTime() - (+r.slice(5) || 7) * 864e5));
  if (r.startsWith('versao:')){ const m = byId('marcos', r.slice(7)); return m ? String(m.entregue || m.data || iso(HOJE)).slice(0, 10) : iso(HOJE); }
  if (r === 'lote'){ const u = typeof leUltimo === 'function' && leUltimo(); return u && u.quando ? u.quando : iso(HOJE); }
  return iso(HOJE);
}
const lv2Categoria = h => h.tipo === 'situacao' ? 'Situação' : h.tipo === 'criterio' ? 'Critério' : /\bprazo:/.test(h.texto || '') ? 'Prazo' : /respons[aá]vel:/.test(h.texto || '') ? 'Responsável' : 'Outra edição';
function lv2Mudancas(){
  const ids = new Set(issuesEm(UI.sel).map(i => i.id)), desde = lv2Desde();
  return (LV2.hist || []).filter(h => ids.has(h.item_id) && String(h.criado_em) >= desde)
    .filter(h => !LV2.mudouFrente || (byId('issues', h.item_id) || {}).ws === LV2.mudouFrente).filter(h => !LV2.mudouPessoa || h.pessoa_id === LV2.mudouPessoa)
    .sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
}
const lv2HistTexto = h => typeof poHistTexto === 'function' ? poHistTexto({tipo:h.tipo, de:h.de, para:h.para, texto:h.texto}) : (h.texto || '');
function lv2TelaMudou(){
  if (!LV2.hist){ lv2LerHistorico().then(() => { if (UI.view === 'mudou') rView(); }); return '<div class="lv2-tela"><p class="sec">Lendo o histórico...</p></div>'; }
  const pj = cadeia(UI.sel).project, vers = pj ? enVersoes('project:' + pj.id) : [], u = typeof leUltimo === 'function' && leUltimo();
  const frentes = [...new Set(issuesEm(UI.sel).map(i => i.ws))].map(id => byId('ws', id)).filter(Boolean), L = lv2Mudancas();
  const pessoasL = [...new Set((LV2.hist || []).map(h => h.pessoa_id).filter(Boolean))].map(pessoa).filter(Boolean);
  const r = LV2.mudouRef || 'dias:7', opt = (v, t) => '<option value="' + esc(v) + '"' + (r === v ? ' selected' : '') + '>' + esc(t) + '</option>';
  const cats = {}; L.forEach(h => { const c = lv2Categoria(h); cats[c] = (cats[c] || 0) + 1; });
  return '<div class="lv2-tela"><header class="lv2-topo"><div><h2>O que mudou desde</h2><p class="lead">Mudanças de situação, critérios, prazos e responsáveis, tiradas do histórico de cada item.</p></div>' +
    '<button type="button" class="btn sec peq" data-lv2-mudou-baixar' + (L.length ? '' : ' disabled') + '>Baixar em .md</button></header>' +
    '<div class="lv2-filtros"><label class="lb">Desde<select class="sel" data-lv2-mudou="ref">' + opt('dias:1', 'Ontem') + opt('dias:7', 'Últimos 7 dias') + opt('dias:30', 'Últimos 30 dias') +
      vers.map(v => opt('versao:' + v.id, 'Versão ' + v.nome + ' (' + fmtData(String(v.entregue || v.data || '').slice(0, 10)) + ')')).join('') + (u ? opt('lote', 'O último lote (' + poDataHora(u.quando) + ')') : '') +
      (r.startsWith('data:') ? opt(r, 'A data ' + fmtData(r.slice(5))) : '') + '</select></label>' +
      '<label class="lb">Ou uma data<input class="campo" type="date" data-lv2-mudou="data" value="' + esc(r.startsWith('data:') ? r.slice(5) : '') + '"></label>' +
      '<label class="lb">Frente<select class="sel" data-lv2-mudou="frente"><option value="">Todas</option>' + frentes.map(w => '<option value="' + esc(w.id) + '"' + (LV2.mudouFrente === w.id ? ' selected' : '') + '>' + esc(w.nome) + '</option>').join('') + '</select></label>' +
      '<label class="lb">Pessoa<select class="sel" data-lv2-mudou="pessoa"><option value="">Todas</option>' + pessoasL.map(p => '<option value="' + esc(p.id) + '"' + (LV2.mudouPessoa === p.id ? ' selected' : '') + '>' + esc(p.nome) + '</option>').join('') + '</select></label></div>' +
    '<p class="lv2-conta"><b>' + L.length + '</b> ' + (L.length === 1 ? 'mudança' : 'mudanças') + ' desde ' + esc(fmtData(lv2Desde().slice(0, 10))) + (Object.keys(cats).length ? ': ' + Object.entries(cats).map(([c, n]) => n + ' de ' + c.toLowerCase()).join(', ') : '') + '</p>' +
    (L.length ? '<div class="tabela-rolo"><table class="tabela lv2-mudou"><thead><tr><th>Quando</th><th>Item</th><th>O quê</th><th>Mudança</th><th>Quem</th></tr></thead><tbody>' + L.slice(0, 500).map(h => { const i = byId('issues', h.item_id), p = h.pessoa_id && pessoa(h.pessoa_id);
      return '<tr><td>' + esc(poDataHora(h.criado_em)) + '</td><td>' + (i ? '<button type="button" class="po-link" data-abrir-item="' + esc(i.id) + '">' + esc(poCh(i) + i.titulo) + '</button>' : '') + '</td><td>' + esc(lv2Categoria(h)) + '</td><td>' + esc(lv2HistTexto(h)) + '</td><td>' + esc(p ? p.nome : h.pessoa_id ? 'Alguém' : 'O sistema') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      (L.length > 500 ? '<p class="po-nota">Mostrando as 500 mais recentes. O arquivo baixado traz todas.</p>' : '') : '<p class="vazio-linha">Nada mudou nesse período.</p>') + '</div>';
}
function lv2MudouMd(){
  const L = lv2Mudancas(), nome = nomeDe(UI.sel);
  return '# O que mudou desde ' + fmtData(lv2Desde().slice(0, 10)) + ': ' + nome + '\n\n' + exLinha('Sistema', EX_SISTEMA) + exLinha('Onde', exCaminho(UI.sel)) + exLinha('Frente', LV2.mudouFrente ? (byId('ws', LV2.mudouFrente) || {}).nome : 'todas') + exLinha('Pessoa', LV2.mudouPessoa ? exPessoa(LV2.mudouPessoa) : 'todas') + exLinha('Mudanças', String(L.length)) + '\n' +
    '| Quando | Item | O quê | Mudança | Quem |\n|---|---|---|---|---|\n' + L.map(h => { const i = byId('issues', h.item_id); return '| ' + poDataHora(h.criado_em) + ' | ' + (i ? exNomeItem(i) : '').replace(/\|/g, '/') + ' | ' + lv2Categoria(h) + ' | ' + lv2HistTexto(h).replace(/\|/g, '/').replace(/\n/g, ' ') + ' | ' + (h.pessoa_id ? exPessoa(h.pessoa_id) || 'Alguém' : 'O sistema') + ' |'; }).join('\n') + '\n';
}
document.addEventListener('change', e => {
  const t = e.target; if (!t.matches || !t.matches('[data-lv2-mudou]')) return;
  const k = t.dataset.lv2Mudou;
  if (k === 'ref') LV2.mudouRef = t.value; else if (k === 'data'){ if (t.value) LV2.mudouRef = 'data:' + t.value; } else if (k === 'frente') LV2.mudouFrente = t.value; else if (k === 'pessoa') LV2.mudouPessoa = t.value;
  salvarUI(); rView();
});
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-lv2-mudou-baixar]')) exBaixar('O que mudou · ' + nomeDe(UI.sel), lv2MudouMd()); });

/* ---------- 1 e 14: exportação por frente agrupada pelo épico; o projeto inteiro e o épico com todas as frentes ---------- */
// todos os itens de um épico, de qualquer frente (filhos, netos...), na ordem da lista
const lv2DoEpico = e => D.issues.filter(i => !i.arquivado && i.id !== e.id && epicDe(i) && epicDe(i).id === e.id).sort((a, b) => (+a.ordem || 0) - (+b.ordem || 0));
function lv2ProvasMd(i, h){
  const L = poCrit(i).filter(c => c.prova || c.provaRes || c.f); if (!L.length) return '';
  return h + ' Provas dos critérios\n\n' + L.map(c => '- ' + c.t + ': ' + (lv2ProvaTexto(i, c) || (c.f ? '_marcado sem prova_' : '_sem prova_'))).join('\n') + '\n';
}
const _exCorpoItemLv2 = exCorpoItem;
exCorpoItem = function(i, nh){
  let o = _exCorpoItemLv2.apply(this, arguments); const h = '#'.repeat(nh);
  const p = lv2ProvasMd(i, h); if (p) o += '\n' + p;
  const w = lv2Ws(i); if (w && w.dod) o += '\n' + h + ' Definição de Pronto da frente ' + w.nome + '\n\n' + w.dod + '\n';
  if (i.revisar) o += '\n' + h + ' Para revisar\n\n' + (i.revisar.motivo || 'Uma decisão mudou') + (i.revisar.em ? ' (' + exData(i.revisar.em) + ')' : '') + '\n';
  if (i.decisao && i.decTexto) o += '\n' + h + ' Decisão registrada\n\n' + i.decTexto + '\n\n' + exLinha('Por', exPessoa(i.decPor)) + exLinha('Em', exData(i.decEm)) + exLinha('Itens afetados', lv2Afetados(i).map(exNomeItem).join('; '));
  return o;
};
// histórico de cada item no arquivo (lido do banco na hora de baixar)
function lv2HistMd(i, h){
  const L = (LV2.hist || []).filter(x => x.item_id === i.id).sort((a, b) => String(a.criado_em).localeCompare(String(b.criado_em)));
  return L.length ? h + ' Histórico\n\n' + L.map(x => '- ' + poDataHora(x.criado_em) + ' · ' + lv2HistTexto(x) + (x.pessoa_id ? ' · ' + (exPessoa(x.pessoa_id) || 'Alguém') : '')).join('\n') + '\n' : '';
}
function lv2ItemCompletoMd(i, nh){
  const h = '#'.repeat(nh), w = lv2Ws(i);
  return h + ' ' + exNomeItem(i) + '\n\n' + exLinha('Tipo', tipoNome(i.tipo)) + exLinha('Frente', w ? exCaminho('ws:' + w.id) : '') + exLinha('Situação', PO_SITU[poSituacao(i)] || exStatus(i)) +
    exLinha('Responsável', exPessoa(i.resp)) + exLinha('Prazo', exData(i.fim) + (i.autoOrigem && i.autoOrigem.prazo ? ' (automático: ' + i.autoOrigem.prazo + ')' : '')) + exLinha('Versão', (lv2Versao(i) || {}).nome) +
    (typeof poExLinhas === 'function' ? poExLinhas(i) : '') + '\n' + exCorpoItem(i, nh + 1) + lv2HistMd(i, h + '#');
}
function lv2EpicoMd(e){
  const its = lv2DoEpico(e), frs = [...new Set(its.map(i => i.ws))].map(id => byId('ws', id)).filter(Boolean);
  return exCabecalho('Épico', exNomeItem(e)) + exLinha('Sistema', EX_SISTEMA) + exLinha('Frente do épico', (lv2Ws(e) || {}).nome) + exLinha('Frentes dos itens', frs.map(w => w.nome).join(', ')) +
    exLinha('Itens', its.length + ' (' + its.filter(i => i.status === 'done').length + ' aceitos, ' + its.filter(lv2Ext).length + ' tarefas externas fora dos totais)') + exLinha('Versão', (D.marcos.find(m => m.id === e.marco) || {}).nome) + exLinha('Meta', e.meta || '') + '\n' +
    exCorpoItem(e, 2) + lv2HistMd(e, '##') + '\n## Itens do épico, de todas as frentes\n\n' + (its.length ? its.map(i => lv2ItemCompletoMd(i, 3)).join('\n') : '_Sem itens._\n');
}
function lv2ProjetoMd(pj){
  const chave = 'project:' + pj.id, its = issuesEm(chave).filter(i => !i.arquivado), eps = its.filter(i => i.tipo === 'epic').sort((a, b) => (+a.ordem || 0) - (+b.ordem || 0));
  const sem = its.filter(i => i.tipo !== 'epic' && !epicDe(i)).sort((a, b) => (+a.ordem || 0) - (+b.ordem || 0)), frs = D.ws.filter(w => { const a = byId('apps', w.app); return a && a.project === pj.id; });
  let md = exNoMd(chave).replace(/\n## Épicos\n[\s\S]*$/, '\n');
  md += '\n## Frentes\n\n' + frs.map(w => '- ' + exCaminho('ws:' + w.id) + ' · ' + issuesEm('ws:' + w.id).filter(i => !i.arquivado && i.tipo !== 'epic').length + ' itens' + (w.dod ? ' · Definição de Pronto própria:\n' + lv2Linhas(w.dod).map(l => '  - ' + l).join('\n') : '')).join('\n') + '\n';
  md += '\n## Épicos, com os itens de todas as frentes\n\n' + eps.map(e => '### ' + exNomeItem(e) + '\n\n' + exLinha('Frente do épico', (lv2Ws(e) || {}).nome) + exLinha('Situação', exStatus(e)) + exLinha('Versão', (D.marcos.find(m => m.id === e.marco) || {}).nome) + exLinha('Meta', e.meta || '') + '\n' +
    exCorpoItem(e, 4) + lv2HistMd(e, '####') + lv2DoEpico(e).map(i => lv2ItemCompletoMd(i, 4)).join('\n')).join('\n');
  if (sem.length) md += '\n## Itens sem épico\n\n' + sem.map(i => lv2ItemCompletoMd(i, 3)).join('\n');
  return md;
}
async function lv2Baixar(tipo, alvo){
  toast('Montando o arquivo com o histórico...');
  try { await lv2LerHistorico(true); } catch(e){ console.warn(e); }
  if (tipo === 'epico') exBaixar('Épico ' + alvo.titulo + ' (todas as frentes)', lv2EpicoMd(alvo));
  else exBaixar('Projeto ' + alvo.nome + ' (completo)', lv2ProjetoMd(alvo));
}
// as opções novas nos menus ⋯ (logo depois de "Baixar em .md")
const _tfAcoesItemLv2 = tfAcoesItem;
tfAcoesItem = function(i){ LV2.menu = {item:i}; try { return _tfAcoesItemLv2.apply(this, arguments); } finally { LV2.menu = null; } };
const _tfAcoesNoLv2 = tfAcoesNo;
tfAcoesNo = function(chave){ LV2.menu = {no:chave}; try { return _tfAcoesNoLv2.apply(this, arguments); } finally { LV2.menu = null; } };
const _tfMenuLv2 = tfMenu;
tfMenu = function(ancora, itens){
  const c = LV2.menu; if (c && Array.isArray(itens)){
    const k = itens.findIndex(x => x && x.txt === 'Baixar em .md');
    const novo = c.item && c.item.tipo === 'epic' ? {txt:'Baixar o épico completo', sub:'Os itens de todas as frentes, com critérios, provas e histórico', ico:TF_ICO.baixar, acao:() => lv2Baixar('epico', c.item)}
      : c.no && c.no.startsWith('project:') ? {txt:'Baixar o projeto inteiro', sub:'Todas as frentes, épicos, itens, critérios, provas e histórico', ico:TF_ICO.baixar, acao:() => lv2Baixar('projeto', byId('projects', c.no.slice(8)))} : null;
    if (novo && k >= 0) itens = itens.slice(0, k + 1).concat([novo], itens.slice(k + 1));
  }
  return _tfMenuLv2.call(this, ancora, itens);
};

/* ---------- as abas novas ---------- */
VIEWS.push(['mapa', 'Mapa de histórias', 'versões nas linhas e épicos nas colunas, com a pirâmide do backlog'], ['mudou', 'O que mudou', 'mudanças desde uma data, uma versão ou o último lote']);
if (typeof SM_ABAS !== 'undefined'){ SM_ABAS.mapa = ['Mapa de histórias', 'Versões nas linhas e épicos nas colunas, com as histórias em cada célula: o que cada versão entrega. Em cima, a pirâmide do backlog: quantos itens estão prontos para começar, quantos ainda pedem detalhe e quantos épicos faltam quebrar.'];
  SM_ABAS.mudou = ['O que mudou', 'Todas as mudanças de situação, critérios, prazos e responsáveis desde uma data, uma versão ou o último lote, filtráveis por frente e por pessoa, com exportação.']; }
if (typeof SM_DICA !== 'undefined'){ SM_DICA.mapa = 'versões × épicos e pirâmide do backlog'; SM_DICA.mudou = 'mudanças desde uma data, versão ou lote'; }
if (typeof EXPL_VIEW !== 'undefined'){ EXPL_VIEW.mapa = 'Mapa de histórias: versões nas linhas, épicos nas colunas, e a pirâmide do backlog.'; EXPL_VIEW.mudou = 'O que mudou desde uma data, uma versão ou o último lote.'; }
const lv2NoValido = sel => /^(project|product|app|ws):/.test(sel || '');
const _rViewLv2 = rView;
rView = function(){
  const c = $('#ops-corpo');
  if (c && (UI.view === 'mapa' || UI.view === 'mudou')){
    if (!lv2NoValido(UI.sel)){ UI.view = 'dashboard'; return _rViewLv2.apply(this, arguments); }
    c.innerHTML = UI.view === 'mapa' ? lv2TelaMapa() : lv2TelaMudou(); if (typeof smAgruparAbas === 'function') smAgruparAbas(); return;
  }
  return _rViewLv2.apply(this, arguments);
};
const _rOperacoesLv2 = rOperacoes;
rOperacoes = function(){
  _rOperacoesLv2.apply(this, arguments);
  if (!lv2NoValido(UI.sel)) ['mapa', 'mudou'].forEach(v => { const b = $('.view-b[data-view="' + v + '"]'); if (b) (b.closest('.view-casa') || b).remove(); if (UI.view === v){ UI.view = 'dashboard'; rView(); } });
};

if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {novoIssue:(...a) => novoIssue(...a), salvar:() => salvar(), novoUuid:() => novoUuid(), byId:(t, id) => byId(t, id), ltNovo:(...a) => ltNovo(...a), ltAplicar:(...a) => ltAplicar(...a), mudarStatus:(...a) => mudarStatus(...a), lv2SemProva, lv2LerHistorico, fecharItem:() => fecharItem(), pgSilenciarL2:k => pgSilenciar(k), abrirItem:id => abrirItem(id), exNoMd:c => exNoMd(c), lv2Repetidas, lv2Mudancas, lv2EpicoMd, lv2ProjetoMd, lv2Piramide, lv2MapaHTML, lv2ConferirDecisoes, lv2Afetados, ltLer, lePreviaHTML, LV2, poAndamentoVersao, pgAcoes, lv2EditarDodFrente, epicDe});
