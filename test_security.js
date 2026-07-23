const http = require('http');

const PORT = 5000;

// Helper to make requests
function makeRequest(options, postData = null) {
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
      req.setHeader('Content-Type', 'application/json');
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('==================================================');
  console.log('🛡️  STARTING BACKEND SECURITY IMPLEMENTATION TESTS');
  console.log('==================================================\n');

  // Test 1: Cache-Control Headers
  console.log('Test 1: Verifying cache-disabling headers on /health...');
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/health',
      method: 'GET'
    });
    console.log(`- Status Code: ${res.statusCode}`);
    console.log(`- Cache-Control: ${res.headers['cache-control']}`);
    console.log(`- Pragma: ${res.headers['pragma']}`);
    console.log(`- Expires: ${res.headers['expires']}`);
    
    if (res.headers['cache-control'] === 'no-store, no-cache, must-revalidate, private') {
      console.log('✅ PASS: Caching headers are correctly set to disable client/proxy cache.\n');
    } else {
      console.log('❌ FAIL: Caching headers do not match expected disable directives.\n');
    }
  } catch (err) {
    console.log(`❌ FAIL: Health check failed: ${err.message}. Make sure server is running on port ${PORT}.\n`);
    return;
  }

  // Test 2: Locked Challenge Direct Access Protection
  console.log('Test 2: Verifying data-stripping for locked challenges...');
  try {
    // List active challenges first to find a locked one or fallback
    const listRes = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/challenges?team_name=rate_limit_tester_team',
      method: 'GET'
    });
    const listBody = JSON.parse(listRes.body);
    let targetIdentifier = 2; // Default fallback
    if (listBody.data && listBody.data.length > 0) {
      const lockedCh = listBody.data.find(ch => ch.is_locked);
      if (lockedCh) {
        targetIdentifier = lockedCh.order_number || lockedCh.id;
      }
    }

    console.log(`- Fetching challenge details for identifier: ${targetIdentifier}...`);
    const res = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: `/api/challenges/${targetIdentifier}?team_name=rate_limit_tester_team`,
      method: 'GET'
    });
    console.log(`- Status Code: ${res.statusCode}`);
    const body = JSON.parse(res.body);
    
    // Check if the service correctly stripped the data
    const hasData = body.data !== undefined;
    const hasStory = body.data && body.data.story_context !== undefined;
    const hasAssets = body.data && body.data.assets !== undefined;
    const hasStoryFrag = body.data && body.data.story_fragment !== undefined;

    console.log(`- data block present? ${hasData}`);
    console.log(`- story_context present? ${hasStory}`);
    console.log(`- assets present? ${hasAssets}`);
    console.log(`- story_fragment present? ${hasStoryFrag}`);
    
    if (res.statusCode === 400 && body.data && body.data.story_context === undefined && body.data.assets === undefined) {
      console.log('✅ PASS: Locked challenge details (assets, story_context) are successfully stripped.\n');
    } else if (res.statusCode === 404) {
      console.log('ℹ️ INFO: No locked challenges found to test (or Database is empty). Challenge access returned 404.\n');
    } else {
      console.log('❌ FAIL: Locked challenge returned sensitive information.\n');
    }
  } catch (err) {
    console.log(`❌ FAIL: Challenge protection test error: ${err.message}\n`);
  }

  // Test 3: Rate Limiting
  console.log('Test 3: Testing submission rate limiter (5 requests/minute limit)...');
  try {
    const postOptions = {
      hostname: 'localhost',
      port: PORT,
      path: '/api/challenges/submit',
      method: 'POST'
    };
    const postData = {
      team_name: 'RateLimitTesterTeam',
      challenge_identifier: 1,
      answer: 'wrong_answer'
    };

    let rateLimited = false;
    let attemptsCount = 0;
    
    for (let i = 1; i <= 6; i++) {
      process.stdout.write(`- Attempt ${i}... `);
      const res = await makeRequest(postOptions, postData);
      console.log(`Status: ${res.statusCode}`);
      attemptsCount++;
      if (res.statusCode === 429) {
        rateLimited = true;
        const body = JSON.parse(res.body);
        console.log(`- Rate Limit response message: "${body.message}"`);
        break;
      }
    }

    if (rateLimited) {
      console.log('✅ PASS: Rate limit triggered a 429 status code successfully on attempt 6.\n');
    } else {
      console.log('❌ FAIL: Made 6 requests without triggering rate limiting (429 status).\n');
    }
  } catch (err) {
    console.log(`❌ FAIL: Rate limiter test error: ${err.message}\n`);
  }

  console.log('==================================================');
  console.log('🏁 TESTS CONCLUDED');
  console.log('==================================================');
}

runTests();
