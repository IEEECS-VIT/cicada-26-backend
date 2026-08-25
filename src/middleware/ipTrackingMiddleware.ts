import { Request, Response, NextFunction } from 'express';

// Global in-memory toggle for IP tracking & location locking
// Defaults to true unless IP_TRACKING_ENABLED environment variable is explicitly 'false'
let ipTrackingEnabled: boolean = process.env.IP_TRACKING_ENABLED !== 'false';

/**
 * Returns whether IP tracking and location locking is currently active.
 */
export const isIpTrackingEnabled = (): boolean => {
  return ipTrackingEnabled;
};

/**
 * Sets the IP tracking and location locking state.
 */
export const setIpTrackingEnabled = (enabled: boolean): boolean => {
  ipTrackingEnabled = Boolean(enabled);
  return ipTrackingEnabled;
};

/**
 * Toggles the IP tracking and location locking state.
 */
export const toggleIpTracking = (): boolean => {
  ipTrackingEnabled = !ipTrackingEnabled;
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
