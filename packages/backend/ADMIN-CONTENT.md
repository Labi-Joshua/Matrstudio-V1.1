# Admin content API (resources, paths, review queues, settings)

Routes live in `src/routes/admin-resources.ts`, `admin-paths.ts`, `admin-review.ts`, `admin-settings.ts` and
are mounted under `/api/admin` by `routes/admin.ts` (behind the Access JWT and the admin session). Helpers are in
`src/content/`, the link-check job is `src/cron/link-check.ts`, the schema is `migrations/0014_admin_content.sql`.
Request schemas are in `packages/types/src/admin-content.ts`. The response shapes follow the parsers of the
admin Resources/Paths (`apps/admin/lib/content`), Review (`lib/review`) and Settings screens.

Errors are `{ code, message, ...extra }`. Common codes: `invalid_request` (400, optional `fieldErrors`),
`unknown_taxonomy` (400), `forbidden` (403), `not_found` (404), `duplicate` (409, `existing`),
`already_reviewed` (409), `rate_limited` (429). Times are ISO strings. Every write is audited (ids and field
names only, no personal data). Ids in paths must match `[A-Za-z0-9_-]{1,64}`.

Topic and level inputs accept the slug or the display name (any case). Topics are returned by **name**
(`topic`) with the slug as `topicSlug`; levels are slugs (`beginner|intermediate|advanced|all`).
Nothing here is read by the learner app yet (it keeps its placeholder catalogue).

## Resources (`resources:view` to read, `resources:manage` to write)

Resource row: `{ id, title, source, creator, type (video|article|tool|course|template|book|other), topic, topicSlug, level, durationMin, usedInPaths, status (draft|live|retired|needs_fix), problem, url, license, rights (free_public|unsure), intro, learningGoal, tags[], thumbnail, addedBy (name), creditedLearner, addedAt, updatedAt, retiredAt }`.
`problem` is the reason of the last failed link check. `thumbnail` is a small `data:` image or null (the admin CSP only allows
same-origin and data: images); lists send `null` to stay light, detail and create/patch send it.

- `GET /resources?tab=all|needs_fix&q&type&topic&level&status&cursor&limit` -> `{ items, nextCursor, counts{total,live,draft,needsFix,retired,paths} }`.
  Retired are hidden unless `status=retired|all`; `status=published` means live (pickers). Rows add `kind` (= type), `linkCheck`, `reports`. Cursor is opaque, newest first.
- `POST /resources/preview {url}` -> `{ url, title, source, creator, durationMin, thumbnail (data: URL or null), linkOk, linkReason, duplicateOf{id,title}|null, suggested{type,topic,level,license} }`.
  Rate limited (30 per 10 min per admin). A page that cannot be fetched still returns 200 with `linkOk:false`.
- `POST /resources {url, title, type, topic, level, creator?, license?, rights?, durationMin?, intro?, learningGoal?, tags?, paths?: [{pathId, moduleId}], status: draft|live}`
  -> 201 `{ id, resource, attachedToPaths }`. Duplicate normalised URL -> 409 `duplicate`. Tags are names; unknown ones are created. The page's preview image is fetched on create (best effort).
- `GET /resources/:id` -> the row plus `stats30d{opened,saved,done,brokenReports}`, `linkCheck{at,ok,reason,failures}`, `linkChecks[]`, `reporters`, `usedIn[{pathId,pathTitle,pathStatus,moduleId,moduleTitle,moduleNumber,lessonId,lessonNumber}]`.
  `opened` is `null` (opens are not tracked yet; a parser that coerces null to 0 will show 0).
- `PATCH /resources/:id` (any of title, creator, type, topic, level, license, rights, durationMin, intro, learningGoal, tags, status draft|live; `url` and unknown fields are ignored) -> the row plus `usedInLivePaths`. Retired -> 409 `retired`.
- `POST /resources/:id/fix-link {url, notifyReporters}`: the new link must open (else 422 `link_not_working` with `reason`) and not duplicate another resource. Sets the URL, returns a needs-fix resource to live, records a passing check, marks the link report fixed. With `notifyReporters` each reporter gets an in-app `report-fixed` notification (`createNotification`) and their tickets become `fixed`. -> the row plus `notified`.
- `POST /resources/:id/retire {confirm:true, notifyOwners?}` -> the row plus `flaggedLessons[]`. Lessons keep pointing at it and show as unavailable. `notifyOwners` is accepted and ignored (the admin notification feed is not part of this module).

Link check: every 30-minute tick checks up to 20 live or needs-fix resources not checked for 23 h (oldest first), writes `link_checks`, two failures in a row set `needs_fix`, a pass sets it back to `live`. 401/403/429/999 answers count as inconclusive (not a failure). Rows older than 90 days are deleted.

SSRF rules (`src/content/safe-fetch.ts`, reusing `auth/submission-url.ts`): https only, no credentials, no IP literals, no localhost/single-label/internal TLDs, checked again on every redirect (manual, max 3), 5 s timeout, 256 KB page cap, 150 KB image cap (PNG/JPEG/WebP by magic bytes, never SVG), no cookies, nothing else stored. DNS rebinding to a private IP is not detectable from the Worker; Cloudflare Workers cannot reach private networks anyway.

## Paths (`paths:view|manage`)

Path document (returned by GET/PATCH/lessons/publish/unpublish/DELETE lesson/preview): `{ id, slug, title, description, status (draft|live|unpublished), level, topic, topicSlug, time (free text, e.g. "7 hrs"), showInExplore, certificate, inviteOnly, coverUrl (null: only a same-origin image can show), learners, inProgress, certificatesIssued, publishedAt, lastSavedAt, outcomes[], audience[], modules[{id,title,lessons[{id,resourceId,title,source,type,durationMin,intro,unavailable}]}] }`.

- `GET /paths?status=draft|live|unpublished|published` -> `{ items[{id,title,topic,level,time,status,modules,lessons,learners,completionRate,updatedAt}], counts{all,live,draft,unpublished}, learnersEnrolled }`.
- `POST /paths {title, topic, level, description?, time?}` -> 201 the document (with `id`; no modules).
- `GET /paths/:id`; `PATCH /paths/:id` autosave: any of title, topic, level, time, description, showInExplore, certificate, inviteOnly, outcomes, audience, `modules` -> the document.
  `modules` is the full order `[{id?, title, lessonIds[]}]`: an id the path does not know (the editor's `tmp-...`) creates a module; every existing lesson id must appear exactly once (400 for an unknown or repeated lesson, 409 `lessons_missing` if a lesson is left out: remove lessons with DELETE so learners are told); modules left out are deleted (they are empty).
- `POST /paths/:id/lessons {resourceIds[], moduleId}` -> 201 the document plus `added[]`, `skipped[]` (max 90 lessons per path, `path_full`). `PATCH /paths/:id/lessons/:lid {intro}` -> the document.
- `GET /paths/:id/publish-check` -> `{ checks[{key,label,ok,lessonIds?}], warnings[string], canPublish }` (keys: content, intros, links, resources_live, details; warning: no cover).
- `POST /paths/:id/publish {featureTopOfExplore?}` -> the document plus `warnings` (409 `publish_blocked` + the check body, 409 `already_live`); `POST /paths/:id/unpublish` -> the document (409 `not_live`).
- `GET /paths/:id/lessons/:lid/removal-impact` -> `{ lesson, live, tookLesson, onLesson, onPath, notify, defaultMessage }` (`notify` = learners who took the lesson plus those still on the path).
- `DELETE /paths/:id/lessons/:lid {message?}` -> the document plus `notified`. On a live path each learner gets one `new-lesson` notification (max 5000), done-marks for the lesson are removed, learners whose remaining lessons are all done are marked finished (finishers keep their completion). The last lesson of a live path cannot go (409 `last_lesson`).
- `GET /paths/:id/preview` -> the document plus `banner` (no progress).

## Review queues (`review_queues:view|manage`)

All three lists return `{ items, nextCursor, counts{submissions,linkReports,profileReports} }` and take `assignee=me|none|<id>`, `olderThanDays`, `status`, `topic` (submissions), `cursor`, `limit`. Oldest first. Statuses: submissions `in_review|needs_changes` (also `accepted|declined|all`); link and profile reports `open|handled`. Submission lists also carry `targetDays`.
Decision endpoints (approve, request-change, decline) return `{ submission:{id,status}, nextId, next }` (`nextId` = oldest remaining in-review item or null); a second decision on the same item is 409 `already_reviewed`.

Submissions use the existing `resource_submissions` table (new columns `assigned_to`, `decline_reason`, `duplicate_of`).
- Row: `{ id, title, source, type, submitter{id,name,submitted,approved}, check{status pass|warn,label}, ageDays, assignedTo{id,name}|null, overdue }`. The row check only reflects the duplicate check (no page fetch in a list).
- `GET /review/submissions/:id` -> `{ id, title, url, source, type, minutes, topic, level, creator, note, ageDays, submittedAt, status, submitter{id,name,since ("March 2026"),submitted,approved,declined}, autoChecks[{key,label,status pass|warn|fail}], duplicateOf{id,title,url,status,usedInPaths}|null, assignedTo, declineReason, curatorNote }`.
  Auto-checks: link works (fetch), free to read (always `warn`: check by hand), not in library, language (from `<html lang>`). "Unknown" is reported as `warn`. Duplicate declines do not count against the submitter.
- `POST .../approve {record:{title,creator,type,topic,level,intro,placement: library|library_and_path,license?,rights?,durationMin?,learningGoal?,tags?}, credit}` creates a live resource (credits the submitter when `credit`), notifies and emails them (template `submission-approved`). `placement` is recorded in the audit row only (no path is chosen in the form). 409 `duplicate` if the URL is already in the library.
- `POST .../request-change {message}`; `POST .../decline {reason: duplicate|not_a_fit|low_quality|not_free|other, note?, duplicateOf?}`; `PATCH .../assign {assignee: "me"|adminId|null}` -> `{ assignedTo }` (assignee must be an active admin who can manage review queues). All of these (and approve) are one atomic move out of `in_review`: the loser gets 409.

Link reports are derived, with no learner endpoint: a support ticket of kind `report` and category `Broken link` (what Report a problem sends) is matched to a library resource by its normalised link, else by the resource title. Reports older than the last time the group was handled do not reopen it.
- Row: `{ id (= resource id), title, source, usedInPaths, reportCount, reason, linkStatus failed|ok, ageDays, assignedTo }`.
- `GET /review/link-reports/:id` -> `{ id, resourceId, title, url, type, reportCount, firstReportDays, linkStatus, reports[{name,when,text}], linkCheck{ok,reason,checkedText}, usedIn[string], learnersNow, assignedTo, resolved }` (`learnersNow` = learners on a live path that uses it, not narrowed to the lesson).
- `PATCH .../assign`; `POST .../dismiss {note?}` (reporters get a `report-cant-reproduce` notification, their tickets become `cant_reproduce`; 409 when nothing is open). Fixing is `POST /resources/:id/fix-link`.

Profile reports need a learner endpoint (tickets cannot carry a profile): `POST /api/me/profile-reports {username, reason: spam|abusive|impersonation|other, note?}` (signed-in learner, 10 per hour, 404 for unknown/private/hidden profiles, own profile 400, a repeat open report is a no-op 201). Table `profile_reports`.
- Row: `{ id (= profile owner's user id), name, handle ("@name"), avatarUrl (null: photos are served from the learner origin, which the admin CSP blocks), reason, reportCount, ageDays, assignedTo }`.
- `GET /review/profile-reports/:id` -> `{ id, name, handle, avatarUrl, profileUrl, reason, reportCount, ageDays, bio, links[], reports[{name:"A learner",when,text}], facts{joined,pathsStarted,submissions,pastReports}, assignedTo, resolved, hidden }`. Reporters stay anonymous.
- `PATCH .../assign`; `POST .../hide-profile {message, notifyReporters?}` (sets `profiles.hidden_at`: the public page and photo stop being served, the owner is notified with the message, reporters too when asked; the account keeps working); `POST .../dismiss {note?}`. 409 `already_reviewed` when nothing is open.

Learners are told through `createNotification`/`notificationStatement`. Deviation: the notifications table only allows five kinds, so outcomes use `support-reply` (submission and profile outcomes), `report-fixed`, `report-cant-reproduce` and `new-lesson` (lesson removed). Dedicated kinds need a table rebuild. Emails go through the existing queue as the new `staff-message` type.

## Settings

Everything needs `settings:view` (read) or `settings:manage` (write), except Home curation (`resources:view|manage`, so Curators can edit it).
- Taxonomy: `GET /settings/taxonomy?kind` -> `{ items[{id,kind,slug,name,resources,paths}] }`; `POST {kind,name}` (409 `name_taken`); `PATCH /:id {name}` (slug stays); `GET /:id/usage`; `POST /:id/merge {into}` (same kind; rewrites resources, paths and tags, deletes the source); `DELETE /:id` with `{mode:"move",into}` or `{mode:"remove"}` (tags only; topics and levels in use must be moved). In use with no mode -> 409 `in_use` with counts. Seeded: nine topics (the seven catalogue topics, Motion, Research) and four levels (incl. "All levels").
- Home curation: `GET/PUT /settings/home-curation`. GET returns `featuredPaths[{id,title,level,learners}]`, `libraryPicks[{id,title,type,durationMin}]`, `popularRules`; PUT takes id arrays (max 6 paths, 12 picks, live only, no duplicates) and `popularRules {rankBy: opens|saves|completions, window: 7d|30d|90d, hideReported, minLearners|null}`.
- Email templates: `GET /settings/email-templates` -> `{ items, templates }` of `{key,name,when,subject,body,variables,customised,wired,preview}` (no `cta`); `GET/PUT /:key {subject,body}` (unknown `{{variables}}` -> 400 `unknown_variable`; saving the default text removes the override); `POST /:key/test` sends `[Test] ...` with sample values to the signed-in admin only (10 per hour). Only `submission-approved` and `submission-declined` are read by sending code (`wired:true`); the rest are stored for later wiring.
- Nudge rules: `GET/PUT /settings/nudge-rules {enabled, firstAfterDays, secondAfterDays > first, maxPerWeek}`. Stored only: the reminder sender is a later task (`wired:false`).
- Queue targets: `GET/PUT /settings/queue-targets {submissionDays, linkReportDays, firstReplyDays, autoResolveDays, workingDays[]}` (defaults 3, 3, 2, 7, Mon-Fri). Review queues read `submissionDays` / `linkReportDays` for `overdue`; the support builder can read `firstReplyDays` and `autoResolveDays` from `settings_kv` key `queue_targets`. `workingDays` is stored but day counts are calendar days for now.

## Other shared-file edits
`auth/audit.ts` (new actions), `auth/limits.ts` (adminPreview, adminTestEmail, profileReportUser), `lib/auth-email-templates.ts` (`staff-message`), `notifications/create.ts` (`notificationStatement`), `routes/public-profile.ts` (hidden profiles), `routes/me.ts`, `routes/admin.ts`, `index.ts` (link check on the cron tick).
