# Admin portal: people API (users, waitlist, support inbox, dashboard, metrics)

Migration `0015_admin_people.sql`. All routes are under `/api/admin`, behind Access JWT (lock 1) and the
admin session plus role check (lock 2, `requireAdmin(area, level)`). Errors are `{ code, message, ...extra }`.
Times are ISO 8601 strings. Types and zod schemas: `packages/types/src/admin-people.ts`. Every write is
audited (actor = admin id; meta holds ids and category codes only, never addresses or free text).

## Contract with the People screens (matches `apps/admin/lib/people`)

Users
- `GET /users?q&status&cursor&limit` -> `{users[{id,name,email,status,joinedAt,lastSignInAt,pathsCount,authMethods[]}], nextCursor, totals{learners,waitlist}}`. Newest first; `q` matches the start of an email or name; `status` = `active|unconfirmed|suspended`. `lastSignInAt` is the newest session still on record.
- `GET /users/:id` -> `{user{...row, emailConfirmed, emailConfirmedAt (always null: Better Auth keeps no time), authMethod (password|google|both), suspension{reason,note,at,by}|null, profileHidden (null: no profile moderation yet), profile{username,isPublic}, paths[{id,title,state,lessonsDone,lessonsTotal,percent,finishedAt}], submissions[{id,title,status (approved|in_review|declined|needs_changes),at}], tickets[{id,kind,subject,status,at}], impact{paths,pathsCompleted,submissions,openTickets}}}`. The catalogue is not in D1, so a path's `title` is its slug, `lessonsTotal` is 0 and `percent` is 100 only when completed.
- `POST /users/:id/reset-link` (manage) -> 202 `{sent:true}`; starts the learner's normal reset email (15 min, single use); the link is never returned. 409 `user_suspended`. 3 per learner and 30 per admin per hour.
- `POST /users/:id/suspend {reason, message?}` (manage): `reason` is a short code (portal sends spam, guidelines, security, other); `message` is the text emailed to the learner (stored as the suspension note; the audit row only keeps the reason code and whether a message existed). Deletes all sessions, blocks new ones (session hook, code `account_suspended`). 409 `already_suspended`.
- `POST /users/:id/restore` (manage) -> `{restored:true}`, emails the learner. 409 `not_suspended`.
- `POST /users/:id/export` (manage) -> `{queued:false, data:{...the learner's data copy}}` (no hashes or tokens), audited, 20 per hour per admin. Nothing is emailed.
- `DELETE /users/:id {confirm, emailCopy?}` (manage, **Super admin only**, **fresh auth**): `confirm` must equal the learner's email. 403 `forbidden`, 401 `reauth_required` (client then POST /reauth and retries), 400 `confirm_mismatch`. Reuses `deleteLearnerAccount` (shared with `routes/account.ts`). `emailCopy` is accepted but **not implemented** (no data-copy email exists yet).

Waitlist (only confirmed subscribers are listed; status is derived and exclusive: waiting, invited, created, confirmed)
- `GET /waitlist/stats` -> `{waiting,oldestWaitingAt,invited,lastBatchAt,created,confirmed,learners}` (also nested under `stats`). created/confirmed count invited people.
- `GET /waitlist?status=waiting|invited|joined|created|confirmed&cursor&limit` -> `{entries[{id (string),email,joinedAt,source (referral|null),status,invitedAt,batchId}], nextCursor}`, oldest first. `joined` = created or confirmed.
- `GET /waitlist/batches` -> `{batches[{id,sentAt,invited,created,confirmed,notJoined,reminderSentAt, createdAt,createdAccount,needReminder,reminded,joinedFrom,joinedTo}]}` (last 20). `notJoined` = invited 7+ days ago, not joined, invite valid, never reminded.
- `POST /waitlist/invites {count}` (1 to 100) or `{ids[]}` (numeric subscriber ids) (manage) -> 201 `{batchId,sent,invited,joinedFrom,joinedTo}`: oldest waiting first, 14-day single-use invites through `prepareInvite` (token hash only), one `waitlist-invite` email each. 409 `nothing_to_send`, 409 `conflict`. 10 per hour per admin.
- `POST /waitlist/batches/:id/remind` (manage) -> `{reminded}`: the one reminder with a fresh 14-day link. 409 `none_eligible`, 404 unknown batch.

## Support inbox (`support_inbox`)

`admin-support.ts` keeps `POST /support/:id/reply`; a staff reply sets `waiting_on_user` (stamps `first_reply_at`, `waiting_since`, notifies and emails the learner). The learner API keeps reporting `replied` for that state, and a learner follow-up reopens the ticket.
- `GET /support?tab=open|waiting|resolved&kind&category&status&assigned=me&overdue=1&cursor&limit` -> `{tickets[], nextCursor, counts{open,waiting,resolved (last 30 days),resolvedLast30d,overdue}}`. Open/waiting: overdue first, then oldest first; resolved: newest closed first. Ticket: `id,kind,category,subject,snippet,status,isNew,logged,assignedToMe,createdAt,updatedAt,dueAt,overdue,state,secondsLeft,resolvesAt,requester{name,email},from{id,name,email}`.
- `GET /support/:id` -> `{ticket{id,kind,category,subject,status,isNew,createdAt,updatedAt,closedAt,dueAt,overdue,sla,resolvesAt,autoResolveDays (7 while waiting_on_user),assignee{id,name}|null,assignedToMe,attached[],context,issue{id,title,severity}|null,linkedIssue,linkReport{id,title,reports}|null,requester{id,name,email,joinedAt,paths,pathsCount,pastTotal,pastResolved,pastRequests},messages[{id,author learner|staff|note,name,authorName,channel,body,at}]}, requester}`. `linkReport` is only the stored reference (title "Link report", reports 1) until link reports exist.
- `POST /support/:id/note {body}`: internal, never shown to the learner. 201.
- `POST /support/:id/assign {to:"me"|"nobody"}`.
- `POST /support/:id/log {title, description?, severity, area?, linkReportId?, notifyRequester?}` -> 201 `{issueId, issue}`. Reports only (409 `not_a_report`), once (409 `already_logged`), live tickets only. The request stays open.
- `POST /support/:id/status {status, message?}`: `open` (also reopens a closed ticket), `waiting_on_user`, `resolved`, `fixed`, `cant_reproduce` (the last two for problem reports only). Closing statuses notify the learner; `message` becomes a staff message in the thread and is sent with the notification and email. 409 `ticket_closed` when closing something already closed.
- SLA: first reply due 2 working days (Mon to Fri) after creation, stored at creation (`support/sla.ts`; older tickets were backfilled +48 h). Not yet driven by Settings queue targets.
- Auto-resolve: `cron/support.ts` runs on every 30-minute tick; `waiting_on_user` for 7 days becomes `resolved`, with an in-app notification, the `support-closed` email and audit `support.auto_resolved`.

## Dashboard (`dashboard:view`)

`GET /dashboard?range=today|7d|30d|90d|custom&from=YYYY-MM-DD&to=YYYY-MM-DD` (custom: whole UTC days, max 366). The previous period is the equally long period right before. Response: `variant` (`admin` | `curator` | `support`, from permissions: Super admin and mixed roles are `admin`), `range{key,from,to,previousFrom,previousTo,buckets[7]}`, `empty` (no learners yet), `attention[{key,count,href}]` (`submissions_over_5_days`, `requests_overdue`), `stats[4]{key,label,value,previous}`, `series` (7 points for current and previous), `queue[{id,kind,title,meta,createdAt,href}]`, `noResultSearches`, `recentActivity[]` (admin variant with `audit_log:view`), `atRisk[]` (learners who started a path and have been quiet 14 to 60 days), `accountsNeedHelp[]` (support variant: unconfirmed 3+ days).
Sections the admin cannot open are empty, not leaked. Stat sets: admin = new learners, weekly active, path completions, open help requests (series `signups` + `active`); support = open requests, avg first reply (hours), resolved, unconfirmed accounts (series `opened` + `resolved`); curator = live resources, paths live, submissions waiting, broken links (series `active`).

Honest gaps: `noResultSearches` is `{available:false, items:[]}` (learner search runs in the browser against the catalogue, so there is nothing to log yet; no `search_misses` table was created). Curator `live_resources` and `paths_live` read `resources`/`paths` tables if they exist (becontent) and are `null` otherwise; `broken_links` is `null` until link checks exist. "Active" means a session refresh, a finished lesson or path activity in the period.

## Metrics (`metrics:view`)

`GET /metrics/learners | paths | paths/:slug | library | emails | support` with the same `range` params; every figure is `{value, previous, deltaPct}`. `GET /metrics/:tab/export` returns a CSV (`metric,value`) of the same numbers (audited).
- learners: `stats{weeklyActive, monthlyActive, returningLearnersPct, lessonsPerLearner}`, `funnel[invited, created_account, confirmed_email, finished_onboarding]` (events in the period, not a cohort), `series`.
- paths: per path slug `started, completed, completionRatePct, avgHoursToFinish, dropOffLesson`. The catalogue is not in D1, so there are no titles or lesson counts; the UI maps slugs to the catalogue. `paths/:slug`: stats, `lessons[{index,lessonId,learners,pct}]` (ordered by when first completed), `biggestDrop`.
- library: `saves`, `mostSaved[4]`; `mostOpened` and `noResultSearches` are `{available:false}` (opens and searches are not recorded).
- emails: from the new `email_daily` counters (sent and dropped per message type, no addresses, counting starts at deploy). `opened`/`clicked` are `null` on purpose (tracking is off). `inviteAcceptancePct`, `mailingListJoins`, `unsubscribes` come from the waitlist; `continueLearningReturns` is `{available:false}`.
- support: `requestsOpened, avgFirstReplyHours, repliedWithinTargetPct, resolved`, `requestsByTopic`, `problemReportsByType` (learner-chosen categories).

All aggregates read a bounded range through indexes added in 0015.

## Deviations and gaps

- `GET /metrics/paths/:id` takes the path slug.
- Deleting an account also deletes the learner's submissions (existing cascade). "Approved ones stay, credited to Former member" needs a schema change and is not built. `emailCopy` on delete is accepted and ignored.
- `emailConfirmedAt`, `profileHidden`, path titles and lesson totals have no data source yet (see above).
- "Other learners who reported the same link are told too", and link-report titles/counts, wait for the link-report tables.
- Dashboard `noResultSearches` is empty with `available:false` (no server-side search logging, so no `search_misses` table).
- Suspending, restoring, resetting and the waitlist emails use new templates in `lib/auth-email-templates.ts`.
