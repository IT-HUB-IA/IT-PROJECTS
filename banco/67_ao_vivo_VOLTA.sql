-- VOLTA da parte 67: tira os avisos ao vivo (a tela volta a só atualizar ao recarregar ou pelas conferências periódicas).
do $$ declare t record; begin
  for t in select tabela from interno.ao_vivo_tabelas loop
    if to_regclass('public.' || t.tabela) is null then continue; end if;
    execute format('drop trigger if exists zz_ao_vivo_i on public.%I', t.tabela);
    execute format('drop trigger if exists zz_ao_vivo_u on public.%I', t.tabela);
    execute format('drop trigger if exists zz_ao_vivo_d on public.%I', t.tabela);
  end loop;
  if to_regclass('realtime.messages') is not null then drop policy if exists ciclodev_ao_vivo_receber on realtime.messages; end if;
end $$;
drop function if exists public.ao_vivo_topicos();
drop function if exists logica.ao_vivo_topicos();
drop function if exists interno.ao_vivo_meus_topicos();
drop function if exists interno.ao_vivo_avisar();
drop table if exists interno.ao_vivo_tabelas;
drop function if exists interno.av_esp_no(uuid);
drop function if exists interno.av_esp_item(uuid);
drop function if exists interno.av_esp_pessoa(uuid);
