import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://fdzcrmwwjpfwntbakied.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseKey || supabaseKey === 'your_supabase_anon_key_here') {
  console.warn(
    '[WARN] Supabase API key is missing or set to placeholder in .env. Please set SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY.'
  );
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);
