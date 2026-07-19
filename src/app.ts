import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import leaderboardRoutes from './routes/leaderboardRoutes.js';

const app: Express = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    service: 'Cicada-26 Leaderboard API',
  });
});

// API Routes
app.use('/api/leaderboard', leaderboardRoutes);

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
