import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db, { supabase } from './db';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import leaderboardRoutes from './routes/leaderboardRoutes.js';
import challengeRoutes from './routes/challengeRoutes.js';
import { ChallengeController } from './controllers/challengeController.js';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Global Cache Disabling Middleware for Security (Disable browser caching for answers/responses)
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

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

app.post(['/api/dev/seed-user', '/api/auth/seed-user'], async (req: Request, res: Response) => {
  const { email, role, display_name, register_no, x_admin_key } = req.body;
  try {
    const userCount = await db.users.countUsers();
    const isFirstUser = userCount === 0;

    const adminKeyHeader = req.headers['x-admin-key'] || x_admin_key;
    const expectedKey = process.env.ADMIN_API_KEY || 'sb_secret_PDPDEMJYJko0s5Bg7fP_GQ_hO5TgW09';
    const isMasterAdmin = adminKeyHeader && adminKeyHeader === expectedKey;

    let finalRole: 'participant' | 'admin' = role === 'admin' ? 'admin' : 'participant';
    let isAdminApproved = true;

    if (isFirstUser) {
      finalRole = 'admin';
      isAdminApproved = true;
    } else if (role === 'admin') {
      finalRole = 'admin';
      isAdminApproved = Boolean(isMasterAdmin);
    }

    const id = uuidv4();
    await db.users.seedUser(id, email, display_name || null, register_no || null, finalRole, isAdminApproved);
    
    res.json({ 
      success: true, 
      message: isFirstUser 
        ? 'First user registered! Automatically bootstrapped as Super Admin.' 
        : (finalRole === 'admin' && !isAdminApproved 
            ? 'Admin user added to whitelist (Pending Approval by Super Admin).' 
            : 'User added to whitelist!'), 
      id,
      role: finalRole,
      is_first_user: isFirstUser,
      is_admin_approved: isAdminApproved
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/verify-login', async (req: Request, res: Response) => {
  const { access_token, email: bodyEmail, google_display_name: bodyName } = req.body;
  try {
    let email = bodyEmail;
    let google_display_name = bodyName || '';

    if (access_token) {
      // 1. Cryptographically verify the token with Supabase
      const { data: { user: authUser }, error } = await supabase.auth.getUser(access_token);
      
      if (error || !authUser || !authUser.email) {
        return res.status(401).json({ success: false, error: 'Invalid or expired Google Auth token.' });
      }

      email = authUser.email;
      google_display_name = authUser.user_metadata?.full_name || authUser.user_metadata?.name || '';
    } else if (!email) {
      return res.status(400).json({ success: false, error: 'Missing access_token or email.' });
    }

    // 2. Check Whitelist & First User Auto-Bootstrap
    let user = await db.users.findByEmail(email);
    const userCount = await db.users.countUsers();
    const isFirstUser = userCount === 0;
    
    if (!user) {
      if (isFirstUser) {
        // Automatically bootstrap first user logging in as Super Admin
        const id = uuidv4();
        await db.users.seedUser(id, email, google_display_name || 'Super Admin', null, 'admin', true);
        user = await db.users.findByEmail(email);
      } else {
        return res.status(403).json({ 
          success: false, 
          error: `UNAUTHORIZED: Your email (${email}) is not whitelisted for Cicada 2067.` 
        });
      }
    }

    // 3. Update Display Name if empty
    if (user && !user.display_name && google_display_name) {
      await db.users.updateDisplayName(user.id, google_display_name);
      user.display_name = google_display_name;
    }

    // 4. Admin Key Provisioning & Approval Check
    const isAdmin = user?.role === 'admin';
    const isApprovedAdmin = isAdmin && user?.is_admin_approved !== false;
    const adminSecretKey = isApprovedAdmin ? (process.env.ADMIN_API_KEY || 'sb_secret_PDPDEMJYJko0s5Bg7fP_GQ_hO5TgW09') : null;

    res.json({ 
      success: true, 
      message: isFirstUser 
        ? 'Welcome! You are the first user and have been automatically bootstrapped as Super Admin.' 
        : (isApprovedAdmin ? 'Login successful! Admin access granted.' : 'Login successful!'), 
      user,
      admin_secret_key: adminSecretKey,
      is_first_user: isFirstUser,
      is_approved_admin: isApprovedAdmin,
      redirectUrl: isApprovedAdmin ? '/admin-portal' : '/dashboard'
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

    const team = await db.teams.findByInviteCode(invite_code.toUpperCase());
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

// Rate limiting map for challenge submissions (max 5 attempts per minute per IP or team)
const submissionAttempts = new Map<string, { count: number; resetTime: number }>();

const rateLimitSubmission = (req: Request, res: Response, next: NextFunction) => {
  const identifier = String(req.body?.team_name || req.body?.team_id || req.ip || 'global');
  const now = Date.now();

  const attempt = submissionAttempts.get(identifier);
  if (!attempt || now > attempt.resetTime) {
    submissionAttempts.set(identifier, {
      count: 1,
      resetTime: now + 60000, // 1 minute window
    });
    return next();
  }

  if (attempt.count >= 5) {
    return res.status(429).json({
      success: false,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. You can only make 5 challenge submission attempts per minute.',
    });
  }

  attempt.count++;
  next();
};

app.post('/api/challenges/submit', rateLimitSubmission, async (req: Request, res: Response) => {
  const { team_id, user_id, challenge_id, submitted_answer } = req.body;
  if (team_id !== undefined || challenge_id !== undefined || user_id !== undefined || submitted_answer !== undefined) {
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
  } else {
    // Delegate to ChallengeController.submitAnswer
    await ChallengeController.submitAnswer(req, res);
  }
});

// ==========================================
// ADMIN ROUTES
// ==========================================

async function isReqAuthorizedAdmin(req: Request): Promise<boolean> {
  try {
    const adminKey = req.headers['x-admin-key'] || req.query.admin_key || req.body?.x_admin_key;
    const expectedKey = process.env.ADMIN_API_KEY || 'sb_secret_PDPDEMJYJko0s5Bg7fP_GQ_hO5TgW09';

    if (adminKey && adminKey === expectedKey) return true;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user: authUser } } = await supabase.auth.getUser(token);
      if (authUser?.email) {
        const dbUser = await db.users.findByEmail(authUser.email);
        if (dbUser && dbUser.role === 'admin' && dbUser.is_admin_approved !== false) return true;
      }
    }

    const userEmail = (req.headers['x-user-email'] || req.body?.admin_email) as string;
    if (userEmail) {
      const dbUser = await db.users.findByEmail(userEmail);
      if (dbUser && dbUser.role === 'admin' && dbUser.is_admin_approved !== false) return true;
    }

    const userId = (req.headers['x-user-id'] || req.body?.admin_user_id || req.query?.admin_user_id) as string;
    if (userId) {
      const dbUser = await db.users.findById(userId);
      if (dbUser && dbUser.role === 'admin' && dbUser.is_admin_approved !== false) return true;
    }
  } catch (e) {}

  return false;
}

app.post('/api/admin/delete-team', async (req: Request, res: Response) => {
  const { team_id } = req.body;
  try {
    const isAuthorized = await isReqAuthorizedAdmin(req);
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Forbidden: Valid admin key or active admin session required.' });
    }

    await db.teams.deleteTeam(team_id);
    res.json({ success: true, message: 'Team forcefully deleted by admin.' });
  } catch (err: any) {
    res.status(403).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/toggle-role', async (req: Request, res: Response) => {
  const { target_user_id, target_email, role } = req.body;
  try {
    const isAuthorized = await isReqAuthorizedAdmin(req);
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Forbidden: Valid admin key or active admin session required.' });
    }

    if (role !== 'admin' && role !== 'participant') {
      return res.status(400).json({ success: false, error: 'Invalid role specified. Allowed values: "admin", "participant"' });
    }

    let targetId = target_user_id;
    if (!targetId && target_email) {
      const targetUser = await db.users.findByEmail(target_email);
      if (!targetUser) return res.status(404).json({ success: false, error: `User with email '${target_email}' not found.` });
      targetId = targetUser.id;
    }

    if (!targetId) {
      return res.status(400).json({ success: false, error: 'Either target_user_id or target_email is required.' });
    }

    await db.users.updateRole(targetId, role);
    res.json({ success: true, message: `User '${targetId}' role updated to '${role}' successfully!` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/approve-admin', async (req: Request, res: Response) => {
  const { target_user_id, target_email } = req.body;
  try {
    const isAuthorized = await isReqAuthorizedAdmin(req);
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Forbidden: Valid admin key or active admin session required.' });
    }

    let targetId = target_user_id;
    if (!targetId && target_email) {
      const targetUser = await db.users.findByEmail(target_email);
      if (!targetUser) return res.status(404).json({ success: false, error: `User with email '${target_email}' not found.` });
      targetId = targetUser.id;
    }

    if (!targetId) {
      return res.status(400).json({ success: false, error: 'Either target_user_id or target_email is required.' });
    }

    await db.users.approveAdmin(targetId);
    res.json({ 
      success: true, 
      message: `Admin user '${targetId}' has been approved and granted admin secret key access!` 
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/users', async (req: Request, res: Response) => {
  try {
    const isAuthorized = await isReqAuthorizedAdmin(req);
    if (!isAuthorized) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Valid Admin API key or active admin session required.' });
    }

    const users = await db.users.listAllUsers();
    res.json({ success: true, count: users.length, data: users });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/delete-user', async (req: Request, res: Response) => {
  const { target_user_id, target_email } = req.body;
  try {
    const isAuthorized = await isReqAuthorizedAdmin(req);
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Forbidden: Valid admin key or active admin session required.' });
    }

    let targetId = target_user_id;
    if (!targetId && target_email) {
      const targetUser = await db.users.findByEmail(target_email);
      if (!targetUser) return res.status(404).json({ success: false, error: `User with email '${target_email}' not found.` });
      targetId = targetUser.id;
    }

    if (!targetId) {
      return res.status(400).json({ success: false, error: 'Either target_user_id or target_email is required.' });
    }

    await db.users.deleteUser(targetId);
    res.json({ 
      success: true, 
      message: `User '${targetId}' deleted successfully from database!` 
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Mount leaderboard and challenge routes
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/challenges', challengeRoutes);

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Cicada 2067 Backend is live and Database Agnostic!' });
});

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    service: 'Cicada-26 Leaderboard & Challenge API',
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
