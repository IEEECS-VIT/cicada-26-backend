import { Request, Response } from 'express';
import { z } from 'zod';
import { challengeService } from '../../services/challengeService.js';

const assetSchema = z.object({
  type: z.enum(['image', 'pdf', 'audio', 'video', 'file', 'text']),
  url: z.string().optional(),
  name: z.string().optional(),
  caption: z.string().optional(),
  content: z.string().optional(),
});

const storyFragmentSchema = z.object({
  title: z.string().min(1, 'Story fragment title is required'),
  header: z.string().optional(),
  content: z.string().min(1, 'Story fragment content is required'),
});

const createChallengeSchema = z.object({
  order_number: z.number().int().min(1),
  name: z.string().min(1),
  story_context: z.string().optional(),
  assets: z.array(assetSchema).optional(),
  story_fragment: storyFragmentSchema.optional(),
  answer_key: z.string().min(1, 'Answer key is required'),
  time_limit: z.number().int().min(1).optional(),
  is_active: z.boolean().optional(),
});

const updateChallengeSchema = z.object({
  order_number: z.number().int().min(1).optional(),
  name: z.string().min(1).optional(),
  story_context: z.string().optional(),
  assets: z.array(assetSchema).optional(),
  story_fragment: storyFragmentSchema.optional(),
  answer_key: z.string().min(1).optional(),
  time_limit: z.number().int().min(1).optional(),
  is_active: z.boolean().optional(),
});

const adminOverrideSchema = z.object({
  team_name: z.string().min(1, 'Team name is required'),
  target_challenge_order: z.number().int().min(1, 'Target challenge order must be at least 1'),
});

export class AdminChallengeController {
  /**
   * GET /api/admin/challenges/all
   */
  static async getAllChallengesAdmin(req: Request, res: Response): Promise<void> {
    try {
      const data = await challengeService.getAllChallengesAdmin();
      res.status(200).json({
        success: true,
        message: 'All challenges (admin) fetched successfully',
        data,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch admin challenges',
      });
    }
  }

  /**
   * POST /api/admin/challenges
   */
  static async createChallenge(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = createChallengeSchema.parse(req.body);
      const data = await challengeService.createChallenge(validatedData as any);
      res.status(201).json({
        success: true,
        message: `Challenge '${data.name}' created successfully`,
        data,
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
      const errMsg = error.message || '';
      if (errMsg.includes('unique constraint') || errMsg.includes('challenges_order_number_key') || errMsg.includes('23505')) {
        res.status(400).json({
          success: false,
          error: `Challenge with order_number ${req.body?.order_number} already exists. Please specify a unique order_number or update the existing challenge.`,
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create challenge',
      });
    }
  }

  /**
   * PUT /api/admin/challenges/:id
   */
  static async updateChallenge(req: Request, res: Response): Promise<void> {
    try {
      const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!rawId) {
        res.status(400).json({ success: false, error: 'Challenge ID is required' });
        return;
      }
      const id: string = rawId;
      const validatedData = updateChallengeSchema.parse(req.body);
      const data = await challengeService.updateChallenge(id, validatedData as any);

      if (!data) {
        res.status(404).json({
          success: false,
          error: `Challenge '${id}' not found`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: `Challenge '${id}' updated successfully`,
        data,
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
        error: error.message || 'Failed to update challenge',
      });
    }
  }

  /**
   * DELETE /api/admin/challenges/:id
   */
  static async deleteChallenge(req: Request, res: Response): Promise<void> {
    try {
      const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!rawId) {
        res.status(400).json({ success: false, error: 'Challenge ID is required' });
        return;
      }
      const id: string = rawId;
      const success = await challengeService.deleteChallenge(id);

      if (!success) {
        res.status(404).json({
          success: false,
          error: `Challenge '${id}' not found`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: `Challenge '${id}' deleted successfully`,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete challenge',
      });
    }
  }

  /**
   * GET /api/admin/challenges/progress
   */
  static async getAdminProgressTracking(req: Request, res: Response): Promise<void> {
    try {
      const data = await challengeService.getAllTeamsProgressAdmin();
      res.status(200).json({
        success: true,
        message: 'Admin progress matrix fetched successfully',
        data,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch admin progress matrix',
      });
    }
  }

  /**
   * POST /api/admin/challenges/override
   */
  static async adminOverride(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = adminOverrideSchema.parse(req.body);
      const data = await challengeService.adminOverrideUnlock(validatedData);

      res.status(200).json({
        success: true,
        message: data.message,
        data,
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
        error: error.message || 'Failed to execute admin override',
      });
    }
  }

  /**
   * POST /api/admin/challenges/reset-team
   */
  static async resetTeamProgress(req: Request, res: Response): Promise<void> {
    try {
      const { team_name } = req.body;
      if (!team_name || !String(team_name).trim()) {
        res.status(400).json({
          success: false,
          error: 'Team name is required',
        });
        return;
      }

      const data = await challengeService.resetTeamProgress(String(team_name).trim());
      res.status(200).json({
        success: true,
        message: `Team '${team_name}' progress reset back to challenge 1 successfully`,
        data,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to reset team progress',
      });
    }
  }

  /**
   * GET /api/admin/challenges/submission-logs
   */
  static async getSubmissionLogs(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const team_name = req.query.team_name ? String(req.query.team_name) : undefined;
      const data = await challengeService.getSubmissionLogs(limit, team_name);

      res.status(200).json({
        success: true,
        message: 'Submission logs fetched successfully',
        data,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch submission logs',
      });
    }
  }
}
