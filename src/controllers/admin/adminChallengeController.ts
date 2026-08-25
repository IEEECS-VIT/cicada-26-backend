import { Request, Response } from 'express';
import { z } from 'zod';
import { challengeService } from '../../services/challengeService.js';
import { logAdminActivity } from '../../services/auditLogger.js';
import { ChallengeAsset } from '../../types/challenge.js';

const assetSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['image', 'pdf', 'audio', 'video', 'file', 'text']),
  url: z.string().optional(),
  name: z.string().optional(),
  caption: z.string().optional(),
  content: z.string().optional(),
});

const addAssetBodySchema = z.object({
  type: z.enum(['image', 'pdf', 'audio', 'video', 'file', 'text']),
  url: z.string().optional(),
  name: z.string().optional(),
  caption: z.string().optional(),
  content: z.string().optional(),
});

const editAssetBodySchema = z.object({
  type: z.enum(['image', 'pdf', 'audio', 'video', 'file', 'text']).optional(),
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

const hintSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1, 'Hint text cannot be empty'),
  is_visible: z.boolean().default(true),
});

const addHintBodySchema = z.object({
  text: z.string().min(1, 'Hint text is required'),
  is_visible: z.boolean().default(true),
});

const editHintBodySchema = z.object({
  text: z.string().min(1, 'Hint text is required'),
});

const createChallengeSchema = z.object({
  order_number: z.number().int().min(1),
  name: z.string().min(1),
  story_context: z.string().optional(),
  assets: z.array(assetSchema).optional(),
  story_fragment: storyFragmentSchema.optional(),
  hints: z.array(hintSchema).optional(),
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
  hints: z.array(hintSchema).optional(),
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
   * GET /api/admin/challenges
   * List active challenges (Admin-only access)
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
   * GET /api/admin/challenges/participant-progress
   * Get participant progress tracking (Admin-only access)
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
      await logAdminActivity(req, 'CREATE_CHALLENGE', { order_number: data.order_number, name: data.name });

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

      await logAdminActivity(req, 'UPDATE_CHALLENGE', { challenge_id: id, updates: validatedData });

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

      await logAdminActivity(req, 'DELETE_CHALLENGE', { challenge_id: id });

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

      await logAdminActivity(req, 'ADMIN_OVERRIDE_UNLOCK', validatedData);

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
      await logAdminActivity(req, 'RESET_TEAM_PROGRESS', { team_name });

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

  /**
   * POST /api/admin/challenges/:id/hints
   * Add a hint to a challenge
   */
  static async addHint(req: Request, res: Response): Promise<void> {
    try {
      const challengeId = req.params.id;
      if (!challengeId) {
        res.status(400).json({ success: false, error: 'Challenge ID is required' });
        return;
      }
      const validatedData = addHintBodySchema.parse(req.body);
      const hints = await challengeService.addHintToChallenge(String(challengeId), validatedData.text, validatedData.is_visible);

      await logAdminActivity(req, 'ADD_CHALLENGE_HINT', { challenge_id: String(challengeId), text: validatedData.text });

      res.status(201).json({
        success: true,
        message: 'Hint added successfully',
        data: hints,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: 'Validation Error', details: error.errors });
        return;
      }
      res.status(500).json({ success: false, error: error.message || 'Failed to add hint' });
    }
  }

  /**
   * PUT /api/admin/challenges/:id/hints/:hintId
   * Edit a hint in a challenge
   */
  static async editHint(req: Request, res: Response): Promise<void> {
    try {
      const challengeId = req.params.id;
      const hintId = req.params.hintId;
      if (!challengeId || !hintId) {
        res.status(400).json({ success: false, error: 'Challenge ID and Hint ID are required' });
        return;
      }
      const validatedData = editHintBodySchema.parse(req.body);
      const hints = await challengeService.editHintInChallenge(String(challengeId), String(hintId), validatedData.text);

      await logAdminActivity(req, 'EDIT_CHALLENGE_HINT', { challenge_id: String(challengeId), hint_id: String(hintId) });

      res.status(200).json({
        success: true,
        message: 'Hint edited successfully',
        data: hints,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: 'Validation Error', details: error.errors });
        return;
      }
      res.status(500).json({ success: false, error: error.message || 'Failed to edit hint' });
    }
  }

  /**
   * DELETE /api/admin/challenges/:id/hints/:hintId
   * Delete a hint from a challenge
   */
  static async deleteHint(req: Request, res: Response): Promise<void> {
    try {
      const challengeId = req.params.id;
      const hintId = req.params.hintId;
      if (!challengeId || !hintId) {
        res.status(400).json({ success: false, error: 'Challenge ID and Hint ID are required' });
        return;
      }
      const hints = await challengeService.deleteHintFromChallenge(String(challengeId), String(hintId));

      await logAdminActivity(req, 'DELETE_CHALLENGE_HINT', { challenge_id: String(challengeId), hint_id: String(hintId) });

      res.status(200).json({
        success: true,
        message: 'Hint deleted successfully',
        data: hints,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to delete hint' });
    }
  }

  /**
   * PATCH /api/admin/challenges/:id/hints/:hintId/toggle
   * Toggle visibility of a hint
   */
  static async toggleHint(req: Request, res: Response): Promise<void> {
    try {
      const challengeId = req.params.id;
      const hintId = req.params.hintId;
      if (!challengeId || !hintId) {
        res.status(400).json({ success: false, error: 'Challenge ID and Hint ID are required' });
        return;
      }
      const hints = await challengeService.toggleHintVisibility(String(challengeId), String(hintId));

      await logAdminActivity(req, 'TOGGLE_CHALLENGE_HINT', { challenge_id: String(challengeId), hint_id: String(hintId) });

      res.status(200).json({
        success: true,
        message: 'Hint visibility toggled successfully',
        data: hints,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to toggle hint visibility' });
    }
  }

  /**
   * POST /api/admin/challenges/:id/assets
   * Add an asset to a challenge
   */
  static async addAsset(req: Request, res: Response): Promise<void> {
    try {
      const challengeId = req.params.id;
      if (!challengeId) {
        res.status(400).json({ success: false, error: 'Challenge ID is required' });
        return;
      }
      const validatedData = addAssetBodySchema.parse(req.body);
      const assets = await challengeService.addAssetToChallenge(String(challengeId), validatedData);

      await logAdminActivity(req, 'ADD_CHALLENGE_ASSET', { challenge_id: String(challengeId), type: validatedData.type, name: validatedData.name });

      res.status(201).json({
        success: true,
        message: 'Asset added successfully',
        data: assets,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: 'Validation Error', details: error.errors });
        return;
      }
      res.status(500).json({ success: false, error: error.message || 'Failed to add asset' });
    }
  }

  /**
   * PUT /api/admin/challenges/:id/assets/:assetId
   * Edit/Replace an asset in a challenge
   */
  static async editAsset(req: Request, res: Response): Promise<void> {
    try {
      const challengeId = req.params.id;
      const assetId = req.params.assetId;
      if (!challengeId || !assetId) {
        res.status(400).json({ success: false, error: 'Challenge ID and Asset ID are required' });
        return;
      }
      const validatedData = editAssetBodySchema.parse(req.body);
      const cleanedData = Object.fromEntries(
        Object.entries(validatedData).filter(([_, v]) => v !== undefined)
      ) as Partial<ChallengeAsset>;
      const assets = await challengeService.editAssetInChallenge(String(challengeId), String(assetId), cleanedData);

      await logAdminActivity(req, 'EDIT_CHALLENGE_ASSET', { challenge_id: String(challengeId), asset_id: String(assetId) });

      res.status(200).json({
        success: true,
        message: 'Asset updated successfully',
        data: assets,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: 'Validation Error', details: error.errors });
        return;
      }
      res.status(500).json({ success: false, error: error.message || 'Failed to edit asset' });
    }
  }

  /**
   * DELETE /api/admin/challenges/:id/assets/:assetId
   * Delete an asset from a challenge
   */
  static async deleteAsset(req: Request, res: Response): Promise<void> {
    try {
      const challengeId = req.params.id;
      const assetId = req.params.assetId;
      if (!challengeId || !assetId) {
        res.status(400).json({ success: false, error: 'Challenge ID and Asset ID are required' });
        return;
      }
      const assets = await challengeService.deleteAssetFromChallenge(String(challengeId), String(assetId));

      await logAdminActivity(req, 'DELETE_CHALLENGE_ASSET', { challenge_id: String(challengeId), asset_id: String(assetId) });

      res.status(200).json({
        success: true,
        message: 'Asset deleted successfully',
        data: assets,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to delete asset' });
    }
  }

  /**
   * GET /api/admin/challenges/ip-tracking
   * GET /api/admin/challenges/ip-blocking
   * Get the current status of IP tracking / location locking
   */
  static async getIpTrackingStatus(req: Request, res: Response): Promise<void> {
    try {
      const enabled = challengeService.isIpTrackingEnabled();
      res.status(200).json({
        success: true,
        ip_tracking_enabled: enabled,
        ip_blocking_enabled: enabled,
        message: `IP tracking / blocking is currently ${enabled ? 'ENABLED' : 'DISABLED'}`,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to get IP tracking status' });
    }
  }

  /**
   * POST /api/admin/challenges/ip-tracking/toggle
   * POST /api/admin/challenges/toggle-ip-tracking
   * PATCH /api/admin/challenges/ip-tracking
   * Toggle or set the IP tracking / location locking state
   */
  static async toggleIpTracking(req: Request, res: Response): Promise<void> {
    try {
      let enabled: boolean;
      if (req.body && typeof req.body.enabled === 'boolean') {
        enabled = challengeService.setIpTrackingEnabled(req.body.enabled);
      } else {
        enabled = challengeService.toggleIpTracking();
      }

      await logAdminActivity(req, 'TOGGLE_IP_TRACKING', { ip_tracking_enabled: enabled });

      res.status(200).json({
        success: true,
        message: `IP tracking middleware ${enabled ? 'enabled' : 'disabled'} successfully`,
        ip_tracking_enabled: enabled,
        ip_blocking_enabled: enabled,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to toggle IP tracking' });
    }
  }
}
