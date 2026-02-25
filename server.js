import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';

const app = express();
const PORT = 3000;
const CLIENT_ID = '630610710531-cs7afi140j0knbfn43mcjduj7etv5tbn.apps.googleusercontent.com';
const client = new OAuth2Client(CLIENT_ID);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for simplicity in this case
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);
app.use(cors({
  origin: ['http://localhost:5173', 'https://apps.judemakes.dev', 'https://yourdomain.com'],
  credentials: true
}));
app.use(express.json({ limit: '10kb' })); // Limit body size

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

const DATA_FILE = './data.json';

// Input validation schemas
const schemas = {
  addRep: {
    userid: { type: 'string', required: true, minLength: 1 },
    type: { type: 'string', required: true, enum: ['pushup', 'pullup'] },
    count: { type: 'number', required: true, min: -1000, max: 1000 },
    username: { type: 'string', required: false, maxLength: 100 }
  },
  challengeProgress: {
    userid: { type: 'string', required: true, minLength: 1 },
    count: { type: 'number', required: true, min: 0, max: 10000 }
  }
};

// Validation middleware
function validate(schema) {
  return (req, res, next) => {
    const errors = [];
    const schemaRules = schemas[schema];
    
    if (!schemaRules) {
      return next();
    }
    
    for (const [field, rules] of Object.entries(schemaRules)) {
      const value = req.body[field];
      
      // Required field check
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
        continue;
      }
      
      // Skip validation if field is optional and not provided
      if (!rules.required && (value === undefined || value === null || value === '')) {
        continue;
      }
      
      // Type check
      if (rules.type && typeof value !== rules.type) {
        errors.push(`${field} must be of type ${rules.type}`);
        continue;
      }
      
      // String validations
      if (rules.type === 'string') {
        if (rules.minLength && value.length < rules.minLength) {
          errors.push(`${field} must be at least ${rules.minLength} characters`);
        }
        if (rules.maxLength && value.length > rules.maxLength) {
          errors.push(`${field} must be at most ${rules.maxLength} characters`);
        }
        if (rules.enum && !rules.enum.includes(value)) {
          errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
        }
      }
      
      // Number validations
      if (rules.type === 'number') {
        if (rules.min && value < rules.min) {
          errors.push(`${field} must be at least ${rules.min}`);
        }
        if (rules.max && value > rules.max) {
          errors.push(`${field} must be at most ${rules.max}`);
        }

      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors 
      });
    }
    
    next();
  };
}

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

// Get day of year
function getDayOfYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  const oneDay = 1000 * 60 * 60 * 24;
  const day = Math.floor(diff / oneDay);
  return day;
}

// Get today's date string
function getTodayString() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

// Initialize challenge data if not exists
function ensureChallengeData(userid) {
  const today = getTodayString();

  if (!userData[userid]) {
    userData[userid] = {
      name: 'Anonymous',
      pushup: 0,
      pullup: 0,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      challenge: {
        date: today,
        progress: 0,
        completed: false
      }
    };
  } else if (!userData[userid].challenge) {
    userData[userid].challenge = {
      date: today,
      progress: 0,
      completed: false
    };
  }
}


app.post('/add-rep', validate('addRep'), async (req, res) => {
  try {
    const { userid, type, count, username } = req.body;

    // Check if user exists in userData, initialize if not
    if (!userData[userid]) {
      userData[userid] = {
        name: username || 'Anonymous',
        pushup: 0,
        pullup: 0,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        challenge: {
          date: getTodayString(),
          progress: 0,
          completed: false
        }
      };
      console.log(`Created new user: ${userData[userid].name} (${userid})`);
    }

    // Update the rep count
    const oldCount = userData[userid][type];
    userData[userid][type] += count;
    userData[userid].lastUpdated = new Date().toISOString();

    // Save to file asynchronously
    saveData();

    console.log(`Updated ${type} for user ${userData[userid].name}: ${oldCount} → ${userData[userid][type]}`);

    // Successfully updated
    res.status(200).json({ 
      total: userData[userid][type], 
      previousTotal: oldCount,
      added: count,
      exercise: type
    });

  } catch (error) {
    console.error('Error in /add-rep:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Get total reps for a user
app.get('/total/:userid', (req, res) => {
  const { userid } = req.params;
  if (!userData[userid]) {
    return res.json({ pushup: 0, pullup: 0 });
  }
  
  // Return only necessary user data (exclude sensitive info)
  const { pushup, pullup, name } = userData[userid];
  res.json({ pushup, pullup, name });
});

app.get('/total', (req, res) => {
  try {
    const today = getTodayString();
    const dayOfYear = getDayOfYear();

    // Transform data to include challenge completion status
    const transformedData = {};
    for (const [id, user] of Object.entries(userData)) {
      transformedData[id] = {
        ...user,
        challengeCompleted: user.challenge?.date === today && user.challenge?.completed
      };
    }

    res.json(transformedData);
  } catch (error) {
    console.error('Error in /total:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Get today's daily challenge info
app.get('/challenge/daily', (req, res) => {
  try {
    const dayOfYear = getDayOfYear();
    const target = dayOfYear;
    const today = getTodayString();

    // Count completed users for today
    let completedCount = 0;
    const completedBy = [];

    for (const [id, user] of Object.entries(userData)) {
      if (user.challenge && user.challenge.date === today && user.challenge.completed) {
        completedCount++;
        completedBy.push({ id, name: user.name });
      }
    }

    res.json({
      dayOfYear,
      target,
      date: today,
      completedCount,
      completedBy
    });
  } catch (error) {
    console.error('Error in /challenge/daily:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update challenge progress
app.post('/challenge/progress', validate('challengeProgress'), (req, res) => {
  try {
    const { userid, count } = req.body;
    const today = getTodayString();

    // Ensure user and challenge data exists
    ensureChallengeData(userid);

    const userChallenge = userData[userid].challenge;

    // Reset if it's a new day
    if (userChallenge.date !== today) {
      userChallenge.date = today;
      userChallenge.progress = 0;
      userChallenge.completed = false;
    }

    const oldProgress = userChallenge.progress;
    userChallenge.progress = Math.max(userChallenge.progress, count);

    // Check if completed
    const dayOfYear = getDayOfYear();
    if (userChallenge.progress >= dayOfYear && !userChallenge.completed) {
      userChallenge.completed = true;
    }

    userData[userid].lastUpdated = new Date().toISOString();
    saveData();

    console.log(`Updated challenge progress for ${userData[userid].name}: ${oldProgress} → ${userChallenge.progress}`);

    res.json({
      progress: userChallenge.progress,
      target: dayOfYear,
      completed: userChallenge.completed
    });

  } catch (error) {
    console.error('Error in /challenge/progress:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get challenge leaderboard (who completed today)
app.get('/challenge/leaderboard', (req, res) => {
  try {
    const today = getTodayString();
    const completed = [];

    for (const [id, user] of Object.entries(userData)) {
      if (user.challenge && user.challenge.date === today && user.challenge.completed) {
        completed.push({
          id,
          name: user.name,
          progress: user.challenge.progress,
          target: getDayOfYear()
        });
      }
    }

    res.json({
      date: today,
      completed
    });

  } catch (error) {
    console.error('Error in /challenge/leaderboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 404 handler - using regex pattern instead of wildcard
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  if (res.headersSent) {
    return next(error);
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  saveData();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  saveData();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 RepBoard API server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
