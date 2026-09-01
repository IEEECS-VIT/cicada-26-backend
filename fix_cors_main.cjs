const fs = require('fs');
let content = fs.readFileSync('src/app.ts', 'utf8');

const replacement = `
  origin: process.env.NODE_ENV === 'development' ? true : (origin, callback) => {
    const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(o => o.trim());
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(\`CORS: Origin '\${origin}' is not allowed.\`));
  }
`;

content = content.replace(/origin: process\.env\.NODE_ENV === 'development' \? true : \(origin, callback\) => \{[\s\S]*?\},/, replacement.trim() + ',');
fs.writeFileSync('src/app.ts', content);
