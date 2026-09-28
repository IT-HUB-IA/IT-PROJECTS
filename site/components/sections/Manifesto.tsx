import { Manchete, Revelar } from "@/components/ui/Revelar";

export function Manifesto() {
  return (
    <section className="mani" aria-labelledby="mani-titulo">
      <div className="container mani-in">
        <p className="rotulo mani-rot">Manifesto</p>
        <Manchete as="h2" className="display mani-titulo" linhas={["Não fazemos", "um sistema.", <span key="c" className="mani-cinza">Fazemos o método</span>, <span key="d" className="mani-cinza">que faz sistemas.</span>]} />
        <Revelar className="mani-colunas" atraso={0.1}>
          <p><span id="mani-titulo" className="sr-only">Manifesto da IT.IA</span>Cada sistema sai da mesma linha: escopo, fontes, uso, evidências, desenho, protótipo e verificação. O que aprendemos em um vira padrão no próximo.</p>
          <p>O primeiro sistema ensina o segundo. O milésimo nasce com tudo o que os anteriores aprenderam. Qualidade não depende de sorte: depende de método.</p>
        </Revelar>
      </div>
    </section>
  );
}
