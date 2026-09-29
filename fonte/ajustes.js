/* ===== Configurações de cada trabalho =====
   Status personalizados, campos dos itens e automações são de um trabalho, não do sistema todo.
   Por isso ficam numa aba Configurações dentro do projeto, do produto e da aplicação (no botão Mais das abas),
   e o menu principal Configurações fica só com o que é geral: etapas padrão, requisitos, acessos e a conta.
   O conteúdo é montado por rcTrabalhoHTML (recursos.js), filtrado pelo ponto escolhido na Estrutura. */
VIEWS.push(['ajustes', 'Configurações', 'status, campos e automações deste trabalho']);
SM_ABAS.ajustes = ['Configurações', 'Os status, os campos dos itens e as automações deste trabalho. O que for criado aqui vale para ele e para tudo o que está dentro dele.'];
SM_DICA.ajustes = 'status, campos e automações';
EXPL_VIEW.ajustes = SM_ABAS.ajustes[1];

const AJ_ONDE = {project:'este projeto', product:'este produto', app:'esta aplicação'};
const _rViewAj = rView;
rView = function(){
  const c = $('#ops-corpo');
  if (c && UI.view === 'ajustes'){
    const tipo = (UI.sel || '').split(':')[0];
    c.innerHTML = '<div class="aj-tela"><p class="lead aj-intro">Configurações de <b>' + esc(nomeDe(UI.sel)) + '</b>. O que você cria aqui vale para ' + (AJ_ONDE[tipo] || 'este trabalho') + ' e para tudo o que está dentro. O que foi criado num nível acima aparece marcado com "vem de cima".</p>' + rcTrabalhoHTML(UI.sel) + '</div>';
    smAgruparAbas(); return;
  }
  _rViewAj();
};
const _rOperacoesAj = rOperacoes;
rOperacoes = function(){
  _rOperacoesAj();
  const tipo = (UI.sel || '').split(':')[0];
  if (!AJ_ONDE[tipo] || !podeEditar()){ const b = $('.view-b[data-view="ajustes"]'); if (b) (b.closest('.view-casa') || b).remove(); if (UI.view === 'ajustes'){ UI.view = 'dashboard'; rView(); } }
};
// no menu principal, um aviso de onde ficam agora
const _rConfigAj = rConfig;
rConfig = function(){
  _rConfigAj();
  const lead = $('#m-configuracoes .topo-tela .lead');
  if (lead && !$('#m-configuracoes .aj-aviso')) lead.insertAdjacentHTML('afterend', '<p class="aj-aviso">Status, campos dos itens e automações ficam dentro de cada trabalho: abra o projeto, o produto ou a aplicação em Operações e clique em <b>Mais → Configurações</b>.</p>');
};
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {rOperacoes, rcTrabalhoHTML});
