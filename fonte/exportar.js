/* ===== Baixar em .md =====
   Qualquer item (card), épico ou ponto da Estrutura (cliente, projeto, produto, aplicação, frente) vira um arquivo .md
   organizado, com só aquilo que foi escolhido, para mandar para outra pessoa ou para um agente de IA.
   Todo arquivo começa pela identificação: de que sistema veio, de onde é (o caminho na Estrutura), a chave e o id,
   quem exportou e quando. Depois vêm a situação, o conteúdo e as ligações com outras coisas. */
const EX_SISTEMA = 'CicloDev (IT.IA) · ciclodev.it-ia.tec.br';
const exData = d => { if (!d) return ''; const x = typeof d === 'number' ? new Date(d) : new Date(String(d).length === 10 ? d + 'T12:00:00' : d); return isNaN(x) ? String(d) : x.toLocaleDateString('pt-BR'); };
const exAgora = () => new Date().toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'});
const exPessoa = id => { const p = id && pessoa(id); return p ? p.nome : ''; };
const exMencoes = t => String(t || '').replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
const exChave = i => (typeof chaveDe === 'function' && chaveDe(i)) || '';
const exNomeItem = i => (exChave(i) ? exChave(i) + ' · ' : '') + i.titulo;
const exLinha = (rot, v) => v === '' || v == null || v === false ? '' : '- **' + rot + ':** ' + v + '\n';
const exCaminho = chave => caminho(chave).map(p => p[1]).join(' › ');
const EX_NIVEL = {client:'Cliente', project:'Projeto', product:'Produto', app:'Aplicação', ws:'Frente de trabalho'};
function exCabecalho(tipo, titulo){
  return '<!-- Exportado do ' + EX_SISTEMA + ' em ' + exAgora() + (exPessoa(idEu(UI.verComo)) ? ' por ' + exPessoa(idEu(UI.verComo)) : '') + '. ' + tipo + '. -->\n\n# ' + titulo + '\n\n';
}
function exStatus(i){ const c = i.st && D.statusCustom.find(s => s.id === i.st); return c ? c.nome : stNome(i.status); }
function exMinutos(i){ const m = Math.round((i.tempo || []).reduce((s, t) => s + (((t.fim || Date.now()) - t.ini) / 60000 || 0), 0)); return m ? Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'min' : ''; }

// a parte de identificação de um item: de onde é e com o que está ligado
function exIdentItem(i){
  const ep = i.pai && byId('issues', i.pai), mc = i.marco && D.marcos.find(m => m.id === i.marco), sp = i.sprint && D.sprints.find(s => s.id === i.sprint);
  return '## Identificação\n\n' +
    exLinha('Sistema', EX_SISTEMA) +
    exLinha('Chave', exChave(i)) +
    exLinha('Tipo', tipoNome(i.tipo)) +
    exLinha('Onde fica', exCaminho('ws:' + i.ws) + ' (cliente › projeto › produto › aplicação › frente)') +
    exLinha(i.tipo === 'subtask' ? 'Item de cima' : 'Épico', ep ? exNomeItem(ep) : '') +
    exLinha('Versão', mc ? mc.nome : '') +
    exLinha('Sprint', sp ? sp.nome : '') +
    exLinha('Id interno', '`' + i.id + '`') + '\n';
}
function exSituacao(i){
  const etq = typeof etiquetasDoItem === 'function' ? etiquetasDoItem(i).map(t => t.nome).join(', ') : '';
  return '## Situação\n\n' +
    exLinha('Status', exStatus(i)) + exLinha('Prioridade', prioNome(i.prio)) +
    exLinha('Responsável', exPessoa(i.resp) || 'sem responsável') + exLinha('Quem abriu', exPessoa(i.rep)) +
    exLinha('Início', exData(i.ini)) + exLinha('Prazo', exData(i.fim)) + exLinha('Concluído em', exData(i.feito)) +
    exLinha('Estimativa', i.est ? i.est + ' h' : '') + exLinha('Pontos', i.pontos || '') + exLinha('Tempo registrado', exMinutos(i)) +
    exLinha('O cliente vê', i.vis === 'cliente' ? 'sim' : 'não') + exLinha('Etiquetas', etq) + exLinha('Criado em', exData(i.criado)) +
    (i.arquivado ? exLinha('Arquivado', 'sim') : '') + '\n';
}
function exCorpoItem(i, nh){
  const h = '#'.repeat(nh), partes = [];
  partes.push(h + ' Descrição\n\n' + ((i.desc || '').trim() || '_Sem descrição._') + '\n');
  if ((i.check || []).length) partes.push(h + ' Checklist\n\n' + i.check.map(c => '- [' + (c.f ? 'x' : ' ') + '] ' + c.t).join('\n') + '\n');
  const cfs = (typeof camposDoEscopo === 'function' ? camposDoEscopo('ws:' + i.ws) : []).filter(c => i.cf && i.cf[c.id] != null && i.cf[c.id] !== '');
  if (cfs.length) partes.push(h + ' Campos do projeto\n\n' + cfs.map(c => '- **' + c.nome + ':** ' + i.cf[c.id]).join('\n') + '\n');
  const dc = typeof dcLigacao === 'function' && dcLigacao(i);
  if (dc) partes.push(h + ' Decisão na ficha técnica\n\n- **Campo:** ' + dc.sec + ' › ' + dc.campo + '\n- **Decidido:** ' + ((D.sheets[dc.pk] || {campos:{}}).campos[dc.chave] || '_ainda vazio_') + '\n');
  const lig = (i.links || []).map(l => { const o = byId('issues', l.alvo); return o ? '- ' + ({'Blocks':'Bloqueia', 'Is blocked by':'É bloqueado por', 'Relates to':'Tem relação com', 'Duplicates':'Duplica'}[l.tipo] || l.tipo) + ': ' + exNomeItem(o) + ' (' + exStatus(o) + ')' : ''; }).filter(Boolean);
  if (lig.length) partes.push(h + ' Ligações\n\n' + lig.join('\n') + '\n');
  const refs = (i.refs || []).map(r => '- ' + (r.url ? '[' + (r.nome || r.url) + '](' + r.url + ')' : r.nome + ' (arquivo)'));
  if (refs.length) partes.push(h + ' Anexos e links\n\n' + refs.join('\n') + '\n');
  const coms = (i.coments || []).filter(c => (c.txt || '').trim());
  if (coms.length) partes.push(h + ' Comentários\n\n' + coms.map(c => '**' + (exPessoa(c.quem) || (c.cliente ? 'Cliente' : 'Alguém')) + '** · ' + exData(c.quando) + (c.cliente ? ' · visível ao cliente' : '') + '\n\n' + exMencoes(c.txt).split('\n').map(l => '> ' + l).join('\n')).join('\n\n') + '\n');
  return partes.join('\n');
}
// um item completo; num épico, os itens de dentro vêm logo depois, cada um com o que tem
function exItemMd(i){
  const filhos = D.issues.filter(x => x.pai === i.id && !x.arquivado);
  let md = exCabecalho(tipoNome(i.tipo), exNomeItem(i)) + exIdentItem(i) + exSituacao(i) + exCorpoItem(i, 2);
  if (filhos.length){
    const feitos = filhos.filter(x => x.status === 'done').length;
    md += '\n## ' + (i.tipo === 'epic' ? 'Itens do épico' : 'Subitens') + ' (' + feitos + ' de ' + filhos.length + ' concluídos)\n\n' +
      filhos.map(f => '- ' + (f.status === 'done' ? '[x] ' : '[ ] ') + exNomeItem(f) + ' · ' + exStatus(f) + (f.resp ? ' · ' + exPessoa(f.resp) : '') + (f.fim ? ' · prazo ' + exData(f.fim) : '')).join('\n') + '\n';
    if (i.tipo === 'epic') md += '\n' + filhos.map(f => '### ' + exNomeItem(f) + '\n\n' +
      exLinha('Tipo', tipoNome(f.tipo)) + exLinha('Onde fica', exCaminho('ws:' + f.ws)) + exLinha('Status', exStatus(f)) + exLinha('Prioridade', prioNome(f.prio)) + exLinha('Responsável', exPessoa(f.resp)) + exLinha('Prazo', exData(f.fim)) + exLinha('Id interno', '`' + f.id + '`') + '\n' +
      exCorpoItem(f, 4)).join('\n');
  }
  return md;
}
// um ponto da Estrutura: o caminho, o que tem dentro, a ficha técnica, as versões e os épicos com os itens
function exNoMd(chave){
  const [tipo, id] = chave.split(':'), o = tfObjNo(chave); if (!o) return '';
  const itens = issuesEm(chave).filter(i => !i.arquivado), epics = itens.filter(i => i.tipo === 'epic');
  const semEpico = itens.filter(i => i.tipo !== 'epic' && !(i.pai && epics.some(e => e.id === i.pai)) && !(i.pai && itens.some(x => x.id === i.pai)));
  const feitos = itens.filter(i => i.status === 'done').length;
  let md = exCabecalho(EX_NIVEL[tipo], o.nome) + '## Identificação\n\n' + exLinha('Sistema', EX_SISTEMA) + exLinha('Nível', EX_NIVEL[tipo]) + exLinha('Onde fica', exCaminho(chave)) +
    exLinha('Situação', (EST.find(e => e.id === o.status) || {nome:o.status}).nome) + (o.motivo ? exLinha('Motivo da pausa', o.motivo) : '') +
    (tipo === 'app' ? exLinha('Plataforma', {web:'Web', desktop:'Desktop', mobile:'Celular'}[o.plataforma] || o.plataforma) : '') + (tipo === 'project' ? exLinha('Origem', o.origem === 'brownfield' ? 'Brownfield (já em andamento)' : 'Greenfield (do zero)') : '') +
    exLinha('Id interno', '`' + o.id + '`') + exLinha('Itens', itens.length + ' (' + feitos + ' concluídos)') + '\n';
  // o que tem dentro
  const dentro = [];
  if (tipo === 'client') D.projects.filter(p => p.client === id).forEach(p => dentro.push('- Projeto: ' + p.nome));
  if (tipo === 'project'){ D.products.filter(p => p.project === id).forEach(p => dentro.push('- Produto: ' + p.nome)); D.apps.filter(a => a.project === id).forEach(a => dentro.push('- Aplicação: ' + a.nome + (a.product ? ' (em ' + (byId('products', a.product) || {nome:''}).nome + ')' : '') + ' · frentes: ' + D.ws.filter(w => w.app === a.id).map(w => w.nome).join(', '))); }
  if (tipo === 'product') D.apps.filter(a => a.product === id).forEach(a => dentro.push('- Aplicação: ' + a.nome + ' · frentes: ' + D.ws.filter(w => w.app === a.id).map(w => w.nome).join(', ')));
  if (tipo === 'app') D.ws.filter(w => w.app === id).forEach(w => dentro.push('- Frente: ' + w.nome + ' (' + issuesEm('ws:' + w.id).filter(i => !i.arquivado).length + ' itens)'));
  if (dentro.length) md += '## O que tem dentro\n\n' + dentro.join('\n') + '\n\n';
  // ficha técnica preenchida: só a do próprio ponto (nunca a do projeto acima)
  const fichas = [D.sheets[chave]].filter(Boolean);
  const valores = []; FICHA.forEach(([sec, , campos]) => campos.forEach(cp => { const k = sec + '|' + cp; const v = fichas.map(f => f.campos[k]).find(x => x && String(x).trim()); if (v) valores.push('- **' + sec + ' › ' + cp + ':** ' + String(v).replace(/\n/g, ' ')); }));
  if (valores.length) md += '## Ficha técnica\n\n' + valores.join('\n') + '\n\n';
  const vs = typeof enVersoes === 'function' && tipo !== 'client' ? enVersoes(chave) : [];
  if (vs.length) md += '## Versões\n\n' + vs.map(v => { const lig = itens.filter(i => i.marco === v.id); return '- **' + v.nome + '**' + (v.desc ? ': ' + v.desc : '') + ' · ' + (v.entregue ? 'no ar desde ' + exData(v.entregue) : 'prevista para ' + exData(v.data)) + (lig.length ? ' · ' + lig.filter(i => i.status === 'done').length + ' de ' + lig.length + ' itens' : ''); }).join('\n') + '\n\n';
  const linhaIt = i => '- ' + (i.status === 'done' ? '[x] ' : '[ ] ') + exNomeItem(i) + ' · ' + exStatus(i) + (i.resp ? ' · ' + exPessoa(i.resp) : '') + (i.fim ? ' · prazo ' + exData(i.fim) : '') + (tipo !== 'ws' ? ' · ' + ((byId('ws', i.ws) || {}).nome || '') : '');
  if (epics.length) md += '## Épicos\n\n' + epics.map(e => { const f = itens.filter(i => i.pai === e.id); return '### ' + exNomeItem(e) + '\n\n' + exLinha('Status', exStatus(e)) + exLinha('Frente', (byId('ws', e.ws) || {}).nome) + exLinha('Versão', (D.marcos.find(m => m.id === e.marco) || {}).nome) +
    ((e.desc || '').trim() ? '\n' + e.desc.trim() + '\n' : '') + (f.length ? '\n' + f.map(linhaIt).join('\n') + '\n' : '\n_Sem itens._\n'); }).join('\n') + '\n';
  if (semEpico.length) md += '## Itens sem épico\n\n' + semEpico.map(linhaIt).join('\n') + '\n';
  return md;
}
function exBaixar(nome, md){
  // nome do arquivo sem acento e sem símbolos: alguns navegadores trocam o nome por "download" quando tem acento
  const arq = String(nome).replace(/\s*·\s*/g, ' - ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ._()-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) + '.md';
  const url = URL.createObjectURL(new Blob([md], {type:'text/markdown;charset=utf-8'}));
  const a = document.createElement('a'); a.href = url; a.download = arq; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('Baixado: ' + arq);
}
const exBaixarItem = i => exBaixar(exNomeItem(i), exItemMd(i));
const exBaixarNo = chave => { const o = tfObjNo(chave); if (o) exBaixar(EX_NIVEL[chave.split(':')[0]] + ' ' + o.nome, exNoMd(chave)); };
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {exItemMd, exNoMd});
