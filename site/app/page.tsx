import { Topo } from "@/components/layout/Topo";
import { Rodape } from "@/components/layout/Rodape";
import { Abertura } from "@/components/sections/Abertura";
import { Frentes } from "@/components/sections/Frentes";
import { Catalogo } from "@/components/sections/Catalogo";
import { Metodo } from "@/components/sections/Metodo";
import { Regras } from "@/components/sections/Regras";
import { Laboratorio } from "@/components/sections/Laboratorio";
import { SobMedida } from "@/components/sections/SobMedida";

export default function Inicio() {
  return (
    <>
      <Topo />
      <main id="conteudo">
        <Abertura />
        <Frentes />
        <Catalogo />
        <Metodo />
        <Regras />
        <Laboratorio />
        <SobMedida />
      </main>
      <Rodape />
    </>
  );
}
