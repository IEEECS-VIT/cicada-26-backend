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

// ---------------------------------------------------------------------------
// CORS — only allow requests from the configured frontend origin
// ---------------------------------------------------------------------------
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, Postman)
    if (!origin) return callback(null, true);
    if (origin === allowedOrigin) return callback(null, true);
    callback(new Error(`CORS: Origin '${origin}' is not allowed.`));
  },
  credentials: true, // Allow cookies (session_token HttpOnly cookie)
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key', 'x-god-key'],
}));

app.use(express.json({ limit: '2mb' }));

// ---------------------------------------------------------------------------
// Security headers — disable caching on all responses
// ---------------------------------------------------------------------------
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// ---------------------------------------------------------------------------
// Health Checks (public — needed for Render uptime checks)
// ---------------------------------------------------------------------------
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    service: 'Cicada 2067 Backend API',
    status: 'UP',
  });
});

app.get('/api', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    service: 'Cicada 2067 Backend API',
    status: 'UP',
    endpoints: {
      auth: '/api/auth/login',
      challenges: '/api/challenges',
      leaderboard: '/api/leaderboard',
      teams: '/api/teams',
    },
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Cicada 2067 Backend is live.' });
});

// ---------------------------------------------------------------------------
// User API Routes
// ---------------------------------------------------------------------------
app.use('/api/auth', userAuthRoutes);           // login, logout, /me, seed-user (admin-only)
app.use('/api/teams', userTeamRoutes);          // create, join, leave, update-name (requireAuth)
app.use('/api/challenges', userChallengeRoutes);// all challenge ops (requireAuth)
app.use('/api/leaderboard', userLeaderboardRoutes); // live leaderboard (requireAuth)

// ---------------------------------------------------------------------------
// Admin API Routes
// ---------------------------------------------------------------------------
app.use('/api/admin/auth', adminAuthRoutes);          // requireAdmin
app.use('/api/admin/teams', adminTeamRoutes);          // requireAdmin
app.use('/api/admin/challenges', adminChallengeRoutes);// requireAdmin
app.use('/api/admin/leaderboard', adminLeaderboardRoutes); // requireAdmin

// ---------------------------------------------------------------------------
// Super Admin (GOD) API Routes
// ---------------------------------------------------------------------------
app.use('/api/god/auth', godAuthRoutes);  // verify-login (public), grant-god-role (requireGod)
app.use('/api/god/logs', godLogRoutes);   // requireGod

// ---------------------------------------------------------------------------
// 404 Handler
// ---------------------------------------------------------------------------
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// ---------------------------------------------------------------------------
// Global Error Handler
// ---------------------------------------------------------------------------
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Global Error]', err.message);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    // Never leak internal error details in production
    ...(process.env.NODE_ENV === 'development' && { detail: err.message }),
  });
});

export default app;
