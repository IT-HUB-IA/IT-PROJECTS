-- =====================================================================
-- CicloDev · 09 · Depósito de arquivos (Supabase Storage). SÓ NO SUPABASE (o schema storage não existe no Postgres puro).
-- Bucket privado "anexos". O arquivo só abre para quem enxerga o registro de anexos que aponta para ele.
-- Caminho do arquivo: <id da pessoa no login>/<uuid>-<nome do arquivo>
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('anexos', 'anexos', false, 52428800)   -- até 50 MB por arquivo
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists anexos_ver on storage.objects;
drop policy if exists anexos_enviar on storage.objects;
drop policy if exists anexos_apagar on storage.objects;

-- ver: precisa existir um anexo visível (a RLS de public.anexos roda dentro do exists)
create policy anexos_ver on storage.objects for select to authenticated
  using (bucket_id = 'anexos' and exists (select 1 from public.anexos a where a.storage_path = storage.objects.name));

-- enviar: só dentro da própria pasta
create policy anexos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'anexos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- apagar: o dono do arquivo ou o Master
create policy anexos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'anexos' and (owner = (select auth.uid()) or (select interno.eh_master())));
