-- Asset sessions: links external asset IDs (location or device) to chat sessions.
CREATE TABLE IF NOT EXISTS asset_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    asset_id TEXT NOT NULL,          -- external location_id or thing_id
    asset_type TEXT NOT NULL,        -- 'location' or 'device'
    session_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_asset_sessions_asset ON asset_sessions (tenant_id, asset_id, asset_type);
CREATE INDEX idx_asset_sessions_session ON asset_sessions (tenant_id, session_key);
