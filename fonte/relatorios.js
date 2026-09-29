/* ================= Visões e relatórios: Meu painel, Portfólio, Relatórios (fluxo acumulado), caminho crítico e Metas ================= */

const RL_SEM_GRUPO = s => ['doing','review','blocked'].includes(s) ? 'fazendo' : s === 'done' ? 'feito' : 'afazer';
const rlPct = x => Math.round(Math.max(0, Math.min(1, x)) * 100);
const rlBarra = (p, cls) => '<div class="rl-barra' + (cls ? ' ' + cls : '') + '" role="img" aria-label="' + rlPct(p) + '%"><i style="width:' + rlPct(p) + '%"></i></div>';
const rlMeus = () => D.issues.filter(i => !i.arquivado && i.resp === eu());

/* =============== METAS: dados =============== */
const MT = {cache:null, lendo:null, erro:null};
function mtLocal(){
  if (!D.metasLoc){
    D.metasLoc = {metas:[], resultados:[], itens:[]};
    const pj = D.projects[0];
    if (pj && !COM_BANCO){
      const m = {id:uid('mt'), no_id:pj.id, titulo:'Colocar o app do CEO no ar', descricao:'Primeira versão usada pelo CEO no dia a dia.', dono_id:eu(), inicio:iso(dAdd(HOJE, -30)), fim:iso(dAdd(HOJE, 60)), situacao:'ativa', criado_em:new Date().toISOString()};
      D.metasLoc.metas.push(m);
      const r1 = {id:uid('kr'), meta_id:m.id, titulo:'Aprovações feitas pelo celular', medida:'numero', inicial:0, alvo:40, atual:12, unidade:'por semana', ordem:0};
      const r2 = {id:uid('kr'), meta_id:m.id, titulo:'Itens do lançamento concluídos', medida:'itens', inicial:0, alvo:0, atual:0, unidade:null, ordem:1};
      D.metasLoc.resultados.push(r1, r2);
      issuesEm('project:' + pj.id).slice(0, 6).forEach(i => D.metasLoc.itens.push({resultado_id:r2.id, item_id:i.id}));
    }
  }
  return D.metasLoc;
}
async function mtCarregar(forcar){
  if (MT.cache && !forcar) return MT.cache;
  const sb = domBanco();
  if (!sb){ MT.cache = mtLocal(); return MT.cache; }
  if (!MT.lendo) MT.lendo = Promise.all(['metas','metas_resultados','metas_resultados_itens'].map(t => sb.from(t).select('*')))
    .then(([a, b, c]) => { const e = a.error || b.error || c.error; MT.erro = e ? e.message : null; MT.cache = {metas:a.data || [], resultados:b.data || [], itens:c.data || []}; return MT.cache; })
    .finally(() => { MT.lendo = null; });
  return MT.lendo;
}
async function mtGravar(tabela, op, linha, filtro){
  const sb = domBanco();
  if (!sb){
    const L = mtLocal(), k = {metas:'metas', metas_resultados:'resultados', metas_resultados_itens:'itens'}[tabela];
    if (op === 'inserir'){ const n = Object.assign(tabela === 'metas_resultados_itens' ? {} : {id:uid(tabela === 'metas' ? 'mt' : 'kr')}, linha); L[k].push(n); }
    else if (op === 'alterar'){ const x = L[k].find(r => r.id === filtro); if (x) Object.assign(x, linha); }
    else if (op === 'apagar'){
      if (tabela === 'metas_resultados_itens') L.itens = L.itens.filter(r => !(r.resultado_id === filtro.resultado_id && r.item_id === filtro.item_id));
      else { L[k] = L[k].filter(r => r.id !== filtro); if (tabela === 'metas'){ const rs = L.resultados.filter(r => r.meta_id === filtro).map(r => r.id); L.resultados = L.resultados.filter(r => r.meta_id !== filtro); L.itens = L.itens.filter(r => !rs.includes(r.resultado_id)); } if (tabela === 'metas_resultados') L.itens = L.itens.filter(r => r.resultado_id !== filtro); }
    }
    salvar(); return true;
  }
  let q;
  if (op === 'inserir') q = sb.from(tabela).insert(linha).select();
  else if (op === 'alterar') q = sb.from(tabela).update(linha).eq('id', filtro).select('id');
  else q = typeof filtro === 'object' ? sb.from(tabela).delete().match(filtro).select() : sb.from(tabela).delete().eq('id', filtro).select('id');
  const {data, error} = await q;
  if (error || !data || !data.length){ toast(error && /relation|does not exist|schema cache/i.test(error.message) ? 'As metas ainda não estão disponíveis: falta atualizar o banco.' : 'Não deu para gravar' + (error ? ': ' + error.message : ': sem permissão')); return false; }
  MT.cache = null; return true;
}

/* =============== METAS: cálculo =============== */
function mtProgressoResultado(r, dados){
  if (r.medida === 'itens'){
    const its = dados.itens.filter(x => x.resultado_id === r.id).map(x => byId('issues', x.item_id)).filter(Boolean);
    return {p:its.length ? its.filter(i => i.status === 'done').length / its.length : 0, txt:its.filter(i => i.status === 'done').length + ' de ' + its.length + ' itens', itens:its};
  }
  const den = (+r.alvo - +r.inicial) || 1;
  return {p:Math.max(0, Math.min(1, (+r.atual - +r.inicial) / den)), txt:(+r.atual).toLocaleString('pt-BR') + ' de ' + (+r.alvo).toLocaleString('pt-BR') + (r.unidade ? ' ' + r.unidade : '')};
}
function mtSituacao(m, p){
  if (m.situacao === 'concluida') return ['ok', 'Concluída'];
  if (m.situacao === 'cancelada') return ['off', 'Cancelada'];
  if (p >= 1) return ['ok', 'Alcançada'];
  const ini = parse(m.inicio), fim = parse(m.fim);
  if (HOJE > fim) return ['risco', 'Prazo passou'];
  const esperado = Math.max(0, Math.min(1, (HOJE - ini) / Math.max(1, fim - ini)));
  if (p >= esperado - 0.1) return ['rumo', 'No rumo'];
  if (p >= esperado - 0.25) return ['atencao', 'Atenção'];
  return ['risco', 'Em risco'];
}
function mtDaMeta(m, dados){
  const rs = dados.resultados.filter(r => r.meta_id === m.id).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  const prog = rs.map(r => mtProgressoResultado(r, dados));
  const p = prog.length ? prog.reduce((s, x) => s + x.p, 0) / prog.length : 0;
  return {rs, prog, p, sit:mtSituacao(m, p)};
}
function mtDoEscopo(chave, dados){
  if (chave === 'all') return dados.metas.slice();
  const id = chave.split(':')[1];
  const abaixo = new Set([id]);
  D.products.filter(x => x.project === id).forEach(x => abaixo.add(x.id));
  D.apps.filter(x => x.project === id || x.product === id || abaixo.has(x.product)).forEach(x => abaixo.add(x.id));
  return dados.metas.filter(m => abaixo.has(m.no_id));
}

/* =============== METAS: a aba =============== */
function vMetas(){
  const dados = MT.cache;
  if (!dados){ mtCarregar().then(() => { if (UI.view === 'metas') rView(); }); return '<p class="rl-carregando">Carregando as metas...</p>'; }
  if (MT.erro && domBanco()) return '<p class="rl-erro">Não deu para ler as metas: ' + esc(/relation|does not exist|schema cache/i.test(MT.erro) ? 'falta atualizar o banco (parte 20).' : MT.erro) + '</p>';
  const pode = podeEditar() && UI.sel !== 'all';
  const ms = mtDoEscopo(UI.sel, dados).sort((a, b) => (a.situacao === 'ativa' ? 0 : 1) - (b.situacao === 'ativa' ? 0 : 1) || a.fim.localeCompare(b.fim));
  return '<div class="rl-cab"><div><h2 class="sub" style="margin:0">Metas</h2><p class="lead">O que se quer alcançar e até quando, medido por números ou pelos itens ligados. A cor compara o progresso com o tempo que já passou.</p></div>' + (pode ? '<button class="btn" type="button" data-mt="nova">' + ICO.mais + 'Nova meta</button>' : '') + '</div>' +
    (ms.length ? '<div class="mt-lista">' + ms.map(m => {
      const x = mtDaMeta(m, dados), dono = pessoa(m.dono_id);
      return '<article class="mt-meta mt-' + x.sit[0] + '"><header><div><h3>' + esc(m.titulo) + '</h3><p class="mt-sub">' + fmt(m.inicio) + ' a ' + fmt(m.fim) + (dono ? ' · ' + esc(dono.nome) : '') + (m.no_id !== UI.sel.split(':')[1] ? ' · ' + esc(enNomeNo ? enNomeNo(m.no_id) : '') : '') + '</p></div><span class="mt-selo">' + x.sit[1] + '</span><b class="mt-pct">' + rlPct(x.p) + '%</b></header>' +
        (m.descricao ? '<p class="mt-desc">' + esc(m.descricao) + '</p>' : '') + rlBarra(x.p) +
        '<ul class="mt-rs">' + (x.rs.length ? x.rs.map((r, n) => '<li><div class="mt-r-t"><span>' + esc(r.titulo) + '</span><small>' + esc(x.prog[n].txt) + '</small></div>' + rlBarra(x.prog[n].p, 'fina') +
          (pode ? '<div class="mt-r-acoes">' + (r.medida === 'numero' ? '<label class="mt-atual">Agora<input class="campo peq" type="number" step="any" value="' + esc(r.atual) + '" data-mt-atual="' + esc(r.id) + '" aria-label="Valor de agora de ' + esc(r.titulo) + '"></label>' : '<button class="btn fant peq" type="button" data-mt-itens="' + esc(r.id) + '">Escolher itens</button>') + '<button class="ico-btn" type="button" data-mt-apagar-r="' + esc(r.id) + '" aria-label="Excluir o resultado ' + esc(r.titulo) + '" title="Excluir resultado">' + ICO.fechar + '</button></div>' : '') + '</li>').join('') : '<li class="mt-vazio">Nenhum resultado ainda. Um resultado é o que mostra que a meta foi alcançada, como "40 aprovações por semana".</li>') + '</ul>' +
        (pode ? '<footer><button class="btn sec peq" type="button" data-mt-novo-r="' + esc(m.id) + '">' + ICO.mais + 'Resultado</button><button class="btn fant peq" type="button" data-mt-editar="' + esc(m.id) + '">Editar</button><button class="btn fant peq rl-perigo" type="button" data-mt-apagar="' + esc(m.id) + '">Excluir</button></footer>' : '') + '</article>';
    }).join('') + '</div>' : '<div class="rl-vazio"><b>Nenhuma meta aqui ainda.</b><p>Uma meta diz o que o projeto quer alcançar num período, por exemplo "Colocar o app do CEO no ar até dezembro", e os resultados mostram se está chegando lá.</p></div>');
}
function mtFormMeta(m){
  const n = m || {titulo:'', descricao:'', dono_id:eu(), inicio:iso(HOJE), fim:iso(dAdd(HOJE, 90)), situacao:'ativa'};
  modal(m ? 'Editar meta' : 'Nova meta', '<div class="grade-form"><label class="lb largo">O que quer alcançar<input class="campo" id="mt-t" maxlength="200" value="' + esc(n.titulo) + '" placeholder="Ex.: Colocar o app do CEO no ar"></label>' +
    '<label class="lb largo">Por que importa (opcional)<textarea class="campo" id="mt-d" rows="2" maxlength="4000">' + esc(n.descricao || '') + '</textarea></label>' +
    '<label class="lb">Início<input class="campo" type="date" id="mt-i" value="' + esc(n.inicio) + '"></label><label class="lb">Até<input class="campo" type="date" id="mt-f" value="' + esc(n.fim) + '"></label>' +
    '<label class="lb">Quem cuida<select class="sel" id="mt-o"><option value="">Ninguém</option>' + D.people.filter(p => p.acesso !== 'stakeholder').map(p => '<option value="' + esc(p.id) + '"' + (p.id === n.dono_id ? ' selected' : '') + '>' + esc(p.nome) + '</option>').join('') + '</select></label>' +
    (m ? '<label class="lb">Situação<select class="sel" id="mt-s">' + [['ativa','Ativa'],['concluida','Concluída'],['cancelada','Cancelada']].map(([v, t]) => '<option value="' + v + '"' + (n.situacao === v ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></label>' : '') + '</div>',
    [{txt:'Cancelar', cls:'sec'}, {txt:m ? 'Salvar' : 'Criar meta', acao:dl => {
      const v = {titulo:$('#mt-t', dl).value.trim(), descricao:$('#mt-d', dl).value.trim() || null, inicio:$('#mt-i', dl).value, fim:$('#mt-f', dl).value, dono_id:$('#mt-o', dl).value || null};
      if (m) v.situacao = $('#mt-s', dl).value;
      if (!v.titulo){ toast('Escreva o que quer alcançar'); return false; }
      if (!v.inicio || !v.fim || v.fim < v.inicio){ toast('A data final precisa ser depois do início'); return false; }
      if (!m) v.no_id = UI.sel.split(':')[1];
      mtGravar('metas', m ? 'alterar' : 'inserir', v, m && m.id).then(ok => { if (ok){ toast(m ? 'Meta salva' : 'Meta criada'); mtCarregar(true).then(rView); } });
    }}]);
}
function mtFormResultado(metaId){
  modal('Novo resultado', '<div class="grade-form"><label class="lb largo">Como saber que deu certo<input class="campo" id="kr-t" maxlength="200" placeholder="Ex.: Aprovações feitas pelo celular"></label>' +
    '<fieldset class="lb largo rl-medida"><legend>Medido por</legend><label><input type="radio" name="kr-m" value="numero" checked> Um número (de onde parte até onde quer chegar)</label><label><input type="radio" name="kr-m" value="itens"> Itens concluídos (você escolhe os itens)</label></fieldset>' +
    '<label class="lb kr-num">Parte de<input class="campo" type="number" step="any" id="kr-i" value="0"></label><label class="lb kr-num">Quer chegar a<input class="campo" type="number" step="any" id="kr-a" value="100"></label>' +
    '<label class="lb kr-num">Agora está em<input class="campo" type="number" step="any" id="kr-v" value="0"></label><label class="lb kr-num">Unidade (opcional)<input class="campo" id="kr-u" maxlength="20" placeholder="clientes, %, horas"></label></div>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Adicionar', acao:dl => {
      const medida = dl.querySelector('input[name="kr-m"]:checked').value;
      const v = {meta_id:metaId, titulo:$('#kr-t', dl).value.trim(), medida, inicial:+$('#kr-i', dl).value || 0, alvo:+$('#kr-a', dl).value || 0, atual:+$('#kr-v', dl).value || 0, unidade:$('#kr-u', dl).value.trim() || null, ordem:((MT.cache || {resultados:[]}).resultados.filter(r => r.meta_id === metaId).length)};
      if (!v.titulo){ toast('Escreva como saber que deu certo'); return false; }
      if (medida === 'numero' && v.alvo === v.inicial){ toast('O número que quer chegar precisa ser diferente do de partida'); return false; }
      if (medida === 'itens'){ v.inicial = 0; v.alvo = 0; v.atual = 0; }
      mtGravar('metas_resultados', 'inserir', v).then(ok => { if (ok){ toast('Resultado adicionado'); mtCarregar(true).then(rView); } });
    }}]);
  const dl = $('dialog[open]'); if (dl) dl.addEventListener('change', e => { if (e.target.name === 'kr-m') $$('.kr-num', dl).forEach(x => { x.hidden = e.target.value === 'itens'; }); });
}
function mtEscolherItens(resId){
  const dados = MT.cache, r = dados.resultados.find(x => x.id === resId); if (!r) return;
  const meta = dados.metas.find(m => m.id === r.meta_id);
  const ch = ['projects','products','apps'].map(l => byId(l, meta.no_id) && ({projects:'project', products:'product', apps:'app'}[l] + ':' + meta.no_id)).find(Boolean) || UI.sel;
  const ligados = new Set(dados.itens.filter(x => x.resultado_id === resId).map(x => x.item_id));
  const its = issuesEm(ch).sort((a, b) => (ligados.has(b.id) - ligados.has(a.id)) || a.titulo.localeCompare(b.titulo));
  modal('Itens de "' + esc(r.titulo) + '"', '<input class="campo" type="search" id="kr-busca" placeholder="Procurar item" aria-label="Procurar item" style="margin-bottom:10px"><ul class="rl-escolha">' + its.map(i => '<li><label><input type="checkbox" value="' + esc(i.id) + '"' + (ligados.has(i.id) ? ' checked' : '') + '>' + tipoHTML(i.tipo) + '<span>' + esc(i.titulo) + '</span>' + stHTML(i.status) + '</label></li>').join('') + '</ul>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Salvar', acao:dl => {
      const quer = new Set($$('.rl-escolha input:checked', dl).map(x => x.value));
      const tirar = [...ligados].filter(x => !quer.has(x)), por = [...quer].filter(x => !ligados.has(x));
      Promise.all(tirar.map(item_id => mtGravar('metas_resultados_itens', 'apagar', null, {resultado_id:resId, item_id})).concat(por.map(item_id => mtGravar('metas_resultados_itens', 'inserir', {resultado_id:resId, item_id}))))
        .then(r2 => { if (r2.every(Boolean)) toast('Itens salvos'); mtCarregar(true).then(rView); });
    }}]);
  const dl = $('dialog[open]'); const b = dl && $('#kr-busca', dl);
  if (b) b.addEventListener('input', () => { const q = pkSemAcento(b.value); $$('.rl-escolha li', dl).forEach(li => { li.hidden = q && !pkSemAcento(li.textContent).includes(q); }); });
}
function mtConfirmar(titulo, texto, fazer){ modal(titulo, '<p style="margin:0">' + texto + '</p>', [{txt:'Cancelar', cls:'sec'}, {txt:'Excluir', cls:'perigo', acao:() => { fazer(); }}]); }
document.addEventListener('click', e => {
  let x;
  if (e.target.closest('[data-mt="nova"]')){ mtFormMeta(null); return; }
  if ((x = e.target.closest('[data-mt-editar]'))){ mtFormMeta(MT.cache.metas.find(m => m.id === x.dataset.mtEditar)); return; }
  if ((x = e.target.closest('[data-mt-novo-r]'))){ mtFormResultado(x.dataset.mtNovoR); return; }
  if ((x = e.target.closest('[data-mt-itens]'))){ mtEscolherItens(x.dataset.mtItens); return; }
  if ((x = e.target.closest('[data-mt-apagar]'))){ const m = MT.cache.metas.find(z => z.id === x.dataset.mtApagar); mtConfirmar('Excluir meta', 'A meta <b>' + esc(m.titulo) + '</b> e os resultados dela serão excluídos. Os itens ligados continuam existindo.', () => mtGravar('metas', 'apagar', null, m.id).then(ok => { if (ok){ toast('Meta excluída'); mtCarregar(true).then(rView); } })); return; }
  if ((x = e.target.closest('[data-mt-apagar-r]'))){ const r = MT.cache.resultados.find(z => z.id === x.dataset.mtApagarR); mtConfirmar('Excluir resultado', 'O resultado <b>' + esc(r.titulo) + '</b> será excluído.', () => mtGravar('metas_resultados', 'apagar', null, r.id).then(ok => { if (ok){ toast('Resultado excluído'); mtCarregar(true).then(rView); } })); }
});
document.addEventListener('change', e => {
  const x = e.target.closest && e.target.closest('[data-mt-atual]'); if (!x) return;
  const v = +x.value; if (!isFinite(v)) return;
  mtGravar('metas_resultados', 'alterar', {atual:v}, x.dataset.mtAtual).then(ok => { if (ok){ toast('Valor atualizado'); mtCarregar(true).then(rView); } });
});

/* =============== RELATÓRIOS: fluxo acumulado, entregas por semana, tempo até concluir =============== */
function rlGrafFluxo(lista, dias){
  const ini = dAdd(HOJE, -dias + 1), W = 720, H = 220, E = 36, B = 24, T = 8;
  const pontos = [];
  for (let n = 0; n < dias; n++){
    const d = iso(dAdd(ini, n)); let af = 0, fz = 0, ft = 0;
    lista.forEach(i => { const cr = i.criado || i.ini; if (!cr || cr > d) return; if (i.feito && i.feito <= d) ft++; else if ((i.iniciado && i.iniciado <= d) || (!i.iniciado && RL_SEM_GRUPO(i.status) !== 'afazer' && !(i.feito && i.feito > d) && d === iso(HOJE))) fz++; else af++; });
    pontos.push([d, af, fz, ft]);
  }
  const max = Math.max(1, ...pontos.map(p => p[1] + p[2] + p[3]));
  const x = n => E + n / Math.max(1, dias - 1) * (W - E - T), y = v => T + (1 - v / max) * (H - T - B);
  const area = (baixo, alto) => 'M' + pontos.map((p, n) => x(n).toFixed(1) + ',' + y(alto(p)).toFixed(1)).join('L') + 'L' + pontos.map((p, n) => [x(n).toFixed(1), y(baixo(p)).toFixed(1)]).reverse().map(c => c.join(',')).join('L') + 'Z';
  const ticks = [0, Math.round(max / 2), max];
  const datas = [0, Math.floor((dias - 1) / 2), dias - 1];
  const ult = pontos[pontos.length - 1];
  return '<figure class="rl-fig"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Fluxo acumulado dos últimos ' + dias + ' dias: hoje ' + ult[3] + ' feitos, ' + ult[2] + ' fazendo e ' + ult[1] + ' a fazer">' +
    ticks.map(t => '<line x1="' + E + '" x2="' + (W - T) + '" y1="' + y(t) + '" y2="' + y(t) + '" class="rl-grade"/><text x="' + (E - 6) + '" y="' + (y(t) + 4) + '" text-anchor="end" class="rl-eixo">' + t + '</text>').join('') +
    '<path d="' + area(p => 0, p => p[3]) + '" class="rl-a-feito"/><path d="' + area(p => p[3], p => p[3] + p[2]) + '" class="rl-a-fazendo"/><path d="' + area(p => p[3] + p[2], p => p[3] + p[2] + p[1]) + '" class="rl-a-afazer"/>' +
    datas.map(n => '<text x="' + x(n) + '" y="' + (H - 6) + '" text-anchor="' + (n === 0 ? 'start' : n === dias - 1 ? 'end' : 'middle') + '" class="rl-eixo">' + fmt(pontos[n][0]) + '</text>').join('') +
    '</svg><figcaption><span><i class="rl-l-afazer"></i>A fazer ' + ult[1] + '</span><span><i class="rl-l-fazendo"></i>Fazendo ' + ult[2] + '</span><span><i class="rl-l-feito"></i>Feito ' + ult[3] + '</span><small>Se a faixa do meio (Fazendo) engorda, há coisa demais começada ao mesmo tempo. Se a de cima cresce sem parar, está chegando mais trabalho do que se conclui.</small></figcaption></figure>';
}
function rlGrafSemanas(lista){
  const sem = []; const seg = dAdd(HOJE, -((HOJE.getDay() + 6) % 7));
  for (let n = 7; n >= 0; n--){ const a = dAdd(seg, -7 * n), b = dAdd(a, 6); sem.push([a, lista.filter(i => i.feito && parse(i.feito) >= a && parse(i.feito) <= b).length]); }
  const W = 720, H = 180, E = 30, B = 24, T = 16, max = Math.max(1, ...sem.map(s => s[1])), lw = (W - E - 8) / sem.length;
  const media = sem.slice(0, -1).reduce((s, x) => s + x[1], 0) / Math.max(1, sem.length - 1);
  return '<figure class="rl-fig"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Itens concluídos por semana nas últimas 8 semanas; média de ' + media.toFixed(1) + ' por semana">' +
    sem.map(([d, v], n) => { const h = v / max * (H - T - B), xx = E + n * lw + lw * 0.18; return '<rect x="' + xx.toFixed(1) + '" y="' + (H - B - h).toFixed(1) + '" width="' + (lw * 0.64).toFixed(1) + '" height="' + Math.max(0, h).toFixed(1) + '" class="rl-b' + (n === sem.length - 1 ? ' atual' : '') + '"/><text x="' + (xx + lw * 0.32).toFixed(1) + '" y="' + (H - B - h - 4).toFixed(1) + '" text-anchor="middle" class="rl-valor">' + v + '</text><text x="' + (xx + lw * 0.32).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" class="rl-eixo">' + fmt(iso(d)) + '</text>'; }).join('') +
    '<line x1="' + E + '" x2="' + (W - 8) + '" y1="' + (H - B) + '" y2="' + (H - B) + '" class="rl-grade"/></svg><figcaption><span>Média das semanas fechadas: <b>' + media.toFixed(1).replace('.', ',') + '</b> por semana</span><small>A última barra é a semana de agora, ainda em andamento.</small></figcaption></figure>';
}
function rlTempos(lista){
  const f = lista.filter(i => i.feito && parse(i.feito) >= dAdd(HOJE, -60));
  const med = l => { if (!l.length) return null; const s = l.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const lead = med(f.filter(i => i.criado).map(i => Math.max(0, (parse(i.feito) - parse(i.criado)) / 864e5)));
  const ciclo = med(f.filter(i => i.iniciado).map(i => Math.max(0, (parse(i.feito) - parse(i.iniciado)) / 864e5)));
  const abertos = lista.filter(i => i.status !== 'done'), atr = abertos.filter(atrasado).length;
  const d = v => v === null ? '<p class="rl-v"><b>sem dados</b></p>' : '<p class="rl-v"><b>' + Math.round(v) + '</b> ' + (Math.round(v) === 1 ? 'dia' : 'dias') + '</p>';
  return '<div class="rl-numeros"><div><small>Do pedido até concluir</small>' + d(lead) + '<span>metade dos itens dos últimos 60 dias levou até isso</span></div><div><small>Do começo até concluir</small>' + d(ciclo) + '<span>contando só depois que alguém começou</span></div><div><small>Em aberto</small><b>' + abertos.length + '</b><span>' + atr + ' atrasado' + (atr === 1 ? '' : 's') + '</span></div><div><small>Concluídos em 60 dias</small><b>' + f.length + '</b><span>itens</span></div></div>';
}
function vRelatorios(){
  const lista = UI.sel === 'all' ? D.issues.filter(i => !i.arquivado) : issuesEm(UI.sel);
  const dias = [30, 60, 90].includes(UI.rlDias) ? UI.rlDias : 30;
  return '<div class="rl-cab"><div><h2 class="sub" style="margin:0">Relatórios</h2><p class="lead">Como o trabalho anda em ' + esc(UI.sel === 'all' ? 'tudo' : nomeDe(UI.sel)) + ': quanto entra, quanto sai e quanto demora.</p></div><label class="rotulo-mini" style="display:flex;gap:8px;align-items:center">Período<select class="sel peq" data-rl-dias>' + [30, 60, 90].map(n => '<option value="' + n + '"' + (n === dias ? ' selected' : '') + '>' + n + ' dias</option>').join('') + '</select></label></div>' +
    rlTempos(lista) +
    '<section class="pc-c rl-sec"><h3>Fluxo acumulado' + I('Fluxo acumulado: quantos itens estavam a fazer, fazendo e feitos em cada dia. Mostra se o trabalho está andando ou empacando.') + '</h3>' + rlGrafFluxo(lista, dias) + '</section>' +
    '<section class="pc-c rl-sec"><h3>Concluídos por semana' + I('Quantos itens foram concluídos em cada semana. Ajuda a prever quanto cabe nas próximas semanas.') + '</h3>' + rlGrafSemanas(lista) + '</section>';
}
document.addEventListener('change', e => { if (e.target.matches && e.target.matches('[data-rl-dias]')){ UI.rlDias = +e.target.value; salvarUI(); rView(); } });

/* =============== CAMINHO CRÍTICO na linha do tempo =============== */
function rlCaminhoCritico(lista){
  const noConj = new Map(lista.filter(i => i.ini && i.fim).map(i => [i.id, i]));
  const depois = new Map(); [...noConj.keys()].forEach(k => depois.set(k, new Set()));
  let ligacoes = 0;
  noConj.forEach(i => (i.links || []).forEach(l => {
    if (!noConj.has(l.alvo)) return;
    if (l.tipo === 'Blocks'){ depois.get(i.id).add(l.alvo); ligacoes++; }
    else if (l.tipo === 'Is blocked by'){ depois.get(l.alvo).add(i.id); ligacoes++; }
  }));
  if (!ligacoes) return {cadeia:[], ligacoes};
  const dur = i => Math.max(1, (parse(i.fim) - parse(i.ini)) / 864e5 + 1);
  const memo = new Map(), andando = new Set();
  const melhor = id => {
    if (memo.has(id)) return memo.get(id);
    if (andando.has(id)) return {soma:0, cad:[]};   // ciclo: para aqui
    andando.add(id);
    let r = {soma:0, cad:[]};
    depois.get(id).forEach(p => { const x = melhor(p); if (x.soma > r.soma) r = x; });
    andando.delete(id);
    const res = {soma:r.soma + dur(noConj.get(id)), cad:[id].concat(r.cad)};
    memo.set(id, res); return res;
  };
  let top = {soma:0, cad:[]};
  noConj.forEach((_, id) => { const x = melhor(id); if (x.cad.length > 1 && x.soma > top.soma) top = x; });
  return {cadeia:top.cad.map(id => noConj.get(id)), dias:top.soma, ligacoes};
}
function rlMarcarCritico(){
  const c = $('#ops-corpo'); if (!c || UI.view !== 'timeline') return;
  const r = rlCaminhoCritico(listaFiltrada());
  const alvo = c.querySelector('.gantt-rolo'); if (!alvo) return;
  const ligado = !!UI.rlCritico;
  const fim = r.cadeia.length ? r.cadeia.reduce((m, i) => i.fim > m ? i.fim : m, r.cadeia[0].fim) : null;
  alvo.insertAdjacentHTML('beforebegin', '<div class="rl-cc' + (ligado ? ' ligado' : '') + '"><div><b>Caminho crítico' + I('Caminho crítico: a sequência mais longa de itens que dependem um do outro (ligação "Bloqueia"). Se qualquer um deles atrasar, a entrega final atrasa junto.') + '</b>' +
    (r.cadeia.length ? '<span>' + r.cadeia.length + ' itens em sequência, ' + Math.round(r.dias) + ' dias de trabalho, termina em ' + fmt(fim) + '.' + (r.cadeia.some(atrasado) ? ' <em>Tem item atrasado nele.</em>' : '') + '</span>' : '<span>' + (r.ligacoes ? 'As ligações não formam uma sequência.' : 'Nenhum item ligado com "Bloqueia" aqui. Ligue os itens que dependem um do outro, dentro do item em Ligações.') + '</span>') + '</div>' +
    (r.cadeia.length ? '<button class="btn ' + (ligado ? 'acento' : 'sec') + ' peq" type="button" data-rl-critico aria-pressed="' + ligado + '">' + (ligado ? 'Tirar destaque' : 'Destacar') + '</button>' : '') + '</div>');
  if (ligado && r.cadeia.length){
    const ids = new Set(r.cadeia.map(i => i.id));
    c.classList.add('rl-com-critico');
    $$('.g-barra[data-abrir-item]', c).forEach(b => b.classList.toggle('rl-critica', ids.has(b.dataset.abrirItem)));
    $$('.g-nome[data-abrir-item]', c).forEach(b => b.closest('.g-lin').classList.toggle('rl-critica-lin', ids.has(b.dataset.abrirItem)));
  } else c.classList.remove('rl-com-critico');
}
document.addEventListener('click', e => { if (e.target.closest('[data-rl-critico]')){ UI.rlCritico = !UI.rlCritico; salvarUI(); rView(); } });

/* =============== PORTFÓLIO na Visão geral =============== */
function rlSaude(its){
  const abertos = its.filter(i => i.status !== 'done');
  if (!its.length) return ['off', 'Sem itens'];
  const atr = abertos.filter(atrasado).length, bloq = abertos.filter(i => i.status === 'blocked').length;
  if (atr / Math.max(1, abertos.length) > 0.25 || bloq >= 3) return ['risco', 'Em risco'];
  if (atr || bloq) return ['atencao', 'Atenção'];
  return ['rumo', 'No rumo'];
}
function rlPortfolio(){
  const pjs = D.projects.filter(p => p.status !== 'archived');
  if (!pjs.length) return '';
  const linhas = pjs.map(p => {
    const ch = 'project:' + p.id, its = issuesEm(ch), feitos = its.filter(i => i.status === 'done').length, abertos = its.filter(i => i.status !== 'done');
    const prox = marcosDoEscopo(ch).filter(m => !m.entregue).sort((a, b) => a.data.localeCompare(b.data))[0];
    const cli = D.clients.find(c => c.id === p.client);
    const s = p.status === 'on_hold' ? ['off', 'Pausado'] : rlSaude(its);
    return {p, ch, its, feitos, abertos, prox, cli, s, atr:abertos.filter(atrasado).length};
  }).sort((a, b) => ({risco:0, atencao:1, rumo:2, off:3}[a.s[0]] - {risco:0, atencao:1, rumo:2, off:3}[b.s[0]]) || a.p.nome.localeCompare(b.p.nome));
  return '<section class="pc-c rl-port"><h3>Portfólio<span>' + linhas.length + ' projetos</span>' + I('Portfólio: todos os projetos numa tabela só, os que precisam de atenção primeiro. Clique num projeto para abrir.') + '</h3><div class="tabela-rolo"><table class="tabela rl-port-t"><thead><tr><th>Projeto</th><th>Situação</th><th>Progresso</th><th class="num">Em aberto</th><th class="num">Atrasados</th><th>Próxima versão</th></tr></thead><tbody>' +
    linhas.map(x => '<tr class="clicavel" data-rl-ir="' + esc(x.ch) + '" tabindex="0"><th scope="row">' + esc(x.p.nome) + (x.cli ? '<small>' + esc(x.cli.nome) + '</small>' : '') + '</th><td><span class="mt-selo rl-s-' + x.s[0] + '">' + x.s[1] + '</span></td><td>' + (x.its.length ? rlBarra(x.feitos / x.its.length, 'fina') + '<small>' + x.feitos + ' de ' + x.its.length + '</small>' : '<small>sem itens</small>') + '</td><td class="num">' + x.abertos.length + '</td><td class="num' + (x.atr ? ' rl-ruim' : '') + '">' + x.atr + '</td><td>' + (x.prox ? esc(x.prox.nome) + '<small' + (parse(x.prox.data) < HOJE ? ' class="rl-ruim"' : '') + '>' + fmt(x.prox.data) + '</small>' : '<small>nenhuma</small>') + '</td></tr>').join('') +
    '</tbody></table></div></section>';
}
const _rOverviewRl = rOverview;
rOverview = function(){
  const r = _rOverviewRl.apply(this, arguments);
  if (UI.verComo === 'stakeholder' || (UI.ovSel && UI.ovSel !== 'all')) return r;
  const el = $('#m-overview'), topo = el && el.querySelector('.topo-tela');
  if (topo && !el.querySelector('.rl-port')) topo.insertAdjacentHTML('afterend', rlPortfolio());
  return r;
};
document.addEventListener('click', e => { const x = e.target.closest('[data-rl-ir]'); if (x) pkIrNo(x.dataset.rlIr); });
document.addEventListener('keydown', e => { const x = e.target.closest && e.target.closest('[data-rl-ir]'); if (x && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); pkIrNo(x.dataset.rlIr); } });

/* =============== MEU PAINEL =============== */
const PN_WIDGETS = {
  atrasados:['Meus atrasados', 'itens seus com prazo vencido'],
  semana:['Vencem em 7 dias', 'itens seus com prazo nesta semana'],
  fazendo:['Estou fazendo', 'itens seus em andamento'],
  avisos:['Avisos não lidos', 'o que chegou para você'],
  situacao:['Meus itens por situação', 'quantos estão em cada coluna'],
  concluidos:['O que concluí', 'itens seus concluídos por dia, nas últimas 2 semanas'],
  metas:['Metas', 'as metas que você cuida e as dos seus projetos'],
  projetos:['Meus projetos', 'os projetos em que você tem itens']
};
const PN_PADRAO = ['atrasados','semana','avisos','fazendo','situacao','concluidos','metas','projetos'];
function pnLayout(){ const l = CM.prefs && Array.isArray(CM.prefs.painel) && CM.prefs.painel.length ? CM.prefs.painel.filter(k => PN_WIDGETS[k]) : PN_PADRAO; return l.length ? l : PN_PADRAO; }
const pnLista = (l, vazio) => l.length ? '<ul class="pn-itens">' + l.slice(0, 8).map(i => '<li data-abrir-item="' + esc(i.id) + '" class="clicavel">' + tipoHTML(i.tipo) + '<span class="pn-t">' + esc(i.titulo) + '<small>' + esc(caminhoTexto(i)) + '</small></span>' + (i.fim ? '<span class="pn-data' + (atrasado(i) ? ' atraso' : '') + '">' + fmt(i.fim) + '</span>' : '') + '</li>').join('') + '</ul>' + (l.length > 8 ? '<p class="pn-mais">e mais ' + (l.length - 8) + '</p>' : '') : '<p class="pn-vazio">' + vazio + '</p>';
function pnWidget(k){
  const meus = rlMeus(), abertos = meus.filter(i => i.status !== 'done');
  if (k === 'atrasados') return pnLista(abertos.filter(atrasado).sort((a, b) => a.fim.localeCompare(b.fim)), 'Nada atrasado com você.');
  if (k === 'semana') return pnLista(abertos.filter(i => i.fim && !atrasado(i) && parse(i.fim) <= dAdd(HOJE, 7)).sort((a, b) => a.fim.localeCompare(b.fim)), 'Nada vence nos próximos 7 dias.');
  if (k === 'fazendo') return pnLista(abertos.filter(i => RL_SEM_GRUPO(i.status) === 'fazendo'), 'Nada em andamento. Pegue um item do quadro.');
  if (k === 'avisos'){ const n = cmMeus().filter(x => !x.lida).sort((a, b) => b.quando - a.quando); return n.length ? '<ul class="pn-avisos">' + n.slice(0, 5).map(x => '<li class="clicavel" data-cm-id="' + esc(x.id) + '"' + (x.item ? ' data-cm-abrir="' + esc(x.item) + '"' : '') + '><b>' + esc(x.titulo) + '</b><span>' + esc(cmSemToken(x.txt)) + '</span></li>').join('') + '</ul><button class="btn fant peq" type="button" data-rc-sino>Ver todos (' + n.length + ')</button>' : '<p class="pn-vazio">Tudo lido.</p>'; }
  if (k === 'situacao'){ const g = STATUS.map(s => [s, abertos.concat(meus.filter(i => i.status === 'done' && i.feito && parse(i.feito) >= dAdd(HOJE, -14))).filter(i => i.status === s.id).length]); const max = Math.max(1, ...g.map(x => x[1])); return '<ul class="pn-barras">' + g.map(([s, n]) => '<li><span>' + esc(s.nome) + '</span><div class="rl-barra fina"><i class="st-bg-' + s.id + '" style="width:' + (n / max * 100) + '%"></i></div><b>' + n + '</b></li>').join('') + '</ul><p class="pn-nota">Feito conta só os últimos 14 dias.</p>'; }
  if (k === 'concluidos'){ const dias = []; for (let n = 13; n >= 0; n--){ const d = iso(dAdd(HOJE, -n)); dias.push([d, meus.filter(i => i.feito === d).length]); } const max = Math.max(1, ...dias.map(x => x[1])), tot = dias.reduce((s, x) => s + x[1], 0);
    return '<svg class="pn-spark" viewBox="0 0 280 70" role="img" aria-label="' + tot + ' itens concluídos nas últimas 2 semanas">' + dias.map(([d, v], n) => '<rect x="' + (n * 20 + 3) + '" y="' + (60 - v / max * 52) + '" width="14" height="' + Math.max(1, v / max * 52) + '" class="rl-b' + (n === 13 ? ' atual' : '') + '"><title>' + fmt(d) + ': ' + v + '</title></rect>').join('') + '<line x1="0" x2="280" y1="61" y2="61" class="rl-grade"/></svg><p class="pn-nota"><b>' + tot + '</b> concluído' + (tot === 1 ? '' : 's') + ' em 14 dias.</p>'; }
  if (k === 'metas'){
    const dados = MT.cache; if (!dados){ mtCarregar().then(() => { if (UI.modulo === 'painel') rMeuPainel(); }).catch(() => {}); return '<p class="pn-vazio">Carregando...</p>'; }
    const meusPj = new Set(meus.map(i => (appDe(i) || {}).project).filter(Boolean));
    const ms = dados.metas.filter(m => m.situacao === 'ativa' && (m.dono_id === eu() || meusPj.has(m.no_id) || D.apps.some(a => a.id === m.no_id && meusPj.has(a.project)) || D.products.some(p => p.id === m.no_id && meusPj.has(p.project))));
    return ms.length ? '<ul class="pn-metas">' + ms.slice(0, 5).map(m => { const x = mtDaMeta(m, dados); return '<li><div><b>' + esc(m.titulo) + '</b><span class="mt-selo rl-s-' + x.sit[0] + '">' + x.sit[1] + '</span></div>' + rlBarra(x.p, 'fina') + '<small>' + rlPct(x.p) + '% · até ' + fmt(m.fim) + '</small></li>'; }).join('') + '</ul>' : '<p class="pn-vazio">Nenhuma meta ativa nos seus projetos. Crie na aba Metas de um projeto.</p>';
  }
  if (k === 'projetos'){ const ids = [...new Set(meus.map(i => (appDe(i) || {}).project).filter(Boolean))]; const pjs = ids.map(id => byId('projects', id)).filter(Boolean);
    return pjs.length ? '<ul class="pn-proj">' + pjs.map(p => { const its = issuesEm('project:' + p.id), f = its.filter(i => i.status === 'done').length, s = rlSaude(its); return '<li class="clicavel" data-rl-ir="project:' + esc(p.id) + '" tabindex="0"><div><b>' + esc(p.nome) + '</b><span class="mt-selo rl-s-' + s[0] + '">' + s[1] + '</span></div>' + rlBarra(its.length ? f / its.length : 0, 'fina') + '<small>' + f + ' de ' + its.length + ' itens · ' + rlMeus().filter(i => i.status !== 'done' && (appDe(i) || {}).project === p.id).length + ' com você</small></li>'; }).join('') + '</ul>' : '<p class="pn-vazio">Você ainda não tem itens em nenhum projeto.</p>'; }
  return '';
}
function pnContagem(k){
  const abertos = rlMeus().filter(i => i.status !== 'done');
  if (k === 'atrasados') return abertos.filter(atrasado).length;
  if (k === 'semana') return abertos.filter(i => i.fim && !atrasado(i) && parse(i.fim) <= dAdd(HOJE, 7)).length;
  if (k === 'fazendo') return abertos.filter(i => RL_SEM_GRUPO(i.status) === 'fazendo').length;
  if (k === 'avisos') return cmMeus().filter(x => !x.lida).length;
  return null;
}
let PN_ARRUMAR = false;
function rMeuPainel(){
  const el = $('#m-painel'); if (!el) return;
  if (!CM.prefs){ cmLerPrefs().then(() => { if (UI.modulo === 'painel') rMeuPainel(); }); }
  const lay = pnLayout(), fora = Object.keys(PN_WIDGETS).filter(k => !lay.includes(k));
  const p = pessoa(eu()), hora = new Date().getHours();
  el.innerHTML = '<div class="topo-tela"><div><h1><span>' + (hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite') + (p ? ', ' + esc(p.nome.split(' ')[0]) : '') + '</span></h1><p class="lead">O que é seu, de todos os projetos, numa tela só.</p></div><div class="acoes">' +
    (PN_ARRUMAR ? (fora.length ? '<select class="sel peq" data-pn-add aria-label="Adicionar quadro"><option value="">Adicionar quadro</option>' + fora.map(k => '<option value="' + k + '">' + PN_WIDGETS[k][0] + '</option>').join('') + '</select>' : '') + '<button class="btn fant peq" type="button" data-pn-padrao>Voltar ao padrão</button><button class="btn peq" type="button" data-pn-arrumar>Pronto</button>' : '<button class="btn sec peq" type="button" data-pn-arrumar>Arrumar o painel</button>') + '</div></div>' +
    '<div class="pn-grade' + (PN_ARRUMAR ? ' arrumando' : '') + '">' + lay.map((k, n) => { const q = pnContagem(k); return '<section class="pc-c pn-w pn-w-' + k + '" data-pn="' + k + '"><h3>' + PN_WIDGETS[k][0] + (q !== null ? '<span>' + q + '</span>' : '') + '</h3>' +
      (PN_ARRUMAR ? '<div class="pn-arr"><button class="ico-btn" type="button" data-pn-mover="' + k + '" data-dir="-1" aria-label="Mover ' + PN_WIDGETS[k][0] + ' para antes"' + (n === 0 ? ' disabled' : '') + '>‹</button><button class="ico-btn" type="button" data-pn-mover="' + k + '" data-dir="1" aria-label="Mover ' + PN_WIDGETS[k][0] + ' para depois"' + (n === lay.length - 1 ? ' disabled' : '') + '>›</button><button class="ico-btn" type="button" data-pn-tirar="' + k + '" aria-label="Tirar ' + PN_WIDGETS[k][0] + ' do painel">' + ICO.fechar + '</button></div><p class="pn-nota">' + PN_WIDGETS[k][1] + '</p>' : pnWidget(k)) + '</section>'; }).join('') + '</div>';
}
function pnSalvar(l){ const antes = CM.prefs ? CM.prefs.painel : null; CM.prefs = Object.assign({}, CM_PADRAO, CM.prefs || {}, {painel:l}); rMeuPainel(); cmGravarPrefs({painel:l}).then(ok => { if (!ok){ CM.prefs.painel = antes || []; rMeuPainel(); } }); }
document.addEventListener('click', e => {
  let x;
  if (e.target.closest('[data-pn-arrumar]')){ PN_ARRUMAR = !PN_ARRUMAR; rMeuPainel(); return; }
  if (e.target.closest('[data-pn-padrao]')){ pnSalvar([]); return; }
  if ((x = e.target.closest('[data-pn-tirar]'))){ const l = pnLayout().filter(k => k !== x.dataset.pnTirar); if (!l.length){ toast('Deixe pelo menos um quadro'); return; } pnSalvar(l); return; }
  if ((x = e.target.closest('[data-pn-mover]'))){ const l = pnLayout().slice(), i = l.indexOf(x.dataset.pnMover), j = i + +x.dataset.dir; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; pnSalvar(l); const b = $('[data-pn-mover="' + x.dataset.pnMover + '"][data-dir="' + x.dataset.dir + '"]'); if (b && !b.disabled) b.focus(); }
});
document.addEventListener('change', e => { if (e.target.matches && e.target.matches('[data-pn-add]') && e.target.value) pnSalvar(pnLayout().concat(e.target.value)); });

/* =============== ligar: abas novas, módulo Meu painel =============== */
VIEWS.push(['relatorios', 'Relatórios', 'fluxo acumulado, entregas por semana e tempo até concluir'], ['metas', 'Metas', 'objetivos com resultados medidos']);
SM_ABAS.relatorios = ['Relatórios', 'Como o trabalho anda: fluxo acumulado, quantos itens saem por semana e quanto tempo demoram.'];
SM_ABAS.metas = ['Metas', 'O que se quer alcançar e até quando, com resultados medidos por número ou pelos itens ligados.'];
EXPL_VIEW.relatorios = SM_ABAS.relatorios[1]; EXPL_VIEW.metas = SM_ABAS.metas[1];
VIEWS.forEach(v => { if (v[0] === 'relatorios' || v[0] === 'metas') v[1] = SM_ABAS[v[0]][0]; });
const _rViewRl = rView;
rView = function(){
  const c = $('#ops-corpo');
  if (c && UI.view === 'relatorios'){ c.innerHTML = vRelatorios(); smAgruparAbas(); return; }
  if (c && UI.view === 'metas'){ c.innerHTML = vMetas(); smAgruparAbas(); return; }
  const r = _rViewRl.apply(this, arguments);
  if (UI.view === 'timeline') rlMarcarCritico();
  return r;
};
const _rOperacoesRl = rOperacoes;
rOperacoes = function(){
  const r = _rOperacoesRl.apply(this, arguments);
  const tipo = (UI.sel || '').split(':')[0];
  if (!['project','product','app'].includes(tipo) || UI.verComo === 'stakeholder'){ const b = $('.ops-cab .view-b[data-view="metas"]'); if (b) (b.closest('.view-casa') || b).remove(); if (UI.view === 'metas'){ UI.view = 'dashboard'; rView(); } }
  if (UI.verComo === 'stakeholder'){ const b = $('.ops-cab .view-b[data-view="relatorios"]'); if (b) (b.closest('.view-casa') || b).remove(); }
  smAgruparAbas();
  return r;
};
const _renderRl = render;
render = function(){ if (UI.modulo === 'painel'){ rMeuPainel(); atualizarSino(); return; } return _renderRl.apply(this, arguments); };
PK_IR.i = 'painel';
PK_ATALHOS[1][1].unshift(['G I', 'Meu painel']);
// as metas do banco voltam a ser lidas quando os dados são recarregados
const _montarDadosRl = montarDados;
montarDados = function(){ MT.cache = null; return _montarDadosRl.apply(this, arguments); };

if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {rlCaminhoCritico, mtCarregar, MT, rMeuPainel, vRelatorios, rOperacoes, rView});
