/* ===== Aba Segurança: a análise automática do código e do banco =====
   O robô (função diagramas-auto) lê o código de cada repositório ligado e a estrutura de cada banco ligado, passa as
   regras de segurança (supabase/functions/diagramas-auto/seguranca.ts, nascidas dos guias da OWASP) e grava os achados
   (parte 43). Aqui a pessoa vê a nota, o que achou, por que importa, como corrigir e a fonte; cria o Bug de cada achado,
   ou ignora com motivo. Quando o achado some do código ou do banco, ele aparece como corrigido sozinho.
   O catálogo de regras (SG_REGRAS) vem do mesmo arquivo da função, juntado pelo build.py: fonte única. */
const SG = {chave:null, achados:[], rodadas:[], carregando:false, erro:'', filtro:'aberto', area:''};
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
    const [a, r] = await Promise.all([
      sb.from('analise_achados').select('id, no_id, origem, rotulo, regra, gravidade, titulo, onde, trecho, status, motivo, item_id, referencia, vezes, primeiro_em, ultimo_em, corrigido_em').in('no_id', nos).order('ultimo_em', {ascending:false}).limit(2000),
      sb.from('analise_rodadas').select('no_id, origem, rotulo, referencia, arquivos, abertos, novos, corrigidos, avisos, rodou_em').in('no_id', nos)]);
    if (a.error) throw a.error; if (r.error) throw r.error;
    if (SG.chave !== chave) return;
    SG.achados = a.data || []; SG.rodadas = r.data || [];
  } catch (e){ SG.erro = e.message || String(e); }
  SG.carregando = false;
}
function sgNota(lista){ const p = {critica:25, alta:10, media:4, baixa:1}; return Math.max(0, 100 - lista.reduce((s, a) => s + (p[a.gravidade] || 0), 0)); }
const sgQuando = ts => { if (!ts) return ''; const m = Math.round((Date.now() - new Date(ts).getTime()) / 60000); if (m < 1) return 'agora'; if (m < 60) return 'há ' + m + ' min'; const h = Math.round(m / 60); if (h < 24) return 'há ' + h + ' h'; const d = Math.round(h / 24); return d === 1 ? 'ontem' : 'há ' + d + ' dias'; };
function sgTelaHTML(){
  const pode = podeEditar(), sb = sgBanco();
  if (!sb) return '<div class="sg-tela"><p class="sg-vazio">A análise de segurança precisa do banco do CicloDev ligado.</p></div>';
  if (SG.carregando && !SG.achados.length) return '<div class="sg-tela"><p class="sg-vazio">Carregando a análise…</p></div>';
  if (SG.erro) return '<div class="sg-tela"><p class="entrada-erro">Não deu para ler a análise: ' + esc(SG.erro) + '</p></div>';
  const abertos = SG.achados.filter(a => a.status === 'aberto'), n = sgNota(abertos);
  const cont = g => abertos.filter(a => a.gravidade === g).length;
  const cor = n >= 85 ? 'bom' : n >= 60 ? 'medio' : 'ruim';
  const fontes = SG.rodadas.slice().sort((a, b) => String(b.rodou_em).localeCompare(String(a.rodou_em)));
  const lista = SG.achados.filter(a => a.status === SG.filtro && (!SG.area || (SG.area === 'codigo' ? a.origem.startsWith('repo:') : a.origem.startsWith('banco:'))))
    .sort((a, b) => SG_ORDEM[a.gravidade] - SG_ORDEM[b.gravidade] || a.onde.localeCompare(b.onde));
  const n2 = st => SG.achados.filter(a => a.status === st).length;
  const semItem = abertos.filter(a => !a.item_id && (a.gravidade === 'critica' || a.gravidade === 'alta'));
  let h = '<div class="sg-tela"><section class="sg-topo"><div class="sg-nota sg-' + cor + '"><b>' + (fontes.length ? n : '–') + '</b><span>nota de segurança</span></div>' +
    '<div class="sg-resumo"><h3>Análise de segurança</h3><p>O CicloDev lê o código e o banco ligados a este ' + (UI.sel.startsWith('project:') ? 'projeto (e aos produtos e aplicações dele)' : UI.sel.startsWith('product:') ? 'produto (e às aplicações dele)' : 'ponto') + ' a cada publicação e confere as regras dos guias da OWASP. Nada é mudado no seu sistema: ele só lê.</p>' +
    '<div class="sg-contas">' + ['critica','alta','media','baixa'].map(g => '<span class="sg-conta sg-g-' + g + '"><b>' + cont(g) + '</b>' + SG_GRAV[g][0] + '</span>').join('') + '</div>' +
    '<div class="sg-acoes">' + (pode ? '<button type="button" class="btn peq" data-sg-analisar>Analisar agora</button>' : '') + (pode && semItem.length ? '<button type="button" class="btn sec peq" data-sg-lote>Criar os ' + semItem.length + ' itens de críticos e altos</button>' : '') + '</div></div>' +
    '<div class="sg-fontes"><h4>O que foi lido</h4>' + (fontes.length ? fontes.map(f => '<div class="sg-fonte"><b>' + esc(f.rotulo || (f.origem.startsWith('repo:') ? 'Repositório' : 'Banco')) + '</b><span>' + (f.origem.startsWith('repo:') ? 'código' : 'banco') + ' · ' + esc(sgQuando(f.rodou_em)) + (f.arquivos != null ? ' · ' + f.arquivos + (f.origem.startsWith('repo:') ? ' arquivos' : ' tabelas') : '') + '</span>' +
      '<span>' + f.abertos + ' abertos' + (f.novos ? ' · ' + f.novos + ' novos' : '') + (f.corrigidos ? ' · ' + f.corrigidos + ' corrigidos' : '') + '</span>' + (f.avisos ? '<small>' + esc(f.avisos) + '</small>' : '') + '</div>').join('')
      : '<p class="sg-vazio">Ainda não rodou. Ligue um repositório ou um banco na aba Infraestrutura (painel Automático) e clique em Analisar agora.</p>') + '</div></section>';
  h += '<div class="sg-filtros" role="group" aria-label="Filtrar achados">' + [['aberto','Abertos'],['corrigido','Corrigidos'],['ignorado','Ignorados']].map(([k, r]) => '<button type="button" class="sg-f' + (SG.filtro === k ? ' sel' : '') + '" data-sg-filtro="' + k + '" aria-pressed="' + (SG.filtro === k) + '">' + r + ' <b>' + n2(k) + '</b></button>').join('') +
    '<span class="espaco"></span><select class="sel peq" data-sg-area aria-label="Onde"><option value="">Código e banco</option><option value="codigo"' + (SG.area === 'codigo' ? ' selected' : '') + '>Só código</option><option value="banco"' + (SG.area === 'banco' ? ' selected' : '') + '>Só banco</option></select></div>';
  if (!lista.length) h += '<p class="sg-vazio">' + (SG.filtro === 'aberto' ? (fontes.length ? 'Nenhum achado aberto. Bom trabalho!' : 'Nada para mostrar ainda.') : SG.filtro === 'corrigido' ? 'Nenhum achado corrigido ainda. Quando um achado some do código ou do banco, ele aparece aqui.' : 'Nenhum achado ignorado.') + '</p>';
  let grav = null;
  lista.slice(0, 300).forEach(a => {
    if (a.gravidade !== grav){ grav = a.gravidade; h += '<h4 class="sg-sec sg-g-' + grav + '">' + SG_GRAV[grav][0] + ' <small>' + SG_GRAV[grav][1] + '</small></h4>'; }
    const r = sgRegra(a.regra), it = a.item_id && byId('issues', a.item_id);
    h += '<article class="sg-ach sg-g-' + a.gravidade + '" data-sg-id="' + esc(a.id) + '"><header><span class="sg-reg">' + esc(a.regra) + '</span><b>' + esc(a.titulo) + '</b>' +
      (a.status === 'corrigido' ? '<span class="sg-selo ok">Corrigido ' + esc(sgQuando(a.corrigido_em)) + '</span>' : a.status === 'ignorado' ? '<span class="sg-selo">Ignorado</span>' : a.vezes > 1 ? '<span class="sg-selo">visto ' + a.vezes + ' vezes</span>' : '<span class="sg-selo novo">novo</span>') + '</header>' +
      '<p class="sg-onde"><span>' + esc(a.rotulo) + '</span> · <code>' + esc(a.onde) + '</code></p>' + (a.trecho ? '<pre class="sg-trecho">' + esc(a.trecho) + '</pre>' : '') +
      '<details class="sg-det"' + (a.gravidade === 'critica' && a.status === 'aberto' ? ' open' : '') + '><summary>Por que importa e como corrigir</summary><p><b>Por que importa.</b> ' + esc(r.porque) + '</p><p><b>Como corrigir.</b> ' + esc(r.correcao) + '</p><p class="sg-fontetxt">Fonte: ' + esc(r.fonte) + ' (base de conhecimento, Segurança)</p></details>' +
      (a.motivo ? '<p class="sg-motivo">Ignorado: ' + esc(a.motivo) + '</p>' : '') +
      '<div class="sg-bts">' + (it ? '<button type="button" class="btn sec peq" data-abrir-item="' + esc(it.id) + '">Abrir ' + esc((typeof chaveDe === 'function' && chaveDe(it)) || 'o item') + '</button>' : (pode && a.status === 'aberto' ? '<button type="button" class="btn peq" data-sg-item="' + esc(a.id) + '">Criar item para corrigir</button>' : '')) +
        (pode && a.status === 'aberto' ? '<button type="button" class="btn fant peq" data-sg-ignorar="' + esc(a.id) + '">Ignorar com motivo</button>' : '') + (pode && a.status === 'ignorado' ? '<button type="button" class="btn fant peq" data-sg-reabrir="' + esc(a.id) + '">Voltar a considerar</button>' : '') + '</div></article>';
  });
  if (lista.length > 300) h += '<p class="sg-vazio">E mais ' + (lista.length - 300) + ' achados.</p>';
  return h + '</div>';
}
// a frente onde o item nasce: a do ponto do achado (a primeira frente ativa da aplicação ou do produto)
function sgFrente(noId){
  const ws = D.ws.filter(w => w.status !== 'archived' && (w.app === noId || (byId('apps', w.app) || {}).product === noId || (byId('apps', w.app) || {}).project === noId));
  const atual = UI.sel.startsWith('app:') ? D.ws.find(w => w.app === UI.sel.slice(4)) : null;
  return (ws.find(w => /back|banco|seguran|database/i.test(w.nome)) || ws[0] || atual || null);
}
async function sgCriarItens(achados){
  const sb = sgBanco(); if (!sb) return 0;
  let n = 0;
  for (const a of achados){
    const w = sgFrente(a.no_id); if (!w){ toast('Não achei uma frente para criar o item de ' + a.onde); continue; }
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
const _rOperacoesSg = rOperacoes;
rOperacoes = function(){
  _rOperacoesSg.apply(this, arguments);
  if (!sgPodeTer(UI.sel)){ const b = $('.view-b[data-view="seguranca"]'); if (b) (b.closest('.view-casa') || b).remove(); if (UI.view === 'seguranca'){ UI.view = 'dashboard'; rView(); } }
};
VIEWS.push(['seguranca', 'Segurança', 'análise automática de segurança do código e do banco']);
if (typeof SM_ABAS !== 'undefined') SM_ABAS.seguranca = ['Segurança', 'O CicloDev lê o código e o banco ligados e confere as regras de segurança dos guias da OWASP: segredos no código, SQL Injection, XSS, dependências com falha conhecida, tabelas sem RLS e mais. Cada achado diz por que importa e como corrigir, e vira item com um clique.'];
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
document.addEventListener('change', e => { if (e.target.matches && e.target.matches('[data-sg-area]') && UI.view === 'seguranca'){ SG.area = e.target.value; rView(); } });
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {sgCarregar, sgCriarItens, SG, rOperacoes:(...a) => rOperacoes(...a)});
