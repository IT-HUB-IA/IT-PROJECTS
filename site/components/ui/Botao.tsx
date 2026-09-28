import type { ReactNode } from "react";

type Estilo = "cheio" | "vazio" | "preto";
export function Botao({ href, children, estilo = "cheio", externo = false }: { href: string; children: ReactNode; estilo?: Estilo; externo?: boolean }) {
  return (
    <a className={"btn btn-" + estilo} href={href} {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      <span className="ponto-sm" aria-hidden="true" />
      <span className="txt">{children}</span>
      {externo && <span className="sr-only"> (abre em outra aba)</span>}
    </a>
  );
}
