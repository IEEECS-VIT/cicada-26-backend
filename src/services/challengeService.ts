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
  Round,
  RoundPublic,
  CreateRoundDto,
  UpdateRoundDto,
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

  private filterHints(hints: any[] | undefined | null, startedAtIso: string | null | undefined): any[] {
    if (!hints || hints.length === 0) return [];
    const startedTime = startedAtIso && !isStartedAtPlaceholder(startedAtIso) ? new Date(startedAtIso).getTime() : 0;
    const elapsedMinutes = startedTime > 0 ? (Date.now() - startedTime) / 60000 : 0;

    return hints.filter(h => {
      if (h.is_visible) return true;
      if (typeof h.unlock_minutes === 'number' && startedTime > 0) {
        return elapsedMinutes >= h.unlock_minutes;
      }
      return false;
    });
  }


  public hashTeamId(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  public filterAssetsBySet(assets: any[] | undefined, assignedSet: number | null | undefined, teamIdHash: number): any[] {
    if (!assets || assets.length === 0) return [];
    
    // Find all distinct sets in this challenge
    const uniqueSets = Array.from(new Set(assets.map(a => a.asset_set).filter(s => typeof s === 'number'))).sort((a, b) => a - b);
    
    if (uniqueSets.length === 0) {
      return assets; // No sets defined, return all
    }

    let targetSet;
    if (assignedSet !== null && assignedSet !== undefined && uniqueSets.includes(assignedSet)) {
       targetSet = assignedSet;
    } else {
       const setIndex = teamIdHash % uniqueSets.length;
       targetSet = uniqueSets[setIndex];
    }

    return assets.filter(a => typeof a.asset_set !== 'number' || a.asset_set === targetSet);
  }

  constructor(
    private challengeRepo: SupabaseChallengeRepository = supabaseChallengeRepository,
    private leaderboardRepo: SupabaseLeaderboardRepository = supabaseLeaderboardRepository
  ) {}

  private maskChallengeAssets(challenge: ChallengePublic): ChallengePublic {
    if (!challenge.assets) return challenge;
    const maskedAssets = challenge.assets.map((asset: any, index: number) => {
      if (asset.url) {
        const i = asset.original_index !== undefined ? asset.original_index : index;
        return {
          ...asset,
          url: `/api/challenges/assets/masked?c=${challenge.id}&i=${i}`,
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
   * Resolve the Round a challenge belongs to (via its round_id)
   */
  private getRoundForChallenge(challenge: { round_id?: string | null }, rounds: Round[]): Round | null {
    if (!challenge.round_id) return null;
    return rounds.find((r) => r.id === challenge.round_id) || null;
  }

  /**
   * Resolve the Round containing a given challenge order_number
   */
  private getRoundForOrder(order: number, challenges: ChallengePublic[], rounds: Round[]): Round | null {
    const challenge = challenges.find((c) => c.order_number === order);
    return challenge ? this.getRoundForChallenge(challenge, rounds) : null;
  }

  /**
   * Determine the team's current round order. If progress points past the last
   * challenge (competition finished), all rounds count as entered.
   */
  private getCurrentRoundOrder(currentOrder: number, challenges: ChallengePublic[], rounds: Round[]): number {
    const round = this.getRoundForOrder(currentOrder, challenges, rounds);
    if (round) return round.order_number;
    const maxOrder = challenges.reduce((max, c) => Math.max(max, c.order_number), 0);
    if (currentOrder > maxOrder && rounds.length > 0) {
      return rounds[rounds.length - 1]!.order_number;
    }
    return 1;
  }

  /**
   * Fetch a round's story fragment by round id
   */
  private async getRoundStoryFragment(roundId: string | null | undefined): Promise<StoryFragment | null> {
    if (!roundId) return null;
    const round = await this.challengeRepo.getRoundByIdentifier(roundId);
    return round?.story_fragment || null;
  }

  /**
   * When the next challenge is the first of a new round, return that round's
   * intro fragment (the moment a team "enters" the round)
   */
  private async getRoundEntryFragment(nextChallengeOrder: number, currentRoundId?: string | null): Promise<StoryFragment | null> {
    const nextChallenge = await this.challengeRepo.getPublicChallengeByIdentifier(nextChallengeOrder);
    if (!nextChallenge || !nextChallenge.round_id) return null;
    if (nextChallenge.round_id === currentRoundId) return null;
    const nextRound = await this.challengeRepo.getRoundByIdentifier(nextChallenge.round_id);
    return nextRound?.story_fragment || null;
  }

  /**
   * Get all active public challenges (without answer keys)
   * Optionally annotates is_locked status if team_name is provided
   */
  public async getPublicChallenges(team_name?: string, clientIp?: string): Promise<ChallengePublic[]> {
    const [challenges, rounds] = await Promise.all([
      this.challengeRepo.getPublicChallenges(),
      this.challengeRepo.getRounds(),
    ]);
    let currentOrder = 1;
    let progress: any = null;
    let currentRoundOrder = 1;
    let assignedSet: number | null = null;
    let teamHash = 0;

    if (team_name && team_name.trim()) {
      teamHash = this.hashTeamId(team_name.trim());
      const teamData = await db.teams.findByName(team_name.trim());
      if (teamData) {
        assignedSet = teamData.assigned_asset_set ?? null;
        // Auto-assign and save a permanent asset set if none exists
        if (assignedSet === null || assignedSet === undefined) {
          const firstWithSets = challenges.find(c => c.assets && c.assets.some(a => typeof a.asset_set === 'number'));
          if (firstWithSets) {
            const uniqueSets = Array.from(new Set(firstWithSets.assets.map((a: any) => a.asset_set).filter((s: any) => typeof s === 'number'))).sort((a: any, b: any) => a - b);
            if (uniqueSets.length > 0) {
              assignedSet = Number(uniqueSets[teamHash % uniqueSets.length]);
              await db.teams.updateAssignedAssetSet(teamData.id, assignedSet as number);
            }
          }
        }
      }

      progress = await this.challengeRepo.getTeamProgress(team_name.trim());
      if (!progress) {
        progress = await this.challengeRepo.upsertTeamProgress(team_name.trim(), 1, []);
      }
      currentOrder = progress?.current_challenge_order || 1;
      currentRoundOrder = this.getCurrentRoundOrder(currentOrder, challenges, rounds);

      // IP Tracking mismatch check
      if (isIpTrackingEnabled() && progress && progress.started_ip && clientIp && progress.started_ip !== clientIp) {
        throw new Error(`IP_MISMATCH:${progress.started_ip}`);
      }

      if (progress && isStartedAtPlaceholder(progress.challenge_started_at)) {
        const nowStr = new Date().toISOString();
        progress = await this.challengeRepo.updateStartedTimers(team_name.trim(), nowStr, clientIp, !progress.round_started_at || isStartedAtPlaceholder(progress.round_started_at));
      }
    }

    return challenges.map((item) => {
      const isLocked = item.order_number > currentOrder;
      if (isLocked) {
        return {
          id: item.id,
          round_id: item.round_id,
          round_name: item.round_name,
          round_order: item.round_order,
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

      const round = this.getRoundForChallenge(item, rounds);
      const roundFragment = round && round.order_number <= currentRoundOrder ? round.story_fragment : null;
      const { story_fragment: _storyFragment, ...rest } = item as any;

      // Attach original index and filter assets
      let finalAssets = rest.assets || [];
      if (team_name && team_name.trim()) {
        finalAssets = finalAssets.map((a: any, i: number) => ({ ...a, original_index: i }));
        finalAssets = this.filterAssetsBySet(finalAssets, assignedSet, teamHash);
      }

      const publicChallenge = {
        ...rest,
        assets: finalAssets,
        is_locked: false,
        time_limit: item.time_limit || 1800,
        hints: this.filterHints(item.hints, item.order_number === currentOrder && progress ? progress.challenge_started_at : undefined), // Service boundary visibility check
        story_fragment: roundFragment,
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
    let assignedSet: number | null = null;
    let teamHash = 0;

    if (team_name && team_name.trim()) {
      teamHash = this.hashTeamId(team_name.trim());
      const teamData = await db.teams.findByName(team_name.trim());
      if (teamData) {
        assignedSet = teamData.assigned_asset_set ?? null;
      }
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
      progress = await this.challengeRepo.updateStartedTimers(team_name.trim(), nowStr, clientIp, !progress.round_started_at || isStartedAtPlaceholder(progress.round_started_at));
    }
    if (isLocked) {
      return {
        id: challenge.id,
        round_id: challenge.round_id,
        round_name: challenge.round_name,
        round_order: challenge.round_order,
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

    const rounds = await this.challengeRepo.getRounds();
    const currentRoundOrder = this.getCurrentRoundOrder(currentOrder, [challenge], rounds);
    const round = this.getRoundForChallenge(challenge, rounds);
    const roundFragment = round && round.order_number <= currentRoundOrder ? round.story_fragment : null;
    const { story_fragment: _storyFragment, ...rest } = challenge as any;

    const challenge_started_at = challenge.order_number === currentOrder && progress ? progress.challenge_started_at : undefined;
    const startVal = (challenge.order_number === currentOrder && progress && progress.challenge_started_at && !isStartedAtPlaceholder(progress.challenge_started_at))
      ? progress.challenge_started_at
      : undefined;

    const publicChallenge = {
      ...rest,
      is_locked: false,
      time_limit: challenge.time_limit || 1800,
      hints: this.filterHints(challenge.hints, challenge.order_number === currentOrder && progress ? progress.challenge_started_at : undefined), // Service boundary visibility check
      story_fragment: roundFragment,
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
    // NOTE: This is no longer a short-circuit — the answer is still validated below,
    // so a wrong key (even for an already-solved challenge) still fails.
    const alreadyCompleted = existingProgress?.completed_challenges?.includes(challenge.order_number) || false;

    if (!alreadyCompleted && existingProgress && isStartedAtPlaceholder(existingProgress.challenge_started_at)) {
      const nowStr = new Date().toISOString();
      existingProgress = await this.challengeRepo.updateStartedTimers(team_name.trim(), nowStr, clientIp, !existingProgress.round_started_at || isStartedAtPlaceholder(existingProgress.round_started_at));
    }

    // Verify time limit/timeout (only for the challenge the team is currently on)
    if (!alreadyCompleted && existingProgress && existingProgress.challenge_started_at && !isStartedAtPlaceholder(existingProgress.challenge_started_at)) {
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

        const roundFragment = await this.getRoundEntryFragment(nextChallengeOrder, challenge.round_id);

        return {
          success: false,
          message: 'Time Limit Exceeded. You have been moved to the next challenge without points.',
          tryAgain: false,
          unlocked_next_challenge: currentOrder,
          story_fragment: roundFragment,
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
      let expectedHash = challenge.answer_key;

      if (expectedHash.startsWith('{') && expectedHash.endsWith('}')) {
         try {
             const parsed = JSON.parse(expectedHash);
             const teamData = await db.teams.findByName(team_name.trim());
             const assignedSet = teamData?.assigned_asset_set;
             
             const uniqueSets = Array.from(new Set((challenge.assets || []).map((a: any) => a.asset_set).filter((s: any) => typeof s === 'number'))).sort((a: any, b: any) => a - b);
             let targetSet = null;
             
             if (assignedSet !== null && assignedSet !== undefined && uniqueSets.includes(assignedSet)) {
                 targetSet = assignedSet;
             } else if (uniqueSets.length > 0) {
                 targetSet = uniqueSets[this.hashTeamId(team_name.trim()) % uniqueSets.length];
             }

             if (targetSet !== null && parsed[String(targetSet)]) {
                 expectedHash = parsed[String(targetSet)];
             } else if (parsed['global']) {
                 expectedHash = parsed['global'];
             }
         } catch (e) {
             // Fallback to treat it as string if parsing fails
         }
      }
  
      if (isBcryptHash(expectedHash)) {
        isCorrect = await bcrypt.compare(normalizedSubmitted, expectedHash);
      } else {
        isCorrect = normalizedSubmitted === expectedHash.trim().toLowerCase();
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

    // Already solved (validated above): report completed state without
    // advancing progress or touching the leaderboard (preserves tie-breaker rank).
    if (alreadyCompleted) {
      const roundFragment = await this.getRoundStoryFragment(challenge.round_id);
      return {
        success: true,
        message: 'You have already completed this challenge.',
        already_solved: true,
        unlocked_next_challenge: currentUnlockedOrder,
        story_fragment: roundFragment,
      };
    }

    // Correct Answer logic!
    const completedSet = new Set<number>(existingProgress?.completed_challenges || []);
    completedSet.add(challenge.order_number);

    const completedArray = Array.from(completedSet).sort((a, b) => a - b);
    const nextChallengeOrder = challenge.order_number + 1;
    const currentOrder = Math.max(currentUnlockedOrder, nextChallengeOrder);

    const allChallengesData = await this.challengeRepo.getAllChallengesAdmin();
    const totalPoints = allChallengesData
      .filter((c: any) => completedArray.includes(c.order_number))
      .reduce((sum: number, c: any) => sum + (c.points || 0), 0);

    // 1. Update Leaderboard FIRST (ensures team exists in leaderboard table satisfying FK)
    await this.leaderboardRepo.setScoreByName(
      team_name.trim(),
      totalPoints,
      new Date().toISOString()
    );

    // 2. Update Team Progress SECOND
    await this.challengeRepo.upsertTeamProgress(
      team_name.trim(),
      currentOrder,
      completedArray
    );

    const roundFragment = await this.getRoundEntryFragment(nextChallengeOrder, challenge.round_id);

    return {
      success: true,
      message: 'Correct answer! Next challenge unlocked automatically.',
      unlocked_next_challenge: nextChallengeOrder,
      story_fragment: roundFragment,
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
    const [allChallenges, rounds] = await Promise.all([
      this.challengeRepo.getPublicChallenges(),
      this.challengeRepo.getRounds(),
    ]);

    const currentOrder = progress?.current_challenge_order || 1;
    const currentRoundOrder = this.getCurrentRoundOrder(currentOrder, allChallenges, rounds);

    const unlockedFragments = rounds
      .filter((r) => r.order_number <= currentRoundOrder && r.story_fragment)
      .map((r) => ({
        round_order: r.order_number,
        round_name: r.name,
        story_fragment: r.story_fragment as StoryFragment,
      }));

    return {
      team_name: team_name.trim(),
      current_challenge_order: currentOrder,
      current_round_order: currentRoundOrder,
      completed_challenges: completedOrders,
      challenges_solved: completedOrders.length,
      unlocked_story_fragments: unlockedFragments,
    };
  }

  /**
   * Story Fragment Archive: Get all unlocked story fragments for a team
   */
  public async getUnlockedStoryFragments(team_name: string): Promise<Array<{
    round_order: number;
    round_name: string;
    story_fragment: StoryFragment;
  }>> {
    const progress = await this.getParticipantProgress(team_name);
    return progress.unlocked_story_fragments;
  }

  /**
   * Admin Progress Tracking (Visible to Admin Only - Section 7)
   */
  public async getAllTeamsProgressAdmin(): Promise<AdminTeamProgressSummary[]> {
    const [progressList, leaderboard, allChallenges, rounds] = await Promise.all([
      this.challengeRepo.getAllTeamsProgressAdmin(),
      this.leaderboardRepo.getLiveLeaderboard(),
      this.challengeRepo.getPublicChallenges(),
      this.challengeRepo.getRounds(),
    ]);
    const totalChallengesCount = allChallenges.length;
    const totalRoundsCount = rounds.length;

    const summaryMap = new Map<string, AdminTeamProgressSummary>();
    const leaderboardMap = new Map(leaderboard.map((item) => [item.team_name, item]));

    for (const prog of progressList) {
      const lbEntry = leaderboardMap.get(prog.team_name);
      const solvedCount = prog.completed_challenges.length;
      const roundOfTeam = this.getRoundForOrder(prog.current_challenge_order, allChallenges, rounds);
      const roundsEntered = roundOfTeam?.order_number ?? 1;

      summaryMap.set(prog.team_name, {
        team_name: prog.team_name,
        current_challenge_order: prog.current_challenge_order,
          current_round_order: roundsEntered,
        challenges_solved: solvedCount,
        completion_time: lbEntry?.completion_time || null,
        attempts_count: prog.attempts_count || 0,
        last_attempt_at: prog.last_attempt_at,
        story_progress: `${roundsEntered} / ${totalRoundsCount} rounds · ${solvedCount} / ${totalChallengesCount} challenges`,
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
          story_progress: `1 / ${totalRoundsCount} rounds · ${lb.challenges_completed || 0} / ${totalChallengesCount} challenges`,
          completed_challenges: [],
          current_round_order: 1,
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

    // If resetting to challenge 1 (full reset), wipe completed_challenges entirely.
    // Otherwise, build up the set by marking all challenges before target as done.
    let completedArray: number[];
    if (target_challenge_order === 1) {
      completedArray = [];
    } else {
      const completedSet = new Set<number>(existingProgress?.completed_challenges || []);
      for (let i = 1; i < target_challenge_order; i++) {
        completedSet.add(i);
      }
      completedArray = Array.from(completedSet).sort((a, b) => a - b);
    }

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

    const targetChallenge = await this.challengeRepo.getPublicChallengeByIdentifier(target_challenge_order);
    const targetFragment = targetChallenge ? await this.getRoundStoryFragment(targetChallenge.round_id) : null;

    return {
      success: true,
      message: `Admin override successful. Team '${team_name}' unlocked up to challenge ${target_challenge_order}.`,
      unlocked_next_challenge: target_challenge_order,
      story_fragment: targetFragment,
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
        const trimmed = dto.answer_key.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          try {
            const parsed = JSON.parse(trimmed);
            const hashedParsed: Record<string, string> = {};
            for (const key of Object.keys(parsed)) {
              hashedParsed[key] = isBcryptHash(parsed[key]) ? parsed[key] : parsed[key].trim().toLowerCase();
            }
            hashedDto.answer_key = JSON.stringify(hashedParsed);
          } catch (e) {
            hashedDto.answer_key = trimmed.toLowerCase();
          }
        } else {
          hashedDto.answer_key = trimmed.toLowerCase();
        }
      }
    return this.challengeRepo.createChallenge(hashedDto);
  }

  /**
   * Admin: Update challenge
   */
  public async updateChallenge(id: string, dto: UpdateChallengeDto): Promise<Challenge | null> {
    const hashedDto = { ...dto };
    if (dto.answer_key) {
        const trimmed = dto.answer_key.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          try {
            const parsed = JSON.parse(trimmed);
            const hashedParsed: Record<string, string> = {};
            for (const key of Object.keys(parsed)) {
              hashedParsed[key] = isBcryptHash(parsed[key]) ? parsed[key] : parsed[key].trim().toLowerCase();
            }
            hashedDto.answer_key = JSON.stringify(hashedParsed);
          } catch (e) {
            hashedDto.answer_key = trimmed.toLowerCase();
          }
        } else {
          hashedDto.answer_key = trimmed.toLowerCase();
        }
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
  public async addHintToChallenge(challengeId: string, hintText: string, isVisible: boolean, unlockMinutes?: number): Promise<ChallengeHint[]> {
    if (!hintText || !hintText.trim()) {
      throw new Error('Hint text is required');
    }
    return this.challengeRepo.addHintToChallenge(challengeId, hintText.trim(), isVisible, unlockMinutes);
  }

  /**
   * Admin: Edit a hint in a challenge
   */
  public async editHintInChallenge(challengeId: string, hintId: string, hintText: string, unlockMinutes?: number): Promise<ChallengeHint[]> {
    if (!hintText || !hintText.trim()) {
      throw new Error('Hint text is required');
    }
    return this.challengeRepo.editHintInChallenge(challengeId, hintId, hintText.trim(), unlockMinutes);
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
   * Set IP tracking enabled state (persisted to the database)
   */
  public async setIpTrackingEnabled(enabled: boolean): Promise<boolean> {
    return setIpTrackingEnabled(enabled);
  }

  /**
   * Toggle IP tracking state (persisted to the database)
   */
  public async toggleIpTracking(): Promise<boolean> {
    return toggleIpTracking();
  }

  /**
   * Participant: List rounds with per-team lock state.
   * A round's story fragment is only revealed once the team has ENTERED it
   * (i.e. the round's first challenge is unlocked).
   */
  public async getPublicRounds(team_name?: string): Promise<RoundPublic[]> {
    const [rounds, challenges] = await Promise.all([
      this.challengeRepo.getRounds(),
      this.challengeRepo.getPublicChallenges(),
    ]);

    let currentRoundOrder = 1;
    if (team_name && team_name.trim()) {
      const progress = await this.challengeRepo.getTeamProgress(team_name.trim());
      const currentOrder = progress?.current_challenge_order || 1;
      currentRoundOrder = this.getCurrentRoundOrder(currentOrder, challenges, rounds);
    }

    return rounds
      .filter((r) => r.is_active)
      .map((r) => {
        const isLocked = r.order_number > currentRoundOrder;
        return {
          id: r.id,
          name: r.name,
          order_number: r.order_number,
          story_fragment: isLocked ? null : r.story_fragment || null,
          time_limit: r.time_limit || 0,
          is_active: r.is_active,
          is_locked: isLocked,
          created_at: r.created_at,
          updated_at: r.updated_at,
        };
      });
  }

  /**
   * Admin: List all rounds (including inactive, with fragments)
   */
  public async getRoundsAdmin(): Promise<Round[]> {
    return this.challengeRepo.getRounds();
  }

  /**
   * Admin: Create a new round
   */
  public async createRound(dto: CreateRoundDto): Promise<Round> {
    return this.challengeRepo.createRound(dto);
  }

  /**
   * Admin: Update a round by UUID or order_number
   */
  public async updateRound(identifier: string, dto: UpdateRoundDto): Promise<Round | null> {
    return this.challengeRepo.updateRound(identifier, dto);
  }

  /**
   * Admin: Delete a round (blocked while challenges are assigned to it)
   */
  public async deleteRound(id: string): Promise<boolean> {
    return this.challengeRepo.deleteRound(id);
  }

  /**
   * Admin: Reorder rounds atomically
   */
  public async reorderRounds(orderedIds: string[]): Promise<Array<{ id: string; order_number: number }>> {
    return this.challengeRepo.reorderRounds(orderedIds);
  }
}

export const challengeService = new ChallengeService();
