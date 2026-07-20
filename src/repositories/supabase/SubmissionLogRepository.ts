import { SupabaseClient } from '@supabase/supabase-js';
import { ISubmissionLogRepository } from '../interfaces';

export class SupabaseSubmissionLogRepository implements ISubmissionLogRepository {
  private supabase: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.supabase = client;
  }

  async logSubmission(teamId: string | null, userId: string | null, challengeId: string | null, submittedAnswer: string, isCorrect: boolean): Promise<void> {
    const { error } = await this.supabase
      .from('submission_logs')
      .insert([{
        team_id: teamId,
        user_id: userId,
        challenge_id: challengeId,
        submitted_answer: submittedAnswer,
        is_correct: isCorrect
      }]);
      
    if (error) throw new Error(error.message);
  }
}
