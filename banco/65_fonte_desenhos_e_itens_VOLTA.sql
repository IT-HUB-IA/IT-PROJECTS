-- VOLTA da parte 65. As colunas ficam (sem uso) para não perder as escolhas; tudo volta a valer como "os dois ligados".
drop function if exists public.fonte_opcoes(text, uuid, boolean, boolean, boolean);
drop function if exists logica.fonte_opcoes(text, uuid, boolean, boolean, boolean);
drop function if exists interno.itens_da_fonte_intactos(uuid, text);
update public.repositorios set gera_desenhos = true, gera_itens = true where not gera_desenhos or not gera_itens;
update public.infra_bancos set gera_desenhos = true, gera_itens = true where not gera_desenhos or not gera_itens;
-- infra_auto_proximos, infra_auto_bancos_devidos e analise_inventario_gravar continuam aceitando as chaves (todas ligadas = como antes)
