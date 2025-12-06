let currentValue = { push: 0, pull: 0 };
let alltimerep = { push: 0, pull: 0 };

const reset = document.getElementById('reset');
const repCount = document.getElementById('repCount');
const repTypeSelect = document.getElementById('repType');
const googleSignInButton = document.getElementById('googleSignInButton');
const logoutBtn = document.getElementById('logoutBtn');

let userId = null;
let repType = 'push';
let currentKeyboardKey = new Map();

const pages = {
  repPage: document.getElementById('repPage'),
  profilePage: document.getElementById('profilePage'),
  communityPage: document.getElementById('communityPage')
};

const stats = {
  allTimePushUps: document.getElementById("AllTimePushUpStat"),
  allTimePullUps: document.getElementById("AllTimePullUpStat")
};

const buttons = {
  repPageButton: document.getElementById('repPageButton'),
  profileButton: document.getElementById('profileButton'),
  communityButton: document.getElementById('communityButton'),
  repButton: document.getElementById('repButton')
};

const increments = {
  increment: document.getElementById('incerment'),
  decrement: document.getElementById('decrement')
};

// -------------------------
// Utility: Update stats UI
// -------------------------
function updateStatsUI() {
  stats.allTimePushUps.innerText = alltimerep.push;
  stats.allTimePullUps.innerText = alltimerep.pull;
  repCount.textContent = currentValue[repType] || 0;

  // Disable rep buttons for guests
  const disabled = !userId;
  buttons.repButton.disabled = disabled;
  increments.increment.disabled = disabled;
  increments.decrement.disabled = disabled;
}

// -------------------------
// Load all-time reps
// -------------------------
async function loadAllTimeRepsFromServerOrLocal() {
  if (!userId) {
    loadAllTimeReps();
    updateStatsUI();
    return;
  }

  try {
    const res = await fetch('https://apps.judemakes.dev/api/get-all-reps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    const data = await res.json();
    if (data.success && data.allTime) {
      alltimerep = data.allTime;
      console.log('Loaded all-time reps from server:', alltimerep);
    } else {
      console.warn('Failed to fetch server reps, using localStorage');
      loadAllTimeReps();
    }
  } catch (err) {
    console.error('Error fetching all-time reps:', err);
    loadAllTimeReps();
  }

  updateStatsUI();
}

// -------------------------
// Local storage helpers
// -------------------------
function logLocalStorageRep(userId, type, reps, sessionId = null, id) {
  if (!userId) return;
  const pendingReps = JSON.parse(localStorage.getItem('pendingReps') || '[]');
  pendingReps.push({ userId, type, reps, sessionId, id, timestamp: Date.now() });
  localStorage.setItem('pendingReps', JSON.stringify(pendingReps));
}

function getLocalStorageReps() {
  return JSON.parse(localStorage.getItem('pendingReps') || '[]');
}

function setLocalStorageReps(reps) {
  localStorage.setItem('pendingReps', JSON.stringify(reps));
}

function saveAllTimeReps() {
  localStorage.setItem('alltimerep', JSON.stringify(alltimerep));
}

function loadAllTimeReps() {
  const stored = localStorage.getItem('alltimerep');
  if (stored) alltimerep = JSON.parse(stored);
}

// -------------------------
// Rep logging
// -------------------------
async function logServerRep(userId, type, reps, sessionId = null, id) {
  logLocalStorageRep(userId, type, reps, sessionId, id);

  const pendingReps = getLocalStorageReps();
  if (pendingReps.length === 0) return null;

  const failedReps = [];
  let lastTotal = null;

  for (const rep of pendingReps) {
    try {
      const res = await fetch('https://apps.judemakes.dev/api/add-rep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rep)
      });
      const data = await res.json();
      if (data.success) {
        lastTotal = data.total;
      } else {
        failedReps.push(rep);
      }
    } catch {
      failedReps.push(rep);
    }
  }

  setLocalStorageReps(failedReps);
  return lastTotal;
}

// -------------------------
// Increase rep count
// -------------------------
async function increaseRepCount(reps, type) {
  if (!userId) {
    alert("Please sign in to log reps!");
    return;
  }

  type = type.toLowerCase();
  alltimerep[type] = (alltimerep[type] || 0) + reps;
  currentValue[type] = (currentValue[type] || 0) + reps;

  updateStatsUI();
  saveAllTimeReps();

  try {
    await logServerRep(userId, type, reps, null, Date.now());
  } catch (error) {
    console.error("Error logging reps to server:", error);
  }
}

// -------------------------
// Google Sign-In
// -------------------------
function handleCredentialResponse(response) {
  const token = response.credential;
  localStorage.setItem('id_token', token);

  const payload = JSON.parse(atob(token.split('.')[1]));
  console.log("Decoded JWT payload:", payload);

  verifyToken(token).then(data => {
    const username = data.user.name;
    localStorage.setItem('userId', data.userId);
    localStorage.setItem('username', username);

    userId = data.userId;
    currentValue = { push: 0, pull: 0 };

    updateUIForLoggedInUser(username);
    loadAllTimeRepsFromServerOrLocal();
  }).catch(err => {
    console.error("Token verification failed:", err);
    logout();
  });
}

// -------------------------
// Verify token via server
// -------------------------
async function verifyToken(id_token) {
  const res = await fetch('https://apps.judemakes.dev/api/verify-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_token })
  });
  const data = await res.json();
  return data;
}

// -------------------------
// Update UI for logged-in user
// -------------------------
function updateUIForLoggedInUser(username = "Guest") {
  document.getElementById("username").innerText = username;
  document.getElementById("initial").innerText = username.charAt(0).toUpperCase();
  googleSignInButton.style.display = username === "Guest" ? "block" : "none";
  updateStatsUI();
}

// -------------------------
// Logout
// -------------------------
function logout() {
  userId = null;
  currentValue = { push: 0, pull: 0 };
  repCount.textContent = 0;

  updateUIForLoggedInUser();
}

// -------------------------
// Page switcher
// -------------------------
function showPage(pageId) {
  for (const key in pages) {
    pages[key].style.display = key === pageId ? 'block' : 'none';
  }

  Object.values(buttons).forEach(btn => btn.classList?.remove('active'));

  if (pageId === 'repPage') buttons.repPageButton.classList.add('active');
  else if (pageId === 'profilePage') {
    buttons.profileButton.classList.add('active');
    loadAllTimeRepsFromServerOrLocal();
  } else if (pageId === 'communityPage') {
    buttons.communityButton.classList.add('active');
  }
}

// -------------------------
// Event listeners
// -------------------------
window.addEventListener('DOMContentLoaded', () => {
  // Initialize rep type
  repType = repTypeSelect.value.toLowerCase();

  const storedUserId = localStorage.getItem('userId');
  const storedUsername = localStorage.getItem('username');
  if (storedUserId && storedUsername) {
    userId = storedUserId;
    updateUIForLoggedInUser(storedUsername);
    loadAllTimeRepsFromServerOrLocal();
  } else updateUIForLoggedInUser();

  // Initialize Google Sign-In once
  google.accounts.id.initialize({
    client_id: '630610710531-cs7afi140j0knbfn43mcjduj7etv5tbn.apps.googleusercontent.com',
    callback: handleCredentialResponse
  });
});

googleSignInButton.addEventListener('click', () => google.accounts.id.prompt());
logoutBtn.addEventListener('click', logout);

repTypeSelect.addEventListener('change', () => {
  repType = repTypeSelect.value.toLowerCase();
  updateStatsUI();
});

// Keyboard handling
document.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && !currentKeyboardKey.get('Space')) {
    increaseRepCount(1, repType);
  }
  currentKeyboardKey.set(event.code, true);
});
document.addEventListener('keyup', (event) => {
  currentKeyboardKey.set(event.code, false);
});

// Rep buttons
buttons.repButton.addEventListener('click', () => increaseRepCount(1, repType));
increments.increment.addEventListener('click', () => increaseRepCount(5, repType));
increments.decrement.addEventListener('click', () => increaseRepCount(-5, repType));

// Navbar buttons
buttons.repPageButton.addEventListener('click', () => showPage('repPage'));
buttons.profileButton.addEventListener('click', () => showPage('profilePage'));
buttons.communityButton.addEventListener('click', () => showPage('communityPage'));

// Show default page
showPage('repPage');
