/* ===== Barra Criar: no topo de todas as abas que mostram itens =====
   As abas (Painel, Quadro, Tabela, Lista, Calendário, Linha do tempo, Carga, Fila, Meu trabalho) são só jeitos de ver
   os mesmos itens: tudo o que se cria aqui vai para a mesma tabela de itens, no ponto da estrutura escolhido.
   Por isso a barra é a mesma em todas, sempre no mesmo lugar: + Item, + Épico, Criar em lote e Instruções para IA. */
const CRIA_VIEWS = new Set(['dashboard', 'board', 'table', 'list', 'calendar', 'timeline', 'workload', 'backlog', 'mywork']);
function criaBarraHTML(){
  return '<div class="cria-barra" role="toolbar" aria-label="Criar"><span class="cria-rot">Criar</span>' +
    '<button type="button" class="btn peq" data-acao="novo-item">' + ICO.mais + 'Item</button>' +
    '<button type="button" class="btn sec peq" data-bj-acao="novo-epic">' + ICO.mais + 'Épico</button>' +
    '<button type="button" class="btn sec peq" data-lt-abrir>' + ICO.mais + 'Em lote</button>' +
    '<span class="espaco"></span>' +
    '<button type="button" class="btn fant peq" data-ia-instrucoes title="Baixa um arquivo com o funcionamento do CicloDev para passar a um agente de IA">Instruções para IA</button></div>';
}
const _rViewCria = rView;
rView = function(){
  const r = _rViewCria.apply(this, arguments);
  const c = $('#ops-corpo');
  if (c && CRIA_VIEWS.has(UI.view) && podeEditar() && !$('.cria-barra', c)) c.insertAdjacentHTML('afterbegin', criaBarraHTML());
  return r;
};
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {criaBarraHTML, CRIA_VIEWS});

/* ---------- instruções para passar a um agente de IA (ChatGPT, Claude, etc.) ----------
   O agente conversa com a pessoa, monta o texto no formato do Criar em lote e a pessoa cola aqui.
   Vão junto as frentes, versões e épicos que existem de verdade no ponto escolhido, para os nomes baterem. */
function ciContexto(){
  const pj = cadeia(UI.sel).project;
  const frentes = (typeof ltFrentes === 'function' ? ltFrentes() : []).map(w => { const a = byId('apps', w.app); return {nome:w.nome, app:a ? a.nome : ''}; });
  const versoes = (typeof marcosDoEscopo === 'function' ? marcosDoEscopo(UI.sel) : []).filter(m => m.tipo === 'release' && !m.entregue).map(m => m.nome);
  const epicos = pj ? issuesEm('project:' + pj.id).filter(i => i.tipo === 'epic' && !i.arquivado).map(i => i.titulo).slice(0, 80) : [];
  return {onde:nomeDe(UI.sel), projeto:pj ? pj.nome : '', frentes, versoes, proxima:typeof ltProximaVersao === 'function' ? ltProximaVersao() : 'v0.1', epicos};
}
function ciLoteMd(ctx){
  const c = ctx || ciContexto(), fr = c.frentes.map(f => f.nome).filter((n, k, a) => a.indexOf(n) === k);
  return '## Formato do Criar em lote do CicloDev\n\n' +
    'O CicloDev cria vários itens de uma vez a partir de um texto simples. Regras (siga exatamente):\n\n' +
    '1. **Linha sem traço** vira um **épico** (uma entrega grande).\n' +
    '2. **Linha que começa com `- `** vira um **item** dentro do épico da linha de cima.\n' +
    '3. **Linha em branco** separa um épico do outro (opcional, só deixa mais fácil de ler).\n' +
    '4. **`[Nome da frente]` no fim da linha** diz em qual frente de trabalho fica. O item herda a frente do épico quando não diz outra.\n' +
    '5. **`{Nome da versão}` no fim da linha** diz em qual versão entra. O item herda a versão do épico. Uma versão que ainda não existe é criada junto.\n' +
    '6. Um épico com o mesmo nome de um que já existe no projeto **não é duplicado**: os itens entram nele.\n' +
    '7. Só título. Não escreva descrição, prazo, prioridade nem responsável no texto: isso se ajusta depois, na tela.\n' +
    '8. Títulos curtos e claros, começando com verbo ou com o nome da coisa (ex.: "Cadastro do cliente", "Validar CPF no cadastro").\n\n' +
    '### Exemplo\n\n```\n' + LT_EXEMPLO + '\n```\n\n' +
    '### Nomes que existem agora' + (c.onde ? ' (em ' + c.onde + ')' : '') + '\n\n' +
    '**Frentes de trabalho** (use exatamente um destes nomes dentro de `[ ]`):\n' + (fr.length ? fr.map(n => '- ' + n).join('\n') : '- (nenhuma frente ainda: crie uma na Estrutura antes)') + '\n\n' +
    '**Versões abertas** (use dentro de `{ }`; a próxima sugerida é `' + c.proxima + '`):\n' + (c.versoes.length ? c.versoes.map(n => '- ' + n).join('\n') : '- (nenhuma: pode usar {' + c.proxima + '} e ela é criada)') + '\n\n' +
    '**Épicos que já existem no projeto** (repetir o nome põe os itens dentro dele):\n' + (c.epicos.length ? c.epicos.map(n => '- ' + n).join('\n') : '- (nenhum ainda)') + '\n\n' +
    '### Roteiro para o agente\n\n' +
    'Você vai ajudar a pessoa a organizar o trabalho de "' + (c.projeto || c.onde || 'este projeto') + '" no CicloDev.\n\n' +
    '1. Converse com a pessoa para entender o que precisa ser feito. Faça perguntas curtas, uma de cada vez, até entender as entregas (épicos) e as tarefas de cada uma (itens).\n' +
    '2. Agrupe as tarefas em épicos que façam sentido para quem vai entregar. Reaproveite os épicos que já existem quando o assunto for o mesmo.\n' +
    '3. Use só as frentes da lista acima. Se nenhuma servir, avise a pessoa em vez de inventar.\n' +
    '4. Mostre um resumo e peça confirmação antes de gerar o texto final.\n' +
    '5. No fim, entregue **só o texto no formato acima, dentro de um bloco de código**, sem comentários no meio, pronto para colar em **Criar em lote**.\n';
}
function ciGeralMd(){
  const c = ciContexto(), l = (arr, f) => arr.map(f).join('\n');
  return '# CicloDev: instruções para um agente de IA\n\n' +
    'Gerado em ' + new Date().toLocaleString('pt-BR') + (c.onde ? ', a partir de **' + c.onde + '**' : '') + '. Passe este arquivo inteiro para o agente antes de começar a conversa.\n\n' +
    '## O que é o CicloDev\n\nO CicloDev é o sistema de gestão de projetos de software da IT.IA. Nele ficam o trabalho a fazer (itens), as entregas (versões), a ficha técnica, os desenhos de infraestrutura e a conversa com o assistente DevIT.\n\n' +
    '## Como o trabalho é organizado\n\n' +
    'A estrutura tem níveis, do maior para o menor: **Cliente › Projeto › Produto › Aplicação › Frente de trabalho**. Todo item mora numa frente de trabalho (por exemplo Frontend, Backend, Database), e aparece em todos os níveis de cima.\n\n' +
    '**Tipos de item:**\n' + l(TIPOS, t => '- **' + t.nome + '**: ' + t.expl) + '\n\nUm épico agrupa histórias e tarefas; uma sub-tarefa fica dentro de outro item.\n\n' +
    '**Situações (status):**\n' + l(STATUS, s => '- **' + s.nome + '**: ' + s.expl) + '\n\nNo Criar em lote, o item novo começa em ' + stNome('backlog') + ' (na Fila) e o épico começa em ' + stNome('todo') + '.\n\n' +
    '**Prioridades:**\n' + l(PRIOS, p => '- **' + p.nome + '**: ' + p.expl) + '\n\n' +
    '**Campos de um item:** título, tipo, situação, prioridade, responsável, frente de trabalho, épico (pai), início e prazo, estimativa, checklist, comentários, anexos, versão em que entra e ligações com outros itens.\n\n' +
    '## As abas\n\nAs abas são jeitos diferentes de ver os **mesmos itens**. Criar em qualquer uma delas grava no mesmo lugar.\n\n' +
    '- **Painel**: o resumo do ponto escolhido (andamento, atrasos, avisos).\n- **Calendário**: os itens nos dias do prazo.\n- **Quadro**: os itens em colunas pela situação; arrastar muda a situação.\n- **Tabela**: os itens como numa planilha.\n- **Linha do tempo**: cada item vira uma barra do início ao prazo.\n- **Fila**: o que ainda não entrou no quadro, com os épicos ao lado.\n- **Infraestrutura**: desenhos da arquitetura, montados sozinhos do código e do banco.\n- **Ficha técnica**: as informações técnicas do sistema.\n\n' +
    '## Versões (Entregas)\n\nUma versão (ex.: v1.2) junta os itens que vão para o ar juntos. Quando é publicada em produção, fica marcada como entregue.\n\n' +
    '## Como o agente pode ajudar\n\nO jeito mais seguro de o agente criar trabalho no CicloDev é **gerar o texto do Criar em lote**. A pessoa cola o texto em **Criar › Em lote**, confere a prévia e clica em Criar tudo. Nada é criado sem a prévia.\n\n' +
    ciLoteMd(c);
}
document.addEventListener('click', e => {
  if (e.target.closest && e.target.closest('[data-ia-instrucoes]')){ e.preventDefault(); exBaixar('CicloDev - instrucoes para IA - ' + (nomeDe(UI.sel) || 'geral'), ciGeralMd()); }
});
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {ciGeralMd, ciLoteMd, ciContexto});
