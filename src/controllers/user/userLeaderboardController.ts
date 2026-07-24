import { Request, Response } from 'express';
import { LeaderboardService } from '../../services/leaderboardService.js';

export class UserLeaderboardController {
  /**
   * GET /api/leaderboard
   * Public live leaderboard snapshot
   */
  static async getLeaderboard(req: Request, res: Response): Promise<void> {
    try {
      const data = await LeaderboardService.getLiveLeaderboard();
      res.status(200).json({
        success: true,
        message: 'Live leaderboard fetched successfully',
        data,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error while fetching leaderboard',
      });
    }
  }
}
