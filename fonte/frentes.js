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
