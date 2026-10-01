/* ===== Aba Segurança: a análise automática do código e do banco =====
   O robô (função diagramas-auto) lê o código de cada repositório ligado e a estrutura de cada banco ligado, passa as
   regras de segurança (supabase/functions/diagramas-auto/seguranca.ts, nascidas dos guias da OWASP) e grava os achados
   (parte 43). Aqui a pessoa vê a nota, o que achou, por que importa, como corrigir e a fonte; cria o Bug de cada achado,
   ou ignora com motivo. Quando o achado some do código ou do banco, ele aparece como corrigido sozinho.
   O catálogo de regras (SG_REGRAS) vem do mesmo arquivo da função, juntado pelo build.py: fonte única. */
const SG = {chave:null, achados:[], rodadas:[], inventario:[], carregando:false, erro:'', filtro:'aberto', area:'', tipo:''};
// o tipo de cada regra pelo código: QUA = qualidade do código, ARQ = arquitetura do banco, o resto é segurança
const sgTipo = regra => /^QUA-/.test(regra) ? 'qualidade' : /^ARQ-/.test(regra) ? 'arquitetura' : 'seguranca';
const SG_TIPOS = {seguranca:'Segurança', qualidade:'Qualidade do código', arquitetura:'Arquitetura do banco'};
const SG_GRAV = {critica:['Crítica', 'Corrigir hoje: alguém de fora consegue explorar.'], alta:['Alta', 'Corrigir nesta versão.'], media:['Média', 'Planejar a correção.'], baixa:['Baixa', 'Melhoria de boa prática.']};
const SG_ORDEM = {critica:0, alta:1, media:2, baixa:3};
const sgRegra = id => (typeof SG_REGRAS !== 'undefined' ? SG_REGRAS : []).find(r => r.id === id) || {id, titulo:id, porque:'', correcao:'', fonte:''};
const sgPodeTer = sel => /^(project|product|app):/.test(sel || '');
// o ponto escolhido e o que está dentro dele (o projeto mostra também os produtos e as aplicações)
function sgNos(sel){
  const [t, id] = (sel || '').split(':');
  if (t === 'app') return [id];
  if (t === 'product') return [id].concat(D.apps.filter(a => a.product === id).map(a => a.id));
  if (t === 'project') return [id].concat(D.products.filter(p => p.project === id).map(p => p.id), D.apps.filter(a => a.project === id).map(a => a.id));
  return [];
}
const sgBanco = () => (typeof COM_BANCO !== 'undefined' && COM_BANCO && window.ciclodevBanco && BANCO.carregado) ? window.ciclodevBanco : null;
async function sgCarregar(){
  const sb = sgBanco(), nos = sgNos(UI.sel), chave = UI.sel;
  SG.chave = chave; SG.carregando = true; SG.erro = '';
  if (!sb){ SG.achados = []; SG.rodadas = []; SG.carregando = false; return; }
  try {
    const [a, r, v] = await Promise.all([
      sb.from('analise_achados').select('id, no_id, origem, rotulo, regra, gravidade, titulo, onde, trecho, status, motivo, item_id, referencia, vezes, primeiro_em, ultimo_em, corrigido_em').in('no_id', nos).order('ultimo_em', {ascending:false}).limit(2000),
      sb.from('analise_rodadas').select('no_id, origem, rotulo, referencia, arquivos, abertos, novos, corrigidos, avisos, rodou_em').in('no_id', nos),
      sb.from('analise_inventario').select('id, no_id, origem, rotulo, tipo, chave, grupo, nome, onde, sinais, item_id').in('no_id', nos).limit(5000)]);
    if (a.error) throw a.error; if (r.error) throw r.error;
    if (SG.chave !== chave) return;
    SG.achados = a.data || []; SG.rodadas = r.data || []; SG.inventario = v.error ? [] : (v.data || []);
  } catch (e){ SG.erro = e.message || String(e); }
  SG.carregando = false;
  // o que o robô leu e ainda não virou item é montado sozinho
  const novos = SG.inventario.filter(x => !x.item_id);
  if (novos.length && podeEditar() && !SG.importando && SG.chave === chave) setTimeout(() => sgImportarAgora(novos, {auto:true}), 0);
}
function sgNota(lista){ const p = {critica:25, alta:10, media:4, baixa:1}; return Math.max(0, 100 - lista.reduce((s, a) => s + (p[a.gravidade] || 0), 0)); }
const sgQuando = ts => { if (!ts) return ''; const m = Math.round((Date.now() - new Date(ts).getTime()) / 60000); if (m < 1) return 'agora'; if (m < 60) return 'há ' + m + ' min'; const h = Math.round(m / 60); if (h < 24) return 'há ' + h + ' h'; const d = Math.round(h / 24); return d === 1 ? 'ontem' : 'há ' + d + ' dias'; };
function sgTelaHTML(){
  const pode = podeEditar(), sb = sgBanco();
  if (!sb) return '<div class="sg-tela"><p class="sg-vazio">A análise de segurança precisa do banco do CicloDev ligado.</p></div>';
  if (SG.carregando && !SG.achados.length) return '<div class="sg-tela"><p class="sg-vazio">Carregando a análise…</p></div>';
  if (SG.erro) return '<div class="sg-tela"><p class="entrada-erro">Não deu para ler a análise: ' + esc(SG.erro) + '</p></div>';
  const abertos = SG.achados.filter(a => a.status === 'aberto'), n = sgNota(abertos.filter(a => sgTipo(a.regra) === 'seguranca'));
  const cont = g => abertos.filter(a => a.gravidade === g && sgTipo(a.regra) === 'seguranca').length;
  const contTipo = t => abertos.filter(a => sgTipo(a.regra) === t).length;
  const cor = n >= 85 ? 'bom' : n >= 60 ? 'medio' : 'ruim';
  const fontes = SG.rodadas.slice().sort((a, b) => String(b.rodou_em).localeCompare(String(a.rodou_em)));
  const lista = SG.achados.filter(a => a.status === SG.filtro && (!SG.tipo || sgTipo(a.regra) === SG.tipo) && (!SG.area || (SG.area === 'codigo' ? a.origem.startsWith('repo:') : a.origem.startsWith('banco:'))))
    .sort((a, b) => SG_ORDEM[a.gravidade] - SG_ORDEM[b.gravidade] || a.onde.localeCompare(b.onde));
  const n2 = st => SG.achados.filter(a => a.status === st && (!SG.tipo || sgTipo(a.regra) === SG.tipo)).length;
  const semItem = abertos.filter(a => !a.item_id && (a.gravidade === 'critica' || a.gravidade === 'alta'));
  const inv = SG.inventario, invNovo = inv.filter(x => !x.item_id);
  let h = '<div class="sg-tela"><section class="sg-topo"><div class="sg-nota sg-' + cor + '"><b>' + (fontes.length ? n : '–') + '</b><span>nota de segurança</span></div>' +
    '<div class="sg-resumo"><h3>Análise do código e do banco</h3><p>O CicloDev lê o código e o banco ligados a este ' + (UI.sel.startsWith('project:') ? 'projeto (e aos produtos e aplicações dele)' : UI.sel.startsWith('product:') ? 'produto (e às aplicações dele)' : 'ponto') + ' a cada publicação e confere as regras de segurança (guias da OWASP), de qualidade do código e de arquitetura do banco. Nada é mudado no seu sistema: ele só lê.</p>' +
    '<div class="sg-contas">' + ['critica','alta','media','baixa'].map(g => '<span class="sg-conta sg-g-' + g + '"><b>' + cont(g) + '</b>' + SG_GRAV[g][0] + '</span>').join('') + '</div>' +
    '<p class="sg-outros">Além da segurança: <b>' + contTipo('qualidade') + '</b> de qualidade do código e <b>' + contTipo('arquitetura') + '</b> de arquitetura do banco (não entram na nota).</p>' +
    '<div class="sg-acoes">' + (pode ? '<button type="button" class="btn peq" data-sg-analisar>Analisar agora</button>' : '') + (pode && semItem.length ? '<button type="button" class="btn sec peq" data-sg-lote>Criar os ' + semItem.length + ' itens de críticos e altos</button>' : '') + '</div></div>' +
    '<div class="sg-fontes"><h4>O que foi lido</h4>' + (fontes.length ? fontes.map(f => '<div class="sg-fonte"><b>' + esc(f.rotulo || (f.origem.startsWith('repo:') ? 'Repositório' : 'Banco')) + '</b><span>' + (f.origem.startsWith('repo:') ? 'código' : 'banco') + ' · ' + esc(sgQuando(f.rodou_em)) + (f.arquivos != null ? ' · ' + f.arquivos + (f.origem.startsWith('repo:') ? ' arquivos' : ' tabelas') : '') + '</span>' +
      '<span>' + f.abertos + ' abertos' + (f.novos ? ' · ' + f.novos + ' novos' : '') + (f.corrigidos ? ' · ' + f.corrigidos + ' corrigidos' : '') + '</span>' + (f.avisos ? '<small>' + esc(f.avisos) + '</small>' : '') + '</div>').join('')
      : '<p class="sg-vazio">Ainda não rodou. Ligue um repositório ou um banco na aba Infraestrutura (painel Automático) e clique em Analisar agora.</p>') + '</div></section>' + sgInventarioHTML(inv, invNovo, pode);
  h += '<div class="sg-filtros" role="group" aria-label="Filtrar achados">' + [['aberto','Abertos'],['corrigido','Corrigidos'],['ignorado','Ignorados']].map(([k, r]) => '<button type="button" class="sg-f' + (SG.filtro === k ? ' sel' : '') + '" data-sg-filtro="' + k + '" aria-pressed="' + (SG.filtro === k) + '">' + r + ' <b>' + n2(k) + '</b></button>').join('') +
    '<span class="espaco"></span><select class="sel peq" data-sg-tipo aria-label="Tipo"><option value="">Todos os tipos</option>' + Object.entries(SG_TIPOS).map(([k, r]) => '<option value="' + k + '"' + (SG.tipo === k ? ' selected' : '') + '>' + r + '</option>').join('') + '</select><select class="sel peq" data-sg-area aria-label="Onde"><option value="">Código e banco</option><option value="codigo"' + (SG.area === 'codigo' ? ' selected' : '') + '>Só código</option><option value="banco"' + (SG.area === 'banco' ? ' selected' : '') + '>Só banco</option></select></div>';
  if (!lista.length) h += '<p class="sg-vazio">' + (SG.filtro === 'aberto' ? (fontes.length ? 'Nenhum achado aberto. Bom trabalho!' : 'Nada para mostrar ainda.') : SG.filtro === 'corrigido' ? 'Nenhum achado corrigido ainda. Quando um achado some do código ou do banco, ele aparece aqui.' : 'Nenhum achado ignorado.') + '</p>';
  let grav = null;
  lista.slice(0, 300).forEach(a => {
    if (a.gravidade !== grav){ grav = a.gravidade; h += '<h4 class="sg-sec sg-g-' + grav + '">' + SG_GRAV[grav][0] + ' <small>' + SG_GRAV[grav][1] + '</small></h4>'; }
    const r = sgRegra(a.regra), it = a.item_id && byId('issues', a.item_id);
    h += '<article class="sg-ach sg-g-' + a.gravidade + '" data-sg-id="' + esc(a.id) + '"><header><span class="sg-reg">' + esc(a.regra) + '</span>' + (sgTipo(a.regra) !== 'seguranca' ? '<span class="sg-selo">' + SG_TIPOS[sgTipo(a.regra)] + '</span>' : '') + '<b>' + esc(a.titulo) + '</b>' +
      (a.status === 'corrigido' ? '<span class="sg-selo ok">Corrigido ' + esc(sgQuando(a.corrigido_em)) + '</span>' : a.status === 'ignorado' ? '<span class="sg-selo">Ignorado</span>' : a.vezes > 1 ? '<span class="sg-selo">visto ' + a.vezes + ' vezes</span>' : '<span class="sg-selo novo">novo</span>') + '</header>' +
      '<p class="sg-onde"><span>' + esc(a.rotulo) + '</span> · <code>' + esc(a.onde) + '</code></p>' + (a.trecho ? '<pre class="sg-trecho">' + esc(a.trecho) + '</pre>' : '') +
      '<details class="sg-det"' + (a.gravidade === 'critica' && a.status === 'aberto' ? ' open' : '') + '><summary>Por que importa e como corrigir</summary><p><b>Por que importa.</b> ' + esc(r.porque) + '</p><p><b>Como corrigir.</b> ' + esc(r.correcao) + '</p><p class="sg-fontetxt">Fonte: ' + esc(r.fonte) + '</p></details>' +
      (a.motivo ? '<p class="sg-motivo">Ignorado: ' + esc(a.motivo) + '</p>' : '') +
      '<div class="sg-bts">' + (it ? '<button type="button" class="btn sec peq" data-abrir-item="' + esc(it.id) + '">Abrir ' + esc((typeof chaveDe === 'function' && chaveDe(it)) || 'o item') + '</button>' : (pode && a.status === 'aberto' ? '<button type="button" class="btn peq" data-sg-item="' + esc(a.id) + '">Criar item para corrigir</button>' : '')) +
        (pode && a.status === 'aberto' ? '<button type="button" class="btn fant peq" data-sg-ignorar="' + esc(a.id) + '">Ignorar com motivo</button>' : '') + (pode && a.status === 'ignorado' ? '<button type="button" class="btn fant peq" data-sg-reabrir="' + esc(a.id) + '">Voltar a considerar</button>' : '') + '</div></article>';
  });
  if (lista.length > 300) h += '<p class="sg-vazio">E mais ' + (lista.length - 300) + ' achados.</p>';
  return h + '</div>';
}
// ---------- o que já existe: importar como épicos e itens ----------
const SG_INV_TIPO = {tela:'Telas', api:'APIs', job:'Tarefas agendadas', tabela:'Tabelas', integracao:'Integrações', infra:'Infraestrutura', teste:'Testes'};
function sgMotivos(x){ const s = x.sinais || {}, m = [];
  if (s.todo) m.push(s.todo + (s.todo === 1 ? ' marca TODO/FIXME no arquivo' : ' marcas TODO/FIXME no arquivo'));
  if (s.inacabado) m.push('o código diz "' + s.inacabado + '"');
  if (x.tipo === 'tabela' && s.usada === false) m.push('o código não usa esta tabela');
  return m; }
function sgInventarioHTML(inv, novo, pode){
  if (!inv.length) return '';
  const por = t => inv.filter(x => x.tipo === t).length, prontos = novo.filter(x => !sgMotivos(x).length).length;
  return '<section class="sg-inv"><div><h4>O que já existe no sistema</h4><p>' + Object.keys(SG_INV_TIPO).filter(t => por(t)).map(t => '<b>' + por(t) + '</b> ' + SG_INV_TIPO[t].toLowerCase()).join(' · ') +
    '. ' + (novo.length ? novo.length + ' ainda não viraram itens (' + prontos + ' parecem prontos).' : 'Tudo já virou item.') + '</p></div>' +
    (pode && novo.length ? '<button type="button" class="btn peq" data-sg-importar>Importar como épicos e itens</button>' : '') + '</section>';
}
function sgImportar(){
  const novo = SG.inventario.filter(x => !x.item_id); if (!novo.length){ toast('Tudo já virou item.'); return; }
  const tipos = Object.keys(SG_INV_TIPO).filter(t => novo.some(x => x.tipo === t));
  const grupos = [...new Set(novo.map(x => x.grupo))];
  modal('Importar o que já existe', '<p>O CicloDev cria um <b>épico</b> para cada grupo (módulo, controlador ou família de tabelas) e um <b>item</b> para cada tela, API, tarefa ou tabela, com onde está no código e o que foi visto.</p>' +
    '<ul class="sg-imp-regras"><li><b>Já pronto</b> (sem TODO, sem "não implementado", tabela usada pelo código): entra como <b>Concluído</b>, como se tivesse sido feito aqui desde o começo. Mudança daqui para frente vira Melhoria.</li><li><b>Precisa análise</b>: entra em <b>Criado</b>, com o motivo escrito no item e o critério "Conferir o que falta".</li></ul>' +
    '<fieldset class="sg-imp-tipos"><legend>O que importar</legend>' + tipos.map(t => { const n = novo.filter(x => x.tipo === t).length, ok = novo.filter(x => x.tipo === t && !sgMotivos(x).length).length;
      return '<label class="cm-ck"><input type="checkbox" data-sg-imp-tipo="' + t + '"' + (t === 'tabela' && n > 60 ? '' : ' checked') + '> ' + SG_INV_TIPO[t] + ' <small>' + n + ' (' + ok + ' prontos, ' + (n - ok) + ' para analisar)</small></label>'; }).join('') + '</fieldset>' +
    '<p class="sec">' + grupos.length + (grupos.length === 1 ? ' épico' : ' épicos') + ' no total. Épico com o mesmo nome de um que já existe recebe os itens, sem duplicar. O que já foi importado não entra de novo.' + (novo.some(x => x.tipo === 'tabela') && novo.filter(x => x.tipo === 'tabela').length > 60 ? ' As tabelas vêm desmarcadas porque são muitas: marque se quiser um item por tabela.' : '') + '</p>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Importar', acao:d => { const marcados = [...d.querySelectorAll('[data-sg-imp-tipo]:checked')].map(x => x.dataset.sgImpTipo); if (!marcados.length){ toast('Marque o que importar'); return false; }
      sgImportarAgora(novo.filter(x => marcados.includes(x.tipo))); }}]);
}
// o que já existe entra como se tivesse sido feito no CicloDev desde o começo: o que parece pronto nasce Concluído
// (sem critério pendente, para não travar o aceite); o que tem sinal de inacabado entra em Criado, com o motivo.
async function sgImportarAgora(lista, opc = {}){
  const sb = sgBanco(); if (!sb || SG.importando) return;
  SG.importando = true;
  const criados = [], epicos = {}, novosEp = new Set();
  for (const x of lista){
    const w = sgFrentePara(x.no_id, frAssuntoInventario(x)); if (!w) continue;
    const ap = w.app, chaveEp = ap + '|' + x.grupo;
    let ep = epicos[chaveEp] || D.issues.find(i => i.tipo === 'epic' && !i.arquivado && i.titulo.toLowerCase() === x.grupo.toLowerCase() && (byId('ws', i.ws) || {}).app === ap);
    if (!ep){ ep = novoIssue({titulo:x.grupo.slice(0, 300), ws:w.id, tipo:'epic', status:'todo'}); ep.desc = 'Épico criado pela importação do que já existe no sistema (análise automática do código e do banco).'; if (typeof garantirBoard === 'function') garantirBoard({issues:[ep], boards:D.boards, equipes:D.equipes}); D.issues.push(ep); registrar('criou', ep); novosEp.add(ep.id); }
    epicos[chaveEp] = ep;
    const m = sgMotivos(x), s = x.sinais || {};
    const it = novoIssue({titulo:x.nome.slice(0, 300), ws:w.id, tipo:'story', status:m.length ? 'backlog' : 'done', pai:ep.id});
    if (!m.length){ it.feito = iso(HOJE); it.fim = iso(HOJE); }
    it.desc = 'Importado da análise automática (' + (x.rotulo || '') + '): já existia no sistema quando ele foi ligado ao CicloDev.\nOnde: ' + x.onde + (s.teste ? '\nTem teste automático.' : '') + (x.tipo === 'tabela' && s.colunas ? '\nColunas: ' + s.colunas + (s.rls === false ? ' · RLS desligada' : '') : '') +
      (m.length ? '\n\nPrecisa análise: ' + m.join('; ') + '.' : '\n\nJá pronto: nenhum sinal de trabalho pendente foi visto. Entrou como Concluído, como se tivesse sido feito aqui desde o começo. Mudança daqui para frente vira Melhoria.');
    it.crit = m.length ? [{t:'Conferir o que falta: ' + m.join('; '), f:false}] : [];
    if (typeof garantirBoard === 'function') garantirBoard({issues:[it], boards:D.boards, equipes:D.equipes});
    it.ordem = Math.max(0, ...D.issues.map(y => +y.ordem || 0)) + 1;
    D.issues.push(it); criados.push({id:x.id, item:it.id});
  }
  // épico com tudo pronto também fica Concluído
  Object.values(epicos).forEach(ep => { const f = D.issues.filter(i => i.pai === ep.id && !i.arquivado); if (f.length && f.every(i => i.status === 'done') && ep.status !== 'done' && novosEp.has(ep.id)){ ep.status = 'done'; ep.feito = iso(HOJE); } });
  salvar(); rView();
  if (criados.length) toast((opc.auto ? 'O sistema ligado foi montado no CicloDev: ' : '') + criados.length + (criados.length === 1 ? ' item' : ' itens') + ' em ' + Object.keys(epicos).length + (Object.keys(epicos).length === 1 ? ' épico' : ' épicos') + ', cada um na frente do assunto.');
  const t0 = Date.now(); while (window.ciclodevSync && (window.ciclodevSync.rodando || window.ciclodevSync.pendente) && Date.now() - t0 < 60000) await new Promise(ok => setTimeout(ok, 500));
  for (let i = 0; i < criados.length; i += 500){ const {error} = await sb.rpc('analise_inventario_ligar', {p_pares:criados.slice(i, i + 500)}); if (error){ toast('Os itens foram criados, mas não deu para marcar o inventário: ' + (error.message || error)); break; } }
  criados.forEach(c => { const x = SG.inventario.find(y => y.id === c.id); if (x) x.item_id = c.item; });
  SG.importando = false;
  if (UI.view === 'seguranca') rView();
}
// a frente onde o item nasce: a do ponto do achado (a primeira frente ativa da aplicação ou do produto)
function sgFrente(noId){
  const ws = D.ws.filter(w => w.status !== 'archived' && (w.app === noId || (byId('apps', w.app) || {}).product === noId || (byId('apps', w.app) || {}).project === noId));
  const atual = UI.sel.startsWith('app:') ? D.ws.find(w => w.app === UI.sel.slice(4)) : null;
  return (ws.find(w => /back|banco|seguran|database/i.test(w.nome)) || ws[0] || atual || null);
}
// a frente do assunto (tela vai para Frontend, tabela para Database...) na aplicação do ponto; sem ela, a de sempre
function sgFrentePara(noId, assunto){ const b = sgFrente(noId); if (!b) return null; return (assunto && frenteSugerida(b.app, '', assunto)) || b; }
async function sgCriarItens(achados){
  const sb = sgBanco(); if (!sb) return 0;
  let n = 0;
  for (const a of achados){
    const w = sgFrentePara(a.no_id, frAssuntoAchado(a)); if (!w){ toast('Não achei uma frente para criar o item de ' + a.onde); continue; }
    const r = sgRegra(a.regra);
    const ni = novoIssue({titulo:('Segurança: ' + a.titulo + ' (' + a.onde.replace(/^.*\//, '') + ')').slice(0, 300), ws:w.id, tipo:'bug', status:'backlog', prio:a.gravidade === 'critica' ? 'highest' : a.gravidade === 'alta' ? 'high' : 'medium'});
    ni.desc = 'Achado da análise de segurança automática (' + a.regra + ').\n\nOnde: ' + a.rotulo + ' · ' + a.onde + (a.trecho ? '\nTrecho: ' + a.trecho : '') + '\n\nPor que importa: ' + r.porque + '\n\nComo corrigir: ' + r.correcao + '\n\nFonte: ' + r.fonte;
    ni.crit = [{t:'A análise de segurança não acha mais este ponto (' + a.regra + ' em ' + a.onde.replace(/:\d+$/, '') + ')', f:false}];
    ni.moscow = a.gravidade === 'critica' || a.gravidade === 'alta' ? 'deve' : 'deveria'; ni.nivel = {critica:1, alta:2, media:3, baixa:4}[a.gravidade];
    if (typeof garantirBoard === 'function') garantirBoard({issues:[ni], boards:D.boards, equipes:D.equipes});
    ni.ordem = Math.min(0, ...D.issues.map(x => +x.ordem || 0)) - 1;   // segurança vai para o topo da fila
    D.issues.push(ni); registrar('criou', ni); n++;
    a._novoItem = ni.id;
  }
  salvar();
  // espera o item chegar ao banco (a gravação é em lote) e liga o achado a ele
  const t0 = Date.now(); while (window.ciclodevSync && (window.ciclodevSync.rodando || window.ciclodevSync.pendente) && Date.now() - t0 < 20000) await new Promise(ok => setTimeout(ok, 400));
  for (const a of achados) if (a._novoItem){ const {error} = await sb.rpc('analise_marcar', {p_id:a.id, p_status:null, p_motivo:null, p_item:a._novoItem}); if (!error) a.item_id = a._novoItem; delete a._novoItem; }
  return n;
}
const _rViewSg = rView;
rView = function(){
  const c = $('#ops-corpo');
  if (c && UI.view === 'seguranca'){
    if (!sgPodeTer(UI.sel)){ UI.view = 'dashboard'; return _rViewSg.apply(this, arguments); }
    c.innerHTML = sgTelaHTML(); if (typeof smAgruparAbas === 'function') smAgruparAbas();
    if (SG.chave !== UI.sel && !SG.carregando) sgCarregar().then(() => { if (UI.view === 'seguranca') rView(); });
    return;
  }
  return _rViewSg.apply(this, arguments);
};
// projeto que já está em produção: ao ligar o GitHub, o banco ou o que for, o que o robô leu vira épicos e itens sozinho,
// como se tivesse sido feito no CicloDev desde o começo. Roda quando alguém que edita abre o ponto (e de novo quando o robô lê coisa nova).
async function sgAutoImportar(){
  const sb = sgBanco(), chave = UI.sel;
  if (!sb || SG.importando || !podeEditar() || !sgPodeTer(chave) || SG_AUTO.has(chave)) return;
  SG_AUTO.add(chave); setTimeout(() => SG_AUTO.delete(chave), 10000);
  const {data, error} = await sb.from('analise_inventario').select('id, no_id, origem, rotulo, tipo, chave, grupo, nome, onde, sinais, item_id').in('no_id', sgNos(chave)).limit(5000);
  const novos = (data || []).filter(x => !x.item_id);
  if (error || !novos.length || UI.sel !== chave) return;
  const ja = new Set(SG.inventario.map(x => x.id)); novos.forEach(x => { if (!ja.has(x.id)) SG.inventario.push(x); });
  await sgImportarAgora(novos, {auto:true});
}
const SG_AUTO = new Set();
const _rOperacoesSg = rOperacoes;
rOperacoes = function(){
  _rOperacoesSg.apply(this, arguments);
  sgAutoImportar();
  if (!sgPodeTer(UI.sel)){ const b = $('.view-b[data-view="seguranca"]'); if (b) (b.closest('.view-casa') || b).remove(); if (UI.view === 'seguranca'){ UI.view = 'dashboard'; rView(); } }
};
VIEWS.push(['seguranca', 'Análise', 'análise automática do código e do banco: segurança, qualidade e arquitetura']);
if (typeof SM_ABAS !== 'undefined') SM_ABAS.seguranca = ['Análise', 'O CicloDev lê o código e o banco ligados e confere as regras de segurança dos guias da OWASP: segredos no código, SQL Injection, XSS, dependências com falha conhecida, tabelas sem RLS e mais. Cada achado diz por que importa e como corrigir, e vira item com um clique.'];
if (typeof SM_DICA !== 'undefined') SM_DICA.seguranca = 'análise automática de segurança';
if (typeof EXPL_VIEW !== 'undefined') EXPL_VIEW.seguranca = 'Análise automática de segurança do código e do banco ligados, com as regras dos guias da OWASP.';
// não entra nas fixas (a ordem delas é a combinada): vem na barra de começo, como Entregas, e dá para tirar
if (typeof SM_EXTRAS_PADRAO !== 'undefined' && !SM_EXTRAS_PADRAO.includes('seguranca')){ SM_EXTRAS_PADRAO.push('seguranca'); if (typeof SM_PRINCIPAIS !== 'undefined' && !SM_PRINCIPAIS.includes('seguranca')) SM_PRINCIPAIS.push('seguranca'); }

document.addEventListener('click', async e => {
  if (!e.target.closest || UI.view !== 'seguranca') return;
  const f = e.target.closest('[data-sg-filtro]'); if (f){ SG.filtro = f.dataset.sgFiltro; rView(); return; }
  if (e.target.closest('[data-sg-analisar]')){
    const sb = sgBanco(); if (!sb) return;
    const no = UI.sel.split(':')[1];
    const {error} = await sb.rpc('infra_auto_pedir', {p_no:no});
    if (error){ toast('Não deu para pedir a análise: ' + (error.message || error)); return; }
    toast('O robô está lendo o código e o banco. Em alguns minutos a análise aparece aqui.');
    const chave = UI.sel; let k = 0;
    const t = setInterval(async () => { k++; if (UI.sel !== chave || k > 40){ clearInterval(t); return; } const antes = JSON.stringify(SG.rodadas.map(r => r.rodou_em)); await sgCarregar(); if (UI.view === 'seguranca') rView(); if (JSON.stringify(SG.rodadas.map(r => r.rodou_em)) !== antes){ clearInterval(t); toast('Análise de segurança atualizada.'); } }, 15000);
    return;
  }
  const ci = e.target.closest('[data-sg-item]');
  if (ci){ const a = SG.achados.find(x => x.id === ci.dataset.sgItem); if (!a) return; ci.disabled = true; const n = await sgCriarItens([a]); rView(); if (n) toast('Item criado no topo da fila, com o que achou, por que importa e como corrigir.'); return; }
  if (e.target.closest('[data-sg-importar]')){ sgImportar(); return; }
  if (e.target.closest('[data-sg-lote]')){
    const lista = SG.achados.filter(a => a.status === 'aberto' && !a.item_id && (a.gravidade === 'critica' || a.gravidade === 'alta'));
    modal('Criar itens de segurança', '<p>Cria ' + lista.length + (lista.length === 1 ? ' item' : ' itens') + ' do tipo Bug, um para cada achado crítico ou alto ainda sem item, no topo da fila, com prioridade Deve. Cada um leva o que achou, por que importa, como corrigir e a fonte.</p>',
      [{txt:'Cancelar', cls:'sec'}, {txt:'Criar', acao:() => { sgCriarItens(lista).then(n => { rView(); toast(n + (n === 1 ? ' item criado.' : ' itens criados.')); }); }}]);
    return;
  }
  const ig = e.target.closest('[data-sg-ignorar]');
  if (ig){ const id = ig.dataset.sgIgnorar;
    modal('Ignorar este achado', '<label class="lb">Por que ele não vale aqui<textarea class="campo" id="sg-motivo" rows="3" maxlength="1000" placeholder="Ex.: é uma chave de teste, sem acesso a nada real"></textarea></label><p class="sec">Fica registrado quem ignorou e o motivo. Se o achado mudar, ele volta.</p>',
      [{txt:'Cancelar', cls:'sec'}, {txt:'Ignorar', acao:d => { const m = $('#sg-motivo', d).value.trim(); if (m.length < 3){ toast('Diga o motivo'); return false; }
        sgBanco().rpc('analise_marcar', {p_id:id, p_status:'ignorado', p_motivo:m, p_item:null}).then(({data, error}) => { if (error){ toast('Não deu: ' + (error.message || error)); return; } const a = SG.achados.find(x => x.id === id); if (a){ a.status = 'ignorado'; a.motivo = m; } rView(); }); }}]);
    return;
  }
  const re = e.target.closest('[data-sg-reabrir]');
  if (re){ const {error} = await sgBanco().rpc('analise_marcar', {p_id:re.dataset.sgReabrir, p_status:'aberto', p_motivo:null, p_item:null}); if (error){ toast('Não deu: ' + (error.message || error)); return; } const a = SG.achados.find(x => x.id === re.dataset.sgReabrir); if (a){ a.status = 'aberto'; a.motivo = null; } rView(); }
});
document.addEventListener('change', e => { if (!e.target.matches || UI.view !== 'seguranca') return; if (e.target.matches('[data-sg-area]')){ SG.area = e.target.value; rView(); } if (e.target.matches('[data-sg-tipo]')){ SG.tipo = e.target.value; rView(); } });
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {sgCarregar, sgCriarItens, sgImportarAgora, SG, rOperacoes:(...a) => rOperacoes(...a)});
