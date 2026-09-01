-- public.users.id is NOT the same as auth.uid() for this app (users are seeded
-- via an admin CSV-import script with independently-generated ids, joined to
-- their auth identity only by email) -- see migration 00010, which fixed the
-- same mistake for the storage.objects policies. The base RLS policies from
-- migration 00004 were never corrected and still join on "id = auth.uid()",
-- so every one of these USING clauses silently matches zero rows for every
-- user, admin included. RLS returns an empty result set rather than an error,
-- so this went unnoticed: any authenticated SELECT against users/teams made
-- directly from the browser (not through the service-role backend API) has
-- always come back empty. In the admin dashboard this surfaces as scores
-- never updating live -- the direct teams query in refreshLive() reads
-- nothing, so the UI falls back to a stale leaderboard number instead of the
-- real, already-correct points value.

DROP POLICY IF EXISTS "Users can view themselves and teammates" ON public.users;
CREATE POLICY "Users can view themselves and teammates"
ON public.users
FOR SELECT
USING (
  email = auth.email() OR
  (team_id IS NOT NULL AND team_id = (SELECT team_id FROM public.users WHERE email = auth.email()))
);

DROP POLICY IF EXISTS "Users can update their own basic info" ON public.users;
CREATE POLICY "Users can update their own basic info"
ON public.users
FOR UPDATE
USING (email = auth.email())
WITH CHECK (email = auth.email());

DROP POLICY IF EXISTS "Admins have full access to users" ON public.users;
CREATE POLICY "Admins have full access to users"
ON public.users
FOR ALL
USING ( (SELECT role FROM public.users WHERE email = auth.email()) IN ('admin', 'GOD') );

DROP POLICY IF EXISTS "Users can view their own team" ON public.teams;
CREATE POLICY "Users can view their own team"
ON public.teams
FOR SELECT
USING (id = (SELECT team_id FROM public.users WHERE email = auth.email()));

DROP POLICY IF EXISTS "Leaders can update their team name" ON public.teams;
CREATE POLICY "Leaders can update their team name"
ON public.teams
FOR UPDATE
USING (leader_id = (SELECT id FROM public.users WHERE email = auth.email()))
WITH CHECK (leader_id = (SELECT id FROM public.users WHERE email = auth.email()));

DROP POLICY IF EXISTS "Admins have full access to teams" ON public.teams;
CREATE POLICY "Admins have full access to teams"
ON public.teams
FOR ALL
USING ( (SELECT role FROM public.users WHERE email = auth.email()) IN ('admin', 'GOD') );
