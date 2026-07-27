-- ============================================================
-- Cicada '26 - Live Leaderboard Supabase Setup SQL
-- Project: Cicada '26 (https://fdzcrmwwjpfwntbakied.supabase.co)
-- ============================================================
-- Run this script in your Supabase SQL Editor:
-- Go to: https://supabase.com/dashboard/project/fdzcrmwwjpfwntbakied/sql/new

-- 1. Create Leaderboard Table
CREATE TABLE IF NOT EXISTS public.leaderboard (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_name TEXT NOT NULL UNIQUE,
    challenges_completed INTEGER NOT NULL DEFAULT 0 CHECK (challenges_completed >= 0),
    completion_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create Index for Fast Leaderboard Queries (Sorting: Solved DESC, Time ASC)
CREATE INDEX IF NOT EXISTS idx_leaderboard_sorting 
ON public.leaderboard (challenges_completed DESC, completion_time ASC);

-- 3. Automatic updated_at Trigger
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_leaderboard_updated_at ON public.leaderboard;
CREATE TRIGGER set_leaderboard_updated_at
BEFORE UPDATE ON public.leaderboard
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- 4. Create Dynamic Live Leaderboard View with Calculated Ranks
-- Solves requirement: Sorted by 1. Challenges Solved (DESC), 2. Time Taken / Completion Time (ASC)
CREATE OR REPLACE VIEW public.live_leaderboard 
WITH (security_invoker = true) 
AS
SELECT 
    ROW_NUMBER() OVER (
        ORDER BY challenges_completed DESC, completion_time ASC
    ) AS rank,
    id,
    team_name,
    challenges_completed,
    completion_time,
    created_at,
    updated_at
FROM public.leaderboard;

-- 5. Configure Row Level Security (RLS)
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

-- Allow public read access to leaderboard
DROP POLICY IF EXISTS "Allow public select on leaderboard" ON public.leaderboard;
CREATE POLICY "Allow public select on leaderboard" 
ON public.leaderboard FOR SELECT 
USING (true);

-- Allow authenticated/service role full access to manage scores
DROP POLICY IF EXISTS "Allow service role full access" ON public.leaderboard;
CREATE POLICY "Allow service role full access" 
ON public.leaderboard FOR ALL 
USING (true)
WITH CHECK (true);

-- 6. Enable Realtime Publications for Live Leaderboard Streaming
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'leaderboard'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.leaderboard;
    END IF;
END $$;

-- Insert sample seed data for testing
INSERT INTO public.leaderboard (team_name, challenges_completed, completion_time)
VALUES 
    ('CyberKnights', 5, NOW() - INTERVAL '15 minutes'),
    ('BinaryBandits', 5, NOW() - INTERVAL '5 minutes'),
    ('CodeNinja', 4, NOW() - INTERVAL '30 minutes'),
    ('Hackerman', 3, NOW() - INTERVAL '1 hour')
ON CONFLICT (team_name) DO NOTHING;


-- ============================================================
-- 7. Create Challenges Table (Challenge Engine & Story Fragment System)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number INTEGER NOT NULL UNIQUE CHECK (order_number > 0),
    name TEXT NOT NULL,
    story_context TEXT,
    assets JSONB NOT NULL DEFAULT '[]'::jsonb,
    story_fragment JSONB NOT NULL DEFAULT '{}'::jsonb,
    hints JSONB NOT NULL DEFAULT '[]'::jsonb,
    answer_key TEXT NOT NULL,
    time_limit INTEGER NOT NULL DEFAULT 1800,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure story_fragment and hints columns exist if table was created previously
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS story_fragment JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS hints JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Index for ordering challenges
CREATE INDEX IF NOT EXISTS idx_challenges_order ON public.challenges (order_number ASC);

-- Trigger for challenges updated_at
DROP TRIGGER IF EXISTS set_challenges_updated_at ON public.challenges;
CREATE TRIGGER set_challenges_updated_at
BEFORE UPDATE ON public.challenges
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();


-- ============================================================
-- 8. Create Team Progress Table (Admin Progress Tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.team_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_name TEXT NOT NULL UNIQUE REFERENCES public.leaderboard(team_name) ON DELETE CASCADE ON UPDATE CASCADE,
    current_challenge_order INTEGER NOT NULL DEFAULT 1 CHECK (current_challenge_order > 0),
    completed_challenges JSONB NOT NULL DEFAULT '[]'::jsonb,
    attempts_count INTEGER NOT NULL DEFAULT 0 CHECK (attempts_count >= 0),
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    challenge_started_at TIMESTAMPTZ,
    started_ip VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure attempts_count and last_attempt_at columns exist if table was created previously
ALTER TABLE public.team_progress ADD COLUMN IF NOT EXISTS attempts_count INTEGER NOT NULL DEFAULT 0 CHECK (attempts_count >= 0);
ALTER TABLE public.team_progress ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.team_progress ADD COLUMN IF NOT EXISTS challenge_started_at TIMESTAMPTZ;
ALTER TABLE public.team_progress ALTER COLUMN challenge_started_at DROP NOT NULL;
ALTER TABLE public.team_progress ALTER COLUMN challenge_started_at DROP DEFAULT;

-- Trigger for team_progress updated_at
DROP TRIGGER IF EXISTS set_team_progress_updated_at ON public.team_progress;
CREATE TRIGGER set_team_progress_updated_at
BEFORE UPDATE ON public.team_progress
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();


-- ============================================================
-- 9. Row Level Security (RLS) for Challenges & Team Progress
-- ============================================================
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_progress ENABLE ROW LEVEL SECURITY;

-- Allow public read access to challenges
DROP POLICY IF EXISTS "Allow public select on challenges" ON public.challenges;
CREATE POLICY "Allow public select on challenges"
ON public.challenges FOR SELECT
USING (true);

-- Allow service role full access on challenges
DROP POLICY IF EXISTS "Allow service role full access on challenges" ON public.challenges;
CREATE POLICY "Allow service role full access on challenges"
ON public.challenges FOR ALL
USING (true)
WITH CHECK (true);

-- Allow public read access to team_progress
DROP POLICY IF EXISTS "Allow public select on team_progress" ON public.team_progress;
CREATE POLICY "Allow public select on team_progress"
ON public.team_progress FOR SELECT
USING (true);

-- Allow service role full access on team_progress
DROP POLICY IF EXISTS "Allow service role full access on team_progress" ON public.team_progress;
CREATE POLICY "Allow service role full access on team_progress"
ON public.team_progress FOR ALL
USING (true)
WITH CHECK (true);


-- ============================================================
-- 10. Seed Initial Challenges Data with Story Fragments
-- ============================================================
INSERT INTO public.challenges (order_number, name, story_context, assets, story_fragment, answer_key, is_active)
VALUES
(
    1,
    'Archive 01: Transmission Beacon',
    'A hidden transmission was intercepted from the outer orbital station. Decrypt the initial security passkey to proceed.',
    '[
        {"type": "text", "content": "Signal Payload: 0x4369636164613236"},
        {"type": "image", "url": "https://images.unsplash.com/photo-1518770660439-4636190af475", "name": "Beacon Spectrum Analysis", "caption": "Frequency distribution graph"}
    ]'::jsonb,
    '{
        "title": "Recovered Mission Log",
        "header": "Day 102",
        "content": "Signal acquisition established. Orbital station transmission key recovered successfully."
    }'::jsonb,
    'CICADA26_START',
    true
),
(
    2,
    'Archive 02: Crew Log Extraction',
    'Log entries from Commander Vance detail an anomaly near Sector 7. Locate the coordinates embedded in the raw text file.',
    '[
        {"type": "file", "url": "https://example.com/assets/crew_log_02.txt", "name": "crew_log_raw.txt"},
        {"type": "pdf", "url": "https://example.com/assets/sector7_map.pdf", "name": "Sector 7 Nav Map"}
    ]'::jsonb,
    '{
        "title": "Recovered Mission Log",
        "header": "Day 145",
        "content": "Commander Vance''s log extracted. Sector 7 anomaly confirmed active and expanding."
    }'::jsonb,
    'SECTOR_7_ANOMALY',
    true
),
(
    3,
    'Archive 03: Crew Research Log',
    'Final research notes from the biology division. An encrypted audio file holds the final password to unlock the telemetry database.',
    '[
        {"type": "audio", "url": "https://example.com/assets/research_audio.mp3", "name": "Research Audio Tape #3"},
        {"type": "video", "url": "https://example.com/assets/lab_feed.mp4", "name": "Lab Camera Surveillance Feed"}
    ]'::jsonb,
    '{
        "title": "Recovered Mission Log",
        "header": "Day 172",
        "content": "The anomaly has intensified. Telemetry database decrypted. Primary orbital core payload standing by."
    }'::jsonb,
    'CREW_RESEARCH_ALPHA',
    true
)
ON CONFLICT (order_number) DO NOTHING;


