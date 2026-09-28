import { produtos, naLinha } from "@/data/site";
import { Revelar } from "@/components/ui/Revelar";

export function Catalogo() {
  return (
    <section id="catalogo" className="cat" aria-labelledby="cat-titulo">
      <div className="container">
        <div className="cat-cab">
          <p className="rotulo">Catálogo · edição 2026</p>
          <h2 id="cat-titulo" className="display cat-titulo">Cada sistema tem<br />número de série<span className="ponto" aria-hidden="true" /></h2>
          <p className="cat-apoio">Produtos próprios da IT.IA, prontos para usar. A lista cresce: quando um sistema sai da linha, ele ganha o próximo número.</p>
        </div>
        <ol className="cat-lista">
          {produtos.map(p => (
            <li key={p.serie}>
              <Revelar className="cat-item">
                <span className="cat-serie rotulo">{p.serie}</span>
                <span className="cat-nome display">{p.nome}</span>
                <span className="cat-frase">{p.frase}</span>
                <span className="cat-estado rotulo"><span className="ponto-sm" aria-hidden="true" /> {p.estado}</span>
                <a className="cat-link" href="#ciclodev">Ver o {p.nome}<span aria-hidden="true"> ↓</span></a>
              </Revelar>
            </li>
          ))}
          {naLinha.map(n => (
            <li key={n} className="cat-vazio">
              <span className="cat-serie rotulo">{n}</span>
              <span className="cat-nome display">Na linha de produção</span>
              <span className="cat-estado rotulo">em breve</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
