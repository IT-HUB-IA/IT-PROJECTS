/* =====================================================================
   Antes de ligar um repositório ou um banco: uma janela que diz para ONDE vai ligar, o QUE o robô vai fazer
   e o que JÁ EXISTE ali, e pede a confirmação. Ligar no lugar errado monta desenhos, ficha técnica e épicos no
   ponto errado (foi o que aconteceu com o IT-PROJECTS na MK Cobranças); por isso a pessoa confere antes.
   integrarConfirmar({tipo:'repo'|'banco', nome, noId, provedor, trocar, mover}) -> Promise<null | {desenhos, itens}>
   As duas escolhas (desenhos / épicos e histórias) também mudam depois, no painel Automático, sem desligar a fonte.
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
  const li = t => Array.isArray(t) ? '<li data-ig="' + t[0] + '">' + t[1] + '</li>' : '<li>' + t + '</li>';
  const vai = repo ? [
      'Ler o código de <b>' + esc(o.nome) + '</b> a cada publicação (só leitura: nada é mudado no ' + (o.provedor === 'gitlab' ? 'GitLab' : 'GitHub') + ').',
      ['desenhos', 'Montar os desenhos de <b>Software</b>, <b>Infraestrutura</b> e <b>Telas e rotas</b> na aba Infraestrutura de ' + aqui + '.'],
      'Preencher a <b>Ficha técnica</b> (linguagens, versões, ambientes, integrações).',
      'Rodar a <b>Análise</b>: segurança, qualidade e bibliotecas com falha conhecida, com alertas no sininho.',
      ['itens', '<b>Criar épicos e histórias</b> com o que já existe no código (APIs, telas, funções, versões) nas frentes de ' + aqui + '. Ao abrir a aba Análise eles são montados sozinhos.'],
      o.mover ? 'Mudar a situação dos itens pelos commits e pull requests (branch: Em andamento, PR: Em revisão, PR mesclado: Concluído).' : ''
    ] : [
      'Ler só a <b>estrutura</b> de <b>' + esc(o.nome) + '</b> (tabelas, colunas, chaves, regras de acesso), nunca os dados, em modo somente leitura, de hora em hora.',
      ['desenhos', 'Montar o <b>DER</b> e o mapa de <b>Acesso ao banco</b> na aba Infraestrutura de ' + aqui + '.'],
      'Preencher a seção <b>Database</b> da Ficha técnica.',
      'Rodar a <b>Análise</b> de segurança e de arquitetura do banco.',
      ['itens', '<b>Criar épicos e histórias</b> com as tabelas do banco ("Banco: …" e "Tabela …") nas frentes de ' + aqui + '. Ao abrir a aba Análise eles são montados sozinhos.']
    ];
  const cuidado = [];
  if (s.n) cuidado.push((['aplicação','frente'].includes(tipoNo) ? 'Esta ' : 'Este ') + tipoNo + ' já tem <b>' + s.n + (s.n === 1 ? ' item' : ' itens') + '</b> (' + s.ep + (s.ep === 1 ? ' épico' : ' épicos') + ', ' + s.and + ' em andamento, ' + s.feitos + ' concluídos). Nada disso é apagado nem mudado, mas com <b>Épicos e histórias</b> marcado os novos entram ao lado: se o que já existe foi feito à mão, pode ficar repetido. Para ter só os desenhos, desmarque Épicos e histórias.');
  if (reposAqui.length) cuidado.push('Já ' + (reposAqui.length === 1 ? 'está ligado aqui o repositório ' : 'estão ligados aqui os repositórios ') + '<b>' + reposAqui.map(esc).join(', ') + '</b>. Os desenhos dos dois ficam lado a lado.');
  if (bancosAqui.length) cuidado.push('Já ' + (bancosAqui.length === 1 ? 'está ligado aqui o banco ' : 'estão ligados aqui os bancos ') + '<b>' + bancosAqui.map(esc).join(', ') + '</b>. Os desenhos de cada um ficam separados.');
  if (o.trocar && !repo) cuidado.push('Você está <b>trocando</b> um banco já ligado: os desenhos do banco antigo vão para o arquivo e a ficha dele é refeita com o novo.');
  emOutro.forEach(r => { const ch = igChave(r.no_id); cuidado.push('Este repositório já está ligado em <b>' + esc(ch ? igCaminho(ch).join(' › ') : 'outro lugar') + '</b>. Ele <b>sai de lá</b>: os desenhos e a ficha de lá vão para o arquivo (os itens de lá continuam lá).'); });
  return new Promise(res => {
    let decidido = false;
    const dlg = modal(repo ? 'Ligar o repositório?' : (o.trocar ? 'Trocar o banco?' : 'Ligar o banco?'),
      '<div class="ig">' +
      '<p class="ig-onde">' + (repo ? 'Repositório' : 'Banco') + ' <b>' + esc(o.nome) + '</b><br>vai ser ligado em <b>' + caminho.map(esc).join(' › ') + '</b> <span class="ig-tipo">' + tipoNo + '</span></p>' +
      '<h4>O que o robô vai montar</h4><div class="ig-opcoes">' +
        '<label><input type="checkbox" id="ig-desenhos" checked> <b>Desenhos</b> <span>' + (repo ? 'Software, Infraestrutura, Telas e rotas' : 'DER e Acesso ao banco') + ', com os quadros no canvas</span></label>' +
        '<label><input type="checkbox" id="ig-itens"' + ((o.itensPadrao ?? !s.n) ? ' checked' : '') + '> <b>Épicos e histórias</b> <span>o backlog com ' + (repo ? 'o que já existe no código' : 'as tabelas do banco') + ', nas frentes de ' + aqui + '</span></label>' +
        '<p class="ig-nota">Dá para ter os dois, um só ou nenhum, e mudar depois no painel Automático sem desligar ' + (repo ? 'o repositório' : 'o banco') + '. Ficha técnica e Análise de segurança vêm sempre.</p></div>' +
      '<h4>O que vai acontecer</h4><ul class="ig-lista">' + vai.filter(Boolean).map(li).join('') + '</ul>' +
      (cuidado.length ? '<h4>Antes de confirmar</h4><ul class="ig-lista ig-cuidado">' + cuidado.map(li).join('') + '</ul>' : '') +
      '<p class="ig-volta">Se ligar no lugar errado: troque pelo botão Trocar ou Desligar. Os desenhos e a ficha saem sozinhos daqui; os épicos e histórias criados vão para a Lixeira pela própria lixeira.</p>' +
      '<label class="ig-ok"><input type="checkbox" id="ig-conferi"> Conferi: <b>' + esc(o.nome) + '</b> é d' + (repo ? 'o código' : 'o banco') + ' de <b>' + esc(caminho[caminho.length - 1]) + '</b></label></div>',
      [{txt:'Cancelar', cls:'sec', acao:() => { decidido = true; res(null); }},
       {txt:repo ? 'Sim, ligar' : (o.trocar ? 'Sim, trocar' : 'Sim, ligar'), acao:d => {
         if (!$('#ig-conferi', d).checked){ toast('Marque que conferiu o lugar antes de ligar.'); return false; }
         decidido = true; res({desenhos:$('#ig-desenhos', d).checked, itens:$('#ig-itens', d).checked}); }}]);
    dlg.classList.add('ig-dlg');
    dlg.addEventListener('close', () => { if (!decidido){ decidido = true; res(null); } });
    // o que vai acontecer acompanha as escolhas: o que fica desligado aparece riscado
    const marcar = () => { const de = $('#ig-desenhos', dlg).checked, it = $('#ig-itens', dlg).checked;
      $$('.ig-lista li[data-ig]', dlg).forEach(x => x.classList.toggle('ig-off', (x.dataset.ig === 'desenhos' && !de) || (x.dataset.ig === 'itens' && !it))); };
    dlg.addEventListener('change', e => { if (e.target.id === 'ig-desenhos' || e.target.id === 'ig-itens') marcar(); });
    marcar();
  });
}
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {integrarConfirmar, igSituacao, igChave});
