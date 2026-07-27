import app from './src/app.js';

async function runAuthProtectionTests() {
  const server = app.listen(5006, async () => {
    const baseUrl = 'http://localhost:5006';

    console.log('==================================================');
    console.log('⚡ TESTING USER ROUTE AUTHENTICATION ENFORCEMENT');
    console.log('==================================================\n');

    // TEST 1: Unauthenticated GET challenge (Should be 401 Unauthorized)
    console.log('--- TEST 1: Access Challenge Without Login ---');
    const res1 = await fetch(baseUrl + '/api/challenges/1');
    const body1 = await res1.json();
    console.log('HTTP Status:', res1.status, res1.status === 401 ? 'PASSED (401 Unauthorized)' : 'FAILED', body1);

    // TEST 2: User Login Endpoint (POST /api/auth/login)
    console.log('\n--- TEST 2: User Login Route (POST /api/auth/login) ---');
    const res2 = await fetch(baseUrl + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'shikhar102005@gmail.com' })
    });
    const body2 = await res2.json();
    console.log('HTTP Status:', res2.status, body2.success ? 'PASSED' : 'FAILED', body2.message);

    // TEST 3: Authenticated GET challenge (Should be 200 OK)
    console.log('\n--- TEST 3: Access Challenge With Logged In User Session (x-user-email) ---');
    const res3 = await fetch(baseUrl + '/api/challenges/1', {
      headers: { 'x-user-email': 'shikhar102005@gmail.com' }
    });
    const body3 = await res3.json();
    console.log('HTTP Status:', res3.status, res3.status === 200 || res3.status === 404 ? 'PASSED (Authenticated Access)' : 'FAILED', body3.message || body3.error);

    // TEST 4: Unauthenticated Challenge Submission (Should be 401 Unauthorized)
    console.log('\n--- TEST 4: Submit Challenge Without Login ---');
    const res4 = await fetch(baseUrl + '/api/challenges/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_name: 'CyberKnights', challenge_identifier: 1, answer: 'test' })
    });
    const body4 = await res4.json();
    console.log('HTTP Status:', res4.status, res4.status === 401 ? 'PASSED (401 Unauthorized)' : 'FAILED', body4);

    server.close();
    process.exit(0);
  });
}

runAuthProtectionTests();
