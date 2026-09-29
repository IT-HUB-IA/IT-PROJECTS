-- =====================================================================
-- CicloDev · 24 · Avisos do portal por webhook (SÓ NO SUPABASE: usa pg_net e pg_cron). Depende da parte 23.
--
-- A cada minuto, a rotina manda para o endereço do webhook de cada portal os avisos da fila (portais_eventos):
--   pergunta_criada, pergunta_respondida, pergunta_cancelada.
-- Cada aviso vai por POST, com o corpo em JSON {id, tipo, criado_em, dados} e dois cabeçalhos:
--   X-CicloDev-Evento:     o tipo do aviso
--   X-CicloDev-Assinatura: sha256=<HMAC-SHA256 do corpo, em hexadecimal, com o segredo do webhook do portal>
-- Resposta 2xx marca como entregue. Outra resposta, ou nenhuma em 10 minutos, tenta de novo no próximo minuto (até 10 vezes).
-- O sistema de fora também pode buscar a mesma fila pela função portal-api (GET /eventos), então nada se perde.
-- =====================================================================
create or replace function interno.portal_entregar() returns int
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare e record; n int := 0; corpo text; st int;
begin
  -- 1) confere os que já saíram
  for e in select ev.id, ev.pedido_id, ev.enviado_em from public.portais_eventos ev where ev.entregue_em is null and ev.pedido_id is not null loop
    select r.status_code into st from net._http_response r where r.id = e.pedido_id;
    if st between 200 and 299 then
      update public.portais_eventos set entregue_em = now(), pedido_id = null, ultimo_erro = null where id = e.id;
    elsif st is not null then
      update public.portais_eventos set pedido_id = null, ultimo_erro = 'O sistema de fora respondeu ' || st where id = e.id;
    elsif e.enviado_em < now() - interval '10 minutes' then
      update public.portais_eventos set pedido_id = null, ultimo_erro = 'Sem resposta em 10 minutos' where id = e.id;
    end if;
  end loop;
  -- 2) manda os que faltam, na ordem
  for e in select ev.id, ev.tipo, ev.criado_em, ev.dados, p.webhook_url, s.webhook_segredo
             from public.portais_eventos ev join public.portais p on p.id = ev.portal_id join public.portais_segredos s on s.portal_id = p.id
            where ev.entregue_em is null and ev.pedido_id is null and ev.tentativas < 10 and p.ativo and p.webhook_url is not null
            order by ev.id limit 50 loop
    corpo := jsonb_build_object('id', e.id, 'tipo', e.tipo, 'criado_em', e.criado_em, 'dados', e.dados)::text;
    update public.portais_eventos
       set pedido_id = net.http_post(url := e.webhook_url, body := corpo::jsonb,
             headers := jsonb_build_object('content-type', 'application/json', 'x-ciclodev-evento', e.tipo,
                                           'x-ciclodev-assinatura', 'sha256=' || encode(hmac(corpo, e.webhook_segredo, 'sha256'), 'hex')),
             timeout_milliseconds := 10000),
           tentativas = tentativas + 1, enviado_em = now()
     where id = e.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function interno.portal_entregar() from public, anon, authenticated;

do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'ciclodev_portal_webhook';
  perform cron.schedule('ciclodev_portal_webhook', '* * * * *', $c$select interno.portal_entregar()$c$);
end $$;
