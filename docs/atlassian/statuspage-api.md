# Statuspage

Fonte: Postman API Reference Library, espaço "Atlassian (Cloud)" (lido em 28/09/2026). 115 funções.


## permissions

| Método | Caminho | Função |
|---|---|---|
| PUT | `organizations/:organization_id/permissions/:user_id` | Update a user's role permissions |
| GET | `organizations/:organization_id/permissions/:user_id` | Get a user's permissions |

## status embed config

| Método | Caminho | Função |
|---|---|---|
| GET | `pages/:page_id/status_embed_config` | Get status embed config settings |
| PATCH | `pages/:page_id/status_embed_config` | Update status embed config settings |
| PUT | `pages/:page_id/status_embed_config` | Update status embed config settings |

## pages

| Método | Caminho | Função |
|---|---|---|
| GET | `pages` | Get a list of pages |
| PATCH | `pages/:page_id` | Update a page |
| PUT | `pages/:page_id` | Update a page |
| GET | `pages/:page_id` | Get a page |

## page access users

| Método | Caminho | Função |
|---|---|---|
| POST | `pages/:page_id/page_access_users` | Add a page access user |
| GET | `pages/:page_id/page_access_users` | Get a list of page access users |
| PATCH | `pages/:page_id/page_access_users/:page_access_user_id` | Update page access user |
| PUT | `pages/:page_id/page_access_users/:page_access_user_id` | Update page access user |
| DELETE | `pages/:page_id/page_access_users/:page_access_user_id` | Delete page access user |
| GET | `pages/:page_id/page_access_users/:page_access_user_id` | Get page access user |

## page access user components

| Método | Caminho | Função |
|---|---|---|
| PATCH | `pages/:page_id/page_access_users/:page_access_user_id/components` | Add components for page access user |
| PUT | `pages/:page_id/page_access_users/:page_access_user_id/components` | Add components for page access user |
| POST | `pages/:page_id/page_access_users/:page_access_user_id/components` | Replace components for page access user |
| DELETE | `pages/:page_id/page_access_users/:page_access_user_id/components` | Remove components for page access user |
| GET | `pages/:page_id/page_access_users/:page_access_user_id/components` | Get components for page access user |
| DELETE | `pages/:page_id/page_access_users/:page_access_user_id/components/:component_id` | Remove component for page access user |

## page access user metrics

| Método | Caminho | Função |
|---|---|---|
| PATCH | `pages/:page_id/page_access_users/:page_access_user_id/metrics` | Add metrics for page access user |
| PUT | `pages/:page_id/page_access_users/:page_access_user_id/metrics` | Add metrics for page access user |
| POST | `pages/:page_id/page_access_users/:page_access_user_id/metrics` | Replace metrics for page access user |
| DELETE | `pages/:page_id/page_access_users/:page_access_user_id/metrics` | Delete metrics for page access user |
| GET | `pages/:page_id/page_access_users/:page_access_user_id/metrics` | Get metrics for page access user |
| DELETE | `pages/:page_id/page_access_users/:page_access_user_id/metrics/:metric_id` | Delete metric for page access user |

## page access groups

| Método | Caminho | Função |
|---|---|---|
| GET | `pages/:page_id/page_access_groups` | Get a list of page access groups |
| POST | `pages/:page_id/page_access_groups` | Create a page access group |
| GET | `pages/:page_id/page_access_groups/:page_access_group_id` | Get a page access group |
| PATCH | `pages/:page_id/page_access_groups/:page_access_group_id` | Update a page access group |
| PUT | `pages/:page_id/page_access_groups/:page_access_group_id` | Update a page access group |
| DELETE | `pages/:page_id/page_access_groups/:page_access_group_id` | Remove a page access group |

## page access group components

| Método | Caminho | Função |
|---|---|---|
| PATCH | `pages/:page_id/page_access_groups/:page_access_group_id/components` | Add components to page access group |
| PUT | `pages/:page_id/page_access_groups/:page_access_group_id/components` | Add components to page access group |
| POST | `pages/:page_id/page_access_groups/:page_access_group_id/components` | Replace components for a page access group |
| DELETE | `pages/:page_id/page_access_groups/:page_access_group_id/components` | Delete components for a page access group |
| GET | `pages/:page_id/page_access_groups/:page_access_group_id/components` | List components for a page access group |
| DELETE | `pages/:page_id/page_access_groups/:page_access_group_id/components/:component_id` | Remove a component from a page access group |

## subscribers

| Método | Caminho | Função |
|---|---|---|
| POST | `pages/:page_id/subscribers/resend_confirmation` | Resend confirmations to a list of subscribers |
| POST | `pages/:page_id/subscribers/unsubscribe` | Unsubscribe a list of subscribers |
| POST | `pages/:page_id/subscribers/reactivate` | Reactivate a list of subscribers |
| GET | `pages/:page_id/subscribers/histogram_by_state` | Get a histogram of subscribers by type and then state |
| GET | `pages/:page_id/subscribers/count` | Get a count of subscribers by type |
| GET | `pages/:page_id/subscribers/unsubscribed` | Get a list of unsubscribed subscribers |
| POST | `pages/:page_id/subscribers` | Create a subscriber |
| GET | `pages/:page_id/subscribers` | Get a list of subscribers |
| POST | `pages/:page_id/subscribers/:subscriber_id/resend_confirmation` | Resend confirmation to a subscriber |
| DELETE | `pages/:page_id/subscribers/:subscriber_id` | Unsubscribe a subscriber |
| PATCH | `pages/:page_id/subscribers/:subscriber_id` | Update a subscriber |
| GET | `pages/:page_id/subscribers/:subscriber_id` | Get a subscriber |

## templates

| Método | Caminho | Função |
|---|---|---|
| POST | `pages/:page_id/incident_templates` | Create a template |
| GET | `pages/:page_id/incident_templates` | Get a list of templates |

## incidents

| Método | Caminho | Função |
|---|---|---|
| POST | `pages/:page_id/incidents` | Create an incident |
| GET | `pages/:page_id/incidents` | Get a list of incidents |
| GET | `pages/:page_id/incidents/active_maintenance` | Get a list of active maintenances |
| GET | `pages/:page_id/incidents/upcoming` | Get a list of upcoming incidents |
| GET | `pages/:page_id/incidents/scheduled` | Get a list of scheduled incidents |
| GET | `pages/:page_id/incidents/unresolved` | Get a list of unresolved incidents |
| DELETE | `pages/:page_id/incidents/:incident_id` | Delete an incident |
| PATCH | `pages/:page_id/incidents/:incident_id` | Update an incident |
| PUT | `pages/:page_id/incidents/:incident_id` | Update an incident |
| GET | `pages/:page_id/incidents/:incident_id` | Get an incident |

## incident updates

| Método | Caminho | Função |
|---|---|---|
| PATCH | `pages/:page_id/incidents/:incident_id/incident_updates/:incident_update_id` | Update a previous incident update |
| PUT | `pages/:page_id/incidents/:incident_id/incident_updates/:incident_update_id` | Update a previous incident update |

## incident subscribers

| Método | Caminho | Função |
|---|---|---|
| POST | `pages/:page_id/incidents/:incident_id/subscribers` | Create an incident subscriber |
| GET | `pages/:page_id/incidents/:incident_id/subscribers` | Get a list of incident subscribers |
| DELETE | `pages/:page_id/incidents/:incident_id/subscribers/:subscriber_id` | Unsubscribe an incident subscriber |
| GET | `pages/:page_id/incidents/:incident_id/subscribers/:subscriber_id` | Get an incident subscriber |
| POST | `pages/:page_id/incidents/:incident_id/subscribers/:subscriber_id/resend_confirmation` | Resend confirmation to an incident subscriber |

## incident postmortem

| Método | Caminho | Função |
|---|---|---|
| GET | `pages/:page_id/incidents/:incident_id/postmortem` | Get Postmortem |
| PUT | `pages/:page_id/incidents/:incident_id/postmortem` | Create Postmortem |
| DELETE | `pages/:page_id/incidents/:incident_id/postmortem` | Delete Postmortem |
| PUT | `pages/:page_id/incidents/:incident_id/postmortem/publish` | Publish Postmortem |
| PUT | `pages/:page_id/incidents/:incident_id/postmortem/revert` | Revert Postmortem |

## components

| Método | Caminho | Função |
|---|---|---|
| POST | `pages/:page_id/components` | Create a component |
| GET | `pages/:page_id/components` | Get a list of components |
| PATCH | `pages/:page_id/components/:component_id` | Update a component |
| PUT | `pages/:page_id/components/:component_id` | Update a component |
| DELETE | `pages/:page_id/components/:component_id` | Delete a component |
| GET | `pages/:page_id/components/:component_id` | Get a component |
| GET | `pages/:page_id/components/:component_id/uptime` | Get uptime data for a component |
| DELETE | `pages/:page_id/components/:component_id/page_access_users` | Remove page access users from component |
| POST | `pages/:page_id/components/:component_id/page_access_users` | Add page access users to a component |
| DELETE | `pages/:page_id/components/:component_id/page_access_groups` | Remove page access groups from a component |
| POST | `pages/:page_id/components/:component_id/page_access_groups` | Add page access groups to a component |

## component groups

| Método | Caminho | Função |
|---|---|---|
| POST | `pages/:page_id/component-groups` | Create a component group |
| GET | `pages/:page_id/component-groups` | Get a list of component groups |
| PATCH | `pages/:page_id/component-groups/:id` | Update a component group |
| PUT | `pages/:page_id/component-groups/:id` | Update a component group |
| DELETE | `pages/:page_id/component-groups/:id` | Delete a component group |
| GET | `pages/:page_id/component-groups/:id` | Get a component group |
| GET | `pages/:page_id/component-groups/:id/uptime` | Get uptime data for a component group |

## metrics

| Método | Caminho | Função |
|---|---|---|
| POST | `pages/:page_id/metrics/data` | Add data points to metrics |
| GET | `pages/:page_id/metrics` | Get a list of metrics |
| PATCH | `pages/:page_id/metrics/:metric_id` | Update a metric |
| PUT | `pages/:page_id/metrics/:metric_id` | Update a metric |
| DELETE | `pages/:page_id/metrics/:metric_id` | Delete a metric |
| GET | `pages/:page_id/metrics/:metric_id` | Get a metric |
| DELETE | `pages/:page_id/metrics/:metric_id/data` | Reset data for a metric |
| POST | `pages/:page_id/metrics/:metric_id/data` | Add data to a metric |
| GET | `pages/:page_id/metrics_providers/:metrics_provider_id/metrics` | List metrics for a metric provider |
| POST | `pages/:page_id/metrics_providers/:metrics_provider_id/metrics` | Create a metric for a metric provider |

## metric providers

| Método | Caminho | Função |
|---|---|---|
| GET | `pages/:page_id/metrics_providers` | Get a list of metric providers |
| POST | `pages/:page_id/metrics_providers` | Create a metric provider |
| GET | `pages/:page_id/metrics_providers/:metrics_provider_id` | Get a metric provider |
| PATCH | `pages/:page_id/metrics_providers/:metrics_provider_id` | Update a metric provider |
| PUT | `pages/:page_id/metrics_providers/:metrics_provider_id` | Update a metric provider |
| DELETE | `pages/:page_id/metrics_providers/:metrics_provider_id` | Delete a metric provider |
| GET | `pages/:page_id/metrics_providers/:metrics_provider_id/metrics` | List metrics for a metric provider |
| POST | `pages/:page_id/metrics_providers/:metrics_provider_id/metrics` | Create a metric for a metric provider |

## users

| Método | Caminho | Função |
|---|---|---|
| GET | `organizations/:organization_id/permissions/:user_id` | Get a user's permissions |
| DELETE | `organizations/:organization_id/users/:user_id` | Delete a user |
| POST | `organizations/:organization_id/users` | Create a user |
| GET | `organizations/:organization_id/users` | Get a list of users |
