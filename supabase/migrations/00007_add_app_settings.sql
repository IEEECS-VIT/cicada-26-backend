-- Migration: Add app_settings table for durable, DB-backed admin toggles
-- (e.g. IP tracking / location locking), replacing in-memory-only state that
-- reset on every server restart or redeploy.
CREATE TABLE IF NOT EXISTS public.app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.app_settings (key, value)
VALUES ('ip_tracking_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;
