-- Waitlist subscribers.
-- Write cost per signup: 1 table row + 1 index row (email) + 1 index row (referral_code) = 3 rows written.
CREATE TABLE waitlist_subscribers (
  id            INTEGER PRIMARY KEY,                  -- rowid alias: no extra index
  email         TEXT    NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'verified', 'unsubscribed', 'bounced')),
  referral_code TEXT    NOT NULL,
  referred_by   TEXT,                                 -- referral_code of the referrer, unchecked on write
  metadata      TEXT    NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX idx_waitlist_email ON waitlist_subscribers (email);
CREATE UNIQUE INDEX idx_waitlist_referral_code ON waitlist_subscribers (referral_code);

-- One-row counter so the public "N people joined" number costs 1 row read instead of a table scan.
-- Costs 1 extra row written per signup (4 total).
CREATE TABLE waitlist_stats (
  id    INTEGER PRIMARY KEY CHECK (id = 1),
  total INTEGER NOT NULL DEFAULT 0
);
INSERT INTO waitlist_stats (id, total) VALUES (1, 0);

CREATE TRIGGER trg_waitlist_count
AFTER INSERT ON waitlist_subscribers
BEGIN
  UPDATE waitlist_stats SET total = total + 1 WHERE id = 1;
END;
