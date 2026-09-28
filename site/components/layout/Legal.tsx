import type { Secao } from "@/data/legal";
import { atualizadoEm } from "@/data/legal";
import { Topo } from "@/components/layout/Topo";
import { Rodape } from "@/components/layout/Rodape";

// página legal: capa preta com o título, resumo em destaque, índice e seções numeradas
export function Legal({ rotulo, titulo, resumo, secoes, outra }: { rotulo: string; titulo: string; resumo: string; secoes: Secao[]; outra: { href: string; txt: string } }) {
  return (
    <>
      <Topo />
      <main id="conteudo">
        <section className="capa lg-capa" aria-labelledby="lg-titulo">
          <span className="capa-canto a" aria-hidden="true" />
          <span className="capa-canto b" aria-hidden="true" />
          <div className="container">
            <p className="rotulo com-ponto claro">{rotulo}</p>
            <h1 id="lg-titulo" className="titulo lg-titulo">{titulo}<span className="titulo-ponto" aria-hidden="true" /></h1>
            <p className="rotulo claro lg-data">Última atualização: {atualizadoEm}</p>
          </div>
        </section>
        <div className="container lg-in">
          <nav className="lg-indice" aria-label="Nesta página">
            <p className="rotulo com-ponto">Nesta página</p>
            <ol>{secoes.map(s => <li key={s.id}><a className="link" href={"#" + s.id}>{s.titulo}</a></li>)}</ol>
            <a className="link lg-outra" href={outra.href}>{outra.txt} →</a>
          </nav>
          <article className="lg-texto">
            <div className="cartao lg-resumo"><p className="rotulo com-ponto">Resumo</p><p>{resumo}</p></div>
            {secoes.map((s, i) => (
              <section key={s.id} id={s.id} className="lg-secao">
                <h2><span className="rotulo">{String(i + 1).padStart(2, "0")}</span>{s.titulo}</h2>
                {s.blocos.map((b, k) =>
                  b.tipo === "p" ? <p key={k}>{b.texto}</p>
                  : b.tipo === "lista" ? <ul key={k}>{b.itens.map(t => <li key={t}>{t}</li>)}</ul>
                  : <div key={k} className="tabela-rolo"><table className="tabela"><thead><tr><th scope="col">{b.cab[0]}</th><th scope="col">{b.cab[1]}</th></tr></thead><tbody>{b.linhas.map(([a, c]) => <tr key={a}><th scope="row">{a}</th><td>{c}</td></tr>)}</tbody></table></div>
                )}
              </section>
            ))}
          </article>
        </div>
      </main>
      <Rodape />
    </>
  );
}
