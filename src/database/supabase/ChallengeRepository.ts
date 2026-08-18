import { SupabaseClient } from '@supabase/supabase-js';
import { IChallengeRepository, Challenge } from '../../repositories/interfaces.js';

export class SupabaseChallengeRepository implements IChallengeRepository {
  private supabase: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.supabase = client;
  }

  async findById(id: string): Promise<Challenge | null> {
    const { data, error } = await this.supabase
      .from('challenges')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return null;
    return data as Challenge;
  }

  async findBySequence(sequence: number): Promise<Challenge | null> {
    const { data, error } = await this.supabase
      .from('challenges')
      .select('*')
      .eq('unlock_sequence', sequence)
      .single();
    if (error || !data) return null;
    return data as Challenge;
  }
}
