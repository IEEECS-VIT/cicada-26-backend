import { Request, Response } from 'express';
import { z } from 'zod';
import { challengeService } from '../../services/challengeService.js';
import { logAdminActivity } from '../../services/auditLogger.js';
import { ChallengeAsset } from '../../types/challenge.js';
import {
  getRoundTimerConfig,
  setRoundDurationSeconds,
  startRound,
  resetRoundTimer,
} from '../../services/roundTimerService.js';

const assetSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['image', 'audio', 'video', 'document', 'link', 'pdf', 'file', 'text']).optional(),
  url: z.string().optional(),
  name: z.string().optional(),
  caption: z.string().optional(),
  content: z.string().optional(),
  asset_set: z.number().optional(),
});

const addAssetBodySchema = z.object({
  type: z.enum(['image', 'audio', 'video', 'document', 'link', 'pdf', 'file', 'text']).optional(),
  url: z.string().optional(),
  name: z.string().optional(),
  caption: z.string().optional(),
  content: z.string().optional(),
  asset_set: z.number().optional(),
});

const editAssetBodySchema = z.object({
  type: z.enum(['image', 'audio', 'video', 'document', 'link', 'pdf', 'file', 'text']).optional(),
  url: z.string().optional(),
  name: z.string().optional(),
  caption: z.string().optional(),
  content: z.string().optional(),
  asset_set: z.number().optional(),
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
  unlock_minutes: z.number().int().min(0).optional(),
});

const addHintBodySchema = z.object({
  text: z.string().min(1, 'Hint text is required'),
  is_visible: z.boolean().default(true),
  unlock_minutes: z.number().int().min(0).optional(),
});

const editHintBodySchema = z.object({
  text: z.string().min(1, 'Hint text is required'),
  unlock_minutes: z.number().int().min(0).optional(),
});

const successRewardSchema = z.object({
  link: z.string().optional(),
  label: z.string().optional(),
  code: z.string().optional(),
}).refine((v) => v.link !== undefined || v.label !== undefined || v.code !== undefined, {
  message: 'Provide at least one of link, label, or code',
}).optional().nullable();

const createChallengeSchema = z.object({
  round_id: z.string().uuid('round_id must be a valid UUID').optional(),
  order_number: z.number().int().min(1),
  name: z.string().min(1),
  story_context: z.string().optional(),
  assets: z.array(assetSchema).optional(),
  story_fragment: storyFragmentSchema.optional(),
  hints: z.array(hintSchema).optional(),
  answer_key: z.string().min(1, 'Answer key is required'),
  success_reward: successRewardSchema,
  time_limit: z.number().int().min(0).optional(), // 0 means unlimited
  is_active: z.boolean().optional(),
});

const updateChallengeSchema = z.object({
  round_id: z.string().uuid('round_id must be a valid UUID').optional(),
  order_number: z.number().int().min(1).optional(),
  name: z.string().min(1).optional(),
  story_context: z.string().optional(),
  assets: z.array(assetSchema).optional(),
  story_fragment: storyFragmentSchema.optional(),
  hints: z.array(hintSchema).optional(),
  answer_key: z.string().min(1).optional(),
  success_reward: successRewardSchema,
  time_limit: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

const createRoundSchema = z.object({
  name: z.string().min(1, 'Round name is required'),
  order_number: z.number().int().min(1).optional(),
  story_fragment: storyFragmentSchema.optional(),
  time_limit: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

const updateRoundSchema = z.object({
  name: z.string().min(1).optional(),
  order_number: z.number().int().min(1).optional(),
  story_fragment: storyFragmentSchema.optional(),
  time_limit: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

const reorderRoundsSchema = z.object({
  ordered_ids: z.array(z.string().uuid('Round ID must be a valid UUID')).min(1, 'ordered_ids must not be empty'),
});

const adminOverrideSchema = z.object({
  team_name: z.string().min(1, 'Team name is required'),
  target_challenge_order: z.number().int().min(1, 'Target challenge order must be at least 1'),
});

const updateRoundTimerSchema = z.object({
  duration_seconds: z.number().int().min(60, 'Round duration must be at least 60 seconds').max(24 * 60 * 60 * 30).optional(),
  action: z.enum(['start', 'reset']).optional(),
}).refine((v) => v.duration_seconds !== undefined || v.action !== undefined, {
  message: 'Provide duration_seconds and/or an action (start or reset)',
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
      const hints = await challengeService.addHintToChallenge(String(challengeId), validatedData.text, validatedData.is_visible, validatedData.unlock_minutes);

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
      const hints = await challengeService.editHintInChallenge(String(challengeId), String(hintId), validatedData.text, validatedData.unlock_minutes);

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
      const assets = await challengeService.addAssetToChallenge(String(challengeId), validatedData as any);

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
   * GET /api/admin/challenges/ip-blocking
   * GET /api/admin/challenges/ip-tracking
   * Get the current status of IP tracking / location locking
   */
  static async getIpTrackingStatus(req: Request, res: Response): Promise<void> {
    try {
      const enabled = challengeService.isIpTrackingEnabled();
      res.status(200).json({
        success: true,
        enabled,
        ip_blocking_enabled: enabled,
        ip_tracking_enabled: enabled,
        message: `IP blocking is currently ${enabled ? 'ENABLED' : 'DISABLED'}`,
        data: {
          enabled,
          ip_blocking_enabled: enabled,
          ip_tracking_enabled: enabled,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to get IP blocking status' });
    }
  }

  /**
   * POST /api/admin/challenges/ip-blocking/toggle
   * POST /api/admin/challenges/ip-tracking/toggle
   * Toggle or set the IP blocking state
   */
  static async toggleIpTracking(req: Request, res: Response): Promise<void> {
    try {
      let enabled: boolean;
      const bodyVal = req.body?.enabled ?? req.body?.ip_blocking_enabled ?? req.body?.ip_tracking_enabled;
      if (typeof bodyVal === 'boolean') {
        enabled = await challengeService.setIpTrackingEnabled(bodyVal);
      } else {
        enabled = await challengeService.toggleIpTracking();
      }

      await logAdminActivity(req, 'TOGGLE_IP_BLOCKING', { ip_blocking_enabled: enabled });

      res.status(200).json({
        success: true,
        enabled,
        ip_blocking_enabled: enabled,
        ip_tracking_enabled: enabled,
        message: `IP blocking ${enabled ? 'enabled' : 'disabled'} successfully`,
        data: {
          enabled,
          ip_blocking_enabled: enabled,
          ip_tracking_enabled: enabled,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to toggle IP blocking' });
    }
  }

  /**
   * GET /api/admin/rounds
   * List all rounds (including inactive, with story fragments)
   */
  static async getRounds(req: Request, res: Response): Promise<void> {
    try {
      const data = await challengeService.getRoundsAdmin();
      res.status(200).json({
        success: true,
        message: 'Rounds fetched successfully',
        data,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch rounds' });
    }
  }

  /**
   * POST /api/admin/rounds
   */
  static async createRound(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = createRoundSchema.parse(req.body);
      const data = await challengeService.createRound(validatedData as any);
      await logAdminActivity(req, 'CREATE_ROUND', { name: data.name, order_number: data.order_number });

      res.status(201).json({
        success: true,
        message: `Round '${data.name}' created successfully`,
        data,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: 'Validation Error', details: error.errors });
        return;
      }
      res.status(500).json({ success: false, error: error.message || 'Failed to create round' });
    }
  }

  /**
   * PUT /api/admin/rounds/:id
   */
  static async updateRound(req: Request, res: Response): Promise<void> {
    try {
      const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!rawId) {
        res.status(400).json({ success: false, error: 'Round ID is required' });
        return;
      }
      const id: string = rawId;
      const validatedData = updateRoundSchema.parse(req.body);
      const data = await challengeService.updateRound(id, validatedData as any);

      if (!data) {
        res.status(404).json({ success: false, error: `Round '${id}' not found` });
        return;
      }

      await logAdminActivity(req, 'UPDATE_ROUND', { round_id: id, updates: validatedData });

      res.status(200).json({
        success: true,
        message: `Round '${id}' updated successfully`,
        data,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: 'Validation Error', details: error.errors });
        return;
      }
      res.status(500).json({ success: false, error: error.message || 'Failed to update round' });
    }
  }

  /**
   * DELETE /api/admin/rounds/:id
   */
  static async deleteRound(req: Request, res: Response): Promise<void> {
    try {
      const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!rawId) {
        res.status(400).json({ success: false, error: 'Round ID is required' });
        return;
      }
      const id: string = rawId;
      const success = await challengeService.deleteRound(id);

      if (!success) {
        res.status(404).json({ success: false, error: `Round '${id}' not found` });
        return;
      }

      await logAdminActivity(req, 'DELETE_ROUND', { round_id: id });

      res.status(200).json({
        success: true,
        message: `Round '${id}' deleted successfully`,
      });
    } catch (error: any) {
      if (error.message?.includes('Cannot delete round with')) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      res.status(500).json({ success: false, error: error.message || 'Failed to delete round' });
    }
  }

  /**
   * POST /api/admin/rounds/reorder
   * Reorder rounds via ordered UUID list
   */
  static async reorderRounds(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = reorderRoundsSchema.parse(req.body);
      const data = await challengeService.reorderRounds(validatedData.ordered_ids);

      await logAdminActivity(req, 'REORDER_ROUNDS', { ordered_ids: validatedData.ordered_ids });

      res.status(200).json({
        success: true,
        message: 'Rounds reordered successfully',
        data,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: 'Validation Error', details: error.errors });
        return;
      }
      res.status(500).json({ success: false, error: error.message || 'Failed to reorder rounds' });
    }
  }

  /**
   * GET /api/admin/challenges/round-timer
   * Get the current round timer config (duration, started_at, remaining).
   */
  static async getRoundTimer(req: Request, res: Response): Promise<void> {
    try {
      const data = getRoundTimerConfig();
      res.status(200).json({
        success: true,
        message: 'Round timer config fetched successfully',
        data,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch round timer config' });
    }
  }

  /**
   * POST /api/admin/challenges/round-timer
   * Set the round duration and/or start/reset the countdown. Persisted to
   * app_settings so the countdown survives page reloads and server restarts.
   */
  static async updateRoundTimer(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = updateRoundTimerSchema.parse(req.body);
      let data = getRoundTimerConfig();
      const applied: string[] = [];

      if (validatedData.duration_seconds !== undefined) {
        data = await setRoundDurationSeconds(validatedData.duration_seconds);
        applied.push(`duration=${validatedData.duration_seconds}s`);
      }
      if (validatedData.action === 'start') {
        data = await startRound();
        applied.push('started');
      } else if (validatedData.action === 'reset') {
        data = await resetRoundTimer();
        applied.push('reset');
      }

      await logAdminActivity(req, 'UPDATE_ROUND_TIMER', { ...validatedData });

      res.status(200).json({
        success: true,
        message: `Round timer updated (${applied.join(', ') || 'no changes'})`,
        data,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: 'Validation Error', details: error.errors });
        return;
      }
      res.status(500).json({ success: false, error: error.message || 'Failed to update round timer' });
    }
  }
}
