import { contato } from "@/data/site";
import { Titulo } from "@/components/ui/Capa";
import { Botao } from "@/components/ui/Botao";

// o que acontece depois do clique: tira o medo de "vou cair num vendedor"
const PASSOS = [
  { n: "01", nome: "Você conta como é hoje", texto: "Pelo WhatsApp ou por e-mail: o processo, a planilha, o sistema que trava." },
  { n: "02", nome: "Mapeamos com você", texto: "Uma conversa para entender quem faz o quê, onde o tempo se perde e o que precisa mudar." },
  { n: "03", nome: "Você recebe o caminho", texto: "Uma proposta com o escopo, as etapas e o que entra primeiro no ar." },
];

export function SobMedida() {
  return (
    <section id="contato" className="capa sm" aria-labelledby="sm-titulo">
      <span className="capa-canto a" aria-hidden="true" />
      <span className="capa-canto b" aria-hidden="true" />
      <div className="container sm-in">
        <div className="sm-texto-col">
          <p className="rotulo com-ponto claro">Sob medida</p>
          <Titulo id="sm-titulo" className="sm-titulo">Conte o problema. A gente desenha o sistema</Titulo>
          <p className="sm-texto">Você fala direto com quem constrói. Em uma conversa, entendemos como o trabalho acontece hoje e mostramos o que automatizar, o que integrar e por onde começar.</p>
          <div className="sm-acoes">
            <Botao href={contato.whatsapp} estilo="claro" externo>Quero conversar sobre o meu sistema</Botao>
            <p className="sm-micro">Conversa sem compromisso. Prefere e-mail? <span className="sm-email">{contato.email}</span></p>
          </div>
        </div>
        <ol className="sm-passos" aria-label="O que acontece depois">
          {PASSOS.map(p => (
            <li key={p.n}>
              <span className="rotulo claro">{p.n}</span>
              <div><b>{p.nome}</b><p>{p.texto}</p></div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
