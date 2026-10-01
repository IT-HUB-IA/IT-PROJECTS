/* ===== Item completo pelo método do Product Owner (P.O.) =====
   Cada item ganha: história (Como [quem], quero [o quê], para [por quê]), critérios de aceite com caixa de marcar,
   desenho (computador e celular), prioridade (classe MoSCoW + nível de 1 a 5), valor de negócio, estimativa em pontos
   (1, 2, 3, 5, 8, 13, 20), tipo (Item, Bug, Melhoria) e o ciclo de vida com histórico.
   O épico ganha a meta; a versão ganha a meta e o andamento; o projeto ganha o P.O. e a Definição de Pronto.
   Banco: parte 38. As regras (critério desmarcado, só o P.O. aceita, item aceito não muda) valem no banco também. */

/* ---------- vocabulário ---------- */
// o ciclo de vida do item usa os mesmos 6 lugares de sempre (o id no banco não muda): só os nomes seguem o método
[['backlog','Criado','escrito, ainda sem ordem de prioridade'],['todo','Priorizado','na ordem da fila, pronto para começar'],['doing','Em andamento','alguém está fazendo'],
 ['review','Pronto para testar','feito, esperando o P.O. testar'],['blocked','Travado','parado, esperando algo'],['done','Aceito','testado e aceito pelo P.O.']]
  .forEach(([id, nome, expl]) => { const s = STATUS.find(x => x.id === id); if (s){ s.nome = nome; s.expl = expl; } });
Object.assign(GRUPO_NOME, {backlog:'Criado', todo:'Priorizado', doing:'Em andamento', review:'Pronto para testar', blocked:'Travado', done:'Aceito'});
const PO_SITU = {backlog:'Criado', todo:'Priorizado', doing:'Em andamento', review:'Pronto para testar', blocked:'Travado', done:'Aceito', voltou:'Voltou'};
const PO_MOSCOW = [['deve','Deve','sem isso a entrega não vale'],['deveria','Deveria','importante, mas dá para entregar sem'],['poderia','Poderia','bom ter, se sobrar tempo'],['nao_tera','Não terá agora','combinado que fica para depois']];
const PO_NIVEIS = [[1,'1 · Emergência','só para emergência: largar tudo'],[2,'2 · Mais urgente','o mais urgente do dia a dia'],[3,'3 · Normal','no ritmo normal'],[4,'4 · Pode esperar','entra depois dos outros'],[5,'5 · Ideia','ideia ainda sem detalhe']];
const PO_PONTOS = [1, 2, 3, 5, 8, 13, 20];
const PO_TIPOS = [['item','Item','algo novo que a pessoa vai ver ou usar'],['bug','Bug','um critério de aceite que não foi cumprido'],['melhoria','Melhoria','mudança depois de pronto (sempre um item novo)']];
const PO_PRIO_DE_NIVEL = {1:'highest', 2:'high', 3:'medium', 4:'low', 5:'low'};
const PO_NIVEL_DE_PRIO = {highest:1, high:2, medium:3, low:4, lowest:5};
const poMoscowNome = v => (PO_MOSCOW.find(m => m[0] === v) || [, ''])[1];
const poNivel = i => i.nivel != null ? +i.nivel : (PO_NIVEL_DE_PRIO[i.prio] || 3);
const poTemPO = i => i && !['epic','subtask'].includes(i.tipo);   // os campos do método valem para história, tarefa e bug
const poTipo = i => i.tipo === 'bug' ? 'bug' : i.melhoria ? 'melhoria' : 'item';
const poCrit = i => (i.crit || []);
const poCritConta = i => { const c = poCrit(i); return {f:c.filter(x => x.f).length, n:c.length}; };
const poGrupo = s => { const st = STATUS.find(x => x.id === s); if (st) return s; const c = (D.statusCustom || []).find(x => x.id === s); return c ? c.grupo : s; };
const poVoltou = i => !!i.voltou && ['backlog','todo','doing'].includes(i.status);
const poSituacao = i => poVoltou(i) ? 'voltou' : i.status;
const poProjeto = i => { const ws = i && byId('ws', i.ws); const a = ws && byId('apps', ws.app); return a ? byId('projects', a.project) : null; };
const poDoPO = i => { const pj = poProjeto(i); const p = pj && pj.po && pessoa(pj.po); return p && p.ativo !== false ? p : null; };
const poSouPO = i => { const p = poDoPO(i); return !p || p.id === eu(); };
const poAceito = i => i.status === 'done';
const poHistoria = i => (i.hQuem || i.hQuero || i.hPara) ? 'Como ' + (i.hQuem || '...') + ', quero ' + (i.hQuero || '...') + ', para ' + (i.hPara || '...') + '.' : '';
const poCh = x => { const c = typeof chaveDe === 'function' ? chaveDe(x) : ''; return c ? c + ' · ' : ''; };
const poDataHora = v => { if (!v) return ''; const d = new Date(v); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'}) + ' ' + d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}); };

/* ---------- banco: leitura e gravação dos campos novos ---------- */
GRAVAR.splice(GRAVAR.findIndex(g => g[0] === 'itens_checklist') + 1, 0, ['itens_criterios', ['id']]);
TABELAS_BANCO.push('itens_criterios');
const _montarDadosPo = montarDados;
montarDados = function(T, eu){
  const d = _montarDadosPo(T, eu);
  const rI = new Map((T.itens || []).map(r => [r.id, r]));
  const crit = new Map(); (T.itens_criterios || []).slice().sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).forEach(c => { if (!crit.has(c.item_id)) crit.set(c.item_id, []); crit.get(c.item_id).push({t:c.texto, f:!!c.feito, por:c.marcado_por || null, em:c.marcado_em || null, _id:c.id}); });
  d.issues.forEach(i => { const r = rI.get(i.id) || {};
    i.hQuem = r.historia_quem || ''; i.hQuero = r.historia_quero || ''; i.hPara = r.historia_para || '';
    i.moscow = r.moscow || null; i.nivel = r.nivel == null ? null : +r.nivel; i.valor = r.valor == null ? null : +r.valor; i.valorMotivo = r.valor_motivo || '';
    i.melhoria = !!r.melhoria; i.origem = r.origem_id || null; i.voltou = r.voltou_em || null; i.voltouMotivo = r.voltou_motivo || ''; i.meta = r.meta || '';
    i.crit = crit.get(i.id) || []; });
  const rP = new Map((T.projetos || []).map(r => [r.no_id, r]));
  d.projects.forEach(p => { const r = rP.get(p.id) || {}; p.dod = r.definicao_pronto || ''; p.po = r.po_id || null; });
  const rM = new Map((T.marcos || []).map(r => [r.id, r]));
  d.marcos.forEach(m => { const r = rM.get(m.id) || {}; m.meta = r.meta || ''; });
  const papel = new Map((T.anexos || []).filter(a => a.papel).map(a => [a.id, a.papel]));
  d.issues.forEach(i => (i.refs || []).forEach(x => { const pp = x._id && papel.get(x._id); if (pp) x.papel = pp; }));
  return d;
};
const _linhasDaTelaPo = linhasDaTela;
linhasDaTela = function(d){
  const L = _linhasDaTelaPo(d);
  L.itens_criterios = L.itens_criterios || [];
  const porId = new Map(d.issues.map(i => [i.id, i])), temItem = new Set((L.itens || []).map(r => r.id));
  (L.itens || []).forEach(r => { const i = porId.get(r.id); if (!i) return;
    // nível e prioridade antiga andam juntos: quem mudou a prioridade antiga (Tabela, automação) muda o nível
    let n = i.nivel == null ? null : +i.nivel;
    if (n == null || PO_PRIO_DE_NIVEL[n] !== (i.prio || 'medium')) n = PO_NIVEL_DE_PRIO[i.prio || 'medium'] || 3;
    i.nivel = n; r.nivel = n; r.prioridade = PO_PRIO_DE_NIVEL[n];
    if (!PO_PONTOS.includes(+i.pontos) && +i.pontos !== 21) r.pontos = null; else r.pontos = +i.pontos;
    const txt = (v, max) => { const s = String(v || '').trim(); return s ? s.slice(0, max) : null; };
    r.historia_quem = txt(i.hQuem, 300); r.historia_quero = txt(i.hQuero, 500); r.historia_para = txt(i.hPara, 500);
    r.moscow = PO_MOSCOW.some(m => m[0] === i.moscow) ? i.moscow : null;
    r.valor = +i.valor >= 1 && +i.valor <= 10 ? Math.round(+i.valor) : null; r.valor_motivo = txt(i.valorMotivo, 300);
    r.melhoria = !!i.melhoria && i.tipo !== 'bug'; r.origem_id = i.origem && temItem.has(i.origem) && i.origem !== i.id ? i.origem : null;
    r.voltou_em = i.voltou || null; r.voltou_motivo = i.voltou ? txt(i.voltouMotivo, 1000) : null; r.meta = txt(i.meta, 1000);
    poCrit(i).forEach((c, k) => { if (String(c.t || '').trim()) L.itens_criterios.push({id:garantirId(c), item_id:i.id, texto:String(c.t).trim().slice(0, 500), feito:!!c.f, ordem:k}); });
  });
  const pp = new Map(d.projects.map(p => [p.id, p])), temPessoa = new Set(d.people.map(p => p.id));
  (L.projetos || []).forEach(r => { const p = pp.get(r.no_id); if (!p) return; r.definicao_pronto = String(p.dod || '').trim().slice(0, 3000) || null; r.po_id = p.po && temPessoa.has(p.po) ? p.po : null; });
  const mm = new Map(d.marcos.map(m => [m.id, m]));
  (L.marcos || []).forEach(r => { const m = mm.get(r.id); r.meta = m && String(m.meta || '').trim() ? String(m.meta).trim().slice(0, 1000) : null; });
  const papel = new Map(); d.issues.forEach(i => (i.refs || []).forEach(x => { if (x._id && x.papel) papel.set(x._id, x.papel); }));
  (L.anexos || []).forEach(r => { if (r.item_id) r.papel = papel.get(r.id) || null; });
  return L;
};

/* ---------- o histórico (vem do banco, que grava quem e quando) ---------- */
const POH = {itens:{}, pedindo:{}};
async function poHistCarregar(id){
  const sb = window.ciclodevBanco; if (!sb || POH.pedindo[id]) return;
  POH.pedindo[id] = true;
  try {
    const {data, error} = await sb.from('itens_historico').select('*').eq('item_id', id).order('criado_em', {ascending:true}).limit(300);
    if (!error && Array.isArray(data)) POH.itens[id] = data.map(h => ({tipo:h.tipo, de:h.de, para:h.para, texto:h.texto, quem:h.pessoa_id, em:h.criado_em}));
  } catch(e){ console.warn('Histórico', e); }
  finally { POH.pedindo[id] = false; }
  if (itemAberto === id) poHistDesenhar(id);
}
// mudança feita agora: aparece na hora e o banco confirma logo depois
function poHistLocal(i, h){
  POH.itens[i.id] = (POH.itens[i.id] || []).concat([Object.assign({quem:eu(), em:new Date().toISOString(), _local:true}, h)]);
  if (window.ciclodevBanco) setTimeout(() => poHistCarregar(i.id), 2500);
}
function poHistTexto(h){
  if (h.tipo === 'criterio'){
    const t = '"' + (h.para || h.de || '') + '"';
    return h.texto === 'marcou' ? 'Marcou o critério ' + t : h.texto === 'desmarcou' ? 'Desmarcou o critério ' + t : h.texto === 'tirou' ? 'Tirou o critério ' + t
      : h.texto === 'mudou o texto' ? 'Mudou o critério "' + (h.de || '') + '" para "' + (h.para || '') + '"' : 'Criou o critério ' + t + (h.texto === 'criou marcado' ? ', já marcado' : '');
  }
  if (!h.de && h.texto === 'Criado') return 'Criou o item, em ' + (PO_SITU[h.para] || h.para);
  if (h.para === 'voltou') return 'Devolveu: ' + (PO_SITU[h.de] || h.de || '?') + ' → Voltou' + (h.texto ? '. Motivo: ' + h.texto : '');
  return (PO_SITU[h.de] || h.de || '?') + ' → ' + (PO_SITU[h.para] || h.para) + (h.texto ? ' (' + h.texto + ')' : '');
}
function poHistDesenhar(id){
  const box = $('#gaveta-wrap .po-hist-lista'); if (!box) return;
  const L = (POH.itens[id] || []).slice().reverse();
  box.innerHTML = L.length ? L.map(h => { const p = h.quem && pessoa(h.quem);
    return '<li class="po-hist-lin"><span class="po-hist-quando">' + esc(poDataHora(h.em)) + '</span><span class="po-hist-txt">' + esc(poHistTexto(h)) + '</span><span class="po-hist-quem">' + esc(p ? p.nome : h.quem ? 'Alguém' : 'O sistema') + '</span></li>'; }).join('')
    : '<li class="po-vazio">' + (window.ciclodevBanco ? 'Carregando o histórico...' : 'As mudanças de situação e de critério aparecem aqui.') + '</li>';
}

/* ---------- regras ao mudar a situação (a tela avisa antes; o banco garante) ---------- */
function poPodeAceitar(i, avisar){
  if (!poTemPO(i)) return true;
  const c = poCritConta(i);
  if (c.f < c.n){ if (avisar) toast('Faltam ' + (c.n - c.f) + (c.n - c.f === 1 ? ' critério de aceite' : ' critérios de aceite') + ' para marcar em "' + i.titulo + '". Só vai para Aceito com todos marcados.'); return false; }
  const po = poDoPO(i);
  if (po && po.id !== eu()){ if (avisar) toast('Só o P.O. do projeto (' + po.nome + ') aceita um item. Leve para Pronto para testar.'); return false; }
  return true;
}
const _mudarStatusPo = mudarStatus;
mudarStatus = function(i, s){
  const g = poGrupo(s);
  if (g === 'done' && i.status !== 'done' && !poPodeAceitar(i, true)) return;
  const antes = poSituacao(i);
  if (g === 'review' || g === 'done') i.voltou = null;
  const r = _mudarStatusPo.apply(this, arguments);
  if (poSituacao(i) !== antes) poHistLocal(i, {tipo:'situacao', de:antes, para:poSituacao(i)});
  return r;
};
// o selo da situação mostra "Voltou" quando o P.O. devolveu
const _statusItemHTMLPo = statusItemHTML;
statusItemHTML = function(i){ return poVoltou(i) ? '<span class="st st-voltou" title="O P.O. devolveu' + (i.voltouMotivo ? ': ' + esc(i.voltouMotivo) : '') + '">' + ICO_ST.todo + 'Voltou</span>' : _statusItemHTMLPo.apply(this, arguments); };

/* ---------- a janela do item ---------- */
const poSel = (campo, opcoes, atual, dis, vazio) => '<select class="sel d-sel" data-po="' + campo + '"' + dis + '>' + (vazio ? '<option value="">' + esc(vazio) + '</option>' : '') +
  opcoes.map(([v, n, t]) => '<option value="' + esc(v) + '"' + (String(atual == null ? '' : atual) === String(v) ? ' selected' : '') + (t ? ' title="' + esc(t) + '"' : '') + '>' + esc(n) + '</option>').join('') + '</select>';
const poLin = (rot, ctrl, tit) => '<div class="d-lin jn-lin"><span class="d-rot"' + (tit ? ' title="' + esc(tit) + '"' : '') + '>' + esc(rot) + '</span><span class="d-val">' + ctrl + '</span></div>';
function poPosicao(i){
  const fila = poFila(i); const k = fila.indexOf(i); return k < 0 ? null : k + 1;
}
// a fila do P.O.: os itens da mesma aplicação que ainda não foram aceitos, na ordem combinada
function poFila(i){
  const ws = byId('ws', i.ws); const app = ws && ws.app;
  return D.issues.filter(x => !x.arquivado && poTemPO(x) && x.status !== 'done' && (byId('ws', x.ws) || {}).app === app).sort((a, b) => (+a.ordem || 0) - (+b.ordem || 0));
}
function poCartaoHTML(i, pode){
  const dis = pode ? '' : ' disabled';
  if (i.tipo === 'epic') return '<section class="g-cartao po-cartao"><h4>Produto</h4>' +
    '<label class="po-campo"><span>Meta da entrega</span><textarea class="campo" rows="3" data-po="meta" maxlength="1000" placeholder="O que esta entrega resolve e como saber que deu certo"' + dis + '>' + esc(i.meta || '') + '</textarea></label></section>';
  if (!poTemPO(i)) return '';
  const tipo = poTipo(i), pos = poPosicao(i);
  const origens = D.issues.filter(x => x.id !== i.id && !x.arquivado && poTemPO(x) && (byId('ws', x.ws) || {}).app === (byId('ws', i.ws) || {}).app);
  const org = i.origem && byId('issues', i.origem);
  return '<section class="g-cartao po-cartao"><h4>Produto</h4>' +
    poLin('Tipo', poSel('tipo', PO_TIPOS, tipo, dis), PO_TIPOS.map(t => t[1] + ': ' + t[2]).join('. ')) +
    (tipo !== 'item' ? poLin(tipo === 'bug' ? 'Item de origem' : 'Veio de', poSel('origem', origens.map(x => [x.id, poCh(x) + x.titulo]), i.origem || '', dis, tipo === 'bug' ? 'Escolha o item' : 'Nenhum'),
      tipo === 'bug' ? 'O item cujo critério de aceite não foi cumprido' : 'O item que deu origem a esta melhoria') : '') +
    (org ? '<div class="po-origem"><button type="button" class="po-link" data-abrir-item="' + org.id + '">' + esc(poCh(org) + org.titulo) + '</button></div>' : '') +
    poLin('Prioridade', poSel('moscow', PO_MOSCOW, i.moscow, dis, 'Sem classe'), PO_MOSCOW.map(m => m[1] + ': ' + m[2]).join('. ')) +
    poLin('Nível', poSel('nivel', PO_NIVEIS, poNivel(i), dis), PO_NIVEIS.map(n => n[1] + ': ' + n[2]).join('. ')) +
    poLin('Valor', poSel('valor', [1,2,3,4,5,6,7,8,9,10].map(n => [n, n + (n === 10 ? ' (máximo)' : n === 1 ? ' (mínimo)' : '')]), i.valor, dis, 'Sem valor'), 'Valor de negócio de 1 a 10: ordena a fila. No empate, sobe quem tem mais valor por ponto') +
    '<label class="po-campo"><span>Por que importa</span><input class="campo" data-po="valorMotivo" maxlength="300" placeholder="Ex.: reduz as ligações ao suporte" value="' + esc(i.valorMotivo || '') + '"' + dis + '></label>' +
    poLin('Estimativa', poSel('pontos', PO_PONTOS.concat(+i.pontos === 21 ? [21] : []).map(n => [n, n + (n === 1 ? ' ponto' : ' pontos')]), i.pontos, dis, 'Sem pontos'), 'Pontos na sequência 1, 2, 3, 5, 8, 13, 20') +
    (pos ? poLin('Posição na fila', '<input class="campo d-sel po-num" type="number" min="1" data-po="posicao" value="' + pos + '"' + dis + '><span class="po-de">de ' + poFila(i).length + '</span>', 'A ordem da fila, que o P.O. combina') : '') +
  '</section>';
}
function poSituacaoHTML(i, pode){
  if (!poTemPO(i)) return '';
  const po = poDoPO(i), souPO = poSouPO(i), c = poCritConta(i);
  let acoes = '';
  if (pode && i.status === 'review') acoes = souPO
    ? '<div class="po-acoes"><button type="button" class="btn peq" data-po-acao="aceitar"' + (c.f < c.n ? ' disabled title="Marque todos os critérios de aceite antes"' : '') + '>Aceitar</button><button type="button" class="btn sec peq" data-po-acao="devolver">Devolver</button></div>'
    : '<p class="po-nota">Esperando o P.O. (' + esc(po.nome) + ') testar e aceitar.</p>';
  else if (pode && i.status === 'done') acoes = '<div class="po-acoes"><button type="button" class="btn sec peq" data-po-acao="melhoria">Criar melhoria</button><button type="button" class="btn sec peq" data-po-acao="bug">Abrir bug</button></div>';
  return '<div class="po-situ">' +
    '<div class="po-situ-lin">' + (poVoltou(i) ? '<span class="po-situ-nome po-s-voltou">Voltou</span>' : '') +
    '<span class="po-situ-po">P.O.: ' + (po ? '<b>' + esc(po.nome) + '</b>' : 'ninguém definido') + (pode ? ' <button type="button" class="po-link" data-po-acao="definir-po">' + (po ? 'trocar' : 'definir') + '</button>' : '') + '</span></div>' +
    (poVoltou(i) && i.voltouMotivo ? '<p class="po-voltou">Voltou: ' + esc(i.voltouMotivo) + '</p>' : '') + acoes + '</div>';
}
function poHistoriaHTML(i, pode){
  const trava = poAceito(i), dis = pode && !trava ? '' : ' disabled';
  const frase = poHistoria(i);
  return '<section class="g-sec jn-sec po-sec" data-po-sec="historia"><h4><span class="jn-sec-tit">História</span></h4><p class="jn-sec-ajuda">Quem usa, o que quer e por quê, numa frase curta</p>' +
    '<p class="po-frase' + (frase ? '' : ' po-frase-vazia') + '">' + (frase ? esc(frase) : 'Como [quem], quero [o quê], para [por quê].') + '</p>' +
    '<div class="po-hist-campos">' +
      '<label class="po-campo"><span>Como</span><input class="campo" data-po="hQuem" maxlength="300" placeholder="quem usa (ex.: lojista)" value="' + esc(i.hQuem || '') + '"' + dis + '></label>' +
      '<label class="po-campo"><span>quero</span><input class="campo" data-po="hQuero" maxlength="500" placeholder="o que a pessoa quer fazer" value="' + esc(i.hQuero || '') + '"' + dis + '></label>' +
      '<label class="po-campo"><span>para</span><input class="campo" data-po="hPara" maxlength="500" placeholder="por que isso importa" value="' + esc(i.hPara || '') + '"' + dis + '></label>' +
    '</div>' + (trava ? '<p class="po-nota">Item aceito: a história não muda mais. Para mudar, use Criar melhoria.</p>' : '') + '</section>';
}
function poCriteriosHTML(i, pode){
  const trava = poAceito(i), ed = pode && !trava, c = poCritConta(i), L = poCrit(i);
  const pj = poProjeto(i);
  const quem = x => { const p = x.por && pessoa(x.por); return x.f ? 'marcado' + (p ? ' por ' + p.nome : '') + (x.em ? ' em ' + poDataHora(x.em) : '') : ''; };
  return '<section class="g-sec jn-sec po-sec" data-po-sec="criterios"><h4><span class="jn-sec-tit">Critérios de aceite</span>' + (c.n ? '<span class="g-cont">' + c.f + ' de ' + c.n + '</span>' : '') + '</h4>' +
    '<p class="jn-sec-ajuda">O que precisa estar certo para o P.O. aceitar. Só vai para Aceito com todos marcados</p>' +
    '<div class="jn-caixa po-crit-caixa">' + (c.n ? '<div class="progresso"><i style="width:' + (c.f / c.n * 100) + '%"></i></div>' : '') +
    (L.length ? '<ol class="po-crit">' + L.map((x, k) => '<li class="po-crit-lin' + (x.f ? ' feito' : '') + '">' +
        '<label class="po-crit-ck"><input type="checkbox" data-po-crit="' + k + '"' + (x.f ? ' checked' : '') + (ed ? '' : ' disabled') + '><span class="po-crit-txt">' + esc(x.t) + (x.f ? '<small class="po-crit-quem">' + esc(quem(x)) + '</small>' : '') + '</span></label>' +
        (ed ? '<span class="po-crit-mover"><button type="button" class="ico-btn" data-po-crit-mover="' + k + '|-1" aria-label="Subir"' + (k === 0 ? ' disabled' : '') + '>↑</button><button type="button" class="ico-btn" data-po-crit-mover="' + k + '|1" aria-label="Descer"' + (k === L.length - 1 ? ' disabled' : '') + '>↓</button><button type="button" class="ico-btn" data-po-crit-tirar="' + k + '" aria-label="Tirar o critério">' + ICO.fechar + '</button></span>' : '') +
      '</li>').join('') + '</ol>' : '<p class="jn-vazio">Nenhum critério ainda.</p>') +
    (ed ? '<form class="g-add jn-add-linha" data-po-form="crit"><input class="campo" name="t" maxlength="500" placeholder="+ Escreva um critério de aceite e aperte Enter"><button class="btn sec peq" type="submit">Adicionar</button></form>' : '') + '</div>' +
    (trava ? '<p class="po-nota">Item aceito: os critérios não mudam mais. Para mudar, use Criar melhoria.</p>' : '') +
    '<div class="po-dod"><b>Definição de Pronto' + (pj ? ' de ' + esc(pj.nome) : '') + '</b>' + (pj && pj.dod ? '<p>' + esc(pj.dod).replace(/\n/g, '<br>') + '</p>' : '<p class="po-frase-vazia">Ainda não escrita para este projeto.</p>') +
      (pode && pj ? '<button type="button" class="po-link" data-po-acao="dod">' + (pj.dod ? 'Editar' : 'Escrever') + '</button>' : '') + '</div></section>';
}
function poDesenhoHTML(i, pode){
  const slot = (papel, nome) => { const x = (i.refs || []).find(r => r.papel === papel); const url = x && (x.url || x._ver);
    return '<div class="po-des-slot"><span class="po-des-nome">' + nome + '</span>' +
      (x ? (url ? '<button type="button" class="po-des-img" data-po-des-ver="' + papel + '" aria-label="Ampliar o desenho de ' + nome.toLowerCase() + '"><img src="' + esc(url) + '" alt="Desenho de ' + esc(nome.toLowerCase()) + '"></button>' : '<span class="po-des-vazio">' + esc(x.nome) + '<small>carregando...</small></span>') +
        (pode ? '<span class="po-des-acoes"><label class="po-link">Trocar<input type="file" accept="image/*" data-po-des="' + papel + '" hidden></label><button type="button" class="po-link" data-po-des-tirar="' + papel + '">Tirar</button></span>' : '')
      : (pode ? '<label class="po-des-vazio po-des-add"><input type="file" accept="image/*" data-po-des="' + papel + '" hidden><b>' + ICO.mais + 'Anexar imagem</b><small>PNG ou JPG</small></label>' : '<span class="po-des-vazio">Sem desenho</span>')) + '</div>'; };
  return '<section class="g-sec jn-sec po-sec" data-po-sec="desenho"><h4><span class="jn-sec-tit">Desenho da tela</span></h4><p class="jn-sec-ajuda">Como a tela deve ficar, no computador e no celular</p>' +
    '<div class="po-des">' + slot('desenho_computador', 'Computador') + slot('desenho_celular', 'Celular') + '</div></section>';
}
const poHistSecHTML = () => '<section class="g-sec jn-sec po-sec" data-po-sec="historico"><h4><span class="jn-sec-tit">Histórico de mudanças</span></h4><p class="jn-sec-ajuda">Cada mudança de situação e de critério, com quem fez e quando. Nada é apagado</p><ul class="po-hist-lista"></ul></section>';

const _abrirItemPo = abrirItem;
abrirItem = function(id){
  const r = _abrirItemPo.apply(this, arguments);
  try { poGaveta(byId('issues', id)); } catch(e){ console.warn('P.O.', e); }
  return r;
};
function poGaveta(i){
  const g = $('#gaveta-wrap .gaveta'); if (!g || !i || g.dataset.po) return; g.dataset.po = '1';
  const pri = $('.g-principal', g), lat = $('.g-lateral', g); if (!pri || !lat) return;
  const pode = podeEditar();
  const principal = $(':scope > .g-cartao', lat);
  // cartão Produto logo depois do Principal; a situação com o P.O. e os botões Aceitar e Devolver dentro do Principal
  if (principal){
    principal.insertAdjacentHTML('afterend', poCartaoHTML(i, pode));
    const linSt = $('[data-g="status"]', principal); const lin = linSt && linSt.closest('.d-lin');
    if (lin && poTemPO(i)) lin.insertAdjacentHTML('afterend', poSituacaoHTML(i, pode));
    // a prioridade antiga vira Prioridade e Nível no cartão Produto (os dois andam juntos)
    if (poTemPO(i)){ const pr = $('[data-g="prio"]', principal); if (pr) pr.closest('.d-lin').remove(); const rs = lin && $('.d-rot', lin); if (rs) rs.textContent = 'Situação'; }
    const he = $('[data-g="est"]', lat); const rh = he && he.closest('.d-lin') && $('.d-rot', he.closest('.d-lin')); if (rh && poTemPO(i)) rh.textContent = 'Horas estimadas';
  }
  // os pontos ficam só no cartão Produto (na sequência nova)
  if (poTemPO(i)) $$('[data-bj-campo="pontos"]', lat).forEach(s => { const l = s.closest('.d-lin'); if (l) l.remove(); });
  // corpo: história, critérios e desenho logo depois da descrição; o histórico antes dos comentários
  const desc = $$(':scope > .g-sec', pri).find(s => s.dataset.smSec === 'Descrição') || $(':scope > .g-sec', pri);
  if (poTemPO(i) && desc){
    const dc = desc.nextElementSibling && desc.nextElementSibling.classList.contains('dc-sec') ? desc.nextElementSibling : desc;
    dc.insertAdjacentHTML('afterend', poHistoriaHTML(i, pode) + poCriteriosHTML(i, pode) + poDesenhoHTML(i, pode));
    const com = $$(':scope > .g-sec', pri).find(s => s.dataset.smSec === 'Comments');
    if (com) com.insertAdjacentHTML('beforebegin', poHistSecHTML()); else pri.insertAdjacentHTML('beforeend', poHistSecHTML());
    poHistDesenhar(i.id);
    if (window.ciclodevBanco && !POH.itens[i.id]) poHistCarregar(i.id);
    // os desenhos não se repetem na lista de anexos
    (i.refs || []).forEach((x, k) => { if (!x.papel) return; const b = $('[data-tirar-ref="issue:' + i.id + '|' + k + '"]', pri); const el = b && b.closest('.ref'); if (el) el.hidden = true; });
  }
}
// reabrir a janela sem perder o lugar da rolagem
function poReabrir(i){
  const g = $('#gaveta-wrap .gaveta'); const rolos = g ? $$('*', g).filter(x => x.scrollTop > 0).map(x => [x.className, x.scrollTop]).concat(g.scrollTop ? [['__g', g.scrollTop]] : []) : [];
  abrirItem(i.id);
  const g2 = $('#gaveta-wrap .gaveta'); if (!g2) return;
  rolos.forEach(([c, t]) => { if (c === '__g') g2.scrollTop = t; else { const el = $$('*', g2).find(x => x.className === c); if (el) el.scrollTop = t; } });
}

/* ---------- mudanças na janela ---------- */
function poMudarTipo(i, novo){
  if (novo === poTipo(i)) return true;
  if (novo === 'bug'){
    if (D.issues.some(x => x.pai === i.id && !x.arquivado && x.tipo !== 'subtask')){ toast('Este item tem subitens que não são subtarefas: não dá para virar Bug.'); return false; }
    const pai = i.pai && byId('issues', i.pai);
    if (pai && !['epic','story'].includes(pai.tipo)){ toast('Um Bug fica dentro de um épico ou de uma história.'); return false; }
    i.tipo = 'bug'; i.melhoria = false;
  } else {
    if (i.tipo === 'bug'){ const pai = i.pai && byId('issues', i.pai); i.tipo = pai && pai.tipo === 'story' ? 'task' : 'story'; }
    i.melhoria = novo === 'melhoria';
  }
  return true;
}
function poPorPosicao(i, pos){
  const fila = poFila(i).filter(x => x !== i); const k = Math.max(0, Math.min(fila.length, Math.round(+pos) - 1));
  fila.splice(k, 0, i); fila.forEach((x, n) => { x.ordem = n + 1; });
}
document.addEventListener('change', e => {
  const t = e.target; if (!t || !t.matches) return;
  const i = itemAberto && byId('issues', itemAberto); if (!i) return;
  if (t.matches('[data-po]')){
    const c = t.dataset.po, v = t.value;
    if (c === 'tipo'){ if (!poMudarTipo(i, v)){ poReabrir(i); return; } if (v === 'bug' && !i.origem) toast('Escolha o item de origem: o Bug é um critério de aceite que não foi cumprido nele.'); }
    else if (c === 'nivel'){ i.nivel = +v || 3; i.prio = PO_PRIO_DE_NIVEL[i.nivel]; }
    else if (c === 'valor' || c === 'pontos') i[c] = v ? +v : null;
    else if (c === 'moscow' || c === 'origem') i[c] = v || null;
    else if (c === 'posicao'){ poPorPosicao(i, v); }
    else if (['hQuem','hQuero','hPara','valorMotivo','meta'].includes(c)){
      if (poAceito(i) && c.startsWith('h')){ toast('Item aceito: a história não muda mais. Use Criar melhoria.'); poReabrir(i); return; }
      i[c] = String(v || '').trim();
    }
    salvar(); poReabrir(i); if (typeof rView === 'function' && c !== 'meta' && !c.startsWith('h') && c !== 'valorMotivo') rView();
    return;
  }
  if (t.matches('[data-po-crit]')){
    const x = poCrit(i)[+t.dataset.poCrit]; if (!x) return;
    if (poAceito(i)){ toast('Item aceito: os critérios não mudam mais.'); poReabrir(i); return; }
    x.f = t.checked; x.por = t.checked ? eu() : null; x.em = new Date().toISOString();
    poHistLocal(i, {tipo:'criterio', para:x.t, texto:x.f ? 'marcou' : 'desmarcou'});
    salvar(); poReabrir(i); rView(); return;
  }
  if (t.matches('[data-po-des]') && t.files && t.files[0]){
    const f = t.files[0]; if (!/^image\//.test(f.type)){ toast('Escolha uma imagem (PNG ou JPG).'); return; }
    lerArquivo(f).then(ref => {
      ref.papel = t.dataset.poDes; if (!ref.url) Object.defineProperty(ref, '_ver', {value:URL.createObjectURL(f), enumerable:false, writable:true});
      i.refs = (i.refs || []).filter(x => x.papel !== ref.papel).concat([ref]);
      registrar('editou', i, i.titulo + ': desenho de ' + (ref.papel === 'desenho_celular' ? 'celular' : 'computador'));
      salvar(); poReabrir(i); toast('Desenho guardado.');
    });
  }
});
document.addEventListener('submit', e => {
  const f = e.target; if (!f.matches || !f.matches('[data-po-form="crit"]')) return; e.preventDefault();
  const i = itemAberto && byId('issues', itemAberto); if (!i) return;
  const t = String(f.t.value || '').trim(); if (!t) return;
  if (poAceito(i)){ toast('Item aceito: os critérios não mudam mais. Use Criar melhoria.'); return; }
  i.crit = poCrit(i).concat([{t:t.slice(0, 500), f:false}]);
  poHistLocal(i, {tipo:'criterio', para:t, texto:'criou'});
  salvar(); poReabrir(i); rView();
  const ni = $('#gaveta-wrap [data-po-form="crit"] input'); if (ni) ni.focus();
});
document.addEventListener('click', e => {
  const t = e.target.closest ? e.target.closest('[data-po-crit-mover],[data-po-crit-tirar],[data-po-acao],[data-po-des-tirar],[data-po-des-ver]') : null; if (!t) return;
  const i = itemAberto && byId('issues', itemAberto); if (!i) return;
  if (t.dataset.poCritMover){ const [k, d] = t.dataset.poCritMover.split('|').map(Number); const L = poCrit(i).slice(); const j = k + d; if (j < 0 || j >= L.length) return; [L[k], L[j]] = [L[j], L[k]]; i.crit = L; salvar(); poReabrir(i); return; }
  if (t.dataset.poCritTirar != null){ const k = +t.dataset.poCritTirar; const x = poCrit(i)[k]; if (!x) return;
    tfComDesfazer('Critério tirado.', () => { i.crit = poCrit(i).filter((_, n) => n !== k); poHistLocal(i, {tipo:'criterio', de:x.t, texto:'tirou'}); }); poReabrir(i); return; }
  if (t.dataset.poDesTirar){ const papel = t.dataset.poDesTirar; tfComDesfazer('Desenho tirado.', () => { i.refs = (i.refs || []).filter(x => x.papel !== papel); }); poReabrir(i); return; }
  if (t.dataset.poDesVer){ const x = (i.refs || []).find(r => r.papel === t.dataset.poDesVer); const url = x && (x.url || x._ver); if (url) modal(t.dataset.poDesVer === 'desenho_celular' ? 'Desenho: celular' : 'Desenho: computador', '<img class="po-des-grande" src="' + esc(url) + '" alt="">', [{txt:'Fechar'}]); return; }
  const a = t.dataset.poAcao;
  if (a === 'aceitar'){ if (!poPodeAceitar(i, true)) return; mudarStatus(i, 'done'); salvar(); poReabrir(i); rView(); return; }
  if (a === 'devolver'){
    modal('Devolver "' + i.titulo + '"', '<label class="lb">O que não ficou certo<textarea class="campo" id="po-motivo" rows="4" maxlength="1000" placeholder="Ex.: o saldo não bate com o extrato"></textarea></label><p class="sec">O item volta para a equipe com a situação Voltou. Fica no histórico.</p>',
      [{txt:'Cancelar', cls:'sec'}, {txt:'Devolver', acao:d => { const m = $('#po-motivo', d).value.trim(); if (!m){ toast('Escreva o que não ficou certo'); return false; }
        const antes = poSituacao(i); i.voltou = new Date().toISOString(); i.voltouMotivo = m;
        _mudarStatusPo(i, 'todo'); poHistLocal(i, {tipo:'situacao', de:antes, para:'voltou', texto:m}); salvar(); poReabrir(i); rView(); }}]);
    return;
  }
  if (a === 'melhoria' || a === 'bug') return poNovoDeOrigem(i, a);
  if (a === 'dod'){ const pj = poProjeto(i); if (pj) poEditarDod(pj, () => poReabrir(i)); return; }
  if (a === 'definir-po'){ const pj = poProjeto(i); if (pj) poEditarPO(pj, () => poReabrir(i)); return; }
});
// melhoria ou bug a partir de um item aceito: sempre um item novo, ligado ao antigo
function poNovoDeOrigem(i, tipo){
  const crits = poCrit(i);
  modal(tipo === 'bug' ? 'Abrir bug de "' + i.titulo + '"' : 'Criar melhoria de "' + i.titulo + '"',
    '<label class="lb">Título<input class="campo" id="po-nt" maxlength="300" value="' + esc(tipo === 'bug' ? 'Bug: ' : 'Melhoria: ') + '"></label>' +
    (tipo === 'bug' && crits.length ? '<label class="lb">Qual critério de aceite não foi cumprido<select class="sel" id="po-nc">' + crits.map((c, k) => '<option value="' + k + '">' + esc(c.t) + '</option>').join('') + '</select></label>' : '') +
    '<p class="sec">' + (tipo === 'bug' ? 'O bug fica ligado a ' : 'A melhoria é um item novo, ligado a ') + esc(poCh(i) + i.titulo) + '. O item aceito não muda.</p>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Criar', acao:d => {
      const t = $('#po-nt', d).value.trim().replace(/^(Bug|Melhoria):\s*$/, ''); if (!t){ toast('Escreva o título'); return false; }
      const ep = i.tipo === 'epic' ? i : (i.pai && byId('issues', i.pai)); const paiOk = ep && ['epic','story'].includes(ep.tipo) ? ep.id : null;
      const ni = novoIssue({titulo:t, ws:i.ws, tipo:tipo === 'bug' ? 'bug' : (paiOk && byId('issues', paiOk).tipo === 'story' ? 'task' : (paiOk ? 'story' : 'task')), status:'backlog', pai:paiOk, prio:i.prio});
      ni.origem = i.id; ni.melhoria = tipo === 'melhoria'; ni.nivel = poNivel(i); ni.moscow = i.moscow || null; ni.marco = i.marco;
      const nc = $('#po-nc', d); if (tipo === 'bug' && nc){ const c = crits[+nc.value]; if (c) ni.crit = [{t:c.t, f:false}]; ni.desc = 'Critério de aceite não cumprido em ' + (chaveDe(i) || i.titulo) + ': ' + (c ? c.t : ''); }
      if (typeof garantirBoard === 'function') garantirBoard({issues:[ni], boards:D.boards, equipes:D.equipes});
      ni.ordem = Math.max(0, ...D.issues.map(x => +x.ordem || 0)) + 1;
      D.issues.push(ni); registrar('criou', ni); salvar(); rView(); abrirItem(ni.id); toast(tipo === 'bug' ? 'Bug aberto, ligado ao item de origem.' : 'Melhoria criada como item novo.');
    }}]);
}
function poEditarDod(pj, depois){
  modal('Definição de Pronto: ' + pj.nome, '<label class="lb">O que todo item precisa ter para ser aceito<textarea class="campo" id="po-dod" rows="7" maxlength="3000" placeholder="Ex.:\n- Sem bugs conhecidos\n- Testado no computador e no celular\n- Aprovado pelo P.O.">' + esc(pj.dod || '') + '</textarea></label><p class="sec">Aparece como lembrete em todos os itens do projeto.</p>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Guardar', acao:d => { pj.dod = $('#po-dod', d).value.trim(); salvar(); toast('Definição de Pronto guardada.'); if (depois) depois(); }}]);
}
function poEditarPO(pj, depois){
  const atual = pj.po && pessoa(pj.po);
  if (atual && atual.ativo !== false && atual.id !== eu()){ toast('Só o P.O. atual (' + atual.nome + ') passa o papel para outra pessoa.'); return; }
  const equipe = D.people.filter(p => p.ativo !== false);
  modal('P.O. de ' + pj.nome, '<label class="lb">Quem é o P.O. (Product Owner)<select class="sel" id="po-quem"><option value="">Ninguém (qualquer um do time aceita, como antes)</option>' +
    equipe.map(p => '<option value="' + esc(p.id) + '"' + (p.id === pj.po ? ' selected' : '') + '>' + esc(p.nome) + '</option>').join('') + '</select></label><p class="sec">Só o P.O. aceita ou devolve os itens deste projeto. Depois de definido, só ele passa o papel para outra pessoa.</p>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Guardar', acao:d => { pj.po = $('#po-quem', d).value || null; salvar(); toast(pj.po ? 'P.O. definido: ' + pessoa(pj.po).nome + '.' : 'Projeto sem P.O.'); if (depois) depois(); if (typeof rView === 'function') rView(); }}]);
}

/* ---------- Quadro, Lista e Fila: prioridade, estimativa e critérios à vista; filtrar e ordenar ---------- */
const PO_MOSCOW_CURTO = {deve:'Deve', deveria:'Deveria', poderia:'Poderia', nao_tera:'Não terá'};
const poOrdemMoscow = v => ({deve:0, deveria:1, poderia:2, nao_tera:3})[v] ?? 4;
// a ordem pela prioridade: classe, nível, valor e, no empate, quem tem mais valor por ponto
const poCompararPrioridade = (a, b) => poOrdemMoscow(a.moscow) - poOrdemMoscow(b.moscow) || poNivel(a) - poNivel(b) || (+b.valor || 0) - (+a.valor || 0) ||
  ((+b.valor || 0) / (+b.pontos || 1)) - ((+a.valor || 0) / (+a.pontos || 1)) || (+a.ordem || 0) - (+b.ordem || 0);
function poChipsHTML(i, curto){
  if (!poTemPO(i)) return '';
  const c = poCritConta(i), n = poNivel(i);
  return '<span class="po-chips">' +
    (i.moscow ? '<span class="po-chip po-m-' + i.moscow + '" title="Prioridade: ' + esc(poMoscowNome(i.moscow)) + '">' + esc(PO_MOSCOW_CURTO[i.moscow]) + '</span>' : '') +
    '<span class="po-chip po-n po-n' + n + '" title="Nível ' + esc(PO_NIVEIS[n - 1][1]) + '">N' + n + '</span>' +
    (curto ? '' : (i.pontos ? '<span class="po-chip po-pts" title="Estimativa">' + i.pontos + ' pts</span>' : '')) +
    (c.n ? '<span class="po-chip po-ck' + (c.f === c.n ? ' ok' : '') + '" title="Critérios de aceite marcados: ' + c.f + ' de ' + c.n + '">✓ ' + c.f + ' de ' + c.n + '</span>' : '') +
    (i.tipo === 'bug' ? '<span class="po-chip po-bug">Bug</span>' : i.melhoria ? '<span class="po-chip po-mel">Melhoria</span>' : '') + '</span>';
}
const _cartaoHTMLPo = cartaoHTML;
cartaoHTML = function(i){ const h = _cartaoHTMLPo.apply(this, arguments); return h.replace('<div class="bj-badges">', '<div class="bj-badges">' + poChipsHTML(i, true)); };
const _linhaBacklogPo = linhaBacklog;
linhaBacklog = function(i){
  const h = _linhaBacklogPo.apply(this, arguments); if (!poTemPO(i)) return h;
  const pos = poPosicao(i), falta = pos && pos <= 5 && (!poHistoria(i) || !poCritConta(i).n);
  return h.replace('<button type="button" class="bj-linha-tit"', (pos ? '<span class="po-pos" title="Posição na fila">' + pos + '</span>' : '') + '<button type="button" class="bj-linha-tit"')
    .replace('<span class="bj-linha-dir">', (falta ? '<span class="po-chip po-falta" title="Os primeiros da fila precisam de história e critérios de aceite">falta detalhe</span>' : '') + poChipsHTML(i, true) + '<span class="bj-linha-dir">');
};
// filtros do método: prioridade, nível, tipo e situação; e a ordem da lista
UI.poF = UI.poF || {}; 
const _ferramentasPo = ferramentasHTML;
ferramentasHTML = function(extra){
  const f = UI.poF || {}, s = (k, rot, ops) => '<label class="po-f"><span>' + rot + '</span><select class="sel" data-po-f="' + k + '"><option value="">Todos</option>' + ops.map(([v, n]) => '<option value="' + esc(v) + '"' + (String(f[k] || '') === String(v) ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select></label>';
  const ordem = ['list'].includes(UI.view) ? '<label class="po-f"><span>Ordenar</span><select class="sel" data-po-f="ordem">' + [['', 'Ordem da fila'], ['prioridade', 'Prioridade'], ['valor', 'Valor'], ['pontos', 'Estimativa']].map(([v, n]) => '<option value="' + v + '"' + ((f.ordem || '') === v ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' : '';
  const ativo = ['moscow','nivel','tipo','situ'].some(k => f[k]);
  return _ferramentasPo(extra) + '<div class="po-filtros" role="group" aria-label="Filtrar pelo método do P.O.">' +
    s('moscow', 'Prioridade', PO_MOSCOW.map(m => [m[0], m[1]])) + s('nivel', 'Nível', PO_NIVEIS.map(n => [n[0], n[1]])) + s('tipo', 'Tipo', PO_TIPOS.map(t => [t[0], t[1]])) +
    s('situ', 'Situação', Object.entries(PO_SITU)) + ordem + (ativo ? '<button type="button" class="btn fant peq" data-po-f-limpar>Limpar</button>' : '') + '</div>';
};
const _listaFiltradaPo = listaFiltrada;
listaFiltrada = function(){
  let l = _listaFiltradaPo.apply(this, arguments);
  const f = UI.poF || {};
  if (f.moscow) l = l.filter(i => poTemPO(i) && i.moscow === f.moscow);
  if (f.nivel) l = l.filter(i => poTemPO(i) && poNivel(i) === +f.nivel);
  if (f.tipo) l = l.filter(i => poTemPO(i) && poTipo(i) === f.tipo);
  if (f.situ) l = l.filter(i => poSituacao(i) === f.situ);
  if (f.ordem === 'prioridade') l = l.slice().sort(poCompararPrioridade);
  else if (f.ordem === 'valor') l = l.slice().sort((a, b) => (+b.valor || 0) - (+a.valor || 0) || poCompararPrioridade(a, b));
  else if (f.ordem === 'pontos') l = l.slice().sort((a, b) => (+b.pontos || 0) - (+a.pontos || 0) || poCompararPrioridade(a, b));
  return l;
};
document.addEventListener('change', e => { const t = e.target; if (!t.matches || !t.matches('[data-po-f]')) return; UI.poF = Object.assign({}, UI.poF, {[t.dataset.poF]:t.value || ''}); salvarUI(); rView(); });
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-po-f-limpar]')){ UI.poF = {ordem:(UI.poF || {}).ordem || ''}; salvarUI(); rView(); } });
// Lista: agrupada pela situação do ciclo de vida, com prioridade, estimativa e critérios em cada linha
vList = function(){
  const l = listaFiltrada();
  const grupos = ['backlog','todo','doing','voltou','review','blocked','done'];
  return ferramentasHTML('') + (l.length ? '' : '<p class="vazio-linha">Nenhum item com esses filtros.</p>') + grupos.map(g => {
    const its = l.filter(i => poSituacao(i) === g); if (!its.length) return '';
    const pts = its.reduce((s, i) => s + (+i.pontos || 0), 0);
    return '<div class="grupo-lista po-grupo"><h3>' + (g === 'voltou' ? '<span class="st st-voltou">' + ICO_ST.todo + 'Voltou</span>' : stHTML(g)) + '<span class="rotulo-mini">' + its.length + (its.length === 1 ? ' item' : ' itens') + (pts ? ' · ' + pts + ' pts' : '') + '</span></h3><ul>' +
      its.map(i => { const ch = chaveDe(i); return '<li data-abrir-item="' + i.id + '"><span class="po-li-tit">' + tipoHTML(i.tipo) + (ch ? '<span class="bj-chave">' + esc(ch) + '</span>' : '') + '<span class="po-li-nome">' + esc(i.titulo) + '</span></span>' +
        '<span class="po-li-dir">' + poChipsHTML(i) + '<span class="sec po-li-onde">' + esc(caminhoTexto(i)) + '</span>' + avatar(i.resp) + '</span></li>'; }).join('') + '</ul></div>';
  }).join('');
};
// Fila: botão para pôr na ordem da prioridade (o P.O. ajusta depois, arrastando ou pela posição)
const _vBacklogPo = vBacklog;
vBacklog = function(){
  const h = _vBacklogPo.apply(this, arguments);
  return h.replace('eles vão para a coluna A fazer do Quadro.', 'eles vão para a coluna Priorizado do Quadro. Os do topo da fila devem ser os mais detalhados (história e critérios de aceite).')
    .replace(/<button type="button" class="btn [^"]*" data-bj-acao="mover-board"/, m => (podeEditar() ? '<button type="button" class="btn sec peq po-ordenar" data-po-ordenar title="Ordena pela classe, pelo nível e pelo valor; no empate, sobe quem tem mais valor por ponto">Ordenar pela prioridade</button>' : '') + m);
};
document.addEventListener('click', e => {
  if (!(e.target.closest && e.target.closest('[data-po-ordenar]'))) return;
  const its = issuesEm(UI.sel).filter(i => !i.arquivado && poTemPO(i) && i.status !== 'done');
  if (!its.length){ toast('Não há itens para ordenar aqui.'); return; }
  tfComDesfazer('Fila ordenada pela prioridade (' + its.length + (its.length === 1 ? ' item' : ' itens') + ').', () => {
    const base = Math.min(...its.map(i => +i.ordem || 0));
    its.slice().sort(poCompararPrioridade).forEach((i, k) => { i.ordem = base + k + 1; });
  });
});

/* ---------- Entregas: andamento da versão por itens aceitos e por pontos, a meta e a Definição de Pronto ---------- */
function poAndamentoVersao(m){
  const its = issuesEm(m.no || UI.sel).filter(i => i.marco === m.id && !i.arquivado && i.tipo !== 'epic');
  const ac = its.filter(i => i.status === 'done'), pts = its.reduce((s, i) => s + (+i.pontos || 0), 0), ptsAc = ac.reduce((s, i) => s + (+i.pontos || 0), 0);
  return {n:its.length, ac:ac.length, pts, ptsAc, semPts:its.filter(i => !i.pontos).length};
}
const _enHTMLPo = enHTML;
enHTML = function(chave){
  const h = _enHTMLPo.apply(this, arguments);
  const box = document.createElement('div'); box.innerHTML = h; const pode = podeEditar();
  $$('.en2-v', box).forEach(li => { const b = $('[data-en-notas]', li); const m = b && byId('marcos', b.dataset.enNotas); if (!m) return;
    const a = poAndamentoVersao(m), prog = $('.en2-prog', li);
    if (prog) prog.innerHTML = a.n ? '<div class="rl-barra fina" title="Itens aceitos"><i style="width:' + (a.ac / a.n * 100) + '%"></i></div><small><b>' + a.ac + ' de ' + a.n + '</b> itens aceitos</small>' +
      (a.pts ? '<div class="rl-barra fina po-barra-pts" title="Pontos aceitos"><i style="width:' + (a.ptsAc / a.pts * 100) + '%"></i></div><small><b>' + a.ptsAc + ' de ' + a.pts + '</b> pontos · faltam ' + (a.pts - a.ptsAc) + '</small>' : '<small>sem pontos estimados</small>') +
      (a.semPts && a.pts ? '<small class="po-nota">' + a.semPts + (a.semPts === 1 ? ' item sem estimativa' : ' itens sem estimativa') + '</small>' : '') : '<small>sem itens ligados</small>';
    const nome = $('.en2-v-nome > div', li);
    if (nome) nome.insertAdjacentHTML('beforeend', m.meta ? '<p class="po-v-meta"><b>Meta:</b> ' + esc(m.meta) + (pode ? ' <button type="button" class="po-link" data-po-v-meta="' + m.id + '">mudar</button>' : '') + '</p>'
      : pode ? '<p class="po-v-meta"><button type="button" class="po-link" data-po-v-meta="' + m.id + '">Escrever a meta</button></p>' : '');
  });
  const pj = cadeia(chave).project;
  const col = $$('.en2-col', box)[1];
  if (pj && col) col.insertAdjacentHTML('afterbegin', '<section class="en2-caixa po-dod-caixa"><header><h3>Definição de Pronto</h3><p>O que todo item de ' + esc(pj.nome) + ' precisa ter para ser aceito. Aparece como lembrete em cada item.</p></header>' +
    '<div class="po-dod-corpo">' + (pj.dod ? '<div class="po-dod-txt">' + esc(pj.dod).replace(/\n/g, '<br>') + '</div>' : '<p class="po-nota">Ainda não escrita.</p>') +
    '<p class="po-nota">P.O. do projeto: ' + (pj.po && pessoa(pj.po) ? '<b>' + esc(pessoa(pj.po).nome) + '</b>' : 'ninguém definido') + '</p>' +
    (pode ? '<div class="po-acoes"><button type="button" class="btn sec peq" data-po-dod-proj="' + pj.id + '">' + (pj.dod ? 'Editar' : 'Escrever') + '</button><button type="button" class="btn fant peq" data-po-po-proj="' + pj.id + '">' + (pj.po ? 'Trocar o P.O.' : 'Definir o P.O.') + '</button></div>' : '') + '</div></section>');
  return box.innerHTML;
};
document.addEventListener('click', e => {
  const t = e.target.closest ? e.target.closest('[data-po-v-meta],[data-po-dod-proj],[data-po-po-proj]') : null; if (!t) return;
  if (t.dataset.poVMeta){ const m = byId('marcos', t.dataset.poVMeta); if (!m) return;
    modal('Meta da versão ' + m.nome, '<label class="lb">O que esta versão precisa entregar<textarea class="campo" id="po-vm" rows="4" maxlength="1000" placeholder="Ex.: o lojista publica anúncios sem ligar para o suporte">' + esc(m.meta || '') + '</textarea></label>',
      [{txt:'Cancelar', cls:'sec'}, {txt:'Guardar', acao:d => { m.meta = $('#po-vm', d).value.trim(); salvar(); rView(); }}]); return; }
  const pj = byId('projects', t.dataset.poDodProj || t.dataset.poPoProj); if (!pj) return;
  if (t.dataset.poDodProj) poEditarDod(pj, () => rView()); else poEditarPO(pj, () => rView());
});

/* ---------- exportação (.md): os campos do método em todo item, épico e ponto da Estrutura ---------- */
function poExLinhas(i){
  if (i.tipo === 'epic') return exLinha('Meta da entrega', i.meta || '');
  if (!poTemPO(i)) return '';
  const c = poCritConta(i), org = i.origem && byId('issues', i.origem), pos = poPosicao(i);
  return exLinha('Situação no ciclo', PO_SITU[poSituacao(i)] + (poVoltou(i) && i.voltouMotivo ? ' (motivo: ' + i.voltouMotivo + ')' : '')) +
    exLinha('Tipo no método', PO_TIPOS.find(t => t[0] === poTipo(i))[1]) + exLinha(poTipo(i) === 'bug' ? 'Item de origem' : 'Veio de', org ? exNomeItem(org) : '') +
    exLinha('Classe (MoSCoW)', poMoscowNome(i.moscow)) + exLinha('Nível', PO_NIVEIS[poNivel(i) - 1][1]) +
    exLinha('Valor de negócio', i.valor ? i.valor + ' de 10' + (i.valorMotivo ? ' · ' + i.valorMotivo : '') : (i.valorMotivo || '')) +
    exLinha('Estimativa (pontos)', i.pontos || '') + exLinha('Critérios de aceite', c.n ? c.f + ' de ' + c.n + ' marcados' : '') + exLinha('Posição na fila', pos || '') +
    exLinha('P.O.', poDoPO(i) ? poDoPO(i).nome : '');
}
const _exSituacaoPo = exSituacao;
exSituacao = function(i){ return _exSituacaoPo.apply(this, arguments).replace(/\n$/, poExLinhas(i) + '\n'); };
const _exCorpoItemPo = exCorpoItem;
exCorpoItem = function(i, nh){
  const o = _exCorpoItemPo.apply(this, arguments); if (!poTemPO(i)) return o;
  const h = '#'.repeat(nh), add = [];
  if (poHistoria(i)) add.push(h + ' História\n\n' + poHistoria(i) + '\n');
  const L = poCrit(i);
  if (L.length) add.push(h + ' Critérios de aceite\n\n' + L.map(c => '- [' + (c.f ? 'x' : ' ') + '] ' + c.t + (c.f && (c.por || c.em) ? ' _(marcado' + (c.por ? ' por ' + exPessoa(c.por) : '') + (c.em ? ' em ' + exData(c.em) : '') + ')_' : '')).join('\n') + '\n');
  const des = (i.refs || []).filter(x => x.papel);
  if (des.length) add.push(h + ' Desenho\n\n' + des.map(x => '- ' + (x.papel === 'desenho_celular' ? 'Celular' : 'Computador') + ': ' + x.nome).join('\n') + '\n');
  const pj = poProjeto(i); if (pj && pj.dod) add.push(h + ' Definição de Pronto do projeto\n\n' + pj.dod + '\n');
  if (!add.length) return o;
  const k = o.indexOf('\n' + h + ' ', 1);
  return k < 0 ? o + '\n' + add.join('\n') : o.slice(0, k + 1) + add.join('\n') + '\n' + o.slice(k + 1);
};
const _exNoMdPo = exNoMd;
exNoMd = function(chave){
  let md = _exNoMdPo.apply(this, arguments); if (!md) return md;
  const pj = chave !== 'all' && chave.split(':')[0] !== 'client' ? cadeia(chave).project : null;
  if (pj){
    const bloco = '## Método do P.O.\n\n' + exLinha('P.O. do projeto', pj.po ? exPessoa(pj.po) : 'ninguém definido') + '\n**Definição de Pronto:**\n\n' + (pj.dod || '_Ainda não escrita._') + '\n\n';
    const k = md.indexOf('\n## ', md.indexOf('## Identificação') + 5); md = k < 0 ? md + bloco : md.slice(0, k + 1) + bloco + md.slice(k + 1);
  }
  const vs = typeof enVersoes === 'function' && chave.split(':')[0] !== 'client' ? enVersoes(chave) : [];
  if (vs.length) md += '\n## Andamento das versões\n\n' + vs.map(v => { const a = poAndamentoVersao(v); return '- **' + v.nome + '** · entrega ' + exData(v.data) + (v.meta ? ' · meta: ' + v.meta : '') + ' · ' + a.ac + ' de ' + a.n + ' itens aceitos · ' + a.ptsAc + ' de ' + a.pts + ' pontos (faltam ' + (a.pts - a.ptsAc) + ')'; }).join('\n') + '\n';
  const fila = issuesEm(chave).filter(i => !i.arquivado && poTemPO(i)).sort((a, b) => (a.status === 'done') - (b.status === 'done') || (+a.ordem || 0) - (+b.ordem || 0));
  if (fila.length) md += '\n## Backlog (na ordem do P.O.)\n\n| # | Item | Tipo | Situação | Classe | Nível | Valor | Pontos | Critérios |\n|---|---|---|---|---|---|---|---|---|\n' +
    fila.map((i, k) => { const c = poCritConta(i); return '| ' + (i.status === 'done' ? '' : k + 1) + ' | ' + exNomeItem(i).replace(/\|/g, '/') + ' | ' + PO_TIPOS.find(t => t[0] === poTipo(i))[1] + ' | ' + PO_SITU[poSituacao(i)] + ' | ' + (poMoscowNome(i.moscow) || '') + ' | ' + poNivel(i) + ' | ' + (i.valor || '') + ' | ' + (i.pontos || '') + ' | ' + (c.n ? c.f + '/' + c.n : '') + ' |'; }).join('\n') + '\n';
  return md;
};

if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {exItemMd, exNoMd, abrirItem, mudarStatus, poFila, poCritConta, poSituacao, poPodeAceitar, POH, poHistCarregar});
