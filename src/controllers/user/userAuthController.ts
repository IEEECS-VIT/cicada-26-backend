import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db, { supabase } from '../../db.js';

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
   * POST /api/auth/verify-login
   * Public participant login verification via Supabase access token or whitelisted email.
   */
  static async verifyLogin(req: Request, res: Response): Promise<void> {
    const { access_token, email: bodyEmail, google_display_name: bodyName } = req.body;
    try {
      let email = bodyEmail;
      let google_display_name = bodyName || '';

      if (access_token) {
        const { data: { user: authUser }, error } = await supabase.auth.getUser(access_token);
        if (error || !authUser || !authUser.email) {
          res.status(401).json({ success: false, error: 'Invalid or expired Google Auth token.' });
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

      const isAdmin = user.role === 'admin';
      const isApprovedAdmin = isAdmin && user.is_admin_approved !== false;
      const adminSecretKey = isApprovedAdmin ? (process.env.ADMIN_API_KEY || 'sb_secret_PDPDEMJYJko0s5Bg7fP_GQ_hO5TgW09') : null;

      res.json({
        success: true,
        message: isApprovedAdmin ? 'Login successful! Admin access granted.' : 'Login successful!',
        user,
        admin_secret_key: adminSecretKey,
        is_approved_admin: isApprovedAdmin,
        redirectUrl: isApprovedAdmin ? '/admin-portal' : '/dashboard',
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
