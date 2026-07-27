import { Request, Response } from 'express';
import db, { supabase } from '../../db.js';

export class GodAuthController {
  /**
   * POST /api/god/auth/verify-login
   * Dedicated Super Admin ('GOD') login verification route.
   */
  static async verifyLogin(req: Request, res: Response): Promise<void> {
    const { access_token, email: bodyEmail } = req.body;
    try {
      const godKeyHeader = req.headers['x-god-key'] || req.body?.x_god_key;
      const expectedGodKey = process.env.GOD_API_KEY || 'god_secret_CICADA_SUPER_ADMIN_2067';
      const isGodKeyValid = godKeyHeader && godKeyHeader === expectedGodKey;

      let email = bodyEmail;

      if (access_token) {
        const { data: { user: authUser }, error } = await supabase.auth.getUser(access_token);
        if (error || !authUser || !authUser.email) {
          res.status(401).json({ success: false, error: 'Invalid or expired Auth token.' });
          return;
        }
        email = authUser.email;
      }

      if (!email && !isGodKeyValid) {
        res.status(400).json({ success: false, error: 'Missing access_token, email, or valid x-god-key header.' });
        return;
      }

      let user = email ? await db.users.findByEmail(email) : null;

      if (isGodKeyValid && user && user.role !== 'GOD') {
        await db.users.updateRole(user.id, 'GOD');
        user.role = 'GOD';
      }

      const isGodUser = (user && user.role === 'GOD') || Boolean(isGodKeyValid);

      if (!isGodUser) {
        res.status(403).json({
          success: false,
          error: `FORBIDDEN: User '${email || 'Unknown'}' does not have Super Admin ('GOD') privileges.`,
        });
        return;
      }

      res.json({
        success: true,
        message: 'Welcome GOD! Super Admin verification successful.',
        role: 'GOD',
        god_secret_key: expectedGodKey,
        user,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/god/auth/grant-god-role
   * Grant Super Admin ('GOD') role to a user.
   */
  static async grantGodRole(req: Request, res: Response): Promise<void> {
    const { target_user_id, target_email } = req.body;
    try {
      let targetId = target_user_id;
      if (!targetId && target_email) {
        const targetUser = await db.users.findByEmail(target_email);
        if (!targetUser) {
          res.status(404).json({ success: false, error: `User '${target_email}' not found.` });
          return;
        }
        targetId = targetUser.id;
      }

      if (!targetId) {
        res.status(400).json({ success: false, error: 'Either target_user_id or target_email is required.' });
        return;
      }

      await db.users.updateRole(targetId, 'GOD');
      res.json({
        success: true,
        message: `User '${targetId}' has been elevated to Super Admin ('GOD')!`,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
