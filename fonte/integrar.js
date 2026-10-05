/* =====================================================================
   Antes de ligar um repositório ou um banco: uma janela que diz para ONDE vai ligar, o QUE o robô vai fazer
   e o que JÁ EXISTE ali, e pede a confirmação. Ligar no lugar errado monta desenhos, ficha técnica e épicos no
   ponto errado (foi o que aconteceu com o IT-PROJECTS na MK Cobranças); por isso a pessoa confere antes.
   integrarConfirmar({tipo:'repo'|'banco', nome, noId, provedor, trocar, mover}) -> Promise<null | {desenhos, ficha, analise, itens, mover?, mapa?}>
   Cada coisa que o robô faz é uma escolha (parte 70): repositório tem Desenhos, Ficha técnica, Análise, Épicos e histórias,
   Mudar a situação dos itens e Mapa do Sistema; banco tem as quatro primeiras. Todas mudam depois em Ligações.
   ===================================================================== */
function igChave(noId){
  for (const [col, pre] of [['apps','app'], ['products','product'], ['projects','project'], ['clients','client'], ['ws','ws']])
    if (byId(col, noId)) return pre + ':' + noId;
  return null;
}
function igCaminho(chave){
  const c = cadeia(chave), partes = [c.client, c.project, c.product, c.app].filter(Boolean).map(x => x.nome);
  return partes.length ? partes : [nomeDe(chave)];
}
const IG_TIPO = {app:'aplicação', product:'produto', project:'projeto', client:'cliente', ws:'frente'};
function igSituacao(chave){
  const its = issuesEm(chave), ep = its.filter(i => i.tipo === 'epic').length;
  const and = its.filter(i => ['doing','review','blocked'].includes(i.status)).length, feitos = its.filter(i => i.status === 'done').length;
  return {n:its.length, ep, and, feitos, outros:its.length - ep};
}
function integrarConfirmar(o){
  const chave = igChave(o.noId) || UI.sel, tipoNo = IG_TIPO[chave.split(':')[0]] || 'ponto';
  const caminho = igCaminho(chave), s = igSituacao(chave), aqui = esc(caminho[caminho.length - 1]);
  const repo = o.tipo === 'repo';
  // o que já está ligado neste ponto, e se este repositório já está ligado em outro lugar (vai sair de lá)
  const reposAqui = (typeof EN !== 'undefined' && EN.repos ? EN.repos : []).filter(r => r.no_id === o.noId && r.nome.toLowerCase() !== String(o.nome).toLowerCase()).map(r => r.nome);
  const emOutro = repo ? (typeof EN !== 'undefined' && EN.repos ? EN.repos : []).filter(r => r.nome.toLowerCase() === String(o.nome).toLowerCase() && r.no_id !== o.noId) : [];
  const bancosAqui = !repo && typeof IFR_AUTO !== 'undefined' && IFR_AUTO.no === o.noId ? IFR_AUTO.bancos.filter(b => !o.trocar || b.id !== o.trocar).map(b => b.nome + (b.supa_projeto ? ' (' + b.supa_projeto + ')' : b.servidor ? ' (' + b.servidor + ')' : '')) : [];
  // cada coisa que o robô faz é uma escolha própria (parte 70): só acontece o que ficar marcado
  const prov = o.provedor === 'gitlab' ? 'GitLab' : 'GitHub';
  const opcoes = repo ? [
      ['desenhos', true, 'Desenhos', 'Montar os desenhos de <b>Software</b>, <b>Infraestrutura</b> e <b>Telas e rotas</b>, com os quadros no canvas, na aba Infraestrutura de ' + aqui + '.'],
      ['ficha', true, 'Ficha técnica', 'Preencher a <b>Ficha técnica</b> (linguagens, versões, ambientes, integrações).'],
      ['analise', true, 'Análise', 'Rodar a <b>Análise</b>: segurança, qualidade e bibliotecas com falha conhecida, com alertas no sininho.'],
      ['itens', o.itensPadrao ?? !s.n, 'Épicos e histórias', 'Criar o backlog com o que já existe no código (APIs, telas, funções, versões) nas frentes de ' + aqui + '.'],
      ['mover', o.mover !== false, 'Mudar a situação dos itens', 'Pelos commits e pull requests: branch vira Em andamento, PR aberto vira Em revisão, PR mesclado vira Concluído.'],
      ['mapa', true, 'Mapa do Sistema', 'A cada publicação, montar o <b>Como está</b> (telas, botões, campos e para onde vão), com alertas.']
    ] : [
      ['desenhos', true, 'Desenhos', 'Montar o <b>DER</b> e o mapa de <b>Acesso ao banco</b> na aba Infraestrutura de ' + aqui + '.'],
      ['ficha', true, 'Ficha técnica', 'Preencher a seção <b>Database</b> da Ficha técnica.'],
      ['analise', true, 'Análise', 'Rodar a <b>Análise</b> de segurança e de arquitetura do banco.'],
      ['itens', o.itensPadrao ?? !s.n, 'Épicos e histórias', 'Criar o backlog com as tabelas do banco ("Banco: …" e "Tabela …") nas frentes de ' + aqui + '.']
    ];
  const base = repo ? 'O robô lê o código de <b>' + esc(o.nome) + '</b> a cada publicação, só para leitura: nada é mudado no ' + prov + '.'
    : 'O robô lê só a <b>estrutura</b> de <b>' + esc(o.nome) + '</b> (tabelas, colunas, chaves, regras de acesso), nunca os dados, em modo somente leitura, de hora em hora.';
  const cuidado = [];
  if (s.n) cuidado.push((['aplicação','frente'].includes(tipoNo) ? 'Esta ' : 'Este ') + tipoNo + ' já tem <b>' + s.n + (s.n === 1 ? ' item' : ' itens') + '</b> (' + s.ep + (s.ep === 1 ? ' épico' : ' épicos') + ', ' + s.and + ' em andamento, ' + s.feitos + ' concluídos). Nada disso é apagado nem mudado, mas com <b>Épicos e histórias</b> marcado os novos entram ao lado: se o que já existe foi feito à mão, pode ficar repetido. Para não repetir, desmarque Épicos e histórias.');
  if (reposAqui.length) cuidado.push('Já ' + (reposAqui.length === 1 ? 'está ligado aqui o repositório ' : 'estão ligados aqui os repositórios ') + '<b>' + reposAqui.map(esc).join(', ') + '</b>. Os desenhos dos dois ficam lado a lado.');
  if (bancosAqui.length) cuidado.push('Já ' + (bancosAqui.length === 1 ? 'está ligado aqui o banco ' : 'estão ligados aqui os bancos ') + '<b>' + bancosAqui.map(esc).join(', ') + '</b>. Os desenhos de cada um ficam separados.');
  if (o.trocar && !repo) cuidado.push('Você está <b>trocando</b> um banco já ligado: os desenhos do banco antigo vão para o arquivo e a ficha dele é refeita com o novo.');
  emOutro.forEach(r => { const ch = igChave(r.no_id); cuidado.push('Este repositório já está ligado em <b>' + esc(ch ? igCaminho(ch).join(' › ') : 'outro lugar') + '</b>. Ele <b>sai de lá</b>: os desenhos e a ficha de lá vão para o arquivo (os itens de lá continuam lá).'); });
  return new Promise(res => {
    let decidido = false;
    const dlg = modal(repo ? 'Ligar o repositório?' : (o.trocar ? 'Trocar o banco?' : 'Ligar o banco?'),
      '<div class="ig">' +
      '<p class="ig-onde">' + (repo ? 'Repositório' : 'Banco') + ' <b>' + esc(o.nome) + '</b><br>vai ser ligado em <b>' + caminho.map(esc).join(' › ') + '</b> <span class="ig-tipo">' + tipoNo + '</span></p>' +
      '<h4>O que o robô vai fazer</h4><p class="ig-base">' + base + '</p>' +
      '<div class="ig-opcoes"><label class="ig-tudo"><input type="checkbox" id="ig-tudo"> <b>Tudo</b> <span>marca ou desmarca todas as opções abaixo</span></label>' +
        opcoes.map(([k, liga, rot, txt]) => '<label class="ig-op" data-ig="' + k + '"><input type="checkbox" id="ig-' + k + '"' + (liga ? ' checked' : '') + '> <b>' + rot + '</b><span>' + txt + '</span></label>').join('') +
        '<p class="ig-nota">Só acontece o que estiver marcado. Dá para mudar cada uma depois, em Ligações, sem desligar ' + (repo ? 'o repositório' : 'o banco') + '.</p></div>' +
      (cuidado.length ? '<h4>Antes de confirmar</h4><ul class="ig-lista ig-cuidado">' + cuidado.map(t => '<li>' + t + '</li>').join('') + '</ul>' : '') +
      '<p class="ig-volta">Se ligar no lugar errado: troque pelo botão Trocar ou Desligar. Os desenhos e a ficha saem sozinhos daqui; os épicos e histórias criados vão para a Lixeira pela própria lixeira.</p>' +
      '<label class="ig-ok"><input type="checkbox" id="ig-conferi"> Conferi: <b>' + esc(o.nome) + '</b> é d' + (repo ? 'o código' : 'o banco') + ' de <b>' + esc(caminho[caminho.length - 1]) + '</b></label></div>',
      [{txt:'Cancelar', cls:'sec', acao:() => { decidido = true; res(null); }},
       {txt:repo ? 'Sim, ligar' : (o.trocar ? 'Sim, trocar' : 'Sim, ligar'), acao:d => {
         if (!$('#ig-conferi', d).checked){ toast('Marque que conferiu o lugar antes de ligar.'); return false; }
         decidido = true; res(Object.fromEntries(opcoes.map(([k]) => [k, $('#ig-' + k, d).checked]))); }}]);
    dlg.classList.add('ig-dlg');
    dlg.addEventListener('close', () => { if (!decidido){ decidido = true; res(null); } });
    // a caixa Tudo acompanha as outras (marcada, desmarcada ou "algumas"); o que fica desmarcado aparece apagado
    const marcar = () => { const cx = opcoes.map(([k]) => $('#ig-' + k, dlg)), n = cx.filter(x => x.checked).length, t = $('#ig-tudo', dlg);
      t.checked = n === cx.length; t.indeterminate = n > 0 && n < cx.length;
      cx.forEach(x => x.closest('.ig-op').classList.toggle('ig-off', !x.checked)); };
    dlg.addEventListener('change', e => {
      if (e.target.id === 'ig-tudo') opcoes.forEach(([k]) => { $('#ig-' + k, dlg).checked = e.target.checked; });
      if (e.target.id && e.target.id.startsWith('ig-') && e.target.id !== 'ig-conferi') marcar(); });
    marcar();
  });
}
// guarda as escolhas da janela na fonte recém-ligada (parte 70). Só chama o banco se algo ficou desmarcado ou se a fonte
// já tinha algo desligado; o que não veio na escolha (null) fica como está.
const IG_COLUNA = {desenhos:'gera_desenhos', itens:'gera_itens', ficha:'gera_ficha', analise:'gera_analise', mapa:'gera_mapa', mover:'mover_status'};
async function igGravarEscolhas(tipo, id, esc0, atual){
  if (!id || !esc0) return {data:null, error:null};
  const algoDesligado = Object.values(esc0).some(v => v === false) || Object.values(IG_COLUNA).some(c => atual && atual[c] === false);
  if (!algoDesligado) return {data:null, error:null};
  const v = k => typeof esc0[k] === 'boolean' ? esc0[k] : null;
  const {data, error} = await window.ciclodevBanco.rpc('fonte_opcoes', {p_tipo:tipo, p_id:id, p_desenhos:v('desenhos'), p_itens:v('itens'), p_lixeira:false,
    p_ficha:v('ficha'), p_analise:v('analise'), p_mapa:tipo === 'repo' ? v('mapa') : null, p_mover:tipo === 'repo' ? v('mover') : null});
  if (data && atual) Object.entries(IG_COLUNA).forEach(([k, c]) => { if (typeof data[k] === 'boolean') atual[c] = data[k]; });
  return {data, error};
}
// o que ficou ligado, numa frase, para o aviso depois de ligar
function igResumo(esc0){
  const nomes = {desenhos:'Desenhos', ficha:'Ficha técnica', analise:'Análise', itens:'Épicos e histórias', mover:'Mudar a situação dos itens', mapa:'Mapa do Sistema'};
  const sim = Object.keys(nomes).filter(k => esc0[k] === true).map(k => nomes[k]);
  return sim.length ? 'Ligado: ' + sim.join(', ') + '.' : 'Nada marcado: a fonte fica ligada, mas o robô não faz nada com ela até você marcar algo em Ligações.';
}
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {integrarConfirmar, igSituacao, igChave, igGravarEscolhas, igResumo});
