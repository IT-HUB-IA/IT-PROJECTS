import type { ReactNode } from "react";

// a "capa" do CicloDev: faixa preta com grade de 64px e marcas de canto
export function Capa({ children, className = "", id, rotulo }: { children: ReactNode; className?: string; id?: string; rotulo?: string }) {
  return (
    <section id={id} className={"capa " + className} aria-label={rotulo}>
      <span className="capa-canto a" aria-hidden="true" />
      <span className="capa-canto b" aria-hidden="true" />
      <div className="container capa-in">{children}</div>
    </section>
  );
}

// rótulo técnico: mono, caixa alta, com o ponto vermelho
export function Rotulo({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={"rotulo com-ponto " + className}>{children}</p>;
}

// título com o ponto vermelho no fim, como os títulos das telas do CicloDev
export function Titulo({ children, as: Tag = "h2", className = "", id }: { children: ReactNode; as?: "h1" | "h2" | "h3"; className?: string; id?: string }) {
  return <Tag id={id} className={"titulo " + className}>{children}<span className="titulo-ponto" aria-hidden="true" /></Tag>;
}
