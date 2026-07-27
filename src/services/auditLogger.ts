import { Request } from 'express';
import db from '../db.js';

export async function logAdminActivity(req: Request, action: string, details?: any): Promise<void> {
  try {
    const adminEmail =
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
