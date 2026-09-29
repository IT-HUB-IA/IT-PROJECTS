-- =====================================================================
-- CicloDev · 26 · O agente (DevIT) de cada usuário nasce com a conta, a conversa também fica em .md e aceita anexos
--
--   ia_agentes   um por usuário, criado sozinho quando a conta é criada (junto com a permissão de IA, desligada).
--                historico_md guarda a conversa inteira em Markdown, para o agente poder lembrar depois.
--                Cada mensagem nova entra no fim do .md sozinha (gatilho); ninguém edita nem apaga pela tela.
--
-- A conversa nunca se perde: ia_mensagens e historico_md não têm mudança nem apagamento pela tela.
-- Desligar a IA de alguém só esconde o balão; ligar de novo traz a mesma conversa de volta.
-- Os arquivos anexados ficam no depósito anexos (parte 09), na pasta <login>/ia/; as regras do depósito para essa pasta
-- estão na parte 27 (só no Supabase).
-- Depende da parte 25.
-- =====================================================================

create table if not exists public.ia_agentes (
  pessoa_id     uuid primary key references public.pessoas(id) on delete cascade,
  criado_em     timestamptz not null default now(),
  historico_md  text not null default '',
  mensagens     integer not null default 0,
  atualizado_em timestamptz not null default now()
);
comment on table public.ia_agentes is 'O agente de IA de cada usuário: nasce com a conta. historico_md é a conversa inteira em Markdown, só cresce.';

alter table public.ia_agentes enable row level security;
drop policy if exists proprio on public.ia_agentes;
create policy proprio on public.ia_agentes for select to authenticated using (pessoa_id = (select interno.pessoa_atual()));
revoke all on public.ia_agentes from anon, authenticated;
grant select on public.ia_agentes to authenticated;
grant all on public.ia_agentes to service_role;

-- anexos de cada mensagem: [{nome, tipo, tamanho, caminho}], com o arquivo no depósito anexos, na pasta <login>/ia/ da própria pessoa
alter table public.ia_mensagens add column if not exists anexos jsonb not null default '[]'::jsonb;
alter table public.ia_mensagens drop constraint if exists ia_mensagens_texto_check;
alter table public.ia_mensagens drop constraint if exists ia_mensagens_conteudo_ok;
alter table public.ia_mensagens add constraint ia_mensagens_conteudo_ok check (
  jsonb_typeof(anexos) = 'array' and jsonb_array_length(anexos) <= 10 and pg_column_size(anexos) <= 20000 and length(texto) <= 8000
  and (length(btrim(texto)) >= 1 or jsonb_array_length(anexos) >= 1));
comment on column public.ia_mensagens.anexos is 'Arquivos mandados junto com a mensagem: [{nome, tipo, tamanho, caminho}]. O arquivo fica no depósito anexos, em <login>/ia/.';

-- cada anexo precisa estar na pasta da própria pessoa (ninguém aponta para arquivo de outro)
create or replace function interno.ia_conferir_anexos() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare a jsonb; login text;
begin
  if jsonb_array_length(new.anexos) = 0 then return new; end if;
  select auth_user_id::text into login from public.pessoas where id = new.pessoa_id;
  for a in select * from jsonb_array_elements(new.anexos) loop
    if jsonb_typeof(a) <> 'object' or coalesce(length(btrim(a ->> 'nome')), 0) = 0 or length(a ->> 'nome') > 200
       or jsonb_typeof(a -> 'tamanho') <> 'number' or login is null or coalesce(a ->> 'caminho', '') not like login || '/ia/%' then
      raise exception 'Anexo inválido' using errcode = '22023';
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists ia_mensagens_anexos on public.ia_mensagens;
create trigger ia_mensagens_anexos before insert on public.ia_mensagens for each row execute function interno.ia_conferir_anexos();

-- a permissão que nasce com a conta não conta como "mudada" no Admin: só quem liga ou desliga preenche alterado_em
alter table public.ia_permissoes alter column alterado_em drop not null, alter column alterado_em drop default;

-- o começo do .md de cada agente
create or replace function interno.ia_cabecalho(p uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select '# Conversa com o DevIT' || chr(10) || chr(10) ||
         '- Dono: ' || coalesce(pe.nome, 'sem nome') || coalesce(' (ID ' || pe.numero || ')', '') || chr(10) ||
         '- Agente criado em: ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || chr(10) ||
         '- O agente só enxerga o que o dono enxerga no CicloDev.' || chr(10)
  from public.pessoas pe where pe.id = p
$$;

-- cria o agente (e a permissão de IA, desligada) de uma pessoa, se ainda não existir
create or replace function interno.ia_preparar(p uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.ia_agentes (pessoa_id, historico_md) values (p, interno.ia_cabecalho(p)) on conflict (pessoa_id) do nothing;
  insert into public.ia_permissoes (pessoa_id, ativo) values (p, false) on conflict (pessoa_id) do nothing;
end $$;

-- conta nova: o agente nasce junto
create or replace function interno.ia_ao_criar_pessoa() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform interno.ia_preparar(new.id);
  return new;
end $$;
drop trigger if exists pessoas_ia_agente on public.pessoas;
create trigger pessoas_ia_agente after insert on public.pessoas for each row execute function interno.ia_ao_criar_pessoa();

-- cada mensagem entra no fim do .md
create or replace function interno.ia_md_mensagem(m public.ia_mensagens) returns text
language sql stable set search_path = public, pg_temp as $$
  select chr(10) || '## ' || to_char(m.criado_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || ' · ' ||
         case when m.autor = 'agente' then 'DevIT' else 'Usuário' end || chr(10) || chr(10) ||
         case when length(btrim(m.texto)) > 0 then m.texto || chr(10) else '' end ||
         case when jsonb_array_length(m.anexos) > 0 then
           (case when length(btrim(m.texto)) > 0 then chr(10) else '' end) || 'Anexos:' || chr(10) ||
           (select string_agg('- ' || (x ->> 'nome') || ' (' || coalesce(nullif(x ->> 'tipo', ''), 'arquivo') || ', ' ||
                    case when (x ->> 'tamanho')::numeric >= 1048576 then round((x ->> 'tamanho')::numeric / 1048576, 1) || ' MB' else ceil((x ->> 'tamanho')::numeric / 1024) || ' KB' end ||
                    ') · `' || (x ->> 'caminho') || '`', chr(10)) from jsonb_array_elements(m.anexos) x) || chr(10)
         else '' end
$$;
create or replace function interno.ia_guardar_md() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform interno.ia_preparar(new.pessoa_id);
  update public.ia_agentes set historico_md = historico_md || interno.ia_md_mensagem(new), mensagens = mensagens + 1, atualizado_em = now()
   where pessoa_id = new.pessoa_id;
  return new;
end $$;
drop trigger if exists ia_mensagens_md on public.ia_mensagens;
create trigger ia_mensagens_md after insert on public.ia_mensagens for each row execute function interno.ia_guardar_md();

-- quem já tem conta ganha o agente agora, com a conversa que já existia no .md
insert into public.ia_agentes (pessoa_id, historico_md, mensagens)
select pe.id,
       interno.ia_cabecalho(pe.id) || coalesce((select string_agg(interno.ia_md_mensagem(m), '' order by m.criado_em, m.id) from public.ia_mensagens m where m.pessoa_id = pe.id), ''),
       (select count(*) from public.ia_mensagens m where m.pessoa_id = pe.id)
  from public.pessoas pe
on conflict (pessoa_id) do nothing;
insert into public.ia_permissoes (pessoa_id, ativo) select id, false from public.pessoas on conflict (pessoa_id) do nothing;

revoke all on function interno.ia_conferir_anexos(), interno.ia_cabecalho(uuid), interno.ia_preparar(uuid), interno.ia_ao_criar_pessoa(), interno.ia_md_mensagem(public.ia_mensagens), interno.ia_guardar_md() from public, anon, authenticated;
