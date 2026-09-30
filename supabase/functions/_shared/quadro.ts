// Monta um desenho no quadro (o canvas escuro do CicloDev, fonte/canvas_infra.html), seguindo o padrão de cada tipo de desenho:
//   cards de sistema, pessoa, módulo, banco e serviço (C4, infraestrutura, software), tabela e classe (DER e UML, com PK, FK,
//   tipos e multiplicidade), passos de processo (início, tarefa, decisão, fim, raias), diagrama de sequência (participantes,
//   mensagens numeradas, retornos, ativações e blocos alt/opt/loop/par) e ligações com rótulo e pontas de cardinalidade.
// Quem desenha (o robô ou o DevIT) só diz O QUE existe (o modelo); aqui se calcula ONDE cada coisa fica, sempre igual para
// o mesmo modelo e sem nada se sobrepor. O documento sai no formato que o canvas grava (quadros/<id>: nome, pai, nodes, edges).

export type TipoCard = 'modulo' | 'empresa' | 'departamento' | 'banco' | 'servico' | 'cartao' | 'tabela' | 'fluxo' | 'sequencia';
export type Linha = { nome: string; tipo?: string; chave?: '' | 'pk' | 'fk' | 'pkfk' | 'uq'; nulo?: boolean; vis?: string };
export type Participante = { id: string; nome: string; tipo: 'ator' | 'tela' | 'servico' | 'banco' | 'externo' | 'fila' };
export type Passo = { de: string; para: string; texto: string; tipo?: 'chamada' | 'retorno' | 'assincrona' };
export type Bloco = { tipo: 'alt' | 'opt' | 'loop' | 'par'; rotulo?: string; de: number; ate: number; senao?: { em: number; rotulo?: string }[] };
export type CardQ = {
  id: string; grupo?: string; tipo: TipoCard; titulo: string; subtitulo?: string; etiquetas?: string[]; topicos?: string[]; cor?: string; nota?: string;
  estado?: 'ativo' | 'inativo'; icone?: string; rotuloTipo?: string;
  linhas?: Linha[]; operacoes?: Linha[]; estilo?: 'der' | 'classe'; abstrata?: boolean;           // tabela e classe
  forma?: 'tarefa' | 'decisao' | 'inicio' | 'fim' | 'evento' | 'dados' | 'documento' | 'subprocesso'; // passo de processo
  participantes?: Participante[]; passos?: Passo[]; blocos?: Bloco[];                               // sequência
};
export type GrupoQ = { id: string; titulo: string; cor?: string };
export type Ponta = '' | 'nenhum' | 'seta' | 'aberta' | 'um' | 'umum' | 'zeroum' | 'muitos' | 'ummuitos' | 'zeromuitos' | 'triangulo' | 'losango' | 'losangoc';
export type LigQ = { de: string; para: string; rotulo?: string; tracejada?: boolean; cor?: string; inicio?: Ponta; fim?: Ponta; rotuloInicio?: string; rotuloFim?: string;
  deLinha?: string; paraLinha?: string };   // nome da coluna (ou atributo) de onde a linha sai e onde chega
export type Modelo = { titulo: string; resumo?: string; legenda?: string[]; layout?: 'grade' | 'camadas' | 'raias'; grupos: GrupoQ[]; cards: CardQ[]; ligacoes: LigQ[] };
export type NoCanvas = Record<string, any> & { id: string; tipo: string; x: number; y: number; w: number; h?: number };
export type DocQuadro = { nome: string; pai: string | null; nodes: NoCanvas[]; edges: Record<string, any>[]; atualizadoEm?: number };

export const CORES_CANVAS = ['azul', 'ouro', 'roxo', 'verde', 'ciano', 'laranja', 'rosa', 'amarelo', 'vermelho', 'cinza'];
const COR_TIPO: Record<TipoCard, string> = { modulo: 'ouro', empresa: 'azul', departamento: 'laranja', banco: 'ciano', servico: 'roxo', cartao: 'cinza', tabela: 'ciano', fluxo: 'verde', sequencia: 'roxo' };
const LARG: Record<TipoCard, number> = { modulo: 260, empresa: 280, departamento: 250, banco: 270, servico: 260, cartao: 300, tabela: 290, fluxo: 200, sequencia: 820 };
export const FORMAS: Record<string, { w: number; h: number }> = { tarefa: { w: 200, h: 80 }, decisao: { w: 150, h: 150 }, inicio: { w: 64, h: 64 }, fim: { w: 64, h: 64 }, evento: { w: 64, h: 64 }, dados: { w: 200, h: 80 }, documento: { w: 200, h: 86 }, subprocesso: { w: 200, h: 86 } };
const MAX_TOPICOS = 24, MAX_LINHAS = 60, GRADE = 20;
const G = { pad: 30, topo: 50, fundo: 30, gapX: 80, gapY: 50, entreGrupos: 100, larguraMax: 3800, colunaCamada: 110 };

// id curto e estável a partir de um texto (o mesmo card tem sempre o mesmo id, e o canvas guarda a posição que a pessoa mexeu)
export function hashCurto(s: string): string {
  let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  let h2 = 0x9e3779b9; for (let i = s.length - 1; i >= 0; i--) { h2 ^= s.charCodeAt(i); h2 = Math.imul(h2, 0x85ebca6b) >>> 0; }
  return h.toString(36) + h2.toString(36);
}
const arred = (v: number) => Math.ceil(v / GRADE) * GRADE;
const linhas = (txt: string, largura: number, px: number) => Math.max(1, Math.ceil((String(txt).length * px) / Math.max(60, largura)));
const idNo = (c: string) => 'n' + hashCurto('card:' + c);
const idLinha = (card: string, nome: string, op = false) => 'l' + hashCurto(card + (op ? '|op|' : '|') + nome);

// as mesmas medidas do diagrama de sequência que o canvas desenha (seqMedidas no canvas_infra.html)
export function medidasSequencia(c: CardQ): { w: number; h: number } {
  const ps = c.participantes || [], st = c.passos || [], bl = c.blocos || [];
  const colW = Math.max(180, ...ps.map(p => String(p.nome || '').length * 7.4 + 56),
    ...st.filter(x => x.de !== x.para).map(x => Math.min(420, String(x.texto || '').length * 6.9 + 40) / Math.max(1, Math.abs(ps.findIndex(p => p.id === x.para) - ps.findIndex(p => p.id === x.de)))));
  let y = 98;
  st.forEach((x, i) => { y += bl.filter(b => b.de === i).length * 30; y += bl.filter(b => (b.senao || []).some(z => z.em === i)).length * 24; y += x.de === x.para ? 56 : 44; y += bl.filter(b => b.ate === i).length * 16; });
  return { w: Math.round(40 + colW * Math.max(1, ps.length)), h: Math.round(y + 76 + 44) };
}
// a tabela fica larga o bastante para o maior nome de coluna e o maior tipo (sem cortar), entre 260 e 560
export function larguraTabela(c: CardQ): number {
  const ls = (c.linhas || []).concat(c.operacoes || []);
  const nome = Math.max(0, ...ls.map(l => ((l.vis ? l.vis + ' ' : '') + l.nome).length)), tipo = Math.max(0, ...ls.map(l => (l.tipo || '').length + (l.nulo ? 1 : 0)));
  const cab = Math.max(String(c.titulo || '').length * 8.8 + (c.etiquetas || []).reduce((t, e) => t + e.length * 7 + 22, 0), String(c.subtitulo || '').length * 6.6) + 96;
  return Math.min(560, Math.max(260, arred(Math.max(cab, 40 + 8 + nome * 7.6 + 16 + Math.min(tipo, 32) * 7.2 + 26))));
}
// tamanho que o card vai ter no canvas (as mesmas medidas do CSS dele), com folga para não encostar
export function tamanhoCard(c: CardQ): { w: number; h: number } {
  if (c.tipo === 'fluxo') return FORMAS[c.forma || 'tarefa'] || FORMAS.tarefa;
  if (c.tipo === 'sequencia') return medidasSequencia(c);
  const w = c.tipo === 'tabela' ? larguraTabela(c) : LARG[c.tipo];
  if (c.tipo === 'tabela') {
    const n = Math.min(MAX_LINHAS + 1, (c.linhas || []).length), ops = c.estilo === 'classe' ? (c.operacoes || []).length : 0;
    return { w, h: 4 + 44 + 24 * n + (ops ? 2 + 24 * ops : 0) };
  }
  if (c.tipo === 'cartao') return { w, h: Math.max(140, arred(34 + linhas(c.titulo + (c.subtitulo ? '\n' + c.subtitulo : ''), w - 30, 7.2) * 19 + (c.topicos || []).length * 19)) };
  let h = 4 + 23 + 18 + 7 + linhas(c.titulo, w - 50, c.tipo === 'empresa' ? 9.2 : 8.2) * (c.tipo === 'empresa' ? 22 : 20);
  if (c.subtitulo) h += 2 + linhas(c.subtitulo, w - 50, 6.4) * 17;
  const tops = (c.topicos || []).slice(0, MAX_TOPICOS + 1);
  if (tops.length) h += 20 + tops.reduce((s, t) => s + linhas(t, w - 80, 7.1) * 18.5 + 3, 0);
  return { w, h: arred(h + 12) };
}

function noDoCard(c: CardQ, x: number, y: number): NoCanvas {
  const id = idNo(c.id), t = tamanhoCard(c);
  if (c.tipo === 'cartao') return { id, tipo: 'cartao', x, y, w: t.w, h: t.h, cor: c.cor || 'cinza', texto: [c.titulo, c.subtitulo || '', ...(c.topicos || []).map(s => '• ' + s)].filter(Boolean).join('\n'), nota: c.nota || '' };
  if (c.tipo === 'fluxo') return { id, tipo: 'fluxo', x, y, w: t.w, h: t.h, cor: c.cor || 'verde', forma: c.forma || 'tarefa', titulo: c.titulo, subtitulo: c.subtitulo || '', nota: c.nota || '' };
  if (c.tipo === 'sequencia') return { id, tipo: 'sequencia', x, y, w: t.w, h: t.h, cor: c.cor || 'roxo', titulo: c.titulo, nota: c.nota || '',
    participantes: (c.participantes || []).map(p => ({ id: 'p' + hashCurto(c.id + '|' + p.id), nome: p.nome, tipo: p.tipo })),
    passos: (c.passos || []).map((s, i) => ({ id: 's' + hashCurto(c.id + '|' + i), de: 'p' + hashCurto(c.id + '|' + s.de), para: 'p' + hashCurto(c.id + '|' + s.para), texto: s.texto, tipo: s.tipo || 'chamada' })),
    blocos: (c.blocos || []).map(b => ({ tipo: b.tipo, rotulo: b.rotulo || '', de: b.de, ate: b.ate, senao: b.senao || [] })) };
  if (c.tipo === 'tabela') {
    const ls = c.linhas || [], lista = ls.length > MAX_LINHAS ? ls.slice(0, MAX_LINHAS).concat({ nome: '… e mais ' + (ls.length - MAX_LINHAS), tipo: '' }) : ls;
    return { id, tipo: 'tabela', x, y, w: t.w, cor: c.cor || 'ciano', estilo: c.estilo || 'der', titulo: c.titulo, subtitulo: c.subtitulo || '', etiquetas: (c.etiquetas || []).slice(0, 3), abstrata: !!c.abstrata, nota: c.nota || '',
      linhas: lista.map(l => ({ id: idLinha(c.id, l.nome), nome: l.nome, tipo: l.tipo || '', chave: l.chave || '', nulo: !!l.nulo, vis: l.vis || '' })),
      operacoes: (c.operacoes || []).map(l => ({ id: idLinha(c.id, l.nome, true), nome: l.nome, tipo: l.tipo || '', chave: '', nulo: false, vis: l.vis || '' })) };
  }
  const tops = c.topicos || [];
  const lista = tops.length > MAX_TOPICOS ? tops.slice(0, MAX_TOPICOS).concat('… e mais ' + (tops.length - MAX_TOPICOS)) : tops;
  const n: NoCanvas = { id, tipo: c.tipo, x, y, w: t.w, cor: c.cor || COR_TIPO[c.tipo], titulo: c.titulo, subtitulo: c.subtitulo || '', etiquetas: (c.etiquetas || []).slice(0, 4),
    topicos: lista.map((s, i) => ({ id: 't' + hashCurto(c.id + '|' + i + '|' + s), texto: s, nota: '' })), nota: c.nota || '' };
  if (c.estado) n.estado = c.estado;
  if (c.icone) n.icone = c.icone;
  if (c.rotuloTipo) n.rotuloTipo = c.rotuloTipo;
  return n;
}

/* ---------- camadas: a ordem das ligações vira colunas (esquerda para a direita) ---------- */
function camadas(ids: string[], ligs: LigQ[]): Map<string, number> {
  const dentro = new Set(ids), saem = new Map<string, string[]>(ids.map(i => [i, []]));
  for (const l of ligs) if (dentro.has(l.de) && dentro.has(l.para) && l.de !== l.para) saem.get(l.de)!.push(l.para);
  // tira os ciclos (a volta de um laço não empurra a coluna) com uma busca em profundidade na ordem do modelo
  const estado = new Map<string, number>(), ok = new Map<string, string[]>(ids.map(i => [i, []]));
  const visitar = (v: string) => { estado.set(v, 1); for (const w of saem.get(v)!) { if (estado.get(w) === 1) continue; ok.get(v)!.push(w); if (!estado.get(w)) visitar(w); } estado.set(v, 2); };
  ids.forEach(v => { if (!estado.get(v)) visitar(v); });
  const nivel = new Map<string, number>(ids.map(i => [i, 0]));
  const ordem: string[] = []; const vis = new Set<string>();
  const topo = (v: string) => { vis.add(v); for (const w of ok.get(v)!) if (!vis.has(w)) topo(w); ordem.unshift(v); };
  ids.forEach(v => { if (!vis.has(v)) topo(v); });
  for (const v of ordem) for (const w of ok.get(v)!) nivel.set(w, Math.max(nivel.get(w)!, nivel.get(v)! + 1));
  return nivel;
}

type Pos = { x: number; y: number; w: number; h: number };
type Caixa = { grupo: GrupoQ | null; cards: CardQ[]; w: number; h: number; pos: Map<string, Pos> };
function arrumarGrade(grupo: GrupoQ | null, cards: CardQ[]): Caixa {
  const n = cards.length, tam = new Map(cards.map(c => [c.id, tamanhoCard(c)]));
  const larg = Math.max(...cards.map(c => tam.get(c.id)!.w));
  const colunas = larg > 600 ? 1 : n <= 3 ? n : Math.min(n > 40 ? 12 : n > 20 ? 7 : 5, Math.ceil(Math.sqrt(n * 1.6)));
  const pos = new Map<string, Pos>();
  let y = grupo ? G.topo : 0, maxX = 0;
  for (let i = 0; i < n; i += colunas) {
    const linha = cards.slice(i, i + colunas), hs = linha.map(c => tam.get(c.id)!.h);
    linha.forEach((c, j) => { const t = tam.get(c.id)!, x = (grupo ? G.pad : 0) + j * (larg + G.gapX) + (larg - t.w) / 2; pos.set(c.id, { x, y, w: t.w, h: t.h }); maxX = Math.max(maxX, x + t.w); });
    y += Math.max(...hs) + G.gapY;
  }
  return { grupo, cards, pos, w: arred(maxX + (grupo ? G.pad : 0)), h: arred(y - G.gapY + (grupo ? G.fundo : 0)) };
}
function arrumarCamadas(grupo: GrupoQ | null, cards: CardQ[], ligs: LigQ[]): Caixa {
  const nivel = camadas(cards.map(c => c.id), ligs), tam = new Map(cards.map(c => [c.id, tamanhoCard(c)]));
  const maxN = Math.max(0, ...nivel.values()), cols: CardQ[][] = Array.from({ length: maxN + 1 }, () => []);
  cards.forEach(c => cols[nivel.get(c.id)!].push(c));
  // dentro da coluna, cada um perto de quem aponta para ele (menos cruzamento)
  const ordemY = new Map<string, number>();
  cols.forEach((col, k) => {
    if (k) col.sort((a, b) => { const m = (c: CardQ) => { const pais = ligs.filter(l => l.para === c.id && ordemY.has(l.de)).map(l => ordemY.get(l.de)!); return pais.length ? pais.reduce((s, v) => s + v, 0) / pais.length : 1e9; }; return m(a) - m(b); });
    col.forEach((c, i) => ordemY.set(c.id, i));
  });
  const larguraCol = cols.map(col => Math.max(0, ...col.map(c => tam.get(c.id)!.w)));
  const altCol = cols.map(col => col.reduce((s, c) => s + tam.get(c.id)!.h, 0) + Math.max(0, col.length - 1) * G.gapY);
  const altura = Math.max(...altCol), pos = new Map<string, Pos>();
  let x = grupo ? G.pad : 0;
  cols.forEach((col, k) => {
    let y = (grupo ? G.topo : 0) + (altura - altCol[k]) / 2;
    col.forEach(c => { const t = tam.get(c.id)!; pos.set(c.id, { x: x + (larguraCol[k] - t.w) / 2, y: arred(y), w: t.w, h: t.h }); y += t.h + G.gapY; });
    x += larguraCol[k] + G.colunaCamada;
  });
  return { grupo, cards, pos, w: arred(x - G.colunaCamada + (grupo ? G.pad : 0)), h: arred(altura + (grupo ? G.topo + G.fundo : 0) + GRADE) };
}

// o lado da ligação: sai pela direita e entra pela esquerda quando o outro está ao lado; senão, por baixo ou por cima.
// Linha que sai de uma coluna de tabela só pode sair pelos lados (esquerda ou direita).
function lados(a: Pos, b: Pos, soLados: boolean): [string, string] {
  if (b.x >= a.x + a.w) return ['r', 'l'];
  if (b.x + b.w <= a.x) return ['l', 'r'];
  if (soLados) return ['r', 'r'];
  return b.y + b.h / 2 >= a.y + a.h / 2 ? ['b', 't'] : ['t', 'b'];
}

export function montarQuadro(m: Modelo, extra: { nome?: string; pai?: string | null; aviso?: string } = {}): DocQuadro {
  const grupos = m.grupos.filter(g => m.cards.some(c => c.grupo === g.id));
  const corDoGrupo = new Map(grupos.map((g, i) => [g.id, g.cor || CORES_CANVAS[i % CORES_CANVAS.length]]));
  const nodes: NoCanvas[] = [], edges: Record<string, any>[] = [], onde = new Map<string, Pos>();
  // título, resumo e legenda em cima
  
  const resumo = [m.resumo, extra.aviso].filter(Boolean).join('\n');
  const legenda = m.legenda && m.legenda.length ? 'Legenda\n' + m.legenda.map(l => '• ' + l).join('\n') : '';
  const altTexto = (t: string, w: number) => arred(34 + t.split('\n').reduce((s, l) => s + linhas(l, w - 30, 7.2), 0) * 19);
  const hCab = Math.max(resumo ? altTexto(resumo, 1100) : 0, legenda ? altTexto(legenda, 560) : 0, 100);
  if (resumo) nodes.push({ id: 'n' + hashCurto('resumo'), tipo: 'cartao', x: 0, y: -hCab - 40, w: 1100, h: hCab, cor: 'ouro', texto: resumo, nota: '' });
  if (legenda) nodes.push({ id: 'n' + hashCurto('legenda'), tipo: 'cartao', x: resumo ? 1140 : 0, y: -hCab - 40, w: 560, h: hCab, cor: 'cinza', texto: legenda, nota: '' });
  nodes.unshift({ id: 'n' + hashCurto('titulo'), tipo: 'texto', x: 0, y: -hCab - 100, w: 1600, cor: 'cinza', texto: m.titulo, fonte: 'g', negrito: true });
  const colocar = (c: CardQ, p: Pos) => { onde.set(c.id, p); const n = noDoCard(c, Math.round(p.x), Math.round(p.y)); nodes.push(n); };
  if (m.layout === 'raias') {
    // processo: cada grupo é uma raia (quem faz), as colunas seguem a ordem dos passos em todas as raias juntas
    const nivel = camadas(m.cards.map(c => c.id), m.ligacoes), tam = new Map(m.cards.map(c => [c.id, tamanhoCard(c)]));
    const maxN = Math.max(0, ...nivel.values()), colW = Math.max(...m.cards.map(c => tam.get(c.id)!.w)) + G.colunaCamada;
    const raias = grupos.length ? grupos : [{ id: '_', titulo: 'Processo' }];
    const largura = arred(G.pad * 2 + 90 + (maxN + 1) * colW - G.colunaCamada);
    let y = 0;
    raias.forEach((r, i) => {
      const dela = m.cards.filter(c => (c.grupo || '_') === r.id || (!grupos.length));
      const porCol = new Map<number, CardQ[]>(); dela.forEach(c => { const k = nivel.get(c.id)!; (porCol.get(k) || porCol.set(k, []).get(k)!).push(c); });
      const alt = Math.max(160, ...[...porCol.values()].map(l => l.reduce((s, c) => s + tam.get(c.id)!.h + 70, 0)));
      nodes.push({ id: 'n' + hashCurto('grupo:' + r.id), tipo: 'grupo', x: 0, y, w: largura, h: arred(alt + G.topo), cor: corDoGrupo.get(r.id) || CORES_CANVAS[i % CORES_CANVAS.length], titulo: r.titulo, nota: '' });
      for (const [k, l] of porCol) { let yy = y + G.topo + (alt - l.reduce((s, c) => s + tam.get(c.id)!.h + 70, 0)) / 2 + 20; l.forEach(c => { const t = tam.get(c.id)!; colocar(c, { x: G.pad + 90 + k * colW + (colW - G.colunaCamada - t.w) / 2, y: arred(yy), w: t.w, h: t.h }); yy += t.h + 70; }); }
      y += arred(alt + G.topo) + 40;
    });
  } else {
    const arrumar = (g: GrupoQ | null, cs: CardQ[]) => m.layout === 'camadas' ? arrumarCamadas(g, cs, m.ligacoes) : arrumarGrade(g, cs);
    const caixas: Caixa[] = grupos.map(g => arrumar(g, m.cards.filter(c => c.grupo === g.id)));
    const soltos = m.cards.filter(c => !c.grupo || !grupos.some(g => g.id === c.grupo));
    if (soltos.length) caixas.push(arrumar(null, soltos));
    // grupos em prateleiras, da esquerda para a direita, quebrando quando passa da largura
    let x = 0, y = 0, alturaPrat = 0;
    const larguraMax = Math.max(G.larguraMax, ...caixas.map(c => c.w));
    caixas.forEach(cx => {
      if (x > 0 && x + cx.w > larguraMax) { x = 0; y += alturaPrat + G.entreGrupos; alturaPrat = 0; }
      if (cx.grupo) nodes.push({ id: 'n' + hashCurto('grupo:' + cx.grupo.id), tipo: 'grupo', x, y, w: cx.w, h: cx.h, cor: corDoGrupo.get(cx.grupo.id), titulo: cx.grupo.titulo, nota: '' });
      for (const c of cx.cards) { const p = cx.pos.get(c.id)!; colocar(c, { x: x + p.x, y: y + p.y, w: p.w, h: p.h }); }
      x += cx.w + G.entreGrupos; alturaPrat = Math.max(alturaPrat, cx.h);
    });
  }
  const cardDe = new Map(m.cards.map(c => [c.id, c]));
  const vistos = new Set<string>();
  for (const l of m.ligacoes) {
    const a = onde.get(l.de), b = onde.get(l.para); if (!a || !b || l.de === l.para) continue;
    const k = l.de + '>' + l.para + '|' + (l.deLinha || '') + '|' + (l.paraLinha || '') + '|' + (l.rotulo || ''); if (vistos.has(k)) continue; vistos.add(k);
    let [dl, pl] = lados(a, b, !!(l.deLinha || l.paraLinha));
    const cA = cardDe.get(l.de)!;
    // da decisão (losango) cada resposta sai por um vértice: para cima, para baixo ou para o lado, conforme onde está o próximo passo
    if (cA.tipo === 'fluxo' && cA.forma === 'decisao') {
      const cy = a.y + a.h / 2, by = b.y + b.h / 2;
      dl = by < cy - a.h / 2 ? 't' : by > cy + a.h / 2 ? 'b' : b.x >= a.x ? 'r' : 'l';
      pl = dl === 't' || dl === 'b' ? (b.x >= a.x + a.w / 2 ? 'l' : b.x + b.w <= a.x + a.w / 2 ? 'r' : dl === 't' ? 'b' : 't') : dl === 'r' ? 'l' : 'r';
    }
    const e: Record<string, any> = { id: 'a' + hashCurto('lig:' + k), de: idNo(l.de), deLado: dl, para: idNo(l.para), paraLado: pl,
      rotulo: l.rotulo || '', cor: l.cor || (cA.grupo && corDoGrupo.get(cA.grupo)) || 'cinza', estilo: 'curva', tracejada: !!l.tracejada, setas: 'fim', nota: '' };
    if (l.inicio) e.inicio = l.inicio; if (l.fim) e.fim = l.fim;
    if (l.rotuloInicio) e.rotuloInicio = l.rotuloInicio; if (l.rotuloFim) e.rotuloFim = l.rotuloFim;
    if (l.deLinha) e.deLinha = idLinha(l.de, l.deLinha); if (l.paraLinha) e.paraLinha = idLinha(l.para, l.paraLinha);
    edges.push(e);
  }
  return { nome: extra.nome || m.titulo, pai: extra.pai === undefined ? 'raiz' : extra.pai, nodes, edges };
}

// a próxima rodada mantém onde a pessoa arrumou os cards, se a estrutura (os mesmos cards e grupos) não mudou
export function manterPosicoes(novo: DocQuadro, antigo: DocQuadro | null | undefined): DocQuadro {
  if (!antigo || !Array.isArray(antigo.nodes)) return novo;
  const idsN = novo.nodes.map(n => n.id).sort().join(','), idsA = antigo.nodes.map(n => n.id).sort().join(',');
  if (idsN !== idsA) return novo;
  const pos = new Map(antigo.nodes.map(n => [n.id, n]));
  return { ...novo, nodes: novo.nodes.map(n => { const a = pos.get(n.id)!; return { ...n, x: a.x, y: a.y, w: a.w, ...(n.h !== undefined && a.h !== undefined ? { h: a.h } : {}) }; }),
    edges: novo.edges.map(e => { const a = antigo.edges.find(x => x.id === e.id); return a ? { ...e, deLado: a.deLado, paraLado: a.paraLado, estilo: a.estilo || e.estilo } : e; }) };
}

/* ---------- o que o DevIT devolve para o quadro: o molde (JSON Schema) e a conferência ---------- */
const TXT = { type: 'string' }, LISTA_TXT = { type: 'array', items: TXT };
const LINHA_ESQ = { type: 'object', additionalProperties: false, required: ['nome', 'tipo', 'chave', 'nulo', 'vis'],
  properties: { nome: TXT, tipo: TXT, chave: { type: 'string', enum: ['', 'pk', 'fk', 'pkfk', 'uq'] }, nulo: { type: 'boolean' }, vis: { type: 'string', enum: ['', '+', '-', '#', '~'] } } };
export const PONTAS: Ponta[] = ['', 'nenhum', 'seta', 'aberta', 'um', 'umum', 'zeroum', 'muitos', 'ummuitos', 'zeromuitos', 'triangulo', 'losango', 'losangoc'];
export const ICONES = ['', 'pessoa', 'tela', 'api', 'funcao', 'container', 'nuvem', 'volume', 'fila', 'globo', 'chave', 'escudo', 'relogio', 'git', 'cadeado', 'tabela'];
export const ESQUEMA_QUADRO = {
  type: 'object', additionalProperties: false, required: ['titulo', 'resumo', 'layout', 'legenda', 'grupos', 'cards', 'ligacoes'],
  properties: {
    titulo: TXT, resumo: TXT, layout: { type: 'string', enum: ['grade', 'camadas', 'raias'] }, legenda: LISTA_TXT,
    grupos: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'titulo'], properties: { id: TXT, titulo: TXT } } },
    cards: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['id', 'grupo', 'tipo', 'titulo', 'subtitulo', 'etiquetas', 'topicos', 'rotuloTipo', 'icone', 'cor', 'linhas', 'operacoes', 'estilo', 'abstrata', 'forma', 'participantes', 'passos', 'blocos'],
      properties: {
        id: TXT, grupo: TXT, tipo: { type: 'string', enum: ['modulo', 'empresa', 'departamento', 'banco', 'servico', 'cartao', 'tabela', 'fluxo', 'sequencia'] },
        titulo: TXT, subtitulo: TXT, etiquetas: LISTA_TXT, topicos: LISTA_TXT, rotuloTipo: TXT, icone: { type: 'string', enum: ICONES },
        cor: { type: 'string', enum: ['', ...CORES_CANVAS] }, linhas: { type: 'array', items: LINHA_ESQ }, operacoes: { type: 'array', items: LINHA_ESQ },
        estilo: { type: 'string', enum: ['der', 'classe'] }, abstrata: { type: 'boolean' },
        forma: { type: 'string', enum: ['', 'tarefa', 'decisao', 'inicio', 'fim', 'evento', 'dados', 'documento', 'subprocesso'] },
        participantes: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'nome', 'tipo'], properties: { id: TXT, nome: TXT, tipo: { type: 'string', enum: ['ator', 'tela', 'servico', 'banco', 'externo', 'fila'] } } } },
        passos: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['de', 'para', 'texto', 'tipo'], properties: { de: TXT, para: TXT, texto: TXT, tipo: { type: 'string', enum: ['chamada', 'retorno', 'assincrona'] } } } },
        blocos: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['tipo', 'rotulo', 'de', 'ate', 'senao'], properties: {
          tipo: { type: 'string', enum: ['alt', 'opt', 'loop', 'par'] }, rotulo: TXT, de: { type: 'integer' }, ate: { type: 'integer' },
          senao: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['em', 'rotulo'], properties: { em: { type: 'integer' }, rotulo: TXT } } } } } },
      } } },
    ligacoes: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['de', 'para', 'rotulo', 'tracejada', 'inicio', 'fim', 'rotuloInicio', 'rotuloFim', 'deLinha', 'paraLinha'],
      properties: { de: TXT, para: TXT, rotulo: TXT, tracejada: { type: 'boolean' }, inicio: { type: 'string', enum: PONTAS }, fim: { type: 'string', enum: PONTAS }, rotuloInicio: TXT, rotuloFim: TXT, deLinha: TXT, paraLinha: TXT } } },
  },
};
// o que veio de fora (o DevIT) só entra conferido: tipos certos, tamanhos limitados, ligações só entre cards que existem
export function limparModelo(o: unknown, tituloPadrao: string): Modelo | null {
  const x: any = o && typeof o === 'object' ? o : null; if (!x || !Array.isArray(x.cards) || !x.cards.length) return null;
  const t = (v: unknown, n: number) => String(v ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, n);
  const lista = (v: unknown, n: number, m: number) => (Array.isArray(v) ? v : []).slice(0, n).map(s => t(s, m)).filter(Boolean);
  const TIPOS = ['modulo', 'empresa', 'departamento', 'banco', 'servico', 'cartao', 'tabela', 'fluxo', 'sequencia'];
  const grupos: GrupoQ[] = (Array.isArray(x.grupos) ? x.grupos : []).slice(0, 30).map((g: any) => ({ id: t(g?.id, 80), titulo: t(g?.titulo, 120) })).filter((g: GrupoQ) => g.id && g.titulo);
  const idsG = new Set(grupos.map(g => g.id)), vistos = new Set<string>();
  const linhaOk = (l: any): Linha => ({ nome: t(l?.nome, 80), tipo: t(l?.tipo, 60), chave: ['', 'pk', 'fk', 'pkfk', 'uq'].includes(l?.chave) ? l.chave : '', nulo: !!l?.nulo, vis: ['', '+', '-', '#', '~'].includes(l?.vis) ? l.vis : '' });
  const cards: CardQ[] = [];
  for (const c of x.cards.slice(0, 150)) {
    const id = t(c?.id, 80); if (!id || vistos.has(id) || !TIPOS.includes(c?.tipo)) continue; vistos.add(id);
    const card: CardQ = { id, tipo: c.tipo, titulo: t(c.titulo, 160) || '(sem nome)', grupo: idsG.has(c.grupo) ? c.grupo : undefined, subtitulo: t(c.subtitulo, 300), etiquetas: lista(c.etiquetas, 4, 40), topicos: lista(c.topicos, 40, 300),
      rotuloTipo: t(c.rotuloTipo, 40).toUpperCase() || undefined, icone: ICONES.includes(c.icone) && c.icone ? c.icone : undefined, cor: CORES_CANVAS.includes(c.cor) ? c.cor : undefined };
    if (c.tipo === 'tabela') { card.estilo = c.estilo === 'classe' ? 'classe' : 'der'; card.abstrata = !!c.abstrata; card.linhas = (Array.isArray(c.linhas) ? c.linhas : []).slice(0, 80).map(linhaOk).filter((l: Linha) => l.nome); card.operacoes = (Array.isArray(c.operacoes) ? c.operacoes : []).slice(0, 30).map(linhaOk).filter((l: Linha) => l.nome); }
    if (c.tipo === 'fluxo') card.forma = FORMAS[c.forma] ? c.forma : 'tarefa';
    if (c.tipo === 'sequencia') {
      const ps: Participante[] = (Array.isArray(c.participantes) ? c.participantes : []).slice(0, 12).map((p: any) => ({ id: t(p?.id, 60), nome: t(p?.nome, 60), tipo: ['ator', 'tela', 'servico', 'banco', 'externo', 'fila'].includes(p?.tipo) ? p.tipo : 'servico' })).filter((p: Participante) => p.id && p.nome);
      const idsP = new Set(ps.map(p => p.id));
      const st: Passo[] = (Array.isArray(c.passos) ? c.passos : []).slice(0, 80).map((s: any) => ({ de: t(s?.de, 60), para: t(s?.para, 60), texto: t(s?.texto, 160), tipo: ['chamada', 'retorno', 'assincrona'].includes(s?.tipo) ? s.tipo : 'chamada' })).filter((s: Passo) => idsP.has(s.de) && idsP.has(s.para));
      const n = st.length;
      card.participantes = ps; card.passos = st;
      card.blocos = (Array.isArray(c.blocos) ? c.blocos : []).slice(0, 20).map((b: any) => ({ tipo: ['alt', 'opt', 'loop', 'par'].includes(b?.tipo) ? b.tipo : 'alt', rotulo: t(b?.rotulo, 80), de: Math.max(0, Math.min(n - 1, b?.de | 0)), ate: Math.max(0, Math.min(n - 1, b?.ate | 0)),
        senao: (Array.isArray(b?.senao) ? b.senao : []).slice(0, 6).map((z: any) => ({ em: Math.max(0, Math.min(n - 1, z?.em | 0)), rotulo: t(z?.rotulo, 80) })) })).filter((b: Bloco) => n && b.ate >= b.de);
      if (!ps.length) continue;
    }
    cards.push(card);
  }
  if (!cards.length) return null;
  const ids = new Set(cards.map(c => c.id)), linhasDe = new Map(cards.map(c => [c.id, new Set((c.linhas || []).concat(c.operacoes || []).map(l => l.nome))]));
  const ligacoes: LigQ[] = (Array.isArray(x.ligacoes) ? x.ligacoes : []).slice(0, 400).filter((l: any) => ids.has(l?.de) && ids.has(l?.para) && l.de !== l.para).map((l: any) => {
    const o: LigQ = { de: l.de, para: l.para, rotulo: t(l.rotulo, 120), tracejada: !!l.tracejada };
    if (PONTAS.includes(l.inicio) && l.inicio) o.inicio = l.inicio; if (PONTAS.includes(l.fim) && l.fim) o.fim = l.fim;
    if (t(l.rotuloInicio, 20)) o.rotuloInicio = t(l.rotuloInicio, 20); if (t(l.rotuloFim, 20)) o.rotuloFim = t(l.rotuloFim, 20);
    if (linhasDe.get(l.de)!.has(l.deLinha)) o.deLinha = l.deLinha; if (linhasDe.get(l.para)!.has(l.paraLinha)) o.paraLinha = l.paraLinha;
    return o;
  });
  return { titulo: t(x.titulo, 200) || tituloPadrao, resumo: t(x.resumo, 1500), legenda: lista(x.legenda, 8, 200), layout: ['grade', 'camadas', 'raias'].includes(x.layout) ? x.layout : 'grade', grupos, cards, ligacoes };
}
