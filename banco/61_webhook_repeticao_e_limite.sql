-- =====================================================================
-- Parte 61 · Ordem de serviço do banco nº1, item S9 (e um ajuste da parte 60).
-- Avisos do GitHub e do GitLab (git-webhook, sem login): depois de conferir a assinatura, o banco guarda o resumo
--   (sha256) do aviso por 30 dias; o mesmo aviso de novo responde "repetido" e não grava nada (proteção contra repetição).
--   Janela de tempo (±5 min): o GitHub e o GitLab não assinam a hora do aviso, então não dá para conferir a hora com
--   segurança; a proteção é o resumo do conteúdo assinado.
-- Portal (portal-api, sem login, com chave cdp_...): no máximo 120 chamadas por minuto por chave. Passou disso, o banco
--   recusa com o código 53400 e a função responde 429 (espere um minuto).
-- Ajuste da parte 60: a vista itens_com_caminho é só leitura também nas permissões.
-- Plano de volta: 61_webhook_repeticao_e_limite_VOLTA.sql.
-- =====================================================================
create table if not exists interno.webhook_recebidos (
  resumo text primary key, origem text not null, recebido_em timestamptz not null default now());
create index if not exists webhook_recebidos_em_idx on interno.webhook_recebidos (recebido_em);
alter table interno.webhook_recebidos enable row level security;
revoke all on interno.webhook_recebidos from public, anon, authenticated, service_role;

create or replace function interno.webhook_novo(p_origem text, p_corpo text) returns boolean
language plpgsql set search_path = '' as $$
declare r text := encode(extensions.digest(p_origem || chr(10) || coalesce(p_corpo, ''), 'sha256'), 'hex'); n int;
begin
  delete from interno.webhook_recebidos w where w.recebido_em < now() - interval '30 days';
  insert into interno.webhook_recebidos (resumo, origem) values (r, p_origem) on conflict (resumo) do nothing;
  get diagnostics n = row_count;
  return n = 1;
end $$;
revoke all on function interno.webhook_novo(text, text) from public, anon, authenticated, service_role;

do $$
declare def text; antes text;
begin
  def := pg_get_functiondef('public.git_receber_github(text,text,text)'::regprocedure);
  if position('webhook_novo' in def) = 0 then
    antes := 'begin j := p_corpo::jsonb; exception when others then return jsonb_build_object(''ok'', false, ''erro'', ''conteúdo inválido''); end;';
    if position(antes in def) = 0 then raise exception 'S9: não achei onde pôr a proteção em git_receber_github'; end if;
    def := replace(def, antes, antes || E'\n  -- S9 (parte 61): o mesmo aviso (já conferido pela assinatura) não é processado duas vezes\n  if not interno.webhook_novo(''github'', p_corpo) then return jsonb_build_object(''ok'', true, ''repetido'', true); end if;');
    execute def;
  end if;
  def := pg_get_functiondef('public.git_receber_gitlab(uuid,text,text,text)'::regprocedure);
  if position('webhook_novo' in def) = 0 then
    antes := '  return jsonb_build_object(''ok'', true, ''evento'', p_evento) || interno.git_processar(r, p_evento, j);';
    if position(antes in def) = 0 then raise exception 'S9: não achei onde pôr a proteção em git_receber_gitlab'; end if;
    def := replace(def, antes, E'  -- S9 (parte 61): o mesmo aviso (já conferido pelo segredo) não é processado duas vezes\n  if not interno.webhook_novo(''gitlab:'' || r.id, p_corpo) then return jsonb_build_object(''ok'', true, ''repetido'', true); end if;\n' || antes);
    execute def;
  end if;
end $$;

-- limite de chamadas por chave do portal
create table if not exists interno.portal_chamadas (
  resumo text not null, minuto timestamptz not null, n integer not null default 1, primary key (resumo, minuto));
alter table interno.portal_chamadas enable row level security;
revoke all on interno.portal_chamadas from public, anon, authenticated, service_role;

create or replace function public.portal_por_chave(p_chave text) returns table (portal_id uuid, no_id uuid, nome text)
language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp' as $function$
declare r text := encode(digest(p_chave, 'sha256'), 'hex'); k int;
begin
  -- só conta chave que vale (chave inventada não chega a ocupar espaço)
  if exists (select 1 from public.portais_chaves c join public.portais p on p.id = c.portal_id where c.resumo = r and c.revogada_em is null and p.ativo) then
    delete from interno.portal_chamadas x where x.minuto < now() - interval '1 hour';
    insert into interno.portal_chamadas as x (resumo, minuto) values (r, date_trunc('minute', now()))
    on conflict (resumo, minuto) do update set n = x.n + 1 returning x.n into k;
    if k > 120 then raise exception 'Muitas chamadas com esta chave (limite: 120 por minuto). Espere um minuto.' using errcode = '53400'; end if;
  end if;
  return query
  update public.portais_chaves c set usada_em = now()
    from public.portais p
   where c.resumo = r and c.revogada_em is null and p.id = c.portal_id and p.ativo
  returning p.id, p.no_id, p.nome;
end $function$;
revoke all on function public.portal_por_chave(text) from public, anon, authenticated;
grant execute on function public.portal_por_chave(text) to service_role;

-- ajuste da parte 60
revoke insert, update, delete, truncate, references, trigger on public.itens_com_caminho from authenticated, anon;
