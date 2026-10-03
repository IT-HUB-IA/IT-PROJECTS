/* =====================================================================
   Ao vivo nos módulos que têm dados próprios (fora da leitura geral da tela).
   Cada um relê o seu quando o banco avisa, só se a tela dele estiver aberta, e nunca debaixo de quem está digitando.
   As conferências periódicas antigas de cada módulo continuam, mas só como reserva: rodam quando o canal ao vivo
   está fora do ar (avLigado() falso). Com o canal ligado, não há mais conferência de tempos em tempos.
   '*' no lote = voltou de muito tempo fora: relê tudo.
   ===================================================================== */
const avNoLote = (lote, ...ts) => lote.has('*') || ts.some(t => lote.has(t));
if (typeof avOuvir === 'function'){
  // Infraestrutura: lista de desenhos, painel Automático (código, bancos, pedidos ao robô) e os quadros do canvas
  avOuvir(['infra_diagramas', 'infra_diagramas_versoes', 'infra_canvas', 'infra_automacoes', 'infra_geracoes', 'repositorios', 'infra_bancos', 'publicacoes', 'git_conexoes', 'supa_conexoes'], () => {
    if (UI.view !== 'infra' || !IFR.no) return;
    avQuandoLivre('infra', async () => {
      const no = IFR.no; if (UI.view !== 'infra' || !no || IFR_AUTO.atualizando) return;   // "Atualizar agora" em andamento já relê no fim
      await Promise.all([ifrAutoCarregar(), ifrCarregar()]);
      if (IFR.no !== no || UI.view !== 'infra') return;
      await ifrAtualizarRemoto(); ifrLado(); if (typeof ifrAvisarCanvas === 'function') ifrAvisarCanvas();
    });
  });
  // Ficha técnica preenchida pelo robô
  avOuvir(['ficha_auto', 'repositorios', 'infra_bancos'], () => { if (UI.view === 'sheet') avQuandoLivre('ficha', faConferir); });
  // Análise de segurança
  avOuvir(['analise_rodadas', 'analise_achados', 'analise_inventario'], () => {
    if (UI.view !== 'seguranca') return;
    avQuandoLivre('seguranca', async () => {
      const antes = JSON.stringify((SG.rodadas || []).map(r => r.rodou_em));
      await sgCarregar(); if (UI.view !== 'seguranca') return; rView();
      if (antes !== '[]' && JSON.stringify((SG.rodadas || []).map(r => r.rodou_em)) !== antes) toast('Análise de segurança atualizada.');
    });
  });
  // Servidores
  avOuvir(['servidores', 'servidores_alcance', 'servidores_servicos', 'servidores_custos', 'servidores_lancamentos'], () => {
    if (!SRV.lido) return;
    avQuandoLivre('servidores', async () => { await svCarregar(true); if (UI.view === 'servidores' || UI.view === 'custos') rView(); });
  });
  // Inventário (do cliente aberto)
  avOuvir(['inv_ativos', 'inv_baixas', 'inv_anexos', 'inv_categorias', 'inv_conferencias', 'inv_conferencias_itens', 'inv_funcionarios', 'inv_funcionarios_apps',
    'inv_itens', 'inv_licencas', 'inv_licencas_uso', 'inv_ligacoes', 'inv_locais', 'inv_manutencoes', 'inv_modelos', 'inv_movimentos', 'inv_saldos', 'inv_termos'], () => {
    if (UI.view !== 'inventario') return;
    avQuandoLivre('inventario', async () => { await invCarregar(true); if (UI.view === 'inventario') rView(); });
  });
  // Agent Studio (só o dono do sistema vê)
  avOuvir(['studio_agentes', 'studio_conhecimento', 'studio_funcoes', 'studio_instrucoes_versoes'], () => {
    if (!ST.lido || !document.getElementById('m-agentes') || !document.getElementById('m-agentes').offsetParent) return;
    avQuandoLivre('studio', async () => { await stCarregar(); rStudio(); });
  });
  // conversa com a IA: resposta nova chega na hora
  avOuvir(['ia_mensagens'], () => { iaNovidades(); });
  // notificações: o aviso do navegador e o sino na hora
  avOuvir(['notificacoes'], () => { cmBuscarNovos().catch(() => {}); });
  // portal do cliente: resposta do stakeholder chega na hora (o item em si vem pela leitura geral)
  avOuvir(['perguntas_stakeholder', 'portais', 'portais_membros'], lote => { if (avNoLote(lote, 'portais', 'portais_membros')) ptCarregarClientes(); else ptResumo(); });
}
