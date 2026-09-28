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


// o que a IT.IA faz
export const frentes = [
  { rot: "Sob medida", nome: "Sistemas para a sua operação", texto: "Entendemos como o trabalho acontece e entregamos o sistema feito para ele: web, app, integração ou robô.", itens: ["Processos que hoje vivem em planilha", "Sistemas antigos que travam a operação", "Integração entre ferramentas que não conversam"] },
  { rot: "Produtos", nome: "Sistemas prontos da IT.IA", texto: "Cada problema que resolvemos bem vira produto, com número de série no catálogo.", itens: ["CicloDev, gestão do desenvolvimento de software", "Novos sistemas na linha de produção"] },
  { rot: "IA aplicada", nome: "Agentes dentro dos sistemas", texto: "Inteligência artificial que trabalha com os dados do sistema, respeita as permissões de cada pessoa e só age com confirmação.", itens: ["Planejamento e análise", "Segurança e revisão", "Atendimento e rotinas"] },
  { rot: "Laboratório", nome: "Pesquisa aplicada em IA", texto: "Testamos cada avanço de inteligência artificial antes de levar para os sistemas. As análises ficam abertas no Instagram.", itens: ["Análise dos novos modelos e ferramentas", "Aplicações validadas em sistemas reais"] },
];

// o CicloDev no catálogo: só o essencial, o resto fica no site dele
export const ciclodevDestaques = [
  "Estrutura moldada: cliente, projeto, produto, aplicação e frente",
  "Painel, Board, Lista, Tabela, Calendário e Linha do tempo",
  "Etapas com trava e prova para avançar",
  "DevIT, o agente de IA que atua como P.O. do projeto",
];

// regras da casa: valem para todo sistema que sai da IT.IA
export const regras = [
  { nome: "Registro de tudo", texto: "Quem mudou o quê e quando. O histórico nunca se perde." },
  { nome: "Cada um vê o que é seu", texto: "Permissões por pessoa e por trabalho, conferidas no próprio banco de dados." },
  { nome: "IA só age com confirmação", texto: "Criar, editar e apagar sempre esperam o ok de quem pediu." },
  { nome: "Testado antes de ir para o ar", texto: "Nada é entregue sem verificação de ponta a ponta." },
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
