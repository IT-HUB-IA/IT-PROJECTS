-- =====================================================================
-- CicloDev · 27 · Arquivos do chat do DevIT no depósito anexos (SÓ NO SUPABASE: usa storage). Depende das partes 09 e 26.
--
-- Cada pessoa guarda os arquivos que manda ao DevIT na pasta <login>/ia/ do depósito anexos.
-- Só a própria pessoa lê o que está na pasta dela, e ninguém apaga nada dali pela tela (o histórico nunca se perde).
-- =====================================================================
drop policy if exists anexos_ia_ver on storage.objects;
create policy anexos_ia_ver on storage.objects for select to authenticated
  using (bucket_id = 'anexos' and (storage.foldername(name))[1] = (select auth.uid())::text and (storage.foldername(name))[2] = 'ia');

-- a regra de apagar da parte 09 continua igual, menos para a pasta do chat
drop policy if exists anexos_apagar on storage.objects;
create policy anexos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'anexos' and (storage.foldername(name))[2] is distinct from 'ia' and (owner = (select auth.uid()) or (select interno.eh_master())));
