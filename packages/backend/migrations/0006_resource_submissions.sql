-- Learner resource submissions. Rows belong to a learner and are removed with the account
-- (ON DELETE CASCADE; D1 enforces foreign keys). Curator decisions fill status, curator_note,
-- reviewed_by and reviewed_at; learners can only edit while status is needs_changes.
CREATE TABLE resource_submissions (
  id             TEXT    PRIMARY KEY NOT NULL,
  user_id        TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  url            TEXT    NOT NULL,
  url_normalised TEXT    NOT NULL,
  title          TEXT,
  note           TEXT,
  topic          TEXT,
  status         TEXT    NOT NULL DEFAULT 'in_review'
                 CHECK (status IN ('in_review', 'accepted', 'declined', 'needs_changes')),
  curator_note   TEXT,
  reviewed_by    TEXT,
  reviewed_at    INTEGER,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);

CREATE INDEX idx_resource_submissions_user ON resource_submissions (user_id, created_at DESC);
CREATE UNIQUE INDEX uq_resource_submissions_user_url ON resource_submissions (user_id, url_normalised);
