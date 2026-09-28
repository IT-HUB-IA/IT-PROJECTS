import { contato } from "@/data/site";
import { Manchete, Revelar } from "@/components/ui/Revelar";
import { Botao } from "@/components/ui/Botao";

export function SobMedida() {
  return (
    <section id="sob-medida" className="sm" aria-labelledby="sm-titulo">
      <div className="container sm-in">
        <p className="rotulo sm-rot">Sob medida</p>
        <div>
          <Manchete className="display sm-titulo" linhas={["Sua operação", "também pode", <span key="v">virar um sistema<span className="ponto" aria-hidden="true" /></span>]} />
          <span id="sm-titulo" className="sr-only">Sistemas sob medida para a sua empresa</span>
          <Revelar className="sm-texto">
            <p>Planilha que ninguém entende, processo que depende de uma pessoa, sistema antigo que trava. A IT.IA leva a mesma linha de produção dos nossos produtos para dentro da sua empresa: entende como o trabalho acontece e entrega um sistema feito para ele.</p>
            <div className="sm-ctas">
              <Botao href={contato.whatsapp} externo>Conversar no WhatsApp</Botao>
              <a className="link rotulo sm-email" href={"mailto:" + contato.email}>{contato.email}</a>
            </div>
          </Revelar>
        </div>
      </div>
    </section>
  );
}
