import { CONFIG } from "./constants.js";

/**
 * Validation utilities
 */
export const Validators = {
  /**
   * Validates if a value is a valid exercise type
   * @param {string} type - Exercise type
   * @returns {boolean}
   */
  isValidExerciseType(type) {
    return Object.values(CONFIG.EXERCISE_TYPES).includes(type);
  },
  
  /**
   * Validates rep count
   * @param {number} count - Rep count
   * @returns {boolean}
   */
  isValidRepCount(count) {
    return typeof count === 'number' && 
           Math.abs(count) >= CONFIG.VALIDATION.MIN_REPS && 
           Math.abs(count) <= CONFIG.VALIDATION.MAX_REPS;
  },
  
  /**
   * Validates user ID format
   * @param {string} userId - User ID
   * @returns {boolean}
   */
  isValidUserId(userId) {
    return typeof userId === 'string' && userId.length > 0;
  }
};

/**
 * Date and time utilities
 */
export const DateUtils = {
  /**
   * Formats a date for display
   * @param {Date} date - Date to format
   * @returns {string}
   */
  formatDate(date) {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
};

/**
 * Storage utilities
 */
export const StorageUtils = {
  /**
   * Safely gets value from localStorage
   * @param {string} key - Storage key
   * @param {any} defaultValue - Default value if not found
   * @returns {any}
   */
  getItem(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.warn(`Failed to get localStorage item "${key}":`, error);
      return defaultValue;
    }
  },
  
  /**
   * Safely sets value in localStorage
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   * @returns {boolean} Success status
   */
  setItem(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn(`Failed to set localStorage item "${key}":`, error);
      return false;
    }
  },
  
  /**
   * Safely removes item from localStorage
   * @param {string} key - Storage key
   * @returns {boolean} Success status
   */
  removeItem(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn(`Failed to remove localStorage item "${key}":`, error);
      return false;
    }
  }
};

/**
 * DOM utilities
 */
export const DOMUtils = {
  /**
   * Safely gets element by ID with error handling
   * @param {string} id - Element ID
   * @returns {HTMLElement|null}
   */
  getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
      console.warn(`Element with ID "${id}" not found`);
    }
    return element;
  },
  
  /**
   * Shows a message to the user
   * @param {string} message - Message to display
   * @param {string} type - Message type (error, success, info)
   */
  showMessage(message, type = 'info') {
    const messageElement = DOMUtils.getElement('loginMessage');
    if (messageElement) {
      messageElement.textContent = message;
      messageElement.style.color = type === 'error' ? 'red' : 
                                  type === 'success' ? 'green' : 
                                  'inherit';
    } else {
      // Fallback to alert
      alert(message);
    }
  },
  
  /**
   * Toggles element visibility
   * @param {string} id - Element ID
   * @param {boolean} show - Whether to show the element
   */
  toggleVisibility(id, show) {
    const element = DOMUtils.getElement(id);
    if (element) {
      element.style.display = show ? '' : 'none';
    }
  }
};

/**
 * Math utilities
 */
export const MathUtils = {
  /**
   * Clamps a number between min and max values
   * @param {number} value - Value to clamp
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number}
   */
  clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  },
  
  /**
   * Calculates total reps from user data
   * @param {Object} userData - User data with pushup/pullup counts
   * @returns {number}
   */
  calculateTotalReps(userData) {
    const pushups = userData.pushup || 0;
    const pullups = userData.pullup || 0;
    return pushups + pullups;
  }
};