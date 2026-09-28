import { regras } from "@/data/site";
import { Rotulo, Titulo } from "@/components/ui/Capa";

// regras da casa em tabela, como as tabelas do Playbook do CicloDev
export function Regras() {
  return (
    <section id="regras" className="secao secao-branca" aria-labelledby="rg-titulo">
      <div className="container rg-in">
        <div className="secao-cab">
          <Rotulo>Regras da casa</Rotulo>
          <Titulo id="rg-titulo">Válidas para todos os nossos sistemas</Titulo>
        </div>
        <div className="tabela-rolo">
          <table className="tabela">
            <thead><tr><th scope="col">Regra</th><th scope="col">Na prática</th></tr></thead>
            <tbody>{regras.map(r => <tr key={r.nome}><th scope="row">{r.nome}</th><td>{r.texto}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
