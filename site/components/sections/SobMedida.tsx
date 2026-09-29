import { contato } from "@/data/site";
import { Titulo } from "@/components/ui/Capa";
import { Botao } from "@/components/ui/Botao";

// o que acontece depois do clique: deixa claro o próximo passo
const PASSOS = [
  { n: "01", nome: "Você apresenta o cenário atual", texto: "Por WhatsApp ou e-mail: o processo, as planilhas e os sistemas que limitam a operação." },
  { n: "02", nome: "Mapeamos o processo com você", texto: "Uma conversa para entender quem faz o quê, onde o tempo se perde e o que precisa mudar." },
  { n: "03", nome: "Definimos o caminho juntos", texto: "Escopo, etapas e as primeiras entregas, combinados com você." },
];

export function SobMedida() {
  return (
    <section id="contato" className="capa sm" aria-labelledby="sm-titulo">
      <span className="capa-canto a" aria-hidden="true" />
      <span className="capa-canto b" aria-hidden="true" />
      <div className="container sm-in">
        <div className="sm-texto-col">
          <p className="rotulo com-ponto claro">Sob medida</p>
          <Titulo id="sm-titulo" className="sm-titulo">Apresente o desafio. Nós desenhamos o sistema</Titulo>
          <p className="sm-texto">Você conversa diretamente com quem desenvolve. Compreendemos como o trabalho acontece hoje e indicamos o que automatizar, o que integrar e por onde começar.</p>
          <div className="sm-acoes">
            <Botao href={contato.whatsapp} estilo="claro" externo>Quero conversar sobre o meu sistema</Botao>
            <p className="sm-micro">Se preferir, escreva para <span className="sm-email">{contato.email}</span></p>
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
