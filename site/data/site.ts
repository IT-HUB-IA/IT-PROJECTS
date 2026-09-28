// Todo o conteúdo do site mora aqui. Para lançar um produto novo, acrescente um item em `produtos`.

export const contato = {
  email: "contato@it-ia.tec.br",
  suporte: "suporte@it-ia.tec.br",
  privacidade: "privacidade@it-ia.tec.br",
  whatsapp: "https://wa.me/5511960288595?text=" + encodeURIComponent("Olá, IT.IA! Vim pelo site e quero conversar sobre um sistema."),
  whatsappTexto: "(11) 96028-8595",
  instagram: "https://www.instagram.com/it.ia_official/",
  instagramTexto: "@it.ia_official",
  cnpj: "69.279.397/0001-07",
};

export type Produto = {
  serie: string;
  nome: string;
  estado: "em produção" | "na linha";
  frase: string;
  link?: string;
};

export const produtos: Produto[] = [
  {
    serie: "IT-001",
    nome: "CicloDev",
    estado: "em produção",
    frase: "Gestão do desenvolvimento de software, do primeiro pedido à entrega, com um P.O. de IA dentro.",
    link: "https://ciclodev.it-ia.tec.br",
  },
];

// linhas vazias do catálogo: o que ainda está sendo feito, sem nome inventado
export const naLinha = ["IT-002", "IT-003", "IT-004"];

// a estrutura moldada do CicloDev: cada nível pode ser renomeado, ligado ou desligado
export const estrutura = [
  { nivel: "Cliente", exemplo: "Quem pede" },
  { nivel: "Projeto", exemplo: "O que vai ser feito" },
  { nivel: "Produto", exemplo: "O que o cliente recebe" },
  { nivel: "Aplicação", exemplo: "Web, app, API, robô" },
  { nivel: "Frente", exemplo: "Onde o time trabalha" },
];

export const ferramentas = [
  { cod: "01", nome: "Visões do trabalho", texto: "O mesmo trabalho visto como Painel, Backlog, Board, Lista, Tabela, Calendário, Linha do tempo, Carga do time e Meu trabalho. Mudou num lugar, mudou em todos." },
  { cod: "02", nome: "Itens de verdade", texto: "Épicos, histórias, tarefas e bugs com checklist, comentários, anexos, ligações de bloqueio e campos seus." },
  { cod: "03", nome: "Sprints e marcos", texto: "Ciclos com pontos, capacidade de cada pessoa e marcos que mostram se a entrega vai chegar a tempo." },
  { cod: "04", nome: "Etapas com trava", texto: "Cada fase exige prova para avançar: print, link, arquivo ou aprovação. Nada passa só na palavra." },
  { cod: "05", nome: "Foco e tempo", texto: "Cronômetro por item, blocos de foco na agenda e o registro de quanto cada coisa levou de verdade." },
  { cod: "06", nome: "Ficha técnica", texto: "Stack, frameworks, integrações e decisões de cada aplicação guardadas junto do trabalho." },
  { cod: "07", nome: "Custos", texto: "Quanto custa a operação, cada pessoa e cada projeto. A conta aparece antes da surpresa." },
  { cod: "08", nome: "Service Desk", texto: "O cliente pede com print, arquivo ou áudio. O pedido vira item, com prazo de resposta contado." },
  { cod: "09", nome: "Time e acessos", texto: "Owner, Dev e Stakeholder. Cada um vê o que precisa, e trabalho compartilhado respeita a permissão de cada um." },
  { cod: "10", nome: "Domínios", texto: "Endereços e vencimentos de cada sistema num lugar só, com aviso antes de vencer." },
  { cod: "11", nome: "Registro de tudo", texto: "Quem mudou o quê e quando. O histórico nunca se perde." },
  { cod: "12", nome: "Playbook", texto: "O método da IT.IA dentro do sistema: etapas, lentes e padrões que todo projeto segue." },
];

export const devit = [
  { cod: "P.O.", nome: "Molda o projeto inteiro", texto: "Do escopo à entrega: quebra a ideia em épicos, histórias e tarefas, estima, prioriza e replaneja quando algo muda." },
  { cod: "SEG", nome: "Análise de segurança", texto: "Revisa código, banco de dados, acessos e entrega contínua com as práticas de segurança reconhecidas no mercado. Aponta o que está exposto, explica o risco e propõe a correção." },
  { cod: "INF", nome: "Cria a infraestrutura", texto: "Monta a estrutura de banco, regras de acesso e ambientes a partir do que o projeto precisa." },
  { cod: "ARQ", nome: "Pensa como arquiteto", texto: "Estudou design de sistemas em escala, Domain-Driven Design e bancos de dados por dentro. Propõe cache, divisão de dados e disponibilidade quando fazem sentido, e explica o custo de cada escolha." },
  { cod: "DES", nome: "Desenha o sistema", texto: "Diagramas de arquitetura, fluxos e telas, gerados a partir do projeto real e não de um modelo pronto." },
  { cod: "COD", nome: "Conectado ao seu código", texto: "Entende o repositório e o banco de dados, então responde sobre o seu sistema, não sobre um sistema qualquer." },
  { cod: "OK", nome: "Só faz com o seu ok", texto: "Criar, editar e apagar sempre esperam a sua confirmação, e só onde você tem permissão." },
];

export const metodo = [
  { n: "01", nome: "Escopo", texto: "O que é, para quem e o que fica de fora." },
  { n: "02", nome: "Fontes", texto: "Tudo que já existe: sistemas, planilhas, pessoas." },
  { n: "03", nome: "Uso", texto: "Como o trabalho acontece de verdade, no dia a dia." },
  { n: "04", nome: "Evidências", texto: "Números e provas antes de qualquer opinião." },
  { n: "05", nome: "Desenho", texto: "Arquitetura, dados e telas no papel." },
  { n: "06", nome: "Protótipo", texto: "Algo clicável, cedo, para errar barato." },
  { n: "07", nome: "Verificação", texto: "Testado de ponta a ponta antes de ir para o ar." },
];
