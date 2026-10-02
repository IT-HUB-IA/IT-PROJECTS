/* =====================================================================
   Entregas: código (GitHub e GitLab) ligado aos itens, versões com notas geradas
   dos itens concluídos e o registro das publicações. Tudo ligado a um projeto
   (ou a uma aplicação dele). Camada nova, depois do tarefas.js. Prefixo en.
   ===================================================================== */
const EN = {repos:null, pubs:null, carregando:null, atividade:null};
const enSb = () => COM_BANCO ? window.ciclodevBanco : null;
const enLocal = () => { D.dev = D.dev || {repos:[], pubs:[], links:[]}; return D.dev; };
const EN_LOCAL = {repositorios:'repos', publicacoes:'pubs', codigo_vinculos:'links'};
const EN_AMB = {producao:'Produção', homologacao:'Homologação', previa:'Prévia'};
const enAmb = a => EN_AMB[a] || a || 'Produção';
const EN_ST_PUB = {sucesso:'Deu certo', falha:'Falhou', em_andamento:'Em andamento'};
const EN_ORIGEM = {manual:'Registrada aqui', github:'GitHub', gitlab:'GitLab'};
const EN_EST = {ativo:'Ativo', aberto:'Aberto', rascunho:'Rascunho', mesclado:'Mesclado', fechado:'Fechado', excluido:'Apagado'};
const EN_ICO = {
  github:'<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 .1 1.6 1 1.6 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5a3.9 3.9 0 0 1 1-2.7c-.1-.3-.5-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7a3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0 0 12 2z"/></svg>',
  gitlab:'<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21.4 15.7 10H8.3L12 21.4zM3.1 10 2 13.4c-.1.3 0 .7.3.9L12 21.4 3.1 10zm0 0h5.2L6 3c-.1-.4-.7-.4-.8 0L3.1 10zm17.8 0 1.1 3.4c.1.3 0 .7-.3.9L12 21.4 20.9 10zm0 0h-5.2L18 3c.1-.4.7-.4.8 0l2.1 7z"/></svg>',
  branch:TF_SV('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 7v10M18 9c0 5-7 4-11 8"/>'),
  commit:TF_SV('<circle cx="12" cy="12" r="3.5"/><path d="M2 12h6.5M15.5 12H22"/>'),
  pr:TF_SV('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 7v10M18 17V9a3 3 0 0 0-3-3h-4"/><path d="M13 3l-3 3 3 3"/>'),
  versao:TF_SV('<path d="M4 4h9l7 7-9 9-7-7z"/><circle cx="8.5" cy="8.5" r="1.4" fill="currentColor"/>'),
  foguete:TF_SV('<path d="M14 4c3 0 6 3 6 6-2 4-6 7-6 7l-4-4s3-4 4-9z"/><path d="M10 13l-3 1-2 4 4-2 1-3M15 9h.01"/>'),
  copiar:TF_SV('<rect x="8" y="8" width="12" height="12"/><path d="M16 8V4H4v12h4"/>')
};

/* ---------- dados: banco (Supabase) ou, no modo de exemplo, o navegador ---------- */
async function enLer(tabela, filtro){
  const sb = enSb();
  if (!sb){ const L = enLocal()[EN_LOCAL[tabela]]; return filtro && filtro.local ? L.filter(filtro.local) : L.slice(); }
  let q = sb.from(tabela).select('*');
  if (filtro && filtro.eq) q = q.eq(filtro.eq[0], filtro.eq[1]);
  if (filtro && filtro.em) q = q.in(filtro.em[0], filtro.em[1]);
  if (filtro && filtro.ordem) q = q.order(filtro.ordem, {ascending:false});
  if (filtro && filtro.limite) q = q.limit(filtro.limite);
  const {data, error} = await q;
  if (error) throw error;
  return data || [];
}
async function enInserir(tabela, linha){
  const sb = enSb();
  if (!sb){ const nova = Object.assign({id:uid('dv'), criado_em:new Date().toISOString()}, linha); enLocal()[EN_LOCAL[tabela]].unshift(nova); salvar(); return nova; }
  const {data, error} = await sb.from(tabela).insert(linha).select('*');
  if (error || !data || !data.length){ toast('Não deu para gravar: ' + tfErro(error || 'o banco não confirmou')); return null; }
  return data[0];
}
async function enAlterar(tabela, id, campos){
  const sb = enSb();
  if (!sb){ const x = enLocal()[EN_LOCAL[tabela]].find(r => r.id === id); if (x) Object.assign(x, campos); salvar(); return !!x; }
  const {data, error} = await sb.from(tabela).update(campos).eq('id', id).select('id');
  if (error || !data || !data.length){ toast('Não deu para alterar: ' + tfErro(error || 'sem permissão')); return false; }
  return true;
}
async function enApagar(tabela, id){
  const sb = enSb();
  if (!sb){ const L = enLocal(); L[EN_LOCAL[tabela]] = L[EN_LOCAL[tabela]].filter(r => r.id !== id); if (tabela === 'repositorios') L.links = L.links.filter(l => l.repositorio_id !== id); salvar(); return true; }
  const {data, error} = await sb.from(tabela).delete().eq('id', id).select('id');
  if (error || !data || !data.length){ toast('Não deu para excluir: ' + tfErro(error || 'sem permissão')); return false; }
  return true;
}
async function enCarregar(forcar){
  if (EN.repos && EN.pubs && !forcar) return;
  if (EN.carregando && !forcar) return EN.carregando;
  EN.carregando = (async () => {
    try { const [r, p] = await Promise.all([enLer('repositorios', {ordem:'criado_em'}), enLer('publicacoes', {ordem:'publicado_em', limite:300})]); EN.repos = r; EN.pubs = p; EN.erro = null; }
    catch(e){ EN.repos = EN.repos || []; EN.pubs = EN.pubs || []; EN.erro = tfErro(e); }
    EN.carregando = null;
  })();
  return EN.carregando;
}

/* ---------- escopo: o ponto escolhido, o que está acima (até o projeto) e o que está dentro ---------- */
function enNos(chave){ // o ponto e o que está dentro dele; nunca o que está acima (ver noDono em app.js)
  const d = noDono(chave), s = new Set(); if (!d || d === 'all') return s;
  s.add(d.split(':')[1]); const t = tfDentro(d); [...t.projs, ...t.prods, ...t.apps, ...t.ws].forEach(x => s.add(x));
  return s;
}
const enVersoes = chave => marcosDoEscopo(chave).filter(m => m.tipo === 'release').sort((a, b) => String(b.entregue || b.data).localeCompare(String(a.entregue || a.data)));
const enNomeNo = id => { const k = ['projects','products','apps','ws','clients'].map(l => byId(l, id) && ({projects:'project', products:'product', apps:'app', ws:'ws', clients:'client'}[l] + ':' + id)).find(Boolean); return k ? nomeDe(k) : 'Ponto excluído'; };
function enHa(ts){ if (!ts) return ''; const m = Math.round((Date.now() - new Date(ts).getTime()) / 60000); if (m < 1) return 'agora'; if (m < 60) return 'há ' + m + ' min'; const h = Math.round(m / 60); if (h < 24) return 'há ' + h + ' h'; const d = Math.round(h / 24); return d === 1 ? 'ontem' : 'há ' + d + ' dias'; }
const enData = ts => ts ? new Date(ts).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'}) : '';
function enCopiar(txt, botao){
  const fim = ok => { if (botao){ const t = botao.textContent; botao.textContent = ok ? 'Copiado' : 'Selecione e copie'; setTimeout(() => { botao.textContent = t; }, 1600); } };
  try { navigator.clipboard.writeText(txt).then(() => fim(true), () => fim(false)); } catch(e){ fim(false); }
}
// nome de branch com a chave do item (é assim que o GitHub e o GitLab ligam o código ao item)
function enBranch(i){
  const chave = (typeof chaveDe === 'function' ? chaveDe(i) : i.chave) || 'ITEM';
  const slug = String(i.titulo || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48).replace(/-$/, '');
  return chave + (slug ? '-' + slug : '');
}
// link colado: descobre se é PR/MR, commit ou branch
function enLerLink(url){
  let u; try { u = new URL(url.trim()); } catch(e){ return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const p = u.pathname.replace(/\/+$/, ''), gl = /gitlab/i.test(u.host) || p.includes('/-/');
  let m;
  if ((m = p.match(/^\/(.+?)\/pull\/(\d+)/)) || (m = p.match(/^\/(.+?)\/-\/merge_requests\/(\d+)/))) return {provedor:gl ? 'gitlab' : 'github', tipo:'pr', ref:m[2], repo:m[1], url:u.href};
  if ((m = p.match(/^\/(.+?)\/(?:-\/)?commits?\/([0-9a-f]{7,40})/i))) return {provedor:gl ? 'gitlab' : 'github', tipo:'commit', ref:m[2], repo:m[1], url:u.href};
  if ((m = p.match(/^\/(.+?)\/(?:-\/)?tree\/(.+)$/))) return {provedor:gl ? 'gitlab' : 'github', tipo:'branch', ref:decodeURIComponent(m[2]), repo:m[1], url:u.href};
  return null;
}

/* ---------- notas de versão a partir dos itens concluídos ---------- */
function enItensDaVersao(m){
  const escopo = issuesEm(m.no || UI.sel);
  const ligados = escopo.filter(i => i.marco === m.id);
  if (ligados.length) return {itens:ligados.filter(i => i.status === 'done'), modo:'ligados', total:ligados.length};
  const anteriores = enVersoes(m.no || UI.sel).filter(x => x.id !== m.id && x.entregue && (!m.entregue || x.entregue < m.entregue)).map(x => x.entregue).sort();
  const desde = anteriores.length ? anteriores[anteriores.length - 1] : null;
  const ate = m.entregue || null;
  return {itens:escopo.filter(i => i.status === 'done' && i.feito && (!desde || i.feito > desde) && (!ate || i.feito <= ate)), modo:'periodo', desde, total:0};
}
function enGerarNotas(m, soCliente){
  const r = enItensDaVersao(m);
  const its = r.itens.filter(i => !soCliente || i.vis === 'cliente');
  const grupo = {novidades:[], melhorias:[], correcoes:[]};
  its.forEach(i => { (i.tipo === 'bug' ? grupo.correcoes : ['epic','story'].includes(i.tipo) ? grupo.novidades : grupo.melhorias).push(i); });
  const linha = i => '- ' + i.titulo + ((typeof chaveDe === 'function' && chaveDe(i)) ? ' (' + chaveDe(i) + ')' : '');
  let t = '## ' + m.nome + '\n\n' + (m.entregue ? 'Publicada em ' + fmtData(m.entregue) + '.' : 'Prevista para ' + fmtData(m.data) + '.') + '\n';
  if (m.desc) t += '\n' + m.desc + '\n';
  [['novidades','Novidades'], ['melhorias','Melhorias'], ['correcoes','Correções']].forEach(([k, n]) => { if (grupo[k].length) t += '\n### ' + n + '\n' + grupo[k].map(linha).join('\n') + '\n'; });
  if (!its.length) t += '\nNenhum item concluído ' + (r.modo === 'ligados' ? 'entre os ligados a esta versão' : 'desde a última versão') + ' ainda.\n';
  return {texto:t, n:its.length, modo:r.modo, desde:r.desde};
}

/* ---------- a aba Entregas ---------- */
VIEWS.splice(Math.max(0, VIEWS.findIndex(v => v[0] === 'custos')), 0, ['entregas', 'Entregas', 'versões, publicações e código']);
EXPL_VIEW.entregas = 'Entregas: as versões do projeto com as notas de versão, o registro de tudo o que foi para o ar (quando, onde e qual versão) e os repositórios do GitHub e do GitLab ligados. Com o repositório ligado, branch, commit e pull request aparecem sozinhos em cada item e mudam o status dele.';
const _rViewEn = rView;
rView = function(){
  if (UI.view === 'entregas'){ const c = $('#ops-corpo'); if (!c) return; enView(c); return; }
  _rViewEn();
};
const _rOperacoesEn = rOperacoes;
rOperacoes = function(){
  _rOperacoesEn();
  const tipo = (UI.sel || '').split(':')[0];
  if (!['project','product','app'].includes(tipo) || !podeEditar()){ const b = $('.view-b[data-view="entregas"]'); if (b) (b.closest('.view-casa') || b).remove(); if (UI.view === 'entregas'){ UI.view = 'dashboard'; rView(); } }
};
function enView(c){
  if (!EN.repos || !EN.pubs){ c.innerHTML = '<p class="sec" style="padding:24px">Lendo as entregas...</p>'; enCarregar().then(() => { if (UI.view === 'entregas' && $('#ops-corpo')) enView($('#ops-corpo')); }); return; }
  c.innerHTML = enHTML(UI.sel);
  enCarregarAtividade(UI.sel);
}
function enHTML(chave){
  const pode = podeEditar(), nos = enNos(chave);
  const repos = EN.repos.filter(r => nos.has(r.no_id));
  const pubs = EN.pubs.filter(p => nos.has(p.no_id)).slice().sort((x, y) => String(y.publicado_em).localeCompare(String(x.publicado_em)));
  const versoes = enVersoes(chave);
  const lixo = (attr, id, nome) => pode ? '<button type="button" class="ico-btn en2-lixo" ' + attr + '="' + id + '" aria-label="Excluir ' + esc(nome) + '" title="Excluir">' + TF_ICO.lixo + '</button>' : '';
  const situ = m => { const atr = !m.entregue && m.data && parse(m.data) < HOJE; return m.entregue ? ['ok', 'No ar desde ' + fmtData(m.entregue)] : atr ? ['atraso', 'Atrasada · era ' + fmtData(m.data)] : ['prev', 'Prevista para ' + fmtData(m.data)]; };
  const itensV = m => { const lig = issuesEm(m.no || chave).filter(i => i.marco === m.id); return [lig.filter(i => i.status === 'done').length, lig.length]; };
  // 1, 2, 3: do código ao ar
  const prox = versoes.filter(m => !m.entregue).sort((x, y) => String(x.data).localeCompare(String(y.data)))[0];
  const ult = pubs[0];
  const passo = (n, cls, tit, valor, dica, botao) => '<li class="en2-passo ' + cls + '"><span class="en2-n">' + n + '</span><div class="en2-p-t"><small>' + tit + '</small><b>' + valor + '</b><span>' + dica + '</span></div>' + (pode && botao ? botao : '') + '</li>';
  const [pf, pt] = prox ? itensV(prox) : [0, 0];
  const trilho = '<ol class="en2-trilho" aria-label="Do código ao ar">' +
    passo(1, repos.length ? 'feito' : '', 'Código', repos.length ? repos.length + (repos.length === 1 ? ' repositório ligado' : ' repositórios ligados') : 'Nenhum repositório', 'Branch, commit e PR com a chave do item (ex.: BL-37) aparecem no item sozinhos',
      '<button type="button" class="btn sec peq" data-en-novo-repo>' + EN_ICO.branch + 'Ligar repositório</button>') +
    passo(2, prox ? 'feito' : '', 'Próxima versão', prox ? esc(prox.nome) + ' <em>' + esc(situ(prox)[1]) + '</em>' : 'Nenhuma versão planejada', prox ? (pt ? pf + ' de ' + pt + ' itens aceitos' : 'Sem itens ligados: as notas pegam o que foi concluído') : 'Uma versão junta o que vai para o ar de uma vez',
      '<button type="button" class="btn peq" data-en-nova-versao>' + ICO.mais + 'Nova versão</button>') +
    passo(3, ult ? 'feito' : '', 'No ar', ult ? esc(ult.versao || 'Sem versão') + ' <em>' + esc(enAmb(ult.ambiente)) + ', ' + esc(enHa(ult.publicado_em)) + '</em>' : 'Nada publicado ainda', ult ? (EN_ST_PUB[ult.status] || ult.status) : 'Registre aqui ou deixe chegar sozinho do repositório',
      '<button type="button" class="btn sec peq" data-en-nova-pub>' + EN_ICO.foguete + 'Registrar publicação</button>') + '</ol>';
  // versões: uma linha por versão
  const linhaV = m => { const [f, t] = itensV(m), st = situ(m);
    return '<li class="en2-v en2-' + st[0] + '"><div class="en2-v-nome">' + EN_ICO.versao + '<div><b>' + esc(m.nome) + '</b>' + (m.no && m.no !== noDono(chave) ? ' <span class="en2-onde">' + esc(nomeDe(m.no)) + '</span>' : '') + (m.desc ? '<small>' + esc(m.desc) + '</small>' : '') + '</div></div>' +
      '<span class="en2-pilula en2-' + st[0] + '">' + esc(st[1]) + '</span>' +
      '<div class="en2-prog">' + (t ? '<div class="rl-barra fina"><i style="width:' + (f / t * 100) + '%"></i></div><small>' + f + ' de ' + t + ' itens</small>' : '<small>sem itens ligados</small>') + '</div>' +
      '<div class="en2-acoes"><button type="button" class="btn fant peq" data-en-notas="' + m.id + '">' + (m.notas ? 'Notas' : 'Gerar notas') + '</button>' +
      (pode && !m.entregue ? '<button type="button" class="btn sec peq" data-en-publicar="' + m.id + '">' + EN_ICO.foguete + 'Publicar</button>' : '') + lixo('data-en-excluir-versao', m.id, m.nome) + '</div></li>'; };
  // no ar: histórico curto
  const linhaP = p => '<li class="en2-pub"><span class="en2-bola en-st-' + esc(p.status) + '" title="' + esc(EN_ST_PUB[p.status] || p.status) + '"></span><div><b>' + esc(p.versao || 'Sem versão') + '</b> <span class="en2-amb">' + esc(enAmb(p.ambiente)) + '</span>' +
    '<small>' + esc(enData(p.publicado_em)) + ' · ' + esc(EN_ORIGEM[p.origem] || p.origem) + (p.url ? ' · <a href="' + esc(p.url) + '" target="_blank" rel="noopener noreferrer">abrir</a>' : '') + (p.observacao ? '<br>' + esc(p.observacao) : '') + '</small></div>' + lixo('data-en-excluir-pub', p.id, 'a publicação ' + (p.versao || '')) + '</li>';
  // repositórios: uma linha por repositório
  const linhaR = r => '<li class="en2-repo"><div class="en2-repo-t">' + (EN_ICO[r.provedor] || '') + '<div><a href="' + esc(r.url || (r.provedor === 'gitlab' ? 'https://gitlab.com/' : 'https://github.com/') + r.nome) + '" target="_blank" rel="noopener noreferrer"><b>' + esc(r.nome) + '</b></a>' +
      '<small class="' + (r.ultimo_erro ? 'en2-erro' : '') + '">' + (r.ultimo_erro ? esc(r.ultimo_erro) : r.ultimo_evento_em ? 'Último aviso: ' + esc(r.ultimo_evento) + ', ' + esc(enHa(r.ultimo_evento_em)) : 'Ainda sem avisos. Eles chegam sozinhos a cada push, pull request ou publicação') + '</small></div></div>' +
    '<div class="en2-repo-a">' + (pode ? '<label class="en-liga"><input type="checkbox" data-en-mover="' + r.id + '"' + (r.mover_status ? ' checked' : '') + '> Status anda sozinho</label>' +
      '<span class="en2-repo-b"><button type="button" class="btn fant peq" data-en-trocar-repo="' + r.id + '">Trocar</button><button type="button" class="btn fant peq" data-en-excluir-repo="' + r.id + '">Desligar</button></span>' : '') + '</div></li>';
  const caixa = (tit, ajuda, corpo, vazio) => '<section class="en2-caixa"><header><h3>' + tit + '</h3><p>' + ajuda + '</p></header>' + (corpo || '<p class="en2-vazio">' + vazio + '</p>') + '</section>';
  return '<div class="en2">' + (EN.erro ? '<p class="aviso-faixa">Não deu para ler tudo do banco: ' + esc(EN.erro) + '</p>' : '') + trilho +
    '<div class="en2-grade"><div class="en2-col">' +
      caixa('Versões', 'Cada entrega com nome (como v1.2.0). Ligue itens a uma versão pelo campo Versão do item.', versoes.length ? '<ul class="en2-lista">' + versoes.map(linhaV).join('') + '</ul>' : '', 'Nenhuma versão ainda. Crie a primeira em "Nova versão".') +
      '<section class="en2-caixa"><header><h3>Atividade de código</h3><p>O que chegou do repositório, com o item de cada um.</p></header><div id="en-atividade"><p class="en2-vazio">Lendo...</p></div></section>' +
    '</div><div class="en2-col">' +
      caixa('No ar', 'Cada vez que algo foi publicado: qual versão, onde e quando.', pubs.length ? '<ul class="en2-lista">' + pubs.slice(0, 12).map(linhaP).join('') + '</ul>' : '', 'Nada publicado ainda.') +
      caixa('Repositórios', 'O código no GitHub ou no GitLab.', repos.length ? '<ul class="en2-lista">' + repos.map(linhaR).join('') + '</ul>' : '', 'Nenhum repositório ligado. Em "Ligar repositório", conecte a conta do GitHub ou do GitLab e escolha o repositório.') +
    '</div></div></div>';
}
async function enCarregarAtividade(chave){
  const el = $('#en-atividade'); if (!el) return;
  const nos = enNos(chave), repos = (EN.repos || []).filter(r => nos.has(r.no_id)).map(r => r.id);
  const itensEscopo = new Set(issuesEm(chave).map(i => i.id));
  let L = [];
  try {
    if (!COM_BANCO) L = enLocal().links.filter(l => itensEscopo.has(l.item_id));
    else if (repos.length) L = (await enLer('codigo_vinculos', {em:['repositorio_id', repos], ordem:'quando', limite:60})).filter(l => !l.item_id || itensEscopo.has(l.item_id));
  } catch(e){ el.innerHTML = '<p class="sec">Não deu para ler a atividade: ' + esc(tfErro(e)) + '</p>'; return; }
  if (!$('#en-atividade')) return;
  L = L.slice().sort((a, b) => String(b.quando).localeCompare(String(a.quando))).slice(0, 30);
  el.innerHTML = L.length ? '<ul class="en-feed">' + L.map(l => { const i = byId('issues', l.item_id);
    return '<li>' + (EN_ICO[l.tipo] || '') + '<span class="en-feed-t"><b>' + esc(l.tipo === 'pr' ? (l.provedor === 'gitlab' ? 'MR !' : 'PR #') + l.ref : l.tipo === 'commit' ? String(l.ref).slice(0, 7) : l.ref) + '</b> ' + esc(l.titulo && l.titulo !== l.ref ? l.titulo : '') +
      '<small>' + (i ? '<button type="button" class="en-link-item" data-abrir-item="' + i.id + '">' + esc((typeof chaveDe === 'function' && chaveDe(i)) || '') + ' ' + esc(i.titulo) + '</button> · ' : '') + esc(EN_EST[l.estado] || l.estado) + (l.autor ? ' · ' + esc(l.autor) : '') + ' · ' + esc(enHa(l.quando)) + '</small></span>' +
      (l.url ? '<a class="btn fant peq" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">Abrir</a>' : '') + '</li>'; }).join('') + '</ul>'
    : '<p class="en2-vazio">' + (repos.length || !COM_BANCO ? 'Nada ainda. Coloque a chave do item (por exemplo BL-37) no nome do branch, na mensagem do commit ou no título do PR.' : 'Ligue um repositório para ver aqui o código de cada item.') + '</p>';
}

/* ---------- versões ---------- */
function enProximoNome(chave){
  const v = enVersoes(chave).map(m => (m.nome.match(/(\d+)\.(\d+)(?:\.(\d+))?/) || null)).filter(Boolean).map(m => [+m[1], +m[2], +(m[3] || 0)]).sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2])[0];
  return v ? 'v' + v[0] + '.' + (v[1] + 1) + '.0' : 'v1.0.0';
}
function enNovaVersao(){
  const chave = noDono(UI.sel);
  const soltos = issuesEm(chave).filter(i => i.status === 'done' && !i.marco);
  const ult = enVersoes(chave).filter(m => m.entregue).map(m => m.entregue).sort().pop();
  const novosFeitos = soltos.filter(i => !ult || (i.feito && i.feito > ult));
  const pendentes = issuesEm(chave).filter(i => i.status !== 'done' && !i.marco);
  modal('Nova versão', '<p class="sec tf-nota" style="margin-top:0">Uma versão junta o que vai para o ar de uma vez. Dela saem as notas de versão.</p>' +
    '<div class="grade-form"><label class="lb">Nome<input class="campo" id="en-v-n" value="' + esc(enProximoNome(chave)) + '"></label><label class="lb">Data de entrega<input class="campo" type="date" id="en-v-d" required value="' + iso(dAdd(HOJE, 14)) + '"></label>' +
    '<label class="lb largo">Resumo (opcional)<input class="campo" id="en-v-r" placeholder="Ex.: cadastro de clientes e painel do CEO"></label>' +
    '<label class="lb largo">Meta da versão<input class="campo" id="en-v-m" maxlength="1000" placeholder="Ex.: o lojista publica anúncios sem ligar para o suporte"></label></div>' +
    '<div class="tf-opcoes">' + (novosFeitos.length ? '<label><input type="checkbox" id="en-v-f" checked> Ligar os ' + novosFeitos.length + ' itens aceitos desde a última versão</label>' : '') +
      (pendentes.length ? '<label><input type="checkbox" id="en-v-p"> Ligar também os ' + pendentes.length + ' itens em aberto sem versão</label>' : '') +
      '<label><input type="checkbox" id="en-v-c" checked> O cliente vê esta versão</label></div>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Criar versão', acao:dl => {
      const nome = $('#en-v-n', dl).value.trim(); if (!nome){ toast('Dê um nome à versão'); return false; }
      if (!$('#en-v-d', dl).value){ toast('Escolha a data de entrega da versão'); return false; }
      if (enVersoes(chave).some(m => m.nome.toLowerCase() === nome.toLowerCase())){ toast('Já existe uma versão com esse nome'); return false; }
      const lig = [].concat($('#en-v-f', dl) && $('#en-v-f', dl).checked ? novosFeitos : [], $('#en-v-p', dl) && $('#en-v-p', dl).checked ? pendentes : []);
      tfComDesfazer('Versão ' + nome + ' criada' + (lig.length ? ', com ' + lig.length + ' itens.' : '.'), () => {
        const m = {id:uid('mc'), no:chave, tipo:'release', nome, desc:$('#en-v-r', dl).value.trim(), data:$('#en-v-d', dl).value, vis:$('#en-v-c', dl).checked, entregue:null, notas:'', meta:$('#en-v-m', dl).value.trim()};
        D.marcos.push(m); lig.forEach(i => { i.marco = m.id; });
      });
      if (UI.view === 'entregas') rView();
    }}]);
}
function enNotas(id){
  const m = byId('marcos', id); if (!m) return;
  const pode = podeEditar();
  const inicial = m.notas || enGerarNotas(m, false).texto;
  const dlg = modal('Notas de versão · ' + esc(m.nome), '<p class="sec tf-nota" style="margin-top:0">' + (m.notas ? 'Notas salvas. Dá para editar ou gerar de novo a partir dos itens.' : 'Geradas a partir dos itens concluídos. Ajuste o texto se quiser e salve.') + '</p>' +
    (pode ? '<div class="tf-opcoes" style="margin:10px 0"><label><input type="checkbox" id="en-n-c"> Só os itens que o cliente vê</label></div>' : '') +
    '<div class="en-notas"><div class="tf-editor en-notas-ed">' + (pode ? '<div class="tf-barra" role="toolbar" aria-label="Formatação do texto">' + TF_BARRA.map(([k, t, ic]) => '<button type="button" class="tf-bb" data-en-fmt="' + k + '" title="' + t + '" aria-label="' + t + '">' + ic + '</button>').join('') + '</div>' : '') +
      '<textarea class="campo tf-area" id="en-n-t" rows="14"' + (pode ? '' : ' readonly') + ' aria-label="Texto das notas">' + esc(inicial) + '</textarea></div>' +
      '<div class="en-notas-ver"><p class="rotulo-mini">Como fica</p><div class="tf-md" id="en-n-v">' + tfMd(inicial) + '</div></div></div>',
    [pode ? {txt:'Gerar de novo', cls:'fant', acao:dl => { const g = enGerarNotas(m, $('#en-n-c', dl).checked); $('#en-n-t', dl).value = g.texto; $('#en-n-v', dl).innerHTML = tfMd(g.texto); toast(g.n + (g.n === 1 ? ' item' : ' itens') + ' nas notas'); return false; }} : null,
     {txt:'Copiar o texto', cls:'sec', acao:dl => { enCopiar($('#en-n-t', dl).value); toast('Texto copiado'); return false; }},
     pode ? {txt:'Salvar notas', acao:dl => { const t = $('#en-n-t', dl).value; tfComDesfazer('Notas de ' + m.nome + ' salvas.', () => { m.notas = t; }); if (UI.view === 'entregas') rView(); }} : {txt:'Fechar'}].filter(Boolean));
  dlg.addEventListener('input', e => { if (e.target.id === 'en-n-t') $('#en-n-v', dlg).innerHTML = tfMd(e.target.value); });
  dlg.addEventListener('click', e => { const b = e.target.closest('[data-en-fmt]'); if (b){ tfFormatar($('#en-n-t', dlg), b.dataset.enFmt); $('#en-n-v', dlg).innerHTML = tfMd($('#en-n-t', dlg).value); } });
}
function enExcluirVersao(id){
  const m = byId('marcos', id); if (!m) return;
  const n = D.issues.filter(i => i.marco === m.id).length;
  tfExcluirPerguntaSimples('Excluir a versão ' + esc(m.nome) + '?', (n ? 'Os ' + n + ' itens ligados a ela ficam sem versão. ' : '') + 'As publicações registradas continuam no histórico.', () => {
    tfComDesfazer('Versão ' + m.nome + ' excluída.', () => { D.marcos = D.marcos.filter(x => x.id !== m.id); D.issues.forEach(i => { if (i.marco === m.id) i.marco = null; }); });
    if (UI.view === 'entregas') rView();
  });
}
function tfExcluirPerguntaSimples(titulo, texto, fazer){
  modal(titulo, '<p style="margin:0">' + texto + '</p>', [{txt:'Cancelar', cls:'sec'}, {txt:'Excluir', cls:'acento', acao:() => { fazer(); }}]);
}

/* ---------- publicações ---------- */
function enNovaPublicacao(marcoId){
  const chave = noDono(UI.sel), versoes = enVersoes(chave);
  const m0 = marcoId ? byId('marcos', marcoId) : versoes.find(m => !m.entregue);
  const onde = nosDentro(chave).filter(k => !k.startsWith('client')).map(k => [k, nomeDe(k)]);
  const dlg = modal('Registrar publicação', '<p class="sec tf-nota" style="margin-top:0">Anote o que foi para o ar. Com o repositório ligado, as publicações do GitHub e do GitLab chegam sozinhas.</p>' +
    '<div class="grade-form"><label class="lb">Versão<select class="sel" id="en-p-v"><option value="">Sem versão cadastrada</option>' + versoes.map(m => '<option value="' + m.id + '"' + (m0 && m0.id === m.id ? ' selected' : '') + '>' + esc(m.nome) + (m.entregue ? ' (já publicada)' : '') + '</option>').join('') + '</select></label>' +
    '<label class="lb">Ou escreva a versão<input class="campo" id="en-p-t" placeholder="Ex.: v1.2.1 ou o commit"></label>' +
    '<label class="lb">Ambiente<select class="sel" id="en-p-a"><option value="producao">Produção (no ar para todos)</option><option value="homologacao">Homologação (teste do cliente)</option><option value="previa">Prévia</option></select></label>' +
    '<label class="lb">Situação<select class="sel" id="en-p-s"><option value="sucesso">Deu certo</option><option value="falha">Falhou</option><option value="em_andamento">Em andamento</option></select></label>' +
    '<label class="lb">Quando<input class="campo" type="datetime-local" id="en-p-q" value="' + tfLocal(new Date()) + '"></label>' +
    '<label class="lb">Onde<select class="sel" id="en-p-o">' + onde.map(([k, n]) => '<option value="' + k + '"' + (k === chave ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select></label>' +
    '<label class="lb largo">Link (opcional)<input class="campo" id="en-p-l" placeholder="https://"></label><label class="lb largo">Observação (opcional)<input class="campo" id="en-p-ob"></label></div>' +
    '<div class="tf-opcoes"><label id="en-p-ent-l"><input type="checkbox" id="en-p-ent" checked> Marcar a versão como publicada</label></div>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Registrar', acao:dl => {
      const mid = $('#en-p-v', dl).value, m = mid ? byId('marcos', mid) : null, livre = $('#en-p-t', dl).value.trim();
      const versao = m ? m.nome : livre; if (!versao){ toast('Escolha a versão ou escreva qual foi'); return false; }
      const url = $('#en-p-l', dl).value.trim(); if (url && !/^https?:\/\//.test(url)){ toast('O link precisa começar com https://'); return false; }
      const q = new Date($('#en-p-q', dl).value); if (isNaN(q)){ toast('Escolha o dia e a hora'); return false; }
      const amb = $('#en-p-a', dl).value, st = $('#en-p-s', dl).value, marcar = m && !m.entregue && $('#en-p-ent', dl).checked && amb === 'producao' && st === 'sucesso';
      enInserir('publicacoes', {no_id:$('#en-p-o', dl).value.split(':')[1], marco_id:m ? m.id : null, versao, ambiente:amb, status:st, origem:'manual', url:url || null, observacao:$('#en-p-ob', dl).value.trim() || null, publicado_em:q.toISOString()}).then(p => {
        if (!p) return; EN.pubs = [p].concat(EN.pubs || []);
        if (marcar){ m.entregue = iso(q); salvar(); }
        if (UI.view === 'entregas') rView();
        tfAviso('Publicação de ' + versao + ' registrada' + (marcar ? ' e a versão marcada como publicada.' : '.'), [], 4000);
      });
    }}]);
  const ver = () => { const m = byId('marcos', $('#en-p-v', dlg).value); $('#en-p-ent-l', dlg).hidden = !m || !!m.entregue || $('#en-p-a', dlg).value !== 'producao' || $('#en-p-s', dlg).value !== 'sucesso'; $('#en-p-t', dlg).disabled = !!m; };
  dlg.addEventListener('change', ver); ver();
}

/* ---------- repositórios: ligar e desligar ficam em git.js (contas conectadas do GitHub e do GitLab) ---------- */
/* ---------- no item: Desenvolvimento ---------- */
function enCartaoItem(i, links, pode){
  const temRepo = (EN.repos || []).some(r => enNos('ws:' + i.ws).has(r.no_id));
  const grupos = [['pr', 'Pull requests'], ['branch', 'Branches'], ['commit', 'Commits']];
  const linha = l => '<li class="en-l">' + (EN_ICO[l.tipo] || '') + '<span class="en-l-t">' + (l.url ? '<a href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' : '<span>') +
      esc(l.tipo === 'pr' ? (l.provedor === 'gitlab' ? '!' : '#') + l.ref + (l.titulo ? ' ' + l.titulo : '') : l.tipo === 'commit' ? String(l.ref).slice(0, 7) + (l.titulo ? ' ' + l.titulo : '') : l.ref) + (l.url ? '</a>' : '</span>') +
      '<small>' + esc([l.autor, enHa(l.quando)].filter(Boolean).join(' · ')) + '</small></span>' +
      '<span class="en-est en-est-' + esc(l.estado) + '">' + esc(EN_EST[l.estado] || l.estado) + '</span>' +
      (pode ? '<button type="button" class="ico-btn" data-en-tirar-link="' + l.id + '" aria-label="Excluir este link" title="Excluir este link">' + ICO.fechar + '</button>' : '') + '</li>';
  const corpo = links.length ? grupos.map(([t, n]) => { const g = links.filter(l => l.tipo === t); if (!g.length) return '';
      const mostra = t === 'commit' ? g.slice(0, 4) : g;
      return '<p class="rotulo-mini en-g">' + n + ' · ' + g.length + '</p><ul class="en-ls">' + mostra.map(linha).join('') + (g.length > mostra.length ? '<li class="sec en-mini">e mais ' + (g.length - mostra.length) + '</li>' : '') + '</ul>'; }).join('')
    : '<p class="sec en-mini">' + (temRepo ? 'Nada ainda. Use o nome de branch abaixo ou a chave ' + esc((typeof chaveDe === 'function' && chaveDe(i)) || '') + ' no commit ou no título do PR.' : 'Ligue o repositório na aba Entregas do projeto, ou cole aqui o link de um PR, commit ou branch.') + '</p>';
  return '<section class="g-cartao en-dev"><h4>Desenvolvimento' + I('Desenvolvimento: os branches, commits e pull requests deste item no GitHub ou no GitLab. Com o repositório ligado, chegam sozinhos pela chave do item e o status anda sozinho.') + '</h4>' + corpo +
    (pode ? '<div class="en-dev-acoes"><button type="button" class="btn sec peq" data-en-copiar-branch="' + i.id + '" title="' + esc(enBranch(i)) + '">' + EN_ICO.branch + 'Copiar nome do branch</button><button type="button" class="btn fant peq" data-en-colar-link="' + i.id + '">Colar link</button></div>' +
      '<form class="g-add en-colar" data-en-form-link="' + i.id + '" hidden><input class="campo" name="u" placeholder="Link do PR, commit ou branch"><button class="btn sec peq" type="submit">Ligar</button></form>' : '') + '</section>';
}
const _abrirItemEn = abrirItem;
abrirItem = function(id){
  _abrirItemEn(id);
  const i = byId('issues', id), g = $('#gaveta-wrap .gaveta'); if (!i || !g || !podeEditar()) return;
  const lat = $('.g-lateral', g); if (!lat) return;
  const ponto = document.createElement('div'); ponto.className = 'en-dev-lugar'; const prim = lat.querySelector('.g-cartao'); if (prim) prim.after(ponto); else lat.prepend(ponto);
  const pinta = links => { if (itemAberto !== id || !ponto.isConnected) return; ponto.outerHTML = enCartaoItem(i, links, podeEditar()); };
  const ler = COM_BANCO ? enLer('codigo_vinculos', {eq:['item_id', id], ordem:'quando'}) : Promise.resolve(enLocal().links.filter(l => l.item_id === id));
  Promise.all([ler, enCarregar()]).then(([L]) => pinta(L), () => pinta([]));
};
async function enRedesenharItem(id){ if (itemAberto === id) abrirItem(id); if (UI.view === 'entregas') enCarregarAtividade(UI.sel); }

/* ---------- cliques ---------- */
document.addEventListener('click', e => {
  let b;
  if (e.target.closest('[data-en-nova-versao]')){ enNovaVersao(); return; }
  if (e.target.closest('[data-en-nova-pub]')){ enNovaPublicacao(null); return; }
  if (e.target.closest('[data-en-novo-repo]')){ gcLigarRepo(); return; }
  if ((b = e.target.closest('[data-en-notas]'))){ enNotas(b.dataset.enNotas); return; }
  if ((b = e.target.closest('[data-en-publicar]'))){ enNovaPublicacao(b.dataset.enPublicar); return; }
  if ((b = e.target.closest('[data-en-excluir-versao]'))){ enExcluirVersao(b.dataset.enExcluirVersao); return; }
  if ((b = e.target.closest('[data-en-excluir-repo]'))){ gcDesligarRepo(b.dataset.enExcluirRepo); return; }
  if ((b = e.target.closest('[data-en-trocar-repo]'))){ gcDesligarRepo(b.dataset.enTrocarRepo, true); return; }
  if ((b = e.target.closest('[data-en-excluir-pub]'))){ const id = b.dataset.enExcluirPub, p = (EN.pubs || []).find(x => x.id === id); if (!p) return;
    tfExcluirPerguntaSimples('Excluir o registro da publicação ' + esc(p.versao || '') + '?', 'Sai só do histórico do CicloDev. O que está no ar não muda.', () => {
      enApagar('publicacoes', id).then(ok => { if (!ok) return; EN.pubs = EN.pubs.filter(x => x.id !== id); if (UI.view === 'entregas') rView(); tfAviso('Registro excluído.', [], 3000); }); }); return; }
  if ((b = e.target.closest('[data-en-copiar-branch]'))){ const i = byId('issues', b.dataset.enCopiarBranch); if (!i) return; const n = enBranch(i); enCopiar(n, b); tfAviso('Nome do branch copiado: ' + n, [], 5000); return; }
  if ((b = e.target.closest('[data-en-colar-link]'))){ const f = $('[data-en-form-link="' + b.dataset.enColarLink + '"]'); if (f){ f.hidden = !f.hidden; if (!f.hidden) $('input', f).focus(); } return; }
  if ((b = e.target.closest('[data-en-tirar-link]'))){ const id = b.dataset.enTirarLink, item = itemAberto;
    tfExcluirPerguntaSimples('Excluir este link do código?', 'Sai só do item. O branch, o commit ou o PR continuam no ' + 'repositório.', () => { enApagar('codigo_vinculos', id).then(ok => { if (ok){ enRedesenharItem(item); toast('Link excluído'); } }); }); return; }
});
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-en-form-link]'); if (!f) return; e.preventDefault();
  const i = byId('issues', f.dataset.enFormLink), v = $('input', f).value, l = enLerLink(v);
  if (!i) return; if (!l){ toast('Cole o link de um pull request, merge request, commit ou branch do GitHub ou do GitLab'); return; }
  const repo = (EN.repos || []).find(r => r.nome.toLowerCase() === String(l.repo).toLowerCase());
  enInserir('codigo_vinculos', {item_id:i.id, repositorio_id:repo ? repo.id : null, provedor:l.provedor, tipo:l.tipo, ref:l.ref, titulo:null, url:l.url, estado:l.tipo === 'pr' ? 'aberto' : 'ativo'}).then(x => { if (x){ enRedesenharItem(i.id); toast('Link ligado ao item'); } });
});
document.addEventListener('change', e => {
  const t = e.target; if (!t.matches || !t.matches('[data-en-mover]')) return;
  const r = (EN.repos || []).find(x => x.id === t.dataset.enMover); if (!r) return;
  enAlterar('repositorios', r.id, {mover_status:t.checked}).then(ok => { if (ok){ r.mover_status = t.checked; toast(t.checked ? 'O status vai mudar sozinho' : 'O status não muda mais sozinho'); } else t.checked = !t.checked; });
});

/* ---------- banco: as notas da versão ---------- */
const _montarDadosEn = montarDados;
montarDados = function(T, eu){
  const d = _montarDadosEn(T, eu);
  const mT = new Map((T.marcos || []).map(m => [m.id, m]));
  d.marcos.forEach(m => { const r = mT.get(m.id); m.notas = r && r.notas || ''; });
  EN.repos = null; EN.pubs = null;
  return d;
};
const _linhasDaTelaEn = linhasDaTela;
linhasDaTela = function(d){
  const L = _linhasDaTelaEn(d);
  const mm = new Map(d.marcos.map(m => [m.id, m]));
  (L.marcos || []).forEach(r => { const m = mm.get(r.id); r.notas = m && m.notas ? m.notas : null; });
  return L;
};
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {EN, enGerarNotas, enLerLink, enBranch, abrirItem, rOperacoes});
