# User provisioning (SCIM)

Fonte: Postman API Reference Library, espaço "Atlassian (Cloud)" (lido em 28/09/2026). 21 funções.


## Users

| Método | Caminho | Função |
|---|---|---|
| GET | `scim/directory/:directoryId/Users/:userId` | Get a user by ID |
| PUT | `scim/directory/:directoryId/Users/:userId` | Update user via user attributes |
| DELETE | `scim/directory/:directoryId/Users/:userId` | Deactivate a user |
| PATCH | `scim/directory/:directoryId/Users/:userId` | Update user by ID (PATCH) |
| GET | `scim/directory/:directoryId/Users` | Get users |
| POST | `scim/directory/:directoryId/Users` | Create a user |

## Groups

| Método | Caminho | Função |
|---|---|---|
| GET | `scim/directory/:directoryId/Groups/:id` | Get a group by ID |
| PUT | `scim/directory/:directoryId/Groups/:id` | Update a group by ID |
| DELETE | `scim/directory/:directoryId/Groups/:id` | Delete a group by ID |
| PATCH | `scim/directory/:directoryId/Groups/:id` | Update a group by ID (PATCH) |
| GET | `scim/directory/:directoryId/Groups` | Get groups |
| POST | `scim/directory/:directoryId/Groups` | Create a group |

## Schemas

| Método | Caminho | Função |
|---|---|---|
| GET | `scim/directory/:directoryId/Schemas` | Get all schemas |
| GET | `scim/directory/:directoryId/Schemas/urn:ietf:params:scim:schemas:core:2.0:User` | Get user schemas |
| GET | `scim/directory/:directoryId/Schemas/urn:ietf:params:scim:schemas:core:2.0:Group` | Get group schemas |
| GET | `scim/directory/:directoryId/Schemas/urn:ietf:params:scim:schemas:extension:enterprise:2.0:User` | Get user enterprise extension schemas |
| GET | `scim/directory/:directoryId/ServiceProviderConfig` | Get feature metadata |

## Service Provider Configuration

| Método | Caminho | Função |
|---|---|---|
| GET | `scim/directory/:directoryId/ResourceTypes` | Get resource types |
| GET | `scim/directory/:directoryId/ResourceTypes/User` | Get user resource types |
| GET | `scim/directory/:directoryId/ResourceTypes/Group` | Get group resource types |

## Admin APIs

| Método | Caminho | Função |
|---|---|---|
| DELETE | `admin/user-provisioning/v1/org/:orgId/user/:AAID/onlyDeleteUserInDB` | Delete user in SCIM DB |
