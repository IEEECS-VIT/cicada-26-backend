const fs = require('fs');
let code = fs.readFileSync('src/services/challengeService.ts', 'utf8');

// I already added filterHints earlier but it got wiped out by checkout. Wait, I did `git checkout` which restored it to the previous state.
const filterFunction = `
  private filterHints(hints: any[] | undefined | null, startedAtIso: string | null | undefined): any[] {
    if (!hints || hints.length === 0) return [];
    const startedTime = startedAtIso && !isStartedAtPlaceholder(startedAtIso) ? new Date(startedAtIso).getTime() : 0;
    const elapsedMinutes = startedTime > 0 ? (Date.now() - startedTime) / 60000 : 0;

    return hints.filter(h => {
      if (h.is_visible) return true;
      if (typeof h.unlock_minutes === 'number' && startedTime > 0) {
        return elapsedMinutes >= h.unlock_minutes;
      }
      return false;
    });
  }
`;

code = code.replace('export class ChallengeService {', 'export class ChallengeService {\n' + filterFunction);

code = code.replace(
  'hints: (item.hints || []).filter((h: any) => h.is_visible), // Service boundary visibility check (security filter)',
  'hints: this.filterHints(item.hints, item.order_number === currentOrder && progress ? progress.challenge_started_at : undefined), // Service boundary visibility check'
);

code = code.replace(
  'hints: (challenge.hints || []).filter((h: any) => h.is_visible), // Service boundary visibility check (security filter)',
  'hints: this.filterHints(challenge.hints, challenge.order_number === currentOrder && progress ? progress.challenge_started_at : undefined), // Service boundary visibility check'
);

// We need to re-apply the addHintToChallenge edits because `git checkout` removed them from this file too.
code = code.replace(
  'public async addHintToChallenge(challengeId: string, hintText: string, isVisible: boolean): Promise<ChallengeHint[]> {',
  'public async addHintToChallenge(challengeId: string, hintText: string, isVisible: boolean, unlockMinutes?: number): Promise<ChallengeHint[]> {'
);
code = code.replace(
  'return this.challengeRepo.addHintToChallenge(challengeId, hintText.trim(), isVisible);',
  'return this.challengeRepo.addHintToChallenge(challengeId, hintText.trim(), isVisible, unlockMinutes);'
);
code = code.replace(
  'public async editHintInChallenge(challengeId: string, hintId: string, hintText: string): Promise<ChallengeHint[]> {',
  'public async editHintInChallenge(challengeId: string, hintId: string, hintText: string, unlockMinutes?: number): Promise<ChallengeHint[]> {'
);
code = code.replace(
  'return this.challengeRepo.editHintInChallenge(challengeId, hintId, hintText.trim());',
  'return this.challengeRepo.editHintInChallenge(challengeId, hintId, hintText.trim(), unlockMinutes);'
);


// Replace updateChallengeStartedAt -> updateStartedTimers
code = code.replace(
  'progress = await this.challengeRepo.updateChallengeStartedAt(team_name.trim(), nowStr, clientIp);',
  'progress = await this.challengeRepo.updateStartedTimers(team_name.trim(), nowStr, clientIp, !progress.round_started_at || isStartedAtPlaceholder(progress.round_started_at));'
);
code = code.replace(
  'progress = await this.challengeRepo.updateChallengeStartedAt(team_name.trim(), nowStr, clientIp);',
  'progress = await this.challengeRepo.updateStartedTimers(team_name.trim(), nowStr, clientIp, !progress.round_started_at || isStartedAtPlaceholder(progress.round_started_at));'
);
code = code.replace(
  'existingProgress = await this.challengeRepo.updateChallengeStartedAt(team_name.trim(), nowStr, clientIp);',
  'existingProgress = await this.challengeRepo.updateStartedTimers(team_name.trim(), nowStr, clientIp, !existingProgress.round_started_at || isStartedAtPlaceholder(existingProgress.round_started_at));'
);

const oldTimeLimitBlock = `    // Verify time limit/timeout (only for the challenge the team is currently on)
    if (!alreadyCompleted && existingProgress && existingProgress.challenge_started_at && !isStartedAtPlaceholder(existingProgress.challenge_started_at)) {
      const startedAt = new Date(existingProgress.challenge_started_at).getTime();
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      const limit = challenge.time_limit !== undefined ? challenge.time_limit : 1800;
      if (elapsedSeconds > limit) {
        // TIME LIMIT EXCEEDED: Auto-skip to next challenge without awarding points
        // This prevents the team from being permanently soft-locked forever.
        const nextChallengeOrder = challenge.order_number + 1;
        const currentOrder = Math.max(currentUnlockedOrder, nextChallengeOrder);
        
        await this.challengeRepo.upsertTeamProgress(
          team_name.trim(),
          currentOrder,
          existingProgress?.completed_challenges || []
        );

        const roundFragment = await this.getRoundEntryFragment(nextChallengeOrder, challenge.round_id);

        return {
          success: false,
          message: 'Time Limit Exceeded. You have been moved to the next challenge without points.',
          tryAgain: false,
          unlocked_next_challenge: currentOrder,
          story_fragment: roundFragment,
        };
      }
    }`;

const newTimeLimitBlock = `    // Verify Round time limit
    if (!alreadyCompleted && existingProgress && existingProgress.round_started_at && !isStartedAtPlaceholder(existingProgress.round_started_at)) {
      const allRounds = await this.challengeRepo.getRounds();
      const currentRound = this.getRoundForChallenge(challenge, allRounds);

      if (currentRound && currentRound.time_limit > 0) {
        const startedAt = new Date(existingProgress.round_started_at).getTime();
        const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
        const bonusSeconds = existingProgress.round_bonus_seconds || 0;
        const limit = currentRound.time_limit * 60 + bonusSeconds;

        if (elapsedSeconds > limit) {
          // TIME LIMIT EXCEEDED: Auto-skip to the next round without awarding points
          const allChallenges = await this.challengeRepo.getPublicChallenges();
          const nextRound = allRounds.find(r => r.order_number > currentRound.order_number);
          let nextOrder = currentUnlockedOrder + 1;

          if (nextRound) {
            const firstOfNextRound = allChallenges.find(c => c.round_id === nextRound.id);
            if (firstOfNextRound) {
              nextOrder = Math.max(currentUnlockedOrder, firstOfNextRound.order_number);
            }
          }

          // Reset round timers and skip
          await this.challengeRepo.upsertTeamProgress(
            team_name.trim(),
            nextOrder,
            existingProgress?.completed_challenges || [],
            undefined, // attempts_count
            null, // Reset round_started_at
            0     // Reset bonus seconds
          );

          const roundFragment = await this.getRoundEntryFragment(nextOrder, challenge.round_id);

          return {
            success: false,
            message: 'Round Time Limit Exceeded. You have been moved to the next round without points.',
            tryAgain: false,
            unlocked_next_challenge: nextOrder,
            story_fragment: roundFragment,
          };
        }
      }
    }`;

code = code.replace(oldTimeLimitBlock, newTimeLimitBlock);

const oldCorrectAnswerBlock = `    // 2. Update Team Progress SECOND
    await this.challengeRepo.upsertTeamProgress(
      team_name.trim(),
      currentOrder,
      completedArray
    );`;

const newCorrectAnswerBlock = `    const allRounds = await this.challengeRepo.getRounds();
    const currentRound = this.getRoundForChallenge(challenge, allRounds);
    
    let roundStartedAt = existingProgress?.round_started_at;
    let roundBonusSeconds = existingProgress?.round_bonus_seconds || 0;

    const allChallenges = await this.challengeRepo.getPublicChallenges();
    const nextChallenge = allChallenges.find(c => c.order_number === currentOrder);
    const nextRound = nextChallenge ? this.getRoundForChallenge(nextChallenge, allRounds) : null;

    if (currentRound && currentRound.time_limit > 0 && (!nextRound || nextRound.id !== currentRound.id)) {
      if (existingProgress?.round_started_at && !isStartedAtPlaceholder(existingProgress.round_started_at)) {
         const startedAt = new Date(existingProgress.round_started_at).getTime();
         const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
         const limit = currentRound.time_limit * 60 + (existingProgress.round_bonus_seconds || 0);
         const leftover = limit - elapsedSeconds;
         if (leftover > 0) {
            roundBonusSeconds = leftover;
         } else {
            roundBonusSeconds = 0;
         }
      }
      roundStartedAt = null;
    }

    // 2. Update Team Progress SECOND
    await this.challengeRepo.upsertTeamProgress(
      team_name.trim(),
      currentOrder,
      completedArray,
      undefined,
      roundStartedAt,
      roundBonusSeconds
    );`;

code = code.replace(oldCorrectAnswerBlock, newCorrectAnswerBlock);
fs.writeFileSync('src/services/challengeService.ts', code);
console.log('challengeService patched successfully!');
