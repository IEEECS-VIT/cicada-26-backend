import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db, { supabase } from '../../db.js';
import { activeSessions } from '../../middleware/authMiddleware.js';

export class UserAuthController {
  /**
   * POST /api/auth/seed-user
   * Public participant whitelist/seed endpoint.
   * STRICT CONSTRAINT: Participants CANNOT register as admin. Force role to 'participant'.
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
      await db.users.seedUser(id, email.trim(), display_name || null, register_no || null, finalRole, true);

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
   * Public user login endpoint. Authenticates user via Google OAuth access_token or whitelisted email.
   */
  static async login(req: Request, res: Response): Promise<void> {
    const { access_token, email: bodyEmail, google_display_name: bodyName } = req.body;
    try {
      let email = bodyEmail;
      let google_display_name = bodyName || '';

      if (access_token) {
        const { data: { user: authUser }, error } = await supabase.auth.getUser(access_token);
        if (error || !authUser || !authUser.email) {
          res.status(401).json({ success: false, error: 'Invalid or expired Auth token.' });
          return;
        }
        email = authUser.email;
        google_display_name = authUser.user_metadata?.full_name || authUser.user_metadata?.name || '';
      } else if (!email) {
        res.status(400).json({ success: false, error: 'Missing access_token or email.' });
        return;
      }

      let user = await db.users.findByEmail(email);
      if (!user) {
        res.status(403).json({
          success: false,
          error: `UNAUTHORIZED: Your email (${email}) is not whitelisted for Cicada 2067.`,
        });
        return;
      }

      if (!user.display_name && google_display_name) {
        await db.users.updateDisplayName(user.id, google_display_name);
        user.display_name = google_display_name;
      }

      const isGod = user.role === 'GOD';
      const isAdmin = user.role === 'admin' || isGod;
      const isApprovedAdmin = isAdmin && user.is_admin_approved !== false;
      const adminSecretKey = isApprovedAdmin ? (process.env.ADMIN_API_KEY || 'sb_secret_PDPDEMJYJko0s5Bg7fP_GQ_hO5TgW09') : null;

      const sessionToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
      activeSessions.set(sessionToken, email);
      res.cookie('session_token', sessionToken, { httpOnly: true, secure: false, path: '/' });

      res.json({
        success: true,
        message: 'Login successful!',
        is_authenticated: true,
        role: user.role,
        user,
        admin_secret_key: adminSecretKey,
        is_approved_admin: isApprovedAdmin,
        redirectUrl: isGod ? '/god-portal' : isApprovedAdmin ? '/admin-portal' : '/dashboard',
        session_token: sessionToken,
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
   * Retrieve the profile details of the logged-in user and their team.
   */
  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ success: false, error: 'Unauthorized: No user found in request session.' });
        return;
      }

      let teamName: string | null = null;
      if (user.team_id) {
        const team = await db.teams.findById(user.team_id);
        teamName = team ? team.name : null;
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          register_no: user.register_no,
          role: user.role,
          created_at: user.created_at,
          joined_team_at: user.joined_team_at,
        },
        team_name: teamName,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
