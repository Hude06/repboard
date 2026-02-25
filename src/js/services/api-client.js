import { CONFIG } from "../utils/constants.js";
import { Validators } from "../utils/helpers.js";

/**
 * API Client for RepBoard backend communication
 * Handles all HTTP requests with proper error handling and loading states
 */
export class APIClient {
  constructor() {
    this.baseURL = CONFIG.API_URL;
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 5000
    };
  }
  
  /**
   * Calculate delay with exponential backoff
   * @param {number} attempt - Current attempt number
   * @returns {number} Delay in milliseconds
   */
  calculateDelay(attempt) {
    const delay = this.retryConfig.baseDelay * Math.pow(2, attempt - 1);
    return Math.min(delay, this.retryConfig.maxDelay);
  }
  
  /**
   * Sleep for specified time
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Make HTTP request with retry logic
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @param {number} attempt - Current attempt number
   * @returns {Promise<Response>}
   */
  async fetchWithRetry(endpoint, options = {}, attempt = 1) {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const defaultOptions = {
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      };
      
      const response = await fetch(url, { ...defaultOptions, ...options });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      console.warn(`API request failed (attempt ${attempt}/${this.retryConfig.maxRetries}):`, error.message);
      
      if (attempt < this.retryConfig.maxRetries && this.shouldRetry(error)) {
        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
        return this.fetchWithRetry(endpoint, options, attempt + 1);
      }
      
      throw error;
    }
  }
  
  /**
   * Determine if error should trigger a retry
   * @param {Error} error - The error that occurred
   * @returns {boolean}
   */
  shouldRetry(error) {
    // Retry on network errors and 5xx server errors
    return error.name === 'TypeError' || // Network error
           (error.message.includes('HTTP 5') || error.message.includes('timeout'));
  }
  
  /**
   * Handle API errors consistently
   * @param {Error} error - Error to handle
   * @param {string} context - Context where error occurred
   * @throws {Error} - Re-throws error with context
   */
  handleError(error, context) {
    const errorMessage = `Failed to ${context}: ${error.message}`;
    console.error(errorMessage, error);
    throw new Error(errorMessage);
  }
  
  /**
   * Validate request data
   * @param {Object} data - Data to validate
   * @param {string} context - Validation context
   */
  validateRequest(data, context) {
    if (!data.userid || !Validators.isValidUserId(data.userid)) {
      throw new Error(`Invalid user ID in ${context}`);
    }
    
    if (data.type && !Validators.isValidExerciseType(data.type)) {
      throw new Error(`Invalid exercise type in ${context}`);
    }
    
    if (data.count !== undefined && !Validators.isValidRepCount(data.count)) {
      throw new Error(`Invalid rep count in ${context}`);
    }
  }
  
  /**
   * Add reps to user's count
   * @param {string} userId - User ID
   * @param {string} type - Exercise type
   * @param {number} count - Rep count
   * @param {string} username - User's name
   * @returns {Promise<Object>} Response data
   */
  async addReps(userId, type, count, username) {
    const data = { userid: userId, type, count, username };
    this.validateRequest(data, 'addReps request');
    
    try {
      const response = await this.fetchWithRetry('/add-rep', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      
      return await response.json();
    } catch (error) {
      this.handleError(error, 'add reps');
    }
  }
  
  /**
   * Get total reps for a specific user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User's rep data
   */
  async getUserTotals(userId) {
    if (!Validators.isValidUserId(userId)) {
      throw new Error('Invalid user ID for getUserTotals');
    }
    
    try {
      const response = await this.fetchWithRetry(`/total/${userId}`);
      return await response.json();
    } catch (error) {
      // Return default values if user not found
      if (error.message.includes('HTTP 404')) {
        return { pushup: 0, pullup: 0 };
      }
      this.handleError(error, 'get user totals');
    }
  }
  
  /**
   * Get all users' totals for community leaderboard
   * @returns {Promise<Array>} Array of user data
   */
  async getCommunityTotals() {
    try {
      const response = await this.fetchWithRetry('/total');
      const data = await response.json();

      // Transform and sort data
      return Object.entries(data)
        .map(([userid, user]) => ({
          userid,
          name: user.name || 'Anonymous',
          pushup: user.pushup || 0,
          pullup: user.pullup || 0,
          total: user.pushup || 0,
          challengeCompleted: user.challengeCompleted || false
        }))
        .sort((a, b) => b.pushup - a.pushup);
    } catch (error) {
      this.handleError(error, 'get community totals');
    }
  }

  async getPublicProfile(userId) {
    if (!Validators.isValidUserId(userId)) {
      throw new Error('Invalid user ID for getPublicProfile');
    }

    try {
      const response = await this.fetchWithRetry(`/profile/${userId}`);
      return await response.json();
    } catch (error) {
      this.handleError(error, 'get public profile');
    }
  }

  async updatePreferredRepType(userId, preferredRepType) {
    if (!Validators.isValidUserId(userId)) {
      throw new Error('Invalid user ID for updatePreferredRepType');
    }

    if (!Validators.isValidExerciseType(preferredRepType)) {
      throw new Error('Invalid rep type for updatePreferredRepType');
    }

    try {
      const response = await this.fetchWithRetry('/profile/settings', {
        method: 'POST',
        body: JSON.stringify({
          userid: userId,
          preferredRepType,
        }),
      });
      return await response.json();
    } catch (error) {
      this.handleError(error, 'update preferred rep type');
    }
  }
  
  /**
   * Check if online and API is reachable
   * @returns {Promise<boolean>} True if online and reachable
   */
  async checkConnectivity() {
    if (!navigator.onLine) {
      return false;
    }
    
    try {
      // Simple health check
      const response = await fetch(`${this.baseURL}/total`, {
        method: 'HEAD',
        cache: 'no-cache'
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Get API status information
   * @returns {Promise<Object>} Status information
   */
  async getAPIStatus() {
    try {
      const online = await this.checkConnectivity();
      return {
        online,
        baseURL: this.baseURL,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        online: false,
        baseURL: this.baseURL,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // ------------------- CHALLENGE API -------------------

  /**
   * Get today's daily challenge info
   * @returns {Promise<Object>} Challenge data
   */
  async getDailyChallenge() {
    try {
      const response = await this.fetchWithRetry('/challenge/daily');
      return await response.json();
    } catch (error) {
      this.handleError(error, 'get daily challenge');
    }
  }

  /**
   * Update user's challenge progress
   * @param {string} userId - User ID
   * @param {number} count - Progress count
   * @returns {Promise<Object>} Updated challenge data
   */
  async updateChallengeProgress(userId, count) {
    if (!Validators.isValidUserId(userId)) {
      throw new Error('Invalid user ID for challenge progress');
    }

    const data = { userid: userId, count };

    try {
      const response = await this.fetchWithRetry('/challenge/progress', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (error) {
      this.handleError(error, 'update challenge progress');
    }
  }

  /**
   * Get challenge leaderboard (who completed today)
   * @returns {Promise<Object>} Challenge leaderboard data
   */
  async getChallengeLeaderboard() {
    try {
      const response = await this.fetchWithRetry('/challenge/leaderboard');
      return await response.json();
    } catch (error) {
      this.handleError(error, 'get challenge leaderboard');
    }
  }
}

// Create singleton instance
export const apiClient = new APIClient();
