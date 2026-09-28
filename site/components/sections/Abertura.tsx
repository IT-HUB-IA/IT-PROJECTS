"use client";
import { motion } from "framer-motion";
import { Logo } from "@/components/ui/Logo";
import { Botao } from "@/components/ui/Botao";
import { contato } from "@/data/site";

export function Abertura() {
  return (
    <section id="inicio" className="capa ab" aria-labelledby="ab-titulo">
      <span className="capa-canto a" aria-hidden="true" />
      <span className="capa-canto b" aria-hidden="true" />
      <div className="container ab-in">
        <div className="ab-texto">
          <p className="rotulo com-ponto claro">IT.IA · Fábrica de sistemas</p>
          <motion.h1 id="ab-titulo" className="titulo ab-titulo" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.2, 0.7, 0.2, 1] }}>
            Sistemas<br />em série<span className="titulo-ponto" aria-hidden="true" />
          </motion.h1>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
            <p className="ab-apoio">A IT.IA cria sistemas com método, inteligência artificial e registro de tudo. Alguns viram produtos nossos. Outros viram o sistema da sua empresa.</p>
            <div className="ab-ctas">
              <Botao href={contato.whatsapp} estilo="claro" externo>Falar com a IT.IA</Botao>
              <Botao href="#catalogo" estilo="contorno">Ver o catálogo</Botao>
            </div>
          </motion.div>
        </div>
        <motion.div className="ab-peca" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.1 }} aria-hidden="true">
          <div className="ab-listras listras listras-movendo" />
          <div className="ab-bloco"><Logo className="ab-logo" titulo="" cor="#050506" ponto="#FFFFFF" /></div>
        </motion.div>
      </div>
    </section>
  );
}
