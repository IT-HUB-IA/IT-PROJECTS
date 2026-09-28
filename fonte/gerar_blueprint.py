"""Acrescenta a aba Blueprint ao Playbook (parte_playbook.html)."""
import html
def T(termo, expl):
    t = termo + ' (' + expl + ')'
    e = html.escape(t, quote=True)
    return html.escape(termo) + '<button class="info" type="button" data-info="%s" aria-label="O que é: %s">i</button>' % (e, e)

def caixa(x, y, w, h, titulo, linhas=(), cls=''):
    s = '<g class="bp-cx %s"><rect x="%d" y="%d" width="%d" height="%d"/>' % (cls, x, y, w, h)
    s += '<text x="%d" y="%d" class="bp-tt">%s</text>' % (x + 14, y + 24, html.escape(titulo))
    for k, l in enumerate(linhas):
        s += '<text x="%d" y="%d" class="bp-tx">%s</text>' % (x + 14, y + 46 + k * 18, html.escape(l))
    return s + '</g>'

def seta(pts, rot, lx, ly, cls='', anc='middle'):
    d = 'M' + ' L'.join('%d %d' % p for p in pts)
    return '<path d="%s" class="bp-seta %s" marker-end="url(#bp-ponta%s)"/><text x="%d" y="%d" class="bp-rot %s" text-anchor="%s">%s</text>' % (d, cls, '-v' if 'vermelha' in cls else '', lx, ly, cls, anc, html.escape(rot))

defs = '<defs><marker id="bp-ponta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker><marker id="bp-ponta-v" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#FF0000"/></marker></defs>'

# ---------- figura 1: quem fala com quem ----------
f1 = [defs]
f1.append(caixa(20, 40, 170, 60, 'Master', ['vê e muda tudo']))
f1.append(caixa(20, 130, 170, 60, 'Dev', ['onde participa']))
f1.append(caixa(20, 220, 170, 60, 'Stakeholder', ['só o visível']))
f1.append(caixa(270, 40, 250, 240, 'CicloDev (a tela)', ['Overview · Operações', 'Clients · Catalog · Costs', 'Service Desk · Team', 'Agent Studio · Playbook', 'Settings', '', 'Board, Table, Calendar...', 'leem o mesmo registro']))
f1.append(caixa(600, 40, 230, 110, 'Rotinas (RPC)', ['mover na estrutura', 'foco e cronômetro', 'converter pedido', 'cumprir etapa']))
f1.append(caixa(600, 170, 230, 110, 'Regras de acesso (RLS)', ['quem vê cada linha', 'Master · Dev · Stakeholder', 'anon não vê nada']))
f1.append('<g class="bp-banco"><rect x="900" y="20" width="280" height="440"/><text x="914" y="44" class="bp-tt">Banco tfcvoszeewmpghgxztuy</text></g>')
f1.append(caixa(916, 60, 248, 96, 'public', ['54 tabelas do produto', 'árvore + ancestrais', 'itens, custos, pedidos...'], 'forte'))
f1.append(caixa(916, 170, 248, 82, 'bi', ['todas as contas', 'painel, financeiro, carga']))
f1.append(caixa(916, 266, 248, 66, 'auditoria', ['quem fez o quê']))
f1.append(caixa(916, 346, 248, 50, 'storage: anexos', []))
f1.append(caixa(916, 406, 248, 44, 'pg_cron: a cada 10 min', []))
f1.append(caixa(270, 360, 250, 90, 'Agentes de IA', ['AI PO · atendimento · Billy', 'provedor ainda não ligado'], 'pendente'))
f1.append(caixa(600, 360, 230, 90, 'Kit CicloDev', ['nos sistemas dos clientes', 'painel · feedback · status'], 'pendente'))
# setas
f1.append(seta([(190, 70), (268, 70)], 'usa', 229, 62))
f1.append(seta([(190, 160), (268, 160)], 'usa', 229, 152))
f1.append(seta([(190, 250), (268, 250)], 'vê o painel', 229, 242))
f1.append(seta([(520, 95), (598, 95)], 'chama', 559, 87))
f1.append(seta([(520, 225), (598, 225)], 'lê e grava', 559, 217))
f1.append(seta([(830, 95), (914, 95)], 'grava', 872, 87, 'vermelha'))
f1.append(seta([(830, 225), (914, 120)], 'filtra', 838, 250, '', 'start'))
f1.append(seta([(1040, 156), (1040, 168)], '', 0, 0))
f1.append('<text x="1052" y="166" class="bp-rot" text-anchor="start">lê</text>')
f1.append(seta([(1172, 108), (1190, 108), (1190, 299), (1166, 299)], 'triggers', 1196, 210, '', 'start'))
f1.append(seta([(1164, 428), (1176, 428), (1176, 211), (1166, 211)], '', 0, 0))
f1.append(seta([(520, 405), (560, 405), (560, 250), (598, 250)], 'permissões', 548, 396, 'pendente', 'end'))
f1.append(seta([(830, 405), (870, 405), (870, 140), (914, 140)], 'pedidos e leitura', 874, 482, 'pendente'))
svg1 = '<svg class="bp-svg" viewBox="0 0 1260 490" role="img" aria-label="A tela chama rotinas e lê o banco através das regras de acesso; as contas ficam no schema bi, o registro de quem fez o quê na auditoria, e agentes de IA e o Kit CicloDev dependem de ligação externa.">' + ''.join(f1) + '</svg>'

# ---------- figura 2: caminho de um pedido ----------
etapas = [('Cliente', 'abre o pedido', 'Kit CicloDev ou Service Desk'), ('IA de atendimento', 'responde primeiro', 'dúvida resolve sozinha'), ('Equipe', 'responde', 'carimba o SLA'),
          ('converter_pedido', 'vira item', 'Bug ou Story no board'), ('Board', 'item anda', 'status muda'), ('Automação', 'dispara', 'avisa quem abriu')]
f2 = [defs]; w, gap, y = 175, 26, 30
for k, (t, a, b) in enumerate(etapas):
    x = 20 + k * (w + gap)
    f2.append(caixa(x, y, w, 88, t, [a, b], 'forte' if k in (3, 5) else ('pendente' if k == 1 else '')))
    if k:
        f2.append('<path d="M%d %d L%d %d" class="bp-seta %s" marker-end="url(#bp-ponta%s)"/>' % (x - gap, y + 44, x - 2, y + 44, 'vermelha' if k == 3 else '', '-v' if k == 3 else ''))
f2.append('<text x="%d" y="150" class="bp-rot" text-anchor="middle">pedidos · pedidos_mensagens · itens · notificacoes · automacoes_execucoes · auditoria.registros</text>' % (20 + (6 * w + 5 * gap) / 2))
svg2 = '<svg class="bp-svg" viewBox="0 0 1210 165" role="img" aria-label="O pedido do cliente passa pela IA de atendimento, pela equipe que responde e carimba o SLA, vira item pelo converter_pedido, anda no board e uma automação avisa quem abriu.">' + ''.join(f2) + '</svg>'

painel = ('      <div class="painel-aba" role="tabpanel" id="pn-blueprint" aria-labelledby="aba-blueprint" hidden>\n'
  '        <p class="intro">O ' + T('Blueprint', 'planta do sistema: o desenho de como as partes se ligam, para validar tudo junto antes de construir') + ' do CicloDev. Tracejado é o que já está desenhado mas depende de algo de fora para funcionar.</p>\n'
  '        <figure class="bp-fig">' + svg1 + '<figcaption>Quem fala com quem. A tela nunca escreve direto nas contas: ela chama as rotinas, grava no <code>public</code> passando pelas regras de acesso, e as contas saem do <code>bi</code>. Os gatilhos do banco escrevem a auditoria sozinhos, e a rotina agendada atualiza o ritmo a cada 10 minutos. O traço vermelho é a escrita de dados.</figcaption></figure>\n'
  '        <figure class="bp-fig">' + svg2 + '<figcaption>O caminho de um pedido do cliente até avisar quem pediu. A conversão em item é o ponto em que o pedido entra no trabalho do time (em vermelho); a resposta da IA depende do provedor de IA ser ligado.</figcaption></figure>\n'
  '      </div>\n')

p = 'parte_playbook.html'; s = open(p).read()
if 'id="aba-blueprint"' not in s:
    s = s.replace('<button class="aba" type="button" role="tab" id="aba-ficha"', '<button class="aba" type="button" role="tab" id="aba-blueprint" aria-controls="pn-blueprint" aria-selected="false">Blueprint</button>\n        <button class="aba" type="button" role="tab" id="aba-ficha"', 1)
else:
    i = s.index('      <div class="painel-aba" role="tabpanel" id="pn-blueprint"'); j = s.index('      </div>\n', i) + len('      </div>\n'); s = s[:i] + s[j:]
k = s.rindex('    </section>')
s = s[:k] + painel + s[k:]
open(p, 'w').write(s); print('blueprint ok')
