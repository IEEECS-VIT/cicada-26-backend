import { UserLeaderboardController } from './user/userLeaderboardController.js';
import { AdminLeaderboardController } from './admin/adminLeaderboardController.js';

export const LeaderboardController = {
  getLeaderboard: UserLeaderboardController.getLeaderboard,
  streamLeaderboard: AdminLeaderboardController.streamLeaderboard,
  submitScore: AdminLeaderboardController.submitScore,
  adjustScore: AdminLeaderboardController.adjustScore,
  updateScore: AdminLeaderboardController.updateScore,
  deleteTeam: AdminLeaderboardController.deleteTeam,
  resetLeaderboard: AdminLeaderboardController.resetLeaderboard,
  exportLeaderboard: AdminLeaderboardController.exportLeaderboard,
};
