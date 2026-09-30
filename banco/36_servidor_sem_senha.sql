-- Parte 36: o servidor que a tela mostra é o que vem depois do ÚLTIMO @ do endereço (30/09/2026).
-- Antes pegava o primeiro @: uma senha com @ fazia um pedaço da senha aparecer como "servidor" na lista de bancos.
-- Mesma assinatura da parte 33 (não cria outra versão da função). Corrige também os bancos já ligados.

create or replace function public.infra_banco_salvar(p_no uuid, p_id uuid, p_nome text, p_provedor text, p_motor text, p_esquemas text[], p_conexao text default null, p_ativo boolean default true)
returns public.infra_bancos
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.infra_bancos; esq text[]; con text := nullif(btrim(coalesce(p_conexao, '')), ''); host text; v_motor text := coalesce(nullif(p_motor, ''), 'postgres');
begin
  if p_no is null or p_no not in (select interno.nos_editaveis()) then raise exception 'Você não pode mudar este ponto' using errcode = '42501'; end if;
  if not interno.infra_no_ok(p_no) then raise exception 'A Infraestrutura fica em projetos, produtos e aplicações' using errcode = '22023'; end if;
  if coalesce(p_provedor, '') not in ('supabase','aws','outro') then raise exception 'Provedor inválido' using errcode = '22023'; end if;
  if v_motor not in ('postgres','mysql') then raise exception 'Motor inválido' using errcode = '22023'; end if;
  if p_provedor = 'supabase' and v_motor <> 'postgres' then raise exception 'O Supabase é PostgreSQL' using errcode = '22023'; end if;
  select coalesce(array_agg(distinct btrim(e)) filter (where btrim(e) <> ''), case when v_motor = 'mysql' then '{}'::text[] else '{public}' end) into esq from unnest(coalesce(p_esquemas, '{}')) e;
  if cardinality(esq) = 0 then raise exception 'Diga qual banco (database) ler' using errcode = '22023'; end if;
  if exists (select 1 from unnest(esq) e where e !~ '^[A-Za-z_][A-Za-z0-9_$-]{0,62}$') then raise exception 'Nome de esquema inválido' using errcode = '22023'; end if;
  if p_id is not null then
    select * into r from public.infra_bancos where id = p_id and no_id = p_no;
    if r.id is null then raise exception 'Banco não encontrado neste ponto' using errcode = '22023'; end if;
  end if;
  if con is null and p_id is null then raise exception 'Informe o endereço de conexão do banco' using errcode = '22023'; end if;
  if con is not null and ((v_motor = 'postgres' and con !~ '^postgres(ql)?://') or (v_motor = 'mysql' and con !~ '^mysql://')) then
    raise exception 'O endereço precisa começar com %', case when v_motor = 'mysql' then 'mysql://' else 'postgresql://' end using errcode = '22023'; end if;
  if con is not null then host := left(substring(con from '^[A-Za-z0-9+.-]+://(?:.*@)?([^@:/?]+)'), 255); end if;   -- o host vem depois do ÚLTIMO @: senha com @ não vaza para a tela
  if p_id is null then
    insert into public.infra_bancos (no_id, nome, provedor, motor, esquemas, ativo, servidor)
    values (p_no, coalesce(nullif(btrim(p_nome), ''), 'Banco de dados'), p_provedor, v_motor, esq, coalesce(p_ativo, true), host) returning * into r;
  else
    update public.infra_bancos set nome = coalesce(nullif(btrim(p_nome), ''), nome), provedor = p_provedor, motor = v_motor, esquemas = esq, ativo = coalesce(p_ativo, true),
           servidor = coalesce(host, servidor) where id = p_id returning * into r;
  end if;
  if con is not null then
    insert into interno.infra_bancos_conexao (banco_id, conexao) values (r.id, con)
    on conflict (banco_id) do update set conexao = excluded.conexao, trocado_em = now();
    -- endereço novo: lê de novo na próxima rodada
    update public.infra_bancos set ultimo_hash = null, ultima_leitura_em = null, ultimo_erro = null where id = r.id returning * into r;
  end if;
  perform interno.infra_auto_chamar();
  return r;
exception when unique_violation then raise exception 'Já existe um banco com esse nome aqui' using errcode = '23505';
end $$;

update public.infra_bancos b set servidor = left(substring(c.conexao from '^[A-Za-z0-9+.-]+://(?:.*@)?([^@:/?]+)'), 255)
  from interno.infra_bancos_conexao c where c.banco_id = b.id;
