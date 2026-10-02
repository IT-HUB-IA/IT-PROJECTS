# CicloDev

Gestão de projetos, entregas e custos da IT.IA, feita no CicloDev. Cliente atual: Blanco & Lisboa (projeto BL).

| Pasta | O que tem |
|---|---|
| `publico/` | A página que a Vercel publica (gerada, não editar à mão) |
| `fonte/` | O código da tela. `build.py` junta tudo e gera `publico/index.html` |
| `banco/` | O banco no Supabase (`tfcvoszeewmpghgxztuy`): SQL em partes, testes e o `LEIA-ME.md` com as decisões |
| `testes/` | Testes da tela (Playwright) |
| `emails/` | Os e-mails do login em português (esqueci a senha, convite, confirmação), para colar no Supabase |

## Regra de tela: usar toda a largura

Texto, telas e cards ocupam toda a largura da janela. Não se limita a largura de nada (nada de `max-width` em px, ch ou `min(...)` em texto, tela ou card) e nada quebra linha enquanto houver espaço. As exceções são poucas: janela (modal), menu suspenso, aviso flutuante, balão de conversa, nome de arquivo cortado com "..." e barra de gráfico. `node testes/t_largura.js` barra qualquer CSS novo que desobedeça.

## Gerar a página

```
cd fonte && python3 build.py   (gera publico/index.html = apresentação e publico/entrar.html = sistema)
```

## Login

Supabase Auth, com e-mail e senha. A chave que aparece em `fonte/login.js` é a chave **pública** do projeto: ela foi feita para ficar na tela. Quem protege os dados são as regras de acesso (RLS) do banco. Nenhuma chave secreta fica neste repositório.

Para dar acesso a alguém: criar o usuário no Supabase (Authentication, Users, Add user) com o mesmo e-mail cadastrado na pessoa do time (`public.pessoas.email`). No primeiro login o banco liga os dois sozinho.

## E-mails (Resend)

Os e-mails do login saem pelo Resend, com o domínio `it-ia.tec.br` (já verificado). A configuração fica no Supabase, em Authentication, Emails, SMTP Settings. A chave do Resend fica só lá, nunca neste repositório.

## Situação

A tela ainda guarda os dados no navegador de quem usa (dados de exemplo). O banco já está no ar e conferido. Ligar a tela ao banco é o próximo passo.

## Pendências

Ver [PENDENCIAS.md](PENDENCIAS.md).
