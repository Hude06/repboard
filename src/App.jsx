import React, { useEffect, useMemo, useRef, useState } from "react";
import PushupHeatmap from "./components/PushupHeatmap.jsx";
import { createApiClient } from "./lib/api.js";

const REP_TYPES = {
  pushup: "Push-Ups",
  pullup: "Pull-Ups",
};

const PAGE = {
  REP: "rep",
  LEADERBOARD: "leaderboard",
  PROFILE: "profile",
};

const AUTH_MODE = {
  SIGN_IN: "sign-in",
  SIGN_UP: "sign-up",
};

const SESSION_STORAGE_KEY = "repboard.session.counts";
const REP_TYPE_STORAGE_KEY = "repboard.preferred.rep.type";

function getStoredSessionCounts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || "{}");
    return {
      pushup: Number(parsed.pushup || 0),
      pullup: Number(parsed.pullup || 0),
    };
  } catch {
    return { pushup: 0, pullup: 0 };
  }
}

function getStoredPreferredRepType() {
  const value = localStorage.getItem(REP_TYPE_STORAGE_KEY);
  return value === "pullup" ? "pullup" : "pushup";
}

function rankLabel(index) {
  if (index === 0) return "1";
  if (index === 1) return "2";
  if (index === 2) return "3";
  return String(index + 1);
}

export default function App({ apiClient }) {
  const api = useMemo(() => apiClient || createApiClient(), [apiClient]);

  const [page, setPage] = useState(PAGE.REP);
  const [sessionCounts, setSessionCounts] = useState(getStoredSessionCounts);
  const [fallbackPreferredRepType, setFallbackPreferredRepType] = useState(getStoredPreferredRepType);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [search, setSearch] = useState("");
  const [publicProfile, setPublicProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [authMode, setAuthMode] = useState(AUTH_MODE.SIGN_IN);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState("");
  const messageTimeoutRef = useRef(null);

  const preferredRepType = profile?.preferredRepType || fallbackPreferredRepType;
  const currentRepCount = sessionCounts[preferredRepType];

  useEffect(() => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionCounts));
  }, [sessionCounts]);

  useEffect(() => {
    localStorage.setItem(REP_TYPE_STORAGE_KEY, preferredRepType);
  }, [preferredRepType]);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const currentUser = await api.getCurrentUser();
        if (!isMounted) return;

        setUser(currentUser);
        if (currentUser) {
          const currentProfile = await api.ensureProfile(currentUser);
          if (!isMounted) return;
          setProfile(currentProfile);
        }
      } catch (error) {
        showMessage(error.message || "Failed to initialize app.");
      }
    }

    bootstrap();
    const unsubscribe = api.onAuthStateChange(async (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        return;
      }

      const nextProfile = await api.ensureProfile(nextUser);
      setProfile(nextProfile);
    });

    return () => {
      isMounted = false;
      unsubscribe();
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
    };
  }, [api]);

  useEffect(() => {
    if (page !== PAGE.LEADERBOARD) return;

    let isMounted = true;

    async function loadLeaderboard() {
      try {
        setLoading(true);
        const entries = await api.getLeaderboard(search);
        if (!isMounted) return;
        setLeaderboard(entries);
      } catch (error) {
        showMessage(error.message || "Failed to load leaderboard.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadLeaderboard();
    return () => {
      isMounted = false;
    };
  }, [api, page, search]);

  function showMessage(text) {
    setMessage(text);
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }
    messageTimeoutRef.current = setTimeout(() => {
      setMessage("");
    }, 2800);
  }

  function getAuthErrorMessage(error) {
    const base = String(error?.message || "Authentication failed.");
    const normalized = base.toLowerCase();

    if (normalized.includes("email not confirmed")) {
      return "Please verify your email first, then sign in.";
    }

    if (normalized.includes("invalid login credentials")) {
      return "Invalid email or password.";
    }

    if (normalized.includes("user already registered")) {
      return "This email is already registered. Please sign in instead.";
    }

    if (normalized.includes("password should be at least")) {
      return "Password is too short. Use at least 6 characters.";
    }

    return base;
  }

  async function handleGoogleSignIn() {
    try {
      setVerificationNotice("");
      await api.signInWithGoogle();
      showMessage("Opening Google sign-in...");
    } catch (error) {
      showMessage(getAuthErrorMessage(error));
    }
  }

  async function handleEmailAuth(event) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      showMessage("Email is required.");
      return;
    }

    if (!normalizedEmail.includes("@") || !normalizedEmail.includes(".")) {
      showMessage("Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      showMessage("Password must be at least 6 characters.");
      return;
    }

    if (authMode === AUTH_MODE.SIGN_UP && password !== confirmPassword) {
      showMessage("Passwords do not match.");
      return;
    }

    setAuthLoading(true);

    try {
      if (authMode === AUTH_MODE.SIGN_UP) {
        const result = await api.signUpWithEmail(normalizedEmail, password);
        if (result.needsEmailVerification) {
          setVerificationNotice("Check your email to verify your account.");
          showMessage("Verification email sent. Please verify your email before signing in.");
          setAuthMode(AUTH_MODE.SIGN_IN);
          setPassword("");
          setConfirmPassword("");
          return;
        }

        setVerificationNotice("");
        showMessage("Account created successfully.");
      } else {
        await api.signInWithEmail(normalizedEmail, password);
        setVerificationNotice("");
        showMessage("Signed in successfully.");
      }
    } catch (error) {
      showMessage(getAuthErrorMessage(error));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handlePasswordReset() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      showMessage("Enter your email first, then request reset.");
      return;
    }

    try {
      await api.requestPasswordReset(normalizedEmail);
      showMessage("Password reset email sent.");
    } catch (error) {
      showMessage(getAuthErrorMessage(error));
    }
  }

  async function handleSignOut() {
    try {
      await api.signOut();
      setPage(PAGE.REP);
      showMessage("Signed out.");
    } catch (error) {
      showMessage(error.message || "Sign out failed.");
    }
  }

  async function handleRepDelta(delta) {
    setSessionCounts((prev) => {
      const current = prev[preferredRepType];
      const next = Math.max(0, current + delta);
      return { ...prev, [preferredRepType]: next };
    });

    if (!user) {
      showMessage("Rep updated locally. Sign in to sync leaderboard/profile.");
      return;
    }

    try {
      const nextProfile = await api.addRepDelta(user.id, preferredRepType, delta);
      setProfile(nextProfile);
    } catch (error) {
      showMessage(error.message || "Failed to sync rep change.");
    }
  }

  function resetCurrentRepSession() {
    const delta = -currentRepCount;
    if (delta === 0) return;
    handleRepDelta(delta);
  }

  async function handlePreferredRepTypeChange(event) {
    const nextRepType = event.target.value === "pullup" ? "pullup" : "pushup";
    setFallbackPreferredRepType(nextRepType);

    if (!user) {
      showMessage("Preference saved locally.");
      return;
    }

    try {
      const nextProfile = await api.updatePreferredRepType(user.id, nextRepType);
      if (nextProfile) {
        setProfile(nextProfile);
      }
    } catch (error) {
      showMessage(error.message || "Failed to update setting.");
    }
  }

  async function openPublicProfile(userId) {
    try {
      const nextProfile = await api.getPublicProfile(userId);
      setPublicProfile(nextProfile);
    } catch (error) {
      showMessage(error.message || "Unable to open profile.");
    }
  }

  return (
    <div className="app">
      <div className="background-glow" aria-hidden="true" />

      <header className="app-header">
        <p className="kicker">REPBOARD</p>
        <h1>REPBOARD</h1>
        <p className="subhead">Track reps. Stay consistent.</p>
      </header>

      <div className="status-row">
        <p className="message" role="status" aria-live="polite">{message}</p>
        {!api.hasSupabaseEnv && (
          <span className="chip">{import.meta.env.DEV ? "Demo mode" : "Supabase env missing"}</span>
        )}
      </div>

      <main className="page-wrap">
        {page === PAGE.REP && (
          <section className="card rep-card" aria-label="Rep page">
            <div className="card-head">
              <h2>Rep Counter</h2>
              <p>
                Active rep type: <strong>{REP_TYPES[preferredRepType]}</strong>
              </p>
            </div>

            <div className="rep-row">
              <button className="side-button" type="button" onClick={() => handleRepDelta(-5)} aria-label="Remove five reps">
                -5
              </button>
              <button className="main-button" type="button" onClick={() => handleRepDelta(1)} aria-label="Add one rep">
                <strong data-testid="current-rep-count">{currentRepCount}</strong>
              </button>
              <button className="side-button" type="button" onClick={() => handleRepDelta(5)} aria-label="Add five reps">
                +5
              </button>
            </div>

            <div className="card-actions">
              <button className="ghost" type="button" onClick={resetCurrentRepSession}>Reset session reps</button>
            </div>
          </section>
        )}

        {page === PAGE.LEADERBOARD && (
          <section className="card leaderboard-card" aria-label="Leaderboard page">
            <div className="card-head">
              <h2>Leaderboard</h2>
              <p>Push-up totals ranked across all athletes.</p>
            </div>

            <input
              className="search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search athletes..."
              aria-label="Search athletes"
            />

            {loading && <p className="empty">Loading leaderboard...</p>}
            {!loading && leaderboard.length === 0 && <p className="empty">No athletes yet.</p>}

            {!loading && leaderboard.length > 0 && (
              <div className="leaderboard-list">
                {leaderboard.map((entry, index) => (
                  <button
                    key={entry.id}
                    type="button"
                    className="leaderboard-item"
                    onClick={() => openPublicProfile(entry.id)}
                    aria-label={`Open ${entry.username} profile`}
                  >
                    <span className="rank">{rankLabel(index)}</span>
                    <span className="athlete-name">{entry.username}</span>
                    <span className="athlete-total">{entry.pushupTotal}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {page === PAGE.PROFILE && user && (
          <section className="card profile-card" aria-label="Profile page">
            <div className="profile-top">
              <div className="avatar" aria-hidden="true">
                {(profile?.username || user?.email || "G").charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="kicker">Athlete profile</p>
                <h2>{profile?.username || user?.email || "Guest"}</h2>
              </div>
            </div>

            <div className="stats-grid">
              <article>
                <p className="stat-value">{profile?.pushupTotal || 0}</p>
                <p className="stat-label">Push-Ups</p>
              </article>
              <article>
                <p className="stat-value">{profile?.pullupTotal || 0}</p>
                <p className="stat-label">Pull-Ups</p>
              </article>
            </div>

            <div className="setting-block">
              <label htmlFor="preferredRepType">Default rep type</label>
              <select id="preferredRepType" value={preferredRepType} onChange={handlePreferredRepTypeChange}>
                <option value="pushup">Push-Ups</option>
                <option value="pullup">Pull-Ups</option>
              </select>
            </div>

            <div className="heatmap-block">
              <h3>Push-Up Calendar</h3>
              <PushupHeatmap dailyPushups={profile?.dailyPushups || {}} label="Your push-up calendar" />
            </div>

            <div className="card-actions">
              <button className="ghost" type="button" onClick={handleSignOut}>Log out</button>
            </div>
          </section>
        )}

        {page === PAGE.PROFILE && !user && (
          <section className="card auth-screen" aria-label="Authentication page">
            <div className="card-head">
              <h2>Account</h2>
              <p>Sign in to sync stats and appear on the leaderboard.</p>
            </div>

            {verificationNotice && <div className="verify-tag">{verificationNotice}</div>}

            <div className="auth-mode-toggle" role="group" aria-label="Authentication mode">
              <button
                type="button"
                className={authMode === AUTH_MODE.SIGN_IN ? "active" : ""}
                onClick={() => setAuthMode(AUTH_MODE.SIGN_IN)}
                disabled={authLoading}
              >
                Email sign in
              </button>
              <button
                type="button"
                className={authMode === AUTH_MODE.SIGN_UP ? "active" : ""}
                onClick={() => setAuthMode(AUTH_MODE.SIGN_UP)}
                disabled={authLoading}
              >
                Email sign up
              </button>
            </div>

            <form className="auth-form" onSubmit={handleEmailAuth}>
              <label htmlFor="authEmail">Email</label>
              <input
                id="authEmail"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />

              <label htmlFor="authPassword">Password</label>
              <input
                id="authPassword"
                type="password"
                autoComplete={authMode === AUTH_MODE.SIGN_UP ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
              />

              {authMode === AUTH_MODE.SIGN_UP && (
                <>
                  <label htmlFor="authConfirmPassword">Confirm password</label>
                  <input
                    id="authConfirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Re-enter password"
                  />
                </>
              )}

              <div className="card-actions">
                <button className="primary" type="submit" disabled={authLoading}>
                  {authLoading
                    ? "Please wait..."
                    : authMode === AUTH_MODE.SIGN_UP
                      ? "Create account"
                      : "Sign in"}
                </button>
                {authMode === AUTH_MODE.SIGN_IN && (
                  <button className="ghost" type="button" onClick={handlePasswordReset} disabled={authLoading}>
                    Forgot password
                  </button>
                )}
              </div>
            </form>

            <div className="oauth-divider" aria-hidden="true">or</div>
            <button className="ghost" type="button" onClick={handleGoogleSignIn} disabled={authLoading}>
              Continue with Google
            </button>
          </section>
        )}
      </main>

      <nav className="nav" aria-label="Main navigation">
        <button type="button" className={page === PAGE.LEADERBOARD ? "active" : ""} onClick={() => setPage(PAGE.LEADERBOARD)}>
          Leaderboard
        </button>
        <button type="button" className={page === PAGE.REP ? "active" : ""} onClick={() => setPage(PAGE.REP)}>
          Rep
        </button>
        <button type="button" className={page === PAGE.PROFILE ? "active" : ""} onClick={() => setPage(PAGE.PROFILE)}>
          {user ? "Profile" : "Account"}
        </button>
      </nav>

      {publicProfile && (
        <div className="modal" onClick={() => setPublicProfile(null)}>
          <div className="modal-content" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button className="close" type="button" onClick={() => setPublicProfile(null)} aria-label="Close profile">
              x
            </button>
            <p className="kicker">Public profile</p>
            <h3>{publicProfile.username}</h3>
            <p className="public-total">{publicProfile.pushupTotal} push-ups</p>
            <PushupHeatmap dailyPushups={publicProfile.dailyPushups || {}} label="Public push-up calendar" />
          </div>
        </div>
      )}
    </div>
  );
}
