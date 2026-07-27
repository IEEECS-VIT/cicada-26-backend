-- Cicada 2067 - Supabase Schema Setup (Safe & Re-runnable Migration)

-- 1. Create Teams Table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  leader_id UUID,
  invite_code VARCHAR(100) UNIQUE NOT NULL,
  is_disqualified BOOLEAN DEFAULT FALSE NOT NULL
);

-- 2. Create Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  register_no VARCHAR(100) UNIQUE,
  role VARCHAR(50) DEFAULT 'participant' NOT NULL,
  team_id UUID REFERENCES teams(id) ON UPDATE CASCADE ON DELETE SET NULL,
  joined_team_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Safely update User Role check constraint to support 'GOD'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('participant', 'admin', 'GOD'));

-- 4. Safely add Leader Foreign Key constraint to teams if not present
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_leader') THEN
    ALTER TABLE teams ADD CONSTRAINT fk_leader FOREIGN KEY (leader_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Submission Logs Table
CREATE TABLE IF NOT EXISTS submission_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  challenge_id UUID,
  submitted_answer TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Immutable Admin Activity Logs Table (Super Admin 'GOD' access)
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email VARCHAR(255) NOT NULL,
  admin_username VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Alter tables to support Round Timer and Hints
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS time_limit INTEGER NOT NULL DEFAULT 1800;
ALTER TABLE public.team_progress ADD COLUMN IF NOT EXISTS challenge_started_at TIMESTAMPTZ;
ALTER TABLE public.team_progress ALTER COLUMN challenge_started_at DROP NOT NULL;
ALTER TABLE public.team_progress ALTER COLUMN challenge_started_at DROP DEFAULT;
ALTER TABLE public.team_progress ADD COLUMN IF NOT EXISTS started_ip VARCHAR(45);
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS hints JSONB NOT NULL DEFAULT '[]'::jsonb;

