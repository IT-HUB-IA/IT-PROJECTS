/* ===== Calendário (visual novo) =====
   Mês, semana, dia e agenda com o mesmo comportamento de antes (arrastar para mudar o prazo, clicar no horário
   vazio para reservar um bloco, puxar a borda do bloco), num desenho mais claro:
   - cabeçalho com o período em destaque e os números do período (prazos, atrasados, entregas, horas previstas);
   - dias com o número grande, a barra de carga do dia, hoje em vermelho e o fim de semana mais apagado;
   - na semana e no dia, a linha da hora de agora;
   - itens com a cor da situação e o responsável;
   - à direita, quando há um projeto escolhido, a lista "O que fazer hoje" (que saiu do Painel). */
const CL_HORAS = Array.from({length:12}, (_, k) => 8 + k);
const CL_ALT = 48;   // altura de uma hora, em px
const clStatusCor = i => i.status === 'done' ? 'done' : atrasado(i) ? 'atraso' : i.status;
const clNomeSt = i => (typeof PO_SITU !== 'undefined' && poTemPO(i) ? PO_SITU[poSituacao(i)] : null) || stNome(i.status);
function clEv(i, compacto){
  const p = pessoa(i.resp);
  return '<div class="ev cl-ev cl-' + clStatusCor(i) + '" draggable="' + podeEditar() + '" data-item="' + i.id + '" title="' + esc(i.titulo + ' · ' + clNomeSt(i) + (p ? ' · ' + p.nome : '')) + '">' +
    '<span class="cl-ev-t">' + esc(i.titulo) + '</span>' + (compacto ? '' : '<span class="cl-ev-m">' + esc(clNomeSt(i)) + (p ? ' · ' + esc(ini(p.nome)) : '') + '</span>') + '</div>';
}
function clMarcos(di){
  const ms = typeof marcosDoEscopo === 'function' ? marcosDoEscopo(UI.sel) : [];
  return ms.filter(m => m.data === di).map(m => '<div class="ev marco cl-marco rc-ev-' + m.tipo + '" title="' + esc((m.tipo === 'release' ? 'Versão' : 'Marco') + ': ' + m.nome) + '">◆ ' + esc(m.nome) + '</div>').join('') +
    D.projects.filter(p => p.alvo === di).map(p => '<div class="ev marco cl-marco" title="Entrega prevista do projeto">◆ Entrega: ' + esc(p.nome) + '</div>').join('');
}
function clNumeros(l, dias){
  const set = new Set(dias.map(iso)), its = l.filter(i => set.has(i.fim));
  const ms = (typeof marcosDoEscopo === 'function' ? marcosDoEscopo(UI.sel) : []).filter(m => set.has(m.data)).length;
  const horas = dias.reduce((s, d) => s + cargaDoDia(iso(d)), 0);
  const n = (v, rot, cls) => '<div class="cl-num' + (cls ? ' ' + cls : '') + '"><b>' + v + '</b><span>' + rot + '</span></div>';
  return '<div class="cl-nums">' + n(its.length, its.length === 1 ? 'prazo' : 'prazos') + n(its.filter(i => atrasado(i)).length, 'atrasados', its.some(i => atrasado(i)) ? 'ruim' : '') +
    n(its.filter(i => i.status === 'done').length, 'concluídos', 'bom') + n(ms, ms === 1 ? 'entrega' : 'entregas') + n(Math.round(horas) + 'h', 'previstas') + '</div>';
}
vCalendar = function(){
  const ref = parse(UI.calRef) || HOJE, hoje = iso(HOJE), agora = new Date();
  const l = listaFiltrada();
  const modos = [['mes','Mês'],['semana','Semana'],['dia','Dia'],['agenda','Agenda']];
  const fds = d => d.getDay() === 0 || d.getDay() === 6;
  let titulo = '', sub = '', corpo = '', dias = [];
  if (UI.calModo === 'mes'){
    titulo = MESES[ref.getMonth()]; sub = String(ref.getFullYear());
    const primeiro = new Date(ref.getFullYear(), ref.getMonth(), 1), ini0 = dAdd(primeiro, -primeiro.getDay());
    dias = Array.from({length:new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate()}, (_, k) => new Date(ref.getFullYear(), ref.getMonth(), k + 1));
    const cargas = Array.from({length:42}, (_, k) => cargaDoDia(iso(dAdd(ini0, k)))), maxC = Math.max(8, ...cargas);
    corpo = '<div class="mes cl-mes">' + DSEM.map((d, k) => '<div class="dsem' + (k === 0 || k === 6 ? ' fds' : '') + '">' + d + '</div>').join('');
    for (let k = 0; k < 42; k++){
      const d = dAdd(ini0, k), di = iso(d), its = l.filter(i => i.fim === di);
      corpo += '<div class="dia cl-dia' + (d.getMonth() !== ref.getMonth() ? ' fora' : '') + (di === hoje ? ' hoje' : '') + (fds(d) ? ' fds' : '') + (di < hoje ? ' passou' : '') + '" data-soltar-data="' + di + '">' +
        '<div class="cl-dia-cab"><span class="dn">' + d.getDate() + '</span>' + (di === hoje ? '<span class="cl-hoje-tag">Hoje</span>' : '') + (cargas[k] >= 1 ? '<span class="cl-carga" title="' + cargas[k].toFixed(0) + 'h previstas"><i style="width:' + Math.min(100, cargas[k] / maxC * 100) + '%"></i></span>' : '') + '</div>' +
        clMarcos(di) + its.slice(0, 3).map(i => clEv(i, true)).join('') +
        (its.length > 3 ? '<button class="cl-mais" type="button" data-cal-dia="' + di + '">+' + (its.length - 3) + ' itens</button>' : '') + '</div>';
    }
    corpo += '</div>';
  } else if (UI.calModo === 'semana' || UI.calModo === 'dia'){
    dias = UI.calModo === 'dia' ? [ref] : Array.from({length:7}, (_, k) => dAdd(ref, k - ref.getDay()));
    if (UI.calModo === 'dia'){ titulo = DSEM[ref.getDay()] + ', ' + ref.getDate(); sub = MESES[ref.getMonth()] + ' de ' + ref.getFullYear(); }
    else { const a = dias[0], b = dias[6]; titulo = a.getDate() + (a.getMonth() !== b.getMonth() ? ' de ' + MESES[a.getMonth()] : '') + ' a ' + b.getDate() + ' de ' + MESES[b.getMonth()]; sub = 'Semana · ' + b.getFullYear(); }
    const cargas = dias.map(d => cargaDoDia(iso(d))), maxC = Math.max(8, ...cargas);
    corpo = '<div class="semana cl-semana" style="--dias:' + dias.length + ';--alt:' + CL_ALT + 'px"><div class="topo cl-canto"></div>' +
      dias.map((d, k) => { const di = iso(d); return '<div class="topo cl-topo' + (di === hoje ? ' hoje' : '') + (fds(d) ? ' fds' : '') + '"><span class="cl-sem">' + DSEM[d.getDay()] + '</span><span class="cl-n">' + d.getDate() + '</span>' +
        '<span class="cl-carga-l"><span class="cl-carga" title="' + cargas[k].toFixed(0) + 'h previstas"><i style="width:' + Math.min(100, cargas[k] / maxC * 100) + '%"></i></span><small class="carga-dia">' + cargas[k].toFixed(0) + 'h</small></span></div>'; }).join('') +
      '<div class="h cl-h-prazo">Prazo</div>' + dias.map(d => '<div class="dia-todo' + (fds(d) ? ' fds' : '') + '" data-soltar-data="' + iso(d) + '">' + clMarcos(iso(d)) + l.filter(i => i.fim === iso(d)).map(i => clEv(i)).join('') + '</div>').join('');
    CL_HORAS.forEach(hh => {
      corpo += '<div class="h">' + String(hh).padStart(2, '0') + ':00</div>';
      dias.forEach(d => {
        const di = iso(d), blocos = l.filter(i => i.bloco && i.bloco.data === di && parseInt(i.bloco.ini, 10) === hh);
        const linha = di === hoje && agora.getHours() === hh ? '<span class="cl-agora" style="top:' + (agora.getMinutes() / 60 * CL_ALT) + 'px" aria-hidden="true"></span>' : '';
        corpo += '<div class="cel' + (fds(d) ? ' fds' : '') + (di === hoje ? ' hoje' : '') + '" data-bloco-dia="' + di + '" data-bloco-hora="' + hh + '">' + linha + blocos.map(i => { const [h1, m1] = i.bloco.ini.split(':').map(Number), [h2, m2] = i.bloco.fim.split(':').map(Number); const dur = Math.max(0.5, (h2 + m2 / 60) - (h1 + m1 / 60));
          return '<div class="ev bloco bloco-abs cl-bloco" data-abrir-item="' + i.id + '" style="top:' + (m1 / 60 * CL_ALT) + 'px;height:' + (dur * CL_ALT - 3) + 'px"><b>' + esc(i.bloco.ini + '–' + i.bloco.fim) + '</b><span>' + esc(i.titulo) + '</span></div>'; }).join('') + '</div>';
      });
    });
    corpo += '</div>';
  } else {
    titulo = 'Próximos dias'; sub = 'Agenda';
    const ds = [...new Set(l.filter(i => i.fim && parse(i.fim) >= dAdd(HOJE, -7)).map(i => i.fim))].sort().slice(0, 20);
    dias = ds.map(parse);
    corpo = ds.length ? '<div class="agenda cl-agenda">' + ds.map(di => { const d = parse(di), its = l.filter(i => i.fim === di);
      return '<div class="ag-dia cl-ag-dia' + (di === hoje ? ' hoje' : '') + (di < hoje ? ' passou' : '') + '"><div class="cl-ag-data"><span class="cl-sem">' + DSEM[d.getDay()] + '</span><span class="cl-n">' + d.getDate() + '</span><span class="cl-mes-c">' + MESES[d.getMonth()].slice(0, 3) + '</span>' + (di === hoje ? '<span class="cl-hoje-tag">Hoje</span>' : '') + '</div>' +
        '<div class="ag-itens">' + its.map(i => '<div class="ag-it cl-ag-it cl-' + clStatusCor(i) + '" data-abrir-item="' + i.id + '"><i class="cl-ponto" aria-hidden="true"></i><span class="cl-ag-tit">' + esc(i.titulo) + '<small>' + esc(caminhoTexto(i)) + '</small></span><span class="cl-ag-st">' + esc(clNomeSt(i)) + '</span><span class="cl-ag-av">' + avatar(i.resp) + '</span></div>').join('') + '</div></div>'; }).join('') + '</div>'
      : '<p class="vazio-linha">Nenhum prazo daqui para frente com esses filtros.</p>';
  }
  const cab = '<div class="cal-cab cl-cab"><div class="cl-tit"><small>' + esc(sub) + '</small><h3>' + esc(titulo) + '</h3></div>' +
    '<div class="cl-nav"><button class="btn sec peq" type="button" data-cal-nav="-1" aria-label="Anterior">‹</button><button class="btn sec peq" type="button" data-cal-nav="0">Hoje</button><button class="btn sec peq" type="button" data-cal-nav="1" aria-label="Próximo">›</button></div>' +
    '<span class="espaco"></span><div class="seg cl-seg" role="group" aria-label="Modo do calendário">' + modos.map(([k, n]) => '<button type="button" data-cal-modo="' + k + '" aria-pressed="' + (UI.calModo === k) + '">' + n + '</button>').join('') + '</div></div>';
  const leg = '<div class="legenda cl-leg"><span><i class="cl-l cl-todo"></i>A fazer</span><span><i class="cl-l cl-doing"></i>Em andamento</span><span><i class="cl-l cl-review"></i>Pronto para testar</span><span><i class="cl-l cl-done"></i>Concluído</span><span><i class="cl-l cl-atraso"></i>Atrasado</span><span><i class="cl-l cl-marco-l"></i>Entrega ou marco</span>' +
    '<span class="cl-dica">' + (UI.calModo === 'semana' || UI.calModo === 'dia' ? 'Clique num horário vazio para reservar um bloco; puxe a borda de baixo do bloco para mudar a duração.' : 'Arraste um item para outro dia para mudar o prazo.') + '</span></div>';
  const pj = cadeia(UI.sel).project, lado = pj && typeof pgHojeHTML === 'function' ? '<aside class="cl-lado">' + pgHojeHTML(UI.sel) + '</aside>' : '';
  return ferramentasHTML() + '<div class="cl-grade' + (lado ? ' com-lado' : '') + '"><div class="cl-principal">' + cab + clNumeros(l, dias) + '<div class="cl-corpo">' + corpo + '</div>' + leg + '</div>' + lado + '</div>';
};
// a linha de agora anda sozinha, sem redesenhar o calendário inteiro
setInterval(() => { if (UI.view !== 'calendar' || !$('.cl-semana')) return; const l = $('.cl-agora'); const a = new Date(); if (l && l.parentElement && +l.parentElement.dataset.blocoHora === a.getHours()) l.style.top = (a.getMinutes() / 60 * CL_ALT) + 'px'; else if ((l || ($('.cl-semana .cel.hoje') && CL_HORAS.includes(a.getHours()))) && !$('dialog[open]') && !$('#gaveta-wrap .gaveta')) rView(); }, 60000);
