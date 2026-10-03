-- VOLTA da parte 58: cada função de logica volta para o public (apaga a porta fina com o mesmo nome antes).
do $$
declare f record;
begin
  for f in select p.proname, pg_get_function_identity_arguments(p.oid) ident from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'logica' loop
    execute format('drop function if exists public.%I(%s)', f.proname, f.ident);
    execute format('alter function logica.%I(%s) set schema public', f.proname, f.ident);
  end loop;
end $$;
drop schema if exists logica;
