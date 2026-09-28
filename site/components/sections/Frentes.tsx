import { frentes, sobMedida, contato } from "@/data/site";
import { Rotulo, Titulo } from "@/components/ui/Capa";
import { Revelar } from "@/components/ui/Revelar";
import { Botao } from "@/components/ui/Botao";

export function Frentes() {
  const s = sobMedida;
  return (
    <section id="frentes" className="secao" aria-labelledby="fr-titulo">
      <div className="container">
        <div className="secao-cab">
          <Rotulo>O que fazemos</Rotulo>
          <Titulo id="fr-titulo">Uma linha de produção de software</Titulo>
          <p className="lead">Tudo o que a IT.IA desenvolve segue o mesmo método. O que muda é o destino: a sua empresa, o nosso catálogo ou o conteúdo que publicamos.</p>
        </div>
        <div className="fr-grade">
          {/* a peça principal: o antes e depois que o cliente reconhece */}
          <Revelar className="cartao fr-c fr-destaque">
            <div className="fr-dest-txt">
              <h3 className="rotulo com-ponto">{s.rot}</h3>
              <b className="fr-nome">{s.nome}</b>
              <p>{s.texto}</p>
              <ul className="fr-formatos" aria-label="O que entregamos">{s.formatos.map(f => <li key={f}>{f}</li>)}</ul>
              <div className="fr-cta"><Botao href={contato.whatsapp} estilo="claro" externo>Quero conversar sobre o meu sistema</Botao></div>
            </div>
            <div className="fr-compara">
              <div>
                <p className="rotulo">Hoje</p>
                <ul>{s.hoje.map(t => <li key={t}>{t}</li>)}</ul>
              </div>
              <div className="fr-depois">
                <p className="rotulo com-ponto">Com o sistema</p>
                <ul>{s.depois.map(t => <li key={t}>{t}</li>)}</ul>
              </div>
            </div>
          </Revelar>
          {frentes.map((f, i) => (
            <Revelar key={f.rot} atraso={(i + 1) * 0.05} className="cartao fr-c">
              <h3 className="rotulo com-ponto">{f.rot}</h3>
              <b className="fr-nome">{f.nome}</b>
              <p>{f.texto}</p>
              <ul>{f.itens.map(t => <li key={t}>{t}</li>)}</ul>
              {f.link && <a className="fr-link" href={f.link.href} {...(f.link.externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{f.link.txt}<span aria-hidden="true"> →</span>{f.link.externo && <span className="sr-only"> (abre em outra aba)</span>}</a>}
            </Revelar>
          ))}
        </div>
      </div>
    </section>
  );
}
