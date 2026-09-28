import { contato, produtos } from "@/data/site";
import { Logo } from "@/components/ui/Logo";

// rodapé como ficha técnica da empresa
export function Rodape() {
  const ano = new Date().getFullYear();
  return (
    <footer className="ro">
      <div className="container ro-in">
        <div className="ro-marca">
          <Logo className="h-[44px] w-auto" titulo="IT.IA" />
          <p>IT.IA · fábrica de sistemas</p>
        </div>
        <dl className="ro-ficha">
          <div><dt className="rotulo">Empresa</dt><dd>IT.IA<br />CNPJ {contato.cnpj}</dd></div>
          <div><dt className="rotulo">Contato</dt><dd><a className="link" href={"mailto:" + contato.email}>{contato.email}</a><br /><a className="link" href={contato.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp {contato.whatsappTexto}</a></dd></div>
          <div><dt className="rotulo">Suporte e privacidade</dt><dd><a className="link" href={"mailto:" + contato.suporte}>{contato.suporte}</a><br /><a className="link" href={"mailto:" + contato.privacidade}>{contato.privacidade}</a></dd></div>
          <div><dt className="rotulo">Catálogo</dt><dd>{produtos.map(p => <span key={p.serie}><a className="link" href={p.link} target="_blank" rel="noopener noreferrer">{p.nome}</a><br /></span>)}</dd></div>
          <div><dt className="rotulo">Laboratório</dt><dd><a className="link" href={contato.instagram} target="_blank" rel="noopener noreferrer">{contato.instagramTexto}</a></dd></div>
        </dl>
        <p className="ro-base rotulo"><span>© {ano} IT.IA. Todos os direitos reservados.</span><span>Este site não usa cookies nem formulários.</span></p>
      </div>
    </footer>
  );
}
