-- Timestamps are ISO-8601 UTC strings written by the application.

CREATE TABLE plans (
  id                INTEGER PRIMARY KEY,
  slug              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  price             INTEGER NOT NULL DEFAULT 0,      -- monthly price in IDR
  monthly_quota     INTEGER,                         -- NULL = unlimited
  max_scale         INTEGER NOT NULL DEFAULT 1,
  retention_hours   INTEGER NOT NULL DEFAULT 24,
  watermark         INTEGER NOT NULL DEFAULT 0,
  api_access        INTEGER NOT NULL DEFAULT 1,
  premium_templates INTEGER NOT NULL DEFAULT 0,
  is_default        INTEGER NOT NULL DEFAULT 0,
  is_active         INTEGER NOT NULL DEFAULT 1,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL
);

CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  plan_id       INTEGER NOT NULL REFERENCES plans (id),
  created_at    TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE sessions (
  id         INTEGER PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  ip         TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE api_keys (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  prefix       TEXT NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,
  created_at   TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at   TEXT
);

CREATE TABLE templates (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL DEFAULT 'general',
  is_active   INTEGER NOT NULL DEFAULT 1,
  is_premium  INTEGER NOT NULL DEFAULT 0,
  definition  TEXT NOT NULL,                       -- JSON, see engine/schema.js
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE renders (
  id            TEXT PRIMARY KEY,
  user_id       INTEGER REFERENCES users (id) ON DELETE SET NULL,
  api_key_id    INTEGER REFERENCES api_keys (id) ON DELETE SET NULL,
  ip            TEXT,
  template_slug TEXT NOT NULL,
  format        TEXT NOT NULL,
  width         INTEGER NOT NULL,
  height        INTEGER NOT NULL,
  bytes         INTEGER NOT NULL,
  duration_ms   INTEGER NOT NULL,
  source        TEXT NOT NULL CHECK (source IN ('web', 'api')),
  file_name     TEXT,
  expires_at    TEXT,
  created_at    TEXT NOT NULL
);

CREATE INDEX renders_user_created ON renders (user_id, created_at);
CREATE INDEX renders_ip_created ON renders (ip, created_at) WHERE user_id IS NULL;
CREATE INDEX renders_expires ON renders (expires_at) WHERE file_name IS NOT NULL;
CREATE INDEX renders_created ON renders (created_at);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL                                -- JSON
);
