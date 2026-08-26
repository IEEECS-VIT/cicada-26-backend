import { Request, Response, NextFunction } from 'express';
import { supabase } from '../db.js';

const SETTINGS_KEY = 'ip_tracking_enabled';

// In-memory cache for fast synchronous reads on the hot path (challenge submission).
// Hydrated from the app_settings table at module load, and kept in sync on every write
// so the value survives server restarts/redeploys instead of resetting to the env default.
let ipTrackingEnabled: boolean = process.env.IP_TRACKING_ENABLED !== 'false';

const hydrate = async (): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle();

    if (error) throw error;

    if (data && typeof data.value === 'boolean') {
      ipTrackingEnabled = data.value;
    } else {
      // No row yet (fresh DB / migration just applied) — seed it with the current default.
      await supabase.from('app_settings').upsert({ key: SETTINGS_KEY, value: ipTrackingEnabled });
    }
  } catch (err: any) {
    console.warn(`[ipTrackingMiddleware] Could not hydrate '${SETTINGS_KEY}' from app_settings (falling back to in-memory default). Has the 00007_add_app_settings.sql migration been applied? Details: ${err.message}`);
  }
};

void hydrate();

/**
 * Returns whether IP tracking and location locking is currently active.
 */
export const isIpTrackingEnabled = (): boolean => {
  return ipTrackingEnabled;
};

const persist = async (value: boolean): Promise<void> => {
  const { error } = await supabase.from('app_settings').upsert({ key: SETTINGS_KEY, value });
  if (error) throw new Error(`Failed to persist IP tracking setting: ${error.message}`);
};

/**
 * Sets the IP tracking and location locking state and persists it to the database.
 */
export const setIpTrackingEnabled = async (enabled: boolean): Promise<boolean> => {
  const next = Boolean(enabled);
  await persist(next);
  ipTrackingEnabled = next;
  return ipTrackingEnabled;
};

/**
 * Toggles the IP tracking and location locking state and persists it to the database.
 */
export const toggleIpTracking = async (): Promise<boolean> => {
  const next = !ipTrackingEnabled;
  await persist(next);
  ipTrackingEnabled = next;
  return ipTrackingEnabled;
};

/**
 * Optional Express middleware for IP tracking checks.
 * If IP tracking is disabled, requests pass through without constraint.
 */
export const ipTrackingMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  (req as any).ipTrackingEnabled = isIpTrackingEnabled();
  next();
};
