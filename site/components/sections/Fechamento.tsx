import { contato } from "@/data/site";
import { Manchete } from "@/components/ui/Revelar";
import { Botao } from "@/components/ui/Botao";

export function Fechamento() {
  return (
    <section className="fe" aria-labelledby="fe-titulo">
      <div className="container fe-in">
        <p className="rotulo fe-rot">Próximo da fila</p>
        <Manchete className="display fe-titulo" linhas={["Qual é o", "próximo sistema?"]} />
        <span id="fe-titulo" className="sr-only">Fale com a IT.IA</span>
        <div className="fe-ctas">
          <Botao href="#catalogo" estilo="preto">Ver o catálogo</Botao>
          <Botao href={contato.whatsapp} estilo="preto" externo>Falar com a IT.IA</Botao>
        </div>
      </div>
    </section>
  );
}
