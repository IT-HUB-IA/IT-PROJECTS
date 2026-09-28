import { produtos, naLinha } from "@/data/site";

// faixa com os números de série correndo: a linha de produção em movimento
export function Serie() {
  const itens = [...produtos.map(p => `${p.serie} · ${p.nome} · ${p.estado}`), ...naLinha.map(n => `${n} · na linha`)];
  const volta = [...itens, ...itens, ...itens];
  return (
    <div className="serie" aria-hidden="true">
      <div className="serie-trilho">
        {[0, 1].map(k => (
          <div className="serie-grupo" key={k}>
            {volta.map((t, i) => <span key={i} className="rotulo"><span className="ponto-sm" /> {t}</span>)}
          </div>
        ))}
      </div>
    </div>
  );
}
