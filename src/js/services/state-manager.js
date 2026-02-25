import { CONFIG } from "../utils/constants.js";
import { StorageUtils, Validators } from "../utils/helpers.js";

/**
 * Centralized state manager for RepBoard application
 * Handles all application state and provides reactive updates
 */
export class StateManager {
  constructor() {
    this.state = {
      // User authentication state
      auth: {
        userId: null,
        username: "GUEST",
        isAuthenticated: false,
        isLoading: false,
        error: null,
      },
      // Flag to prevent infinite recursion in state notifications
      _updatingState: false,

      // Rep counting state
      reps: {
        session: { pushup: 0, pullup: 0 },
        allTime: { pushup: 0, pullup: 0 },
        currentExercise: CONFIG.EXERCISE_TYPES.PUSHUP,
        sessionTotal: 0,
      },

      // UI state
      ui: {
        currentPage: "repPage",
        loading: { addRep: false, fetchTotals: false, signIn: false },
        error: null,
      },

      // Community state
      community: {
        users: [],
        isLoading: false,
        error: null,
      },

      // Challenge state
      challenge: {
        dayOfYear: 0,
        target: 0,
        progress: 0,
        completed: false,
        completedCount: 0,
        completedBy: [],
        isLoading: false,
        error: null,
      },
    };

    // Event listeners
    this.listeners = new Map();

    // Initialize state from storage
    this.initializeFromStorage();
  }

  // ------------------- STATE INITIALIZATION -------------------

  initializeFromStorage() {
    const sessionPushups = StorageUtils.getItem(
      CONFIG.STORAGE_KEYS.SESSION_REPS_PUSHUP,
      0,
    );
    const sessionPullups = StorageUtils.getItem(
      CONFIG.STORAGE_KEYS.SESSION_REPS_PULLUP,
      0,
    );

    this.state.reps.session.pushup = sessionPushups;
    this.state.reps.session.pullup = sessionPullups;
    this.state.reps.sessionTotal = sessionPushups + sessionPullups;
  }

  // ------------------- LISTENERS -------------------

  subscribe(key, callback) {
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key).add(callback);
  }

  unsubscribe(key, callback) {
    if (this.listeners.has(key)) this.listeners.get(key).delete(callback);
  }

  // ------------------- NOTIFICATION -------------------

  notify(key, newValue, oldValue) {
    if (this.state._updatingState) return;
    this.state._updatingState = true;

    try {
      // Exact key listeners
      if (this.listeners.has(key)) {
        this.listeners.get(key).forEach((callback) => {
          try {
            callback(newValue, oldValue);
          } catch (err) {
            console.error(`Error in listener "${key}":`, err);
          }
        });
      }

      // Parent key listeners
      const keyParts = key.split(".");
      for (let i = keyParts.length - 1; i > 0; i--) {
        const parentKey = keyParts.slice(0, i).join(".");
        if (this.listeners.has(parentKey)) {
          this.listeners.get(parentKey).forEach((callback) => {
            try {
              callback(this.getNestedValue(parentKey), oldValue);
            } catch (err) {
              console.error(`Error in listener "${parentKey}":`, err);
            }
          });
        }
      }
    } finally {
      this.state._updatingState = false;
    }
  }

  getNestedValue(path) {
    return path.split(".").reduce((obj, key) => obj?.[key], this.state);
  }

  setNestedValue(path, value) {
    const keys = path.split(".");
    const lastKey = keys.pop();
    const target = keys.reduce(
      (obj, key) => (obj[key] = obj[key] || {}),
      this.state,
    );

    const oldValue = target[lastKey];
    target[lastKey] = value;

    this.notify(path, value, oldValue);
  }

  // ------------------- AUTH -------------------

  updateAuth(authData) {
    const oldAuth = { ...this.state.auth };
    this.state.auth = {
      ...this.state.auth,
      ...authData,
      isAuthenticated: !!authData.userId,
    };

    Object.keys(this.state.auth).forEach((key) => {
      if (this.state.auth[key] !== oldAuth[key]) {
        this.notify(`auth.${key}`, this.state.auth[key], oldAuth[key]);
      }
    });

    this.notify("auth", this.state.auth, oldAuth);
  }

  // ------------------- REPS -------------------

  updateReps(type, count, isSession = true) {
    if (!Validators.isValidExerciseType(type))
      throw new Error(`Invalid exercise type: ${type}`);

    const category = isSession ? "session" : "allTime";
    const oldValue = this.state.reps[category][type];
    const newValue = Math.max(0, oldValue + count);

    this.state.reps[category][type] = newValue;

    if (isSession)
      this.state.reps.sessionTotal =
        this.state.reps.session.pushup + this.state.reps.session.pullup;

    if (isSession) {
      const storageKey =
        type === CONFIG.EXERCISE_TYPES.PUSHUP
          ? CONFIG.STORAGE_KEYS.SESSION_REPS_PUSHUP
          : CONFIG.STORAGE_KEYS.SESSION_REPS_PULLUP;
      StorageUtils.setItem(storageKey, newValue);
    }

    this.notify(`reps.${category}.${type}`, newValue, oldValue);
    this.notify("reps", this.state.reps, this.state.reps);
  }

  setAllTimeReps(type, total) {
    if (!Validators.isValidExerciseType(type)) {
      throw new Error(`Invalid exercise type: ${type}`);
    }

    const oldValue = this.state.reps.allTime[type];
    const safeTotal = Math.max(0, Number(total) || 0);
    this.state.reps.allTime[type] = safeTotal;
    this.notify(`reps.allTime.${type}`, safeTotal, oldValue);
    this.notify("reps", this.state.reps, this.state.reps);
  }

  setCurrentExercise(type) {
    if (!Validators.isValidExerciseType(type))
      throw new Error(`Invalid exercise type: ${type}`);
    const oldValue = this.state.reps.currentExercise;
    this.state.reps.currentExercise = type;
    this.notify("reps.currentExercise", type, oldValue);
  }

  // ------------------- UI -------------------

  setLoading(operation, loading) {
    const oldValue = this.state.ui.loading[operation];
    this.state.ui.loading[operation] = loading;
    this.notify(`ui.loading.${operation}`, loading, oldValue);
  }

  setError(error) {
    const oldValue = this.state.ui.error;
    this.state.ui.error = error;
    this.notify("ui.error", error, oldValue);
  }

  setCurrentPage(page) {
    const oldValue = this.state.ui.currentPage;
    this.state.ui.currentPage = page;
    this.notify("ui.currentPage", page, oldValue);
  }

  // ------------------- COMMUNITY -------------------

  updateCommunity(users) {
    const oldValue = this.state.community.users;
    this.state.community.users = users;
    this.notify("community.users", users, oldValue);
  }

  // ------------------- CHALLENGE -------------------

  updateChallenge(challengeData) {
    const oldChallenge = { ...this.state.challenge };
    this.state.challenge = {
      ...this.state.challenge,
      ...challengeData,
    };

    Object.keys(this.state.challenge).forEach((key) => {
      if (this.state.challenge[key] !== oldChallenge[key]) {
        this.notify(`challenge.${key}`, this.state.challenge[key], oldChallenge[key]);
      }
    });

    this.notify("challenge", this.state.challenge, oldChallenge);
  }

  updateChallengeProgress(progress) {
    const oldProgress = this.state.challenge.progress;
    this.state.challenge.progress = progress;
    this.notify("challenge.progress", progress, oldProgress);
  }

  setChallengeLoading(loading) {
    const oldLoading = this.state.challenge.isLoading;
    this.state.challenge.isLoading = loading;
    this.notify("challenge.isLoading", loading, oldLoading);
  }

  // ------------------- SESSION -------------------

  resetSession() {
    const oldSession = { ...this.state.reps.session };
    this.state.reps.session = { pushup: 0, pullup: 0 };
    this.state.reps.sessionTotal = 0;

    StorageUtils.removeItem(CONFIG.STORAGE_KEYS.SESSION_REPS_PUSHUP);
    StorageUtils.removeItem(CONFIG.STORAGE_KEYS.SESSION_REPS_PULLUP);

    this.notify("reps.session", this.state.reps.session, oldSession);
    this.notify("reps", this.state.reps, this.state.reps);
  }

  // ------------------- DEBUG -------------------

  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }
}

// Create singleton instance
export const stateManager = new StateManager();
