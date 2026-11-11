-- Admin portal: team, roles, audit reading and shell (ADMIN-TEAM.md). Backward compatible: only new
-- nullable or defaulted columns, one new table, two seeded built-in roles.

-- Temporary access: the admin may sign in and use a session only until this unix time. NULL = permanent.
-- Enforced where the admin session is validated and at sign-in; a cron tick signs expired admins out.
ALTER TABLE admin_users ADD COLUMN access_expires_at INTEGER;
-- Cron progress for the current expiry date: 0 nothing sent, 1 "ends in 3 days" notice sent, 2 expired and signed out.
ALTER TABLE admin_users ADD COLUMN access_notice INTEGER NOT NULL DEFAULT 0;
-- Highest admin_notifications.id this admin has marked as read.
ALTER TABLE admin_users ADD COLUMN notifications_read_id INTEGER NOT NULL DEFAULT 0;

ALTER TABLE admin_roles ADD COLUMN description TEXT;

-- Built-in roles (spec E). Locked like super_admin: is_system = 1, so they do not count towards the
-- 20 custom roles, cannot be deleted (trigger in 0005) and, below, cannot be edited.
INSERT INTO admin_roles (id, name, description, is_system) VALUES
  ('curator', 'Curator', 'Resources, paths, review queues and Home curation.', 1),
  ('support', 'Support', 'Support inbox and learner accounts.', 1);

INSERT INTO admin_role_permissions (role_id, area, level) VALUES
  ('curator', 'dashboard', 'view'),
  ('curator', 'metrics', 'view'),
  ('curator', 'resources', 'manage'),
  ('curator', 'paths', 'manage'),
  ('curator', 'review_queues', 'manage'),
  ('support', 'dashboard', 'view'),
  ('support', 'metrics', 'view'),
  ('support', 'users_waitlist', 'manage'),
  ('support', 'support_inbox', 'manage');

CREATE TRIGGER trg_admin_roles_system_no_update BEFORE UPDATE ON admin_roles
WHEN OLD.is_system = 1
BEGIN SELECT RAISE(ABORT, 'system role cannot be edited'); END;

CREATE TRIGGER trg_admin_perm_system_insert BEFORE INSERT ON admin_role_permissions
WHEN (SELECT is_system FROM admin_roles WHERE id = NEW.role_id) = 1
BEGIN SELECT RAISE(ABORT, 'system role cannot be edited'); END;
CREATE TRIGGER trg_admin_perm_system_update BEFORE UPDATE ON admin_role_permissions
WHEN (SELECT is_system FROM admin_roles WHERE id = OLD.role_id) = 1
BEGIN SELECT RAISE(ABORT, 'system role cannot be edited'); END;
CREATE TRIGGER trg_admin_perm_system_delete BEFORE DELETE ON admin_role_permissions
WHEN (SELECT is_system FROM admin_roles WHERE id = OLD.role_id) = 1
BEGIN SELECT RAISE(ABORT, 'system role cannot be edited'); END;

-- Notifications for the admin portal. One row is shown to every admin whose permissions include
-- `area` at View or above (NULL area = every admin). Read state is a per-admin high-water mark
-- (admin_users.notifications_read_id). No personal data: titles and bodies name things, not people's contact details.
CREATE TABLE admin_notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT    NOT NULL,
  title      TEXT    NOT NULL,
  body       TEXT    NOT NULL DEFAULT '',
  href       TEXT,
  area       TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_admin_notifications_created ON admin_notifications (created_at DESC);
