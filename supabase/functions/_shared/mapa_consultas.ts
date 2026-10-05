// Consultas fixas do Mapa do Sistema, só no catálogo do banco (nunca no conteúdo das tabelas):
//   palavras   as palavras das funções, gatilhos e visões (todos os esquemas que não são do sistema): uma coluna citada
//              numa delas é usada pelo banco, mesmo que nenhuma tela mostre.
//   checagens  as regras de valor das colunas (check), de onde o trabalhador tira os papéis (ex.: nivel in ('gerente', ...)).
//   funcoes    nome, parâmetros e o que cada função devolve (para o banco de mentira responder no formato certo). Sem o corpo.
export const CONSULTA_EXTRA = `select json_build_object(
  'palavras', (select coalesce(json_agg(w), '[]') from (
    select distinct lower(w) as w from (
      select p.prosrc as t from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname not in ('pg_catalog', 'information_schema') and n.nspname not like 'pg\\_%' and p.prolang not in (12, 13)
      union all
      select v.definition from pg_views v where v.schemaname not in ('pg_catalog', 'information_schema')
    ) x, regexp_split_to_table(coalesce(x.t, ''), '[^A-Za-z0-9_]+') w
    where length(w) between 2 and 63 and w ~ '[A-Za-z_]' limit 60000) y),
  'checagens', (select coalesce(json_agg(json_build_object('esquema', n.nspname, 'tabela', c.relname, 'regra', left(pg_get_constraintdef(k.oid), 2000))), '[]')
    from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace
   where k.contype = 'c' and n.nspname not in ('pg_catalog', 'information_schema') and n.nspname not like 'pg\\_%'),
  'funcoes', (select coalesce(json_agg(json_build_object('esquema', n.nspname, 'nome', p.proname, 'devolve', left(pg_get_function_result(p.oid), 1000),
      'varias', p.proretset, 'parametros', left(pg_get_function_arguments(p.oid), 1000))), '[]')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname not in ('pg_catalog', 'information_schema', 'extensions', 'graphql', 'graphql_public', 'vault', 'pgsodium', 'realtime', 'storage', 'auth', 'net', 'cron', 'supabase_functions', 'pgbouncer')
     and n.nspname not like 'pg\\_%' and p.prokind = 'f')
) as extra`;
export type Extra = { palavras: string[]; checagens: { esquema: string; tabela: string; regra: string }[]; funcoes?: { esquema: string; nome: string; devolve: string; varias: boolean; parametros: string }[] };
