import { contato } from "@/data/site";
import { Rotulo, Titulo } from "@/components/ui/Capa";
import { Botao } from "@/components/ui/Botao";

const TEMAS = ["Novidades de IA, sem enrolação", "O que funciona na prática", "Bastidores dos nossos sistemas", "Como usar IA no seu trabalho"];

export function Laboratorio() {
  return (
    <section id="laboratorio" className="secao" aria-labelledby="lab-titulo">
      <div className="container lab-in">
        <div className="secao-cab">
          <Rotulo>Laboratório</Rotulo>
          <Titulo id="lab-titulo">Estudamos IA em público</Titulo>
          <p className="lead">Tudo o que aprendemos construindo sistemas com inteligência artificial vira conteúdo aberto no Instagram.</p>
          <Botao href={contato.instagram} estilo="escuro" externo>Seguir {contato.instagramTexto}</Botao>
        </div>
        <div className="cartao lab-c">
          <h3 className="rotulo com-ponto">No perfil</h3>
          <ul>{TEMAS.map(t => <li key={t}>{t}</li>)}</ul>
          <a className="lab-arroba" href={contato.instagram} target="_blank" rel="noopener noreferrer" aria-hidden="true" tabIndex={-1}>{contato.instagramTexto}</a>
        </div>
      </div>
    </section>
  );
}
