export interface LeaderboardEntry {
  rank: number;
  id: string;
  team_name: string;
  challenges_completed: number;
  completion_time: string;
  created_at?: string;
  updated_at?: string;
}

export interface SubmitScoreDto {
  team_name: string;
  challenges_completed: number;
  completion_time?: string;
}

export interface UpdateScoreDto {
  team_name?: string;
  challenges_completed?: number;
  completion_time?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}
