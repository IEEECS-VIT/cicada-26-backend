import bcrypt from 'bcrypt';
import { supabaseChallengeRepository, SupabaseChallengeRepository } from '../database/supabase/supabaseChallengeRepository.js';
import { supabaseLeaderboardRepository, SupabaseLeaderboardRepository } from '../database/supabase/supabaseLeaderboardRepository.js';
import {
  ChallengePublic,
  Challenge,
  SubmitAnswerDto,
  SubmitAnswerResult,
  AdminOverrideDto,
  CreateChallengeDto,
  UpdateChallengeDto,
  ParticipantProgress,
  AdminTeamProgressSummary,
  StoryFragment,
  TeamProgress,
} from '../types/challenge.js';

const isBcryptHash = (str: string): boolean => {
  return /^\$[2ayb]\$[0-9]{2}\$[./A-Za-z0-9]{53}$/.test(str);
};

export class ChallengeService {
  constructor(
    private challengeRepo: SupabaseChallengeRepository = supabaseChallengeRepository,
    private leaderboardRepo: SupabaseLeaderboardRepository = supabaseLeaderboardRepository
  ) {}

  /**
   * Get all active public challenges (without answer keys)
   * Optionally annotates is_locked status if team_name is provided
   */
  public async getPublicChallenges(team_name?: string): Promise<ChallengePublic[]> {
    const challenges = await this.challengeRepo.getPublicChallenges();
    let currentOrder = 1;
    let progress: any = null;
    if (team_name && team_name.trim()) {
      progress = await this.challengeRepo.getTeamProgress(team_name.trim());
      if (!progress) {
        progress = await this.challengeRepo.upsertTeamProgress(team_name.trim(), 1, []);
      }
      currentOrder = progress?.current_challenge_order || 1;
    }

    return challenges.map((item) => {
      const isLocked = item.order_number > currentOrder;
      if (isLocked) {
        return {
          id: item.id,
          order_number: item.order_number,
          name: item.name,
          is_active: item.is_active,
          is_locked: true,
          time_limit: item.time_limit || 1800,
          story_context: undefined,
          assets: undefined,
          story_fragment: undefined,
        } as unknown as ChallengePublic;
      }
      return {
        ...item,
        is_locked: false,
        time_limit: item.time_limit || 1800,
        challenge_started_at: item.order_number === currentOrder && progress ? progress.challenge_started_at : undefined
      };
    });
  }

  public async getPublicChallenge(identifier: string | number, team_name?: string): Promise<ChallengePublic | null> {
    const challenge = await this.challengeRepo.getPublicChallengeByIdentifier(identifier);
    if (!challenge) return null;

    let currentOrder = 1;
    let progress: any = null;
    if (team_name && team_name.trim()) {
      progress = await this.challengeRepo.getTeamProgress(team_name.trim());
      if (!progress) {
        progress = await this.challengeRepo.upsertTeamProgress(team_name.trim(), 1, []);
      }
      currentOrder = progress?.current_challenge_order || 1;
    }

    const isLocked = challenge.order_number > currentOrder;
    if (isLocked) {
      return {
        id: challenge.id,
        order_number: challenge.order_number,
        name: challenge.name,
        is_active: challenge.is_active,
        is_locked: true,
        time_limit: challenge.time_limit || 1800,
        story_context: undefined,
        assets: undefined,
        story_fragment: undefined,
      } as unknown as ChallengePublic;
    }

    return {
      ...challenge,
      is_locked: false,
      time_limit: challenge.time_limit || 1800,
      challenge_started_at: challenge.order_number === currentOrder && progress ? progress.challenge_started_at : undefined
    };
  }

  /**
   * Validate answer submitted by team
   * 1. Record attempt (increment attempt count)
   * 2. Enforce strict sequential challenge progression (block out-of-order attempts)
   * 3. Case insensitive comparison ignoring leading/trailing spaces
   * 4. On correct answer -> Update Leaderboard FIRST, then unlock next challenge & team progress
   * 5. On incorrect answer -> Return "Incorrect Authentication Key" (No info leakage)
   */
  public async submitAnswer(dto: SubmitAnswerDto): Promise<SubmitAnswerResult> {
    const { team_name, challenge_identifier, answer } = dto;

    if (!team_name || !team_name.trim()) {
      throw new Error('Team name is required');
    }

    if (answer === undefined || answer === null) {
      throw new Error('Answer is required');
    }

    // Always record attempt count for the team
    await this.challengeRepo.recordAttempt(team_name.trim());

    // Fetch team progress to check current unlocked challenge order
    const existingProgress = await this.challengeRepo.getTeamProgress(team_name.trim());
    const currentUnlockedOrder = existingProgress?.current_challenge_order || 1;

    // Fetch challenge with answer key
    const challenge = await this.challengeRepo.getChallengeWithAnswerKey(challenge_identifier);
    if (!challenge) {
      throw new Error(`Challenge '${challenge_identifier}' not found`);
    }

    // Verify time limit/timeout
    if (existingProgress && existingProgress.challenge_started_at) {
      const startedAt = new Date(existingProgress.challenge_started_at).getTime();
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      const limit = challenge.time_limit !== undefined ? challenge.time_limit : 1800;
      if (elapsedSeconds > limit) {
        return {
          success: false,
          message: 'Time Limit Exceeded for this challenge.',
          tryAgain: false,
        };
      }
    }

    // Strict Sequential Lock Rule: Team cannot attempt challenge N if N > currentUnlockedOrder
    if (challenge.order_number > currentUnlockedOrder) {
      return {
        success: false,
        message: `Challenge locked. You must complete challenge ${currentUnlockedOrder} first before attempting challenge ${challenge.order_number}.`,
        tryAgain: false,
      };
    }

    // Normalize comparison: trim leading/trailing spaces, case insensitive
    const normalizedSubmitted = answer.trim().toLowerCase();
    let isCorrect = false;

    if (isBcryptHash(challenge.answer_key)) {
      isCorrect = await bcrypt.compare(normalizedSubmitted, challenge.answer_key);
    } else {
      isCorrect = normalizedSubmitted === challenge.answer_key.trim().toLowerCase();
    }

    if (!isCorrect) {
      return {
        success: false,
        message: 'Incorrect Authentication Key',
        tryAgain: true,
      };
    }

    // Correct Answer logic!
    const completedSet = new Set<number>(existingProgress?.completed_challenges || []);
    completedSet.add(challenge.order_number);

    const completedArray = Array.from(completedSet).sort((a, b) => a - b);
    const nextChallengeOrder = challenge.order_number + 1;
    const currentOrder = Math.max(currentUnlockedOrder, nextChallengeOrder);

    // 1. Update Leaderboard FIRST (ensures team exists in leaderboard table satisfying FK)
    await this.leaderboardRepo.setScoreByName(
      team_name.trim(),
      completedArray.length,
      new Date().toISOString()
    );

    // 2. Update Team Progress SECOND
    await this.challengeRepo.upsertTeamProgress(
      team_name.trim(),
      currentOrder,
      completedArray
    );

    return {
      success: true,
      message: 'Correct answer! Next challenge unlocked automatically.',
      unlocked_next_challenge: nextChallengeOrder,
      story_fragment: challenge.story_fragment || null,
    };
  }

  /**
   * Participant Resume & Progress: Returns current state so user continues seamlessly after logout
   */
  public async getParticipantProgress(team_name: string): Promise<ParticipantProgress> {
    if (!team_name || !team_name.trim()) {
      throw new Error('Team name is required');
    }

    const progress = await this.challengeRepo.getTeamProgress(team_name.trim());
    const completedOrders = progress?.completed_challenges || [];
    const allChallenges = await this.challengeRepo.getPublicChallenges();

    const unlockedFragments = allChallenges
      .filter((c) => completedOrders.includes(c.order_number) && c.story_fragment !== undefined && c.story_fragment !== null)
      .map((c) => ({
        challenge_order: c.order_number,
        challenge_name: c.name,
        story_fragment: c.story_fragment as StoryFragment,
      }));

    return {
      team_name: team_name.trim(),
      current_challenge_order: progress?.current_challenge_order || 1,
      completed_challenges: completedOrders,
      challenges_solved: completedOrders.length,
      unlocked_story_fragments: unlockedFragments,
    };
  }

  /**
   * Story Fragment Archive: Get all unlocked story fragments for a team
   */
  public async getUnlockedStoryFragments(team_name: string): Promise<Array<{
    challenge_order: number;
    challenge_name: string;
    story_fragment: StoryFragment;
  }>> {
    const progress = await this.getParticipantProgress(team_name);
    return progress.unlocked_story_fragments;
  }

  /**
   * Admin Progress Tracking (Visible to Admin Only - Section 7)
   */
  public async getAllTeamsProgressAdmin(): Promise<AdminTeamProgressSummary[]> {
    const progressList = await this.challengeRepo.getAllTeamsProgressAdmin();
    const leaderboard = await this.leaderboardRepo.getLiveLeaderboard();
    const allChallenges = await this.challengeRepo.getPublicChallenges();
    const totalChallengesCount = allChallenges.length;

    const summaryMap = new Map<string, AdminTeamProgressSummary>();
    const leaderboardMap = new Map(leaderboard.map((item) => [item.team_name, item]));

    for (const prog of progressList) {
      const lbEntry = leaderboardMap.get(prog.team_name);
      const solvedCount = prog.completed_challenges.length;

      summaryMap.set(prog.team_name, {
        team_name: prog.team_name,
        current_challenge_order: prog.current_challenge_order,
        challenges_solved: solvedCount,
        completion_time: lbEntry?.completion_time || null,
        attempts_count: prog.attempts_count || 0,
        last_attempt_at: prog.last_attempt_at,
        story_progress: `${solvedCount} / ${totalChallengesCount} fragments unlocked`,
        completed_challenges: prog.completed_challenges,
      });
    }

    for (const lb of leaderboard) {
      if (!summaryMap.has(lb.team_name)) {
        summaryMap.set(lb.team_name, {
          team_name: lb.team_name,
          current_challenge_order: (lb.challenges_completed || 0) + 1,
          challenges_solved: lb.challenges_completed || 0,
          completion_time: lb.completion_time || null,
          attempts_count: 0,
          last_attempt_at: lb.updated_at || lb.created_at || new Date().toISOString(),
          story_progress: `${lb.challenges_completed || 0} / ${totalChallengesCount} fragments unlocked`,
          completed_challenges: [],
        });
      }
    }

    return Array.from(summaryMap.values());
  }

  /**
   * Admin Privilege: Override unlock for any team
   */
  public async adminOverrideUnlock(dto: AdminOverrideDto): Promise<SubmitAnswerResult> {
    const { team_name, target_challenge_order } = dto;

    if (!team_name || !team_name.trim()) {
      throw new Error('Team name is required');
    }

    if (!target_challenge_order || target_challenge_order < 1) {
      throw new Error('Target challenge order must be greater than 0');
    }

    const existingProgress = await this.challengeRepo.getTeamProgress(team_name.trim());
    const completedSet = new Set<number>(existingProgress?.completed_challenges || []);

    for (let i = 1; i < target_challenge_order; i++) {
      completedSet.add(i);
    }

    const completedArray = Array.from(completedSet).sort((a, b) => a - b);

    // 1. Update Leaderboard FIRST
    await this.leaderboardRepo.setScoreByName(
      team_name.trim(),
      completedArray.length,
      new Date().toISOString()
    );

    // 2. Update Team Progress SECOND
    await this.challengeRepo.upsertTeamProgress(
      team_name.trim(),
      target_challenge_order,
      completedArray
    );

    return {
      success: true,
      message: `Admin override successful. Team '${team_name}' unlocked up to challenge ${target_challenge_order}.`,
      unlocked_next_challenge: target_challenge_order,
    };
  }

  /**
   * Admin: List all challenges including answer keys
   */
  public async getAllChallengesAdmin(): Promise<Challenge[]> {
    return this.challengeRepo.getAllChallengesAdmin();
  }

  /**
   * Admin: Create new challenge
   */
  public async createChallenge(dto: CreateChallengeDto): Promise<Challenge> {
    const hashedDto = { ...dto };
    if (dto.answer_key) {
      hashedDto.answer_key = await bcrypt.hash(dto.answer_key.trim().toLowerCase(), 10);
    }
    return this.challengeRepo.createChallenge(hashedDto);
  }

  /**
   * Admin: Update challenge
   */
  public async updateChallenge(id: string, dto: UpdateChallengeDto): Promise<Challenge | null> {
    const hashedDto = { ...dto };
    if (dto.answer_key) {
      hashedDto.answer_key = await bcrypt.hash(dto.answer_key.trim().toLowerCase(), 10);
    }
    return this.challengeRepo.updateChallenge(id, hashedDto);
  }

  /**
   * Admin: Delete challenge
   */
  public async deleteChallenge(id: string): Promise<boolean> {
    return this.challengeRepo.deleteChallenge(id);
  }

  /**
   * Admin: Reset a team's progress back to challenge 1
   */
  public async resetTeamProgress(team_name: string): Promise<TeamProgress> {
    if (!team_name || !team_name.trim()) {
      throw new Error('Team name is required');
    }
    return this.challengeRepo.resetTeamProgress(team_name.trim());
  }

  public async getSubmissionLogs(limit?: number, team_name?: string): Promise<any[]> {
    return this.challengeRepo.getSubmissionLogs(limit, team_name);
  }
}

export const challengeService = new ChallengeService();
