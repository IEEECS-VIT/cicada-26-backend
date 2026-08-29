import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { SupabaseUserRepository } from './database/supabase/UserRepository.js';
import { SupabaseTeamRepository } from './database/supabase/TeamRepository.js';
import { SupabaseChallengeRepository } from './database/supabase/ChallengeRepository.js';
import { SupabaseTeamProgressRepository } from './database/supabase/TeamProgressRepository.js';
import { SupabaseSubmissionLogRepository } from './database/supabase/SubmissionLogRepository.js';
import { SupabaseAdminLogRepository } from './database/supabase/AdminLogRepository.js';
import { IUserRepository, ITeamRepository, IChallengeRepository, ITeamProgressRepository, ISubmissionLogRepository, IAdminLogRepository } from './repositories/interfaces.js';

dotenv.config();

// Node <22 has no native WebSocket, which @supabase/realtime-js requires at
// client construction. Fall back to the `ws` package (transitively installed)
// so the app keeps working on Node 20.
if (!globalThis.WebSocket) {
  const { WebSocket } = require('ws') as { WebSocket: typeof globalThis.WebSocket };
  globalThis.WebSocket = WebSocket;
}

// ---------------------------------------------------------------------------
// Startup guard — fail fast if critical env vars are missing
// ---------------------------------------------------------------------------
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('[STARTUP ERROR] SUPABASE_URL is not set. Please check your .env file.');
}
if (!supabaseAnonKey) {
  throw new Error('[STARTUP ERROR] SUPABASE_ANON_KEY is not set. Please check your .env file.');
}
if (!supabaseServiceRoleKey) {
  throw new Error('[STARTUP ERROR] SUPABASE_SERVICE_ROLE_KEY is not set. Please check your .env file.');
}
if (!process.env.GOD_API_KEY) {
  throw new Error('[STARTUP ERROR] GOD_API_KEY is not set. Please check your .env file.');
}
if (!process.env.ADMIN_API_KEY) {
  throw new Error('[STARTUP ERROR] ADMIN_API_KEY is not set. Please check your .env file.');
}

// ---------------------------------------------------------------------------
// Two Supabase clients — one for users, one for admins/god
//
// supabaseAnon  → Uses ANON KEY. Respects Row Level Security (RLS).
//                 Used to verify JWT tokens sent by regular users (participants).
//
// supabase      → Uses SERVICE ROLE KEY. Bypasses RLS. Has full DB access.
//                 Used for: all DB operations, verifying admin/god JWTs,
//                 and seeding/managing users/teams server-side.
// ---------------------------------------------------------------------------
export const supabaseAnon: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// AppDatabase — typed repository registry
// ---------------------------------------------------------------------------
export interface AppDatabase {
  users: IUserRepository;
  teams: ITeamRepository;
  challenges: IChallengeRepository;
  teamProgress: ITeamProgressRepository;
  submissionLogs: ISubmissionLogRepository;
  adminLogs: IAdminLogRepository;
}

// All DB operations use the service role client (full access, server-side only)
export const db: AppDatabase = {
  users: new SupabaseUserRepository(supabase),
  teams: new SupabaseTeamRepository(supabase),
  challenges: new SupabaseChallengeRepository(supabase),
  teamProgress: new SupabaseTeamProgressRepository(supabase),
  submissionLogs: new SupabaseSubmissionLogRepository(supabase),
  adminLogs: new SupabaseAdminLogRepository(supabase),
};

export default db;
