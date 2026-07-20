-- Trigger function to strictly enforce the whitelist before allowing a user to sign up
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER AS $$
DECLARE
  whitelist_user RECORD;
BEGIN
  -- Check if the email exists in our whitelist (public.users)
  SELECT * INTO whitelist_user FROM public.users WHERE email = NEW.email;
  
  -- If the email is not found, instantly abort the entire transaction
  IF NOT FOUND THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Your email (%) is not whitelisted for Cicada 2067.', NEW.email;
  END IF;

  -- The email is whitelisted!
  -- We must sync the public.users ID to match the newly generated auth.users ID
  -- This ensures RLS policies relying on auth.uid() work natively.
  UPDATE public.users 
  SET 
    id = NEW.id,
    display_name = COALESCE(public.users.display_name, NEW.raw_user_meta_data->>'full_name')
  WHERE email = NEW.email;

  -- Allow the signup to proceed
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on the Supabase internal auth table
CREATE TRIGGER enforce_whitelist_on_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_signup();
