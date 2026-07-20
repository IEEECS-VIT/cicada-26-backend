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
CREATE OR REPLACE VIEW public.live_leaderboard AS
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
