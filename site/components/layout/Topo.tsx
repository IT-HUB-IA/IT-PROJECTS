"use client";
import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/Logo";

const LINKS = [
  { href: "#catalogo", txt: "Catálogo" },
  { href: "#ciclodev", txt: "CicloDev" },
  { href: "#devit", txt: "DevIT" },
  { href: "#metodo", txt: "Método" },
  { href: "#laboratorio", txt: "Laboratório" },
];

export function Topo() {
  const [aberto, setAberto] = useState(false);
  const [rolou, setRolou] = useState(false);
  useEffect(() => {
    const f = () => setRolou(window.scrollY > 24);
    f(); window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);
  useEffect(() => {
    if (!aberto) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [aberto]);

  return (
    <header className={"topo" + (rolou ? " rolou" : "")}>
      <div className="container topo-in">
        <a href="#inicio" className="topo-marca" aria-label="IT.IA, voltar ao início">
          <Logo className="h-[22px] w-auto" titulo="" />
          <span className="rotulo topo-nome">IT.IA</span>
        </a>
        <nav aria-label="Principal" className="topo-nav">
          {LINKS.map(l => <a key={l.href} href={l.href} className="link">{l.txt}</a>)}
        </nav>
        <a href="#catalogo" className="btn btn-cheio topo-cta"><span className="ponto-sm" aria-hidden="true" /><span className="txt">Ver o catálogo</span></a>
        <button type="button" className="topo-menu" aria-expanded={aberto} aria-controls="menu-celular" onClick={() => setAberto(a => !a)}>
          <span className="sr-only">{aberto ? "Fechar menu" : "Abrir menu"}</span>
          <span aria-hidden="true" className={"hamb" + (aberto ? " x" : "")}><i /><i /></span>
        </button>
      </div>
      <div id="menu-celular" className="menu-celular listras" hidden={!aberto}>
        <nav aria-label="Principal no celular" className="container">
          {LINKS.map((l, i) => (
            <a key={l.href} href={l.href} onClick={() => setAberto(false)}><span className="rotulo">0{i + 1}</span>{l.txt}</a>
          ))}
        </nav>
      </div>
    </header>
  );
}
