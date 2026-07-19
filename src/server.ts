import dotenv from 'dotenv';
import app from './app.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 Cicada '26 Backend API is running on port ${PORT}`);
  console.log(`📊 Live Leaderboard Endpoint: http://localhost:${PORT}/api/leaderboard`);
  console.log(`💚 Health Check Endpoint:     http://localhost:${PORT}/health`);
  console.log(`===============================================`);
});
