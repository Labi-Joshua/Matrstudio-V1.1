-- Support tickets and bug reports from learners, with the conversation. Rows belong to the learner
-- and go with the account (ON DELETE CASCADE). Times are unix seconds; the API sends ISO strings.
CREATE TABLE support_tickets (
  id               TEXT    PRIMARY KEY,
  user_id          TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  kind             TEXT    NOT NULL CHECK (kind IN ('support', 'report')),
  category         TEXT,
  subject          TEXT    NOT NULL,
  status           TEXT    NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open', 'replied', 'resolved', 'fixed', 'cant_reproduce')),
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL,
  context_resource TEXT,
  context_where    TEXT,
  context_link     TEXT
);

CREATE INDEX idx_support_tickets_user ON support_tickets (user_id, created_at DESC);

CREATE TABLE support_messages (
  id         TEXT    PRIMARY KEY,
  ticket_id  TEXT    NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author     TEXT    NOT NULL CHECK (author IN ('user', 'staff')),
  body       TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_support_messages_ticket ON support_messages (ticket_id, created_at);
