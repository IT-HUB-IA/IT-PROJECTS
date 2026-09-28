import type { Metadata } from "next";
import { Legal } from "@/components/layout/Legal";
import { termos } from "@/data/legal";

export const metadata: Metadata = { title: "Termos de Uso · IT.IA", description: "Termos de Uso do site da IT.IA." };

export default function Termos() {
  return <Legal rotulo="IT.IA · Termos" titulo="Termos de Uso" resumo={termos.resumo} secoes={termos.secoes} outra={{ href: "/privacidade", txt: "Política de Privacidade" }} />;
}
