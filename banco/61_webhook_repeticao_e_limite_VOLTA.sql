-- VOLTA da parte 61: tira a proteção contra repetição e o limite do portal.
do $$
declare def text;
begin
  def := pg_get_functiondef('public.git_receber_github(text,text,text)'::regprocedure);
  def := regexp_replace(def, E'\\n  -- S9 \\(parte 61\\)[^\\n]*\\n  if not interno.webhook_novo[^\\n]*', '');
  execute def;
  def := pg_get_functiondef('public.git_receber_gitlab(uuid,text,text,text)'::regprocedure);
  def := regexp_replace(def, E'  -- S9 \\(parte 61\\)[^\\n]*\\n  if not interno.webhook_novo[^\\n]*\\n', '');
  execute def;
end $$;
create or replace function public.portal_por_chave(p_chave text) returns table (portal_id uuid, no_id uuid, nome text)
language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp' as $function$
begin
  return query
  update public.portais_chaves c set usada_em = now()
    from public.portais p
   where c.resumo = encode(digest(p_chave, 'sha256'), 'hex') and c.revogada_em is null and p.id = c.portal_id and p.ativo
  returning p.id, p.no_id, p.nome;
end $function$;
drop function if exists interno.webhook_novo(text, text);
drop table if exists interno.webhook_recebidos;
drop table if exists interno.portal_chamadas;
