import app from '../app.js';
import { activeSessions } from '../middleware/authMiddleware.js';
import { v4 as uuidv4 } from 'uuid';

// Full route smoke test for the Cicada-26 backend, including the new rounds feature.
// Run: npx tsx src/scripts/test_routes.ts
// Requires a live Supabase connection (see .env) and an ADMIN_API_KEY.

const port = 5023;
let passed = 0;
let failed = 0;

function report(label: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed++;
    console.log(`  [PASS] ${label}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${label}`, detail !== undefined ? JSON.stringify(detail) : '');
  }
}

async function runTests() {
  const server = app.listen(port, async () => {
    const baseUrl = `http://localhost:${port}`;
    const adminKey = process.env.ADMIN_API_KEY || 'sb_secret_PDPDEMJYJko0s5Bg7fP_GQ_hO5TgW09';
    const suffix = Date.now();
    const testTeam = `RouteTest_Team_${suffix}`;
    const testUserEmail = `route_tester_${suffix}@example.com`;
    const sessionToken = uuidv4();

    const adminHeaders = { 'Content-Type': 'application/json', 'x-admin-key': adminKey };
    const userHeaders = { 'Content-Type': 'application/json', Cookie: `session_token=${sessionToken}` };

    const api = async (path: string, opts: RequestInit = {}) => {
      const res = await fetch(`${baseUrl}${path}`, opts);
      let body: any = null;
      try {
        body = await res.json();
      } catch {
        /* non-JSON body (e.g. proxied asset) */
      }
      return { status: res.status, body };
    };

    let round1Id: string | null = null;
    let round2Id: string | null = null;
    let challenge1Id: string | null = null;
    let challenge2Id: string | null = null;
    let hintId: string | null = null;

    console.log('====================================================');
    console.log('--- STARTING FULL ROUTE SMOKE TEST ---');
    console.log('====================================================');
    console.log('Test Team:', testTeam, '| User:', testUserEmail);

    try {
      // ============ PHASE 1: Health ============
      console.log('\n[1] Health checks...');
      const health = await api('/health');
      report('GET /health -> 200', health.status === 200 && health.body?.status === 'UP', health.body);

      // ============ PHASE 2: Admin Round CRUD + Reorder ============
      console.log('\n[2] Admin rounds: CRUD + reorder...');
      const roundsEmpty = await api('/api/admin/challenges/rounds', { headers: adminHeaders });
      report('GET /api/admin/challenges/rounds (empty) -> 200', roundsEmpty.status === 200 && Array.isArray(roundsEmpty.body?.data) && roundsEmpty.body.data.length === 0, roundsEmpty.body);

      const frag1 = { title: 'Recovered Mission Log', header: 'Day 102', content: 'Signal acquisition established.' };
      const frag2 = { title: 'Deep Space Relay', header: 'Day 103', content: 'The core reactor is cycling.' };

      const r1 = await api('/api/admin/challenges/rounds', {
        method: 'POST', headers: adminHeaders,
        body: JSON.stringify({ name: 'Round 1', order_number: 1, story_fragment: frag1, is_active: true }),
      });
      report('POST /api/admin/challenges/rounds (Round 1) -> 201', r1.status === 201 && r1.body?.success, r1.body);
      round1Id = r1.body?.data?.id || null;

      const r2 = await api('/api/admin/challenges/rounds', {
        method: 'POST', headers: adminHeaders,
        body: JSON.stringify({ name: 'Round 2', story_fragment: frag2 }),
      });
      report('POST /api/admin/challenges/rounds (Round 2, auto order) -> 201', r2.status === 201 && r2.body?.data?.order_number === 2, r2.body);
      round2Id = r2.body?.data?.id || null;

      const r1upd = await api(`/api/admin/challenges/rounds/${round1Id}`, {
        method: 'PUT', headers: adminHeaders,
        body: JSON.stringify({ story_fragment: { ...frag1, content: 'Signal acquisition established. Relay stabilized.' } }),
      });
      report('PUT /api/admin/challenges/rounds/:id -> 200', r1upd.status === 200 && r1upd.body?.success, r1upd.body);

      if (round1Id && round2Id) {
        const reorder = await api('/api/admin/challenges/rounds/reorder', {
          method: 'POST', headers: adminHeaders,
          body: JSON.stringify({ ordered_ids: [round2Id, round1Id] }),
        });
        report('POST /api/admin/challenges/rounds/reorder (swap) -> 200', reorder.status === 200, reorder.body);

        const reorderBack = await api('/api/admin/challenges/rounds/reorder', {
          method: 'POST', headers: adminHeaders,
          body: JSON.stringify({ ordered_ids: [round1Id, round2Id] }),
        });
        report('POST .../rounds/reorder (restore) -> 200', reorderBack.status === 200, reorderBack.body);
      }

      const roundsList = await api('/api/admin/challenges/rounds', { headers: adminHeaders });
      report('GET /api/admin/challenges/rounds (2 rounds) -> 200', roundsList.status === 200 && roundsList.body?.data?.length === 2, roundsList.body);

      // ============ PHASE 3: Admin Challenge CRUD + Hints + Assets ============
      console.log('\n[3] Admin challenges: CRUD + hints + assets...');
      const ch1 = await api('/api/admin/challenges', {
        method: 'POST', headers: adminHeaders,
        body: JSON.stringify({
          order_number: 1,
          name: 'Archive 01: Signal Intrusion',
          story_context: 'A rogue transmission has overwritten the station relay.',
          assets: [
            { id: 'asset-test-1', type: 'text', content: 'Handshake token: 0x4369636164613236', name: 'relay_handshake.txt' },
            { id: 'asset-test-2', type: 'image', url: 'https://example.com/assets/beacon_spectrum.png', name: 'Beacon Spectrum', caption: 'Frequency distribution' },
          ],
          hints: [{ id: 'hint-test-1', text: 'The token is hex encoded text.', is_visible: true }],
          round_id: round1Id,
          answer_key: 'CICADA26_START',
          time_limit: 1800,
          is_active: true,
        }),
      });
      report('POST /api/admin/challenges (challenge 1) -> 201', ch1.status === 201 && ch1.body?.success, ch1.body);
      challenge1Id = ch1.body?.data?.id || null;

      const ch2 = await api('/api/admin/challenges', {
        method: 'POST', headers: adminHeaders,
        body: JSON.stringify({
          order_number: 2,
          name: 'Archive 02: Boot Sequence',
          story_context: 'Recover the boot password before the cooling system fails.',
          assets: [],
          hints: [],
          round_id: round2Id,
          answer_key: 'CICADA26_PURGE',
          time_limit: 2400,
          is_active: true,
        }),
      });
      report('POST /api/admin/challenges (challenge 2) -> 201', ch2.status === 201 && ch2.body?.success, ch2.body);
      challenge2Id = ch2.body?.data?.id || null;

      if (challenge1Id) {
        const chUpd = await api(`/api/admin/challenges/${challenge1Id}`, {
          method: 'PUT', headers: adminHeaders,
          body: JSON.stringify({ name: 'Archive 01: Signal Intrusion (Relayed)' }),
        });
        report('PUT /api/admin/challenges/:id -> 200', chUpd.status === 200 && chUpd.body?.success, chUpd.body);

        const hintsAll = await api(`/api/admin/challenges/${challenge1Id}/hints`, {
          method: 'POST', headers: adminHeaders,
          body: JSON.stringify({ text: 'Try converting 0x4369636164613236 to ASCII.', is_visible: false }),
        });
        report('POST /api/admin/challenges/:id/hints -> 201/200', hintsAll.status === 201 || hintsAll.status === 200, hintsAll.body);
        hintId = hintsAll.body?.data?.id || hintsAll.body?.id || null;

        if (hintId) {
          const hintUpd = await api(`/api/admin/challenges/${challenge1Id}/hints/${hintId}`, {
            method: 'PUT', headers: adminHeaders,
            body: JSON.stringify({ text: 'Decode the hex token.', is_visible: true }),
          });
          report('PUT .../:id/hints/:hintId -> 200', hintUpd.status === 200, hintUpd.body);

          const hintTgl = await api(`/api/admin/challenges/${challenge1Id}/hints/${hintId}/toggle`, {
            method: 'PATCH', headers: adminHeaders,
          });
          report('PATCH .../:id/hints/:hintId/toggle -> 200', hintTgl.status === 200, hintTgl.body);

          const hintDel = await api(`/api/admin/challenges/${challenge1Id}/hints/${hintId}`, {
            method: 'DELETE', headers: adminHeaders,
          });
          report('DELETE .../:id/hints/:hintId -> 200', hintDel.status === 200, hintDel.body);
        }

        const assetAdd = await api(`/api/admin/challenges/${challenge1Id}/assets`, {
          method: 'POST', headers: adminHeaders,
          body: JSON.stringify({ type: 'text', content: 'Parity byte for block 3 is 0x41.', name: 'parity_note.txt' }),
        });
        report('POST /api/admin/challenges/:id/assets -> 201/200', assetAdd.status === 201 || assetAdd.status === 200, assetAdd.body);
        const assetId = assetAdd.body?.data?.id || null;

        if (assetId) {
          const assetUpd = await api(`/api/admin/challenges/${challenge1Id}/assets/${assetId}`, {
            method: 'PUT', headers: adminHeaders,
            body: JSON.stringify({ name: 'parity_note_updated.txt' }),
          });
          report('PUT .../:id/assets/:assetId -> 200', assetUpd.status === 200, assetUpd.body);

          const assetDel = await api(`/api/admin/challenges/${challenge1Id}/assets/${assetId}`, {
            method: 'DELETE', headers: adminHeaders,
          });
          report('DELETE .../:id/assets/:assetId -> 200', assetDel.status === 200, assetDel.body);
        }
      }

      const challengesAll = await api('/api/admin/challenges/all', { headers: adminHeaders });
      report('GET /api/admin/challenges/all (answer keys present) -> 200', challengesAll.status === 200 && challengesAll.body?.data?.some((c: any) => c.answer_key), challengesAll.body);

      if (round2Id && challenge2Id) {
        const delRoundWithCh = await api(`/api/admin/challenges/rounds/${round2Id}`, { method: 'DELETE', headers: adminHeaders });
        report('DELETE round with assigned challenge -> 400', delRoundWithCh.status === 400, delRoundWithCh.body);
      }

      // ============ PHASE 4: Participant setup ============
      console.log('\n[4] Participant setup (seed user, session, team)...');
      const seed = await api('/api/auth/seed-user', {
        method: 'POST', headers: adminHeaders,
        body: JSON.stringify({ email: testUserEmail, display_name: 'Route Tester', register_no: `REG-ROUTE-${suffix}` }),
      });
      report('POST /api/auth/seed-user -> 200', seed.status === 200 && seed.body?.success, seed.body);

      activeSessions.set(sessionToken, { email: testUserEmail, expiresAt: Date.now() + 3600 * 1000 });

      const team = await api('/api/teams/create', {
        method: 'POST', headers: userHeaders,
        body: JSON.stringify({ user_id: seed.body?.id, team_name: testTeam }),
      });
      report('POST /api/teams/create -> 200', team.status === 200 && team.body?.success, team.body);

      // ============ PHASE 5: Participant challenge flow (incl. rounds) ============
      console.log('\n[5] Participant challenge flow...');
      const challenges = await api('/api/challenges', { headers: userHeaders });
      const chList = challenges.body?.data || [];
      const c1 = chList.find((c: any) => c.order_number === 1);
      const c2 = chList.find((c: any) => c.order_number === 2);
      report('GET /api/challenges -> 200 (2 challenges)', challenges.status === 200 && chList.length === 2, challenges.body);
      report('challenge 1 unlocked + round fields + fragment', c1 && !c1.is_locked && c1.round_name === 'Round 1' && c1.story_fragment?.title === 'Recovered Mission Log', c1);
      report('challenge 2 locked + fragment masked', c2 && c2.is_locked === true && c2.story_fragment === undefined, c2);

      const rounds = await api('/api/challenges/rounds', { headers: userHeaders });
      const rList = rounds.body?.data || [];
      report('GET /api/challenges/rounds -> 200 (2 rounds)', rounds.status === 200 && rList.length === 2, rounds.body);
      report('round 1 unlocked w/ fragment, round 2 locked w/ null fragment', rList[0]?.is_locked === false && rList[0]?.story_fragment && rList[1]?.is_locked === true && rList[1]?.story_fragment === null, rList);

      const single = await api('/api/challenges/1', { headers: userHeaders });
      report('GET /api/challenges/1 -> 200 + fragment', single.status === 200 && single.body?.data?.story_fragment?.title === 'Recovered Mission Log', single.body);
      const missing = await api('/api/challenges/99', { headers: userHeaders });
      report('GET /api/challenges/99 -> 404', missing.status === 404, missing.body);

      const wrong = await api('/api/challenges/submit', {
        method: 'POST', headers: userHeaders,
        body: JSON.stringify({ team_name: testTeam, challenge_identifier: 1, answer: 'WRONG_ANSWER' }),
      });
      report('POST /api/challenges/submit (wrong answer) -> 400', wrong.status === 400 && wrong.body?.tryAgain === true, wrong.body);

      const correct = await api('/api/challenges/submit', {
        method: 'POST', headers: userHeaders,
        body: JSON.stringify({ team_name: testTeam, challenge_identifier: 1, answer: 'CICADA26_START' }),
      });
      report('POST /api/challenges/submit (correct) -> 200 + next unlocked', correct.status === 200 && correct.body?.unlocked_next_challenge === 2, correct.body);
      report('round-entry fragment returned on submit (Round 2 intro)', correct.body?.story_fragment?.title === 'Deep Space Relay', correct.body?.story_fragment);

      const challenges2 = await api('/api/challenges', { headers: userHeaders });
      const c2b = (challenges2.body?.data || []).find((c: any) => c.order_number === 2);
      report('challenge 2 unlocked after solve', c2b?.is_locked === false, c2b);

      const rounds2 = await api('/api/challenges/rounds', { headers: userHeaders });
      const r2b = (rounds2.body?.data || []).find((r: any) => r.order_number === 2);
      report('round 2 fragment unlocked after entry', r2b?.story_fragment?.title === 'Deep Space Relay', r2b);

      const progress = await api('/api/challenges/progress', { headers: userHeaders });
      report('GET /api/challenges/progress -> current_round_order + 2 round fragments', progress.status === 200 && progress.body?.data?.current_round_order === 1 && progress.body?.data?.unlocked_story_fragments?.length === 2, progress.body?.data);

      const fragments = await api('/api/challenges/story-fragments', { headers: userHeaders });
      report('GET /api/challenges/story-fragments -> 2 round fragments', fragments.status === 200 && fragments.body?.data?.length === 2 && fragments.body?.data[0]?.round_name === 'Round 1', fragments.body?.data);

      const masked = await api('/api/challenges/assets/masked?c=' + challenge1Id + '&i=1', { headers: userHeaders });
      report('GET /api/challenges/assets/masked (proxy) -> not 500', masked.status !== 500, { status: masked.status });

      const leaderboard = await api('/api/leaderboard', { headers: userHeaders });
      report('GET /api/leaderboard -> 200', leaderboard.status === 200, leaderboard.body);

      // ============ PHASE 6: Admin operational endpoints ============
      console.log('\n[6] Admin operational endpoints...');
      const adminProgress = await api('/api/admin/challenges/progress', { headers: adminHeaders });
      const progEntry = (adminProgress.body?.data || []).find((t: any) => t.team_name === testTeam);
      report('GET /api/admin/challenges/progress -> rounds/challenges story_progress', adminProgress.status === 200 && progEntry?.story_progress?.includes('rounds'), progEntry);

      const override = await api('/api/admin/challenges/override', {
        method: 'POST', headers: adminHeaders,
        body: JSON.stringify({ team_name: testTeam, target_challenge_order: 2 }),
      });
      report('POST /api/admin/challenges/override -> 200', override.status === 200, override.body);

      const reset = await api('/api/admin/challenges/reset-team', {
        method: 'POST', headers: adminHeaders,
        body: JSON.stringify({ team_name: testTeam }),
      });
      report('POST /api/admin/challenges/reset-team -> 200', reset.status === 200, reset.body);

      const logs = await api('/api/admin/challenges/submission-logs?team_name=' + encodeURIComponent(testTeam), { headers: adminHeaders });
      report('GET /api/admin/challenges/submission-logs -> 200', logs.status === 200, logs.body);

      const ipStatus = await api('/api/admin/challenges/ip-tracking', { headers: adminHeaders });
      report('GET /api/admin/challenges/ip-tracking -> 200', ipStatus.status === 200, ipStatus.body);
      const ipToggle = await api('/api/admin/challenges/ip-tracking/toggle', {
        method: 'POST', headers: adminHeaders,
        body: JSON.stringify({ enabled: ipStatus.body?.ip_tracking_enabled === true ? false : true }),
      });
      report('POST /api/admin/challenges/ip-tracking/toggle -> 200', ipToggle.status === 200, ipToggle.body);
      await api('/api/admin/challenges/ip-tracking/toggle', {
        method: 'POST', headers: adminHeaders,
        body: JSON.stringify({ enabled: ipStatus.body?.ip_tracking_enabled === true ? true : false }),
      });

      const lbSubmit = await api('/api/admin/leaderboard/submit', {
        method: 'POST', headers: adminHeaders,
        body: JSON.stringify({ team_name: testTeam, challenges_completed: 1 }),
      });
      report('POST /api/admin/leaderboard/submit -> 200', lbSubmit.status === 200, lbSubmit.body);

      const lbEntry = (await api('/api/leaderboard', { headers: userHeaders })).body?.data?.find((t: any) => t.team_name === testTeam);
      if (lbEntry?.id) {
        const lbAdjust = await api(`/api/admin/leaderboard/${lbEntry.id}/adjust`, {
          method: 'PATCH', headers: adminHeaders,
          body: JSON.stringify({ delta: 1 }),
        });
        report('PATCH /api/admin/leaderboard/:id/adjust -> 200', lbAdjust.status === 200, lbAdjust.body);
      } else {
        report('PATCH /api/admin/leaderboard/:id/adjust -> skipped (team missing)', false, lbEntry);
      }

      // ============ PHASE 7: Cleanup ============
      console.log('\n[7] Cleanup...');
      await api(`/api/admin/teams/${testTeam}`, { method: 'DELETE', headers: adminHeaders });
      if (challenge2Id) await api(`/api/admin/challenges/${challenge2Id}`, { method: 'DELETE', headers: adminHeaders });
      if (challenge1Id) await api(`/api/admin/challenges/${challenge1Id}`, { method: 'DELETE', headers: adminHeaders });
      if (round2Id) await api(`/api/admin/challenges/rounds/${round2Id}`, { method: 'DELETE', headers: adminHeaders });
      if (round1Id) await api(`/api/admin/challenges/rounds/${round1Id}`, { method: 'DELETE', headers: adminHeaders });

      const roundsFinal = await api('/api/admin/challenges/rounds', { headers: adminHeaders });
      report('cleanup complete (rounds back to 0)', roundsFinal.status === 200 && roundsFinal.body?.data?.length === 0, roundsFinal.body);

      console.log('\n====================================================');
      console.log(`--- ROUTE TEST COMPLETE: ${passed} passed, ${failed} failed ---`);
      console.log('====================================================');
    } catch (err) {
      failed++;
      console.error('Error during test execution:', err);
    } finally {
      server.close();
      process.exit(failed > 0 ? 1 : 0);
    }
  });
}

runTests();