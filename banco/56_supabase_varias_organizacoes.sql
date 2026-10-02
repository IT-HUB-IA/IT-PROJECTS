-- CicloDev · 56 · Supabase: uma conexão por organização (02/10/2026).
-- O Supabase autoriza uma organização por vez (a janelinha pede para escolher). Quem tem bancos em organizações
-- diferentes conecta cada uma; a tela junta os projetos de todas. Conectar de novo a mesma organização no mesmo
-- espaço atualiza a conexão (chaves novas), em vez de criar outra repetida.
-- Troca supa_conexao_gravar (ganha a organização): a versão antiga sai na mesma operação, para não ficar duas.
-- Pode rodar de novo sem estragar nada.

alter table public.supa_conexoes add column if not exists organizacao_id text check (organizacao_id is null or length(organizacao_id) <= 100);
comment on column public.supa_conexoes.organizacao_id is 'A organização do Supabase que esta autorização alcança (o Supabase autoriza uma por vez).';
create unique index if not exists supa_conexoes_espaco_org on public.supa_conexoes (espaco_id, organizacao_id) where organizacao_id is not null;

drop function if exists public.supa_conexao_gravar(uuid, uuid, text, text, text, timestamptz);
create or replace function public.supa_conexao_gravar(p_espaco uuid, p_pessoa uuid, p_conta text, p_acesso text, p_renovacao text, p_expira timestamptz, p_organizacao text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare cid uuid; org text := nullif(btrim(coalesce(p_organizacao, '')), '');
begin
  if coalesce(p_acesso, '') = '' then raise exception 'Falta a chave de acesso' using errcode = '22023'; end if;
  if org is not null then select id into cid from public.supa_conexoes where espaco_id = p_espaco and organizacao_id = org; end if;
  if cid is null then
    insert into public.supa_conexoes (espaco_id, conta, criado_por, organizacao_id) values (p_espaco, left(coalesce(nullif(btrim(p_conta), ''), 'Supabase'), 300), p_pessoa, org) returning id into cid;
    insert into interno.supa_tokens (conexao_id, acesso, renovacao, expira_em) values (cid, p_acesso, p_renovacao, p_expira);
  else
    -- a mesma organização de novo: chaves novas, nome atualizado, erro antigo some
    update public.supa_conexoes set conta = left(coalesce(nullif(btrim(p_conta), ''), conta), 300), ultimo_erro = null where id = cid;
    insert into interno.supa_tokens (conexao_id, acesso, renovacao, expira_em) values (cid, p_acesso, p_renovacao, p_expira)
    on conflict (conexao_id) do update set acesso = excluded.acesso, renovacao = excluded.renovacao, expira_em = excluded.expira_em, trocado_em = now();
  end if;
  return cid;
end $$;
revoke all on function public.supa_conexao_gravar(uuid, uuid, text, text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.supa_conexao_gravar(uuid, uuid, text, text, text, timestamptz, text) to service_role;
