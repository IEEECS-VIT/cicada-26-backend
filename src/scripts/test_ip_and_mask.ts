import app from '../app.js';
import { activeSessions } from '../middleware/authMiddleware.js';
import { v4 as uuidv4 } from 'uuid';

async function runTests() {
  const server = app.listen(5011, async () => {
    const baseUrl = 'http://localhost:5011';
    const adminKey = process.env.ADMIN_API_KEY || 'sb_secret_PDPDEMJYJko0s5Bg7fP_GQ_hO5TgW09';
    const testTeam = `IP_Test_Team_${Date.now()}`;
    const testUserEmail = `tester_${Date.now()}@example.com`;
    const sessionToken = uuidv4();

    console.log('--- STARTING IP LOCK & URL MASKING VERIFICATION ---');
    console.log('Test Team:', testTeam);

    try {
      console.log('\nStep 1: Setting up test user and team...');
      const regRes = await fetch(`${baseUrl}/api/auth/seed-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({
          email: testUserEmail,
          display_name: 'IP Tester',
          register_no: `REG-${Date.now()}`
        })
      });
      const regData = await regRes.json();
      if (!regData.success) {
        throw new Error(`Failed to whitelist test user: ${regData.error}`);
      }

      const testUserId = regData.id;

      // Add session
      activeSessions.set(sessionToken, {
        email: testUserEmail,
        expiresAt: Date.now() + 3600 * 1000,
      });

      // Create team
      const teamRes = await fetch(`${baseUrl}/api/teams/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${sessionToken}`
        },
        body: JSON.stringify({ user_id: testUserId, team_name: testTeam })
      });
      const teamData = await teamRes.json();
      if (!teamData.success) {
        throw new Error(`Failed to create team: ${teamData.error}`);
      }

      // 2. Start the challenge from IP 1 (1.1.1.1)
      console.log('\nStep 2: Activating challenge from IP 1.1.1.1...');
      const startRes = await fetch(`${baseUrl}/api/challenges`, {
        headers: {
          Cookie: `session_token=${sessionToken}`,
          'x-forwarded-for': '1.1.1.1'
        }
      });
      console.log('IP 1.1.1.1 Fetch Status:', startRes.status);
      const startData = await startRes.json();
      if (!startData.success) {
        throw new Error(`Failed to start challenge: ${JSON.stringify(startData)}`);
      }

      // 3. Verify URL Masking in the returned assets
      console.log('\nStep 3: Checking if asset URLs are masked...');
      const activeChallenge = startData.data.find((c: any) => !c.is_locked);
      if (activeChallenge) {
        console.log('Active Challenge ID:', activeChallenge.id);
        console.log('Active Challenge Assets:', JSON.stringify(activeChallenge.assets, null, 2));
        
        const hasUnmaskedUrl = activeChallenge.assets?.some((a: any) => a.url && !a.url.includes('/api/challenges/assets/masked'));
        if (hasUnmaskedUrl) {
          console.error('FAILED: Asset URLs are not masked!');
        } else {
          console.log('PASSED: Asset URLs are successfully masked with relative proxy endpoints.');
        }

        // Test fetching masked asset
        const maskedAsset = activeChallenge.assets?.find((a: any) => a.url);
        if (maskedAsset) {
          console.log('Fetching masked asset:', maskedAsset.url);
          const assetRes = await fetch(`${baseUrl}${maskedAsset.url}`, {
            headers: {
              Cookie: `session_token=${sessionToken}`,
              'x-forwarded-for': '1.1.1.1'
            }
          });
          console.log('Masked Asset Fetch Status:', assetRes.status);
          if (assetRes.status === 200) {
            console.log('PASSED: Masked asset successfully proxied/streamed from backend.');
          } else {
            console.error('FAILED: Masked asset fetch failed.');
          }
        }
      } else {
        console.log('No active unlocked challenge found for team.');
      }

      // 4. Attempt to access challenge details from IP 2 (2.2.2.2) (Should fail with 403)
      console.log('\nStep 4: Accessing challenge from a different IP (2.2.2.2)...');
      const badIpRes = await fetch(`${baseUrl}/api/challenges`, {
        headers: {
          Cookie: `session_token=${sessionToken}`,
          'x-forwarded-for': '2.2.2.2'
        }
      });
      console.log('IP 2.2.2.2 Fetch Status (Should be 403):', badIpRes.status);
      const badIpData = await badIpRes.json();
      console.log('IP 2.2.2.2 Response Body:', badIpData);
      if (badIpRes.status === 403 && badIpData.error && badIpData.error.includes('IP address mismatch')) {
        console.log('PASSED: Mismatched location/IP access blocked with 403 Forbidden.');
      } else {
        console.error('FAILED: Mismatched location/IP access was NOT blocked!');
      }

      // 5. Attempt to submit answer from IP 2 (2.2.2.2) (Should fail with 403)
      console.log('\nStep 5: Submitting answer from different IP (2.2.2.2)...');
      const submitBadIpRes = await fetch(`${baseUrl}/api/challenges/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${sessionToken}`,
          'x-forwarded-for': '2.2.2.2'
        },
        body: JSON.stringify({
          challenge_identifier: activeChallenge?.id || 1,
          answer: 'DUMMY_KEY'
        })
      });
      console.log('IP 2.2.2.2 Submit Status (Should be 403):', submitBadIpRes.status);
      const submitBadIpData = await submitBadIpRes.json();
      console.log('IP 2.2.2.2 Submit Response:', submitBadIpData);
      if (submitBadIpRes.status === 403) {
        console.log('PASSED: Mismatched IP answer submission blocked with 403 Forbidden.');
      } else {
        console.error('FAILED: Mismatched IP answer submission was NOT blocked!');
      }

    } catch (err) {
      console.error('Error in E2E Verification:', err);
    } finally {
      // Cleanup team progress to not leave junk
      console.log('\nStep 6: Cleaning up test data...');
      try {
        await fetch(`${baseUrl}/api/admin/teams/${testTeam}`, {
          method: 'DELETE',
          headers: { 'x-admin-key': adminKey }
        });
        console.log('Cleanup completed successfully.');
      } catch (cleanErr) {
        console.error('Failed to cleanup test team:', cleanErr);
      }
      server.close();
      process.exit(0);
    }
  });
}

runTests();
