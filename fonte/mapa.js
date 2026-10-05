/* =====================================================================
   Mapa do Sistema: a tela "Como está" da Infraestrutura (parte 69 do banco). Prefixo mp.
   É um reflexo do que existe hoje, tirado do código ligado (GitHub/GitLab) e do banco ligado: nada aqui se desenha
   nem se cria à mão. Quem monta é o trabalhador (worker/mapa), que constrói uma cópia do sistema numa caixa fechada,
   responde às chamadas com dados de exemplo no formato do banco real e percorre a cópia com cada papel.
   No topo da Infraestrutura: "Como está" (abre primeiro) | "Desenhos" (as 10 visões de antes).
   Visões por Projeto (projeto ou produto escolhido na árvore):
     macro  as aplicações e as ligações entre elas
     meso   as aplicações, os módulos de cada uma e as ligações
     micro  tudo, com foco e busca
   Visões por Aplicação (aplicação escolhida na árvore):
     macro  os módulos (com a contagem de alertas e o painel "Colunas sem tela")
     meso   os módulos e as janelas de cada um, ligações com outros módulos e, em resumo, com outras aplicações
     micro  cada tela e janela em detalhe, com o alerta ao lado do que ele fala
   Alertas de dados só nas visões por aplicação e só com o banco da aplicação ligado.
   ===================================================================== */
const MP = {chave:null, carregando:false, erro:'', analises:[], pecas:[], ligacoes:[], alertas:[], proposito:new Map(), repos:[], foco:null, busca:'', lidoEm:0, pedindo:false};
const MP_TIPOS = {aplicacao:'Aplicação', modulo:'Módulo', tela:'Tela', aba:'Aba', janela:'Janela', botao:'Botão', campo:'Campo', link:'Link', comentario:'Comentário'};
const MP_ALERTA = {
  coluna_inexistente:['Coluna que não existe', 'erro'], tabela_inexistente:['Tabela que não existe', 'erro'],
  campo_sem_destino:['Campo sem destino', 'atencao'], so_navegador:['Só no navegador', 'atencao'],
  caminho_sem_fim:['Caminho sem fim', 'info'], coluna_sem_tela:['Coluna sem tela', 'info']
};
const MP_GRAV = {erro:['Erro', '!'], atencao:['Atenção', '!'], info:['Informação', 'i']};
const MP_VISOES = {
  projeto:[['macro', 'Macro', 'As aplicações e as ligações entre elas.'], ['meso', 'Meso', 'As aplicações, os módulos de cada uma e as ligações.'], ['micro', 'Micro', 'Tudo, com foco e busca.']],
  aplicacao:[['macro', 'Macro', 'Os módulos da aplicação.'], ['meso', 'Meso', 'Os módulos e as janelas de cada um, as ligações com outros módulos e, em resumo, com outras aplicações.'], ['micro', 'Micro', 'Cada tela e janela em detalhe.']]
};
const mpModo = () => UI.infraModo === 'desenhos' ? 'desenhos' : 'mapa';
const mpEscopo = () => (UI.sel || '').startsWith('app:') ? 'aplicacao' : 'projeto';
const mpVisao = () => { const v = (UI.mapaVisao || {})[mpEscopo()]; return ['macro', 'meso', 'micro'].includes(v) ? v : 'macro'; };
const mpBanco = () => (typeof ifrBanco === 'function') ? ifrBanco() : null;
const mpQuando = t => t ? new Date(t).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'}) : '';
const mpPl = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);

// os pontos da árvore que contam para o que está escolhido: ele, os de cima (repositório ligado no produto ou projeto vale para baixo) e, no projeto, os de baixo
function mpNos(){
  const [t, id] = (UI.sel || '').split(':'), s = new Set([id]);
  if (t === 'project'){ D.products.filter(p => p.project === id).forEach(p => s.add(p.id)); D.apps.filter(a => a.project === id).forEach(a => s.add(a.id)); }
  if (t === 'product'){ const p = byId('products', id); if (p) s.add(p.project); D.apps.filter(a => a.product === id).forEach(a => s.add(a.id)); }
  if (t === 'app'){ const a = byId('apps', id); if (a){ if (a.product) s.add(a.product); if (a.project) s.add(a.project); } }
  return [...s].filter(Boolean);
}
async function mpTudo(sb, tabela, campos, filtro){
  const out = [];
  for (let de = 0; de < 60000; de += 1000){
    const {data, error} = await filtro(sb.from(tabela).select(campos)).range(de, de + 999);
    if (error) throw error;
    out.push(...(data || [])); if (!data || data.length < 1000) break;
  }
  return out;
}
async function mpCarregar(forcar){
  const sb = mpBanco(), chave = UI.sel;
  if (!sb){ MP.erro = 'O Mapa do Sistema precisa do banco ligado.'; return; }
  if (MP.carregando) return;
  if (!forcar && MP.chave === chave && Date.now() - MP.lidoEm < 20000) return;
  MP.carregando = true; MP.erro = '';
  try {
    const nos = mpNos();
    const an = await mpTudo(sb, 'mapa_analises', 'id,no_id,repositorio_id,status,origem,referencia,criado_em,iniciado_em,concluido_em,erro,tecnologia,com_banco,resumo,lacunas,papeis', q => q.in('no_id', nos).order('criado_em', {ascending:false}));
    const rp = await sb.from('repositorios').select('id, no_id, nome, provedor').in('no_id', nos);
    const prontas = an.filter(a => a.status === 'pronto').map(a => a.id);
    const [pc, lg, al, pp] = prontas.length ? await Promise.all([
      mpTudo(sb, 'mapa_pecas', '*', q => q.in('analise_id', prontas).order('ordem')),
      mpTudo(sb, 'mapa_ligacoes', '*', q => q.in('analise_id', prontas)),
      mpTudo(sb, 'mapa_alertas', '*', q => q.in('analise_id', prontas)),
      mpTudo(sb, 'mapa_proposito', '*', q => q.in('no_id', nos))
    ]) : [[], [], [], await mpTudo(sb, 'mapa_proposito', '*', q => q.in('no_id', nos))];
    if (UI.sel !== chave) return;
    MP.chave = chave; MP.analises = an; MP.repos = rp.data || []; MP.pecas = pc; MP.ligacoes = lg; MP.alertas = al;
    MP.proposito = new Map(pp.map(p => [p.no_id + '|' + p.impressao, p]));
    MP.lidoEm = Date.now();
  } catch(e){ MP.erro = e.message || String(e); }
  finally { MP.carregando = false; }
}

/* ---------- índices ---------- */
// cada peça é única pela análise + chave (dois repositórios podem ter chaves iguais)
const mpId = p => p.analise_id + '|' + p.chave;
function mpIndice(){
  if (MP._ind && MP._ind.base === MP.pecas && MP._ind.lig === MP.ligacoes) return MP._ind;
  const por = new Map(), filhos = new Map();
  MP.pecas.forEach(p => { por.set(mpId(p), p); const k = p.analise_id + '|' + (p.pai || ''); if (!filhos.has(k)) filhos.set(k, []); filhos.get(k).push(p); });
  const saem = new Map(), entram = new Map();
  MP.ligacoes.forEach(l => { const a = l.analise_id + '|' + l.de, b = l.analise_id + '|' + l.para; (saem.get(a) || saem.set(a, []).get(a)).push(l); (entram.get(b) || entram.set(b, []).get(b)).push(l); });
  MP._ind = {base:MP.pecas, lig:MP.ligacoes, por, filhos, saem, entram};
  return MP._ind;
}
const mpFilhos = (p, tipos) => (mpIndice().filhos.get(p.analise_id + '|' + p.chave) || []).filter(x => !tipos || tipos.includes(x.tipo));
const mpPeca = (analise, chave) => mpIndice().por.get(analise + '|' + chave) || null;
function mpDescendentes(p){ const out = []; const pilha = [p]; while (pilha.length){ const x = pilha.pop(); mpFilhos(x).forEach(f => { out.push(f); pilha.push(f); }); } return out; }
const mpAnalise = id => MP.analises.find(a => a.id === id) || null;
const mpRepoNome = a => { const r = MP.repos.find(x => x.id === a.repositorio_id); return r ? r.nome : ((a.resumo || {}).nome || ''); };
// as aplicações achadas no código (cada repositório pode ter várias)
const mpApps = () => MP.pecas.filter(p => p.tipo === 'aplicacao');
function mpAppAtual(){
  const l = mpApps(); if (!l.length) return null;
  const q = (UI.mapaApp || {})[UI.sel];
  return l.find(p => mpId(p) === q) || l[0];
}
// o módulo de uma peça (subindo pelos pais)
function mpModuloDe(p){
  for (let x = p, n = 0; x && n < 30; x = x.pai ? mpPeca(x.analise_id, x.pai) : null, n++) if (x.tipo === 'modulo') return x;
  return null;
}
function mpAppDe(p){
  for (let x = p, n = 0; x && n < 30; x = x.pai ? mpPeca(x.analise_id, x.pai) : null, n++) if (x.tipo === 'aplicacao') return x;
  return null;
}

/* ---------- alertas ---------- */
const mpDeProposito = a => { const an = mpAnalise(a.analise_id); return an ? MP.proposito.get(an.no_id + '|' + a.impressao) || null : null; };
// os alertas de uma aplicação do código: os das peças dela e os do banco (colunas sem tela) da mesma análise
function mpAlertasDaApp(app){
  if (!app) return [];
  const an = mpAnalise(app.analise_id); if (!an || !an.com_banco) return [];
  const pref = app.chave + '/';
  const soUma = mpApps().filter(x => x.analise_id === app.analise_id).length === 1;
  return MP.alertas.filter(a => a.analise_id === app.analise_id && (a.peca === app.chave || (a.peca || '').startsWith(pref) || (a.peca || '').startsWith('tabela:') && soUma || (a.peca || '').startsWith('tabela:') && !a.modulo));
}
const mpAbertos = l => l.filter(a => !mpDeProposito(a));
function mpContaHTML(lista){
  const ab = mpAbertos(lista); if (!ab.length) return '';
  const c = {erro:0, atencao:0, info:0}; ab.forEach(a => { c[a.gravidade] = (c[a.gravidade] || 0) + 1; });
  return '<span class="mp-conta">' + ['erro', 'atencao', 'info'].filter(g => c[g]).map(g => '<span class="mp-al-ico g-' + g + '" title="' + esc(mpPl(c[g], MP_GRAV[g][0].toLowerCase(), MP_GRAV[g][0].toLowerCase())) + '">' + MP_GRAV[g][1] + '<b>' + c[g] + '</b></span>').join('') + '</span>';
}
function mpAlertaHTML(a, curto){
  const pp = mpDeProposito(a), t = MP_ALERTA[a.tipo] || [a.tipo, a.gravidade];
  const pode = podeEditar();
  return '<div class="mp-al g-' + esc(a.gravidade) + (pp ? ' proposito' : '') + '" data-mp-alerta="' + esc(a.id) + '">' +
    '<span class="mp-al-ico g-' + esc(a.gravidade) + '" aria-hidden="true">' + MP_GRAV[a.gravidade][1] + '</span>' +
    '<span class="mp-al-txt"><b>' + esc(t[0]) + '</b> ' + esc(a.texto) +
      (a.prova && a.prova.arquivo ? ' <code>' + esc(a.prova.arquivo + (a.prova.linha ? ':' + a.prova.linha : '')) + '</code>' : '') +
      (pp ? '<small class="mp-al-prop">É de propósito: ' + esc(pp.motivo) + ' · ' + esc(nomePessoa(pp.por)) + ', ' + esc(mpQuando(pp.em)) + '</small>' : '') + '</span>' +
    (!curto && pode ? '<span class="mp-al-acoes">' + (pp ? '<button type="button" class="ifr-lnk" data-mp-desmarcar="' + esc(a.id) + '">Desmarcar</button>' : '<button type="button" class="ifr-lnk" data-mp-proposito="' + esc(a.id) + '">É de propósito</button><button type="button" class="ifr-lnk" data-mp-item="' + esc(a.id) + '">Criar item</button>') + '</span>' : '') +
    '</div>';
}
const nomePessoa = id => { const p = (D.people || []).find(x => x.id === id); return p ? p.nome : 'alguém'; };

/* ---------- pedaços comuns ---------- */
const mpPapeisHTML = p => (p.papeis || []).length ? '<span class="mp-papeis" title="Quem vê">' + p.papeis.map(x => '<span class="mp-papel' + (x === 'visitante' ? ' vis' : '') + '">' + esc(x === 'visitante' ? 'sem entrar' : x) + '</span>').join('') + '</span>' : '';
const mpOndeHTML = p => p.arquivo ? '<code class="mp-onde" title="Onde está no código">' + esc(p.arquivo + (p.linha ? ':' + p.linha : '')) + '</code>' : '';
const mpCerteza = p => p.certeza === 'codigo' ? '<span class="mp-cert" title="Achado só no código: não deu para ver rodando">só no código</span>' : '';
function mpNomeDestino(p){
  if (!p.destino) return '';
  if (p.destino === 'sair') return 'sai do sistema';
  if (p.destino.startsWith('externo:')) return 'leva para ' + p.destino.slice(8).replace(/^https?:\/\//, '');
  const d = mpPeca(p.analise_id, p.destino);
  if (d) return (d.tipo === 'janela' ? 'abre a janela ' : 'leva para ') + d.nome;
  if (/^[\w]+\.[\w]+$/.test(p.destino)) return 'grava em ' + p.destino;
  if (/^(localStorage|sessionStorage|IndexedDB|cookie):/.test(p.destino)) return 'guarda só no navegador (' + p.destino + ')';
  return p.destino;
}
function mpStatusHTML(){
  const an = MP.analises, pode = podeEditar();
  const ult = an.find(a => a.status === 'pronto'), fila = an.find(a => a.status === 'fila' || a.status === 'rodando'), err = an.find(a => a.status === 'erro' && (!ult || a.criado_em > ult.criado_em));
  let t = '';
  if (fila) t += '<span class="mp-st rodando">' + (fila.status === 'rodando' ? 'Analisando o código agora…' : 'Na fila para analisar') + '</span>';
  if (ult) t += '<span>Última análise: <b>' + esc(mpQuando(ult.concluido_em)) + '</b>' + (ult.referencia ? ' · commit <code>' + esc(String(ult.referencia).slice(0, 7)) + '</code>' : '') + (ult.tecnologia ? ' · ' + esc(ult.tecnologia) : '') + ((ult.resumo || {}).segundos ? ' · levou ' + Math.max(1, Math.round(ult.resumo.segundos / 60)) + ' min' : '') + '</span>';
  else if (!fila) t += '<span>Ainda não analisado.</span>';
  if (err) t += '<span class="mp-st erro" title="' + esc(err.erro || '') + '">A última tentativa deu erro: ' + esc(String(err.erro || '').slice(0, 160)) + '</span>';
  return '<div class="mp-status">' + t + '<span class="mp-st-acoes">' + (typeof ifrLigBotaoHTML === 'function' ? ifrLigBotaoHTML() : '') + (pode ? '<button type="button" class="btn sec peq" data-mp-pedir' + (fila || MP.pedindo ? ' disabled' : '') + '>Analisar agora</button>' : '') + '</span></div>';
}
function mpVazioHTML(){
  const pode = podeEditar(), temRepo = MP.repos.length > 0;
  return '<div class="mp-vazio"><h3>Ainda não há mapa deste ponto</h3><p>O mapa sai sozinho do código ligado: a cada publicação, o CicloDev constrói uma cópia do sistema numa caixa fechada, sem entrar no sistema de verdade e sem usar inteligência artificial, e percorre cada tela, janela, botão e campo.</p>' +
    (temRepo ? '<p>' + (pode ? 'Clique em <b>Analisar agora</b> para fazer o primeiro.' : 'Ele aparece aqui depois da próxima publicação.') + '</p>' : '<p>Primeiro ligue o código (GitHub ou GitLab) em <b>Ligações</b>.' + (pode ? ' <button type="button" class="ifr-lnk" data-ifr-ligacoes>Abrir Ligações</button>' : '') + '</p>') + '</div>';
}
function mpLacunasHTML(lista){
  const l = [...new Set(lista)].filter(Boolean); if (!l.length) return '';
  return '<details class="mp-lacunas"><summary>O que não deu para ver (' + l.length + ')</summary><ul>' + l.slice(0, 200).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></details>';
}

/* ---------- Visões por Projeto ---------- */
// ligações entre aplicações: o mesmo dado (as duas leem ou gravam a mesma tabela) e os links de uma para fora
function mpEntreApps(){
  const apps = mpApps(), usa = new Map(), fora = [];
  apps.forEach(a => usa.set(mpId(a), new Set()));
  MP.ligacoes.forEach(l => {
    const de = mpPeca(l.analise_id, l.de); if (!de) return;
    const ap = de.tipo === 'aplicacao' ? de : mpAppDe(de); if (!ap) return;
    if ((l.tipo === 'le_de' || l.tipo === 'grava_em') && l.para.startsWith('tabela:')) usa.get(mpId(ap)).add(l.para.slice(7));
    if (l.tipo === 'outra_aplicacao' || (l.para || '').startsWith('externo:')) fora.push({app:ap, para:l.para.replace(/^externo:/, '').replace(/^https?:\/\//, ''), de});
  });
  const pares = [];
  for (let i = 0; i < apps.length; i++) for (let j = i + 1; j < apps.length; j++){
    const a = usa.get(mpId(apps[i])), b = usa.get(mpId(apps[j])), comuns = [...a].filter(x => b.has(x));
    if (comuns.length) pares.push({a:apps[i], b:apps[j], tabelas:comuns});
  }
  return {pares, fora};
}
function mpProjMacro(){
  const apps = mpApps(); if (!apps.length) return mpVazioHTML();
  const {pares, fora} = mpEntreApps(), sites = [...new Set(fora.map(f => f.para))];
  // desenho: as aplicações num círculo, os sites de fora à direita
  const W = 760, H = apps.length === 1 ? 140 : apps.length <= 3 ? 280 : Math.min(560, 140 + apps.length * 40), cx = sites.length ? 260 : W / 2, cy = H / 2, R = Math.min(H / 2 - 40, 70 + apps.length * 22);
  const pos = new Map(apps.map((a, i) => { const ang = apps.length === 1 ? 0 : (i / apps.length) * Math.PI * 2 - Math.PI / 2; return [mpId(a), {x:apps.length === 1 ? cx : cx + Math.cos(ang) * R, y:apps.length === 1 ? cy : cy + Math.sin(ang) * R}]; }));
  const posF = new Map(sites.map((s, i) => [s, {x:640, y:40 + (i + .5) * ((H - 80) / Math.max(1, sites.length))}]));
  let svg = '<svg class="mp-grafo" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="As aplicações e as ligações entre elas">';
  pares.forEach(p => { const a = pos.get(mpId(p.a)), b = pos.get(mpId(p.b)); svg += '<line class="mp-l-dado" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"><title>' + esc('Usam os mesmos dados: ' + p.tabelas.join(', ')) + '</title></line><text class="mp-l-txt" x="' + (a.x + b.x) / 2 + '" y="' + ((a.y + b.y) / 2 - 6) + '">' + esc(mpPl(p.tabelas.length, 'tabela', 'tabelas')) + ' em comum</text>'; });
  const vistos = new Set();
  fora.forEach(f => { const k = mpId(f.app) + '>' + f.para; if (vistos.has(k)) return; vistos.add(k); const a = pos.get(mpId(f.app)), b = posF.get(f.para); svg += '<line class="mp-l-fora" x1="' + a.x + '" y1="' + a.y + '" x2="' + (b.x - 70) + '" y2="' + b.y + '" marker-end="url(#mp-seta)"/>'; });
  svg += '<defs><marker id="mp-seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>';
  apps.forEach(a => { const p = pos.get(mpId(a)), mods = mpFilhos(a, ['modulo']).length, telas = mpDescendentes(a).filter(x => x.tipo === 'tela').length;
    svg += '<g class="mp-no" data-mp-focar="' + esc(mpId(a)) + '" tabindex="0"><rect x="' + (p.x - 80) + '" y="' + (p.y - 26) + '" width="160" height="52" rx="6"/><text class="mp-no-t" x="' + p.x + '" y="' + (p.y - 4) + '">' + esc(a.nome.slice(0, 22)) + '</text><text class="mp-no-s" x="' + p.x + '" y="' + (p.y + 14) + '">' + esc(mpPl(mods, 'módulo', 'módulos') + ' · ' + mpPl(telas, 'tela', 'telas')) + '</text></g>'; });
  sites.forEach(s => { const p = posF.get(s); svg += '<g class="mp-no fora"><rect x="' + (p.x - 70) + '" y="' + (p.y - 16) + '" width="140" height="32" rx="16"/><text class="mp-no-s" x="' + p.x + '" y="' + (p.y + 4) + '">' + esc(s.slice(0, 22)) + '</text></g>'; });
  svg += '</svg>';
  return '<figure class="mp-fig">' + svg + '<figcaption>' + esc(mpPl(apps.length, 'aplicação', 'aplicações')) + (pares.length ? ' · linha tracejada: usam os mesmos dados' : '') + (sites.length ? ' · seta: leva para fora (outro site ou sistema)' : '') + '</figcaption></figure>' +
    '<div class="mp-cards">' + apps.map(a => mpAppCardHTML(a)).join('') + '</div>';
}
function mpAppCardHTML(a){
  const an = mpAnalise(a.analise_id) || {}, desc = mpDescendentes(a);
  const n = t => desc.filter(x => x.tipo === t).length;
  return '<article class="mp-card"><header><h4><button type="button" class="ifr-lnk" data-mp-focar="' + esc(mpId(a)) + '">' + esc(a.nome) + '</button></h4><small>' + esc((a.dados || {}).framework || '') + (mpRepoNome(an) ? ' · ' + esc(mpRepoNome(an)) : '') + ((a.dados || {}).pasta && a.dados.pasta !== '.' ? ' · pasta ' + esc(a.dados.pasta) : '') + '</small></header>' +
    '<p class="mp-nums"><span><b>' + n('modulo') + '</b> módulos</span><span><b>' + n('tela') + '</b> telas</span><span><b>' + n('janela') + '</b> janelas</span><span><b>' + (n('botao') + n('link')) + '</b> botões e links</span><span><b>' + n('campo') + '</b> campos</span></p>' +
    ((an.papeis || []).length ? '<p class="mp-quem">Papéis vistos: ' + an.papeis.map(x => '<span class="mp-papel' + (x === 'visitante' ? ' vis' : '') + '">' + esc(x === 'visitante' ? 'sem entrar' : x) + '</span>').join('') + '</p>' : '') + '</article>';
}
function mpProjMeso(){
  const apps = mpApps(); if (!apps.length) return mpVazioHTML();
  const {pares, fora} = mpEntreApps();
  let h = '<div class="mp-colunas">' + apps.map(a => '<section class="mp-col"><header><h4><button type="button" class="ifr-lnk" data-mp-focar="' + esc(mpId(a)) + '">' + esc(a.nome) + '</button></h4><small>' + esc((a.dados || {}).framework || '') + '</small></header><ul class="mp-mods">' +
    (mpFilhos(a, ['modulo']).map(m => '<li><button type="button" data-mp-focar="' + esc(mpId(m)) + '">' + esc(m.nome) + '</button><small>' + esc(mpPl(mpDescendentes(m).filter(x => x.tipo === 'tela').length, 'tela', 'telas')) + '</small>' + mpPapeisHTML(m) + '</li>').join('') ||
      '<li class="mp-sem">Sem menu: ' + esc(mpPl(mpFilhos(a, ['tela']).length, 'tela solta', 'telas soltas')) + '</li>') + '</ul></section>').join('') + '</div>';
  if (pares.length || fora.length){
    // tabelas do banco usadas por mais de uma aplicação: em planilha (uma linha por tabela, quais aplicações usam)
    const usoTab = new Map(); pares.forEach(p => p.tabelas.forEach(t => { const u = usoTab.get(t) || usoTab.set(t, new Set()).get(t); u.add(p.a.nome); u.add(p.b.nome); }));
    const linhasTab = [...usoTab.entries()].sort((x, y) => y[1].size - x[1].size || x[0].localeCompare(y[0]));
    const foraL = [...new Map(fora.map(f => [mpId(f.app) + f.para, f])).values()];
    h += '<section class="mp-entre"><h4>Ligações entre as aplicações</h4>' +
      (linhasTab.length ? '<p class="ifr-vazio">Tabelas do banco que mais de uma aplicação usa.</p><div class="tabela-rolo"><table class="tabela planilha mp-entre-pl"><thead><tr><th class="pl-n">#</th><th>Tabela</th><th class="pl-num">Aplicações</th><th>Quais aplicações usam</th></tr></thead><tbody>' +
        linhasTab.map(([t, u], i) => '<tr><td class="pl-n">' + (i + 1) + '</td><td><code><b>' + esc(t) + '</b></code></td><td class="pl-num">' + u.size + '</td><td>' + [...u].sort().map(esc).join(', ') + '</td></tr>').join('') + '</tbody></table></div>' : '') +
      (foraL.length ? '<ul>' + foraL.map(f => '<li><b>' + esc(f.app.nome) + '</b> leva para <b>' + esc(f.para) + '</b> (em "' + esc(f.de.nome) + '")</li>').join('') + '</ul>' : '') + '</section>';
  }
  return h;
}
// micro (projeto e aplicação usam a mesma árvore com foco e busca; na aplicação, só a aplicação escolhida)
function mpArvoreHTML(raizes, comAlertas){
  const b = MP.busca.trim().toLowerCase();
  const casa = p => !b || (p.nome || '').toLowerCase().includes(b) || (p.descricao || '').toLowerCase().includes(b) || (p.arquivo || '').toLowerCase().includes(b);
  const al = comAlertas ? new Map() : null;
  if (al) raizes.forEach(r => mpAlertasDaApp(r).forEach(a => { const k = r.analise_id + '|' + a.peca; (al.get(k) || al.set(k, []).get(k)).push(a); }));
  const linha = (p, nivel) => {
    const fs = mpFilhos(p), mostrar = casa(p) || mpDescendentes(p).some(casa);
    if (!mostrar) return '';
    const aberto = !!b || nivel < 2 || (UI.mapaAbertos || {})[mpId(p)];
    const meus = al ? mpAbertos(al.get(mpId(p)) || []) : [];
    return '<li class="mp-ar t-' + esc(p.tipo) + (MP.foco === mpId(p) ? ' foco' : '') + '">' +
      '<div class="mp-ar-l">' + (fs.length ? '<button type="button" class="mp-ar-seta" data-mp-abrir="' + esc(mpId(p)) + '" aria-expanded="' + aberto + '" aria-label="' + (aberto ? 'Fechar' : 'Abrir') + '">' + (aberto ? '▾' : '▸') + '</button>' : '<span class="mp-ar-seta"></span>') +
      '<button type="button" class="mp-ar-nome" data-mp-focar="' + esc(mpId(p)) + '"><span class="mp-tipo">' + esc(MP_TIPOS[p.tipo] || p.tipo) + '</span>' + esc(p.nome) + '</button>' +
      (p.destino ? '<small class="mp-dest">' + esc(mpNomeDestino(p)) + '</small>' : '') + (meus.length ? mpContaHTML(meus) : '') + '</div>' +
      (fs.length && aberto ? '<ul>' + fs.map(f => linha(f, nivel + 1)).join('') + '</ul>' : '') + '</li>';
  };
  return '<ul class="mp-arvore">' + raizes.map(r => linha(r, 0)).join('') + '</ul>';
}
function mpFocoHTML(comAlertas){
  const p = MP.foco ? mpIndice().por.get(MP.foco) : null;
  if (!p) return '<aside class="mp-foco"><p class="ifr-vazio">Escolha uma peça na árvore para ver quem vê, quando aparece, para onde leva, o que lê e grava e onde está no código.</p></aside>';
  const saem = (mpIndice().saem.get(mpId(p)) || []), entram = (mpIndice().entram.get(mpId(p)) || []);
  const nomeDe = (an, k) => { if (k.startsWith('tabela:')) return 'tabela ' + k.slice(7); if (k.startsWith('funcao:')) return 'função ' + k.slice(7) + ' do banco'; if (k.startsWith('api:')) return 'serviço ' + k.slice(4); if (k.startsWith('externo:')) return k.slice(8); const x = mpPeca(an, k); return x ? x.nome : k; };
  const TL = {leva_para:'leva para', abre:'abre', chama:'chama', grava_em:'grava em', le_de:'lê de', outra_aplicacao:'leva para fora:', mesmo_dado:'mesmo dado que'};
  const pai = p.pai ? mpPeca(p.analise_id, p.pai) : null;
  const meus = comAlertas ? MP.alertas.filter(a => a.analise_id === p.analise_id && a.peca === p.chave) : [];
  return '<aside class="mp-foco" aria-live="polite"><p class="mp-tipo">' + esc(MP_TIPOS[p.tipo] || p.tipo) + mpCerteza(p) + '</p><h4>' + esc(p.nome) + '</h4>' +
    (p.descricao ? '<p class="mp-desc">' + esc(p.descricao) + '</p>' : '') +
    '<dl class="mp-dl">' +
      (pai ? '<dt>Dentro de</dt><dd><button type="button" class="ifr-lnk" data-mp-focar="' + esc(mpId(pai)) + '">' + esc(pai.nome) + '</button></dd>' : '') +
      (p.quando ? '<dt>Quando aparece</dt><dd>' + esc(p.quando) + '</dd>' : '') +
      ((p.papeis || []).length ? '<dt>Quem vê</dt><dd>' + mpPapeisHTML(p) + '</dd>' : '') +
      (p.destino ? '<dt>Para onde vai</dt><dd>' + esc(mpNomeDestino(p)) + '</dd>' : '') +
      (p.arquivo ? '<dt>No código</dt><dd>' + mpOndeHTML(p) + '</dd>' : '') +
    '</dl>' +
    (saem.length ? '<h5>Daqui</h5><ul class="mp-lig">' + saem.map(l => '<li>' + esc(TL[l.tipo] || l.tipo) + ' ' + (mpPeca(p.analise_id, l.para) ? '<button type="button" class="ifr-lnk" data-mp-focar="' + esc(p.analise_id + '|' + l.para) + '">' + esc(nomeDe(p.analise_id, l.para)) + '</button>' : '<b>' + esc(nomeDe(p.analise_id, l.para)) + '</b>') + (l.detalhe ? ' <small>(' + esc(l.detalhe) + ')</small>' : '') + '</li>').join('') + '</ul>' : '') +
    (entram.length ? '<h5>Chega aqui por</h5><ul class="mp-lig">' + entram.map(l => '<li><button type="button" class="ifr-lnk" data-mp-focar="' + esc(p.analise_id + '|' + l.de) + '">' + esc(nomeDe(p.analise_id, l.de)) + '</button> <small>' + esc(TL[l.tipo] || l.tipo) + '</small></li>').join('') + '</ul>' : '') +
    (meus.length ? '<h5>Alertas</h5>' + meus.map(a => mpAlertaHTML(a)).join('') : '') + '</aside>';
}
function mpBuscaHTML(){ return '<label class="mp-busca"><span class="sr">Buscar no mapa</span><input class="campo" type="search" data-mp-busca placeholder="Buscar tela, botão, campo ou arquivo" value="' + esc(MP.busca) + '"></label>'; }
function mpProjMicro(){
  const apps = mpApps(); if (!apps.length) return mpVazioHTML();
  return mpBuscaHTML() + '<div class="mp-micro"><div class="mp-micro-arv">' + mpArvoreHTML(apps, false) + '</div>' + mpFocoHTML(false) + '</div>';
}

/* ---------- Visões por Aplicação ---------- */
function mpSemBancoHTML(app){
  const an = app ? mpAnalise(app.analise_id) : null;
  return an && !an.com_banco ? '<p class="mp-sem-banco">Ligue o banco desta aplicação para conferir onde os dados são salvos.</p>' : '';
}
function mpEscolherAppHTML(){
  const l = mpApps(); if (l.length < 2) return '';
  const at = mpAppAtual();
  return '<div class="mp-apps" role="tablist" aria-label="Aplicação do código">' + l.map(a => '<button type="button" role="tab" class="mp-app-b" data-mp-app="' + esc(mpId(a)) + '" aria-selected="' + (a === at) + '">' + esc(a.nome) + '<small>' + esc((a.dados || {}).pasta || '') + '</small></button>').join('') + '</div>';
}
// "Colunas sem tela": numa planilha (uma linha por coluna, agrupada por tabela, cada tabela abre e fecha), conferidas com
// as funções e gatilhos do banco e com as outras aplicações
function mpColunasSemTelaHTML(app){
  const l = mpAlertasDaApp(app).filter(a => a.tipo === 'coluna_sem_tela');
  if (!l.length) return '';
  const por = new Map(); l.forEach(a => { (por.get(a.tabela) || por.set(a.tabela, []).get(a.tabela)).push(a); });
  const grupos = [...por.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const abertos = UI.mapaCstAbertas || {}, pode = podeEditar();
  const linha = (a, n) => { const pp = mpDeProposito(a), t = MP_ALERTA[a.tipo] || [a.tipo, a.gravidade];
    return '<tr class="mp-cst-col' + (pp ? ' proposito' : '') + '" data-mp-alerta="' + esc(a.id) + '"><td class="pl-n">' + n + '</td><td></td>' +
      '<td><code>' + esc(a.coluna || '(a tabela inteira)') + '</code></td>' +
      '<td><span class="mp-al-ico g-' + esc(a.gravidade) + '" title="' + esc(MP_GRAV[a.gravidade][0]) + '">' + MP_GRAV[a.gravidade][1] + '</span> ' + esc(MP_GRAV[a.gravidade][0]) + '</td>' +
      '<td class="pl-texto">' + esc(a.texto) + (pp ? '<small class="mp-al-prop">É de propósito: ' + esc(pp.motivo) + ' · ' + esc(nomePessoa(pp.por)) + ', ' + esc(mpQuando(pp.em)) + '</small>' : '') + '</td>' +
      '<td>' + (a.prova && a.prova.arquivo ? '<code>' + esc(a.prova.arquivo + (a.prova.linha ? ':' + a.prova.linha : '')) + '</code>' : '') + '</td>' +
      '<td>' + (pp ? 'É de propósito' : 'Aberta') + '</td>' +
      '<td class="pl-acoes">' + (pode ? (pp ? '<button type="button" class="ifr-lnk" data-mp-desmarcar="' + esc(a.id) + '">Desmarcar</button>' : '<button type="button" class="ifr-lnk" data-mp-proposito="' + esc(a.id) + '">É de propósito</button><button type="button" class="ifr-lnk" data-mp-item="' + esc(a.id) + '">Criar item</button>') : '') + '</td></tr>'; };
  let n = 0;
  return '<section class="mp-cst"><h4>Colunas sem tela <small>' + esc(mpPl(mpAbertos(l).length, 'aberta', 'abertas')) + ' em ' + esc(mpPl(grupos.length, 'tabela', 'tabelas')) + '</small></h4><p class="ifr-vazio">Colunas que nenhuma tela mostra ou grava, que nenhuma função ou gatilho do banco cita e que nenhuma outra aplicação usa. Clique numa tabela para abrir as colunas dela.</p>' +
    '<div class="tabela-rolo"><table class="tabela planilha mp-cst-pl"><thead><tr><th class="pl-n">#</th><th>Tabela</th><th>Coluna</th><th>Gravidade</th><th class="pl-texto">O que foi achado</th><th>Onde no código</th><th>Situação</th><th>Ações</th></tr></thead>' +
    grupos.map(([t, as]) => { const toda = as.some(a => !a.coluna), aberto = abertos[t] ?? grupos.length <= 4, ab = mpAbertos(as).length;
      return '<tbody class="mp-cst-g' + (aberto ? ' aberto' : '') + '"><tr class="mp-cst-tab" data-mp-cst="' + esc(t) + '" tabindex="0" aria-expanded="' + aberto + '"><td class="pl-n">' + (++n) + '</td>' +
        '<td colspan="2" class="pl-nome"><span class="mp-cst-seta" aria-hidden="true">' + (aberto ? '▾' : '▸') + '</span><b>' + esc(t) + '</b></td>' +
        '<td>' + mpContaHTML(as) + '</td><td>' + (toda ? 'A tabela inteira não aparece em nenhuma tela' : esc(mpPl(as.length, 'coluna sem tela', 'colunas sem tela'))) + '</td><td></td>' +
        '<td>' + (ab ? esc(mpPl(ab, 'aberta', 'abertas')) : 'Tudo de propósito') + '</td><td></td></tr>' +
        (aberto ? as.map((a, k) => linha(a, n + '.' + (k + 1))).join('') : '') + '</tbody>'; }).join('') +
    '</table></div></section>';
}
function mpAppMacro(){
  const app = mpAppAtual(); if (!app) return mpVazioHTML();
  const als = mpAlertasDaApp(app), mods = mpFilhos(app, ['modulo']), soltas = mpFilhos(app, ['tela']);
  const doMod = m => { const pref = m.chave + '/'; return als.filter(a => a.peca === m.chave || (a.peca || '').startsWith(pref)); };
  const geral = als.filter(a => a.tipo !== 'coluna_sem_tela' && !mods.some(m => a.peca === m.chave || (a.peca || '').startsWith(m.chave + '/')));
  const card = m => { const d = mpDescendentes(m), n = t => d.filter(x => x.tipo === t).length;
    return '<article class="mp-card mod"><header><h4><button type="button" class="ifr-lnk" data-mp-ir-micro="' + esc(mpId(m)) + '">' + esc(m.nome) + '</button></h4>' + mpContaHTML(doMod(m)) + '</header>' +
      '<p class="mp-nums"><span><b>' + n('tela') + '</b> telas</span><span><b>' + n('janela') + '</b> janelas</span><span><b>' + (n('botao') + n('link')) + '</b> botões</span><span><b>' + n('campo') + '</b> campos</span></p>' + mpPapeisHTML(m) + '</article>'; };
  const an = mpAnalise(app.analise_id) || {};
  return mpSemBancoHTML(app) +
    '<div class="mp-cards">' + mods.map(card).join('') + (soltas.length ? '<article class="mp-card mod"><header><h4>Fora do menu</h4>' + mpContaHTML(geral) + '</header><p class="mp-nums"><span><b>' + soltas.length + '</b> telas</span></p><p class="ifr-vazio">' + esc(soltas.map(t => t.nome).slice(0, 6).join(', ')) + '</p></article>' : '') + '</div>' +
    (!mods.length && !soltas.length ? '<p class="ifr-vazio">Nenhum módulo achado nesta aplicação.</p>' : '') +
    (mpAbertos(geral).length ? '<section class="mp-geral"><h4>Alertas da aplicação inteira</h4>' + geral.map(a => mpAlertaHTML(a)).join('') + '</section>' : '') +
    mpColunasSemTelaHTML(app) + mpLacunasHTML(an.lacunas || []);
}
function mpAppMeso(){
  const app = mpAppAtual(); if (!app) return mpVazioHTML();
  const als = mpAlertasDaApp(app), mods = mpFilhos(app, ['modulo']).concat(mpFilhos(app, ['tela']).length ? [{analise_id:app.analise_id, chave:app.chave, nome:'Fora do menu', tipo:'modulo', _solto:true}] : []);
  const moduloDaChave = k => mods.find(m => !m._solto && (k === m.chave || k.startsWith(m.chave + '/')));
  return mpSemBancoHTML(app) + '<div class="mp-colunas">' + mods.map(m => {
    const telas = m._solto ? mpFilhos(app, ['tela']) : mpDescendentes(m).filter(x => x.tipo === 'tela');
    const outros = new Map(), fora = new Set();
    (m._solto ? telas.flatMap(t => [t, ...mpDescendentes(t)]) : [m, ...mpDescendentes(m)]).forEach(p => (mpIndice().saem.get(mpId(p)) || []).forEach(l => {
      if (l.para.startsWith('externo:')) { fora.add(l.para.slice(8).replace(/^https?:\/\//, '')); return; }
      const alvo = moduloDaChave(l.para); if (alvo && alvo !== m && (l.tipo === 'leva_para' || l.tipo === 'abre')) outros.set(alvo.chave, alvo);
    }));
    const doMod = m._solto ? [] : als.filter(a => a.peca === m.chave || (a.peca || '').startsWith(m.chave + '/'));
    return '<section class="mp-col"><header><h4>' + esc(m.nome) + '</h4>' + mpContaHTML(doMod) + '</header>' +
      '<ul class="mp-mods">' + telas.map(t => '<li><button type="button" data-mp-ir-micro="' + esc(mpId(t)) + '">' + esc(t.nome) + '</button>' +
        (mpFilhos(t, ['janela']).length ? '<ul class="mp-jan">' + mpFilhos(t, ['janela']).map(j => '<li><span class="mp-tipo">Janela</span><button type="button" data-mp-ir-micro="' + esc(mpId(j)) + '">' + esc(j.nome) + '</button></li>').join('') + '</ul>' : '') + '</li>').join('') + '</ul>' +
      (outros.size ? '<p class="mp-vai">Leva para ' + [...outros.values()].map(o => '<b>' + esc(o.nome) + '</b>').join(', ') + '</p>' : '') +
      (fora.size ? '<p class="mp-vai fora">Para fora: ' + [...fora].map(f => esc(f)).join(', ') + '</p>' : '') + '</section>';
  }).join('') + '</div>';
}
// micro da aplicação: cada tela e janela em detalhe, com o alerta ao lado do que ele fala
function mpAppMicro(){
  const app = mpAppAtual(); if (!app) return mpVazioHTML();
  const an = mpAnalise(app.analise_id) || {}, als = mpAlertasDaApp(app), b = MP.busca.trim().toLowerCase();
  const alDe = p => als.filter(a => a.peca === p.chave);
  const casa = p => !b || [p, ...mpDescendentes(p)].some(x => (x.nome || '').toLowerCase().includes(b) || (x.arquivo || '').toLowerCase().includes(b));
  const item = p => {
    const det = [mpNomeDestino(p), (p.dados || {}).vai_para && p.tipo === 'campo' && !(p.dados.vai_para || []).length ? 'não vai para lugar nenhum' : ''].filter(Boolean).join(' · ');
    return '<li class="mp-el t-' + esc(p.tipo) + (MP.foco === mpId(p) ? ' foco' : '') + '" id="mp-' + esc(mpId(p).replace(/[^\w-]/g, '_')) + '"><div class="mp-el-l"><span class="mp-tipo">' + esc(MP_TIPOS[p.tipo] || p.tipo) + '</span><b>' + esc(p.nome) + '</b>' +
      (det ? '<small class="mp-dest">' + esc(det) + '</small>' : '') + mpPapeisHTML(p) + mpOndeHTML(p) + mpCerteza(p) + '</div>' +
      alDe(p).map(a => mpAlertaHTML(a)).join('') + (p.descricao ? '<p class="mp-desc">' + esc(p.descricao) + '</p>' : '') + '</li>';
  };
  const bloco = (t, nivel) => {
    const els = mpFilhos(t).filter(x => !['tela', 'janela', 'modulo'].includes(x.tipo));
    const jans = mpFilhos(t, ['janela']);
    return '<section class="mp-bloco t-' + esc(t.tipo) + (MP.foco === mpId(t) ? ' foco' : '') + '" id="mp-' + esc(mpId(t).replace(/[^\w-]/g, '_')) + '"><header><span class="mp-tipo">' + esc(MP_TIPOS[t.tipo]) + '</span><h4>' + esc(t.nome) + '</h4>' + mpPapeisHTML(t) + mpOndeHTML(t) + '</header>' +
      (t.quando ? '<p class="mp-quando">Aparece ' + esc(t.quando) + '.</p>' : '') + alDe(t).map(a => mpAlertaHTML(a)).join('') +
      (els.length ? '<ul class="mp-els">' + els.map(item).join('') + '</ul>' : '<p class="ifr-vazio">Nada para clicar ou preencher aqui.</p>') +
      jans.map(j => bloco(j, nivel + 1)).join('') + '</section>';
  };
  const grupos = [...mpFilhos(app, ['modulo']).map(m => [m, mpDescendentes(m).filter(x => x.tipo === 'tela')]), ...(mpFilhos(app, ['tela']).length ? [[null, mpFilhos(app, ['tela'])]] : [])];
  const solto = mpFilhos(app).filter(x => !['tela', 'modulo'].includes(x.tipo));
  let h = mpSemBancoHTML(app) + mpBuscaHTML();
  grupos.forEach(([m, telas]) => { const v = telas.filter(casa); if (!v.length) return;
    h += '<div class="mp-grupo"><h3>' + (m ? esc(m.nome) + alDe(m).map(a => mpAlertaHTML(a, true)).join('') : 'Fora do menu') + '</h3>' + v.map(t => bloco(t, 0)).join('') + '</div>'; });
  if (solto.length) h += '<div class="mp-grupo"><h3>Na aplicação inteira</h3><ul class="mp-els">' + solto.map(item).join('') + '</ul></div>';
  const gerais = als.filter(a => a.peca === app.chave);
  if (gerais.length) h += '<div class="mp-grupo"><h3>Alertas do código</h3>' + gerais.map(a => mpAlertaHTML(a)).join('') + '</div>';
  return h + mpLacunasHTML(an.lacunas || []);
}

/* ---------- a tela ---------- */
function mpTelaHTML(){
  const esc0 = mpEscopo(), v = mpVisao(), V = MP_VISOES[esc0];
  return '<div class="mp-tela" data-mp-tela="' + esc(UI.sel) + '">' +
    '<div class="mp-cab"><div><h2>' + (esc0 === 'projeto' ? 'Visões por Projeto' : 'Visões por Aplicação') + '</h2><p class="lead">' + esc((V.find(x => x[0] === v) || V[0])[2]) + ' Tirado do código e do banco ligados, como estão agora.</p></div>' +
    '<div class="mp-niveis" role="tablist" aria-label="Nível de detalhe">' + V.map(([k, n]) => '<button type="button" role="tab" class="mp-nivel" data-mp-visao="' + k + '" aria-selected="' + (k === v) + '">' + n + '</button>').join('') + '</div></div>' +
    '<div data-mp-status>' + (MP.chave === UI.sel ? mpStatusHTML() : '') + '</div>' +
    (esc0 === 'aplicacao' ? '<div data-mp-apps>' + mpEscolherAppHTML() + '</div>' : '') +
    '<div class="mp-corpo" data-mp-corpo>' + (MP.chave !== UI.sel || MP.carregando ? '<p class="vazio-linha">Lendo o mapa…</p>' : mpCorpoHTML()) + '</div></div>';
}
function mpCorpoHTML(){
  if (MP.erro) return '<p class="entrada-erro">Não deu para ler o mapa: ' + esc(MP.erro) + '</p>';
  const f = {projeto:{macro:mpProjMacro, meso:mpProjMeso, micro:mpProjMicro}, aplicacao:{macro:mpAppMacro, meso:mpAppMeso, micro:mpAppMicro}}[mpEscopo()][mpVisao()];
  return f();
}
function mpRender(){
  const c = $('#ops-corpo .mp-casa'); if (!c) return;
  const y = window.scrollY, foco = document.activeElement && document.activeElement.matches('[data-mp-busca]') ? document.activeElement.selectionStart : null;
  c.innerHTML = mpTelaHTML();
  if (foco !== null){ const i = c.querySelector('[data-mp-busca]'); if (i){ i.focus(); try { i.setSelectionRange(foco, foco); } catch(e){} } }
  window.scrollTo(0, y);
}
// a janela Ligações (infra_auto.js) é a mesma dos Desenhos: lê o código e os bancos do ponto escolhido
function mpLigacoesDoPonto(){
  if (typeof ifrAutoCarregar !== 'function' || typeof IFR_AUTO === 'undefined') return;
  const no = (UI.sel || '').split(':')[1];
  if (IFR.no === no && IFR_AUTO.no === no && IFR_AUTO.carregado) return;
  IFR.chave = UI.sel; IFR.no = no; IFR_AUTO.carregado = false;
  ifrAutoCarregar().then(() => { document.querySelectorAll('#ops-corpo .mp-casa [data-ifr-lig]').forEach(b => { b.outerHTML = ifrLigBotaoHTML(); }); if (typeof ifrLigRender === 'function') ifrLigRender(); });
}
function mpAbrir(forcar){
  mpLigacoesDoPonto();
  mpRender();
  mpCarregar(forcar).then(() => { if (UI.view === 'infra' && mpModo() === 'mapa') mpRender(); });
}
// a troca "Como está" | "Desenhos" no topo da Infraestrutura (Como está abre primeiro)
function mpTrocaHTML(){
  const m = mpModo();
  return '<div class="mp-troca" role="tablist" aria-label="O que ver na Infraestrutura"><button type="button" role="tab" data-mp-modo="mapa" aria-selected="' + (m === 'mapa') + '">Como está</button><button type="button" role="tab" data-mp-modo="desenhos" aria-selected="' + (m === 'desenhos') + '">Desenhos</button></div>';
}
const _rViewMp = rView;
rView = function(){
  const c = $('#ops-corpo');
  if (c && UI.view === 'infra' && ifrPodeTer(UI.sel) && mpModo() === 'mapa'){
    const casa = c.querySelector('.mp-casa');
    if (casa && casa.dataset.sel === UI.sel){ mpRender(); smAgruparAbas(); return; }
    c.innerHTML = '<div class="mp-casa" data-sel="' + esc(UI.sel) + '"></div>';
    c.insertAdjacentHTML('afterbegin', mpTrocaHTML());
    smAgruparAbas();
    mpAbrir(false);
    return;
  }
  const r = _rViewMp.apply(this, arguments);
  if (c && UI.view === 'infra' && ifrPodeTer(UI.sel) && !c.querySelector('.mp-troca')) c.insertAdjacentHTML('afterbegin', mpTrocaHTML());
  return r;
};

/* ---------- ações ---------- */
async function mpPedir(){
  const sb = mpBanco(); if (!sb) return;
  const no = (UI.sel || '').split(':')[1];
  MP.pedindo = true; mpRender();
  const {data, error} = await sb.rpc('mapa_pedir', {p_no:no});
  MP.pedindo = false;
  if (error) toast(error.message || 'Não deu para pedir a análise');
  else toast(data ? 'Pedido feito: o mapa fica pronto em alguns minutos.' : 'Já está na fila.');
  mpAbrir(true);
}
function mpProposito(a){
  const an = mpAnalise(a.analise_id); if (!an) return;
  modal('É de propósito', '<p class="intro">' + esc(a.texto) + '</p><label class="lb">Por que é assim de propósito? (obrigatório)<textarea class="campo" id="mp-motivo" rows="3" maxlength="500" placeholder="Ex.: o filtro da lista fica só no navegador de cada pessoa"></textarea></label><p class="ifr-vazio">O alerta some enquanto este trecho do código não mudar. Se o código mudar, ele volta para alguém olhar de novo.</p>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Marcar', acao:d => {
      const m = $('#mp-motivo', d).value.trim(); if (m.length < 3){ toast('Escreva o motivo'); return false; }
      mpBanco().rpc('mapa_proposito_marcar', {p_no:an.no_id, p_impressao:a.impressao, p_motivo:m}).then(({error}) => { if (error) toast(error.message); else { toast('Marcado como de propósito'); mpAbrir(true); } });
    }}]);
}
async function mpDesmarcar(a){
  const an = mpAnalise(a.analise_id); if (!an) return;
  const {error} = await mpBanco().rpc('mapa_proposito_tirar', {p_no:an.no_id, p_impressao:a.impressao});
  if (error) toast(error.message); else { toast('Desmarcado'); mpAbrir(true); }
}
// um alerta vira item do backlog: abre o Novo item já preenchido (a pessoa escolhe onde e confere antes de criar)
function mpCriarItem(a){
  const p = mpPeca(a.analise_id, a.peca), t = MP_ALERTA[a.tipo] || [a.tipo];
  novoItem();
  const d = [...document.querySelectorAll('dialog.modal')].pop(); if (!d) return;
  const tt = $('#ni-t', d), ds = $('#ni-d', d), tp = $('#ni-tipo', d);
  if (tt) tt.value = (t[0] + ': ' + a.texto).slice(0, 200);
  if (tp && a.gravidade === 'erro' && [...tp.options].some(o => o.value === 'bug')) tp.value = 'bug';
  if (ds) ds.value = 'Achado pelo Mapa do Sistema (Infraestrutura > Como está).\n' + a.texto + (p ? '\nOnde: ' + p.nome + (p.arquivo ? ' (' + p.arquivo + (p.linha ? ':' + p.linha : '') + ')' : '') : '') + (a.tabela ? '\nTabela: ' + a.tabela + (a.coluna ? ', coluna ' + a.coluna : '') : '') + (a.prova && a.prova.arquivo ? '\nNo código: ' + a.prova.arquivo + (a.prova.linha ? ':' + a.prova.linha : '') : '');
}
const mpAlertaPorId = id => MP.alertas.find(a => String(a.id) === String(id));
document.addEventListener('click', e => {
  const t = e.target;
  const md = t.closest('[data-mp-modo]'); if (md){ if (md.dataset.mpModo !== mpModo()){ UI.infraModo = md.dataset.mpModo; salvarUI(); const c = $('#ops-corpo'); if (c) c.innerHTML = ''; rView(); } return; }
  if (!t.closest('#ops-corpo .mp-casa') && !t.closest('dialog.modal')) return;
  const v = t.closest('[data-mp-visao]'); if (v){ UI.mapaVisao = Object.assign({}, UI.mapaVisao, {[mpEscopo()]:v.dataset.mpVisao}); salvarUI(); mpRender(); return; }
  const ap = t.closest('[data-mp-app]'); if (ap){ UI.mapaApp = Object.assign({}, UI.mapaApp, {[UI.sel]:ap.dataset.mpApp}); salvarUI(); mpRender(); return; }
  if (t.closest('[data-mp-pedir]')) return mpPedir();
  const cs = t.closest('[data-mp-cst]'); if (cs && !t.closest('button')){ const k = cs.dataset.mpCst, ja = (UI.mapaCstAbertas || {})[k]; UI.mapaCstAbertas = Object.assign({}, UI.mapaCstAbertas, {[k]:!(ja ?? cs.getAttribute('aria-expanded') === 'true')}); mpRender(); return; }
  const ab = t.closest('[data-mp-abrir]'); if (ab){ const k = ab.dataset.mpAbrir; UI.mapaAbertos = Object.assign({}, UI.mapaAbertos, {[k]:!(UI.mapaAbertos || {})[k]}); mpRender(); return; }
  const fc = t.closest('[data-mp-focar]'); if (fc){ MP.foco = fc.dataset.mpFocar; if (mpVisao() !== 'micro'){ UI.mapaVisao = Object.assign({}, UI.mapaVisao, {[mpEscopo()]:'micro'}); salvarUI(); }
    const p = mpIndice().por.get(MP.foco); if (p) for (let x = p.pai ? mpPeca(p.analise_id, p.pai) : null; x; x = x.pai ? mpPeca(x.analise_id, x.pai) : null) UI.mapaAbertos = Object.assign({}, UI.mapaAbertos, {[mpId(x)]:true});
    mpRender(); return; }
  const im = t.closest('[data-mp-ir-micro]'); if (im){ MP.foco = im.dataset.mpIrMicro; UI.mapaVisao = Object.assign({}, UI.mapaVisao, {[mpEscopo()]:'micro'}); salvarUI(); mpRender();
    const el = document.getElementById('mp-' + MP.foco.replace(/[^\w-]/g, '_')); if (el) el.scrollIntoView({block:'start', behavior:'smooth'}); return; }
  const pr = t.closest('[data-mp-proposito]'); if (pr){ const a = mpAlertaPorId(pr.dataset.mpProposito); if (a) mpProposito(a); return; }
  const dm = t.closest('[data-mp-desmarcar]'); if (dm){ const a = mpAlertaPorId(dm.dataset.mpDesmarcar); if (a) mpDesmarcar(a); return; }
  const it = t.closest('[data-mp-item]'); if (it){ const a = mpAlertaPorId(it.dataset.mpItem); if (a) mpCriarItem(a); return; }
  if (t.closest('[data-ifr-ligacoes]') && typeof ifrLigAbrir === 'function'){ mpLigacoesDoPonto(); ifrLigAbrir(); }
});
let mpBuscaT = 0;
document.addEventListener('input', e => {
  if (!e.target.matches('#ops-corpo [data-mp-busca]')) return;
  MP.busca = e.target.value; clearTimeout(mpBuscaT); mpBuscaT = setTimeout(mpRender, 180);
});
// ao vivo: quando a análise muda (fila, rodando, pronta) ou alguém marca "é de propósito", a tela relê sozinha
setTimeout(() => { try { if (typeof avOuvir === 'function') avOuvir(['mapa_analises', 'mapa_proposito'], () => { if (UI.view === 'infra' && mpModo() === 'mapa') mpAbrir(true); }); } catch(e){} }, 0);
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {MP, mpCarregar, mpRender, mpTelaHTML, mpAlertasDaApp, mpEntreApps, mpApps, mpModo, mpCriarItem, mpProposito});
// abrir e fechar uma tabela da planilha pelo teclado (Enter ou espaço)
document.addEventListener('keydown', e => { const cs = e.target.closest && e.target.closest('[data-mp-cst]'); if (cs && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); cs.click(); } });
