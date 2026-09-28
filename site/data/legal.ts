// Termos de Uso e Política de Privacidade do site institucional da IT.IA (it-ia.tec.br).
// Cada produto (como o CicloDev) tem os próprios termos e política, no site dele.
import { contato } from "./site";

export const atualizadoEm = "28 de setembro de 2026";

export type Bloco = { tipo: "p"; texto: string } | { tipo: "lista"; itens: string[] } | { tipo: "tabela"; cab: [string, string]; linhas: [string, string][] };
export type Secao = { id: string; titulo: string; blocos: Bloco[] };

const p = (texto: string): Bloco => ({ tipo: "p", texto });
const lista = (...itens: string[]): Bloco => ({ tipo: "lista", itens });

export const termos: { resumo: string; secoes: Secao[] } = {
  resumo: "Este site apresenta a IT.IA e os seus sistemas. Você pode navegar à vontade, sem cadastro. O conteúdo é informativo e pertence à IT.IA. Cada produto, como o CicloDev, tem termos próprios, que valem quando você usa o produto.",
  secoes: [
    { id: "quem-somos", titulo: "Quem somos", blocos: [
      p(`Este site (it-ia.tec.br, o "Site") é da IT.IA, inscrita no CNPJ sob o nº ${contato.cnpj} ("IT.IA", "nós"). A IT.IA cria sistemas sob medida, desenvolve produtos próprios e publica conteúdo sobre inteligência artificial.`),
      p("Ao navegar no Site, você concorda com estes Termos. Se não concordar, pedimos que não use o Site."),
    ] },
    { id: "uso", titulo: "Uso do Site", blocos: [
      p("O Site é aberto e não exige cadastro. Você pode usá-lo para conhecer a IT.IA, os produtos do catálogo e as formas de entrar em contato conosco."),
      p("Não é permitido:"),
      lista(
        "tentar acessar áreas, sistemas ou dados que não são públicos;",
        "atrapalhar o funcionamento do Site, por exemplo com excesso de acessos automatizados;",
        "copiar o Site ou partes dele para se passar pela IT.IA;",
        "usar o Site para qualquer finalidade contrária à lei.",
      ),
    ] },
    { id: "conteudo", titulo: "Conteúdo e propriedade intelectual", blocos: [
      p("Os textos, o logo, os nomes IT.IA e CicloDev, os desenhos, a identidade visual e o código do Site pertencem à IT.IA e são protegidos pela lei de direitos autorais (Lei nº 9.610/1998) e pela lei de propriedade industrial (Lei nº 9.279/1996)."),
      p("Você pode compartilhar o endereço do Site e citar trechos com indicação da fonte. Qualquer outro uso depende de autorização por escrito da IT.IA."),
    ] },
    { id: "informativo", titulo: "Caráter informativo", blocos: [
      p("O que está no Site descreve a IT.IA e os seus sistemas de forma geral. As condições de cada projeto sob medida são combinadas diretamente com cada cliente, por escrito. Os exemplos de telas e conversas exibidos no Site são ilustrativos."),
      p("Trabalhamos para manter o Site correto e no ar, mas ele pode ficar indisponível por manutenção ou por motivos fora do nosso controle, e o conteúdo pode mudar sem aviso."),
    ] },
    { id: "produtos", titulo: "Produtos da IT.IA", blocos: [
      p("Os produtos do catálogo têm termos de uso e política de privacidade próprios. O CicloDev, por exemplo, tem os documentos dele em ciclodev.it-ia.tec.br/termos e ciclodev.it-ia.tec.br/privacidade. Esses documentos valem quando você cria uma conta ou usa o produto."),
    ] },
    { id: "links", titulo: "Links para outros sites", blocos: [
      p("O Site tem links para serviços de terceiros, como WhatsApp e Instagram. Ao abrir esses links, você sai do Site, e passam a valer os termos e as políticas desses serviços. A IT.IA não controla o conteúdo nem as práticas desses terceiros."),
    ] },
    { id: "responsabilidade", titulo: "Responsabilidade", blocos: [
      p("A IT.IA responde pelo Site nos termos da lei. Não respondemos por danos causados por uso indevido do Site, por falhas de conexão do próprio visitante ou por conteúdo de sites de terceiros acessados a partir de links."),
    ] },
    { id: "mudancas", titulo: "Mudanças nestes Termos", blocos: [
      p("Podemos atualizar estes Termos. A data da última atualização fica no topo desta página. A versão publicada aqui é a que vale."),
    ] },
    { id: "lei", titulo: "Lei aplicável e contato", blocos: [
      p("Estes Termos seguem as leis do Brasil. Quando a relação for de consumo, vale o foro do domicílio do consumidor, conforme o Código de Defesa do Consumidor."),
      p(`Dúvidas sobre estes Termos: ${contato.email}.`),
    ] },
  ],
};

export const privacidade: { resumo: string; secoes: Secao[] } = {
  resumo: `Este site não tem cadastro, não tem formulário e não usa cookies. Só recebemos dados pessoais quando você decide falar com a IT.IA por e-mail ou WhatsApp, e usamos esses dados apenas para responder. Não vendemos dados. Para exercer os seus direitos, escreva para ${contato.privacidade}.`,
  secoes: [
    { id: "quem-somos", titulo: "Quem somos", blocos: [
      p(`O site it-ia.tec.br (o "Site") é da IT.IA, inscrita no CNPJ sob o nº ${contato.cnpj} ("IT.IA", "nós"). Esta política explica como a IT.IA trata dados pessoais no Site, de acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, "LGPD") e o Marco Civil da Internet (Lei nº 12.965/2014).`),
      p(`A IT.IA é a controladora dos dados tratados no Site. Para assuntos de dados pessoais, inclusive para falar com o encarregado (DPO), escreva para ${contato.privacidade}.`),
      p("Os produtos da IT.IA, como o CicloDev, têm política de privacidade própria, que vale quando você usa o produto."),
    ] },
    { id: "dados", titulo: "Dados que tratamos", blocos: [
      p("Acesso ao Site: como em qualquer site, o servidor que entrega as páginas registra dados técnicos de cada acesso, como endereço IP, data e hora, página pedida e tipo de navegador. Esses registros servem para manter o Site seguro e funcionando."),
      p("Contato: quando você escreve para a IT.IA por e-mail ou WhatsApp, recebemos o que você decidir enviar, como nome, e-mail, telefone, empresa e a descrição do que precisa."),
      p("Não pedimos dados pessoais sensíveis (como saúde, religião ou biometria). Pedimos que você não os envie nas mensagens."),
    ] },
    { id: "finalidades", titulo: "Para que usamos", blocos: [
      { tipo: "tabela", cab: ["Finalidade", "Base legal (LGPD, art. 7º)"], linhas: [
        ["Manter o Site seguro, no ar e corrigir erros", "Legítimo interesse"],
        ["Guardar registros de acesso pelo prazo exigido pelo Marco Civil da Internet (art. 15)", "Cumprimento de obrigação legal"],
        ["Responder a sua mensagem e conversar sobre um projeto", "Procedimentos preliminares a contrato, a seu pedido"],
        ["Guardar a conversa para dar continuidade ao atendimento", "Legítimo interesse"],
      ] },
      p("Não vendemos dados, não usamos os seus dados para publicidade e não tomamos decisões automatizadas que afetem os seus direitos."),
    ] },
    { id: "cookies", titulo: "Cookies e armazenamento no navegador", blocos: [
      p("O Site não usa cookies, nem próprios nem de terceiros, e não guarda informações no seu navegador. Não usamos ferramentas de rastreamento ou de publicidade."),
    ] },
    { id: "compartilhamento", titulo: "Com quem compartilhamos", blocos: [
      p("Usamos fornecedores para hospedar o Site e para receber e-mails. Eles tratam dados apenas para prestar esses serviços à IT.IA, com obrigações de segurança e confidencialidade."),
      p("Quando você entra em contato conosco pelo WhatsApp ou pelo Instagram, essas plataformas também tratam os dados da conversa, conforme as políticas delas."),
      p("Podemos compartilhar dados quando a lei ou uma ordem judicial exigir."),
    ] },
    { id: "internacional", titulo: "Transferência internacional", blocos: [
      p("Alguns fornecedores podem guardar dados fora do Brasil. Nesses casos, a transferência segue o que a LGPD permite (art. 33), com garantias de proteção adequadas."),
    ] },
    { id: "prazos", titulo: "Por quanto tempo guardamos", blocos: [
      lista(
        "Registros de acesso ao Site: pelo menos 6 meses, como exige o Marco Civil da Internet, e depois são apagados.",
        "Conversas de contato: enquanto durar o atendimento e por até 5 anos depois, para dar continuidade e para defesa de direitos. Você pode pedir a exclusão antes disso.",
      ),
    ] },
    { id: "direitos", titulo: "Os seus direitos", blocos: [
      p("Pela LGPD (art. 18), você pode pedir:"),
      lista(
        "confirmação de que tratamos dados seus e acesso a eles;",
        "correção de dados incompletos ou errados;",
        "anonimização, bloqueio ou exclusão de dados desnecessários ou tratados em desacordo com a lei;",
        "portabilidade dos seus dados;",
        "informação sobre com quem compartilhamos os dados;",
        "exclusão dos dados tratados com o seu consentimento e revogação do consentimento.",
      ),
      p(`Para qualquer pedido, escreva para ${contato.privacidade}. Respondemos em até 15 dias. Você também pode procurar a Autoridade Nacional de Proteção de Dados (ANPD).`),
    ] },
    { id: "seguranca", titulo: "Segurança", blocos: [
      p("O Site funciona apenas com conexão segura (HTTPS) e tem proteções contra uso indevido. Nenhum sistema é totalmente imune a falhas; se acontecer um incidente que possa trazer risco a você, avisaremos você e a ANPD, como manda a lei."),
    ] },
    { id: "mudancas", titulo: "Mudanças nesta política", blocos: [
      p("Podemos atualizar esta política. A data da última atualização fica no topo desta página. Se a mudança for importante, avisaremos no próprio Site."),
    ] },
  ],
};
