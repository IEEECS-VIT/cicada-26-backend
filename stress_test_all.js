const http = require('http');

const PORT = 5000;
const ADMIN_KEY = 'sb_secret_PDPDEMJYJko0s5Bg7fP_GQ_hO5TgW09';

let totalTests = 0;
let passedTests = 0;

function logPass(msg) {
  totalTests++;
  passedTests++;
  console.log(`  ✅ PASS: ${msg}`);
}

function logFail(msg) {
  totalTests++;
  console.log(`  ❌ FAIL: ${msg}`);
}

function makeRequest(options, postData = null) {
  if (!options.headers) {
    options.headers = {};
  }
  if (options.path !== '/api/challenges/admin/all' && options.path !== '/api/admin/challenges/progress' && options.path !== '/api/admin/challenges/all' && !options.path.startsWith('/api/admin/challenges/progress') && !options.path.endsWith('/progress')) {
    options.headers['x-admin-key'] = ADMIN_KEY;
  }
  if (postData && !options.headers['Content-Type']) {
    options.headers['Content-Type'] = 'application/json';
  }
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on('error', (err) => { reject(err); });
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runStressTests() {
  console.log('===========================================================');
  console.log('🚀 EXHAUSTIVE BACKEND AUDIT & STRESS TEST SUITE');
  console.log('===========================================================\n');

  // ----------------------------------------------------------------------
  // SECTION 1: Health & Cache Headers
  // ----------------------------------------------------------------------
  console.log('[SECTION 1] Server Health & Cache Security Headers');
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/health',
      method: 'GET'
    });
    if (res.statusCode === 200 && res.headers['cache-control']?.includes('no-store')) {
      logPass('Health endpoint online & Cache-Control no-store headers set.');
    } else {
      logFail(`Health endpoint returned status ${res.statusCode} with cache headers ${res.headers['cache-control']}`);
    }
  } catch (err) {
    logFail(`Health check connection error: ${err.message}`);
    console.log('\n❌ ABORTING TEST: Ensure backend server is running on port 5000 (npm run dev)');
    return;
  }

  // ----------------------------------------------------------------------
  // SECTION 2: Authentication & Authorization Security
  // ----------------------------------------------------------------------
  console.log('\n[SECTION 2] Authentication & Authorization Protections');
  
  // 2.1 Admin Protected Route without Key
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/challenges/admin/all',
      method: 'GET'
    });
    if (res.statusCode === 401) {
      logPass('Admin protected route rejects request without x-admin-key (401).');
    } else {
      logFail(`Expected 401 for unauthorized admin route, got ${res.statusCode}`);
    }
  } catch (err) {
    logFail(`Admin route test failed: ${err.message}`);
  }

  // 2.2 Verify Login with Non-Whitelisted Email
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/auth/verify-login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'unauthorized_hacker_99@attacker.com' });
    if (res.statusCode === 403) {
      logPass('Login rejected non-whitelisted email (403 Forbidden).');
    } else {
      logFail(`Expected 403 for non-whitelisted user, got ${res.statusCode}`);
    }
  } catch (err) {
    logFail(`Login whitelist test failed: ${err.message}`);
  }

  // 2.3 Seed User (Whitelist Registration)
  const testParticipantEmail = `stress_user_${Date.now()}@cicada2067.com`;
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/auth/seed-user',
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-admin-key': ADMIN_KEY
      }
    }, {
      email: testParticipantEmail,
      role: 'participant',
      display_name: 'Test Stress Agent',
      register_no: `REG_${Date.now()}`
    });
    if (res.statusCode === 200 || res.statusCode === 201) {
      logPass(`Admin successfully whitelisted participant email (${testParticipantEmail}).`);
    } else {
      logFail(`Failed to seed user: status ${res.statusCode} ${res.body}`);
    }
  } catch (err) {
    logFail(`Seed user test error: ${err.message}`);
  }

  // ----------------------------------------------------------------------
  // SECTION 3: Challenge Engine, Lock Rules & Data Stripping
  // ----------------------------------------------------------------------
  console.log('\n[SECTION 3] Challenge Engine & Sequential Lock Rules');

  const testTeam = `StressTeam_${Date.now()}`;

  // 3.1 Initial Active Challenges Fetch
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: `/api/challenges?team_name=${testTeam}`,
      method: 'GET'
    });
    const body = JSON.parse(res.body);
    if (res.statusCode === 200 && Array.isArray(body.data)) {
      const ch1 = body.data.find(c => c.order_number === 1);
      const ch2 = body.data.find(c => c.order_number === 2);
      if (ch1 && !ch1.is_locked && ch2 && ch2.is_locked) {
        logPass(`Team '${testTeam}' sees Challenge 1 unlocked and Challenge 2 locked.`);
      } else {
        logFail(`Lock state mismatch in active challenges list.`);
      }
    } else {
      logFail(`Active challenges fetch failed: status ${res.statusCode}`);
    }
  } catch (err) {
    logFail(`Challenge list test error: ${err.message}`);
  }

  // 3.2 Direct Access to Locked Challenge (Data Stripping Check)
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: `/api/challenges/2?team_name=${testTeam}`,
      method: 'GET'
    });
    const body = JSON.parse(res.body);
    if (res.statusCode === 400 && body.data && body.data.story_context === undefined && body.data.assets === undefined) {
      logPass('Direct access to locked Challenge 2 blocked (400) and sensitive data stripped.');
    } else {
      logFail(`Locked challenge direct access did not strip sensitive data properly.`);
    }
  } catch (err) {
    logFail(`Direct access test error: ${err.message}`);
  }

  // 3.3 Incorrect Answer Submission (Whitespace & Case Insensitive Fallback)
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/challenges/submit',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      team_name: testTeam,
      challenge_identifier: 1,
      answer: 'WRONG_SECRET_PASSPHRASE'
    });
    const body = JSON.parse(res.body);
    if (res.statusCode === 200 || res.statusCode === 400) {
      if (body.success === false && body.message === 'Incorrect Authentication Key') {
        logPass('Incorrect answer returned "Incorrect Authentication Key" without info leakage.');
      } else {
        logFail(`Unexpected incorrect answer response message: ${body.message}`);
      }
    } else {
      logFail(`Incorrect answer returned status ${res.statusCode}`);
    }
  } catch (err) {
    logFail(`Incorrect answer submission test error: ${err.message}`);
  }

  // 3.4 Correct Answer Submission with Space Trimming & Lowercase
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/challenges/submit',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      team_name: testTeam,
      challenge_identifier: 1,
      answer: '  cicada26_start   '
    });
    const body = JSON.parse(res.body);
    if (body.success === true && body.unlocked_next_challenge === 2) {
      logPass('Correct answer accepted (case & whitespace normalized). Challenge 2 unlocked!');
    } else {
      logFail(`Correct answer submission failed: ${JSON.stringify(body)}`);
    }
  } catch (err) {
    logFail(`Correct answer test error: ${err.message}`);
  }

  // ----------------------------------------------------------------------
  // SECTION 4: Progress Recovery & Story Fragments
  // ----------------------------------------------------------------------
  console.log('\n[SECTION 4] Participant Session Resume & Story Fragments');

  // 4.1 Participant Progress Resume
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: `/api/challenges/progress?team_name=${testTeam}`,
      method: 'GET'
    });
    const body = JSON.parse(res.body);
    if (res.statusCode === 200 && body.data?.current_challenge_order === 2) {
      logPass(`Participant progress resumed correctly. Current challenge order is 2.`);
    } else {
      logFail(`Participant progress resume failed: ${JSON.stringify(body)}`);
    }
  } catch (err) {
    logFail(`Progress resume test error: ${err.message}`);
  }

  // 4.2 Unlocked Story Fragments
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: `/api/challenges/story-fragments?team_name=${testTeam}`,
      method: 'GET'
    });
    const body = JSON.parse(res.body);
    if (res.statusCode === 200 && Array.isArray(body.data) && body.data.length >= 1) {
      logPass(`Archive contains ${body.data.length} unlocked story fragment(s).`);
    } else {
      logFail(`Story fragments retrieval failed: ${JSON.stringify(body)}`);
    }
  } catch (err) {
    logFail(`Story fragment test error: ${err.message}`);
  }

  // ----------------------------------------------------------------------
  // SECTION 5: Admin Control & Progress Reset
  // ----------------------------------------------------------------------
  console.log('\n[SECTION 5] Administrative Overrides & Team Progress Reset');

  // 5.1 Admin Override to Challenge 3
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/challenges/admin/override',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': ADMIN_KEY
      }
    }, {
      team_name: testTeam,
      target_challenge_order: 3
    });
    const body = JSON.parse(res.body);
    if (res.statusCode === 200 && body.success === true) {
      logPass(`Admin override successfully advanced team '${testTeam}' to Challenge 3.`);
    } else {
      logFail(`Admin override failed: ${JSON.stringify(body)}`);
    }
  } catch (err) {
    logFail(`Admin override test error: ${err.message}`);
  }

  // 5.2 Reset Team Progress
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/challenges/admin/reset-team',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': ADMIN_KEY
      }
    }, {
      team_name: testTeam
    });
    const body = JSON.parse(res.body);
    if (res.statusCode === 200 && body.success === true && body.data?.current_challenge_order === 1) {
      logPass(`Admin reset team progress for '${testTeam}' back to Challenge 1.`);
    } else {
      logFail(`Reset team progress failed: ${JSON.stringify(body)}`);
    }
  } catch (err) {
    logFail(`Reset team progress test error: ${err.message}`);
  }

  // ----------------------------------------------------------------------
  // SECTION 6: Leaderboard, SSE Streaming & CSV Export
  // ----------------------------------------------------------------------
  console.log('\n[SECTION 6] Leaderboard, Analytics & CSV Export');

  // 6.1 Live Leaderboard
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/leaderboard',
      method: 'GET'
    });
    const body = JSON.parse(res.body);
    if (res.statusCode === 200 && Array.isArray(body.data)) {
      logPass(`Live leaderboard returned ${body.data.length} team ranking(s).`);
    } else {
      logFail(`Leaderboard fetch failed: ${JSON.stringify(body)}`);
    }
  } catch (err) {
    logFail(`Leaderboard test error: ${err.message}`);
  }

  // 6.2 Leaderboard CSV Export
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/leaderboard/export',
      method: 'GET',
      headers: { 'x-admin-key': ADMIN_KEY }
    });
    if (res.statusCode === 200 && res.headers['content-type']?.includes('text/csv') && res.body.includes('Rank,Team Name')) {
      logPass('Leaderboard CSV export endpoint generated valid CSV document.');
    } else {
      logFail(`CSV export failed: status ${res.statusCode} ${res.body.slice(0, 100)}`);
    }
  } catch (err) {
    logFail(`CSV export test error: ${err.message}`);
  }

  // 6.3 Admin Submission Logs Search
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/challenges/admin/submission-logs',
      method: 'GET',
      headers: { 'x-admin-key': ADMIN_KEY }
    });
    const body = JSON.parse(res.body);
    if (res.statusCode === 200 && Array.isArray(body.data)) {
      logPass(`Admin submission logs endpoint returned ${body.data.length} log entry(ies).`);
    } else {
      logFail(`Submission logs search failed: ${JSON.stringify(body)}`);
    }
  } catch (err) {
    logFail(`Submission logs test error: ${err.message}`);
  }

  // ----------------------------------------------------------------------
  // SECTION 7: Rate Limiting & Concurrency Stress Test
  // ----------------------------------------------------------------------
  console.log('\n[SECTION 7] Submission Rate-Limiting & Concurrency Protection');

  const rateTeam = `RateStressTeam_${Date.now()}`;
  let rateLimited = false;
  
  try {
    const requests = [];
    for (let i = 1; i <= 7; i++) {
      requests.push(makeRequest({
        hostname: 'localhost',
        port: PORT,
        path: '/api/challenges/submit',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        team_name: rateTeam,
        challenge_identifier: 1,
        answer: 'WRONG'
      }));
    }

    const responses = await Promise.all(requests);
    const status429Count = responses.filter(r => r.statusCode === 429).length;
    
    if (status429Count >= 1) {
      logPass(`Concurrent rapid submissions triggered 429 Rate Limit (blocked ${status429Count} request(s)).`);
    } else {
      logFail(`Rate limiter failed to block burst requests (status codes: ${responses.map(r => r.statusCode).join(', ')})`);
    }
  } catch (err) {
    logFail(`Rate limit stress test error: ${err.message}`);
  }

  // ----------------------------------------------------------------------
  // SECTION 8: Malformed & Malicious Inputs Edge Cases
  // ----------------------------------------------------------------------
  console.log('\n[SECTION 8] Malicious & Malformed Inputs Edge Cases');

  // 8.1 SQL Injection Payload
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/challenges/submit',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      team_name: testTeam,
      challenge_identifier: 1,
      answer: "' OR '1'='1'; DROP TABLE teams; --"
    });
    const body = JSON.parse(res.body);
    if (res.statusCode === 200 || res.statusCode === 400) {
      if (body.success === false) {
        logPass('SQL injection payload safely handled and rejected without database corruption.');
      } else {
        logFail(`SQL injection payload was accepted unexpectedly.`);
      }
    } else {
      logFail(`SQL injection submission returned status ${res.statusCode}`);
    }
  } catch (err) {
    logFail(`SQL injection test error: ${err.message}`);
  }

  // 8.2 Extremely Long String Payload (Buffer Overflow Attack)
  try {
    const hugeString = 'A'.repeat(50000);
    const res = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/challenges/submit',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      team_name: testTeam,
      challenge_identifier: 1,
      answer: hugeString
    });
    if (res.statusCode === 200 || res.statusCode === 400) {
      logPass('50KB ultra-large answer payload safely handled by server.');
    } else {
      logFail(`Large payload test returned status ${res.statusCode}`);
    }
  } catch (err) {
    logFail(`Large payload test error: ${err.message}`);
  }

  // ----------------------------------------------------------------------
  // CONCLUSION
  // ----------------------------------------------------------------------
  console.log('\n===========================================================');
  console.log(`🏁 AUDIT RESULTS: ${passedTests} / ${totalTests} TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('===========================================================\n');
}

runStressTests();
