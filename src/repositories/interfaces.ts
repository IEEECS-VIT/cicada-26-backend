export interface User {
  id: string;
  email: string;
  display_name: string | null;
  register_no: string | null;
  role: 'participant' | 'admin';
  team_id: string | null;
  joined_team_at: Date | null;
  created_at: Date;
}

export interface Team {
  id: string;
  name: string;
  leader_id: string | null;
  invite_code: string;
  is_disqualified: boolean;
}

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  seedUser(id: string, email: string, display_name: string | null, register_no: string | null, role: 'participant' | 'admin'): Promise<void>;
  updateDisplayName(id: string, displayName: string): Promise<void>;
  updateTeam(id: string, teamId: string | null): Promise<void>;
}

export interface ITeamRepository {
  findById(id: string): Promise<Team | null>;
  findByInviteCode(inviteCode: string): Promise<Team | null>;
  countMembers(teamId: string): Promise<number>;
  createTeamAndJoin(userId: string, teamName: string, inviteCode: string, teamId: string): Promise<void>;
  updateName(teamId: string, newName: string): Promise<void>;
  removeMember(userId: string, teamId: string): Promise<void>;
  deleteTeam(teamId: string): Promise<void>;
}
