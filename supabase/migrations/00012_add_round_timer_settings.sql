-- Migration: Seed round timer settings into app_settings.
-- The participant-facing round countdown is derived server-side from
-- round_started_at + round_duration_seconds, so it survives page reloads
-- (the timer no longer lives in a hardcoded client-side useState value).
INSERT INTO public.app_settings (key, value) VALUES
  ('round_duration_seconds', '10800'::jsonb),
  ('round_started_at', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;
