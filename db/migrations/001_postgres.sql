CREATE TABLE IF NOT EXISTS monitoring_workspaces (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, source TEXT NOT NULL CHECK(source IN ('simulation','live')),
 version INTEGER NOT NULL DEFAULT 0, write_token TEXT NOT NULL DEFAULT '', payload TEXT NOT NULL, updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS workspace_owner ON monitoring_workspaces(owner_id);
CREATE TABLE IF NOT EXISTS monitoring_records (
 workspace_id TEXT NOT NULL REFERENCES monitoring_workspaces(id) ON DELETE CASCADE,
 kind TEXT NOT NULL, id TEXT NOT NULL, patient_id TEXT NOT NULL DEFAULT '', payload TEXT NOT NULL, at BIGINT NOT NULL,
 PRIMARY KEY(workspace_id,kind,id)
);
CREATE INDEX IF NOT EXISTS monitoring_record_time ON monitoring_records(workspace_id,kind,at);
CREATE TABLE IF NOT EXISTS telemetry_keys (owner_id TEXT PRIMARY KEY, hash TEXT NOT NULL UNIQUE, created_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS sample_sessions (token_hash TEXT PRIMARY KEY, owner_id TEXT NOT NULL UNIQUE, expires_at BIGINT NOT NULL);
CREATE INDEX IF NOT EXISTS sample_session_expiry ON sample_sessions(expires_at);
CREATE TABLE IF NOT EXISTS session_rate_limits (id TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at BIGINT NOT NULL);
