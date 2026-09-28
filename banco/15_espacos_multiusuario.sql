-- =====================================================================
-- CicloDev · 15 · Muitos usuários: cadastro aberto, espaço próprio para cada um e compartilhamento por ponto
-- Pedido do William em 28/09/2026. Análise e decisões: docs/ARQUITETURA-MULTIUSUARIO.md
--   · um nível só de usuário (não existe mais Master, Dev ou Stakeholder como nível de conta);
--   · o cadastro cria a pessoa, o número de ID público e o espaço próprio;
--   · tudo o que a pessoa cria nasce no espaço dela (Estrutura, Catalog, Costs, Settings, Agent Studio...);
--   · compartilhar um cliente, projeto, produto, aplicação ou frente dá acesso completo a ele e a tudo o que está dentro.
-- Modelo "pool": as mesmas tabelas para todos, com espaco_id e regras por linha (RLS). Nada de tabela por usuário.
-- Pode rodar de novo sem estragar nada.
-- =====================================================================

-- ---------- 1. identidade: número de ID público e nome de usuário ----------
create sequence if not exists public.pessoas_numero_seq start with 100001;
alter table public.pessoas
  add column if not exists numero  bigint,
  add column if not exists usuario text;
update public.pessoas set numero = nextval('public.pessoas_numero_seq') where numero is null;
alter table public.pessoas alter column numero set default nextval('public.pessoas_numero_seq');
alter table public.pessoas alter column numero set not null;
create unique index if not exists pessoas_numero_uq on public.pessoas (numero);
create unique index if not exists pessoas_usuario_uq on public.pessoas (lower(usuario)) where usuario is not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'pessoas_usuario_formato') then
    alter table public.pessoas add constraint pessoas_usuario_formato check (usuario is null or usuario ~ '^[a-z0-9_.]{3,30}$');
  end if;
end $$;
comment on column public.pessoas.numero is 'Número de ID público da pessoa (como o @ do Trello). É o que se passa para outra pessoa compartilhar.';

-- ---------- 2. espaços de trabalho ----------
create table if not exists public.espacos (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (length(btrim(nome)) between 1 and 120),
  dono_id    uuid references public.pessoas(id) on delete set null,
  pessoal    boolean not null default true,
  modelo     boolean not null default false,
  criado_em  timestamptz not null default now()
);
comment on table public.espacos is 'Espaço de trabalho (Trello: Workspace; Jira: site). Todo usuário ganha o seu no cadastro. modelo = espaço usado só como molde dos espaços novos.';
create unique index if not exists espacos_um_modelo on public.espacos (modelo) where modelo;

create table if not exists public.espaco_membros (
  espaco_id  uuid not null references public.espacos(id) on delete cascade,
  pessoa_id  uuid not null references public.pessoas(id) on delete cascade,
  papel      text not null default 'membro' check (papel in ('dono','membro')),
  desde      timestamptz not null default now(),
  primary key (espaco_id, pessoa_id)
);
create index if not exists espaco_membros_pessoa_idx on public.espaco_membros (pessoa_id);

-- pessoas cadastradas só para planejamento (sem login) pertencem a um espaço
alter table public.pessoas add column if not exists espaco_id uuid references public.espacos(id) on delete cascade;
create index if not exists pessoas_espaco_idx on public.pessoas (espaco_id) where espaco_id is not null;

-- espaços da pessoa atual e o espaço padrão dela (o pessoal)
create or replace function interno.meus_espacos() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select m.espaco_id from public.espaco_membros m where m.pessoa_id = interno.pessoa_atual()
$$;
create or replace function interno.meu_espaco() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select m.espaco_id from public.espaco_membros m join public.espacos e on e.id = m.espaco_id
   where m.pessoa_id = interno.pessoa_atual() order by (m.papel = 'dono') desc, e.pessoal desc, e.criado_em limit 1
$$;

-- espaço do William (dono atual de tudo o que existe) e o espaço Modelo
do $$ declare w uuid; e uuid; m uuid; begin
  select id into w from public.pessoas where auth_user_id is not null order by criado_em limit 1;
  if w is not null and not exists (select 1 from public.espaco_membros where pessoa_id = w) then
    insert into public.espacos (nome, dono_id, pessoal) values ('Espaço de ' || (select split_part(nome, ' ', 1) from public.pessoas where id = w), w, true) returning id into e;
    insert into public.espaco_membros (espaco_id, pessoa_id, papel) values (e, w, 'dono');
  end if;
  if not exists (select 1 from public.espacos where modelo) then
    insert into public.espacos (nome, pessoal, modelo) values ('Modelo dos espaços novos', false, true);
  end if;
end $$;

-- ---------- 3. espaco_id em tudo o que é do sistema da pessoa ----------
create or replace function interno.espaco_do_william() returns uuid language sql stable set search_path = public, pg_temp as $$
  select e.id from public.espacos e where e.pessoal and not e.modelo order by e.criado_em limit 1
$$;
do $$ declare t text; esp uuid := interno.espaco_do_william(); begin
  foreach t in array array['nos','servicos','requisitos','regras_calculo','etapas_modelo','agentes','custos_operacao','dominios','etiquetas','equipes','integracoes','pessoas_custos'] loop
    execute format('alter table public.%I add column if not exists espaco_id uuid references public.espacos(id) on delete cascade', t);
    if esp is not null then execute format('update public.%I set espaco_id = %L where espaco_id is null', t, esp); end if;
    execute format('alter table public.%I alter column espaco_id set default interno.meu_espaco()', t);
    execute format('create index if not exists %I on public.%I (espaco_id)', t || '_espaco_idx', t);
  end loop;
end $$;
-- anexo novo: quem enviou é quem está logado (a regra de inclusão exige isso; a tela não manda o campo)
alter table public.anexos alter column enviado_por set default interno.pessoa_atual();
-- pessoa nova sem login (planejamento) nasce no espaço de quem cria
alter table public.pessoas alter column espaco_id set default interno.meu_espaco();
-- pessoas sem login que já existem (planejamento) ficam no espaço do William
update public.pessoas set espaco_id = interno.espaco_do_william() where auth_user_id is null and espaco_id is null and interno.espaco_do_william() is not null;

-- nomes e códigos passam a ser únicos por espaço (dois usuários podem ter uma etiqueta "Urgente")
do $$ declare c record; begin
  for c in select conrelid::regclass as t, conname from pg_constraint
            where contype = 'u' and conrelid in ('public.etiquetas'::regclass,'public.requisitos'::regclass,'public.servicos'::regclass,'public.agentes'::regclass,'public.etapas_modelo'::regclass,'public.equipes'::regclass,'public.dominios'::regclass)
              and not (conkey @> array[(select attnum from pg_attribute where attrelid = conrelid and attname = 'espaco_id')])
  loop execute format('alter table %s drop constraint %I', c.t, c.conname); end loop;
end $$;
create unique index if not exists etiquetas_espaco_nome_uq on public.etiquetas (espaco_id, nome);
create unique index if not exists requisitos_espaco_nome_uq on public.requisitos (espaco_id, nome);
create unique index if not exists servicos_espaco_codigo_uq on public.servicos (espaco_id, codigo);
create unique index if not exists agentes_espaco_codigo_uq on public.agentes (espaco_id, codigo);
create unique index if not exists etapas_modelo_espaco_chave_uq on public.etapas_modelo (espaco_id, chave);
create unique index if not exists etapas_modelo_espaco_ordem_uq on public.etapas_modelo (espaco_id, ordem);
create unique index if not exists equipes_espaco_nome_uq on public.equipes (espaco_id, nome);
create unique index if not exists dominios_espaco_nome_uq on public.dominios (espaco_id, nome);
-- regras de cálculo: uma vigência por espaço
do $$ declare pk text; begin
  select conname into pk from pg_constraint where conrelid = 'public.regras_calculo'::regclass and contype = 'p';
  if pk is not null and (select array_length(conkey, 1) from pg_constraint where conname = pk and conrelid = 'public.regras_calculo'::regclass) = 1 then
    execute format('alter table public.regras_calculo drop constraint %I', pk);
    alter table public.regras_calculo add primary key (espaco_id, vigente_desde);
  end if;
end $$;
do $$ begin
  alter table public.regras_calculo alter column espaco_id set not null;
exception when others then null; end $$;

-- a Estrutura herda o espaço do pai; a raiz (cliente) nasce no espaço de quem cria
create or replace function interno.espaco_do_no() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.pai_id is not null then
    select espaco_id into new.espaco_id from public.nos where id = new.pai_id;
  elsif tg_op = 'INSERT' then
    new.espaco_id := coalesce(new.espaco_id, interno.meu_espaco());
  else
    new.espaco_id := old.espaco_id;
  end if;
  if new.espaco_id is null then raise exception 'Não foi possível saber o espaço deste ponto da estrutura' using errcode = '23502'; end if;
  if tg_op = 'INSERT' and new.criado_por is null then new.criado_por := interno.pessoa_atual(); end if;
  return new;
end $$;
drop trigger if exists nos_espaco on public.nos;
create trigger nos_espaco before insert or update of pai_id, espaco_id on public.nos for each row execute function interno.espaco_do_no();
do $$ begin alter table public.nos alter column espaco_id set not null; exception when others then null; end $$;
-- mudou o espaço de um ponto (moveu para outro cliente): tudo o que está dentro vai junto
create or replace function interno.espaco_desce() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.espaco_id is distinct from old.espaco_id then
    update public.nos n set espaco_id = new.espaco_id
      from public.nos_ancestrais a where a.ancestral_id = new.id and a.no_id = n.id and a.distancia > 0 and n.espaco_id is distinct from new.espaco_id;
  end if;
  return null;
end $$;
drop trigger if exists nos_espaco_desce on public.nos;
create trigger nos_espaco_desce after update of espaco_id, pai_id on public.nos for each row execute function interno.espaco_desce();
revoke execute on function interno.espaco_desce() from public, anon;

-- ---------- 4. compartilhar: participacoes é o compartilhamento; convites para quem ainda não tem conta ----------
alter table public.participacoes add column if not exists criado_por uuid references public.pessoas(id) on delete set null;
alter table public.participacoes alter column papel set default 'owner';
comment on table public.participacoes is 'Compartilhamento: a pessoa recebe acesso completo ao ponto e a tudo o que está dentro dele.';

create table if not exists public.convites (
  id          uuid primary key default gen_random_uuid(),
  no_id       uuid not null references public.nos(id) on delete cascade,
  email       text not null check (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  criado_por  uuid references public.pessoas(id) on delete set null,
  criado_em   timestamptz not null default now(),
  aceito_em   timestamptz,
  unique (no_id, email)
);
create index if not exists convites_email_idx on public.convites (lower(email)) where aceito_em is null;
comment on table public.convites is 'Compartilhamento com um e-mail que ainda não tem conta. Vira acesso quando a pessoa se cadastra com esse e-mail.';

-- ---------- 5. o que cada pessoa enxerga e em que pode trabalhar ----------
create or replace function interno.eh_master() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$ select false $$;
comment on function interno.eh_master() is 'Não existe mais nível Master (um nível só de usuário). Fica sempre falso por compatibilidade.';

-- nós com acesso de verdade: os do meu espaço e tudo o que está dentro de algo compartilhado comigo
create or replace function interno.nos_visiveis() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select n.id from public.nos n where n.espaco_id in (select interno.meus_espacos())
  union
  select a.no_id from interno.minhas_participacoes() p join public.nos_ancestrais a on a.ancestral_id = p.no_id
$$;
-- nós acima de um compartilhamento: aparecem SÓ com o nome, para situar ("Cliente X › Projeto Y"). Nada do que é deles (ficha, custos, itens) fica visível.
create or replace function interno.nos_caminho() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select a.ancestral_id from interno.minhas_participacoes() p join public.nos_ancestrais a on a.no_id = p.no_id where a.distancia > 0
$$;
create or replace function interno.nos_editaveis() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select n.id from public.nos n where n.espaco_id in (select interno.meus_espacos())
  union
  select a.no_id from interno.minhas_participacoes() p join public.nos_ancestrais a on a.ancestral_id = p.no_id
   where p.papel in ('owner','dev')
$$;
-- pessoas que a pessoa atual pode ver: ela, quem divide espaço, quem divide um ponto compartilhado e quem divide equipe
create or replace function interno.pessoas_visiveis() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select interno.pessoa_atual()
  union select m.pessoa_id from public.espaco_membros m where m.espaco_id in (select interno.meus_espacos())
  union select p.id from public.pessoas p where p.espaco_id in (select interno.meus_espacos())
  union select pa.pessoa_id from public.participacoes pa where pa.no_id in (select interno.nos_visiveis())
  union select m.pessoa_id from public.equipes_membros m join public.equipes e on e.id = m.equipe_id where e.espaco_id in (select interno.meus_espacos())
  union select m2.pessoa_id from public.equipes_membros m1 join public.equipes_membros m2 on m2.equipe_id = m1.equipe_id where m1.pessoa_id = interno.pessoa_atual()
  union select e.dono_id from public.espacos e join public.nos n on n.espaco_id = e.id where (n.id in (select interno.nos_visiveis()) or n.id in (select interno.nos_caminho())) and e.dono_id is not null
$$;

-- ---------- 6. cadastro: pessoa, número de ID, espaço próprio com o modelo padrão e os convites recebidos ----------
create or replace function interno.semear_espaco(p_espaco uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_modelo uuid; r record; novo uuid;
begin
  select e.id into v_modelo from public.espacos e where e.modelo limit 1;
  if v_modelo is null or v_modelo = p_espaco then return; end if;
  insert into public.requisitos (espaco_id, nome, descricao, padrao, ordem)
    select p_espaco, nome, descricao, padrao, ordem from public.requisitos where espaco_id = v_modelo on conflict do nothing;
  insert into public.regras_calculo (espaco_id, vigente_desde, regime, aliq_simples, aliq_presumido, aliq_real, inss_patronal, rat, terceiros, fgts, ferias, terco_ferias,
      decimo_terceiro, multa_fgts, horas_mes, faturavel_pct, margem_pct, contingencia_pct, folga_rateio_pct, manutencao_pct, cambio_usd, complexidade, urgencia)
    select p_espaco, current_date, regime, aliq_simples, aliq_presumido, aliq_real, inss_patronal, rat, terceiros, fgts, ferias, terco_ferias,
      decimo_terceiro, multa_fgts, horas_mes, faturavel_pct, margem_pct, contingencia_pct, folga_rateio_pct, manutencao_pct, cambio_usd, complexidade, urgencia
      from public.regras_calculo where espaco_id = v_modelo order by vigente_desde desc limit 1 on conflict do nothing;
  for r in select * from public.etapas_modelo where espaco_id = v_modelo order by ordem loop
    insert into public.etapas_modelo (espaco_id, chave, nome, explicacao, lente, entrega, ordem) values (p_espaco, r.chave, r.nome, r.explicacao, r.lente, r.entrega, r.ordem)
      on conflict do nothing returning id into novo;
    if novo is not null then
      insert into public.etapas_modelo_itens (etapa_id, texto, modo, obrigatorio, prova_tipo, quem_cumpre, so_terceiros, ordem)
        select novo, texto, modo, obrigatorio, prova_tipo, case when quem_cumpre = 'pessoa_definida' then 'qualquer_um' else quem_cumpre end, so_terceiros, ordem
          from public.etapas_modelo_itens where etapa_id = r.id;
    end if;
  end loop;
end $$;

create or replace function interno.receber_convites(p_pessoa uuid, p_email text) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into public.participacoes (pessoa_id, no_id, papel, criado_por)
    select p_pessoa, c.no_id, 'owner', c.criado_por from public.convites c where lower(c.email) = lower(p_email) and c.aceito_em is null
    on conflict (pessoa_id, no_id) do nothing;
  update public.convites set aceito_em = now() where lower(email) = lower(p_email) and aceito_em is null;
$$;

-- dados pessoais do cadastro (LGPD): numa tabela só do dono. Quem recebe um compartilhamento vê só nome, ID e @usuário.
create or replace function interno.cpf_valido(p text) returns boolean
language plpgsql immutable set search_path = pg_temp as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g'); s int; r int; k int;
begin
  if length(d) <> 11 or d ~ '^(\d)\1{10}$' then return false; end if;
  s := 0; for k in 1..9 loop s := s + substr(d, k, 1)::int * (11 - k); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if; if r <> substr(d, 10, 1)::int then return false; end if;
  s := 0; for k in 1..10 loop s := s + substr(d, k, 1)::int * (12 - k); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if; return r = substr(d, 11, 1)::int;
end $$;
create table if not exists public.pessoas_privado (
  pessoa_id          uuid primary key references public.pessoas(id) on delete cascade,
  nome_completo      text check (nome_completo is null or length(btrim(nome_completo)) between 3 and 160),
  data_nascimento    date check (data_nascimento is null or (data_nascimento > date '1900-01-01' and data_nascimento <= current_date)),
  cpf                text check (cpf is null or (cpf ~ '^\d{11}$' and interno.cpf_valido(cpf))),
  cep                text check (cep is null or cep ~ '^\d{8}$'),
  logradouro         text, numero text, complemento text, bairro text, cidade text,
  uf                 text check (uf is null or uf ~ '^[A-Z]{2}$'),
  uso                text check (uso is null or uso in ('trabalho','estudo','pessoal','outro')),
  cargo              text, empresa text,
  termos_aceitos_em  timestamptz,
  atualizado_em      timestamptz not null default now()
);
create unique index if not exists pessoas_privado_cpf_uq on public.pessoas_privado (cpf) where cpf is not null;
comment on table public.pessoas_privado is 'Dados pessoais do cadastro (LGPD). Só a própria pessoa vê e muda. Nunca aparecem para quem compartilha com ela.';
alter table public.pessoas_privado enable row level security;
drop policy if exists ver on public.pessoas_privado; drop policy if exists muda on public.pessoas_privado; drop policy if exists cria on public.pessoas_privado;
create policy ver on public.pessoas_privado for select to authenticated using (pessoa_id = (select interno.pessoa_atual()));
create policy cria on public.pessoas_privado for insert to authenticated with check (pessoa_id = (select interno.pessoa_atual()));
create policy muda on public.pessoas_privado for update to authenticated using (pessoa_id = (select interno.pessoa_atual())) with check (pessoa_id = (select interno.pessoa_atual()));
revoke all on public.pessoas_privado from anon, public;
grant select, insert, update on public.pessoas_privado to authenticated;
grant all on public.pessoas_privado to service_role;
drop trigger if exists pessoas_privado_carimbo on public.pessoas_privado;
create trigger pessoas_privado_carimbo before update on public.pessoas_privado for each row execute function interno.carimbar_atualizacao();

-- prepara a pessoa de um login (usada pelo gatilho do cadastro e pelo vincular_meu_login)
create or replace function interno.preparar_pessoa(p_auth uuid, p_email text, p_nome text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare pid uuid; esp uuid; nome_ok text;
begin
  select id into pid from public.pessoas where auth_user_id = p_auth;
  if pid is null and p_email is not null then
    update public.pessoas set auth_user_id = p_auth where lower(email) = lower(p_email) and auth_user_id is null returning id into pid;
  end if;
  nome_ok := coalesce(nullif(btrim(p_nome), ''), initcap(split_part(coalesce(p_email, 'usuario'), '@', 1)));
  if pid is null then
    insert into public.pessoas (auth_user_id, nome, email, papel, ativo, espaco_id) values (p_auth, left(nome_ok, 120), lower(p_email), 'dev', true, null) returning id into pid;
  end if;
  if not exists (select 1 from public.espaco_membros where pessoa_id = pid) then
    insert into public.espacos (nome, dono_id, pessoal) values ('Espaço de ' || split_part((select nome from public.pessoas where id = pid), ' ', 1), pid, true) returning id into esp;
    insert into public.espaco_membros (espaco_id, pessoa_id, papel) values (esp, pid, 'dono');
    perform interno.semear_espaco(esp);
  end if;
  if p_email is not null then perform interno.receber_convites(pid, p_email); end if;
  return pid;
end $$;

create or replace function interno.ao_criar_usuario() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare pid uuid; m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb); v_cpf text; nasc date;
begin
  pid := interno.preparar_pessoa(new.id, new.email, coalesce(m ->> 'nome', m ->> 'full_name', m ->> 'name'));
  v_cpf := nullif(regexp_replace(coalesce(m ->> 'cpf', ''), '\D', '', 'g'), '');
  begin nasc := nullif(m ->> 'nascimento', '')::date; exception when others then nasc := null; end;
  if v_cpf is not null and not interno.cpf_valido(v_cpf) then raise exception 'CPF inválido' using errcode = '23514'; end if;
  if v_cpf is not null and exists (select 1 from public.pessoas_privado p where p.cpf = v_cpf and p.pessoa_id <> pid) then
    raise exception 'Já existe uma conta com este CPF' using errcode = '23505';
  end if;
  if m ? 'cpf' or m ? 'nascimento' or m ? 'uso' then
    insert into public.pessoas_privado (pessoa_id, nome_completo, data_nascimento, cpf, cep, logradouro, numero, complemento, bairro, cidade, uf, uso, cargo, empresa, termos_aceitos_em)
    values (pid, nullif(btrim(m ->> 'nome'), ''), nasc, v_cpf, nullif(regexp_replace(coalesce(m ->> 'cep', ''), '\D', '', 'g'), ''), nullif(btrim(m ->> 'logradouro'), ''),
            nullif(btrim(m ->> 'numero'), ''), nullif(btrim(m ->> 'complemento'), ''), nullif(btrim(m ->> 'bairro'), ''), nullif(btrim(m ->> 'cidade'), ''),
            nullif(upper(btrim(m ->> 'uf')), ''), nullif(m ->> 'uso', ''), nullif(btrim(m ->> 'cargo'), ''), nullif(btrim(m ->> 'empresa'), ''),
            case when (m ->> 'termos') = 'sim' then now() end)
    on conflict (pessoa_id) do nothing;
    -- os dados pessoais saem dos dados do login (senão iriam dentro de todo token de acesso)
    begin
      update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - array['cpf','nascimento','cep','logradouro','numero','complemento','bairro','cidade','uf','cargo','empresa','uso','termos']
       where id = new.id;
    exception when others then null; end;
  end if;
  return new;
end $$;
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'raw_user_meta_data') then
    -- cria só se ainda não houver um gatilho chamando interno.ao_criar_usuario (em bancos antigos ele existe com outro nome,
    -- que o Supabase não deixa trocar porque auth.users é dele); assim nunca roda duas vezes por cadastro
    if not exists (select 1 from pg_trigger t join pg_proc f on f.oid = t.tgfoid join pg_namespace n on n.oid = f.pronamespace
                    where t.tgrelid = 'auth.users'::regclass and n.nspname = 'interno' and f.proname = 'ao_criar_usuario') then
      execute 'create trigger ciclodev_ao_criar_usuario after insert on auth.users for each row execute function interno.ao_criar_usuario()';
    end if;
  end if;
end $$;

-- o login da tela: garante a pessoa e devolve quem ela é (com o número de ID e o espaço)
drop function if exists public.vincular_meu_login();
drop function if exists interno.vincular_meu_login();
create or replace function interno.vincular_meu_login() returns table (pessoa_id uuid, nome text, papel text, numero bigint, espaco_id uuid, espaco_nome text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare pid uuid;
begin
  if auth.uid() is null then return; end if;
  pid := interno.preparar_pessoa(auth.uid(), lower(auth.jwt() ->> 'email'), auth.jwt() -> 'user_metadata' ->> 'nome');
  return query select p.id, p.nome, 'master'::text, p.numero, e.id, e.nome
    from public.pessoas p left join public.espacos e on e.id = interno.meu_espaco() where p.id = pid;
end $$;
create or replace function public.vincular_meu_login() returns table (pessoa_id uuid, nome text, papel text, numero bigint, espaco_id uuid, espaco_nome text)
language sql security invoker set search_path = public, pg_temp as $$ select * from interno.vincular_meu_login() $$;

-- achar uma pessoa pelo número de ID (ou pelo @usuario) para compartilhar; devolve só o necessário
create or replace function interno.buscar_pessoa(p_busca text) returns table (id uuid, nome text, numero bigint, usuario text)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id, p.nome, p.numero, p.usuario from public.pessoas p
   where p.ativo and p.auth_user_id is not null and interno.pessoa_atual() is not null
     and (p.numero::text = regexp_replace(btrim(p_busca), '^#', '') or lower(p.usuario) = lower(regexp_replace(btrim(p_busca), '^@', '')))
   limit 1
$$;
create or replace function public.buscar_pessoa(p_busca text) returns table (id uuid, nome text, numero bigint, usuario text)
language sql stable security invoker set search_path = public, pg_temp as $$ select * from interno.buscar_pessoa(p_busca) $$;

-- mover na estrutura: quem pode trabalhar nos dois pontos
create or replace function interno.mover_no(p_no uuid, p_novo_pai uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_no not in (select interno.nos_editaveis()) or (p_novo_pai is not null and p_novo_pai not in (select interno.nos_editaveis())) then
    raise exception 'Sem acesso para mover este ponto' using errcode = '42501';
  end if;
  update public.nos set pai_id = p_novo_pai where id = p_no;
end $$;
create or replace function interno.dispensar_etapa(p_no uuid, p_item_modelo uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_no not in (select interno.nos_editaveis()) then raise exception 'Sem acesso a este ponto' using errcode = '42501'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Escreva o motivo da dispensa' using errcode = '23514'; end if;
  insert into public.etapas_nos (no_id, item_modelo_id, situacao, cumprido_por, cumprido_em, motivo_dispensa)
  values (p_no, p_item_modelo, 'dispensado', interno.pessoa_atual(), now(), p_motivo)
  on conflict (no_id, item_modelo_id) do update set situacao = 'dispensado', cumprido_por = excluded.cumprido_por, cumprido_em = now(), motivo_dispensa = excluded.motivo_dispensa;
end $$;

-- ninguém muda pela tela o próprio número de ID, o login, o e-mail ou o espaço de origem
create or replace function interno.proteger_pessoa() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if current_user in ('authenticated','anon') then
    new.numero := old.numero; new.auth_user_id := old.auth_user_id; new.espaco_id := old.espaco_id;
    if old.auth_user_id is not null then new.email := old.email; new.papel := old.papel; end if;
  end if;
  return new;
end $$;
drop trigger if exists pessoas_proteger on public.pessoas;
create trigger pessoas_proteger before update on public.pessoas for each row execute function interno.proteger_pessoa();

-- ---------- 7. regras de acesso (RLS) ----------
-- apaga as regras antigas das tabelas que dependiam do nível Master e das que mudam aqui
do $$ declare r record; begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' and tablename in (
    'nos','clientes','projetos','aplicacoes','frentes','participacoes','pessoas','pessoas_custos','espacos','espaco_membros','convites',
    'etiquetas','etiquetas_nos','status_fluxo','requisitos','servicos','servicos_cobranca','servicos_requisitos','regras_calculo',
    'custos_operacao','custos_tecnicos','custos_uso','receitas','slas','automacoes','automacoes_execucoes','campos_personalizados',
    'etapas_modelo','etapas_modelo_itens','etapas_nos','provas','agentes','agentes_fontes','agentes_ferramentas','agentes_avaliacoes','agentes_execucoes',
    'dominios','dominios_registros','segredos_catalogo','cambio','equipes','equipes_membros','equipes_nos','integracoes','vinculos_externos','integracoes_log',
    'boards_config','boards_colunas','boards_colunas_status','comentarios_reacoes')
  loop execute format('drop policy %I on public.%I', r.policyname, r.tablename); end loop;
  -- regras soltas que usavam o Master
  execute 'drop policy if exists master_apaga on public.itens';
  execute 'drop policy if exists time_apaga on public.itens';
  execute 'drop policy if exists dono_apaga on public.anexos';
  execute 'drop policy if exists autor_apaga on public.comentarios';
  execute 'drop policy if exists autor_muda on public.comentarios';
end $$;

alter table public.espacos enable row level security;
alter table public.espaco_membros enable row level security;
alter table public.convites enable row level security;

-- Estrutura
create policy ver on public.nos for select to authenticated using (id in (select interno.nos_visiveis()) or id in (select interno.nos_caminho()));
create policy cria on public.nos for insert to authenticated with check (
  (pai_id is null and espaco_id in (select interno.meus_espacos())) or (pai_id in (select interno.nos_editaveis())));
create policy muda on public.nos for update to authenticated using (id in (select interno.nos_editaveis())) with check (id in (select interno.nos_editaveis()) or pai_id in (select interno.nos_editaveis()));
-- apaga: o que é do meu espaço, ou o que está DENTRO de algo compartilhado comigo (o ponto compartilhado em si, só o dono apaga)
create policy apaga on public.nos for delete to authenticated using (
  espaco_id in (select interno.meus_espacos())
  or exists (select 1 from interno.minhas_participacoes() p join public.nos_ancestrais a on a.ancestral_id = p.no_id where a.no_id = nos.id and a.distancia > 0));
do $$ declare t text; begin
  foreach t in array array['clientes','projetos','aplicacoes','frentes'] loop
    execute format('create policy ver on public.%I for select to authenticated using (no_id in (select interno.nos_visiveis()))', t);
    execute format('create policy cria on public.%I for insert to authenticated with check (no_id in (select interno.nos_editaveis()))', t);
    execute format('create policy muda on public.%I for update to authenticated using (no_id in (select interno.nos_editaveis())) with check (no_id in (select interno.nos_editaveis()))', t);
    execute format('create policy apaga on public.%I for delete to authenticated using (no_id in (select interno.nos_editaveis()))', t);
  end loop;
end $$;

-- tudo o que é de um ponto da estrutura: vê quem vê o ponto; muda quem trabalha nele
do $$ declare t text; begin
  foreach t in array array['etiquetas_nos','slas','automacoes','campos_personalizados','custos_tecnicos','receitas','etapas_nos','provas','segredos_catalogo','boards_config','boards_colunas'] loop
    execute format('create policy ver on public.%I for select to authenticated using (no_id in (select interno.nos_visiveis()))', t);
    execute format('create policy cria on public.%I for insert to authenticated with check (no_id in (select interno.nos_editaveis()))', t);
    execute format('create policy muda on public.%I for update to authenticated using (no_id in (select interno.nos_editaveis())) with check (no_id in (select interno.nos_editaveis()))', t);
    execute format('create policy apaga on public.%I for delete to authenticated using (no_id in (select interno.nos_editaveis()))', t);
  end loop;
end $$;
create policy ver on public.status_fluxo for select to authenticated using (no_id is null or no_id in (select interno.nos_visiveis()));
create policy cria on public.status_fluxo for insert to authenticated with check (no_id is not null and no_id in (select interno.nos_editaveis()));
create policy muda on public.status_fluxo for update to authenticated using (no_id is not null and no_id in (select interno.nos_editaveis())) with check (no_id is not null and no_id in (select interno.nos_editaveis()));
create policy apaga on public.status_fluxo for delete to authenticated using (no_id is not null and no_id in (select interno.nos_editaveis()));
create policy ver on public.custos_uso for select to authenticated using (exists (select 1 from public.custos_tecnicos c where c.id = custo_id));
create policy muda on public.custos_uso for all to authenticated using (exists (select 1 from public.custos_tecnicos c where c.id = custo_id and c.no_id in (select interno.nos_editaveis())))
  with check (exists (select 1 from public.custos_tecnicos c where c.id = custo_id and c.no_id in (select interno.nos_editaveis())));
create policy ver on public.boards_colunas_status for select to authenticated using (exists (select 1 from public.boards_colunas c where c.id = coluna_id));
create policy cria on public.boards_colunas_status for insert to authenticated with check (exists (select 1 from public.boards_colunas c where c.id = coluna_id and c.no_id in (select interno.nos_editaveis())));
create policy muda on public.boards_colunas_status for update to authenticated using (exists (select 1 from public.boards_colunas c where c.id = coluna_id and c.no_id in (select interno.nos_editaveis())))
  with check (exists (select 1 from public.boards_colunas c where c.id = coluna_id and c.no_id in (select interno.nos_editaveis())));
grant update on public.boards_colunas_status to authenticated;
-- itens_pessoas e etiquetas_itens também são gravadas com upsert: precisam de UPDATE (regra e permissão)
drop policy if exists muda_altera on public.itens_pessoas; drop policy if exists muda_altera on public.etiquetas_itens;
create policy muda_altera on public.itens_pessoas for update to authenticated
  using (exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())) or pessoa_id = (select interno.pessoa_atual()))
  with check (exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())) or (papel in ('observador','voto') and pessoa_id = (select interno.pessoa_atual())));
create policy muda_altera on public.etiquetas_itens for update to authenticated
  using (exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())))
  with check (exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())));
grant update on public.itens_pessoas, public.etiquetas_itens to authenticated;   -- a tela grava as colunas com upsert, que precisa de UPDATE
create policy apaga on public.boards_colunas_status for delete to authenticated using (exists (select 1 from public.boards_colunas c where c.id = coluna_id and c.no_id in (select interno.nos_editaveis())));
create policy ver on public.automacoes_execucoes for select to authenticated using (exists (select 1 from public.automacoes a where a.id = automacao_id));

-- itens, comentários e anexos: quem trabalha no ponto também apaga
create policy time_apaga on public.itens for delete to authenticated using (frente_id in (select interno.nos_editaveis()));
create policy autor_muda on public.comentarios for update to authenticated using (autor_id = (select interno.pessoa_atual())) with check (autor_id = (select interno.pessoa_atual()));
create policy autor_apaga on public.comentarios for delete to authenticated using (autor_id = (select interno.pessoa_atual())
  or (item_id is not null and exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())))
  or (no_id is not null and no_id in (select interno.nos_editaveis())));
create policy dono_apaga on public.anexos for delete to authenticated using (enviado_por = (select interno.pessoa_atual())
  or (item_id is not null and exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())))
  or (no_id is not null and no_id in (select interno.nos_editaveis())));
create policy ver on public.comentarios_reacoes for select to authenticated using (exists (select 1 from public.comentarios c where c.id = comentario_id));
create policy cria on public.comentarios_reacoes for insert to authenticated with check (pessoa_id = (select interno.pessoa_atual()) and exists (select 1 from public.comentarios c where c.id = comentario_id));
create policy apaga on public.comentarios_reacoes for delete to authenticated using (pessoa_id = (select interno.pessoa_atual()));

-- o que é do sistema da pessoa (Catalog, Costs, Settings, Agent Studio, domínios, etiquetas, equipes, integrações)
do $$ declare t text; begin
  foreach t in array array['servicos','requisitos','regras_calculo','etapas_modelo','agentes','custos_operacao','dominios','etiquetas','equipes','integracoes','pessoas_custos'] loop
    execute format('create policy ver on public.%I for select to authenticated using (espaco_id in (select interno.meus_espacos()))', t);
    execute format('create policy cria on public.%I for insert to authenticated with check (espaco_id in (select interno.meus_espacos()))', t);
    execute format('create policy muda on public.%I for update to authenticated using (espaco_id in (select interno.meus_espacos())) with check (espaco_id in (select interno.meus_espacos()))', t);
    execute format('create policy apaga on public.%I for delete to authenticated using (espaco_id in (select interno.meus_espacos()))', t);
  end loop;
end $$;
-- quem recebeu um ponto compartilhado vê o nome das etiquetas e dos serviços usados nele
create policy ver_compartilhado on public.etiquetas for select to authenticated using (
  exists (select 1 from public.etiquetas_nos l where l.etiqueta_id = etiquetas.id and l.no_id in (select interno.nos_visiveis()))
  or exists (select 1 from public.etiquetas_itens l join public.itens i on i.id = l.item_id where l.etiqueta_id = etiquetas.id));
create policy ver_compartilhado on public.servicos for select to authenticated using (
  exists (select 1 from public.aplicacoes a where a.servico_id = servicos.id and a.no_id in (select interno.nos_visiveis())));
-- filhos das tabelas do espaço: seguem o pai
create policy ver on public.servicos_cobranca for select to authenticated using (exists (select 1 from public.servicos s where s.id = servico_id));
create policy muda on public.servicos_cobranca for all to authenticated using (exists (select 1 from public.servicos s where s.id = servico_id and s.espaco_id in (select interno.meus_espacos())))
  with check (exists (select 1 from public.servicos s where s.id = servico_id and s.espaco_id in (select interno.meus_espacos())));
create policy ver on public.servicos_requisitos for select to authenticated using (exists (select 1 from public.servicos s where s.id = servico_id));
create policy muda on public.servicos_requisitos for all to authenticated using (exists (select 1 from public.servicos s where s.id = servico_id and s.espaco_id in (select interno.meus_espacos())))
  with check (exists (select 1 from public.servicos s where s.id = servico_id and s.espaco_id in (select interno.meus_espacos())));
create policy ver on public.etapas_modelo_itens for select to authenticated using (exists (select 1 from public.etapas_modelo e where e.id = etapa_id));
create policy muda on public.etapas_modelo_itens for all to authenticated using (exists (select 1 from public.etapas_modelo e where e.id = etapa_id and e.espaco_id in (select interno.meus_espacos())))
  with check (exists (select 1 from public.etapas_modelo e where e.id = etapa_id and e.espaco_id in (select interno.meus_espacos())));
do $$ declare t text; begin
  foreach t in array array['agentes_fontes','agentes_ferramentas','agentes_avaliacoes'] loop
    execute format('create policy ver on public.%I for select to authenticated using (exists (select 1 from public.agentes a where a.id = agente_id))', t);
    execute format('create policy muda on public.%I for all to authenticated using (exists (select 1 from public.agentes a where a.id = agente_id and a.espaco_id in (select interno.meus_espacos()))) with check (exists (select 1 from public.agentes a where a.id = agente_id and a.espaco_id in (select interno.meus_espacos())))', t);
  end loop;
end $$;
create policy ver on public.agentes_execucoes for select to authenticated using (exists (select 1 from public.agentes a where a.id = agente_id));
create policy ver on public.dominios_registros for select to authenticated using (exists (select 1 from public.dominios d where d.id = dominio_id));
create policy muda on public.dominios_registros for all to authenticated using (exists (select 1 from public.dominios d where d.id = dominio_id and d.espaco_id in (select interno.meus_espacos())))
  with check (exists (select 1 from public.dominios d where d.id = dominio_id and d.espaco_id in (select interno.meus_espacos())));
create policy ver on public.vinculos_externos for select to authenticated using (exists (select 1 from public.integracoes i where i.id = integracao_id));
create policy muda on public.vinculos_externos for all to authenticated using (exists (select 1 from public.integracoes i where i.id = integracao_id and i.espaco_id in (select interno.meus_espacos())))
  with check (exists (select 1 from public.integracoes i where i.id = integracao_id and i.espaco_id in (select interno.meus_espacos())));
create policy ver on public.integracoes_log for select to authenticated using (exists (select 1 from public.integracoes i where i.id = integracao_id));
create policy ver on public.cambio for select to authenticated using (true);

-- equipes: membros veem a equipe; quem é do espaço da equipe monta
-- (as funções abaixo leem as equipes sem passar pelas regras, para as regras de equipes e membros não chamarem uma à outra sem fim)
create or replace function interno.equipes_do_meu_espaco() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select e.id from public.equipes e where e.espaco_id in (select interno.meus_espacos())
$$;
create or replace function interno.minhas_equipes() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select interno.equipes_do_meu_espaco()
  union select m.equipe_id from public.equipes_membros m where m.pessoa_id = interno.pessoa_atual()
$$;
revoke execute on function interno.equipes_do_meu_espaco(), interno.minhas_equipes() from public, anon;
grant execute on function interno.equipes_do_meu_espaco(), interno.minhas_equipes() to authenticated, service_role;
create policy ver_membro on public.equipes for select to authenticated using (id in (select interno.minhas_equipes()));
create policy ver on public.equipes_membros for select to authenticated using (equipe_id in (select interno.minhas_equipes()));
create policy muda on public.equipes_membros for all to authenticated using (equipe_id in (select interno.equipes_do_meu_espaco()))
  with check (equipe_id in (select interno.equipes_do_meu_espaco()));
create policy ver on public.equipes_nos for select to authenticated using (no_id in (select interno.nos_visiveis()) or equipe_id in (select interno.equipes_do_meu_espaco()));
create policy cria on public.equipes_nos for insert to authenticated with check (no_id in (select interno.nos_editaveis()) and equipe_id in (select interno.equipes_do_meu_espaco()));
create policy muda on public.equipes_nos for update to authenticated using (no_id in (select interno.nos_editaveis())) with check (no_id in (select interno.nos_editaveis()));
create policy apaga on public.equipes_nos for delete to authenticated using (no_id in (select interno.nos_editaveis()) or equipe_id in (select interno.equipes_do_meu_espaco()));

-- compartilhar: quem trabalha no ponto compartilha e tira; quem recebeu pode sair
create policy ver on public.participacoes for select to authenticated using (pessoa_id = (select interno.pessoa_atual()) or no_id in (select interno.nos_visiveis()));
create policy cria on public.participacoes for insert to authenticated with check (no_id in (select interno.nos_editaveis()));
create policy muda on public.participacoes for update to authenticated using (no_id in (select interno.nos_editaveis())) with check (no_id in (select interno.nos_editaveis()));
create policy apaga on public.participacoes for delete to authenticated using (no_id in (select interno.nos_editaveis()) or pessoa_id = (select interno.pessoa_atual()));
create policy ver on public.convites for select to authenticated using (no_id in (select interno.nos_editaveis()));
create policy cria on public.convites for insert to authenticated with check (no_id in (select interno.nos_editaveis()));
create policy apaga on public.convites for delete to authenticated using (no_id in (select interno.nos_editaveis()));

-- pessoas: cada um mexe no próprio perfil; pessoas sem login (planejamento) são do espaço
create policy ver on public.pessoas for select to authenticated using (id in (select interno.pessoas_visiveis()));
create policy cria on public.pessoas for insert to authenticated with check (auth_user_id is null and espaco_id in (select interno.meus_espacos()));
create policy muda on public.pessoas for update to authenticated using (id = (select interno.pessoa_atual()) or (auth_user_id is null and espaco_id in (select interno.meus_espacos())))
  with check (id = (select interno.pessoa_atual()) or (auth_user_id is null and espaco_id in (select interno.meus_espacos())));
create policy apaga on public.pessoas for delete to authenticated using (auth_user_id is null and espaco_id in (select interno.meus_espacos()));
alter table public.pessoas alter column espaco_id set default interno.meu_espaco();

-- espaços
create policy ver on public.espacos for select to authenticated using (id in (select interno.meus_espacos()) or dono_id in (select interno.pessoas_visiveis()));
create policy muda on public.espacos for update to authenticated using (dono_id = (select interno.pessoa_atual())) with check (dono_id = (select interno.pessoa_atual()));
create policy ver on public.espaco_membros for select to authenticated using (espaco_id in (select interno.meus_espacos()));
create policy muda on public.espaco_membros for all to authenticated
  using (exists (select 1 from public.espacos e where e.id = espaco_id and e.dono_id = (select interno.pessoa_atual())))
  with check (exists (select 1 from public.espacos e where e.id = espaco_id and e.dono_id = (select interno.pessoa_atual())));

-- ---------- 8. permissões (GRANT) e funções ----------
revoke all on public.espacos, public.espaco_membros, public.convites from anon, public;
grant select, update on public.espacos to authenticated;
grant select, insert, update, delete on public.espaco_membros, public.convites to authenticated;
grant all on public.espacos, public.espaco_membros, public.convites to service_role;
grant usage, select on sequence public.pessoas_numero_seq to authenticated, service_role;
grant select, insert, update, delete on public.cambio to authenticated;
revoke execute on function interno.nos_caminho(), interno.meus_espacos(), interno.meu_espaco(), interno.pessoas_visiveis(), interno.semear_espaco(uuid), interno.receber_convites(uuid, text),
  interno.preparar_pessoa(uuid, text, text), interno.ao_criar_usuario(), interno.cpf_valido(text), interno.vincular_meu_login(), interno.buscar_pessoa(text), interno.espaco_do_no(), interno.espaco_do_william() from public, anon;
grant execute on function interno.nos_caminho(), interno.meus_espacos(), interno.meu_espaco(), interno.pessoas_visiveis(), interno.vincular_meu_login(), interno.buscar_pessoa(text), interno.cpf_valido(text) to authenticated, service_role;
grant execute on function public.vincular_meu_login(), public.buscar_pessoa(text) to authenticated;
revoke execute on function public.vincular_meu_login(), public.buscar_pessoa(text) from anon, public;
-- relatórios do banco (bi) leem sem as regras por linha: com muitos usuários, ficam fechados para a tela (ela não usa)
do $$ declare f record; begin
  for f in select p.oid::regprocedure as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'bi' and p.prokind = 'f' loop
    execute format('revoke execute on function %s from authenticated, anon, public', f.fn);
  end loop;
  for f in select p.oid::regprocedure as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('painel','financeiro','calcular_preco','ficha','carga','queima_sprint') loop
    execute format('revoke execute on function %s from authenticated, anon, public', f.fn);
  end loop;
end $$;
do $$ begin execute 'revoke all on all tables in schema bi from authenticated, anon'; exception when others then null; end $$;

-- histórico
do $$ declare t text; begin
  foreach t in array array['espacos','espaco_membros','participacoes','convites'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_auditoria', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function auditoria.registrar()', t || '_auditoria', t);
  end loop;
end $$;

-- ---------- 9. o espaço Modelo nasce com a cópia do padrão atual (etapas, requisitos e regras de cálculo) ----------
do $$ declare v_modelo uuid; w uuid := interno.espaco_do_william(); r record; novo uuid; begin
  select e.id into v_modelo from public.espacos e where e.modelo;
  if v_modelo is null or w is null then return; end if;
  if not exists (select 1 from public.etapas_modelo where espaco_id = v_modelo) then
    insert into public.requisitos (espaco_id, nome, descricao, padrao, ordem) select v_modelo, nome, descricao, padrao, ordem from public.requisitos where espaco_id = w on conflict do nothing;
    insert into public.regras_calculo (espaco_id, vigente_desde, regime, aliq_simples, aliq_presumido, aliq_real, inss_patronal, rat, terceiros, fgts, ferias, terco_ferias,
        decimo_terceiro, multa_fgts, horas_mes, faturavel_pct, margem_pct, contingencia_pct, folga_rateio_pct, manutencao_pct, cambio_usd, complexidade, urgencia)
      select v_modelo, vigente_desde, regime, aliq_simples, aliq_presumido, aliq_real, inss_patronal, rat, terceiros, fgts, ferias, terco_ferias,
        decimo_terceiro, multa_fgts, horas_mes, faturavel_pct, margem_pct, contingencia_pct, folga_rateio_pct, manutencao_pct, cambio_usd, complexidade, urgencia
        from public.regras_calculo where espaco_id = w order by vigente_desde desc limit 1 on conflict do nothing;
    for r in select * from public.etapas_modelo where espaco_id = w order by ordem loop
      insert into public.etapas_modelo (espaco_id, chave, nome, explicacao, lente, entrega, ordem) values (v_modelo, r.chave, r.nome, r.explicacao, r.lente, r.entrega, r.ordem) returning id into novo;
      insert into public.etapas_modelo_itens (etapa_id, texto, modo, obrigatorio, prova_tipo, quem_cumpre, so_terceiros, ordem)
        select novo, texto, modo, obrigatorio, prova_tipo, case when quem_cumpre = 'pessoa_definida' then 'qualquer_um' else quem_cumpre end, so_terceiros, ordem from public.etapas_modelo_itens where etapa_id = r.id;
    end loop;
  end if;
end $$;
