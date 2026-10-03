-- =====================================================================
-- Parte 66 · Desligar "Épicos e histórias" com "Mandar para a lixeira" deixava os épicos do robô para trás.
-- Motivo: quando uma história muda de situação, o épico acompanha sozinho (status_id, iniciado_em, concluido_em) e
-- essa mudança fica na auditoria com o nome de quem mexeu na história. A regra de "ninguém mexeu" via isso como edição.
-- Agora, no épico, mudança SÓ nesses campos de situação não conta. Qualquer outro campo (título, descrição, prazo...)
-- continua contando como mexido, e comentário, anexo ou filho de fora continuam segurando o épico.
-- Plano de volta: 66_epico_intacto_com_situacao_automatica_VOLTA.sql (volta a regra da parte 65).
-- =====================================================================
create or replace function interno.itens_da_fonte_intactos(p_no uuid, p_origem text) returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  with dentro as (select a.no_id from public.nos_ancestrais a where a.ancestral_id = p_no),
  st as (select i.id, i.pai_id, i.criado_em from public.itens i join public.analise_inventario v on v.item_id = i.id
          where v.origem = p_origem and i.excluido_em is null and i.frente_id in (select no_id from dentro)),
  intacto as (select t.id, t.pai_id from st t
   where not exists (select 1 from public.comentarios c where c.item_id = t.id)
     and not exists (select 1 from public.anexos x where x.item_id = t.id)
     and not exists (select 1 from public.itens f where f.pai_id = t.id and f.excluido_em is null)
     and not exists (select 1 from auditoria.registros r where r.tabela = 'itens' and r.registro_id = t.id and r.acao = 'U' and r.em > t.criado_em + interval '10 minutes')),
  -- o épico que o robô montou só vai se TODAS as histórias vivas dele forem intactas e forem junto
  ep as (select e.id from public.itens e where e.id in (select pai_id from intacto) and e.tipo = 'epic' and e.excluido_em is null
          and e.descricao like 'Épico montado pelo CicloDev%'
          and not exists (select 1 from public.itens f where f.pai_id = e.id and f.excluido_em is null and f.id not in (select id from intacto))
          and not exists (select 1 from public.comentarios c where c.item_id = e.id)
          and not exists (select 1 from public.anexos x where x.item_id = e.id)
          and not exists (select 1 from auditoria.registros r where r.tabela = 'itens' and r.registro_id = e.id and r.acao = 'U' and r.em > e.criado_em + interval '10 minutes'
                   -- a situação do épico acompanha a dos filhos sozinha: mudança só nesses campos não é "alguém mexeu"
                   and exists (select 1 from jsonb_object_keys(coalesce(r.mudancas, '{}'::jsonb)) k where k not in ('status_id', 'iniciado_em', 'concluido_em', 'atualizado_em'))))
  select id from intacto union select id from ep
$$;
revoke all on function interno.itens_da_fonte_intactos(uuid, text) from public, anon, authenticated, service_role;
