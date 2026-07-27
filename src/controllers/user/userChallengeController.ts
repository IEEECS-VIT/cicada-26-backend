import { Request, Response } from 'express';
import { z } from 'zod';
import { challengeService } from '../../services/challengeService.js';
import db from '../../db.js';

const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = typeof forwarded === 'string' 
      ? forwarded.split(',')[0]?.trim() 
      : (Array.isArray(forwarded) ? forwarded[0]?.trim() : undefined);
    if (ip) return ip;
  }
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
};

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
      const user = (req as any).user;
      let team_name = req.query.team_name ? String(req.query.team_name) : undefined;
      if (!team_name && user && user.team_id) {
        const team = await db.teams.findById(user.team_id);
        if (team) {
          team_name = team.name;
        }
      }
      const data = await challengeService.getPublicChallenges(team_name, getClientIp(req));
      res.status(200).json({
        success: true,
        message: 'Active challenges fetched successfully',
        data,
      });
    } catch (error: any) {
      if (error.message && error.message.startsWith('IP_MISMATCH:')) {
        const expectedIp = error.message.split(':')[1];
        res.status(403).json({
          success: false,
          error: `Access Denied: IP address mismatch. This challenge is locked to another location (${expectedIp}).`,
        });
        return;
      }
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
      const user = (req as any).user;
      let team_name = String(req.query.team_name || req.params.team_name || '');
      if (!team_name.trim() && user && user.team_id) {
        const team = await db.teams.findById(user.team_id);
        if (team) {
          team_name = team.name;
        }
      }
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
      const user = (req as any).user;
      let team_name = String(req.query.team_name || req.params.team_name || '');
      if (!team_name.trim() && user && user.team_id) {
        const team = await db.teams.findById(user.team_id);
        if (team) {
          team_name = team.name;
        }
      }
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
      const user = (req as any).user;
      let team_name = req.query.team_name ? String(req.query.team_name) : undefined;
      if (!team_name && user && user.team_id) {
        const team = await db.teams.findById(user.team_id);
        if (team) {
          team_name = team.name;
        }
      }
      const data = await challengeService.getPublicChallenge(identifier, team_name, getClientIp(req));

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
          error: `Challenge '${identifier}' is locked for team '${team_name || 'unknown'}'. Complete previous challenges first.`,
          data: {
            id: data.id,
            order_number: data.order_number,
            name: data.name,
            is_locked: true,
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: `Challenge '${identifier}' fetched successfully`,
        data,
      });
    } catch (error: any) {
      if (error.message && error.message.startsWith('IP_MISMATCH:')) {
        const expectedIp = error.message.split(':')[1];
        res.status(403).json({
          success: false,
          error: `Access Denied: IP address mismatch. This challenge is locked to another location (${expectedIp}).`,
        });
        return;
      }
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
      const result = await challengeService.submitAnswer(validatedData, getClientIp(req));

      if (result.success) {
        res.status(200).json({
          success: true,
          message: result.message,
          unlocked_next_challenge: result.unlocked_next_challenge,
          story_fragment: result.story_fragment || null,
          data: result,
        });
      } else {
        const status = result.message.startsWith('Access Denied') ? 403 : 400;
        res.status(status).json({
          success: false,
          message: result.message,
          error: result.message,
          tryAgain: result.tryAgain ?? true,
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

  /**
   * GET /api/challenges/assets/masked
   * Stream/Proxy a challenge asset to mask the origin URL
   */
  static async viewMaskedAsset(req: Request, res: Response): Promise<void> {
    try {
      const challengeId = req.query.c ? String(req.query.c) : undefined;
      const assetIndexStr = req.query.i ? String(req.query.i) : undefined;

      if (!challengeId || !assetIndexStr) {
        res.status(400).json({ success: false, error: 'Challenge ID (c) and Asset Index (i) are required' });
        return;
      }

      const assetIndex = parseInt(assetIndexStr, 10);
      if (isNaN(assetIndex)) {
        res.status(400).json({ success: false, error: 'Asset Index must be an integer' });
        return;
      }

      const user = (req as any).user;
      let team_name = '';
      if (user && user.team_id) {
        const team = await db.teams.findById(user.team_id);
        if (team) {
          team_name = team.name;
        }
      }

      if (!team_name) {
        res.status(403).json({ success: false, error: 'Access Denied: You must be in a team to view assets.' });
        return;
      }

      // Fetch challenge to enforce lock and IP validation rules
      const challenge = await challengeService.getPublicChallenge(challengeId, team_name, getClientIp(req));
      if (!challenge) {
        res.status(404).json({ success: false, error: 'Challenge not found or locked' });
        return;
      }

      if (challenge.is_locked) {
        res.status(403).json({ success: false, error: 'Access Denied: Challenge is locked for your team.' });
        return;
      }

      // Fetch full challenge from DB to get the original/raw asset URL
      const fullChallenge = await db.challenges.findById(challenge.id) as any;
      if (!fullChallenge) {
        res.status(404).json({ success: false, error: 'Challenge not found' });
        return;
      }

      const assets = fullChallenge.assets || [];
      const asset = assets[assetIndex];
      if (!asset || !asset.url) {
        res.status(404).json({ success: false, error: 'Asset not found or does not have a URL' });
        return;
      }

      // Fetch the asset resource on the backend server
      const response = await fetch(asset.url);
      if (!response.ok) {
        res.status(404).json({ success: false, error: 'Failed to retrieve asset from origin storage' });
        return;
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);

      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error: any) {
      if (error.message && error.message.startsWith('IP_MISMATCH:')) {
        const expectedIp = error.message.split(':')[1];
        res.status(403).json({
          success: false,
          error: `Access Denied: IP address mismatch. This challenge is locked to another location (${expectedIp}).`,
        });
        return;
      }
      res.status(500).json({ success: false, error: error.message || 'Failed to stream asset' });
    }
  }
}
