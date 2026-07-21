import { Request, Response } from 'express';
import { z } from 'zod';
import { challengeService } from '../services/challengeService.js';

const submitAnswerSchema = z.object({
  team_name: z.string().min(1, 'Team name is required'),
  challenge_identifier: z.union([z.string(), z.number()]),
  answer: z.string({ required_error: 'Answer is required' }),
});

const adminOverrideSchema = z.object({
  team_name: z.string().min(1, 'Team name is required'),
  target_challenge_order: z.number().int().min(1, 'Target challenge order must be at least 1'),
});

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
  order_number: z.number().int().min(1, 'Order number must be at least 1'),
  name: z.string().min(1, 'Challenge name is required'),
  story_context: z.string().optional(),
  assets: z.array(assetSchema).optional(),
  story_fragment: storyFragmentSchema.optional(),
  answer_key: z.string().min(1, 'Answer key is required'),
  is_active: z.boolean().optional(),
});

const updateChallengeSchema = z.object({
  order_number: z.number().int().min(1).optional(),
  name: z.string().min(1).optional(),
  story_context: z.string().optional(),
  assets: z.array(assetSchema).optional(),
  story_fragment: storyFragmentSchema.optional(),
  answer_key: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
});

export class ChallengeController {
  /**
   * GET /api/challenges
   * List all active public challenges (without answer keys)
   */
  static async getPublicChallenges(req: Request, res: Response): Promise<void> {
    try {
      const team_name = req.query.team_name ? String(req.query.team_name) : undefined;
      const data = await challengeService.getPublicChallenges(team_name);
      res.status(200).json({
        success: true,
        message: 'Active challenges fetched successfully',
        data,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch challenges',
      });
    }
  }

  /**
   * GET /api/challenges/progress?team_name=...
   * Get team resume progress state & unlocked fragments after participant logout/re-login
   */
  static async getParticipantProgress(req: Request, res: Response): Promise<void> {
    try {
      const team_name = String(req.query.team_name || req.params.team_name || '');
      if (!team_name.trim()) {
        res.status(400).json({
          success: false,
          error: 'Query parameter team_name is required',
        });
        return;
      }

      const data = await challengeService.getParticipantProgress(team_name);
      res.status(200).json({
        success: true,
        message: `Progress state for team '${team_name}' fetched successfully`,
        data,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch participant progress',
      });
    }
  }

  /**
   * GET /api/challenges/story-fragments?team_name=...
   * Get all unlocked story fragments for a team (Archive page)
   */
  static async getUnlockedStoryFragments(req: Request, res: Response): Promise<void> {
    try {
      const team_name = String(req.query.team_name || req.params.team_name || '');
      if (!team_name.trim()) {
        res.status(400).json({
          success: false,
          error: 'Query parameter team_name is required',
        });
        return;
      }

      const data = await challengeService.getUnlockedStoryFragments(team_name);
      res.status(200).json({
        success: true,
        message: `Unlocked story fragments for team '${team_name}' fetched successfully`,
        data,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch unlocked story fragments',
      });
    }
  }

  /**
   * GET /api/challenges/:identifier
   * Get single public challenge by order_number or UUID (without answer key)
   */
  static async getPublicChallenge(req: Request, res: Response): Promise<void> {
    try {
      const identifier = Array.isArray(req.params.identifier) ? req.params.identifier[0] : req.params.identifier;
      const team_name = req.query.team_name ? String(req.query.team_name) : undefined;
      const data = await challengeService.getPublicChallenge(identifier, team_name);

      if (!data) {
        res.status(404).json({
          success: false,
          error: `Challenge '${identifier}' not found or inactive`,
        });
        return;
      }

      if (data.is_locked) {
        res.status(400).json({
          success: false,
          error: `Challenge '${identifier}' is locked for team '${team_name}'. Complete previous challenges first.`,
          data,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: `Challenge '${identifier}' fetched successfully`,
        data,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch challenge',
      });
    }
  }

  /**
   * POST /api/challenges/submit
   * Submit answer for a challenge
   */
  static async submitAnswer(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = submitAnswerSchema.parse(req.body);
      const result = await challengeService.submitAnswer(validatedData);

      if (!result.success) {
        // Return 400 Bad Request on incorrect answer with zero info leakage
        res.status(400).json({
          success: false,
          message: result.message,
          tryAgain: result.tryAgain ?? true,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: result.message,
        unlocked_next_challenge: result.unlocked_next_challenge,
        story_fragment: result.story_fragment || null,
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

      res.status(400).json({
        success: false,
        error: error.message || 'Failed to process answer submission',
      });
    }
  }

  /**
   * GET /api/challenges/admin/progress
   * Admin Progress Tracking (Visible to Admin Only - Section 7)
   */
  static async getAdminProgressTracking(req: Request, res: Response): Promise<void> {
    try {
      const data = await challengeService.getAllTeamsProgressAdmin();
      res.status(200).json({
        success: true,
        message: 'Admin team progress tracking summary fetched successfully',
        data,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch admin progress tracking',
      });
    }
  }

  /**
   * POST /api/challenges/admin/override
   * Admin force unlock override for team
   */
  static async adminOverride(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = adminOverrideSchema.parse(req.body);
      const result = await challengeService.adminOverrideUnlock(validatedData);

      res.status(200).json({
        success: true,
        message: result.message,
        unlocked_next_challenge: result.unlocked_next_challenge,
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
        error: error.message || 'Failed to execute admin unlock override',
      });
    }
  }

  /**
   * GET /api/challenges/admin/all
   * Admin list all challenges (including answer keys)
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
   * POST /api/challenges/admin
   * Admin create new challenge
   */
  static async createChallenge(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = createChallengeSchema.parse(req.body);
      const data = await challengeService.createChallenge(validatedData);

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

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create challenge',
      });
    }
  }

  /**
   * PUT /api/challenges/admin/:id
   * Admin update existing challenge
   */
  static async updateChallenge(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const validatedData = updateChallengeSchema.parse(req.body);
      const data = await challengeService.updateChallenge(id, validatedData);

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
   * DELETE /api/challenges/admin/:id
   * Admin delete challenge
   */
  static async deleteChallenge(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      await challengeService.deleteChallenge(id);

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
}
