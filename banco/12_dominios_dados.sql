-- =====================================================================
-- Sistema IT.IA · 12 · Domínios já conhecidos (dados reais, conferidos no Registro.br e no Cloudflare em 28/09/2026)
-- Pode rodar de novo: nada duplica.
-- =====================================================================
insert into public.dominios (nome, no_id, registrador, dns_em, servidores_dns, comprado_em, vence_em, renovacao_automatica, email_provedor, observacoes)
values ('it-ia.tec.br', null, 'Registro.br', 'Cloudflare', array['karsyn.ns.cloudflare.com','kellen.ns.cloudflare.com'],
        '2026-09-09', '2036-09-09', null, 'Google (Gmail)', 'Domínio da própria IT.IA. Envio de e-mails do sistema pelo Resend (domínio verificado).')
on conflict (nome) do nothing;

insert into public.dominios_registros (dominio_id, nome, tipo, aponta_para, servico, para_que, proxy)
select d.id, r.nome, r.tipo, r.aponta_para, r.servico, r.para_que, r.proxy
  from public.dominios d
  cross join (values
    ('system',            'CNAME', 'cname.vercel-dns.com',            'Vercel',            'Sistema IT.IA (system.it-ia.tec.br)',            false),
    ('conversor',         'Túnel', 'conversor-billy',                 'Cloudflare Tunnel', 'Conversor do Billy',                             true),
    ('@',                 'MX',    'smtp.google.com',                 'Google',            'Receber e-mails do domínio',                     false),
    ('@',                 'TXT',   'v=spf1 include:_spf.google.com ~all', 'Google',        'SPF: quem pode enviar e-mail pelo domínio',      false),
    ('_dmarc',            'TXT',   'v=DMARC1; p=reject;',             'E-mail',            'DMARC: recusar e-mail falso com o domínio',      false),
    ('@',                 'TXT',   'google-site-verification (valor no Cloudflare)', 'Google', 'Prova de que o domínio é nosso para o Google', false),
    ('resend._domainkey', 'TXT',   'chave DKIM do Resend (valor no Cloudflare)', 'Resend',  'Assinatura dos e-mails enviados pelo Resend',     false),
    ('send',              'CNAME', 'send.forge.rmta.net',             'Resend',            'Envio de e-mails pelo Resend',                   false),
    ('rsend',             'CNAME', 'rsend.forge.rmta.net',            'Resend',            'Envio de e-mails pelo Resend',                   false)
  ) as r(nome, tipo, aponta_para, servico, para_que, proxy)
 where d.nome = 'it-ia.tec.br'
   and not exists (select 1 from public.dominios_registros x where x.dominio_id = d.id and x.nome = r.nome and x.tipo = r.tipo and x.aponta_para = r.aponta_para);
