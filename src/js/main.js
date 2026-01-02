import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
const SERVER_URL = "https://apps.judemakes.dev/api";
// const SERVER_URL = "http://localhost:3000";
const HTML = {
  username: document.getElementById("username"),
  initialLetter: document.getElementById("initial"),
  loginMessage: document.getElementById("loginMessage"),
  repTypeSelect: document.getElementById('repType'),
  repCount: document.getElementById("repCount"),
  yearGoal: document.getElementById("yearlyGoal"),
  buttons: {
    decrement: document.getElementById("decrement"),
    incerment: document.getElementById("incerment"),
    googleSignIn: document.getElementById("googleSignInButton"),
    community: document.getElementById("communityButton"),
    repPage: document.getElementById("repPageButton"),
    profile: document.getElementById("profileButton"),
    rep: document.getElementById("repButton"),
    reset:document.getElementById("reset")
  },
  profilePage: {
    alltimePush: document.getElementById("AllTimePushUpStat"),
    alltimePull: document.getElementById("AllTimePullUpStat")
  },
  pages: {
    repPage: document.getElementById("repPage"),
    profilePage: document.getElementById("profilePage"),
    communityPage: document.getElementById("communityPage"),
  },
};
let sessionReps = {
  pushup: 0,
  pullup: 0,
};
const firebaseConfig = {
  apiKey: "AIzaSyDlzLqiIiRjOGZb1KUFHAv7SZmgP41LhKc",
  authDomain: "repboard-77743.firebaseapp.com",
  projectId: "repboard-77743",
  storageBucket: "repboard-77743.firebasestorage.app",
  messagingSenderId: "230840782970",
  appId: "1:230840782970:web:b9ec5b19e82ea0a76aebc3",
  measurementId: "G-7EWJ77ZXRQ"
};
let userId = null
let username = "GUEST";
const app = initializeApp(firebaseConfig);
// after you create auth:
const auth = getAuth(app);

(async function initAuth() {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (e) {
    console.warn("Could not set persistence:", e);
  }

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      userId = user.uid;
      username = user.displayName || user.email || "user";
      updateUserUI(username);

      // safe to call init now
      await init();
      if (navigator.onLine) await updateUIAllTimeReps();
    } else {
      userId = null;
      username = "GUEST";
      updateUserUI(username);
    }
  });
})();

HTML.buttons.googleSignIn.addEventListener('click', handleGoogleSignIn);
document.getElementById("logoutBtn").addEventListener("click", handleLogout);
HTML.buttons.rep.addEventListener("click", () => handleRepButtonClick(1));
HTML.buttons.incerment.addEventListener("click", () => handleRepButtonClick(5));
HTML.buttons.decrement.addEventListener("click", () => handleRepButtonClick(-5));

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault(); // stops page scroll
    handleRepButtonClick(1);
  }
});


function updateYearlyGoal(currentCount) {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now - startOfYear) / 86400000) + 1;

  const goal = (dayOfYear * (dayOfYear + 1)) / 2;

  // Progress text
  HTML.yearGoal.innerText =
    `${currentCount}/${goal} reps toward yearly goal`;

  // Correct comparison + one-time send
  if (currentCount >= goal) {

    fetch(`${SERVER_URL}/yearly-goal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userid: userId })
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(json => {
        console.log("Yearly goal achieved:", json);
        HTML.yearGoal.innerText = "🎉 Yearly Goal Achieved! 🎉";
      })
      .catch(err => {
        console.error("Failed to update yearly goal:", err);
      });
  }
}


// HTML.buttons.reset.addEventListener("click", async function() {
//   const push = await getTotalRepCountServer("pushup")
//   const pull = await getTotalRepCountServer("pullup")

//   console.log(push,pull)
//   increaseRepCount(-push.total,"pushup")
//   increaseRepCount(-pull.total,"pullup")
//   updateUIAllTimeReps()
// })
document.getElementById("reset_current_count").addEventListener("click", () => {
  const type = HTML.repTypeSelect.value;
  localStorage.removeItem(`sessionReps.${type}`);
  sessionReps[type] = 0;
  HTML.repCount.innerText = 0;
});
document.getElementById("resetLocalStorage").addEventListener("click", () => {
  localStorage.clear();
  location.reload();  
});

function init() {
  if (!userId) return;

  // rep page should always start at 0
  sessionReps.pushup = Number(localStorage.getItem("sessionReps.pushup")) || 0;
  sessionReps.pullup = Number(localStorage.getItem("sessionReps.pullup")) || 0;

  HTML.repCount.innerText = sessionReps[HTML.repTypeSelect.value];
  updateYearlyGoal(sessionReps[HTML.repTypeSelect.value]);
}



function updateUserUI(name) {
  HTML.username.innerText = name;
  HTML.initialLetter.textContent = name.charAt(0).toUpperCase();
  HTML.buttons.googleSignIn.style.display = name === "GUEST" ? "flex" : "none";
}
async function handleGoogleSignIn() {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    console.log("Signed in:", result.user.email);
    // no localStorage writes, no manual userId/username assignments —
    // onAuthStateChanged will run and update the UI.
    showPage('profilePage');
    // safe to call these but not required — onAuthStateChanged will run shortly
    if (navigator.onLine) updateUIAllTimeReps();
  } catch (error) {
    console.error("Sign-in error:", error);
    showFallbackMessage("Sign-in failed. Try again.");
  }
}

function handleLogout() {
  signOut(auth).then(() => {
    console.log("User signed out");
    username = "GUEST"
    userId = null
    updateUserUI(username);
    showPage('repPage');
  }).catch((error) => console.error("Error signing out:", error));
}
async function getTotalRepCountServer(type) {
  try {
    const count = 0
    let body = JSON.stringify({ userid: userId, type, count, username })
    const res = await fetch(SERVER_URL + "/add-rep", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body
    });
    const json = await res.json();
    console.log("Reps updated:", json);
    return json
  } catch (err) {
    console.error("Failed to add reps:", err);
  }
}
async function increaseRepCount(count, type) {
  try {
    let body = JSON.stringify({ userid: userId, type, count, username })
    console.log("body is",body)
    const res = await fetch(SERVER_URL + "/add-rep", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body
    });
    const json = await res.json();
    console.log("Reps updated:", json);
  } catch (err) {
    console.error("Failed to add reps:", err);
    //showFallbackMessage("Failed to update reps. Try again later.");
  }
}
function handleRepButtonClick(count) {
  if (!userId) {
    showFallbackMessage("Please sign in first.");
    return;
  }

  if (!navigator.onLine) {
    showFallbackMessage("You are offline.");
    return;
  }

  const type = HTML.repTypeSelect.value;

  // session (UI only)
  sessionReps[type] += count;
  if (sessionReps[type] < 0) sessionReps[type] = 0; // guard
  localStorage.setItem(`sessionReps.${type}`, sessionReps[type]);
  HTML.repCount.innerText = sessionReps[type];

  // all-time (server)
  if (count !== 0) {
    increaseRepCount(count, type);
  }
  updateYearlyGoal(sessionReps[type]);
}

async function updateUIAllTimeReps() {
    if (!userId) {
    showFallbackMessage("Please sign in first.");
    return;
  }

  if (!navigator.onLine) {
    showFallbackMessage("You are offline. Cannot update reps.");
    return;
  }
  console.log("Working")
  const push = await getTotalRepCountServer("pushup")
  const pull = await getTotalRepCountServer("pullup")
  console.log(push.total,pull.total,push,pull)
  if (HTML.profilePage.alltimePull) {
    HTML.profilePage.alltimePull.innerText = pull.total
  }
  if (HTML.profilePage.alltimePush) {
    HTML.profilePage.alltimePush.innerText = push.total
  }

}

function showPage(pageKey) {
  Object.values(HTML.pages).forEach(page => page.style.display = "none");
  HTML.pages[pageKey].style.display = ""; // restores the CSS default

  Object.values(HTML.buttons).forEach(btn => btn.classList.remove("active"));

  const buttonMap = {
    repPage: "repPage",
    profilePage: "profile",
    communityPage: "community"
  };

  HTML.buttons[buttonMap[pageKey]]?.classList.add("active");
}
async function fetchTotalsServer() {
  const res = await fetch(`${SERVER_URL}/total`);
  if (!res.ok) throw new Error("Request failed");

  const data = await res.json();

  const community = document.getElementById("community");
  community.innerHTML = "";

  Object.entries(data)
    .map(([userid, user]) => ({
      userid,
      name: user.name,
      pushup: user.pushup ?? 0,
      pullup: user.pullup ?? 0,
      total: (user.pushup ?? 0) + (user.pullup ?? 0),
    }))
    .sort((a, b) => b.total - a.total)
    .forEach(user => {
      const div = document.createElement("div");
      console.log(user)
      div.textContent = `${user.name}: ${user.total} total reps (${user.pushup} pushups, ${user.pullup} pullups)` + (user.yearlyGoalAchieved ? " 🎉" : " not yet");
      community.appendChild(div);
    });
}


HTML.repTypeSelect.addEventListener("change", () => {
  const type = HTML.repTypeSelect.value;
  HTML.repCount.innerText = sessionReps[type];
});

HTML.buttons.repPage.addEventListener("click", () => {
  showPage("repPage");
  const type = HTML.repTypeSelect.value;
  HTML.repCount.innerText = sessionReps[type];
});

HTML.buttons.profile.addEventListener("click", function() {
  showPage("profilePage")
  if (userId) {
    updateUIAllTimeReps();
  }
});
HTML.buttons.community.addEventListener("click", function() {
  showPage("communityPage")
  fetchTotalsServer();
  console.log("We ran")
  
});
function showFallbackMessage(message) {
  if (HTML.loginMessage) {
    HTML.loginMessage.textContent = message;
    HTML.loginMessage.style.color = "red";
  } else {
    alert(message);
  }
}
updateUserUI(username);
