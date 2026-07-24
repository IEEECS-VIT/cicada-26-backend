import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../../db.js';

const generateInviteCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export class UserTeamController {
  /**
   * POST /api/teams/create
   */
  static async createTeam(req: Request, res: Response): Promise<void> {
    const { user_id, team_name } = req.body;
    try {
      const user = await db.users.findById(user_id);
      if (!user) throw new Error('User not found.');
      if (user.team_id) throw new Error('You are already in a team. You cannot create another one.');

      const team_id = uuidv4();
      const invite_code = generateInviteCode();

      await db.teams.createTeamAndJoin(user.id, team_name, invite_code, team_id);

      res.json({
        success: true,
        message: 'Team created successfully!',
        team_id,
        invite_code,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/teams/join
   */
  static async joinTeam(req: Request, res: Response): Promise<void> {
    const { user_id, invite_code } = req.body;
    try {
      const user = await db.users.findById(user_id);
      if (!user) throw new Error('User not found.');
      if (user.team_id) throw new Error('You are already in a team. You cannot join another one.');

      const team = await db.teams.findByInviteCode(invite_code.toUpperCase());
      if (!team) throw new Error('Invalid invite code.');

      const membersCount = await db.teams.countMembers(team.id);
      if (membersCount >= 5) throw new Error('This team is already full (maximum 5 members).');

      await db.users.updateTeam(user.id, team.id);

      res.json({ success: true, message: 'Successfully joined the team!', team_id: team.id });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/teams/update-name
   */
  static async updateTeamName(req: Request, res: Response): Promise<void> {
    const { user_id, team_id, new_team_name } = req.body;
    try {
      const team = await db.teams.findById(team_id);
      if (!team) {
        res.status(404).json({ success: false, error: 'Team not found.' });
        return;
      }
      if (team.leader_id !== user_id) {
        res.status(403).json({ success: false, error: 'Forbidden: Only the team leader can change the name.' });
        return;
      }

      await db.teams.updateName(team_id, new_team_name);
      res.json({ success: true, message: 'Team name updated successfully!' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/teams/leave
   * Participant route for leaving a team.
   * CONSTRAINT: Team Leader CANNOT leave the team.
   */
  static async leaveTeam(req: Request, res: Response): Promise<void> {
    const { user_id, team_id: paramTeamId } = req.body;
    try {
      if (!user_id) {
        res.status(400).json({ success: false, error: 'user_id is required.' });
        return;
      }

      const user = await db.users.findById(user_id);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found.' });
        return;
      }

      const targetTeamId = user.team_id || paramTeamId;
      if (!targetTeamId) {
        res.status(400).json({ success: false, error: 'User is not currently in any team.' });
        return;
      }

      const team = await db.teams.findById(targetTeamId);
      if (!team) {
        res.status(404).json({ success: false, error: 'Team not found.' });
        return;
      }

      // CONSTRAINT CHECK: Leader cannot leave team
      if (team.leader_id === user.id) {
        res.status(400).json({
          success: false,
          error: 'Team leader cannot leave the team. Leadership must be transferred or the team must be deleted by an admin.',
        });
        return;
      }

      // Remove non-leader member from team
      await db.teams.removeMember(user.id, team.id);
      res.json({ success: true, message: 'Successfully left the team.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
