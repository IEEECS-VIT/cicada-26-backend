import { Response } from 'express';
import { supabase } from './supabaseClient.js';
import { ILeaderboardRepository } from '../interfaces/leaderboardRepository.js';
import { LeaderboardEntry, UpdateScoreDto } from '../../types/leaderboard.js';

export class SupabaseLeaderboardRepository implements ILeaderboardRepository {
  private sseClients: Response[] = [];
  private isSubscribedToRealtime = false;

  /**
   * Initialize Realtime subscription to Supabase leaderboard table changes.
   */
  private initRealtimeSubscription(): void {
    if (this.isSubscribedToRealtime) return;

    supabase
      .channel('leaderboard-realtime-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leaderboard' },
        async () => {
          console.log('[Realtime] Supabase database change detected. Broadcasting to live clients...');
          const updatedLeaderboard = await this.getLiveLeaderboard();
          this.broadcastStream(updatedLeaderboard);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Subscribed to live Supabase leaderboard changes.');
          this.isSubscribedToRealtime = true;
        }
      });
  }

  /**
   * Register an SSE client for live streaming updates.
   */
  public registerSseClient(res: Response): void {
    this.sseClients.push(res);
    this.initRealtimeSubscription();

    this.getLiveLeaderboard()
      .then((leaderboard) => {
        res.write(`data: ${JSON.stringify({ event: 'initial', leaderboard })}\n\n`);
      })
      .catch((err) => {
        console.error('[SSE Initial Error]', err);
      });
  }

  /**
   * Unregister an SSE client when connection closes.
   */
  public unregisterSseClient(res: Response): void {
    this.sseClients = this.sseClients.filter((client) => client !== res);
  }

  /**
   * Broadcast updated leaderboard to all connected SSE clients instantly.
   */
  public broadcastStream(leaderboard: LeaderboardEntry[]): void {
    const dataString = `data: ${JSON.stringify({ event: 'update', leaderboard })}\n\n`;
    this.sseClients.forEach((client) => {
      client.write(dataString);
    });
  }

  /**
   * Fetch the live leaderboard from Supabase.
   * Sorted based on:
   * 1. Challenges Solved (Descending)
   * 2. Time Taken / Completion Time (Ascending)
   */
  public async getLiveLeaderboard(): Promise<LeaderboardEntry[]> {
    const { data: viewData, error: viewError } = await supabase
      .from('live_leaderboard')
      .select('*');

    if (!viewError && viewData) {
      return viewData as LeaderboardEntry[];
    }

    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('challenges_completed', { ascending: false })
      .order('completion_time', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch leaderboard from Supabase: ${error.message}`);
    }

    return (data || []).map((item, index) => ({
      rank: index + 1,
      id: item.id,
      team_name: item.team_name,
      challenges_completed: item.challenges_completed,
      completion_time: item.completion_time,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));
  }

  /**
   * Manually set ANY score for ANY team (by team name) in Supabase.
   */
  public async setScoreByName(
    team_name: string,
    challenges_completed: number,
    completion_time?: string
  ): Promise<LeaderboardEntry> {
    const payload = {
      team_name,
      challenges_completed,
      completion_time: completion_time || new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('leaderboard')
      .upsert(payload, { onConflict: 'team_name' })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to set score in Supabase for team '${team_name}': ${error.message}`);
    }

    const leaderboard = await this.getLiveLeaderboard();
    this.broadcastStream(leaderboard);

    const entry = leaderboard.find((item) => item.team_name === team_name);
    return entry || {
      rank: 0,
      id: data.id,
      team_name: data.team_name,
      challenges_completed: data.challenges_completed,
      completion_time: data.completion_time,
    };
  }

  /**
   * Adjust score delta by team name or ID in Supabase.
   */
  public async adjustScore(identifier: string, delta: number): Promise<LeaderboardEntry | null> {
    let query = supabase.from('leaderboard').select('*');
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(identifier);

    if (isUuid) {
      query = query.eq('id', identifier);
    } else {
      query = query.eq('team_name', identifier);
    }

    const { data: existing, error: fetchErr } = await query.single();

    if (fetchErr || !existing) {
      throw new Error(`Team entry '${identifier}' not found in Supabase`);
    }

    const newScore = Math.max(0, (existing.challenges_completed || 0) + delta);
    const newTime = new Date().toISOString();

    return this.updateScore(existing.id, {
      challenges_completed: newScore,
      completion_time: newTime,
    });
  }

  /**
   * Update an existing team entry by ID in Supabase.
   */
  public async updateScore(id: string, dto: UpdateScoreDto): Promise<LeaderboardEntry | null> {
    const { data, error } = await supabase
      .from('leaderboard')
      .update(dto)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update score in Supabase: ${error.message}`);
    }

    if (!data) return null;

    const leaderboard = await this.getLiveLeaderboard();
    this.broadcastStream(leaderboard);

    return leaderboard.find((item) => item.id === id) || null;
  }

  /**
   * Delete a team entry from Supabase.
   */
  public async deleteTeam(identifier: string): Promise<boolean> {
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(identifier);

    let query = supabase.from('leaderboard').delete();
    if (isUuid) {
      query = query.eq('id', identifier);
    } else {
      query = query.eq('team_name', identifier);
    }

    const { error } = await query;

    if (error) {
      throw new Error(`Failed to delete entry from Supabase: ${error.message}`);
    }

    const leaderboard = await this.getLiveLeaderboard();
    this.broadcastStream(leaderboard);

    return true;
  }

  /**
   * Reset all leaderboard entries in Supabase.
   */
  public async resetLeaderboard(): Promise<boolean> {
    const { error } = await supabase
      .from('leaderboard')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      throw new Error(`Failed to reset leaderboard in Supabase: ${error.message}`);
    }

    this.broadcastStream([]);
    return true;
  }
}

export const supabaseLeaderboardRepository = new SupabaseLeaderboardRepository();
