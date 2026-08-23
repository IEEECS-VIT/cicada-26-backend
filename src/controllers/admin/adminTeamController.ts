import { Request, Response } from 'express';
import { db, supabase } from '../../db.js';
import { logAdminActivity } from '../../services/auditLogger.js';

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
      await logAdminActivity(req, 'REMOVE_TEAM_MEMBER', { target_user_id, team_id });

      res.json({ success: true, message: `Member '${target_user_id}' removed from team '${team_id}' by admin.` });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/admin/teams/all
   * ADMIN ONLY: Get all teams and their members
   */
  static async getAllTeams(req: Request, res: Response): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select(`
          id, name, invite_code, leader_id, created_at,
          users:users(id, email, display_name, register_no)
        `)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      res.json({ success: true, data });
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
      await logAdminActivity(req, 'DELETE_TEAM', { team_id });

      res.json({ success: true, message: 'Team forcefully deleted by admin.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * PATCH /api/admin/teams/:id/score
   * ADMIN ONLY: Adjust a team's score directly
   */
  static async adjustScore(req: Request, res: Response): Promise<void> {
    const team_id_or_name = req.params.id;
    const { delta, exact } = req.body;
    try {
      let team = await db.teams.findById(team_id_or_name);
      if (!team) {
        team = await db.teams.findByName(team_id_or_name);
      }
      
      if (!team) {
        res.status(404).json({ success: false, error: 'Team not found' });
        return;
      }
      
      let newScore = team.points || 0;
      if (exact !== undefined) {
        newScore = Number(exact);
      } else if (delta !== undefined) {
        newScore += Number(delta);
      }
      
      const { error } = await supabase
        .from('teams')
        .update({ points: newScore })
        .eq('id', team.id);
        
      if (error) throw error;
      
      await logAdminActivity(req, 'ADJUST_SCORE', { team_id: team.id, delta, exact, newScore });
      res.json({ success: true, message: 'Score updated', newScore });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
