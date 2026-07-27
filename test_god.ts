import app from './src/app.js';

async function runTests() {
  const server = app.listen(5005, async () => {
    const baseUrl = 'http://localhost:5005';
    const godKey = 'god_secret_CICADA_SUPER_ADMIN_2067';
    const adminKey = 'sb_secret_PDPDEMJYJko0s5Bg7fP_GQ_hO5TgW09';

    console.log('--- TEST RESULTS ---');

    // TEST 1: GOD Login Verification
    const res1 = await fetch(baseUrl + '/api/god/auth/verify-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-god-key': godKey },
      body: JSON.stringify({ email: 'god@cicada2067.org' })
    });
    const body1 = await res1.json();
    console.log('1. GOD Login Verification:', res1.status, body1.success ? 'PASSED' : 'FAILED');

    // TEST 2: Attempting GOD Logs with Regular Admin Key (Immutability Check)
    const res2 = await fetch(baseUrl + '/api/god/logs', {
      headers: { 'x-admin-key': adminKey }
    });
    const body2 = await res2.json();
    console.log('2. Regular Admin Access to GOD Logs (Should be 403 Forbidden):', res2.status, res2.status === 403 ? 'PASSED (403 Forbidden)' : 'FAILED');

    // TEST 3: Accessing GOD Logs with GOD Key
    const res3 = await fetch(baseUrl + '/api/god/logs', {
      headers: { 'x-god-key': godKey }
    });
    const body3 = await res3.json();
    console.log('3. GOD Key Access to GOD Logs:', res3.status, body3.success ? 'PASSED' : 'FAILED');

    // TEST 4: Grant GOD Role
    const res4 = await fetch(baseUrl + '/api/god/auth/grant-god-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-god-key': godKey },
      body: JSON.stringify({ target_email: 'admin1@cicada2067.org' })
    });
    const body4 = await res4.json();
    console.log('4. Grant GOD Role to Admin User:', res4.status, body4.success ? 'PASSED' : 'FAILED');

    server.close();
    process.exit(0);
  });
}

runTests();
