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
const HTML = {
  username: document.getElementById("username"),
  initialLetter: document.getElementById("initial"),
  loginMessage: document.getElementById("loginMessage"),
  repTypeSelect: document.getElementById('repType'),
  repCount: document.getElementById("repCount"),
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
let username = "guest";
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
      username = "guest";
      updateUserUI(username);
    }
  });
})();

HTML.buttons.googleSignIn.addEventListener('click', handleGoogleSignIn);
document.getElementById("logoutBtn").addEventListener("click", handleLogout);
HTML.buttons.rep.addEventListener("click", () => handleRepButtonClick(1));
HTML.buttons.incerment.addEventListener("click", () => handleRepButtonClick(5));
HTML.buttons.decrement.addEventListener("click", () => handleRepButtonClick(-5));
HTML.buttons.reset.addEventListener("click", async function() {
  const push = await getTotalRepCountServer("pushup")
  const pull = await getTotalRepCountServer("pullup")

  console.log(push,pull)
  increaseRepCount(-push.total,"pushup")
  increaseRepCount(-pull.total,"pullup")
  updateUIAllTimeReps()
})

async function init() {
  // safe: handle case when user isn't signed in yet
  if (!userId) {
    console.log("No user signed in yet — skipping user-specific totals.");
    return;
  }

  const push = await getTotalRepCountServer("pushup");
  const pull = await getTotalRepCountServer("pullup");
  console.log(push, pull);

  if (HTML.repCount) {
    HTML.repCount.innerText = HTML.repTypeSelect.value === "pushup"
      ? (push?.total ?? 0)
      : (pull?.total ?? 0);
  }
}


function updateUserUI(name) {
  HTML.username.innerText = name;
  HTML.initialLetter.textContent = name.charAt(0).toUpperCase();
  HTML.buttons.googleSignIn.style.display = name === "guest" ? "block" : "none";
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
    handleRepButtonClick(0);
    if (navigator.onLine) updateUIAllTimeReps();
  } catch (error) {
    console.error("Sign-in error:", error);
    showFallbackMessage("Sign-in failed. Try again.");
  }
}

function handleLogout() {
  signOut(auth).then(() => {
    console.log("User signed out");
    username = "guest"
    userId = null
    updateUserUI(username);
    showPage('repPage');
  }).catch((error) => console.error("Error signing out:", error));
}
async function getTotalRepCountServer(type) {
  try {
    const count = 0
    let body = JSON.stringify({ userid: userId, type, count })
    const res = await fetch('http://127.0.0.1:3000/add-rep', {
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
    let body = JSON.stringify({ userid: userId, type, count })
    console.log("body is",body)
    const res = await fetch('http://127.0.0.1:3000/add-rep', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body
    });
    const json = await res.json();
    console.log("Reps updated:", json);
    if (HTML.repCount) HTML.repCount.textContent = json.total || 0;
    updateUIAllTimeReps()
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
    showFallbackMessage("You are offline. Cannot update reps.");
    return;
  }

  const type = HTML.repTypeSelect.value;
  increaseRepCount(count, type)
    .then(() => console.log("the rep count was incremented"))
    .catch(() => console.log("an error happened"));
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
  HTML.pages[pageKey].style.display = "block";

  Object.values(HTML.buttons).forEach(btn => btn.classList.remove("active"));

  const buttonMap = {
    repPage: "repPage",
    profilePage: "profile",
    communityPage: "community"
  };

  HTML.buttons[buttonMap[pageKey]]?.classList.add("active");
}

HTML.repTypeSelect.addEventListener("change", function() {
  handleRepButtonClick(0)
})
HTML.buttons.repPage.addEventListener("click", function() {
  showPage("repPage")
  handleRepButtonClick(0)
});
HTML.buttons.profile.addEventListener("click", function() {
  showPage("profilePage")
  updateUIAllTimeReps();
});
HTML.buttons.community.addEventListener("click", () => showPage("communityPage"));
function showFallbackMessage(message) {
  if (HTML.loginMessage) {
    HTML.loginMessage.textContent = message;
    HTML.loginMessage.style.color = "red";
  } else {
    alert(message);
  }
}
updateUserUI(username);
