import { contato } from "@/data/site";
import { Titulo } from "@/components/ui/Capa";
import { Botao } from "@/components/ui/Botao";

// fechamento numa capa preta: a conversa começa aqui
export function SobMedida() {
  return (
    <section id="contato" className="capa sm" aria-labelledby="sm-titulo">
      <span className="capa-canto a" aria-hidden="true" />
      <span className="capa-canto b" aria-hidden="true" />
      <div className="container sm-in">
        <div>
          <p className="rotulo com-ponto claro">Sob medida</p>
          <Titulo id="sm-titulo" className="sm-titulo">Qual é o próximo sistema</Titulo>
          <p className="sm-texto">Planilha que ninguém entende, processo que depende de uma pessoa, sistema antigo que trava. Conte para a gente como o trabalho acontece hoje.</p>
        </div>
        <div className="sm-acoes">
          <Botao href={contato.whatsapp} estilo="claro" externo>Conversar no WhatsApp</Botao>
          <p className="rotulo claro">ou escreva para <span className="sm-email">{contato.email}</span></p>
        </div>
      </div>
    </section>
  );
}
