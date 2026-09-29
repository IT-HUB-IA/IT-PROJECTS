-- =====================================================================
-- CicloDev · 22 · Preferências de tela e lembretes já vistos no banco
-- Antes ficavam só no navegador (e sumiam ao trocar de computador ou limpar o navegador):
--   tela              : tema escuro, abas escolhidas da barra, largura da Estrutura, o que está aberto nela,
--                       onde a pessoa estava (ponto e aba) e os filtros de cada tela
--   lembretes_vistos  : quais lembretes já apareceram na tela desta pessoa (para não repetir o aviso)
-- Cada pessoa só lê e grava a própria linha (política "dono" da parte 20). Depende da parte 20.
-- =====================================================================
alter table public.pessoas_preferencias
  add column if not exists tela jsonb not null default '{}'::jsonb,
  add column if not exists lembretes_vistos jsonb not null default '{}'::jsonb;

alter table public.pessoas_preferencias drop constraint if exists pessoas_preferencias_tela_ok;
alter table public.pessoas_preferencias add constraint pessoas_preferencias_tela_ok
  check (jsonb_typeof(tela) = 'object' and pg_column_size(tela) < 60000);
alter table public.pessoas_preferencias drop constraint if exists pessoas_preferencias_lembretes_ok;
alter table public.pessoas_preferencias add constraint pessoas_preferencias_lembretes_ok
  check (jsonb_typeof(lembretes_vistos) = 'object' and pg_column_size(lembretes_vistos) < 60000);

comment on column public.pessoas_preferencias.tela is 'Arrumação da tela desta pessoa: tema, abas da barra, largura e itens abertos da Estrutura, último ponto e aba, filtros.';
comment on column public.pessoas_preferencias.lembretes_vistos is 'Lembretes que já apareceram na tela desta pessoa: chave "item|quando" e o momento em que apareceu.';
