/* ===== Fila: criar em lote =====
   Cola ou digita a lista inteira de uma vez, como no Trello e no ClickUp:
     linha sem traço            = épico
     linha começando com - * •  = item dentro do épico de cima
     [Nome da frente] no fim    = em qual frente fica (sem ela: a frente do assunto do texto, senão a do épico)
     {Nome da versão} no fim    = em qual versão entra (o item herda a do épico); a versão já precisa existir em Entregas
     linha "campo: valor" logo abaixo do item = detalhe do item (como, quero, para, aceite, prioridade, valor, pontos, tipo, origem);
     logo abaixo do épico, "meta: ..." = a meta do épico. Valor inválido vira erro na prévia e o item dele fica de fora.
   Item com o mesmo título num épico que já existe não duplica: recebe os campos novos, sem perder os que já tem.
   Antes de criar, mostra a prévia. Épico com o mesmo nome de um que já existe no projeto não é duplicado: os itens entram nele.
   Grava como se cada um fosse criado à mão (épico em A fazer, itens na Fila), com Desfazer. */
const LT_EXEMPLO = 'Carteira de clientes [Database]\n- Cadastro do cliente\n- Cadastro das lojas\n- Tela da lista da carteira [Frontend]\n\nCatálogo e limite de publicação [Backend]\n- Limite total de anúncios\n- Anúncios publicados e saldo';
const LT_EXEMPLO_COMPLETO = 'Carteira de clientes [Database]\nmeta: o lojista cuida da própria carteira sem ligar para o suporte\n- Cadastro do cliente\n  como: lojista\n  quero: cadastrar meus clientes com CPF e telefone\n  para: não perder o contato de quem já comprou\n  aceite: Salva nome, CPF e telefone\n  aceite: Avisa quando o CPF já está cadastrado\n  aceite: Funciona no celular\n  prioridade: Deve 2\n  valor: 8 é o que mais gera ligação no suporte\n  pontos: 5\n- Tela da lista da carteira [Frontend]\n  historia: Como lojista, quero ver todos os meus clientes numa lista, para achar um cliente rápido\n  aceite: Busca pelo nome ou pelo CPF\n  prioridade: Deveria 3\n  pontos: 3';
const ltNorm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// sem [frente] na linha: a frente do assunto do texto (tela, integração, tabela...) na mesma aplicação da frente de base
function ltFrenteDoAssunto(base, texto){ if (UI.sel.startsWith('ws:')) return null;   // escolheu uma frente na Estrutura: tudo fica nela
  const w = base && byId('ws', base); const f = w && typeof frenteSugerida === 'function' ? frenteSugerida(w.app, texto) : null; return f ? f.id : null; }
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
  'responsavel':'responsavel', 'prazo':'prazo', 'valor':'valor', 'pontos':'pontos', 'estimativa':'pontos', 'tipo':'tipo', 'origem':'origem', 'meta':'meta',
  'lote':'lote', 'nome do lote':'lote', 'depois de':'depoisde', 'vem depois de':'depoisde', 'depende':'depende', 'depende de':'depende', 'dependencia':'depende', 'versao':'versao', 'entrega':'entrega', 'data de entrega':'entrega', 'pronto':'pronto', 'definicao de pronto':'pronto'};
// data de entrega: 15/11/2026 ou 2026-11-15
function ltDataEntrega(v){ const s = String(v || '').trim(); let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); if (!m){ const b = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s); if (b) m = [null, b[3], b[2].padStart(2, '0'), b[1].padStart(2, '0')]; }
  if (!m) return null; const d = new Date(+m[1], +m[2] - 1, +m[3]); return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? m[1] + '-' + m[2] + '-' + m[3] : null; }
const LT_CLASSES = [['nao tera agora','nao_tera'], ['nao tera','nao_tera'], ['deveria','deveria'], ['deve','deve'], ['poderia','poderia']];
const LT_SEQ = [1, 2, 3, 5, 8, 13, 20];
const LT_ERRO_PRIO = 'use Deve, Deveria, Poderia ou Não terá agora, e o nível de 1 a 5 (ex.: prioridade: Deve 2)';
function ltClasse(v){ const n = ltNorm(v); const c = LT_CLASSES.find(([k]) => n === k || n.startsWith(k + ' ') || n.startsWith(k + ',')); return c ? {classe:c[1], resto:n.slice(c[0].length).replace(/^[\s,;·-]+/, '').trim()} : null; }
function ltDetalhe(campo, v, det, pj){
  const txt = String(v || '').trim();
  const max = (n, rot) => txt.length > n ? rot + ' passa de ' + n + ' letras' : '';
  if (!txt) return 'falta o valor depois de "' + campo + ':"';
  if (campo !== 'aceite' && campo !== 'depende' && campo in det) return '"' + campo + '" aparece duas vezes no mesmo item';
  if (campo === 'quem' || campo === 'quero' || campo === 'para'){ const e = max(campo === 'quem' ? 300 : 500, 'o texto'); if (e) return e; det[campo] = txt; return ''; }
  if (campo === 'historia'){
    const m = /^como\s+(.+?),\s*quero\s+(.+?),\s*para\s+(.+?)\.?$/i.exec(txt);
    if (!m) return 'a história precisa ser assim: Como [quem], quero [o quê], para [por quê]';
    det.quem = m[1].trim(); det.quero = m[2].trim(); det.para = m[3].trim(); det.historia = true; return '';
  }
  if (campo === 'aceite'){ const e = max(500, 'o critério'); if (e) return e; det.aceite = det.aceite || []; if (!det.aceite.some(c => ltNorm(c) === ltNorm(txt))) det.aceite.push(txt); return ''; }   // critério repetido é ignorado
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
  if (campo === 'tipo'){ const t = {item:'item', bug:'bug', melhoria:'melhoria', tarefa:'tarefa', 'tarefa externa':'tarefa', decisao:'decisao'}[ltNorm(txt)]; if (!t) return 'tipo "' + txt + '" não existe: use Item, Bug, Melhoria, Tarefa ou Decisão'; det.tipo = t; return ''; }
  if (campo === 'responsavel'){ const n = ltNorm(txt); if (['ninguem','nenhum','sem responsavel'].includes(n)){ det.resp = '-'; return ''; }
    const ps = D.people.filter(p => p.ativo !== false && p.acesso !== 'stakeholder'); const ex = ps.filter(p => ltNorm(p.nome) === n), com = ps.filter(p => ltNorm(p.nome).startsWith(n));
    const achou = ex.length === 1 ? ex : com; if (achou.length !== 1) return achou.length ? 'responsável "' + txt + '" é ambíguo: ' + achou.map(p => p.nome).join(', ') : 'responsável "' + txt + '" não está no time';
    det.resp = achou[0].id; det.respNome = achou[0].nome; return ''; }
  if (campo === 'prazo'){ const d = ltDataEntrega(txt); if (!d) return 'prazo "' + txt + '" não vale: use dia/mês/ano (ex.: prazo: 15/11/2026)'; det.prazo = d; return ''; }
  if (campo === 'origem'){ det.origemTxt = txt; return ''; }
  if (campo === 'depende'){ det.dependeTxt = det.dependeTxt || []; if (!det.dependeTxt.some(x => ltNorm(x) === ltNorm(txt))) det.dependeTxt.push(txt); return ''; }   // pode repetir: uma linha por item   // conferida no fim: pode ser um item que está mais abaixo no mesmo texto
  return '';
}
function ltLer(texto){
  const frentes = ltFrentes(), padrao = UI.sel.startsWith('ws:') ? UI.sel.slice(3) : primeiroWs(UI.sel);
  const pj = cadeia(UI.sel).project;
  const epicsJa = pj ? issuesEm('project:' + pj.id).filter(i => i.tipo === 'epic' && !i.arquivado) : [];
  const achaFrente = nome => { const n = ltNorm(nome); return frentes.find(w => ltNorm(w.nome) === n) || frentes.find(w => ltNorm(byId('apps', w.app).nome + ' › ' + w.nome) === n) || null; };
  const versoes = ltVersoesDoProjeto();
  const achaVersao = nome => { const n = ltNorm(nome); return versoes.find(v => ltNorm(v.nome) === n) || null; };
  const grupos = [], avisos = [], novasV = [], erros = [], vdecl = [], pronto = [], loteInfo = {nome:'', depois:[]};
  let atual = null, alvo = null;   // alvo: o item (ou o épico) que recebe as linhas de detalhe
  const erro = (k, msg, quem) => { const e = {linha:k + 1, msg}; erros.push(e); if (quem) (quem.erros = quem.erros || []).push(e); };
  String(texto || '').split(/\r?\n/).forEach((bruta, k) => {
    let l = bruta.trim(); if (!l) return;
    const item = /^[-*•–]\s*/.test(l); if (item) l = l.replace(/^[-*•–]\s*/, '').trim(); if (!l) return;
    // linha de detalhe: um dos campos conhecidos, com dois pontos (recuo opcional)
    const md = !item && /^([A-Za-zÀ-ÿ ]{2,22}):\s*(.*)$/.exec(l), campo = md && LT_CAMPOS[ltNorm(md[1])];
    if (md && !campo && /^\s/.test(bruta)){ erro(k, 'campo "' + md[1].trim() + '" não existe. Use: como, quero, para, aceite, prioridade, valor, pontos, tipo, origem, meta, versão, entrega ou pronto', alvo); return; }
    if (campo){
      // a Definição de Pronto do projeto: uma linha por regra, em qualquer lugar do texto
      // o nome deste lote e de quais lotes ele vem depois (quando o trabalho é dividido em vários textos)
      if (campo === 'lote'){ if (md[2].trim()) loteInfo.nome = md[2].trim().slice(0, 120); return; }
      if (campo === 'depoisde'){ md[2].split(/[,;]/).map(x => x.trim()).filter(Boolean).forEach(x => { if (!loteInfo.depois.some(y => ltNorm(y) === ltNorm(x))) loteInfo.depois.push(x.slice(0, 120)); }); return; }
      if (campo === 'pronto'){ const t = md[2].trim(); if (!t){ erro(k, 'falta o valor depois de "pronto:"'); return; } if (t.length > 300){ erro(k, 'a regra da Definição de Pronto passa de 300 letras'); return; } if (!pronto.some(x => ltNorm(x) === ltNorm(t))) pronto.push(t); return; }
      // uma versão: "versão: v1.3" e, logo abaixo, "entrega: 15/11/2026" e "meta: ..."
      if (campo === 'versao'){
        const nome = md[2].trim(); if (!nome){ erro(k, 'falta o nome depois de "versão:" (ex.: versão: v1.3)'); return; }
        if (vdecl.some(v => ltNorm(v.nome) === ltNorm(nome))){ erro(k, 'a versão "' + nome + '" aparece duas vezes'); return; }
        const ja = achaVersao(nome);
        alvo = {ehVersao:true, nome:ja ? ja.nome : nome, ja, entrega:null, meta:null, linha:k + 1, erros:[]}; vdecl.push(alvo);
        if (!ja && !novasV.includes(nome)) novasV.push(nome);
        return;
      }
      if (campo === 'entrega'){
        if (!alvo || !alvo.ehVersao){ erro(k, 'a data de entrega é da versão: escreva logo abaixo da linha "versão: ..."', alvo); return; }
        const d = ltDataEntrega(md[2]); if (!d){ erro(k, 'data de entrega "' + md[2].trim() + '" não vale: use dia/mês/ano (ex.: entrega: 15/11/2026)', alvo); return; }
        alvo.entrega = d; return;
      }
      if (campo === 'meta' && alvo && alvo.ehVersao){
        if (alvo.meta != null){ erro(k, '"meta" aparece duas vezes na mesma versão', alvo); return; }
        if (!md[2].trim() || md[2].trim().length > 1000){ erro(k, md[2].trim() ? 'a meta passa de 1000 letras' : 'falta o valor depois de "meta:"', alvo); return; }
        alvo.meta = md[2].trim(); return;
      }
      if (campo === 'meta'){
        if (!alvo || alvo.ehItem){ erro(k, 'a meta é do épico: escreva logo abaixo da linha do épico (sem traço)', alvo); return; }
        if (alvo.meta != null){ erro(k, '"meta" aparece duas vezes no mesmo épico', alvo); return; }
        if (md[2].trim().length > 1000){ erro(k, 'a meta passa de 1000 letras', alvo); return; }
        if (!md[2].trim()){ erro(k, 'falta o valor depois de "meta:"', alvo); return; }
        alvo.meta = md[2].trim(); return;
      }
      if (!alvo || !alvo.ehItem){ erro(k, 'esta linha é detalhe de item: coloque logo abaixo de uma linha que começa com -', alvo && !alvo.ehVersao ? alvo : null); return; }
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
    if (!item){ const ja = epicsJa.find(e => ltNorm(e.titulo) === ltNorm(l)) || null; atual = {titulo:l, ws:ws || (ja ? ja.ws : ltFrenteDoAssunto(padrao, l) || padrao), mc:mc || (ja ? ja.marco || null : null), ja, itens:[], linha:k + 1, meta:null, erros:[]}; grupos.push(atual); alvo = atual; return; }
    if (!atual){ atual = {titulo:null, ws:padrao, mc:null, ja:null, itens:[], meta:null, erros:[]}; grupos.push(atual); }
    const it = {titulo:l, ws:ws || ltFrenteDoAssunto(atual.ws, l) || atual.ws, mc:mc || atual.mc, ehItem:true, det:{}, erros:[], linha:k + 1};
    if (l.length > 300) erro(k, 'o título passa de 300 letras', it);
    if (atual.itens.some(x => ltNorm(x.titulo) === ltNorm(l))) erro(k, 'o item "' + l + '" aparece duas vezes no mesmo épico', it);
    // o mesmo título num épico que já existe: não duplica, atualiza
    if (atual.ja) it.ja = D.issues.find(x => x.pai === atual.ja.id && !x.arquivado && ltNorm(x.titulo) === ltNorm(l)) || null;
    atual.itens.push(it); alvo = it;
  });
  // depois de ler tudo: o que só dá para conferir no fim
  // versão nova precisa da data de entrega (declarada com "versão:" e "entrega:")
  vdecl.forEach(v => { if (!v.ja && !v.entrega) erro(v.linha - 1, 'a versão nova "' + v.nome + '" precisa da data de entrega: escreva logo abaixo "entrega: 15/11/2026"', v); });
  const semData = n => !vdecl.some(v => ltNorm(v.nome) === ltNorm(n) && v.entrega);
  const msgV = n => 'a versão "' + n + '" ainda não existe e precisa da data de entrega: declare antes, numa linha "versão: ' + n + '" com "entrega: 15/11/2026" embaixo';
  grupos.forEach(g => { if (g.mc && String(g.mc).startsWith(LT_NOVA) && semData(g.mc.slice(LT_NOVA.length)) && g.linha) erro(g.linha - 1, msgV(g.mc.slice(LT_NOVA.length)), g);
    g.itens.forEach(it => { if (it.mc && it.mc !== g.mc && String(it.mc).startsWith(LT_NOVA) && semData(it.mc.slice(LT_NOVA.length))) erro(it.linha - 1, msgV(it.mc.slice(LT_NOVA.length)), it); }); });
  // origem: a chave (BL-12) ou o título de um item que já existe, ou um item deste mesmo texto (pelo título ou pela posição: #3 é o 3º item do texto)
  const todos = []; grupos.forEach(g => g.itens.forEach(it => todos.push(it)));
  const noProj = pj ? issuesEm('project:' + pj.id).filter(i => !i.arquivado) : [];
  // depende: a mesma busca da origem (chave, título ou posição no texto)
  const acharRef = (it, txt) => { const n = ltNorm(txt), pos = /^#\s*(\d+)$/.exec(txt.trim());
    if (pos){ const a = todos[+pos[1] - 1]; return a && a !== it ? {lote:a, nome:a.titulo + ' (' + txt.trim() + ' deste texto)'} : null; }
    const o = noProj.find(i => typeof chaveDe === 'function' && ltNorm(chaveDe(i)) === n) || noProj.find(i => ltNorm(i.titulo) === n);
    if (o) return o.id === (it.ja && it.ja.id) ? null : {id:o.id, nome:((typeof chaveDe === 'function' && chaveDe(o)) || '') + ' ' + o.titulo};
    const d = todos.find(x => x !== it && ltNorm(x.titulo) === n); return d ? {lote:d, nome:d.titulo + ' (deste texto)'} : null; };
  const faltam = new Set();
  todos.forEach(it => (it.det.dependeTxt || []).forEach(txt => { const r = acharRef(it, txt);
    if (!r){ faltam.add(txt); erro(it.linha - 1, 'depende "' + txt + '" não existe neste projeto nem neste texto: use a chave (BL-12), o título do item ou a posição no texto (#3)', it); return; }
    if (r.lote && r.lote.erros.length){ erro(it.linha - 1, 'o item "' + r.lote.titulo + '" de que este depende tem erro e fica de fora: corrija ele primeiro', it); return; }
    (it.det.depende = it.det.depende || []).push(r); }));
  todos.forEach(it => { const txt = it.det.origemTxt; if (!txt) return; const n = ltNorm(txt);
    const pos = /^#\s*(\d+)$/.exec(txt.trim());
    if (pos){ const alvoL = todos[+pos[1] - 1]; if (!alvoL || alvoL === it){ erro(it.linha - 1, 'origem "' + txt + '": não há ' + (alvoL === it ? 'outro ' : '') + 'item nessa posição no texto (#1 é o primeiro item)', it); return; } it.det.origemLote = alvoL; it.det.origemNome = alvoL.titulo + ' (' + txt.trim() + ' deste texto)'; return; }
    const o = noProj.find(i => typeof chaveDe === 'function' && ltNorm(chaveDe(i)) === n) || noProj.find(i => ltNorm(i.titulo) === n);
    if (o){ it.det.origem = o.id; it.det.origemNome = ((typeof chaveDe === 'function' && chaveDe(o)) || '') + ' ' + o.titulo; return; }
    const doTexto = todos.find(x => x !== it && ltNorm(x.titulo) === n);
    if (doTexto){ it.det.origemLote = doTexto; it.det.origemNome = doTexto.titulo + ' (deste texto)'; return; }
    erro(it.linha - 1, 'origem "' + txt + '" não existe neste projeto nem neste texto: use a chave (BL-12), o título do item ou a posição no texto (#3)', it); });
  todos.forEach(it => { const o = it.det.origemLote; if (o && o.erros.length) erro(it.linha - 1, 'o item de origem "' + o.titulo + '" tem erro e fica de fora: corrija ele primeiro', it); });
  // a versão declarada vale também para o {nome} escrito antes ou depois dela
  grupos.forEach(g => g.itens.forEach(it => {
    if (it.det.tipo === 'bug' && !it.det.origem && !it.det.origemLote && !it.det.origemTxt && !(it.ja && it.ja.origem)) erro(it.linha - 1, 'o Bug "' + it.titulo + '" precisa da origem: o item cujo critério não foi cumprido (ex.: origem: BL-12)', it);
    if (it.ja && it.ja.status === 'done' && (it.det.quem || it.det.quero || it.det.para || (it.det.aceite || []).length))
      erro(it.linha - 1, '"' + it.titulo + '" já foi aceito: a história e os critérios não mudam. Para mudar, crie um item novo com tipo: Melhoria', it);
  }));
  erros.sort((a, b) => a.linha - b.linha);
  return {loteInfo, faltam:[...(typeof faltam !== 'undefined' ? faltam : [])], grupos, avisos, padrao, novasV:novasV.filter(n => !vdecl.some(v => ltNorm(v.nome) === ltNorm(n) && v.erros.length)), erros, vdecl, pronto};
}
// o que cada item vai receber, para a prévia e para gravar
const ltTemDet = det => Object.keys(det).some(k => !['origemNome','origemTxt','origemLote','dependeTxt'].includes(k));
function ltResumo(r){
  let epNovos = 0, novos = 0, atualiza = 0, igual = 0, comErro = 0;
  r.grupos.forEach(g => { if (g.erros.length){ comErro += 1 + g.itens.length; return; } if (g.titulo && !g.ja) epNovos++;
    g.itens.forEach(i => { if (i.erros.length) comErro++; else if (i.ja){ if (ltTemDet(i.det)) atualiza++; else igual++; } else novos++; }); });
  const versoes = (r.vdecl || []).filter(v => !v.erros.length && (!v.ja || v.entrega || v.meta)).length, pronto = (r.pronto || []).length;
  return {epNovos, novos, atualiza, igual, comErro, versoes, pronto};
}
// as versões que valem aqui: as do ponto escolhido e as de todo o projeto (uma versão do projeto vale para as aplicações dele)
function ltVersoesDoProjeto(){
  const pj = cadeia(UI.sel).project, aqui = marcosDoEscopo(UI.sel);
  const doProj = pj ? D.marcos.filter(m => m.tipo === 'release' && (m.no === 'project:' + pj.id || dentroDe(m.no, 'project:' + pj.id))) : [];
  return aqui.concat(doProj.filter(m => !aqui.includes(m)));
}
const ltFrenteNome = id => { const w = byId('ws', id); return w ? w.nome : 'sem frente'; };
const LT_NOVA = 'nova:';   // versão escrita no texto que ainda não existe: é criada junto, no projeto
const ltVersao = id => { if (id && String(id).startsWith(LT_NOVA)) return '<span class="lt-fr lt-vs">' + esc(id.slice(LT_NOVA.length)) + ' (nova)</span>'; const v = id && D.marcos.find(x => x.id === id); return v ? '<span class="lt-fr lt-vs">' + esc(v.nome) + '</span>' : ''; };
// a próxima versão depois da maior que existe: v1.2 vira v1.3, v1.2.0 vira v1.3.0; sem nenhuma, v0.1
function ltProximaVersao(){
  const ns = ltVersoesDoProjeto().filter(m => m.tipo === 'release').map(m => m.nome);
  const lidas = ns.map(n => { const m = /^(\D*)(\d+)\.(\d+)(?:\.(\d+))?/.exec(n); return m ? {pre:m[1] || 'v', a:+m[2], b:+m[3], c:m[4] == null ? null : +m[4]} : null; }).filter(Boolean);
  if (!lidas.length) return 'v0.1';
  lidas.sort((x, y) => y.a - x.a || y.b - x.b || (y.c || 0) - (x.c || 0));
  const t = lidas[0]; return t.pre + t.a + '.' + (t.b + 1) + (t.c == null ? '' : '.0');
}
function ltDetHTML(det){
  const p = [];
  if (det.quem || det.quero || det.para) p.push('<p class="lt-hist">Como ' + esc(det.quem || '...') + ', quero ' + esc(det.quero || '...') + ', para ' + esc(det.para || '...') + '.</p>');
  const chips = [];
  if (det.resp) chips.push('<span class="lt-chip">responsável: ' + esc(det.resp === '-' ? 'ninguém' : det.respNome) + '</span>');
  if (det.prazo) chips.push('<span class="lt-chip">prazo ' + esc(fmtData(det.prazo)) + '</span>');
  if (det.tipo && det.tipo !== 'item') chips.push('<span class="lt-chip lt-' + det.tipo + '">' + (det.tipo === 'bug' ? 'Bug' : det.tipo === 'tarefa' ? 'Tarefa externa' : det.tipo === 'decisao' ? 'Decisão' : 'Melhoria') + (det.origemNome ? ' de ' + esc(det.origemNome.trim()) : '') + '</span>');
  if (det.classe || det.nivel) chips.push('<span class="lt-chip">' + esc([det.classe ? ({deve:'Deve', deveria:'Deveria', poderia:'Poderia', nao_tera:'Não terá agora'})[det.classe] : '', det.nivel ? 'nível ' + det.nivel : ''].filter(Boolean).join(' · ')) + '</span>');
  if (det.valor) chips.push('<span class="lt-chip">valor ' + det.valor + (det.valorMotivo ? ': ' + esc(det.valorMotivo) : '') + '</span>');
  if (det.pontos) chips.push('<span class="lt-chip">' + det.pontos + ' pts</span>');
  (det.depende || []).forEach(d => chips.push('<span class="lt-chip lt-dep">depende de ' + esc(d.nome.trim()) + '</span>'));
  if (chips.length) p.push('<div class="lt-chips">' + chips.join('') + '</div>');
  if ((det.aceite || []).length) p.push('<ul class="lt-crit">' + det.aceite.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul>');
  return p.join('');
}
function ltPreviaHTML(r){
  if (!r.grupos.length && !(r.erros || []).length && !(r.vdecl || []).length && !(r.pronto || []).length) return '<p class="lt-vazio">A prévia aparece aqui enquanto você escreve.</p>';
  const s = ltResumo(r), partes = [];
  if (s.epNovos) partes.push('<b>' + s.epNovos + (s.epNovos === 1 ? ' épico novo' : ' épicos novos') + '</b>');
  if (s.novos) partes.push('<b>' + s.novos + (s.novos === 1 ? ' item novo' : ' itens novos') + '</b>');
  if (s.atualiza) partes.push('<b>' + s.atualiza + (s.atualiza === 1 ? ' item atualizado' : ' itens atualizados') + '</b>');
  if (s.versoes) partes.push('<b>' + s.versoes + (s.versoes === 1 ? ' versão' : ' versões') + '</b>');
  if (s.pronto) partes.push('<b>a Definição de Pronto</b>');
  const chaveDo = x => (typeof chaveDe === 'function' && chaveDe(x)) || '';
  return '<p class="lt-conta">' + (partes.length ? partes.join(', ').replace(/, ([^,]*)$/, ' e $1') + (s.epNovos + s.novos === 1 && !s.atualiza ? ' vai ser criado.' : ' vão ser gravados.') : 'Nada para gravar ainda.') +
      (r.novasV && r.novasV.length ? ' Junto, ' + (r.novasV.length === 1 ? 'a versão nova ' : 'as versões novas ') + '<b>' + r.novasV.map(esc).join(', ') + '</b>.' : '') +
      (s.igual ? ' ' + s.igual + (s.igual === 1 ? ' item já existe e fica como está.' : ' itens já existem e ficam como estão.') : '') + '</p>' +
    (r.loteInfo && (r.loteInfo.nome || r.loteInfo.depois.length) ? '<p class="lt-lote-info">' + (r.loteInfo.nome ? 'Lote <b>' + esc(r.loteInfo.nome) + '</b>' : 'Este lote') + (r.loteInfo.depois.length ? ' vem depois de <b>' + r.loteInfo.depois.map(esc).join(', ') + '</b>' : '') + '.</p>' : '') +
    ((r.faltam || []).length ? '<div class="lt-ordem" role="alert"><b>Cole antes ' + (r.loteInfo && r.loteInfo.depois.length ? 'o lote ' + r.loteInfo.depois.map(esc).join(' e o lote ') : 'o lote que cria estes itens') + '</b>' +
      '<p>Este texto depende de ' + r.faltam.length + (r.faltam.length === 1 ? ' item que ainda não existe' : ' itens que ainda não existem') + ' neste projeto (por exemplo: ' + r.faltam.slice(0, 3).map(t => '"' + esc(t) + '"').join(', ') + '). Quando o trabalho é dividido em vários textos, cada um é colado na ordem: primeiro o que cria os itens de que os outros dependem. Cancele, cole o outro lote, clique em Criar tudo e depois volte com este. Enquanto isso, este lote não grava (para não entrar pela metade).</p></div>' : '') +
    ((r.erros || []).length ? '<div class="lt-erros" role="alert"><b>' + r.erros.length + (r.erros.length === 1 ? ' erro' : ' erros') + (s.comErro ? ': ' + s.comErro + (s.comErro === 1 ? ' item fica de fora' : ' itens ficam de fora') + ' até corrigir' : '') + '</b><ul>' + r.erros.map(e => '<li>Linha ' + e.linha + ': ' + esc(e.msg) + '</li>').join('') + '</ul></div>' : '') +
    (r.avisos.length ? '<ul class="lt-avisos">' + r.avisos.map(a => '<li>' + esc(a) + '</li>').join('') + '</ul>' : '') +
    ((r.vdecl || []).length ? '<div class="lt-bloco"><b>Versões</b><ul>' + r.vdecl.map(v => '<li class="' + (v.erros.length ? 'lt-com-erro' : '') + '"><div class="lt-it-tit"><span>' + esc(v.nome) + '</span><span class="lt-tag">' + (v.erros.length ? 'com erro: fica de fora' : v.ja ? (v.entrega || v.meta ? 'já existe: atualiza' : 'já existe') : 'nova') + '</span></div>' +
      '<div class="lt-chips">' + (v.entrega ? '<span class="lt-chip">entrega ' + esc(fmtData ? fmtData(v.entrega) : v.entrega) + '</span>' : v.ja ? '<span class="lt-chip">entrega ' + esc(fmtData ? fmtData(v.ja.data) : v.ja.data) + '</span>' : '') + '</div>' + (v.meta ? '<p class="lt-hist">Meta: ' + esc(v.meta) + '</p>' : '') + '</li>').join('') + '</ul></div>' : '') +
    ((r.pronto || []).length ? '<div class="lt-bloco"><b>Definição de Pronto do projeto</b><ul class="lt-crit">' + r.pronto.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul><small>As regras que ainda não estão lá entram no fim; as que já existem ficam.</small></div>' : '') +
    '<ol class="lt-lista">' + r.grupos.map(g => '<li' + (g.erros.length ? ' class="lt-com-erro"' : '') + '><div class="lt-ep">' + (g.titulo ? '<b>' + esc(g.titulo) + '</b>' + (g.ja ? '<small>já existe: os itens entram nele</small>' : '') : '<b class="lt-sem">Itens sem épico</b>') + '<span class="lt-fr">' + esc(ltFrenteNome(g.ws)) + '</span>' + ltVersao(g.mc) + '</div>' +
      (g.meta ? '<p class="lt-hist">Meta: ' + esc(g.meta) + '</p>' : '') +
      (g.itens.length ? '<ul>' + g.itens.map(i => '<li class="' + (i.erros.length ? 'lt-com-erro' : '') + '"><div class="lt-it-tit"><span>' + esc(i.titulo) + '</span>' +
        (i.erros.length ? '<span class="lt-tag lt-tag-erro">com erro: fica de fora</span>' : i.ja ? '<span class="lt-tag">' + (ltTemDet(i.det) ? 'já existe' + (chaveDo(i.ja) ? ' (' + esc(chaveDo(i.ja)) + ')' : '') + ': atualiza' : 'já existe: fica como está') + '</span>' : '') +
        (i.ws !== g.ws ? '<span class="lt-fr">' + esc(ltFrenteNome(i.ws)) + '</span>' : '') + (i.mc !== g.mc ? ltVersao(i.mc) : '') + '</div>' + ltDetHTML(i.det) +
        (i.erros.length ? '<ul class="lt-it-erros">' + i.erros.map(e => '<li>Linha ' + e.linha + ': ' + esc(e.msg) + '</li>').join('') + '</ul>' : '') + '</li>').join('') + '</ul>' : '') + '</li>').join('') + '</ol>';
}
// "depende de": a ligação "é bloqueado por" que o item já tem (sem repetir)
function ltDepender(x, alvoId){
  if (!x || !alvoId || alvoId === x.id) return; x.links = x.links || [];
  const ja = x.links.some(l => l.alvo === alvoId && l.tipo === 'Is blocked by') || ((byId('issues', alvoId) || {}).links || []).some(l => l.alvo === x.id && l.tipo === 'Blocks');
  if (!ja) x.links.push({tipo:'Is blocked by', alvo:alvoId});
}
// os itens que já existem e o lote vai mexer (para o Desfazer o último lote)
function ltTocados(r){ const L = []; r.grupos.forEach(g => { if (g.ja) L.push(g.ja.id); g.itens.forEach(i => { if (i.ja) L.push(i.ja.id); }); }); return L; }
// grava os detalhes num item (novo ou que já existe): só o que veio no texto; nada do que já existe é apagado
function ltAplicar(x, det){
  if (det.quem) x.hQuem = det.quem; if (det.quero) x.hQuero = det.quero; if (det.para) x.hPara = det.para;
  if (det.classe) x.moscow = det.classe;
  if (det.nivel){ x.nivel = det.nivel; x.prio = ({1:'highest', 2:'high', 3:'medium', 4:'low', 5:'low'})[det.nivel]; }
  if (det.valor) x.valor = det.valor; if (det.valorMotivo) x.valorMotivo = det.valorMotivo;
  if (det.pontos) x.pontos = det.pontos;
  if (det.origem) x.origem = det.origem;
  if (det.tipo === 'melhoria'){ x.melhoria = true; x.externa = false; } else if (det.tipo === 'item'){ x.melhoria = false; x.externa = false; }
  if (det.tipo === 'tarefa'){ if (x.tipo === 'task') { x.externa = true; x.melhoria = false; } else if (typeof poMudarTipo === 'function') poMudarTipo(x, 'tarefa'); }
  if (det.tipo === 'decisao'){ if (x.tipo === 'task') { x.decisao = true; x.externa = false; x.melhoria = false; } else if (typeof poMudarTipo === 'function') poMudarTipo(x, 'decisao'); }
  if (det.resp) x.resp = det.resp === '-' ? null : det.resp;
  if (det.prazo){ x.fim = det.prazo; x.alvo = det.prazo; if (x.ini && x.ini > det.prazo) x.ini = det.prazo; }
  if (det.tipo === 'bug' && x.tipo !== 'bug' && typeof poMudarTipo === 'function') poMudarTipo(x, 'bug');
  if (det.tipo && det.tipo !== 'bug' && x.tipo === 'bug' && typeof poMudarTipo === 'function') poMudarTipo(x, det.tipo);
  (det.depende || []).forEach(d => { if (d.id) ltDepender(x, d.id); });
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
  const versoes = ltVersoesDoProjeto().filter(m => m.tipo === 'release' && !m.entregue).map(m => m.nome), prox = ltProximaVersao();
  const bt = (tipo, valor, txt, tit) => '<button type="button" class="lt-at" data-lt-por="' + tipo + '" data-lt-valor="' + esc(valor) + '"' + (tit ? ' title="' + esc(tit) + '"' : '') + '>' + txt + '</button>';
  const grupo = (rot, dica, botoes) => botoes ? '<div class="lt-at-g"><span class="lt-at-rot" title="' + esc(dica) + '">' + rot + '</span><div class="lt-at-bts">' + botoes + '</div></div>' : '';
  return '<div class="lt-atalhos" role="toolbar" aria-label="Atalhos para escrever">' +
    grupo('Linha nova', 'Acrescenta uma linha embaixo da linha onde está o cursor', bt('epico', '', ICO.mais + 'Épico') + bt('item', '', ICO.mais + 'Item') + bt('nova-versao', prox, ICO.mais + 'Versão nova', 'Versão ' + prox + ', com a data de entrega') + bt('pronto', '', ICO.mais + 'Regra de pronto', 'Uma regra da Definição de Pronto do projeto')) +
    grupo('Detalhe do item', 'Acrescenta, embaixo do item, uma linha campo: valor', [['como', 'Como'], ['quero', 'Quero'], ['para', 'Para'], ['aceite', 'Critério'], ['prioridade', 'Prioridade'], ['valor', 'Valor'], ['pontos', 'Pontos'], ['tipo', 'Tipo'], ['origem', 'Origem'], ['depende', 'Depende de']].map(([k, n]) => bt('det', k, n)).join('')) +
    grupo('Épico ou versão', 'Embaixo da linha do épico ou da versão', bt('det', 'meta', 'Meta') + bt('det', 'entrega', 'Data de entrega')) +
    grupo('Frente da linha', 'Põe [frente] no fim da linha onde está o cursor', frentes.map(n => bt('frente', n, esc(n))).join('')) +
    grupo('Versão da linha', 'Põe {versão} no fim da linha onde está o cursor', versoes.map(n => bt('versao', n, esc(n))).join('')) + '</div>';
}
// põe o atalho na linha onde está o cursor: troca a frente ou a versão que já estiver no fim da linha
function ltPor(ta, tipo, valor){
  const v = ta.value, pos = ta.selectionStart == null ? v.length : ta.selectionStart;
  const ini = v.lastIndexOf('\n', pos - 1) + 1, fimN = v.indexOf('\n', pos), fim = fimN < 0 ? v.length : fimN;
  let linha = v.slice(ini, fim), cursor;
  if (tipo === 'nova-versao' || tipo === 'pronto'){
    const antes = v.slice(0, fim), depois = v.slice(fim), sep = antes.trim() ? '\n' : '';
    const novo = tipo === 'pronto' ? sep + 'pronto: ' : sep + 'versão: ' + valor + '\n  entrega: ';
    ta.value = antes + novo + depois; cursor = (antes + novo).length;
    ta.focus(); ta.setSelectionRange(cursor, cursor); return;
  }
  if (tipo === 'det'){
    // uma linha de detalhe logo abaixo da linha onde está o cursor (a meta sem recuo, logo abaixo do épico)
    const antes = v.slice(0, fim), depois = v.slice(fim);
    const novo = '\n' + (valor === 'meta' ? '' : '  ') + valor + ': ';   // meta sem recuo (do épico); entrega com recuo (da versão)
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
  const linhaG = (ex, txt) => '<tr><td><code>' + esc(ex) + '</code></td><td>' + txt + '</td></tr>';
  modal('Criar em lote',
    '<div class="lt-topo"><div class="lt-topo-t"><b>Montar com um agente de IA</b><span>Baixe ou copie as instruções, converse com o agente e cole aqui o texto que ele devolver. Elas já levam as frentes, versões, épicos e itens deste projeto.</span></div>' +
      '<div class="lt-topo-b"><button type="button" class="btn peq" data-lt-ia-baixar>Baixar instruções</button><button type="button" class="btn sec peq" data-lt-ia-copiar>Copiar instruções</button>' +
      '<span class="lt-topo-sep" aria-hidden="true"></span><button type="button" class="btn fant peq" data-lt-exemplo>Exemplo simples</button><button type="button" class="btn fant peq" data-lt-exemplo-completo>Exemplo completo</button></div></div>' +
    '<div class="lt-grade"><section class="lt-esq"><h3 class="lt-passo"><span>1</span><label for="lt-t">Escreva ou cole o texto</label></h3>' +
      ltAtalhosHTML() +
      '<textarea class="campo lt-texto" id="lt-t" rows="16" spellcheck="false" placeholder="' + esc(LT_EXEMPLO) + '"></textarea></section>' +
    '<section class="lt-dir"><h3 class="lt-passo"><span>2</span>Confira a prévia</h3><div class="lt-previa" aria-live="polite">' + ltPreviaHTML({grupos:[], avisos:[], erros:[]}) + '</div>' +
      '<p class="lt-nota">Nada é gravado antes de <b>Criar tudo</b>. Linha com erro aparece em vermelho e o item dela fica de fora.</p></section></div>' +
    '<details class="lt-guia"><summary>Como escrever: o formato em uma tabela</summary><div class="lt-guia-rolo"><table class="lt-guia-t"><thead><tr><th>Escreva</th><th>O que acontece</th></tr></thead><tbody>' +
      linhaG('Carteira de clientes', 'Linha sem traço vira <b>épico</b>. Com o mesmo nome de um que já existe, os itens entram nele') +
      linhaG('- Cadastro do cliente', 'Linha com traço vira <b>item</b> do épico de cima. A ordem das linhas vira a ordem da fila') +
      linhaG('[Frontend]  {v1.3}', 'No fim da linha: a <b>frente</b> e a <b>versão</b>. Sem frente, o item vai para a do assunto (tela → Frontend, webhook → Integrações, tabela → Database...) ou herda a do épico') +
      linhaG('  como: / quero: / para:', 'A <b>história</b> do item, logo abaixo dele') +
      linhaG('  aceite: Salva o CPF', 'Um <b>critério de aceite</b> por linha. Repetido é ignorado') +
      linhaG('  prioridade: Deve 2', '<b>Prioridade</b>: Deve, Deveria, Poderia ou Não terá agora, e o nível de 1 a 5') +
      linhaG('  valor: 8 menos suporte', '<b>Valor</b> de 1 a 10 e o motivo') +
      linhaG('  pontos: 5', '<b>Estimativa</b>: 1, 2, 3, 5, 8, 13 ou 20') +
      linhaG('  tipo: Bug  /  origem: #1', '<b>Tipo</b> Item, Bug ou Melhoria. A origem é a chave (BL-12), o título ou a posição no texto (#1)') +
      linhaG('  depende: #1  /  BL-12', 'O item só começa depois de outro: a chave, o título ou a posição no texto. Uma linha por item') +
      linhaG('lote: Backend  /  depois de: Database', 'No começo do texto: o nome do lote e de qual lote ele vem depois. <b>Cole primeiro</b> o lote de que este depende') +
      linhaG('meta: ...', 'Logo abaixo do épico (ou da versão): a <b>meta</b>') +
      linhaG('versão: v1.3  /  entrega: 15/11/2026', '<b>Versão nova</b>, com a data de entrega (obrigatória)') +
      linhaG('pronto: Testado no celular', 'Uma regra da <b>Definição de Pronto</b> do projeto') +
    '</tbody></table></div><p class="lt-nota">Item com o mesmo título num épico que já existe não duplica: recebe os campos novos e não perde nada.</p></details>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Criar tudo', acao:dl => {
      const r = ltLer($('#lt-t', dl).value); const sr = ltResumo(r);
      if ((r.faltam || []).length){ toast('Cole antes ' + (r.loteInfo && r.loteInfo.depois.length ? 'o lote ' + r.loteInfo.depois.join(' e o lote ') : 'o lote que cria os itens de que este depende') + '. Nada foi gravado, para o lote não entrar pela metade.'); return false; }
      const novos = sr.epNovos, nItens = sr.novos;
      if (!novos && !nItens && !sr.atualiza && !sr.versoes && !sr.pronto){ toast(r.erros.length ? 'Corrija os erros da prévia: nada foi gravado' : r.grupos.length ? 'Nada muda: tudo já existe como está' : 'Escreva pelo menos um épico ou um item'); return false; }
      const feitos = [novos ? novos + (novos === 1 ? ' épico' : ' épicos') + ' criado' + (novos === 1 ? '' : 's') : '', nItens ? nItens + (nItens === 1 ? ' item criado' : ' itens criados') : '',
        sr.atualiza ? sr.atualiza + (sr.atualiza === 1 ? ' item atualizado' : ' itens atualizados') : '', sr.versoes ? sr.versoes + (sr.versoes === 1 ? ' versão' : ' versões') : '', sr.pronto ? 'Definição de Pronto atualizada' : ''].filter(Boolean);
      tfComDesfazer(feitos.join(', ').replace(/, ([^,]*)$/, ' e $1') + (sr.comErro ? '. ' + sr.comErro + (sr.comErro === 1 ? ' com erro ficou de fora' : ' com erro ficaram de fora') : '') + '.', () => leRegistrar('Criar em lote', feitos.join(', '), ltTocados(r), () => {
        const pj = noDono(UI.sel), idNova = {};
        const decl = n => (r.vdecl || []).find(v => ltNorm(v.nome) === ltNorm(n) && !v.erros.length);
        r.novasV.forEach(n => { const v = decl(n); if (!v || !v.entrega) return; const m = {id:uid('mc'), no:pj, tipo:'release', nome:v.nome, desc:'', data:v.entrega, vis:true, entregue:null, notas:'', meta:v.meta || ''}; D.marcos.push(m); idNova[ltNorm(n)] = m.id; });
        (r.vdecl || []).forEach(v => { if (v.erros.length || !v.ja) return; const m = byId('marcos', v.ja.id); if (!m) return; if (v.entrega) m.data = v.entrega; if (v.meta) m.meta = v.meta; });
        const pjo = cadeia(UI.sel).project;
        if (pjo && (r.pronto || []).length){ const tem = new Set(String(pjo.dod || '').split('\n').map(l => ltNorm(l.replace(/^[-*•]\s*/, '')))); const novasR = r.pronto.filter(t => !tem.has(ltNorm(t)));
          if (novasR.length) pjo.dod = (String(pjo.dod || '').trim() ? String(pjo.dod).trim() + '\n' : '') + novasR.map(t => '- ' + t).join('\n'); }
        const vs = x => x && String(x).startsWith(LT_NOVA) ? idNova[ltNorm(String(x).slice(LT_NOVA.length))] || null : x;
        r.grupos.forEach(g => { if (g.erros.length) return; g.mc = vs(g.mc); g.itens.forEach(i => { i.mc = vs(i.mc); });
          const ep = g.titulo ? (g.ja && byId('issues', g.ja.id)) || ltNovo(g.titulo, g.ws, 'epic', 'todo', null, g.mc) : null;
          if (ep && g.meta) ep.meta = g.meta;
          g.itens.forEach(i => { if (i.erros.length) return;
            if (i.ja){ const x = byId('issues', i.ja.id); i._feito = x; if (x && ltTemDet(i.det)) ltAplicar(x, i.det); return; }
            const ni = ltNovo(i.titulo, i.ws, i.det.tipo === 'bug' ? 'bug' : (i.det.tipo === 'tarefa' || i.det.tipo === 'decisao') ? 'task' : ep ? 'story' : 'task', 'backlog', ep ? ep.id : null, i.mc); i._feito = ni; ltAplicar(ni, i.det); });
        });
        // origem apontando para um item deste mesmo texto: liga depois que todos existem
        r.grupos.forEach(g => g.itens.forEach(i => { const o = i.det.origemLote; if (i._feito && o && o._feito && o._feito !== i._feito) i._feito.origem = o._feito.id;
          (i.det.depende || []).forEach(d => { if (d.lote && d.lote._feito && i._feito) ltDepender(i._feito, d.lote._feito.id); }); }));
      }));
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
