export type AssetType = 'image' | 'pdf' | 'audio' | 'video' | 'file' | 'text';

export interface ChallengeAsset {
  id: string;
  type?: 'image' | 'audio' | 'video' | 'document' | 'link' | 'pdf' | 'file' | 'text';
  name: string;
  url: string;
  asset_set?: number;
}

export interface StoryFragment {
  title: string;
  header?: string;
  content: string;
}

export interface Round {
  id: string;
  name: string;
  order_number: number;
  story_fragment?: StoryFragment | null;
  time_limit: number;
  started_at?: string | null;
  is_paused?: boolean;
  paused_at?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoundPublic {
  id: string;
  name: string;
  order_number: number;
  story_fragment?: StoryFragment | null;
  time_limit: number;
  started_at?: string | null;
  is_paused?: boolean;
  paused_at?: string | null;
  is_active: boolean;
  is_locked?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRoundDto {
  name: string;
  order_number?: number;
  story_fragment?: StoryFragment;
  time_limit?: number;
  is_active?: boolean;
}

export interface UpdateRoundDto {
  name?: string;
  order_number?: number;
  story_fragment?: StoryFragment;
  time_limit?: number;
  started_at?: string | null;
  is_paused?: boolean;
  paused_at?: string | null;
  is_active?: boolean;
}

export interface ChallengeHint {
  id: string;
  text: string;
  is_visible: boolean;
  unlock_minutes?: number;
}

export interface Challenge {
  id: string;
  round_id?: string | null;
  round_name?: string | null;
  round_order?: number | null;
  order_number: number;
  name: string;
  story_context?: string | null;
  assets: ChallengeAsset[];
  story_fragment?: StoryFragment | null;
  hints?: ChallengeHint[] | null;
  answer_key: string;
  time_limit?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChallengePublic {
  id: string;
  round_id?: string | null;
  round_name?: string | null;
  round_order?: number | null;
  order_number: number;
  name: string;
  story_context?: string | null;
  assets: ChallengeAsset[];
  story_fragment?: StoryFragment | null;
  hints?: ChallengeHint[] | null;
  is_active: boolean;
  is_locked?: boolean;
  time_limit?: number;
  challenge_started_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamProgress {
  id: string;
  team_name: string;
  current_challenge_order: number;
  completed_challenges: number[];
  attempts_count: number;
  last_attempt_at: string;
  challenge_started_at: string | null;
  started_ip?: string | null;
  round_started_at?: string | null;
  round_bonus_seconds?: number;
  created_at: string;
  updated_at: string;
}

export interface ParticipantProgress {
  team_name: string;
  current_challenge_order: number;
  current_round_order: number;
  completed_challenges: number[];
  challenges_solved: number;
  round_bonus_seconds: number;
  round_started_at?: string | null;
  unlocked_story_fragments: Array<{
    round_order: number;
    round_name: string;
    story_fragment: StoryFragment;
  }>;
}

export interface AdminTeamProgressSummary {
  current_round_order: number;
  team_name: string;
  current_challenge_order: number;
  challenges_solved: number;
  completion_time: string | null;
  attempts_count: number;
  last_attempt_at: string;
  story_progress: string;
  completed_challenges: number[];
}

export interface SubmitAnswerDto {
  team_name: string;
  challenge_identifier: string | number; // Order number or UUID
  answer: string;
  team_id?: string;
  user_id?: string;
}

export interface SubmitAnswerResult {
  success: boolean;
  message: string;
  tryAgain?: boolean;
  unlocked_next_challenge?: number | null;
  story_fragment?: StoryFragment | null;
  already_solved?: boolean;
}

export interface AdminOverrideDto {
  team_name: string;
  target_challenge_order: number;
}

export interface CreateChallengeDto {
  round_id?: string;
  order_number: number;
  name: string;
  story_context?: string;
  assets?: ChallengeAsset[];
  story_fragment?: StoryFragment;
  hints?: ChallengeHint[];
  answer_key: string;
  time_limit?: number;
  is_active?: boolean;
}

export interface UpdateChallengeDto {
  round_id?: string;
  order_number?: number;
  name?: string;
  story_context?: string;
  assets?: ChallengeAsset[];
  story_fragment?: StoryFragment;
  hints?: ChallengeHint[];
  answer_key?: string;
  time_limit?: number;
  is_active?: boolean;
}
