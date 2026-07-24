import { Request, Response } from 'express';
import { z } from 'zod';
import { challengeService } from '../../services/challengeService.js';

const submitAnswerSchema = z.object({
  team_name: z.string().min(1, 'Team name is required'),
  challenge_identifier: z.union([z.string(), z.number()]),
  answer: z.string({ required_error: 'Answer is required' }),
});

export class UserChallengeController {
  /**
   * GET /api/challenges
   * List all active public challenges
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
   */
  static async getPublicChallenge(req: Request, res: Response): Promise<void> {
    try {
      const rawIdentifier = Array.isArray(req.params.identifier) ? req.params.identifier[0] : req.params.identifier;
      if (!rawIdentifier) {
        res.status(400).json({ success: false, error: 'Challenge identifier is required' });
        return;
      }
      const identifier: string = rawIdentifier;
      const team_name = req.query.team_name ? String(req.query.team_name) : undefined;
      const data = await challengeService.getPublicChallenge(identifier, team_name);

      if (!data) {
        res.status(404).json({
          success: false,
          error: `Challenge '${identifier}' not found or inactive`,
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
   */
  static async submitAnswer(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = submitAnswerSchema.parse(req.body);
      const result = await challengeService.submitAnswer(validatedData);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: result.message,
          data: result,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.message,
          data: result,
        });
      }
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
        error: error.message || 'Failed to process submission',
      });
    }
  }
}
