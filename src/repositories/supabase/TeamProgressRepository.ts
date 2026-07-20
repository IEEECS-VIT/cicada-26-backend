import { SupabaseClient } from '@supabase/supabase-js';
import { ITeamProgressRepository, TeamProgress } from '../interfaces';

export class SupabaseTeamProgressRepository implements ITeamProgressRepository {
  private supabase: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.supabase = client;
  }

  async findByTeamId(teamId: string): Promise<TeamProgress | null> {
    const { data, error } = await this.supabase
      .from('team_progress')
      .select('*')
      .eq('team_id', teamId)
      .single();
    if (error || !data) return null;
    return data as TeamProgress;
  }

  async initializeProgress(teamId: string, firstChallengeId: string): Promise<void> {
    const { error } = await this.supabase
      .from('team_progress')
      .insert([{
        team_id: teamId,
        current_challenge_id: firstChallengeId,
        opened_at: new Date().toISOString()
      }]);
    if (error) throw new Error(error.message);
  }

  async recordAttempt(teamId: string, isCorrect: boolean, deltaSeconds: number = 0, nextChallengeId?: string): Promise<void> {
    const progress = await this.findByTeamId(teamId);
    if (!progress) throw new Error('Progress record not found for team.');

    let updates: any = {
      updated_at: new Date().toISOString(),
      current_challenge_attempts: progress.current_challenge_attempts + 1
    };

    if (isCorrect) {
      updates.challenges_completed = progress.challenges_completed + 1;
      updates.total_time_taken = progress.total_time_taken + deltaSeconds;
      updates.current_challenge_attempts = 0;
      updates.completed_at = new Date().toISOString();
      
      if (nextChallengeId) {
        updates.current_challenge_id = nextChallengeId;
        updates.opened_at = new Date().toISOString(); // Reset for next challenge
        updates.completed_at = null; 
      }
    }

    const { error } = await this.supabase
      .from('team_progress')
      .update(updates)
      .eq('team_id', teamId);
      
    if (error) throw new Error(error.message);
  }
}
