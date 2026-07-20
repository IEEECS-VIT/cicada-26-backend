import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { SupabaseUserRepository } from './repositories/supabase/UserRepository';
import { SupabaseTeamRepository } from './repositories/supabase/TeamRepository';
import { IUserRepository, ITeamRepository } from './repositories/interfaces';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

// Initialize the Supabase Client
const supabase = createClient(supabaseUrl, supabaseKey);

// Define our AppDatabase structure (The Registry)
export interface AppDatabase {
  users: IUserRepository;
  teams: ITeamRepository;
}

// Export the active database implementation
// If we ever want to switch to Firebase, we simply replace the implementations here
// e.g. users: new FirebaseUserRepository(...)
export const db: AppDatabase = {
  users: new SupabaseUserRepository(supabase),
  teams: new SupabaseTeamRepository(supabase)
};

export default db;
