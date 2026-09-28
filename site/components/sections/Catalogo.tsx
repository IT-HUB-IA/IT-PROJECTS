import { produtos, ciclodevDestaques } from "@/data/site";
import { Rotulo, Titulo } from "@/components/ui/Capa";
import { Revelar } from "@/components/ui/Revelar";
import { Botao } from "@/components/ui/Botao";

// o catálogo apresenta cada produto num container só; a apresentação completa fica no site do produto
export function Catalogo() {
  const p = produtos[0];
  return (
    <section id="catalogo" className="secao secao-branca" aria-labelledby="cat-titulo">
      <div className="container">
        <div className="secao-cab">
          <Rotulo>Catálogo</Rotulo>
          <Titulo id="cat-titulo">Sistemas que já saíram da linha</Titulo>
          <p className="lead">Produtos próprios da IT.IA, prontos para usar.</p>
        </div>
        <Revelar className="cartao cat-card">
          <div className="cat-card-cab">
            <span className="rotulo">{p.serie}</span>
            <span className="rotulo com-ponto cat-estado">{p.estado}</span>
          </div>
          <div className="cat-card-corpo">
            <div>
              <h3 className="titulo cat-nome">Ciclo<span className="vermelho">Dev</span><span className="titulo-ponto" aria-hidden="true" /></h3>
              <p className="cat-frase">{p.frase}</p>
              <Botao href={p.link!} estilo="escuro" externo>Conhecer o CicloDev</Botao>
            </div>
            <ul className="cat-destaques">
              {ciclodevDestaques.map(d => <li key={d}>{d}</li>)}
            </ul>
          </div>
        </Revelar>
        <p className="cat-nota">Próximos sistemas estão na linha de produção.</p>
      </div>
    </section>
  );
}
