-- Function to randomly generate a 6-character alphanumeric invite code
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS VARCHAR AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER := 0;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Secure RPC to create a new team
CREATE OR REPLACE FUNCTION public.create_team(p_team_name VARCHAR)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_team_id UUID;
  v_invite_code VARCHAR;
  v_user_record RECORD;
BEGIN
  -- 1. Ensure user is logged in
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  -- 2. Check if user already belongs to a team
  SELECT * INTO v_user_record FROM public.users WHERE id = v_user_id;
  IF v_user_record.team_id IS NOT NULL THEN
    RAISE EXCEPTION 'You are already in a team. You cannot create another one.';
  END IF;

  -- 3. Generate a unique invite code
  v_invite_code := public.generate_invite_code();
  
  -- Prevent ultra-rare collision (could add a loop here, but relying on unique constraint for simplicity)

  -- 4. Create the team
  INSERT INTO public.teams (name, leader_id, invite_code)
  VALUES (p_team_name, v_user_id, v_invite_code)
  RETURNING id INTO v_team_id;

  -- 5. Update the user to belong to this team
  UPDATE public.users 
  SET team_id = v_team_id, joined_team_at = NOW()
  WHERE id = v_user_id;

  RETURN v_team_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Secure RPC to join an existing team
CREATE OR REPLACE FUNCTION public.join_team(p_invite_code VARCHAR)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_team_id UUID;
  v_member_count INT;
  v_user_record RECORD;
BEGIN
  -- 1. Ensure user is logged in
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  -- 2. Check if user already belongs to a team
  SELECT * INTO v_user_record FROM public.users WHERE id = v_user_id;
  IF v_user_record.team_id IS NOT NULL THEN
    RAISE EXCEPTION 'You are already in a team. You cannot join another one.';
  END IF;

  -- 3. Find the team by invite code
  SELECT id INTO v_team_id FROM public.teams WHERE invite_code = UPPER(p_invite_code);
  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code.';
  END IF;

  -- 4. Check if team is full (Max 5 per team)
  SELECT COUNT(*) INTO v_member_count FROM public.users WHERE team_id = v_team_id;
  IF v_member_count >= 5 THEN
    RAISE EXCEPTION 'This team is already full (maximum 5 members).';
  END IF;

  -- 5. Join the team
  UPDATE public.users 
  SET team_id = v_team_id, joined_team_at = NOW()
  WHERE id = v_user_id;

  RETURN v_team_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
