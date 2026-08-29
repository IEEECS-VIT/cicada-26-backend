-- 00007: FK hardening & cascading for all tables (idempotent / re-runnable)
-- Run against the live Supabase DB. Fixes orphan risks, missing FKs, circular
-- references, and adds ON DELETE / ON UPDATE cascading on every FK.

-- ------------------------------------------------------------------
-- 0) Safety: add uuid defaults (teams.id / users.id were created without them)
-- ------------------------------------------------------------------
ALTER TABLE public.teams ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.users ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- ------------------------------------------------------------------
-- 1) Circular teams.leader_id <-> users.team_id
--    Keep both nullable; ON DELETE SET NULL prevents delete loops / data loss.
-- ------------------------------------------------------------------
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_team_id_fkey;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS fk_team;
ALTER TABLE public.users ADD CONSTRAINT users_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES public.teams(id)
  ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS fk_leader;
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_leader_id_fkey;
ALTER TABLE public.teams ADD CONSTRAINT fk_leader
  FOREIGN KEY (leader_id) REFERENCES public.users(id)
  ON UPDATE CASCADE ON DELETE SET NULL;

-- ------------------------------------------------------------------
-- 2) leaderboard -> teams (NEW FK; currently leaderboard is orphaned from teams)
--    Clean orphan/seed rows (no matching team) so the FK can be created.
-- ------------------------------------------------------------------
DELETE FROM public.leaderboard l
WHERE l.team_name NOT IN (SELECT name FROM public.teams);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.leaderboard'::regclass AND contype = 'f'
  ) THEN
    ALTER TABLE public.leaderboard ADD CONSTRAINT leaderboard_team_name_fkey
      FOREIGN KEY (team_name) REFERENCES public.teams(name)
      ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

-- ------------------------------------------------------------------
-- 3) team_progress -> teams (RE-POINTED from leaderboard -> teams)
--    Fixes the forced insert-ordering hack (ensureTeamInLeaderboard) and
--    stops a leaderboard reset from silently wiping team progress.
-- ------------------------------------------------------------------
DELETE FROM public.team_progress p
WHERE p.team_name NOT IN (SELECT name FROM public.teams);

ALTER TABLE public.team_progress DROP CONSTRAINT IF EXISTS team_progress_team_name_fkey;
ALTER TABLE public.team_progress ADD CONSTRAINT team_progress_team_name_fkey
  FOREIGN KEY (team_name) REFERENCES public.teams(name)
  ON UPDATE CASCADE ON DELETE CASCADE;

-- ------------------------------------------------------------------
-- 4) submission_logs: ensure all three FKs exist with proper actions
--    (team/user/challenge are audit refs -> SET NULL keeps history on delete)
-- ------------------------------------------------------------------
UPDATE public.submission_logs SET team_id = NULL
  WHERE team_id IS NOT NULL AND team_id NOT IN (SELECT id FROM public.teams);
UPDATE public.submission_logs SET user_id = NULL
  WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM public.users);
UPDATE public.submission_logs SET challenge_id = NULL
  WHERE challenge_id IS NOT NULL AND challenge_id NOT IN (SELECT id FROM public.challenges);

ALTER TABLE public.submission_logs DROP CONSTRAINT IF EXISTS submission_logs_team_id_fkey;
ALTER TABLE public.submission_logs ADD CONSTRAINT submission_logs_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES public.teams(id)
  ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.submission_logs DROP CONSTRAINT IF EXISTS submission_logs_user_id_fkey;
ALTER TABLE public.submission_logs ADD CONSTRAINT submission_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id)
  ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.submission_logs DROP CONSTRAINT IF EXISTS submission_logs_challenge_id_fkey;
ALTER TABLE public.submission_logs ADD CONSTRAINT submission_logs_challenge_id_fkey
  FOREIGN KEY (challenge_id) REFERENCES public.challenges(id)
  ON UPDATE CASCADE ON DELETE SET NULL;

-- ------------------------------------------------------------------
-- 5) 'GOD' role fix: migration 00001 created enum user_role WITHOUT 'GOD',
--    so the GOD role was unusable despite the CHECK constraint mentioning it.
-- ------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'GOD';
  END IF;
END $$;

-- If your role column is VARCHAR instead of an enum, use this instead:
-- ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
-- ALTER TABLE public.users ADD CONSTRAINT users_role_check
--   CHECK (role IN ('participant', 'admin', 'GOD'));
