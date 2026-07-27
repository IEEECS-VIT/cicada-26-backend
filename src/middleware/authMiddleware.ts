import { Request, Response, NextFunction } from 'express';
import db, { supabase } from '../db.js';

// Simple in-memory session store
export const activeSessions = new Map<string, string>(); // token -> email

export const getCookie = (req: Request, name: string): string | undefined => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [key, val] = cookie.trim().split('=');
    if (key === name) return val;
  }
  return undefined;
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const godKey = req.headers['x-god-key'] || req.query.god_key || req.body?.x_god_key;
    const adminKey = req.headers['x-admin-key'] || req.query.admin_key || req.body?.x_admin_key;
    const expectedGodKey = process.env.GOD_API_KEY || 'god_secret_CICADA_SUPER_ADMIN_2067';
    const expectedAdminKey = process.env.ADMIN_API_KEY || 'sb_secret_PDPDEMJYJko0s5Bg7fP_GQ_hO5TgW09';

    // 1. Allow Master API Keys (Admin / GOD bypass)
    if ((godKey && godKey === expectedGodKey) || (adminKey && adminKey === expectedAdminKey)) {
      return next();
    }

    // Check Session Token Cookie
    const sessionToken = getCookie(req, 'session_token');
    if (sessionToken) {
      const email = activeSessions.get(sessionToken);
      if (email) {
        const dbUser = await db.users.findByEmail(email);
        if (dbUser) {
          (req as any).user = dbUser;
          return next();
        }
      }
    }

    // 2. Check Bearer Token (Active Supabase Session)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user: authUser }, error } = await supabase.auth.getUser(token);
      if (!error && authUser?.email) {
        const dbUser = await db.users.findByEmail(authUser.email);
        if (dbUser) {
          (req as any).user = dbUser;
          return next();
        }
      }
    }

    // 3. Check Active Session User Email Header / Body / Query
    const userEmail = (req.headers['x-user-email'] || req.body?.user_email || req.body?.email || req.query?.user_email || req.query?.email) as string;
    if (userEmail && typeof userEmail === 'string' && userEmail.trim()) {
      const dbUser = await db.users.findByEmail(userEmail.trim().toLowerCase());
      if (dbUser) {
        (req as any).user = dbUser;
        return next();
      }
    }

    // 4. Check Active Session User ID Header / Body / Query
    const userId = (req.headers['x-user-id'] || req.body?.user_id || req.query?.user_id) as string;
    if (userId && typeof userId === 'string' && userId.trim()) {
      const dbUser = await db.users.findById(userId.trim());
      if (dbUser) {
        (req as any).user = dbUser;
        return next();
      }
    }
  } catch (e) {
    // Fall through to unauthorized
  }

  res.status(401).json({
    success: false,
    error: 'Unauthorized: Authentication required. Please log in to access this route.',
  });
};

export const requireUserAuth = requireAuth;

export const requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const godKey = req.headers['x-god-key'] || req.query.god_key || req.body?.x_god_key;
    const adminKey = req.headers['x-admin-key'] || req.query.admin_key || req.body?.x_admin_key;
    const expectedGodKey = process.env.GOD_API_KEY || 'god_secret_CICADA_SUPER_ADMIN_2067';
    const expectedAdminKey = process.env.ADMIN_API_KEY || 'sb_secret_PDPDEMJYJko0s5Bg7fP_GQ_hO5TgW09';

    // 1. Check Master Keys (GOD or Admin)
    if ((godKey && godKey === expectedGodKey) || (adminKey && adminKey === expectedAdminKey)) {
      return next();
    }

    // Check Session Token Cookie
    const sessionToken = getCookie(req, 'session_token');
    if (sessionToken) {
      const email = activeSessions.get(sessionToken);
      if (email) {
        const dbUser = await db.users.findByEmail(email);
        if (dbUser && (dbUser.role === 'admin' || dbUser.role === 'GOD') && dbUser.is_admin_approved !== false) {
          return next();
        }
      }
    }

    // 2. Check Bearer Token (Active Supabase Session)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user: authUser } } = await supabase.auth.getUser(token);
      if (authUser?.email) {
        const dbUser = await db.users.findByEmail(authUser.email);
        if (dbUser && (dbUser.role === 'admin' || dbUser.role === 'GOD') && dbUser.is_admin_approved !== false) {
          return next();
        }
      }
    }

    // 3. Check Active Session User Email Header (x-user-email)
    const userEmail = (req.headers['x-user-email'] || req.body?.admin_email) as string;
    if (userEmail) {
      const dbUser = await db.users.findByEmail(userEmail);
      if (dbUser && (dbUser.role === 'admin' || dbUser.role === 'GOD') && dbUser.is_admin_approved !== false) {
        return next();
      }
    }

    // 4. Check Active Session User ID Header (x-user-id / admin_user_id)
    const userId = (req.headers['x-user-id'] || req.body?.admin_user_id || req.query?.admin_user_id) as string;
    if (userId) {
      const dbUser = await db.users.findById(userId);
      if (dbUser && (dbUser.role === 'admin' || dbUser.role === 'GOD') && dbUser.is_admin_approved !== false) {
        return next();
      }
    }
  } catch (e) {
    // Fall through to unauthorized
  }

  res.status(401).json({
    success: false,
    error: 'Unauthorized: Active Admin/GOD session, valid API key, or privileges required',
  });
};

export const requireGod = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const godKey = req.headers['x-god-key'] || req.query.god_key || req.body?.x_god_key;
    const expectedGodKey = process.env.GOD_API_KEY || 'god_secret_CICADA_SUPER_ADMIN_2067';

    // 1. Check Master GOD Key
    if (godKey && godKey === expectedGodKey) {
      return next();
    }

    // Check Session Token Cookie
    const sessionToken = getCookie(req, 'session_token');
    if (sessionToken) {
      const email = activeSessions.get(sessionToken);
      if (email) {
        const dbUser = await db.users.findByEmail(email);
        if (dbUser && dbUser.role === 'GOD') {
          return next();
        }
      }
    }

    // 2. Check Bearer Token (Active Supabase Session for GOD role)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user: authUser } } = await supabase.auth.getUser(token);
      if (authUser?.email) {
        const dbUser = await db.users.findByEmail(authUser.email);
        if (dbUser && dbUser.role === 'GOD') {
          return next();
        }
      }
    }

    // 3. Check Active Session User Email Header (x-user-email)
    const userEmail = (req.headers['x-user-email'] || req.body?.god_email || req.body?.admin_email) as string;
    if (userEmail) {
      const dbUser = await db.users.findByEmail(userEmail);
      if (dbUser && dbUser.role === 'GOD') {
        return next();
      }
    }

    // 4. Check Active Session User ID Header
    const userId = (req.headers['x-user-id'] || req.body?.god_user_id || req.query?.god_user_id) as string;
    if (userId) {
      const dbUser = await db.users.findById(userId);
      if (dbUser && dbUser.role === 'GOD') {
        return next();
      }
    }
  } catch (e) {
    // Fall through to unauthorized
  }

  res.status(403).json({
    success: false,
    error: 'Forbidden: GOD (Super Admin) privileges or valid x-god-key required',
  });
};
