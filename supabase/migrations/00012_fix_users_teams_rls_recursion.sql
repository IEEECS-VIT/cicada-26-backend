-- Migration 00011 fixed the auth.uid()-vs-email join key but reintroduced a
-- classic Postgres RLS trap: a policy on public.users whose USING clause
-- itself subqueries public.users forces Postgres to re-evaluate that same
-- policy to answer the subquery, which (with two such self-referencing
-- policies active) recurses -- "infinite recursion detected in policy for
-- relation users" (42P17). The standard fix (per Supabase's own docs for
-- this exact error) is to move the self-lookup into a SECURITY DEFINER
-- function: it runs with the privileges of its owner and so does not
-- re-trigger RLS on the table it reads internally.

CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM public.users WHERE email = auth.email() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_app_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.users WHERE email = auth.email() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_app_team_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT team_id FROM public.users WHERE email = auth.email() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_app_user_role() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_app_team_id() TO authenticated, anon;

DROP POLICY IF EXISTS "Users can view themselves and teammates" ON public.users;
CREATE POLICY "Users can view themselves and teammates"
ON public.users
FOR SELECT
USING (
  email = auth.email() OR
  (team_id IS NOT NULL AND team_id = public.current_app_team_id())
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
USING ( public.current_app_user_role() IN ('admin', 'GOD') );

DROP POLICY IF EXISTS "Users can view their own team" ON public.teams;
CREATE POLICY "Users can view their own team"
ON public.teams
FOR SELECT
USING (id = public.current_app_team_id());

DROP POLICY IF EXISTS "Leaders can update their team name" ON public.teams;
CREATE POLICY "Leaders can update their team name"
ON public.teams
FOR UPDATE
USING (leader_id = public.current_app_user_id())
WITH CHECK (leader_id = public.current_app_user_id());

DROP POLICY IF EXISTS "Admins have full access to teams" ON public.teams;
CREATE POLICY "Admins have full access to teams"
ON public.teams
FOR ALL
USING ( public.current_app_user_role() IN ('admin', 'GOD') );
