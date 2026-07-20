-- Cicada 2067 - Supabase Schema Setup

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
  role VARCHAR(50) DEFAULT 'participant' NOT NULL CHECK (role IN ('participant', 'admin')),
  team_id UUID REFERENCES teams(id) ON UPDATE CASCADE ON DELETE SET NULL,
  joined_team_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add Leader Foreign Key constraint back to teams
ALTER TABLE teams ADD CONSTRAINT fk_leader FOREIGN KEY (leader_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- 4. Submission Logs
CREATE TABLE IF NOT EXISTS submission_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  challenge_id UUID, -- Kept as raw UUID since the challenges table is managed elsewhere by your teammate
  submitted_answer TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
