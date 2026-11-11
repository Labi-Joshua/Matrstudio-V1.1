-- Admin content (packages/backend/ADMIN-CONTENT.md): taxonomy, resources, link checks, paths,
-- review state for link and profile reports, and the Settings key/value store. Times are unix
-- seconds; the API sends ISO strings. Backward compatible: new tables, and nullable columns on two
-- existing ones. The learner app still reads its placeholder catalogue; nothing here is read by it yet.

-- Topics group content, tags describe it, levels set difficulty. Resources and paths store the slug,
-- so a rename only changes `name`, and a merge or delete rewrites the slugs that point at it.
CREATE TABLE taxonomy (
  id         TEXT    PRIMARY KEY NOT NULL,
  kind       TEXT    NOT NULL CHECK (kind IN ('topic', 'tag', 'level')),
  slug       TEXT    NOT NULL,
  name       TEXT    NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX uq_taxonomy_kind_slug ON taxonomy (kind, slug);

INSERT INTO taxonomy (id, kind, slug, name) VALUES
  ('topic-ui-ux', 'topic', 'ui-ux', 'UI/UX'),
  ('topic-brand', 'topic', 'brand', 'Brand'),
  ('topic-product', 'topic', 'product', 'Product'),
  ('topic-seo', 'topic', 'seo', 'SEO'),
  ('topic-social-media', 'topic', 'social-media', 'Social media design'),
  ('topic-design-systems', 'topic', 'design-systems', 'Design systems'),
  ('topic-dev-handoff', 'topic', 'dev-handoff', 'Dev handoff'),
  ('topic-motion', 'topic', 'motion', 'Motion'),
  ('topic-research', 'topic', 'research', 'Research'),
  ('level-beginner', 'level', 'beginner', 'Beginner'),
  ('level-intermediate', 'level', 'intermediate', 'Intermediate'),
  ('level-advanced', 'level', 'advanced', 'Advanced'),
  ('level-all', 'level', 'all', 'All levels');

-- A library resource. url_normalised follows src/auth/submission-url.ts (https only, tracking
-- parameters and fragment dropped); at most one non-retired resource per normalised URL.
CREATE TABLE resources (
  id              TEXT    PRIMARY KEY NOT NULL,
  url             TEXT    NOT NULL,
  url_normalised  TEXT    NOT NULL,
  title           TEXT    NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  source          TEXT    NOT NULL DEFAULT '',
  type            TEXT    NOT NULL CHECK (type IN ('video', 'article', 'tool', 'course', 'template', 'book', 'other')),
  creator         TEXT    NOT NULL DEFAULT '',
  topic           TEXT    NOT NULL,
  level           TEXT    NOT NULL,
  license         TEXT    NOT NULL DEFAULT '',
  rights          TEXT    NOT NULL DEFAULT 'free_public' CHECK (rights IN ('free_public', 'unsure')),
  duration_min    INTEGER CHECK (duration_min IS NULL OR duration_min BETWEEN 1 AND 6000),
  thumbnail       TEXT,                 -- a small data: image (same-origin for the admin CSP), or NULL
  intro           TEXT    NOT NULL DEFAULT '' CHECK (length(intro) <= 600),
  learning_goal   TEXT    NOT NULL DEFAULT '' CHECK (length(learning_goal) <= 600),
  status          TEXT    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'retired', 'needs_fix')),
  added_by        TEXT,
  submitted_by    TEXT,                 -- learner credited for it (approved submission), or NULL
  submission_id   TEXT,
  retired_at      INTEGER,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE UNIQUE INDEX uq_resources_url_active ON resources (url_normalised) WHERE status <> 'retired';
CREATE INDEX idx_resources_created ON resources (created_at DESC, id DESC);
CREATE INDEX idx_resources_status ON resources (status, created_at DESC);

CREATE TABLE resource_tags (
  resource_id TEXT NOT NULL REFERENCES resources (id) ON DELETE CASCADE,
  tag         TEXT NOT NULL,
  PRIMARY KEY (resource_id, tag)
) WITHOUT ROWID;
CREATE INDEX idx_resource_tags_tag ON resource_tags (tag);

-- One row per link check (the scheduled job and "check now"). No page content is stored.
CREATE TABLE link_checks (
  id          TEXT    PRIMARY KEY NOT NULL,
  resource_id TEXT    NOT NULL REFERENCES resources (id) ON DELETE CASCADE,
  checked_at  INTEGER NOT NULL,
  ok          INTEGER NOT NULL CHECK (ok IN (0, 1)),
  http_status INTEGER,
  reason      TEXT
);
CREATE INDEX idx_link_checks_resource ON link_checks (resource_id, checked_at DESC);

-- Learning paths built in admin. `slug` is what learner progress tables (path_enrolments,
-- path_lessons_done) call path_slug; lesson ids are path_lessons.id.
CREATE TABLE paths (
  id           TEXT    PRIMARY KEY NOT NULL,
  slug         TEXT    NOT NULL,
  title        TEXT    NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  topic        TEXT    NOT NULL,
  level        TEXT    NOT NULL,
  time         TEXT    NOT NULL DEFAULT '' CHECK (length(time) <= 40),
  description  TEXT    NOT NULL DEFAULT '' CHECK (length(description) <= 1000),
  cover        TEXT,
  show_in_explore INTEGER NOT NULL DEFAULT 1 CHECK (show_in_explore IN (0, 1)),
  certificate  INTEGER NOT NULL DEFAULT 1 CHECK (certificate IN (0, 1)),
  invite_only  INTEGER NOT NULL DEFAULT 0 CHECK (invite_only IN (0, 1)),
  outcomes     TEXT    NOT NULL DEFAULT '[]',
  audience     TEXT    NOT NULL DEFAULT '[]',
  status       TEXT    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'unpublished')),
  created_by   TEXT,
  published_at INTEGER,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE UNIQUE INDEX uq_paths_slug ON paths (slug);

CREATE TABLE path_modules (
  id       TEXT    PRIMARY KEY NOT NULL,
  path_id  TEXT    NOT NULL REFERENCES paths (id) ON DELETE CASCADE,
  title    TEXT    NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  position INTEGER NOT NULL
);
CREATE INDEX idx_path_modules_path ON path_modules (path_id, position);

CREATE TABLE path_lessons (
  id          TEXT    PRIMARY KEY NOT NULL,
  path_id     TEXT    NOT NULL REFERENCES paths (id) ON DELETE CASCADE,
  module_id   TEXT    NOT NULL REFERENCES path_modules (id) ON DELETE CASCADE,
  resource_id TEXT    NOT NULL REFERENCES resources (id),
  intro       TEXT    NOT NULL DEFAULT '' CHECK (length(intro) <= 600),
  position    INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_path_lessons_path ON path_lessons (path_id, module_id, position);
CREATE INDEX idx_path_lessons_resource ON path_lessons (resource_id);

-- A link report is derived from learner support tickets (kind report, category "Broken link"); this
-- row only holds what the curators did with the group of reports for one resource. Reports newer
-- than handled_at reopen it.
CREATE TABLE link_report_state (
  resource_id TEXT    PRIMARY KEY NOT NULL REFERENCES resources (id) ON DELETE CASCADE,
  assigned_to TEXT,
  status      TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'fixed')),
  handled_by  TEXT,
  handled_at  INTEGER,
  updated_at  INTEGER NOT NULL
);

-- "Report this profile" from a learner. One open report per reporter and profile.
CREATE TABLE profile_reports (
  id              TEXT    PRIMARY KEY NOT NULL,
  reporter_id     TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  profile_user_id TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  reason          TEXT    NOT NULL CHECK (reason IN ('spam', 'abusive', 'impersonation', 'other')),
  note            TEXT    CHECK (note IS NULL OR length(note) <= 500),
  status          TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'hidden', 'dismissed')),
  assigned_to     TEXT,
  handled_by      TEXT,
  handled_at      INTEGER,
  created_at      INTEGER NOT NULL
);
CREATE UNIQUE INDEX uq_profile_reports_open ON profile_reports (reporter_id, profile_user_id) WHERE status = 'open';
CREATE INDEX idx_profile_reports_profile ON profile_reports (profile_user_id, status);
CREATE INDEX idx_profile_reports_created ON profile_reports (status, created_at);

-- An admin can hide a public profile without touching the account (the owner cannot undo it).
ALTER TABLE profiles ADD COLUMN hidden_at INTEGER;
ALTER TABLE profiles ADD COLUMN hidden_message TEXT;

-- Review state on learner submissions.
ALTER TABLE resource_submissions ADD COLUMN assigned_to TEXT;
ALTER TABLE resource_submissions ADD COLUMN decline_reason TEXT;
ALTER TABLE resource_submissions ADD COLUMN duplicate_of TEXT;

-- Settings: home curation, nudge rules and queue targets are JSON under a fixed key; email
-- templates are one row per template key (defaults live in code, a row is an override).
CREATE TABLE settings_kv (
  key        TEXT    PRIMARY KEY NOT NULL,
  value      TEXT    NOT NULL,
  updated_by TEXT,
  updated_at INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE email_templates (
  key        TEXT    PRIMARY KEY NOT NULL,
  subject    TEXT    NOT NULL CHECK (length(subject) BETWEEN 1 AND 150),
  body       TEXT    NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  updated_by TEXT,
  updated_at INTEGER NOT NULL
) WITHOUT ROWID;
