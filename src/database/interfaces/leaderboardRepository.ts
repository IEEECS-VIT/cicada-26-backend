import { Response } from 'express';
import { LeaderboardEntry, SubmitScoreDto, UpdateScoreDto } from '../../types/leaderboard.js';

export interface ILeaderboardRepository {
  getLiveLeaderboard(): Promise<LeaderboardEntry[]>;
  setScoreByName(team_name: string, challenges_completed: number, completion_time?: string): Promise<LeaderboardEntry>;
  adjustScore(identifier: string, delta: number): Promise<LeaderboardEntry | null>;
  updateScore(id: string, dto: UpdateScoreDto): Promise<LeaderboardEntry | null>;
  deleteTeam(identifier: string): Promise<boolean>;
  resetLeaderboard(): Promise<boolean>;
  registerSseClient(res: Response): void;
  unregisterSseClient(res: Response): void;
  broadcastStream(leaderboard: LeaderboardEntry[]): void;
}
