// Todo o conteúdo do site mora aqui. Para lançar um produto novo, acrescente um item em `produtos`.

export const contato = {
  email: "contato@it-ia.tec.br",
  suporte: "suporte@it-ia.tec.br",
  privacidade: "privacidade@it-ia.tec.br",
  whatsapp: "https://wa.me/5511960288595?text=" + encodeURIComponent("Olá, IT.IA! Vim pelo site e quero conversar sobre um sistema para a minha empresa."),
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
export type Frente = { rot: string; nome: string; texto: string; itens: string[]; link?: { href: string; txt: string; externo?: boolean } };

export const sobMedida = {
  rot: "Sob medida",
  nome: "Sistemas feitos para a sua operação",
  texto: "Entendemos como o trabalho acontece e construímos o sistema em volta dele, não o contrário.",
  formatos: ["Sistema web", "Aplicativo", "Integração", "Automação"],
  hoje: ["Dados espalhados em planilhas", "Processo que depende de uma pessoa", "Ferramentas que não conversam", "Retrabalho para achar uma informação"],
  depois: ["Cada informação em um lugar só", "Processo com regras e etapas claras", "Tudo integrado, sem copiar e colar", "Histórico de quem fez o quê"],
};

export const frentes: Frente[] = [
  { rot: "Produtos", nome: "Produtos próprios, prontos para usar", texto: "Quando resolvemos bem um problema que muitas empresas têm, ele vira produto no catálogo.", itens: ["CicloDev: gestão do desenvolvimento de software", "Novos produtos em desenvolvimento"], link: { href: "#catalogo", txt: "Ver o catálogo" } },
  { rot: "IA aplicada", nome: "Inteligência artificial dentro do sistema", texto: "Agentes que trabalham com os dados do próprio sistema, respeitam a permissão de cada pessoa e só agem com confirmação.", itens: ["Planejamento e priorização de projetos", "Revisão de segurança de código e banco de dados", "Atendimento e rotinas automatizadas"], link: { href: "#regras", txt: "Ver as regras da casa" } },
  { rot: "Laboratório", nome: "Pesquisa aplicada em IA", texto: "Testamos cada avanço de inteligência artificial antes de levar para os sistemas. As análises ficam abertas no Instagram.", itens: ["Análise dos novos modelos e ferramentas", "Aplicações validadas em sistemas reais"], link: { href: "https://www.instagram.com/it.ia_official/", txt: "Seguir @it.ia_official", externo: true } },
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
