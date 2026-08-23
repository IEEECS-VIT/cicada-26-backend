import { SupabaseClient } from '@supabase/supabase-js';
import { ITeamRepository, Team } from '../../repositories/interfaces.js';

export class SupabaseTeamRepository implements ITeamRepository {
  private supabase: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.supabase = client;
  }

  async findById(id: string): Promise<Team | null> {
    const { data, error } = await this.supabase
      .from('teams')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return null;
    return data as Team;
  }

  async findByName(name: string): Promise<Team | null> {
    const { data, error } = await this.supabase
      .from('teams')
      .select('*')
      .eq('name', name)
      .single();
    if (error || !data) return null;
    return data as Team;
  }

  async findByInviteCode(inviteCode: string): Promise<Team | null> {
    const { data, error } = await this.supabase
      .from('teams')
      .select('*')
      .eq('invite_code', inviteCode)
      .single();
    if (error || !data) return null;
    return data as Team;
  }

  async countMembers(teamId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId);
    if (error) throw new Error(error.message);
    return count || 0;
  }

  async createTeamAndJoin(userId: string, teamName: string, inviteCode: string, teamId: string): Promise<void> {
    // Phase 1: Create the Team
    const { error: teamError } = await this.supabase
      .from('teams')
      .insert([{ id: teamId, name: teamName, leader_id: userId, invite_code: inviteCode }]);
    
    if (teamError) {
      if (teamError.code === '23505') throw new Error('Team name or invite code already exists.');
      throw new Error(teamError.message);
    }

    // Phase 2: Update the User
    const { error: userError } = await this.supabase
      .from('users')
      .update({ team_id: teamId, joined_team_at: new Date().toISOString() })
      .eq('id', userId);

    if (userError) {
      // Manual Rollback if user update fails
      await this.supabase.from('teams').delete().eq('id', teamId);
      throw new Error('Failed to join the newly created team. Creation rolled back.');
    }
  }

  async updateName(teamId: string, newName: string): Promise<void> {
    const { error } = await this.supabase
      .from('teams')
      .update({ name: newName })
      .eq('id', teamId);
    if (error) {
      if (error.code === '23505') throw new Error('That team name is already taken.');
      throw new Error(error.message);
    }
  }

  async removeMember(userId: string, teamId: string): Promise<void> {
    const { error } = await this.supabase
      .from('users')
      .update({ team_id: null, joined_team_at: null })
      .eq('id', userId)
      .eq('team_id', teamId);
    if (error) throw new Error(error.message);
  }

  async deleteTeam(teamId: string): Promise<void> {
    const { error } = await this.supabase
      .from('teams')
      .delete()
      .eq('id', teamId);
    if (error) throw new Error(error.message);
  }
}
