import { estrutura, ferramentas, produtos } from "@/data/site";
import { Manchete, Revelar } from "@/components/ui/Revelar";
import { Botao } from "@/components/ui/Botao";
import { Logo } from "@/components/ui/Logo";

const COLUNAS = [
  { nome: "Backlog", itens: [["Épico", "Portal do cliente"], ["História", "Login com Google"]] },
  { nome: "Fazendo", itens: [["Tarefa", "Tela de cadastro"], ["Bug", "Filtro por mês"]], wip: "2 de 3" },
  { nome: "Revisão", itens: [["Tarefa", "Regras de acesso"]] },
  { nome: "Feito", itens: [["História", "Painel do projeto"], ["Tarefa", "Registro de uso"]] },
];

export function CicloDev() {
  const p = produtos[0];
  return (
    <section id="ciclodev" className="cd" aria-labelledby="cd-titulo">
      <div className="container">
        <div className="cd-cab">
          <p className="rotulo"><span className="ponto-sm" aria-hidden="true" /> {p.serie} · {p.estado}</p>
          <h2 id="cd-titulo" className="display cd-nome">Ciclo<span className="cd-dev">Dev</span><span className="ponto" aria-hidden="true" /></h2>
          <p className="cd-lead">O sistema onde a IT.IA faz os próprios sistemas. Agora aberto para o seu time.</p>
        </div>

        {/* 1. estrutura moldada */}
        <div className="cd-bloco cd-estr">
          <div className="cd-estr-txt">
            <p className="rotulo">01 · Estrutura moldada</p>
            <Manchete className="display cd-h3" linhas={["Tem o formato", "do seu trabalho."]} />
            <p>Nada de lista solta de tarefas. O CicloDev organiza tudo numa árvore que você molda: cliente, projeto, produto, aplicação e frente. Cada nível herda o que precisa do nível de cima e mostra os números de tudo o que tem embaixo.</p>
            <p className="apagado">Uma pessoa sozinha ou um time inteiro: a mesma estrutura cresce junto.</p>
          </div>
          <Revelar className="cd-arvore" atraso={0.1}>
            <ol aria-label="Níveis da estrutura do CicloDev">
              {estrutura.map((e, i) => (
                <li key={e.nivel} style={{ marginLeft: `calc(${i} * var(--degrau))` }}>
                  <span className="rotulo">{String(i + 1).padStart(2, "0")}</span>
                  <b>{e.nivel}</b>
                  <span className="apagado">{e.exemplo}</span>
                </li>
              ))}
            </ol>
          </Revelar>
        </div>

        {/* 2. a tela: um board de exemplo desenhado em código */}
        <Revelar className="cd-tela">
          <div className="cd-tela-barra" aria-hidden="true"><Logo className="h-[12px] w-auto" titulo="" /><span className="rotulo">Portal do cliente › Web › Board</span></div>
          <div className="cd-board" role="img" aria-label="Exemplo do Board do CicloDev: quatro colunas, Backlog, Fazendo, Revisão e Feito, com épicos, histórias, tarefas e bugs.">
            {COLUNAS.map(c => (
              <div className="cd-col" key={c.nome}>
                <div className="cd-col-cab rotulo">{c.nome}{c.wip && <em>{c.wip}</em>}</div>
                {c.itens.map(([t, n]) => (
                  <div className={"cd-card" + (t === "Bug" ? " bug" : "")} key={n}><span className="rotulo">{t}</span><b>{n}</b></div>
                ))}
              </div>
            ))}
          </div>
          <p className="cd-legenda rotulo">Exemplo ilustrativo do Board. O mesmo trabalho também aparece como Painel, Lista, Tabela, Calendário e Linha do tempo.</p>
        </Revelar>

        {/* 3. ferramentas: índice técnico, não cards */}
        <div className="cd-bloco">
          <p className="rotulo">02 · Ferramentas</p>
          <Manchete className="display cd-h3" linhas={["Tudo o que um projeto", "de software precisa."]} />
          <ol className="cd-ferr">
            {ferramentas.map(f => (
              <li key={f.cod}>
                <span className="rotulo">{f.cod}</span>
                <div><b>{f.nome}</b><p>{f.texto}</p></div>
              </li>
            ))}
          </ol>
        </div>

        <div className="cd-cta">
          <Botao href={p.link!} externo>Conhecer o CicloDev</Botao>
          <span className="rotulo">ciclodev.it-ia.tec.br</span>
        </div>
      </div>
    </section>
  );
}
