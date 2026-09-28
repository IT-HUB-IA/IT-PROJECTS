"use client";
import { motion } from "framer-motion";
import { Logo } from "@/components/ui/Logo";
import { Botao } from "@/components/ui/Botao";
import { contato, produtos, naLinha } from "@/data/site";

export function Abertura() {
  const emProducao = produtos.filter(p => p.estado === "em produção").length;
  return (
    <section id="inicio" className="ab grade" aria-labelledby="ab-titulo">
      <div className="container ab-in">
        <div className="ab-texto">
          <p className="rotulo ab-sup"><span className="ponto-sm" aria-hidden="true" /> IT.IA · Fábrica de sistemas</p>
          <h1 id="ab-titulo" className="display ab-titulo">
            {["Sistemas", "em série"].map((l, i) => (
              <motion.span key={l} className="block" initial={{ clipPath: "inset(0 0 100% 0)", y: 18 }} animate={{ clipPath: "inset(0 0 0% 0)", y: 0 }} transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1], delay: 0.1 + i * 0.1 }}>
                {l}{i === 1 && <span className="ab-ponto" aria-hidden="true" />}
              </motion.span>
            ))}
            <span className="sr-only">.</span>
          </h1>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.45 }}>
            <p className="ab-apoio">A IT.IA cria sistemas com método, inteligência artificial e registro de tudo. Alguns viram produtos nossos. Outros viram o sistema da sua empresa.</p>
            <div className="ab-ctas">
              <Botao href="#catalogo">Ver o catálogo</Botao>
              <Botao href={contato.whatsapp} estilo="vazio" externo>Falar com a IT.IA</Botao>
            </div>
          </motion.div>
        </div>

        <motion.div className="ab-peca" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1], delay: 0.2 }} aria-hidden="true">
          <div className="ab-listras listras listras-movendo" />
          <div className="ab-bloco"><Logo className="ab-logo" titulo="" /></div>
          <div className="ab-etq rotulo">Nº 001 em produção</div>
        </motion.div>
      </div>

      <dl className="container ab-contador">
        <div><dt className="rotulo">Em produção</dt><dd className="display">{String(emProducao).padStart(3, "0")}</dd></div>
        <div><dt className="rotulo">Na linha</dt><dd className="display apagado">{String(naLinha.length).padStart(3, "0")}</dd></div>
        <div><dt className="rotulo">Meta</dt><dd className="display apagado">1.000<span className="ponto-dd" aria-hidden="true" /></dd></div>
      </dl>
    </section>
  );
}
