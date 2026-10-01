/* ===== Fila: criar em lote =====
   Cola ou digita a lista inteira de uma vez, como no Trello e no ClickUp:
     linha sem traço            = épico
     linha começando com - * •  = item dentro do épico de cima
     [Nome da frente] no fim    = em qual frente fica (o item herda a do épico)
     {Nome da versão} no fim    = em qual versão entra (o item herda a do épico); a versão já precisa existir em Entregas
     linha "campo: valor" logo abaixo do item = detalhe do item (como, quero, para, aceite, prioridade, valor, pontos, tipo, origem);
     logo abaixo do épico, "meta: ..." = a meta do épico. Valor inválido vira erro na prévia e o item dele fica de fora.
   Item com o mesmo título num épico que já existe não duplica: recebe os campos novos, sem perder os que já tem.
   Antes de criar, mostra a prévia. Épico com o mesmo nome de um que já existe no projeto não é duplicado: os itens entram nele.
   Grava como se cada um fosse criado à mão (épico em A fazer, itens na Fila), com Desfazer. */
const LT_EXEMPLO = 'Carteira de clientes [Database]\n- Cadastro do cliente\n- Cadastro das lojas\n- Tela da lista da carteira [Frontend]\n\nCatálogo e limite de publicação [Backend]\n- Limite total de anúncios\n- Anúncios publicados e saldo';
const LT_EXEMPLO_COMPLETO = 'Carteira de clientes [Database]\nmeta: o lojista cuida da própria carteira sem ligar para o suporte\n- Cadastro do cliente\n  como: lojista\n  quero: cadastrar meus clientes com CPF e telefone\n  para: não perder o contato de quem já comprou\n  aceite: Salva nome, CPF e telefone\n  aceite: Avisa quando o CPF já está cadastrado\n  aceite: Funciona no celular\n  prioridade: Deve 2\n  valor: 8 é o que mais gera ligação no suporte\n  pontos: 5\n- Tela da lista da carteira [Frontend]\n  historia: Como lojista, quero ver todos os meus clientes numa lista, para achar um cliente rápido\n  aceite: Busca pelo nome ou pelo CPF\n  prioridade: Deveria 3\n  pontos: 3';
const ltNorm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// as frentes que valem aqui: primeiro as do ponto escolhido na Estrutura, depois as do projeto
function ltFrentes(){
  const pj = cadeia(UI.sel).project; if (!pj) return [];
  const doProjeto = D.ws.filter(w => { const a = byId('apps', w.app); return a && a.project === pj.id && w.status !== 'archived'; });
  const aqui = new Set(issuesEm(UI.sel).map(i => i.ws).concat(UI.sel.startsWith('ws:') ? [UI.sel.slice(3)] : []));
  const [tipo, id] = UI.sel.split(':');
  const dentro = w => aqui.has(w.id) || (tipo === 'app' && w.app === id) || (tipo === 'product' && (byId('apps', w.app) || {}).product === id) || tipo === 'project' || (tipo === 'ws' && w.id === id);
  return doProjeto.filter(dentro).concat(doProjeto.filter(w => !dentro(w)));
}
// linhas de detalhe: "campo: valor", logo abaixo da linha do item (ou do épico, no caso da meta). O recuo é opcional.
const LT_CAMPOS = {'como':'quem', 'quem':'quem', 'quero':'quero', 'o que':'quero', 'para':'para', 'por que':'para', 'porque':'para', 'historia':'historia',
  'aceite':'aceite', 'criterio':'aceite', 'criterio de aceite':'aceite', 'prioridade':'prioridade', 'classe':'classe', 'moscow':'classe', 'nivel':'nivel',
  'valor':'valor', 'pontos':'pontos', 'estimativa':'pontos', 'tipo':'tipo', 'origem':'origem', 'meta':'meta'};
const LT_CLASSES = [['nao tera agora','nao_tera'], ['nao tera','nao_tera'], ['deveria','deveria'], ['deve','deve'], ['poderia','poderia']];
const LT_SEQ = [1, 2, 3, 5, 8, 13, 20];
const LT_ERRO_PRIO = 'use Deve, Deveria, Poderia ou Não terá agora, e o nível de 1 a 5 (ex.: prioridade: Deve 2)';
function ltClasse(v){ const n = ltNorm(v); const c = LT_CLASSES.find(([k]) => n === k || n.startsWith(k + ' ') || n.startsWith(k + ',')); return c ? {classe:c[1], resto:n.slice(c[0].length).replace(/^[\s,;·-]+/, '').trim()} : null; }
function ltDetalhe(campo, v, det, pj){
  const txt = String(v || '').trim();
  const max = (n, rot) => txt.length > n ? rot + ' passa de ' + n + ' letras' : '';
  if (!txt) return 'falta o valor depois de "' + campo + ':"';
  if (campo !== 'aceite' && campo in det) return '"' + campo + '" aparece duas vezes no mesmo item';
  if (campo === 'quem' || campo === 'quero' || campo === 'para'){ const e = max(campo === 'quem' ? 300 : 500, 'o texto'); if (e) return e; det[campo] = txt; return ''; }
  if (campo === 'historia'){
    const m = /^como\s+(.+?),\s*quero\s+(.+?),\s*para\s+(.+?)\.?$/i.exec(txt);
    if (!m) return 'a história precisa ser assim: Como [quem], quero [o quê], para [por quê]';
    det.quem = m[1].trim(); det.quero = m[2].trim(); det.para = m[3].trim(); det.historia = true; return '';
  }
  if (campo === 'aceite'){ const e = max(500, 'o critério'); if (e) return e; (det.aceite = det.aceite || []).push(txt); return ''; }
  if (campo === 'prioridade' || campo === 'classe'){
    const c = ltClasse(txt);
    if (!c){ if (campo === 'prioridade' && /^[1-5]$/.test(txt)){ det.nivel = +txt; det.prioridade = true; return ''; } return 'prioridade "' + txt + '" não existe: ' + LT_ERRO_PRIO; }
    det.classe = c.classe; det[campo] = true;
    if (c.resto){ if (campo === 'classe' || !/^[1-5]$/.test(c.resto)) return 'nível "' + c.resto + '" não existe: o nível vai de 1 a 5'; if ('nivel' in det) return '"nivel" aparece duas vezes no mesmo item'; det.nivel = +c.resto; }
    return '';
  }
  if (campo === 'nivel'){ if (!/^[1-5]$/.test(txt)) return 'nível "' + txt + '" não existe: o nível vai de 1 a 5 (1 só emergência, 5 ideia sem detalhe)'; det.nivel = +txt; return ''; }
  if (campo === 'valor'){
    const m = /^(\d+)(?:\s*[-:,.]?\s*(.*))?$/.exec(txt);
    if (!m || +m[1] < 1 || +m[1] > 10) return 'valor "' + txt + '" não vale: comece com um número de 1 a 10 (ex.: valor: 8 reduz as ligações)';
    det.valor = +m[1]; if (m[2] && m[2].trim()){ if (m[2].trim().length > 300) return 'o motivo do valor passa de 300 letras'; det.valorMotivo = m[2].trim(); } return '';
  }
  if (campo === 'pontos'){ if (!/^\d+$/.test(txt) || !LT_SEQ.includes(+txt)) return 'estimativa "' + txt + '" fora da sequência: use 1, 2, 3, 5, 8, 13 ou 20'; det.pontos = +txt; return ''; }
  if (campo === 'tipo'){ const t = {item:'item', bug:'bug', melhoria:'melhoria'}[ltNorm(txt)]; if (!t) return 'tipo "' + txt + '" não existe: use Item, Bug ou Melhoria'; det.tipo = t; return ''; }
  if (campo === 'origem'){
    const n = ltNorm(txt), noProj = pj ? issuesEm('project:' + pj.id).filter(i => !i.arquivado) : [];
    const o = noProj.find(i => typeof chaveDe === 'function' && ltNorm(chaveDe(i)) === n) || noProj.find(i => ltNorm(i.titulo) === n);
    if (!o) return 'origem "' + txt + '" não existe neste projeto: use a chave do item (ex.: BL-12)';
    det.origem = o.id; det.origemNome = ((typeof chaveDe === 'function' && chaveDe(o)) || '') + ' ' + o.titulo; return '';
  }
  return '';
}
function ltLer(texto){
  const frentes = ltFrentes(), padrao = UI.sel.startsWith('ws:') ? UI.sel.slice(3) : primeiroWs(UI.sel);
  const pj = cadeia(UI.sel).project;
  const epicsJa = pj ? issuesEm('project:' + pj.id).filter(i => i.tipo === 'epic' && !i.arquivado) : [];
  const achaFrente = nome => { const n = ltNorm(nome); return frentes.find(w => ltNorm(w.nome) === n) || frentes.find(w => ltNorm(byId('apps', w.app).nome + ' › ' + w.nome) === n) || null; };
  const versoes = marcosDoEscopo(UI.sel);
  const achaVersao = nome => { const n = ltNorm(nome); return versoes.find(v => ltNorm(v.nome) === n) || null; };
  const grupos = [], avisos = [], novasV = [], erros = [];
  let atual = null, alvo = null;   // alvo: o item (ou o épico) que recebe as linhas de detalhe
  const erro = (k, msg, quem) => { const e = {linha:k + 1, msg}; erros.push(e); if (quem) (quem.erros = quem.erros || []).push(e); };
  String(texto || '').split(/\r?\n/).forEach((bruta, k) => {
    let l = bruta.trim(); if (!l) return;
    const item = /^[-*•–]\s*/.test(l); if (item) l = l.replace(/^[-*•–]\s*/, '').trim(); if (!l) return;
    // linha de detalhe: um dos campos conhecidos, com dois pontos (recuo opcional)
    const md = !item && /^([A-Za-zÀ-ÿ ]{2,22}):\s*(.*)$/.exec(l), campo = md && LT_CAMPOS[ltNorm(md[1])];
    if (md && !campo && /^\s/.test(bruta)){ erro(k, 'campo "' + md[1].trim() + '" não existe. Use: como, quero, para, aceite, prioridade, valor, pontos, tipo, origem ou meta', alvo); return; }
    if (campo){
      if (campo === 'meta'){
        if (!alvo || alvo.ehItem){ erro(k, 'a meta é do épico: escreva logo abaixo da linha do épico (sem traço)', alvo); return; }
        if (alvo.meta != null){ erro(k, '"meta" aparece duas vezes no mesmo épico', alvo); return; }
        if (md[2].trim().length > 1000){ erro(k, 'a meta passa de 1000 letras', alvo); return; }
        if (!md[2].trim()){ erro(k, 'falta o valor depois de "meta:"', alvo); return; }
        alvo.meta = md[2].trim(); return;
      }
      if (!alvo || !alvo.ehItem){ erro(k, 'esta linha é detalhe de item: coloque logo abaixo de uma linha que começa com -', alvo); return; }
      const e = ltDetalhe(campo, md[2], alvo.det, pj); if (e) erro(k, e, alvo);
      return;
    }
    // [frente] e {versão} no fim da linha, em qualquer ordem
    let ws = null, mc = null, m;
    while ((m = /\s*(\[([^\]]+)\]|\{([^}]+)\})\s*$/.exec(l))){
      l = l.slice(0, m.index).trim();
      if (m[2] != null){ const f = achaFrente(m[2]); if (f) ws = f.id; else avisos.push('Linha ' + (k + 1) + ': a frente "' + m[2].trim() + '" não existe aqui. Vai para ' + (item && atual ? 'a frente do épico' : 'a frente escolhida na Estrutura') + '.'); }
      else { const v = achaVersao(m[3]); if (v) mc = v.id; else if (m[3].trim()){ const n = m[3].trim(); mc = LT_NOVA + n; if (!novasV.includes(n)) novasV.push(n); } }
    }
    if (!l) return;
    if (!item){ const ja = epicsJa.find(e => ltNorm(e.titulo) === ltNorm(l)) || null; atual = {titulo:l, ws:ws || (ja ? ja.ws : padrao), mc:mc || (ja ? ja.marco || null : null), ja, itens:[], linha:k + 1, meta:null, erros:[]}; grupos.push(atual); alvo = atual; return; }
    if (!atual){ atual = {titulo:null, ws:padrao, mc:null, ja:null, itens:[], meta:null, erros:[]}; grupos.push(atual); }
    const it = {titulo:l, ws:ws || atual.ws, mc:mc || atual.mc, ehItem:true, det:{}, erros:[], linha:k + 1};
    if (l.length > 300) erro(k, 'o título passa de 300 letras', it);
    if (atual.itens.some(x => ltNorm(x.titulo) === ltNorm(l))) erro(k, 'o item "' + l + '" aparece duas vezes no mesmo épico', it);
    // o mesmo título num épico que já existe: não duplica, atualiza
    if (atual.ja) it.ja = D.issues.find(x => x.pai === atual.ja.id && !x.arquivado && ltNorm(x.titulo) === ltNorm(l)) || null;
    atual.itens.push(it); alvo = it;
  });
  // depois de ler tudo: o que só dá para conferir no fim
  grupos.forEach(g => g.itens.forEach(it => {
    if (it.det.tipo === 'bug' && !it.det.origem && !(it.ja && it.ja.origem)) erro(it.linha - 1, 'o Bug "' + it.titulo + '" precisa da origem: o item cujo critério não foi cumprido (ex.: origem: BL-12)', it);
    if (it.ja && it.ja.status === 'done' && (it.det.quem || it.det.quero || it.det.para || (it.det.aceite || []).length))
      erro(it.linha - 1, '"' + it.titulo + '" já foi aceito: a história e os critérios não mudam. Para mudar, crie um item novo com tipo: Melhoria', it);
  }));
  erros.sort((a, b) => a.linha - b.linha);
  return {grupos, avisos, padrao, novasV, erros};
}
// o que cada item vai receber, para a prévia e para gravar
const ltTemDet = det => Object.keys(det).some(k => k !== 'origemNome');
function ltResumo(r){
  let epNovos = 0, novos = 0, atualiza = 0, igual = 0, comErro = 0;
  r.grupos.forEach(g => { if (g.erros.length){ comErro += 1 + g.itens.length; return; } if (g.titulo && !g.ja) epNovos++;
    g.itens.forEach(i => { if (i.erros.length) comErro++; else if (i.ja){ if (ltTemDet(i.det)) atualiza++; else igual++; } else novos++; }); });
  return {epNovos, novos, atualiza, igual, comErro};
}
const ltFrenteNome = id => { const w = byId('ws', id); return w ? w.nome : 'sem frente'; };
const LT_NOVA = 'nova:';   // versão escrita no texto que ainda não existe: é criada junto, no projeto
const ltVersao = id => { if (id && String(id).startsWith(LT_NOVA)) return '<span class="lt-fr lt-vs">' + esc(id.slice(LT_NOVA.length)) + ' (nova)</span>'; const v = id && D.marcos.find(x => x.id === id); return v ? '<span class="lt-fr lt-vs">' + esc(v.nome) + '</span>' : ''; };
// a próxima versão depois da maior que existe: v1.2 vira v1.3, v1.2.0 vira v1.3.0; sem nenhuma, v0.1
function ltProximaVersao(){
  const ns = marcosDoEscopo(UI.sel).filter(m => m.tipo === 'release').map(m => m.nome);
  const lidas = ns.map(n => { const m = /^(\D*)(\d+)\.(\d+)(?:\.(\d+))?/.exec(n); return m ? {pre:m[1] || 'v', a:+m[2], b:+m[3], c:m[4] == null ? null : +m[4]} : null; }).filter(Boolean);
  if (!lidas.length) return 'v0.1';
  lidas.sort((x, y) => y.a - x.a || y.b - x.b || (y.c || 0) - (x.c || 0));
  const t = lidas[0]; return t.pre + t.a + '.' + (t.b + 1) + (t.c == null ? '' : '.0');
}
function ltDetHTML(det){
  const p = [];
  if (det.quem || det.quero || det.para) p.push('<p class="lt-hist">Como ' + esc(det.quem || '...') + ', quero ' + esc(det.quero || '...') + ', para ' + esc(det.para || '...') + '.</p>');
  const chips = [];
  if (det.tipo && det.tipo !== 'item') chips.push('<span class="lt-chip lt-' + det.tipo + '">' + (det.tipo === 'bug' ? 'Bug' : 'Melhoria') + (det.origemNome ? ' de ' + esc(det.origemNome.trim()) : '') + '</span>');
  if (det.classe || det.nivel) chips.push('<span class="lt-chip">' + esc([det.classe ? ({deve:'Deve', deveria:'Deveria', poderia:'Poderia', nao_tera:'Não terá agora'})[det.classe] : '', det.nivel ? 'nível ' + det.nivel : ''].filter(Boolean).join(' · ')) + '</span>');
  if (det.valor) chips.push('<span class="lt-chip">valor ' + det.valor + (det.valorMotivo ? ': ' + esc(det.valorMotivo) : '') + '</span>');
  if (det.pontos) chips.push('<span class="lt-chip">' + det.pontos + ' pts</span>');
  if (chips.length) p.push('<div class="lt-chips">' + chips.join('') + '</div>');
  if ((det.aceite || []).length) p.push('<ul class="lt-crit">' + det.aceite.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul>');
  return p.join('');
}
function ltPreviaHTML(r){
  if (!r.grupos.length && !(r.erros || []).length) return '<p class="lt-vazio">A prévia aparece aqui enquanto você escreve.</p>';
  const s = ltResumo(r), partes = [];
  if (s.epNovos) partes.push('<b>' + s.epNovos + (s.epNovos === 1 ? ' épico novo' : ' épicos novos') + '</b>');
  if (s.novos) partes.push('<b>' + s.novos + (s.novos === 1 ? ' item novo' : ' itens novos') + '</b>');
  if (s.atualiza) partes.push('<b>' + s.atualiza + (s.atualiza === 1 ? ' item atualizado' : ' itens atualizados') + '</b>');
  const chaveDo = x => (typeof chaveDe === 'function' && chaveDe(x)) || '';
  return '<p class="lt-conta">' + (partes.length ? partes.join(', ').replace(/, ([^,]*)$/, ' e $1') + (s.epNovos + s.novos === 1 && !s.atualiza ? ' vai ser criado.' : ' vão ser gravados.') : 'Nada para gravar ainda.') +
      (r.novasV && r.novasV.length ? ' Junto, ' + (r.novasV.length === 1 ? 'a versão nova ' : 'as versões novas ') + '<b>' + r.novasV.map(esc).join(', ') + '</b>.' : '') +
      (s.igual ? ' ' + s.igual + (s.igual === 1 ? ' item já existe e fica como está.' : ' itens já existem e ficam como estão.') : '') + '</p>' +
    ((r.erros || []).length ? '<div class="lt-erros" role="alert"><b>' + r.erros.length + (r.erros.length === 1 ? ' erro' : ' erros') + (s.comErro ? ': ' + s.comErro + (s.comErro === 1 ? ' item fica de fora' : ' itens ficam de fora') + ' até corrigir' : '') + '</b><ul>' + r.erros.map(e => '<li>Linha ' + e.linha + ': ' + esc(e.msg) + '</li>').join('') + '</ul></div>' : '') +
    (r.avisos.length ? '<ul class="lt-avisos">' + r.avisos.map(a => '<li>' + esc(a) + '</li>').join('') + '</ul>' : '') +
    '<ol class="lt-lista">' + r.grupos.map(g => '<li' + (g.erros.length ? ' class="lt-com-erro"' : '') + '><div class="lt-ep">' + (g.titulo ? '<b>' + esc(g.titulo) + '</b>' + (g.ja ? '<small>já existe: os itens entram nele</small>' : '') : '<b class="lt-sem">Itens sem épico</b>') + '<span class="lt-fr">' + esc(ltFrenteNome(g.ws)) + '</span>' + ltVersao(g.mc) + '</div>' +
      (g.meta ? '<p class="lt-hist">Meta: ' + esc(g.meta) + '</p>' : '') +
      (g.itens.length ? '<ul>' + g.itens.map(i => '<li class="' + (i.erros.length ? 'lt-com-erro' : '') + '"><div class="lt-it-tit"><span>' + esc(i.titulo) + '</span>' +
        (i.erros.length ? '<span class="lt-tag lt-tag-erro">com erro: fica de fora</span>' : i.ja ? '<span class="lt-tag">' + (ltTemDet(i.det) ? 'já existe' + (chaveDo(i.ja) ? ' (' + esc(chaveDo(i.ja)) + ')' : '') + ': atualiza' : 'já existe: fica como está') + '</span>' : '') +
        (i.ws !== g.ws ? '<span class="lt-fr">' + esc(ltFrenteNome(i.ws)) + '</span>' : '') + (i.mc !== g.mc ? ltVersao(i.mc) : '') + '</div>' + ltDetHTML(i.det) +
        (i.erros.length ? '<ul class="lt-it-erros">' + i.erros.map(e => '<li>Linha ' + e.linha + ': ' + esc(e.msg) + '</li>').join('') + '</ul>' : '') + '</li>').join('') + '</ul>' : '') + '</li>').join('') + '</ol>';
}
// grava os detalhes num item (novo ou que já existe): só o que veio no texto; nada do que já existe é apagado
function ltAplicar(x, det){
  if (det.quem) x.hQuem = det.quem; if (det.quero) x.hQuero = det.quero; if (det.para) x.hPara = det.para;
  if (det.classe) x.moscow = det.classe;
  if (det.nivel){ x.nivel = det.nivel; x.prio = ({1:'highest', 2:'high', 3:'medium', 4:'low', 5:'low'})[det.nivel]; }
  if (det.valor) x.valor = det.valor; if (det.valorMotivo) x.valorMotivo = det.valorMotivo;
  if (det.pontos) x.pontos = det.pontos;
  if (det.origem) x.origem = det.origem;
  if (det.tipo === 'melhoria') x.melhoria = true; else if (det.tipo === 'item') x.melhoria = false;
  if (det.tipo === 'bug' && x.tipo !== 'bug' && typeof poMudarTipo === 'function') poMudarTipo(x, 'bug');
  if (det.tipo && det.tipo !== 'bug' && x.tipo === 'bug' && typeof poMudarTipo === 'function') poMudarTipo(x, det.tipo);
  if ((det.aceite || []).length){ const ja = new Set((x.crit || []).map(c => ltNorm(c.t))); x.crit = (x.crit || []).concat(det.aceite.filter(c => !ja.has(ltNorm(c))).map(t => ({t, f:false}))); }
}
function ltNovo(titulo, ws, tipo, status, pai, mc){
  const ni = novoIssue({titulo, status, ws, tipo, pai:pai || null}); if (mc) ni.marco = mc;
  garantirBoard({issues:[ni], boards:D.boards, equipes:D.equipes});
  ni.ordem = novaOrdem(D.issues.filter(x => !x.sprint), null);
  D.issues.push(ni); registrar('criou', ni); return ni;
}
// botões em cima da caixa: épico, item, cada frente, cada versão e a próxima versão
function ltAtalhosHTML(){
  const frentes = ltFrentes().map(w => w.nome).filter((n, k, a) => a.indexOf(n) === k);
  const versoes = marcosDoEscopo(UI.sel).filter(m => m.tipo === 'release').map(m => m.nome), prox = ltProximaVersao();
  const bt = (tipo, valor, txt, cls) => '<button type="button" class="lt-at' + (cls ? ' ' + cls : '') + '" data-lt-por="' + tipo + '" data-lt-valor="' + esc(valor) + '">' + txt + '</button>';
  return '<div class="lt-atalhos" role="toolbar" aria-label="Atalhos">' +
    '<div class="lt-at-g"><span>Linha nova</span>' + bt('epico', '', ICO.mais + 'Épico') + bt('item', '', ICO.mais + 'Item') + '</div>' +
    '<div class="lt-at-g"><span>Detalhe do item</span>' + [['como', 'Como'], ['quero', 'Quero'], ['para', 'Para'], ['aceite', 'Critério'], ['prioridade', 'Prioridade'], ['valor', 'Valor'], ['pontos', 'Pontos'], ['tipo', 'Tipo'], ['meta', 'Meta do épico']].map(([k, n]) => bt('det', k, ICO.mais + n)).join('') + '</div>' +
    '<div class="lt-at-g"><span>Frente</span>' + frentes.map(n => bt('frente', n, esc(n))).join('') + '</div>' +
    '<div class="lt-at-g"><span>Versão</span>' + versoes.map(n => bt('versao', n, esc(n))).join('') + (versoes.includes(prox) ? '' : bt('versao', prox, ICO.mais + esc(prox) + ' (nova)', 'lt-at-nova')) + '</div></div>';
}
// põe o atalho na linha onde está o cursor: troca a frente ou a versão que já estiver no fim da linha
function ltPor(ta, tipo, valor){
  const v = ta.value, pos = ta.selectionStart == null ? v.length : ta.selectionStart;
  const ini = v.lastIndexOf('\n', pos - 1) + 1, fimN = v.indexOf('\n', pos), fim = fimN < 0 ? v.length : fimN;
  let linha = v.slice(ini, fim), cursor;
  if (tipo === 'det'){
    // uma linha de detalhe logo abaixo da linha onde está o cursor (a meta sem recuo, logo abaixo do épico)
    const antes = v.slice(0, fim), depois = v.slice(fim);
    const novo = '\n' + (valor === 'meta' ? '' : '  ') + valor + ': ';
    ta.value = antes + novo + depois; cursor = (antes + novo).length;
    ta.focus(); ta.setSelectionRange(cursor, cursor); return;
  }
  if (tipo === 'epico' || tipo === 'item'){
    const novo = tipo === 'item' ? '- ' : '';
    const antes = v.slice(0, fim), depois = v.slice(fim);
    const sep = !antes.trim() ? '' : tipo === 'epico' ? '\n\n' : '\n';
    ta.value = antes + sep + novo + depois; cursor = (antes + sep + novo).length;
  } else {
    const re = tipo === 'frente' ? /\s*\[[^\]]*\]/g : /\s*\{[^}]*\}/g;
    const marca = tipo === 'frente' ? '[' + valor + ']' : '{' + valor + '}';
    linha = linha.replace(re, '').replace(/\s+$/, '');
    if (!linha.trim()){ toast('Escreva o nome na linha primeiro, depois escolha ' + (tipo === 'frente' ? 'a frente' : 'a versão')); ta.focus(); return; }
    linha = linha + ' ' + marca;
    ta.value = v.slice(0, ini) + linha + v.slice(fim); cursor = ini + linha.length;
  }
  ta.focus(); ta.setSelectionRange(cursor, cursor);
}
function ltAbrir(){
  if (!podeEditar()) return;
  if (!ltFrentes().length){ toast('Crie antes uma frente de trabalho numa aplicação (Estrutura › aplicação › ⋯ › Criar dentro)'); return; }
  modal('Criar em lote', '<div class="lt-grade"><div class="lt-esq"><label class="lb" for="lt-t">Escreva ou cole a lista</label>' +
    ltAtalhosHTML() +
    '<textarea class="campo lt-texto" id="lt-t" rows="16" spellcheck="false" placeholder="' + esc(LT_EXEMPLO) + '"></textarea>' +
    '<div class="lt-regras"><p><b>Linha sem traço</b> vira épico.</p><p><b>Linha com - na frente</b> vira item dentro do épico de cima.</p><p>Para escolher a <b>frente</b> e a <b>versão</b>, clique na linha e depois no botão dela, em cima da caixa. O item fica na frente e na versão do épico, se não disser outra. Uma versão que ainda não existe é criada junto.</p>' +
    '<p><b>Detalhes do item</b> (opcional): logo abaixo do item, uma linha por campo, no formato <code>campo: valor</code>. Campos: <code>como</code>, <code>quero</code>, <code>para</code>, <code>aceite</code> (um por critério), <code>prioridade</code> (Deve, Deveria, Poderia ou Não terá agora, e o nível de 1 a 5), <code>valor</code> (1 a 10), <code>pontos</code> (1, 2, 3, 5, 8, 13 ou 20), <code>tipo</code> (Item, Bug ou Melhoria) e <code>origem</code> (a chave do item, para o Bug). Logo abaixo do épico: <code>meta</code>.</p>' +
    '<p>Item com o mesmo título num épico que já existe <b>não duplica</b>: recebe os campos novos e não perde nada. Linha com erro aparece na prévia e o item dela fica de fora.</p>' +
    '<div class="lt-ia"><button type="button" class="btn fant peq" data-lt-exemplo>Usar o exemplo</button><button type="button" class="btn fant peq" data-lt-exemplo-completo>Exemplo com detalhes</button></div>' +
    '<div class="lt-ia"><b>Montar com um agente de IA</b><p>Baixe ou copie as instruções do formato, cole num chat com o agente, converse com ele e cole aqui o texto que ele devolver. As instruções já levam as frentes, versões e épicos deste projeto.</p>' +
    '<span><button type="button" class="btn sec peq" data-lt-ia-baixar>Baixar instruções</button><button type="button" class="btn sec peq" data-lt-ia-copiar>Copiar instruções</button></span></div></div></div>' +
    '<div class="lt-dir"><span class="lb">Prévia</span><div class="lt-previa" aria-live="polite">' + ltPreviaHTML({grupos:[], avisos:[], erros:[]}) + '</div></div></div>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Criar tudo', acao:dl => {
      const r = ltLer($('#lt-t', dl).value); const sr = ltResumo(r);
      const novos = sr.epNovos, nItens = sr.novos;
      if (!novos && !nItens && !sr.atualiza){ toast(r.erros.length ? 'Corrija os erros da prévia: nada foi gravado' : r.grupos.length ? 'Nada muda: tudo já existe como está' : 'Escreva pelo menos um épico ou um item'); return false; }
      tfComDesfazer([novos ? novos + (novos === 1 ? ' épico' : ' épicos') : '', nItens ? nItens + (nItens === 1 ? ' item' : ' itens') : ''].filter(Boolean).join(' e ') + (novos || nItens ? ' criados' : '') +
        (sr.atualiza ? (novos || nItens ? ', ' : '') + sr.atualiza + (sr.atualiza === 1 ? ' item atualizado' : ' itens atualizados') : '') + (r.novasV.length ? ', com ' + r.novasV.length + (r.novasV.length === 1 ? ' versão nova' : ' versões novas') : '') +
        (sr.comErro ? '. ' + sr.comErro + (sr.comErro === 1 ? ' com erro ficou de fora' : ' com erro ficaram de fora') : '') + '.', () => {
        const pj = noDono(UI.sel), idNova = {};
        r.novasV.forEach(n => { const m = {id:uid('mc'), no:pj, tipo:'release', nome:n, desc:'', data:iso(dAdd(HOJE, 30)), vis:true, entregue:null, notas:''}; D.marcos.push(m); idNova[LT_NOVA + n] = m.id; });
        const vs = x => x && String(x).startsWith(LT_NOVA) ? idNova[x] || null : x;
        r.grupos.forEach(g => { if (g.erros.length) return; g.mc = vs(g.mc); g.itens.forEach(i => { i.mc = vs(i.mc); });
          const ep = g.titulo ? (g.ja && byId('issues', g.ja.id)) || ltNovo(g.titulo, g.ws, 'epic', 'todo', null, g.mc) : null;
          if (ep && g.meta) ep.meta = g.meta;
          g.itens.forEach(i => { if (i.erros.length) return;
            if (i.ja){ const x = byId('issues', i.ja.id); if (x && ltTemDet(i.det)) ltAplicar(x, i.det); return; }
            ltAplicar(ltNovo(i.titulo, i.ws, i.det.tipo === 'bug' ? 'bug' : ep ? 'story' : 'task', 'backlog', ep ? ep.id : null, i.mc), i.det); });
        });
      });
    }}]);
  const dl = document.querySelector('dialog.modal:last-of-type'); if (!dl) return;
  dl.classList.add('lt-modal');
  const ta = $('#lt-t', dl), pv = $('.lt-previa', dl);
  const atualizar = () => { pv.innerHTML = ltPreviaHTML(ltLer(ta.value)); };
  ta.addEventListener('input', atualizar);
  $('[data-lt-exemplo]', dl).addEventListener('click', () => { ta.value = LT_EXEMPLO; atualizar(); ta.focus(); });
  $('[data-lt-exemplo-completo]', dl).addEventListener('click', () => { ta.value = LT_EXEMPLO_COMPLETO; atualizar(); ta.focus(); });
  $('[data-lt-ia-baixar]', dl).addEventListener('click', () => exBaixar('CicloDev - criar em lote - instrucoes para IA - ' + (nomeDe(UI.sel) || 'geral'), '# Criar em lote no CicloDev: instruções para um agente de IA\n\n' + ciLoteMd()));
  $('[data-lt-ia-copiar]', dl).addEventListener('click', e => enCopiar('# Criar em lote no CicloDev: instruções para um agente de IA\n\n' + ciLoteMd(), e.currentTarget));
  // os botões de atalho não tiram o cursor da caixa: o clique não rouba o foco
  dl.addEventListener('mousedown', e => { if (e.target.closest('[data-lt-por]')) e.preventDefault(); });
  dl.addEventListener('click', e => { const b = e.target.closest('[data-lt-por]'); if (!b) return; ltPor(ta, b.dataset.ltPor, b.dataset.ltValor || ''); atualizar(); });
  ta.focus();
}

// o botão Criar em lote fica na barra Criar, no topo de todas as abas de itens (criar.js)
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-lt-abrir]')){ e.preventDefault(); ltAbrir(); } });
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {ltLer, ltAbrir, ltResumo, LT_EXEMPLO_COMPLETO});
