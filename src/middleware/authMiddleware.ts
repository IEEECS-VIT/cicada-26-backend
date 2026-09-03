import { Request, Response, NextFunction } from 'express';
import db, { supabase, supabaseAnon } from '../db.js';

// ---------------------------------------------------------------------------
// Session Store: token -> { email, expiresAt }
// Server-issued tokens (UUID) — separate from Supabase JWTs.
// Used as HttpOnly cookie sessions so the Supabase JWT doesn't need to be
// sent on every request after initial login.
// ---------------------------------------------------------------------------
import crypto from 'crypto';

const SESSION_TTL_MS = (parseInt(process.env.SESSION_TTL_MINUTES || '30', 10)) * 60 * 1000;
const COOKIE_SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fallback-secret-cicada-26';

export const createSignedSessionToken = (email: string): string => {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const data = `${email}|${expiresAt}`;
  const signature = crypto.createHmac('sha256', COOKIE_SECRET).update(data).digest('hex');
  return `${data}|${signature}`;
};

export const verifySignedSessionToken = (token: string | undefined): string | null => {
  if (!token) return null;
  try {
    const parts = token.split('|');
    if (parts.length !== 3) return null;
    const [email, expStr, signature] = parts as [string, string, string];
    const expiresAt = parseInt(expStr, 10);
    if (Date.now() > expiresAt) return null;
    const expectedSignature = crypto.createHmac('sha256', COOKIE_SECRET).update(`${email}|${expStr}`).digest('hex');
    if (signature === expectedSignature) return email;
  } catch (e) {
    return null;
  }
  return null;
};

// We will keep a mock activeSessions map so userAuthController.ts doesn't break compilation before we patch it
export const activeSessions = new Map<string, any>();

export const getCookie = (req: Request, name: string): string | undefined => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  for (const cookie of cookieHeader.split(';')) {
    const eqIndex = cookie.indexOf('=');
    if (eqIndex === -1) continue;
    const key = cookie.slice(0, eqIndex).trim();
    if (key !== name) continue;
    const raw = cookie.slice(eqIndex + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
};

// ---------------------------------------------------------------------------
// requireAuth — for regular PARTICIPANTS
//
// Verification order:
//   1. GOD/Admin API key header (header-based bypass for admin portals)
//   2. Server session cookie (HttpOnly, set on login, expires in 30 min)
//   3. Authorization: Bearer <supabase_jwt> — verified with ANON KEY client
//      (participants use the anon key on the frontend)
//
// REMOVED permanently: x-user-email, x-user-id, body email/id bypasses
// ---------------------------------------------------------------------------
export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const godKey = req.headers['x-god-key'] as string | undefined;
    const adminKey = req.headers['x-admin-key'] as string | undefined;

    // 1. API key bypass (admin/god portals don't use Supabase JWT on every call)
    if (godKey && godKey === process.env.GOD_API_KEY!) {
      return next();
    }
    if (adminKey && adminKey === process.env.ADMIN_API_KEY!) {
      return next();
    }

    // 2. Server-issued HttpOnly session cookie
    const sessionToken = getCookie(req, 'session_token');
    if (sessionToken) {
      const email = verifySignedSessionToken(sessionToken);
      if (email) {
        const dbUser = await db.users.findByEmail(email);
        if (dbUser) {
          (req as any).user = dbUser;
          return next();
        }
      /*
        */ // expired — clean up
      }
    }

    // 3. Supabase JWT via Authorization: Bearer <token>
    //    Participants send tokens obtained with ANON KEY → verified with supabaseAnon
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user: authUser }, error } = await supabaseAnon.auth.getUser(token);
      if (!error && authUser?.email) {
                  const dbUser = await db.users.findByEmail(authUser.email);
          if (dbUser) {
            // AUTO-RENEW COOKIE TO PREVENT SUPABASE RATE LIMITS
            const newSessionToken = createSignedSessionToken(authUser.email);
            res.cookie('session_token', newSessionToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production' || process.env.RENDER === 'true',
              sameSite: (process.env.NODE_ENV === 'production' || process.env.RENDER === 'true') ? 'none' : 'lax',
              maxAge: SESSION_TTL_MS,
              path: '/',
            });
            (req as any).user = dbUser;
            return next();
          }
      }
    }
  } catch (_) { /* fall through */ }

  res.status(401).json({
    success: false,
    error: 'Unauthorized: A valid Supabase access token (Bearer) or active session cookie is required.',
  });
};

export const requireUserAuth = requireAuth;

// ---------------------------------------------------------------------------
// requireAdmin — for ADMINS and GOD
//
// Verification order:
//   1. GOD or Admin API key header
//   2. Server session cookie (checked for admin/GOD role)
//   3. Authorization: Bearer <supabase_jwt> — verified with SERVICE ROLE KEY
//      (admins use the service role key on the admin portal)
// ---------------------------------------------------------------------------
export const requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const godKey = req.headers['x-god-key'] as string | undefined;
    const adminKey = req.headers['x-admin-key'] as string | undefined;

    // 1. API key bypass
    if (godKey && godKey === process.env.GOD_API_KEY!) {
      return next();
    }
    if (adminKey && adminKey === process.env.ADMIN_API_KEY!) {
      return next();
    }

    // 2. Server session cookie (must be admin or GOD role)
    const sessionToken = getCookie(req, 'session_token');
    if (sessionToken) {
      const email = verifySignedSessionToken(sessionToken);
      if (email) {
        const dbUser = await db.users.findByEmail(email);
        if (dbUser && (dbUser.role === 'admin' || dbUser.role === 'GOD')) {
          (req as any).user = dbUser;
          return next();
        }
      }
    }

    // 3. Supabase JWT — admins use SERVICE ROLE KEY → verified with supabase (service client)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user: authUser } } = await supabase.auth.getUser(token);
      if (authUser?.email) {
                  const dbUser = await db.users.findByEmail(authUser.email);
          if (dbUser && (dbUser.role === 'admin' || dbUser.role === 'GOD')) {
            const newSessionToken = createSignedSessionToken(authUser.email);
            res.cookie('session_token', newSessionToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production' || process.env.RENDER === 'true',
              sameSite: (process.env.NODE_ENV === 'production' || process.env.RENDER === 'true') ? 'none' : 'lax',
              maxAge: SESSION_TTL_MS,
              path: '/',
            });
            (req as any).user = dbUser;
            return next();
          }
      }
    }
  } catch (_) { /* fall through */ }

  res.status(401).json({
    success: false,
    error: 'Unauthorized: Valid Admin/GOD API key, session, or Supabase token with admin privileges required.',
  });
};

// ---------------------------------------------------------------------------
// requireGod — for GOD (Super Admin) ONLY
//
// Verification order:
//   1. x-god-key header
//   2. Server session cookie (must be GOD role)
//   3. Authorization: Bearer <supabase_jwt> — verified with SERVICE ROLE KEY
// ---------------------------------------------------------------------------
export const requireGod = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const godKey = req.headers['x-god-key'] as string | undefined;

    // 1. GOD API key header
    if (godKey && godKey === process.env.GOD_API_KEY!) {
      return next();
    }

    // 2. Server session cookie (must be GOD role)
    const sessionToken = getCookie(req, 'session_token');
    if (sessionToken) {
      const email = verifySignedSessionToken(sessionToken);
      if (email) {
        const dbUser = await db.users.findByEmail(email);
        if (dbUser && dbUser.role === 'GOD') {
          (req as any).user = dbUser;
          return next();
        }
      }
    }

    // 3. Supabase JWT — GOD uses SERVICE ROLE KEY → verified with supabase (service client)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user: authUser } } = await supabase.auth.getUser(token);
      if (authUser?.email) {
                  const dbUser = await db.users.findByEmail(authUser.email);
          if (dbUser && dbUser.role === 'GOD') {
            const newSessionToken = createSignedSessionToken(authUser.email);
            res.cookie('session_token', newSessionToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production' || process.env.RENDER === 'true',
              sameSite: (process.env.NODE_ENV === 'production' || process.env.RENDER === 'true') ? 'none' : 'lax',
              maxAge: SESSION_TTL_MS,
              path: '/',
            });
            (req as any).user = dbUser;
            return next();
          }
      }
    }
  } catch (_) { /* fall through */ }

  res.status(403).json({
    success: false,
    error: 'Forbidden: GOD (Super Admin) privileges or valid x-god-key required.',
  });
};
