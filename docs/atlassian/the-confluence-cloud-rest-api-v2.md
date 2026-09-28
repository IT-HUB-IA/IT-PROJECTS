# Confluence Cloud v2

Fonte: Postman API Reference Library, espaço "Atlassian (Cloud)" (lido em 28/09/2026). 194 funções.


## Attachment

| Método | Caminho | Função |
|---|---|---|
| GET | `attachments` | Get attachments |
| GET | `attachments/:id` | Get attachment by id |
| DELETE | `attachments/:id` | Delete attachment |
| GET | `blogposts/:id/attachments` | Get attachments for blog post |
| GET | `custom-content/:id/attachments` | Get attachments for custom content |
| GET | `labels/:id/attachments` | Get attachments for label |
| GET | `pages/:id/attachments` | Get attachments for page |

## Ancestors

| Método | Caminho | Função |
|---|---|---|
| GET | `whiteboards/:id/ancestors` | Get all ancestors of whiteboard |
| GET | `databases/:id/ancestors` | Get all ancestors of database |
| GET | `embeds/:id/ancestors` | Get all ancestors of Smart Link in content tree |
| GET | `folders/:id/ancestors` | Get all ancestors of folder |
| GET | `pages/:id/ancestors` | Get all ancestors of page |

## Blog Post

| Método | Caminho | Função |
|---|---|---|
| GET | `blogposts` | Get blog posts |
| POST | `blogposts` | Create blog post |
| GET | `blogposts/:id` | Get blog post by id |
| PUT | `blogposts/:id` | Update blog post |
| DELETE | `blogposts/:id` | Delete blog post |
| GET | `labels/:id/blogposts` | Get blog posts for label |
| GET | `spaces/:id/blogposts` | Get blog posts in space |

## Children

| Método | Caminho | Função |
|---|---|---|
| GET | `pages/:id/children` | Get child pages |
| GET | `custom-content/:id/children` | Get child custom content |

## Classification Level

| Método | Caminho | Função |
|---|---|---|
| GET | `classification-levels` | Get list of classification levels |
| GET | `spaces/:id/classification-level/default` | Get space default classification level |
| PUT | `spaces/:id/classification-level/default` | Update space default classification level |
| DELETE | `spaces/:id/classification-level/default` | Delete space default classification level |
| GET | `pages/:id/classification-level` | Get page classification level |
| PUT | `pages/:id/classification-level` | Update page classification level |
| POST | `pages/:id/classification-level/reset` | Reset page classification level |
| GET | `blogposts/:id/classification-level` | Get blog post classification level |
| PUT | `blogposts/:id/classification-level` | Update blog post classification level |
| POST | `blogposts/:id/classification-level/reset` | Reset blog post classification level |
| GET | `whiteboards/:id/classification-level` | Get whiteboard classification level |
| PUT | `whiteboards/:id/classification-level` | Update whiteboard classification level |
| POST | `whiteboards/:id/classification-level/reset` | Reset whiteboard classification level |
| GET | `databases/:id/classification-level` | Get database classification level |
| PUT | `databases/:id/classification-level` | Update database classification level |
| POST | `databases/:id/classification-level/reset` | Reset database classification level |

## Comment

| Método | Caminho | Função |
|---|---|---|
| GET | `attachments/:id/footer-comments` | Get attachment comments |
| GET | `custom-content/:id/footer-comments` | Get custom content comments |
| GET | `pages/:id/footer-comments` | Get footer comments for page |
| GET | `pages/:id/inline-comments` | Get inline comments for page |
| GET | `blogposts/:id/footer-comments` | Get footer comments for blog post |
| GET | `blogposts/:id/inline-comments` | Get inline comments for blog post |
| GET | `footer-comments` | Get footer comments |
| POST | `footer-comments` | Create footer comment |
| GET | `footer-comments/:comment-id` | Get footer comment by id |
| PUT | `footer-comments/:comment-id` | Update footer comment |
| DELETE | `footer-comments/:comment-id` | Delete footer comment |
| GET | `footer-comments/:id/children` | Get children footer comments |
| GET | `inline-comments` | Get inline comments |
| POST | `inline-comments` | Create inline comment |
| GET | `inline-comments/:comment-id` | Get inline comment by id |
| PUT | `inline-comments/:comment-id` | Update inline comment |
| DELETE | `inline-comments/:comment-id` | Delete inline comment |
| GET | `inline-comments/:id/children` | Get children inline comments |

## Content

| Método | Caminho | Função |
|---|---|---|
| POST | `content/convert-ids-to-types` | Convert content ids to content types |

## Content Properties

| Método | Caminho | Função |
|---|---|---|
| GET | `attachments/:attachment-id/properties` | Get content properties for attachment |
| POST | `attachments/:attachment-id/properties` | Create content property for attachment |
| GET | `attachments/:attachment-id/properties/:property-id` | Get content property for attachment by id |
| PUT | `attachments/:attachment-id/properties/:property-id` | Update content property for attachment by id |
| DELETE | `attachments/:attachment-id/properties/:property-id` | Delete content property for attachment by id |
| GET | `blogposts/:blogpost-id/properties` | Get content properties for blog post |
| POST | `blogposts/:blogpost-id/properties` | Create content property for blog post |
| GET | `blogposts/:blogpost-id/properties/:property-id` | Get content property for blog post by id |
| PUT | `blogposts/:blogpost-id/properties/:property-id` | Update content property for blog post by id |
| DELETE | `blogposts/:blogpost-id/properties/:property-id` | Delete content property for blogpost by id |
| GET | `custom-content/:custom-content-id/properties` | Get content properties for custom content |
| POST | `custom-content/:custom-content-id/properties` | Create content property for custom content |
| GET | `custom-content/:custom-content-id/properties/:property-id` | Get content property for custom content by id |
| PUT | `custom-content/:custom-content-id/properties/:property-id` | Update content property for custom content by id |
| DELETE | `custom-content/:custom-content-id/properties/:property-id` | Delete content property for custom content by id |
| GET | `pages/:page-id/properties` | Get content properties for page |
| POST | `pages/:page-id/properties` | Create content property for page |
| GET | `pages/:page-id/properties/:property-id` | Get content property for page by id |
| PUT | `pages/:page-id/properties/:property-id` | Update content property for page by id |
| DELETE | `pages/:page-id/properties/:property-id` | Delete content property for page by id |
| GET | `whiteboards/:id/properties` | Get content properties for whiteboard |
| POST | `whiteboards/:id/properties` | Create content property for whiteboard |
| GET | `whiteboards/:whiteboard-id/properties/:property-id` | Get content property for whiteboard by id |
| PUT | `whiteboards/:whiteboard-id/properties/:property-id` | Update content property for whiteboard by id |
| DELETE | `whiteboards/:whiteboard-id/properties/:property-id` | Delete content property for whiteboard by id |
| GET | `databases/:id/properties` | Get content properties for database |
| POST | `databases/:id/properties` | Create content property for database |
| GET | `databases/:database-id/properties/:property-id` | Get content property for database by id |
| PUT | `databases/:database-id/properties/:property-id` | Update content property for database by id |
| DELETE | `databases/:database-id/properties/:property-id` | Delete content property for database by id |
| GET | `embeds/:id/properties` | Get content properties for Smart Link in the content tree |
| POST | `embeds/:id/properties` | Create content property for Smart Link in the content tree |
| GET | `embeds/:embed-id/properties/:property-id` | Get content property for Smart Link in the content tree by id |
| PUT | `embeds/:embed-id/properties/:property-id` | Update content property for Smart Link in the content tree by id |
| DELETE | `embeds/:embed-id/properties/:property-id` | Delete content property for Smart Link in the content tree by id |
| GET | `folders/:id/properties` | Get content properties for folder |
| POST | `folders/:id/properties` | Create content property for folder |
| GET | `folders/:folder-id/properties/:property-id` | Get content property for folder by id |
| PUT | `folders/:folder-id/properties/:property-id` | Update content property for folder by id |
| DELETE | `folders/:folder-id/properties/:property-id` | Delete content property for folder by id |
| GET | `comments/:comment-id/properties` | Get content properties for comment |
| POST | `comments/:comment-id/properties` | Create content property for comment |
| GET | `comments/:comment-id/properties/:property-id` | Get content property for comment by id |
| PUT | `comments/:comment-id/properties/:property-id` | Update content property for comment by id |
| DELETE | `comments/:comment-id/properties/:property-id` | Delete content property for comment by id |

## Custom Content

| Método | Caminho | Função |
|---|---|---|
| GET | `blogposts/:id/custom-content` | Get custom content by type in blog post |
| GET | `custom-content` | Get custom content by type |
| POST | `custom-content` | Create custom content |
| GET | `custom-content/:id` | Get custom content by id |
| PUT | `custom-content/:id` | Update custom content |
| DELETE | `custom-content/:id` | Delete custom content |
| GET | `pages/:id/custom-content` | Get custom content by type in page |
| GET | `spaces/:id/custom-content` | Get custom content by type in space |

## Database

| Método | Caminho | Função |
|---|---|---|
| POST | `databases` | Create database |
| GET | `databases/:id` | Get database by id |
| DELETE | `databases/:id` | Delete database |

## Data Policies

| Método | Caminho | Função |
|---|---|---|
| GET | `data-policies/metadata` | Get data policy metadata for the workspace |
| GET | `data-policies/spaces` | Get spaces with data policies |

## Folder

| Método | Caminho | Função |
|---|---|---|
| POST | `folders` | Create folder |
| GET | `folders/:id` | Get folder by id |
| DELETE | `folders/:id` | Delete folder |

## Label

| Método | Caminho | Função |
|---|---|---|
| GET | `attachments/:id/labels` | Get labels for attachment |
| GET | `blogposts/:id/labels` | Get labels for blog post |
| GET | `custom-content/:id/labels` | Get labels for custom content |
| GET | `labels` | Get labels |
| GET | `pages/:id/labels` | Get labels for page |
| GET | `spaces/:id/labels` | Get labels for space |
| GET | `spaces/:id/content/labels` | Get labels for space content |

## Like

| Método | Caminho | Função |
|---|---|---|
| GET | `blogposts/:id/likes/count` | Get like count for blog post |
| GET | `blogposts/:id/likes/users` | Get account IDs of likes for blog post |
| GET | `pages/:id/likes/count` | Get like count for page |
| GET | `pages/:id/likes/users` | Get account IDs of likes for page |
| GET | `footer-comments/:id/likes/count` | Get like count for footer comment |
| GET | `footer-comments/:id/likes/users` | Get account IDs of likes for footer comment |
| GET | `inline-comments/:id/likes/count` | Get like count for inline comment |
| GET | `inline-comments/:id/likes/users` | Get account IDs of likes for inline comment |

## Operation

| Método | Caminho | Função |
|---|---|---|
| GET | `attachments/:id/operations` | Get permitted operations for attachment |
| GET | `blogposts/:id/operations` | Get permitted operations for blog post |
| GET | `custom-content/:id/operations` | Get permitted operations for custom content |
| GET | `pages/:id/operations` | Get permitted operations for page |
| GET | `whiteboards/:id/operations` | Get permitted operations for a whiteboard |
| GET | `databases/:id/operations` | Get permitted operations for a database |
| GET | `embeds/:id/operations` | Get permitted operations for a Smart Link in the content tree |
| GET | `folders/:id/operations` | Get permitted operations for a folder |
| GET | `spaces/:id/operations` | Get permitted operations for space |
| GET | `footer-comments/:id/operations` | Get permitted operations for footer comment |
| GET | `inline-comments/:id/operations` | Get permitted operations for inline comment |

## Page

| Método | Caminho | Função |
|---|---|---|
| GET | `labels/:id/pages` | Get pages for label |
| GET | `pages` | Get pages |
| POST | `pages` | Create page |
| GET | `pages/:id` | Get page by id |
| PUT | `pages/:id` | Update page |
| DELETE | `pages/:id` | Delete page |
| GET | `spaces/:id/pages` | Get pages in space |

## Smart Link

| Método | Caminho | Função |
|---|---|---|
| POST | `embeds` | Create Smart Link in the content tree |
| GET | `embeds/:id` | Get Smart Link in the content tree by id |
| DELETE | `embeds/:id` | Delete Smart Link in the content tree |

## Space

| Método | Caminho | Função |
|---|---|---|
| GET | `spaces` | Get spaces |
| POST | `spaces` | Create space |
| GET | `spaces/:id` | Get space by id |

## Space Permissions

| Método | Caminho | Função |
|---|---|---|
| GET | `spaces/:id/permissions` | Get space permissions assignments |
| GET | `space-permissions` | Get available space permissions |

## Space Properties

| Método | Caminho | Função |
|---|---|---|
| GET | `spaces/:space-id/properties` | Get space properties in space |
| POST | `spaces/:space-id/properties` | Create space property in space |
| GET | `spaces/:space-id/properties/:property-id` | Get space property by id |
| PUT | `spaces/:space-id/properties/:property-id` | Update space property by id |
| DELETE | `spaces/:space-id/properties/:property-id` | Delete space property by id |

## Space Roles

| Método | Caminho | Função |
|---|---|---|
| GET | `space-roles` | Get available space roles |
| GET | `space-roles/:id` | Get space role by ID |
| GET | `spaces/:id/role-assignments` | Get space role assignments |
| POST | `spaces/:id/role-assignments` | Set space role assignments |

## Task

| Método | Caminho | Função |
|---|---|---|
| GET | `tasks` | Get tasks |
| GET | `tasks/:id` | Get task by id |
| PUT | `tasks/:id` | Update task |

## User

| Método | Caminho | Função |
|---|---|---|
| POST | `users-bulk` | Create bulk user lookup using ids |
| POST | `user/access/check-access-by-email` | Check site access for a list of emails |
| POST | `user/access/invite-by-email` | Invite a list of emails to the site |

## Version

| Método | Caminho | Função |
|---|---|---|
| GET | `attachments/:id/versions` | Get attachment versions |
| GET | `attachments/:attachment-id/versions/:version-number` | Get version details for attachment version |
| GET | `blogposts/:id/versions` | Get blog post versions |
| GET | `blogposts/:blogpost-id/versions/:version-number` | Get version details for blog post version |
| GET | `pages/:id/versions` | Get page versions |
| GET | `pages/:page-id/versions/:version-number` | Get version details for page version |
| GET | `custom-content/:custom-content-id/versions` | Get custom content versions |
| GET | `custom-content/:custom-content-id/versions/:version-number` | Get version details for custom content version |
| GET | `footer-comments/:id/versions` | Get footer comment versions |
| GET | `footer-comments/:id/versions/:version-number` | Get version details for footer comment version |
| GET | `inline-comments/:id/versions` | Get inline comment versions |
| GET | `inline-comments/:id/versions/:version-number` | Get version details for inline comment version |

## Whiteboard

| Método | Caminho | Função |
|---|---|---|
| POST | `whiteboards` | Create whiteboard |
| GET | `whiteboards/:id` | Get whiteboard by id |
| DELETE | `whiteboards/:id` | Delete whiteboard |

## EAP

| Método | Caminho | Função |
|---|---|---|
| POST | `spaces` | Create space |
| GET | `space-permissions` | Get available space permissions |
| GET | `space-roles` | Get available space roles |
| GET | `space-roles/:id` | Get space role by ID |
| GET | `spaces/:id/role-assignments` | Get space role assignments |
| POST | `spaces/:id/role-assignments` | Set space role assignments |
