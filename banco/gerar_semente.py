"""Gera 08_semente.sql a partir dos dados de exemplo do sistema (dados.json).
Os ids antigos (cl_bl, is_12...) viram uuid fixos, calculados sempre do mesmo jeito,
para a semente poder ser rodada de novo sem criar duplicado."""
import json, uuid, datetime, sys, os

AQUI = os.path.dirname(os.path.abspath(__file__))
D = json.load(open(os.path.join(AQUI, '..', 'dados.json')))
NS = uuid.UUID('6f1c7d2e-9a4b-4c3d-8e5f-1a2b3c4d5e6f')
U = lambda k: str(uuid.uuid5(NS, 'itia:' + k))
HOJE = datetime.date.today()

def q(v):
    if v is None or v == '':
        return 'null'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, (list, tuple)):
        return "array[" + ",".join(q(x) for x in v) + "]::text[]" if v else "'{}'::text[]"
    if isinstance(v, dict):
        return "'" + json.dumps(v, ensure_ascii=False).replace("'", "''") + "'::jsonb"
    return "'" + str(v).replace("'", "''") + "'"

out = []
w = out.append
def ins(tabela, linhas, conflito='do nothing'):
    if not linhas:
        return
    cols = list(linhas[0].keys())
    w('insert into %s (%s) values' % (tabela, ', '.join(cols)))
    w(',\n'.join('  (' + ', '.join(q(l[c]) for c in cols) + ')' for l in linhas))
    w('on conflict %s;\n' % conflito if conflito.startswith('(') or conflito.startswith('on') else 'on conflict %s;\n' % conflito)

ST = {'active': 'ativo', 'on_hold': 'pausado', 'done': 'concluido', 'archived': 'arquivado'}

w('-- =====================================================================')
w('-- Sistema IT.IA · 08 · Semente: os dados de exemplo que o sistema já mostra (gerado por gerar_semente.py)')
w('-- Pode rodar de novo: nada duplica. As datas relativas foram calculadas em %s.' % HOJE.isoformat())
w('-- =====================================================================')
w('begin;')
w("-- a semente não entra no registro de auditoria (o histórico de exemplo é carregado no fim)")
w("alter table public.nos disable trigger nos_auditoria;")
w("alter table public.itens disable trigger itens_auditoria;")
w("alter table public.itens disable trigger itens_automacoes;")
w("alter table public.comentarios disable trigger comentarios_auditoria;")
for t in ['pedidos', 'custos_tecnicos', 'receitas', 'regras_calculo', 'pessoas_custos', 'servicos', 'agentes', 'marcos', 'sprints', 'automacoes']:
    w("alter table public.%s disable trigger %s_auditoria;" % (t, t))
w('')

# ---------- pessoas ----------
PAPEL = {'owner': 'master', 'dev': 'dev', 'stakeholder': 'stakeholder'}
ins('public.pessoas', [dict(id=U(p['id']), nome=p['nome'], funcao=p.get('funcao'), habilidades=p.get('skills', []),
                            capacidade_h=p.get('cap', 0), papel=PAPEL[p['acesso']]) for p in D['people']], '(id) do nothing')

# ---------- estrutura (ordem: pai antes do filho) ----------
nos = []
for c in D['clients']:
    nos.append(dict(id=U(c['id']), tipo='cliente', pai_id=None, nome=c['nome'], status=ST[c['status']], motivo_pausa=c.get('motivo') or None, ordem=0))
for i, p in enumerate(D['projects']):
    nos.append(dict(id=U(p['id']), tipo='projeto', pai_id=U(p['client']), nome=p['nome'], status=ST[p['status']], motivo_pausa=p.get('motivo') or None, ordem=i))
for i, p in enumerate(D['products']):
    nos.append(dict(id=U(p['id']), tipo='produto', pai_id=U(p['project']), nome=p['nome'], status=ST[p['status']], motivo_pausa=p.get('motivo') or None, ordem=i))
for i, a in enumerate(D['apps']):
    nos.append(dict(id=U(a['id']), tipo='aplicacao', pai_id=U(a['product'] or a['project']), nome=a['nome'], status=ST[a['status']], motivo_pausa=a.get('motivo') or None, ordem=i))
for i, s in enumerate(D['ws']):
    nos.append(dict(id=U(s['id']), tipo='frente', pai_id=U(s['app']), nome=s['nome'], status=ST[s['status']], motivo_pausa=s.get('motivo') or None, ordem=i))
ins('public.nos', nos, '(id) do nothing')

ins('public.clientes', [dict(no_id=U(c['id']), tipo_cliente=c['tipo'], documento=c.get('doc') or None,
                             holding_id=U(c['holding']) if c.get('holding') else None) for c in D['clients']], '(no_id) do nothing')
ins('public.projetos', [dict(no_id=U(p['id']), origem=p.get('origem', 'greenfield'), inicio=p.get('inicio'), alvo=p.get('alvo')) for p in D['projects']], '(no_id) do nothing')
ins('public.aplicacoes', [dict(no_id=U(a['id']), plataforma=a.get('plataforma', 'web'), origem_codigo=a.get('origemCodigo') or 'proprio',
                               servico_id=None) for a in D['apps']], '(no_id) do nothing')
ins('public.frentes', [dict(no_id=U(s['id']), wip_limite=s.get('wip')) for s in D['ws']], '(no_id) do nothing')

# quem participa de onde
part = []
for p in D['people']:
    if p['acesso'] == 'owner':
        part += [dict(pessoa_id=U(p['id']), no_id=U(c['id']), papel='owner') for c in D['clients']]
    elif p['acesso'] == 'dev':
        part += [dict(pessoa_id=U(p['id']), no_id=U(pj['id']), papel='dev') for pj in D['projects']]
    else:
        alvo = (p.get('escopo') or 'project:pj_bl').split(':')[1]
        part.append(dict(pessoa_id=U(p['id']), no_id=U(alvo), papel='stakeholder'))
ins('public.participacoes', part, '(pessoa_id, no_id) do nothing')

# ---------- etiquetas ----------
ins('public.etiquetas', [dict(id=U(t['id']), nome=t['nome'], cor=t['cor'], categoria=t.get('cat'), descricao=t.get('desc') or None) for t in D['tags']], '(id) do nothing')
ins('public.etiquetas_nos', [dict(etiqueta_id=U(l['tag']), no_id=U(l['id'])) for l in D['tagLinks']], '(no_id, etiqueta_id) do nothing')

# ---------- status padrão ----------
STATUS = [('backlog', 'Backlog', 'na fila, ainda não planejado', '#A6A6AD'), ('todo', 'To Do', 'a fazer', '#3355E0'),
          ('doing', 'In Progress', 'em andamento', '#E08600'), ('review', 'In Review', 'em revisão', '#6D4AFF'),
          ('blocked', 'Blocked', 'bloqueado, esperando algo', '#FF0000'), ('done', 'Done', 'concluído', '#0E8A55')]
ins('public.status_fluxo', [dict(id=U('st_' + k), no_id=None, chave=k, nome=n, explicacao=e, cor=c, grupo=k, ordem=i)
                            for i, (k, n, e, c) in enumerate(STATUS)], '(id) do nothing')
ins('public.status_fluxo', [dict(id=U(c['id']), no_id=U(c['no'].split(':')[1]), chave=c['id'], nome=c['nome'], explicacao=None, cor=c['cor'], grupo=c['grupo'], ordem=10 + k)
                            for k, c in enumerate(D.get('statusCustom', []))], '(id) do nothing')

# ---------- catálogo e comercial ----------
REQ = list(D['baseline'].keys())
ins('public.requisitos', [dict(id=U('rq_' + n), nome=n, padrao=bool(D['baseline'][n]), ordem=i) for i, n in enumerate(REQ)], '(id) do nothing')
MOD = {'fixo': 'fixo', 'hora': 'hora', 'marco': 'marco', 'setup': 'implantacao', 'mensal': 'mensalidade', 'banco': 'banco_horas',
       'usuario': 'usuario', 'faixa': 'faixas', 'uso': 'uso', 'valor': 'valor', 'sucesso': 'sucesso', 'manutencao': 'manutencao', 'repasse': 'repasse'}
ins('public.servicos', [dict(id=U(s['id']), codigo=s['id'], categoria=s['cat'], nome=s['nome'], descricao=s.get('desc'),
                             entregaveis=s.get('entrega', []), frentes_padrao=s.get('frentes', []), horas_min=s['horas'][0], horas_max=s['horas'][1],
                             sla=s.get('sla') or None, checklist_inicio=s.get('check', []), ativo=s.get('ativo', True)) for s in D['catalog']], '(id) do nothing')
cob = []
for s in D['catalog']:
    for i, c in enumerate(s['preco']):
        cob.append(dict(id=U(s['id'] + ':' + c['m']), servico_id=U(s['id']), modelo=MOD[c['m']], parametros={k: v for k, v in c.items() if k != 'm'}, ordem=i))
ins('public.servicos_cobranca', cob, '(id) do nothing')
for a in D['apps']:
    if a.get('servico'):
        w("update public.aplicacoes set servico_id = %s where no_id = %s and servico_id is null;" % (q(U(a['servico'])), q(U(a['id']))))
w('')
ins('public.servicos_requisitos', [dict(servico_id=U(s['id']), requisito_id=U('rq_' + r)) for s in D['catalog'] for r in s.get('req', []) if r in D['baseline']],
    '(servico_id, requisito_id) do nothing')

R = D['regras']; E = R['encargos']
ins('public.regras_calculo', [dict(vigente_desde='2025-01-01', regime=R['regime'], aliq_simples=R['impostos']['simples'], aliq_presumido=R['impostos']['presumido'],
    aliq_real=R['impostos']['real'], inss_patronal=E['inss'], rat=E['rat'], terceiros=E['terceiros'], fgts=E['fgts'], ferias=E['ferias'],
    terco_ferias=E['terco'], decimo_terceiro=E['decimo'], multa_fgts=E['multaFgts'], horas_mes=R['horasMes'], faturavel_pct=R['faturavel'],
    margem_pct=R['margem'], contingencia_pct=R['risco'], folga_rateio_pct=R.get('reservaOverhead', 0), manutencao_pct=R['manutencaoAnual'],
    cambio_usd=R['cambio'], complexidade=R['complexidade'], urgencia=R['urgencia'])], '(vigente_desde) do nothing')

VINC = {'CLT': 'clt', 'PJ': 'pj', 'Estágio': 'estagio', 'Sócio': 'socio'}
ins('public.pessoas_custos', [dict(id=U(p['id'] + ':custo'), pessoa_id=U(p['id']), vinculo=VINC[p['custo']['vinculo']], salario=p['custo'].get('salario', 0) or 0,
    prolabore=p['custo'].get('prolabore', 0) or 0, valor_pj=p['custo'].get('valorPJ', 0) or 0, beneficios=p['custo'].get('beneficios', 0) or 0,
    vigente_desde='2025-01-01') for p in D['people'] if p.get('custo')], '(id) do nothing')

REC = {'Mensal': 'mensal', 'Anual': 'anual', 'Único': 'unico', 'Depreciação': 'depreciacao', 'Por uso': 'uso'}
ins('public.custos_operacao', [dict(id=U(o['id']), nome=o['nome'], categoria=o['cat'], valor=o['valor'], moeda=o.get('moeda', 'BRL'),
    recorrencia=REC[o['rec']], meses_depreciacao=o.get('meses') if o['rec'] == 'Depreciação' else None, inicio='2025-01-01') for o in D['opCustos']], '(id) do nothing')

def primeiro_mes(off):
    y, m = HOJE.year, HOJE.month + off
    while m <= 0:
        m += 12; y -= 1
    while m > 12:
        m -= 12; y += 1
    return datetime.date(y, m, 1)

ct, uso = [], []
for c in D['custos']:
    u = c.get('uso') or {}
    rec = REC[c['rec']]
    valor = c['valor'] if rec != 'uso' else 1
    ct.append(dict(id=U(c['id']), no_id=U(c['app']) if c.get('app') else U(c['cliente']), fornecedor=c['fornecedor'], categoria=c['cat'],
                   descricao=c.get('desc'), recorrencia=rec, moeda=c.get('moeda', 'BRL'), valor=valor, unidade=u.get('unidade'),
                   limite=u.get('limite'), plano=u.get('plano'), proximo_plano=(u.get('prox') or {}).get('nome'),
                   proximo_valor=(u.get('prox') or {}).get('valor') or None, extra_por_unidade=(u.get('prox') or {}).get('extraUnidade'),
                   repasse=bool(c.get('repasse')), taxa_repasse_pct=c.get('markup', 0) or 0,
                   inicio=c.get('inicio') or primeiro_mes(-(len(u.get('hist', [])) or 6) + 1).isoformat()))
    h = u.get('hist') or []
    for k, qv in enumerate(h):
        uso.append(dict(custo_id=U(c['id']), mes=primeiro_mes(k - len(h) + 1).isoformat(), quantidade=qv))
ins('public.custos_tecnicos', ct, '(id) do nothing')
ins('public.custos_uso', uso, '(custo_id, mes) do nothing')

FORMA = {'Mensal': 'mensal', 'Único': 'unica', 'Parcelado': 'parcelada'}
RMOD = dict(MOD); RMOD['mensal'] = 'mensalidade'
ins('public.receitas', [dict(id=U(r['id']), no_id=U(r['app']) if r.get('app') else U(r['project']), servico_id=U(r['servico']) if r.get('servico') else None,
    descricao=r['desc'], modelo=RMOD.get(r['modelo'], r['modelo']), valor=r['valor'], moeda='BRL', forma=FORMA[r['rec']],
    parcelas=r.get('parcelas') if r['rec'] == 'Parcelado' else None, inicio=r['inicio'], fim=r.get('fim')) for r in D['receitas']], '(id) do nothing')

# SLA de cada cliente, sprints, marcos e automações: vêm dos dados da tela
ins('public.slas', [dict(no_id=U(c['id']), gravidade=g, horas_resposta=v[0], horas_solucao=max(v[1], v[0]))
                    for c in D['clients'] for g, v in (c.get('sla') or {}).items()], '(no_id, gravidade) do nothing')
SPST = {'planejado': 'planejado', 'ativo': 'ativo', 'encerrado': 'encerrado'}
ins('public.sprints', [dict(id=U(x['id']), projeto_id=U(x['project']), nome=x['nome'], meta=x.get('meta') or None, inicio=x['ini'], fim=x['fim'], status=SPST[x['status']])
                       for x in D.get('sprints', [])], '(id) do nothing')
ins('public.marcos', [dict(id=U(m['id']), no_id=U(m['no'].split(':')[1]), tipo=m['tipo'], nome=m['nome'], descricao=m.get('desc') or None, data=m['data'],
                           visivel_cliente=bool(m.get('vis', True)), entregue_em=m.get('entregue')) for m in D.get('marcos', [])], '(id) do nothing')
def param_auto(a):
    p = dict(a.get('param') or {})
    r = {}
    if p.get('para'): r['para'] = p['para']
    if p.get('titulo'): r['titulo'] = p['titulo']
    if p.get('texto'): r['texto'] = p['texto']
    if p.get('pessoa'): r['pessoa_id'] = U(p['pessoa'])
    if p.get('prio'): r['prioridade'] = p['prio']
    if p.get('status'): r['status'] = p['status']
    if p.get('cliente'): r['visivel_cliente'] = True
    return r
def cond_auto(a):
    c = a.get('cond') or {}
    return {k2: c[k1] for k1, k2 in (('tipo', 'tipo'), ('grupo', 'grupo'), ('prio', 'prioridade')) if c.get(k1)}
ins('public.automacoes', [dict(id=U(a['id']), no_id=U(a['no'].split(':')[1]), nome=a['nome'], gatilho=a['gatilho'], condicao=cond_auto(a), acao=a['acao'],
                               parametros=param_auto(a), ativa=bool(a.get('ativa', True)), criado_por=U('pe_w')) for a in D.get('automacoes', [])], '(id) do nothing')
# campos personalizados dos itens
ins('public.campos_personalizados', [dict(id=U(c['id']), no_id=U(c['no'].split(':')[1]), nome=c['nome'], tipo=c['tipo'], opcoes=c.get('opcoes') or [], ordem=k)
                                     for k, c in enumerate(D.get('camposItem', []))], '(id) do nothing')

# ---------- itens ----------
TIPO = {'epic': 'epic', 'story': 'story', 'task': 'task', 'subtask': 'subtask', 'bug': 'bug'}
itens = sorted(D['issues'], key=lambda i: (i.get('pai') is not None, i['id']))
linhas = []
for i in itens:
    feito = i.get('feito')
    st = U(i['st']) if i.get('st') else U('st_' + i['status'])
    ini_trab = i.get('iniciado')
    linhas.append(dict(id=U(i['id']), frente_id=U(i['ws']), pai_id=U(i['pai']) if i.get('pai') else None, tipo=TIPO[i['tipo']], titulo=i['titulo'],
        descricao=i.get('desc') or None, status_id=st, prioridade=i['prio'], responsavel_id=U(i['resp']) if i.get('resp') else None,
        relator_id=U(i['rep']) if i.get('rep') else None, estimativa_h=i.get('est'), pontos=i.get('pontos'), inicio=i.get('ini'), prazo=i.get('fim'), data_prevista=i.get('alvo'),
        visivel_cliente=i.get('vis') == 'cliente', sprint_id=U(i['sprint']) if i.get('sprint') else None, marco_id=U(i['marco']) if i.get('marco') else None,
        criado_em=(i.get('criado') or HOJE.isoformat()) + 'T12:00:00-03:00', iniciado_em=(ini_trab + 'T09:00:00-03:00') if ini_trab else None,
        concluido_em=(feito + 'T17:00:00-03:00') if feito else None))
ins('public.itens', linhas, '(id) do nothing')

chk, lig, com, blo, anx = [], [], [], [], []
for i in D['issues']:
    for k, c in enumerate(i.get('check', [])):
        chk.append(dict(id=U(i['id'] + ':ck:' + str(k)), item_id=U(i['id']), texto=c['t'], feito=bool(c.get('f')), ordem=k))
    for l in i.get('links', []):
        a, b = U(i['id']), U(l['alvo'])
        if l['tipo'] == 'Is blocked by':
            a, b = b, a
        lig.append(dict(origem_id=a, destino_id=b, tipo={'Blocks': 'bloqueia', 'Is blocked by': 'bloqueia', 'Relates to': 'relacionado', 'Duplicates': 'duplica'}[l['tipo']]))
    for k, c in enumerate(i.get('coments', [])):
        com.append(dict(id=U(i['id'] + ':cm:' + str(k)), item_id=U(i['id']), autor_id=U(c['quem']), texto=c['txt'], visivel_cliente=bool(c.get('cliente')),
                        criado_em=c['quando'] + 'T10:00:00-03:00'))
    b = i.get('bloco')
    if b and i.get('resp'):
        blo.append(dict(id=U(i['id'] + ':bl'), item_id=U(i['id']), pessoa_id=U(i['resp']), inicio=b['data'] + 'T' + b['ini'] + ':00-03:00', fim=b['data'] + 'T' + b['fim'] + ':00-03:00'))
    for k, r in enumerate(i.get('refs', [])):
        tipo = {'link': 'link', 'imagem': 'imagem', 'áudio': 'audio', 'audio': 'audio', 'vídeo': 'video', 'video': 'video'}.get(r.get('tipo'), 'documento')
        anx.append(dict(id=U(i['id'] + ':rf:' + str(k)), nome=r['nome'], tipo=tipo, tamanho_bytes=r.get('tam'), storage_path=None if tipo == 'link' else 'exemplo/' + r['nome'],
                        url=r.get('url') if tipo == 'link' else None, item_id=U(i['id']), enviado_por=U('pe_w')))
ins('public.itens_campos', [dict(item_id=U(i['id']), campo_id=U(k), valor=str(v)) for i in D['issues'] for k, v in (i.get('cf') or {}).items() if v not in (None, '')],
    '(item_id, campo_id) do nothing')
ins('public.itens_checklist', chk, '(id) do nothing')
ins('public.itens_ligacoes', lig, '(origem_id, destino_id, tipo) do nothing')
ins('public.comentarios', com, '(id) do nothing')
ins('public.blocos_agenda', blo, '(id) do nothing')

# ---------- ficha técnica ----------
fc = []
for chave, s in D['sheets'].items():
    no = U(chave.split(':')[1])
    for k, v in s.get('campos', {}).items():
        sec, campo = k.split('|', 1)
        fc.append(dict(no_id=no, secao=sec, campo=campo, valor=v, personalizado=False))
    for c in s.get('custom', []):
        fc.append(dict(no_id=no, secao='Custom fields', campo=c['nome'], valor=c.get('valor', ''), personalizado=True))
ins('public.ficha_campos', fc, '(no_id, secao, campo) do nothing')

# ---------- etapas ----------
MODO = {'Aviso': 'aviso', 'Trava': 'trava', 'Desligado': 'desligado'}
PROVA = {'Nenhuma': 'nenhuma', 'Captura de tela': 'captura', 'Arquivo': 'arquivo', 'Link': 'link', 'Texto': 'texto', 'Aprovação de alguém': 'aprovacao'}
QUEM = {'Responsável da etapa': 'responsavel_etapa', 'Qualquer pessoa do time': 'qualquer_um'}
ins('public.etapas_modelo', [dict(id=U(e['id']), chave=e['id'], nome=e['nome'], explicacao=e.get('expl'), lente=e.get('lente'), entrega=e.get('entrega'), ordem=k)
                             for k, e in enumerate(D['template'])], '(id) do nothing')
ins('public.etapas_modelo_itens', [dict(id=U(it['id']), etapa_id=U(e['id']), texto=it['texto'], modo=MODO.get(it.get('modo'), 'aviso'), obrigatorio=bool(it.get('obrig', True)),
                                        prova_tipo=PROVA.get(it.get('prova'), 'nenhuma'), quem_cumpre=QUEM.get(it.get('quem'), 'qualquer_um'), so_terceiros=bool(it.get('terceiros')), ordem=k)
                                   for e in D['template'] for k, it in enumerate(e['itens'])], '(id) do nothing')
en, pv = [], []
for chave, itens_st in D['stages'].items():
    no = U(chave.split(':')[1])
    for iid, st in itens_st.items():
        if not (st.get('feito') or st.get('dispensa')):
            continue
        disp = bool(st.get('dispensa'))
        en.append(dict(no_id=no, item_modelo_id=U(iid), situacao='dispensado' if disp else 'cumprido', cumprido_por=U(st.get('quem', 'pe_w')),
                       cumprido_em=(st.get('quando') or HOJE.isoformat()) + 'T12:00:00-03:00', motivo_dispensa=st.get('dispensa') if disp else None))
        p = st.get('prova')
        if p and p.get('valor') and PROVA.get(p.get('tipo')) not in (None, 'nenhuma'):
            pv.append(dict(id=U(chave + iid + ':pv'), no_id=no, item_modelo_id=U(iid), tipo=PROVA[p['tipo']], valor=p['valor'], enviado_por=U(st.get('quem', 'pe_w'))))
ins('public.etapas_nos', en, '(no_id, item_modelo_id) do nothing')
ins('public.provas', pv, '(id) do nothing')

# ---------- agentes ----------
PERM = {'Livre': 'livre', 'Automática': 'automatica', 'Com confirmação': 'confirmacao', 'Bloqueada': 'bloqueada'}
ins('public.agentes', [dict(id=U(a['id']), codigo=a['id'], nome=a['nome'], papel=a.get('papel'), instrucoes=a.get('instr', ''), regras_passagem=a.get('passa')) for a in D['agents']], '(id) do nothing')
ins('public.agentes_fontes', [dict(id=U(a['id'] + ':f:' + f), agente_id=U(a['id']), nome=f) for a in D['agents'] for f in a.get('fontes', [])], '(id) do nothing')
ins('public.agentes_ferramentas', [dict(agente_id=U(a['id']), ferramenta=f, permissao=PERM[p]) for a in D['agents'] for f, p in a.get('ferramentas', [])],
    '(agente_id, ferramenta) do nothing')

# ---------- service desk ----------
PT = {'Bug report': 'bug', 'Fix request': 'correcao', 'Change request': 'mudanca', 'Feature request': 'funcionalidade', 'Question': 'duvida'}
GR = {'Sistema parado': 'parado', 'Função quebrada': 'quebrada', 'Incômodo': 'incomodo', 'Cosmético': 'cosmetico'}
PS = {'Em triagem': 'novo', 'IA conversando': 'ia_conversando', 'Aguardando você': 'aguardando_voce', 'Virou item': 'virou_item',
      'Resolvido pela IA': 'resolvido', 'Resolvido': 'resolvido', 'Recusado': 'recusado'}
ped, msg = [], []
agente_at = next((a['id'] for a in D['agents'] if 'atendimento' in a['nome'].lower()), D['agents'][0]['id'])
for r in D['requests']:
    stt = PS.get(r['status'], 'novo')
    quando = r['quando'] + 'T09:00:00-03:00'
    ped.append(dict(id=U(r['id']), no_id=U(r['app']), autor_id=U(r['autor']) if r.get('autor') else None, tipo=PT[r['tipo']], gravidade=GR.get(r['grav'], 'incomodo'),
                    status=stt, titulo=r['titulo'], contexto={'resumo': r.get('contexto', '')}, item_id=U(r['issue']) if r.get('issue') else None,
                    criado_em=quando, resolvido_em=quando if stt in ('resolvido', 'recusado') else None))
    for k, m in enumerate(r.get('msgs', [])):
        de = {'cliente': 'cliente', 'ia': 'ia', 'voce': 'equipe'}.get(m['de'], 'equipe')
        msg.append(dict(id=U(r['id'] + ':m:' + str(k)), pedido_id=U(r['id']), autor_tipo=de,
                        pessoa_id=U(r['autor']) if de == 'cliente' and r.get('autor') else (U('pe_w') if de == 'equipe' else None),
                        agente_id=U(agente_at) if de == 'ia' else None, texto=m['txt'],
                        criado_em=(datetime.datetime.fromisoformat(r['quando'] + 'T09:00:00-03:00') + datetime.timedelta(minutes=3 * k + 1)).isoformat()))
    for k, a in enumerate(r.get('anexos', [])):
        tipo = {'imagem': 'imagem', 'áudio': 'audio', 'vídeo': 'video'}.get(a.get('tipo'), 'documento')
        anx.append(dict(id=U(r['id'] + ':ax:' + str(k)), nome=a['nome'], tipo=tipo, tamanho_bytes=None, storage_path='exemplo/' + a['nome'], url=None,
                        item_id=None, enviado_por=U(r['autor']) if r.get('autor') else None, pedido_id=U(r['id'])))
ins('public.pedidos', ped, '(id) do nothing')
ins('public.pedidos_mensagens', msg, '(id) do nothing')
for a in anx:
    a.setdefault('pedido_id', None)
ins('public.anexos', anx, '(id) do nothing')

# ---------- histórico de exemplo das mudanças recentes ----------
EV = {'criou': ('I', None), 'status': ('U', 'status_id'), 'concluiu': ('U', 'status_id'), 'prazo': ('U', 'prazo'), 'comentou': ('U', 'comentario')}
reg = []
for e in D['eventos']:
    if not e.get('item'):
        continue
    acao, campo = EV.get(e['tipo'], ('U', 'titulo'))
    em = datetime.datetime.fromtimestamp(e['quando'] / 1000, datetime.timezone.utc).isoformat()
    reg.append("  ('itens', %s, '%s', %s, %s, %s)" % (q(U(e['item'])), acao, q(dict(({campo: [None, None]} if campo else {'titulo': e.get('txt')}), semente=True)),
                                                     q(U(e['quem'])) if e.get('quem') else 'null', q(em)))
w("delete from auditoria.registros where tabela = 'itens' and mudancas ? 'semente';")
if reg:
    w('insert into auditoria.registros (tabela, registro_id, acao, mudancas, pessoa_id, em) values')
    w(',\n'.join(reg) + ';\n')

w("alter table public.nos enable trigger nos_auditoria;")
w("alter table public.itens enable trigger itens_auditoria;")
w("alter table public.itens enable trigger itens_automacoes;")
w("alter table public.comentarios enable trigger comentarios_auditoria;")
for t in ['pedidos', 'custos_tecnicos', 'receitas', 'regras_calculo', 'pessoas_custos', 'servicos', 'agentes', 'marcos', 'sprints', 'automacoes']:
    w("alter table public.%s enable trigger %s_auditoria;" % (t, t))
w('commit;')
w('')
w("select bi.atualizar();")

open(os.path.join(AQUI, '08_semente.sql'), 'w').write('\n'.join(out) + '\n')
print('ok', len(out), 'linhas')
