-- In-app notifications for a learner. Rows belong to the learner and go with the account
-- (ON DELETE CASCADE; D1 enforces foreign keys). Times are unix seconds; the API sends ISO strings.
CREATE TABLE notifications (
  id         TEXT    PRIMARY KEY,
  user_id    TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  kind       TEXT    NOT NULL CHECK (kind IN
               ('path-reminder', 'new-lesson', 'support-reply', 'report-fixed', 'report-cant-reproduce')),
  title      TEXT    NOT NULL,
  body       TEXT    NOT NULL,
  href       TEXT,
  created_at INTEGER NOT NULL,
  read_at    INTEGER
);

CREATE INDEX idx_notifications_user ON notifications (user_id, created_at DESC);
