// Application configuration and constants
export const CONFIG = {
  // API Configuration
  API_URL: import.meta.env.VITE_API_URL || "http://localhost:3000",
  
  // Firebase Configuration
  FIREBASE_CONFIG: {
    apiKey: "AIzaSyDlzLqiIiRjOGZb1KUFHAv7SZmgP41LhKc",
    authDomain: "repboard-77743.firebaseapp.com",
    projectId: "repboard-77743",
    storageBucket: "repboard-77743.firebasestorage.app",
    messagingSenderId: "230840782970",
    appId: "1:230840782970:web:b9ec5b19e82ea0a76aebc3",
    measurementId: "G-7EWJ77ZXRQ"
  },
  
  // App Configuration
  APP_NAME: "RepBoard",
  VERSION: "2.0.0",
  EXERCISE_TYPES: {
    PUSHUP: "pushup",
    PULLUP: "pullup"
  },
  
  // Storage Keys
  STORAGE_KEYS: {
    SESSION_REPS_PUSHUP: "sessionReps.pushup",
    SESSION_REPS_PULLUP: "sessionReps.pullup",
    OFFLINE_QUEUE: "offlineQueue",
    PREFERRED_REP_TYPE: "settings.preferredRepType"
  },
  
  // UI States
  UI_STATES: {
    IDLE: "idle",
    LOADING: "loading",
    SUCCESS: "success",
    ERROR: "error"
  },
  
  // Validation Rules
  VALIDATION: {
    MIN_REPS: 1,
    MAX_REPS: 1000,
    MAX_INCREMENT: 100
  }
};

// Exercise display names
export const EXERCISE_DISPLAY_NAMES = {
  [CONFIG.EXERCISE_TYPES.PUSHUP]: "Push-Ups",
  [CONFIG.EXERCISE_TYPES.PULLUP]: "Pull-Ups"
};

// Button increments
export const REP_INCREMENTS = {
  SMALL: 1,
  MEDIUM: 5,
  LARGE: 10
};
