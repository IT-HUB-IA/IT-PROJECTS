-- Parte 40: guia "Montar o projeto", tipo Decisão e limites do método por projeto. 02/10/2026.
-- itens.decisao: tipo Decisão (algo a decidir, com prazo de decisão no campo prazo). Fica com tipo 'task'; não conta nos pontos da versão.
-- projetos: visão, sinais de sucesso, partes interessadas e riscos (o que o guia pergunta) e os limites do método (po_limites).
alter table public.itens add column if not exists decisao boolean not null default false;
comment on column public.itens.decisao is 'Tipo Decisão: algo que precisa ser decidido (prazo = prazo da decisão). Tipo task; não conta nos pontos da versão';
alter table public.projetos
  add column if not exists visao text check (visao is null or length(visao) <= 1000),
  add column if not exists sucesso text check (sucesso is null or length(sucesso) <= 2000),
  add column if not exists partes text check (partes is null or length(partes) <= 2000),
  add column if not exists riscos text check (riscos is null or length(riscos) <= 4000),
  add column if not exists riscos_nenhum boolean not null default false,
  add column if not exists po_limites jsonb not null default '{}'::jsonb check (jsonb_typeof(po_limites) = 'object' and pg_column_size(po_limites) <= 2000);
comment on column public.projetos.visao is 'Visão e meta do projeto em uma frase (guia Montar o projeto)';
comment on column public.projetos.sucesso is 'Sinais de que o projeto deu certo, de preferência com número';
comment on column public.projetos.partes is 'Partes interessadas: quem usa, quem decide, quem paga';
comment on column public.projetos.riscos is 'Riscos e o que ainda não foi verificado, com quem cuida e quando revisar';
comment on column public.projetos.po_limites is 'Limites do método: {"parado":5,"aceite":3,"grande":13,"semanas":4}. Vazio = padrão';
