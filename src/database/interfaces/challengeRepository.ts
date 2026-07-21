import {
  Challenge,
  ChallengePublic,
  TeamProgress,
  CreateChallengeDto,
  UpdateChallengeDto,
} from '../../types/challenge.js';

export interface IChallengeRepository {
  getPublicChallenges(): Promise<ChallengePublic[]>;
  getPublicChallengeByIdentifier(identifier: string | number): Promise<ChallengePublic | null>;
  getChallengeWithAnswerKey(identifier: string | number): Promise<Challenge | null>;
  getAllChallengesAdmin(): Promise<Challenge[]>;
  createChallenge(dto: CreateChallengeDto): Promise<Challenge>;
  updateChallenge(id: string, dto: UpdateChallengeDto): Promise<Challenge | null>;
  deleteChallenge(id: string): Promise<boolean>;
  getTeamProgress(team_name: string): Promise<TeamProgress | null>;
  upsertTeamProgress(
    team_name: string,
    current_challenge_order: number,
    completed_challenges: number[],
    attempts_count?: number
  ): Promise<TeamProgress>;
  recordAttempt(team_name: string): Promise<TeamProgress>;
  getAllTeamsProgressAdmin(): Promise<TeamProgress[]>;
}
