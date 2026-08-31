import { SupabaseClient } from '@supabase/supabase-js';
import { Round, CreateRoundDto, UpdateRoundDto } from '../../types/round';

export class SupabaseRoundRepository {
  constructor(private supabase: SupabaseClient) {}

  async createRound(dto: CreateRoundDto): Promise<Round> {
    const { data, error } = await this.supabase
      .from('rounds')
      .insert([
        {
          name: dto.name,
          order_number: dto.order_number,
          story_fragment: dto.story_fragment || null,
          is_active: dto.is_active ?? true,
        },
      ])
      .select()
      .single();

    if (error) throw new Error(`Failed to create round: ${error.message}`);
    return data;
  }

  async getRounds(): Promise<Round[]> {
    const { data, error } = await this.supabase
      .from('rounds')
      .select('*')
      .order('order_number', { ascending: true });

    if (error) throw new Error(`Failed to fetch rounds: ${error.message}`);
    return data || [];
  }

  async updateRound(id: string, dto: UpdateRoundDto): Promise<Round> {
    const { data, error } = await this.supabase
      .from('rounds')
      .update(dto)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update round: ${error.message}`);
    return data;
  }

  async deleteRound(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('rounds')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete round: ${error.message}`);
  }
}

import { supabase } from './supabaseClient.js';
export const supabaseRoundRepository = new SupabaseRoundRepository(supabase);
