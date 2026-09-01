import { supabase } from '../db.js';

/**
 * Round Timer — a single hunt-wide countdown that is durable across
 * page reloads, server restarts and redeploys.
 *
 * Config lives in the app_settings table (same pattern as ipTrackingMiddleware):
 *   round_duration_seconds  — how long one round lasts (default 3 hours)
 *   round_started_at        — ISO timestamp of when the round timer began
 *                             counting down (null = not started yet)
 *
 * The participant-facing countdown is ALWAYS derived from
 * (round_started_at + round_duration_seconds - now), never from a
 * client-held value, so refreshing the page cannot reset it.
 */

const DURATION_KEY = 'round_duration_seconds';
const STARTED_AT_KEY = 'round_started_at';

export const DEFAULT_ROUND_DURATION_SECONDS = 3 * 60 * 60; // 3 hours

export interface RoundTimerConfig {
  round_duration_seconds: number;
  round_started_at: string | null;
  remaining_seconds: number;
  is_running: boolean;
}

let roundDurationSeconds: number = DEFAULT_ROUND_DURATION_SECONDS;
let roundStartedAt: string | null = null;

const hydrate = async (): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', [DURATION_KEY, STARTED_AT_KEY]);

    if (error) throw error;

    const map = new Map<string, any>((data || []).map((row) => [row.key, row.value]));

    const rawDuration = map.get(DURATION_KEY);
    if (typeof rawDuration === 'number' && rawDuration >= 1) {
      roundDurationSeconds = rawDuration;
    }

    const rawStartedAt = map.get(STARTED_AT_KEY);
    if (typeof rawStartedAt === 'string' && rawStartedAt) {
      roundStartedAt = rawStartedAt;
    } else {
      roundStartedAt = null;
    }

    // Seed missing keys with the current defaults (fresh DB / migration not yet applied).
    const toUpsert: Array<{ key: string; value: any }> = [];
    if (!map.has(DURATION_KEY)) toUpsert.push({ key: DURATION_KEY, value: roundDurationSeconds });
    if (!map.has(STARTED_AT_KEY)) toUpsert.push({ key: STARTED_AT_KEY, value: null });
    if (toUpsert.length > 0) {
      await supabase.from('app_settings').upsert(toUpsert);
    }
  } catch (err: any) {
    console.warn(`[roundTimerService] Could not hydrate round timer from app_settings (falling back to in-memory defaults). Details: ${err.message}`);
  }
};

void hydrate();

const persist = async (key: string, value: any): Promise<void> => {
  const { error } = await supabase.from('app_settings').upsert({ key, value });
  if (error) throw new Error(`Failed to persist round timer setting '${key}': ${error.message}`);
};

/**
 * Computes the current round-countdown from the persisted anchor.
 * Server time is the single source of truth — no client-provided timestamps.
 */
export const getRoundTimerConfig = (now: Date = new Date()): RoundTimerConfig => {
  if (!roundStartedAt) {
    return {
      round_duration_seconds: roundDurationSeconds,
      round_started_at: null,
      remaining_seconds: roundDurationSeconds,
      is_running: false,
    };
  }

  const startedMs = new Date(roundStartedAt).getTime();
  const remainingSeconds = Math.max(0, Math.floor((startedMs + roundDurationSeconds * 1000 - now.getTime()) / 1000));

  return {
    round_duration_seconds: roundDurationSeconds,
    round_started_at: roundStartedAt,
    remaining_seconds: remainingSeconds,
    is_running: remainingSeconds > 0,
  };
};

/**
 * Sets the per-round duration (seconds) and persists it.
 */
export const setRoundDurationSeconds = async (seconds: number): Promise<RoundTimerConfig> => {
  const next = Math.min(Math.max(Math.round(seconds), 60), 24 * 60 * 60 * 30);
  await persist(DURATION_KEY, next);
  roundDurationSeconds = next;
  return getRoundTimerConfig();
};

/**
 * Starts (or restarts) the round countdown from the moment of the call.
 */
export const startRound = async (): Promise<RoundTimerConfig> => {
  roundStartedAt = new Date().toISOString();
  await persist(STARTED_AT_KEY, roundStartedAt);
  return getRoundTimerConfig();
};

/**
 * Stops the round countdown and clears the started anchor.
 */
export const resetRoundTimer = async (): Promise<RoundTimerConfig> => {
  roundStartedAt = null;
  await persist(STARTED_AT_KEY, null);
  return getRoundTimerConfig();
};
