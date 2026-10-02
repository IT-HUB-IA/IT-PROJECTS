-- CicloDev · 51 · Servidores: o custo do plano (o contrato) fica marcado como principal.
--   O cadastro tem um bloco só de contrato (contratado em, valor do plano, moeda, recorrência, renova até cancelar ou
--   para numa data); a próxima renovação é calculada pela recorrência. Os outros custos são os extras (backup, IP,
--   licença), que pegam a moeda, o começo e a cobrança do contrato.
-- Pode rodar de novo sem estragar nada.
alter table public.servidores_custos add column if not exists principal boolean not null default false;
comment on column public.servidores_custos.principal is 'true: o custo do plano (o contrato do servidor). Um por servidor.';
create unique index if not exists servidores_custos_um_principal on public.servidores_custos (servidor_id) where principal;
