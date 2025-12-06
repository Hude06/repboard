/* app.js
   Frontend for rep tracking.
   - Uses Google Identity to get an id_token, POSTs to /verify-token
   - Server sets an HttpOnly session cookie; further calls use credentials: 'include'
   - Maintains local pending queue in localStorage and a single processing worker
*/

(() => {
  // --- Constants ---
  const API_BASE = (location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://apps.judemakes.dev');

  // --- App state ---
  let currentValue = { push: 0, pull: 0 };
  let alltimerep = { push: 0, pull: 0 };
  let repType = 'push'; // ui value: 'push' or 'pull'
  let sendingPending = false; // queue processor lock

  // --- Helpers ---
  function uiToServerKey(ui) {
    const normalized = (ui || '').toLowerCase();
    if (normalized === 'push' || normalized === 'pushup') return 'PushUp';
    if (normalized === 'pull' || normalized === 'pullup') return 'PullUp';
    throw new Error('Unknown rep type: ' + ui);
  }
  function uiToServerTypeString(ui) {
    // returns 'pushup' or 'pullup' (string used by older client/backends)
    const normalized = (ui || '').toLowerCase();
    if (normalized === 'push' || normalized === 'pushup') return 'pushup';
    if (normalized === 'pull' || normalized === 'pullup') return 'pullup';
    throw new Error('Unknown rep type: ' + ui);
  }

  // LocalStorage helpers for pending queue (persisted)
  function getLocalPending() {
    return JSON.parse(localStorage.getItem('pendingReps') || '[]');
  }
  function setLocalPending(arr) {
    localStorage.setItem('pendingReps', JSON.stringify(arr));
  }
  function logLocalRep(userId, type, reps, sessionId = null, id = null) {
    const pending = getLocalPending();
    pending.push({ userId, type, reps, sessionId, id, timestamp: Date.now() });
    setLocalPending(pending);
  }

  // HTTP wrapper - all calls include credentials to send HttpOnly cookie
  async function apiFetch(path, opts = {}) {
    const res = await fetch(API_BASE + path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...opts
    });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch (e) {
      throw new Error(`Invalid JSON from ${path}: ${text}`);
    }
    if (!res.ok) {
      const err = new Error(data.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  }

  // --- Pending queue processor (single worker) ---
  async function processPending() {
    if (sendingPending) return;
    sendingPending = true;
    try {
      let pending = getLocalPending();
      if (!pending.length) return;
      const failures = [];
      for (const rep of pending) {
        try {
          // server expects session cookie for auth, ignore rep.userId in body (server uses session)
          const payload = { type: rep.type, reps: rep.reps, sessionId: rep.sessionId, id: rep.id };
          const data = await apiFetch('/add-rep', { method: 'POST', body: JSON.stringify(payload) });
          // if success, server returns new total in data.total
          if (!data.success) {
            failures.push(rep);
          } else {
            // update local totals with authoritative server total if present
            if (typeof data.total === 'number') {
              // map server key back to UI key
              // server returns totals for the userKey only; we'll keep local currentValue in sync conservatively
              // best-effort: if rep.type looks like 'push' or 'pushup' update local alltimerep.push
              const t = (rep.type || '').toLowerCase();
              if (t.includes('push')) alltimerep.push = data.total;
              if (t.includes('pull')) alltimerep.pull = data.total;
              // reflect UI
              updateStatsUI();
            }
          }
        } catch (e) {
          // network/server problems -> keep for retry
          failures.push(rep);
        }
      }
      setLocalPending(failures);
    } finally {
      sendingPending = false;
    }
  }

  // Attempt to process pending on interval & online events
  window.addEventListener('online', () => { processPending().catch(console.error); });
  setInterval(() => processPending().catch(console.error), 10_000);

  // --- UI helpers ---
  function $(id) { return document.getElementById(id); }
  function updateStatsUI() {
    $('AllTimePushUpStat').innerText = alltimerep.push || 0;
    $('AllTimePullUpStat').innerText = alltimerep.pull || 0;
    $('repCount').textContent = currentValue[repType] || 0;
  }

  // --- Init & DOM wiring ---
  function initDOM() {
    const resetBtn = $('reset');
    const repCountEl = $('repCount');
    const repTypeSelect = $('repType');
    const googleSignInButton = $('googleSignInButton');
    const logoutBtn = $('logoutBtn');
    const repButton = $('repButton');
    const incBtn = $('incerment');
    const decBtn = $('decrement');

    // ensure elements exist
    if (!repCountEl || !repTypeSelect || !googleSignInButton) {
      console.error('Missing DOM elements — ensure script is loaded after DOM or wrap in DOMContentLoaded');
    }

    // rep type select
    repTypeSelect.value = repType;
    repTypeSelect.addEventListener('change', (e) => {
      repType = (e.target.value || 'push').toLowerCase();
      repCountEl.textContent = currentValue[repType] || 0;
      console.log('Selected rep type:', repType);
    });

    // reset (confirm)
    resetBtn?.addEventListener('click', () => {
      if (!confirm('Reset current and all-time reps to zero? This cannot be undone.')) return;
      currentValue = { push: 0, pull: 0 };
      alltimerep = { push: 0, pull: 0 };
      saveAllTimeRepsLocal();
      updateStatsUI();
      // attempt to tell server (requires session cookie)
      apiFetch('/reset-reps', { method: 'POST', body: JSON.stringify({ }) })
        .then(() => processPending())
        .catch(err => console.warn('Reset on server failed (maybe offline or not authenticated):', err));
    });

    // mobile UI increment
    repButton?.addEventListener('click', () => increaseRepCount(1, repType));
    incBtn?.addEventListener('click', () => increaseRepCount(5, repType));
    decBtn?.addEventListener('click', () => increaseRepCount(-5, repType));

    // keyboard handling: space to increment — ignore when typing, ignore repeats
    const keyMap = new Map();
    document.addEventListener('keydown', (ev) => {
      if (ev.code !== 'Space') return;
      if (ev.repeat) return;
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
      ev.preventDefault();
      increaseRepCount(1, repType);
    });

    document.addEventListener('keyup', () => {}); // keep in case you expand logic

    // Google Sign-In button callback (we use the Google Identity services)
    googleSignInButton?.addEventListener('click', () => {
      // initialize if needed (id token will be provided to handleCredentialResponse)
      google.accounts.id.initialize({
        client_id: '630610710531-cs7afi140j0knbfn43mcjduj7etv5tbn.apps.googleusercontent.com',
        callback: handleCredentialResponse
      });
      google.accounts.id.prompt(); // One Tap or prompt
    });

    logoutBtn?.addEventListener('click', () => {
      // call server to clear session cookie
      apiFetch('/logout', { method: 'POST', body: JSON.stringify({}) })
        .catch(console.warn)
        .finally(() => {
          // UI fallback
          $('username').innerText = 'Guest';
          $('initial').innerText = 'G';
          $('googleSignInButton').style.display = 'block';
          // don't clear pending queue (we keep pending reps until processed)
        });
    });

    // restore local all-time if any
    loadAllTimeRepsLocal();
    // try to load server-side totals if authenticated
    loadAllTimeRepsFromServer();
    updateStatsUI();

    // try sending pending immediately
    processPending().catch(console.error);
  }

  // --- Local persistence for offline UI (not auth tokens) ---
  function saveAllTimeRepsLocal() {
    localStorage.setItem('alltimerep', JSON.stringify(alltimerep));
  }
  function loadAllTimeRepsLocal() {
    const s = localStorage.getItem('alltimerep');
    if (s) {
      try { alltimerep = JSON.parse(s); } catch (e) { alltimerep = { push: 0, pull: 0 }; }
    }
  }

  // --- Auth flow: handle Google credential response (id_token) ---
  async function handleCredentialResponse(googleResponse) {
    const id_token = googleResponse.credential;
    try {
      // Send id_token to server; server verifies with Google and sets HttpOnly session cookie.
      const res = await apiFetch('/verify-token', { method: 'POST', body: JSON.stringify({ id_token }) });
      // server returns user info (without sending tokens). Update UI.
      if (res.success && res.user) {
        $('username').innerText = res.user.name || 'User';
        $('initial').innerText = (res.user.name || 'G').charAt(0).toUpperCase();
        $('googleSignInButton').style.display = 'none';
        // update all-time from server
        alltimerep.push = res.allTime?.push ?? alltimerep.push;
        alltimerep.pull = res.allTime?.pull ?? alltimerep.pull;
        saveAllTimeRepsLocal();
        updateStatsUI();
        // try to flush pending queue now that session cookie exists
        processPending().catch(console.error);
      }
    } catch (err) {
      console.error('verify-token failed', err);
      alert('Sign-in failed. You are still in guest/offline mode.');
    }
  }

  // --- Load all-time reps from server (if session cookie present) ---
  async function loadAllTimeRepsFromServer() {
    try {
      const data = await apiFetch('/get-all-reps', { method: 'POST', body: JSON.stringify({}) });
      if (data.success && data.allTime) {
        alltimerep = { push: data.allTime.push || 0, pull: data.allTime.pull || 0 };
        saveAllTimeRepsLocal();
        updateStatsUI();
      }
    } catch (err) {
      // not authenticated or offline; ignore
      // console.warn('Could not load all-time reps from server:', err);
    }
  }

  // --- increaseRepCount: local UI change + enqueue server logging ---
  async function increaseRepCount(reps, type) {
    try {
      if (!['push','pull','pushup','pullup'].includes(type)) {
        console.warn('Unknown rep type:', type);
        return;
      }
      // normalize UI key
      const uiKey = (type.toLowerCase().includes('push') ? 'push' : 'pull');
      // safe increment (allow negative if you intend decrement)
      currentValue[uiKey] = (currentValue[uiKey] || 0) + reps;
      // update all-time locally
      alltimerep[uiKey] = Math.max(0, (alltimerep[uiKey] || 0) + reps);

      updateStatsUI();
      saveAllTimeRepsLocal();

      // enqueue for server; server will use session cookie to auth and authoritative totals
      const payloadType = uiToServerTypeString(uiKey); // 'pushup' or 'pullup'
      logLocalRep(null, payloadType, reps, null, Date.now());
      // start worker
      await processPending();
    } catch (err) {
      console.error('increaseRepCount error', err);
    }
  }

  // --- Initialize on DOM ready ---
  window.addEventListener('DOMContentLoaded', initDOM);

  // expose increment function for debugging if needed
  window._increaseRepCount = increaseRepCount;
})();
