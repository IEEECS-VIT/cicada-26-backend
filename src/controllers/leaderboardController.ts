import { Request, Response } from 'express';
import { z } from 'zod';
import { LeaderboardService } from '../services/leaderboardService.js';

const submitScoreSchema = z.object({
  team_name: z.string().min(1, 'Team name is required'),
  challenges_completed: z.number().int().min(0, 'Challenges completed must be 0 or positive'),
  completion_time: z.string().datetime().optional(),
});

const updateScoreSchema = z.object({
  team_name: z.string().min(1).optional(),
  challenges_completed: z.number().int().min(0).optional(),
  completion_time: z.string().datetime().optional(),
});

const adjustScoreSchema = z.object({
  identifier: z.string().optional(),
  delta: z.number().int(),
});

export class LeaderboardController {
  /**
   * GET /api/leaderboard
   * Get the live ordered leaderboard snapshot.
   */
  static async getLeaderboard(req: Request, res: Response): Promise<void> {
    try {
      const data = await LeaderboardService.getLiveLeaderboard();
      res.status(200).json({
        success: true,
        message: 'Live leaderboard fetched successfully',
        data,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error while fetching leaderboard',
      });
    }
  }

  /**
   * GET /api/leaderboard/stream
   * Live Server-Sent Events (SSE) endpoint for instant real-time updates.
   */
  static streamLeaderboard(req: Request, res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    LeaderboardService.registerSseClient(res);

    req.on('close', () => {
      LeaderboardService.unregisterSseClient(res);
      res.end();
    });
  }

  /**
   * POST /api/leaderboard/submit
   * Set ANY score to ANY extent for ANY team (by team_name).
   */
  static async submitScore(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = submitScoreSchema.parse(req.body);
      const result = await LeaderboardService.setScoreByName(
        validatedData.team_name,
        validatedData.challenges_completed,
        validatedData.completion_time
      );
      res.status(200).json({
        success: true,
        message: `Score for team '${validatedData.team_name}' set to ${validatedData.challenges_completed} instantly`,
        data: result,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          details: error.errors,
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to set score',
      });
    }
  }

  /**
   * PATCH /api/leaderboard/:identifier/adjust
   * Adjust score by adding/subtracting any amount (delta) for a team (by name or ID).
   */
  static async adjustScore(req: Request, res: Response): Promise<void> {
    try {
      const identifier = String(req.params.identifier || req.body.identifier || req.params.id);
      const { delta } = adjustScoreSchema.parse(req.body);
      const result = await LeaderboardService.adjustScore(identifier, delta);

      res.status(200).json({
        success: true,
        message: `Score for '${identifier}' adjusted by ${delta > 0 ? '+' + delta : delta}`,
        data: result,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          details: error.errors,
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to adjust team score',
      });
    }
  }

  /**
   * PUT /api/leaderboard/:id
   * Update team entry details by ID (Admin action).
   */
  static async updateScore(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const validatedData = updateScoreSchema.parse(req.body);
      const result = await LeaderboardService.updateScore(id, validatedData);

      if (!result) {
        res.status(404).json({
          success: false,
          error: 'Leaderboard entry not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Team entry modified successfully in Supabase backend',
        data: result,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          details: error.errors,
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update score',
      });
    }
  }

  /**
   * DELETE /api/leaderboard/:identifier
   * Delete team entry by name or ID (Admin action).
   */
  static async deleteTeam(req: Request, res: Response): Promise<void> {
    try {
      const identifier = String(req.params.identifier || req.params.id);
      await LeaderboardService.deleteTeam(identifier);
      res.status(200).json({
        success: true,
        message: `Team '${identifier}' deleted instantly from Supabase backend`,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete team entry',
      });
    }
  }

  /**
   * POST /api/leaderboard/reset
   * Reset entire leaderboard (Admin action).
   */
  static async resetLeaderboard(req: Request, res: Response): Promise<void> {
    try {
      await LeaderboardService.resetLeaderboard();
      res.status(200).json({
        success: true,
        message: 'Leaderboard reset successfully across Supabase backend',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to reset leaderboard',
      });
    }
  }
}
