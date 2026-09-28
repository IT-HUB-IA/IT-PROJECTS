-- SOMENTE TESTE LOCAL: cria logins falsos e liga às pessoas de exemplo
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a','william@teste'),('00000000-0000-0000-0000-00000000000b','ana@teste'),
  ('00000000-0000-0000-0000-00000000000c','ceo@teste'),('00000000-0000-0000-0000-00000000000d','bruno@teste')
on conflict do nothing;
update public.pessoas set auth_user_id = '00000000-0000-0000-0000-00000000000a' where nome = 'William';
update public.pessoas set auth_user_id = '00000000-0000-0000-0000-00000000000b' where nome like 'Ana%';
update public.pessoas set auth_user_id = '00000000-0000-0000-0000-00000000000c' where nome like 'CEO%';
update public.pessoas set auth_user_id = '00000000-0000-0000-0000-00000000000d' where nome like 'Bruno%';
