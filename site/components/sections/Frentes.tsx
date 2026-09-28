import { frentes, contato } from "@/data/site";
import { Botao } from "@/components/ui/Botao";
import { Rotulo, Titulo } from "@/components/ui/Capa";
import { Revelar } from "@/components/ui/Revelar";

export function Frentes() {
  return (
    <section id="frentes" className="secao" aria-labelledby="fr-titulo">
      <div className="container">
        <div className="secao-cab">
          <Rotulo>O que fazemos</Rotulo>
          <Titulo id="fr-titulo">Uma linha de produção de software</Titulo>
          <p className="lead">Tudo o que sai da IT.IA passa pelo mesmo método. Muda o destino: a sua empresa, o nosso catálogo ou o conteúdo que publicamos.</p>
        </div>
        <div className="fr-grade">
          {frentes.map((f, i) => (
            <Revelar key={f.rot} atraso={i * 0.05} className={"cartao fr-c" + (i === 0 ? " fr-destaque" : "")}>
              <h3 className="rotulo com-ponto">{f.rot}</h3>
              <b className="fr-nome">{f.nome}</b>
              <p>{f.texto}</p>
              <ul>{f.itens.map(t => <li key={t}>{t}</li>)}</ul>
              {i === 0 && <div className="fr-cta"><Botao href={contato.whatsapp} estilo="claro" externo>Contar o que precisa</Botao></div>}
            </Revelar>
          ))}
        </div>
      </div>
    </section>
  );
}
