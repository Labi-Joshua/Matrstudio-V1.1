-- Settings (packages/backend/SETTINGS.md). Both tables belong to the learner and are removed with the
-- account (ON DELETE CASCADE; D1 enforces foreign keys).

-- One row per learner, created on first save; a learner without a row has the defaults in
-- packages/types (DEFAULT_PREFS). The learning goal, level and topics stay in `onboarding`.
CREATE TABLE user_preferences (
  user_id            TEXT    PRIMARY KEY NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  notify_submissions INTEGER NOT NULL DEFAULT 1 CHECK (notify_submissions IN (0, 1)),
  notify_lessons     INTEGER NOT NULL DEFAULT 1 CHECK (notify_lessons IN (0, 1)),
  notify_help        INTEGER NOT NULL DEFAULT 1 CHECK (notify_help IN (0, 1)),
  email_digest       INTEGER NOT NULL DEFAULT 1 CHECK (email_digest IN (0, 1)),
  email_reminders    INTEGER NOT NULL DEFAULT 1 CHECK (email_reminders IN (0, 1)),
  email_news         INTEGER NOT NULL DEFAULT 0 CHECK (email_news IN (0, 1)),
  reminder_days      TEXT    NOT NULL DEFAULT '["mon","wed","fri"]',
  reminder_time      TEXT    NOT NULL DEFAULT '19:00',
  weekly_goal        INTEGER NOT NULL DEFAULT 3 CHECK (weekly_goal BETWEEN 1 AND 14),
  updated_at         INTEGER NOT NULL
);

-- An email change waiting for its link. At most one per learner. The link is the signed,
-- single-use, 24-hour token Better Auth sends to the NEW address; it only works while this row
-- still names the same address, so cancelling (deleting the row) kills every outstanding link.
CREATE TABLE pending_email_changes (
  user_id      TEXT    PRIMARY KEY NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  new_email    TEXT    NOT NULL,
  requested_at INTEGER NOT NULL
);
