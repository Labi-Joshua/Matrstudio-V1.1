-- Learner authentication: Better Auth 1.7.18 core tables (camelCase columns, the names the library
-- queries), the passkey plugin table, and onboarding answers. Dates are ISO-8601 text and booleans
-- are 0/1, which is how Better Auth's SQLite adapter reads and writes them.

CREATE TABLE user (
  id            TEXT    PRIMARY KEY NOT NULL,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL,
  emailVerified INTEGER NOT NULL DEFAULT 0,
  image         TEXT,
  createdAt     TEXT    NOT NULL,
  updatedAt     TEXT    NOT NULL
);
CREATE UNIQUE INDEX idx_user_email ON user (email);

-- session.token holds "sha256:<hex>" of the cookie token, never the token itself (SECURITY-AUTH.md section 3).
CREATE TABLE session (
  id        TEXT PRIMARY KEY NOT NULL,
  expiresAt TEXT NOT NULL,
  token     TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  ipAddress TEXT,           -- truncated before it is stored (a.b.c.0)
  userAgent TEXT,
  userId    TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX idx_session_token ON session (token);
CREATE INDEX idx_session_user ON session (userId);
CREATE INDEX idx_session_expires ON session (expiresAt);

-- account.password holds the scrypt string ("scrypt$N=...,r=...,p=...$salt$hash") for the credential provider.
CREATE TABLE account (
  id                    TEXT PRIMARY KEY NOT NULL,
  accountId             TEXT NOT NULL,
  providerId            TEXT NOT NULL,
  userId                TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  accessToken           TEXT,
  refreshToken          TEXT,
  idToken               TEXT,
  accessTokenExpiresAt  TEXT,
  refreshTokenExpiresAt TEXT,
  scope                 TEXT,
  password              TEXT,
  createdAt             TEXT NOT NULL,
  updatedAt             TEXT NOT NULL
);
CREATE INDEX idx_account_user ON account (userId);
CREATE UNIQUE INDEX idx_account_provider ON account (providerId, accountId);

-- Magic-link, password-reset and email-verification single-use records. identifier is stored hashed
-- (verification.storeIdentifier = "hashed"), so a database read does not reveal usable tokens.
CREATE TABLE verification (
  id         TEXT PRIMARY KEY NOT NULL,
  identifier TEXT NOT NULL,
  value      TEXT NOT NULL,
  expiresAt  TEXT NOT NULL,
  createdAt  TEXT NOT NULL,
  updatedAt  TEXT NOT NULL
);
CREATE INDEX idx_verification_identifier ON verification (identifier);
CREATE INDEX idx_verification_expires ON verification (expiresAt);

CREATE TABLE passkey (
  id           TEXT    PRIMARY KEY NOT NULL,
  name         TEXT,
  publicKey    TEXT    NOT NULL,
  userId       TEXT    NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  credentialID TEXT    NOT NULL,
  counter      INTEGER NOT NULL,
  deviceType   TEXT    NOT NULL,
  backedUp     INTEGER NOT NULL,
  transports   TEXT,
  createdAt    TEXT,
  aaguid       TEXT
);
CREATE INDEX idx_passkey_user ON passkey (userId);
CREATE INDEX idx_passkey_credential ON passkey (credentialID);

-- Onboarding answers (POST /api/me/onboarding). One row per user, written idempotently.
CREATE TABLE onboarding (
  userId       TEXT    PRIMARY KEY NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  goal         TEXT,
  level        TEXT,
  topics       TEXT    NOT NULL DEFAULT '[]' CHECK (json_valid(topics)),
  completed_at INTEGER,                       -- unix seconds, set once goal, level and topics are all present
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
);
