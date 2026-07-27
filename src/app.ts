import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';

// User Routes
import userAuthRoutes from './routes/user/authRoutes.js';
import userTeamRoutes from './routes/user/teamRoutes.js';
import userChallengeRoutes from './routes/user/challengeRoutes.js';
import userLeaderboardRoutes from './routes/user/leaderboardRoutes.js';

// Admin Routes
import adminAuthRoutes from './routes/admin/authRoutes.js';
import adminTeamRoutes from './routes/admin/teamRoutes.js';
import adminChallengeRoutes from './routes/admin/challengeRoutes.js';
import adminLeaderboardRoutes from './routes/admin/leaderboardRoutes.js';

// Super Admin (GOD) Routes
import godAuthRoutes from './routes/god/authRoutes.js';
import godLogRoutes from './routes/god/logRoutes.js';

const app: Express = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Cache Disabling Middleware for Security
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Health Checks
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    service: 'Cicada-26 Leaderboard & Challenge API',
  });
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Cicada 2067 Backend is live and Database Agnostic!' });
});

// User API Routes
app.use('/api/auth', userAuthRoutes);
app.use('/api/dev', userAuthRoutes);
app.use('/api/teams', userTeamRoutes);
app.use('/api/challenges', userChallengeRoutes);
app.use('/api/leaderboard', userLeaderboardRoutes);

// Admin API Routes (Modular directory tree)
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/teams', adminTeamRoutes);
app.use('/api/admin/challenges', adminChallengeRoutes);
app.use('/api/admin/leaderboard', adminLeaderboardRoutes);

// Super Admin (GOD) API Routes
app.use('/api/god/auth', godAuthRoutes);
app.use('/api/god/logs', godLogRoutes);
app.use('/api/god', godAuthRoutes);

// Legacy/Compatibility Aliases for Root Admin Paths
app.use('/api/admin', adminAuthRoutes);
app.use('/api/admin', adminTeamRoutes);
app.use('/api/challenges/admin', adminChallengeRoutes);

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`,
  });
});

// Global Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[Global Error]', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

export default app;
