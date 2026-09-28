# Pendências do CicloDev

Coisas combinadas com o William para fazer depois. Quando uma ficar pronta, marcar como feita com a data (não apagar).

## 1. Cadastro de domínios (pedido em 28/09/2026) · FEITO em 28/09/2026

Pronto em Costs, aba Domínios. No banco: tabelas `dominios` e `dominios_registros` (partes 11 e 12). Decidido: fica como aba dentro de Costs.

Um lugar no sistema para guardar cada domínio do grupo e tudo o que depende dele.

**O que cada domínio precisa ter:**

| Informação | Exemplo |
|---|---|
| Domínio | `it-ia.tec.br` |
| Empresa ou produto dono | CicloDev (ligado a um ponto da árvore: cliente, projeto, produto ou aplicação) |
| Onde foi comprado (registrador) | Registro.br |
| Onde o DNS é administrado | Cloudflare (servidores `karsyn` e `kellen.ns.cloudflare.com`) |
| Data da compra | 09/09/2026 |
| Data de vencimento | 09/09/2036 |
| Renovação automática | sim ou não |
| Custo | valor e de quanto em quanto tempo (anual, 10 anos...) |
| E-mail no domínio | provedor do e-mail, se houver |
| Quem tem o acesso | onde fica a senha do painel (só o nome, nunca a senha) |
| Observações | texto livre |

**Subdomínios de cada domínio:**

| Informação | Exemplo |
|---|---|
| Subdomínio | `system.it-ia.tec.br` |
| Para que serve | CicloDev |
| Aponta para | Vercel (projeto `sistema-itia`) |
| Tipo de registro | CNAME para `cname.vercel-dns.com`, com o proxy do Cloudflare desligado |
| Aplicação ligada | a aplicação da árvore que usa o endereço |

**Regras para montar sem repetir informação:**
- O **custo** do domínio não ganha tabela nova: ele entra como um custo técnico (`custos_tecnicos`), com recorrência anual, ligado ao mesmo ponto da árvore. O cadastro do domínio só aponta para esse custo. Assim ele já aparece em Costs, na previsão e no financeiro.
- O **acesso ao painel** (Registro.br, Cloudflare) entra na lista de segredos (`segredos_catalogo`), só com o nome e onde fica, nunca a senha.
- A **empresa dona** vem da árvore, igual aos custos: nada de coluna solta com o nome da empresa.
- **Aviso de vencimento:** avisar o Master 60, 30 e 7 dias antes do vencimento (automação diária, igual à de prazo vencido).
- Só o Master vê e muda (as regras de acesso seguem as de custos).

**Onde fica na tela:** uma aba "Domínios" dentro de Costs, ou um módulo próprio. Decidir com o William quando for fazer.

**Domínios já conhecidos para cadastrar:**
- `it-ia.tec.br`: Registro.br, DNS no Cloudflare, comprado em 09/09/2026, vence em 09/09/2036. Subdomínio `system` para o CicloDev.
- Domínios das empresas do grupo (YOU, Realizze, BEEC, Blanco & Lisboa...): levantar com o William.
