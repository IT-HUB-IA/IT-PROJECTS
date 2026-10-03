-- VOLTA da parte 59 (S3 e S7; a S6 não volta: a função com nome de pessoa não fazia nada em tempo de uso).
do $$
declare t text;
begin
  foreach t in array array['auditoria.registros', 'public.itens_historico', 'public.itens_descricao_versoes'] loop
    execute format('drop trigger if exists so_insercao on %s', t);
    execute format('drop trigger if exists so_insercao_truncate on %s', t);
  end loop;
end $$;
grant update, delete, truncate on public.itens_historico, public.itens_descricao_versoes, auditoria.registros to service_role;
drop function if exists interno.historico_so_insercao();
alter default privileges in schema interno grant execute on functions to public;
alter default privileges in schema public grant execute on functions to public;
alter default privileges in schema logica grant execute on functions to public;
-- o execute de anon nas funções do interno não volta de propósito (anon não entra no interno; era só risco)
