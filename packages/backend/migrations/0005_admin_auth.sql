-- Admin authentication (docs/SECURITY-AUTH.md section 6). Admin accounts, sessions, roles and
-- invites live in their own tables, apart from the learner `user` / `session` tables, so a learner
-- session can never authorise an admin route and an admin session can never authorise a learner
-- route. Times are unix seconds. Secrets are never stored in clear: sessions, invites and backup
-- codes are hashes, the TOTP secret is AES-GCM encrypted (src/auth/admin-secrets.ts).

CREATE TABLE admin_roles (
  id         TEXT    PRIMARY KEY NOT NULL,
  name       TEXT    NOT NULL,
  is_system  INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX idx_admin_roles_name ON admin_roles (lower(name));

-- The one system role. Its permissions are computed in code (manage on every area) and cannot be
-- edited, so there are no permission rows for it.
INSERT INTO admin_roles (id, name, is_system) VALUES ('super_admin', 'Super admin', 1);

-- At most 20 custom roles (SECURITY-AUTH.md section 6.3).
CREATE TRIGGER trg_admin_roles_cap BEFORE INSERT ON admin_roles
WHEN NEW.is_system = 0 AND (SELECT COUNT(*) FROM admin_roles WHERE is_system = 0) >= 20
BEGIN SELECT RAISE(ABORT, 'custom role limit reached'); END;

CREATE TRIGGER trg_admin_roles_system_immutable BEFORE DELETE ON admin_roles
WHEN OLD.is_system = 1
BEGIN SELECT RAISE(ABORT, 'system role cannot be deleted'); END;

CREATE TABLE admin_role_permissions (
  role_id TEXT NOT NULL REFERENCES admin_roles (id) ON DELETE CASCADE,
  area    TEXT NOT NULL CHECK (area IN (
            'dashboard', 'metrics', 'resources', 'paths', 'review_queues', 'support_inbox',
            'users_waitlist', 'admin_team', 'roles', 'audit_log', 'settings')),
  level   TEXT NOT NULL CHECK (level IN ('none', 'view', 'manage')),
  PRIMARY KEY (role_id, area)
) WITHOUT ROWID;

-- Custom roles are capped at View on Admin team and Roles; the audit log is view-only for everyone.
-- Enforced here as well as in code, so no code path can write a higher level.
CREATE TRIGGER trg_admin_perm_cap_insert BEFORE INSERT ON admin_role_permissions
WHEN NEW.level = 'manage' AND NEW.area IN ('admin_team', 'roles', 'audit_log')
BEGIN SELECT RAISE(ABORT, 'permission level not allowed for this area'); END;
CREATE TRIGGER trg_admin_perm_cap_update BEFORE UPDATE ON admin_role_permissions
WHEN NEW.level = 'manage' AND NEW.area IN ('admin_team', 'roles', 'audit_log')
BEGIN SELECT RAISE(ABORT, 'permission level not allowed for this area'); END;

CREATE TABLE admin_users (
  id               TEXT    PRIMARY KEY NOT NULL,
  email            TEXT    NOT NULL,            -- lower-case; must equal the Cloudflare Access identity
  name             TEXT    NOT NULL,
  password_hash    TEXT,                        -- scrypt string; NULL until the invite is accepted
  role_id          TEXT    NOT NULL REFERENCES admin_roles (id),
  status           TEXT    NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'suspended')),
  totp_secret_enc  TEXT,                        -- AES-GCM, "v1.<iv>.<ciphertext>"
  totp_pending_enc TEXT,                        -- secret being enrolled, not yet confirmed
  totp_enrolled_at INTEGER,
  totp_last_step   INTEGER NOT NULL DEFAULT 0,  -- last accepted 30 s time-step (replay protection)
  created_by       TEXT,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at       INTEGER NOT NULL DEFAULT (unixepoch()),
  last_signin_at   INTEGER
);
CREATE UNIQUE INDEX idx_admin_users_email ON admin_users (email);
CREATE INDEX idx_admin_users_role ON admin_users (role_id);

CREATE TABLE admin_backup_codes (
  id        TEXT    PRIMARY KEY NOT NULL,
  admin_id  TEXT    NOT NULL REFERENCES admin_users (id) ON DELETE CASCADE,
  code_hash TEXT    NOT NULL,                   -- SHA-256 of the normalised code, keyed with the auth secret
  used_at   INTEGER
);
CREATE INDEX idx_admin_backup_admin ON admin_backup_codes (admin_id);
CREATE UNIQUE INDEX idx_admin_backup_hash ON admin_backup_codes (admin_id, code_hash);

-- stage 'mfa_pending' = password accepted, 2-step code not yet given: it authorises nothing but
-- POST /api/admin/sign-in/mfa. token_hash is "sha256:<hex>" of the cookie value.
CREATE TABLE admin_sessions (
  id                  TEXT    PRIMARY KEY NOT NULL,
  admin_id            TEXT    NOT NULL REFERENCES admin_users (id) ON DELETE CASCADE,
  token_hash          TEXT    NOT NULL,
  stage               TEXT    NOT NULL DEFAULT 'active' CHECK (stage IN ('mfa_pending', 'active')),
  created_at          INTEGER NOT NULL,
  last_seen_at        INTEGER NOT NULL,
  expires_at          INTEGER NOT NULL,         -- idle deadline (30 min, sliding)
  absolute_expires_at INTEGER NOT NULL,         -- hard cap (12 h)
  last_reauth_at      INTEGER,                  -- step-up (password + 2-step code)
  ip                  TEXT,                     -- truncated
  ua                  TEXT
);
CREATE UNIQUE INDEX idx_admin_sessions_token ON admin_sessions (token_hash);
CREATE INDEX idx_admin_sessions_admin ON admin_sessions (admin_id);
CREATE INDEX idx_admin_sessions_expires ON admin_sessions (expires_at);

-- Single use, 72 hours, bound to the invited email. Only a SHA-256 of the signed token is stored.
CREATE TABLE admin_invites (
  id           TEXT    PRIMARY KEY NOT NULL,
  email        TEXT    NOT NULL,
  role_id      TEXT    NOT NULL REFERENCES admin_roles (id),
  admin_id     TEXT    REFERENCES admin_users (id) ON DELETE CASCADE, -- the account this invite activates
  token_hash   TEXT    NOT NULL,
  created_by   TEXT,                            -- admin id, or NULL for the bootstrap
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at   INTEGER NOT NULL,
  used_at      INTEGER,
  cancelled_at INTEGER
);
CREATE UNIQUE INDEX idx_admin_invites_token ON admin_invites (token_hash);
CREATE INDEX idx_admin_invites_email ON admin_invites (email);
