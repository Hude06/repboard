import { CONFIG } from "../utils/constants.js";
import { StorageUtils } from "../utils/helpers.js";
import { stateManager } from "./state-manager.js";

/**
 * Storage Management Service
 * Handles all localStorage operations with error handling and synchronization
 */
export class StorageService {
  constructor() {
    this.storageKeys = CONFIG.STORAGE_KEYS;
    
    // Subscribe to state changes to keep localStorage in sync
    this.setupStateSync();
  }
  
  /**
   * Set up state synchronization with localStorage
   */
  setupStateSync() {
    // Sync session reps to localStorage
    stateManager.subscribe('reps.session', (session) => {
      StorageUtils.setItem(this.storageKeys.SESSION_REPS_PUSHUP, session.pushup);
      StorageUtils.setItem(this.storageKeys.SESSION_REPS_PULLUP, session.pullup);
    });
    
    // Listen for storage events from other tabs
    window.addEventListener('storage', this.handleStorageEvent.bind(this));
  }
  
  /**
   * Handle storage events from other tabs
   * @param {StorageEvent} event - Storage event
   */
  handleStorageEvent(event) {
    if (event.key === this.storageKeys.SESSION_REPS_PUSHUP) {
      const newValue = event.newValue ? JSON.parse(event.newValue) : 0;
      stateManager.setNestedValue('reps.session.pushup', newValue);
    } else if (event.key === this.storageKeys.SESSION_REPS_PULLUP) {
      const newValue = event.newValue ? JSON.parse(event.newValue) : 0;
      stateManager.setNestedValue('reps.session.pullup', newValue);
    }
  }
  
  /**
   * Load session reps from localStorage
   * @returns {Object} Session rep data
   */
  loadSessionReps() {
    return {
      pushup: StorageUtils.getItem(this.storageKeys.SESSION_REPS_PUSHUP, 0),
      pullup: StorageUtils.getItem(this.storageKeys.SESSION_REPS_PULLUP, 0)
    };
  }
  
  /**
   * Save session reps to localStorage
   * @param {Object} session - Session rep data
   */
  saveSessionReps(session) {
    StorageUtils.setItem(this.storageKeys.SESSION_REPS_PUSHUP, session.pushup);
    StorageUtils.setItem(this.storageKeys.SESSION_REPS_PULLUP, session.pullup);
  }
  
  /**
   * Clear all application data from localStorage
   */
  clearAllData() {
    Object.values(this.storageKeys).forEach(key => {
      StorageUtils.removeItem(key);
    });
    console.log('All application data cleared from localStorage');
  }
  
  /**
   * Get storage usage information
   * @returns {Object} Storage usage stats
   */
  getStorageInfo() {
    try {
      let totalSize = 0;
      const items = {};
      
      // Calculate size and get all app-related items
      Object.values(this.storageKeys).forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          const size = new Blob([value]).size;
          totalSize += size;
          items[key] = {
            size,
            value: JSON.parse(value)
          };
        }
      });
      
      return {
        totalSize,
        items,
        maxSize: 5 * 1024 * 1024, // 5MB typical localStorage limit
        usagePercentage: Math.round((totalSize / (5 * 1024 * 1024)) * 100)
      };
      
    } catch (error) {
      console.error('Failed to get storage info:', error);
      return { totalSize: 0, items: {}, maxSize: 0, usagePercentage: 0 };
    }
  }
  
  /**
   * Export all application data
   * @returns {Object} Exportable data
   */
  exportData() {
    return {
      version: CONFIG.VERSION,
      exportDate: new Date().toISOString(),
      session: this.loadSessionReps(),
      storage: this.getStorageInfo()
    };
  }
  
  /**
   * Import application data
   * @param {Object} data - Data to import
   * @returns {boolean} Success status
   */
  importData(data) {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid import data format');
      }
      
      // Import session reps
      if (data.session) {
        const session = {
          pushup: Number(data.session.pushup) || 0,
          pullup: Number(data.session.pullup) || 0
        };
        
        this.saveSessionReps(session);
        stateManager.setNestedValue('reps.session', session);
      }
      
      console.log('Data imported successfully');
      return true;
      
    } catch (error) {
      console.error('Failed to import data:', error);
      return false;
    }
  }
  
  /**
   * Check if localStorage is available
   * @returns {boolean} True if available
   */
  isStorageAvailable() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (error) {
      console.warn('localStorage is not available:', error);
      return false;
    }
  }
  
  /**
   * Get all localStorage keys used by the app
   * @returns {Array} Array of storage keys
   */
  getAllKeys() {
    return Object.values(this.storageKeys);
  }
}

// Create singleton instance
export const storageService = new StorageService();