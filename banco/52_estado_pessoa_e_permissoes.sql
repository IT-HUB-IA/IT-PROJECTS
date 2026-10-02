-- CicloDev · 52 · O que ficava só no navegador vai para o banco, e permissões que sobravam saem.
--   * pessoas_preferencias.estado: a frente em foco, as fichas automáticas já vistas, o guia do P.O. (passo de cada
--     projeto e avisos silenciados) e o Desfazer do último lote. Cada pessoa só lê e grava o seu (política "dono").
--   * pessoas_preferencias.navegador_antigo: a cópia antiga de todos os dados que estava no navegador (versão sem
--     login), guardada inteira, como foi encontrada, para nada se perder. Só a própria pessoa vê.
--   * Tira de quem entra pelo site (authenticated e anon) as permissões TRUNCATE, TRIGGER e REFERENCES nas tabelas.
--     Ninguém usa nenhuma delas pelo sistema; TRUNCATE passaria por cima das regras de acesso. Não apaga nada.
-- Pode rodar de novo sem estragar nada.
alter table public.pessoas_preferencias add column if not exists estado jsonb not null default '{}'::jsonb;
alter table public.pessoas_preferencias add column if not exists navegador_antigo jsonb not null default '[]'::jsonb;
comment on column public.pessoas_preferencias.estado is 'O que antes ficava só no navegador: foco, fichas vistas, guia do P.O., Desfazer do último lote (parte 52).';
comment on column public.pessoas_preferencias.navegador_antigo is 'Cópias antigas dos dados achadas no navegador (versão sem login), guardadas inteiras ao entrar (parte 52).';

do $$ declare r record; begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p','v','m') loop
    execute format('revoke truncate, trigger, references on public.%I from authenticated, anon', r.relname);
  end loop;
end $$;
-- e as tabelas que forem criadas daqui para frente já nascem sem elas
alter default privileges in schema public revoke truncate, trigger, references on tables from authenticated, anon;
