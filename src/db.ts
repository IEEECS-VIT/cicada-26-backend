import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { SupabaseUserRepository } from './database/supabase/UserRepository.js';
import { SupabaseTeamRepository } from './database/supabase/TeamRepository.js';
import { SupabaseChallengeRepository } from './database/supabase/ChallengeRepository.js';
import { SupabaseTeamProgressRepository } from './database/supabase/TeamProgressRepository.js';
import { SupabaseSubmissionLogRepository } from './database/supabase/SubmissionLogRepository.js';
import { SupabaseAdminLogRepository } from './database/supabase/AdminLogRepository.js';
import { IUserRepository, ITeamRepository, IChallengeRepository, ITeamProgressRepository, ISubmissionLogRepository, IAdminLogRepository } from './repositories/interfaces.js';

dotenv.config();

// ---------------------------------------------------------------------------
// Startup guard — fail fast if critical env vars are missing
// ---------------------------------------------------------------------------
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('[STARTUP ERROR] SUPABASE_URL is not set. Please check your .env file.');
}
if (!supabaseKey) {
  throw new Error('[STARTUP ERROR] SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) is not set. Please check your .env file.');
}

// Initialize and export the Supabase Client
export const supabase = createClient(supabaseUrl, supabaseKey);

// Define our AppDatabase structure (The Registry)
export interface AppDatabase {
  users: IUserRepository;
  teams: ITeamRepository;
  challenges: IChallengeRepository;
  teamProgress: ITeamProgressRepository;
  submissionLogs: ISubmissionLogRepository;
  adminLogs: IAdminLogRepository;
}

// Export the active database implementation
export const db: AppDatabase = {
  users: new SupabaseUserRepository(supabase),
  teams: new SupabaseTeamRepository(supabase),
  challenges: new SupabaseChallengeRepository(supabase),
  teamProgress: new SupabaseTeamProgressRepository(supabase),
  submissionLogs: new SupabaseSubmissionLogRepository(supabase),
  adminLogs: new SupabaseAdminLogRepository(supabase),
};

export default db;
