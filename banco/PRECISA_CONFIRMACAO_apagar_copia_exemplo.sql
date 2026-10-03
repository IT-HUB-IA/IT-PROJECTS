-- =====================================================================
-- PREPARADO, NÃO APLICADO. Ordem de serviço do banco nº1, item S4. Só rodar com ordem escrita do dono.
-- O que é: o esquema copia_exemplo tem 38 tabelas e 279 linhas, cópia dos dados de exemplo (mesmos nomes de tabela
--   das reais; 19 dos 53 nós ainda existem no público). Não está em nenhuma migração nem no repositório: foi criado
--   direto no banco. Não é exposto pela API (a API só vê public e graphql_public) e anon/authenticated não têm USAGE.
-- O que faz: (1) guarda tudo numa linha só em interno.arquivo_esquemas (jsonb por tabela, com a contagem);
--            (2) confere que a contagem guardada bate com a do esquema; (3) apaga o esquema.
-- Volta: o conteúdo fica em interno.arquivo_esquemas (dá para recriar cada tabela a partir do jsonb).
-- =====================================================================
create table if not exists interno.arquivo_esquemas (
  id bigint generated always as identity primary key,
  esquema text not null, guardado_em timestamptz not null default now(), linhas integer not null, dados jsonb not null);
alter table interno.arquivo_esquemas enable row level security;
revoke all on interno.arquivo_esquemas from public, anon, authenticated, service_role;

do $$
declare t text; d jsonb := '{}'; n int := 0; c int; j jsonb;
begin
  for t in select table_name from information_schema.tables where table_schema = 'copia_exemplo' order by 1 loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''), count(*) from copia_exemplo.%I x', t) into j, c;
    d := d || jsonb_build_object(t, j); n := n + c;
  end loop;
  insert into interno.arquivo_esquemas (esquema, linhas, dados) values ('copia_exemplo', n, d);
  if (select sum(jsonb_array_length(v)) from jsonb_each(d) e(k, v)) <> n then raise exception 'S4: a cópia não bate; nada foi apagado'; end if;
  raise notice 'S4: % tabelas e % linhas guardadas em interno.arquivo_esquemas', (select count(*) from jsonb_object_keys(d)), n;
end $$;

drop schema copia_exemplo cascade;
