import { devit } from "@/data/site";
import { Manchete, Revelar } from "@/components/ui/Revelar";

export function DevIT() {
  return (
    <section id="devit" className="dv" aria-labelledby="dv-titulo">
      <div className="faixa listras" aria-hidden="true" />
      <div className="container dv-in">
        <div className="dv-cab">
          <p className="rotulo"><span className="ponto-sm" aria-hidden="true" /> Dentro do CicloDev</p>
          <h2 id="dv-titulo" className="display dv-nome">DevIT<span className="ponto" aria-hidden="true" /></h2>
          <Manchete className="display dv-sub" linhas={["O P.O. que lê", "o seu código."]} />
          <p className="dv-lead">Um agente de inteligência artificial conectado ao código e ao banco de dados do seu projeto. Ele planeja como um Product Owner ultra especialista, revisa segurança, monta infraestrutura e desenha o sistema. Tudo dentro do CicloDev, e só onde você tem permissão.</p>
        </div>

        <Revelar className="dv-chat" atraso={0.1}>
          <div role="img" aria-label="Exemplo de conversa: a pessoa pergunta ao DevIT se há alguma tabela exposta no banco. O DevIT encontra uma tabela sem regra de acesso, explica o risco e pede confirmação antes de criar a regra.">
            <div className="dv-msg eu"><span className="rotulo">Você</span><p>Tem alguma tabela exposta no banco do Portal?</p></div>
            <div className="dv-msg ia">
              <span className="rotulo"><span className="ponto-sm" /> DevIT</span>
              <p>Achei 1. A tabela <code>pedidos_anexos</code> está sem regra de acesso: qualquer pessoa logada lê os anexos de todos os clientes.</p>
              <p>Proponho uma regra que libera só quem participa do pedido. Nada muda para o time.</p>
              <div className="dv-confirma"><span>Criar a regra de acesso?</span><b>Confirmar</b><i>Cancelar</i></div>
            </div>
          </div>
          <p className="rotulo dv-legenda">Exemplo ilustrativo</p>
        </Revelar>

        <ol className="dv-lista">
          {devit.map((d, i) => (
            <li key={d.cod}>
              <Revelar atraso={i * 0.04}>
                <span className="dv-cod">{d.cod}</span>
                <b>{d.nome}</b>
                <p>{d.texto}</p>
              </Revelar>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
