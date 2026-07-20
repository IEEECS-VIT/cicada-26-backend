import { SupabaseClient } from '@supabase/supabase-js';
import { IUserRepository, User } from '../interfaces';

export class SupabaseUserRepository implements IUserRepository {
  private supabase: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.supabase = client;
  }

  async findById(id: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) return null;
    return data as User;
  }

  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
      
    if (error || !data) return null;
    return data as User;
  }

  async seedUser(id: string, email: string, display_name: string | null, register_no: string | null, role: 'participant' | 'admin'): Promise<void> {
    const { error } = await this.supabase
      .from('users')
      .insert([{ id, email, display_name, register_no, role }]);
    if (error) throw new Error(error.message);
  }

  async updateDisplayName(id: string, displayName: string): Promise<void> {
    const { error } = await this.supabase
      .from('users')
      .update({ display_name: displayName })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  async updateTeam(id: string, teamId: string | null): Promise<void> {
    const { error } = await this.supabase
      .from('users')
      .update({ 
        team_id: teamId, 
        joined_team_at: teamId ? new Date().toISOString() : null 
      })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }
}
