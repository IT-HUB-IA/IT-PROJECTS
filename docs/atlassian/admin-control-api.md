# Admin Control

Fonte: Postman API Reference Library, espaço "Atlassian (Cloud)" (lido em 28/09/2026). 21 funções.


## Policies

| Método | Caminho | Função |
|---|---|---|
| GET | `admin/control/v1/orgs/:orgId/policies` | Get list of policies |
| POST | `admin/control/v1/orgs/:orgId/policies` | Create a new policy |
| GET | `admin/control/v1/orgs/:orgId/policies/:policyId` | Get single policy |
| PUT | `admin/control/v1/orgs/:orgId/policies/:policyId` | Update single policy |
| DELETE | `admin/control/v1/orgs/:orgId/policies/:policyId` | Delete single policy |
| GET | `admin/control/v2/orgs/:orgId/policies` | Get list of policies V2 |
| POST | `admin/control/v2/orgs/:orgId/policies` | Create a new policy V2 |
| GET | `admin/control/v2/orgs/:orgId/policies/:policyId` | Get single policy V2 |
| PUT | `admin/control/v2/orgs/:orgId/policies/:policyId` | Update single policy V2 |
| GET | `admin/control/v1/orgs/:orgId/policies/:policyId/validate` | Validate a policy |

## Resources

| Método | Caminho | Função |
|---|---|---|
| GET | `admin/control/v1/orgs/:orgId/policies/:policyId/resources` | Get list of resources associated with a policy |
| POST | `admin/control/v1/orgs/:orgId/policies/:policyId/resources` | Create a new policy resource |
| DELETE | `admin/control/v1/orgs/:orgId/policies/:policyId/resources` | Delete all policy resources |
| PUT | `admin/control/v1/orgs/:orgId/policies/:policyId/resources/:resourceId` | Update single policy resource |
| DELETE | `admin/control/v1/orgs/:orgId/policies/:policyId/resources/:resourceId` | Delete single policy resource |
| GET | `admin/control/v2/orgs/:orgId/policies/:policyId/resources` | Get list of resources associated with a policy V2 |
| POST | `admin/control/v2/orgs/:orgId/policies/:policyId/resources` | Add or remove policy resources V2 |
| DELETE | `admin/control/v2/orgs/:orgId/policies/:policyId/resources` | Delete all policy resources V2 |

## Authentication Policies

| Método | Caminho | Função |
|---|---|---|
| POST | `admin/control/v1/orgs/:orgId/auth-policy/:policyId/add-users` | Add users to a policy |
| GET | `admin/control/v1/orgs/:orgId/auth-policy/task/:taskId` | Get the status of a task |
| POST | `admin/control/v1/orgs/:orgId/users/auth-policies/bulk-fetch` | Get policy information for managed users |
