import { Request, Response, NextFunction } from 'express';
import db, { supabase } from '../db.js';

export const requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const adminKey = req.headers['x-admin-key'] || req.query.admin_key || req.body?.x_admin_key;
    const expectedKey = process.env.ADMIN_API_KEY || 'sb_secret_PDPDEMJYJko0s5Bg7fP_GQ_hO5TgW09';

    // 1. Check Master Admin Key
    if (adminKey && adminKey === expectedKey) {
      return next();
    }

    // 2. Check Bearer Token (Active Supabase Session)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user: authUser } } = await supabase.auth.getUser(token);
      if (authUser?.email) {
        const dbUser = await db.users.findByEmail(authUser.email);
        if (dbUser && dbUser.role === 'admin' && dbUser.is_admin_approved !== false) {
          return next();
        }
      }
    }

    // 3. Check Active Session User Email Header (x-user-email)
    const userEmail = (req.headers['x-user-email'] || req.body?.admin_email) as string;
    if (userEmail) {
      const dbUser = await db.users.findByEmail(userEmail);
      if (dbUser && dbUser.role === 'admin' && dbUser.is_admin_approved !== false) {
        return next();
      }
    }

    // 4. Check Active Session User ID Header (x-user-id / admin_user_id)
    const userId = (req.headers['x-user-id'] || req.body?.admin_user_id || req.query?.admin_user_id) as string;
    if (userId) {
      const dbUser = await db.users.findById(userId);
      if (dbUser && dbUser.role === 'admin' && dbUser.is_admin_approved !== false) {
        return next();
      }
    }
  } catch (e) {
    // Fall through to unauthorized
  }

  res.status(401).json({
    success: false,
    error: 'Unauthorized: Active Admin session, valid x-admin-key, or Admin user privileges required',
  });
};
