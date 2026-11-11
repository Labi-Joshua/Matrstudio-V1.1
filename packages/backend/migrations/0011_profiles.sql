-- Learner profiles. One row per learner, created on first use and removed with the account
-- (ON DELETE CASCADE; D1 enforces foreign keys). Usernames are stored lower-case, so the unique
-- index is case-insensitive. The photo is the browser-resized image itself (R2 is not enabled):
-- at most 200 KB, type checked by magic bytes, served from /api/avatars/{userId}.
CREATE TABLE profiles (
  user_id           TEXT    PRIMARY KEY NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  username          TEXT    NOT NULL
                    CHECK (length(username) BETWEEN 3 AND 30
                           AND username = lower(username)
                           AND username NOT GLOB '*[^a-z0-9_]*'),
  display_name      TEXT    NOT NULL DEFAULT '' CHECK (length(display_name) <= 60),
  bio               TEXT    NOT NULL DEFAULT '' CHECK (length(bio) <= 200),
  avatar            BLOB,
  avatar_type       TEXT    CHECK (avatar_type IN ('image/png', 'image/jpeg', 'image/webp')),
  avatar_updated_at INTEGER,
  is_public         INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1)),
  -- "Choose what shows" in the design: learning stats, completed paths, approved submissions.
  show_stats        INTEGER NOT NULL DEFAULT 1 CHECK (show_stats IN (0, 1)),
  show_paths        INTEGER NOT NULL DEFAULT 1 CHECK (show_paths IN (0, 1)),
  show_submissions  INTEGER NOT NULL DEFAULT 1 CHECK (show_submissions IN (0, 1)),
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  CHECK ((avatar IS NULL) = (avatar_type IS NULL))
);

CREATE UNIQUE INDEX uq_profiles_username ON profiles (username);
