# Jira Service Management

Fonte: Postman API Reference Library, espaço "Atlassian (Cloud)" (lido em 28/09/2026). 69 funções.


## Assets

| Método | Caminho | Função |
|---|---|---|
| GET | `rest/servicedeskapi/assets/workspace` | Get assets workspaces |
| GET | `rest/servicedeskapi/insight/workspace` | Get insight workspaces |

## Customer

| Método | Caminho | Função |
|---|---|---|
| POST | `rest/servicedeskapi/customer` | Create customer |

## Info

| Método | Caminho | Função |
|---|---|---|
| GET | `rest/servicedeskapi/info` | Get info |

## Knowledgebase

| Método | Caminho | Função |
|---|---|---|
| GET | `rest/servicedeskapi/knowledgebase/article` | Get articles |

## Organization

| Método | Caminho | Função |
|---|---|---|
| GET | `rest/servicedeskapi/organization` | Get organizations |
| POST | `rest/servicedeskapi/organization` | Create organization |
| DELETE | `rest/servicedeskapi/organization/:organizationId` | Delete organization |
| GET | `rest/servicedeskapi/organization/:organizationId` | Get organization |
| GET | `rest/servicedeskapi/organization/:organizationId/property` | Get properties keys |
| DELETE | `rest/servicedeskapi/organization/:organizationId/property/:propertyKey` | Delete property |
| GET | `rest/servicedeskapi/organization/:organizationId/property/:propertyKey` | Get property |
| PUT | `rest/servicedeskapi/organization/:organizationId/property/:propertyKey` | Set property |
| DELETE | `rest/servicedeskapi/organization/:organizationId/user` | Remove users from organization |
| GET | `rest/servicedeskapi/organization/:organizationId/user` | Get users in organization |
| POST | `rest/servicedeskapi/organization/:organizationId/user` | Add users to organization |
| DELETE | `rest/servicedeskapi/servicedesk/:serviceDeskId/organization` | Remove organization |
| GET | `rest/servicedeskapi/servicedesk/:serviceDeskId/organization` | Get organizations |
| POST | `rest/servicedeskapi/servicedesk/:serviceDeskId/organization` | Add organization |

## Request

| Método | Caminho | Função |
|---|---|---|
| GET | `rest/servicedeskapi/request` | Get customer requests |
| POST | `rest/servicedeskapi/request` | Create customer request |
| GET | `rest/servicedeskapi/request/:issueIdOrKey` | Get customer request by id or key |
| GET | `rest/servicedeskapi/request/:issueIdOrKey/approval` | Get approvals |
| GET | `rest/servicedeskapi/request/:issueIdOrKey/approval/:approvalId` | Get approval by id |
| POST | `rest/servicedeskapi/request/:issueIdOrKey/approval/:approvalId` | Answer approval |
| GET | `rest/servicedeskapi/request/:issueIdOrKey/attachment` | Get attachments for request |
| POST | `rest/servicedeskapi/request/:issueIdOrKey/attachment` | Create comment with attachment |
| GET | `rest/servicedeskapi/request/:issueIdOrKey/attachment/:attachmentId` | Get attachment content |
| GET | `rest/servicedeskapi/request/:issueIdOrKey/attachment/:attachmentId/thumbnail` | Get attachment thumbnail |
| GET | `rest/servicedeskapi/request/:issueIdOrKey/comment` | Get request comments |
| POST | `rest/servicedeskapi/request/:issueIdOrKey/comment` | Create request comment |
| GET | `rest/servicedeskapi/request/:issueIdOrKey/comment/:commentId` | Get request comment by id |
| GET | `rest/servicedeskapi/request/:issueIdOrKey/comment/:commentId/attachment` | Get comment attachments |
| DELETE | `rest/servicedeskapi/request/:issueIdOrKey/notification` | Unsubscribe |
| GET | `rest/servicedeskapi/request/:issueIdOrKey/notification` | Get subscription status |
| PUT | `rest/servicedeskapi/request/:issueIdOrKey/notification` | Subscribe |
| DELETE | `rest/servicedeskapi/request/:issueIdOrKey/participant` | Remove request participants |
| GET | `rest/servicedeskapi/request/:issueIdOrKey/participant` | Get request participants |
| POST | `rest/servicedeskapi/request/:issueIdOrKey/participant` | Add request participants |
| GET | `rest/servicedeskapi/request/:issueIdOrKey/sla` | Get sla information |
| GET | `rest/servicedeskapi/request/:issueIdOrKey/sla/:slaMetricId` | Get sla information by id |
| GET | `rest/servicedeskapi/request/:issueIdOrKey/status` | Get customer request status |
| GET | `rest/servicedeskapi/request/:issueIdOrKey/transition` | Get customer transitions |
| POST | `rest/servicedeskapi/request/:issueIdOrKey/transition` | Perform customer transition |
| DELETE | `rest/servicedeskapi/request/:requestIdOrKey/feedback` | Delete feedback |
| GET | `rest/servicedeskapi/request/:requestIdOrKey/feedback` | Get feedback |
| POST | `rest/servicedeskapi/request/:requestIdOrKey/feedback` | Post feedback |

## Requesttype

| Método | Caminho | Função |
|---|---|---|
| GET | `rest/servicedeskapi/requesttype` | Get all request types |

## Servicedesk

| Método | Caminho | Função |
|---|---|---|
| GET | `rest/servicedeskapi/servicedesk` | Get service desks |
| GET | `rest/servicedeskapi/servicedesk/:serviceDeskId` | Get service desk by id |
| POST | `rest/servicedeskapi/servicedesk/:serviceDeskId/attachTemporaryFile` | Attach temporary file |
| DELETE | `rest/servicedeskapi/servicedesk/:serviceDeskId/customer` | Remove customers |
| GET | `rest/servicedeskapi/servicedesk/:serviceDeskId/customer` | Get customers |
| POST | `rest/servicedeskapi/servicedesk/:serviceDeskId/customer` | Add customers |
| GET | `rest/servicedeskapi/servicedesk/:serviceDeskId/knowledgebase/article` | Get articles |
| GET | `rest/servicedeskapi/servicedesk/:serviceDeskId/queue` | Get queues |
| GET | `rest/servicedeskapi/servicedesk/:serviceDeskId/queue/:queueId` | Get queue |
| GET | `rest/servicedeskapi/servicedesk/:serviceDeskId/queue/:queueId/issue` | Get issues in queue |
| GET | `rest/servicedeskapi/servicedesk/:serviceDeskId/requesttype` | Get request types |
| POST | `rest/servicedeskapi/servicedesk/:serviceDeskId/requesttype` | Create request type |
| POST | `rest/servicedeskapi/servicedesk/:serviceDeskId/requesttype/permissions/check` | Check request type permissions |
| DELETE | `rest/servicedeskapi/servicedesk/:serviceDeskId/requesttype/:requestTypeId` | Delete request type |
| GET | `rest/servicedeskapi/servicedesk/:serviceDeskId/requesttype/:requestTypeId` | Get request type by id |
| GET | `rest/servicedeskapi/servicedesk/:serviceDeskId/requesttype/:requestTypeId/field` | Get request type fields |
| GET | `rest/servicedeskapi/servicedesk/:serviceDeskId/requesttype/:requestTypeId/property` | Get properties keys |
| DELETE | `rest/servicedeskapi/servicedesk/:serviceDeskId/requesttype/:requestTypeId/property/:propertyKey` | Delete property |
| GET | `rest/servicedeskapi/servicedesk/:serviceDeskId/requesttype/:requestTypeId/property/:propertyKey` | Get property |
| PUT | `rest/servicedeskapi/servicedesk/:serviceDeskId/requesttype/:requestTypeId/property/:propertyKey` | Set property |
| GET | `rest/servicedeskapi/servicedesk/:serviceDeskId/requesttypegroup` | Get request type groups |
