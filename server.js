// server.mjs
import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs/promises';
import fsSync from 'fs';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
const app = express();

const PORT = parseInt(process.env.PORT || '3000', 10);
const CLIENT_ID = '630610710531-cs7afi140j0knbfn43mcjduj7etv5tbn.apps.googleusercontent.com';
const client = new OAuth2Client(CLIENT_ID);

// In-memory session store: sessionId -> { userId, createdAt }
// For production use a persistent store (Redis, DB)
const sessions = new Map();

// Data store
let users = {}; // userId -> { name, email, PushUp, PullUp, sessions: [...] }

// Load data at startup (if file exists)
const DATA_FILE = 'data.json';
async function loadData() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    users = JSON.parse(raw);
    console.log('Loaded data.json');
  } catch (e) {
    console.log('No data.json or invalid JSON - starting fresh');
    users = {};
  }
}
loadData();

// Atomic async write helper
async function saveData() {
  const tmp = DATA_FILE + '.tmp';
  const payload = JSON.stringify(users, null, 2);
  await fs.writeFile(tmp, payload, 'utf8');
  await fs.rename(tmp, DATA_FILE);
}

// Basic rate limiter (per IP)
const limiter = rateLimit({
  windowMs: 10 * 1000, // 10s window
  max: 30, // limit each IP to 30 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false
});

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(limiter);

// Utility: generate secure random session id
function genSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

// Verify Google id_token and return payload
async function verifyGoogleToken(id_token) {
  const ticket = await client.verifyIdToken({
    idToken: id_token,
    audience: CLIENT_ID
  });
  return ticket.getPayload();
}

// Middleware: authenticate via session cookie (HttpOnly cookie named 'session')
function requireSession(req, res, next) {
  const sessionId = req.cookies?.session;
  if (!sessionId) return res.status(401).json({ success:false, error: 'Not authenticated' });
  const session = sessions.get(sessionId);
  if (!session) return res.status(401).json({ success:false, error: 'Invalid session' });
  // attach userId to request
  req.userId = session.userId;
  next();
}

// Accept several variants for rep type (push, pushup, pull, pullup)
function normalizeTypeIncoming(type) {
  if (!type || typeof type !== 'string') return null;
  const t = type.toLowerCase();
  if (t === 'push' || t === 'pushup') return 'PushUp';
  if (t === 'pull' || t === 'pullup') return 'PullUp';
  return null;
}

// -------------------- Endpoints --------------------

// Verify token: frontend sends id_token (Google). Server verifies, creates/returns user and sets session cookie.
app.post('/verify-token', async (req, res) => {
  const { id_token } = req.body;
  if (!id_token) return res.status(400).json({ success:false, error: 'Missing id_token' });

  try {
    const payload = await verifyGoogleToken(id_token);
    const userId = payload.sub;
    if (!users[userId]) {
      users[userId] = {
        name: payload.name || 'Unknown',
        email: payload.email || null,
        PushUp: 0,
        PullUp: 0,
        sessions: []
      };
      await saveData();
    }
    // create session and set HttpOnly cookie
    const sessionId = genSessionId();
    sessions.set(sessionId, { userId, createdAt: Date.now() });

    // Cookie options
    const cookieOptions = {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
    };
    // in production you should set secure: true (requires HTTPS)
    if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

    res.cookie('session', sessionId, cookieOptions);

    // Respond with user info and all-time totals (safe)
    res.json({
      success: true,
      user: { name: users[userId].name, email: users[userId].email },
      allTime: { push: users[userId].PushUp || 0, pull: users[userId].PullUp || 0 }
    });
  } catch (err) {
    console.error('verify-token error', err.message || err);
    res.status(401).json({ success:false, error: 'Invalid token' });
  }
});

// Logout: clear session cookie and remove session
app.post('/logout', (req, res) => {
  const sessionId = req.cookies?.session;
  if (sessionId) {
    sessions.delete(sessionId);
    res.clearCookie('session');
  }
  res.json({ success: true });
});

// Add rep: requires session cookie; server determines userId from session (do not trust any userId in body)
app.post('/add-rep', requireSession, async (req, res) => {
  const { type, reps } = req.body;
  const userId = req.userId;
  const user = users[userId];
  if (!user) return res.status(404).json({ success:false, error: 'User not found' });

  // Validation
  const numReps = Number(reps);
  if (!Number.isFinite(numReps) || !Number.isInteger(numReps)) {
    return res.status(400).json({ success:false, error: 'Invalid reps (must be integer)' });
  }
  if (Math.abs(numReps) > 10000) {
    return res.status(400).json({ success:false, error: 'Reps out of range' });
  }

  const userKey = normalizeTypeIncoming(type);
  if (!userKey) {
    return res.status(400).json({ success:false, error: 'Invalid rep type' });
  }

  // Update user's totals; do not allow totals to go below zero
  user[userKey] = Math.max(0, (user[userKey] || 0) + numReps);

  // record session action
  user.sessions = user.sessions || [];
  user.sessions.push({ reps: numReps, type: userKey, timestamp: Date.now() });
  try {
    await saveData();
  } catch (e) {
    console.error('Error saving data', e);
    // continue, still return success to client; server will try persist next save
  }

  return res.json({ success: true, total: user[userKey] });
});

// Get all-time totals for authenticated user
app.post('/get-all-reps', requireSession, (req, res) => {
  const userId = req.userId;
  const u = users[userId];
  if (!u) return res.status(404).json({ success:false, error: 'User not found' });
  res.json({
    success: true,
    allTime: { push: u.PushUp || 0, pull: u.PullUp || 0 }
  });
});

// Leaderboard: return top users (non-sensitive)
app.get('/leaderboard', (req, res) => {
  const leaderboard = Object.entries(users)
    .map(([id, u]) => ({
      name: u.name,
      total: (u.PushUp || 0) + (u.PullUp || 0),
      push: u.PushUp || 0,
      pull: u.PullUp || 0
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 100);
  res.json({ success: true, leaderboard });
});

// Optional: reset-reps endpoint (authenticated)
app.post('/reset-reps', requireSession, async (req, res) => {
  const userId = req.userId;
  const u = users[userId];
  if (!u) return res.status(404).json({ success:false, error: 'User not found' });
  u.PushUp = 0;
  u.PullUp = 0;
  u.sessions = [];
  try { await saveData(); } catch (e) { console.error('saveData failed:', e); }
  res.json({ success: true });
});

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
