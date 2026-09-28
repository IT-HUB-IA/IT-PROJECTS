import { Topo } from "@/components/layout/Topo";
import { Rodape } from "@/components/layout/Rodape";
import { Abertura } from "@/components/sections/Abertura";
import { Serie } from "@/components/sections/Serie";
import { Manifesto } from "@/components/sections/Manifesto";
import { Catalogo } from "@/components/sections/Catalogo";
import { CicloDev } from "@/components/sections/CicloDev";
import { DevIT } from "@/components/sections/DevIT";
import { Metodo } from "@/components/sections/Metodo";
import { SobMedida } from "@/components/sections/SobMedida";
import { Laboratorio } from "@/components/sections/Laboratorio";
import { Fechamento } from "@/components/sections/Fechamento";

export default function Inicio() {
  return (
    <>
      <Topo />
      <main id="conteudo">
        <Abertura />
        <Serie />
        <Manifesto />
        <Catalogo />
        <CicloDev />
        <DevIT />
        <Metodo />
        <SobMedida />
        <Laboratorio />
        <Fechamento />
      </main>
      <Rodape />
    </>
  );
}
