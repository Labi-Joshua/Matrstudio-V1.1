-- De-duplicates quota alerts: one row per (UTC day, metric, threshold).
CREATE TABLE ops_alerts (
  day     TEXT    NOT NULL,   -- YYYY-MM-DD (UTC)
  metric  TEXT    NOT NULL,   -- requests | rowsRead | rowsWritten
  level   INTEGER NOT NULL,   -- 80 | 95
  sent_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (day, metric, level)
) WITHOUT ROWID;
