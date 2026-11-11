-- Resources a learner bookmarked. Rows belong to the learner and are removed with the account
-- (ON DELETE CASCADE; D1 enforces foreign keys). resource_id is a catalogue slug, not a foreign key:
-- the catalogue is not in the database yet.
CREATE TABLE saved_resources (
  user_id     TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  resource_id TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, resource_id)
);

CREATE INDEX idx_saved_resources_user ON saved_resources (user_id, created_at DESC);
