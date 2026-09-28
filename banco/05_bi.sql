-- =====================================================================
-- CicloDev · 05 · BI: toda conta do sistema mora aqui, num lugar só
-- Critério de desempenho:
--   * o que é pequeno e muda toda hora (custos, receitas, painel) é calculado na hora, com índice;
--   * o que é histórico e cresce sem parar (ritmo semanal dos itens) fica numa visão materializada
--     com índice único, atualizada sem travar leitura (refresh concurrently) pela rotina bi.atualizar().
-- =====================================================================

-- dia de hoje no fuso de Brasília (o banco guarda em UTC)
create or replace function bi.hoje() returns date
language sql stable set search_path = public, pg_temp as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

create or replace function bi.mes_atual() returns date
language sql stable set search_path = public, pg_temp as $$ select date_trunc('month', bi.hoje())::date $$;

-- regra de cálculo vigente
create or replace function bi.regras() returns public.regras_calculo
language sql stable security definer set search_path = public, pg_temp as $$
  select * from public.regras_calculo where vigente_desde <= bi.hoje() order by vigente_desde desc limit 1
$$;

create or replace function bi.aliquota() returns numeric
language sql stable set search_path = public, pg_temp as $$
  select case r.regime when 'simples' then r.aliq_simples when 'presumido' then r.aliq_presumido else r.aliq_real end
    from bi.regras() r
$$;

-- câmbio: o do dia (ou o último antes dele); sem registro, o dólar da regra vigente
create or replace function bi.cambio(p_moeda char(3), p_dia date) returns numeric
language sql stable security definer set search_path = public, pg_temp as $$
  select case when p_moeda = 'BRL' then 1::numeric else coalesce(
    (select c.valor from public.cambio c where c.moeda = p_moeda and c.dia <= p_dia order by c.dia desc limit 1),
    case when p_moeda = 'USD' then (bi.regras()).cambio_usd end) end
$$;

-- =====================================================================
-- EQUIPE: custo mensal de cada pessoa pela regra vigente (CLT, PJ, estágio, sócio)
-- =====================================================================
create or replace view bi.custo_pessoas as
with vig as (
  select distinct on (pc.pessoa_id) pc.*
    from public.pessoas_custos pc
   where pc.vigente_desde <= bi.hoje()
   order by pc.pessoa_id, pc.vigente_desde desc
), r as (select * from bi.regras())
select p.id as pessoa_id, p.nome, v.vinculo, p.capacidade_h,
       c.salario_base, c.provisoes, c.fgts, c.inss, c.multa_fgts, v.beneficios,
       round(c.salario_base + c.provisoes + c.fgts + c.inss + c.multa_fgts + v.beneficios, 2) as total_mes,
       round(p.capacidade_h * 4.33 * r.faturavel_pct / 100, 2) as horas_faturaveis_mes,
       round((c.salario_base + c.provisoes + c.fgts + c.inss + c.multa_fgts + v.beneficios)
             / nullif(p.capacidade_h * 4.33 * r.faturavel_pct / 100, 0), 2) as custo_hora
  from vig v
  join public.pessoas p on p.id = v.pessoa_id and p.ativo
  cross join r
  cross join lateral (
    select
      case v.vinculo when 'clt' then v.salario when 'pj' then v.valor_pj when 'estagio' then v.salario else v.prolabore end as salario_base,
      case when v.vinculo = 'clt' then v.salario * (r.ferias + r.terco_ferias + r.decimo_terceiro) / 100 else 0 end as provisoes,
      case when v.vinculo = 'clt' then v.salario * (1 + (r.ferias + r.terco_ferias + r.decimo_terceiro) / 100) * r.fgts / 100 else 0 end as fgts,
      case when r.regime = 'simples' then 0
           when v.vinculo = 'clt' then v.salario * (1 + (r.ferias + r.terco_ferias + r.decimo_terceiro) / 100) * (r.inss_patronal + r.rat + r.terceiros) / 100
           when v.vinculo = 'socio' then v.prolabore * 0.20
           else 0 end as inss,
      case when v.vinculo = 'clt' then v.salario * r.multa_fgts / 100 else 0 end as multa_fgts
  ) c;
comment on view bi.custo_pessoas is 'Custo mensal e custo hora de cada pessoa. No Simples, o INSS patronal vai no DAS e não entra aqui.';

-- operação interna em valor mensal equivalente (anual/12, depreciação/meses, único fora da conta mensal)
create or replace view bi.operacao_mensal as
select o.*,
       round(case o.recorrencia when 'mensal' then o.valor when 'anual' then o.valor / 12
                                when 'depreciacao' then o.valor / o.meses_depreciacao else 0 end
             * bi.cambio(o.moeda, bi.hoje()), 2) as mensal_brl
  from public.custos_operacao o
 where o.inicio <= bi.hoje() and (o.fim is null or o.fim >= bi.hoje());

-- os números que formam o preço da hora
create or replace view bi.parametros_preco as
with eq as (select coalesce(sum(total_mes), 0) as custo_equipe, coalesce(sum(horas_faturaveis_mes), 0) as horas from bi.custo_pessoas),
     op as (select coalesce(sum(mensal_brl), 0) as overhead from bi.operacao_mensal),
     r as (select * from bi.regras())
select eq.custo_equipe, eq.horas as horas_faturaveis, op.overhead,
       round(eq.custo_equipe / nullif(eq.horas, 0), 2) as custo_hora_medio,
       round(op.overhead * (1 + r.folga_rateio_pct / 100) / nullif(eq.horas, 0), 2) as rateio_hora,
       bi.aliquota() as aliquota, r.margem_pct, r.contingencia_pct,
       round((eq.custo_equipe + op.overhead * (1 + r.folga_rateio_pct / 100)) / nullif(eq.horas, 0)
             * (1 + r.contingencia_pct / 100) / greatest(1 - (bi.aliquota() + r.margem_pct) / 100, 0.05), 2) as preco_hora
  from eq, op, r;

-- a calculadora do Catalog: (equipe + rateio) × (1 + contingência) ÷ (1 − impostos − margem) × urgência
create or replace function bi.calcular_preco(p_horas numeric, p_complexidade text default 'Média', p_urgencia text default 'Normal')
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  with ok as (select interno.eh_master() as m),
       p as (select * from bi.parametros_preco where (select m from ok)),
       r as (select * from bi.regras()),
       k as (select coalesce((r.complexidade->>p_complexidade)::numeric, 1) as kc,
                    coalesce((r.urgencia->>p_urgencia)::numeric, 1) as ku from r),
       c as (select p_horas * k.kc as horas, p_horas * k.kc * p.custo_hora_medio as equipe,
                    p_horas * k.kc * p.rateio_hora as rateio, k.ku, p.aliquota, p.margem_pct, p.contingencia_pct from p, k),
       f as (select c.*, (c.equipe + c.rateio) * c.contingencia_pct / 100 as contingencia,
                    (c.equipe + c.rateio) * (1 + c.contingencia_pct / 100)
                      / greatest(1 - (c.aliquota + c.margem_pct) / 100, 0.05) * c.ku as preco from c)
  select jsonb_build_object(
    'horas', round(horas, 1), 'equipe', round(equipe, 2), 'rateio', round(rateio, 2), 'contingencia', round(contingencia, 2),
    'impostos', round(preco * aliquota / 100, 2), 'margem', round(preco * margem_pct / 100, 2),
    'acrescimo_urgencia', round(preco - preco / ku, 2), 'preco', round(preco, 2))
  from f
$$;

-- =====================================================================
-- CUSTOS E RECEITAS MÊS A MÊS (36 meses para trás e 12 para frente)
-- =====================================================================
create or replace view bi.meses as
select m::date as mes, (m::date > bi.mes_atual()) as previsto
  from generate_series(bi.mes_atual() - interval '36 months', bi.mes_atual() + interval '12 months', interval '1 month') m;

-- tendência de uso de cada custo (Forecast): inclinação dos últimos 6 meses registrados
create or replace view bi.custos_tendencia as
select u.custo_id,
       (array_agg(u.quantidade order by u.mes desc))[1] as ultima_quantidade,
       max(u.mes) as ultimo_mes,
       min(u.mes) as primeiro_mes,
       (array_agg(u.quantidade order by u.mes asc))[1] as primeira_quantidade,
       coalesce(regr_slope(u.quantidade, extract(epoch from u.mes) / 2629800.0), 0)::numeric as inclinacao_mes
  from (select *, row_number() over (partition by custo_id order by mes desc) as rn from public.custos_uso) u
 where u.rn <= 6
 group by u.custo_id;

create or replace view bi.custos_mensais as
with base as (
  select c.*, date_trunc('month', c.inicio)::date as mes_ini,
         date_trunc('month', coalesce(c.fim, 'infinity'::date))::date as mes_fim
    from public.custos_tecnicos c
), grade as (
  select b.*, m.mes, m.previsto,
         ((extract(year from m.mes) - extract(year from b.mes_ini)) * 12 + extract(month from m.mes) - extract(month from b.mes_ini))::int as idade
    from base b
    join bi.meses m on m.mes >= b.mes_ini and (b.fim is null or m.mes <= b.mes_fim)
), qtd as (
  select g.*, u.valor_pago,
         case when g.unidade is null then null
              when u.quantidade is not null then u.quantidade
              when t.custo_id is null then null
              when g.mes < t.primeiro_mes then t.primeira_quantidade
              else greatest(0, t.ultima_quantidade + t.inclinacao_mes *
                   ((extract(year from g.mes) - extract(year from t.ultimo_mes)) * 12 + extract(month from g.mes) - extract(month from t.ultimo_mes)))
         end as quantidade,
         (u.quantidade is null and g.unidade is not null) as quantidade_estimada
    from grade g
    left join public.custos_uso u on u.custo_id = g.id and u.mes = g.mes
    left join bi.custos_tendencia t on t.custo_id = g.id
), valor as (
  select q.*,
         case
           when q.valor_pago is not null then q.valor_pago
           when q.recorrencia = 'uso' then coalesce(q.quantidade, 0) * q.valor
           when q.limite is not null and q.quantidade > q.limite and q.proximo_valor is not null
             then q.proximo_valor + coalesce((q.quantidade - q.limite) * q.extra_por_unidade, 0)
           else q.valor
         end as valor_moeda
    from qtd q
)
select v.id as custo_id, v.no_id, v.mes, v.previsto, v.quantidade, v.quantidade_estimada,
       v.limite, (v.limite is not null and v.quantidade > v.limite) as acima_do_limite,
       -- caixa: o que sai do bolso naquele mês
       round(case v.recorrencia
               when 'anual' then case when v.idade % 12 = 0 then v.valor_moeda else 0 end
               when 'unico' then case when v.idade = 0 then v.valor_moeda else 0 end
               else v.valor_moeda end * bi.cambio(v.moeda, least(v.mes, bi.hoje())), 2) as caixa_brl,
       -- competência: o peso do custo em cada mês (anual dividido por 12)
       round(case v.recorrencia
               when 'anual' then v.valor_moeda / 12
               when 'unico' then case when v.idade = 0 then v.valor_moeda else 0 end
               else v.valor_moeda end * bi.cambio(v.moeda, least(v.mes, bi.hoje())), 2) as competencia_brl,
       round(case when v.repasse then v.valor_moeda * (1 + v.taxa_repasse_pct / 100) * bi.cambio(v.moeda, least(v.mes, bi.hoje())) else 0 end, 2) as repasse_brl
  from valor v;
comment on view bi.custos_mensais is 'Custo técnico de cada item em cada mês, desde o início (pode ser retroativo), com previsão pela tendência de uso.';

create or replace view bi.receitas_mensais as
with grade as (
  select r.*, m.mes, m.previsto,
         ((extract(year from m.mes) - extract(year from date_trunc('month', r.inicio))) * 12
           + extract(month from m.mes) - extract(month from date_trunc('month', r.inicio)))::int as idade
    from public.receitas r
    join bi.meses m on m.mes >= date_trunc('month', r.inicio)::date
                   and (r.fim is null or m.mes <= date_trunc('month', r.fim)::date)
)
select g.id as receita_id, g.no_id, g.mes, g.previsto,
       round(case g.forma
               when 'mensal' then g.valor
               when 'unica' then case when g.idade = 0 then g.valor else 0 end
               when 'parcelada' then case when g.idade < g.parcelas then g.valor / g.parcelas else 0 end
             end * bi.cambio(g.moeda, least(g.mes, bi.hoje())), 2) as valor_brl
  from grade g;

-- previsão de quando cada custo com limite chega no teto do plano
create or replace view bi.previsao_limites as
select c.id as custo_id, c.no_id, c.fornecedor, c.descricao, c.unidade, c.limite, c.plano, c.proximo_plano,
       t.ultima_quantidade, round(t.inclinacao_mes, 3) as crescimento_mes,
       round(100 * t.ultima_quantidade / c.limite, 1) as uso_pct,
       case when t.ultima_quantidade >= c.limite then 0
            when t.inclinacao_mes > 0 then ceil((c.limite - t.ultima_quantidade) / t.inclinacao_mes)::int end as meses_ate_limite
  from public.custos_tecnicos c
  join bi.custos_tendencia t on t.custo_id = c.id
 where c.limite is not null and (c.fim is null or c.fim >= bi.hoje());

-- =====================================================================
-- ITENS: situação calculada de cada item (grupo do status, atraso, tempos)
-- =====================================================================
create or replace view bi.itens_situacao as
select i.id, i.frente_id, i.tipo, i.titulo, i.prioridade, i.responsavel_id, i.estimativa_h, i.pontos,
       i.inicio, i.prazo, i.data_prevista, i.visivel_cliente, i.sprint_id, i.marco_id, i.pai_id,
       i.criado_em, i.iniciado_em, i.concluido_em, s.grupo, s.nome as status_nome, s.cor as status_cor,
       (s.grupo <> 'done' and i.prazo < bi.hoje()) as atrasado,
       (i.data_prevista is not null and i.prazo is not null and i.data_prevista > i.prazo) as previsto_depois_do_prazo,
       extract(epoch from (i.concluido_em - i.criado_em)) / 3600 as lead_time_h,
       extract(epoch from (i.concluido_em - i.iniciado_em)) / 3600 as cycle_time_h
  from public.itens i
  join public.status_fluxo s on s.id = i.status_id
 where i.arquivado_em is null;

-- RITMO SEMANAL por nível da estrutura (Throughput, Lead time, Cycle time). Materializada.
create materialized view if not exists bi.ritmo_semanal as
with semanas as (
  select generate_series(date_trunc('week', now() - interval '25 weeks'), date_trunc('week', now()), interval '1 week')::date as semana
), criados as (
  select a.ancestral_id as no_id, date_trunc('week', i.criado_em)::date as semana, count(*) as n
    from public.itens i join public.nos_ancestrais a on a.no_id = i.frente_id
   where i.arquivado_em is null and i.criado_em >= now() - interval '26 weeks'
   group by 1, 2
), feitos as (
  select a.ancestral_id as no_id, date_trunc('week', i.concluido_em)::date as semana, count(*) as n,
         avg(extract(epoch from (i.concluido_em - i.criado_em)) / 3600) as lead_h,
         avg(extract(epoch from (i.concluido_em - i.iniciado_em)) / 3600) as cycle_h,
         sum(coalesce(i.estimativa_h, 0)) as horas, sum(coalesce(i.pontos, 0)) as pontos
    from public.itens i join public.nos_ancestrais a on a.no_id = i.frente_id
   where i.arquivado_em is null and i.concluido_em >= now() - interval '26 weeks'
   group by 1, 2
)
select n.id as no_id, s.semana,
       coalesce(c.n, 0)::int as criados, coalesce(f.n, 0)::int as concluidos,
       round(f.lead_h::numeric, 1) as lead_time_h, round(f.cycle_h::numeric, 1) as cycle_time_h,
       coalesce(f.horas, 0) as horas_concluidas, coalesce(f.pontos, 0)::int as pontos_concluidos
  from public.nos n
  cross join semanas s
  left join criados c on c.no_id = n.id and c.semana = s.semana
  left join feitos f on f.no_id = n.id and f.semana = s.semana
 where n.status <> 'arquivado';
create unique index if not exists ritmo_semanal_pk on bi.ritmo_semanal (no_id, semana);

-- VELOCIDADE por ciclo (Velocity) e QUEIMA do ciclo (Burndown)
create or replace view bi.velocidade_sprints as
select sp.id as sprint_id, sp.projeto_id, sp.nome, sp.inicio, sp.fim, sp.status,
       count(i.id) as itens, count(i.id) filter (where i.concluido_em is not null) as itens_concluidos,
       coalesce(sum(i.pontos), 0) as pontos_planejados,
       coalesce(sum(i.pontos) filter (where i.concluido_em is not null), 0) as pontos_concluidos,
       coalesce(sum(i.estimativa_h), 0) as horas_planejadas,
       coalesce(sum(i.estimativa_h) filter (where i.concluido_em is not null), 0) as horas_concluidas
  from public.sprints sp
  left join public.itens i on i.sprint_id = sp.id and i.arquivado_em is null
 group by sp.id;

create or replace function bi.queima_sprint(p_sprint uuid)
returns table (dia date, restante_h numeric, restante_pontos numeric, ideal_h numeric)
language sql stable security definer set search_path = public, pg_temp as $$
  with sp as (select * from public.sprints where id = p_sprint),
       tot as (select coalesce(sum(estimativa_h), 0) as h, count(*) as n from public.itens where sprint_id = p_sprint and arquivado_em is null),
       dias as (select d::date as dia from sp, generate_series(sp.inicio, sp.fim, interval '1 day') d)
  select d.dia,
         coalesce(sum(i.estimativa_h) filter (where i.concluido_em is null or (i.concluido_em at time zone 'America/Sao_Paulo')::date > d.dia), 0),
         coalesce(sum(i.pontos) filter (where i.concluido_em is null or (i.concluido_em at time zone 'America/Sao_Paulo')::date > d.dia), 0),
         round(tot.h * (1 - (d.dia - sp.inicio)::numeric / greatest(sp.fim - sp.inicio, 1)), 1)
    from dias d cross join sp cross join tot
    left join public.itens i on i.sprint_id = p_sprint and i.arquivado_em is null
   group by d.dia, tot.h, sp.inicio, sp.fim
   order by d.dia
$$;

-- próximo dia útil (sábado e domingo passam para segunda). Usado fora das contas pesadas.
create or replace function bi.dia_util(p_dia date) returns date
language sql immutable set search_path = public, pg_temp as $$
  select case extract(isodow from p_dia) when 6 then p_dia + 2 when 7 then p_dia + 1 else p_dia end
$$;

-- CARGA (Workload): a estimativa que falta de cada item aberto, espalhada pelos dias úteis entre o início e o prazo.
-- Item atrasado: o que falta fica no próximo dia útil a partir de hoje.
-- Desempenho: as contas de data ficam escritas direto na consulta (sem chamar função linha a linha)
-- e os dias úteis saem de uma fórmula, sem gerar a lista de dias de cada item.
create or replace function bi.carga(p_de date, p_ate date)
returns table (pessoa_id uuid, dia date, horas numeric, capacidade_dia numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare hoje date := bi.hoje(); todos boolean := interno.eh_master();
begin
  return query
  with base as (
    select i.id, i.responsavel_id, i.estimativa_h,
           greatest(coalesce(i.inicio, i.prazo), hoje) as b_de, greatest(i.prazo, hoje) as b_ate
      from public.itens i
      join public.status_fluxo s on s.id = i.status_id and s.grupo <> 'done'
     where i.arquivado_em is null and i.responsavel_id is not null and i.prazo is not null
       and (todos or i.frente_id in (select interno.nos_visiveis()))
  ), abertos as (
    select b.id, b.responsavel_id, b.estimativa_h, x.de, greatest(x.ate0, x.de) as ate
      from base b
      cross join lateral (select
        b.b_de + case extract(isodow from b.b_de) when 6 then 2 when 7 then 1 else 0 end as de,
        b.b_ate + case extract(isodow from b.b_ate) when 6 then 2 when 7 then 1 else 0 end as ate0) x
  ), no_periodo as (
    select a.*, ((a.ate - a.de) / 7) * 5 + ((a.ate - a.de) % 7) + 1
               - case when extract(isodow from a.de) + ((a.ate - a.de) % 7) > 5 then 2 else 0 end as n_uteis
      from abertos a where a.de <= p_ate and a.ate >= p_de
  ), gasto as (
    select t.item_id, sum(extract(epoch from (coalesce(t.fim, now()) - t.inicio)) / 3600) as h
      from public.tempo_registros t where t.item_id in (select id from no_periodo) group by t.item_id
  ), dias as (
    select a.responsavel_id, d::date as dia,
           greatest(coalesce(a.estimativa_h, 0) - coalesce(g.h, 0), 0) / greatest(a.n_uteis, 1) as horas_dia
      from no_periodo a
      left join gasto g on g.item_id = a.id
      cross join lateral generate_series(greatest(a.de, p_de), least(a.ate, p_ate), interval '1 day') d
     where extract(isodow from d) < 6
  )
  select d.responsavel_id, d.dia, round(sum(d.horas_dia), 2), round(p.capacidade_h / 5, 2)
    from dias d join public.pessoas p on p.id = d.responsavel_id
   group by d.responsavel_id, d.dia, p.capacidade_h;
end $$;

-- SLA de cada pedido: vale o SLA do nível mais próximo acima do pedido
create or replace view bi.pedidos_sla as
select p.id as pedido_id, p.no_id, p.status, p.gravidade, p.criado_em, p.respondido_em, p.resolvido_em,
       s.horas_resposta, s.horas_solucao,
       p.criado_em + make_interval(secs => s.horas_resposta * 3600) as prazo_resposta,
       p.criado_em + make_interval(secs => s.horas_solucao * 3600) as prazo_solucao,
       case
         when s.no_id is null then 'sem_sla'
         when p.resolvido_em is not null then case when p.resolvido_em <= p.criado_em + make_interval(secs => s.horas_solucao * 3600) then 'cumprido' else 'estourado' end
         when now() > p.criado_em + make_interval(secs => s.horas_solucao * 3600) then 'estourado'
         when p.respondido_em is null and now() > p.criado_em + make_interval(secs => s.horas_resposta * 3600) then 'resposta_atrasada'
         when now() > p.criado_em + make_interval(secs => s.horas_solucao * 3600 * 0.8) then 'perto_do_limite'
         else 'no_prazo' end as situacao
  from public.pedidos p
  left join lateral (
    select sl.* from public.nos_ancestrais a
      join public.slas sl on sl.no_id = a.ancestral_id and sl.gravidade = p.gravidade
     where a.no_id = p.no_id order by a.distancia limit 1
  ) s on true;

-- ETAPAS: situação efetiva de cada item de etapa em cada projeto e aplicação (modelo + ajustes)
create or replace view bi.etapas_situacao as
select n.id as no_id, n.tipo as no_tipo, em.id as etapa_id, em.nome as etapa, em.ordem as etapa_ordem,
       mi.id as item_modelo_id, mi.texto, mi.obrigatorio,
       coalesce(en.modo, mi.modo) as modo, coalesce(en.prova_tipo, mi.prova_tipo) as prova_tipo,
       coalesce(en.situacao, 'pendente') as situacao, en.cumprido_por, en.cumprido_em, en.motivo_dispensa
  from public.nos n
  cross join public.etapas_modelo_itens mi
  join public.etapas_modelo em on em.id = mi.etapa_id
  left join public.etapas_nos en on en.no_id = n.id and en.item_modelo_id = mi.id
 where n.tipo in ('projeto','aplicacao') and n.status <> 'arquivado'
   and (not mi.so_terceiros or exists (
         select 1 from public.nos_ancestrais a join public.aplicacoes ap on ap.no_id = a.no_id
          where a.ancestral_id = n.id and ap.origem_codigo = 'terceiros'));

-- FICHA TÉCNICA com herança: vale o valor do nível mais próximo
create or replace function bi.ficha_do_no(p_no uuid)
returns table (secao text, campo text, valor text, personalizado boolean, herdado boolean, origem_id uuid, origem_nome text)
language sql stable security definer set search_path = public, pg_temp as $$
  select distinct on (f.secao, f.campo) f.secao, f.campo, f.valor, f.personalizado, a.distancia > 0, f.no_id, n.nome
    from public.nos_ancestrais a
    join public.ficha_campos f on f.no_id = a.ancestral_id
    join public.nos n on n.id = f.no_id
   where a.no_id = p_no and p_no in (select interno.nos_visiveis())
   order by f.secao, f.campo, a.distancia
$$;

-- MUDANÇAS RECENTES de um nível (lidas do registro de auditoria)
-- Desempenho: escopo pequeno (até 3 mil itens) busca pelos ids do escopo no índice (registro_id, em);
-- escopo grande percorre a auditoria do mais novo para o mais velho e para quando junta o suficiente.
create or replace function bi.mudancas_recentes(p_no uuid, p_limite int default 12)
returns table (quando timestamptz, pessoa text, acao text, item_id uuid, titulo text, detalhe jsonb)
language plpgsql stable security definer set search_path = public, auditoria, pg_temp as $$
declare
  so_cliente boolean := interno.eh_stakeholder();
  n_escopo int;
begin
  if p_no not in (select interno.nos_visiveis()) then return; end if;
  select count(*) into n_escopo from (
    select 1 from public.itens i join public.nos_ancestrais a on a.no_id = i.frente_id and a.ancestral_id = p_no limit 3001) x;

  if n_escopo <= 3000 then
    return query
    with alvo as (
      select i.id, i.titulo, i.visivel_cliente from public.itens i
        join public.nos_ancestrais a on a.no_id = i.frente_id and a.ancestral_id = p_no
       where not so_cliente or i.visivel_cliente
    ), com as (
      select c.id, c.item_id from public.comentarios c join alvo on alvo.id = c.item_id
       where not so_cliente or c.visivel_cliente
    ), ev as (
      (select r.em, r.pessoa_id, r.acao, r.mudancas, alvo.id as item_id, alvo.titulo, false as comentario
         from alvo cross join lateral (
           select * from auditoria.registros r where r.registro_id = alvo.id and r.tabela = 'itens' order by r.em desc limit p_limite) r)
      union all
      (select r.em, r.pessoa_id, r.acao, null, alvo.id, alvo.titulo, true
         from com join alvo on alvo.id = com.item_id
         cross join lateral (select * from auditoria.registros r where r.registro_id = com.id and r.tabela = 'comentarios' and r.acao = 'I' limit 1) r)
    )
    select ev.em, pe.nome, interno.rotulo_mudanca(ev.acao, ev.mudancas, ev.comentario), ev.item_id, ev.titulo, ev.mudancas
      from ev left join public.pessoas pe on pe.id = ev.pessoa_id
     order by ev.em desc limit p_limite;
  else
    return query
    select r.em, pe.nome, interno.rotulo_mudanca(r.acao, r.mudancas, r.tabela = 'comentarios'), i.id, i.titulo, r.mudancas
      from auditoria.registros r
      left join public.comentarios c on r.tabela = 'comentarios' and c.id = r.registro_id
      join public.itens i on i.id = case when r.tabela = 'itens' then r.registro_id else c.item_id end
      join public.nos_ancestrais a on a.no_id = i.frente_id and a.ancestral_id = p_no
      left join public.pessoas pe on pe.id = r.pessoa_id
     where r.tabela in ('itens','comentarios') and (r.tabela = 'itens' or r.acao = 'I')
       and (not so_cliente or (i.visivel_cliente and (c.id is null or c.visivel_cliente)))
     order by r.em desc limit p_limite;
  end if;
end $$;

create or replace function interno.rotulo_mudanca(p_acao text, p_mudancas jsonb, p_comentario boolean) returns text
language sql immutable set search_path = public, pg_temp as $$
  select case when p_comentario then 'comentou em'
              when p_acao = 'I' then 'criou'
              when p_mudancas ? 'status_id' then 'mudou o status de'
              when p_mudancas ? 'prazo' then 'mudou o prazo de'
              when p_mudancas ? 'responsavel_id' then 'mudou o responsável de'
              when p_mudancas ? 'arquivado_em' then 'arquivou'
              else 'editou' end
$$;

-- =====================================================================
-- PAINEL de qualquer nível (o Dashboard): tudo numa chamada só
-- =====================================================================
create or replace function bi.painel(p_no uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  so_cliente boolean := interno.eh_stakeholder();
  hoje date := bi.hoje();
  r jsonb;
begin
  if p_no not in (select interno.nos_visiveis()) then
    raise exception 'Sem acesso a este nível' using errcode = '42501';
  end if;

  with it as (
    select s.* from bi.itens_situacao s
      join public.nos_ancestrais a on a.no_id = s.frente_id and a.ancestral_id = p_no
     where not so_cliente or s.visivel_cliente
  ), filhos as (
    select n.id, n.nome, n.tipo, n.status,
           count(s.id) as total,
           count(s.id) filter (where s.grupo = 'done') as feitos,
           count(s.id) filter (where s.grupo in ('doing','review')) as andamento,
           count(s.id) filter (where s.grupo = 'blocked') as bloqueados,
           count(s.id) filter (where s.atrasado) as atrasados
      from public.nos n
      left join public.nos_ancestrais a on a.ancestral_id = n.id
      left join it s on s.frente_id = a.no_id
     where n.pai_id = p_no and n.status <> 'arquivado' and n.id in (select interno.nos_visiveis())
     group by n.id
  ), dias as (
    select d::date as dia,
           (select count(*) from it where (it.concluido_em at time zone 'America/Sao_Paulo')::date = d::date) as concluidos
      from generate_series(hoje - 13, hoje, interval '1 day') d
  )
  select jsonb_build_object(
    'kpis', (select jsonb_build_object(
        'total', count(*),
        'backlog', count(*) filter (where grupo = 'backlog'),
        'a_fazer', count(*) filter (where grupo = 'todo'),
        'em_andamento', count(*) filter (where grupo in ('doing','review')),
        'bloqueados', count(*) filter (where grupo = 'blocked'),
        'concluidos', count(*) filter (where grupo = 'done'),
        'atrasados', count(*) filter (where atrasado),
        'sem_responsavel', count(*) filter (where responsavel_id is null and grupo <> 'done'),
        'criados_14d', count(*) filter (where criado_em >= now() - interval '14 days'),
        'concluidos_semana', count(*) filter (where concluido_em >= date_trunc('week', now())),
        'concluidos_semana_anterior', count(*) filter (where concluido_em >= date_trunc('week', now()) - interval '1 week' and concluido_em < date_trunc('week', now())),
        'horas_restantes', coalesce(sum(estimativa_h) filter (where grupo <> 'done'), 0)) from it),
    'por_status', (select coalesce(jsonb_object_agg(g, n), '{}'::jsonb) from (select grupo g, count(*) n from it group by grupo) x),
    'filhos', (select coalesce(jsonb_agg(to_jsonb(f) order by f.nome), '[]'::jsonb) from filhos f),
    'dias', (select jsonb_agg(jsonb_build_object('dia', dia, 'concluidos', concluidos) order by dia) from dias),
    'ultimos_concluidos', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select id, titulo, concluido_em from it where grupo = 'done' order by concluido_em desc nulls last limit 8) x),
    'mudancas', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from bi.mudancas_recentes(p_no, 10) m),
    'avisos', jsonb_build_object(
        'atrasados', (select count(*) from it where atrasado),
        'bloqueados', (select count(*) from it where grupo = 'blocked'),
        'sem_responsavel', (select count(*) from it where responsavel_id is null and grupo <> 'done'),
        'etapas_pendentes', case when so_cliente then 0 else (select count(*)
              from public.nos_ancestrais a
              join public.nos n on n.id = a.no_id and n.tipo in ('projeto','aplicacao') and n.status <> 'arquivado'
              cross join public.etapas_modelo_itens mi
              left join public.etapas_nos en on en.no_id = n.id and en.item_modelo_id = mi.id
             where a.ancestral_id = p_no and mi.obrigatorio and coalesce(en.situacao, 'pendente') = 'pendente'
               and coalesce(en.modo, mi.modo) <> 'desligado'
               and (not mi.so_terceiros or exists (select 1 from public.nos_ancestrais a2 join public.aplicacoes ap on ap.no_id = a2.no_id
                                                    where a2.ancestral_id = n.id and ap.origem_codigo = 'terceiros'))) end,
        'custos_perto_do_limite', case when interno.eh_master() then (select count(*) from bi.previsao_limites l
              join public.nos_ancestrais a on a.no_id = l.no_id and a.ancestral_id = p_no
             where l.meses_ate_limite is not null and l.meses_ate_limite <= 3) else 0 end,
        'pedidos_aguardando', case when so_cliente then 0 else (select count(*) from public.pedidos p
              join public.nos_ancestrais a on a.no_id = p.no_id and a.ancestral_id = p_no
             where p.status = 'aguardando_voce') end),
    'ritmo', (select coalesce(jsonb_agg(jsonb_build_object('semana', semana, 'criados', criados, 'concluidos', concluidos,
                     'lead_time_h', lead_time_h, 'cycle_time_h', cycle_time_h) order by semana), '[]'::jsonb)
                from bi.ritmo_semanal where no_id = p_no)
  ) into r;
  return r;
end $$;

-- FINANCEIRO de qualquer nível (só o Master): o que já foi gasto e cobrado, desde o início
create or replace function bi.financeiro(p_no uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r jsonb; v_mes date := bi.mes_atual(); par record;
begin
  if not interno.eh_master() then
    raise exception 'Só o Master vê valores' using errcode = '42501';
  end if;
  select * into par from bi.parametros_preco;
  with esc as (select no_id from public.nos_ancestrais where ancestral_id = p_no),
       cm as (select * from bi.custos_mensais where no_id in (select no_id from esc)),
       rm as (select * from bi.receitas_mensais where no_id in (select no_id from esc)),
       serie as (
         select m.mes, m.previsto,
                coalesce((select sum(caixa_brl) from cm where cm.mes = m.mes), 0) as custo,
                coalesce((select sum(valor_brl) from rm where rm.mes = m.mes), 0) + coalesce((select sum(repasse_brl) from cm where cm.mes = m.mes), 0) as receita
           from bi.meses m where m.mes >= v_mes - interval '24 months' and m.mes <= v_mes + interval '6 months')
  select jsonb_build_object(
    'custo_mes', (select coalesce(sum(competencia_brl), 0) from cm where cm.mes = v_mes),
    'gasto_ate_hoje', (select coalesce(sum(caixa_brl), 0) from cm where not cm.previsto),
    'cobrado_ate_hoje', (select coalesce(sum(valor_brl), 0) from rm where not rm.previsto),
    'repasse_ate_hoje', (select coalesce(sum(repasse_brl), 0) from cm where not cm.previsto),
    -- a receber: o que falta dos contratos com valor fechado (única e parcelada); mensalidade sem fim não entra
    'a_receber', (select coalesce(sum(greatest(r.valor * bi.cambio(r.moeda, bi.hoje())
                     - coalesce((select sum(x.valor_brl) from rm x where x.receita_id = r.id and not x.previsto), 0), 0)), 0)
                    from public.receitas r where r.no_id in (select no_id from esc) and r.forma <> 'mensal'),
    'equipe_para_terminar', round(coalesce((select sum(estimativa_h) from bi.itens_situacao s
                              join esc on esc.no_id = s.frente_id where s.grupo <> 'done'), 0)
                              * coalesce(par.custo_hora_medio, 0) * (1 + coalesce(par.contingencia_pct, 0) / 100), 2),
    'serie', (select jsonb_agg(to_jsonb(s) order by s.mes) from serie s)
  ) into r;
  return r || jsonb_build_object('resultado', (r->>'cobrado_ate_hoje')::numeric - (r->>'gasto_ate_hoje')::numeric);
end $$;

-- atualiza as visões materializadas sem travar a leitura
create or replace function bi.atualizar() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  refresh materialized view concurrently bi.ritmo_semanal;
end $$;
