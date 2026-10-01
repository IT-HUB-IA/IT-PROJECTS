/* ===== Editar em lote =====
   Ajusta o que já existe com um texto simples. Um bloco por item (ou por grupo de itens), e embaixo só o que muda:
     editar: BL-12                       acha pela chave
     editar: Cadastro do cliente         acha pelo título (com "no épico: ..." quando há mais de um com o mesmo título)
     editar todos: épico Carteira        todos os itens de um épico (ou: versão v1.1, frente Backend)
       campo: valor                      uma linha por mudança
   A prévia mostra o antes e o depois de cada item e o total afetado. Com qualquer erro, nada é gravado.
   Tudo vai para o histórico do item (o banco grava quem, quando e o que mudou) e o último lote pode ser desfeito. */
const LE_CAMPOS = {'titulo':'titulo', 'novo titulo':'titulo', 'renomear':'titulo', 'como':'quem', 'quero':'quero', 'para':'para', 'historia':'historia',
  'prioridade':'prioridade', 'classe':'classe', 'nivel':'nivel', 'valor':'valor', 'pontos':'pontos', 'estimativa':'pontos', 'tipo':'tipo',
  'responsavel':'responsavel', 'prazo':'prazo', 'epico':'epico', 'versao':'versao', 'frente':'frente', 'posicao':'posicao',
  'aceite':'aceite', 'tirar aceite':'tiraraceite', 'trocar aceites':'trocaraceites', 'depende':'depende', 'tirar depende':'tirardepende', 'trocar depende':'trocardepende',
  'arquivar':'arquivar', 'cancelar':'cancelar', 'reabrir':'reabrir', 'mudar aceito':'mudaraceito', 'meta':'meta',
  'situacao':'situacao', 'status':'situacao', 'motivo':'motivo', 'inicio':'inicio', 'data de inicio':'inicio', 'onde':'onde', 'descricao':'descricao',
  'horas':'horas', 'estimativa em horas':'horas', 'data alvo':'alvo', 'data prevista':'alvo', 'cliente ve':'clienteve', 'visibilidade':'clienteve', 'sprint':'sprint'};
const LE_DET = ['quem', 'quero', 'para', 'historia', 'prioridade', 'classe', 'nivel', 'valor', 'pontos', 'tipo', 'responsavel', 'prazo'];
const LE_PROTEGE = ['quem', 'quero', 'para', 'historia', 'aceite', 'tiraraceite', 'trocaraceites'];
const LE_EXEMPLO = 'editar: BL-12\n  titulo: Cadastro do pagador com CPF\n  prioridade: Deve 2\n  pontos: 5\n  aceite: Mostra a data do cadastro\n  tirar aceite: Funciona no celular\n  situação: Pronto para testar\n  início: 05/10/2026\n  prazo: 15/10/2026\n\neditar: Tela da lista da carteira\n  no épico: Carteira de clientes\n  versão: v1.1\n  posição: topo\n  depende: BL-12\n\neditar todos: épico Carteira de clientes\n  versão: v1.2\n\neditar: BL-20\n  cancelar: virou parte do BL-12';
const leNorm = s => ltNorm(s);
const leCh = x => (typeof chaveDe === 'function' && chaveDe(x)) || '';
const leNome = x => x ? ((leCh(x) ? leCh(x) + ' · ' : '') + x.titulo) : '';
function leDoProjeto(){ const pj = cadeia(UI.sel).project; return pj ? D.issues.filter(x => { const p = poProjeto(x); return p && p.id === pj.id; }) : []; }
// acha um item pela chave ou pelo título (no épico, se veio); devolve {x} ou {erro}
function leAchar(ref, noEpico, lista, incluirArquivados){
  const n = leNorm(ref), L = lista.filter(x => incluirArquivados || !x.arquivado);
  const porChave = L.filter(x => leNorm(leCh(x)) === n); if (porChave.length === 1) return {x:porChave[0]};
  let porTit = L.filter(x => leNorm(x.titulo) === n);
  if (noEpico){ const ep = leAchar(noEpico, null, lista.filter(x => x.tipo === 'epic')); if (ep.erro) return {erro:'o épico "' + noEpico + '" ' + ep.erro.replace(/^[^ ]+ /, '')}; porTit = porTit.filter(x => x.pai === ep.x.id); }
  if (porTit.length === 1) return {x:porTit[0]};
  if (!porTit.length) return {erro:'"' + ref + '" não existe neste projeto: use a chave (BL-12) ou o título exato'};
  return {erro:'"' + ref + '" é ambíguo: ' + porTit.length + ' itens com esse título (' + porTit.slice(0, 5).map(leCh).filter(Boolean).join(', ') + '). Use a chave ou a linha "no épico:"'};
}
// situação: os nomes do método (Criado, Priorizado...), os do fluxo padrão (To Do...) e os do fluxo do projeto
function leSituacao(txt){
  const n = leNorm(txt);
  const po = Object.entries(PO_SITU).find(([, nome]) => leNorm(nome) === n); if (po) return po[0] === 'voltou' ? {voltou:true, status:'todo'} : {status:po[0]};
  const st = STATUS.find(x => leNorm(x.nome) === n || x.id === n); if (st) return {status:st.id};
  const c = (typeof statusDoEscopo === 'function' ? statusDoEscopo(UI.sel) : D.statusCustom || []).find(x => leNorm(x.nome) === n); if (c) return {status:c.grupo, st:c.id};
  return null;
}
// onde: "Aplicação › Frente", uma frente, uma aplicação, um produto, um projeto ou um cliente (como na coluna Onde da Lista)
const LE_ONDE_TIPOS = {cliente:'clients', projeto:'projects', produto:'products', aplicacao:'apps', app:'apps', frente:'ws'};
function leOnde(txt){
  let v = String(txt || '').trim(), tipo = null;
  const vivo = o => o && o.status !== 'archived';
  const partes = v.split(/\s*[›>]\s*/).filter(Boolean);
  // "projeto BL", "aplicação Java Fiscal": a primeira palavra diz o que é, a não ser que o nome inteiro já exista (ex.: "App celular do CEO")
  const mt = /^(cliente|projeto|produto|aplicação|aplicacao|app|frente)\s+(.+)$/i.exec(v);
  const existe = n => ['clients','projects','products','apps','ws'].some(c => (D[c] || []).some(o => vivo(o) && leNorm(o.nome) === leNorm(n)));
  if (mt && partes.length < 2 && !existe(v)){ tipo = LE_ONDE_TIPOS[leNorm(mt[1])]; v = mt[2].trim(); }
  if (partes.length >= 2){
    const fr = partes.pop(), apn = partes.pop();
    const aps = D.apps.filter(a => vivo(a) && leNorm(a.nome) === leNorm(apn)); if (!aps.length) return {erro:'a aplicação "' + apn + '" não existe'};
    const ws = D.ws.filter(w => vivo(w) && aps.some(a => a.id === w.app) && leNorm(w.nome) === leNorm(fr));
    if (ws.length === 1) return {ws:ws[0]}; return {erro:ws.length ? '"' + v + '" é ambíguo' : 'a aplicação "' + apn + '" não tem a frente "' + fr + '"'};
  }
  const achados = [];
  Object.entries({clients:'cliente', projects:'projeto', products:'produto', apps:'aplicação', ws:'frente'}).forEach(([col, rot]) => { if (tipo && tipo !== col) return; (D[col] || []).forEach(o => { if (vivo(o) && leNorm(o.nome) === leNorm(v)) achados.push({col, rot, o}); }); });
  if (!achados.length) return {erro:'"' + txt + '" não existe na estrutura: use o que a coluna Onde mostra (ex.: Java BL › Backend), ou o nome de uma frente, aplicação, produto, projeto ou cliente'};
  if (achados.length > 1) return {erro:'"' + txt + '" é ambíguo (' + achados.map(a => a.rot).join(', ') + '): escreva antes o que é, como "onde: aplicação ' + v + '", ou use "Aplicação › Frente"'};
  const a = achados[0]; if (a.col === 'ws') return {ws:a.o};
  const apps = D.apps.filter(ap => vivo(ap) && (a.col === 'apps' ? ap.id === a.o.id : a.col === 'products' ? ap.product === a.o.id : a.col === 'projects' ? ap.project === a.o.id : (byId('projects', ap.project) || {}).client === a.o.id));
  return {no:a, apps};
}
// para um item: a frente certa dentro do lugar pedido
function leOndePara(x, r){
  if (r.ws) return {ws:r.ws};
  const atual = byId('ws', x.ws); if (atual && r.apps.some(a => a.id === atual.app)) return {ws:atual, igual:true};
  if (r.apps.length !== 1) return {erro:r.apps.length ? r.no.rot + ' "' + r.no.o.nome + '" tem ' + r.apps.length + ' aplicações: diga qual, como "onde: ' + r.apps[0].nome + ' › ' + (atual ? atual.nome : 'Frente') + '"' : r.no.rot + ' "' + r.no.o.nome + '" não tem aplicação'};
  const ws = D.ws.filter(w => w.app === r.apps[0].id && w.status !== 'archived'), mesmo = atual && ws.find(w => leNorm(w.nome) === leNorm(atual.nome));
  if (mesmo) return {ws:mesmo}; if (ws.length === 1) return {ws:ws[0]};
  return {erro:'a aplicação "' + r.apps[0].nome + '" tem ' + ws.length + ' frentes' + (ws.length ? ' (' + ws.map(w => w.nome).join(', ') + '): diga qual, como "onde: ' + r.apps[0].nome + ' › ' + ws[0].nome + '"' : '')};
}
function leLer(texto){
  const proj = leDoProjeto(), blocos = [], erros = [], avisos = [];
  let b = null;
  const erro = (linha, msg, alvo) => { const e = {linha, msg}; erros.push(e); if (alvo) alvo.erros.push(e); };
  String(texto || '').split(/\r?\n/).forEach((bruta, k) => {
    const l = bruta.trim(); if (!l || l.startsWith('#')) return;
    const m = /^([A-Za-zÀ-ÿ ]{2,30}):\s*(.*)$/.exec(l);
    if (!m){ erro(k + 1, 'linha sem "campo: valor". Comece cada bloco com editar: e escreva embaixo uma mudança por linha', b); return; }
    const chave = leNorm(m[1]), val = m[2].trim();
    if (chave === 'editar' || chave === 'editar todos'){ b = {linha:k + 1, ref:val, todos:chave === 'editar todos', ops:[], erros:[], avisos:[], alvos:[]}; blocos.push(b); if (!val) erro(k + 1, 'falta dizer qual item editar', b); return; }
    if (!b){ erro(k + 1, 'comece com "editar: BL-12" (ou o título do item) antes das mudanças'); return; }
    if (chave === 'no epico'){ b.noEpico = val; return; }
    const op = LE_CAMPOS[chave];
    if (!op){ erro(k + 1, 'campo "' + m[1].trim() + '" não existe no Editar em lote', b); return; }
    if (!val){ erro(k + 1, 'falta o valor depois de "' + m[1].trim() + ':"', b); return; }
    b.ops.push({op, val, linha:k + 1});
  });
  const pj = cadeia(UI.sel).project;
  blocos.forEach(b => {
    if (b.erros.length && !b.ref) return;
    // os alvos
    if (b.todos){
      const mm = /^(epico|versao|frente)\s+(.+)$/.exec(leNorm(b.ref));
      if (!mm){ erro(b.linha, 'editar todos: use "épico Nome", "versão v1.2" ou "frente Backend"', b); return; }
      const nomeOrig = b.ref.trim().split(/\s+/).slice(1).join(' ');
      if (mm[1] === 'epico'){ const ep = leAchar(nomeOrig, null, proj.filter(x => x.tipo === 'epic')); if (ep.erro){ erro(b.linha, 'épico ' + ep.erro, b); return; } b.alvos = proj.filter(x => !x.arquivado && x.pai === ep.x.id); b.grupo = 'épico ' + ep.x.titulo; }
      if (mm[1] === 'versao'){ const v = ltVersoesDoProjeto().find(v => leNorm(v.nome) === leNorm(nomeOrig)); if (!v){ erro(b.linha, 'a versão "' + nomeOrig + '" não existe', b); return; } b.alvos = proj.filter(x => !x.arquivado && x.tipo !== 'epic' && x.marco === v.id); b.grupo = 'versão ' + v.nome; }
      if (mm[1] === 'frente'){ const fs = ltFrentes().filter(w => leNorm(w.nome) === leNorm(nomeOrig)); if (!fs.length){ erro(b.linha, 'a frente "' + nomeOrig + '" não existe aqui', b); return; } const ids = new Set(fs.map(w => w.id)); b.alvos = proj.filter(x => !x.arquivado && x.tipo !== 'epic' && ids.has(x.ws)); b.grupo = 'frente ' + fs[0].nome; }
      if (!b.alvos.length) erro(b.linha, 'nenhum item em ' + b.grupo, b);
      if (b.ops.some(o => o.op === 'titulo')) erro(b.linha, 'renomear não vale para vários itens de uma vez: use editar: com um item só', b);
    } else {
      const r = leAchar(b.ref, b.noEpico, proj, b.ops.some(o => o.op === 'reabrir'));
      if (r.erro){ erro(b.linha, r.erro, b); return; }
      b.alvos = [r.x];
    }
    // os valores
    b.det = {};
    b.ops.forEach(o => {
      if (LE_DET.includes(o.op)){ const e = ltDetalhe(o.op, o.val, b.det, pj); if (e) erro(o.linha, e, b); return; }
      if (o.op === 'titulo'){ if (o.val.length > 300) erro(o.linha, 'o título passa de 300 letras', b); return; }
      if (o.op === 'epico'){ if (['nenhum','sem epico'].includes(leNorm(o.val))){ o.alvo = null; return; } const r = leAchar(o.val, null, proj.filter(x => x.tipo === 'epic')); if (r.erro) erro(o.linha, 'épico ' + r.erro, b); else o.alvo = r.x; return; }
      if (o.op === 'versao'){ if (['nenhuma','sem versao'].includes(leNorm(o.val))){ o.alvo = null; return; } const v = ltVersoesDoProjeto().find(v => leNorm(v.nome) === leNorm(o.val)); if (!v) erro(o.linha, 'a versão "' + o.val + '" não existe: crie antes (Criar em lote, com versão: e entrega:)', b); else o.alvo = v; return; }
      if (o.op === 'frente'){ const f = ltFrentes().find(w => leNorm(w.nome) === leNorm(o.val)); if (!f) erro(o.linha, 'a frente "' + o.val + '" não existe aqui', b); else o.alvo = f; return; }
      if (o.op === 'posicao'){ const n = leNorm(o.val); if (n === 'topo' || n === 'fim'){ o.onde = n; return; }
        const mm = /^(depois de|antes de)\s+(.+)$/.exec(n); if (!mm){ erro(o.linha, 'posição: use topo, fim, "depois de BL-12" ou "antes de BL-12"', b); return; }
        const r = leAchar(o.val.replace(/^\s*(depois|antes)\s+de\s+/i, ''), null, proj); if (r.erro){ erro(o.linha, 'posição: ' + r.erro, b); return; } o.onde = mm[1] === 'depois de' ? 'depois' : 'antes'; o.alvo = r.x; return; }
      if (o.op === 'aceite' || o.op === 'tiraraceite'){ if (o.val.length > 500) erro(o.linha, 'o critério passa de 500 letras', b); return; }
      if (['trocaraceites','trocardepende','reabrir','mudaraceito'].includes(o.op)){ if (leNorm(o.val) !== 'sim') erro(o.linha, 'escreva "sim" para confirmar', b); return; }
      if (o.op === 'depende' || o.op === 'tirardepende'){ const r = leAchar(o.val, null, proj); if (r.erro) erro(o.linha, 'depende: ' + r.erro, b); else o.alvo = r.x; return; }
      if (o.op === 'arquivar' || o.op === 'cancelar'){ if (o.val.length > 500) erro(o.linha, 'o motivo passa de 500 letras', b); return; }
      if (o.op === 'situacao'){ o.alvo = leSituacao(o.val); if (!o.alvo) erro(o.linha, 'situação "' + o.val + '" não existe neste projeto: use Criado, Priorizado, Em andamento, Pronto para testar, Aceito ou Voltou', b);
        else if (o.alvo.voltou && !b.ops.some(m => m.op === 'motivo')) erro(o.linha, 'Voltou precisa do motivo: escreva embaixo "motivo: o que não ficou certo"', b); return; }
      if (o.op === 'motivo'){ if (!b.ops.some(m => m.op === 'situacao' && leNorm(m.val) === 'voltou')) erro(o.linha, 'motivo: vale só com "situação: Voltou"', b); else if (o.val.length > 1000) erro(o.linha, 'o motivo passa de 1000 letras', b); return; }
      if (o.op === 'inicio' || o.op === 'alvo'){ const rot = o.op === 'inicio' ? 'início' : 'data alvo'; if (['nenhum','nenhuma','sem data','sem inicio'].includes(leNorm(o.val))){ o.data = null; return; }
        o.data = ltDataEntrega(o.val); if (!o.data) erro(o.linha, rot + ' "' + o.val + '" não vale: use dia/mês/ano (ex.: ' + rot + ': 05/10/2026)', b); return; }
      if (o.op === 'onde'){ const r = leOnde(o.val); if (r.erro) erro(o.linha, 'onde: ' + r.erro, b); else o.alvo = r; return; }
      if (o.op === 'descricao'){ if (o.val.length > 10000) erro(o.linha, 'a descrição passa de 10000 letras', b); return; }
      if (o.op === 'horas'){ const n = Number(String(o.val).replace(',', '.').replace(/\s*h(oras)?$/i, '')); if (!isFinite(n) || n < 0 || n > 10000) erro(o.linha, 'horas "' + o.val + '" não vale: use um número de 0 a 10000 (ex.: horas: 6)', b); else o.num = n; return; }
      if (o.op === 'clienteve'){ const n = leNorm(o.val); if (['sim','cliente','visivel','visivel ao cliente'].includes(n)) o.vis = 'cliente'; else if (['nao','interno','so interno'].includes(n)) o.vis = 'interno'; else erro(o.linha, 'cliente vê: escreva sim ou não', b); return; }
      if (o.op === 'sprint'){ if (['nenhum','nenhuma','sem sprint','tirar'].includes(leNorm(o.val))){ o.alvo = null; return; } const sp = (typeof sprintsDoEscopo === 'function' ? sprintsDoEscopo(UI.sel) : D.sprints || []).find(x => leNorm(x.nome) === leNorm(o.val)); if (!sp) erro(o.linha, 'o sprint "' + o.val + '" não existe neste projeto', b); else o.alvo = sp; return; }
    });
    if (b.erros.length) return;
    // simula em cada item para mostrar o antes e o depois (e achar o que só aparece item a item)
    b.sim = b.alvos.map(x => { const c = JSON.parse(JSON.stringify(x)); const av = [], er = []; leAplicar(c, b, false, av, er); er.forEach(m => erro(b.linha, leNome(x) + ': ' + m, b)); av.forEach(m => b.avisos.push(leNome(x) + ': ' + m)); return {x, c, mud:leDiff(x, c)}; });
  });
  blocos.forEach(b => b.avisos.forEach(a => avisos.push(a)));
  const afetados = new Set(); blocos.forEach(b => (b.sim || []).forEach(s => { if (s.mud.length) afetados.add(s.x.id); }));
  return {blocos, erros, avisos, afetados:afetados.size};
}
// aplica as mudanças de um bloco num item (real = no item de verdade; senão, numa cópia para a prévia)
function leAplicar(x, b, real, avisos, erros){
  const tem = op => b.ops.some(o => o.op === op);
  if (x.status === 'done' && b.ops.some(o => LE_PROTEGE.includes(o.op))){
    if (!tem('mudaraceito')){ erros.push('já foi aceito: a história e os critérios estão protegidos. Crie uma Melhoria, ou escreva "mudar aceito: sim" (o item volta para Priorizado)'); return; }
    avisos.push('estava aceito e volta para Priorizado, porque a história ou os critérios mudam (mudar aceito: sim)');
    x.status = 'todo'; x.feito = null; delete x.st;
  }
  if (tem('trocaraceites')){ const marc = (x.crit || []).filter(c => c.f); if (marc.length) avisos.push('saem ' + marc.length + (marc.length === 1 ? ' critério marcado como cumprido' : ' critérios marcados como cumpridos') + ' (trocar aceites)'); x.crit = []; }
  if (tem('trocardepende')){ x.links = (x.links || []).filter(l => l.tipo !== 'Is blocked by'); x._depFora = poDeps(x).map(o => o.id); if (real) D.issues.forEach(o => { if (o.links) o.links = o.links.filter(l => !(l.tipo === 'Blocks' && l.alvo === x.id)); }); }
  b.ops.forEach(o => {
    if (o.op === 'titulo') x.titulo = o.val;
    else if (o.op === 'epico'){ const ep = o.alvo; if (ep && ep.id === x.id){ erros.push('não fica dentro de si mesmo'); return; } if (x.tipo === 'epic'){ erros.push('épico não fica dentro de outro épico'); return; }
      if (ep && (byId('ws', ep.ws) || {}).app !== (byId('ws', x.ws) || {}).app){ erros.push('o épico "' + ep.titulo + '" é de outra aplicação'); return; } x.pai = ep ? ep.id : null; if (x.tipo === 'task' && ep && !x.externa && !x.decisao) x.tipo = 'story'; }
    else if (o.op === 'versao') x.marco = o.alvo ? o.alvo.id : null;
    else if (o.op === 'frente'){ const pai = x.pai && byId('issues', x.pai); if (pai && (byId('ws', pai.ws) || {}).app !== o.alvo.app){ erros.push('a frente "' + o.alvo.nome + '" é de outra aplicação que o épico do item'); return; } x.ws = o.alvo.id; }
    else if (o.op === 'posicao'){ const fila = D.issues.filter(y => !y.arquivado && y.id !== x.id && poTemPO(y) && y.status !== 'done' && (byId('ws', y.ws) || {}).app === (byId('ws', x.ws) || {}).app).sort((a, c) => (+a.ordem || 0) - (+c.ordem || 0));
      if (o.onde === 'topo') x.ordem = fila.length ? (+fila[0].ordem || 0) - 1 : 0;
      else if (o.onde === 'fim') x.ordem = fila.length ? (+fila[fila.length - 1].ordem || 0) + 1 : 0;
      else { const k = fila.findIndex(y => y.id === o.alvo.id); if (k < 0){ erros.push('o item "' + o.alvo.titulo + '" não está na fila desta aplicação'); return; }
        const a = +fila[k].ordem || 0, viz = o.onde === 'depois' ? fila[k + 1] : fila[k - 1];
        x.ordem = viz ? (a + (+viz.ordem || 0)) / 2 : a + (o.onde === 'depois' ? 1 : -1); } }
    else if (o.op === 'aceite'){ x.crit = x.crit || []; if (!x.crit.some(c => leNorm(c.t) === leNorm(o.val))) x.crit.push({t:o.val, f:false}); }
    else if (o.op === 'tiraraceite'){ const c = (x.crit || []).find(c => leNorm(c.t) === leNorm(o.val)); if (!c){ erros.push('não tem o critério "' + o.val + '"'); return; } if (c.f) avisos.push('o critério "' + c.t + '" estava marcado como cumprido e sai'); x.crit = x.crit.filter(y => y !== c); }
    else if (o.op === 'depende'){ if (o.alvo.id === x.id){ erros.push('não depende de si mesmo'); return; } ltDepender(x, o.alvo.id); }
    else if (o.op === 'tirardepende'){ const antes = poDeps(x).some(d => d.id === o.alvo.id) || (x.links || []).some(l => l.tipo === 'Is blocked by' && l.alvo === o.alvo.id); if (!antes){ erros.push('não depende de "' + o.alvo.titulo + '"'); return; }
      x.links = (x.links || []).filter(l => !(l.tipo === 'Is blocked by' && l.alvo === o.alvo.id)); (x._depFora = x._depFora || []).push(o.alvo.id);
      if (real){ const y = byId('issues', o.alvo.id); if (y) y.links = (y.links || []).filter(l => !(l.tipo === 'Blocks' && l.alvo === x.id)); } }
    else if (o.op === 'arquivar' || o.op === 'cancelar'){ if (x.arquivado){ erros.push('já está arquivado'); return; } x.arquivado = true; if (o.op === 'cancelar') x.resolucao = 'nao_sera_feito';
      x.coments = (x.coments || []).concat([{quem:eu(), txt:(o.op === 'cancelar' ? 'Cancelado' : 'Arquivado') + ' pelo Editar em lote. Motivo: ' + o.val, quando:iso(HOJE), cliente:false}]); }
    else if (o.op === 'reabrir'){ if (!x.arquivado && x.resolucao !== 'nao_sera_feito'){ erros.push('não está arquivado nem cancelado'); return; } x.arquivado = false; delete x._arq; x.resolucao = null;
      x.coments = (x.coments || []).concat([{quem:eu(), txt:'Reaberto pelo Editar em lote.', quando:iso(HOJE), cliente:false}]); }
    else if (o.op === 'meta'){ if (x.tipo !== 'epic'){ erros.push('a meta é só do épico'); return; } x.meta = o.val; }
  });
  const ini0 = x.ini;
  if (b.det && Object.keys(b.det).length){ const det = Object.assign({}, b.det); if (det.historia) delete det.historia; ltAplicar(x, det); }
  x.ini = ini0;   // o prazo do lote não puxa o início sozinho: início depois do prazo é erro
  b.ops.forEach(o => {
    if (o.op === 'inicio') x.ini = o.data;
    else if (o.op === 'alvo') x.alvo = o.data;
    else if (o.op === 'descricao') x.desc = o.val;
    else if (o.op === 'horas') x.est = o.num;
    else if (o.op === 'clienteve') x.vis = o.vis;
    else if (o.op === 'sprint') x.sprint = o.alvo ? o.alvo.id : undefined;
    else if (o.op === 'onde'){ const r = leOndePara(x, o.alvo); if (r.erro){ erros.push(r.erro); return; } if (r.igual) return;
      const ap = r.ws.app, pai = x.pai && byId('issues', x.pai);
      if (pai && (byId('ws', pai.ws) || {}).app !== ap){ erros.push('o épico "' + pai.titulo + '" fica em outra aplicação: mova o épico, ou tire o item dele (épico: nenhum)'); return; }
      if (x.tipo === 'epic' && D.issues.some(f => f.pai === x.id && !f.arquivado && (byId('ws', f.ws) || {}).app !== ap && !b.alvos.some(y => y.id === f.id))){ erros.push('o épico tem itens na aplicação de agora: mova os itens junto (editar todos: épico ' + x.titulo + ')'); return; }
      x.ws = r.ws.id; }
  });
  if (x.ini && x.fim && x.ini > x.fim && b.ops.some(o => ['inicio','prazo'].includes(o.op))) erros.push('o início (' + fmtData(x.ini) + ') fica depois do prazo (' + fmtData(x.fim) + ')');
  const so = b.ops.find(o => o.op === 'situacao'); if (so && so.alvo) leMudarSituacao(x, so.alvo, (b.ops.find(o => o.op === 'motivo') || {}).val, tem('mudaraceito'), real, avisos, erros);
}
// a situação pelas mesmas regras da tela: Aceitar e Devolver só o P.O. (sem P.O., qualquer um do time), Aceito só com todos os critérios marcados
function leMudarSituacao(x, alvo, motivo, mudarAceito, real, avisos, erros){
  const antes = poSituacao(x), novo = alvo.voltou ? 'voltou' : alvo.status;
  if (novo === antes && (alvo.st || null) === (x.st || null)) return;
  const metodo = poTemPO(x), po = metodo && poDoPO(x);
  if (x.status === 'done' && novo !== 'done' && !mudarAceito){ erros.push('já foi aceito: para tirar de Aceito, escreva "mudar aceito: sim"'); return; }
  if (novo === 'done' && metodo){
    if (po && po.id !== eu()){ erros.push('só o P.O. do projeto (' + po.nome + ') aceita: leve para Pronto para testar'); return; }
    const c = poCritConta(x); if (c.f < c.n){ erros.push('não vai para Aceito com ' + (c.n - c.f) + (c.n - c.f === 1 ? ' critério desmarcado' : ' critérios desmarcados')); return; }
  }
  if (alvo.voltou){
    if (!metodo){ erros.push('Voltou é do método do P.O. (história, tarefa ou bug)'); return; }
    if (po && po.id !== eu()){ erros.push('só o P.O. do projeto (' + po.nome + ') devolve'); return; }
    if (x.status !== 'review'){ erros.push('só volta quem está em Pronto para testar (agora: ' + (PO_SITU[antes] || antes) + ')'); return; }
    x.voltou = new Date().toISOString(); x.voltouMotivo = motivo || '';
  } else if (['review','done'].includes(alvo.status)) x.voltou = null;
  if (['doing','review','done'].includes(alvo.status) && ['backlog','todo'].includes(x.status) && poDepsAbertas(x).length) avisos.push('depende de ' + poDepsAbertas(x).map(y => y.titulo).join(', ') + ', que ainda não foi aceito');
  x.status = alvo.status; if (alvo.st) x.st = alvo.st; else delete x.st;
  x.feito = alvo.status === 'done' ? iso(HOJE) : null;
  if (real && typeof registrar === 'function') registrar(alvo.status === 'done' ? 'concluiu' : 'status', x, x.titulo + ' → ' + (PO_SITU[novo] || stNome(alvo.status)));
}
const leSitNome = x => { const c = x.st && (D.statusCustom || []).find(y => y.id === x.st); return c ? c.nome : PO_SITU[poSituacao(x)] || stNome(x.status); };
// o antes e o depois, campo a campo
function leDiff(a, c){
  const pes = id => { const p = id && pessoa(id); return p ? p.nome : ''; }, it = id => { const y = id && byId('issues', id); return y ? y.titulo : ''; }, mc = id => { const m = id && byId('marcos', id); return m ? m.nome : ''; }, wsn = id => { const w = id && byId('ws', id); return w ? w.nome : ''; }, spn = id => { const x = id && (D.sprints || []).find(y => y.id === id); return x ? x.nome : ''; };
  const deps = (x, fora) => poDeps(x).map(y => y.id).concat((x.links || []).filter(l => l.tipo === 'Is blocked by').map(l => l.alvo)).filter((v, k, l) => l.indexOf(v) === k && !(fora || []).includes(v)).map(it).sort().join(', ');
  const L = [['Título', a.titulo, c.titulo], ['Como', a.hQuem, c.hQuem], ['Quero', a.hQuero, c.hQuero], ['Para', a.hPara, c.hPara],
    ['Prioridade', poMoscowNome(a.moscow), poMoscowNome(c.moscow)], ['Nível', poNivel(a), poNivel(c)], ['Valor', a.valor || '', c.valor || ''], ['Pontos', a.pontos || '', c.pontos || ''],
    ['Tipo', (PO_TIPOS.find(t => t[0] === poTipo(a)) || [, '', ''])[1], (PO_TIPOS.find(t => t[0] === poTipo(c)) || [, '', ''])[1]], ['Responsável', pes(a.resp), pes(c.resp)], ['Início', a.ini ? fmtData(a.ini) : '', c.ini ? fmtData(c.ini) : ''], ['Prazo', a.fim ? fmtData(a.fim) : '', c.fim ? fmtData(c.fim) : ''], ['Data alvo', a.alvo ? fmtData(a.alvo) : '', c.alvo ? fmtData(c.alvo) : ''],
    ['Descrição', String(a.desc || '').slice(0, 160), String(c.desc || '').slice(0, 160)], ['Horas', a.est || '', c.est || ''], ['Cliente vê', a.vis === 'cliente' ? 'sim' : 'não', c.vis === 'cliente' ? 'sim' : 'não'], ['Sprint', spn(a.sprint), spn(c.sprint)],
    ['Épico', it(a.pai), it(c.pai)], ['Versão', mc(a.marco), mc(c.marco)], ['Onde', caminhoTexto(a), caminhoTexto(c)], ['Posição na fila', a.ordem, c.ordem],
    ['Critérios', (a.crit || []).map(x => (x.f ? '✓ ' : '') + x.t).join(' | '), (c.crit || []).map(x => (x.f ? '✓ ' : '') + x.t).join(' | ')],
    ['Depende de', deps(a), deps(c, c._depFora)], ['Situação', leSitNome(a), leSitNome(c)],
    ['Arquivado', a.arquivado ? (a.resolucao === 'nao_sera_feito' ? 'cancelado' : 'sim') : 'não', c.arquivado ? (c.resolucao === 'nao_sera_feito' ? 'cancelado' : 'sim') : 'não'], ['Meta', a.meta || '', c.meta || '']];
  return L.filter(([, x, y]) => String(x == null ? '' : x) !== String(y == null ? '' : y)).map(([r, x, y]) => r === 'Posição na fila' ? [r, 'mudou de lugar', y > x ? 'mais para baixo' : 'mais para cima'] : [r, x, y]);
}
function lePreviaHTML(r){
  if (!r.blocos.length && !r.erros.length) return '<p class="lt-vazio">Escreva "editar: BL-12" e, embaixo, o que muda. A prévia mostra o antes e o depois.</p>';
  const v = s => s === '' || s == null ? '<i class="le-vazio">vazio</i>' : esc(String(s));
  return '<p class="lt-conta"><b>' + r.afetados + (r.afetados === 1 ? ' item afetado' : ' itens afetados') + '</b> em ' + r.blocos.length + (r.blocos.length === 1 ? ' bloco.' : ' blocos.') + (r.erros.length ? ' Com erro, nada é gravado.' : '') + '</p>' +
    (r.erros.length ? '<div class="lt-erros" role="alert"><b>' + r.erros.length + (r.erros.length === 1 ? ' erro: corrija para gravar' : ' erros: corrija para gravar') + '</b><ul>' + r.erros.map(e => '<li>' + (e.linha ? 'Linha ' + e.linha + ': ' : '') + esc(e.msg) + '</li>').join('') + '</ul></div>' : '') +
    (r.avisos.length ? '<ul class="lt-avisos">' + r.avisos.map(a => '<li>' + esc(a) + '</li>').join('') + '</ul>' : '') +
    r.blocos.map(b => '<section class="le-bloco' + (b.erros.length ? ' lt-com-erro' : '') + '"><div class="le-bloco-tit">Linha ' + b.linha + ': <b>' + esc(b.todos ? 'todos de ' + (b.grupo || b.ref) : b.ref) + '</b>' + (b.alvos.length ? ' <span class="lt-tag">' + b.alvos.length + (b.alvos.length === 1 ? ' item' : ' itens') + '</span>' : '') + '</div>' +
      (b.sim || []).slice(0, 60).map(s => '<div class="le-item"><div class="le-item-tit">' + esc(leNome(s.x)) + (s.mud.length ? '' : ' <span class="lt-tag">nada muda</span>') + '</div>' +
        (s.mud.length ? '<table class="le-dif"><thead><tr><th>Campo</th><th>Antes</th><th>Depois</th></tr></thead><tbody>' + s.mud.map(([c, a, d]) => '<tr><td>' + esc(c) + '</td><td>' + v(a) + '</td><td>' + v(d) + '</td></tr>').join('') + '</tbody></table>' : '') + '</div>').join('') +
      ((b.sim || []).length > 60 ? '<p class="lt-nota">E mais ' + (b.sim.length - 60) + ' itens com as mesmas mudanças.</p>' : '') + '</section>').join('');
}

/* ---------- o registro do último lote (criar ou editar), para Desfazer ---------- */
const LE_CHAVE = 'ciclodev-ultimo-lote';
function leUltimo(){ try { return JSON.parse(localStorage.getItem(LE_CHAVE) || 'null'); } catch(e){ return null; } }
// guarda como estavam os itens que o lote mexe (e os que ele cria) e roda a mudança
function leRegistrar(tipo, resumo, tocados, fazer){
  const pj = cadeia(UI.sel).project;
  const idsAntes = new Set(D.issues.map(x => x.id)), mcAntes = new Set(D.marcos.map(m => m.id));
  const antes = {}; (tocados || []).forEach(id => { const x = byId('issues', id); if (x) antes[id] = JSON.parse(JSON.stringify(x)); });
  const marcos = JSON.parse(JSON.stringify(D.marcos.filter(m => pj && dentroDe(m.no, 'project:' + pj.id) || (pj && m.no === 'project:' + pj.id))));
  const r = fazer();
  const reg = {tipo, resumo, quando:new Date().toISOString(), projeto:pj ? pj.id : null, dod:pj ? pj.dod || '' : '', antes, criados:D.issues.filter(x => !idsAntes.has(x.id)).map(x => x.id), marcosCriados:D.marcos.filter(m => !mcAntes.has(m.id)).map(m => m.id), marcos};
  try { localStorage.setItem(LE_CHAVE, JSON.stringify(reg)); } catch(e){ console.warn('Desfazer: não deu para guardar', e); }
  return r;
}
function leDesfazerHTML(){
  const u = leUltimo(); const pj = cadeia(UI.sel).project; if (!u || !pj || u.projeto !== pj.id) return '';
  return '<button type="button" class="btn fant peq le-desfazer" data-le-desfazer title="' + esc(u.tipo + ': ' + u.resumo) + '">Desfazer o último lote (' + esc(u.tipo) + ', ' + esc(poDataHora(u.quando)) + ')</button>';
}
function leDesfazer(){
  const u = leUltimo(); if (!u) return;
  const n = Object.keys(u.antes || {}).length, c = (u.criados || []).length;
  modal('Desfazer o último lote', '<p>' + esc(u.tipo) + ' de ' + esc(poDataHora(u.quando)) + ': ' + esc(u.resumo) + '.</p><p>Volta ' + n + (n === 1 ? ' item' : ' itens') + ' a como estavam e tira ' + c + (c === 1 ? ' item criado' : ' itens criados') + ' por ele. O que mudou depois nesses itens também volta. O histórico guarda tudo.</p>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Desfazer', acao:() => {
      Object.entries(u.antes || {}).forEach(([id, x]) => { const k = D.issues.findIndex(y => y.id === id); if (k >= 0) D.issues[k] = Object.assign(x, {chave:D.issues[k].chave || x.chave}); else D.issues.push(x); });
      const fora = new Set(u.criados || []); D.issues.forEach(x => { if (fora.has(x.pai)) fora.add(x.id); });
      D.issues = D.issues.filter(x => !fora.has(x.id)); D.issues.forEach(x => { if (x.links) x.links = x.links.filter(l => !fora.has(l.alvo)); });
      const mf = new Set(u.marcosCriados || []); D.marcos = D.marcos.filter(m => !mf.has(m.id)).map(m => (u.marcos || []).find(a => a.id === m.id) || m);
      const pj = byId('projects', u.projeto); if (pj) pj.dod = u.dod;
      try { localStorage.removeItem(LE_CHAVE); } catch(e){}
      document.querySelectorAll('dialog.modal').forEach(d => { if (d.open) d.close(); });
      salvar(); rView(); toast('Último lote desfeito.');
    }}]);
}
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-le-desfazer]')){ e.preventDefault(); leDesfazer(); } });

/* ---------- a janela ---------- */
function leAbrir(){
  if (!podeEditar()) return;
  if (!cadeia(UI.sel).project){ toast('Escolha um projeto (ou algo dentro dele) na Estrutura'); return; }
  const linhaG = (ex, txt) => '<tr><td><code>' + esc(ex) + '</code></td><td>' + txt + '</td></tr>';
  modal('Editar em lote',
    '<div class="lt-topo"><div class="lt-topo-t"><b>Ajustar o que já existe</b><span>Um bloco por item: "editar: BL-12" (ou o título) e, embaixo, só o que muda. A prévia mostra o antes e o depois; com qualquer erro, nada é gravado.</span></div>' +
      '<div class="lt-topo-b"><button type="button" class="btn peq" data-lt-ia-baixar>Baixar instruções</button><button type="button" class="btn sec peq" data-lt-ia-copiar>Copiar instruções</button><span class="lt-topo-sep" aria-hidden="true"></span>' +
      '<button type="button" class="btn fant peq" data-le-exemplo>Exemplo</button><button type="button" class="btn fant peq" data-le-criar>Ir para Criar em lote</button>' + leDesfazerHTML() + '</div></div>' +
    '<div class="lt-grade"><section class="lt-esq"><h3 class="lt-passo"><span>1</span><label for="le-t">Escreva ou cole as mudanças</label></h3>' +
      '<textarea class="campo lt-texto" id="le-t" rows="18" spellcheck="false" placeholder="' + esc(LE_EXEMPLO) + '"></textarea></section>' +
    '<section class="lt-dir"><h3 class="lt-passo"><span>2</span>Confira o antes e o depois</h3><div class="lt-previa le-previa" aria-live="polite">' + lePreviaHTML({blocos:[], erros:[], avisos:[], afetados:0}) + '</div>' +
      '<p class="lt-nota">Tudo vai para o histórico de cada item. O último lote pode ser desfeito.</p></section></div>' +
    '<details class="lt-guia"><summary>Como escrever: o que dá para mudar</summary><div class="lt-guia-rolo"><table class="lt-guia-t"><thead><tr><th>Escreva</th><th>O que acontece</th></tr></thead><tbody>' +
      linhaG('editar: BL-12', 'Começa o bloco do item, pela <b>chave</b> ou pelo <b>título</b>. Título repetido: acrescente <code>no épico: Nome</code>') +
      linhaG('editar todos: épico Carteira', 'Todos os itens de um <b>épico</b> (ou <code>versão v1.1</code>, <code>frente Backend</code>) recebem as mudanças') +
      linhaG('  titulo: Novo nome', '<b>Renomeia</b> (só com um item)') +
      linhaG('  como: / quero: / para: / historia:', 'Troca a <b>história</b>') +
      linhaG('  prioridade: Deve 2 / nivel / valor / pontos', 'Troca <b>prioridade, nível, valor e pontos</b>') +
      linhaG('  tipo: Item / Bug / Melhoria / Tarefa / Decisão', 'Troca o <b>tipo</b>. Tarefa é a tarefa externa (não é desenvolvimento). Decisão é algo a decidir, com <b>prazo:</b> da decisão') +
      linhaG('  responsavel: Ana  /  prazo: 15/11/2026', 'Troca <b>responsável</b> e <b>prazo</b>') +
      linhaG('  situação: Pronto para testar', 'Muda a <b>situação</b>: Criado, Priorizado, Em andamento, Pronto para testar, Aceito ou Voltou (com <code>motivo:</code>). Aceitar e devolver, só o P.O.') +
      linhaG('  início: 05/10/2026  /  data alvo: 20/10/2026', 'Troca o <b>início</b> e a <b>data alvo</b>. Início depois do prazo é erro') +
      linhaG('  onde: Java BL › Backend', 'Muda <b>onde</b> o item fica (a coluna Onde da Lista). Vale também uma frente, aplicação, produto, projeto ou cliente') +
      linhaG('  descrição: / horas: 6 / cliente vê: sim / sprint: Sprint 3', 'Troca <b>descrição</b>, <b>horas</b>, se o <b>cliente vê</b> e o <b>sprint</b>') +
      linhaG('  aceite: texto  /  tirar aceite: texto', '<b>Acrescenta</b> ou <b>tira</b> um critério (tirar um marcado avisa)') +
      linhaG('  trocar aceites: sim', 'Tira todos os critérios antes dos <code>aceite:</code> do bloco (substitui)') +
      linhaG('  épico: Nome / versão: v1.2 / frente: Backend', '<b>Move</b> para outro épico, versão ou frente (<code>nenhum</code> / <code>nenhuma</code> tira)') +
      linhaG('  posição: topo / fim / depois de BL-12', 'Muda o <b>lugar na fila</b>') +
      linhaG('  depende: BL-3  /  tirar depende: BL-3', 'Acrescenta ou tira uma <b>dependência</b>. <code>trocar depende: sim</code> tira todas antes') +
      linhaG('  arquivar: motivo  /  cancelar: motivo', '<b>Arquiva</b> ou <b>cancela</b>, com o motivo nos comentários. O histórico fica') +
      linhaG('  reabrir: sim', '<b>Reabre</b> um item arquivado ou cancelado') +
      linhaG('  mudar aceito: sim', 'Deixa mudar história e critérios de item <b>aceito</b> (ele volta para Priorizado). Sem isso, é erro') +
    '</tbody></table></div></details>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Gravar mudanças', acao:dl => {
      const r = leLer($('#le-t', dl).value);
      if (r.erros.length){ toast('Corrija os erros da prévia: nada foi gravado'); return false; }
      if (!r.afetados){ toast('Nada muda'); return false; }
      const tocados = new Set(); r.blocos.forEach(b => b.alvos.forEach(x => tocados.add(x.id)));
      r.blocos.forEach(b => b.ops.forEach(o => { if ((o.op === 'tirardepende' || o.op === 'trocardepende') && o.alvo) tocados.add(o.alvo.id); }));
      r.blocos.forEach(b => { if (b.ops.some(o => o.op === 'trocardepende')) b.alvos.forEach(x => poDeps(x).forEach(y => tocados.add(y.id))); });
      const resumo = r.afetados + (r.afetados === 1 ? ' item editado' : ' itens editados');
      tfComDesfazer(resumo + '.', () => leRegistrar('Editar em lote', resumo, [...tocados], () => {
        r.blocos.forEach(b => b.alvos.forEach(x0 => { const x = byId('issues', x0.id); if (!x) return;
          const antesSt = poSituacao(x); leAplicar(x, b, true, [], []); delete x._depFora;
          if (poSituacao(x) !== antesSt) poHistLocal(x, {tipo:'situacao', de:antesSt, para:poSituacao(x)});
          registrar('editou', x, x.titulo + ': editado em lote'); }));
      }));
    }}]);
  const dl = document.querySelector('dialog.modal:last-of-type'); if (!dl) return;
  dl.classList.add('lt-modal', 'le-modal');
  const ta = $('#le-t', dl), pv = $('.le-previa', dl);
  let t = 0; const atualizar = () => { clearTimeout(t); t = setTimeout(() => { pv.innerHTML = lePreviaHTML(leLer(ta.value)); }, 120); };
  ta.addEventListener('input', atualizar);
  $('[data-le-exemplo]', dl).addEventListener('click', () => { ta.value = LE_EXEMPLO; atualizar(); ta.focus(); });
  $('[data-le-criar]', dl).addEventListener('click', () => { dl.close(); dl.remove(); ltAbrir(); });
  $('[data-lt-ia-baixar]', dl).addEventListener('click', () => exBaixar('CicloDev - criar e editar em lote - instrucoes para IA - ' + (nomeDe(UI.sel) || 'geral'), '# Criar e editar em lote no CicloDev: instruções para um agente de IA\n\n' + ciLoteMd()));
  $('[data-lt-ia-copiar]', dl).addEventListener('click', e => enCopiar('# Criar e editar em lote no CicloDev: instruções para um agente de IA\n\n' + ciLoteMd(), e.currentTarget));
  ta.focus();
}
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-le-abrir]')){ e.preventDefault(); leAbrir(); } });
// na barra do topo: Editar em lote, ao lado de Em lote; e no Criar em lote, o caminho para cá e o Desfazer
const _criaBarraHTMLLe = criaBarraHTML;
criaBarraHTML = function(){ return _criaBarraHTMLLe.apply(this, arguments).replace('<span class="espaco"></span>', '<button type="button" class="btn sec peq" data-le-abrir title="Ajustar o que já existe: renomear, mover, trocar prioridade, critérios, dependências, arquivar">Editar em lote</button><span class="espaco"></span>'); };
const _ltAbrirLe = ltAbrir;
ltAbrir = function(){ const r = _ltAbrirLe.apply(this, arguments); const dl = document.querySelector('dialog.lt-modal:last-of-type'); const b = dl && $('.lt-topo-b', dl);
  if (b && !$('[data-le-ir]', b)){ b.insertAdjacentHTML('beforeend', '<button type="button" class="btn fant peq" data-le-ir>Ir para Editar em lote</button>' + leDesfazerHTML()); $('[data-le-ir]', b).addEventListener('click', () => { dl.close(); dl.remove(); leAbrir(); }); } return r; };
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {leLer, leAbrir, leDesfazer, leUltimo, ltAbrir});
