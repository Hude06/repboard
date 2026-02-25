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
import { CONFIG } from "../utils/constants.js";
import { stateManager } from "../services/state-manager.js";
import { DOMUtils } from "../utils/helpers.js";

/**
 * Firebase Authentication Manager
 * Handles all authentication-related operations
 */
export class AuthManager {
  constructor() {
    this.app = null;
    this.auth = null;
    this.provider = null;
    this.isInitialized = false;
    
    // Bind methods to maintain context
    this.handleAuthStateChange = this.handleAuthStateChange.bind(this);
  }
  
  /**
   * Initialize Firebase Authentication
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }
    
    try {
      // Initialize Firebase
      this.app = initializeApp(CONFIG.FIREBASE_CONFIG);
      this.auth = getAuth(this.app);
      this.provider = new GoogleAuthProvider();
      
      // Set persistence to local (survives browser restart)
      await setPersistence(this.auth, browserLocalPersistence);
      
      // Set up auth state listener
      onAuthStateChanged(this.auth, this.handleAuthStateChange);
      
      this.isInitialized = true;
      console.log('Firebase Auth initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize Firebase Auth:', error);
      DOMUtils.showMessage('Authentication system failed to initialize', 'error');
      throw error;
    }
  }
  
  /**
   * Handle Firebase auth state changes
   * @param {Object|null} user - Firebase user object or null
   */
  async handleAuthStateChange(user) {
    try {
      if (user) {
        // User is signed in
        const authData = {
          userId: user.uid,
          username: user.displayName || user.email || 'user',
          isLoading: false,
          error: null
        };
        
        stateManager.updateAuth(authData);
        
        console.log(`User signed in: ${authData.username} (${authData.userId})`);
        
      } else {
        // User is signed out
        stateManager.updateAuth({
          userId: null,
          username: 'GUEST',
          isLoading: false,
          error: null
        });
        
        console.log('User signed out');
      }
      
    } catch (error) {
      console.error('Error handling auth state change:', error);
      stateManager.updateAuth({
        isLoading: false,
        error: 'Authentication state update failed'
      });
    }
  }
  
  /**
   * Sign in with Google popup
   * @returns {Promise<Object>} User data
   */
  async signInWithGoogle() {
    if (!this.isInitialized) {
      throw new Error('AuthManager not initialized');
    }
    
    stateManager.setLoading('signIn', true);
    
    try {
      const result = await signInWithPopup(this.auth, this.provider);
      const user = result.user;
      
      console.log(`Google sign-in successful: ${user.email}`);
      
      // Auth state change will be handled by the listener
      return {
        userId: user.uid,
        username: user.displayName || user.email || 'user',
        email: user.email
      };
      
    } catch (error) {
      console.error('Google sign-in error:', error);
      
      let errorMessage = 'Sign-in failed. Try again.';
      
      // Provide more specific error messages
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign-in cancelled.';
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = 'Sign-in popup was blocked. Please allow popups.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Check your connection.';
      }
      
      DOMUtils.showMessage(errorMessage, 'error');
      throw new Error(errorMessage);
      
    } finally {
      stateManager.setLoading('signIn', false);
    }
  }
  
  /**
   * Sign out the current user
   * @returns {Promise<void>}
   */
  async signOut() {
    if (!this.isInitialized) {
      return;
    }
    
    try {
      await signOut(this.auth);
      console.log('User signed out successfully');
      
      // Auth state change will be handled by the listener
      
    } catch (error) {
      console.error('Sign-out error:', error);
      DOMUtils.showMessage('Sign-out failed. Try again.', 'error');
      throw error;
    }
  }
  
  /**
   * Get current authenticated user
   * @returns {Object|null} Current user or null
   */
  getCurrentUser() {
    if (!this.isInitialized || !this.auth) {
      return null;
    }
    
    const user = this.auth.currentUser;
    if (!user) {
      return null;
    }
    
    return {
      userId: user.uid,
      username: user.displayName || user.email || 'user',
      email: user.email,
      photoURL: user.photoURL
    };
  }
  
  /**
   * Check if user is currently authenticated
   * @returns {boolean} True if authenticated
   */
  isAuthenticated() {
    return this.getCurrentUser() !== null;
  }
  
  /**
   * Get authentication initialization status
   * @returns {boolean} True if initialized
   */
  isReady() {
    return this.isInitialized;
  }
  
  /**
   * Reset authentication state (for testing/debugging)
   */
  reset() {
    this.app = null;
    this.auth = null;
    this.provider = null;
    this.isInitialized = false;
  }
  
  /**
   * Get current authentication state for debugging
   * @returns {Object} Current auth state
   */
  getAuthState() {
    return {
      isInitialized: this.isInitialized,
      currentUser: this.getCurrentUser(),
      isAuthenticated: this.isAuthenticated()
    };
  }
}

// Create singleton instance
export const authManager = new AuthManager();