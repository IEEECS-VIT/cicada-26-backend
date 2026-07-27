import { Request, Response } from 'express';
import db from '../../db.js';

export class GodLogController {
  /**
   * GET /api/god/logs
   * View immutable admin activity logs (GOD only)
   */
  static async getAdminLogs(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const logs = await db.adminLogs.getLogs(limit);
      res.status(200).json({
        success: true,
        count: logs.length,
        message: 'Immutable admin audit logs fetched successfully',
        data: logs,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch admin audit logs' });
    }
  }

  /**
   * DELETE /api/god/logs/:id
   * Delete a specific admin log entry (GOD only)
   */
  static async deleteAdminLog(req: Request, res: Response): Promise<void> {
    try {
      const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!rawId) {
        res.status(400).json({ success: false, error: 'Log ID is required' });
        return;
      }
      await db.adminLogs.deleteLog(rawId);
      res.status(200).json({
        success: true,
        message: `Admin log entry '${rawId}' deleted successfully by Super Admin ('GOD')`,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to delete admin log entry' });
    }
  }

  /**
   * DELETE /api/god/logs
   * Clear all admin activity logs (GOD only)
   */
  static async clearAdminLogs(req: Request, res: Response): Promise<void> {
    try {
      await db.adminLogs.clearLogs();
      res.status(200).json({
        success: true,
        message: "All admin audit logs cleared successfully by Super Admin ('GOD')",
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to clear admin audit logs' });
    }
  }
}
