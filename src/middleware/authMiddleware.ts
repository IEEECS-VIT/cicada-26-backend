import { Request, Response, NextFunction } from 'express';
import db, { supabase } from '../db.js';

// ---------------------------------------------------------------------------
// Session Store
// Stores: token -> { email, expiresAt }
// ---------------------------------------------------------------------------
interface SessionEntry {
  email: string;
  expiresAt: number; // Unix ms timestamp
}

export const activeSessions = new Map<string, SessionEntry>();

const SESSION_TTL_MS = (parseInt(process.env.SESSION_TTL_MINUTES || '30', 10)) * 60 * 1000;

// Clean up expired sessions periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of activeSessions.entries()) {
    if (now > entry.expiresAt) {
      activeSessions.delete(token);
    }
  }
}, 5 * 60 * 1000);

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

// ---------------------------------------------------------------------------
// Validate that all required env vars are present at startup
// ---------------------------------------------------------------------------
export const validateEnv = (): void => {
  const required = ['GOD_API_KEY', 'ADMIN_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `[STARTUP ERROR] Missing required environment variables: ${missing.join(', ')}. ` +
      `Please check your .env file.`
    );
  }
};

// ---------------------------------------------------------------------------
// requireAuth
// Accepts ONLY:
//   1. GOD/Admin API key headers (x-god-key / x-admin-key)
//   2. Supabase JWT via Authorization: Bearer <token>
//   3. Server-issued session_token cookie (with TTL)
//
// REMOVED insecure bypasses: x-user-email, x-user-id, body email/id
// ---------------------------------------------------------------------------
export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const godKey = req.headers['x-god-key'] as string | undefined;
    const adminKey = req.headers['x-admin-key'] as string | undefined;
    const expectedGodKey = process.env.GOD_API_KEY!;
    const expectedAdminKey = process.env.ADMIN_API_KEY!;

    // 1. Allow Master API Keys (Admin / GOD header bypass)
    if ((godKey && godKey === expectedGodKey) || (adminKey && adminKey === expectedAdminKey)) {
      return next();
    }

    // 2. Check server-issued session_token cookie
    const sessionToken = getCookie(req, 'session_token');
    if (sessionToken) {
      const entry = activeSessions.get(sessionToken);
      if (entry && Date.now() < entry.expiresAt) {
        const dbUser = await db.users.findByEmail(entry.email);
        if (dbUser) {
          (req as any).user = dbUser;
          return next();
        }
      } else if (entry) {
        // Token exists but expired — clean it up
        activeSessions.delete(sessionToken);
      }
    }

    // 3. Check Bearer Token (Supabase JWT) — PRIMARY auth method
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
  } catch (e) {
    // Fall through to unauthorized
  }

  res.status(401).json({
    success: false,
    error: 'Unauthorized: A valid Supabase access token (Bearer) or active session is required.',
  });
};

export const requireUserAuth = requireAuth;

// ---------------------------------------------------------------------------
// requireAdmin
// ---------------------------------------------------------------------------
export const requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const godKey = req.headers['x-god-key'] as string | undefined;
    const adminKey = req.headers['x-admin-key'] as string | undefined;
    const expectedGodKey = process.env.GOD_API_KEY!;
    const expectedAdminKey = process.env.ADMIN_API_KEY!;

    // 1. Check Master API Keys (GOD or Admin header)
    if ((godKey && godKey === expectedGodKey) || (adminKey && adminKey === expectedAdminKey)) {
      return next();
    }

    // 2. Check server-issued session_token cookie
    const sessionToken = getCookie(req, 'session_token');
    if (sessionToken) {
      const entry = activeSessions.get(sessionToken);
      if (entry && Date.now() < entry.expiresAt) {
        const dbUser = await db.users.findByEmail(entry.email);
        if (dbUser && (dbUser.role === 'admin' || dbUser.role === 'GOD') && dbUser.is_admin_approved !== false) {
          (req as any).user = dbUser;
          return next();
        }
      } else if (entry) {
        activeSessions.delete(sessionToken);
      }
    }

    // 3. Check Bearer Token (Supabase JWT)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user: authUser } } = await supabase.auth.getUser(token);
      if (authUser?.email) {
        const dbUser = await db.users.findByEmail(authUser.email);
        if (dbUser && (dbUser.role === 'admin' || dbUser.role === 'GOD') && dbUser.is_admin_approved !== false) {
          (req as any).user = dbUser;
          return next();
        }
      }
    }
  } catch (e) {
    // Fall through to unauthorized
  }

  res.status(401).json({
    success: false,
    error: 'Unauthorized: Active Admin/GOD session, valid API key, or privileges required.',
  });
};

// ---------------------------------------------------------------------------
// requireGod
// ---------------------------------------------------------------------------
export const requireGod = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const godKey = req.headers['x-god-key'] as string | undefined;
    const expectedGodKey = process.env.GOD_API_KEY!;

    // 1. Check Master GOD Key header
    if (godKey && godKey === expectedGodKey) {
      return next();
    }

    // 2. Check server-issued session_token cookie
    const sessionToken = getCookie(req, 'session_token');
    if (sessionToken) {
      const entry = activeSessions.get(sessionToken);
      if (entry && Date.now() < entry.expiresAt) {
        const dbUser = await db.users.findByEmail(entry.email);
        if (dbUser && dbUser.role === 'GOD') {
          (req as any).user = dbUser;
          return next();
        }
      } else if (entry) {
        activeSessions.delete(sessionToken);
      }
    }

    // 3. Check Bearer Token (Supabase JWT)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user: authUser } } = await supabase.auth.getUser(token);
      if (authUser?.email) {
        const dbUser = await db.users.findByEmail(authUser.email);
        if (dbUser && dbUser.role === 'GOD') {
          (req as any).user = dbUser;
          return next();
        }
      }
    }
  } catch (e) {
    // Fall through to unauthorized
  }

  res.status(403).json({
    success: false,
    error: 'Forbidden: GOD (Super Admin) privileges or valid x-god-key required.',
  });
};
