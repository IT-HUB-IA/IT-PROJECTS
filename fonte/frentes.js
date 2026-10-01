// ===== Frentes de trabalho padrão e para onde cada item vai sozinho =====
// Toda aplicação nova nasce com estas frentes. Quando o item não diz a frente, o CicloDev olha o texto
// (título, e o tipo do que foi lido do código) e põe na frente do assunto, desde que a aplicação tenha essa frente.
// A ordem da lista é a ordem de prioridade na hora de decidir: o assunto mais específico ganha (uma "tela de integração" vai para Integrações).
const FRENTES_PADRAO = [
  {nome:'Frontend', chave:'frontend', nomes:/^(front|frontend|front-end|telas?|interface)$/,
    re:/\b(tela|telas|pagina|paginas|botao|botoes|layout|formulario|modal|janela|menu|aba|abas|filtro|campo|grafico|dashboard|painel|css|html|responsiv\w*|componente\w*|front|frontend|react|vue|angular|celular|mobile)\b/},
  {nome:'Backend', chave:'backend', nomes:/^(back|backend|back-end|servidor|api|apis)$/,
    re:/\b(api|apis|endpoint\w*|rota|rotas|servico|servicos|regra de negocio|regras de negocio|calculo\w*|validacao|validacoes|validar|job|jobs|fila|filas|worker|cron|agendad\w*|processamento|back|backend|controller|spring|express|edge function)\b/},
  {nome:'Database', chave:'database', nomes:/^(database|banco|banco de dados|dados|db|bd)$/,
    re:/\b(tabela|tabelas|banco|schema|migration|migrations|migracao|sql|indice|indices|rls|trigger|gatilho\w*|view|views|procedure|rpc|coluna|colunas|backup|postgres|mysql|database)\b/},
  {nome:'Integrações', chave:'integracoes', nomes:/^(integra\w*)$/,
    re:/\b(integra\w*|webhook\w*|terceiro\w*|externo\w*|conexa|whats\w*|gmail|e-?mail\w*|sms|gateway|pix|boleto\w*|pagamento\w*|oauth|sso|sincroniz\w*|sync|sftp|ftp|sdk|crm|erp externo|mercado pago|stripe|asaas|github|gitlab|correios|receita federal|nota fiscal|nfe|nfse)\b/},
  {nome:'Infraestrutura', chave:'infraestrutura', nomes:/^(infra\w*|devops|deploy|operacao)$/,
    re:/\b(deploy|servidor\w*|vps|docker|kubernetes|pipeline|ci|cd|dominio|dns|ssl|https|hospedagem|nginx|monitora\w*|logs?|ambiente\w*|vercel|aws|cloudflare|infra\w*|devops)\b/},
  {nome:'Segurança', chave:'seguranca', nomes:/^(seguranca|security|appsec)$/,
    re:/\b(seguranca|vulnerab\w*|senha\w*|segredo\w*|token\w*|criptograf\w*|permiss\w*|nivel de acesso|niveis de acesso|lgpd|owasp|xss|injection|injecao|csrf|autentica\w*|2fa)\b/},
  {nome:'Testes', chave:'testes', nomes:/^(testes?|qa|qualidade)$/,
    re:/\b(teste|testes|qa|homologa\w*|e2e|cobertura|regressao|automatiza\w* de teste)\b/},
  {nome:'Design', chave:'design', nomes:/^(design|ux|ui|ux\/ui|ui\/ux)$/,
    re:/\b(design|prototipo\w*|figma|identidade visual|ux|ui|wireframe\w*|marca|logo\w*|paleta|tipografia)\b/},
  {nome:'Documentação', chave:'documentacao', nomes:/^(documenta\w*|docs?)$/,
    re:/\b(documenta\w*|manual do usuario|readme|changelog|tutorial\w*)\b/}
];
// a ordem de decisão (mais específico primeiro); a ordem de criação segue FRENTES_PADRAO
const FR_ORDEM_DECISAO = ['integracoes', 'seguranca', 'testes', 'infraestrutura', 'documentacao', 'design', 'database', 'frontend', 'backend'];
const frNorm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
// cria as frentes padrão de uma aplicação (as que ela ainda não tem)
function criarFrentesPadrao(appId){
  const ja = D.ws.filter(w => w.app === appId && w.status !== 'archived').map(w => frChave(w.nome));
  FRENTES_PADRAO.forEach(f => { if (!ja.includes(f.chave)) D.ws.push({id:uid('ws'), app:appId, nome:f.nome, status:'active', wip:3}); });
}
// de qual assunto padrão é a frente (pelo nome dela), ou null
function frChave(nome){ const n = frNorm(nome); const f = FRENTES_PADRAO.find(x => x.nomes.test(n)); return f ? f.chave : null; }
// o assunto do texto, ou null quando nada bate
function frAssunto(texto){
  const t = ' ' + frNorm(texto) + ' ';
  for (const k of FR_ORDEM_DECISAO){ const f = FRENTES_PADRAO.find(x => x.chave === k); if (f.re.test(t)) return k; }
  return null;
}
// a frente certa para o texto entre as frentes de UMA aplicação; null quando o texto não diz ou a aplicação não tem essa frente
function frenteSugerida(appId, texto, assunto){
  const k = assunto || frAssunto(texto); if (!k || !appId) return null;
  return D.ws.find(w => w.app === appId && w.status !== 'archived' && frChave(w.nome) === k) || null;
}
// o assunto do que a análise leu do código e do banco
function frAssuntoInventario(x){
  const fixo = {integracao:'integracoes', infra:'infraestrutura', teste:'testes'}[x.tipo]; if (fixo) return fixo;
  const t = (x.nome || '') + ' ' + (x.grupo || '') + ' ' + (x.onde || '');
  const k = frAssunto(t);
  if (k === 'integracoes' || k === 'seguranca' || k === 'testes') return k;
  return {tela:'frontend', api:'backend', job:'backend', tabela:'database', modulo:null, integracao:'integracoes'}[x.tipo] || k;
}
// o assunto de um achado da análise (pela regra e pelo arquivo)
function frAssuntoAchado(a){
  const r = String(a.regra || '');
  if (/^(BD|ARQ)-/.test(r)) return 'database';
  if (/^QUA-/.test(r)) return /\.(jsx|tsx|vue|svelte|html?|css)\b/i.test(a.onde || '') ? 'frontend' : 'backend';
  return 'seguranca';
}
// criar rápido (Quadro, colunas, Fila): a frente escolhida na Estrutura; senão a do assunto do título, na aplicação de sempre; senão a primeira
function wsDoAssunto(titulo){
  if (UI.sel.startsWith('ws:')) return UI.sel.slice(3);
  const base = primeiroWs(UI.sel), w = base && byId('ws', base);
  const s = w ? frenteSugerida(w.app, titulo) : null;
  return s ? s.id : base;
}
// janela Novo item: enquanto a pessoa escreve o título, o "Onde" vai para a frente do assunto (até ela mesma escolher outra)
const _novoItemFr = novoItem;
novoItem = function(){
  _novoItemFr.apply(this, arguments);
  const t = $('#ni-t'), s = $('#ni-ws'); if (!t || !s || UI.sel.startsWith('ws:')) return;
  let escolheu = false; s.addEventListener('change', () => { escolheu = true; });
  t.addEventListener('input', () => {
    if (escolheu) return;
    const k = frAssunto(t.value); if (!k) return;
    const atual = byId('ws', s.value), ops = [...s.options].map(o => byId('ws', o.value)).filter(Boolean);
    const w = ops.find(x => atual && x.app === atual.app && frChave(x.nome) === k) || ops.find(x => frChave(x.nome) === k);
    if (w && w.id !== s.value) s.value = w.id;
  });
};
// árvore: as frentes padrão novas (Integrações, Infraestrutura...) só aparecem quando têm item ou estão escolhidas.
// Frontend, Backend, Database e as frentes criadas pela pessoa aparecem sempre. Continuam existindo para o envio automático.
function frWsArvore(appId){
  const todas = D.ws.filter(w => w.app === appId);
  if (UI.abertos['vazias:' + appId]) return {vis:todas, ocultas:todas.filter(frEscondivel)};
  const ocultas = todas.filter(frEscondivel);
  return {vis:todas.filter(w => !ocultas.includes(w)), ocultas};
}
function frEscondivel(w){
  const k = frChave(w.nome);
  if (!k || ['frontend', 'backend', 'database'].includes(k) || UI.sel === 'ws:' + w.id) return false;
  return !D.issues.some(i => i.ws === w.id && !i.arquivado);
}
// aplicações que já existiam ganham as frentes padrão que faltam (uma vez por sessão, sem duplicar)
let frCompletou = false;
function frCompletarApps(){
  if (frCompletou || typeof podeEditar !== 'function' || !podeEditar() || !D.apps.length) return;
  if (typeof BANCO === 'undefined' || !BANCO || !BANCO.carregado) return;   // só depois de o banco carregar (senão criaria de novo o que já existe lá)
  frCompletou = true;
  const antes = D.ws.length;
  D.apps.filter(a => a.status !== 'archived').forEach(a => criarFrentesPadrao(a.id));
  if (D.ws.length !== antes) salvar();
}
const _rOperacoesFr = rOperacoes;
rOperacoes = function(){ frCompletarApps(); return _rOperacoesFr.apply(this, arguments); };
// ficha técnica: cada seção mostra a frente de trabalho do mesmo assunto (o que está sendo feito ali)
const FR_FICHA = {'Database':'database', 'APIs':'backend', 'Integrations':'integracoes', 'Environments':'infraestrutura', 'Secrets catalog':'seguranca', 'Visual identity':'design', 'Repositories':'documentacao'};
function frFichaLigacao(sec, chave){
  const k = FR_FICHA[sec]; if (!k) return '';
  const [tipo, id] = String(chave).split(':');
  const apps = D.apps.filter(a => (tipo === 'app' && a.id === id) || (tipo === 'product' && a.product === id) || (tipo === 'project' && a.project === id));
  const ws = D.ws.filter(w => w.status !== 'archived' && apps.some(a => a.id === w.app) && frChave(w.nome) === k);
  if (!ws.length) return '';
  const itens = D.issues.filter(i => !i.arquivado && i.tipo !== 'epic' && ws.some(w => w.id === i.ws)), feitos = itens.filter(i => i.status === 'done').length;
  const nome = FRENTES_PADRAO.find(x => x.chave === k).nome;
  return '<p class="ficha-fr">Frente <b>' + esc(nome) + '</b>: ' + (itens.length ? itens.length + (itens.length === 1 ? ' item' : ' itens') + ' (' + feitos + ' concluídos, ' + (itens.length - feitos) + ' em aberto)' : 'nenhum item ainda') +
    ws.map(w => ' <button type="button" class="btn fant peq" data-ir-ops="ws:' + w.id + '">' + esc(apps.length > 1 ? (byId('apps', w.app) || {}).nome + ' › ' + w.nome : 'Abrir a frente') + '</button>').join('') + '</p>';
}
