import { SupabaseClient } from '@supabase/supabase-js';
import { IUserRepository, User } from '../../repositories/interfaces.js';

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

  async seedUser(id: string, email: string, display_name: string | null, register_no: string | null, role: 'participant' | 'admin' | 'GOD'): Promise<void> {
    const payload: any = { id, email, display_name, register_no, role };
    const { error } = await this.supabase
      .from('users')
      .insert([payload]);
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

  async updateRole(id: string, role: 'participant' | 'admin' | 'GOD'): Promise<void> {
    const { error } = await this.supabase
      .from('users')
      .update({ role })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  async approveAdmin(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('users')
      .update({ role: 'admin' })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  async countUsers(): Promise<number> {
    const { count, error } = await this.supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    if (error) return 0;
    return count || 0;
  }

  async listAllUsers(): Promise<User[]> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*, teams(name)')
      .order('created_at', { ascending: false });

    if (error) return [];
    return data as any[];
  }

  async findByTeamId(teamId: string): Promise<User[]> {
    const { data, error } = await this.supabase
      .from('users')
      .select('id, display_name, email, register_no')
      .eq('team_id', teamId);
      
    if (error) return [];
    return data as any[];
  }

  async deleteUser(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('users')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  }
}
