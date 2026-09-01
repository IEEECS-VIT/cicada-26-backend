import {
  Challenge,
  ChallengePublic,
  TeamProgress,
  CreateChallengeDto,
  UpdateChallengeDto,
  ChallengeAsset,
  Round,
  CreateRoundDto,
  UpdateRoundDto,
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
  updateStartedTimers(team_name: string, started_at: string | null, clientIp?: string | null, setRoundStarted?: boolean): Promise<TeamProgress>;
  getAllTeamsProgressAdmin(): Promise<TeamProgress[]>;
  addAssetToChallenge(challengeId: string, asset: Omit<ChallengeAsset, 'id'> & { id?: string }): Promise<ChallengeAsset[]>;
  editAssetInChallenge(challengeId: string, assetId: string, updatedAsset: Partial<ChallengeAsset>): Promise<ChallengeAsset[]>;
  deleteAssetFromChallenge(challengeId: string, assetId: string): Promise<ChallengeAsset[]>;
  getRounds(): Promise<Round[]>;
  getRoundByIdentifier(identifier: string | number): Promise<Round | null>;
  createRound(dto: CreateRoundDto): Promise<Round>;
  updateRound(identifier: string, dto: UpdateRoundDto): Promise<Round | null>;
  deleteRound(id: string): Promise<boolean>;
  reorderRounds(orderedIds: string[]): Promise<Array<{ id: string; order_number: number }>>;
}
