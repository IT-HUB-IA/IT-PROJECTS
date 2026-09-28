/* =====================================================================
   AGENT STUDIO (só o dono do sistema)
   A oficina do assistente de IA do CicloDev. O agente nasce em branco: sabe só o que o dono
   coloca aqui (instruções, documentos .md, funções). Tudo vem das tabelas studio_* do banco
   (banco/17_agent_studio.sql), que só o dono do sistema lê e muda.
   ===================================================================== */
const ST = {lido:false, ag:null, docs:null, versoes:null, funcoes:null, busca:null, buscando:false, carregando:false, erro:null, enviando:null};
const ST_MODELOS = [['claude-opus-5-5','Claude Opus 5.5 (o mais preciso)'],['claude-sonnet-5-5','Claude Sonnet 5.5 (mais barato)'],['claude-haiku-4-5','Claude Haiku 4.5 (o mais rápido)']];
const ST_TIPO = {livro:'Livro', manual:'Manual', regra:'Regra', exemplo:'Exemplo', outro:'Outro'};
const ST_PESO = {fundamental:'Fundamental', apoio:'Apoio'};
const ST_ACAO = {ler:'Consultar', criar:'Criar', editar:'Editar', apagar:'Apagar', outra:'Outra'};
const stBanco = () => (COM_BANCO && window.ciclodevBanco && ADM.dono) ? window.ciclodevBanco : null;
const stMil = v => num(+v || 0, 0);
const stPaginas = c => Math.max(1, Math.round((+c || 0) / 1800));   // página de livro: uns 1.800 caracteres

/* ---------- menu e rota: só o dono do sistema ---------- */
{ const li = document.querySelector('.item[data-tela="agentes"]'); if (li) li.parentElement.hidden = true; }
if (COM_BANCO){
  const _entrouSt = window.ciclodevEntrouComo;
  window.ciclodevEntrouComo = function(p){
    const r = _entrouSt(p);
    // o admin.js confere o dono logo depois de entrar; aqui só espera essa resposta
    const conferir = (n) => { if (ADM.dono){ const li = document.querySelector('.item[data-tela="agentes"]'); if (li) li.parentElement.hidden = false; if (UI.modulo === 'agentes') render(); } else if (n < 40) setTimeout(() => conferir(n + 1), 150); };
    Promise.resolve(r).then(() => conferir(0));
    return r;
  };
}
const _abrirModuloSt = abrirModulo;
abrirModulo = function(id){ if (id === 'agentes' && !ADM.dono) id = 'overview'; return _abrirModuloSt(id); };
const _renderSt = render;
render = function(){ if (UI.modulo === 'agentes') return rStudio(); return _renderSt(); };

/* ---------- leitura ---------- */
async function stCarregar(){
  const sb = stBanco(); if (!sb || ST.carregando) return;
  ST.carregando = true; ST.erro = null;
  const a = await sb.from('studio_agentes').select('*');
  if (a.error){ ST.erro = a.error.message; ST.carregando = false; ST.lido = true; return rStudio(); }
  ST.ag = (a.data || [])[0] || null;
  if (ST.ag){
    const [d, v, f] = await Promise.all([sb.rpc('studio_documentos', {p_agente:ST.ag.id}), sb.from('studio_instrucoes_versoes').select('*'), sb.from('studio_funcoes').select('*')]);
    const e = [d, v, f].find(x => x.error);
    if (e) ST.erro = e.error.message;
    else {
      ST.docs = (d.data || []).sort((x, y) => (x.peso === y.peso ? 0 : x.peso === 'fundamental' ? -1 : 1) || String(x.titulo).localeCompare(y.titulo, 'pt-BR'));
      ST.versoes = (v.data || []).filter(x => x.agente_id === ST.ag.id).sort((x, y) => String(y.salvo_em).localeCompare(x.salvo_em));
      ST.funcoes = (f.data || []).filter(x => x.agente_id === ST.ag.id).sort((x, y) => (x.ordem - y.ordem) || String(x.nome).localeCompare(y.nome, 'pt-BR'));
    }
  }
  ST.carregando = false; ST.lido = true;
  if (UI.modulo === 'agentes') rStudio();
}

/* ---------- tela ---------- */
function rStudio(){
  const el = $('#m-agentes'); if (!el) return;
  if (!ADM.dono){ el.innerHTML = '<p class="vazio-linha">Só o dono do sistema abre este módulo.</p>'; return; }
  const topo = '<div class="topo-tela"><div><h1><span>Agent Studio</span>' + I('Agent Studio: a oficina do assistente de IA do CicloDev. Só o dono do sistema vê esta tela.') + '</h1><p class="lead">O assistente nasce em branco: ele sabe só o que você colocar aqui. Instruções, documentos e funções são seus para definir, melhorar ou tirar.</p></div></div>';
  if (!ST.ag){
    el.innerHTML = topo + (ST.erro ? '<p class="entrada-erro">Não foi possível ler o Agent Studio: ' + esc(ST.erro) + '</p>' : !ST.lido ? '<p class="vazio-linha">Lendo o Agent Studio…</p>' : '<p class="vazio-linha">Nenhum agente no banco.</p>');
    if (!ST.lido && !ST.carregando && !ST.erro) stCarregar();
    return;
  }
  const a = ST.ag, docs = ST.docs || [], ligados = docs.filter(d => d.ativo);
  const tokens = ligados.reduce((s, d) => s + (+d.tokens_estimados || 0), 0), trechos = ligados.reduce((s, d) => s + (+d.trechos || 0), 0);
  el.innerHTML = topo + (ST.erro ? '<p class="entrada-erro">' + esc(ST.erro) + '</p>' : '') +
    '<div class="kpis st-kpis">' + admKpi(ligados.length + (docs.length > ligados.length ? '<small> de ' + docs.length + '</small>' : ''), 'Documentos ligados') + admKpi(stMil(trechos), 'Trechos para consulta') + admKpi(stMil(ligados.reduce((s, d) => s + stPaginas(d.caracteres), 0)), 'Páginas, mais ou menos') + admKpi(stMil(tokens), 'Tokens estimados') + '</div>' +
    '<div class="st-grade">' +
    '<section class="g-cartao st-cartao"><h4>O agente</h4>' +
      '<label class="lb">Nome<input class="campo" data-st-ag="nome" value="' + esc(a.nome) + '" maxlength="80"></label>' +
      '<label class="lb">Para que serve<textarea class="campo" rows="2" data-st-ag="descricao" maxlength="500">' + esc(a.descricao || '') + '</textarea></label>' +
      '<label class="lb"><span class="st-rot">Modelo de IA' + I('Modelo de IA: qual versão do Claude responde. O Opus é o mais preciso; o Sonnet custa metade.') + '</span><select class="sel" data-st-ag="modelo">' + ST_MODELOS.map(([k, n]) => '<option value="' + k + '"' + (a.modelo === k ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + (ST_MODELOS.some(m => m[0] === a.modelo) ? '' : '<option selected>' + esc(a.modelo) + '</option>') + '</select></label>' +
      '<div class="aviso-faixa st-aviso"><b>Desligado</b><span>O assistente ainda não conversa com ninguém. Ele liga quando o provedor de IA for conectado e você decidir soltar.</span></div>' +
    '</section>' +
    '<section class="g-cartao st-cartao st-largo"><h4>Instruções' + I('Instruções (system prompt): o texto fixo que diz ao assistente quem ele é, como falar e o que pode ou não fazer. Vale para todas as conversas.') + '</h4>' +
      '<textarea class="campo st-instr" rows="10" data-st-instr placeholder="Em branco. Escreva aqui quem o assistente é, como ele fala e o que ele nunca faz.">' + esc(a.instrucoes || '') + '</textarea>' +
      '<div class="st-linha"><button class="btn" type="button" data-st-salvar-instr>Salvar instruções</button><span class="sec st-dica" data-st-instr-info>' + stMil((a.instrucoes || '').length) + ' caracteres' + (a.atualizado_em ? ' · salvo em ' + esc(admHora(a.atualizado_em)) : '') + '</span>' +
      (ST.versoes && ST.versoes.length ? '<button class="btn sec peq" type="button" data-st-versoes>Versões anteriores (' + ST.versoes.length + ')</button>' : '') + '</div>' +
    '</section></div>' +
    '<section class="g-cartao st-cartao"><h4>Base de conhecimento' + I('Base de conhecimento: os documentos que o assistente estuda antes de responder. Fundamental = base principal; Apoio = consulta extra. Cada documento é cortado em trechos pequenos para a busca achar a parte certa.') + '</h4>' +
      '<div class="st-soltar" data-st-soltar><input type="file" id="st-arq" accept=".md,.markdown,.txt,text/markdown,text/plain" multiple hidden><p><b>Arraste os arquivos .md aqui</b> ou <button class="btn sec peq" type="button" data-st-escolher>Escolher arquivos</button></p><small class="sec">Livros, manuais e regras em Markdown ou texto. Até 8 MB por arquivo.</small>' + (ST.enviando ? '<p class="st-enviando" role="status">' + esc(ST.enviando) + '</p>' : '') + '</div>' +
      (docs.length ? '<div class="tabela-rolo"><table class="tabela st-docs"><thead><tr><th>Documento</th><th>Tipo</th><th>Peso</th><th class="num">Páginas</th><th class="num">Trechos</th><th class="num">Versão</th><th>Ligado</th><th><span class="sr">Ações</span></th></tr></thead><tbody>' +
        docs.map(d => '<tr class="' + (d.ativo ? '' : 'st-desligado') + '"><th scope="row"><b>' + esc(d.titulo) + '</b>' + (d.arquivo_nome ? '<small class="sec st-arq-nome">' + esc(d.arquivo_nome) + '</small>' : '') + '</th>' +
          '<td>' + esc(ST_TIPO[d.tipo] || d.tipo) + '</td><td><span class="pill' + (d.peso === 'fundamental' ? ' st-fund' : '') + '">' + esc(ST_PESO[d.peso] || d.peso) + '</span></td>' +
          '<td class="num">' + stMil(stPaginas(d.caracteres)) + '</td><td class="num">' + stMil(d.trechos) + '</td><td class="num">' + d.versao + '</td>' +
          '<td><label class="st-chave"><input type="checkbox" data-st-ligar="' + d.id + '"' + (d.ativo ? ' checked' : '') + '><span>' + (d.ativo ? 'Sim' : 'Não') + '</span></label></td>' +
          '<td class="st-acoes"><button class="btn sec peq" type="button" data-st-ver="' + d.id + '">Ver</button><button class="btn sec peq" type="button" data-st-editar="' + d.id + '">Editar</button><button class="btn sec peq" type="button" data-st-trocar="' + d.id + '">Trocar arquivo</button><button class="btn sec peq perigo" type="button" data-st-apagar="' + d.id + '">Apagar</button></td></tr>').join('') +
        '</tbody></table></div>' : '<p class="vazio-linha">Nenhum documento ainda. Coloque aqui os seus livros em .md.</p>') +
    '</section>' +
    '<section class="g-cartao st-cartao"><h4>Testar a busca' + I('Testar a busca: escreva uma pergunta e veja quais trechos dos documentos o assistente usaria para responder.') + '</h4>' +
      '<form class="g-add" data-st-buscar><input class="campo" name="q" placeholder="Ex.: como priorizar o que entregar primeiro" value="' + esc((ST.busca && ST.busca.q) || '') + '"' + (ligados.length ? '' : ' disabled') + '><button class="btn sec" type="submit"' + (ligados.length ? '' : ' disabled') + '>Buscar</button></form>' +
      (ST.buscando ? '<p class="vazio-linha">Buscando…</p>' : ST.busca ? (ST.busca.erro ? '<p class="entrada-erro">' + esc(ST.busca.erro) + '</p>' : ST.busca.r.length ? '<ol class="st-achados">' + ST.busca.r.map(t => '<li><div class="st-achado-cab"><b>' + esc(t.titulo) + '</b>' + (t.secao ? '<span class="sec"> › ' + esc(t.secao) + '</span>' : '') + '</div><p>' + esc(String(t.texto).slice(0, 420)) + (String(t.texto).length > 420 ? '…' : '') + '</p></li>').join('') + '</ol>' : '<p class="vazio-linha">Nada encontrado para essa pergunta nos documentos ligados.</p>') : '') +
    '</section>' +
    '<section class="g-cartao st-cartao"><h4>Funções' + I('Funções: o que o assistente poderá fazer no sistema, como criar ou editar tarefas. Criar, editar e apagar sempre pedem o "confirmar" do usuário e só valem onde ele tem permissão.') + '</h4>' +
      ((ST.funcoes || []).length ? '<div class="tabela-rolo"><table class="tabela"><thead><tr><th>Função</th><th>O que faz</th><th>Tipo</th><th>Confirmação</th><th>Ligada</th><th><span class="sr">Ações</span></th></tr></thead><tbody>' +
        ST.funcoes.map(f => '<tr><th scope="row">' + esc(f.nome) + '</th><td>' + esc(f.descricao || '') + '</td><td>' + esc(ST_ACAO[f.acao] || f.acao) + '</td><td>' + (f.pede_confirmacao ? 'Pede confirmação' : 'Faz direto') + '</td>' +
          '<td><label class="st-chave"><input type="checkbox" data-st-fn-ligar="' + f.id + '"' + (f.ativo ? ' checked' : '') + '><span>' + (f.ativo ? 'Sim' : 'Não') + '</span></label></td>' +
          '<td class="st-acoes"><button class="btn sec peq perigo" type="button" data-st-fn-apagar="' + f.id + '">Apagar</button></td></tr>').join('') + '</tbody></table></div>'
        : '<p class="vazio-linha">Nenhuma função ainda. O assistente não faz nada no sistema até você cadastrar e ligar uma.</p>') +
      '<form class="st-fn-form" data-st-fn-nova><input class="campo" name="nome" placeholder="Nome da função, ex.: Criar tarefa" maxlength="80" required><input class="campo" name="descricao" placeholder="O que ela faz, em uma frase" maxlength="4000"><select class="sel" name="acao">' + Object.entries(ST_ACAO).map(([k, n]) => '<option value="' + k + '">' + n + '</option>').join('') + '</select><button class="btn sec" type="submit">Adicionar</button></form>' +
    '</section>';
}

/* ---------- gravar ---------- */
async function stMudarAgente(campos){
  const sb = stBanco(); if (!sb || !ST.ag) return false;
  const {data, error} = await sb.from('studio_agentes').update(campos).eq('id', ST.ag.id).select();
  if (error || !(data || []).length){ toast('Não salvou: ' + (error ? error.message : 'sem permissão')); return false; }
  ST.ag = data[0]; return true;
}
function stTitulo(texto, arquivo){
  const m = /^#[ \t]+(.+)$/m.exec(texto || '');
  return (m ? m[1] : String(arquivo || 'Documento').replace(/\.(md|markdown|txt)$/i, '').replace(/[_-]+/g, ' ')).trim().slice(0, 200) || 'Documento';
}
const stLer = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result || '')); r.onerror = () => rej(r.error); r.readAsText(f, 'utf-8'); });
async function stEnviar(arquivos, trocarId){
  const sb = stBanco(); if (!sb || !ST.ag) return;
  const lista = Array.from(arquivos || []).filter(f => /\.(md|markdown|txt)$/i.test(f.name) || /^text\//.test(f.type));
  if (!lista.length){ toast('Escolha arquivos .md ou .txt'); return; }
  let ok = 0; const erros = [];
  for (const [i, f] of lista.entries()){
    ST.enviando = 'Enviando ' + (i + 1) + ' de ' + lista.length + ': ' + f.name + '…'; rStudio();
    if (f.size > 8000000){ erros.push(f.name + ' passa de 8 MB'); continue; }
    let texto; try { texto = (await stLer(f)).replace(/^﻿/, ''); } catch(e){ erros.push(f.name + ': não deu para ler'); continue; }
    if (!texto.trim()){ erros.push(f.name + ' está vazio'); continue; }
    const r = trocarId
      ? await sb.from('studio_conhecimento').update({conteudo:texto, arquivo_nome:f.name}).eq('id', trocarId).select()
      : await sb.from('studio_conhecimento').insert({agente_id:ST.ag.id, titulo:stTitulo(texto, f.name), arquivo_nome:f.name, conteudo:texto}).select();
    if (r.error || !(r.data || []).length) erros.push(f.name + ': ' + (r.error ? r.error.message : 'sem permissão')); else ok++;
  }
  ST.enviando = null;
  toast(erros.length ? (ok ? ok + ' enviado(s). ' : '') + 'Não entrou: ' + erros.join('; ') : ok === 1 ? (trocarId ? 'Arquivo trocado. Os trechos foram refeitos.' : 'Documento guardado e cortado em trechos.') : ok + ' documentos guardados.');
  ST.busca = null; await stCarregar();
}
function stFormDoc(d){
  return '<div class="grade-form"><label class="lb largo">Título<input class="campo" id="st-d-t" maxlength="200" value="' + esc(d.titulo) + '"></label>' +
    '<label class="lb">Tipo<select class="sel" id="st-d-tp">' + Object.entries(ST_TIPO).map(([k, n]) => '<option value="' + k + '"' + (d.tipo === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' +
    '<label class="lb">Peso<select class="sel" id="st-d-p">' + Object.entries(ST_PESO).map(([k, n]) => '<option value="' + k + '"' + (d.peso === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' +
    '<label class="lb largo">Descrição<textarea class="campo" id="st-d-ds" rows="3" maxlength="1000" placeholder="Do que o documento trata e quando o assistente deve usá-lo">' + esc(d.descricao || '') + '</textarea></label></div>';
}
async function stSalvarDoc(dlg, d){
  const sb = stBanco(); if (!sb) return false;
  const t = $('#st-d-t', dlg).value.trim(); if (!t){ toast('Escreva o título'); return false; }
  const {data, error} = await sb.from('studio_conhecimento').update({titulo:t, tipo:$('#st-d-tp', dlg).value, peso:$('#st-d-p', dlg).value, descricao:$('#st-d-ds', dlg).value.trim() || null}).eq('id', d.id).select();
  if (error || !(data || []).length){ toast('Não salvou: ' + (error ? error.message : 'sem permissão')); return; }
  toast('Documento salvo'); stCarregar();
}
async function stVer(d){
  const sb = stBanco(); if (!sb) return;
  const dlg = modal(esc(d.titulo), '<p class="vazio-linha">Abrindo…</p>', [{txt:'Fechar', cls:'sec'}]); dlg.classList.add('st-modal-ler');
  const {data, error} = await sb.from('studio_conhecimento').select('id,conteudo').eq('id', d.id);
  const linha = (data || []).find(x => x.id === d.id), corpo = dlg.querySelector('.modal-corpo'); if (!corpo) return;
  corpo.innerHTML = error || !linha ? '<p class="entrada-erro">Não abriu: ' + esc(error ? error.message : 'não encontrado') + '</p>' : '<p class="sec st-dica">' + stMil(d.caracteres) + ' caracteres · ' + stMil(d.trechos) + ' trechos · versão ' + d.versao + '</p><pre class="st-texto">' + esc(linha.conteudo) + '</pre>';
}
function stVersoes(){
  const v = ST.versoes || [];
  const dlg = modal('Versões anteriores das instruções', v.map((x, i) => '<div class="st-versao"><div class="st-linha"><b>' + esc(admHora(x.salvo_em)) + '</b><button class="btn sec peq" type="button" data-st-voltar="' + i + '">Usar esta versão</button></div><pre class="st-texto">' + esc(x.instrucoes) + '</pre></div>').join(''), [{txt:'Fechar', cls:'sec'}]);
  dlg.classList.add('st-modal-ler');
  dlg.addEventListener('click', async e => {
    const b = e.target.closest('[data-st-voltar]'); if (!b) return;
    const x = v[+b.dataset.stVoltar]; if (!x) return;
    if (await stMudarAgente({instrucoes:x.instrucoes})){ dlg.close(); dlg.remove(); toast('Instruções voltaram para a versão de ' + admHora(x.salvo_em) + '. A de agora ficou guardada.'); stCarregar(); }
  });
}

/* ---------- eventos ---------- */
document.addEventListener('click', async e => {
  if (!e.target.closest('#m-agentes')) return;
  const q = s => e.target.closest(s); let x;
  if (q('[data-st-escolher]')){ const i = $('#st-arq'); i.dataset.trocar = ''; i.click(); return; }
  if ((x = q('[data-st-trocar]'))){ const i = $('#st-arq'); i.dataset.trocar = x.dataset.stTrocar; i.removeAttribute('multiple'); i.click(); return; }
  if (q('[data-st-salvar-instr]')){ const t = $('#m-agentes [data-st-instr]').value; if (await stMudarAgente({instrucoes:t})){ toast('Instruções salvas'); stCarregar(); } return; }
  if (q('[data-st-versoes]')) return stVersoes();
  if ((x = q('[data-st-ver]'))){ const d = (ST.docs || []).find(y => y.id === x.dataset.stVer); if (d) stVer(d); return; }
  if ((x = q('[data-st-editar]'))){ const d = (ST.docs || []).find(y => y.id === x.dataset.stEditar); if (d) modal('Editar documento', stFormDoc(d), [{txt:'Cancelar', cls:'sec'},{txt:'Salvar', acao:dlg => { stSalvarDoc(dlg, d); }}]); return; }
  if ((x = q('[data-st-apagar]'))){ const d = (ST.docs || []).find(y => y.id === x.dataset.stApagar); if (!d) return;
    modal('Apagar ' + esc(d.titulo) + '?', '<p style="margin:0">O documento e os ' + stMil(d.trechos) + ' trechos dele saem da base do assistente. Não dá para desfazer; para só tirar das respostas, desligue em vez de apagar.</p>',
      [{txt:'Cancelar', cls:'sec'},{txt:'Apagar', cls:'perigo', acao:async () => { const {error} = await stBanco().from('studio_conhecimento').delete().eq('id', d.id); toast(error ? 'Não apagou: ' + error.message : 'Documento apagado'); stCarregar(); }}]); return; }
  if ((x = q('[data-st-fn-apagar]'))){ const f = (ST.funcoes || []).find(y => y.id === x.dataset.stFnApagar); if (!f) return;
    modal('Apagar a função ' + esc(f.nome) + '?', '<p style="margin:0">O assistente deixa de poder fazer isso.</p>', [{txt:'Cancelar', cls:'sec'},{txt:'Apagar', cls:'perigo', acao:async () => { const {error} = await stBanco().from('studio_funcoes').delete().eq('id', f.id); toast(error ? 'Não apagou: ' + error.message : 'Função apagada'); stCarregar(); }}]); return; }
});
document.addEventListener('change', async e => {
  if (!e.target.closest('#m-agentes')) return;
  const t = e.target, sb = stBanco(); if (!sb) return;
  if (t.id === 'st-arq'){ const trocar = t.dataset.trocar || null; t.setAttribute('multiple', ''); const fs = Array.from(t.files || []); t.value = ''; if (fs.length) stEnviar(trocar ? fs.slice(0, 1) : fs, trocar); return; }
  if (t.dataset.stAg){ const v = t.value.trim(); if (t.dataset.stAg === 'nome' && !v){ toast('O nome não pode ficar vazio'); t.value = ST.ag.nome; return; }
    if (await stMudarAgente({[t.dataset.stAg]: v || (t.dataset.stAg === 'descricao' ? null : v)})) toast('Salvo'); return; }
  if (t.dataset.stLigar){ const {data, error} = await sb.from('studio_conhecimento').update({ativo:t.checked}).eq('id', t.dataset.stLigar).select();
    if (error || !(data || []).length) toast('Não mudou: ' + (error ? error.message : 'sem permissão')); else toast(t.checked ? 'Documento ligado: entra nas respostas' : 'Documento desligado: fica guardado, mas sai das respostas');
    ST.busca = null; stCarregar(); return; }
  if (t.dataset.stFnLigar){ const {data, error} = await sb.from('studio_funcoes').update({ativo:t.checked}).eq('id', t.dataset.stFnLigar).select();
    if (error || !(data || []).length) toast('Não mudou: ' + (error ? error.message : 'sem permissão')); stCarregar(); return; }
});
document.addEventListener('input', e => {
  const t = e.target.closest && e.target.closest('#m-agentes [data-st-instr]'); if (!t) return;
  const i = $('#m-agentes [data-st-instr-info]'); if (i) i.textContent = stMil(t.value.length) + ' caracteres · não salvo';
});
document.addEventListener('submit', async e => {
  const f = e.target; if (!f.closest || !f.closest('#m-agentes')) return;
  const sb = stBanco();
  if (f.matches('[data-st-buscar]')){ e.preventDefault(); if (!sb) return; const q = f.q.value.trim(); if (!q) return;
    ST.buscando = true; ST.busca = {q, r:[]}; rStudio();
    const {data, error} = await sb.rpc('studio_buscar', {p_agente:ST.ag.id, p_pergunta:q, p_limite:8});
    ST.buscando = false; ST.busca = {q, r:data || [], erro:error ? error.message : null}; rStudio(); return; }
  if (f.matches('[data-st-fn-nova]')){ e.preventDefault(); if (!sb) return; const nome = f.nome.value.trim(); if (!nome) return; const acao = f.acao.value;
    const {data, error} = await sb.from('studio_funcoes').insert({agente_id:ST.ag.id, nome, descricao:f.descricao.value.trim(), acao, pede_confirmacao:true, ordem:(ST.funcoes || []).length}).select();
    if (error || !(data || []).length){ toast('Não adicionou: ' + (error ? (/unique|duplicate/i.test(error.message) ? 'já existe uma função com esse nome' : error.message) : 'sem permissão')); return; }
    toast('Função adicionada, desligada. Ligue quando quiser que o assistente use.'); stCarregar(); return; }
});
['dragover','drop'].forEach(ev => document.addEventListener(ev, e => {
  const z = e.target.closest && e.target.closest('#m-agentes [data-st-soltar]'); if (!z) return;
  e.preventDefault();
  if (ev === 'dragover'){ z.classList.add('sobre'); return; }
  z.classList.remove('sobre'); stEnviar(e.dataTransfer && e.dataTransfer.files, null);
}));
document.addEventListener('dragleave', e => { const z = e.target.closest && e.target.closest('#m-agentes [data-st-soltar]'); if (z && !z.contains(e.relatedTarget)) z.classList.remove('sobre'); });
