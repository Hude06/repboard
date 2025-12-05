let currentValue = {
    push: 0,
    pull: 0
}
let alltimerep = {
    push: 0,
    pull: 0
}
const repCount = document.getElementById('repCount');
const repTypeSelect = document.getElementById('repType');
const googleSignInButton = document.getElementById('googleSignInButton');
let userId = null;
let repType = repTypeSelect.value;
console.log(`Selected rep type: ${repType}`);
let currentKeyboardKey = new Map();
window.addEventListener('DOMContentLoaded', () => {
    const storedUserId = localStorage.getItem('userId');
    const storedUsername = localStorage.getItem('username');

    if (storedUserId && storedUsername) {
        userId = storedUserId;
        updateUIForLoggedInUser(storedUsername);
        loadAllTimeRepsFromServerOrLocal();
    } else {
        updateUIForLoggedInUser(); // Guest
        loadAllTimeReps(); // fallback to localStorage
    }
});
async function loadAllTimeRepsFromServerOrLocal() {
    if (!userId) {
        // Not logged in, just use localStorage
        loadAllTimeReps();
        return;
    }

    try {
        const res = await fetch('http://localhost:3000/get-all-reps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        const data = await res.json();
        if (data.success && data.allTime) {
            alltimerep = data.allTime; // use server totals
            console.log('Loaded all-time reps from server:', alltimerep);
        } else {
            console.warn('Failed to fetch all-time reps from server, using localStorage');
            loadAllTimeReps(); // fallback
        }
    } catch (err) {
        console.error('Error fetching all-time reps:', err);
        loadAllTimeReps(); // fallback
    }
    
    // Update UI stats
    stats.allTimePushUps.innerText = alltimerep.push;
    stats.allTimePullUps.innerText = alltimerep.pull;
    repCount.textContent = currentValue[repType] || 0; // add this
}
document.addEventListener('keydown', (event) => {
    currentKeyboardKey.set(event.code, true);
    if (currentKeyboardKey.get('Space')) {
        console.log('Space key pressed - incrementing rep count');
        increaseRepCount(1,repType);
    }
});
googleSignInButton.addEventListener('click', () => {
    console.log("Google Sign-In button clicked");

    google.accounts.id.initialize({
      client_id: '630610710531-cs7afi140j0knbfn43mcjduj7etv5tbn.apps.googleusercontent.com',
      callback: handleCredentialResponse
    });

    // Force the prompt every time, even if previously dismissed
    google.accounts.id.prompt(); // One Tap
});


async function handleCredentialResponse(response) {
    const token = response.credential;
    localStorage.setItem('id_token', token);

    const payload = token.split('.')[1];
    const decodedPayload = JSON.parse(atob(payload));
    console.log("Decoded JWT payload:", decodedPayload);

    try {
        const data = await verifyToken(token);
        const username = data.user.name;

        // Save locally for offline
        localStorage.setItem('userId', data.userId);
        localStorage.setItem('username', username);

        updateUIForLoggedInUser(username);
        userId = data.userId;
        loadAllTimeRepsFromServerOrLocal(); // reload totals from server after login
        currentValue = { push: 0, pull: 0 };
        repCount.textContent = currentValue[repType];
    } catch (error) {
        console.error("Error verifying token:", error);

        // Fallback if offline
        const storedUserId = localStorage.getItem('userId');
        const storedUsername = localStorage.getItem('username');
        if (storedUserId && storedUsername) {
            userId = storedUserId;
            updateUIForLoggedInUser(storedUsername);
            currentValue = { push: 0, pull: 0 }; // reset current session counts
            repCount.textContent = currentValue[repType]; // reset display
        } else {
            userId = null;
            updateUIForLoggedInUser(); // show guest
        }
    }
}
function updateUIForLoggedInUser(username = "Guest") {
    document.getElementById("username").innerText = username;
    document.getElementById("initial").innerText = username.charAt(0).toUpperCase();
    document.getElementById("googleSignInButton").style.display = username === "Guest" ? "block" : "none";
}
document.addEventListener('keyup', (event) => {
    currentKeyboardKey.set(event.code, false);
});
// Log a rep locally in localStorage
function logLocalStorageRep(userId, type, reps, sessionId = null, id) {
    const pendingReps = JSON.parse(localStorage.getItem('pendingReps') || '[]');
    pendingReps.push({ userId, type, reps, sessionId, id, timestamp: Date.now() });
    localStorage.setItem('pendingReps', JSON.stringify(pendingReps));
}

// Get all pending reps from localStorage
function getLocalStorageReps() {
    return JSON.parse(localStorage.getItem('pendingReps') || '[]');
}

// Save updated pending reps back to localStorage
function setLocalStorageReps(reps) {
    localStorage.setItem('pendingReps', JSON.stringify(reps));
}

// Attempt to log reps to the server
async function logServerRep(userId, type, reps, sessionId = null, id) {
    // Step 1: log locally first
    logLocalStorageRep(userId, type, reps, sessionId, id);
    console.log('Logged rep locally:', { userId, type, reps, sessionId, id });  
    // Step 2: get all pending reps
    const pendingReps = getLocalStorageReps();
    if (pendingReps.length === 0) return null;

    const failedReps = [];
    let lastTotal = null;

    // Step 3: try to send each pending rep
    for (const rep of pendingReps) {
        try {
            const res = await fetch('http://localhost:3000/add-rep', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rep)
            });
            const data = await res.json();
            if (data.success) {
                console.log('Successfully logged rep:', rep);
                lastTotal = data.total;
            } else {
                console.error('Failed to log rep:', rep, data);
                failedReps.push(rep);
            }
        } catch (err) {
            console.error('Error logging rep:', rep, err);
            failedReps.push(rep);
        }
    }

    // Step 4: save any reps that failed for retry
    setLocalStorageReps(failedReps);

    return lastTotal;
}
function getServerReps(userId, type) {
    fetch('http://localhost:3000/get-reps', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ userId, type })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            currentValue[type] = data.total;
            repCount.textContent = currentValue[type];
            console.log(`Fetched ${type} reps from server:`, data.total);
        } else {
            console.error('Failed to fetch reps from server:', data);
        }
    })
    .catch(err => {
        console.error('Error fetching reps from server:', err);
    });
}
function saveAllTimeReps() {
    localStorage.setItem('alltimerep', JSON.stringify(alltimerep));
}
function loadAllTimeReps() {
    const stored = localStorage.getItem('alltimerep');
    if (stored) {
        alltimerep = JSON.parse(stored);
    }
}

function logout() {
    console.log("Logging out user");
    // Clear user session or token here
    document.getElementById("username").innerText = "Guest";
    document.getElementById("initial").innerText = "G";
    document.getElementById("googleSignInButton").style.display = "block";
}
async function verifyToken(id_token) {
    const res = await fetch('http://localhost:3000/verify-token', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ id_token })
    });
    const data = await res.json();
    console.log('User verified:', data);
    return data; // now this actually returns to the caller
}

document.getElementById("logoutBtn").addEventListener('click', logout);
async function increaseRepCount(reps,type) {
    const id = Date.now(); // simple unique ID based on timestamp
    alltimerep[type] += reps;
    currentValue[type] += reps;
    repCount.textContent = currentValue[type];
    console.log(alltimerep,currentValue[type]);
    stats.allTimePushUps.innerText = alltimerep.push;
    stats.allTimePullUps.innerText = alltimerep.pull;
    saveAllTimeReps();

    try {
        if (!userId) return; // skip if not signed in
        await logServerRep(userId, type, reps, null,id);

    } catch (error) {
        console.error("Error logging reps to server:", error);
    }
}

repTypeSelect.addEventListener('change', () => {
  repType = repTypeSelect.value;
  console.log(`Selected rep type: ${repType}`);
  repCount.textContent = currentValue[repType];
});
const pages = {
  repPage: document.getElementById('repPage'),
  profilePage: document.getElementById('profilePage'),
  communityPage: document.getElementById('communityPage')
};
const stats = {
    allTimePushUps: document.getElementById("AllTimePushUpStat"),
    allTimePullUps: document.getElementById("AllTimePullUpStat")
}
const buttons = {
  repPageButton: document.getElementById('repPageButton'),
  profileButton: document.getElementById('profileButton'),
  communityButton: document.getElementById('communityButton'),
  repButton: document.getElementById('repButton')
};
const incerments = {
    increment: document.getElementById('incerment'),
    decrement: document.getElementById('decrement')
}
// Mobile-optimized increment
buttons.repButton.addEventListener('click', () => {
    increaseRepCount(1,repType);    
});
incerments.increment.addEventListener('click', () => {
    increaseRepCount(5,repType);
});
incerments.decrement.addEventListener('click', () => {
    increaseRepCount(-5,repType);
});
// Page switcher
function showPage(pageId) {
  for (const key in pages) {
    pages[key].style.display = key === pageId ? 'block' : 'none';
  }

  // Highlight active button
  Object.values(buttons).forEach(btn => btn.classList?.remove('active'));

  if (pageId === 'repPage') {
    buttons.repPageButton.classList.add('active');
  } else if (pageId === 'profilePage') {
    buttons.profileButton.classList.add('active');
    stats.allTimePullUps.innerText = alltimerep.pull;
    stats.allTimePushUps.innerText = alltimerep.push;
    
}
  else if (pageId === 'communityPage') {
    buttons.communityButton.classList.add('active');
}

}

// Navbar buttons
buttons.repPageButton.addEventListener('click', () => showPage('repPage'));
buttons.profileButton.addEventListener('click', () => showPage('profilePage'));
buttons.communityButton.addEventListener('click', () => showPage('communityPage'));

// Show default page
showPage('repPage');
