import type { ReactNode } from "react";

// claro e contorno ficam sobre as capas pretas; escuro fica sobre o papel
type Estilo = "claro" | "contorno" | "escuro" | "vazio";
export function Botao({ href, children, estilo = "escuro", externo = false }: { href: string; children: ReactNode; estilo?: Estilo; externo?: boolean }) {
  return (
    <a className={"btn btn-" + estilo} href={href} {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      <span className="ponto-sm" aria-hidden="true" />
      <span className="txt">{children}</span>
      {externo && <span className="sr-only"> (abre em outra aba)</span>}
    </a>
  );
}
