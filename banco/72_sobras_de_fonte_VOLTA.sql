-- Volta da parte 72: some a lista de sobras de fonte que saiu (os itens que já foram para a lixeira continuam lá e voltam pela lixeira).
drop function if exists public.fonte_sobras_lixeira(uuid, text, boolean);
drop function if exists public.fonte_sobras(uuid);
drop function if exists logica.fonte_sobras_lixeira(uuid, text, boolean);
drop function if exists logica.fonte_sobras(uuid);
drop function if exists interno.fonte_saiu(text);
