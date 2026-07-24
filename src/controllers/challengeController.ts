import { UserChallengeController } from './user/userChallengeController.js';
import { AdminChallengeController } from './admin/adminChallengeController.js';

export const ChallengeController = {
  getPublicChallenges: UserChallengeController.getPublicChallenges,
  getParticipantProgress: UserChallengeController.getParticipantProgress,
  getUnlockedStoryFragments: UserChallengeController.getUnlockedStoryFragments,
  getPublicChallenge: UserChallengeController.getPublicChallenge,
  submitAnswer: UserChallengeController.submitAnswer,
  getAllChallengesAdmin: AdminChallengeController.getAllChallengesAdmin,
  createChallenge: AdminChallengeController.createChallenge,
  updateChallenge: AdminChallengeController.updateChallenge,
  deleteChallenge: AdminChallengeController.deleteChallenge,
  getAdminProgressTracking: AdminChallengeController.getAdminProgressTracking,
  adminOverride: AdminChallengeController.adminOverride,
  resetTeamProgress: AdminChallengeController.resetTeamProgress,
  getSubmissionLogs: AdminChallengeController.getSubmissionLogs,
};
