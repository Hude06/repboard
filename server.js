import express from 'express';
import cors from 'cors';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';

const app = express();
const PORT = 3000;
const CLIENT_ID = '630610710531-cs7afi140j0knbfn43mcjduj7etv5tbn.apps.googleusercontent.com';
const client = new OAuth2Client(CLIENT_ID);

app.use(cors());
app.use(express.json());

const DATA_FILE = './data.json';

// Load data on startup
let userData = {};
if (fs.existsSync(DATA_FILE)) {
  try {
    const json = fs.readFileSync(DATA_FILE, 'utf8');
    userData = JSON.parse(json);
    console.log("Data loaded:", userData);
  } catch (err) {
    console.error("Error reading data file:", err);
    userData = {};
  }
} else {
  userData = {};
}

// Save data helper
function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(userData, null, 2), 'utf8');
    console.log("Data saved successfully.");
  } catch (err) {
    console.error("Error saving data:", err);
  }
}

app.post('/yearly-goal', async (req, res) => {
  const { userid } = req.body;

  if (!userid) {
    return res.status(400).json({ error: 'Invalid request. UserID is required.' });
  }

  if (!userData[userid]) {
    return res.status(404).json({ error: 'User not found.' });
  }

  userData[userid].yearlyGoalAchieved = true;
  console.log(`User ${userid} has achieved their yearly goal.`);
  saveData();

  return res.json({ success: true });
});

app.post('/add-rep', (req, res) => {
  console.log("Adding rep to user");

  const { userid, type, count, username } = req.body;

  // Validation checks
  if (!userid || !type || typeof count !== 'number') {
    return res.status(400).json({ error: 'Invalid request. Ensure all fields are provided and count is a number' });
  }

  if (!['pushup', 'pullup'].includes(type)) {
    return res.status(400).json({ error: 'Invalid exercise type. Allowed types are pushup or pullup' });
  }

  // Check if user exists in userData, initialize if not
  if (!userData[userid]) {
    console.log("name is " + username)
    userData[userid] = { name: username, pushup: 0, pullup: 0 };
  }

  // Update the rep count
  userData[userid][type] += count;

  // Write updated data to file
  fs.writeFile(DATA_FILE, JSON.stringify(userData, null, 2), (err) => {
    if (err) {
      console.error('Error writing to file', err);
      return res.status(500).json({ error: 'Failed to save data' });
    }

    // Successfully updated
    res.status(200).json({ total: userData[userid][type] });
  });
});


// Get total reps for a user
app.get('/total/:userid', (req, res) => {
  const { userid } = req.params;
  if (!userData[userid]) return res.json({ pushups: 0, pullups: 0 });
  res.json(userData[userid]);
});
app.get('/total', (req, res) => {
  res.send(JSON.stringify(userData))
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
