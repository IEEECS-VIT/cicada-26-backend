import { Request, Response, NextFunction } from 'express';

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const adminKey = req.headers['x-admin-key'] || req.query.admin_key;
  const expectedKey = process.env.ADMIN_API_KEY || 'cicada_admin_secret_key_2026';

  if (!adminKey || adminKey !== expectedKey) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or missing Admin API Key (x-admin-key header)',
    });
    return;
  }

  next();
};
