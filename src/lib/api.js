import { hasSupabaseEnv, supabase } from "./supabaseClient.js";

const MOCK_STORAGE_KEY = "repboard.mock.profiles";
const allowMockMode = import.meta.env.DEV && !hasSupabaseEnv;

function assertSupabaseConfigured() {
  if (!hasSupabaseEnv || !supabase) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
}

function getEmailRedirectURL() {
  return window.location.origin;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getInitialMockProfiles() {
  return {
    "demo-1": {
      id: "demo-1",
      username: "AlexFit",
      preferredRepType: "pushup",
      pushupTotal: 248,
      pullupTotal: 46,
      dailyPushups: {},
    },
    "demo-2": {
      id: "demo-2",
      username: "JordanStrong",
      preferredRepType: "pushup",
      pushupTotal: 193,
      pullupTotal: 39,
      dailyPushups: {},
    },
  };
}

function loadMockProfiles() {
  try {
    const value = localStorage.getItem(MOCK_STORAGE_KEY);
    if (!value) {
      const seeded = getInitialMockProfiles();
      localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(value);
  } catch {
    return getInitialMockProfiles();
  }
}

function saveMockProfiles(profiles) {
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(profiles));
}

function normalizeRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    username: row.username || "Athlete",
    preferredRepType: row.preferred_rep_type || row.preferredRepType || "pushup",
    pushupTotal: Number(row.pushup_total ?? row.pushupTotal ?? 0),
    pullupTotal: Number(row.pullup_total ?? row.pullupTotal ?? 0),
    dailyPushups: row.daily_pushups || row.dailyPushups || {},
  };
}

async function insertProfileWithUniqueUsername(userId, baseUsername) {
  let attempt = 0;
  while (attempt < 5) {
    const suffix = attempt === 0 ? "" : `-${Math.floor(Math.random() * 9000) + 1000}`;
    const candidate = `${baseUsername}${suffix}`.slice(0, 40);

    const payload = {
      id: userId,
      username: candidate,
      preferred_rep_type: "pushup",
      pushup_total: 0,
      pullup_total: 0,
      daily_pushups: {},
    };

    const { data, error } = await supabase.from("profiles").insert(payload).select().single();
    if (!error) {
      return normalizeRow(data);
    }

    const isUniqueUsernameError = error.code === "23505";
    if (!isUniqueUsernameError) {
      throw error;
    }

    attempt += 1;
  }

  throw new Error("Unable to allocate a unique username. Please try again.");
}

async function getCurrentUser() {
  if (allowMockMode) {
    return null;
  }

  assertSupabaseConfigured();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.user ?? null;
}

async function signInWithGoogle() {
  assertSupabaseConfigured();

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: getEmailRedirectURL(),
    },
  });

  if (error) throw error;
}

async function signInWithEmail(email, password) {
  assertSupabaseConfigured();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
}

async function signUpWithEmail(email, password) {
  assertSupabaseConfigured();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getEmailRedirectURL(),
    },
  });

  if (error) throw error;

  return {
    user: data.user,
    needsEmailVerification: !data.session,
  };
}

async function requestPasswordReset(email) {
  assertSupabaseConfigured();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getEmailRedirectURL(),
  });

  if (error) throw error;
}

async function signOut() {
  if (allowMockMode) {
    return;
  }

  assertSupabaseConfigured();

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

function getFallbackUsername(user) {
  return (
    user?.user_metadata?.name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Athlete"
  );
}

async function ensureProfile(user) {
  if (!user) return null;

  if (allowMockMode) {
    const profiles = loadMockProfiles();
    if (!profiles[user.id]) {
      profiles[user.id] = {
        id: user.id,
        username: getFallbackUsername(user),
        preferredRepType: "pushup",
        pushupTotal: 0,
        pullupTotal: 0,
        dailyPushups: {},
      };
      saveMockProfiles(profiles);
    }
    return profiles[user.id];
  }

  const existing = await getProfile(user.id);
  if (existing) return existing;

  const baseUsername = getFallbackUsername(user)
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 24) || "athlete";

  return insertProfileWithUniqueUsername(user.id, baseUsername);
}

async function getProfile(userId) {
  if (!userId) return null;

  if (allowMockMode) {
    const profiles = loadMockProfiles();
    return profiles[userId] || null;
  }

  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return normalizeRow(data);
}

async function getPublicProfile(userId) {
  return getProfile(userId);
}

async function updatePreferredRepType(userId, preferredRepType) {
  if (!userId) return null;

  if (allowMockMode) {
    const profiles = loadMockProfiles();
    if (!profiles[userId]) return null;
    profiles[userId].preferredRepType = preferredRepType;
    saveMockProfiles(profiles);
    return profiles[userId];
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ preferred_rep_type: preferredRepType })
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return normalizeRow(data);
}

async function addRepDelta(userId, repType, delta) {
  if (!userId) throw new Error("No user ID");

  const profile = await getProfile(userId);
  if (!profile) throw new Error("Profile missing");

  const next = {
    ...profile,
    pushupTotal: profile.pushupTotal,
    pullupTotal: profile.pullupTotal,
    dailyPushups: { ...profile.dailyPushups },
  };

  if (repType === "pushup") {
    next.pushupTotal = Math.max(0, next.pushupTotal + delta);
    const today = todayKey();
    next.dailyPushups[today] = Math.max(0, Number(next.dailyPushups[today] || 0) + delta);
  }

  if (repType === "pullup") {
    next.pullupTotal = Math.max(0, next.pullupTotal + delta);
  }

  if (allowMockMode) {
    const profiles = loadMockProfiles();
    profiles[userId] = next;
    saveMockProfiles(profiles);
    return next;
  }

  const payload = {
    pushup_total: next.pushupTotal,
    pullup_total: next.pullupTotal,
    daily_pushups: next.dailyPushups,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("profiles").update(payload).eq("id", userId).select().single();
  if (error) throw error;
  return normalizeRow(data);
}

async function getLeaderboard(searchTerm = "") {
  if (allowMockMode) {
    const profiles = loadMockProfiles();
    const normalized = Object.values(profiles)
      .filter((profile) =>
        profile.username.toLowerCase().includes(searchTerm.trim().toLowerCase()),
      )
      .sort((a, b) => b.pushupTotal - a.pushupTotal);

    return normalized;
  }

  let query = supabase
    .from("profiles")
    .select("id,username,pushup_total,pullup_total,daily_pushups,preferred_rep_type")
    .order("pushup_total", { ascending: false })
    .limit(100);

  if (searchTerm.trim()) {
    query = query.ilike("username", `%${searchTerm.trim()}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(normalizeRow);
}

function onAuthStateChange(callback) {
  if (allowMockMode) {
    return () => {};
  }

  assertSupabaseConfigured();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });

  return () => subscription.unsubscribe();
}

export function createApiClient() {
  return {
    hasSupabaseEnv,
    getCurrentUser,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    requestPasswordReset,
    signOut,
    ensureProfile,
    getProfile,
    getPublicProfile,
    updatePreferredRepType,
    addRepDelta,
    getLeaderboard,
    onAuthStateChange,
  };
}
