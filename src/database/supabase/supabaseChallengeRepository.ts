import { supabase } from './supabaseClient.js';
import { supabaseLeaderboardRepository } from './supabaseLeaderboardRepository.js';
import { IChallengeRepository } from '../interfaces/challengeRepository.js';
import {
  Challenge,
  ChallengePublic,
  TeamProgress,
  CreateChallengeDto,
  UpdateChallengeDto,
} from '../../types/challenge.js';

export class SupabaseChallengeRepository implements IChallengeRepository {
  /**
   * Helper to determine if identifier is UUID
   */
  private isUuid(val: string | number): boolean {
    if (typeof val === 'number') return false;
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val);
  }

  /**
   * Helper to ensure team exists in public.leaderboard table to satisfy foreign key constraints
   */
  private async ensureTeamInLeaderboard(team_name: string, initial_score: number = 0): Promise<void> {
    const { data: existing } = await supabase
      .from('leaderboard')
      .select('team_name')
      .eq('team_name', team_name)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase
        .from('leaderboard')
        .insert({
          team_name,
          challenges_completed: initial_score,
          completion_time: new Date().toISOString(),
        });

      if (error && !error.message.includes('duplicate key') && !error.message.includes('already exists')) {
        console.warn(`[Leaderboard Init Warning] Could not auto-insert team '${team_name}': ${error.message}`);
      }
    }
  }

  /**
   * Fetch all active challenges for public (excluding answer_key)
   */
  public async getPublicChallenges(): Promise<ChallengePublic[]> {
    const { data, error } = await supabase
      .from('challenges')
      .select('id, order_number, name, story_context, assets, story_fragment, time_limit, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('order_number', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch active challenges: ${error.message}`);
    }

    return (data || []).map((item) => ({
      ...item,
      assets: typeof item.assets === 'string' ? JSON.parse(item.assets) : item.assets || [],
      story_fragment: typeof item.story_fragment === 'string' ? JSON.parse(item.story_fragment) : item.story_fragment || null,
    })) as ChallengePublic[];
  }

  /**
   * Fetch single active challenge for public by order_number or UUID (excluding answer_key)
   */
  public async getPublicChallengeByIdentifier(identifier: string | number): Promise<ChallengePublic | null> {
    let query = supabase
      .from('challenges')
      .select('id, order_number, name, story_context, assets, story_fragment, time_limit, is_active, created_at, updated_at')
      .eq('is_active', true);

    if (this.isUuid(identifier)) {
      query = query.eq('id', identifier);
    } else {
      const orderNum = typeof identifier === 'number' ? identifier : parseInt(identifier, 10);
      if (isNaN(orderNum)) {
        return null;
      }
      query = query.eq('order_number', orderNum);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch challenge '${identifier}': ${error.message}`);
    }

    if (!data) return null;

    return {
      ...data,
      assets: typeof data.assets === 'string' ? JSON.parse(data.assets) : data.assets || [],
      story_fragment: typeof data.story_fragment === 'string' ? JSON.parse(data.story_fragment) : data.story_fragment || null,
    } as ChallengePublic;
  }

  /**
   * Fetch single challenge including answer_key for verification
   */
  public async getChallengeWithAnswerKey(identifier: string | number): Promise<Challenge | null> {
    let query = supabase.from('challenges').select('*');

    if (this.isUuid(identifier)) {
      query = query.eq('id', identifier);
    } else {
      const orderNum = typeof identifier === 'number' ? identifier : parseInt(identifier, 10);
      if (isNaN(orderNum)) {
        return null;
      }
      query = query.eq('order_number', orderNum);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch challenge for verification '${identifier}': ${error.message}`);
    }

    if (!data) return null;

    return {
      ...data,
      assets: typeof data.assets === 'string' ? JSON.parse(data.assets) : data.assets || [],
      story_fragment: typeof data.story_fragment === 'string' ? JSON.parse(data.story_fragment) : data.story_fragment || null,
    } as Challenge;
  }

  /**
   * Fetch all challenges for admin (including answer keys)
   */
  public async getAllChallengesAdmin(): Promise<Challenge[]> {
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .order('order_number', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch all challenges for admin: ${error.message}`);
    }

    return (data || []).map((item) => ({
      ...item,
      assets: typeof item.assets === 'string' ? JSON.parse(item.assets) : item.assets || [],
      story_fragment: typeof item.story_fragment === 'string' ? JSON.parse(item.story_fragment) : item.story_fragment || null,
    })) as Challenge[];
  }

  /**
   * Create a new challenge (Admin)
   */
  public async createChallenge(dto: CreateChallengeDto): Promise<Challenge> {
    const payload = {
      order_number: dto.order_number,
      name: dto.name,
      story_context: dto.story_context || '',
      assets: dto.assets || [],
      story_fragment: dto.story_fragment || {},
      answer_key: dto.answer_key,
      time_limit: dto.time_limit !== undefined ? dto.time_limit : 1800,
      is_active: dto.is_active !== undefined ? dto.is_active : true,
    };

    const { data, error } = await supabase
      .from('challenges')
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create challenge: ${error.message}`);
    }

    return {
      ...data,
      assets: typeof data.assets === 'string' ? JSON.parse(data.assets) : data.assets || [],
      story_fragment: typeof data.story_fragment === 'string' ? JSON.parse(data.story_fragment) : data.story_fragment || null,
    } as Challenge;
  }

  /**
   * Update challenge (Admin)
   */
  public async updateChallenge(identifier: string, dto: UpdateChallengeDto): Promise<Challenge | null> {
    let query = supabase.from('challenges').update(dto);

    if (this.isUuid(identifier)) {
      query = query.eq('id', identifier);
    } else {
      const orderNum = parseInt(identifier, 10);
      if (isNaN(orderNum)) {
        return null;
      }
      query = query.eq('order_number', orderNum);
    }

    const { data, error } = await query.select().maybeSingle();

    if (error) {
      throw new Error(`Failed to update challenge '${identifier}': ${error.message}`);
    }

    if (!data) return null;

    return {
      ...data,
      assets: typeof data.assets === 'string' ? JSON.parse(data.assets) : data.assets || [],
      story_fragment: typeof data.story_fragment === 'string' ? JSON.parse(data.story_fragment) : data.story_fragment || null,
    } as Challenge;
  }

  /**
   * Delete challenge (Admin)
   */
  public async deleteChallenge(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('challenges')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete challenge: ${error.message}`);
    }

    return true;
  }

  /**
   * Fetch progress for a team
   */
  public async getTeamProgress(team_name: string): Promise<TeamProgress | null> {
    const { data, error } = await supabase
      .from('team_progress')
      .select('*')
      .eq('team_name', team_name)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch team progress for '${team_name}': ${error.message}`);
    }

    if (!data) return null;

    return {
      ...data,
      completed_challenges: typeof data.completed_challenges === 'string' 
        ? JSON.parse(data.completed_challenges) 
        : data.completed_challenges || [],
      attempts_count: data.attempts_count || 0,
      last_attempt_at: data.last_attempt_at || data.updated_at || data.created_at,
      challenge_started_at: data.challenge_started_at,
    } as TeamProgress;
  }

  /**
   * Record an attempt for a team (increments attempt_count & sets last_attempt_at)
   */
  public async recordAttempt(team_name: string): Promise<TeamProgress> {
    // Ensure team exists in public.leaderboard table first (satisfies foreign key constraint)
    await this.ensureTeamInLeaderboard(team_name, 0);

    const existing = await this.getTeamProgress(team_name);
    const newCount = (existing?.attempts_count || 0) + 1;
    const now = new Date().toISOString();

    const payload = {
      team_name,
      current_challenge_order: existing?.current_challenge_order || 1,
      completed_challenges: existing?.completed_challenges || [],
      attempts_count: newCount,
      last_attempt_at: now,
      challenge_started_at: existing?.challenge_started_at || now,
    };

    const { data, error } = await supabase
      .from('team_progress')
      .upsert(payload, { onConflict: 'team_name' })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record attempt for '${team_name}': ${error.message}`);
    }

    return {
      ...data,
      completed_challenges: typeof data.completed_challenges === 'string' 
        ? JSON.parse(data.completed_challenges) 
        : data.completed_challenges || [],
    } as TeamProgress;
  }

  /**
   * Upsert progress for a team
   */
  public async upsertTeamProgress(
    team_name: string,
    current_challenge_order: number,
    completed_challenges: number[],
    attempts_count?: number
  ): Promise<TeamProgress> {
    // Ensure team exists in public.leaderboard table first (satisfies foreign key constraint)
    await this.ensureTeamInLeaderboard(team_name, completed_challenges.length);

    const existing = await this.getTeamProgress(team_name);
    const now = new Date().toISOString();

    const payload = {
      team_name,
      current_challenge_order,
      completed_challenges,
      attempts_count: attempts_count !== undefined ? attempts_count : (existing?.attempts_count || 0),
      last_attempt_at: now,
      challenge_started_at: (existing && existing.current_challenge_order === current_challenge_order) 
        ? existing.challenge_started_at 
        : now,
    };

    const { data, error } = await supabase
      .from('team_progress')
      .upsert(payload, { onConflict: 'team_name' })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update team progress for '${team_name}': ${error.message}`);
    }

    return {
      ...data,
      completed_challenges: typeof data.completed_challenges === 'string' 
        ? JSON.parse(data.completed_challenges) 
        : data.completed_challenges || [],
    } as TeamProgress;
  }

  /**
   * Fetch progress for all teams (Admin Progress Tracking)
   */
  public async getAllTeamsProgressAdmin(): Promise<TeamProgress[]> {
    const { data, error } = await supabase
      .from('team_progress')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch admin team progress list: ${error.message}`);
    }

    return (data || []).map((item) => ({
      ...item,
      completed_challenges: typeof item.completed_challenges === 'string'
        ? JSON.parse(item.completed_challenges)
        : item.completed_challenges || [],
      attempts_count: item.attempts_count || 0,
      last_attempt_at: item.last_attempt_at || item.updated_at || item.created_at,
    })) as TeamProgress[];
  }
  /**
   * Admin: Reset a team's progress back to challenge 1
   */
  public async resetTeamProgress(team_name: string): Promise<TeamProgress> {
    await this.ensureTeamInLeaderboard(team_name, 0);

    const now = new Date().toISOString();
    const payload = {
      team_name,
      current_challenge_order: 1,
      completed_challenges: [],
      attempts_count: 0,
      last_attempt_at: now,
      challenge_started_at: now,
    };

    const { data, error } = await supabase
      .from('team_progress')
      .upsert(payload, { onConflict: 'team_name' })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to reset team progress for '${team_name}': ${error.message}`);
    }

    await supabaseLeaderboardRepository.setScoreByName(team_name, 0, now);

    return {
      ...data,
      completed_challenges: [],
      attempts_count: 0,
    } as TeamProgress;
  }

  public async getSubmissionLogs(limit: number = 100, team_name?: string): Promise<any[]> {
    try {
      let query = supabase
        .from('submission_logs')
        .select('*')
        .order('submitted_at', { ascending: false })
        .limit(limit);

      if (team_name) {
        query = query.eq('team_id', team_name);
      }

      const { data, error } = await query;
      if (error) return [];
      return data || [];
    } catch {
      return [];
    }
  }
}

export const supabaseChallengeRepository = new SupabaseChallengeRepository();
