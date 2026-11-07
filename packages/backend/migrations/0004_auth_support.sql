-- Auth support tables: waitlist invites, rate-limit counters, append-only audit log.

-- Invites: single use, bound to the invited email, 72 hours. Only a SHA-256 of the token is stored.
CREATE TABLE invites (
  id         TEXT    PRIMARY KEY NOT NULL,
  email      TEXT    NOT NULL,                -- lower-case; the account is created with this address, confirmed
  token_hash TEXT    NOT NULL,
  created_by TEXT,                            -- operator or system actor, free text
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL,
  used_at    INTEGER
);
CREATE UNIQUE INDEX idx_invites_token ON invites (token_hash);
CREATE INDEX idx_invites_email ON invites (email);

-- Fixed-window counters (see src/auth/limits.ts). Keys carry keyed hashes, never raw emails or IPs.
CREATE TABLE rate_limits (
  key          TEXT    PRIMARY KEY NOT NULL,
  count        INTEGER NOT NULL,
  window_start INTEGER NOT NULL
) WITHOUT ROWID;

-- Append-only: the triggers below make UPDATE and DELETE fail for every caller. The single
-- exception is anonymisation on account deletion (SECURITY-AUTH.md section 11): an UPDATE is
-- accepted only if it leaves id, action, meta and time untouched and sets actor, target, ip and ua to NULL.
CREATE TABLE audit_log (
  id         INTEGER PRIMARY KEY,
  actor      TEXT,                            -- user id, or NULL (system / anonymous / anonymised)
  action     TEXT    NOT NULL,
  target     TEXT,                            -- user id, or "email:<keyed hash>"
  ip         TEXT,                            -- truncated
  ua         TEXT,
  meta       TEXT    NOT NULL DEFAULT '{}' CHECK (json_valid(meta)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_audit_actor ON audit_log (actor, created_at);
CREATE INDEX idx_audit_action ON audit_log (action, created_at);

CREATE TRIGGER trg_audit_no_update BEFORE UPDATE ON audit_log
WHEN NOT (NEW.id = OLD.id AND NEW.action = OLD.action AND NEW.created_at = OLD.created_at
          AND NEW.meta = OLD.meta AND NEW.actor IS NULL AND NEW.target IS NULL
          AND NEW.ip IS NULL AND NEW.ua IS NULL)
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;

CREATE TRIGGER trg_audit_no_delete BEFORE DELETE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
