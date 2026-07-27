import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { SupabaseUserRepository } from './repositories/supabase/UserRepository.js';
import { SupabaseTeamRepository } from './repositories/supabase/TeamRepository.js';
import { SupabaseChallengeRepository } from './repositories/supabase/ChallengeRepository.js';
import { SupabaseTeamProgressRepository } from './repositories/supabase/TeamProgressRepository.js';
import { SupabaseSubmissionLogRepository } from './repositories/supabase/SubmissionLogRepository.js';
import { SupabaseAdminLogRepository } from './repositories/supabase/AdminLogRepository.js';
import { IUserRepository, ITeamRepository, IChallengeRepository, ITeamProgressRepository, ISubmissionLogRepository, IAdminLogRepository } from './repositories/interfaces.js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://fdzcrmwwjpfwntbakied.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

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
