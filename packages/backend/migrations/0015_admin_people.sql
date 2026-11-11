-- Admin portal, people side (ADMIN-PEOPLE.md): users, waitlist invites, support inbox, dashboard and
-- metrics. Backward compatible: nothing is removed, old code keeps working against this schema.
-- Times are unix seconds unless the table it extends already uses ISO text (user, path_*).

-- ---------------------------------------------------------------------------------------------
-- Support: new status 'waiting_on_user', internal notes, first-reply SLA and a linked issue.
-- SQLite cannot widen a CHECK, so both tables are rebuilt (messages first: it points at tickets).
-- 'replied' stays allowed so a Worker from before this migration can still write it; the new code
-- treats it like 'waiting_on_user' and the learner API keeps showing it as "replied".
-- ---------------------------------------------------------------------------------------------
CREATE TABLE support_tickets_v2 (
  id               TEXT    PRIMARY KEY,
  user_id          TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  kind             TEXT    NOT NULL CHECK (kind IN ('support', 'report')),
  category         TEXT,
  subject          TEXT    NOT NULL,
  status           TEXT    NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open', 'replied', 'waiting_on_user', 'resolved', 'fixed', 'cant_reproduce')),
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL,
  context_resource TEXT,
  context_where    TEXT,
  context_link     TEXT,
  due_at           INTEGER,  -- first reply due (2 working days after creation)
  first_reply_at   INTEGER,  -- first staff reply, NULL until then
  waiting_since    INTEGER,  -- when the status became waiting_on_user (drives the 7-day auto-resolve)
  closed_at        INTEGER,  -- when it was resolved, fixed or marked can't reproduce
  assigned_to      TEXT      -- admin id, NULL = nobody
);

INSERT INTO support_tickets_v2
  (id, user_id, kind, category, subject, status, created_at, updated_at,
   context_resource, context_where, context_link, due_at, first_reply_at, waiting_since, closed_at, assigned_to)
SELECT t.id, t.user_id, t.kind, t.category, t.subject,
       CASE t.status WHEN 'replied' THEN 'waiting_on_user' ELSE t.status END,
       t.created_at, t.updated_at, t.context_resource, t.context_where, t.context_link,
       t.created_at + 172800,
       (SELECT MIN(m.created_at) FROM support_messages m WHERE m.ticket_id = t.id AND m.author = 'staff'),
       CASE t.status WHEN 'replied' THEN t.updated_at END,
       CASE WHEN t.status IN ('resolved', 'fixed', 'cant_reproduce') THEN t.updated_at END,
       NULL
  FROM support_tickets t;

CREATE TABLE support_messages_v2 (
  id         TEXT    PRIMARY KEY,
  ticket_id  TEXT    NOT NULL REFERENCES support_tickets_v2(id) ON DELETE CASCADE,
  author     TEXT    NOT NULL CHECK (author IN ('user', 'staff', 'note')),  -- 'note' is internal, never shown to the learner
  body       TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  admin_id   TEXT                                                           -- the admin who wrote a staff reply or note
);

INSERT INTO support_messages_v2 (id, ticket_id, author, body, created_at)
SELECT id, ticket_id, author, body, created_at FROM support_messages;

DROP TABLE support_messages;
DROP TABLE support_tickets;
ALTER TABLE support_tickets_v2 RENAME TO support_tickets;
ALTER TABLE support_messages_v2 RENAME TO support_messages;

CREATE INDEX idx_support_tickets_user ON support_tickets (user_id, created_at DESC);
CREATE INDEX idx_support_tickets_status ON support_tickets (status, created_at);
CREATE INDEX idx_support_tickets_created ON support_tickets (created_at);
CREATE INDEX idx_support_tickets_waiting ON support_tickets (status, waiting_since);
CREATE INDEX idx_support_tickets_closed ON support_tickets (closed_at);
CREATE INDEX idx_support_tickets_assigned ON support_tickets (assigned_to, status);
CREATE INDEX idx_support_messages_ticket ON support_messages (ticket_id, created_at);

-- A problem report logged for the team ("Logged as #214"). At most one per ticket.
CREATE TABLE support_issues (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id      TEXT    NOT NULL UNIQUE REFERENCES support_tickets(id) ON DELETE CASCADE,
  title          TEXT    NOT NULL,
  severity       TEXT    NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  description    TEXT,
  area           TEXT,
  notify_requester INTEGER NOT NULL DEFAULT 1,
  link_report_id TEXT,   -- id of a link report (review queues); not a foreign key
  created_by     TEXT    NOT NULL,
  created_at     INTEGER NOT NULL
);

-- ---------------------------------------------------------------------------------------------
-- Users: suspension. One row while suspended; restoring deletes it (the audit log keeps the history).
-- The learner row itself is untouched, so Better Auth never sees the new state: sign-in is refused
-- by a session hook (auth/index.ts) and live sessions are deleted when the row is written.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE user_suspensions (
  user_id      TEXT    PRIMARY KEY NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  reason       TEXT    NOT NULL,   -- a short code chosen in the portal (spam, guidelines, security, other)
  note         TEXT,               -- the message emailed to the learner
  suspended_by TEXT    NOT NULL,   -- admin id
  suspended_at INTEGER NOT NULL
);

-- ---------------------------------------------------------------------------------------------
-- Waitlist invites. waitlist_subscribers is not touched; an invite is a row here plus a row in the
-- existing `invites` table (single use, only the token hash stored). No email addresses are copied.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE waitlist_batches (
  id         TEXT    PRIMARY KEY NOT NULL,
  created_by TEXT    NOT NULL,     -- admin id
  created_at INTEGER NOT NULL,
  size       INTEGER NOT NULL,
  joined_from INTEGER,             -- earliest and latest waitlist sign-up in the batch (for the preview line)
  joined_to   INTEGER
);
CREATE INDEX idx_waitlist_batches_created ON waitlist_batches (created_at DESC);

CREATE TABLE waitlist_invites (
  subscriber_id INTEGER PRIMARY KEY NOT NULL REFERENCES waitlist_subscribers(id) ON DELETE CASCADE,
  batch_id      TEXT    NOT NULL REFERENCES waitlist_batches(id) ON DELETE CASCADE,
  invite_id     TEXT    NOT NULL,  -- the invites row of the first email
  invited_at    INTEGER NOT NULL,
  reminded_at   INTEGER            -- the one reminder; NULL until sent
);
CREATE INDEX idx_waitlist_invites_batch ON waitlist_invites (batch_id, invited_at);
CREATE INDEX idx_waitlist_invites_invited ON waitlist_invites (invited_at);
CREATE INDEX idx_waitlist_status_created ON waitlist_subscribers (status, created_at, id);

-- ---------------------------------------------------------------------------------------------
-- Email counters for the Emails metrics tab: one row per day and message type, no addresses.
-- Counting starts when this ships. Opens and clicks are not tracked (tracking is off on purpose).
-- ---------------------------------------------------------------------------------------------
CREATE TABLE email_daily (
  day     TEXT    NOT NULL,        -- UTC date, YYYY-MM-DD
  type    TEXT    NOT NULL,        -- the AuthEmailMessage type
  sent    INTEGER NOT NULL DEFAULT 0,
  dropped INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, type)
) WITHOUT ROWID;

-- ---------------------------------------------------------------------------------------------
-- Indexes so the dashboard and metrics aggregates read a bounded range instead of scanning.
-- ---------------------------------------------------------------------------------------------
CREATE INDEX idx_user_created ON user (createdAt);
CREATE INDEX idx_user_unconfirmed ON user (createdAt) WHERE emailVerified = 0;
CREATE INDEX idx_user_name_lower ON user (lower(name));
CREATE INDEX idx_session_updated ON session (updatedAt);
CREATE INDEX idx_path_enrolments_started ON path_enrolments (started_at);
CREATE INDEX idx_path_enrolments_completed ON path_enrolments (completed_at);
CREATE INDEX idx_path_enrolments_last_activity ON path_enrolments (last_activity_at);
CREATE INDEX idx_path_lessons_done_completed ON path_lessons_done (completed_at);
CREATE INDEX idx_saved_resources_created ON saved_resources (created_at);
CREATE INDEX idx_resource_submissions_status ON resource_submissions (status, created_at);
CREATE INDEX idx_onboarding_completed ON onboarding (completed_at);
CREATE INDEX idx_invites_used ON invites (used_at);
