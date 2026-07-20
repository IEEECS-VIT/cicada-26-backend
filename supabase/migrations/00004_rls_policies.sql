-- Enable Row Level Security (RLS) on the tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------
-- USERS TABLE POLICIES
-- --------------------------------------------------------

-- 1. Participants can view their own profile and profiles of their teammates
CREATE POLICY "Users can view themselves and teammates" 
ON public.users
FOR SELECT
USING (
  id = auth.uid() OR 
  (team_id IS NOT NULL AND team_id = (SELECT team_id FROM public.users WHERE id = auth.uid()))
);

-- 2. Participants can update their own display_name
CREATE POLICY "Users can update their own basic info"
ON public.users
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 3. Admins have FULL access to the users table
CREATE POLICY "Admins have full access to users"
ON public.users
FOR ALL
USING ( (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' );

-- --------------------------------------------------------
-- TEAMS TABLE POLICIES
-- --------------------------------------------------------

-- 1. Participants can view their own team
CREATE POLICY "Users can view their own team"
ON public.teams
FOR SELECT
USING (id = (SELECT team_id FROM public.users WHERE id = auth.uid()));

-- 2. Team leaders can update their own team's name
CREATE POLICY "Leaders can update their team name"
ON public.teams
FOR UPDATE
USING (leader_id = auth.uid())
WITH CHECK (leader_id = auth.uid());

-- 3. Admins have FULL access to the teams table
CREATE POLICY "Admins have full access to teams"
ON public.teams
FOR ALL
USING ( (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' );
