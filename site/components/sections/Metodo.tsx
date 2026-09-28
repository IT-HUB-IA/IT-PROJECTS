"use client";
import { useEffect, useRef, useState } from "react";
import { metodo, fasesMetodo } from "@/data/site";
import { Rotulo, Titulo } from "@/components/ui/Capa";

// O painel fica fixo na tela enquanto a página rola: a linha vermelha enche, as etapas
// acendem uma a uma e o detalhe da etapa ativa troca com transição. No celular vira uma
// lista vertical cuja linha enche com a rolagem. O progresso vai numa variável CSS (--p),
// sem redesenhar o React a cada quadro; o React só muda quando a etapa ativa muda.
const N = metodo.length;
const faseDe = (i: number) => fasesMetodo.find(f => i >= f.de && i <= f.ate)!;

export function Metodo() {
  const trilho = useRef<HTMLDivElement>(null);
  const [ativo, setAtivo] = useState(0);

  useEffect(() => {
    const el = trilho.current; if (!el) return;
    let quadro = 0;
    const medir = () => {
      quadro = 0;
      const r = el.getBoundingClientRect(), vh = window.innerHeight, celular = window.matchMedia("(max-width: 860px)").matches;
      const p = celular ? (vh * 0.6 - r.top) / r.height : (64 - r.top) / Math.max(1, r.height - (vh - 64));
      const v = Math.max(0, Math.min(1, p));
      el.style.setProperty("--p", String(v));
      const i = Math.min(N - 1, Math.floor(v * N));
      setAtivo(a => (a === i ? a : i));
    };
    const pedir = () => { if (!quadro) quadro = requestAnimationFrame(medir); };
    medir();
    window.addEventListener("scroll", pedir, { passive: true });
    window.addEventListener("resize", pedir);
    return () => { window.removeEventListener("scroll", pedir); window.removeEventListener("resize", pedir); cancelAnimationFrame(quadro); };
  }, []);

  // clicar numa etapa leva a rolagem até ela
  const ir = (i: number) => {
    const el = trilho.current; if (!el) return;
    const topo = el.getBoundingClientRect().top + window.scrollY;
    const celular = window.matchMedia("(max-width: 860px)").matches;
    const alvo = celular ? topo + el.offsetHeight * ((i + 0.5) / N) - window.innerHeight * 0.6 : topo - 64 + (el.offsetHeight - (window.innerHeight - 64)) * ((i + 0.5) / N);
    window.scrollTo({ top: alvo, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  return (
    <section id="metodo" className="secao mt" aria-labelledby="mt-titulo">
      <div className="mt-trilho" ref={trilho} style={{ ["--n" as string]: N }} data-ativo={ativo}>
        <div className="mt-fixo">
          <div className="container">
            <div className="secao-cab mt-cab">
              <Rotulo>Método</Rotulo>
              <Titulo id="mt-titulo">Todo sistema passa pelas mesmas etapas</Titulo>
              <p className="lead">Do escopo à entrega, cada etapa tem um resultado definido. O que aprendemos em cada sistema torna-se padrão no próximo.</p>
            </div>
            <div className="cartao mt-painel">
              <div className="mt-grupos" aria-hidden="true">
                {fasesMetodo.map(f => (
                  <span key={f.nome} className={"rotulo" + (ativo >= f.de && ativo <= f.ate ? " on" : ativo > f.ate ? " feito" : "")} style={{ gridColumn: `${f.de + 1} / ${f.ate + 2}` }}>{f.nome}</span>
                ))}
              </div>
              <div className="mt-linha" aria-hidden="true"><span className="mt-enche" /></div>
              <ol className="mt-fases">
                {metodo.map((m, i) => (
                  <li key={m.n} className={i < ativo ? "feita" : i === ativo ? "ativa" : undefined}>
                    <button type="button" onClick={() => ir(i)} aria-current={i === ativo ? "step" : undefined}>
                      <span className="mt-marca" aria-hidden="true" />
                      <span className="rotulo">{m.n}</span>
                      <b>{"curto" in m && m.curto ? m.curto : m.nome}</b>
                      <span className="mt-fase-txt">{m.texto}<em><span className="rotulo">Resultado</span>{m.resultado}</em></span>
                    </button>
                  </li>
                ))}
              </ol>
              <div className="mt-detalhe" aria-live="polite">
                {metodo.map((m, i) => (
                  <div key={m.n} className={"mt-det" + (i === ativo ? " on" : i < ativo ? " antes" : "")} aria-hidden={i !== ativo}>
                    <span className="mt-num">{m.n}</span>
                    <div className="mt-det-txt">
                      <p className="rotulo com-ponto">{faseDe(i).nome}</p>
                      <h3>{m.nome}</h3>
                      <p>{m.texto}</p>
                    </div>
                    <p className="mt-res"><span className="rotulo">Resultado</span><b>{m.resultado}</b></p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
