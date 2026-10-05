-- VOLTA da parte 69 (Mapa do Sistema). Apaga o mapa montado e os "é de propósito" marcados.
-- O mapa se monta de novo sozinho a partir do código; só os motivos de "é de propósito" se perdem (são escritos por pessoas).
-- Por isso: com algum "é de propósito" marcado, a volta para com erro. Exporte antes e apague pela tela.
do $$ begin
  if to_regclass('public.mapa_proposito') is not null and exists (select 1 from public.mapa_proposito) then
    raise exception 'Há alertas marcados como "é de propósito". Volta cancelada para não perder os motivos escritos.';
  end if;
end $$;
set client_min_messages = warning;
do $$ begin if to_regclass('interno.ao_vivo_tabelas') is not null then delete from interno.ao_vivo_tabelas where tabela in ('mapa_analises', 'mapa_proposito'); end if; end $$;
drop trigger if exists mapa_publicou on public.infra_automacoes;
drop function if exists public.mapa_pedir(uuid), public.mapa_proposito_marcar(uuid, text, text), public.mapa_proposito_tirar(uuid, text),
  public.mapa_confere(text), public.mapa_proximo(), public.mapa_gravar(uuid, jsonb), public.mapa_falhou(uuid, text), public.mapa_repo_da_analise(uuid);
drop function if exists logica.mapa_pedir(uuid), logica.mapa_proposito_marcar(uuid, text, text), logica.mapa_proposito_tirar(uuid, text),
  logica.mapa_confere(text), logica.mapa_proximo(), logica.mapa_gravar(uuid, jsonb), logica.mapa_falhou(uuid, text), logica.mapa_repo_da_analise(uuid);
drop table if exists public.mapa_proposito, public.mapa_alertas, public.mapa_ligacoes, public.mapa_pecas, public.mapa_analises;
drop function if exists interno.mapa_publicou(), interno.mapa_repos_de(uuid), interno.mapa_usadas_por_outras(uuid), interno.mapa_limpar(uuid), interno.mapa_apagar_antigas(uuid);
-- o segredo do trabalhador (Vault, ciclodev_mapa_segredo) fica: apague no painel do Supabase se não for mais usar.
