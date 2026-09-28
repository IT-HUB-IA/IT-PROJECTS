"use client";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { metodo } from "@/data/site";
import { Manchete } from "@/components/ui/Revelar";

// o ponto vermelho percorre a linha do método conforme a rolagem
export function Metodo() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 60%"] });
  const pos = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  return (
    <section id="metodo" className="mt grade" aria-labelledby="mt-titulo">
      <div className="container">
        <p className="rotulo">A linha de produção</p>
        <Manchete className="display mt-titulo" linhas={["Sete etapas.", "Todo sistema passa", "por todas."]} />
        <span id="mt-titulo" className="sr-only">O método da IT.IA em sete etapas</span>
        <div className="mt-linha" ref={ref}>
          <div className="mt-trilho" aria-hidden="true"><motion.span className="mt-bola" style={{ ["--pos" as string]: pos }} /></div>
          <ol>
            {metodo.map(m => (
              <li key={m.n}>
                <span className="rotulo">{m.n}</span>
                <b className="display">{m.nome}</b>
                <p>{m.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
