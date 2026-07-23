export interface User {
  id: string;
  email: string;
  display_name: string | null;
  register_no: string | null;
  role: 'participant' | 'admin';
  is_admin_approved?: boolean;
  team_id: string | null;
  joined_team_at: Date | null;
  created_at: Date;
}

export interface Team {
  id: string;
  name: string;
  leader_id: string | null;
  invite_code: string;
  is_disqualified: boolean;
}

export interface Challenge {
  id: string;
  challenge_name: string;
  story_context: string;
  embedded_assets: any;
  answer_hash: string;
  unlock_sequence: number;
  unlocks_story_fragment: string | null;
  created_at: Date;
}

export interface TeamProgress {
  id: string;
  team_id: string;
  current_challenge_id: string | null;
  challenges_completed: number;
  total_time_taken: number;
  current_challenge_attempts: number;
  opened_at: Date | null;
  completed_at: Date | null;
  updated_at: Date;
}

export interface SubmissionLog {
  id: string;
  team_id: string | null;
  user_id: string | null;
  challenge_id: string | null;
  submitted_answer: string;
  is_correct: boolean;
  submitted_at: Date;
}

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  seedUser(id: string, email: string, display_name: string | null, register_no: string | null, role: 'participant' | 'admin', is_admin_approved?: boolean): Promise<void>;
  updateDisplayName(id: string, displayName: string): Promise<void>;
  updateTeam(id: string, teamId: string | null): Promise<void>;
  updateRole(id: string, role: 'participant' | 'admin'): Promise<void>;
  approveAdmin(id: string): Promise<void>;
  countUsers(): Promise<number>;
  listAllUsers(): Promise<User[]>;
  deleteUser(id: string): Promise<void>;
}

export interface ITeamRepository {
  findById(id: string): Promise<Team | null>;
  findByInviteCode(inviteCode: string): Promise<Team | null>;
  countMembers(teamId: string): Promise<number>;
  createTeamAndJoin(userId: string, teamName: string, inviteCode: string, teamId: string): Promise<void>;
  updateName(teamId: string, newName: string): Promise<void>;
  removeMember(userId: string, teamId: string): Promise<void>;
  deleteTeam(teamId: string): Promise<void>;
}

export interface IChallengeRepository {
  findById(id: string): Promise<Challenge | null>;
  findBySequence(sequence: number): Promise<Challenge | null>;
}

export interface ITeamProgressRepository {
  findByTeamId(teamId: string): Promise<TeamProgress | null>;
  initializeProgress(teamId: string, firstChallengeId: string): Promise<void>;
  recordAttempt(teamId: string, isCorrect: boolean, deltaSeconds?: number, nextChallengeId?: string): Promise<void>;
}

export interface ISubmissionLogRepository {
  logSubmission(teamId: string | null, userId: string | null, challengeId: string | null, submittedAnswer: string, isCorrect: boolean): Promise<void>;
}
