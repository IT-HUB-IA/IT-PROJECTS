-- =====================================================================
-- CicloDev · 49 · Inventário: arquivos e aviso diário. SÓ NO SUPABASE (storage e pg_cron não existem no Postgres puro).
-- Bucket privado "inventario": fotos, nota fiscal, termo assinado, certificado de apagamento, CDF.
-- Caminho: <id do cliente>/<uuid>-<nome do arquivo>. Só quem edita o cliente (o time) envia, vê e apaga.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('inventario', 'inventario', false, 26214400)   -- até 25 MB por arquivo
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create or replace function interno.inv_pasta_ok(p_nome text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((storage.foldername(p_nome))[1] ~ '^[0-9a-f-]{36}$' and interno.inv_pode(((storage.foldername(p_nome))[1])::uuid), false) $$;
revoke all on function interno.inv_pasta_ok(text) from public, anon;
grant execute on function interno.inv_pasta_ok(text) to authenticated;

drop policy if exists inventario_ver on storage.objects;
drop policy if exists inventario_enviar on storage.objects;
drop policy if exists inventario_apagar on storage.objects;
create policy inventario_ver on storage.objects for select to authenticated using (bucket_id = 'inventario' and interno.inv_pasta_ok(name));
create policy inventario_enviar on storage.objects for insert to authenticated with check (bucket_id = 'inventario' and interno.inv_pasta_ok(name));
create policy inventario_apagar on storage.objects for delete to authenticated using (bucket_id = 'inventario' and interno.inv_pasta_ok(name));

-- aviso diário (garantia, empréstimo, aluguel, licença, conferência; estoque mínimo às segundas). 08:23 de Brasília.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'ciclodev_inventario_avisos';
    perform cron.schedule('ciclodev_inventario_avisos', '23 11 * * *', 'select interno.inv_avisos()');
  end if;
end $$;
