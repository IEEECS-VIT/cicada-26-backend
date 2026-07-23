-- Enable Row Level Security (RLS) on the tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------
-- SERVICE ROLE BYPASS POLICIES (Server-side API Operations)
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Allow service role full access on users" ON public.users;
CREATE POLICY "Allow service role full access on users"
ON public.users FOR ALL
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role full access on teams" ON public.teams;
CREATE POLICY "Allow service role full access on teams"
ON public.teams FOR ALL
USING (true) WITH CHECK (true);

-- --------------------------------------------------------
-- USERS TABLE POLICIES
-- --------------------------------------------------------

-- 1. Participants can view their own profile and profiles of their teammates
DROP POLICY IF EXISTS "Users can view themselves and teammates" ON public.users;
CREATE POLICY "Users can view themselves and teammates" 
ON public.users
FOR SELECT
USING (
  id = auth.uid() OR 
  (team_id IS NOT NULL AND team_id = (SELECT team_id FROM public.users WHERE id = auth.uid()))
);

-- 2. Participants can update their own basic info
DROP POLICY IF EXISTS "Users can update their own basic info" ON public.users;
CREATE POLICY "Users can update their own basic info"
ON public.users
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 3. Admins have FULL access to the users table
DROP POLICY IF EXISTS "Admins have full access to users" ON public.users;
CREATE POLICY "Admins have full access to users"
ON public.users
FOR ALL
USING ( (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' );

-- --------------------------------------------------------
-- TEAMS TABLE POLICIES
-- --------------------------------------------------------

-- 1. Participants can view their own team
DROP POLICY IF EXISTS "Users can view their own team" ON public.teams;
CREATE POLICY "Users can view their own team"
ON public.teams
FOR SELECT
USING (id = (SELECT team_id FROM public.users WHERE id = auth.uid()));

-- 2. Team leaders can update their own team's name
DROP POLICY IF EXISTS "Leaders can update their team name" ON public.teams;
CREATE POLICY "Leaders can update their team name"
ON public.teams
FOR UPDATE
USING (leader_id = auth.uid())
WITH CHECK (leader_id = auth.uid());

-- 3. Admins have FULL access to the teams table
DROP POLICY IF EXISTS "Admins have full access to teams" ON public.teams;
CREATE POLICY "Admins have full access to teams"
ON public.teams
FOR ALL
USING ( (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' );
