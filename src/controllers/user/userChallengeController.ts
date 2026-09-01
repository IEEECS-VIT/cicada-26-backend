import { Request, Response } from 'express';
import { z } from 'zod';
import { challengeService } from '../../services/challengeService.js';
import db from '../../db.js';
import { getRoundTimerConfig } from '../../services/roundTimerService.js';

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

const MAX_ASSET_BYTES = 20 * 1024 * 1024; // 20MB
const ASSET_FETCH_TIMEOUT_MS = 15000;

const getAllowedAssetHosts = (): Set<string> => {
  const hosts = new Set<string>();
  const supabaseUrl = process.env.SUPABASE_URL;
  if (supabaseUrl) {
    try {
      hosts.add(new URL(supabaseUrl).hostname);
    } catch {
      // ignore malformed SUPABASE_URL
    }
  }
  const extra = process.env.ASSET_ALLOWED_HOSTS;
  if (extra) {
    for (const h of extra.split(',')) {
      const host = h.trim();
      if (host) hosts.add(host);
    }
  }
  return hosts;
};

const validateAssetUrl = (rawUrl: string): URL => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Invalid asset URL');
  }

  const isDev = process.env.NODE_ENV !== 'production';
  const isLocalHttp = url.protocol === 'http:'
    && isDev
    && (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1');

  if (url.protocol !== 'https:' && !isLocalHttp) {
    throw new Error('Asset URL must use HTTPS');
  }

  const allowedHosts = getAllowedAssetHosts();
  if (allowedHosts.size > 0 && !allowedHosts.has(url.hostname)) {
    throw new Error('Asset URL host is not allowed');
  }

  return url;
};

// CHANGE 3+4: Answer submission now uses team_id from authenticated user — NOT body team_name
const submitAnswerSchema = z.object({
  challenge_identifier: z.union([z.string(), z.number()]),
  answer: z.string({ required_error: 'Answer is required' }),
});

export class UserChallengeController {
  /**
   * GET /api/challenges
   * List all active public challenges.
   * CHANGE 3: Team context derived from req.user.team_id — not query param.
   */
  static async getPublicChallenges(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      let team_name: string | undefined;

      // CHANGE 3: Resolve team name from authenticated user's team_id only
      if (user?.team_id) {
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
      if (error.message?.startsWith('IP_MISMATCH:')) {
        const expectedIp = error.message.split(':')[1];
        res.status(403).json({
          success: false,
          error: `Access Denied: IP address mismatch. This challenge is locked to another location (${expectedIp}).`,
        });
        return;
      }
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch challenges' });
    }
  }

  /**
   * GET /api/challenges/rounds
   * List rounds with per-team lock state. A round's story fragment is only
   * revealed once the team has entered it.
   */
  static async getPublicRounds(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      let team_name: string | undefined;

      if (user?.team_id) {
        const team = await db.teams.findById(user.team_id);
        if (team) team_name = team.name;
      }

      const data = await challengeService.getPublicRounds(team_name);
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
   * GET /api/challenges/progress
   * CHANGE 3+4: Progress can only be fetched for the authenticated user's own team.
   * No team_name query param accepted — prevents spying on other teams.
   */
  static async getParticipantProgress(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;

      if (!user?.team_id) {
        res.status(400).json({
          success: false,
          error: 'You are not currently in a team. Join or create a team first.',
        });
        return;
      }

      // CHANGE 4: Only fetch progress for the user's OWN team
      const team = await db.teams.findById(user.team_id);
      if (!team) {
        res.status(404).json({ success: false, error: 'Your team could not be found.' });
        return;
      }

      const data = await challengeService.getParticipantProgress(team.name);
      res.status(200).json({
        success: true,
        message: 'Team progress fetched successfully',
        data,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch participant progress' });
    }
  }

  /**
   * GET /api/challenges/round-timer
   * Round countdown config. remaining_seconds is computed server-side from the
   * persisted round_started_at + round_duration_seconds, so the participant
   * timer never restarts on a page reload.
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
   * GET /api/challenges/story-fragments
   * CHANGE 3+4: Only returns story fragments for the authenticated user's own team.
   */
  static async getUnlockedStoryFragments(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;

      if (!user?.team_id) {
        res.status(400).json({
          success: false,
          error: 'You are not in a team. Join or create a team to view story fragments.',
        });
        return;
      }

      // CHANGE 4: Only fetch fragments for the user's OWN team
      const team = await db.teams.findById(user.team_id);
      if (!team) {
        res.status(404).json({ success: false, error: 'Your team could not be found.' });
        return;
      }

      const data = await challengeService.getUnlockedStoryFragments(team.name);
      res.status(200).json({
        success: true,
        message: 'Unlocked story fragments fetched successfully',
        data,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch story fragments' });
    }
  }

  /**
   * GET /api/challenges/:identifier
   * CHANGE 3: Team context from req.user.team_id — no query param override.
   */
  static async getPublicChallenge(req: Request, res: Response): Promise<void> {
    try {
      const rawIdentifier = Array.isArray(req.params.identifier) ? req.params.identifier[0] : req.params.identifier;
      if (!rawIdentifier) {
        res.status(400).json({ success: false, error: 'Challenge identifier is required' });
        return;
      }

      const user = (req as any).user;
      let team_name: string | undefined;

      // CHANGE 3: Resolve team name from authenticated user's team_id only
      if (user?.team_id) {
        const team = await db.teams.findById(user.team_id);
        if (team) team_name = team.name;
      }

      const data = await challengeService.getPublicChallenge(rawIdentifier, team_name, getClientIp(req));
      if (!data) {
        res.status(404).json({ success: false, error: `Challenge '${rawIdentifier}' not found or inactive` });
        return;
      }

      if (data.is_locked) {
        res.status(400).json({
          success: false,
          error: `Challenge '${rawIdentifier}' is locked for your team. Complete previous challenges first.`,
          data: { id: data.id, order_number: data.order_number, name: data.name, is_locked: true },
        });
        return;
      }

      res.status(200).json({ success: true, message: `Challenge fetched successfully`, data });
    } catch (error: any) {
      if (error.message?.startsWith('IP_MISMATCH:')) {
        const expectedIp = error.message.split(':')[1];
        res.status(403).json({
          success: false,
          error: `Access Denied: IP address mismatch. This challenge is locked to another location (${expectedIp}).`,
        });
        return;
      }
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch challenge' });
    }
  }

  /**
   * POST /api/challenges/submit
   * CHANGE 3+4: team_name is NEVER accepted from request body.
   * The team is identified exclusively by the authenticated user's team_id.
   * This prevents any team from submitting answers on behalf of another team.
   */
  static async submitAnswer(req: Request, res: Response): Promise<void> {
    try {
      // CHANGE 3+4: Get team from authenticated user — not from body
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ success: false, error: 'Unauthorized: Authentication required.' });
        return;
      }

      if (!user.team_id) {
        res.status(400).json({
          success: false,
          error: 'You must be in a team to submit answers. Create or join a team first.',
        });
        return;
      }

      // CHANGE 4: Resolve team name from DB using the authenticated user's team_id
      const team = await db.teams.findById(user.team_id);
      if (!team) {
        res.status(404).json({ success: false, error: 'Your team could not be found. Contact an admin.' });
        return;
      }

      // Validate only challenge_identifier and answer from body — team_name is intentionally excluded
      const validatedData = submitAnswerSchema.parse(req.body);

      const result = await challengeService.submitAnswer(
        {
          team_name: team.name, // Resolved server-side from team_id — never from client
          challenge_identifier: validatedData.challenge_identifier,
          answer: validatedData.answer,
          team_id: team.id,
          user_id: user.id,
        },
        getClientIp(req)
      );

      if (result.success) {
        res.status(200).json({
          success: true,
          message: result.message,
          unlocked_next_challenge: result.unlocked_next_challenge,
          story_fragment: result.story_fragment || null,
          already_solved: !!result.already_solved,
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
        res.status(400).json({ success: false, error: 'Validation Error', details: error.errors });
        return;
      }
      res.status(500).json({ success: false, error: error.message || 'Failed to process submission' });
    }
  }

  /**
   * GET /api/challenges/assets/masked
   * Stream/proxy a challenge asset to mask the origin URL.
   * CHANGE 3+4: Team verified from req.user.team_id.
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

      // CHANGE 3+4: Resolve team from authenticated user only
      const user = (req as any).user;
      if (!user?.team_id) {
        res.status(403).json({ success: false, error: 'Access Denied: You must be in a team to view assets.' });
        return;
      }

      const team = await db.teams.findById(user.team_id);
      if (!team) {
        res.status(403).json({ success: false, error: 'Access Denied: Your team could not be found.' });
        return;
      }

      const challenge = await challengeService.getPublicChallenge(challengeId, team.name, getClientIp(req));
      if (!challenge) {
        res.status(404).json({ success: false, error: 'Challenge not found or locked' });
        return;
      }

      if (challenge.is_locked) {
        res.status(403).json({ success: false, error: 'Access Denied: Challenge is locked for your team.' });
        return;
      }

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

      let assetUrl: URL;
      try {
        assetUrl = validateAssetUrl(asset.url);
      } catch (err: any) {
        res.status(400).json({ success: false, error: err.message || 'Invalid asset URL' });
        return;
      }

      let assetResponse: globalThis.Response;
      try {
        assetResponse = await fetch(assetUrl.toString(), {
          redirect: 'manual',
          signal: AbortSignal.timeout(ASSET_FETCH_TIMEOUT_MS),
        });
      } catch (err: any) {
        if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
          res.status(504).json({ success: false, error: 'Asset fetch timed out' });
        } else {
          res.status(502).json({ success: false, error: 'Failed to retrieve asset from origin storage' });
        }
        return;
      }

      if (assetResponse.status >= 300 && assetResponse.status < 400) {
        res.status(502).json({ success: false, error: 'Asset redirects are not allowed' });
        return;
      }

      if (!assetResponse.ok) {
        res.status(404).json({ success: false, error: 'Failed to retrieve asset from origin storage' });
        return;
      }

      const contentLength = assetResponse.headers.get('content-length');
      if (contentLength) {
        const size = parseInt(contentLength, 10);
        if (!isNaN(size) && size > MAX_ASSET_BYTES) {
          res.status(413).json({ success: false, error: 'Asset is too large' });
          return;
        }
      }

      const arrayBuffer = await assetResponse.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_ASSET_BYTES) {
        res.status(413).json({ success: false, error: 'Asset is too large' });
        return;
      }

      const contentType = assetResponse.headers.get('content-type') || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);

      res.send(Buffer.from(arrayBuffer));
    } catch (error: any) {
      if (error.message?.startsWith('IP_MISMATCH:')) {
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
