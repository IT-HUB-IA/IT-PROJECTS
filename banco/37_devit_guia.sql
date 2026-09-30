-- Parte 37: o DevIT conduz guias no chat (primeiro: ligar banco do Supabase ou da AWS). 30/09/2026.
-- ia_mensagens.contexto guarda, na fala do agente, em que guia e passo a conversa está e quais botões ele ofereceu
-- ({guia, passo, botoes:[{rotulo, valor}], fim, ia}); na fala da pessoa, qual botão ela clicou ({guia, valor}).
-- Só a função devit (papel de serviço) grava fala do agente; a pessoa continua gravando só a própria fala (parte 25).
alter table public.ia_mensagens add column if not exists contexto jsonb not null default '{}'::jsonb;
alter table public.ia_mensagens drop constraint if exists ia_mensagens_contexto_ok;
alter table public.ia_mensagens add constraint ia_mensagens_contexto_ok check (jsonb_typeof(contexto) = 'object' and pg_column_size(contexto) <= 8000);
comment on column public.ia_mensagens.contexto is 'Guia em andamento no chat: na fala do DevIT {guia, passo, botoes, fim, ia}; na fala da pessoa {guia, valor} do botão clicado. Escrito pela função devit.';
