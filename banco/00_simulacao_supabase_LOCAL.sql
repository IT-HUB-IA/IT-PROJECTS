-- SOMENTE PARA TESTE LOCAL. NÃO APLICAR NO SUPABASE (lá tudo isso já existe).
-- Simula os papéis, o schema auth e as funções auth.uid()/auth.jwt() do Supabase.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;

create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text unique, raw_user_meta_data jsonb, created_at timestamptz default now(), last_sign_in_at timestamptz, email_confirmed_at timestamptz);

create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create or replace function auth.jwt() returns jsonb language sql stable as
$$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- Vault do Supabase (simulado): no Supabase o valor fica cifrado; aqui só imita as funções e a visão usadas pelo CicloDev.
create schema if not exists vault;
create table if not exists vault.secrets (id uuid primary key default gen_random_uuid(), name text, description text not null default '', secret text not null,
  key_id uuid, nonce bytea, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create unique index if not exists secrets_name_idx on vault.secrets (name) where name is not null;
create or replace view vault.decrypted_secrets as select s.*, s.secret as decrypted_secret from vault.secrets s;
create or replace function vault.create_secret(new_secret text, new_name text default null, new_description text default '', new_key_id uuid default null) returns uuid
language sql security definer set search_path = '' as $$ insert into vault.secrets (secret, name, description, key_id) values (new_secret, new_name, coalesce(new_description, ''), new_key_id) returning id $$;
create or replace function vault.update_secret(secret_id uuid, new_secret text default null, new_name text default null, new_description text default null, new_key_id uuid default null) returns void
language sql security definer set search_path = '' as $$
  update vault.secrets set secret = coalesce(new_secret, secret), name = coalesce(new_name, name), description = coalesce(new_description, description), updated_at = now() where id = secret_id $$;
revoke all on schema vault from public;
