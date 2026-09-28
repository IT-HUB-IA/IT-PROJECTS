# IDv2 User management

Fonte: Postman API Reference Library, espaço "Atlassian (Cloud)" (lido em 28/09/2026). 10 funções.


## Manage

| Método | Caminho | Função |
|---|---|---|
| GET | `users/:account_id/manage` | Get user management permissions |

## Profile

| Método | Caminho | Função |
|---|---|---|
| GET | `users/:account_id/manage/profile` | Get profile |
| PATCH | `users/:account_id/manage/profile` | Update profile |

## Email

| Método | Caminho | Função |
|---|---|---|
| PUT | `users/:account_id/manage/email` | Set email
 |

## Api Tokens

| Método | Caminho | Função |
|---|---|---|
| GET | `users/:account_id/manage/api-tokens` | Get API tokens |
| DELETE | `users/:account_id/manage/api-tokens/:tokenId` | Delete API token |

## Lifecycle

| Método | Caminho | Função |
|---|---|---|
| POST | `users/:account_id/manage/lifecycle/disable` | Deactivate a user |
| POST | `users/:account_id/manage/lifecycle/enable` | Activate a user |
| POST | `users/:account_id/manage/lifecycle/delete` | Delete account |
| POST | `users/:account_id/manage/lifecycle/cancel-delete` | Cancel delete account |
