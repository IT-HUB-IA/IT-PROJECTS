// Junta o que cada papel viu numa só árvore de peças (aplicação → módulo → tela → aba/janela/botão/campo/link),
// com quem vê cada uma, o arquivo e a linha no código, as ligações e os alertas de dados.
// Alertas só existem com o banco da aplicação ligado (sem ele não há com o que comparar).
import { createHash } from 'node:crypto';
import { slug } from './percorrer.mjs';
import { ESPECIAIS } from './falso.mjs';

const SAIR = /^(sair|logout|log out|sign out|desconectar|encerrar sess[aã]o|deslogar)$/i;
const SISTEMA = /^(id|uuid|created_at|updated_at|deleted_at|criado_em|atualizado_em|alterado_em|excluido_em|apagado_em|inserted_at|modificado_em|criado_por|atualizado_por|versao|version|tenant_id|espaco_id)$/i;
const impressao = (...p) => createHash('sha256').update(p.map(x => String(x ?? '')).join('|')).digest('hex').slice(0, 32);

export class Mapa {
  constructor() { this.pecas = new Map(); this.ligacoes = new Map(); this.alertas = new Map(); this.lacunas = []; }
  peca(p) {
    const o = this.pecas.get(p.chave);
    if (o) { for (const x of p.papeis || []) o.papeis.add(x); for (const k of ['descricao', 'quando', 'destino', 'arquivo', 'linha']) if (!o[k] && p[k]) o[k] = p[k]; if (p.certeza === 'rodando') o.certeza = 'rodando'; Object.assign(o.dados, p.dados || {}); return o; }
    const n = { chave: p.chave.slice(0, 300), pai: p.pai || null, tipo: p.tipo, nome: String(p.nome || '').slice(0, 300) || '(sem nome)', descricao: p.descricao || null, quando: p.quando || null, destino: p.destino || null,
      papeis: new Set(p.papeis || []), arquivo: p.arquivo || null, linha: p.linha || null, certeza: p.certeza || 'rodando', dados: { ...(p.dados || {}) }, ordem: this.pecas.size };
    this.pecas.set(n.chave, n); return n;
  }
  ligar(de, para, tipo, detalhe) {
    if (!de || !para || de === para) return;
    const k = de + '\u0000' + para + '\u0000' + tipo, o = this.ligacoes.get(k);
    if (o) { if (detalhe) o.detalhe = [...new Set([...(o.detalhe || '').split(', ').filter(Boolean), ...String(detalhe).split(', ')])].join(', ').slice(0, 500); return; }
    this.ligacoes.set(k, { de, para, tipo, detalhe: detalhe ? String(detalhe).slice(0, 500) : null });
  }
  alerta(a) { const imp = a.impressao || impressao(a.tipo, a.peca, a.tabela, a.coluna, a.trecho || ''); if (!this.alertas.has(imp)) this.alertas.set(imp, { ...a, impressao: imp }); }
  resultado(extra = {}) {
    return { ...extra,
      pecas: [...this.pecas.values()].map(p => ({ ...p, papeis: [...p.papeis].sort(), certeza: p.certeza === 'rodando' && p.arquivo ? 'confirmado' : p.certeza })),
      ligacoes: [...this.ligacoes.values()],
      alertas: [...this.alertas.values()].map(({ trecho, ...a }) => a),
      lacunas: this.lacunas.slice(0, 500) };
  }
}

// uma aplicação: as voltas de cada papel (percorrer) + a leitura do código
export function montarAplicacao(mapa, { app, voltas, codigo, bancos, comBanco }) {
  const A = app.chave, onde = (rot) => codigo.onde(rot) || {};
  mapa.peca({ chave: A, tipo: 'aplicacao', nome: app.nome, descricao: app.framework + (app.como ? ' · ' + app.como : ''), arquivo: /[/.]/.test(app.prova?.split(' ')[0] || '') ? app.prova.split(' ')[0] : null, certeza: voltas.length ? 'rodando' : 'codigo',
    dados: { pasta: app.rel, framework: app.framework, tipo: app.tipo, prova: app.prova } });
  const chaveTela = new Map(); // digital -> chave da peça tela
  const modulos = new Map();   // rótulo do menu -> chave do módulo
  const usados = new Set();
  const unica = (base) => { let k = base, n = 2; while (usados.has(k) && !mapa.pecas.has(k)) k = base + '-' + n++; usados.add(k); return k; };
  // 1. módulos: o que está no menu da primeira tela de cada papel
  const levaATela = (v, t, rot) => v.r.cliques.some(c => c.de === t.digital && c.rotulo === rot && c.zona === 'menu' && c.para && !/^(externo:|janela:|sair$|sem_fim$|aba$)/.test(c.para));
  for (const v of voltas) for (const t0 of v.r.telas.filter(t => !(t.passos || []).length)) {
    for (const e of t0.elementos.filter(x => x.zona === 'menu' && x.tipo === 'clique' && x.rotulo && (x.ativo || x.rotulo === t0.titulo || levaATela(v, t0, x.rotulo) || SAIR.test(x.rotulo)))) {
      if (SAIR.test(e.rotulo)) { const o = onde(e.rotulo); mapa.peca({ chave: A + '/b:' + slug(e.rotulo), pai: A, tipo: 'botao', nome: e.rotulo, destino: 'sair', papeis: [v.papel], arquivo: o.arquivo, linha: o.linha, quando: 'no menu' }); continue; }
      const k = A + '/m:' + slug(e.rotulo);
      modulos.set(e.rotulo, k);
      const o = onde(e.rotulo);
      mapa.peca({ chave: k, pai: A, tipo: 'modulo', nome: e.rotulo, descricao: e.ajuda || null, papeis: [v.papel], arquivo: o.arquivo, linha: o.linha, quando: 'no menu' });
    }
  }
  // 2. telas: pai = o módulo pelo qual se chegou (ou a aplicação)
  const moduloDe = (t, v) => { for (const p of t.passos || []) if (modulos.has(p.rotulo) && p.zona === 'menu') return modulos.get(p.rotulo); if (!(t.passos || []).length && modulos.has(t.titulo)) return modulos.get(t.titulo); return null; };
  for (const v of voltas) for (const t of v.r.telas) {
    if (chaveTela.has(t.digital)) { mapa.peca({ chave: chaveTela.get(t.digital), papeis: [v.papel] }); continue; }
    const mod = moduloDe(t, v);
    const nome = t.titulo || (t.passos.length ? t.passos[t.passos.length - 1].rotulo : 'Início');
    const k = unica((mod || A) + '/t:' + slug(nome + (t.passos.length ? '' : t.caminho !== '/' ? ' ' + t.caminho : '')));
    chaveTela.set(t.digital, k);
    const o = onde(t.titulo);
    const via = t.passos.length ? t.passos[t.passos.length - 1] : null;
    mapa.peca({ chave: k, pai: mod || A, tipo: 'tela', nome, papeis: [v.papel], arquivo: o.arquivo, linha: o.linha,
      quando: via ? (via.zona === 'menu' ? 'pelo menu ' + via.rotulo : 'ao clicar em ' + via.rotulo) : 'ao abrir' + (t.caminho && t.caminho !== '/' ? ' ' + t.caminho : ''),
      dados: { caminho: t.caminho, entrada: t.entrada } });
    if (mod) { mapa.ligar(mod, k, 'leva_para', null); mapa.peca({ chave: mod, destino: k }); }
  }
  const telaDe = (dig) => chaveTela.get(dig) || null;
  // 3. o que tem em cada tela: botões, abas, links, campos
  const filhos = (pai, elementos, papel, zonaOk) => {
    for (const e of elementos) {
      if (!e.rotulo || !zonaOk(e)) continue;
      const tipo = e.tipo === 'campo' ? 'campo' : e.zona === 'aba' ? 'aba' : e.tag === 'a' ? 'link' : 'botao';
      const k = pai + '/' + ({ campo: 'c', aba: 'a', link: 'l', botao: 'b' })[tipo] + ':' + slug(e.rotulo);
      const o = onde(e.rotulo);
      mapa.peca({ chave: k, pai, tipo, nome: e.rotulo, descricao: e.ajuda || null, papeis: [papel], arquivo: o.arquivo, linha: o.linha, dados: tipo === 'campo' ? { tipo: e.tipoCampo } : (e.href ? { endereco: e.href.slice(0, 300) } : {}) });
    }
  };
  for (const v of voltas) for (const t of v.r.telas) filhos(telaDe(t.digital), t.elementos, v.papel, e => e.zona === 'tela' || e.zona === 'aba' || (e.zona === 'menu' && !(t.passos || []).length && !modulos.has(e.rotulo) && !SAIR.test(e.rotulo)));
  // 4. janelas
  const chaveJanela = new Map();
  for (const v of voltas) for (const j of v.r.janelas) {
    const pai = telaDe(j.tela); if (!pai) continue;
    const k = pai + '/j:' + slug(j.titulo || j.botao); chaveJanela.set(j.tela + '|' + j.titulo, k);
    const o = onde(j.titulo);
    mapa.peca({ chave: k, pai, tipo: 'janela', nome: j.titulo || ('Janela de ' + j.botao), papeis: [v.papel], arquivo: o.arquivo, linha: o.linha, quando: 'ao clicar em ' + j.botao });
    filhos(k, j.elementos, v.papel, () => true);
    lerMarcas(mapa, k, j.texto, v.falso);
  }
  // 5. cliques: para onde cada botão leva
  for (const v of voltas) for (const c of v.r.cliques) {
    const de = telaDe(c.de); if (!de) continue;
    const tipo = c.zona === 'menu' ? null : c.zona === 'aba' ? 'a' : c.tag === 'a' ? 'l' : 'b';
    const kb = c.zona === 'menu' ? (modulos.get(c.rotulo) || (SAIR.test(c.rotulo) ? A + '/b:' + slug(c.rotulo) : de + '/' + (c.tag === 'a' ? 'l' : 'b') + ':' + slug(c.rotulo))) : de + '/' + tipo + ':' + slug(c.rotulo);
    if (!kb) continue;
    if (!mapa.pecas.has(kb)) { const o = onde(c.rotulo); mapa.peca({ chave: kb, pai: de, tipo: ({ a: 'aba', l: 'link', b: 'botao' })[tipo] || 'botao', nome: c.rotulo, descricao: c.ajuda || null, papeis: [v.papel], arquivo: o.arquivo, linha: o.linha }); }
    let destino = null;
    if (c.para === 'sair') destino = 'sair';
    else if (String(c.para).startsWith('externo:')) { destino = c.para; mapa.ligar(kb, c.para, 'outra_aplicacao', c.para.slice(8)); }
    else if (String(c.para).startsWith('janela:')) { destino = chaveJanela.get(c.de + '|' + c.para.slice(7)) || null; if (destino) mapa.ligar(kb, destino, 'abre', null); }
    else if (c.para === 'aba') { if (c.elementos) filhos(kb, c.elementos.filter(x => x.zona === 'tela'), v.papel, () => true); lerMarcas(mapa, kb, c.texto, v.falso); }
    else if (c.para === 'sem_fim') { destino = null; if (comBanco) mapa.alerta({ peca: kb, modulo: moduloDeChave(kb), tipo: 'caminho_sem_fim', gravidade: 'info', texto: 'Ao clicar em "' + c.rotulo + '" não dá para seguir: ' + (c.motivo || 'nada acontece') + '.', prova: { motivo: c.motivo, papel: v.papel }, trecho: onde(c.rotulo).trecho }); }
    else if (telaDe(c.para)) { destino = telaDe(c.para); mapa.ligar(kb, destino, 'leva_para', null); }
    if (destino) mapa.peca({ chave: kb, destino });
    for (const e of c.eventos || []) ligarEvento(mapa, kb, e, v.falso);
  }
  // 6. o que cada tela mostra do banco (os marcadores que apareceram) e o que pediu ao banco
  for (const v of voltas) for (const t of v.r.telas) lerMarcas(mapa, telaDe(t.digital), t.texto, v.falso);
  for (const v of voltas) for (const e of v.r.eventos) {
    if (e.acao && e.acao.recarga) continue;
    const pai = !e.acao ? null : e.acao.carregou ? telaDe(e.acao.onde) : e.acao.campos ? (chaveJanela.get(e.acao.onde) || telaDe(e.acao.onde)) : (telaDe(e.acao.onde) && (telaDe(e.acao.onde) + '/' + (e.acao.zona === 'aba' ? 'a' : 'b') + ':' + slug(e.acao.botao)));
    const quem = pai && mapa.pecas.has(pai) ? pai : (e.acao ? telaDe(e.acao.onde) : null) || A;
    ligarEvento(mapa, quem, e, v.falso);
    if (comBanco) alertasDoEvento(mapa, quem, e, v.falso);
  }
  // 7. campos: para onde vai o que se digita
  const naoEnviados = new Map();
  for (const v of voltas) for (const c of v.r.campos) {
    const pai = c.janela ? chaveJanela.get(c.onde) : telaDe(c.onde); if (!pai) continue;
    const k = pai + '/c:' + slug(c.campo || c.nome || c.tipo);
    const o = onde(c.campo);
    const destinos = [...c.destino.banco.map(d => d.tabela + '.' + d.coluna), ...c.destino.navegador.map(d => d.area + ':' + d.chave)];
    mapa.peca({ chave: k, pai, tipo: 'campo', nome: c.campo || c.nome || '(campo sem nome)', papeis: [c.papel], arquivo: o.arquivo, linha: o.linha, destino: destinos[0] || null,
      dados: { tipo: c.tipo, vai_para: destinos, enviado_por: c.enviou } });
    for (const d of c.destino.banco) {
      mapa.ligar(k, 'tabela:' + d.tabela, 'grava_em', d.coluna);
      // a coluna que não existe aparece também ao lado do campo que grava nela
      const t = comBanco && c.papel && voltas.find(x => x.papel === c.papel)?.falso.tabela(d.tabela);
      if (t && !(t.colunas || []).some(x => x.nome === d.coluna)) mapa.alerta({ peca: k, modulo: moduloDeChave(k), tipo: 'coluna_inexistente', gravidade: 'erro', tabela: d.tabela, coluna: d.coluna,
        texto: 'O que se digita em "' + (c.campo || c.nome) + '" vai para a coluna "' + d.coluna + '" da tabela "' + d.tabela + '", que não existe no banco ligado.', prova: { papel: c.papel }, trecho: o.trecho });
    }
    if (c.destino.chamada.some(x => x.tipo === 'auth')) mapa.peca({ chave: k, destino: 'entrar (login)' });
    if (!comBanco || !c.valor || ['checkbox', 'radio', 'select-one', 'select'].includes(c.tipo)) continue;
    if (c.aceito === false && !c.destino.banco.length && !c.destino.navegador.length) { naoEnviados.set(pai, [...(naoEnviados.get(pai) || []), c.campo || c.nome]); continue; }
    const mod = moduloDeChave(k);
    if (c.destino.navegador.length && !c.destino.banco.length) mapa.alerta({ peca: k, modulo: mod, tipo: 'so_navegador', gravidade: 'atencao', texto: 'O que se digita em "' + (c.campo || c.nome) + '" fica salvo só neste navegador (' + c.destino.navegador[0].area + '), não no banco.', prova: { onde: c.destino.navegador[0], papel: c.papel }, trecho: o.trecho });
    else if (!c.destino.banco.length && !c.destino.navegador.length && !c.destino.filtro.length && !c.destino.chamada.length && c.tipo !== 'password' && c.tipo !== 'search' && !/busca|pesquis|procur|filtr|search/i.test(c.campo || ''))
      mapa.alerta({ peca: k, modulo: mod, tipo: 'campo_sem_destino', gravidade: 'atencao', texto: 'O que se digita em "' + (c.campo || c.nome) + '" não vai para o banco nem fica guardado' + (c.enviou ? ' (depois de clicar em "' + c.enviou + '")' : ' (não há botão de enviar perto)') + '.', prova: { enviou: c.enviou, papel: c.papel }, trecho: o.trecho });
  }
  for (const [pai, nomes] of naoEnviados) { const p = mapa.pecas.get(pai); mapa.lacunas.push('Em "' + (p ? p.nome : pai) + '", o formulário não foi aceito com os valores de exemplo (a tela pediu algo que o mapa não soube preencher): não deu para ver para onde vão ' + [...new Set(nomes)].slice(0, 8).join(', ') + '.'); }
  // 8. o que fica guardado só no navegador sem vir de um campo (preferências, rascunhos, dados inteiros)
  if (comBanco) {
    const chaves = new Map();
    for (const v of voltas) for (const g of v.r.guardados) if (['localStorage', 'sessionStorage', 'IndexedDB', 'cookie'].includes(g.area) && !/^mqf/.test(g.valor) && !(g.marcas || []).some(m => /^mqf/.test(m)) && !/^(sb-|supabase\.|lswt-|lock:|__)/i.test(g.chave)) {
      const k = g.area + ':' + g.chave.replace(/\d[\d.]{5,}/g, '#'); if (!chaves.has(k)) chaves.set(k, { ...g, papel: v.papel, tamanho: String(g.valor || '').length });
    }
    const deCampo = new Set([...mapa.alertas.values()].filter(a => a.tipo === 'so_navegador' && a.prova?.onde).map(a => a.prova.onde.area + ':' + a.prova.onde.chave));
    for (const [k, g] of chaves) {
      if (deCampo.has(k)) continue;
      const est = codigo.navegador.find(n => n.chave === g.chave || (g.area === 'IndexedDB' && n.area === 'IndexedDB'));
      const quem = g.acao ? (telaDe(g.acao.onde) || A) : A;
      mapa.alerta({ peca: quem, modulo: moduloDeChave(quem), tipo: 'so_navegador', gravidade: 'atencao', texto: 'Guarda "' + g.chave + '" só neste navegador (' + g.area + (g.tamanho > 2000 ? ', mais de 2 mil letras' : '') + '): em outro computador ou navegador isso não aparece.',
        prova: { area: g.area, chave: g.chave, arquivo: est?.arquivo, linha: est?.linha, papel: g.papel }, trecho: est?.trecho || k });
    }
  }
  // 9. sistemas que não rodam: telas pelos modelos de página
  if (!voltas.length) for (const te of codigo.telasEstaticas.filter(x => x.arquivo.startsWith(app.rel === '.' ? '' : app.rel + '/'))) {
    const k = unica(A + '/t:' + slug(te.titulo));
    mapa.peca({ chave: k, pai: A, tipo: 'tela', nome: te.titulo, arquivo: te.arquivo, certeza: 'codigo' });
    for (const e of te.elementos) {
      if (!e.rotulo) continue;
      const tipo = e.tag === 'a' ? 'link' : ['input', 'select', 'textarea'].includes(e.tag) && !['submit', 'button'].includes(e.tipo) ? 'campo' : e.tag === 'form' ? null : 'botao';
      if (!tipo) continue;
      mapa.peca({ chave: k + '/' + tipo[0] + ':' + slug(e.rotulo), pai: k, tipo, nome: e.rotulo, arquivo: te.arquivo, linha: e.linha, destino: e.destino, certeza: 'codigo' });
    }
  }
  const doCampo = new Set([...mapa.alertas.values()].filter(a => a.tipo === 'coluna_inexistente' && /\/c:[^/]+$/.test(a.peca)).map(a => a.peca.replace(/\/c:[^/]+$/, '') + '|' + a.tabela + '.' + a.coluna));
  for (const [imp, a] of mapa.alertas) if (a.tipo === 'coluna_inexistente' && doCampo.has(a.peca + '|' + a.tabela + '.' + a.coluna)) mapa.alertas.delete(imp);
  return { telas: chaveTela.size, janelas: chaveJanela.size, modulos: modulos.size };
}
const moduloDeChave = (k) => { const m = /^(.*?\/m:[^/]+)/.exec(k || ''); return m ? m[1] : null; };

function lerMarcas(mapa, peca, texto, falso) {
  if (!peca || !texto || !falso) return;
  const porTabela = new Map();
  for (const x of falso.colunasNoTexto(texto)) { if (!porTabela.has(x.tabela)) porTabela.set(x.tabela, new Set()); porTabela.get(x.tabela).add(x.coluna); }
  for (const [t, cols] of porTabela) mapa.ligar(peca, 'tabela:' + t, 'le_de', [...cols].join(', '));
}
function ligarEvento(mapa, quem, e, falso) {
  if (!quem) return;
  if ((e.tipo === 'le' || e.tipo === 'grava') && e.tabela) {
    const cols = (e.colunas || []).filter(c => c && c !== '*embutida');
    if (e.tipo === 'grava') mapa.ligar(quem, 'tabela:' + e.tabela, 'grava_em', cols.join(', '));
    else if (cols.length) mapa.ligar(quem, 'tabela:' + e.tabela, 'le_de', cols.join(', '));
    else mapa.ligar(quem, 'tabela:' + e.tabela, 'le_de', null);
  }
  if (e.tipo === 'rpc') mapa.ligar(quem, 'funcao:' + e.nome, 'chama', null);
  if (e.tipo === 'funcao') mapa.ligar(quem, 'api:' + e.nome, 'chama', null);
  if (e.tipo === 'api') mapa.ligar(quem, 'api:' + e.host + e.caminho, 'chama', e.metodo);
}
function alertasDoEvento(mapa, quem, e, falso) {
  if ((e.tipo !== 'le' && e.tipo !== 'grava') || !e.tabela) return;
  const t = falso.tabela(e.tabela, e.esquema), mod = moduloDeChave(quem);
  if (!t) { mapa.alerta({ peca: quem, modulo: mod, tipo: 'tabela_inexistente', gravidade: 'erro', tabela: e.tabela, texto: (e.tipo === 'grava' ? 'Grava' : 'Lê') + ' na tabela "' + e.tabela + '", que não existe no banco ligado.', prova: { via: e.via, metodo: e.metodo } }); return; }
  const existe = new Set((t.colunas || []).map(c => c.nome));
  const cols = [...(e.colunas || []), ...(e.filtros || [])].filter(c => c && c !== '*embutida' && !ESPECIAIS.has(c) && !c.includes('.'));
  for (const c of new Set(cols)) if (!existe.has(c)) mapa.alerta({ peca: quem, modulo: mod, tipo: 'coluna_inexistente', gravidade: 'erro', tabela: t.nome, coluna: c,
    texto: (e.tipo === 'grava' ? 'Grava' : 'Lê') + ' a coluna "' + c + '" da tabela "' + t.nome + '", que não existe no banco ligado.', prova: { via: e.via, metodo: e.metodo } });
}

// os alertas do código (o que não deu para ver rodando) e as colunas sem tela (do repositório inteiro)
export function alertasDoCodigo(mapa, { codigo, falso, usadasPorOutras = [], palavras = [], apps }) {
  const appDe = (arq) => (apps.find(a => a.rel !== '.' && arq.startsWith(a.rel + '/')) || apps[0])?.chave;
  for (const a of codigo.acessos) {
    const t = falso.tabela(a.tabela);
    const peca = appDe(a.arquivo);
    if (!peca) continue;
    if (!t) {
      if (a.via === 'sql' && !falso.temBanco) continue;
      mapa.alerta({ peca, modulo: null, tipo: 'tabela_inexistente', gravidade: 'erro', tabela: a.tabela, texto: 'O código ' + (a.modo === 'grava' ? 'grava' : 'lê') + ' a tabela "' + a.tabela + '", que não existe no banco ligado (' + a.arquivo + ', linha ' + a.linha + ').', prova: { arquivo: a.arquivo, linha: a.linha, trecho: a.trecho }, trecho: a.trecho });
      continue;
    }
    const existe = new Set((t.colunas || []).map(c => c.nome));
    for (const c of a.colunas) if (!existe.has(c)) mapa.alerta({ peca, modulo: null, tipo: 'coluna_inexistente', gravidade: 'erro', tabela: t.nome, coluna: c,
      texto: 'O código ' + (a.modo === 'grava' ? 'grava' : 'lê') + ' a coluna "' + c + '" da tabela "' + t.nome + '", que não existe no banco ligado (' + a.arquivo + ', linha ' + a.linha + ').', prova: { arquivo: a.arquivo, linha: a.linha, trecho: a.trecho }, trecho: a.trecho });
  }
  // colunas sem tela: nenhuma tela mostra ou grava, o código não cita, nenhuma função do banco usa, nenhuma outra aplicação usa
  const usadas = new Set(), tabelasUsadas = new Set();
  for (const l of mapa.ligacoes.values()) if (l.para.startsWith('tabela:') && (l.tipo === 'le_de' || l.tipo === 'grava_em')) {
    const t = l.para.slice(7); tabelasUsadas.add(t);
    for (const c of String(l.detalhe || '').split(',').map(x => x.trim()).filter(Boolean)) usadas.add(t + '.' + c);
  }
  for (const a of codigo.acessos) { tabelasUsadas.add(a.tabela); for (const c of a.colunas) usadas.add(a.tabela + '.' + c); }
  const outras = new Set(usadasPorOutras.map(String)), pal = new Set(palavras.map(x => String(x).toLowerCase()));
  for (const x of outras) tabelasUsadas.add(x.split('.')[0]);
  const vistas = new Set();
  for (const t of falso.tabelas.values()) {
    if (vistas.has(t)) continue; vistas.add(t);
    if (!['r', 'p'].includes(t.tipo || 'r')) continue;
    if (!['public'].includes(t.esquema) && !tabelasUsadas.has(t.nome)) continue; // só o que a API expõe, ou o que alguém usa
    const pk = new Set((t.restricoes || []).filter(r => r.tipo === 'p' || r.tipo === 'f').flatMap(r => r.cols || []));
    const k = 'tabela:' + t.nome;
    if (!tabelasUsadas.has(t.nome) && !pal.has(t.nome.toLowerCase())) {
      mapa.alerta({ peca: k, modulo: null, tipo: 'coluna_sem_tela', gravidade: 'info', tabela: t.nome, coluna: null, texto: 'Nenhuma tela, nenhuma função do banco e nenhuma outra aplicação usa a tabela "' + t.nome + '".', prova: { colunas: (t.colunas || []).length } });
      continue;
    }
    for (const c of t.colunas || []) {
      if (SISTEMA.test(c.nome) || pk.has(c.nome) || /_id$/.test(c.nome)) continue;
      if (usadas.has(t.nome + '.' + c.nome) || outras.has(t.nome + '.' + c.nome) || pal.has(c.nome.toLowerCase())) continue;
      mapa.alerta({ peca: k, modulo: null, tipo: 'coluna_sem_tela', gravidade: 'info', tabela: t.nome, coluna: c.nome, texto: 'Nenhuma tela mostra ou grava a coluna "' + c.nome + '" da tabela "' + t.nome + '" (nem as funções do banco nem outra aplicação a usam).', prova: { tipo: c.tipo } });
    }
  }
}
