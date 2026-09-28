"use client";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

// entrada padrão da marca: sobe 12px, rápido, uma vez só. O conteúdo nunca fica invisível esperando a animação.
export function Revelar({ children, atraso = 0, className }: { children: ReactNode; atraso?: number; className?: string }) {
  return (
    <motion.div className={className} initial={{ y: 12 }} whileInView={{ y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1], delay: atraso }}>
      {children}
    </motion.div>
  );
}

// manchete que aparece com um corte horizontal (clip-path), linha por linha
export function Manchete({ linhas, className, as: Tag = "h2" }: { linhas: ReactNode[]; className?: string; as?: "h1" | "h2" }) {
  return (
    <Tag className={className}>
      {linhas.map((l, i) => (
        <motion.span key={i} className="block" initial={{ clipPath: "inset(0 0 100% 0)", y: 12 }} whileInView={{ clipPath: "inset(0 0 0% 0)", y: 0 }} viewport={{ once: true }} transition={{ duration: 0.55, ease: [0.2, 0.7, 0.2, 1], delay: i * 0.08 }}>
          {l}
        </motion.span>
      ))}
    </Tag>
  );
}
