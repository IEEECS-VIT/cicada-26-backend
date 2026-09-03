import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db, { supabaseAnon } from '../../db.js';
import { activeSessions, getCookie, createSignedSessionToken, verifySignedSessionToken } from '../../middleware/authMiddleware.js';

const SESSION_TTL_MS = (parseInt(process.env.SESSION_TTL_MINUTES || '30', 10)) * 60 * 1000;

export class UserAuthController {
  /**
   * POST /api/auth/seed-user
   * ADMIN-ONLY: Add a participant email to the whitelist.
   * This route is protected by requireAdmin in the router.
   * Participants CANNOT register themselves as admin — role is always forced to 'participant'.
   */
  static async seedUser(req: Request, res: Response): Promise<void> {
    const { email, display_name, register_no } = req.body;
    try {
      if (!email || !email.trim()) {
        res.status(400).json({ success: false, error: 'Email is required.' });
        return;
      }

      // Hardcode role to participant ONLY. Admin registration via public API is forbidden.
      const finalRole: 'participant' = 'participant';
      const id = uuidv4();
      await db.users.seedUser(id, email.trim(), display_name || null, register_no || null, finalRole);

      res.json({
        success: true,
        message: 'User added to whitelist!',
        id,
        role: finalRole,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/auth/login
   * Public user login endpoint. Authenticates user via Supabase access_token.
   * Returns a server-issued session_token (valid for SESSION_TTL_MINUTES).
   */
  static async login(req: Request, res: Response): Promise<void> {
    const { access_token } = req.body;
    try {
      // access_token (Supabase JWT) is the ONLY accepted authentication method.
      if (!access_token) {
        res.status(400).json({ success: false, error: 'Missing access_token. A valid Supabase access token is required.' });
        return;
      }

      const { data: { user: authUser }, error } = await supabaseAnon.auth.getUser(access_token);
      if (error || !authUser || !authUser.email) {
        res.status(401).json({ success: false, error: 'Invalid or expired Supabase access token.' });
        return;
      }

      const email = authUser.email;
      const google_display_name = authUser.user_metadata?.full_name || authUser.user_metadata?.name || '';

      let user = await db.users.findByEmail(email);
      if (!user) {
        res.status(403).json({
          success: false,
          error: `UNAUTHORIZED: Your email (${email}) is not whitelisted for Cicada 2067. Contact an admin.`,
        });
        return;
      }

      // Auto-update display name on first login if not already set
      if (!user.display_name && google_display_name) {
        await db.users.updateDisplayName(user.id, google_display_name);
        user.display_name = google_display_name;
      }

      const isGod = user.role === 'GOD';
      const isAdmin = user.role === 'admin' || isGod;

      // Issue a server-side session token with TTL
      const sessionToken = createSignedSessionToken(email);

      // Set HttpOnly cookie (not readable by JS)
      res.cookie('session_token', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' || process.env.RENDER === 'true',
        sameSite: (process.env.NODE_ENV === 'production' || process.env.RENDER === 'true') ? 'none' : 'lax',
        maxAge: SESSION_TTL_MS,
        path: '/',
      });

      res.json({
        success: true,
        message: 'Login successful!',
        is_authenticated: true,
        role: user.role,
        user: {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          register_no: user.register_no,
          role: user.role,
          team_id: user.team_id,
        },
        // NOTE: admin_secret_key is the ADMIN_API_KEY from .env.
        // Only sent to approved admins so the frontend can set x-admin-key header.
        // Do NOT log or expose this value publicly.
        admin_secret_key: isAdmin ? process.env.ADMIN_API_KEY : null,
        is_approved_admin: isAdmin,
        session_expires_in_minutes: parseInt(process.env.SESSION_TTL_MINUTES || '30', 10),
        redirectUrl: isGod ? '/god-portal' : isAdmin ? '/admin-portal' : '/dashboard',
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/auth/verify-login (Alias for login)
   */
  static async verifyLogin(req: Request, res: Response): Promise<void> {
    return UserAuthController.login(req, res);
  }

  /**
   * GET /api/auth/me
   * Retrieve profile of the authenticated user (requires auth middleware).
   */
  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ success: false, error: 'Unauthorized: No authenticated user found.' });
        return;
      }

      // Auto-sync session token if missing or expired (e.g. user authenticated via Supabase JWT on refresh)
      const currentToken = getCookie(req, 'session_token');
        if (!currentToken || !verifySignedSessionToken(currentToken)) {
          const sessionToken = createSignedSessionToken(user.email);
        res.cookie('session_token', sessionToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production' || process.env.RENDER === 'true',
          sameSite: (process.env.NODE_ENV === 'production' || process.env.RENDER === 'true') ? 'none' : 'lax',
          maxAge: SESSION_TTL_MS,
          path: '/',
        });
      }

      let teamName: string | null = null;
      let inviteCode: string | null = null;
      if (user.team_id) {
        const team = await db.teams.findById(user.team_id);
        if (team) {
          teamName = team.name;
          inviteCode = team.invite_code;
        }
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          register_no: user.register_no,
          role: user.role,
          team_id: user.team_id,
          team_name: teamName,
          invite_code: inviteCode,
          created_at: user.created_at,
          joined_team_at: user.joined_team_at,
        },
        team_name: teamName,
        invite_code: inviteCode
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/auth/logout
   * Invalidate the current session token.
   */
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      const sessionToken = getCookie(req, 'session_token');
      if (sessionToken) {
        activeSessions.delete(sessionToken);
      }
      res.clearCookie('session_token', { path: '/' });
      res.json({ success: true, message: 'Logged out successfully.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
