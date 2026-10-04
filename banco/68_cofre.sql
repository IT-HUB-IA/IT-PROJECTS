-- =====================================================================
-- Parte 68 · Cofre: cada pessoa guarda senhas, credenciais, chaves de API, chaves SSH, certificados e notas seguras.
-- Regras (nenhuma pode ser quebrada pela API, só pelas funções abaixo):
--   1. O VALOR NUNCA FICA EM TABELA COMUM. public.cofre_itens só tem o que pode aparecer numa lista (nome, tipo, endereço,
--      descrição pública). Usuário, senha, chave etc. vão inteiros, como um JSON, para o Vault do Supabase (criptografado),
--      e a ligação item -> segredo fica em interno.cofre_vault, que ninguém de fora lê. A descrição do segredo no Vault
--      (que não é criptografada) leva só o id, nunca o nome do item.
--   2. QUEM VÊ: o dono e as pessoas com quem ele compartilhou (ver ou editar). Nem o dono do espaço vê o cofre dos outros.
--      Item na lixeira: só o dono.
--   3. NINGUÉM GRAVA DIRETO: a tela só pode LER a lista (regra de linha); incluir, mudar, compartilhar, revelar e apagar
--      passam por funções que conferem a permissão. Sem permissão a resposta é a mesma de "não existe" (não confirma nada).
--   4. TODA revelação e cópia fica registrada (cofre_registros, só inclusão). No máximo 60 revelações por pessoa a cada
--      10 minutos (contra quem tente puxar tudo de uma vez).
--   5. Apagou o item (ou a pessoa, ou o espaço): o segredo sai do Vault junto.
-- Plano de volta: 68_cofre_VOLTA.sql.
-- =====================================================================
set client_min_messages = warning;

create table if not exists public.cofre_itens (
  id            uuid primary key default gen_random_uuid(),
  espaco_id     uuid not null references public.espacos(id) on delete cascade,
  dono_id       uuid not null references public.pessoas(id) on delete cascade,
  no_id         uuid references public.nos(id) on delete set null,      -- só organização (a que projeto ou aplicação se refere); não dá acesso a ninguém
  tipo          text not null check (tipo in ('senha', 'chave_api', 'credencial', 'nota', 'chave_ssh', 'certificado', 'banco', 'outro')),
  nome          text not null check (length(btrim(nome)) between 1 and 160),
  url           text check (url is null or length(url) <= 500),
  descricao     text check (descricao is null or length(descricao) <= 2000),   -- pública para quem vê o item; nunca o segredo
  etiquetas     text[] not null default '{}' check (cardinality(etiquetas) <= 20),
  trocar_em     date,                                                    -- lembrete de troca da senha ou da chave
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.pessoas(id) on delete set null,
  excluido_em   timestamptz
);
comment on table public.cofre_itens is 'Cofre: só o que pode aparecer numa lista. O valor (usuário, senha, chave...) fica no Vault; ver interno.cofre_vault e logica.cofre_revelar.';
create index if not exists cofre_itens_dono_idx on public.cofre_itens (dono_id);
create index if not exists cofre_itens_espaco_idx on public.cofre_itens (espaco_id);
create index if not exists cofre_itens_no_idx on public.cofre_itens (no_id);

create table if not exists public.cofre_acessos (
  item_id   uuid not null references public.cofre_itens(id) on delete cascade,
  pessoa_id uuid not null references public.pessoas(id) on delete cascade,
  nivel     text not null check (nivel in ('ver', 'editar')),
  dado_por  uuid references public.pessoas(id) on delete set null,
  dado_em   timestamptz not null default now(),
  primary key (item_id, pessoa_id)
);
create index if not exists cofre_acessos_pessoa_idx on public.cofre_acessos (pessoa_id);
create index if not exists cofre_acessos_dado_por_idx on public.cofre_acessos (dado_por);

create table if not exists public.cofre_registros (
  id        bigint generated always as identity primary key,
  item_id   uuid not null references public.cofre_itens(id) on delete cascade,
  pessoa_id uuid references public.pessoas(id) on delete set null,
  acao      text not null check (acao in ('criou', 'revelou', 'copiou', 'alterou', 'alterou_segredo', 'compartilhou', 'tirou_acesso', 'lixeira', 'restaurou')),
  detalhe   text check (detalhe is null or length(detalhe) <= 300),
  em        timestamptz not null default now()
);
create index if not exists cofre_registros_item_idx on public.cofre_registros (item_id, em desc);
create index if not exists cofre_registros_pessoa_idx on public.cofre_registros (pessoa_id, em desc);
create index if not exists cofre_itens_atualizado_por_idx on public.cofre_itens (atualizado_por);

-- a ligação com o Vault: fora da API, ninguém lê
create table if not exists interno.cofre_vault (
  item_id    uuid primary key references public.cofre_itens(id) on delete cascade,
  segredo_id uuid not null
);
alter table interno.cofre_vault enable row level security;
revoke all on interno.cofre_vault from public, anon, authenticated, service_role;

/* ---------- quem pode o quê ---------- */
-- 'dono', 'editar', 'ver' ou nulo (sem acesso). Item na lixeira: só o dono.
create or replace function interno.cofre_nivel(p_item uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select case when i.dono_id = interno.pessoa_atual() then 'dono'
              when i.excluido_em is null then (select a.nivel from public.cofre_acessos a where a.item_id = i.id and a.pessoa_id = interno.pessoa_atual())
         end
    from public.cofre_itens i where i.id = p_item
$$;
revoke all on function interno.cofre_nivel(uuid) from public, anon;
grant execute on function interno.cofre_nivel(uuid) to authenticated;

-- pessoas com quem o dono pode compartilhar: as do mesmo espaço (membros ou quem participa de algum ponto dele)
create or replace function interno.cofre_pode_receber(p_espaco uuid, p_pessoa uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.pessoas p where p.id = p_pessoa and p.ativo)
     and (exists (select 1 from public.espaco_membros m where m.espaco_id = p_espaco and m.pessoa_id = p_pessoa)
          or exists (select 1 from public.pessoas p where p.id = p_pessoa and p.espaco_id = p_espaco)
          or exists (select 1 from public.participacoes x join public.nos n on n.id = x.no_id where x.pessoa_id = p_pessoa and n.espaco_id = p_espaco))
$$;
revoke all on function interno.cofre_pode_receber(uuid, uuid) from public, anon, authenticated, service_role;

-- o item apagado leva o segredo do Vault junto (também quando a pessoa ou o espaço são apagados)
create or replace function interno.cofre_apagar_segredo() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare sid uuid;
begin
  select v.segredo_id into sid from interno.cofre_vault v where v.item_id = old.id;
  if sid is not null then delete from vault.secrets where id = sid; end if;
  return old;
end $$;
revoke all on function interno.cofre_apagar_segredo() from public, anon, authenticated, service_role;
drop trigger if exists cofre_apagar_segredo on public.cofre_itens;
create trigger cofre_apagar_segredo before delete on public.cofre_itens for each row execute function interno.cofre_apagar_segredo();

-- o segredo: um objeto JSON (usuário, senha, chave, notas, campos extras...), até 64 KB
create or replace function interno.cofre_segredo_ok(p jsonb) returns void
language plpgsql immutable set search_path = public, pg_temp as $$
begin
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'O segredo precisa ser um conjunto de campos' using errcode = '22023'; end if;
  if octet_length(p::text) > 65536 then raise exception 'O segredo passou de 64 KB' using errcode = '22023'; end if;
end $$;
revoke all on function interno.cofre_segredo_ok(jsonb) from public, anon, authenticated, service_role;

-- os campos públicos (lista): só os conhecidos, conferidos
create or replace function interno.cofre_meta_ok(p jsonb) returns void
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare k text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'Dados do item inválidos' using errcode = '22023'; end if;
  for k in select jsonb_object_keys(p) loop
    if k not in ('tipo', 'nome', 'url', 'descricao', 'etiquetas', 'trocar_em', 'no_id') then raise exception 'Campo desconhecido: %', k using errcode = '22023'; end if;
  end loop;
  if p ? 'etiquetas' and jsonb_typeof(p->'etiquetas') <> 'array' then raise exception 'Etiquetas inválidas' using errcode = '22023'; end if;
  if p ? 'etiquetas' and exists (select 1 from jsonb_array_elements(p->'etiquetas') e where jsonb_typeof(e) <> 'string' or length(e #>> '{}') > 40) then raise exception 'Etiqueta inválida (texto até 40 letras)' using errcode = '22023'; end if;
  if nullif(p->>'no_id', '') is not null and (p->>'no_id')::uuid not in (select interno.nos_visiveis()) then raise exception 'Ponto da estrutura não encontrado' using errcode = '42501'; end if;
end $$;
revoke all on function interno.cofre_meta_ok(jsonb) from public, anon, authenticated, service_role;

create or replace function interno.cofre_anotar(p_item uuid, p_acao text, p_detalhe text default null) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into public.cofre_registros (item_id, pessoa_id, acao, detalhe) values (p_item, interno.pessoa_atual(), p_acao, left(p_detalhe, 300))
$$;
revoke all on function interno.cofre_anotar(uuid, text, text) from public, anon, authenticated, service_role;

/* ---------- regras de linha: a tela só LÊ (lista); o resto é pelas funções ---------- */
alter table public.cofre_itens enable row level security;
alter table public.cofre_acessos enable row level security;
alter table public.cofre_registros enable row level security;
revoke all on public.cofre_itens, public.cofre_acessos, public.cofre_registros from public, anon, authenticated, service_role;
grant select on public.cofre_itens, public.cofre_acessos, public.cofre_registros to authenticated;
drop policy if exists ver on public.cofre_itens;
drop policy if exists ver on public.cofre_acessos;
drop policy if exists ver on public.cofre_registros;
create policy ver on public.cofre_itens for select to authenticated using (interno.cofre_nivel(id) is not null);
create policy ver on public.cofre_acessos for select to authenticated using (interno.cofre_nivel(item_id) is not null);
-- o histórico: o dono vê tudo do item; os outros, só o que eles mesmos fizeram
create policy ver on public.cofre_registros for select to authenticated using (interno.cofre_nivel(item_id) = 'dono' or pessoa_id = interno.pessoa_atual());

/* ---------- funções (corpo em logica, porta fina no public) ---------- */
create or replace function logica.cofre_criar(p_meta jsonb, p_segredo jsonb) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := interno.pessoa_atual(); esp uuid := interno.meu_espaco(); novo uuid; sid uuid;
begin
  if eu is null then raise exception 'Entre no CicloDev primeiro' using errcode = '42501'; end if;
  -- quem não é membro de nenhum espaço (um cliente que acompanha) guarda no espaço onde participa
  if esp is null then select n.espaco_id into esp from public.participacoes x join public.nos n on n.id = x.no_id where x.pessoa_id = eu and n.espaco_id is not null order by x.no_id limit 1; end if;
  if esp is null then raise exception 'Sem espaço para guardar' using errcode = '42501'; end if;
  perform interno.cofre_meta_ok(p_meta); perform interno.cofre_segredo_ok(p_segredo);
  insert into public.cofre_itens (espaco_id, dono_id, no_id, tipo, nome, url, descricao, etiquetas, trocar_em, atualizado_por)
  values (esp, eu, nullif(p_meta->>'no_id', '')::uuid, coalesce(p_meta->>'tipo', 'senha'), btrim(p_meta->>'nome'), nullif(btrim(p_meta->>'url'), ''),
          nullif(btrim(p_meta->>'descricao'), ''), coalesce((select array_agg(e) from jsonb_array_elements_text(p_meta->'etiquetas') e), '{}'),
          nullif(p_meta->>'trocar_em', '')::date, eu)
  returning id into novo;
  sid := vault.create_secret(p_segredo::text, null, 'ciclodev cofre ' || novo);
  insert into interno.cofre_vault (item_id, segredo_id) values (novo, sid);
  perform interno.cofre_anotar(novo, 'criou');
  return novo;
end $$;

create or replace function logica.cofre_alterar(p_id uuid, p_meta jsonb, p_segredo jsonb default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := interno.pessoa_atual(); sid uuid;
begin
  if coalesce(interno.cofre_nivel(p_id), '') not in ('dono', 'editar') or exists (select 1 from public.cofre_itens where id = p_id and excluido_em is not null) then
    raise exception 'Item não encontrado' using errcode = '42501'; end if;
  if p_meta is not null then
    perform interno.cofre_meta_ok(p_meta);
    update public.cofre_itens set
      tipo = case when p_meta ? 'tipo' then p_meta->>'tipo' else tipo end,
      nome = case when p_meta ? 'nome' then btrim(p_meta->>'nome') else nome end,
      url = case when p_meta ? 'url' then nullif(btrim(p_meta->>'url'), '') else url end,
      descricao = case when p_meta ? 'descricao' then nullif(btrim(p_meta->>'descricao'), '') else descricao end,
      etiquetas = case when p_meta ? 'etiquetas' then coalesce((select array_agg(e) from jsonb_array_elements_text(p_meta->'etiquetas') e), '{}') else etiquetas end,
      trocar_em = case when p_meta ? 'trocar_em' then nullif(p_meta->>'trocar_em', '')::date else trocar_em end,
      no_id = case when p_meta ? 'no_id' then nullif(p_meta->>'no_id', '')::uuid else no_id end,
      atualizado_em = now(), atualizado_por = eu
    where id = p_id;
    perform interno.cofre_anotar(p_id, 'alterou');
  end if;
  if p_segredo is not null then
    perform interno.cofre_segredo_ok(p_segredo);
    select segredo_id into sid from interno.cofre_vault where item_id = p_id;
    if sid is null or not exists (select 1 from vault.secrets where id = sid) then
      sid := vault.create_secret(p_segredo::text, null, 'ciclodev cofre ' || p_id);
      insert into interno.cofre_vault (item_id, segredo_id) values (p_id, sid) on conflict (item_id) do update set segredo_id = excluded.segredo_id;
    else
      perform vault.update_secret(sid, p_segredo::text);
    end if;
    update public.cofre_itens set atualizado_em = now(), atualizado_por = eu where id = p_id;
    perform interno.cofre_anotar(p_id, 'alterou_segredo');
  end if;
end $$;

-- mostra o segredo (e registra). Sem permissão: a mesma resposta de "não existe".
create or replace function logica.cofre_revelar(p_id uuid, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := interno.pessoa_atual(); v text;
begin
  if eu is null or interno.cofre_nivel(p_id) is null then raise exception 'Item não encontrado' using errcode = '42501'; end if;
  if (select count(*) from public.cofre_registros where pessoa_id = eu and acao = 'revelou' and em > now() - interval '10 minutes') >= 60 then
    raise exception 'Muitas revelações em pouco tempo. Espere alguns minutos.' using errcode = '54000'; end if;
  select d.decrypted_secret into v from interno.cofre_vault c join vault.decrypted_secrets d on d.id = c.segredo_id where c.item_id = p_id;
  perform interno.cofre_anotar(p_id, 'revelou', p_motivo);
  return coalesce(v, '{}')::jsonb;
end $$;

-- a tela avisa que copiou um campo (só o nome do campo vai para o registro, nunca o valor)
create or replace function logica.cofre_copiou(p_id uuid, p_campo text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if interno.cofre_nivel(p_id) is null then raise exception 'Item não encontrado' using errcode = '42501'; end if;
  perform interno.cofre_anotar(p_id, 'copiou', left(regexp_replace(coalesce(p_campo, ''), '[^[:alnum:] _-]', '', 'g'), 60));
end $$;

-- dá, muda ou tira o acesso de uma pessoa (só o dono). p_nivel nulo = tirar.
create or replace function logica.cofre_compartilhar(p_id uuid, p_pessoa uuid, p_nivel text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := interno.pessoa_atual(); esp uuid; nome text;
begin
  if interno.cofre_nivel(p_id) is distinct from 'dono' then raise exception 'Item não encontrado' using errcode = '42501'; end if;
  select espaco_id into esp from public.cofre_itens where id = p_id and excluido_em is null;
  if esp is null then raise exception 'Item está na lixeira' using errcode = '22023'; end if;
  if p_pessoa is null or p_pessoa = eu then raise exception 'Escolha outra pessoa' using errcode = '22023'; end if;
  select p.nome into nome from public.pessoas p where p.id = p_pessoa;
  if p_nivel is null then
    delete from public.cofre_acessos where item_id = p_id and pessoa_id = p_pessoa;
    if found then perform interno.cofre_anotar(p_id, 'tirou_acesso', nome); end if;
    return;
  end if;
  if p_nivel not in ('ver', 'editar') then raise exception 'Nível inválido' using errcode = '22023'; end if;
  if not interno.cofre_pode_receber(esp, p_pessoa) then raise exception 'Essa pessoa não é do mesmo espaço' using errcode = '42501'; end if;
  insert into public.cofre_acessos (item_id, pessoa_id, nivel, dado_por) values (p_id, p_pessoa, p_nivel, eu)
    on conflict (item_id, pessoa_id) do update set nivel = excluded.nivel, dado_por = excluded.dado_por, dado_em = now();
  perform interno.cofre_anotar(p_id, 'compartilhou', nome || ' (' || p_nivel || ')');
end $$;

-- com quem o dono pode compartilhar
create or replace function logica.cofre_pessoas(p_id uuid) returns table (id uuid, nome text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare esp uuid;
begin
  if interno.cofre_nivel(p_id) is distinct from 'dono' then raise exception 'Item não encontrado' using errcode = '42501'; end if;
  select espaco_id into esp from public.cofre_itens where cofre_itens.id = p_id;
  return query select p.id, p.nome from public.pessoas p where p.ativo and p.id <> interno.pessoa_atual() and interno.cofre_pode_receber(esp, p.id) order by p.nome;
end $$;

-- lixeira: só o dono manda e só o dono traz de volta (lá dentro ninguém mais vê)
create or replace function logica.cofre_lixeira(p_id uuid, p_restaurar boolean default false) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if interno.cofre_nivel(p_id) is distinct from 'dono' then raise exception 'Item não encontrado' using errcode = '42501'; end if;
  update public.cofre_itens set excluido_em = case when p_restaurar then null else now() end, atualizado_em = now(), atualizado_por = interno.pessoa_atual() where id = p_id;
  perform interno.cofre_anotar(p_id, case when p_restaurar then 'restaurou' else 'lixeira' end);
end $$;

-- apagar de vez: só o dono, só da lixeira; o segredo sai do Vault junto (gatilho)
create or replace function logica.cofre_apagar(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare n text := interno.cofre_nivel(p_id);
begin
  delete from public.cofre_itens c where c.id = p_id and c.excluido_em is not null and n = 'dono';
  if found then return; end if;
  if n is distinct from 'dono' then raise exception 'Item não encontrado' using errcode = '42501'; end if;
  raise exception 'Mande para a lixeira antes de apagar de vez' using errcode = '22023';
end $$;

do $$
declare f text;
begin
  foreach f in array array['cofre_criar(jsonb, jsonb)', 'cofre_alterar(uuid, jsonb, jsonb)', 'cofre_revelar(uuid, text)', 'cofre_copiou(uuid, text)',
                           'cofre_compartilhar(uuid, uuid, text)', 'cofre_pessoas(uuid)', 'cofre_lixeira(uuid, boolean)', 'cofre_apagar(uuid)'] loop
    execute format('revoke all on function logica.%s from public, anon, service_role', f);
    execute format('grant execute on function logica.%s to authenticated', f);
  end loop;
end $$;

-- as portas da API (security invoker): só repassam
create or replace function public.cofre_criar(p_meta jsonb, p_segredo jsonb) returns uuid language sql security invoker set search_path = '' as $$ select logica.cofre_criar($1, $2) $$;
create or replace function public.cofre_alterar(p_id uuid, p_meta jsonb, p_segredo jsonb default null) returns void language sql security invoker set search_path = '' as $$ select logica.cofre_alterar($1, $2, $3) $$;
create or replace function public.cofre_revelar(p_id uuid, p_motivo text default null) returns jsonb language sql security invoker set search_path = '' as $$ select logica.cofre_revelar($1, $2) $$;
create or replace function public.cofre_copiou(p_id uuid, p_campo text) returns void language sql security invoker set search_path = '' as $$ select logica.cofre_copiou($1, $2) $$;
create or replace function public.cofre_compartilhar(p_id uuid, p_pessoa uuid, p_nivel text) returns void language sql security invoker set search_path = '' as $$ select logica.cofre_compartilhar($1, $2, $3) $$;
create or replace function public.cofre_pessoas(p_id uuid) returns table (id uuid, nome text) language sql security invoker set search_path = '' as $$ select * from logica.cofre_pessoas($1) $$;
create or replace function public.cofre_lixeira(p_id uuid, p_restaurar boolean default false) returns void language sql security invoker set search_path = '' as $$ select logica.cofre_lixeira($1, $2) $$;
create or replace function public.cofre_apagar(p_id uuid) returns void language sql security invoker set search_path = '' as $$ select logica.cofre_apagar($1) $$;
do $$
declare f text;
begin
  foreach f in array array['cofre_criar(jsonb, jsonb)', 'cofre_alterar(uuid, jsonb, jsonb)', 'cofre_revelar(uuid, text)', 'cofre_copiou(uuid, text)',
                           'cofre_compartilhar(uuid, uuid, text)', 'cofre_pessoas(uuid)', 'cofre_lixeira(uuid, boolean)', 'cofre_apagar(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, service_role', f);
    execute format('grant execute on function public.%s to authenticated', f);
    execute format('comment on function public.%s is %L', f, 'Porta da API do cofre (security invoker). O corpo e a regra de acesso estão em logica.' || split_part(f, '(', 1) || '.');
  end loop;
end $$;

-- ao vivo (parte 67): o dono fica sabendo das mudanças nos itens dele e quem ganha ou perde acesso fica sabendo na hora.
-- Só pelo canal PESSOAL de cada um (nunca pelo da empresa), e o aviso leva só o id.
do $$ begin
  if to_regclass('interno.ao_vivo_tabelas') is null then return; end if;
  insert into interno.ao_vivo_tabelas (tabela, chave, espaco) values
    ('cofre_itens', 'id', 'interno.av_esp_pessoa(x.dono_id)'), ('cofre_acessos', 'item_id', 'interno.av_esp_pessoa(x.pessoa_id)')
  on conflict (tabela) do update set chave = excluded.chave, espaco = excluded.espaco;
end $$;
drop trigger if exists zz_ao_vivo_i on public.cofre_itens;
drop trigger if exists zz_ao_vivo_u on public.cofre_itens;
drop trigger if exists zz_ao_vivo_d on public.cofre_itens;
drop trigger if exists zz_ao_vivo_i on public.cofre_acessos;
drop trigger if exists zz_ao_vivo_u on public.cofre_acessos;
drop trigger if exists zz_ao_vivo_d on public.cofre_acessos;
create trigger zz_ao_vivo_i after insert on public.cofre_itens referencing new table as novas for each statement execute function interno.ao_vivo_avisar('id', 'interno.av_esp_pessoa(x.dono_id)');
create trigger zz_ao_vivo_u after update on public.cofre_itens referencing old table as velhas new table as novas for each statement execute function interno.ao_vivo_avisar('id', 'interno.av_esp_pessoa(x.dono_id)');
create trigger zz_ao_vivo_d after delete on public.cofre_itens referencing old table as velhas for each statement execute function interno.ao_vivo_avisar('id', 'interno.av_esp_pessoa(x.dono_id)');
create trigger zz_ao_vivo_i after insert on public.cofre_acessos referencing new table as novas for each statement execute function interno.ao_vivo_avisar('item_id', 'interno.av_esp_pessoa(x.pessoa_id)');
create trigger zz_ao_vivo_u after update on public.cofre_acessos referencing old table as velhas new table as novas for each statement execute function interno.ao_vivo_avisar('item_id', 'interno.av_esp_pessoa(x.pessoa_id)');
create trigger zz_ao_vivo_d after delete on public.cofre_acessos referencing old table as velhas for each statement execute function interno.ao_vivo_avisar('item_id', 'interno.av_esp_pessoa(x.pessoa_id)');
