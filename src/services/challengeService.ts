import bcrypt from 'bcrypt';
import db from '../db.js';
import { isIpTrackingEnabled, setIpTrackingEnabled, toggleIpTracking } from '../middleware/ipTrackingMiddleware.js';
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
  ChallengeHint,
  ChallengeAsset,
} from '../types/challenge.js';

const isBcryptHash = (str: string): boolean => {
  return /^\$[2ayb]\$[0-9]{2}\$[./A-Za-z0-9]{53}$/.test(str);
};

const isStartedAtPlaceholder = (dateStr: string | null | undefined): boolean => {
  if (!dateStr) return true;
  const time = new Date(dateStr).getTime();
  return isNaN(time) || time <= 86400000; // less than 1 day from epoch (allows 1970-01-01)
};

const toISTString = (dateStr: string | null | undefined, fallback: string = ''): string => {
  if (!dateStr) return fallback;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return fallback;
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffsetMs);
  const iso = istDate.toISOString();
  return iso.replace('Z', '+05:30');
};

const toISTStringNullable = (dateStr: string | null | undefined): string | null | undefined => {
  if (!dateStr) return dateStr;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffsetMs);
  const iso = istDate.toISOString();
  return iso.replace('Z', '+05:30');
};

export class ChallengeService {
  constructor(
    private challengeRepo: SupabaseChallengeRepository = supabaseChallengeRepository,
    private leaderboardRepo: SupabaseLeaderboardRepository = supabaseLeaderboardRepository
  ) {}

  private maskChallengeAssets(challenge: ChallengePublic): ChallengePublic {
    if (!challenge.assets) return challenge;
    const maskedAssets = challenge.assets.map((asset, index) => {
      if (asset.url) {
        return {
          ...asset,
          url: `/api/challenges/assets/masked?c=${challenge.id}&i=${index}`,
        };
      }
      return asset;
    });
    return {
      ...challenge,
      assets: maskedAssets,
    };
  }

  /**
   * Get all active public challenges (without answer keys)
   * Optionally annotates is_locked status if team_name is provided
   */
  public async getPublicChallenges(team_name?: string, clientIp?: string): Promise<ChallengePublic[]> {
    const challenges = await this.challengeRepo.getPublicChallenges();
    let currentOrder = 1;
    let progress: any = null;
    if (team_name && team_name.trim()) {
      progress = await this.challengeRepo.getTeamProgress(team_name.trim());
      if (!progress) {
        progress = await this.challengeRepo.upsertTeamProgress(team_name.trim(), 1, []);
      }
      currentOrder = progress?.current_challenge_order || 1;

      // IP Tracking mismatch check
      if (isIpTrackingEnabled() && progress && progress.started_ip && clientIp && progress.started_ip !== clientIp) {
        throw new Error(`IP_MISMATCH:${progress.started_ip}`);
      }

      if (progress && isStartedAtPlaceholder(progress.challenge_started_at)) {
        const nowStr = new Date().toISOString();
        progress = await this.challengeRepo.updateChallengeStartedAt(team_name.trim(), nowStr, clientIp);
      }
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
          hints: undefined, // Explicitly mask hints for locked challenges
        } as unknown as ChallengePublic;
      }
      const challenge_started_at = item.order_number === currentOrder && progress ? progress.challenge_started_at : undefined;
      const startVal = (item.order_number === currentOrder && progress && progress.challenge_started_at && !isStartedAtPlaceholder(progress.challenge_started_at))
        ? progress.challenge_started_at
        : undefined;

      const publicChallenge = {
        ...item,
        is_locked: false,
        time_limit: item.time_limit || 1800,
        hints: (item.hints || []).filter((h: any) => h.is_visible), // Service boundary visibility check (security filter)
        challenge_started_at: toISTStringNullable(challenge_started_at) || null,
        created_at: toISTString(startVal || item.created_at, item.created_at),
        updated_at: toISTString(startVal || item.updated_at, item.updated_at)
      };

      return this.maskChallengeAssets(publicChallenge);
    });
  }

  public async getPublicChallenge(identifier: string | number, team_name?: string, clientIp?: string): Promise<ChallengePublic | null> {
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

      // IP Tracking mismatch check
      if (isIpTrackingEnabled() && progress && progress.started_ip && clientIp && progress.started_ip !== clientIp) {
        throw new Error(`IP_MISMATCH:${progress.started_ip}`);
      }
    }

    const isLocked = challenge.order_number > currentOrder;
    if (!isLocked && team_name && team_name.trim() && progress && isStartedAtPlaceholder(progress.challenge_started_at) && challenge.order_number === currentOrder) {
      const nowStr = new Date().toISOString();
      progress = await this.challengeRepo.updateChallengeStartedAt(team_name.trim(), nowStr, clientIp);
    }
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
        hints: undefined, // Explicitly mask hints for locked challenges
      } as unknown as ChallengePublic;
    }

    const challenge_started_at = challenge.order_number === currentOrder && progress ? progress.challenge_started_at : undefined;
    const startVal = (challenge.order_number === currentOrder && progress && progress.challenge_started_at && !isStartedAtPlaceholder(progress.challenge_started_at))
      ? progress.challenge_started_at
      : undefined;

    const publicChallenge = {
      ...challenge,
      is_locked: false,
      time_limit: challenge.time_limit || 1800,
      hints: (challenge.hints || []).filter((h: any) => h.is_visible), // Service boundary visibility check (security filter)
      challenge_started_at: toISTStringNullable(challenge_started_at) || null,
      created_at: toISTString(startVal || challenge.created_at, challenge.created_at),
      updated_at: toISTString(startVal || challenge.updated_at, challenge.updated_at)
    };

    return this.maskChallengeAssets(publicChallenge);
  }

  /**
   * Validate answer submitted by team
   * 1. Record attempt (increment attempt count)
   * 2. Enforce strict sequential challenge progression (block out-of-order attempts)
   * 3. Case insensitive comparison ignoring leading/trailing spaces
   * 4. On correct answer -> Update Leaderboard FIRST, then unlock next challenge & team progress
   * 5. On incorrect answer -> Return "Incorrect Authentication Key" (No info leakage)
   */
  public async submitAnswer(dto: SubmitAnswerDto, clientIp?: string): Promise<SubmitAnswerResult> {
    const { team_name, challenge_identifier, answer } = dto;

    if (!team_name || !team_name.trim()) {
      throw new Error('Team name is required');
    }

    if (answer === undefined || answer === null) {
      throw new Error('Answer is required');
    }

    // Fetch team progress to check current unlocked challenge order
    let existingProgress = await this.challengeRepo.getTeamProgress(team_name.trim());

    // IP Tracking mismatch check
    if (isIpTrackingEnabled() && existingProgress && existingProgress.started_ip && clientIp && existingProgress.started_ip !== clientIp) {
      return {
        success: false,
        message: `Access Denied: Answer submission must come from the same IP address that activated the challenge.`,
        tryAgain: false,
      };
    }

    // Always record attempt count for the team
    await this.challengeRepo.recordAttempt(team_name.trim());

    const currentUnlockedOrder = existingProgress?.current_challenge_order || 1;

    // Fetch challenge with answer key
    const challenge = await this.challengeRepo.getChallengeWithAnswerKey(challenge_identifier);
    if (!challenge) {
      throw new Error(`Challenge '${challenge_identifier}' not found`);
    }

    if (!challenge.is_active) {
      return {
        success: false,
        message: 'This challenge is currently inactive and cannot be attempted.',
        tryAgain: false,
      };
    }

    // Bug Fix: If they already solved this challenge, don't update Leaderboard time (which ruins their tie-breaker rank)
    const alreadyCompleted = existingProgress?.completed_challenges?.includes(challenge.order_number) || false;
    if (alreadyCompleted) {
      return {
        success: true,
        message: 'You have already completed this challenge.',
        unlocked_next_challenge: currentUnlockedOrder,
        story_fragment: challenge.story_fragment || null,
      };
    }

    if (existingProgress && isStartedAtPlaceholder(existingProgress.challenge_started_at)) {
      const nowStr = new Date().toISOString();
      existingProgress = await this.challengeRepo.updateChallengeStartedAt(team_name.trim(), nowStr, clientIp);
    }

    // Verify time limit/timeout
    if (existingProgress && existingProgress.challenge_started_at && !isStartedAtPlaceholder(existingProgress.challenge_started_at)) {
      const startedAt = new Date(existingProgress.challenge_started_at).getTime();
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      const limit = challenge.time_limit !== undefined ? challenge.time_limit : 1800;
      if (elapsedSeconds > limit) {
        // TIME LIMIT EXCEEDED: Auto-skip to next challenge without awarding points
        // This prevents the team from being permanently soft-locked forever.
        const nextChallengeOrder = challenge.order_number + 1;
        const currentOrder = Math.max(currentUnlockedOrder, nextChallengeOrder);
        
        await this.challengeRepo.upsertTeamProgress(
          team_name.trim(),
          currentOrder,
          existingProgress?.completed_challenges || []
        );

        return {
          success: false,
          message: 'Time Limit Exceeded. You have been moved to the next challenge without points.',
          tryAgain: false,
          unlocked_next_challenge: currentOrder,
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

    // Log the submission attempt for admin visibility (submission_logs table)
    await db.submissionLogs.logSubmission(
      dto.team_id ?? null,
      dto.user_id ?? null,
      challenge.id,
      answer,
      isCorrect
    );

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

  /**
   * Admin: Add a hint to a challenge
   */
  public async addHintToChallenge(challengeId: string, hintText: string, isVisible: boolean): Promise<ChallengeHint[]> {
    if (!hintText || !hintText.trim()) {
      throw new Error('Hint text is required');
    }
    return this.challengeRepo.addHintToChallenge(challengeId, hintText.trim(), isVisible);
  }

  /**
   * Admin: Edit a hint in a challenge
   */
  public async editHintInChallenge(challengeId: string, hintId: string, hintText: string): Promise<ChallengeHint[]> {
    if (!hintText || !hintText.trim()) {
      throw new Error('Hint text is required');
    }
    return this.challengeRepo.editHintInChallenge(challengeId, hintId, hintText.trim());
  }

  /**
   * Admin: Delete a hint from a challenge
   */
  public async deleteHintFromChallenge(challengeId: string, hintId: string): Promise<ChallengeHint[]> {
    return this.challengeRepo.deleteHintFromChallenge(challengeId, hintId);
  }

  /**
   * Admin: Toggle hint visibility
   */
  public async toggleHintVisibility(challengeId: string, hintId: string): Promise<ChallengeHint[]> {
    return this.challengeRepo.toggleHintVisibility(challengeId, hintId);
  }

  /**
   * Admin: Add an asset to a challenge
   */
  public async addAssetToChallenge(challengeId: string, asset: Omit<ChallengeAsset, 'id'> & { id?: string }): Promise<ChallengeAsset[]> {
    return this.challengeRepo.addAssetToChallenge(challengeId, asset);
  }

  /**
   * Admin: Edit/Replace an asset in a challenge
   */
  public async editAssetInChallenge(challengeId: string, assetId: string, updatedAsset: Partial<ChallengeAsset>): Promise<ChallengeAsset[]> {
    return this.challengeRepo.editAssetInChallenge(challengeId, assetId, updatedAsset);
  }

  /**
   * Admin: Delete an asset from a challenge
   */
  public async deleteAssetFromChallenge(challengeId: string, assetId: string): Promise<ChallengeAsset[]> {
    return this.challengeRepo.deleteAssetFromChallenge(challengeId, assetId);
  }

  /**
   * Check if IP tracking is currently active
   */
  public isIpTrackingEnabled(): boolean {
    return isIpTrackingEnabled();
  }

  /**
   * Set IP tracking enabled state
   */
  public setIpTrackingEnabled(enabled: boolean): boolean {
    return setIpTrackingEnabled(enabled);
  }

  /**
   * Toggle IP tracking state
   */
  public toggleIpTracking(): boolean {
    return toggleIpTracking();
  }
}

export const challengeService = new ChallengeService();
