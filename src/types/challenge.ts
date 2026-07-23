export type AssetType = 'image' | 'pdf' | 'audio' | 'video' | 'file' | 'text';

export interface ChallengeAsset {
  type: AssetType;
  url?: string;
  name?: string;
  caption?: string;
  content?: string;
}

export interface StoryFragment {
  title: string;
  header?: string;
  content: string;
}

export interface Challenge {
  id: string;
  order_number: number;
  name: string;
  story_context?: string | null;
  assets: ChallengeAsset[];
  story_fragment?: StoryFragment | null;
  answer_key: string;
  time_limit?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChallengePublic {
  id: string;
  order_number: number;
  name: string;
  story_context?: string | null;
  assets: ChallengeAsset[];
  story_fragment?: StoryFragment | null;
  is_active: boolean;
  is_locked?: boolean;
  time_limit?: number;
  challenge_started_at?: string;
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
  challenge_started_at: string;
  created_at: string;
  updated_at: string;
}

export interface ParticipantProgress {
  team_name: string;
  current_challenge_order: number;
  completed_challenges: number[];
  challenges_solved: number;
  unlocked_story_fragments: Array<{
    challenge_order: number;
    challenge_name: string;
    story_fragment: StoryFragment;
  }>;
}

export interface AdminTeamProgressSummary {
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
}

export interface SubmitAnswerResult {
  success: boolean;
  message: string;
  tryAgain?: boolean;
  unlocked_next_challenge?: number | null;
  story_fragment?: StoryFragment | null;
}

export interface AdminOverrideDto {
  team_name: string;
  target_challenge_order: number;
}

export interface CreateChallengeDto {
  order_number: number;
  name: string;
  story_context?: string;
  assets?: ChallengeAsset[];
  story_fragment?: StoryFragment;
  answer_key: string;
  time_limit?: number;
  is_active?: boolean;
}

export interface UpdateChallengeDto {
  order_number?: number;
  name?: string;
  story_context?: string;
  assets?: ChallengeAsset[];
  story_fragment?: StoryFragment;
  answer_key?: string;
  time_limit?: number;
  is_active?: boolean;
}
