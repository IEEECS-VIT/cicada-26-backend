import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../../db.js';
import { logAdminActivity } from '../../services/auditLogger.js';

export class AdminAuthController {
  /**
   * POST /api/admin/toggle-role
   * Toggle user role between admin and participant
   */
  static async toggleRole(req: Request, res: Response): Promise<void> {
    const { target_user_id, target_email, role } = req.body;
    try {
      if (role !== 'admin' && role !== 'participant' && role !== 'GOD') {
        res.status(400).json({ success: false, error: 'Invalid role specified. Allowed values: "admin", "participant", "GOD"' });
        return;
      }

      let targetId = target_user_id;
      if (!targetId && target_email) {
        const targetUser = await db.users.findByEmail(target_email);
        if (!targetUser) {
          res.status(404).json({ success: false, error: `User with email '${target_email}' not found.` });
          return;
        }
        targetId = targetUser.id;
      }

      if (!targetId) {
        res.status(400).json({ success: false, error: 'Either target_user_id or target_email is required.' });
        return;
      }

      await db.users.updateRole(targetId, role);
      await logAdminActivity(req, 'TOGGLE_ROLE', { target_user_id: targetId, role });

      res.json({ success: true, message: `User '${targetId}' role updated to '${role}' successfully!` });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/admin/approve-admin
   * Approve an admin account
   */
  static async approveAdmin(req: Request, res: Response): Promise<void> {
    const { target_user_id, target_email } = req.body;
    try {
      let targetId = target_user_id;
      if (!targetId && target_email) {
        const targetUser = await db.users.findByEmail(target_email);
        if (!targetUser) {
          res.status(404).json({ success: false, error: `User with email '${target_email}' not found.` });
          return;
        }
        targetId = targetUser.id;
      }

      if (!targetId) {
        res.status(400).json({ success: false, error: 'Either target_user_id or target_email is required.' });
        return;
      }

      await db.users.approveAdmin(targetId);
      await logAdminActivity(req, 'APPROVE_ADMIN', { target_user_id: targetId });

      res.json({
        success: true,
        message: `Admin user '${targetId}' has been approved and granted admin access!`,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/admin/users
   * List all registered users
   */
  static async listUsers(req: Request, res: Response): Promise<void> {
    try {
      const users = await db.users.listAllUsers();
      res.json({ success: true, count: users.length, data: users });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/admin/delete-user
   * Delete a user account from database
   */
  static async deleteUser(req: Request, res: Response): Promise<void> {
    const { target_user_id, target_email } = req.body;
    try {
      let targetId = target_user_id;
      if (!targetId && target_email) {
        const targetUser = await db.users.findByEmail(target_email);
        if (!targetUser) {
          res.status(404).json({ success: false, error: `User with email '${target_email}' not found.` });
          return;
        }
        targetId = targetUser.id;
      }

      if (!targetId) {
        res.status(400).json({ success: false, error: 'Either target_user_id or target_email is required.' });
        return;
      }

      await db.users.deleteUser(targetId);
      await logAdminActivity(req, 'DELETE_USER', { target_user_id: targetId });

      res.json({
        success: true,
        message: `User '${targetId}' deleted successfully from database!`,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/admin/auth/bulk-import-admins
   * Bulk create/update admin accounts from CSV string or array of emails/records
   */
  static async bulkImportAdmins(req: Request, res: Response): Promise<void> {
    try {
      const { csv_data, csv_content, admins: adminsArray } = req.body;
      const rawContent: string = csv_data || csv_content || (typeof req.body === 'string' ? req.body : '');

      const records: Array<{ email: string; display_name?: string; register_no?: string }> = [];

      if (Array.isArray(adminsArray)) {
        for (const item of adminsArray) {
          if (typeof item === 'string' && item.trim()) {
            records.push({ email: item.trim().toLowerCase() });
          } else if (item && typeof item === 'object' && item.email) {
            const entry: { email: string; display_name?: string; register_no?: string } = {
              email: String(item.email).trim().toLowerCase(),
            };
            if (item.display_name) entry.display_name = String(item.display_name).trim();
            if (item.register_no) entry.register_no = String(item.register_no).trim();
            records.push(entry);
          }
        }
      } else if (rawContent && rawContent.trim()) {
        const lines = rawContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        if (lines.length === 0) {
          res.status(400).json({ success: false, error: 'CSV content is empty.' });
          return;
        }

        let hasHeader = false;
        let emailIdx = 0;
        let nameIdx = -1;
        let regIdx = -1;

        const firstLineCols = lines[0]!.split(',').map((c) => c.trim().toLowerCase().replace(/^["']|["']$/g, ''));
        if (firstLineCols.some((col) => col === 'email' || col === 'display_name' || col === 'name' || col === 'register_no')) {
          hasHeader = true;
          emailIdx = firstLineCols.findIndex((c) => c === 'email');
          if (emailIdx === -1) emailIdx = 0;
          nameIdx = firstLineCols.findIndex((c) => c === 'display_name' || c === 'name');
          regIdx = firstLineCols.findIndex((c) => c === 'register_no' || c === 'reg_no');
        }

        const dataLines = hasHeader ? lines.slice(1) : lines;

        for (const line of dataLines) {
          const cols = line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
          const rawEmail = cols[emailIdx];
          if (rawEmail && rawEmail.includes('@')) {
            const entry: { email: string; display_name?: string; register_no?: string } = {
              email: rawEmail.toLowerCase(),
            };
            if (nameIdx !== -1 && cols[nameIdx]) entry.display_name = cols[nameIdx]!;
            if (regIdx !== -1 && cols[regIdx]) entry.register_no = cols[regIdx]!;
            records.push(entry);
          }
        }
      } else {
        res.status(400).json({
          success: false,
          error: 'Please provide CSV content via `csv_data` field or an array of admin objects via `admins` field.',
        });
        return;
      }

      if (records.length === 0) {
        res.status(400).json({ success: false, error: 'No valid admin email addresses found in the provided CSV payload.' });
        return;
      }

      let createdCount = 0;
      let updatedCount = 0;
      let failedCount = 0;
      const details: Array<{ email: string; status: 'created' | 'updated' | 'error'; message?: string }> = [];

      for (const rec of records) {
        try {
          const existingUser = await db.users.findByEmail(rec.email);
          if (existingUser) {
            await db.users.updateRole(existingUser.id, 'admin');
            await db.users.approveAdmin(existingUser.id);
            if (rec.display_name && !existingUser.display_name) {
              await db.users.updateDisplayName(existingUser.id, rec.display_name);
            }
            updatedCount++;
            details.push({ email: rec.email, status: 'updated' });
          } else {
            const newId = uuidv4();
            await db.users.seedUser(
              newId,
              rec.email,
              rec.display_name || null,
              rec.register_no || null,
              'admin'
            );
            createdCount++;
            details.push({ email: rec.email, status: 'created' });
          }
        } catch (itemErr: any) {
          failedCount++;
          details.push({ email: rec.email, status: 'error', message: itemErr.message });
        }
      }

      await logAdminActivity(req, 'BULK_IMPORT_ADMINS', { total: records.length, created: createdCount, updated: updatedCount });

      res.status(200).json({
        success: true,
        message: `Successfully processed ${records.length} admin account(s) from CSV.`,
        summary: {
          total_processed: records.length,
          created: createdCount,
          updated: updatedCount,
          failed: failedCount,
        },
        details,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/admin/auth/ip-tracking
   * Check IP tracking state
   */
  static async getIpTrackingStatus(req: Request, res: Response): Promise<void> {
    const { AdminChallengeController } = await import('./adminChallengeController.js');
    return AdminChallengeController.getIpTrackingStatus(req, res);
  }

  /**
   * POST /api/admin/auth/toggle-ip-tracking
   * Toggle IP tracking state
   */
  static async toggleIpTracking(req: Request, res: Response): Promise<void> {
    const { AdminChallengeController } = await import('./adminChallengeController.js');
    return AdminChallengeController.toggleIpTracking(req, res);
  }

  /**
   * GET /api/admin/auth/logs
   * Real, attributed admin activity log (who did what, when)
   */
  static async getActivityLogs(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 200;
      const data = await db.adminLogs.getLogs(limit);
      res.status(200).json({ success: true, message: 'Admin activity logs fetched successfully', data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch admin activity logs' });
    }
  }
}
