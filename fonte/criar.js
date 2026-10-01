/* ===== Barra Criar: no topo de todas as abas que mostram itens =====
   As abas (Painel, Quadro, Tabela, Lista, Calendário, Linha do tempo, Carga, Fila, Meu trabalho) são só jeitos de ver
   os mesmos itens: tudo o que se cria aqui vai para a mesma tabela de itens, no ponto da estrutura escolhido.
   Por isso a barra é a mesma em todas, sempre no mesmo lugar: na linha das abas, logo depois delas,
   com + Item, + Épico, Em lote e Instruções para IA. */
const CRIA_VIEWS = new Set(['dashboard', 'board', 'table', 'list', 'calendar', 'timeline', 'workload', 'backlog', 'mywork']);
function criaBarraHTML(){
  return '<div class="cria-barra" role="toolbar" aria-label="Criar">' +
    '<button type="button" class="btn peq" data-acao="novo-item">' + ICO.mais + 'Item</button>' +
    '<button type="button" class="btn sec peq" data-bj-acao="novo-epic">' + ICO.mais + 'Épico</button>' +
    '<button type="button" class="btn sec peq" data-lt-abrir>' + ICO.mais + 'Em lote</button>' +
    '<span class="espaco"></span>' +
    '<button type="button" class="btn fant peq" data-ia-instrucoes title="Instruções para IA: baixa um arquivo com o funcionamento do CicloDev para passar a um agente de IA" aria-label="Instruções para IA">IA</button></div>';
}
function criaPosicionar(){
  // a barra fica na linha das abas, logo depois delas (e do Mais), empurrada para a direita
  const c = $('#ops-corpo'), acoes = $('#m-operacoes .ops-cab .views'), quer = CRIA_VIEWS.has(UI.view) && podeEditar();
  $$('#m-operacoes .cria-barra').forEach(b => { if (!quer || (acoes && !acoes.contains(b))) b.remove(); });
  if (quer && acoes && !$('.cria-barra', acoes)) acoes.insertAdjacentHTML('beforeend', criaBarraHTML());
  else if (quer && !acoes && c && !$('.cria-barra', c)) c.insertAdjacentHTML('afterbegin', criaBarraHTML());   // sem cabeçalho de ações (tela Tudo)
}
const _rViewCria = rView;
rView = function(){ const r = _rViewCria.apply(this, arguments); criaPosicionar(); return r; };
const _rOperacoesCria = rOperacoes;
rOperacoes = function(){ const r = _rOperacoesCria.apply(this, arguments); criaPosicionar(); return r; };
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {criaBarraHTML, CRIA_VIEWS, criaPosicionar});

/* ---------- instruções para passar a um agente de IA (ChatGPT, Claude, etc.) ----------
   O agente conversa com a pessoa, monta o texto no formato do Criar em lote e a pessoa cola aqui.
   Vão junto as frentes, versões e épicos que existem de verdade no ponto escolhido, para os nomes baterem. */
function ciContexto(){
  const pj = cadeia(UI.sel).project;
  const frentes = (typeof ltFrentes === 'function' ? ltFrentes() : []).map(w => { const a = byId('apps', w.app); return {nome:w.nome, app:a ? a.nome : ''}; });
  const versoes = (typeof marcosDoEscopo === 'function' ? marcosDoEscopo(UI.sel) : []).filter(m => m.tipo === 'release' && !m.entregue).map(m => m.nome);
  const epicos = pj ? issuesEm('project:' + pj.id).filter(i => i.tipo === 'epic' && !i.arquivado).map(i => i.titulo).slice(0, 80) : [];
  const itens = pj ? issuesEm('project:' + pj.id).filter(i => i.tipo !== 'epic' && i.tipo !== 'subtask' && !i.arquivado).slice(0, 120).map(i => { const ch = typeof chaveDe === 'function' ? chaveDe(i) : ''; const ep = i.pai && byId('issues', i.pai); return (ch ? ch + ': ' : '') + i.titulo + (ep ? ' (épico ' + ep.titulo + ')' : ''); }) : [];
  return {onde:nomeDe(UI.sel), projeto:pj ? pj.nome : '', frentes, versoes, proxima:typeof ltProximaVersao === 'function' ? ltProximaVersao() : 'v0.1', epicos, itens};
}
function ciLoteMd(ctx){
  const c = ctx || ciContexto(), fr = c.frentes.map(f => f.nome).filter((n, k, a) => a.indexOf(n) === k);
  const ex = typeof LT_EXEMPLO_COMPLETO === 'string' ? LT_EXEMPLO_COMPLETO : LT_EXEMPLO;
  return '## Formato do Criar em lote do CicloDev\n\n' +
    'O CicloDev cria vários itens de uma vez a partir de um texto simples. O CicloDev segue o método de Product Owner: cada item pode ter história, critérios de aceite, prioridade, valor, estimativa e tipo. Siga as regras exatamente: o texto é lido linha por linha.\n\n' +
    '### Linhas de estrutura\n\n' +
    '1. **Linha sem traço** vira um **épico** (uma entrega grande).\n' +
    '2. **Linha que começa com `- `** vira um **item** dentro do épico da linha de cima.\n' +
    '3. **Linha em branco** separa um épico do outro (opcional, só deixa mais fácil de ler).\n' +
    '4. **`[Nome da frente]` no fim da linha** diz em qual frente de trabalho fica. O item herda a frente do épico quando não diz outra.\n' +
    '5. **`{Nome da versão}` no fim da linha** diz em qual versão entra. O item herda a versão do épico. Uma versão que ainda não existe é criada junto.\n\n' +
    '### Linhas de detalhe (opcionais)\n\n' +
    'Logo abaixo da linha do item, uma linha por campo, no formato `campo: valor`. Recue com dois espaços para ficar fácil de ler (o recuo é opcional). Os detalhes valem para o item da linha `- ` mais próxima acima.\n\n' +
    '| Campo | O que é | Valores aceitos | Exemplo |\n|---|---|---|---|\n' +
    '| `como` | História: quem usa | texto curto (até 300 letras) | `como: lojista` |\n' +
    '| `quero` | História: o que a pessoa quer | texto curto (até 500 letras) | `quero: ver o saldo de anúncios` |\n' +
    '| `para` | História: por que isso importa | texto curto (até 500 letras) | `para: saber quantos ainda posso publicar` |\n' +
    '| `historia` | A história inteira numa linha (no lugar de como, quero e para) | `Como [quem], quero [o quê], para [por quê]` | `historia: Como lojista, quero ver o saldo, para decidir` |\n' +
    '| `aceite` | Um critério de aceite. Repita a linha para cada critério, na ordem | texto (até 500 letras) | `aceite: Mostra o saldo atualizado` |\n' +
    '| `prioridade` | Classe MoSCoW e, depois, o nível | `Deve`, `Deveria`, `Poderia` ou `Não terá agora`, seguido do nível de 1 a 5 | `prioridade: Deve 2` |\n' +
    '| `nivel` | Só o nível, se não vier junto da prioridade | 1 a 5 | `nivel: 3` |\n' +
    '| `valor` | Valor de negócio, e por que importa | número de 1 a 10, e depois o motivo | `valor: 8 reduz as ligações ao suporte` |\n' +
    '| `pontos` | Estimativa | 1, 2, 3, 5, 8, 13 ou 20 | `pontos: 5` |\n' +
    '| `tipo` | Tipo do item | `Item`, `Bug` ou `Melhoria` | `tipo: Bug` |\n' +
    '| `origem` | O item de origem (obrigatório no Bug) | a chave do item, como BL-12 | `origem: BL-12` |\n' +
    '| `meta` | **Do épico**: a meta da entrega. Logo abaixo da linha do épico, sem traço | texto (até 1000 letras) | `meta: o lojista publica sem ligar para o suporte` |\n\n' +
    '**O nível de prioridade:** 1 só para emergência; 2 é o mais urgente do dia a dia; 3 é o ritmo normal; 4 pode esperar; 5 é ideia ainda sem detalhe.\n\n' +
    '**Os tipos:** Item é algo novo que a pessoa vai ver ou usar. Bug é um critério de aceite que não foi cumprido: sempre com `origem:` apontando o item. Melhoria é mudança pedida depois que um item ficou pronto: é sempre um item novo (pode ter `origem:` com o item antigo), nunca uma mudança no item antigo.\n\n' +
    '### Regras de leitura\n\n' +
    '1. Um campo por linha. Não junte dois campos na mesma linha.\n' +
    '2. Os critérios de aceite vão com `aceite:`, um por linha. **Não** use `- ` para critério: linha com `- ` vira item.\n' +
    '3. Valor fora do aceito (prioridade que não existe, nível fora de 1 a 5, estimativa fora da sequência, valor fora de 1 a 10, campo que não existe, Bug sem origem) aparece como erro na prévia, com o número da linha, e **aquele item não é criado**. Os outros itens entram normalmente.\n' +
    '4. Um épico com o mesmo nome de um que já existe no projeto **não é duplicado**: os itens entram nele.\n' +
    '5. Um item com o mesmo título dentro de um épico que já existe **não é duplicado**: ele recebe os campos que vieram no texto, e nada do que ele já tem é apagado (os critérios novos se somam aos que já existem).\n' +
    '6. Item que já foi aceito não muda a história nem os critérios: para mudar, crie um item novo com `tipo: Melhoria`.\n' +
    '7. Títulos curtos e claros (até 300 letras), começando com verbo ou com o nome da coisa (ex.: "Cadastro do cliente", "Validar CPF no cadastro").\n' +
    '8. Prazo e responsável não vão no texto: ajustam-se depois, na tela.\n' +
    '9. O formato antigo, só com títulos, continua valendo: os detalhes são opcionais.\n\n' +
    '### Exemplo só com títulos\n\n```\n' + LT_EXEMPLO + '\n```\n\n' +
    '### Exemplo completo\n\n```\n' + ex + '\n```\n\n' +
    '### Exemplo com Bug e Melhoria\n\n```\nCarteira de clientes\n- CPF repetido entra no cadastro\n  tipo: Bug\n  origem: BL-12\n  aceite: Avisa quando o CPF já está cadastrado\n  prioridade: Deve 2\n  pontos: 2\n- Exportar a carteira em planilha\n  tipo: Melhoria\n  origem: BL-12\n  como: lojista\n  quero: baixar a carteira em planilha\n  para: mandar para o meu contador\n  prioridade: Poderia 4\n  valor: 3\n  pontos: 3\n```\n\n' +
    '### Nomes que existem agora' + (c.onde ? ' (em ' + c.onde + ')' : '') + '\n\n' +
    '**Frentes de trabalho** (use exatamente um destes nomes dentro de `[ ]`):\n' + (fr.length ? fr.map(n => '- ' + n).join('\n') : '- (nenhuma frente ainda: crie uma na Estrutura antes)') + '\n\n' +
    '**Versões abertas** (use dentro de `{ }`; a próxima sugerida é `' + c.proxima + '`):\n' + (c.versoes.length ? c.versoes.map(n => '- ' + n).join('\n') : '- (nenhuma: pode usar {' + c.proxima + '} e ela é criada)') + '\n\n' +
    '**Épicos que já existem no projeto** (repetir o nome põe os itens dentro dele):\n' + (c.epicos.length ? c.epicos.map(n => '- ' + n).join('\n') : '- (nenhum ainda)') + '\n\n' +
    (c.itens && c.itens.length ? '**Itens que já existem** (use a chave em `origem:`; repetir o título dentro do mesmo épico atualiza o item):\n' + c.itens.map(n => '- ' + n).join('\n') + '\n\n' : '') +
    '### Roteiro para o agente\n\n' +
    'Você vai ajudar a pessoa a organizar o trabalho de "' + (c.projeto || c.onde || 'este projeto') + '" no CicloDev, como um Product Owner faria.\n\n' +
    '1. Converse com a pessoa para entender o que precisa ser feito. Faça perguntas curtas, uma de cada vez, até entender as entregas (épicos) e os itens de cada uma.\n' +
    '2. Para cada item, descubra a história (quem usa, o que quer e por quê) e os critérios de aceite (o que precisa estar certo para aceitar). Critérios curtos, que dê para conferir com sim ou não.\n' +
    '3. Combine a prioridade (Deve, Deveria, Poderia, Não terá agora e o nível de 1 a 5), o valor de negócio (1 a 10, com o motivo) e, se a pessoa souber, a estimativa em pontos.\n' +
    '4. Os itens do topo (os mais importantes) devem ser os mais detalhados. Ideias ainda soltas podem ficar só com o título e `prioridade: Poderia 5`.\n' +
    '5. Agrupe os itens em épicos que façam sentido para quem vai entregar. Reaproveite os épicos que já existem quando o assunto for o mesmo.\n' +
    '6. Use só as frentes da lista acima. Se nenhuma servir, avise a pessoa em vez de inventar.\n' +
    '7. Use só os valores aceitos da tabela. Na dúvida, deixe o campo de fora: ele pode ser preenchido depois, na tela.\n' +
    '8. Mostre um resumo e peça confirmação antes de gerar o texto final.\n' +
    '9. No fim, entregue **só o texto no formato acima, dentro de um bloco de código**, sem comentários no meio, pronto para colar em **Criar em lote**.\n';
}
function ciGeralMd(){
  const c = ciContexto(), l = (arr, f) => arr.map(f).join('\n');
  return '# CicloDev: instruções para um agente de IA\n\n' +
    'Gerado em ' + new Date().toLocaleString('pt-BR') + (c.onde ? ', a partir de **' + c.onde + '**' : '') + '. Passe este arquivo inteiro para o agente antes de começar a conversa.\n\n' +
    '## O que é o CicloDev\n\nO CicloDev é o sistema de gestão de projetos de software da IT.IA. Nele ficam o trabalho a fazer (itens), as entregas (versões), a ficha técnica, os desenhos de infraestrutura e a conversa com o assistente DevIT.\n\n' +
    '## Como o trabalho é organizado\n\n' +
    'A estrutura tem níveis, do maior para o menor: **Cliente › Projeto › Produto › Aplicação › Frente de trabalho**. Todo item mora numa frente de trabalho (por exemplo Frontend, Backend, Database), e aparece em todos os níveis de cima.\n\n' +
    '**Tipos de item:**\n' + l(TIPOS, t => '- **' + t.nome + '**: ' + t.expl) + '\n\nUm épico agrupa histórias e tarefas; uma sub-tarefa fica dentro de outro item.\n\n' +
    '**Situações (status):**\n' + l(STATUS, s => '- **' + s.nome + '**: ' + s.expl) + '\n- **Voltou**: o P.O. testou e devolveu, com o motivo\n\nNo Criar em lote, o item novo começa em ' + stNome('backlog') + ' (na Fila) e o épico começa em ' + stNome('todo') + '.\n\n' +
    '**Prioridade (classe MoSCoW):**\n' + l(typeof PO_MOSCOW !== 'undefined' ? PO_MOSCOW : [], m => '- **' + m[1] + '**: ' + m[2]) + '\n\n' +
    '**Nível de prioridade (de 1 a 5):**\n' + l(typeof PO_NIVEIS !== 'undefined' ? PO_NIVEIS : [], n => '- **' + n[1] + '**: ' + n[2]) + '\n\n' +
    '**Tipo no método:**\n' + l(typeof PO_TIPOS !== 'undefined' ? PO_TIPOS : [], t => '- **' + t[1] + '**: ' + t[2]) + '\n\n' +
    '**Campos de um item:** título, número (BL-xx, o identificador único), história (Como [quem], quero [o quê], para [por quê]), critérios de aceite (com caixa de marcar), desenho (computador e celular), prioridade (classe e nível), valor de negócio (1 a 10, com o motivo), estimativa em pontos (1, 2, 3, 5, 8, 13 ou 20), tipo (Item, Bug ou Melhoria, com o item de origem), situação, responsável, prazo, frente de trabalho, épico, versão, checklist, comentários, anexos e ligações com outros itens.\n\n' +
    '## O método do Product Owner (P.O.)\n\n' +
    '- **A fila (backlog)** fica na ordem que o P.O. combina: arrastando ou pela posição. Os do topo são os mais detalhados. O botão Ordenar pela prioridade ordena pela classe, pelo nível e pelo valor; no empate, sobe quem tem mais valor por ponto.\n' +
    '- **O ciclo de vida:** Criado, Priorizado, Em andamento, Pronto para testar, Aceito e Voltou (quando o P.O. devolve). Cada mudança fica no histórico do item, com quem e quando.\n' +
    '- **Só o P.O. aceita ou devolve** um item, quando o projeto tem P.O. definido. Um item **não vai para Aceito com critério de aceite desmarcado**.\n' +
    '- **Bug** é um critério de aceite que não foi cumprido, ligado ao item de origem. **Melhoria** ou mudança de ideia depois de pronto é sempre um item novo, nunca uma mudança no item antigo: o item aceito não muda mais a história nem os critérios.\n' +
    '- **O épico** tem a meta da entrega. **A versão** tem data de entrega e meta, e mostra quantos itens estão aceitos, quantos pontos e quanto falta.\n' +
    '- **A Definição de Pronto** é um texto por projeto (ex.: sem bugs conhecidos, testado, aprovado pelo P.O.) que aparece como lembrete em todo item.\n\n' +
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
