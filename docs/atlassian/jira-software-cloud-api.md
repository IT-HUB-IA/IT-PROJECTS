# Jira Software Cloud API

Fonte: Postman API Reference Library, espaço "Atlassian (Cloud)" (lido em 28/09/2026). 95 funções.


## Backlog

| Método | Caminho | Função |
|---|---|---|
| POST | `rest/agile/1.0/backlog/issue` | Move issues to backlog |
| POST | `rest/agile/1.0/backlog/:boardId/issue` | Move issues to backlog for board |

## Board

| Método | Caminho | Função |
|---|---|---|
| GET | `rest/agile/1.0/board` | Get all boards |
| POST | `rest/agile/1.0/board` | Create board |
| GET | `rest/agile/1.0/board/filter/:filterId` | Get board by filter id |
| DELETE | `rest/agile/1.0/board/:boardId` | Delete board |
| GET | `rest/agile/1.0/board/:boardId` | Get board |
| GET | `rest/agile/1.0/board/:boardId/backlog` | Get issues for backlog |
| GET | `rest/agile/1.0/board/:boardId/configuration` | Get configuration |
| GET | `rest/agile/1.0/board/:boardId/epic` | Get epics |
| GET | `rest/agile/1.0/board/:boardId/epic/none/issue` | Get issues without epic for board |
| GET | `rest/agile/1.0/board/:boardId/epic/:epicId/issue` | Get board issues for epic |
| GET | `rest/agile/1.0/board/:boardId/features` | Get features for board |
| PUT | `rest/agile/1.0/board/:boardId/features` | Toggle features |
| GET | `rest/agile/1.0/board/:boardId/issue` | Get issues for board |
| POST | `rest/agile/1.0/board/:boardId/issue` | Move issues to board |
| GET | `rest/agile/1.0/board/:boardId/project` | Get projects |
| GET | `rest/agile/1.0/board/:boardId/project/full` | Get projects full |
| GET | `rest/agile/1.0/board/:boardId/properties` | Get board property keys |
| DELETE | `rest/agile/1.0/board/:boardId/properties/:propertyKey` | Delete board property |
| GET | `rest/agile/1.0/board/:boardId/properties/:propertyKey` | Get board property |
| PUT | `rest/agile/1.0/board/:boardId/properties/:propertyKey` | Set board property |
| GET | `rest/agile/1.0/board/:boardId/quickfilter` | Get all quick filters |
| GET | `rest/agile/1.0/board/:boardId/quickfilter/:quickFilterId` | Get quick filter |
| GET | `rest/agile/1.0/board/:boardId/reports` | Get reports for board |
| GET | `rest/agile/1.0/board/:boardId/sprint` | Get all sprints |
| GET | `rest/agile/1.0/board/:boardId/sprint/:sprintId/issue` | Get board issues for sprint |
| GET | `rest/agile/1.0/board/:boardId/version` | Get all versions |

## Epic

| Método | Caminho | Função |
|---|---|---|
| GET | `rest/agile/1.0/epic/none/issue` | Get issues without epic |
| POST | `rest/agile/1.0/epic/none/issue` | Remove issues from epic |
| GET | `rest/agile/1.0/epic/:epicIdOrKey` | Get epic |
| POST | `rest/agile/1.0/epic/:epicIdOrKey` | Partially update epic |
| GET | `rest/agile/1.0/epic/:epicIdOrKey/issue` | Get issues for epic |
| POST | `rest/agile/1.0/epic/:epicIdOrKey/issue` | Move issues to epic |
| PUT | `rest/agile/1.0/epic/:epicIdOrKey/rank` | Rank epics |

## Issue

| Método | Caminho | Função |
|---|---|---|
| PUT | `rest/agile/1.0/issue/rank` | Rank issues |
| GET | `rest/agile/1.0/issue/:issueIdOrKey/estimation` | Get issue |
| GET | `rest/agile/1.0/issue/:issueIdOrKey/estimation` | Get issue estimation for board |
| PUT | `rest/agile/1.0/issue/:issueIdOrKey/estimation` | Estimate issue for board |

## Sprint

| Método | Caminho | Função |
|---|---|---|
| POST | `rest/agile/1.0/sprint` | Create sprint |
| DELETE | `rest/agile/1.0/sprint/:sprintId` | Delete sprint |
| GET | `rest/agile/1.0/sprint/:sprintId` | Get sprint |
| POST | `rest/agile/1.0/sprint/:sprintId` | Partially update sprint |
| PUT | `rest/agile/1.0/sprint/:sprintId` | Update sprint |
| GET | `rest/agile/1.0/sprint/:sprintId/issue` | Get issues for sprint |
| POST | `rest/agile/1.0/sprint/:sprintId/issue` | Move issues to sprint and rank |
| GET | `rest/agile/1.0/sprint/:sprintId/properties` | Get properties keys |
| DELETE | `rest/agile/1.0/sprint/:sprintId/properties/:propertyKey` | Delete property |
| GET | `rest/agile/1.0/sprint/:sprintId/properties/:propertyKey` | Get property |
| PUT | `rest/agile/1.0/sprint/:sprintId/properties/:propertyKey` | Set property |
| POST | `rest/agile/1.0/sprint/:sprintId/swap` | Swap sprint |

## Development Information

| Método | Caminho | Função |
|---|---|---|
| POST | `rest/devinfo/0.10/bulk` | Store development information |
| GET | `rest/devinfo/0.10/repository/:repositoryId` | Get repository |
| DELETE | `rest/devinfo/0.10/repository/:repositoryId` | Delete repository |
| DELETE | `rest/devinfo/0.10/bulkByProperties` | Delete development information by properties |
| GET | `rest/devinfo/0.10/existsByProperties` | Check if data exists for the supplied properties |
| DELETE | `rest/devinfo/0.10/repository/:repositoryId/:entityType/:entityId` | Delete development information entity |

## Feature Flags

| Método | Caminho | Função |
|---|---|---|
| POST | `rest/featureflags/0.1/bulk` | Submit Feature Flag data |
| DELETE | `rest/featureflags/0.1/bulkByProperties` | Delete Feature Flags by Property |
| GET | `rest/featureflags/0.1/flag/:featureFlagId` | Get a Feature Flag by ID |
| DELETE | `rest/featureflags/0.1/flag/:featureFlagId` | Delete a Feature Flag by ID |

## Deployments

| Método | Caminho | Função |
|---|---|---|
| POST | `rest/deployments/0.1/bulk` | Submit deployment data |
| DELETE | `rest/deployments/0.1/bulkByProperties` | Delete deployments by Property |
| GET | `rest/deployments/0.1/pipelines/:pipelineId/environments/:environmentId/deployments/:deploymentSequenceNumber` | Get a deployment by key |
| DELETE | `rest/deployments/0.1/pipelines/:pipelineId/environments/:environmentId/deployments/:deploymentSequenceNumber` | Delete a deployment by key |
| GET | `rest/deployments/0.1/pipelines/:pipelineId/environments/:environmentId/deployments/:deploymentSequenceNumber/gating-status` | Get deployment gating status by key |

## Builds

| Método | Caminho | Função |
|---|---|---|
| POST | `rest/builds/0.1/bulk` | Submit build data |
| DELETE | `rest/builds/0.1/bulkByProperties` | Delete builds by Property |
| GET | `rest/builds/0.1/pipelines/:pipelineId/builds/:buildNumber` | Get a build by key |
| DELETE | `rest/builds/0.1/pipelines/:pipelineId/builds/:buildNumber` | Delete a build by key |

## Remote Links

| Método | Caminho | Função |
|---|---|---|
| POST | `rest/remotelinks/1.0/bulk` | Submit Remote Link data |
| DELETE | `rest/remotelinks/1.0/bulkByProperties` | Delete Remote Links by Property |
| GET | `rest/remotelinks/1.0/remotelink/:remoteLinkId` | Get a Remote Link by ID |
| DELETE | `rest/remotelinks/1.0/remotelink/:remoteLinkId` | Delete a Remote Link by ID |

## Security Information

| Método | Caminho | Função |
|---|---|---|
| POST | `rest/security/1.0/linkedWorkspaces/bulk` | Submit Security Workspaces to link |
| DELETE | `rest/security/1.0/linkedWorkspaces/bulk` | Delete linked Security Workspaces |
| GET | `rest/security/1.0/linkedWorkspaces` | Get linked Security Workspaces |
| GET | `rest/security/1.0/linkedWorkspaces/:workspaceId` | Get a linked Security Workspace by ID |
| POST | `rest/security/1.0/bulk` | Submit Vulnerability data |
| DELETE | `rest/security/1.0/bulkByProperties` | Delete Vulnerabilities by Property |
| GET | `rest/security/1.0/vulnerability/:vulnerabilityId` | Get a Vulnerability by ID |
| DELETE | `rest/security/1.0/vulnerability/:vulnerabilityId` | Delete a Vulnerability by ID |

## Operations

| Método | Caminho | Função |
|---|---|---|
| POST | `rest/operations/1.0/linkedWorkspaces/bulk` | Submit Operations Workspace Ids |
| DELETE | `rest/operations/1.0/linkedWorkspaces/bulk` | Delete Operations Workpaces by Id |
| GET | `rest/operations/1.0/linkedWorkspaces` | Get all Operations Workspace IDs or a specific Operations Workspace by ID |
| POST | `rest/operations/1.0/bulk` | Submit Incident or Review data |
| DELETE | `rest/operations/1.0/bulkByProperties` | Delete Incidents or Review by Property |
| GET | `rest/operations/1.0/incidents/:incidentId` | Get a Incident by ID |
| DELETE | `rest/operations/1.0/incidents/:incidentId` | Delete a Incident by ID |
| GET | `rest/operations/1.0/post-incident-reviews/:reviewId` | Get a Review by ID |
| DELETE | `rest/operations/1.0/post-incident-reviews/:reviewId` | Delete a Review by ID |

## DevOps Components

| Método | Caminho | Função |
|---|---|---|
| POST | `rest/devopscomponents/1.0/bulk` | Submit DevOps Components |
| DELETE | `rest/devopscomponents/1.0/bulkByProperties` | Delete DevOps Components by Property |
| GET | `rest/devopscomponents/1.0/:componentId` | Get a Component by ID |
| DELETE | `rest/devopscomponents/1.0/:componentId` | Delete a Component by ID |
