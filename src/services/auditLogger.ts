import { Request } from 'express';
import db from '../db.js';

export async function logAdminActivity(req: Request, action: string, details?: any): Promise<void> {
  try {
    // req.user is set by requireAdmin for session-cookie and Bearer-JWT auth (verified
    // server-side) — always prefer it over client-supplied headers/body, which are
    // spoofable and were previously the only source, so every log was misattributed.
    // Only the x-admin-key/x-god-key bypass path leaves req.user unset.
    const adminEmail =
      (req as any).user?.email ||
      (req.headers['x-user-email'] as string) ||
      (req.body?.admin_email as string) ||
      (req.body?.email as string) ||
      'admin@cicada2067.org';

    const ipAddress =
      (req.headers['x-forwarded-for'] as string) ||
      req.ip ||
      req.socket?.remoteAddress ||
      '127.0.0.1';

    await db.adminLogs.logAction(adminEmail, action, details, ipAddress);
  } catch (err) {
    console.error('[Audit Logger Error]', err);
  }
}
