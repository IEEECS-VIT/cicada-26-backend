import { supabase } from './supabaseClient.js';
import { supabaseLeaderboardRepository } from './supabaseLeaderboardRepository.js';
import { IChallengeRepository } from '../interfaces/challengeRepository.js';
import { v4 as uuidv4 } from 'uuid';
import {
  Challenge,
  ChallengePublic,
  TeamProgress,
  CreateChallengeDto,
  UpdateChallengeDto,
  ChallengeHint,
  ChallengeAsset,
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
      .select('id, order_number, name, story_context, assets, story_fragment, hints, time_limit, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('order_number', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch active challenges: ${error.message}`);
    }

    return (data || []).map((item) => {
      const allHints: ChallengeHint[] = typeof item.hints === 'string'
        ? JSON.parse(item.hints)
        : item.hints || [];
      const visibleHints = allHints.filter(h => h.is_visible);
      return {
        ...item,
        assets: typeof item.assets === 'string' ? JSON.parse(item.assets) : item.assets || [],
        story_fragment: typeof item.story_fragment === 'string' ? JSON.parse(item.story_fragment) : item.story_fragment || null,
        hints: visibleHints,
      };
    }) as ChallengePublic[];
  }

  /**
   * Fetch single active challenge for public by order_number or UUID (excluding answer_key)
   */
  public async getPublicChallengeByIdentifier(identifier: string | number): Promise<ChallengePublic | null> {
    let query = supabase
      .from('challenges')
      .select('id, order_number, name, story_context, assets, story_fragment, hints, time_limit, is_active, created_at, updated_at')
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

    const allHints: ChallengeHint[] = typeof data.hints === 'string'
      ? JSON.parse(data.hints)
      : data.hints || [];
    const visibleHints = allHints.filter(h => h.is_visible);

    return {
      ...data,
      assets: typeof data.assets === 'string' ? JSON.parse(data.assets) : data.assets || [],
      story_fragment: typeof data.story_fragment === 'string' ? JSON.parse(data.story_fragment) : data.story_fragment || null,
      hints: visibleHints,
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
      hints: typeof data.hints === 'string' ? JSON.parse(data.hints) : data.hints || [],
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
      hints: typeof item.hints === 'string' ? JSON.parse(item.hints) : item.hints || [],
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
      hints: dto.hints || [],
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
      hints: typeof data.hints === 'string' ? JSON.parse(data.hints) : data.hints || [],
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
      hints: typeof data.hints === 'string' ? JSON.parse(data.hints) : data.hints || [],
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
      challenge_started_at: existing?.challenge_started_at || '1970-01-01T00:00:00.000Z',
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
   * Update challenge_started_at for a team
   */
  public async updateChallengeStartedAt(team_name: string, started_at: string | null, clientIp?: string | null): Promise<TeamProgress> {
    const { data, error } = await supabase
      .from('team_progress')
      .update({ 
        challenge_started_at: started_at,
        started_ip: clientIp || null
      })
      .eq('team_name', team_name)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update challenge started at for '${team_name}': ${error.message}`);
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

    const isNewChallenge = !existing || existing.current_challenge_order !== current_challenge_order;
    const challenge_started_at = isNewChallenge ? '1970-01-01T00:00:00.000Z' : (existing?.challenge_started_at || '1970-01-01T00:00:00.000Z');
    const started_ip = isNewChallenge ? null : (existing?.started_ip || null);

    const payload = {
      team_name,
      current_challenge_order,
      completed_challenges,
      attempts_count: attempts_count !== undefined ? attempts_count : (existing?.attempts_count || 0),
      last_attempt_at: now,
      challenge_started_at,
      started_ip,
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
      challenge_started_at: '1970-01-01T00:00:00.000Z',
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

  /**
   * Add a hint to a challenge
   */
  public async addHintToChallenge(challengeId: string, hintText: string, isVisible: boolean): Promise<ChallengeHint[]> {
    const challenge = await this.getChallengeWithAnswerKey(challengeId);
    if (!challenge) {
      throw new Error(`Challenge '${challengeId}' not found`);
    }

    const hints = challenge.hints || [];
    const newHint: ChallengeHint = {
      id: uuidv4(),
      text: hintText,
      is_visible: isVisible,
    };
    hints.push(newHint);

    const { error } = await supabase
      .from('challenges')
      .update({ hints })
      .eq('id', challenge.id);

    if (error) {
      throw new Error(`Failed to add hint: ${error.message}`);
    }

    return hints;
  }

  /**
   * Edit a hint in a challenge
   */
  public async editHintInChallenge(challengeId: string, hintId: string, hintText: string): Promise<ChallengeHint[]> {
    const challenge = await this.getChallengeWithAnswerKey(challengeId);
    if (!challenge) {
      throw new Error(`Challenge '${challengeId}' not found`);
    }

    const hints = challenge.hints || [];
    const hint = hints.find((h) => h.id === hintId);
    if (!hint) {
      throw new Error(`Hint '${hintId}' not found in challenge '${challengeId}'`);
    }

    hint.text = hintText;

    const { error } = await supabase
      .from('challenges')
      .update({ hints })
      .eq('id', challenge.id);

    if (error) {
      throw new Error(`Failed to update hint: ${error.message}`);
    }

    return hints;
  }

  /**
   * Delete a hint from a challenge
   */
  public async deleteHintFromChallenge(challengeId: string, hintId: string): Promise<ChallengeHint[]> {
    const challenge = await this.getChallengeWithAnswerKey(challengeId);
    if (!challenge) {
      throw new Error(`Challenge '${challengeId}' not found`);
    }

    const hints = challenge.hints || [];
    const updatedHints = hints.filter((h) => h.id !== hintId);

    if (hints.length === updatedHints.length) {
      throw new Error(`Hint '${hintId}' not found in challenge '${challengeId}'`);
    }

    const { error } = await supabase
      .from('challenges')
      .update({ hints: updatedHints })
      .eq('id', challenge.id);

    if (error) {
      throw new Error(`Failed to delete hint: ${error.message}`);
    }

    return updatedHints;
  }

  /**
   * Toggle hint visibility
   */
  public async toggleHintVisibility(challengeId: string, hintId: string): Promise<ChallengeHint[]> {
    const challenge = await this.getChallengeWithAnswerKey(challengeId);
    if (!challenge) {
      throw new Error(`Challenge '${challengeId}' not found`);
    }

    const hints = challenge.hints || [];
    const hint = hints.find((h) => h.id === hintId);
    if (!hint) {
      throw new Error(`Hint '${hintId}' not found in challenge '${challengeId}'`);
    }

    hint.is_visible = !hint.is_visible;

    const { error } = await supabase
      .from('challenges')
      .update({ hints })
      .eq('id', challenge.id);

    if (error) {
      throw new Error(`Failed to toggle hint visibility: ${error.message}`);
    }

    return hints;
  }

  /**
   * Add an asset to a challenge
   */
  public async addAssetToChallenge(challengeId: string, asset: Omit<ChallengeAsset, 'id'> & { id?: string }): Promise<ChallengeAsset[]> {
    const challenge = await this.getChallengeWithAnswerKey(challengeId);
    if (!challenge) {
      throw new Error(`Challenge '${challengeId}' not found`);
    }

    const assets = challenge.assets || [];
    const newAsset: ChallengeAsset = {
      ...asset,
      id: asset.id || uuidv4(),
    };
    assets.push(newAsset);

    const { error } = await supabase
      .from('challenges')
      .update({ assets })
      .eq('id', challenge.id);

    if (error) {
      throw new Error(`Failed to add asset: ${error.message}`);
    }

    return assets;
  }

  /**
   * Edit/Replace an asset in a challenge
   */
  public async editAssetInChallenge(challengeId: string, assetId: string, updatedAsset: Partial<ChallengeAsset>): Promise<ChallengeAsset[]> {
    const challenge = await this.getChallengeWithAnswerKey(challengeId);
    if (!challenge) {
      throw new Error(`Challenge '${challengeId}' not found`);
    }

    const assets = challenge.assets || [];
    
    // Find asset by id, name, or index fallback
    let assetIndex = assets.findIndex((a) => a.id === assetId);
    if (assetIndex === -1) {
      assetIndex = assets.findIndex((a) => a.name && a.name.toLowerCase() === assetId.toLowerCase());
    }
    if (assetIndex === -1 && /^\d+$/.test(assetId)) {
      const idx = parseInt(assetId, 10);
      if (idx >= 0 && idx < assets.length) {
        assetIndex = idx;
      }
    }

    if (assetIndex === -1) {
      throw new Error(`Asset '${assetId}' not found in challenge '${challengeId}'`);
    }

    // Merge properties (preserving id if already set, or generating one)
    const existingAsset = assets[assetIndex];
    if (!existingAsset) {
      throw new Error(`Asset '${assetId}' not found at index ${assetIndex}`);
    }

    assets[assetIndex] = {
      ...existingAsset,
      ...updatedAsset,
      id: existingAsset.id || uuidv4(),
    } as ChallengeAsset;

    const { error } = await supabase
      .from('challenges')
      .update({ assets })
      .eq('id', challenge.id);

    if (error) {
      throw new Error(`Failed to update asset: ${error.message}`);
    }

    return assets;
  }

  /**
   * Delete an asset from a challenge
   */
  public async deleteAssetFromChallenge(challengeId: string, assetId: string): Promise<ChallengeAsset[]> {
    const challenge = await this.getChallengeWithAnswerKey(challengeId);
    if (!challenge) {
      throw new Error(`Challenge '${challengeId}' not found`);
    }

    const assets = challenge.assets || [];
    
    // Find asset by id, name, or index fallback to remove
    let assetIndex = assets.findIndex((a) => a.id === assetId);
    if (assetIndex === -1) {
      assetIndex = assets.findIndex((a) => a.name && a.name.toLowerCase() === assetId.toLowerCase());
    }
    if (assetIndex === -1 && /^\d+$/.test(assetId)) {
      const idx = parseInt(assetId, 10);
      if (idx >= 0 && idx < assets.length) {
        assetIndex = idx;
      }
    }

    if (assetIndex === -1) {
      throw new Error(`Asset '${assetId}' not found in challenge '${challengeId}'`);
    }

    const updatedAssets = assets.filter((_, idx) => idx !== assetIndex);

    const { error } = await supabase
      .from('challenges')
      .update({ assets: updatedAssets })
      .eq('id', challenge.id);

    if (error) {
      throw new Error(`Failed to delete asset: ${error.message}`);
    }

    return updatedAssets;
  }
}

export const supabaseChallengeRepository = new SupabaseChallengeRepository();
