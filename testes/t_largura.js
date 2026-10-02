// Regra do sistema: texto, telas e cards usam toda a largura da janela. Nenhum CSS novo pode limitar a largura
// (max-width em px, ch, em ou min(...)) de texto, tela ou card. Só ficam liberados os itens desta lista: janelas
// (modal), menus suspensos, avisos flutuantes, balões de conversa, nomes de arquivo cortados com "...",
// barras de gráfico, selects e a página de login. Rodar: node testes/t_largura.js (de dentro de fonte/ ou da raiz).
const fs = require('fs'), path = require('path');
const dir = fs.existsSync('fonte') ? 'fonte' : '.';
const LIBERADOS = [
  /dialog\.modal/, /\.sm-abas-menu/, /\.tf-menu/, /\.tf-aviso/, /^\s*position:fixed/, /\.msg\b/, /\.bolha/, /\.ia-msg/, /\.ia-agente/, /\.ia-botoes/,
  /\.ia-anexo/, /\.ia-pend-nome/, /\.arq\b/, /\.sd-anexo/, /\.colunas/, /\.rosca/, /\.rc-vistas \.sel/, /\.rc-diamante/, /\.dc-linha \.sel/, /\.po-f \.sel/, /\.po-num/,
  /\.entrada-/, /\.ops-titulo > \.acoes/, /\.en2-prog/,
];
let falhas = 0;
for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.css'))){
  const css = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /([^{}]+)\{([^{}]*)\}/g; let m;
  while ((m = re.exec(css))){
    const sel = m[1].replace(/@(media|container)[^{]*$/, '').trim(), corpo = m[2];
    if (!/max-width\s*:\s*(\d+(\.\d+)?(px|ch|em|rem)|min\()/.test(corpo)) continue;
    if (/^@/.test(sel) || LIBERADOS.some(r => r.test(sel) || r.test(corpo))) continue;
    falhas++; console.log('FALHA ' + f + ': "' + sel.slice(0, 80) + '" limita a largura (' + (corpo.match(/max-width\s*:[^;]+/) || [''])[0] + ')');
  }
}
console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
