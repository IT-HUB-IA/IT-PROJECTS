import re, html
ATUAL = '28 de setembro de 2026'
CSS = r'''
:root{--preto:#050506;--carvao:#151517;--grafite:#2E2E31;--nevoa:#B9B9BE;--branco:#fff;--vermelho:#FF0000;--linha:#E4E4E7;--texto:#1b1b1e;--sec:#55555c;
--display:'Space Grotesk',ui-sans-serif,system-ui,sans-serif;--corpo:'IBM Plex Sans',ui-sans-serif,system-ui,sans-serif;--mono:'IBM Plex Mono',ui-monospace,Menlo,monospace}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--branco);color:var(--texto);font-family:var(--corpo);font-size:16px;line-height:1.65}
a{color:inherit}
.topo{background-color:var(--preto);background-image:linear-gradient(var(--carvao) 1px,transparent 1px),linear-gradient(90deg,var(--carvao) 1px,transparent 1px);background-size:64px 64px;color:var(--branco)}
.topo-in{max-width:1120px;margin:0 auto;padding:28px 24px 56px}
.barra{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.logo{font-family:var(--display);font-weight:700;font-size:24px;display:flex;align-items:center;gap:10px;text-decoration:none}
.logo i{width:10px;height:10px;background:var(--vermelho);display:inline-block}
.nav{display:flex;gap:6px;flex-wrap:wrap}
.nav a{font-family:var(--mono);font-size:12px;letter-spacing:.1em;text-transform:uppercase;text-decoration:none;color:var(--nevoa);padding:8px 12px;border:1px solid var(--grafite)}
.nav a:hover,.nav a[aria-current]{color:var(--branco);border-color:var(--nevoa)}
.olho{margin:48px 0 12px;font-family:var(--mono);font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--nevoa);display:flex;align-items:center;gap:10px}
.olho::before{content:"";width:24px;height:2px;background:var(--vermelho)}
h1{font-family:var(--display);font-weight:600;font-size:clamp(34px,5vw,56px);line-height:1.05;letter-spacing:-.03em;margin:0}
.atual{margin:16px 0 0;color:var(--nevoa);font-size:14px}
.corpo{max-width:1120px;margin:0 auto;padding:48px 24px 80px;display:grid;grid-template-columns:260px 1fr;gap:56px}
.indice{position:sticky;top:24px;align-self:start;border:1px solid var(--linha);padding:18px}
.indice b{display:block;font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--sec);margin-bottom:10px}
.indice ol{margin:0;padding-left:20px;font-size:14px;line-height:1.5;display:grid;gap:6px}
.indice a{text-decoration:none;color:var(--sec)}.indice a:hover{color:var(--texto);text-decoration:underline}
main{min-width:0}
.resumo{border-left:3px solid var(--vermelho);background:#F6F6F7;padding:16px 20px;margin:0 0 32px}
.resumo p{margin:0}
section{padding:8px 0 24px;border-bottom:1px solid var(--linha);scroll-margin-top:16px}
section:last-of-type{border-bottom:0}
h2{font-family:var(--display);font-size:24px;font-weight:600;letter-spacing:-.01em;margin:24px 0 10px;display:flex;gap:12px;align-items:baseline}
h2 span{font-family:var(--mono);font-size:13px;color:var(--vermelho);font-weight:500}
h3{font-size:16px;margin:18px 0 6px}
ul{padding-left:20px}li{margin:4px 0}
table{width:100%;border-collapse:collapse;font-size:14px;margin:12px 0}
th,td{border:1px solid var(--linha);padding:10px 12px;text-align:left;vertical-align:top}
th{background:var(--preto);color:var(--branco);font-family:var(--mono);font-weight:500;font-size:12px;letter-spacing:.08em;text-transform:uppercase}
.tabela{overflow-x:auto}
.contato{border:1px solid var(--texto);padding:20px;margin-top:16px}
.rodape{background:var(--preto);color:var(--nevoa);font-family:var(--mono);font-size:12px;letter-spacing:.06em}
.rodape div{max-width:1120px;margin:0 auto;padding:24px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
.rodape a{color:var(--nevoa)}
@media (max-width:860px){.corpo{grid-template-columns:1fr;gap:24px}.indice{position:static}}
@media print{.topo,.rodape,.indice{display:none}.corpo{display:block}}
'''
def pagina(arq, titulo, olho, resumo, secoes, ativo):
    ind = ''.join(f'<li><a href="#s{i+1}">{html.escape(t)}</a></li>' for i,(t,_) in enumerate(secoes))
    sec = ''.join(f'<section id="s{i+1}"><h2><span>{i+1:02d}</span>{html.escape(t)}</h2>{c}</section>' for i,(t,c) in enumerate(secoes))
    nav = ''.join(f'<a href="{h}"' + (' aria-current="page"' if h == ativo else '') + f'>{n}</a>' for h,n in [('/termos','Termos de Uso'),('/privacidade','Privacidade'),('/','Entrar no sistema')])
    doc = f'''<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(titulo)} · CicloDev</title><meta name="description" content="{html.escape(titulo)} do CicloDev.">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
<style>{CSS}</style></head><body>
<header class="topo"><div class="topo-in"><div class="barra"><a class="logo" href="/"><i aria-hidden="true"></i>CicloDev</a><nav class="nav" aria-label="Documentos">{nav}</nav></div>
<p class="olho">{html.escape(olho)}</p><h1>{html.escape(titulo)}</h1><p class="atual">Última atualização: {ATUAL}</p></div></header>
<div class="corpo"><aside class="indice" aria-label="Índice"><b>Nesta página</b><ol>{ind}</ol></aside>
<main><div class="resumo">{resumo}</div>{sec}</main></div>
<footer class="rodape"><div><span>© 2026 IT.IA · Gestão de projetos de software</span><span><a href="/termos">Termos de Uso</a> · <a href="/privacidade">Política de Privacidade</a> · <a href="mailto:admin@it-ia.tec.br">admin@it-ia.tec.br</a></span></div></footer>
</body></html>
'''
    assert '—' not in doc, arq
    import os; open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'publico', arq), 'w', encoding='utf-8').write(doc)

# ======================= PRIVACIDADE =======================
P = [
('Quem somos e como falar com a gente', '''<p>Esta política explica como o <b>CicloDev</b> (o "Sistema"), sistema de gestão de projetos de software da IT.IA, disponível no endereço <a href="https://system.it-ia.tec.br">system.it-ia.tec.br</a>, trata dados pessoais, de acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, "LGPD") e o Marco Civil da Internet (Lei nº 12.965/2014).</p>
<p>A IT.IA é a <b>controladora</b> dos dados da sua conta e do seu uso do Sistema. Para qualquer assunto sobre os seus dados, inclusive para falar com o encarregado (DPO), escreva para <a href="mailto:admin@it-ia.tec.br">admin@it-ia.tec.br</a>.</p>'''),
('Quais dados tratamos', '''<div class="tabela"><table><thead><tr><th>Grupo</th><th>Dados</th><th>De onde vêm</th></tr></thead><tbody>
<tr><td>Conta</td><td>Nome, e-mail, número de ID do Sistema, nome de usuário (se você criar) e senha. A senha é guardada de forma cifrada (hash); nem a IT.IA consegue lê-la.</td><td>Você, no cadastro</td></tr>
<tr><td>Cadastro</td><td>Nome completo, data de nascimento, CPF, endereço residencial (CEP, rua, número, complemento, bairro, cidade e estado), finalidade de uso (trabalho, estudo, pessoal ou outro), cargo ou curso e empresa ou instituição.</td><td>Você, no cadastro ou em "Complete o seu cadastro"</td></tr>
<tr><td>Login com outras contas</td><td>Se você entrar com Google, GitHub, Apple ou Microsoft: nome, e-mail, foto do perfil e o identificador da conta nesse serviço. Não recebemos a sua senha dessas contas.</td><td>O serviço que você escolheu</td></tr>
<tr><td>Conteúdo</td><td>O que você cria ou recebe no Sistema: clientes e seus contatos, projetos, aplicações, tarefas, sprints, comentários, links, custos, receitas, equipes, custo e remuneração de pessoas do time e demais registros.</td><td>Você e as pessoas com quem você trabalha</td></tr>
<tr><td>Uso do Sistema</td><td>Data e hora de entrada, telas abertas, tempo de uso (contado em blocos de 5 minutos com a tela em uso), tempo para carregar e salvar e mensagens de erro da tela.</td><td>A própria tela do Sistema</td></tr>
<tr><td>Registros de acesso</td><td>Endereço IP, data e hora de cada entrada no Sistema e o tipo de navegador. Os serviços de hospedagem também registram, por pouco tempo, os acessos às páginas e ao login, para segurança.</td><td>O próprio pedido do seu navegador ao Sistema</td></tr>
</tbody></table></div>
<p>Não tratamos dados pessoais sensíveis (como origem racial, saúde, religião ou biometria) e pedimos que você não os coloque no Sistema.</p>'''),
('Para que usamos e com qual base legal', '''<div class="tabela"><table><thead><tr><th>Finalidade</th><th>Dados usados</th><th>Base legal (LGPD, art. 7º)</th></tr></thead><tbody>
<tr><td>Criar e manter a sua conta, fazer login e oferecer o Sistema</td><td>Conta, login com outras contas, conteúdo</td><td>Execução de contrato (inciso V)</td></tr>
<tr><td>Identificar você de forma única, evitar contas duplicadas e prevenir fraudes</td><td>CPF, nome completo e data de nascimento</td><td>Execução de contrato (inciso V) e legítimo interesse (inciso IX)</td></tr>
<tr><td>Preencher o endereço a partir do CEP</td><td>CEP</td><td>Execução de contrato (inciso V)</td></tr>
<tr><td>Permitir que você compartilhe e trabalhe junto com outras pessoas</td><td>Nome, número de ID, nome de usuário e o conteúdo compartilhado</td><td>Execução de contrato (inciso V)</td></tr>
<tr><td>Medir o uso, o desempenho e os erros para manter e melhorar o Sistema</td><td>Uso do Sistema</td><td>Legítimo interesse (inciso IX)</td></tr>
<tr><td>Proteger o Sistema e as contas contra acessos indevidos</td><td>Registros de acesso e uso do Sistema</td><td>Legítimo interesse (inciso IX)</td></tr>
<tr><td>Guardar os registros de acesso pelo prazo que a lei exige</td><td>Registros de acesso</td><td>Cumprimento de obrigação legal (inciso II; Marco Civil, art. 15)</td></tr>
<tr><td>Falar com você sobre a sua conta (confirmação de e-mail, troca de senha, avisos importantes)</td><td>E-mail</td><td>Execução de contrato (inciso V)</td></tr>
</tbody></table></div>
<p>Não usamos os seus dados para publicidade, não vendemos dados e não tomamos decisões automatizadas que afetem os seus direitos.</p>'''),
('Quem vê os seus dados dentro do Sistema', '''<ul>
<li><b>Você</b> vê e pode alterar os seus dados de conta e de cadastro.</li>
<li><b>Pessoas com quem você compartilha</b> um cliente, projeto ou aplicação, ou que estão na mesma equipe que você, veem o seu nome, e-mail, número de ID, nome de usuário e o seu perfil no Team (função, habilidades e horas por semana), além do conteúdo compartilhado. Elas <b>não</b> veem o seu CPF, nascimento, endereço, cargo do cadastro ou dados de uso.</li>
<li><b>A IT.IA</b>, que administra o CicloDev, tem acesso aos dados de cadastro, aos números de uso de cada conta (por exemplo, quantos projetos existem e quantos dias houve acesso) e ao histórico de uso (entradas e telas abertas), para dar suporte, prevenir fraudes e cuidar do funcionamento. A IT.IA <b>não</b> acessa o conteúdo dos seus projetos no uso normal do Sistema.</li>
</ul>'''),
('Com quem compartilhamos', '''<p>O Sistema usa os serviços abaixo para funcionar. Cada um recebe só o necessário para a sua parte:</p>
<div class="tabela"><table><thead><tr><th>Empresa</th><th>Para quê</th><th>Onde</th></tr></thead><tbody>
<tr><td>Supabase</td><td>Banco de dados e login</td><td>Banco de dados em São Paulo, Brasil</td></tr>
<tr><td>Serviço de envio de e-mail (Resend)</td><td>E-mails da conta, como confirmação de cadastro e troca de senha</td><td>Estados Unidos</td></tr>
<tr><td>Vercel</td><td>Hospedagem das páginas do Sistema</td><td>Estados Unidos e rede global</td></tr>
<tr><td>Google, GitHub, Apple ou Microsoft</td><td>Login, somente se você escolher entrar com uma dessas contas</td><td>Conforme a política de cada empresa</td></tr>
<tr><td>ViaCEP</td><td>Busca do endereço a partir do CEP (só o CEP é enviado)</td><td>Brasil</td></tr>
<tr><td>Google Fonts e jsDelivr</td><td>Fontes e bibliotecas da tela; recebem só dados técnicos do navegador, como o endereço IP, e nenhum dado da sua conta</td><td>Rede global</td></tr>
</tbody></table></div>
<p>Não vendemos nem alugamos dados. Fora os serviços acima, a IT.IA só compartilha dados quando a lei ou uma ordem judicial exigir, ou para defender direitos em processo judicial, administrativo ou arbitral.</p>'''),
('Transferência para outros países', '''<p>Alguns desses serviços funcionam fora do Brasil. Nesses casos, a transferência segue o art. 33 da LGPD, e a IT.IA escolhe fornecedores que oferecem garantias de proteção de dados nos seus termos de serviço. Os dados do banco de dados (conta, cadastro, conteúdo e uso) ficam armazenados no Brasil.</p>'''),
('Por quanto tempo guardamos', '''<ul>
<li><b>Conta, cadastro e conteúdo:</b> enquanto a sua conta existir. Se você pedir a exclusão, apagamos em até 30 dias, exceto o que a lei nos obrigue a guardar.</li>
<li><b>Uso do Sistema:</b> até 12 meses. Depois disso, o Sistema apaga automaticamente.</li>
<li><b>Registros de acesso (IP, data e hora de cada entrada):</b> 12 meses, cumprindo o mínimo de 6 meses exigido pelo art. 15 do Marco Civil da Internet. Depois disso, o Sistema apaga automaticamente.</li>
<li><b>Dados necessários para cumprir obrigações legais ou defender direitos:</b> pelo prazo que a lei determinar.</li>
</ul>'''),
('Os seus direitos', '''<p>Pela LGPD (art. 18), você pode pedir a qualquer momento:</p>
<ul>
<li>confirmação de que tratamos os seus dados e acesso a eles;</li>
<li>correção de dados incompletos, errados ou desatualizados;</li>
<li>anonimização, bloqueio ou exclusão de dados desnecessários, excessivos ou tratados em desacordo com a lei;</li>
<li>portabilidade dos seus dados para outro fornecedor;</li>
<li>exclusão dos dados tratados com o seu consentimento;</li>
<li>informação sobre com quem compartilhamos os seus dados;</li>
<li>informação sobre a possibilidade de não dar consentimento e o que acontece nesse caso;</li>
<li>revogação do consentimento;</li>
<li>oposição a um tratamento feito com base em legítimo interesse, quando houver descumprimento da lei.</li>
</ul>
<p>Para exercer qualquer um desses direitos, escreva para <a href="mailto:admin@it-ia.tec.br">admin@it-ia.tec.br</a> usando o e-mail da sua conta. Podemos pedir uma confirmação de identidade para proteger você. Respondemos em até 15 dias. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD), em <a href="https://www.gov.br/anpd">gov.br/anpd</a>.</p>'''),
('Como protegemos os dados', '''<ul>
<li>Toda a comunicação com o Sistema é cifrada (HTTPS).</li>
<li>As senhas são guardadas de forma cifrada (hash).</li>
<li>O banco de dados tem regras de acesso por registro: cada pessoa só consegue ler e alterar o que é dela ou o que foi compartilhado com ela.</li>
<li>Os dados de cadastro ficam separados, numa área que só a própria pessoa e a administração conseguem ler.</li>
<li>Mudanças importantes ficam registradas em histórico.</li>
</ul>
<p>Nenhum sistema é totalmente imune a falhas. Se acontecer um incidente de segurança que possa trazer risco ou dano relevante a você, avisaremos você e a ANPD, como manda o art. 48 da LGPD.</p>'''),
('Armazenamento no navegador (cookies)', '''<p>O Sistema guarda no seu navegador apenas o que é necessário para funcionar: a sessão de login (para você não precisar entrar a cada página) e preferências da tela, como o menu recolhido. Não usamos cookies de publicidade nem ferramentas de rastreamento de terceiros. Se você limpar os dados do navegador, só vai precisar entrar de novo.</p>'''),
('Dados de terceiros que você coloca no Sistema', '''<p>Ao cadastrar no Sistema dados de outras pessoas (por exemplo, contatos de clientes ou membros de equipe sem conta), você é o controlador desses dados e a IT.IA atua como operadora, tratando-os só para oferecer o Sistema a você. Você deve ter uma base legal para usar esses dados e informar essas pessoas quando a lei exigir.</p>'''),
('Crianças e adolescentes', '''<p>O Sistema é feito para uso profissional e educacional. Menores de 18 anos só podem usá-lo com autorização e acompanhamento do responsável legal. Se soubermos que dados de uma criança foram cadastrados sem o consentimento de um responsável, apagaremos esses dados.</p>'''),
('Mudanças nesta política', '''<p>Podemos atualizar esta política para refletir mudanças no Sistema ou na lei. A data da última atualização fica no topo. Se a mudança for relevante, avisaremos pelo e-mail da conta ou dentro do Sistema antes de ela valer.</p>
<div class="contato"><b>Contato:</b> <a href="mailto:admin@it-ia.tec.br">admin@it-ia.tec.br</a></div>'''),
]
pagina('privacidade.html', 'Política de Privacidade', 'CicloDev · LGPD',
 '<p><b>Resumo:</b> usamos os seus dados só para oferecer o Sistema, manter a sua conta segura e melhorar o serviço. Não vendemos dados e não fazemos publicidade. O seu CPF, nascimento e endereço não aparecem para as pessoas com quem você compartilha projetos. Você pode pedir acesso, correção ou exclusão pelo e-mail admin@it-ia.tec.br.</p>', P, '/privacidade')

# ======================= TERMOS =======================
T = [
('Aceite destes termos', '''<p>Estes Termos de Uso regulam o uso do <b>CicloDev</b> (o "Sistema"), uma plataforma de gestão de projetos de software oferecida pela IT.IA em <a href="https://system.it-ia.tec.br">system.it-ia.tec.br</a>. Ao criar uma conta ou usar o Sistema, você declara que leu e concorda com estes Termos e com a <a href="/privacidade">Política de Privacidade</a>. Se não concordar, não use o Sistema.</p>'''),
('O que o Sistema oferece', '''<p>O Sistema reúne ferramentas para planejar e acompanhar projetos de software, como estrutura de clientes, projetos e aplicações, Board, Backlog, Sprints, cronograma, calendário, carga do time, custos e receitas, atendimento (Service Desk), catálogo de serviços, modelos de etapas (Playbook), agentes e compartilhamento de trabalho entre contas. As funções podem mudar, ser melhoradas ou retiradas com o tempo.</p>'''),
('Sua conta', '''<ul>
<li>Para criar uma conta você precisa informar dados verdadeiros, completos e atualizados. Menores de 18 anos só podem usar o Sistema com autorização do responsável legal.</li>
<li>Cada pessoa pode ter uma conta por CPF. A conta é pessoal: não compartilhe a sua senha.</li>
<li>Você é responsável pelo que for feito com a sua conta. Se perceber uso indevido, troque a senha e avise <a href="mailto:admin@it-ia.tec.br">admin@it-ia.tec.br</a>.</li>
<li>Se você entrar com Google, GitHub, Apple ou Microsoft, o uso dessas contas também segue as regras de cada serviço.</li>
</ul>'''),
('Uso permitido e proibido', '''<p>Você se compromete a usar o Sistema de acordo com a lei, estes Termos e a boa-fé. É proibido:</p>
<ul>
<li>usar o Sistema para qualquer atividade ilegal ou para guardar ou divulgar conteúdo ilícito, ofensivo, discriminatório ou que viole direitos de outras pessoas;</li>
<li>inserir dados pessoais de terceiros sem base legal, ou dados pessoais sensíveis sem necessidade;</li>
<li>tentar acessar contas, dados ou áreas que não são suas, testar falhas de segurança sem autorização ou contornar as regras de acesso;</li>
<li>enviar vírus, códigos maliciosos ou qualquer coisa que prejudique o Sistema ou outras pessoas;</li>
<li>sobrecarregar o Sistema de propósito, ou coletar dados de forma automatizada sem autorização;</li>
<li>copiar, revender ou explorar comercialmente o Sistema, ou criar produtos a partir dele, sem autorização por escrito;</li>
<li>se passar por outra pessoa ou empresa.</li>
</ul>'''),
('O seu conteúdo', '''<ul>
<li>O que você cria no Sistema continua sendo seu. A IT.IA não se torna dona do seu conteúdo.</li>
<li>Para o Sistema funcionar, você autoriza a IT.IA a armazenar, copiar para segurança, processar e exibir o seu conteúdo, apenas para oferecer o serviço a você e às pessoas com quem você compartilhar.</li>
<li>Você garante que tem o direito de usar o conteúdo que coloca no Sistema, inclusive dados de clientes e de outras pessoas. Nesses casos, você é o controlador desses dados e a IT.IA é a operadora, como explica a <a href="/privacidade">Política de Privacidade</a>.</li>
<li>Você pode pedir uma cópia dos seus dados a qualquer momento pelo e-mail admin@it-ia.tec.br.</li>
</ul>'''),
('Compartilhamento entre contas', '''<ul>
<li>Você pode compartilhar um cliente, projeto ou aplicação com outras pessoas pelo número de ID, nome de usuário ou e-mail.</li>
<li>Quem recebe um compartilhamento pode ver e trabalhar em tudo o que está dentro do ponto compartilhado. Compartilhe só com quem você confia e retire o acesso quando não for mais necessário.</li>
<li>Você é responsável pelas decisões de compartilhamento que tomar.</li>
</ul>'''),
('Propriedade intelectual', '''<p>O Sistema, a marca CicloDev, o design, os textos, os modelos e o código pertencem à IT.IA ou aos seus licenciantes e são protegidos pela lei. Estes Termos dão a você apenas o direito de usar o Sistema, de forma pessoal e intransferível, enquanto a sua conta estiver ativa. Marcas de terceiros (como Google, GitHub, Apple, Microsoft, Jira e Trello) pertencem aos seus donos e são citadas só para identificar serviços.</p>'''),
('Preço', '''<p>No momento, o uso do Sistema é gratuito. Se a IT.IA passar a cobrar por algum plano ou função, isso será informado com pelo menos 30 dias de antecedência, com o preço e as condições. Nada será cobrado sem a sua concordância.</p>'''),
('Disponibilidade e mudanças no serviço', '''<p>Trabalhamos para manter o Sistema funcionando sempre, mas podem ocorrer interrupções para manutenção, atualizações ou por falhas de serviços de terceiros, como hospedagem e internet. Quando possível, avisaremos manutenções programadas com antecedência.</p>'''),
('Responsabilidades', '''<ul>
<li>A IT.IA responde pelos danos que causar, nos termos da lei, inclusive do Código de Defesa do Consumidor quando ele se aplicar.</li>
<li>Na medida permitida pela lei, a IT.IA não responde por danos causados por uso do Sistema em desacordo com estes Termos, por conteúdo inserido pelos usuários, por decisões tomadas com base nas informações do Sistema, por falhas de serviços de terceiros fora do seu controle ou por caso fortuito e força maior.</li>
<li>Os cálculos do Sistema (como custos, preço sugerido e margem) servem de apoio à decisão e dependem dos dados informados. Confira-os antes de usar em propostas, contratos ou obrigações fiscais.</li>
</ul>'''),
('Suspensão e encerramento', '''<ul>
<li>Você pode deixar de usar o Sistema e pedir a exclusão da sua conta a qualquer momento, pelo e-mail <a href="mailto:admin@it-ia.tec.br">admin@it-ia.tec.br</a>.</li>
<li>A IT.IA pode suspender ou encerrar uma conta que descumpra estes Termos ou a lei, ou quando uma autoridade exigir. Sempre que possível e permitido, avisaremos antes e daremos a chance de corrigir o problema e de receber uma cópia dos seus dados.</li>
<li>Depois do encerramento, os dados são tratados como descrito na <a href="/privacidade">Política de Privacidade</a>.</li>
</ul>'''),
('Mudanças nestes termos', '''<p>Podemos atualizar estes Termos. A data da última atualização fica no topo. Mudanças relevantes serão avisadas pelo e-mail da conta ou dentro do Sistema com pelo menos 15 dias de antecedência. Se você não concordar, pode encerrar a conta antes de a mudança valer; continuar usando o Sistema depois disso significa que você concorda.</p>'''),
('Lei aplicável e foro', '''<p>Estes Termos seguem as leis do Brasil. Fica eleito o foro do domicílio do usuário para resolver qualquer questão, sem prejuízo de outro foro que a lei garanta a você. Antes de ir à Justiça, procure a gente: a maioria dos problemas se resolve por e-mail.</p>
<div class="contato"><b>Contato:</b> <a href="mailto:admin@it-ia.tec.br">admin@it-ia.tec.br</a></div>'''),
]
pagina('termos.html', 'Termos de Uso', 'CicloDev · Condições de uso',
 '<p><b>Resumo:</b> use o Sistema de acordo com a lei e com dados verdadeiros. O que você cria é seu. Compartilhe só com quem confia. O uso é gratuito por enquanto e qualquer cobrança futura será avisada antes. Dúvidas: admin@it-ia.tec.br.</p>', T, '/termos')
print('ok')
