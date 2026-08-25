import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import db from '../../db.js';

export class UserTeamController {
  /**
   * POST /api/teams/create
   * Creates a new team. User identity comes from req.user (set by requireAuth middleware).
   * user_id from the request body is IGNORED — we use the authenticated user's ID.
   */
  static async createTeam(req: Request, res: Response): Promise<void> {
    const { team_name } = req.body;
    try {
      // CHANGE 3+4: Use authenticated user from middleware — never trust body user_id
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
        return;
      }

      if (!team_name || !team_name.trim()) {
        res.status(400).json({ success: false, error: 'team_name is required.' });
        return;
      }

      // Security Check: Block SQL injection & weird characters in team name
      const teamNameRegex = /^[a-zA-Z0-9 _-]+$/;
      if (!teamNameRegex.test(team_name.trim())) {
        res.status(400).json({ success: false, error: 'team_name can only contain alphanumeric characters, spaces, underscores, and dashes.' });
        return;
      }

      if (user.team_id) {
        res.status(400).json({ success: false, error: 'You are already in a team. You cannot create another one.' });
        return;
      }

      const team_id = randomUUID();
      const invite_code = generateInviteCode();

      await db.teams.createTeamAndJoin(user.id, team_name.trim(), invite_code, team_id);

      res.json({
        success: true,
        message: 'Team created successfully!',
        team_id,
        invite_code,
      });
    } catch (err: any) {
      console.error("CREATE TEAM ERROR:", err);
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/teams/join
   * Join a team via invite code. User identity comes from req.user.
   */
  static async joinTeam(req: Request, res: Response): Promise<void> {
    const { invite_code } = req.body;
    try {
      // CHANGE 3+4: Use authenticated user from middleware
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
        return;
      }

      if (!invite_code || !invite_code.trim()) {
        res.status(400).json({ success: false, error: 'invite_code is required.' });
        return;
      }

      if (user.team_id) {
        res.status(400).json({ success: false, error: 'You are already in a team. You cannot join another one.' });
        return;
      }

      const team = await db.teams.findByInviteCode(invite_code.toUpperCase().trim());
      if (!team) {
        res.status(404).json({ success: false, error: 'Invalid invite code. No team found.' });
        return;
      }

      const membersCount = await db.teams.countMembers(team.id);
      if (membersCount >= 5) {
        res.status(400).json({ success: false, error: 'This team is already full (maximum 5 members).' });
        return;
      }

      await db.users.updateTeam(user.id, team.id);

      res.json({ success: true, message: 'Successfully joined the team!', team_id: team.id });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/teams/update-name
   * Update team name. Only the team leader can do this.
   * Ownership verified via req.user.team_id and team.leader_id — no body trust.
   */
  static async updateTeamName(req: Request, res: Response): Promise<void> {
    const { new_team_name } = req.body;
    try {
      // CHANGE 3+4: Use authenticated user — ignore body user_id/team_id
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
        return;
      }

      if (!new_team_name || !new_team_name.trim()) {
        res.status(400).json({ success: false, error: 'new_team_name is required.' });
        return;
      }

      // Security Check: Block SQL injection & weird characters in team name
      const teamNameRegex = /^[a-zA-Z0-9 _-]+$/;
      if (!teamNameRegex.test(new_team_name.trim())) {
        res.status(400).json({ success: false, error: 'new_team_name can only contain alphanumeric characters, spaces, underscores, and dashes.' });
        return;
      }

      if (!user.team_id) {
        res.status(400).json({ success: false, error: 'You are not currently in a team.' });
        return;
      }

      // CHANGE 4: Verify ownership — only team leader can rename
      const team = await db.teams.findById(user.team_id);
      if (!team) {
        res.status(404).json({ success: false, error: 'Team not found.' });
        return;
      }

      if (team.leader_id !== user.id) {
        res.status(403).json({ success: false, error: 'Forbidden: Only the team leader can change the team name.' });
        return;
      }

      await db.teams.updateName(user.team_id, new_team_name.trim());
      res.json({ success: true, message: 'Team name updated successfully!' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/teams/leave
   * Leave current team. Team leaders cannot leave.
   * Ownership verified via req.user — no body user_id trust.
   */
  static async leaveTeam(req: Request, res: Response): Promise<void> {
    try {
      // CHANGE 3+4: Use authenticated user — ignore body user_id
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
        return;
      }

      if (!user.team_id) {
        res.status(400).json({ success: false, error: 'You are not currently in any team.' });
        return;
      }

      // CHANGE 4: Verify team exists and check leadership
      const team = await db.teams.findById(user.team_id);
      if (!team) {
        res.status(404).json({ success: false, error: 'Team not found.' });
        return;
      }

      if (team.leader_id === user.id) {
        res.status(400).json({
          success: false,
          error: 'Team leader cannot leave the team. Transfer leadership or contact an admin to dissolve the team.',
        });
        return;
      }

      await db.teams.removeMember(user.id, team.id);
      res.json({ success: true, message: 'Successfully left the team.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/teams/me
   * Fetch current user's team details including invite_code and members
   */
  static async getMyTeam(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
        return;
      }

      if (!user.team_id) {
        res.status(400).json({ success: false, error: 'You are not currently in any team.' });
        return;
      }

      const [team, members] = await Promise.all([
        db.teams.findById(user.team_id),
        db.users.findByTeamId(user.team_id)
      ]);

      if (!team) {
        res.status(404).json({ success: false, error: 'Team not found.' });
        return;
      }

      res.json({
        success: true,
        team_id: team.id,
        team_name: team.name,
        invite_code: team.invite_code,
        leader_id: team.leader_id,
        team: {
          id: team.id,
          name: team.name,
          invite_code: team.invite_code,
          leader_id: team.leader_id,
          is_disqualified: team.is_disqualified,
          points: team.points
        },
        members,
        data: {
          ...team,
          members
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/teams/me/members
   * Fetch all members of the user's current team, along with team info and invite_code
   */
  static async getMyTeamMembers(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
        return;
      }

      if (!user.team_id) {
        res.status(400).json({ success: false, error: 'You are not currently in any team.' });
        return;
      }

      const [team, members] = await Promise.all([
        db.teams.findById(user.team_id),
        db.users.findByTeamId(user.team_id)
      ]);

      res.json({
        success: true,
        invite_code: team ? team.invite_code : null,
        team_name: team ? team.name : null,
        team_id: user.team_id,
        data: members,
        members
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
