-- VOLTA da parte 62.
-- I4: as políticas voltam a ser as de antes (copiadas do Supabase em 03/10/2026, antes da parte 62).
do $$ declare t text; p record; begin
  foreach t in array array['custos_uso','dominios_registros','equipes','equipes_membros','espaco_membros','etapas_modelo_itens','etiquetas','infra_canvas','itens_criterios','servicos','servicos_cobranca','servicos_requisitos','vinculos_externos'] loop
    for p in select polname from pg_policy where polrelid = ('public.' || quote_ident(t))::regclass loop execute format('drop policy %I on public.%I', p.polname, t); end loop;
  end loop;
end $$;
create policy muda on public.custos_uso for all to authenticated using ((EXISTS ( SELECT 1
   FROM custos_tecnicos c
  WHERE ((c.id = custos_uso.custo_id) AND (c.no_id IN ( SELECT interno.nos_editaveis() AS nos_editaveis)))))) with check ((EXISTS ( SELECT 1
   FROM custos_tecnicos c
  WHERE ((c.id = custos_uso.custo_id) AND (c.no_id IN ( SELECT interno.nos_editaveis() AS nos_editaveis))))));
create policy ver on public.custos_uso for select to authenticated using ((EXISTS ( SELECT 1
   FROM custos_tecnicos c
  WHERE (c.id = custos_uso.custo_id))));
create policy muda on public.dominios_registros for all to authenticated using ((EXISTS ( SELECT 1
   FROM dominios d
  WHERE ((d.id = dominios_registros.dominio_id) AND (d.espaco_id IN ( SELECT interno.meus_espacos() AS meus_espacos)))))) with check ((EXISTS ( SELECT 1
   FROM dominios d
  WHERE ((d.id = dominios_registros.dominio_id) AND (d.espaco_id IN ( SELECT interno.meus_espacos() AS meus_espacos))))));
create policy ver on public.dominios_registros for select to authenticated using ((EXISTS ( SELECT 1
   FROM dominios d
  WHERE (d.id = dominios_registros.dominio_id))));
create policy cria on public.equipes for insert to authenticated with check ((espaco_id IN ( SELECT interno.meus_espacos() AS meus_espacos)));
create policy apaga on public.equipes for delete to authenticated using ((espaco_id IN ( SELECT interno.meus_espacos() AS meus_espacos)));
create policy ver on public.equipes for select to authenticated using ((espaco_id IN ( SELECT interno.meus_espacos() AS meus_espacos)));
create policy ver_membro on public.equipes for select to authenticated using ((id IN ( SELECT interno.minhas_equipes() AS minhas_equipes)));
create policy muda on public.equipes for update to authenticated using ((espaco_id IN ( SELECT interno.meus_espacos() AS meus_espacos))) with check ((espaco_id IN ( SELECT interno.meus_espacos() AS meus_espacos)));
create policy muda on public.equipes_membros for all to authenticated using ((equipe_id IN ( SELECT interno.equipes_do_meu_espaco() AS equipes_do_meu_espaco))) with check ((equipe_id IN ( SELECT interno.equipes_do_meu_espaco() AS equipes_do_meu_espaco)));
create policy ver on public.equipes_membros for select to authenticated using ((equipe_id IN ( SELECT interno.minhas_equipes() AS minhas_equipes)));
create policy muda on public.espaco_membros for all to authenticated using ((EXISTS ( SELECT 1
   FROM espacos e
  WHERE ((e.id = espaco_membros.espaco_id) AND (e.dono_id = ( SELECT interno.pessoa_atual() AS pessoa_atual)))))) with check ((EXISTS ( SELECT 1
   FROM espacos e
  WHERE ((e.id = espaco_membros.espaco_id) AND (e.dono_id = ( SELECT interno.pessoa_atual() AS pessoa_atual))))));
create policy ver on public.espaco_membros for select to authenticated using ((espaco_id IN ( SELECT interno.meus_espacos() AS meus_espacos)));
create policy muda on public.etapas_modelo_itens for all to authenticated using ((EXISTS ( SELECT 1
   FROM etapas_modelo e
  WHERE ((e.id = etapas_modelo_itens.etapa_id) AND (e.espaco_id IN ( SELECT interno.meus_espacos() AS meus_espacos)))))) with check ((EXISTS ( SELECT 1
   FROM etapas_modelo e
  WHERE ((e.id = etapas_modelo_itens.etapa_id) AND (e.espaco_id IN ( SELECT interno.meus_espacos() AS meus_espacos))))));
create policy ver on public.etapas_modelo_itens for select to authenticated using ((EXISTS ( SELECT 1
   FROM etapas_modelo e
  WHERE (e.id = etapas_modelo_itens.etapa_id))));
create policy cria on public.etiquetas for insert to authenticated with check ((espaco_id IN ( SELECT interno.meus_espacos() AS meus_espacos)));
create policy apaga on public.etiquetas for delete to authenticated using ((espaco_id IN ( SELECT interno.meus_espacos() AS meus_espacos)));
create policy ver on public.etiquetas for select to authenticated using ((espaco_id IN ( SELECT interno.meus_espacos() AS meus_espacos)));
create policy ver_compartilhado on public.etiquetas for select to authenticated using (((EXISTS ( SELECT 1
   FROM etiquetas_nos l
  WHERE ((l.etiqueta_id = etiquetas.id) AND (l.no_id IN ( SELECT interno.nos_visiveis() AS nos_visiveis))))) OR (EXISTS ( SELECT 1
   FROM (etiquetas_itens l
     JOIN itens i ON ((i.id = l.item_id)))
  WHERE (l.etiqueta_id = etiquetas.id)))));
create policy muda on public.etiquetas for update to authenticated using ((espaco_id IN ( SELECT interno.meus_espacos() AS meus_espacos))) with check ((espaco_id IN ( SELECT interno.meus_espacos() AS meus_espacos)));
create policy mexe on public.infra_canvas for all to authenticated using ((no_id IN ( SELECT interno.nos_editaveis() AS nos_editaveis))) with check ((no_id IN ( SELECT interno.nos_editaveis() AS nos_editaveis)));
create policy ver on public.infra_canvas for select to authenticated using ((no_id IN ( SELECT interno.nos_visiveis() AS nos_visiveis)));
create policy time_muda on public.itens_criterios for all to authenticated using ((EXISTS ( SELECT 1
   FROM itens i
  WHERE ((i.id = itens_criterios.item_id) AND (i.frente_id IN ( SELECT interno.nos_editaveis() AS nos_editaveis)))))) with check ((EXISTS ( SELECT 1
   FROM itens i
  WHERE ((i.id = itens_criterios.item_id) AND (i.frente_id IN ( SELECT interno.nos_editaveis() AS nos_editaveis))))));
create policy ver on public.itens_criterios for select to authenticated using ((EXISTS ( SELECT 1
   FROM itens i
  WHERE (i.id = itens_criterios.item_id))));
create policy cria on public.servicos for insert to authenticated with check ((espaco_id IN ( SELECT interno.meus_espacos() AS meus_espacos)));
create policy apaga on public.servicos for delete to authenticated using ((espaco_id IN ( SELECT interno.meus_espacos() AS meus_espacos)));
create policy ver on public.servicos for select to authenticated using ((espaco_id IN ( SELECT interno.meus_espacos() AS meus_espacos)));
create policy ver_compartilhado on public.servicos for select to authenticated using ((EXISTS ( SELECT 1
   FROM aplicacoes a
  WHERE ((a.servico_id = servicos.id) AND (a.no_id IN ( SELECT interno.nos_visiveis() AS nos_visiveis))))));
create policy muda on public.servicos for update to authenticated using ((espaco_id IN ( SELECT interno.meus_espacos() AS meus_espacos))) with check ((espaco_id IN ( SELECT interno.meus_espacos() AS meus_espacos)));
create policy muda on public.servicos_cobranca for all to authenticated using ((EXISTS ( SELECT 1
   FROM servicos s
  WHERE ((s.id = servicos_cobranca.servico_id) AND (s.espaco_id IN ( SELECT interno.meus_espacos() AS meus_espacos)))))) with check ((EXISTS ( SELECT 1
   FROM servicos s
  WHERE ((s.id = servicos_cobranca.servico_id) AND (s.espaco_id IN ( SELECT interno.meus_espacos() AS meus_espacos))))));
create policy ver on public.servicos_cobranca for select to authenticated using ((EXISTS ( SELECT 1
   FROM servicos s
  WHERE (s.id = servicos_cobranca.servico_id))));
create policy muda on public.servicos_requisitos for all to authenticated using ((EXISTS ( SELECT 1
   FROM servicos s
  WHERE ((s.id = servicos_requisitos.servico_id) AND (s.espaco_id IN ( SELECT interno.meus_espacos() AS meus_espacos)))))) with check ((EXISTS ( SELECT 1
   FROM servicos s
  WHERE ((s.id = servicos_requisitos.servico_id) AND (s.espaco_id IN ( SELECT interno.meus_espacos() AS meus_espacos))))));
create policy ver on public.servicos_requisitos for select to authenticated using ((EXISTS ( SELECT 1
   FROM servicos s
  WHERE (s.id = servicos_requisitos.servico_id))));
create policy muda on public.vinculos_externos for all to authenticated using ((EXISTS ( SELECT 1
   FROM integracoes i
  WHERE ((i.id = vinculos_externos.integracao_id) AND (i.espaco_id IN ( SELECT interno.meus_espacos() AS meus_espacos)))))) with check ((EXISTS ( SELECT 1
   FROM integracoes i
  WHERE ((i.id = vinculos_externos.integracao_id) AND (i.espaco_id IN ( SELECT interno.meus_espacos() AS meus_espacos))))));
create policy ver on public.vinculos_externos for select to authenticated using ((EXISTS ( SELECT 1
   FROM integracoes i
  WHERE (i.id = vinculos_externos.integracao_id))));

-- I3: horários de antes e sem a rotina de conferência
do $$ declare j record; begin
  if to_regnamespace('cron') is null then return; end if;
  for j in select jobid, jobname from cron.job where jobname in ('ciclodev_bi_atualizar','ciclodev_diagramas_auto','ciclodev_email_imediato') loop
    perform cron.alter_job(j.jobid, schedule := case when j.jobname = 'ciclodev_email_imediato' then '*/5 * * * *' else '*/10 * * * *' end);
  end loop;
  perform cron.unschedule(jobid) from cron.job where jobname = 'ciclodev_rotinas_conferir';
end $$;
drop function if exists interno.rotinas_conferir();

-- I1: os índices de chave estrangeira criados pela parte 62 (todos terminam em _fk_idx)
do $$ declare i record; begin
  for i in select schemaname, indexname from pg_indexes where indexname like '%\_fk\_idx' and schemaname in ('public','interno','auditoria') loop
    execute format('drop index if exists %I.%I', i.schemaname, i.indexname);
  end loop;
end $$;
-- O5: os comentários ficam (não mudam nada no funcionamento).
