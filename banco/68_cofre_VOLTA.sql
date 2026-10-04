-- VOLTA da parte 68 (cofre). ATENÇÃO: só desfaz se o cofre estiver VAZIO. Com qualquer item guardado ele para com erro,
-- para nunca apagar segredo de alguém sem querer (o segredo vive só no Vault; apagar aqui é perder de vez).
do $$ begin
  if exists (select 1 from public.cofre_itens) then
    raise exception 'O cofre tem itens guardados. Volta cancelada: exporte ou apague os itens pela tela antes.';
  end if;
end $$;
set client_min_messages = warning;
delete from interno.ao_vivo_tabelas where tabela in ('cofre_itens', 'cofre_acessos');
drop function if exists public.cofre_criar(jsonb, jsonb), public.cofre_alterar(uuid, jsonb, jsonb), public.cofre_revelar(uuid, text), public.cofre_copiou(uuid, text),
  public.cofre_compartilhar(uuid, uuid, text), public.cofre_pessoas(uuid), public.cofre_lixeira(uuid, boolean), public.cofre_apagar(uuid);
drop function if exists logica.cofre_criar(jsonb, jsonb), logica.cofre_alterar(uuid, jsonb, jsonb), logica.cofre_revelar(uuid, text), logica.cofre_copiou(uuid, text),
  logica.cofre_compartilhar(uuid, uuid, text), logica.cofre_pessoas(uuid), logica.cofre_lixeira(uuid, boolean), logica.cofre_apagar(uuid);
drop table if exists interno.cofre_vault;
drop table if exists public.cofre_registros, public.cofre_acessos, public.cofre_itens;
drop function if exists interno.cofre_nivel(uuid), interno.cofre_pode_receber(uuid, uuid), interno.cofre_apagar_segredo(), interno.cofre_segredo_ok(jsonb),
  interno.cofre_meta_ok(jsonb), interno.cofre_anotar(uuid, text, text);
