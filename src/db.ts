import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { SupabaseUserRepository } from './repositories/supabase/UserRepository';
import { SupabaseTeamRepository } from './repositories/supabase/TeamRepository';
import { SupabaseChallengeRepository } from './repositories/supabase/ChallengeRepository';
import { SupabaseTeamProgressRepository } from './repositories/supabase/TeamProgressRepository';
import { SupabaseSubmissionLogRepository } from './repositories/supabase/SubmissionLogRepository';
import { IUserRepository, ITeamRepository, IChallengeRepository, ITeamProgressRepository, ISubmissionLogRepository } from './repositories/interfaces';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

// Initialize and export the Supabase Client
export const supabase = createClient(supabaseUrl, supabaseKey);

// Define our AppDatabase structure (The Registry)
export interface AppDatabase {
  users: IUserRepository;
  teams: ITeamRepository;
  challenges: IChallengeRepository;
  teamProgress: ITeamProgressRepository;
  submissionLogs: ISubmissionLogRepository;
}

// Export the active database implementation
export const db: AppDatabase = {
  users: new SupabaseUserRepository(supabase),
  teams: new SupabaseTeamRepository(supabase),
  challenges: new SupabaseChallengeRepository(supabase),
  teamProgress: new SupabaseTeamProgressRepository(supabase),
  submissionLogs: new SupabaseSubmissionLogRepository(supabase)
};

export default db;
