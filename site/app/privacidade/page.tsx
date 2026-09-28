import type { Metadata } from "next";
import { Legal } from "@/components/layout/Legal";
import { privacidade } from "@/data/legal";

export const metadata: Metadata = { title: "Política de Privacidade · IT.IA", description: "Política de Privacidade do site da IT.IA, conforme a LGPD." };

export default function Privacidade() {
  return <Legal rotulo="IT.IA · LGPD" titulo="Política de Privacidade" resumo={privacidade.resumo} secoes={privacidade.secoes} outra={{ href: "/termos", txt: "Termos de Uso" }} />;
}
