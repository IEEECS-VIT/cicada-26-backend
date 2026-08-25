import app from '../app.js';
import { activeSessions } from '../middleware/authMiddleware.js';
import { v4 as uuidv4 } from 'uuid';

async function runTests() {
  const port = 5022;
  const server = app.listen(port, async () => {
    const baseUrl = `http://localhost:${port}`;
    const adminKey = process.env.ADMIN_API_KEY || 'sb_secret_PDPDEMJYJko0s5Bg7fP_GQ_hO5TgW09';
    const testTeam = `IP_Toggle_Team_${Date.now()}`;
    const testUserEmail = `toggle_tester_${Date.now()}@example.com`;
    const sessionToken = uuidv4();

    console.log('====================================================');
    console.log('--- STARTING IP BLOCKING TOGGLE VERIFICATION TEST ---');
    console.log('====================================================');
    console.log('Test Team:', testTeam);

    try {
      // Step 1: Whitelist test user, setup session, and create team
      console.log('\n[1] Seeding user, establishing session, and creating team...');
      const seedRes = await fetch(`${baseUrl}/api/auth/seed-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({
          email: testUserEmail,
          display_name: 'Toggle Tester',
          register_no: `REG-TOGGLE-${Date.now()}`,
        }),
      });
      const seedData = await seedRes.json();
      if (!seedData.success) {
        throw new Error(`Failed to seed user: ${JSON.stringify(seedData)}`);
      }

      // Add session to activeSessions
      activeSessions.set(sessionToken, {
        email: testUserEmail,
        expiresAt: Date.now() + 3600 * 1000,
      });

      const userHeaders = {
        'Content-Type': 'application/json',
        Cookie: `session_token=${sessionToken}`,
      };

      const createTeamRes = await fetch(`${baseUrl}/api/teams/create`, {
        method: 'POST',
        headers: userHeaders,
        body: JSON.stringify({
          user_id: seedData.id,
          team_name: testTeam,
        }),
      });
      const createTeamData = await createTeamRes.json();
      if (!createTeamData.success) {
        throw new Error(`Failed to create team: ${JSON.stringify(createTeamData)}`);
      }

      // Step 2: Ensure IP tracking is ON initially
      console.log('\n[2] Checking initial IP tracking status...');
      const statusRes1 = await fetch(`${baseUrl}/api/admin/challenges/ip-tracking`, {
        headers: { 'x-admin-key': adminKey },
      });
      const statusData1 = await statusRes1.json();
      console.log('Initial IP Tracking Status:', statusData1);

      // Explicitly enable if not enabled
      if (!statusData1.ip_tracking_enabled) {
        await fetch(`${baseUrl}/api/admin/challenges/ip-tracking/toggle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
          body: JSON.stringify({ enabled: true }),
        });
      }

      // Step 3: Fetch challenge from IP 10.0.0.1 to lock IP
      console.log('\n[3] Activating challenge from IP 10.0.0.1...');
      const startRes = await fetch(`${baseUrl}/api/challenges`, {
        headers: {
          Cookie: `session_token=${sessionToken}`,
          'x-forwarded-for': '10.0.0.1',
        },
      });
      console.log('IP 10.0.0.1 Fetch status:', startRes.status);
      if (startRes.status !== 200) {
        throw new Error(`Failed to fetch challenges: ${await startRes.text()}`);
      }

      // Step 4: Access challenge from mismatched IP 10.0.0.2 when IP tracking is ON (Should return 403)
      console.log('\n[4] Attempting to access from mismatched IP 10.0.0.2 with IP tracking ENABLED...');
      const mismatchRes1 = await fetch(`${baseUrl}/api/challenges`, {
        headers: {
          Cookie: `session_token=${sessionToken}`,
          'x-forwarded-for': '10.0.0.2',
        },
      });
      console.log('IP 10.0.0.2 status (Expected 403):', mismatchRes1.status);
      if (mismatchRes1.status === 403) {
        console.log('  [PASS] Mismatched IP was correctly blocked with 403 Forbidden.');
      } else {
        console.error('  [FAIL] Expected 403 but got:', mismatchRes1.status);
      }

      // Step 5: Admin toggles IP tracking OFF
      console.log('\n[5] Admin turning IP tracking OFF...');
      const disableRes = await fetch(`${baseUrl}/api/admin/challenges/ip-tracking/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ enabled: false }),
      });
      const disableData = await disableRes.json();
      console.log('IP Tracking Toggled to:', disableData);
      if (disableData.ip_tracking_enabled !== false) {
        throw new Error('Failed to disable IP tracking');
      }

      // Step 6: Access challenge from mismatched IP 10.0.0.2 with IP tracking DISABLED (Should return 200)
      console.log('\n[6] Attempting to access from mismatched IP 10.0.0.2 with IP tracking DISABLED...');
      const allowRes = await fetch(`${baseUrl}/api/challenges`, {
        headers: {
          Cookie: `session_token=${sessionToken}`,
          'x-forwarded-for': '10.0.0.2',
        },
      });
      console.log('IP 10.0.0.2 status when disabled (Expected 200):', allowRes.status);
      if (allowRes.status === 200) {
        console.log('  [PASS] Access from new IP was permitted when IP tracking is turned OFF.');
      } else {
        console.error('  [FAIL] Expected 200 but got:', allowRes.status);
      }

      // Step 7: Admin toggles IP tracking back ON
      console.log('\n[7] Admin turning IP tracking back ON...');
      const enableRes = await fetch(`${baseUrl}/api/admin/challenges/toggle-ip-tracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ enabled: true }),
      });
      const enableData = await enableRes.json();
      console.log('IP Tracking Toggled to:', enableData);
      if (enableData.ip_tracking_enabled !== true) {
        throw new Error('Failed to re-enable IP tracking');
      }

      // Step 8: Access challenge from mismatched IP 10.0.0.2 with IP tracking back ON (Should return 403)
      console.log('\n[8] Re-verifying mismatched IP 10.0.0.2 is blocked again...');
      const mismatchRes2 = await fetch(`${baseUrl}/api/challenges`, {
        headers: {
          Cookie: `session_token=${sessionToken}`,
          'x-forwarded-for': '10.0.0.2',
        },
      });
      console.log('IP 10.0.0.2 status after re-enabling (Expected 403):', mismatchRes2.status);
      if (mismatchRes2.status === 403) {
        console.log('  [PASS] Mismatched IP was blocked with 403 Forbidden again.');
      } else {
        console.error('  [FAIL] Expected 403 but got:', mismatchRes2.status);
      }

      console.log('\n====================================================');
      console.log('--- ALL IP TRACKING TOGGLE TESTS PASSED SUCCESSFULLY ---');
      console.log('====================================================');

    } catch (err) {
      console.error('Error during test execution:', err);
    } finally {
      // Cleanup
      console.log('\nCleaning up test team...');
      try {
        await fetch(`${baseUrl}/api/admin/teams/${testTeam}`, {
          method: 'DELETE',
          headers: { 'x-admin-key': adminKey },
        });
      } catch (cleanErr) {
        console.error('Cleanup error:', cleanErr);
      }
      server.close();
      process.exit(0);
    }
  });
}

runTests();
