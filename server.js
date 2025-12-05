import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import cors from 'cors';
import { OAuth2Client } from 'google-auth-library';

const app = express();
const PORT = 3000;
const CLIENT_ID = '630610710531-cs7afi140j0knbfn43mcjduj7etv5tbn.apps.googleusercontent.com';
const client = new OAuth2Client(CLIENT_ID);

app.use(cors());
app.use(bodyParser.json());

let users = {};      // loaded from data.json
let repsLog = [];    // store individual reps/actions

// Load data on start
try {
    users = JSON.parse(fs.readFileSync('data.json'));
} catch (e) {
    console.log("No existing data, starting fresh");
    users = {};
}

// Save data helper
function saveData() {
    fs.writeFileSync('data.json', JSON.stringify(users, null, 2));
}

// -------------------
// Google Auth Endpoint
// -------------------
app.post('/verify-token', async (req, res) => {
    const { id_token } = req.body;
    if (!id_token) return res.status(400).json({ error: 'Missing token' });

    try {
        const ticket = await client.verifyIdToken({
            idToken: id_token,
            audience: CLIENT_ID
        });

        const payload = ticket.getPayload();
        const userId = payload.sub;

        // Add user if doesn't exist
        if (!users[userId]) {
            users[userId] = {
                name: payload.name,
                email: payload.email,
                PushUp: 0,
                PullUp: 0,
                sessions: []
            };
            saveData();
        }

        res.json({ success: true, user: users[userId], userId });
    } catch (err) {
        console.error(err);
        res.status(401).json({ error: 'Invalid token' });
    }
});

// -------------------
// Add Rep Endpoint
// -------------------
app.post('/add-rep', (req, res) => {
    const { userId, type, reps, sessionId, id } = req.body;

    if (!users[userId]) return res.status(404).json({ error: 'User not found' });

    // Map frontend type to backend key
    const typeMap = { pushup: 'PushUp', pullup: 'PullUp' };
    const normalizedType = type.toLowerCase();
    const userKey = typeMap[normalizedType];

    if (!userKey) return res.status(400).json({ error: 'Invalid rep type' });

    // Update totals
    users[userId][userKey] = (users[userId][userKey] || 0) + reps;

    // Save session info if provided
    if (sessionId) {
        if (!users[userId].sessions) users[userId].sessions = [];
        users[userId].sessions.push({ sessionId, type: userKey, reps, timestamp: Date.now() });
    }

    // Log individual action
    repsLog.push({
        user: users[userId].name,
        GooglAuth: userId,
        Reps: reps,
        Type: userKey,
        sessionId: sessionId || null,
        timestamp: Date.now(),
        id: id || null
    });

    saveData();

    console.log('Logged reps:', repsLog[repsLog.length - 1], 'Total:', users[userId][userKey], userKey);
    res.json({ success: true, total: users[userId][userKey] });
});


app.post('/get-all-reps', (req, res) => {
    const { userId } = req.body;
    if (!users[userId]) return res.status(404).json({ error: 'User not found' });
    console.log('Fetching all-time reps for user:', users[userId].name, users[userId],users[userId].PushUp,users[userId].PullUp);
    res.json({ 
        success: true, 
        allTime: { 
            push: users[userId].PushUp || 0,
            pull: users[userId].PullUp || 0
        } 
    });
});
// -------------------
// Get Leaderboard
// -------------------
app.get('/leaderboard', (req, res) => {
    const leaderboard = Object.values(users)
        .map(u => ({
            name: u.name,
            PushUp: u.PushUp,
            PullUp: u.PullUp
        }))
        .sort((a, b) => (b.PushUp + b.PullUp) - (a.PushUp + a.PullUp));

    res.json(leaderboard);
});

// -------------------
// Start server
// -------------------
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
