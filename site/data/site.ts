// Todo o conteúdo do site mora aqui. Para lançar um produto novo, acrescente um item em `produtos`.

export const contato = {
  email: "contato@it-ia.tec.br",
  suporte: "suporte@it-ia.tec.br",
  privacidade: "privacidade@it-ia.tec.br",
  whatsapp: "https://wa.me/5511960288595?text=" + encodeURIComponent("Olá, IT.IA! Vim pelo site e gostaria de conversar sobre um sistema para a minha empresa."),
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
    frase: "Plataforma de gestão do desenvolvimento de software, do primeiro pedido à entrega, com IA integrada.",
    link: "https://ciclodev.it-ia.tec.br",
  },
];


// o que a IT.IA faz
export type Frente = { rot: string; nome: string; texto: string; itens: string[]; link?: { href: string; txt: string; externo?: boolean } };

export const sobMedida = {
  rot: "Sob medida",
  nome: "Sistemas feitos para a sua operação",
  texto: "Compreendemos como o trabalho acontece e desenvolvemos o sistema a partir dele, e não o contrário.",
  formatos: ["Sistema web", "Aplicativo", "Integração", "Automação"],
  hoje: ["Informações dispersas em planilhas", "Processos que dependem de uma única pessoa", "Ferramentas que não se integram", "Retrabalho para localizar informações"],
  depois: ["Cada informação em um único lugar", "Processos com regras e etapas definidas", "Integração completa, sem retrabalho manual", "Histórico de todas as alterações"],
};

export const frentes: Frente[] = [
  { rot: "Produtos", nome: "Produtos próprios, prontos para usar", texto: "Quando uma solução resolve um problema comum a muitas empresas, ela se torna um produto do nosso catálogo.", itens: ["CicloDev: gestão do desenvolvimento de software", "Novos produtos em desenvolvimento"], link: { href: "#catalogo", txt: "Ver o catálogo" } },
  { rot: "IA integrada", nome: "Inteligência artificial integrada aos sistemas", texto: "Agentes que operam com os dados do próprio sistema, respeitam as permissões de cada usuário e só executam ações com confirmação.", itens: ["Planejamento e priorização de projetos", "Arquitetura de software e de banco de dados", "Revisão de segurança de código e infraestrutura", "Atendimento e rotinas automatizadas"], link: { href: "#regras", txt: "Ver as regras da casa" } },
  { rot: "Laboratório", nome: "Pesquisa aplicada em IA", texto: "Avaliamos cada avanço da inteligência artificial antes de aplicá-lo em nossos sistemas. As análises são publicadas no Instagram.", itens: ["Análise de novos modelos e ferramentas", "Aplicações validadas em sistemas reais"], link: { href: "https://www.instagram.com/it.ia_official/", txt: "Seguir @it.ia_official", externo: true } },
];

// o CicloDev no catálogo: só o essencial, o resto fica no site dele
export const ciclodevFicha: { rot: string; texto: string; papeis?: string[]; destaque?: boolean }[] = [
  { rot: "Estrutura", texto: "Moldada ao seu trabalho: cliente, projeto, produto, aplicação e frente." },
  { rot: "Visões", texto: "Painel, Board, Lista, Tabela, Calendário e Linha do tempo, sempre sincronizados." },
  { rot: "Governança", texto: "Etapas com trava: cada fase exige comprovação para avançar." },
  { rot: "IA integrada", texto: "DevIT, o agente conectado ao código e ao banco de dados que acompanha o projeto do escopo à entrega.", papeis: ["Product Owner", "Arquiteto de software", "Segurança"], destaque: true },
];

// regras da casa: valem para todo sistema que sai da IT.IA
export const regras = [
  { nome: "Registro completo", texto: "Todas as alterações são registradas: quem alterou, o quê e quando." },
  { nome: "Acesso por permissão", texto: "Cada pessoa acessa apenas o que lhe cabe, com permissões verificadas no próprio banco de dados." },
  { nome: "IA com confirmação", texto: "Criação, edição e exclusão de dados sempre dependem da aprovação de quem solicitou." },
  { nome: "Testado antes da publicação", texto: "Nenhuma entrega é feita sem verificação de ponta a ponta." },
];

// o método completo, do escopo à entrega, agrupado em quatro fases
export const fasesMetodo = [
  { nome: "Entender", de: 0, ate: 3 },
  { nome: "Projetar", de: 4, ate: 5 },
  { nome: "Construir", de: 6, ate: 7 },
  { nome: "Entregar", de: 8, ate: 9 },
];
export const metodo = [
  { n: "01", nome: "Escopo", texto: "Definimos o que será feito, para quem e o que fica fora do projeto.", resultado: "Escopo aprovado" },
  { n: "02", nome: "Fontes", texto: "Levantamos tudo o que já existe: sistemas, planilhas, documentos e pessoas-chave.", resultado: "Mapa das fontes" },
  { n: "03", nome: "Uso", texto: "Acompanhamos como o trabalho acontece de fato, no dia a dia de quem vai usar o sistema.", resultado: "Fluxos reais do processo" },
  { n: "04", nome: "Evidências", texto: "Reunimos dados e comprovações que orientam cada decisão do projeto.", resultado: "Requisitos validados" },
  { n: "05", nome: "Desenho", texto: "Definimos arquitetura, modelo de dados, regras de acesso e telas antes de escrever o código.", resultado: "Arquitetura e telas" },
  { n: "06", nome: "Protótipo", texto: "Uma versão navegável, desde cedo, para validar a solução com quem vai usá-la.", resultado: "Protótipo aprovado" },
  { n: "07", nome: "Desenvolvimento", curto: "Desenvol\u00advimento", texto: "Construção em ciclos curtos, com cada entrega registrada e acompanhada no CicloDev.", resultado: "Versões incrementais" },
  { n: "08", nome: "Verificação", texto: "Testes de ponta a ponta, revisão de código e análise de segurança.", resultado: "Sistema testado" },
  { n: "09", nome: "Homologação", texto: "Você valida o sistema com dados e situações reais antes da publicação.", resultado: "Aceite do cliente" },
  { n: "10", nome: "Entrega", texto: "Publicação, migração dos dados e treinamento da equipe que vai usar o sistema.", resultado: "Sistema em produção" },
];
