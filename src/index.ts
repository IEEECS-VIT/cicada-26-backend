import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db, { supabase } from './db';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const generateInviteCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// ==========================================
// AUTHENTICATION & WHITELIST ROUTES
// ==========================================

app.post('/api/dev/seed-user', async (req: Request, res: Response) => {
  const { email, role, display_name, register_no } = req.body;
  try {
    const id = uuidv4();
    await db.users.seedUser(id, email, display_name || null, register_no || null, role || 'participant');
    res.json({ success: true, message: 'User added to whitelist!', id });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/verify-login', async (req: Request, res: Response) => {
  const { access_token } = req.body;
  try {
    if (!access_token) {
      return res.status(400).json({ success: false, error: 'Missing access_token.' });
    }

    // 1. Cryptographically verify the token with Supabase
    const { data: { user: authUser }, error } = await supabase.auth.getUser(access_token);
    
    if (error || !authUser || !authUser.email) {
      return res.status(401).json({ success: false, error: 'Invalid or expired Google Auth token.' });
    }

    // Extract real data directly from the encrypted token payload
    const email = authUser.email;
    const google_display_name = authUser.user_metadata?.full_name || authUser.user_metadata?.name || '';

    // 2. Check Whitelist
    const user = await db.users.findByEmail(email);
    
    if (!user) {
      return res.status(403).json({ 
        success: false, 
        error: `UNAUTHORIZED: Your email (${email}) is not whitelisted for Cicada 2067.` 
      });
    }

    // 3. Update Display Name if empty
    if (!user.display_name && google_display_name) {
      await db.users.updateDisplayName(user.id, google_display_name);
      user.display_name = google_display_name;
    }

    res.json({ 
      success: true, 
      message: 'Login successful!', 
      user,
      redirectUrl: user.role === 'admin' ? '/admin-portal' : '/dashboard'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// TEAM CREDENTIALS ROUTES
// ==========================================

app.post('/api/teams/create', async (req: Request, res: Response) => {
  const { user_id, team_name } = req.body;
  try {
    const user = await db.users.findById(user_id);
    if (!user) throw new Error('User not found.');
    if (user.team_id) throw new Error('You are already in a team. You cannot create another one.');

    const team_id = uuidv4();
    const invite_code = generateInviteCode();
    
    // Uses our manually rolled-back transaction logic in the repo
    await db.teams.createTeamAndJoin(user.id, team_name, invite_code, team_id);

    res.json({ 
      success: true, 
      message: 'Team created successfully!',
      team_id,
      invite_code 
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/teams/join', async (req: Request, res: Response) => {
  const { user_id, invite_code } = req.body;
  try {
    const user = await db.users.findById(user_id);
    if (!user) throw new Error('User not found.');
    if (user.team_id) throw new Error('You are already in a team. You cannot join another one.');

    const team = await db.teams.findByInviteCode(inviteCode.toUpperCase());
    if (!team) throw new Error('Invalid invite code.');

    const membersCount = await db.teams.countMembers(team.id);
    if (membersCount >= 5) throw new Error('This team is already full (maximum 5 members).');

    await db.users.updateTeam(user.id, team.id);

    res.json({ success: true, message: 'Successfully joined the team!', team_id: team.id });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/teams/update-name', async (req: Request, res: Response) => {
  const { user_id, team_id, new_team_name } = req.body;
  try {
    const team = await db.teams.findById(team_id);
    if (!team) return res.status(404).json({ success: false, error: 'Team not found.' });
    if (team.leader_id !== user_id) return res.status(403).json({ success: false, error: 'Forbidden: Only the team leader can change the name.' });

    await db.teams.updateName(team_id, new_team_name);
    res.json({ success: true, message: 'Team name updated successfully!' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/teams/remove-member', async (req: Request, res: Response) => {
  const { user_id, team_id, target_user_id } = req.body;
  try {
    const team = await db.teams.findById(team_id);
    if (!team) return res.status(404).json({ success: false, error: 'Team not found.' });
    if (team.leader_id !== user_id) return res.status(403).json({ success: false, error: 'Forbidden: Only the team leader can remove members.' });
    if (user_id === target_user_id) return res.status(400).json({ success: false, error: 'You cannot remove yourself. Transfer leadership or delete the team instead.' });

    await db.teams.removeMember(target_user_id, team_id);
    res.json({ success: true, message: 'Member removed successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// CHALLENGE SUBMISSION ROUTES
// ==========================================

app.post('/api/challenges/submit', async (req: Request, res: Response) => {
  const { team_id, user_id, challenge_id, submitted_answer } = req.body;
  try {
    // 1. Validate team and user
    const team = await db.teams.findById(team_id);
    if (!team) return res.status(404).json({ success: false, error: 'Team not found.' });

    const user = await db.users.findById(user_id);
    if (!user || user.team_id !== team_id) return res.status(403).json({ success: false, error: 'User does not belong to this team.' });

    // 2. Validate Challenge
    const challenge = await db.challenges.findById(challenge_id);
    if (!challenge) return res.status(404).json({ success: false, error: 'Challenge not found.' });

    // 3. Verify Answer using Bcrypt
    const isCorrect = await bcrypt.compare(submitted_answer, challenge.answer_hash);

    // 4. Log the submission immutably (whether correct or not)
    await db.submissionLogs.logSubmission(team_id, user_id, challenge_id, submitted_answer, isCorrect);

    // 5. Update Delta Time Tracking
    if (isCorrect) {
      // Calculate delta time
      const progress = await db.teamProgress.findByTeamId(team_id);
      let deltaSeconds = 0;
      if (progress && progress.opened_at) {
        const openedAt = new Date(progress.opened_at).getTime();
        const submittedAt = new Date().getTime();
        deltaSeconds = Math.floor((submittedAt - openedAt) / 1000);
      }

      // Record the success attempt with time calculation
      // For this implementation, we just pass undefined for the next challenge to avoid complexity, but it handles attempts
      await db.teamProgress.recordAttempt(team_id, true, deltaSeconds);

      return res.json({ 
        success: true, 
        message: 'Correct answer! Progress recorded.',
        time_taken_seconds: deltaSeconds,
        unlocks_story: challenge.unlocks_story_fragment 
      });
    } else {
      // Record failure attempt
      await db.teamProgress.recordAttempt(team_id, false);
      return res.status(400).json({ success: false, error: 'Incorrect answer. Submission logged.' });
    }

  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// ADMIN ROUTES
// ==========================================

app.post('/api/admin/delete-team', async (req: Request, res: Response) => {
  const { admin_user_id, team_id } = req.body;
  try {
    const user = await db.users.findById(admin_user_id);
    if (!user || user.role !== 'admin') {
      throw new Error('Forbidden: You do not have admin privileges.');
    }

    await db.teams.deleteTeam(team_id);
    res.json({ success: true, message: 'Team forcefully deleted by admin.' });
  } catch (err: any) {
    res.status(403).json({ success: false, error: err.message });
  }
});

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Cicada 2067 Backend is live and Database Agnostic!' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
