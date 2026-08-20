import { Request, Response, NextFunction } from 'express';

const ipLimits = new Map<string, number[]>();
const teamLimits = new Map<string, number[]>();

const WINDOW_SIZE_MS = 60 * 1000; // 1 minute
const MAX_ATTEMPTS = 5; // 5 attempts per minute

export const submissionRateLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const ipKey = req.ip || 'unknown-ip';
  const user = (req as any).user;
  const teamKey = user?.team_id ? String(user.team_id) : null;

  const now = Date.now();

  const checkRateLimit = (key: string, store: Map<string, number[]>): boolean => {
    let timestamps = store.get(key) || [];
    
    // Clean up timestamps older than 60 seconds
    timestamps = timestamps.filter((ts) => now - ts <= WINDOW_SIZE_MS);

    if (timestamps.length >= MAX_ATTEMPTS) {
      store.set(key, timestamps);
      return false; // Rate limit exceeded
    }

    timestamps.push(now);
    store.set(key, timestamps);
    return true;
  };

  // Check IP limit (bypass for local loopback to allow concurrent test suite runs)
  const isLoopback = ipKey === '::1' || ipKey === '127.0.0.1' || ipKey === '::ffff:127.0.0.1';
  if (!isLoopback && !checkRateLimit(ipKey, ipLimits)) {
    res.status(429).json({
      success: false,
      message: 'Too many attempts. Submission rate limit exceeded. Please try again later.',
    });
    return;
  }

  // Check Team limit
  if (teamKey && !checkRateLimit(teamKey, teamLimits)) {
    res.status(429).json({
      success: false,
      message: 'Too many attempts. Submission rate limit exceeded. Please try again later.',
    });
    return;
  }

  next();
};
