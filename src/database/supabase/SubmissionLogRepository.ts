import { SupabaseClient } from '@supabase/supabase-js';
import { ISubmissionLogRepository } from '../../repositories/interfaces.js';

export class SupabaseSubmissionLogRepository implements ISubmissionLogRepository {
  private supabase: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.supabase = client;
  }

  async logSubmission(teamId: string | null, userId: string | null, challengeId: string | null, submittedAnswer: string, isCorrect: boolean): Promise<void> {
    try {
      await this.supabase
        .from('submission_logs')
        .insert([{
          team_id: teamId,
          user_id: userId,
          challenge_id: challengeId,
          submitted_answer: submittedAnswer,
          is_correct: isCorrect
        }]);
    } catch {
      // Ignore if table does not exist in dev
    }
  }

  async getLogs(team_id?: string, is_correct?: boolean, limit: number = 100): Promise<any[]> {
    try {
      let query = this.supabase
        .from('submission_logs')
        .select('*')
        .order('submitted_at', { ascending: false })
        .limit(limit);

      if (team_id) {
        query = query.eq('team_id', team_id);
      }
      if (is_correct !== undefined) {
        query = query.eq('is_correct', is_correct);
      }

      const { data, error } = await query;
      if (error) return [];
      return data || [];
    } catch {
      return [];
    }
  }
}
