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
.logo .marca-icone{width:36px;height:36px;flex:0 0 36px;display:block}
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
    nav = ''.join(f'<a href="{h}"' + (' aria-current="page"' if h == ativo else '') + f'>{n}</a>' for h,n in [('/termos','Termos de Uso'),('/privacidade','Privacidade'),('/fornecedores','Fornecedores'),('/','Entrar no sistema')])
    doc = f'''<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(titulo)} · CicloDev</title><meta name="description" content="{html.escape(titulo)} do CicloDev."><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png"><link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest"><meta name="theme-color" content="#0B0B0C">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
<style>{CSS}</style></head><body>
<header class="topo"><div class="topo-in"><div class="barra"><a class="logo" href="/"><svg class="marca-icone" viewBox="0 0 256 256" aria-hidden="true" focusable="false"> <rect width="256" height="256" rx="56" fill="#0B0B0C"/> <rect x="28" y="46" width="200" height="168" rx="10" fill="#F7F7F8"/> <path d="M38 46h180a10 10 0 0 1 10 10v24H28V56a10 10 0 0 1 10-10z" fill="#DCDCDF"/> <circle cx="50" cy="63" r="6.5" fill="#FF1F1F"/> <circle cx="70" cy="63" r="6.5" fill="#B4B4BA"/> <circle cx="90" cy="63" r="6.5" fill="#B4B4BA"/> <path d="M98 116l-32 32 32 32" fill="none" stroke="#0B0B0C" stroke-width="17" stroke-linecap="square" stroke-linejoin="miter"/> <path d="M158 116l32 32-32 32" fill="none" stroke="#0B0B0C" stroke-width="17" stroke-linecap="square" stroke-linejoin="miter"/> <path d="M146 104l-36 88" fill="none" stroke="#FF1F1F" stroke-width="15" stroke-linecap="square"/> </svg><i aria-hidden="true"></i>CicloDev</a><nav class="nav" aria-label="Documentos">{nav}</nav></div>
<p class="olho">{html.escape(olho)}</p><h1>{html.escape(titulo)}</h1><p class="atual">Última atualização: {ATUAL}</p></div></header>
<div class="corpo"><aside class="indice" aria-label="Índice"><b>Nesta página</b><ol>{ind}</ol></aside>
<main><div class="resumo">{resumo}</div>{sec}</main></div>
<footer class="rodape"><div><span>© 2026 IT.IA · CNPJ 69.279.397/0001-07</span><span><a href="/termos">Termos de Uso</a> · <a href="/privacidade">Privacidade</a> · <a href="/fornecedores">Fornecedores</a> · <a href="mailto:contato@it-ia.tec.br">contato@it-ia.tec.br</a></span></div></footer>
</body></html>
'''
    assert '—' not in doc, arq
    import os; open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'publico', arq), 'w', encoding='utf-8').write(doc)

# ======================= DADOS DA EMPRESA =======================
EMPRESA = 'IT.IA, inscrita no CNPJ sob o nº 69.279.397/0001-07'
SUPORTE = '<a href="mailto:suporte@it-ia.tec.br">suporte@it-ia.tec.br</a>'
CONTATO = '<a href="mailto:contato@it-ia.tec.br">contato@it-ia.tec.br</a>'
PRIVACIDADE = '<a href="mailto:privacidade@it-ia.tec.br">privacidade@it-ia.tec.br</a>'

# ======================= PRIVACIDADE =======================
P = [
('Quem somos', f'''<p>O <b>CicloDev</b> (o "Sistema") é o sistema de gestão de projetos de software da <b>{EMPRESA}</b> ("IT.IA", "nós"). Esta política explica como a IT.IA trata dados pessoais no Sistema, de acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, "LGPD") e o Marco Civil da Internet (Lei nº 12.965/2014).</p>
<p>A IT.IA é a <b>controladora</b> dos dados da sua conta e do seu uso do Sistema. Para assuntos de dados pessoais, inclusive para falar com o encarregado (DPO), escreva para {PRIVACIDADE}.</p>'''),
('Dados que tratamos', '''<ul>
<li><b>Conta:</b> nome, e-mail, número de ID, nome de usuário (opcional) e senha, que é guardada protegida e nunca em texto aberto.</li>
<li><b>Cadastro:</b> nome completo, data de nascimento, CPF, endereço, finalidade de uso, cargo ou curso e empresa ou instituição.</li>
<li><b>Login com Google:</b> se você entrar com a sua conta Google, recebemos o nome, o e-mail, a foto e o identificador da conta. Não recebemos a sua senha do Google.</li>
<li><b>Conteúdo:</b> o que você e as pessoas com quem você trabalha colocam no Sistema, como clientes, projetos, tarefas, comentários, links, equipes, custos e demais registros.</li>
<li><b>Uso e acesso:</b> data e hora das entradas, telas abertas, tempo de uso, desempenho e erros da tela, endereço IP e tipo de navegador.</li>
</ul>
<p>Não pedimos dados pessoais sensíveis (como saúde, religião ou biometria) e pedimos que você não os coloque no Sistema.</p>'''),
('Para que usamos', '''<div class="tabela"><table><thead><tr><th>Finalidade</th><th>Base legal (LGPD, art. 7º)</th></tr></thead><tbody>
<tr><td>Criar e manter a sua conta e oferecer o Sistema, inclusive o compartilhamento com outras pessoas</td><td>Execução de contrato</td></tr>
<tr><td>Identificar você de forma única, evitar contas duplicadas e prevenir fraudes</td><td>Execução de contrato e legítimo interesse</td></tr>
<tr><td>Manter o Sistema seguro, medir o uso e corrigir erros</td><td>Legítimo interesse</td></tr>
<tr><td>Guardar os registros de acesso pelo prazo exigido pelo Marco Civil da Internet (art. 15)</td><td>Cumprimento de obrigação legal</td></tr>
<tr><td>Enviar mensagens sobre a sua conta, como confirmação de e-mail e troca de senha</td><td>Execução de contrato</td></tr>
</tbody></table></div>
<p>Não vendemos dados, não fazemos publicidade com eles e não tomamos decisões automatizadas que afetem os seus direitos.</p>'''),
('Quem vê os seus dados', '''<ul>
<li><b>Você</b> vê e altera os seus dados.</li>
<li><b>Quem trabalha com você</b> (pessoas com quem você compartilha algo, ou da mesma equipe) vê o seu nome, e-mail, número de ID, nome de usuário e perfil no Team, além do conteúdo compartilhado. Essas pessoas <b>não</b> veem os seus dados de cadastro (como CPF, nascimento e endereço) nem os seus dados de uso.</li>
<li><b>A IT.IA</b> acessa os dados de conta, de cadastro e de uso para dar suporte, prevenir fraudes e manter o Sistema funcionando. A IT.IA não acessa o conteúdo dos seus projetos, salvo quando você pedir suporte ou quando a lei exigir.</li>
</ul>'''),
('Com quem compartilhamos', '''<p>Usamos fornecedores para hospedar o Sistema, guardar os dados, enviar e-mails e oferecer o login com Google. Eles recebem só o necessário para a sua parte do serviço. A lista atualizada está na página <a href="/fornecedores">Fornecedores</a>.</p>
<p>Fora isso, a IT.IA só compartilha dados quando a lei ou uma ordem judicial exigir, ou para defender direitos em processo judicial, administrativo ou arbitral.</p>'''),
('Transferência internacional', '''<p>Alguns fornecedores ficam fora do Brasil. Nesses casos, a transferência segue o art. 33 da LGPD, e a IT.IA escolhe fornecedores que oferecem garantias de proteção de dados.</p>'''),
('Por quanto tempo guardamos', '''<ul>
<li><b>Conta, cadastro e conteúdo:</b> enquanto a sua conta existir. Se você pedir a exclusão, apagamos em até 30 dias, exceto o que a lei nos obrigue a guardar.</li>
<li><b>Uso e registros de acesso:</b> até 12 meses, o que cumpre o prazo mínimo de 6 meses do Marco Civil da Internet. Depois disso, são apagados automaticamente.</li>
<li><b>O que for necessário para cumprir a lei ou defender direitos:</b> pelo prazo que a lei determinar.</li>
</ul>'''),
('Os seus direitos', f'''<p>Pela LGPD (art. 18), você pode pedir: confirmação e acesso aos seus dados; correção; anonimização, bloqueio ou exclusão de dados desnecessários ou tratados em desacordo com a lei; portabilidade; exclusão de dados tratados com consentimento; informação sobre com quem compartilhamos; e revogação do consentimento. Você também pode se opor a um tratamento feito com base em legítimo interesse.</p>
<p>Para exercer esses direitos, escreva para {PRIVACIDADE} usando o e-mail da sua conta. Podemos pedir uma confirmação de identidade para proteger você. Respondemos em até 15 dias. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD), em <a href="https://www.gov.br/anpd">gov.br/anpd</a>.</p>'''),
('Segurança', '''<p>A IT.IA adota medidas técnicas e administrativas para proteger os dados contra acesso não autorizado, perda e alteração, como comunicação cifrada, controle de acesso por pessoa e registro de alterações. Nenhum sistema é totalmente imune a falhas. Se acontecer um incidente de segurança que possa trazer risco ou dano relevante, avisaremos você e a ANPD, como manda o art. 48 da LGPD.</p>'''),
('Cookies e armazenamento no navegador', '''<p>O Sistema guarda no seu navegador só o necessário para funcionar, como a sessão de login e preferências da tela. Não usamos cookies de publicidade nem rastreamento de terceiros.</p>'''),
('Dados que você coloca sobre outras pessoas', '''<p>Quando você cadastra dados de outras pessoas no Sistema (por exemplo, contatos de clientes ou pessoas do time), você é o controlador desses dados e a IT.IA atua como operadora, tratando-os só para oferecer o Sistema a você. Você é responsável por ter uma base legal para isso.</p>'''),
('Idade mínima', '''<p>O Sistema é destinado a maiores de 18 anos. Não criamos contas para menores de idade. Se soubermos que uma conta pertence a um menor, ela será encerrada e os dados apagados.</p>'''),
('Mudanças nesta política', f'''<p>Podemos atualizar esta política. A data da última atualização fica no topo. Se a mudança for relevante, avisaremos pelo e-mail da conta ou dentro do Sistema antes de ela valer.</p>
<div class="contato"><b>Privacidade e dados pessoais:</b> {PRIVACIDADE}<br><b>Suporte:</b> {SUPORTE}<br><b>Contato geral:</b> {CONTATO}</div>'''),
]
pagina('privacidade.html', 'Política de Privacidade', 'CicloDev · LGPD',
 f'<p><b>Resumo:</b> a IT.IA usa os seus dados só para oferecer o CicloDev, manter a sua conta segura e melhorar o serviço. Não vendemos dados. Os seus dados de cadastro não aparecem para as pessoas com quem você trabalha. Para acessar, corrigir ou apagar os seus dados, escreva para {PRIVACIDADE}.</p>', P, '/privacidade')

# ======================= TERMOS =======================
T = [
('Aceite', f'''<p>Estes Termos de Uso regulam o uso do <b>CicloDev</b> (o "Sistema"), oferecido pela <b>{EMPRESA}</b> ("IT.IA"). Ao criar uma conta ou usar o Sistema, você concorda com estes Termos e com a <a href="/privacidade">Política de Privacidade</a>. Se não concordar, não use o Sistema.</p>'''),
('O Sistema', '''<p>O CicloDev é uma plataforma de gestão de projetos de software. As funções podem mudar, ser melhoradas ou retiradas com o tempo. Funções marcadas como teste ou em desenvolvimento podem ter falhas e ser alteradas ou encerradas.</p>'''),
('Sua conta', f'''<ul>
<li>É preciso ter 18 anos ou mais e informar dados verdadeiros e atualizados.</li>
<li>A conta é pessoal: uma por pessoa. Não compartilhe a sua senha.</li>
<li>Você é responsável pelo que for feito com a sua conta. Se perceber uso indevido, troque a senha e avise {SUPORTE}.</li>
<li>Se você entrar com a sua conta Google, o uso dela também segue as regras do Google.</li>
</ul>'''),
('Uso proibido', '''<p>Não é permitido usar o Sistema para:</p>
<ul>
<li>qualquer atividade ilegal, ou guardar e divulgar conteúdo ilícito, ofensivo ou que viole direitos de outras pessoas;</li>
<li>tratar dados pessoais de terceiros sem base legal;</li>
<li>acessar contas ou dados que não são seus, testar falhas de segurança sem autorização ou contornar as regras de acesso;</li>
<li>enviar vírus ou códigos maliciosos, sobrecarregar o Sistema ou coletar dados de forma automatizada sem autorização;</li>
<li>copiar, revender ou criar produtos a partir do Sistema sem autorização por escrito;</li>
<li>se passar por outra pessoa ou empresa.</li>
</ul>'''),
('O seu conteúdo', f'''<ul>
<li>O que você cria no Sistema é seu. A IT.IA não se torna dona do seu conteúdo.</li>
<li>Você autoriza a IT.IA a guardar, copiar para segurança e exibir o seu conteúdo, só para oferecer o Sistema a você e às pessoas com quem você compartilhar.</li>
<li>Você garante que tem o direito de usar o que coloca no Sistema, inclusive dados de outras pessoas.</li>
<li>Você pode pedir uma cópia dos seus dados a qualquer momento pelo e-mail {SUPORTE}.</li>
</ul>'''),
('Compartilhamento', '''<ul>
<li>Quem recebe um compartilhamento pode ver e trabalhar em tudo o que está dentro do que foi compartilhado. Compartilhe só com quem você confia.</li>
<li>O conteúdo continua sendo de quem compartilhou. Se essa pessoa retirar o acesso ou encerrar a conta, você deixa de ver esse conteúdo.</li>
</ul>'''),
('Sugestões', '''<p>Se você enviar sugestões ou ideias sobre o Sistema, a IT.IA pode usá-las livremente para melhorar o Sistema, sem precisar dar crédito.</p>'''),
('Propriedade intelectual', '''<p>O Sistema, a marca CicloDev, o design e o código pertencem à IT.IA. Estes Termos dão a você só o direito de usar o Sistema, de forma pessoal e intransferível, enquanto a sua conta estiver ativa. Marcas de terceiros citadas, como Google, pertencem aos seus donos.</p>'''),
('Disponibilidade', '''<p>A IT.IA trabalha para manter o Sistema funcionando, mas podem ocorrer interrupções para manutenção, atualizações ou por falhas de serviços de terceiros. Quando possível, avisaremos manutenções programadas.</p>'''),
('Responsabilidades', '''<ul>
<li>A IT.IA responde pelos danos que causar, nos termos da lei, inclusive do Código de Defesa do Consumidor quando ele se aplicar.</li>
<li>Na medida permitida pela lei, a IT.IA não responde por danos causados por uso do Sistema em desacordo com estes Termos, por conteúdo inserido pelos usuários, por decisões tomadas com base nas informações do Sistema ou por falhas de serviços de terceiros fora do seu controle.</li>
<li>Os cálculos e relatórios do Sistema servem de apoio e dependem dos dados informados. Confira-os antes de usar.</li>
</ul>'''),
('Suspensão e encerramento', f'''<ul>
<li>Você pode encerrar a sua conta a qualquer momento, pedindo pelo e-mail {SUPORTE}.</li>
<li>A IT.IA pode suspender ou encerrar uma conta que descumpra estes Termos ou a lei, ou quando uma autoridade exigir. Sempre que possível, avisaremos antes e daremos a chance de corrigir o problema e de receber uma cópia dos dados.</li>
<li>Depois do encerramento, os dados são tratados como descrito na <a href="/privacidade">Política de Privacidade</a>.</li>
</ul>'''),
('Mudanças nestes termos', '''<p>A IT.IA pode atualizar estes Termos. A data da última atualização fica no topo. Mudanças relevantes serão avisadas pelo e-mail da conta ou dentro do Sistema com pelo menos 15 dias de antecedência. Se você não concordar, pode encerrar a conta antes de a mudança valer.</p>'''),
('Lei aplicável e foro', f'''<p>Estes Termos seguem as leis do Brasil. Fica eleito o foro do domicílio do usuário, sem prejuízo de outro foro que a lei garanta a você.</p>
<div class="contato"><b>Suporte:</b> {SUPORTE}<br><b>Contato geral:</b> {CONTATO}<br><b>Privacidade e dados pessoais:</b> {PRIVACIDADE}</div>'''),
]
pagina('termos.html', 'Termos de Uso', 'CicloDev · Condições de uso',
 '<p><b>Resumo:</b> use o CicloDev de acordo com a lei e com dados verdadeiros. O que você cria é seu. Compartilhe só com quem confia. A IT.IA pode melhorar o Sistema e avisa antes de mudar estes Termos.</p>', T, '/termos')

# ======================= FORNECEDORES =======================
F = [
('Lista de fornecedores', '''<div class="tabela"><table><thead><tr><th>Fornecedor</th><th>Para quê</th><th>País</th></tr></thead><tbody>
<tr><td>Supabase</td><td>Banco de dados e login</td><td>Dados guardados no Brasil; empresa nos Estados Unidos</td></tr>
<tr><td>Vercel</td><td>Hospedagem das páginas</td><td>Estados Unidos</td></tr>
<tr><td>Resend</td><td>Envio de e-mails da conta</td><td>Estados Unidos</td></tr>
<tr><td>Google</td><td>Login, só se você escolher entrar com a sua conta Google</td><td>Estados Unidos</td></tr>
<tr><td>ViaCEP</td><td>Preencher o endereço a partir do CEP (recebe só o CEP)</td><td>Brasil</td></tr>
<tr><td>Google Fonts e jsDelivr</td><td>Entrega de fontes e bibliotecas da tela (recebem só dados técnicos do navegador)</td><td>Estados Unidos</td></tr>
</tbody></table></div>
<p>Quando esta lista mudar, a data no topo será atualizada.</p>'''),
]
pagina('fornecedores.html', 'Fornecedores', 'CicloDev · Privacidade',
 '<p><b>Resumo:</b> estes são os serviços que a IT.IA usa para o CicloDev funcionar e o que cada um faz. Eles recebem só o necessário para a sua parte. Veja também a <a href="/privacidade">Política de Privacidade</a>.</p>', F, '/fornecedores')
print('ok')
