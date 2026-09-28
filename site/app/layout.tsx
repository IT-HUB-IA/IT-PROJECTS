import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Movimento } from "@/components/ui/Movimento";

export const metadata: Metadata = {
  metadataBase: new URL("https://it-ia.tec.br"),
  title: "IT.IA · Fábrica de sistemas",
  description: "A IT.IA cria sistemas com método, inteligência artificial e registro de tudo. Sistemas sob medida, produtos próprios como o CicloDev e inteligência artificial aplicada.",
  openGraph: { title: "IT.IA · Fábrica de sistemas", description: "Sistemas em série. Conheça o catálogo da IT.IA.", images: ["/og.png"], locale: "pt_BR", type: "website" },
  icons: { icon: "/icone.svg", apple: "/apple-touch-icon.png" },
};
export const viewport: Viewport = { themeColor: "#F4F4F5" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <a href="#conteudo" className="pular">Pular para o conteúdo</a>
        <Movimento>{children}</Movimento>
      </body>
    </html>
  );
}
