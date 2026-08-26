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
      // teams<->users has two FK paths (users.team_id -> teams.id for membership,
      // teams.leader_id -> users.id for leadership) — PostgREST can't disambiguate an
      // embed without an explicit hint, hence "more than one relationship was found".
      // users!team_id selects the membership relationship, which is what this endpoint wants.
      // teams has no created_at column (never added to the schema), so this can't order
      // by creation time — order by name instead.
      const { data, error } = await supabase
        .from('teams')
        .select(`
          id, name, invite_code, leader_id,
          users:users!team_id(id, email, display_name, register_no)
        `)
        .order('name', { ascending: true });

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
    const { team_id, team_name } = req.body;
    if (!team_id && !team_name) {
      res.status(400).json({ success: false, error: 'team_id or team_name is required.' });
      return;
    }

    try {
      let team = team_id ? await db.teams.findById(team_id) : null;
      if (!team && team_name) team = await db.teams.findByName(team_name);
      if (!team && team_id) team = await db.teams.findByName(team_id);

      if (!team) {
        // No matching row (e.g. a team that only exists via orphaned progress/leaderboard
        // records) — nothing to delete server-side, but still record the admin's intent.
        await logAdminActivity(req, 'DELETE_TEAM', { team_id, team_name, note: 'No matching teams row found' });
        res.status(404).json({ success: false, error: 'Team not found' });
        return;
      }

      await db.teams.deleteTeam(team.id);
      await logAdminActivity(req, 'DELETE_TEAM', { team_id: team.id, team_name: team.name });

      res.json({ success: true, message: 'Team forcefully deleted by admin.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * PATCH /api/admin/teams/:id
   * ADMIN ONLY: Update a team's name and/or disqualification status
   */
  static async updateTeam(req: Request, res: Response): Promise<void> {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!rawId) {
      res.status(400).json({ success: false, error: 'Team ID or name is required' });
      return;
    }
    const team_id_or_name = String(rawId);
    const { name, is_disqualified } = req.body;

    if (name === undefined && is_disqualified === undefined) {
      res.status(400).json({ success: false, error: 'At least one of name or is_disqualified is required.' });
      return;
    }

    try {
      let team = await db.teams.findById(team_id_or_name);
      if (!team) {
        team = await db.teams.findByName(team_id_or_name);
      }

      if (!team) {
        res.status(404).json({ success: false, error: 'Team not found' });
        return;
      }

      if (typeof name === 'string' && name.trim() && name.trim() !== team.name) {
        await db.teams.updateName(team.id, name.trim());
      }

      if (typeof is_disqualified === 'boolean') {
        const { error } = await supabase
          .from('teams')
          .update({ is_disqualified })
          .eq('id', team.id);
        if (error) throw error;
      }

      await logAdminActivity(req, 'UPDATE_TEAM', { team_id: team.id, name, is_disqualified });
      res.json({ success: true, message: 'Team updated' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * PATCH /api/admin/teams/:id/score
   * ADMIN ONLY: Adjust a team's score directly
   */
  static async adjustScore(req: Request, res: Response): Promise<void> {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!rawId) {
      res.status(400).json({ success: false, error: 'Team ID or name is required' });
      return;
    }
    const team_id_or_name = String(rawId);
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
