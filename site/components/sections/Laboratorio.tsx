import { contato } from "@/data/site";
import { Revelar } from "@/components/ui/Revelar";
import { Botao } from "@/components/ui/Botao";

const TEMAS = ["Novidades de IA, sem enrolação", "O que funciona na prática", "Bastidores dos nossos sistemas", "Como usar IA no seu trabalho"];

export function Laboratorio() {
  return (
    <section id="laboratorio" className="lab" aria-labelledby="lab-titulo">
      <div className="container lab-in">
        <div>
          <p className="rotulo">Laboratório</p>
          <h2 id="lab-titulo" className="display lab-titulo">Estudamos IA<br />em público<span className="ponto" aria-hidden="true" /></h2>
          <p className="lab-texto">Tudo o que aprendemos construindo sistemas com inteligência artificial vira conteúdo aberto no Instagram.</p>
          <Botao href={contato.instagram} estilo="vazio" externo>Seguir {contato.instagramTexto}</Botao>
        </div>
        <Revelar className="lab-temas" atraso={0.1}>
          <ul>
            {TEMAS.map((t, i) => <li key={t}><span className="rotulo">{String(i + 1).padStart(2, "0")}</span>{t}</li>)}
          </ul>
          <a className="lab-arroba display" href={contato.instagram} target="_blank" rel="noopener noreferrer" aria-hidden="true" tabIndex={-1}>{contato.instagramTexto}</a>
        </Revelar>
      </div>
    </section>
  );
}
