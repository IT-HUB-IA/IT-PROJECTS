// Análise de segurança do código e do banco, sem IA. Cada regra nasce de um guia da OWASP da base de conhecimento
// (IT-HUB-IA/agent-s-conhecimento, categoria Segurança) e diz em português simples o que achou, por que importa e como corrigir.
// O código chega pelo mesmo pacote dos desenhos (lerTarGz); o banco, pela mesma leitura só de estrutura (CONSULTA_BANCO).
// Nada aqui grava nem executa nada no sistema do usuário: só lê texto e o catálogo do banco.
import type { Arquivos, Estrutura, Tabela } from './gerar.ts';

export type Gravidade = 'critica' | 'alta' | 'media' | 'baixa';
export type Achado = {
  regra: string; gravidade: Gravidade; titulo: string;
  onde: string;              // arquivo:linha, ou esquema.tabela
  trecho: string;            // o pedaço que motivou (segredos sempre mascarados)
  impressao: string;         // identidade estável do achado (a próxima análise reconhece o mesmo)
};
export type Regra = { id: string; area: 'codigo' | 'banco' | 'dependencias' | 'qualidade' | 'arquitetura'; gravidade: Gravidade; titulo: string; porque: string; correcao: string; fonte: string };

const OWASP = (n: string) => 'OWASP ' + n.replace(/_/g, ' ');
// o catálogo: o que a tela mostra para cada regra (o texto não vai em cada achado, só o código da regra)
export const REGRAS: Regra[] = [
  // ---------- segredos ----------
  { id: 'SEG-01', area: 'codigo', gravidade: 'critica', titulo: 'Chave secreta escrita no código', fonte: OWASP('Secrets_Management_Cheat_Sheet'),
    porque: 'Quem tem acesso ao repositório (ou a uma cópia antiga dele) consegue usar a chave. Ela continua no histórico do Git mesmo depois de apagada.',
    correcao: 'Troque a chave agora no serviço que a emitiu (a antiga deve ser considerada vazada). Guarde a nova numa variável de ambiente ou num cofre de segredos e leia pelo nome.' },
  { id: 'SEG-02', area: 'codigo', gravidade: 'critica', titulo: 'Chave de administrador do Supabase (service_role) no código', fonte: OWASP('Secrets_Management_Cheat_Sheet'),
    porque: 'A chave service_role passa por cima de todas as regras de acesso (RLS): com ela, qualquer pessoa lê, muda e apaga tudo no banco.',
    correcao: 'Gere uma chave nova no Supabase (Settings, API, Roll), use a service_role só no servidor, por variável de ambiente, e no navegador use apenas a chave anon (pública).' },
  { id: 'SEG-03', area: 'codigo', gravidade: 'alta', titulo: 'Senha escrita num arquivo de configuração', fonte: OWASP('Secrets_Management_Cheat_Sheet'),
    porque: 'A senha do banco ou do serviço fica visível para quem abre o arquivo e vai junto em toda cópia do projeto.',
    correcao: 'Troque o valor por uma variável de ambiente (ex.: spring.datasource.password=${DB_PASSWORD}) e defina a variável no servidor.' },
  { id: 'SEG-04', area: 'codigo', gravidade: 'alta', titulo: 'Arquivo de segredos (.env ou chave privada) dentro do repositório', fonte: OWASP('Secrets_Management_Cheat_Sheet'),
    porque: 'Arquivos .env e chaves privadas guardam os segredos de verdade do sistema e não deveriam sair da máquina ou do servidor.',
    correcao: 'Tire o arquivo do repositório, ponha o nome dele no .gitignore, troque os segredos que estavam nele e deixe só um .env.example sem valores.' },
  // ---------- injeção ----------
  { id: 'INJ-01', area: 'codigo', gravidade: 'critica', titulo: 'SQL montado juntando texto (risco de SQL Injection)', fonte: OWASP('SQL_Injection_Prevention_Cheat_Sheet'),
    porque: 'Se uma parte do texto vem do usuário, ele pode escrever comandos SQL e ler ou apagar dados de outras pessoas.',
    correcao: 'Use consulta parametrizada: PreparedStatement com ? (Java), $1 (Postgres no Node) ou os parâmetros do seu ORM, nunca + ou ${} dentro do SQL.' },
  { id: 'INJ-02', area: 'codigo', gravidade: 'alta', titulo: 'Código executado a partir de texto (eval)', fonte: OWASP('Injection_Prevention_Cheat_Sheet'),
    porque: 'eval e new Function rodam qualquer texto como programa. Se esse texto vier de fora, quem mandou passa a mandar no sistema.',
    correcao: 'Troque por uma lógica fixa (um mapa de opções, JSON.parse para dados). Se não houver como evitar, nunca passe nada que venha do usuário.' },
  { id: 'INJ-03', area: 'codigo', gravidade: 'alta', titulo: 'Comando do sistema operacional montado com texto', fonte: OWASP('OS_Command_Injection_Defense_Cheat_Sheet'),
    porque: 'Um texto vindo do usuário dentro de um comando permite rodar outros comandos no servidor.',
    correcao: 'Use a função da biblioteca em vez do comando, ou passe os argumentos separados (execFile, ProcessBuilder com lista) e valide contra uma lista do que é permitido.' },
  // ---------- XSS ----------
  { id: 'XSS-01', area: 'codigo', gravidade: 'alta', titulo: 'HTML montado com dado direto na tela (risco de XSS)', fonte: OWASP('Cross_Site_Scripting_Prevention_Cheat_Sheet'),
    porque: 'Colocar texto vindo de fora em innerHTML (ou dangerouslySetInnerHTML) deixa um script malicioso rodar no navegador de quem abre a tela e roubar a sessão.',
    correcao: 'Use textContent (ou a forma normal do framework, que já protege). Se precisar mesmo de HTML, passe o texto por um sanitizador como o DOMPurify antes.' },
  // ---------- transporte e criptografia ----------
  { id: 'TLS-01', area: 'codigo', gravidade: 'alta', titulo: 'Verificação de certificado HTTPS desligada', fonte: OWASP('Transport_Layer_Security_Cheat_Sheet'),
    porque: 'Sem conferir o certificado, qualquer um no meio do caminho pode se passar pelo servidor e ler ou trocar os dados.',
    correcao: 'Tire o rejectUnauthorized: false / verify=False / TrustManager que aceita tudo. Se o servidor usa certificado próprio, configure esse certificado como confiável.' },
  { id: 'TLS-02', area: 'codigo', gravidade: 'media', titulo: 'Chamada para endereço sem HTTPS', fonte: OWASP('Transport_Layer_Protection_Cheat_Sheet'),
    porque: 'Pelo http:// os dados viajam abertos: senhas, tokens e dados pessoais podem ser lidos na rede.',
    correcao: 'Use https:// no endereço. Se o serviço não tem HTTPS, peça para ativarem antes de mandar dados por ele.' },
  { id: 'CRI-01', area: 'codigo', gravidade: 'alta', titulo: 'Algoritmo fraco (MD5 ou SHA-1) para senha ou segurança', fonte: OWASP('Password_Storage_Cheat_Sheet'),
    porque: 'MD5 e SHA-1 são quebrados em segundos hoje. Senhas guardadas assim podem ser descobertas se o banco vazar.',
    correcao: 'Para senha, use bcrypt, scrypt ou Argon2 (com a biblioteca pronta). Para outros usos, use SHA-256 ou maior.' },
  { id: 'CRI-02', area: 'codigo', gravidade: 'media', titulo: 'Número aleatório previsível usado em token ou senha', fonte: OWASP('Cryptographic_Storage_Cheat_Sheet'),
    porque: 'Math.random e java.util.Random são previsíveis: quem vê alguns valores consegue adivinhar os próximos tokens.',
    correcao: 'Use crypto.randomUUID / crypto.getRandomValues (JavaScript), SecureRandom (Java) ou secrets (Python).' },
  { id: 'JWT-01', area: 'codigo', gravidade: 'alta', titulo: 'Token JWT lido sem conferir a assinatura', fonte: OWASP('JSON_Web_Token_Cheat_Sheet'),
    porque: 'Ler o token sem verificar (jwt.decode, algoritmo none) aceita um token inventado por qualquer pessoa, que passa a entrar como outro usuário.',
    correcao: 'Use a verificação da biblioteca (jwt.verify com a chave e o algoritmo fixos) em todo lugar que decide quem é o usuário.' },
  // ---------- configuração ----------
  { id: 'CFG-01', area: 'codigo', gravidade: 'media', titulo: 'CORS aberto para qualquer site', fonte: OWASP('HTTP_Headers_Cheat_Sheet'),
    porque: 'Com Access-Control-Allow-Origin: *, qualquer site consegue chamar a sua API pelo navegador de quem está logado.',
    correcao: 'Liste só os endereços do seu sistema na configuração de CORS (ex.: origin: ["https://app.seudominio.com"]).' },
  { id: 'CFG-02', area: 'codigo', gravidade: 'media', titulo: 'Modo de depuração ligado na configuração', fonte: OWASP('Error_Handling_Cheat_Sheet'),
    porque: 'O modo de depuração mostra detalhes internos (caminhos, consultas, variáveis) para quem provocar um erro.',
    correcao: 'Desligue em produção (DEBUG=False, spring.devtools fora do pacote final) e mostre ao usuário só uma mensagem genérica de erro.' },
  { id: 'LOG-01', area: 'codigo', gravidade: 'media', titulo: 'Senha ou token escrito no log', fonte: OWASP('Logging_Cheat_Sheet'),
    porque: 'O log é lido por muita gente e guardado por muito tempo: um segredo escrito nele vaza sem ninguém perceber.',
    correcao: 'Tire o dado sensível da linha de log ou registre só uma parte mascarada (ex.: os 4 últimos caracteres).' },
  // ---------- dependências ----------
  { id: 'DEP-01', area: 'dependencias', gravidade: 'alta', titulo: 'Biblioteca com falha de segurança conhecida', fonte: OWASP('Vulnerable_Dependency_Management_Cheat_Sheet'),
    porque: 'A falha já é pública (tem código CVE ou GHSA): atacantes procuram justamente sistemas que ainda usam essa versão.',
    correcao: 'Atualize a biblioteca para a versão corrigida indicada no aviso e rode os testes. Se não houver correção, avalie trocar de biblioteca.' },
  // ---------- banco ----------
  { id: 'BD-01', area: 'banco', gravidade: 'critica', titulo: 'Tabela aberta para visitantes sem RLS', fonte: OWASP('Database_Security_Cheat_Sheet'),
    porque: 'O papel anon (quem não fez login) tem permissão nesta tabela e ela não tem RLS: qualquer pessoa na internet lê ou muda as linhas pela API.',
    correcao: 'Ligue a RLS (alter table ... enable row level security) e crie as políticas de quem pode ver e mudar. Se o visitante não precisa, tire a permissão (revoke ... from anon).' },
  { id: 'BD-02', area: 'banco', gravidade: 'alta', titulo: 'Tabela aberta para qualquer usuário logado sem RLS', fonte: OWASP('Authorization_Cheat_Sheet'),
    porque: 'Sem RLS, todo usuário logado vê e muda as linhas de todos os outros, não só as dele.',
    correcao: 'Ligue a RLS e crie políticas que limitem cada pessoa às linhas dela (ex.: using (dono_id = auth.uid())).' },
  { id: 'BD-03', area: 'banco', gravidade: 'critica', titulo: 'Regra de acesso que libera escrita para todos', fonte: OWASP('Authorization_Cheat_Sheet'),
    porque: 'A política de criar, mudar ou apagar usa "true" (vale para qualquer linha) para visitantes ou para todos: a RLS existe, mas não protege nada.',
    correcao: 'Troque o "true" por uma condição de verdade (ex.: dono_id = auth.uid()) e limite a política ao papel que precisa.' },
  { id: 'BD-04', area: 'banco', gravidade: 'alta', titulo: 'Dado pessoal ou sensível visível para visitantes', fonte: OWASP('Database_Security_Cheat_Sheet'),
    porque: 'A tabela tem coluna de dado sensível (CPF, senha, token, cartão...) e os visitantes podem ler.',
    correcao: 'Tire a leitura do anon, ou crie uma visão só com as colunas públicas e libere a visão no lugar da tabela.' },
  { id: 'BD-06', area: 'banco', gravidade: 'alta', titulo: 'Permissão dada a PUBLIC (todo mundo)', fonte: OWASP('Database_Security_Cheat_Sheet'),
    porque: 'PUBLIC inclui todos os papéis do banco, inclusive os que você não criou para isso.',
    correcao: 'Tire de PUBLIC (revoke ... from public) e dê só aos papéis que precisam.' },
  { id: 'BD-07', area: 'banco', gravidade: 'media', titulo: 'Senha guardada numa coluna de texto', fonte: OWASP('Password_Storage_Cheat_Sheet'),
    porque: 'Coluna com nome de senha e tipo texto costuma guardar a senha aberta ou com hash fraco.',
    correcao: 'Guarde só o hash da senha com bcrypt ou Argon2 (ou use o Auth do Supabase, que já faz isso) e nunca a senha em si.' },
  { id: 'BD-08', area: 'banco', gravidade: 'baixa', titulo: 'Tabela sem chave primária', fonte: OWASP('Database_Security_Cheat_Sheet'),
    porque: 'Sem chave primária fica difícil escrever regras de acesso por linha, auditar e corrigir dados com segurança.',
    correcao: 'Acrescente uma coluna id (uuid default gen_random_uuid() primary key) ou declare a chave que já existe.' },
  { id: 'BD-09', area: 'banco', gravidade: 'baixa', titulo: 'RLS ligada sem nenhuma regra', fonte: OWASP('Authorization_Cheat_Sheet'),
    porque: 'Ninguém além do dono consegue ler a tabela. Se ela é usada pela API, alguma tela não funciona; se não é, está tudo certo.',
    correcao: 'Se a tabela é usada pela API, crie as políticas de quem pode ver e mudar. Se não é, nada a fazer.' },
  // ---------- qualidade do código (base de conhecimento: Código Limpo) ----------
  { id: 'QUA-01', area: 'qualidade', gravidade: 'baixa', titulo: 'Arquivo grande demais', fonte: 'Código Limpo (base de conhecimento): funções e classes pequenas',
    porque: 'Um arquivo com centenas de linhas costuma juntar várias responsabilidades: fica difícil de entender, de testar e qualquer mudança mexe em muita coisa.',
    correcao: 'Separe por assunto: cada parte com uma responsabilidade num arquivo próprio (ex.: tela, regras e acesso ao banco separados).' },
  { id: 'QUA-02', area: 'qualidade', gravidade: 'baixa', titulo: 'Função longa demais', fonte: 'Código Limpo (base de conhecimento): funções pequenas que fazem uma coisa',
    porque: 'Função muito longa faz várias coisas ao mesmo tempo: é onde os bugs se escondem e ninguém quer mexer.',
    correcao: 'Quebre em funções menores com nomes que dizem o que cada uma faz. Uma boa medida é caber na tela sem rolar.' },
  { id: 'QUA-03', area: 'qualidade', gravidade: 'baixa', titulo: 'Código repetido em dois lugares', fonte: 'Código Limpo (base de conhecimento): não se repita (DRY)',
    porque: 'O mesmo bloco copiado em vários lugares obriga a corrigir cada cópia; quando uma é esquecida, o sistema passa a se comportar diferente em cada tela.',
    correcao: 'Junte o bloco numa função só e chame dos dois lugares.' },
  { id: 'QUA-04', area: 'qualidade', gravidade: 'baixa', titulo: 'Erro engolido (catch vazio)', fonte: OWASP('Error_Handling_Cheat_Sheet'),
    porque: 'O erro acontece e ninguém fica sabendo: o usuário vê algo errado sem aviso e não há registro para investigar.',
    correcao: 'Registre o erro (log) e trate: avise o usuário, tente de novo ou deixe o erro subir. Nunca deixe o catch vazio.' },
  { id: 'QUA-05', area: 'qualidade', gravidade: 'baixa', titulo: 'Trabalho marcado como não terminado (TODO, FIXME)', fonte: 'Código Limpo (base de conhecimento): comentários',
    porque: 'Quem escreveu deixou avisado que falta algo ou que há um problema conhecido neste ponto. É um sinal de que a funcionalidade pode não estar pronta.',
    correcao: 'Termine o que falta ou crie um item para isso e tire a marca do código.' },
  { id: 'QUA-06', area: 'qualidade', gravidade: 'baixa', titulo: 'Mensagens de depuração esquecidas no código', fonte: OWASP('Logging_Cheat_Sheet'),
    porque: 'console.log e System.out.println soltos poluem o log de produção e às vezes mostram dados que não deveriam aparecer.',
    correcao: 'Tire as mensagens de teste ou troque por um log de verdade, com nível (info, erro) e sem dados sensíveis.' },
  { id: 'QUA-07', area: 'qualidade', gravidade: 'media', titulo: 'Repositório sem nenhum teste automático', fonte: 'Desenvolvimento ágil (base de conhecimento): Definição de Pronto com testes',
    porque: 'Sem teste, cada mudança pode quebrar algo que funcionava e só o usuário descobre.',
    correcao: 'Comece pelos fluxos mais importantes (login, cadastro, pagamento): um teste para cada um, rodando a cada publicação.' },
  // ---------- arquitetura do banco ----------
  { id: 'ARQ-01', area: 'arquitetura', gravidade: 'media', titulo: 'Chave estrangeira sem índice', fonte: 'Bancos de dados (base de conhecimento): índices e chaves estrangeiras',
    porque: 'Sem índice na coluna da chave estrangeira, as buscas por ela e as exclusões na tabela pai ficam lentas e travam a tabela quando o volume cresce.',
    correcao: 'Crie o índice: create index on tabela (coluna_id);' },
  { id: 'ARQ-02', area: 'arquitetura', gravidade: 'baixa', titulo: 'Coluna que aponta para outra tabela sem chave estrangeira', fonte: 'Bancos de dados (base de conhecimento): integridade referencial',
    porque: 'A coluna termina em _id mas o banco não confere se o registro apontado existe: sobram referências para coisas apagadas.',
    correcao: 'Declare a chave estrangeira (alter table ... add foreign key (coluna_id) references outra_tabela(id)) depois de limpar os valores órfãos.' },
];
export const REGRA = (id: string) => REGRAS.find(r => r.id === id)!;

// ---------- utilidades ----------
const mascarar = (s: string) => s.length <= 8 ? '****' : s.slice(0, 4) + '…' + '*'.repeat(6) + s.slice(-2);
function hash(s: string): string { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); }
const linhaDe = (txt: string, pos: number) => txt.slice(0, pos).split('\n').length;
const trechoDe = (txt: string, pos: number) => { const i = txt.lastIndexOf('\n', pos) + 1, f = txt.indexOf('\n', pos); return txt.slice(i, f < 0 ? undefined : f).trim().slice(0, 200); };
const CODIGO_FONTE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|vue|svelte|py|go|java|kt|kts|cs|php|rb)$/i;
const TESTE = /(^|\/)(test|tests|testes?|__tests__|spec|e2e|cypress|fixtures?|mocks?|exemplos?|examples?|docs?)\/|\.(test|spec)\.[a-z]+$|Test\.java$/i;
const COMENTARIO = /^\s*(\/\/|#|\*|\/\*|<!--)/;
// o mesmo achado na próxima análise: regra + arquivo + o texto da linha (sem espaços), e não o número da linha (que muda)
const impressao = (regra: string, arquivo: string, linha: string) => hash(regra + '|' + arquivo + '|' + linha.replace(/\s+/g, ''));

type Padrao = { regra: string; re: RegExp; so?: RegExp; segredo?: boolean; fraco?: boolean; teste?: boolean; e?: (linha: string, m: RegExpExecArray) => boolean };
// os padrões de código (as mesmas ideias do Gitleaks e das regras OWASP do Semgrep, escritas aqui para rodar sem nada instalado)
const PADROES: Padrao[] = [
  { regra: 'SEG-01', segredo: true, re: /\b(AKIA[0-9A-Z]{16})\b/g },                                                     // AWS
  { regra: 'SEG-01', segredo: true, re: /\b(gh[pousr]_[A-Za-z0-9]{36,})\b/g },                                           // GitHub
  { regra: 'SEG-01', segredo: true, re: /\b(sk_live_[A-Za-z0-9]{20,})\b/g },                                             // Stripe
  { regra: 'SEG-01', segredo: true, re: /\b(xox[baprs]-[A-Za-z0-9-]{20,})\b/g },                                         // Slack
  { regra: 'SEG-01', segredo: true, re: /\b(AIza[0-9A-Za-z_-]{35})\b/g },                                                // Google
  { regra: 'SEG-01', segredo: true, re: /\b(sk-(?:proj-|ant-)?[A-Za-z0-9_-]{32,})\b/g },                                 // OpenAI / Anthropic
  { regra: 'SEG-01', segredo: true, re: /(-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----)/g },
  { regra: 'SEG-01', segredo: true, re: /\b((?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^:\s'"@/]+:[^@\s'"$<{]{4,}@[^\s'"]+)/g,   // endereço de banco com senha
    fraco: true, e: (_l, m) => { const u = m[1].match(/:\/\/([^:]+):([^@]+)@/); return !!u && !/^(senha|password|pass|minhasenha|suasenha|secret|\[?your-password\]?|x+|\*+|usuario|user)$/i.test(u[2]) && !/^(usuario|user|xxxx)$/i.test(u[1]) && !/xxxx|exemplo|example|seu-/i.test(m[1]); } },
  { regra: 'SEG-02', segredo: true, re: /\b(eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})\b/g, e: (_l, m) => papelJwt(m[1]) === 'service_role' },
  { regra: 'SEG-03', segredo: true, re: /^\s*[\w.-]*(?:password|passwd|senha|secret|api[_-]?key|token)\s*[=:]\s*["']?([^\s"'#${}<>][^\s"'#]{5,})["']?\s*$/gim,
    so: /\.(properties|ya?ml|toml|ini|conf|cfg|env[\w.-]*|json)$|(^|\/)\.env/i, e: (l) => !/\$\{|\{\{|<|%\(|example|exemplo|changeme|change[_-]?me|troque|coloque|preencha|informe|digite|insira|substitua|aqui|here|sua[_-]?senha|minha[_-]?senha|senha[_-]?aqui|your[_-]|my[_-]?password|xxx|\*\*\*|placeholder|dummy|fake|sample|todo/i.test(l) },
  { regra: 'INJ-01', re: /(?:executeQuery|executeUpdate|execute|createQuery|createNativeQuery|prepareStatement|query|raw|\$queryRawUnsafe|\$executeRawUnsafe)\s*\(\s*["'`][^"'`]*\b(?:select|insert|update|delete|where)\b[^"'`]*["'`]\s*\+/gi },
  { regra: 'INJ-01', re: /(?:query|execute|raw|createQuery|sql)\s*\(\s*`[^`]*\b(?:select|insert|update|delete|where)\b[^`]*\$\{/gi },
  { regra: 'INJ-01', re: /["`]\s*(?:select|update|delete from|insert into)\b[^"`;]*\bwhere\b[^"`;]*["`]\s*\+\s*[A-Za-z_]/gi },
  { regra: 'INJ-01', re: /(?:cursor\.)?execute\(\s*f["'][^"']*\b(?:select|insert|update|delete)\b[^"']*\{/gi },
  { regra: 'INJ-02', re: /(?<![\w.])(?:eval|new\s+Function)\s*\(\s*(?!['"`][^'"`]*['"`]\s*\))/g, so: /\.(m?[jt]sx?|cjs|vue|svelte|py)$/i },
  { regra: 'INJ-03', re: /(?:child_process\.)?\bexec(?:Sync)?\s*\(\s*(?:`[^`]*\$\{|["'][^"']*["']\s*\+)/g },
  { regra: 'INJ-03', re: /Runtime\.getRuntime\(\)\.exec\(\s*[^)]*\+/g },
  { regra: 'INJ-03', re: /os\.system\(\s*(?:f["']|[^)]*\+)|subprocess\.\w+\([^)]*shell\s*=\s*True/g },
  { regra: 'XSS-01', re: /\.(?:innerHTML|outerHTML)\s*\+?=\s*(?!\s*['"`][^'"`$]*['"`]\s*;?\s*$)[^;\n]*[A-Za-z_$]/g, e: (l) => /\+\s*[A-Za-z_$][\w$.]*\s*(?:\+|;|$)|\$\{\s*[A-Za-z_$][\w$.]*\s*\}/.test(l.replace(/(?:esc|escape|escapar|sanitiz\w*|DOMPurify\.sanitize|encodeURIComponent)\s*\([^()]*(?:\([^()]*\)[^()]*)*\)/gi, '""')) && !/^\s*[\w$.]+\.(?:inner|outer)HTML\s*=\s*[\w$.]+\([^)]*\)\s*;?\s*$/.test(l) },
  { regra: 'XSS-01', re: /dangerouslySetInnerHTML\s*=\s*\{\{\s*__html\s*:\s*(?!['"`])/g },
  { regra: 'XSS-01', re: /document\.write(?:ln)?\s*\(/g },
  { regra: 'XSS-01', re: /\bv-html\s*=/g },
  { regra: 'TLS-01', re: /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*[=:]\s*['"]?0|verify\s*=\s*False|InsecureSkipVerify\s*:\s*true|ALLOW_ALL_HOSTNAME_VERIFIER|NoopHostnameVerifier|TrustAllStrategy|checkServerTrusted\s*\([^)]*\)\s*\{\s*\}/g },
  { regra: 'TLS-02', re: /["'`]http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|[\w-]+:\d|www\.w3\.org|schemas\.|xmlns|example\.|host\.docker)[\w.-]+/g },
  { regra: 'CRI-01', re: /MessageDigest\.getInstance\(\s*["'](?:MD5|SHA-?1)["']|createHash\(\s*["'](?:md5|sha1)["']|hashlib\.(?:md5|sha1)\(|DigestUtils\.(?:md5|sha1)(?:Hex)?\(|\bmd5\s*\(/gi },
  { regra: 'CRI-02', re: /Math\.random\(\)|new\s+(?:java\.util\.)?Random\(\)|\brandom\.(?:random|randint|choice)\(/g, e: (l) => /token|senha|password|secret|codigo|code|otp|pin|salt|nonce|chave|key/i.test(l) },
  { regra: 'JWT-01', re: /jwt\.decode\(|algorithms?\s*[:=]\s*\[?\s*["']none["']|\.parseUnsecuredClaims\(|verify\s*[:=]\s*False|options\s*=\s*\{\s*["']verify_signature["']\s*:\s*False/gi },
  { regra: 'CFG-01', re: /Access-Control-Allow-Origin["']?\s*[,:]\s*["']\*["']|cors\(\s*\{\s*origin\s*:\s*(?:["']\*["']|true)|@CrossOrigin\(\s*(?:origins\s*=\s*)?["']\*["']|allowedOrigins\(\s*["']\*["']|CORS_ALLOW_ALL_ORIGINS\s*=\s*True|AllowAnyOrigin\(\)/g },
  { regra: 'CFG-02', re: /^\s*DEBUG\s*=\s*True\b|app\.run\([^)]*debug\s*=\s*True|spring-boot-devtools|server\.error\.include-stacktrace\s*=\s*always/gm },
  { regra: 'LOG-01', re: /(?:console\.(?:log|info|warn|error|debug)|log(?:ger)?\.(?:info|debug|warn|error|trace)|System\.out\.print(?:ln)?|print)\s*\([^)\n]*\b(?:password|senha|passwd|token|secret|apiKey|api_key|authorization|cpf)\b/gi },
];
// o "role" de dentro de um JWT do Supabase (só lê o meio do token; não confere assinatura, nem precisa)
function papelJwt(t: string): string { try { const m = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); return (JSON.parse(atob(m + '='.repeat((4 - m.length % 4) % 4))) || {}).role || ''; } catch { return ''; } }

// arquivo já empacotado ou minificado (gerado por uma ferramenta): linhas enormes. Não é o código que as pessoas escrevem.
export const empacotado = (t: string) => { if (t.length < 20000) return false; const L = t.split('\n'); return L.some(l => l.length > 5000) || t.length / L.length > 250; };
// arquivos que são, eles mesmos, segredo
const ARQ_SEGREDO = /(^|\/)(\.env(?:\.(?!example|sample|template|exemplo)[\w-]+)?|id_rsa|id_ed25519|[^/]+\.pem|[^/]+\.key|[^/]+\.p12|[^/]+\.pfx|credentials\.json|service-account[^/]*\.json)$/i;

export function analisarCodigo(arq: Arquivos, caminhos: string[], limite = 400): Achado[] {
  const out: Achado[] = [], vistos = new Set<string>();
  const add = (a: Achado) => { if (vistos.has(a.impressao) || out.length >= limite) return; vistos.add(a.impressao); out.push(a); };
  for (const c of caminhos) if (ARQ_SEGREDO.test(c) && !/example|sample|exemplo/i.test(c))
    add({ regra: 'SEG-04', gravidade: 'alta', titulo: REGRA('SEG-04').titulo, onde: c, trecho: '(o arquivo inteiro)', impressao: impressao('SEG-04', c, '') });
  for (const [caminho, txt] of arq) {
    if (empacotado(txt)) continue;
    const teste = TESTE.test(caminho);
    for (const p of PADROES) {
      if (p.so ? !p.so.test(caminho) : !(CODIGO_FONTE.test(caminho) || /\.(html?|properties|ya?ml|env|toml|json)$|(^|\/)\.env/i.test(caminho))) continue;
      if (teste && (!p.segredo || p.fraco)) continue;   // em teste, só chave com formato de verdade (AWS, GitHub...) interessa; endereço de banco de exemplo não
      p.re.lastIndex = 0; let m: RegExpExecArray | null, n = 0;
      while ((m = p.re.exec(txt)) && n < 20) {
        if (m[0] === '') { p.re.lastIndex++; continue; }
        const linha = trechoDe(txt, m.index);
        if (COMENTARIO.test(linha) && !p.segredo) continue;
        if (p.e && !p.e(linha, m)) continue;
        n++;
        const r = REGRA(p.regra);
        const t = p.segredo && m[1] ? linha.split(m[1]).join(mascarar(m[1])) : linha;
        add({ regra: r.id, gravidade: teste ? 'media' : r.gravidade, titulo: r.titulo + (teste ? ' (em arquivo de teste)' : ''), onde: caminho + ':' + linhaDe(txt, m.index), trecho: t.slice(0, 200), impressao: impressao(r.id, caminho, p.segredo && m[1] ? hash(m[1]) : linha) });
      }
    }
  }
  const ordem = { critica: 0, alta: 1, media: 2, baixa: 3 };
  return out.sort((a, b) => ordem[a.gravidade] - ordem[b.gravidade] || a.onde.localeCompare(b.onde));
}

// ---------- qualidade do código ----------
const FONTE_QUA = /\.(ts|tsx|mts|js|jsx|mjs|cjs|vue|svelte|py|go|java|kt|cs|php|rb)$/i;
const GERADO = /(^|\/)(generated|gen|migrations?|dist|build|vendor|\.min\.)|\.d\.ts$|-lock\.|\.pb\.|_pb2\.py$/i;
const INICIO_FUNCAO = /^\s*(?:export\s+)?(?:async\s+)?(?:function\s+\w+\s*\(|(?:const|let)\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{|(?:public|private|protected|static|\s)+[\w<>\[\],\s]+\s+\w+\s*\([^;]*\)\s*(?:throws [\w.,\s]+)?\{|def\s+\w+\s*\()/;
export function analisarQualidade(arq: Arquivos, caminhos: string[], limite = 300): Achado[] {
  const out: Achado[] = [];
  const add = (regra: string, onde: string, trecho: string, extra: string) => { if (out.length >= limite) return; const r = REGRA(regra); out.push({ regra, gravidade: r.gravidade, titulo: r.titulo, onde, trecho: trecho.slice(0, 200), impressao: impressao(regra, onde.replace(/:\d+$/, ''), extra) }); };
  const fontes = [...arq.keys()].filter(c => FONTE_QUA.test(c) && !GERADO.test(c));
  const testes = caminhos.filter(c => TESTE.test(c) && FONTE_QUA.test(c));
  if (fontes.length >= 5 && !testes.length) add('QUA-07', '(repositório inteiro)', fontes.length + ' arquivos de código e nenhum arquivo de teste', 'sem-testes');
  const janelas = new Map<string, string>();   // 8 linhas normalizadas -> onde apareceram primeiro
  const dup = new Set<string>();
  for (const c of fontes) {
    const txt = arq.get(c) || '', L = txt.split('\n');
    if (TESTE.test(c) || empacotado(txt)) continue;
    const util = L.filter(l => l.trim() && !COMENTARIO.test(l)).length;
    if (util > 800) add('QUA-01', c, util + ' linhas de código', 'grande');
    // funções longas: do início até a chave que fecha (ou, no Python, até voltar o recuo)
    let longas = 0;
    for (let i = 0; i < L.length && longas < 5; i++) {
      if (!INICIO_FUNCAO.test(L[i]) || /^\s*(if|for|while|switch|catch|else|return)\b/.test(L[i])) continue;
      let fim = i;
      if (/^\s*def\s/.test(L[i])) { const rec = L[i].match(/^\s*/)![0].length; for (fim = i + 1; fim < L.length && (!L[fim].trim() || L[fim].match(/^\s*/)![0].length > rec); fim++); fim--; }
      else { let n = 0, achou = false; for (let j = i; j < L.length; j++) { for (const ch of L[j].replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '')) { if (ch === '{') { n++; achou = true; } else if (ch === '}') n--; } if (achou && n <= 0) { fim = j; break; } if (j - i > 2000) break; } }
      const tam = fim - i + 1;
      if (tam > 80) { longas++; const nome = (L[i].match(/(?:function\s+|def\s+|(?:const|let)\s+|\s)(\w+)\s*(?:=|\()/) || [])[1] || 'função'; add('QUA-02', c + ':' + (i + 1), nome + ': ' + tam + ' linhas', nome); i = fim; }
    }
    // catch vazio e except: pass
    for (const m of txt.matchAll(/catch\s*(?:\([^)]*\))?\s*\{\s*\}|except[^:\n]*:\s*\n\s*pass\b/g)) add('QUA-04', c + ':' + linhaDe(txt, m.index!), trechoDe(txt, m.index!), trechoDe(txt, m.index!));
    const todos = [...txt.matchAll(/(?:\/\/|#|\/\*|\*)\s*(TODO|FIXME|HACK|XXX)\b[:\s]*(.*)/g)];
    if (todos.length) add('QUA-05', c + ':' + linhaDe(txt, todos[0].index!), todos.length + (todos.length === 1 ? ' marca: ' : ' marcas, a primeira: ') + (todos[0][1] + ' ' + todos[0][2]).trim().slice(0, 140), 'todo');
    const dbg = [...txt.matchAll(/^\s*(?:console\.(?:log|debug)|System\.out\.println|e\.printStackTrace)\(/gm)];
    if (dbg.length >= 3) add('QUA-06', c + ':' + linhaDe(txt, dbg[0].index!), dbg.length + ' mensagens de depuração no arquivo', 'debug');
    // repetição: janelas de 8 linhas com conteúdo (sem linhas curtas como "}" ou imports)
    const norm = L.map(l => l.trim().replace(/\s+/g, ' ')).map(l => (l.length < 12 || /^(import|from|package|using|#include|\}|\{|\)|\]|<\/)/.test(l)) ? '' : l);
    for (let i = 0; i + 8 <= norm.length; i++) {
      if (norm.slice(i, i + 8).some(l => !l)) continue;
      const k = norm.slice(i, i + 8).join('\n'), onde = c + ':' + (i + 1), ja = janelas.get(k);
      if (!ja) janelas.set(k, onde);
      else if (!ja.startsWith(c + ':') && !dup.has(ja.replace(/:\d+$/, '') + '|' + c)) { dup.add(ja.replace(/:\d+$/, '') + '|' + c); add('QUA-03', onde, 'igual a ' + ja + ': ' + norm[i].slice(0, 100), ja.replace(/:\d+$/, '')); i += 7; }
    }
  }
  return out;
}

// ---------- dependências (base pública OSV.dev, a mesma do GitHub e do Google) ----------
export type Dependencia = { ecossistema: 'npm' | 'Maven' | 'PyPI' | 'Go'; nome: string; versao: string; arquivo: string };
const versaoLimpa = (v: string) => (String(v || '').match(/\d+(?:\.\d+){0,3}(?:[-.][0-9A-Za-z.]+)?/) || [''])[0];
export function dependenciasDe(arq: Arquivos): Dependencia[] {
  const out: Dependencia[] = [], ja = new Set<string>();
  const add = (d: Dependencia) => { const k = d.ecossistema + d.nome + d.versao; if (d.versao && !ja.has(k)) { ja.add(k); out.push(d); } };
  for (const [c, t] of arq) {
    if (/(^|\/)package\.json$/.test(c)) { try { const j = JSON.parse(t); for (const s of ['dependencies', 'devDependencies']) for (const [n, v] of Object.entries(j[s] || {})) if (typeof v === 'string' && !/^(file:|link:|workspace:|git|http|npm:)/.test(v)) add({ ecossistema: 'npm', nome: n, versao: versaoLimpa(v), arquivo: c }); } catch { /* json inválido: segue */ } }
    else if (/(^|\/)pom\.xml$/.test(c)) {
      const props: Record<string, string> = {}; for (const m of t.matchAll(/<([\w.-]+)>([^<${}]+)<\/\1>/g)) props[m[1]] = m[2].trim();
      for (const m of t.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
        const g = (m[1].match(/<groupId>([^<]+)</) || [])[1], a = (m[1].match(/<artifactId>([^<]+)</) || [])[1]; let v = (m[1].match(/<version>([^<]+)</) || [])[1] || '';
        const pv = v.match(/^\$\{([^}]+)\}$/); if (pv) v = props[pv[1]] || '';
        if (g && a && /^\d/.test(v)) add({ ecossistema: 'Maven', nome: g.trim() + ':' + a.trim(), versao: v.trim(), arquivo: c });
      }
    }
    else if (/(^|\/)requirements[^/]*\.txt$/.test(c)) for (const m of t.matchAll(/^\s*([A-Za-z0-9_.-]+)\s*==\s*([\w.]+)/gm)) add({ ecossistema: 'PyPI', nome: m[1], versao: m[2], arquivo: c });
    else if (/(^|\/)go\.mod$/.test(c)) for (const m of t.matchAll(/^\s*(?:require\s+)?([\w.-]+\.[\w.-]+\/[\w./-]+)\s+v([\w.-]+)/gm)) add({ ecossistema: 'Go', nome: m[1], versao: m[2], arquivo: c });
  }
  return out.slice(0, 900);
}
export async function analisarDependencias(deps: Dependencia[], buscar: typeof fetch): Promise<{ achados: Achado[]; erro?: string }> {
  if (!deps.length) return { achados: [] };
  try {
    const r = await buscar('https://api.osv.dev/v1/querybatch', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queries: deps.map(d => ({ package: { ecosystem: d.ecossistema, name: d.nome }, version: d.versao })) }), signal: AbortSignal.timeout(20000) });
    if (!r.ok) return { achados: [], erro: 'a base de falhas conhecidas (OSV) respondeu ' + r.status };
    const j = await r.json(); const out: Achado[] = [];
    (j.results || []).forEach((res: any, k: number) => {
      const vs = (res && res.vulns) || []; if (!vs.length) return; const d = deps[k];
      const ids = vs.map((v: any) => v.id).slice(0, 6).join(', ');
      out.push({ regra: 'DEP-01', gravidade: vs.length >= 3 ? 'critica' : 'alta', titulo: d.nome + ' ' + d.versao + ': ' + vs.length + (vs.length === 1 ? ' falha conhecida' : ' falhas conhecidas'),
        onde: d.arquivo, trecho: ids + (vs.length > 6 ? ' e mais ' + (vs.length - 6) : '') + ' · veja em osv.dev', impressao: impressao('DEP-01', d.arquivo, d.ecossistema + d.nome + d.versao) });
    });
    return { achados: out };
  } catch (e) { return { achados: [], erro: 'não deu para consultar a base de falhas conhecidas: ' + String((e as Error)?.message || e).slice(0, 120) }; }
}

// ---------- banco ----------
const SENSIVEL = /(^|_)(cpf|cnpj|rg|senha|password|passwd|pass_hash|token|secret|segredo|cartao|card_number|cvv|iban|pis|nis|ssn|telefone|celular|phone|email|e_mail|nascimento|birth|salario|salary)(_|$)/i;
const ESCRITA = ['INSERT', 'UPDATE', 'DELETE'];
const comandos = (c: string) => ({ r: ['SELECT'], a: ['INSERT'], w: ['UPDATE'], d: ['DELETE'], '*': ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] } as Record<string, string[]>)[c] || [];
const aberta = (x?: string | null) => !x || /^\(?\s*true\s*\)?$/i.test(x.trim());
export function analisarBanco(e: Estrutura, opc: { mysql?: boolean } = {}): Achado[] {
  const out: Achado[] = [];
  const add = (regra: string, t: Tabela, trecho: string, extra = '', titulo?: string) => { const r = REGRA(regra); const onde = t.esquema + '.' + t.nome;
    out.push({ regra, gravidade: r.gravidade, titulo: titulo || r.titulo, onde, trecho: trecho.slice(0, 200), impressao: impressao(regra, onde, extra) }); };
  for (const t of e.tabelas) {
    if (!['r', 'p'].includes(t.tipo)) continue;
    const priv = (papel: string) => (t.permissoes.find(p => p.papel === papel) || { privs: [] }).privs;
    const anon = priv('anon'), aut = priv('authenticated'), pub = priv('PUBLIC');
    const sens = t.colunas.filter(c => SENSIVEL.test(c.nome)).map(c => c.nome);
    if (opc.mysql) { /* MySQL não tem RLS nem os papéis anon/authenticated: só as regras que valem para qualquer banco */ }
    else if (!t.rls) {
      if (anon.length || pub.length) add('BD-01', t, 'anon pode: ' + (anon.length ? anon : pub).join(', ').toLowerCase() + ' · RLS desligada');
      else if (aut.length) add('BD-02', t, 'authenticated pode: ' + aut.join(', ').toLowerCase() + ' · RLS desligada');
    } else if (!t.regras.length && (anon.length || aut.length)) add('BD-09', t, 'RLS ligada, 0 regras');
    for (const po of (opc.mysql ? [] : t.regras)) {
      const cmds = comandos(po.comando), papeis = po.papeis.length ? po.papeis : ['PUBLIC'];
      const paraTodos = papeis.some(p => p === 'anon' || p === 'PUBLIC');
      const expr = cmds.includes('SELECT') || cmds.includes('DELETE') || cmds.includes('UPDATE') ? po.usando : po.checa;
      if (po.permissiva && paraTodos && cmds.some(c => ESCRITA.includes(c)) && aberta(cmds.includes('INSERT') && !cmds.includes('UPDATE') ? po.checa : expr))
        add('BD-03', t, 'política "' + po.nome + '" (' + cmds.join(', ').toLowerCase() + ') para ' + papeis.join(', ') + ' com true', po.nome);
    }
    // visitantes leem dado sensível: sem RLS com SELECT, ou com uma regra de leitura aberta para anon
    const leAnon = (anon.includes('SELECT') || pub.includes('SELECT')) && (!t.rls || t.regras.some(po => (po.comando === 'r' || po.comando === '*') && po.permissiva && (po.papeis.length ? po.papeis : ['PUBLIC']).some(p => p === 'anon' || p === 'PUBLIC') && aberta(po.usando)));
    if (!opc.mysql && leAnon && sens.length) add('BD-04', t, 'colunas: ' + sens.slice(0, 8).join(', '), sens.join(','));
    if (!opc.mysql && pub.length) add('BD-06', t, 'PUBLIC pode: ' + pub.join(', ').toLowerCase());
    for (const c of t.colunas) if (/^(senha|password|passwd|pass)$/i.test(c.nome) && /text|char/i.test(c.tipo)) add('BD-07', t, 'coluna ' + c.nome + ' (' + c.tipo + ')', c.nome);
    if (!t.restricoes.some(r => r.tipo === 'p')) add('BD-08', t, 'sem primary key');
    // arquitetura: chave estrangeira sem índice (no MySQL o banco já cria o índice sozinho) e coluna _id sem chave estrangeira
    const fks = t.restricoes.filter(r => r.tipo === 'f');
    if (!opc.mysql && Array.isArray(t.indices)) {
      const cobre = (cols: string[]) => (t.indices || []).some(ix => cols.every((c, k) => ix[k] === c)) || t.restricoes.some(r => (r.tipo === 'p' || r.tipo === 'u') && cols.every((c, k) => r.cols[k] === c));
      for (const fk of fks) if (!cobre(fk.cols)) add('ARQ-01', t, 'coluna ' + fk.cols.join(', ') + ' → ' + (fk.ref_tabela || '?'), fk.cols.join(','));
    }
    const comFk = new Set(fks.flatMap(f => f.cols));
    for (const c of t.colunas) if (/^[a-z0-9_]+_id$/i.test(c.nome) && !comFk.has(c.nome) && /uuid|int|bigint|serial/i.test(c.tipo) && !t.restricoes.some(r => r.tipo === 'p' && r.cols.includes(c.nome)) && !/^(external|externo|stripe|google|github|gitlab|conexa|asaas|cliente_externo|session|sessao|trace|request|correlation|tenant)_/i.test(c.nome))
      add('ARQ-02', t, 'coluna ' + c.nome + ' (' + c.tipo + ')', c.nome);
  }
  const ordem = { critica: 0, alta: 1, media: 2, baixa: 3 };
  return out.sort((a, b) => ordem[a.gravidade] - ordem[b.gravidade] || a.onde.localeCompare(b.onde));
}
// uma nota de 0 a 100 para o resumo (cada achado pesa pela gravidade)
export function nota(achados: Achado[]): number {
  const peso = { critica: 25, alta: 10, media: 4, baixa: 1 };
  return Math.max(0, 100 - achados.reduce((s, a) => s + peso[a.gravidade], 0));
}
