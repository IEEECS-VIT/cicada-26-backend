import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './db';
import { v4 as uuidv4 } from 'uuid';

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
  const { email, google_display_name } = req.body;
  try {
    const user = await db.users.findByEmail(email);
    
    if (!user) {
      return res.status(403).json({ 
        success: false, 
        error: `UNAUTHORIZED: Your email (${email}) is not whitelisted for Cicada 2067.` 
      });
    }

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
