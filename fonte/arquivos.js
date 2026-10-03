/* ===== Arquivos no banco =====
   Imagem, áudio, vídeo, PDF e qualquer outro arquivo anexado vai para o depósito de arquivos do Supabase (bucket privado
   "anexos", parte 09) e ganha uma linha na tabela anexos (parte 04). Vale para: anexos dos itens, arquivos da ficha técnica,
   anexos dos pedidos do Atendimento e provas das etapas. Antes, só o nome (e uma cópia das imagens pequenas) ficava na tela.
   Caminho no depósito: <id do login>/<onde>/<uuid>-<nome do arquivo>; na ficha, o <onde> guarda também a seção.
   Para mostrar, o sistema pede ao banco um link temporário (1 hora) de cada arquivo. */
const AQ_TIPO = {'imagem':'imagem', 'áudio':'audio', 'audio':'audio', 'vídeo':'video', 'video':'video'};
const AQ_LIMITE = 52428800;   // 50 MB, o mesmo do bucket
const aqSlug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
const aqNomeSeguro = n => (String(n || 'arquivo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_').slice(-80)) || 'arquivo';
const aqEArquivo = x => x && x.tipo !== 'link';

// todos os arquivos que a tela conhece, com o lugar de cada um no banco
function aqTodos(d){
  const L = [];
  (d.issues || []).forEach(i => (i.refs || []).forEach(x => { if (aqEArquivo(x)) L.push({x, onde:'item', col:'item_id', alvo:i.id}); }));
  (d.requests || []).forEach(r => (r.anexos || []).forEach(x => { if (aqEArquivo(x)) L.push({x, onde:'pedido', col:'pedido_id', alvo:r.id}); }));
  Object.entries(d.sheets || {}).forEach(([k, s]) => { const nid = idNo(k); if (nid) (s.arquivos || []).forEach(x => { if (aqEArquivo(x)) L.push({x, onde:'ficha', col:'no_id', alvo:nid, sec:x.sec}); }); });
  Object.entries(d.stages || {}).forEach(([k, itens]) => Object.values(itens || {}).forEach(s => { const p = s && s.prova; if (p && (p._arq || p.storage) && (p.tipo === 'Arquivo' || p.tipo === 'Captura de tela' || p.storage || p._arq)) L.push({x:p, onde:'prova', col:'prova_id', alvo:null, prova:p}); }));
  return L;
}

// antes de gravar: manda para o depósito o que ainda não foi
async function aqEnviarPendentes(){
  const sb = window.ciclodevBanco; if (!sb || !sb.storage) return;
  const pend = aqTodos(D).filter(a => !a.x.storage && !a.x._enviando && (a.x._arq || String(a.x.url || '').startsWith('data:')));
  if (!pend.length) return;
  let uid = null; try { const {data} = await sb.auth.getSession(); uid = data && data.session && data.session.user && data.session.user.id; } catch(e){}
  if (!uid){ console.warn('Arquivos: sem login, não deu para enviar'); return; }
  for (const a of pend){
    const x = a.x; x._enviando = true;
    try {
      let blob = x._arq;
      if (!blob && String(x.url || '').startsWith('data:')) blob = await (await fetch(x.url)).blob();
      if (!blob) continue;
      if (blob.size > AQ_LIMITE){ toast('O arquivo ' + x.nome + ' passa de 50 MB e não foi guardado.'); continue; }
      const id = novoUuid(), pasta = a.onde === 'ficha' ? 'ficha/' + aqSlug(a.sec) : a.onde;
      const caminho = uid + '/' + pasta + '/' + id + '-' + aqNomeSeguro(x.nome);
      const {error} = await sb.storage.from('anexos').upload(caminho, blob, {contentType:blob.type || 'application/octet-stream', upsert:false});
      if (error){ toast('Não deu para guardar o arquivo ' + x.nome + ': ' + (error.message || error)); continue; }
      x._id = x._id && /^[0-9a-f-]{36}$/.test(x._id) ? x._id : id; x.storage = caminho; x.mime = blob.type || null; x.tam = blob.size;
      if (a.onde === 'prova' && !x.valor) x.valor = x.nome;   // a prova precisa de um valor: fica o nome do arquivo
    } catch(e){ console.warn('Arquivos', e); }
    finally { x._enviando = false; }
  }
}

// na gravação: uma linha em anexos para cada arquivo guardado no depósito
const _linhasDaTelaAq = linhasDaTela;
linhasDaTela = function(d){
  const L = _linhasDaTelaAq(d);
  L.anexos = L.anexos || [];
  const temItem = new Set((L.itens || []).map(r => r.id)), temPed = new Set((L.pedidos || []).map(r => r.id)), temNo = new Set((L.nos || []).map(r => r.id)), temProva = new Set((L.provas || []).map(r => r.id));
  const ja = new Set(L.anexos.map(r => r.id)), eu = idEu('master') || null;
  aqTodos(d).forEach(a => { const x = a.x; if (!x.storage) return;
    let alvo = a.alvo;
    if (a.onde === 'prova'){ alvo = a.prova._id; if (!alvo || !temProva.has(alvo)) return; }
    if ((a.onde === 'item' && !temItem.has(alvo)) || (a.onde === 'pedido' && !temPed.has(alvo)) || (a.onde === 'ficha' && !temNo.has(alvo))) return;
    const id = a.onde === 'prova' ? (x._anexo || (x._anexo = novoUuid())) : x._id; if (!id || ja.has(id)) return; ja.add(id);
    const row = {id, nome:x.nome || 'arquivo', tipo:AQ_TIPO[x.tipo] || 'documento', mime:x.mime || null, tamanho_bytes:x.tam == null ? null : +x.tam, storage_path:x.storage, enviado_por:x._por || eu};
    row[a.col] = alvo; L.anexos.push(row);
  });
  // o aviso "arquivos não vão para o banco" só vale para o que não conseguiu ir
  BANCO.arquivosFora = aqTodos(d).some(a => !a.x.storage && (a.x._arq || String(a.x.url || '').startsWith('data:')));
  return L;
};
// os anexos gravam depois dos pedidos e das provas, que eles apontam (e são apagados antes deles)
(function(){ const k = GRAVAR.findIndex(g => g[0] === 'anexos'); if (k >= 0){ const [g] = GRAVAR.splice(k, 1); const n = GRAVAR.findIndex(x => x[0] === 'notificacoes'); GRAVAR.splice(n >= 0 ? n : GRAVAR.length, 0, g); } })();

// na leitura: os arquivos voltam com o caminho no depósito (e a ficha, com a seção de cada um)
const _montarDadosAq = montarDados;
montarDados = function(T, eu){
  const d = _montarDadosAq(T, eu);
  const arqs = (T.anexos || []).filter(a => a.storage_path);
  const porId = new Map(arqs.map(a => [a.id, a]));
  const DE = {audio:'áudio', video:'vídeo', documento:'arquivo'};
  const ref = a => ({nome:a.nome, tipo:DE[a.tipo] || a.tipo, tam:a.tamanho_bytes || undefined, mime:a.mime || undefined, storage:a.storage_path, _id:a.id, _por:a.enviado_por || undefined, _banco:true});
  // itens: completa os que já vieram (ficam na mesma ordem)
  (d.issues || []).forEach(i => (i.refs || []).forEach(x => { const a = x._id && porId.get(x._id); if (a){ x.storage = a.storage_path; x.mime = a.mime || undefined; x._por = a.enviado_por || undefined; } }));
  // pedidos: refaz a lista com o que o banco tem
  const porPed = new Map(); arqs.filter(a => a.pedido_id).forEach(a => { if (!porPed.has(a.pedido_id)) porPed.set(a.pedido_id, []); porPed.get(a.pedido_id).push(ref(a)); });
  (d.requests || []).forEach(r => { const links = (r.anexos || []).filter(x => x.tipo === 'link'); r.anexos = links.concat(porPed.get(r.id) || []); });
  // ficha: a seção vem do caminho (…/ficha/<seção>/…)
  const secDe = {}; FICHA.forEach(([sec]) => { secDe[aqSlug(sec)] = sec; });
  const chaveDe = {}; [['clients', 'client'], ['projects', 'project'], ['products', 'product'], ['apps', 'app'], ['ws', 'ws']].forEach(([l, t]) => (d[l] || []).forEach(o => { chaveDe[o.id] = t + ':' + o.id; }));
  Object.values(d.sheets || {}).forEach(s => { s.arquivos = (s.arquivos || []).filter(x => !x.storage && x.tipo === 'link'); });
  arqs.filter(a => a.no_id).forEach(a => { const k = chaveDe[a.no_id]; if (!k) return; const s = d.sheets[k] || (d.sheets[k] = {campos:{}, custom:[], arquivos:[]});
    const m = /\/ficha\/([^/]+)\//.exec(a.storage_path); s.arquivos.push(Object.assign(ref(a), {sec:(m && secDe[m[1]]) || 'Anexos e anotações'})); });
  // provas: o arquivo fica junto da prova
  const porProva = new Map(arqs.filter(a => a.prova_id).map(a => [a.prova_id, a]));
  Object.values(d.stages || {}).forEach(itens => Object.values(itens || {}).forEach(s => { const p = s && s.prova; const a = p && p._id && porProva.get(p._id); if (a){ p.storage = a.storage_path; p.nome = a.nome; p._anexo = a.id; p.mime = a.mime || undefined; } }));
  AQ.links = null;
  return d;
};

// links temporários para mostrar e abrir os arquivos
const AQ = {links:null, pedindo:false, espera:0};
// os links chegaram: redesenha a janela do item, mas nunca debaixo de quem está digitando nela (espera parar)
function aqReabrir(){
  clearTimeout(AQ.espera); if (!itemAberto) return;
  if (typeof avOcupado === 'function' && avOcupado()){ AQ.espera = setTimeout(aqReabrir, 1000); return; }
  abrirItem(itemAberto);
}
async function aqPedirLinks(){
  const sb = window.ciclodevBanco; if (!sb || !sb.storage || AQ.pedindo) return;
  const L = aqTodos(D).filter(a => a.x.storage && !String(a.x.url || '').startsWith('data:') && !(a.x._urlAte > Date.now())); if (!L.length) return;
  AQ.pedindo = true;
  try {
    const caminhos = [...new Set(L.map(a => a.x.storage))];
    const {data, error} = await sb.storage.from('anexos').createSignedUrls(caminhos, 3600);
    if (error || !data) return;
    const url = new Map(data.filter(r => r && r.signedUrl).map(r => [r.path, r.signedUrl]));
    let mudou = false; L.forEach(a => { const u = url.get(a.x.storage); if (u){ a.x.url = u; a.x._urlAte = Date.now() + 3300000; mudou = true; } });
    if (mudou){ if (itemAberto) aqReabrir(); else if (UI.modulo === 'operacoes' && UI.view === 'sheet') rView(); else if (UI.modulo === 'servicedesk' && typeof rServiceDesk === 'function') rServiceDesk(); }
  } catch(e){ console.warn('Arquivos: links', e); }
  finally { AQ.pedindo = false; }
}
// o link temporário não é dado: não entra na gravação (a linha usa o caminho no depósito)
if (COM_BANCO){
  const _gravarAq = gravarNoBanco;
  gravarNoBanco = async function(){ await aqEnviarPendentes(); return _gravarAq.apply(this, arguments); };
  window.ciclodevGravarAgora = gravarNoBanco;
  const _carregarAq = carregarDoBanco;
  carregarDoBanco = async function(){ const r = await _carregarAq.apply(this, arguments); setTimeout(aqPedirLinks, 50); return r; };
  window.ciclodevCarregarBanco = carregarDoBanco;
  // ao abrir um item ou a ficha, garante os links (eles vencem em 1 hora)
  const _abrirItemAq = abrirItem;
  abrirItem = function(id){ const r = _abrirItemAq.apply(this, arguments); const i = byId('issues', id); if (i && (i.refs || []).some(x => x.storage && !(x._urlAte > Date.now()))) setTimeout(aqPedirLinks, 0); return r; };
}
// nada de arquivo acima de 50 MB: avisa na hora de escolher
document.addEventListener('change', e => { const t = e.target; if (!t || t.type !== 'file' || !t.files) return; const g = [...t.files].filter(f => f.size > AQ_LIMITE); if (g.length) toast('Passa de 50 MB e não vai ser guardado: ' + g.map(f => f.name).join(', ')); }, true);
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {aqTodos, aqEnviarPendentes});
