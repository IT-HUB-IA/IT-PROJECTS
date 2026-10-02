-- =====================================================================
-- CicloDev · 46 · Inventário com as publicações (versões)
-- O robô lê do GitHub/GitLab as publicações (releases) do repositório, com a data de cada uma, e as datas de cada arquivo
-- (primeiro e último commit) e de cada tabela (migrations do Supabase, ou o próprio MySQL). A tela monta o projeto como se o
-- P.O. o tivesse feito no CicloDev: as versões viram Entregas com a data da publicação, cada item ganha início e prazo
-- pelas datas reais e entra na versão em que foi publicado.
-- =====================================================================
set lock_timeout = '5s';
alter table public.analise_inventario drop constraint if exists analise_inventario_tipo_check;
alter table public.analise_inventario add constraint analise_inventario_tipo_check
  check (tipo in ('tela','api','modulo','tabela','job','integracao','infra','teste','versao')) not valid;
alter table public.analise_inventario validate constraint analise_inventario_tipo_check;
