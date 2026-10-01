-- =====================================================================
-- CicloDev · 45 · Inventário com integrações, infraestrutura e testes
-- O robô agora também lê do código os sistemas de fora que ele chama (integracao), os arquivos de montagem e
-- publicação (infra: Docker, GitHub Actions, Vercel, Terraform, Kubernetes) e os arquivos de teste (teste).
-- Cada um vira item na frente do mesmo assunto (Integrações, Infraestrutura, Testes).
-- =====================================================================
set lock_timeout = '5s';
alter table public.analise_inventario drop constraint if exists analise_inventario_tipo_check;
alter table public.analise_inventario add constraint analise_inventario_tipo_check
  check (tipo in ('tela','api','modulo','tabela','job','integracao','infra','teste')) not valid;
alter table public.analise_inventario validate constraint analise_inventario_tipo_check;
