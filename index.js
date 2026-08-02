// Auto-fallback for Render default 'node index.js' start command
const { spawn } = require('child_process');
const child = spawn('npx', ['tsx', 'src/index.ts'], { stdio: 'inherit', shell: true });
child.on('close', (code) => process.exit(code || 0));
