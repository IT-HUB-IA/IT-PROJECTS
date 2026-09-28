import { contato } from "@/data/site";
import { Rotulo, Titulo } from "@/components/ui/Capa";
import { Botao } from "@/components/ui/Botao";

const TEMAS = ["Análise de novos modelos e ferramentas de IA", "Aplicações validadas em sistemas reais", "Como desenvolvemos nossos sistemas", "IA aplicada ao trabalho de cada área"];

export function Laboratorio() {
  return (
    <section id="laboratorio" className="secao" aria-labelledby="lab-titulo">
      <div className="container lab-in">
        <div className="secao-cab">
          <Rotulo>Laboratório</Rotulo>
          <Titulo id="lab-titulo">Inteligência artificial com critério</Titulo>
          <p className="lead">Todo avanço da inteligência artificial passa pelo nosso laboratório antes de chegar a um sistema. O que se comprova útil torna-se padrão nos projetos, e as análises são publicadas no Instagram.</p>
          <Botao href={contato.instagram} estilo="escuro" externo>Seguir {contato.instagramTexto}</Botao>
        </div>
        <div className="cartao lab-c">
          <h3 className="rotulo com-ponto">No Instagram</h3>
          <ul>{TEMAS.map(t => <li key={t}>{t}</li>)}</ul>
          <a className="lab-arroba" href={contato.instagram} target="_blank" rel="noopener noreferrer" aria-hidden="true" tabIndex={-1}>{contato.instagramTexto}</a>
        </div>
      </div>
    </section>
  );
}
