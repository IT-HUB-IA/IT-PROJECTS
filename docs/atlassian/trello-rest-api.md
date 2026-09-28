# Trello REST API

Fonte: Postman API Reference Library, espaço "Atlassian (Cloud)" (lido em 28/09/2026). 255 funções.


## Geral

| Método | Caminho | Função |
|---|---|---|
| GET | `actions/:id` | Get an Action |
| PUT | `actions/:id` | Update an Action |
| DELETE | `actions/:id` | Delete an Action |
| GET | `actions/:id/:field` | Get a specific field on an Action |
| GET | `actions/:id/board` | Get the Board for an Action |
| GET | `actions/:id/card` | Get the Card for an Action |
| GET | `actions/:id/list` | Get the List for an Action |
| GET | `actions/:id/member` | Get the Member of an Action |
| GET | `actions/:id/memberCreator` | Get the Member Creator of an Action |
| GET | `actions/:id/organization` | Get the Organization of an Action |
| PUT | `actions/:id/text` | Update a Comment Action |
| GET | `actions/:idAction/reactions` | Get Action's Reactions |
| POST | `actions/:idAction/reactions` | Create Reaction for Action |
| GET | `actions/:idAction/reactions/:id` | Get Action's Reaction |
| DELETE | `actions/:idAction/reactions/:id` | Delete Action's Reaction |
| GET | `actions/:idAction/reactionsSummary` | List Action's summary of Reactions |
| GET | `applications/:key/compliance` | Get Application's compliance data |
| GET | `batch` | Batch Requests |
| GET | `boards/:id/memberships` | Get Memberships of a Board |
| GET | `boards/:id` | Get a Board |
| PUT | `boards/:id` | Update a Board |
| DELETE | `boards/:id` | Delete a Board |
| GET | `boards/:id/:field` | Get a field on a Board |
| GET | `boards/:boardId/actions` | Get Actions of a Board |
| GET | `boards/:boardId/boardStars` | Get boardStars on a Board |
| GET | `boards/:id/checklists` | Get Checklists on a Board |
| GET | `boards/:id/cards` | Get Cards on a Board |
| GET | `boards/:id/cards/:filter` | Get filtered Cards on a Board |
| GET | `boards/:id/customFields` | Get Custom Fields for Board |
| GET | `boards/:id/labels` | Get Labels on a Board |
| POST | `boards/:id/labels` | Create a Label on a Board |
| GET | `boards/:id/lists` | Get Lists on a Board |
| POST | `boards/:id/lists` | Create a List on a Board |
| GET | `boards/:id/lists/:filter` | Get filtered Lists on a Board |
| GET | `boards/:id/members` | Get the Members of a Board |
| PUT | `boards/:id/members` | Invite Member to Board via email |
| PUT | `boards/:id/members/:idMember` | Add a Member to a Board |
| DELETE | `boards/:id/members/:idMember` | Remove Member from Board |
| PUT | `boards/:id/memberships/:idMembership` | Update Membership of Member on a Board |
| PUT | `boards/:id/myPrefs/emailPosition` | Update emailPosition Pref on a Board |
| PUT | `boards/:id/myPrefs/idEmailList` | Update idEmailList Pref on a Board |
| PUT | `boards/:id/myPrefs/showSidebar` | Update showSidebar Pref on a Board |
| PUT | `boards/:id/myPrefs/showSidebarActivity` | Update showSidebarActivity Pref on a Board |
| PUT | `boards/:id/myPrefs/showSidebarBoardActions` | Update showSidebarBoardActions Pref on a Board |
| PUT | `boards/:id/myPrefs/showSidebarMembers` | Update showSidebarMembers Pref on a Board |
| POST | `boards/` | Create a Board |
| POST | `boards/:id/calendarKey/generate` | Create a calendarKey for a Board |
| POST | `boards/:id/emailKey/generate` | Create a emailKey for a Board |
| POST | `boards/:id/idTags` | Create a Tag for a Board |
| POST | `boards/:id/markedAsViewed` | Mark Board as viewed |
| GET | `boards/:id/boardPlugins` | Get Enabled Power-Ups on Board |
| POST | `boards/:id/boardPlugins` | Enable a Power-Up on a Board |
| DELETE | `boards/:id/boardPlugins/:idPlugin` | Disable a Power-Up on a Board |
| GET | `boards/:id/plugins` | Get Power-Ups on a Board |
| POST | `cards` | Create a new Card |
| GET | `cards/:id` | Get a Card |
| PUT | `cards/:id` | Update a Card |
| DELETE | `cards/:id` | Delete a Card |
| GET | `cards/:id/:field` | Get a field on a Card |
| GET | `cards/:id/actions` | Get Actions on a Card |
| GET | `cards/:id/attachments` | Get Attachments on a Card |
| POST | `cards/:id/attachments` | Create Attachment On Card |
| GET | `cards/:id/attachments/:idAttachment` | Get an Attachment on a Card |
| DELETE | `cards/:id/attachments/:idAttachment` | Delete an Attachment on a Card |
| GET | `cards/:id/board` | Get the Board the Card is on |
| GET | `cards/:id/checkItemStates` | Get checkItems on a Card |
| GET | `cards/:id/checklists` | Get Checklists on a Card |
| POST | `cards/:id/checklists` | Create Checklist on a Card |
| GET | `cards/:id/checkItem/:idCheckItem` | Get checkItem on a Card |
| PUT | `cards/:id/checkItem/:idCheckItem` | Update a checkItem on a Card |
| DELETE | `cards/:id/checkItem/:idCheckItem` | Delete checkItem on a Card |
| GET | `cards/:id/list` | Get the List of a Card |
| GET | `cards/:id/members` | Get the Members of a Card |
| GET | `cards/:id/membersVoted` | Get Members who have voted on a Card |
| POST | `cards/:id/membersVoted` | Add Member vote to Card |
| GET | `cards/:id/pluginData` | Get pluginData on a Card |
| GET | `cards/:id/stickers` | Get Stickers on a Card |
| POST | `cards/:id/stickers` | Add a Sticker to a Card |
| GET | `cards/:id/stickers/:idSticker` | Get a Sticker on a Card |
| DELETE | `cards/:id/stickers/:idSticker` | Delete a Sticker on a Card |
| PUT | `cards/:id/stickers/:idSticker` | Update a Sticker on a Card |
| PUT | `cards/:id/actions/:idAction/comments` | Update Comment Action on a Card |
| DELETE | `cards/:id/actions/:idAction/comments` | Delete a comment on a Card |
| PUT | `cards/:idCard/customField/:idCustomField/item` | Update Custom Field item on Card |
| PUT | `cards/:idCard/customFields` | Update Multiple Custom Field items on Card |
| GET | `cards/:id/customFieldItems` | Get Custom Field Items for a Card |
| POST | `cards/:id/actions/comments` | Add a new comment to a Card |
| POST | `cards/:id/idLabels` | Add a Label to a Card |
| POST | `cards/:id/idMembers` | Add a Member to a Card |
| POST | `cards/:id/labels` | Create a new Label on a Card |
| POST | `cards/:id/markAssociatedNotificationsRead` | Mark a Card's Notifications as read |
| DELETE | `cards/:id/idLabels/:idLabel` | Remove a Label from a Card |
| DELETE | `cards/:id/idMembers/:idMember` | Remove a Member from a Card |
| DELETE | `cards/:id/membersVoted/:idMember` | Remove a Member's Vote on a Card |
| PUT | `cards/:idCard/checklist/:idChecklist/checkItem/:idCheckItem` | Update Checkitem on Checklist on Card |
| DELETE | `cards/:id/checklists/:idChecklist` | Delete a Checklist on a Card |
| POST | `checklists` | Create a Checklist |
| GET | `checklists/:id` | Get a Checklist |
| PUT | `checklists/:id` | Update a Checklist |
| DELETE | `checklists/:id` | Delete a Checklist |
| GET | `checklists/:id/:field` | Get field on a Checklist |
| PUT | `checklists/:id/:field` | Update field on a Checklist |
| GET | `checklists/:id/board` | Get the Board the Checklist is on |
| GET | `checklists/:id/cards` | Get the Card a Checklist is on |
| GET | `checklists/:id/checkItems` | Get Checkitems on a Checklist |
| POST | `checklists/:id/checkItems` | Create Checkitem on Checklist |
| GET | `checklists/:id/checkItems/:idCheckItem` | Get a Checkitem on a Checklist |
| DELETE | `checklists/:id/checkItems/:idCheckItem` | Delete Checkitem from Checklist |
| POST | `customFields` | Create a new Custom Field on a Board |
| GET | `customFields/:id` | Get a Custom Field |
| PUT | `customFields/:id` | Update a Custom Field definition |
| DELETE | `customFields/:id` | Delete a Custom Field definition |
| POST | `customFields/:id/options` | Add Option to Custom Field dropdown |
| GET | `customFields/:id/options` | Get Options of Custom Field drop down |
| GET | `customFields/:id/options/:idCustomFieldOption` | Get Option of Custom Field dropdown |
| DELETE | `customFields/:id/options/:idCustomFieldOption` | Delete Option of Custom Field dropdown |
| GET | `emoji` | List available Emoji |
| GET | `enterprises/:id` | Get an Enterprise |
| GET | `enterprises/:id/auditlog` | Get auditlog data for an Enterprise |
| GET | `enterprises/:id/admins` | Get Enterprise admin Members |
| GET | `enterprises/:id/signupUrl` | Get signupUrl for Enterprise |
| GET | `enterprises/:id/members/query` | Get Users of an Enterprise |
| GET | `enterprises/:id/members` | Get Members of Enterprise |
| GET | `enterprises/:id/members/:idMember` | Get a Member of Enterprise |
| GET | `enterprises/:id/transferrable/organization/:idOrganization` | Get whether an organization can be transferred to an enterprise. |
| GET | `enterprises/:id/transferrable/bulk/:idOrganizations` | Get a bulk list of organizations that can be transferred to an enterprise. |
| PUT | `enterprises/${{id}}/enterpriseJoinRequest/bulk` | Decline enterpriseJoinRequests from one organization or a bulk list of organizations. |
| GET | `enterprises/:id/claimableOrganizations` | Get ClaimableOrganizations of an Enterprise |
| GET | `enterprises/:id/pendingOrganizations` | Get PendingOrganizations of an Enterprise |
| POST | `enterprises/:id/tokens` | Create an auth Token for an Enterprise. |
| PUT | `enterprises/:id/organizations` | Transfer an Organization to an Enterprise. |
| PUT | `enterprises/:id/members/:idMember/licensed` | Update a Member's licensed status |
| PUT | `enterprises/:id/members/:idMember/deactivated` | Deactivate a Member of an Enterprise. |
| PUT | `enterprises/:id/admins/:idMember` | Update Member to be admin of Enterprise |
| DELETE | `enterprises/:id/admins/:idMember` | Remove a Member as admin from Enterprise. |
| DELETE | `enterprises/:id/organizations/:idOrg` | Delete an Organization from an Enterprise. |
| GET | `enterprises/:id/organizations/bulk/:idOrganizations` | Bulk accept a set of organizations to an Enterprise. |
| GET | `labels/:id` | Get a Label |
| PUT | `labels/:id` | Update a Label |
| DELETE | `labels/:id` | Delete a Label |
| PUT | `labels/:id/:field` | Update a field on a label |
| POST | `labels` | Create a Label |
| GET | `lists/:id` | Get a List |
| PUT | `lists/:id` | Update a List |
| POST | `lists` | Create a new List |
| POST | `lists/:id/archiveAllCards` | Archive all Cards in List |
| POST | `lists/:id/moveAllCards` | Move all Cards in List |
| PUT | `lists/:id/closed` | Archive or unarchive a list |
| PUT | `lists/:id/idBoard` | Move List to Board |
| PUT | `lists/:id/:field` | Update a field on a List |
| GET | `lists/:id/actions` | Get Actions for a List |
| GET | `lists/:id/board` | Get the Board a List is on |
| GET | `lists/:id/cards` | Get Cards in a List |
| GET | `members/:id` | Get a Member |
| PUT | `members/:id` | Update a Member |
| GET | `members/:id/:field` | Get a field on a Member |
| GET | `members/:id/actions` | Get a Member's Actions |
| GET | `members/:id/boardBackgrounds` | Get Member's custom Board backgrounds |
| POST | `members/:id/boardBackgrounds` | Upload new boardBackground for Member |
| GET | `members/:id/boardBackgrounds/:idBackground` | Get a boardBackground of a Member |
| PUT | `members/:id/boardBackgrounds/:idBackground` | Update a Member's custom Board background |
| DELETE | `members/:id/boardBackgrounds/:idBackground` | Delete a Member's custom Board background |
| GET | `members/:id/boardStars` | Get a Member's boardStars |
| POST | `members/:id/boardStars` | Create Star for Board |
| GET | `members/:id/boardStars/:idStar` | Get a boardStar of Member |
| PUT | `members/:id/boardStars/:idStar` | Update the position of a boardStar of Member |
| DELETE | `members/:id/boardStars/:idStar` | Delete Star for Board |
| GET | `members/:id/boards` | Get Boards that Member belongs to |
| GET | `members/:id/boardsInvited` | Get Boards the Member has been invited to |
| GET | `members/:id/cards` | Get Cards the Member is on |
| GET | `members/:id/customBoardBackgrounds` | Get a Member's custom Board Backgrounds |
| POST | `members/:id/customBoardBackgrounds` | Create a new custom Board Background |
| GET | `members/:id/customBoardBackgrounds/:idBackground` | Get custom Board Background of Member |
| PUT | `members/:id/customBoardBackgrounds/:idBackground` | Update custom Board Background of Member |
| DELETE | `members/:id/customBoardBackgrounds/:idBackground` | Delete custom Board Background of Member |
| GET | `members/:id/customEmoji` | Get a Member's customEmojis |
| POST | `members/:id/customEmoji` | Create custom Emoji for Member |
| GET | `members/:id/customEmoji/:idEmoji` | Get a Member's custom Emoji |
| GET | `members/:id/customStickers` | Get Member's custom Stickers |
| POST | `members/:id/customStickers` | Create custom Sticker for Member |
| GET | `members/:id/customStickers/:idSticker` | Get a Member's custom Sticker |
| DELETE | `members/:id/customStickers/:idSticker` | Delete a Member's custom Sticker |
| GET | `members/:id/notifications` | Get Member's Notifications |
| GET | `members/:id/organizations` | Get Member's Organizations |
| GET | `members/:id/organizationsInvited` | Get Organizations a Member has been invited to |
| GET | `members/:id/savedSearches` | Get Member's saved searched |
| POST | `members/:id/savedSearches` | Create saved Search for Member |
| GET | `members/:id/savedSearches/:idSearch` | Get a saved search |
| PUT | `members/:id/savedSearches/:idSearch` | Update a saved search |
| DELETE | `members/:id/savedSearches/:idSearch` | Delete a saved search |
| GET | `members/:id/tokens` | Get Member's Tokens |
| POST | `members/:id/avatar` | Create Avatar for Member |
| POST | `members/:id/oneTimeMessagesDismissed` | Dismiss a message for Member |
| GET | `members/:id/notificationsChannelSettings` | Get a Member's notification channel settings |
| PUT | `members/:id/notificationsChannelSettings` | Update blocked notification keys of Member on a channel |
| GET | `members/:id/notificationsChannelSettings/:channel` | Get blocked notification keys of Member on this channel |
| PUT | `members/:id/notificationsChannelSettings/:channel` | Update blocked notification keys of Member on a channel |
| PUT | `members/:id/notificationsChannelSettings/:channel/:blockedKeys` | Update blocked notification keys of Member on a channel |
| GET | `notifications/:id` | Get a Notification |
| PUT | `notifications/:id` | Update a Notification's read status |
| GET | `notifications/:id/:field` | Get a field of a Notification |
| POST | `notifications/all/read` | Mark all Notifications as read |
| PUT | `notifications/:id/unread` | Update Notification's read status |
| GET | `notifications/:id/board` | Get the Board a Notification is on |
| GET | `notifications/:id/card` | Get the Card a Notification is on |
| GET | `notifications/:id/list` | Get the List a Notification is on |
| GET | `notifications/:id/member` | Get the Member a Notification is about (not the creator) |
| GET | `notifications/:id/memberCreator` | Get the Member who created the Notification |
| GET | `notifications/:id/organization` | Get a Notification's associated Organization |
| POST | `organizations` | Create a new Organization |
| GET | `organizations/:id` | Get an Organization |
| PUT | `organizations/:id` | Update an Organization |
| DELETE | `organizations/:id` | Delete an Organization |
| GET | `organizations/:id/:field` | Get field on Organization |
| GET | `organizations/:id/actions` | Get Actions for Organization |
| GET | `organizations/:id/boards` | Get Boards in an Organization |
| POST | `organizations/:id/exports` | Create Export for Organizations |
| GET | `organizations/:id/exports` | Retrieve Organization's Exports |
| GET | `organizations/:id/members` | Get the Members of an Organization |
| PUT | `organizations/:id/members` | Update an Organization's Members |
| GET | `organizations/:id/memberships` | Get Memberships of an Organization |
| GET | `organizations/:id/memberships/:idMembership` | Get a Membership of an Organization |
| GET | `organizations/:id/pluginData` | Get the pluginData Scoped to Organization |
| GET | `organizations/:id/tags` | Get Tags of an Organization |
| POST | `organizations/:id/tags` | Create a Tag in Organization |
| PUT | `organizations/:id/members/:idMember` | Update a Member of an Organization |
| DELETE | `organizations/:id/members/:idMember` | Remove a Member from an Organization |
| PUT | `organizations/:id/members/:idMember/deactivated` | Deactivate or reactivate a member of an Organization |
| POST | `organizations/:id/logo` | Update logo for an Organization |
| DELETE | `organizations/:id/logo` | Delete Logo for Organization |
| DELETE | `organizations/:id/members/:idMember/all` | Remove a Member from an Organization and all Organization Boards |
| DELETE | `organizations/:id/prefs/associatedDomain` | Remove the associated Google Apps domain from a Workspace |
| DELETE | `organizations/:id/prefs/orgInviteRestrict` | Delete the email domain restriction on who can be invited to the Workspace |
| DELETE | `organizations/:id/tags/:idTag` | Delete an Organization's Tag |
| GET | `organizations/:id/newBillableGuests/:idBoard` | Get Organizations new billable guests |
| GET | `plugins/:id/` | Get a Plugin |
| PUT | `plugins/:id/` | Update a Plugin |
| POST | `plugins/:idPlugin/listing` | Create a Listing for Plugin |
| GET | `plugins/:id/compliance/memberPrivacy` | Get Plugin's Member privacy compliance |
| PUT | `plugins/:idPlugin/listings/:idListing` | Updating Plugin's Listing |
| GET | `search` | Search Trello |
| GET | `search/members/` | Search for Members |
| GET | `tokens/:token` | Get a Token |
| GET | `tokens/:token/member` | Get Token's Member |
| GET | `tokens/:token/webhooks` | Get Webhooks for Token |
| POST | `tokens/:token/webhooks` | Create Webhooks for Token |
| GET | `tokens/:token/webhooks/:idWebhook` | Get a Webhook belonging to a Token |
| DELETE | `tokens/:token/webhooks/:idWebhook` | Delete a Webhook created by Token |
| PUT | `tokens/:token/webhooks/:idWebhook` | Update a Webhook created by Token |
| DELETE | `tokens/:token/` | Delete a Token |
| POST | `webhooks/` | Create a Webhook |
| GET | `webhooks/:id` | Get a Webhook |
| PUT | `webhooks/:id` | Update a Webhook |
| DELETE | `webhooks/:id` | Delete a Webhook |
| GET | `webhooks/:id/:field` | Get a field on a Webhook |
