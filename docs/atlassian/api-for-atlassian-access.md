# Atlassian Access

Fonte: Postman API Reference Library, espaço "Atlassian (Cloud)" (lido em 28/09/2026). 34 funções.


## Orgs

| Método | Caminho | Função |
|---|---|---|
| GET | `v1/orgs` | Get organizations |
| GET | `v1/orgs/:orgId` | Get an organization by ID |

## Users

| Método | Caminho | Função |
|---|---|---|
| GET | `v1/orgs/:orgId/users` | Get managed accounts in an organization |
| POST | `v1/orgs/:orgId/users/search` | Search for users in an organization |

## Groups

| Método | Caminho | Função |
|---|---|---|
| POST | `v1/orgs/:orgId/groups/search` | Search for groups within an organization |

## Domains

| Método | Caminho | Função |
|---|---|---|
| GET | `v1/orgs/:orgId/domains` | Get domains in an organization |
| GET | `v1/orgs/:orgId/domains/:domainId` | Get domain by ID |

## Events

| Método | Caminho | Função |
|---|---|---|
| GET | `v1/orgs/:orgId/events` | Get an audit log of events |
| GET | `v1/orgs/:orgId/events/:eventId` | Get an event by ID |
| GET | `v1/orgs/:orgId/event-actions` | Get list of event actions |

## Policies

| Método | Caminho | Função |
|---|---|---|
| GET | `v1/orgs/:orgId/policies` | Get list of policies |
| POST | `v1/orgs/:orgId/policies` | Create a policy |
| GET | `v1/orgs/:orgId/policies/:policyId` | Get a policy by ID |
| PUT | `v1/orgs/:orgId/policies/:policyId` | Update a policy |
| DELETE | `v1/orgs/:orgId/policies/:policyId` | Delete a policy |
| POST | `v1/orgs/:orgId/policies/:policyId/resources` | Add Resource to Policy |
| PUT | `v1/orgs/:orgId/policies/:policyId/resources/:resourceId` | Update Policy Resource |
| DELETE | `v1/orgs/:orgId/policies/:policyId/resources/:resourceId` | Delete Policy Resource |
| GET | `v1/orgs/:orgId/policies/:policyId/validate` | Validate Policy |

## Directory

| Método | Caminho | Função |
|---|---|---|
| GET | `v1/orgs/:orgId/directory/users/:accountId/last-active-dates` | User’s last active dates |
| DELETE | `v1/orgs/:orgId/directory/users/:accountId` | Remove user access |
| POST | `v1/orgs/:orgId/directory/users/:accountId/suspend-access` | Suspend user access |
| POST | `v1/orgs/:orgId/directory/users/:accountId/restore-access` | Restore user access |
| POST | `v1/orgs/:orgId/directory/groups` | Create group |
| DELETE | `v1/orgs/:orgId/directory/groups/:groupId` | Delete group |
| POST | `v1/orgs/:orgId/directory/groups/:groupId/memberships` | Add user to group |
| DELETE | `v1/orgs/:orgId/directory/groups/:groupId/memberships/:accountId` | Remove user from group |
| POST | `v1/orgs/:orgId/users/invite` | Invite user to org |
| POST | `v1/orgs/:orgId/directory/groups/:groupId/roles/assign` | Assign roles to a group |
| POST | `v1/orgs/:orgId/directory/groups/:groupId/roles/revoke` | Revoke roles from a group |
| POST | `v1/orgs/:orgId/users/:userId/roles/assign` | Grant user access |
| POST | `v1/orgs/:orgId/users/:userId/roles/revoke` | Revoke user access |

## Workspaces

| Método | Caminho | Função |
|---|---|---|
| POST | `v2/orgs/:orgId/workspaces` | Get list of workspaces |

## Validate

| Método | Caminho | Função |
|---|---|---|
| GET | `v1/orgs/:orgId/policies/:policyId/validate` | Validate Policy |
