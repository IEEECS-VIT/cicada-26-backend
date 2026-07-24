import { Request, Response } from 'express';
import db from '../../db.js';

export class AdminTeamController {
  /**
   * POST /api/admin/teams/remove-member
   * ADMIN ONLY: Forcefully remove a member from a team
   */
  static async removeMember(req: Request, res: Response): Promise<void> {
    const { target_user_id, team_id } = req.body;
    try {
      if (!target_user_id || !team_id) {
        res.status(400).json({ success: false, error: 'target_user_id and team_id are required.' });
        return;
      }

      const team = await db.teams.findById(team_id);
      if (!team) {
        res.status(404).json({ success: false, error: 'Team not found.' });
        return;
      }

      await db.teams.removeMember(target_user_id, team_id);
      res.json({ success: true, message: `Member '${target_user_id}' removed from team '${team_id}' by admin.` });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/admin/teams/delete-team
   * ADMIN ONLY: Delete team
   */
  static async deleteTeam(req: Request, res: Response): Promise<void> {
    const { team_id } = req.body;
    try {
      if (!team_id) {
        res.status(400).json({ success: false, error: 'team_id is required.' });
        return;
      }

      await db.teams.deleteTeam(team_id);
      res.json({ success: true, message: 'Team forcefully deleted by admin.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
