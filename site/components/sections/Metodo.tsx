"use client";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { metodo } from "@/data/site";
import { Rotulo, Titulo } from "@/components/ui/Capa";

// o ponto vermelho percorre a linha do método conforme a rolagem
export function Metodo() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 60%"] });
  const pos = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  return (
    <section id="metodo" className="secao" aria-labelledby="mt-titulo">
      <div className="container">
        <div className="secao-cab">
          <Rotulo>Método</Rotulo>
          <Titulo id="mt-titulo">Todo sistema passa pelas mesmas etapas</Titulo>
          <p className="lead">O que aprendemos em cada sistema torna-se padrão no próximo. Qualidade não depende de sorte, e sim de método.</p>
        </div>
        <div className="cartao mt-painel" ref={ref}>
          <div className="mt-trilho" aria-hidden="true"><motion.span className="mt-bola" style={{ ["--pos" as string]: pos }} /></div>
          <ol className="mt-lista">
            {metodo.map(m => (
              <li key={m.n}>
                <span className="rotulo">{m.n}</span>
                <b>{m.nome}</b>
                <p>{m.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
