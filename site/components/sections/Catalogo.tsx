import { produtos, ciclodevFicha } from "@/data/site";
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
          <Titulo id="cat-titulo">Sistemas prontos para usar</Titulo>
          <p className="lead">Produtos próprios da IT.IA, desenvolvidos com o mesmo método aplicado aos projetos dos nossos clientes.</p>
        </div>
        <Revelar className="cartao cat-card">
          <div className="cat-card-cab">
            <span className="rotulo">{p.serie} · Gestão do desenvolvimento de software</span>
            <span className="rotulo com-ponto cat-estado">{p.estado}</span>
          </div>
          <div className="cat-card-corpo">
            <div className="cat-info">
              <h3 className="titulo cat-nome">Ciclo<span className="vermelho">Dev</span><span className="titulo-ponto" aria-hidden="true" /></h3>
              <p className="cat-frase">{p.frase}</p>
              <div className="cat-acoes">
                <Botao href={p.link!} estilo="escuro" externo>Conhecer o CicloDev</Botao>
                <span className="rotulo cat-url">ciclodev.it-ia.tec.br</span>
              </div>
            </div>
            <dl className="cat-ficha">
              {ciclodevFicha.map(f => (
                <div key={f.rot} className={f.destaque ? "cat-ficha-ia" : undefined}>
                  <dt className="rotulo com-ponto">{f.rot}</dt>
                  <dd>{f.texto}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Revelar>
        <p className="cat-nota">Novos sistemas em desenvolvimento.</p>
      </div>
    </section>
  );
}
