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
      sb.from('analise_achados').select('id, no_id, origem, rotulo, regra, gravidade, titulo, onde, trecho, status, motivo, item_id, referencia, vezes, primeiro_em, ultimo_em, corrigido_em, visto_em, visto_por').in('no_id', nos).order('ultimo_em', {ascending:false}).limit(2000),
      sb.from('analise_rodadas').select('no_id, origem, rotulo, referencia, arquivos, abertos, novos, corrigidos, avisos, rodou_em').in('no_id', nos),
      sb.from('analise_inventario').select('id, no_id, origem, rotulo, tipo, chave, grupo, nome, onde, sinais, item_id').in('no_id', nos).limit(5000)]);
    if (a.error) throw a.error; if (r.error) throw r.error;
    if (SG.chave !== chave) return;
    SG.achados = a.data || []; SG.rodadas = r.data || []; SG.inventario = v.error ? [] : (v.data || []);
  } catch (e){ SG.erro = e.message || String(e); }
  SG.carregando = false;
  // o que o robô leu e ainda não virou item é montado sozinho
  const novos = SG.inventario.filter(sgPendente);
  if (novos.length && podeEditar() && !SG.importando && SG.chave === chave) setTimeout(() => sgImportarAgora(novos, {auto:true}), 0);
}
function sgNota(lista){ const p = {critica:25, alta:10, media:4, baixa:1}; return Math.max(0, 100 - lista.reduce((s, a) => s + (p[a.gravidade] || 0), 0)); }
const sgQuando = ts => { if (!ts) return ''; const m = Math.round((Date.now() - new Date(ts).getTime()) / 60000); if (m < 1) return 'agora'; if (m < 60) return 'há ' + m + ' min'; const h = Math.round(m / 60); if (h < 24) return 'há ' + h + ' h'; const d = Math.round(h / 24); return d === 1 ? 'ontem' : 'há ' + d + ' dias'; };
function sgTelaHTML(){
  const pode = podeEditar(), sb = sgBanco(), podeVer = podeEditar();   // quem só acompanha (stakeholder) não marca alerta
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
  const inv = SG.inventario, invNovo = inv.filter(sgPendente);
  // alerta: o que apareceu e ninguém marcou como visto (não trava nada; a pessoa só confirma que viu)
  const alertas = abertos.filter(a => !a.visto_em).sort((a, b) => SG_ORDEM[a.gravidade] - SG_ORDEM[b.gravidade]);
  const alertaHTML = alertas.length ? '<section class="sg-alerta" role="status"><div><b>' + (alertas.length === 1 ? '1 alerta novo' : alertas.length + ' alertas novos') + '</b><span>' +
      (alertas.some(a => a.regra === 'DEP-01') ? (nd => nd === 1 ? '1 é de biblioteca com falha de segurança conhecida. ' : nd + ' são de bibliotecas com falha de segurança conhecida. ')(alertas.filter(a => a.regra === 'DEP-01').length) : '') +
      'Nada foi travado: veja abaixo (marcados com "alerta") e marque como visto. O achado continua aberto até ser corrigido.</span></div>' +
      (podeVer ? '<button type="button" class="btn peq" data-sg-visto-todos>Marcar todos como vistos</button>' : '') + '</section>' : '';
  let h = '<div class="sg-tela">' + alertaHTML + '<section class="sg-topo"><div class="sg-nota sg-' + cor + '"><b>' + (fontes.length ? n : '–') + '</b><span>nota de segurança</span></div>' +
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
  // o que foi achado no banco vai numa planilha (uma linha por tabela e achado); o do código continua em cartões
  const doBanco = lista.filter(a => a.origem.startsWith('banco:')), doCodigo = lista.filter(a => !a.origem.startsWith('banco:'));
  if (doBanco.length) h += sgPlanilhaBancoHTML(doBanco.slice(0, 500), pode, podeVer) + (doBanco.length > 500 ? '<p class="sg-vazio">E mais ' + (doBanco.length - 500) + ' achados do banco.</p>' : '') + (doCodigo.length ? '<h3 class="sg-pl-tit">No código</h3>' : '');
  let grav = null;
  doCodigo.slice(0, 300).forEach(a => {
    if (a.gravidade !== grav){ grav = a.gravidade; h += '<h4 class="sg-sec sg-g-' + grav + '">' + SG_GRAV[grav][0] + ' <small>' + SG_GRAV[grav][1] + '</small></h4>'; }
    const r = sgRegra(a.regra), it = a.item_id && byId('issues', a.item_id);
    h += '<article class="sg-ach sg-g-' + a.gravidade + '" data-sg-id="' + esc(a.id) + '"><header><span class="sg-reg">' + esc(a.regra) + '</span>' + (sgTipo(a.regra) !== 'seguranca' ? '<span class="sg-selo">' + SG_TIPOS[sgTipo(a.regra)] + '</span>' : '') + '<b>' + esc(a.titulo) + '</b>' +
      (a.status === 'corrigido' ? '<span class="sg-selo ok">Corrigido ' + esc(sgQuando(a.corrigido_em)) + '</span>' : a.status === 'ignorado' ? '<span class="sg-selo">Ignorado</span>' : !a.visto_em ? '<span class="sg-selo alerta">alerta</span>' : a.vezes > 1 ? '<span class="sg-selo">visto ' + a.vezes + ' vezes</span>' : '<span class="sg-selo novo">novo</span>') + '</header>' +
      '<p class="sg-onde"><span>' + esc(a.rotulo) + '</span> · <code>' + esc(a.onde) + '</code></p>' + (a.trecho ? '<pre class="sg-trecho">' + esc(a.trecho) + '</pre>' : '') +
      '<details class="sg-det"' + (a.gravidade === 'critica' && a.status === 'aberto' ? ' open' : '') + '><summary>Por que importa e como corrigir</summary><p><b>Por que importa.</b> ' + esc(r.porque) + '</p><p><b>Como corrigir.</b> ' + esc(r.correcao) + '</p><p class="sg-fontetxt">Fonte: ' + esc(r.fonte) + '</p></details>' +
      (a.motivo ? '<p class="sg-motivo">Ignorado: ' + esc(a.motivo) + '</p>' : '') +
      '<div class="sg-bts">' + (a.status === 'aberto' && !a.visto_em && podeVer ? '<button type="button" class="btn peq" data-sg-visto="' + esc(a.id) + '">Marcar como visto</button>' : '') +
        (a.status === 'aberto' && a.visto_em ? '<span class="sg-visto">Visto' + (a.visto_por && byId('people', a.visto_por) ? ' por ' + esc(byId('people', a.visto_por).nome.split(' ')[0]) : '') + ' ' + esc(sgQuando(a.visto_em)) + '</span>' : '') + (it ? '<button type="button" class="btn sec peq" data-abrir-item="' + esc(it.id) + '">Abrir ' + esc((typeof chaveDe === 'function' && chaveDe(it)) || 'o item') + '</button>' : (pode && a.status === 'aberto' ? '<button type="button" class="btn peq" data-sg-item="' + esc(a.id) + '">Criar item para corrigir</button>' : '')) +
        (pode && a.status === 'aberto' ? '<button type="button" class="btn fant peq" data-sg-ignorar="' + esc(a.id) + '">Ignorar com motivo</button>' : '') + (pode && a.status === 'ignorado' ? '<button type="button" class="btn fant peq" data-sg-reabrir="' + esc(a.id) + '">Voltar a considerar</button>' : '') + '</div></article>';
  });
  if (doCodigo.length > 300) h += '<p class="sg-vazio">E mais ' + (doCodigo.length - 300) + ' achados do código.</p>';
  return h + '</div>';
}
// achados do banco em planilha: as mesmas informações e os mesmos botões dos cartões, em linhas e colunas
function sgPlanilhaBancoHTML(l, pode, podeVer){
  const abertos = SG.detAbertos || {};
  const situacao = a => a.status === 'corrigido' ? 'Corrigido ' + sgQuando(a.corrigido_em) : a.status === 'ignorado' ? 'Ignorado' + (a.motivo ? ': ' + a.motivo : '') : !a.visto_em ? 'Alerta (não visto)' : 'Visto' + (a.visto_por && byId('people', a.visto_por) ? ' por ' + byId('people', a.visto_por).nome.split(' ')[0] : '') + ' ' + sgQuando(a.visto_em);
  const linhas = l.map((a, i) => { const r = sgRegra(a.regra), it = a.item_id && byId('issues', a.item_id), [esq, ...resto] = String(a.onde).split('.'), tab = resto.join('.') || esq, det = abertos[a.id] ?? (a.gravidade === 'critica' && a.status === 'aberto');
    return '<tr class="sg-pl-l sg-g-' + a.gravidade + '" data-sg-id="' + esc(a.id) + '"><td class="pl-n">' + (i + 1) + '</td><td><code>' + esc(resto.length ? esq : '') + '</code></td><td><code><b>' + esc(tab) + '</b></code></td>' +
      '<td><span class="sg-pl-grav sg-g-' + a.gravidade + '">' + esc(SG_GRAV[a.gravidade][0]) + '</span></td><td><span class="sg-reg">' + esc(a.regra) + '</span> ' + esc(SG_TIPOS[sgTipo(a.regra)] || '') + '</td>' +
      '<td class="pl-texto"><b>' + esc(a.titulo) + '</b>' + (a.trecho ? '<br><code>' + esc(a.trecho) + '</code>' : '') + '<br><button type="button" class="ifr-lnk" data-sg-det="' + esc(a.id) + '" aria-expanded="' + det + '">' + (det ? 'Esconder' : 'Por que importa e como corrigir') + '</button></td>' +
      '<td>' + esc(situacao(a)) + '</td>' +
      '<td class="pl-acoes">' + (a.status === 'aberto' && !a.visto_em && podeVer ? '<button type="button" class="ifr-lnk" data-sg-visto="' + esc(a.id) + '">Marcar como visto</button>' : '') +
        (it ? '<button type="button" class="ifr-lnk" data-abrir-item="' + esc(it.id) + '">Abrir ' + esc((typeof chaveDe === 'function' && chaveDe(it)) || 'o item') + '</button>' : (pode && a.status === 'aberto' ? '<button type="button" class="ifr-lnk" data-sg-item="' + esc(a.id) + '">Criar item</button>' : '')) +
        (pode && a.status === 'aberto' ? '<button type="button" class="ifr-lnk" data-sg-ignorar="' + esc(a.id) + '">Ignorar</button>' : '') + (pode && a.status === 'ignorado' ? '<button type="button" class="ifr-lnk" data-sg-reabrir="' + esc(a.id) + '">Voltar a considerar</button>' : '') + '</td></tr>' +
      (det ? '<tr class="sg-pl-det"><td class="pl-n"></td><td colspan="7"><p><b>Por que importa.</b> ' + esc(r.porque) + '</p><p><b>Como corrigir.</b> ' + esc(r.correcao) + '</p><p class="sg-fontetxt">Fonte: ' + esc(r.fonte) + '</p></td></tr>' : ''); }).join('');
  return '<h3 class="sg-pl-tit">No banco <small>' + l.length + (l.length === 1 ? ' achado' : ' achados') + '</small></h3><div class="tabela-rolo sg-pl"><table class="tabela planilha"><thead><tr><th class="pl-n">#</th><th>Esquema</th><th>Tabela</th><th>Gravidade</th><th>Regra</th><th class="pl-texto">O que foi achado</th><th>Situação</th><th>Ações</th></tr></thead><tbody>' + linhas + '</tbody></table></div>';
}
// ---------- o que já existe: importar como épicos e itens ----------
// ainda falta montar: não virou item (a versão conta como montada quando já existe em Entregas)
const sgPendente = x => !x.item_id && (x.tipo !== 'versao' || !D.marcos.some(z => z.tipo === 'release' && z.nome.toLowerCase() === String(x.nome).toLowerCase()));
const SG_INV_TIPO = {tela:'Telas', api:'APIs', job:'Tarefas agendadas', tabela:'Tabelas', integracao:'Integrações', infra:'Infraestrutura', teste:'Testes', versao:'Versões publicadas'};
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
  const novo = SG.inventario.filter(sgPendente); if (!novo.length){ toast('Tudo já virou item.'); return; }
  const tipos = Object.keys(SG_INV_TIPO).filter(t => novo.some(x => x.tipo === t));
  const grupos = [...new Set(novo.map(x => x.grupo))];
  modal('Importar o que já existe', '<p>O CicloDev cria um <b>épico</b> para cada grupo (módulo, controlador ou família de tabelas) e um <b>item</b> para cada tela, API, tarefa ou tabela, com onde está no código e o que foi visto.</p>' +
    '<ul class="sg-imp-regras"><li>Tudo é montado como se o P.O. tivesse feito o projeto aqui: história, critérios, prioridade, pontos, início e prazo pelas datas das publicações, e as versões publicadas viram Entregas.</li><li><b>Parece pronto</b> (sem TODO, sem "não implementado", tabela usada pelo código): entra em <b>Pronto para testar</b>, para o P.O. analisar e aceitar.</li><li><b>Precisa análise</b>: entra em <b>Criado</b>, com o motivo escrito no item e o critério "Conferir o que falta".</li></ul>' +
    '<fieldset class="sg-imp-tipos"><legend>O que importar</legend>' + tipos.map(t => { const n = novo.filter(x => x.tipo === t).length, ok = novo.filter(x => x.tipo === t && !sgMotivos(x).length).length;
      return '<label class="cm-ck"><input type="checkbox" data-sg-imp-tipo="' + t + '"' + (t === 'tabela' && n > 60 ? '' : ' checked') + '> ' + SG_INV_TIPO[t] + ' <small>' + n + ' (' + ok + ' prontos, ' + (n - ok) + ' para analisar)</small></label>'; }).join('') + '</fieldset>' +
    '<p class="sec">' + grupos.length + (grupos.length === 1 ? ' épico' : ' épicos') + ' no total. Épico com o mesmo nome de um que já existe recebe os itens, sem duplicar. O que já foi importado não entra de novo.' + (novo.some(x => x.tipo === 'tabela') && novo.filter(x => x.tipo === 'tabela').length > 60 ? ' As tabelas vêm desmarcadas porque são muitas: marque se quiser um item por tabela.' : '') + '</p>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Importar', acao:d => { const marcados = [...d.querySelectorAll('[data-sg-imp-tipo]:checked')].map(x => x.dataset.sgImpTipo); if (!marcados.length){ toast('Marque o que importar'); return false; }
      sgImportarAgora(novo.filter(x => marcados.includes(x.tipo))); }}]);
}
// O que já existe é montado como se o P.O. do CicloDev tivesse feito o projeto desde o começo: épicos com meta, itens com
// história, critérios de aceite, prioridade, pontos, início e prazo pelas datas reais (primeiro e último commit do arquivo, ou a
// migration da tabela) e a versão em que cada um foi publicado (as releases do repositório viram Entregas, com a data delas).
// Nada é aceito sozinho: o que parece pronto vai para Pronto para testar, para o P.O. analisar e aceitar;
// o que tem sinal de inacabado entra em Criado, com o motivo.
const SG_PO = {
  tela:{quem:'usuário do sistema', quero:x => 'usar a ' + x.nome.replace(/^Tela\s+/i, 'tela '), para:'fazer o que esta tela oferece hoje em produção', pontos:3},
  api:{quem:'sistema (as telas e as integrações)', quero:x => 'chamar ' + x.nome.replace(/^API\s+/i, ''), para:'ler e gravar os dados desta parte do sistema', pontos:2},
  job:{quem:'sistema', quero:x => 'rodar sozinho a ' + x.nome.replace(/^Tarefa\s+/i, 'tarefa ').toLowerCase(), para:'que a rotina aconteça sem ninguém precisar lembrar', pontos:2},
  tabela:{quem:'sistema', quero:x => 'guardar os dados na ' + x.nome.replace(/^Tabela\s+/i, 'tabela '), para:'que as telas, as APIs e os relatórios usem estes dados', pontos:1},
  integracao:{quem:'sistema', quero:x => 'trocar dados ' + x.nome.replace(/^Integração\s+/i, '').replace(/^com\s+/i, 'com '), para:'funcionar junto com o sistema de fora', pontos:5},
  infra:{quem:'time de desenvolvimento', quero:x => 'manter ' + x.nome.charAt(0).toLowerCase() + x.nome.slice(1), para:'montar e publicar o sistema do mesmo jeito sempre', pontos:2},
  teste:{quem:'time de desenvolvimento', quero:x => 'que o ' + x.nome.replace(/^Teste\s+/i, 'teste de ').toLowerCase() + ' rode sozinho', para:'saber na hora quando algo quebrar', pontos:1}
};
const sgDia = s => s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
const sgDiaBR = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '';
function sgMontarItem(x, m, w, ep, versoes){
  const s = x.sinais || {}, po = SG_PO[x.tipo] || SG_PO.api, ini = sgDia(s.criado), fim = sgDia(s.publicado) || ini;
  const it = novoIssue({titulo:x.nome.slice(0, 300), ws:w.id, tipo:'story', status:m.length ? 'backlog' : 'review', pai:ep.id});
  it.hQuem = po.quem; it.hQuero = po.quero(x).slice(0, 500); it.hPara = po.para;
  it.moscow = 'deve'; it.nivel = m.length ? 2 : 3; it.prio = m.length ? 'high' : 'medium'; it.pontos = po.pontos;
  it.valor = x.tipo === 'tela' || x.tipo === 'integracao' ? 8 : x.tipo === 'api' ? 7 : 5; it.valorMotivo = 'já está em produção e é usado hoje';
  if (ini){ it.ini = ini; it.criado = ini; } if (fim){ it.fim = fim; it.alvo = fim; }
  // a versão em que foi publicado: a primeira publicação na data do primeiro commit ou depois dela
  const v = ini && versoes.find(z => z.data >= ini); if (v) it.marco = v.id;
  const crit = [];
  if (fim) crit.push({t:'Está publicado em produção (última mudança em ' + sgDiaBR(fim) + (s.commits ? ', ' + s.commits + (s.commits === 1 ? ' commit' : ' commits') : '') + ')', f:true});
  if (x.tipo === 'tela') crit.push({t:'A tela abre e funciona como em produção hoje', f:false});
  else if (x.tipo === 'api') crit.push({t:'Responde ' + x.nome.replace(/^API\s+/i, '') + ' como em produção hoje', f:false});
  else if (x.tipo === 'tabela') crit.push({t:'A tabela guarda os dados certos' + (s.rls === false ? ' (atenção: RLS desligada)' : ''), f:false}, {t:'É usada pelo código', f:s.usada === true});
  else if (x.tipo === 'integracao') crit.push({t:'A troca de dados com o sistema de fora funciona', f:false});
  else crit.push({t:'Funciona como está em produção hoje', f:false});
  if (x.tipo !== 'teste' && x.tipo !== 'infra') crit.push({t:'Tem teste automático', f:!!s.teste});
  if (m.length) crit.push({t:'Conferir o que falta: ' + m.join('; '), f:false});
  it.crit = crit;
  it.desc = 'Montado pelo CicloDev a partir do que já existe (' + (x.rotulo || '') + '), como se o P.O. tivesse feito este projeto aqui desde o começo.\nOnde: ' + x.onde +
    (ini ? '\nComeçou em ' + sgDiaBR(ini) + (fim && fim !== ini ? '; última publicação em ' + sgDiaBR(fim) : '') + '.' : '') +
    (x.tipo === 'tabela' && s.colunas ? '\nColunas: ' + s.colunas + (s.rls === false ? ' · RLS desligada' : '') : '') +
    (m.length ? '\n\nPrecisa análise: ' + m.join('; ') + '.' : '\n\nParece pronto: o P.O. analisa, marca os critérios e aceita.');
  return it;
}
// as publicações (releases) viram versões em Entregas, com a data e as notas de cada uma
function sgVersoes(lista){
  const out = [];
  for (const x of lista.filter(y => y.tipo === 'versao')){
    const w = sgFrente(x.no_id), ap = w && byId('apps', w.app), no = ap ? 'project:' + ap.project : null; if (!no) continue;
    const data = sgDia((x.sinais || {}).data); if (!data) continue;
    let mc = D.marcos.find(z => z.tipo === 'release' && z.no === no && z.nome.toLowerCase() === x.nome.toLowerCase());
    if (!mc){ mc = {id:uid('mc'), no, tipo:'release', nome:x.nome.slice(0, 120), desc:'Publicação ' + x.onde + ' do repositório ' + (x.rotulo || ''), data, vis:true, entregue:data, notas:(x.sinais.notas || '').slice(0, 1200), meta:''}; D.marcos.push(mc); }
    out.push({x, mc});
  }
  return out;
}
async function sgImportarAgora(lista, opc = {}){
  const sb = sgBanco(); if (!sb || SG.importando) return;
  SG.importando = true;
  const criados = [], epicos = {}, novosEp = new Set();
  const vs = sgVersoes(lista); vs.forEach(v => criados.push({id:v.x.id, item:null, marco:v.mc.id}));
  const versoes = D.marcos.filter(z => z.tipo === 'release' && z.data).sort((a, b) => a.data.localeCompare(b.data));
  for (const x of lista){
    if (x.tipo === 'versao') continue;
    const w = sgFrentePara(x.no_id, frAssuntoInventario(x)); if (!w) continue;
    const ap = w.app, chaveEp = ap + '|' + x.grupo;
    let ep = epicos[chaveEp] || D.issues.find(i => i.tipo === 'epic' && !i.arquivado && i.titulo.toLowerCase() === x.grupo.toLowerCase() && (byId('ws', i.ws) || {}).app === ap);
    if (!ep){ ep = novoIssue({titulo:x.grupo.slice(0, 300), ws:w.id, tipo:'epic', status:'todo'}); ep.desc = 'Épico montado pelo CicloDev a partir do que já existe no sistema, como se o P.O. tivesse feito o projeto aqui desde o começo.'; ep.meta = 'Ter ' + x.grupo + ' documentado e aceito no CicloDev, como já funciona em produção'; if (typeof garantirBoard === 'function') garantirBoard({issues:[ep], boards:D.boards, equipes:D.equipes}); D.issues.push(ep); registrar('criou', ep); novosEp.add(ep.id); }
    epicos[chaveEp] = ep;
    const it = sgMontarItem(x, sgMotivos(x), w, ep, versoes.filter(v => v.no === 'project:' + (byId('apps', ap) || {}).project));
    if (typeof garantirBoard === 'function') garantirBoard({issues:[it], boards:D.boards, equipes:D.equipes});
    it.ordem = Math.max(0, ...D.issues.map(y => +y.ordem || 0)) + 1;
    D.issues.push(it); criados.push({id:x.id, item:it.id});
  }
  // o épico vai do primeiro começo ao último prazo dos itens dele
  Object.values(epicos).forEach(ep => { const f = D.issues.filter(i => i.pai === ep.id && !i.arquivado); if (!f.length || !novosEp.has(ep.id)) return;
    const inis = f.map(i => i.ini).filter(Boolean).sort(), fins = f.map(i => i.fim).filter(Boolean).sort(); if (inis.length) ep.ini = inis[0]; if (fins.length){ ep.fim = fins[fins.length - 1]; ep.alvo = ep.fim; } });
  salvar(); rView();
  const nIt = criados.filter(c => c.item).length;
  if (criados.length) toast((opc.auto ? 'O sistema ligado foi montado no CicloDev: ' : '') + nIt + (nIt === 1 ? ' item' : ' itens') + ' em ' + Object.keys(epicos).length + (Object.keys(epicos).length === 1 ? ' épico' : ' épicos') + (vs.length ? ' e ' + vs.length + (vs.length === 1 ? ' versão' : ' versões') : '') + '. O P.O. analisa e aceita.');
  const t0 = Date.now(); while (window.ciclodevSync && (window.ciclodevSync.rodando || window.ciclodevSync.pendente) && Date.now() - t0 < 60000) await new Promise(ok => setTimeout(ok, 500));
  const pares = criados.filter(c => c.item).map(c => ({id:c.id, item:c.item}));
  for (let i = 0; i < pares.length; i += 500){ const {error} = await sb.rpc('analise_inventario_ligar', {p_pares:pares.slice(i, i + 500)}); if (error){ toast('Os itens foram criados, mas não deu para marcar o inventário: ' + (error.message || error)); break; } }
  criados.forEach(c => { const x = SG.inventario.find(y => y.id === c.id); if (x) x.item_id = c.item || 'versao'; });
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
  const novos = (data || []).filter(sgPendente);
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
  const dt = e.target.closest('[data-sg-det]'); if (dt){ const k = dt.dataset.sgDet; SG.detAbertos = Object.assign({}, SG.detAbertos, {[k]:dt.getAttribute('aria-expanded') !== 'true'}); rView(); return; }
  const f = e.target.closest('[data-sg-filtro]'); if (f){ SG.filtro = f.dataset.sgFiltro; rView(); return; }
  if (e.target.closest('[data-sg-analisar]')){
    const sb = sgBanco(); if (!sb) return;
    const no = UI.sel.split(':')[1];
    const {error} = await sb.rpc('infra_auto_pedir', {p_no:no});
    if (error){ toast('Não deu para pedir a análise: ' + (error.message || error)); return; }
    toast('O robô está lendo o código e o banco. Em alguns minutos a análise aparece aqui.');
    const chave = UI.sel; let k = 0;
    const t = setInterval(async () => { k++; if (UI.sel !== chave || k > 40){ clearInterval(t); return; } if (avLigado()) return;   /* reserva: com o ao vivo ligado, ele avisa */ const antes = JSON.stringify(SG.rodadas.map(r => r.rodou_em)); await sgCarregar(); if (UI.view === 'seguranca') rView(); if (JSON.stringify(SG.rodadas.map(r => r.rodou_em)) !== antes){ clearInterval(t); toast('Análise de segurança atualizada.'); } }, 15000);
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
  const vi = e.target.closest('[data-sg-visto],[data-sg-visto-todos]');
  if (vi){
    const ids = vi.dataset.sgVisto ? [vi.dataset.sgVisto] : SG.achados.filter(a => a.status === 'aberto' && !a.visto_em).map(a => a.id);
    if (!ids.length) return;
    vi.disabled = true;
    const {data, error} = await sgBanco().rpc('analise_marcar_visto', {p_ids:ids});
    if (error){ vi.disabled = false; toast('Não deu: ' + (error.message || error)); return; }
    const eu = idEu(UI.verComo || 'master'), agora = new Date().toISOString();
    SG.achados.forEach(a => { if (ids.includes(a.id) && !a.visto_em){ a.visto_em = agora; a.visto_por = eu || null; } });
    toast(ids.length === 1 ? 'Marcado como visto.' : (data ?? ids.length) + ' alertas marcados como vistos.');
    rView(); return;
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
