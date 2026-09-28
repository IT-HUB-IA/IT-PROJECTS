-- =====================================================================
-- Sistema IT.IA · 13 · Ficha cadastral completa do cliente (pedido do William em 28/09/2026)
-- O CNPJ ou CPF continua em clientes.documento. Os campos novos são todos opcionais.
-- As regras de acesso de clientes já valem para eles (só o Master muda; quem vê o cliente vê a ficha).
-- =====================================================================
alter table public.clientes
  add column if not exists razao_social        text,
  add column if not exists nome_fantasia       text,
  add column if not exists inscricao_estadual  text,
  add column if not exists inscricao_municipal text,
  add column if not exists data_abertura       date,
  add column if not exists natureza_juridica   text,
  add column if not exists porte               text,
  add column if not exists regime_tributario   text check (regime_tributario is null or regime_tributario in ('simples','mei','presumido','real','isento','outro')),
  add column if not exists cnae_principal      text,
  add column if not exists situacao_cadastral  text,
  add column if not exists cep                 text,
  add column if not exists logradouro          text,
  add column if not exists numero              text,
  add column if not exists complemento         text,
  add column if not exists bairro              text,
  add column if not exists cidade              text,
  add column if not exists uf                  text check (uf is null or uf ~ '^[A-Z]{2}$'),
  add column if not exists email               text,
  add column if not exists telefone            text,
  add column if not exists site                text,
  add column if not exists contato_nome        text,
  add column if not exists contato_cargo       text,
  add column if not exists contato_email       text,
  add column if not exists contato_telefone    text,
  add column if not exists observacoes         text;
comment on column public.clientes.documento is 'CNPJ (empresa ou holding) ou CPF (pessoa), só os números ou com pontuação.';
