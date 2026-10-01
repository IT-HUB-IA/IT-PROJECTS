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
  const versoes = (typeof ltVersoesDoProjeto === 'function' ? ltVersoesDoProjeto() : []).filter(m => m.tipo === 'release' && !m.entregue).map(m => m.nome + (m.data ? ' · entrega ' + fmtData(m.data) : '') + (m.meta ? ' · meta: ' + m.meta : ''));
  const epicos = pj ? issuesEm('project:' + pj.id).filter(i => i.tipo === 'epic' && !i.arquivado).map(i => i.titulo).slice(0, 80) : [];
  const itens = pj ? issuesEm('project:' + pj.id).filter(i => i.tipo !== 'epic' && i.tipo !== 'subtask' && !i.arquivado).slice(0, 120).map(i => { const ch = typeof chaveDe === 'function' ? chaveDe(i) : ''; const ep = i.pai && byId('issues', i.pai); return (ch ? ch + ': ' : '') + i.titulo + (ep ? ' (épico ' + ep.titulo + ')' : ''); }) : [];
  return {onde:nomeDe(UI.sel), projeto:pj ? pj.nome : '', frentes, versoes, proxima:typeof ltProximaVersao === 'function' ? ltProximaVersao() : 'v0.1', epicos, itens, dod:pj ? pj.dod || '' : '', po:pj && pj.po && pessoa(pj.po) ? pessoa(pj.po).nome : ''};
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
    '4. **`[Nome da frente]` no fim da linha** diz em qual frente de trabalho fica. Quando a linha não diz, o CicloDev põe na frente do assunto, se a aplicação tiver essa frente: tela, botão ou página vai para Frontend; API, rota ou regra para Backend; tabela ou migration para Database; webhook, WhatsApp, e-mail, pagamento ou sistema de terceiro para Integrações; deploy, servidor ou domínio para Infraestrutura; senha, permissão ou LGPD para Segurança; teste para Testes; protótipo ou Figma para Design; manual ou changelog para Documentação. Se o texto não deixa claro, o item herda a frente do épico. Na dúvida, escreva a frente.\n' +
    '5. **`{Nome da versão}` no fim da linha** diz em qual versão entra. O item herda a versão do épico. Uma versão que ainda não existe precisa ser declarada no texto, com a data de entrega (veja Versões, abaixo).\n\n' +
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
    '| `tipo` | Tipo do item | `Item`, `Bug`, `Melhoria`, `Tarefa` (tarefa externa, que não é desenvolvimento) ou `Decisão` (algo a decidir, com `prazo:` da decisão) | `tipo: Bug` |\n' +
    '| `responsavel` | Quem faz (para a Tarefa externa e para qualquer item) | o nome de alguém do time | `responsavel: Ana` |\n' +
    '| `prazo` | O prazo | dia/mês/ano | `prazo: 15/11/2026` |\n' +
    '| `origem` | O item de origem (obrigatório no Bug) | a chave de um item que já existe (BL-12), o título de um item (que já existe ou que está neste mesmo texto) ou a posição do item neste texto (`#3` é o 3º item, contando de cima) | `origem: BL-12`, `origem: Cadastro do cliente`, `origem: #1` |\n' +
    '| `depende` | O item só pode começar depois de outro. Repita a linha para cada item de que ele depende | a chave de um item que já existe (BL-12), o título de um item (que já existe ou que está neste texto) ou a posição neste texto (`#3`) | `depende: BL-12`, `depende: Cadastro do cliente`, `depende: #1` |\n' +
    '| `lote` | O nome deste lote (primeira linha do texto, sem recuo) | texto | `lote: Backend` |\n' +
    '| `depois de` | De quais lotes este vem depois (logo abaixo de `lote:`) | nomes separados por vírgula | `depois de: Database` |\n' +
    '| `meta` | **Do épico**: a meta da entrega. Logo abaixo da linha do épico, sem traço. **Da versão**: logo abaixo da linha `versão:` | texto (até 1000 letras) | `meta: o lojista publica sem ligar para o suporte` |\n' +
    '| `versão` | Declara uma versão (linha sem recuo, em qualquer lugar do texto) | o nome da versão | `versão: v1.3` |\n' +
    '| `entrega` | **Da versão**: a data de entrega, logo abaixo da linha `versão:`. Obrigatória em versão nova | dia/mês/ano ou ano-mês-dia | `entrega: 15/11/2026` |\n' +
    '| `pronto` | Uma regra da Definição de Pronto do projeto (repita a linha para cada regra; sem recuo, em qualquer lugar) | texto (até 300 letras) | `pronto: Testado no computador e no celular` |\n\n' +
    '**O nível de prioridade:** 1 só para emergência; 2 é o mais urgente do dia a dia; 3 é o ritmo normal; 4 pode esperar; 5 é ideia ainda sem detalhe.\n\n' +
    '**Os tipos:** Item é algo novo que a pessoa vai ver ou usar. Bug é um critério de aceite que não foi cumprido: sempre com `origem:` apontando o item. Melhoria é mudança pedida depois que um item ficou pronto: é sempre um item novo (pode ter `origem:` com o item antigo), nunca uma mudança no item antigo.\n\n' +
    '### Versões\n\n' +
    'Uma versão é declarada com a linha `versão: nome` e, logo abaixo, `entrega:` (a data, obrigatória em versão nova) e `meta:` (opcional). Depois, os épicos e itens entram nela com `{nome}` no fim da linha, como sempre.\n\n' +
    '- Versão que **já existe**: pode ser usada só com `{nome}`. Se for declarada com `entrega:` ou `meta:`, a data e a meta dela são atualizadas.\n' +
    '- Versão **nova** sem `entrega:` é erro: ela e os itens que apontam para ela ficam de fora até corrigir.\n' +
    '- Na tela, a data de entrega também é obrigatória (Entregas › Nova versão e Editar em tabela), e a meta fica na própria versão, em Entregas.\n\n' +
    '```\nversão: v1.3\n  entrega: 15/11/2026\n  meta: o lojista cuida da carteira sozinho\n\nCarteira de clientes {v1.3}\n- Cadastro do cliente\n```\n\n' +
    '### Vários lotes: a ordem em que são colados\n\n' +
    'Quando o trabalho é grande, divida em vários textos (um por frente, por exemplo Database, Backend, Integrações e Frontend). A regra é: **cada lote é colado depois dos lotes de que ele depende**. Um item só pode apontar (`depende:` ou `origem:`) para um item que já existe no projeto ou que está no mesmo texto. Se apontar para um item de um lote que ainda não foi colado, a prévia mostra o aviso **Cole antes o lote ...** e o Criar tudo não grava nada desse lote (para ele não entrar pela metade) até o lote anterior ser colado.\n\n' +
    '1. Monte os lotes na ordem das dependências: primeiro o que não depende de ninguém (em geral as decisões e o banco), depois o que usa ele (o servidor), depois as integrações e por último as telas.\n' +
    '2. Comece cada texto com duas linhas, sem recuo: `lote: Nome deste lote` e `depois de: Nome do lote anterior` (vários separados por vírgula). O primeiro lote não tem `depois de:`.\n' +
    '3. Numere os arquivos na ordem de colar: `01-database.txt`, `02-backend.txt`, `03-integracoes.txt`, `04-frontend.txt`.\n' +
    '4. Ao entregar, diga em uma linha a ordem de colar e espere a pessoa confirmar que cada lote foi gravado antes do próximo.\n\n' +
    '```\nlote: Backend\ndepois de: Database\n\nCadastro de pagadores [Backend] {v0.1}\n- Cadastrar pagador com lojas\n  depende: Criar tabela de loja\n```\n\n' +
    '### Ordem do backlog\n\n' +
    '**A ordem das linhas vira a ordem da fila.** Os itens novos entram no fim da fila do projeto, um depois do outro, na mesma ordem em que aparecem no texto (de cima para baixo). Itens que já existem e só são atualizados **não mudam de lugar**. Por isso, escreva primeiro os mais importantes. Depois, o P.O. ajusta a ordem na tela (arrastando, pela posição no item ou com Ordenar pela prioridade).\n\n' +
    '### Situação, histórico e Definição de Pronto\n\n' +
    '- **Situação**: todo item criado pelo lote começa em **Criado** (o épico, em Priorizado). O **Criar em lote sempre cria em Criado**; a situação só muda depois, pelo **Editar em lote** (`situação:`) ou na tela. O ciclo é Criado › Priorizado › Em andamento › Pronto para testar › Aceito, e Voltou quando o P.O. devolve. Quem leva até Pronto para testar é qualquer pessoa do time; **Aceitar e Devolver só o P.O. do projeto** (se o projeto não tem P.O., qualquer um do time aceita, como antes). Nada vai para Aceito com critério de aceite desmarcado. Aparece na janela do item (cartão Principal), no Quadro, na Lista e na Fila.\n' +
    '- **Histórico de mudanças**: o próprio sistema grava cada mudança de situação e de critério (criou, marcou, desmarcou, tirou), com quem fez e quando. Ninguém escreve nem apaga o histórico, nem pelo lote. Aparece no fim da janela do item.\n' +
    '- **Definição de Pronto**: um texto por projeto, mostrado como lembrete em todo item (abaixo dos critérios de aceite) e em Entregas. Pelo lote, cada linha `pronto:` acrescenta uma regra; as que já existem não se repetem e nada é apagado. Na tela, quem edita é qualquer pessoa do time, em Entregas ou no item.\n\n' +
    '### Regras de leitura\n\n' +
    '1. Um campo por linha. Não junte dois campos na mesma linha.\n' +
    '2. Os critérios de aceite vão com `aceite:`, um por linha. **Não** use `- ` para critério: linha com `- ` vira item.\n' +
    '3. Valor fora do aceito (prioridade que não existe, nível fora de 1 a 5, estimativa fora da sequência, valor fora de 1 a 10, campo que não existe, Bug sem origem) aparece como erro na prévia, com o número da linha, e **aquele item não é criado**. Os outros itens entram normalmente.\n' +
    '4. Um épico com o mesmo nome de um que já existe no projeto **não é duplicado**: os itens entram nele.\n' +
    '5. Um item com o mesmo título dentro de um épico que já existe **não é duplicado**: ele recebe os campos que vieram no texto, e nada do que ele já tem é apagado (os critérios novos se somam aos que já existem).\n' +
    '5b. **Critério de aceite repetido é ignorado**: colar o mesmo texto de novo não duplica critério. Conta como igual o critério com o mesmo texto, sem diferença de maiúscula, acento ou espaço; no mesmo item do texto, a segunda linha igual também é ignorada.\n' +
    '5d. **`depende:`** liga o item ao item de que ele depende (na tela, a ligação \"é bloqueado por\"). Apontar para um item que não existe, neste projeto ou neste texto, é erro na prévia e o item fica de fora. Repetir a mesma dependência não duplica. Na janela do item aparece \"Depende de\", com um aviso enquanto a dependência ainda não foi aceita; no Quadro, a etiqueta \"depende\". O aviso não impede começar: só alerta.\n' +
    '5c. Bug e Melhoria podem apontar para um item do **mesmo texto**, que ainda não tem número: use o título dele (`origem: Cadastro do cliente`) ou a posição dele no texto (`origem: #1`). A ligação é feita depois que todos são criados. Se o item de origem tiver erro, o Bug ou a Melhoria também fica de fora.\n' +
    '6. Item que já foi aceito não muda a história nem os critérios: para mudar, crie um item novo com `tipo: Melhoria`.\n' +
    '7. Títulos curtos e claros (até 300 letras), começando com verbo ou com o nome da coisa (ex.: "Cadastro do cliente", "Validar CPF no cadastro").\n' +
    '8. `responsavel:` e `prazo:` valem para qualquer item e são o normal na Tarefa externa e na Decisão (quem faz ou decide e até quando). Se não vierem, ajustam-se depois, pelo Editar em lote ou na tela.\n' +
    '9. O formato antigo, só com títulos, continua valendo: os detalhes são opcionais.\n\n' +
    '### Exemplo só com títulos\n\n```\n' + LT_EXEMPLO + '\n```\n\n' +
    '### Exemplo completo\n\n```\n' + ex + '\n```\n\n' +
    '### Exemplo com Bug, Melhoria e dependência\n\n```\nCarteira de clientes\n- Cadastro do cliente\n  aceite: Avisa quando o CPF já está cadastrado\n- Tela da lista da carteira\n  depende: Cadastro do cliente\n- CPF repetido entra no cadastro\n  tipo: Bug\n  origem: Cadastro do cliente\n  aceite: Avisa quando o CPF já está cadastrado\n  prioridade: Deve 2\n  pontos: 2\n- Exportar a carteira em planilha\n  tipo: Melhoria\n  origem: #1\n  como: lojista\n  quero: baixar a carteira em planilha\n  para: mandar para o meu contador\n  prioridade: Poderia 4\n  valor: 3\n  pontos: 3\n```\n\n' +
    '### Nomes que existem agora' + (c.onde ? ' (em ' + c.onde + ')' : '') + '\n\n' +
    '**Frentes de trabalho** (use exatamente um destes nomes dentro de `[ ]`):\n' + (fr.length ? fr.map(n => '- ' + n).join('\n') : '- (nenhuma frente ainda: crie uma na Estrutura antes)') + '\n\n' +
    '**Versões abertas** (use só o nome dentro de `{ }`; a próxima sugerida é `' + c.proxima + '`):\n' + (c.versoes.length ? c.versoes.map(n => '- ' + n).join('\n') : '- (nenhuma: declare `versão: ' + c.proxima + '` com `entrega:` embaixo)') + '\n\n' +
    '**Épicos que já existem no projeto** (repetir o nome põe os itens dentro dele):\n' + (c.epicos.length ? c.epicos.map(n => '- ' + n).join('\n') : '- (nenhum ainda)') + '\n\n' +
    '**Definição de Pronto de ' + (c.projeto || 'este projeto') + '** (hoje):\n' + (c.dod ? c.dod.split('\n').map(l => l.trim()).filter(Boolean).map(l => (l.startsWith('-') ? l : '- ' + l)).join('\n') : '- (ainda não escrita: pode mandar linhas pronto:)') + '\n\n' +
    '**P.O. do projeto:** ' + (c.po || 'ninguém definido (qualquer um do time aceita)') + '\n\n' +
    (c.itens && c.itens.length ? '**Itens que já existem** (use a chave em `origem:`; repetir o título dentro do mesmo épico atualiza o item):\n' + c.itens.map(n => '- ' + n).join('\n') + '\n\n' : '') +
    '## Editar em lote (ajustar o que já existe)\n\n' +
    'Fica em **Editar em lote**, ao lado de Em lote. Serve para corrigir, mover, renomear, cancelar e mudar muitos itens de uma vez. **Não cria itens** (para criar, use o Criar em lote).\n\n' +
    '### Sintaxe\n\n' +
    '- Cada bloco começa com **`editar: BL-12`** (a chave) ou **`editar: Título exato`**. Se houver mais de um item com o mesmo título, a linha seguinte é `no épico: Nome do épico`.\n' +
    '- Para vários itens de uma vez: **`editar todos: épico Nome`**, `editar todos: versão v1.1` ou `editar todos: frente Backend`.\n' +
    '- Embaixo, **uma mudança por linha**, no formato `campo: valor` (o recuo é opcional). Só escreva o que muda.\n' +
    '- Linha que começa com `#` é comentário e é ignorada.\n\n' +
    '| Campo | O que faz | Valores |\n|---|---|---|\n' +
    '| `titulo` | Renomeia (só com um item, nunca em editar todos) | texto até 300 letras |\n' +
    '| `como`, `quero`, `para`, `historia` | Troca a história | como no Criar em lote |\n' +
    '| `prioridade`, `nivel`, `valor`, `pontos` | Troca prioridade, nível, valor e pontos | os mesmos do Criar em lote |\n' +
    '| `tipo` | Troca o tipo | Item, Bug, Melhoria, Tarefa ou Decisão |\n' +
    '| `responsavel`, `prazo` | Troca o responsável e o prazo | nome de alguém do time (ou `ninguém`); dia/mês/ano |\n' +
    '| `situação` | Muda a situação, pelas mesmas regras da tela: Aceito só pelo P.O. (sem P.O., qualquer um do time) e com todos os critérios marcados; Voltou só pelo P.O., de Pronto para testar, com `motivo:`. Pode pular etapas, como na tela (ex.: de Criado direto para Pronto para testar); se o item depende de outro ainda não aceito, a prévia avisa | `Criado`, `Priorizado`, `Em andamento`, `Pronto para testar`, `Aceito`, `Voltou` (ou um status próprio do projeto) |\n' +
    '| `motivo` | O motivo da devolução (só com `situação: Voltou`) | texto até 1000 letras |\n' +
    '| `início` | A data de início | dia/mês/ano (ou `nenhum`); não pode ficar depois do prazo |\n' +
    '| `onde` | Muda o lugar do item na estrutura (a coluna Onde da Lista) | `Aplicação › Frente` (como a Lista mostra), ou o nome de uma frente, aplicação, produto, projeto ou cliente. Com mais de uma opção, a prévia pede `Aplicação › Frente` |\n' +
    '| `descrição` | Troca a descrição | texto até 10000 letras, numa linha |\n' +
    '| `horas` | A estimativa em horas | número de 0 a 10000 |\n' +
    '| `data alvo` | A data alvo (prevista) | dia/mês/ano (ou `nenhuma`) |\n' +
    '| `cliente vê` | Se o cliente vê o item no painel dele | `sim` ou `não` |\n' +
    '| `sprint` | Põe ou tira de um sprint | o nome do sprint (ou `nenhum`) |\n' +
    '| `aceite` | Acrescenta um critério (igual a um que já existe é ignorado) | texto |\n' +
    '| `tirar aceite` | Tira um critério, pelo texto | o texto do critério |\n' +
    '| `trocar aceites` | Tira todos os critérios antes de pôr os `aceite:` do bloco (substitui) | `sim` |\n' +
    '| `épico`, `versão`, `frente` | Move para outro épico, versão ou frente | o nome (ou a chave do épico); `nenhum` / `nenhuma` tira |\n' +
    '| `posição` | Muda o lugar na fila | `topo`, `fim`, `depois de BL-12`, `antes de BL-12` |\n' +
    '| `depende`, `tirar depende` | Acrescenta ou tira uma dependência | a chave ou o título |\n' +
    '| `trocar depende` | Tira todas as dependências antes das `depende:` do bloco | `sim` |\n' +
    '| `arquivar`, `cancelar` | Arquiva ou cancela (não será feito), com o motivo guardado nos comentários. Nada é apagado | o motivo |\n' +
    '| `reabrir` | Reabre um item arquivado ou cancelado | `sim` |\n' +
    '| `mudar aceito` | Permite mudar história e critérios de um item já aceito (ele volta para Priorizado) e também é **necessário para tirar um item de Aceito** com `situação:` | `sim` |\n' +
    '| `meta` | A meta do épico (só quando o alvo é um épico) | texto |\n\n' +
    '### Exemplos\n\n' +
    '```\n# renomear e trocar prioridade e pontos\neditar: BL-12\n  titulo: Cadastro do pagador com CPF\n  prioridade: Deve 2\n  valor: 9 é o que mais trava o analista\n  pontos: 5\n\n# corrigir a história\neditar: BL-12\n  como: analista\n  quero: cadastrar o pagador com CPF e telefone\n  para: não perder o contato\n\n# critérios: acrescentar, tirar, substituir todos\neditar: BL-12\n  aceite: Mostra a data do cadastro\n  tirar aceite: Funciona no celular\neditar: BL-14\n  trocar aceites: sim\n  aceite: Salva nome e CPF\n  aceite: Avisa CPF repetido\n\n# achar pelo título dentro do épico\neditar: Tela da lista da carteira\n  no épico: Carteira de clientes\n  versão: v1.1\n  frente: Frontend\n\n# mover de épico e mudar a posição na fila\neditar: BL-30\n  épico: Cadastro de pagadores\n  posição: depois de BL-12\n\n# dependências\neditar: BL-31\n  depende: BL-12\n  tirar depende: BL-9\neditar: BL-32\n  trocar depende: sim\n  depende: BL-30\n\n# cancelar, arquivar e reabrir\neditar: BL-20\n  cancelar: virou parte do BL-12\neditar: BL-21\n  arquivar: fica para depois do lançamento\neditar: BL-22\n  reabrir: sim\n\n# vários de uma vez\neditar todos: épico Carteira de clientes\n  versão: v1.2\neditar todos: frente Backend\n  responsavel: Ana\n\n# item já aceito: só com pedido explícito\neditar: BL-5\n  mudar aceito: sim\n  aceite: Mostra o saldo por loja\n\n# tarefa externa\neditar: BL-40\n  tipo: Tarefa\n  responsavel: William\n  prazo: 15/10/2026\n\n# situação, datas e onde\neditar: BL-12\n  situação: Pronto para testar\n  início: 05/10/2026\n  prazo: 15/10/2026\n  onde: Java BL › Backend\n\n# o P.O. devolve\neditar: BL-13\n  situação: Voltou\n  motivo: o saldo não bate com o extrato\n\n# o P.O. aceita (todos os critérios marcados)\neditar: BL-14\n  situação: Aceito\n\n# vários de uma vez\neditar todos: épico Carteira de clientes\n  situação: Pronto para testar\n  responsavel: William\n  tipo: Melhoria\n\n# o resto da janela do item\neditar: BL-15\n  descrição: Tela da lista com filtro por loja\n  horas: 6\n  data alvo: 20/10/2026\n  cliente vê: sim\n  sprint: Sprint 3\n  onde: aplicação Java Fiscal\n```\n\n' +
    '**Regra geral:** tudo o que dá para mudar na tela de um item, em qualquer coluna da Lista ou na janela do item, dá para mudar pelo Editar em lote, com a mesma sintaxe (um campo por linha). E só isso: quem não pode mudar na tela também não pode pelo lote.\n\n' +
    '### Regras de segurança\n\n' +
    '1. **A prévia é obrigatória.** Ela mostra, para cada item, uma tabela com o campo, o antes e o depois, e o total de itens afetados.\n' +
    '2. **Com qualquer erro, nada é gravado**: item que não existe, título ambíguo (dois itens com o mesmo título sem `no épico:`), versão ou frente que não existe, valor inválido, campo desconhecido, critério a tirar que não existe, **situação que não existe**, **`onde` que não existe ou ambíguo**, **Voltou sem `motivo:`**, Aceito com critério desmarcado ou por quem não é o P.O., data fora do formato dia/mês/ano e início depois do prazo.\n' +
    '3. **Item aceito é protegido**: mudar a história ou os critérios dele é erro, a não ser com `mudar aceito: sim` (a prévia avisa e o item volta para Priorizado). O mesmo `mudar aceito: sim` é preciso para **tirar um item de Aceito** com `situação:`. O caminho normal é criar uma Melhoria.\n' +
    '4. Tirar um critério **marcado como cumprido** (com `tirar aceite:` ou `trocar aceites:`) mostra um aviso na prévia.\n' +
    '5. **Nada é apagado**: arquivar e cancelar só escondem o item, com o motivo nos comentários; `reabrir: sim` traz de volta.\n' +
    '6. **Tudo vai para o histórico** de cada item: o banco grava quem mudou, quando e o que mudou (antes e depois).\n' +
    '7. **Desfazer o último lote**: o botão aparece no topo do Criar em lote e do Editar em lote e volta os itens a como estavam antes do último lote (criar ou editar).\n' +
    '8. Use sempre a **chave** (BL-12) quando souber: é o jeito sem erro de achar o item.\n' +
    '9. **A situação segue as regras da tela**: qualquer pessoa do time leva até Pronto para testar (pode pular etapas); **Aceito e Voltou só o P.O.** do projeto (sem P.O., qualquer um do time). Aceito exige todos os critérios marcados; Voltou só sai de Pronto para testar e exige `motivo:`. O que muda de situação vai para o histórico e o Desfazer o último lote volta.\n\n' +
    '## Tarefa externa\n\n' +
    'É um tipo para o que **não é desenvolvimento** (ex.: marcar o vínculo da 40% no sistema do BL, pedir um acesso, mandar um documento). No Criar em lote: `tipo: Tarefa`, com `responsavel:` e `prazo:`. Aparece na Lista, no Quadro e na Fila com a marca **Externa** e **não conta nos pontos da versão**.\n\n' +
    '```\nPendências fora do sistema\n- Marcar o vínculo da 40% no sistema do BL\n  tipo: Tarefa\n  responsavel: William\n  prazo: 10/10/2026\n  aceite: O vínculo aparece no cadastro do BL\n```\n\n' +
    '## Decisão\n\n' +
    'É um tipo para **algo que precisa ser decidido** antes de seguir (ex.: qual banco de pagamento usar). No Criar em lote: `tipo: Decisão`, com `prazo:` (o prazo da decisão) e `responsavel:` (quem decide). Os itens que esperam a decisão usam `depende:` apontando para ela. A lista **O que fazer hoje** avisa quando uma decisão aberta trava itens ou passou do prazo. **Não conta nos pontos da versão.** O sistema nunca adivinha uma decisão pelo título: só vale o `tipo: Decisão`.\n\n' +
    '```\nDecisões abertas\n- Escolher o banco que gera o Pix\n  tipo: Decisão\n  responsavel: William\n  prazo: 08/10/2026\n  aceite: O banco escolhido está registrado no item\n- Gerar o Pix da cobrança\n  depende: Escolher o banco que gera o Pix\n```\n\n' +
    '### Roteiro para o agente\n\n' +
    'Você vai ajudar a pessoa a organizar o trabalho de "' + (c.projeto || c.onde || 'este projeto') + '" no CicloDev, como um Product Owner faria.\n\n' +
    '1. Converse com a pessoa para entender o que precisa ser feito. Faça perguntas curtas, uma de cada vez, até entender as entregas (épicos) e os itens de cada uma.\n' +
    '2. Para cada item, descubra a história (quem usa, o que quer e por quê) e os critérios de aceite (o que precisa estar certo para aceitar). Critérios curtos, que dê para conferir com sim ou não.\n' +
    '3. Combine a prioridade (Deve, Deveria, Poderia, Não terá agora e o nível de 1 a 5), o valor de negócio (1 a 10, com o motivo) e, se a pessoa souber, a estimativa em pontos.\n' +
    '4. Escreva os itens na ordem de importância: a ordem das linhas vira a ordem da fila. Os do topo devem ser os mais detalhados. Ideias ainda soltas podem ficar só com o título e `prioridade: Poderia 5`.\n' +
    '5. Se a entrega for numa versão nova, declare a versão com `versão:` e `entrega:` (a data é obrigatória). Agrupe os itens em épicos que façam sentido para quem vai entregar. Reaproveite os épicos que já existem quando o assunto for o mesmo.\n' +
    '6. Use só as frentes da lista acima. Se nenhuma servir, avise a pessoa em vez de inventar.\n' +
    '7. Use só os valores aceitos da tabela. Na dúvida, deixe o campo de fora: ele pode ser preenchido depois, na tela.\n' +
    '8. Mostre um resumo e peça confirmação antes de gerar o texto final. Para **ajustar** o que já existe, gere um texto do Editar em lote (com a chave de cada item), nunca um Criar em lote repetido. Para mudar a **situação**, use `situação:`; só ponha `Aceito` ou `Voltou` se quem vai colar o texto for o P.O. do projeto.\n' +
    '9. Se o trabalho for dividido em vários lotes, siga a seção Vários lotes: cada texto começa com `lote:` e `depois de:`, e os arquivos vão numerados na ordem de colar.\n' +
    '10. No fim, entregue **só o texto no formato acima, dentro de um bloco de código**, sem comentários no meio, pronto para colar em **Criar em lote**.\n';
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
