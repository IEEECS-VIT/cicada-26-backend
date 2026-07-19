import { Response } from 'express';
import { ILeaderboardRepository } from '../database/interfaces/leaderboardRepository.js';
import { supabaseLeaderboardRepository } from '../database/supabase/supabaseLeaderboardRepository.js';
import { LeaderboardEntry, SubmitScoreDto, UpdateScoreDto } from '../types/leaderboard.js';

export class LeaderboardService {
  private static repository: ILeaderboardRepository = supabaseLeaderboardRepository;

  /**
   * Set dynamic database repository provider (enables easy migration to Prisma/PostgreSQL/MongoDB).
   */
  static setRepository(repo: ILeaderboardRepository): void {
    this.repository = repo;
  }

  static registerSseClient(res: Response): void {
    this.repository.registerSseClient(res);
  }

  static unregisterSseClient(res: Response): void {
    this.repository.unregisterSseClient(res);
  }

  static broadcastStream(leaderboard: LeaderboardEntry[]): void {
    this.repository.broadcastStream(leaderboard);
  }

  static async getLiveLeaderboard(): Promise<LeaderboardEntry[]> {
    return this.repository.getLiveLeaderboard();
  }

  static async setScoreByName(
    team_name: string,
    challenges_completed: number,
    completion_time?: string
  ): Promise<LeaderboardEntry> {
    return this.repository.setScoreByName(team_name, challenges_completed, completion_time);
  }

  static async upsertScore(dto: SubmitScoreDto): Promise<LeaderboardEntry> {
    return this.repository.setScoreByName(dto.team_name, dto.challenges_completed, dto.completion_time);
  }

  static async adjustScore(identifier: string, delta: number): Promise<LeaderboardEntry | null> {
    return this.repository.adjustScore(identifier, delta);
  }

  static async updateScore(id: string, dto: UpdateScoreDto): Promise<LeaderboardEntry | null> {
    return this.repository.updateScore(id, dto);
  }

  static async deleteTeam(identifier: string): Promise<boolean> {
    return this.repository.deleteTeam(identifier);
  }

  static async resetLeaderboard(): Promise<boolean> {
    return this.repository.resetLeaderboard();
  }
}
