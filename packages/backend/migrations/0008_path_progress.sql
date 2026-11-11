-- Learning path progress. Rows belong to the learner and are removed with the account
-- (ON DELETE CASCADE; D1 enforces foreign keys). path_slug and lesson_id are catalogue ids, not
-- foreign keys: the catalogue is not in the database yet. A star can exist before a start, so
-- started_at is nullable. Times are ISO 8601 text.
CREATE TABLE path_enrolments (
  user_id          TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  path_slug        TEXT NOT NULL,
  started_at       TEXT,
  last_activity_at TEXT,
  completed_at     TEXT,
  starred_at       TEXT,
  PRIMARY KEY (user_id, path_slug)
);

CREATE TABLE path_lessons_done (
  user_id      TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  path_slug    TEXT NOT NULL,
  lesson_id    TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  PRIMARY KEY (user_id, path_slug, lesson_id)
);

CREATE INDEX idx_path_enrolments_activity ON path_enrolments (user_id, last_activity_at DESC);
