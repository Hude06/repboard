import { CONFIG } from "../utils/constants.js";
import { StorageUtils } from "../utils/helpers.js";
import { apiClient } from "./api-client.js";

/**
 * Offline Queue Service
 * Handles queuing and synchronization of failed operations when offline
 */
export class OfflineQueueService {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.maxRetries = 3;
    this.retryDelay = 2000; // 2 seconds
    this.storageKey = CONFIG.STORAGE_KEYS.OFFLINE_QUEUE;
    
    this.loadQueue();
    this.setupEventListeners();
  }
  
  /**
   * Set up event listeners for connectivity changes
   */
  setupEventListeners() {
    window.addEventListener('online', () => {
      console.log('Connection restored, processing offline queue...');
      this.processQueue();
    });
    
    // Process queue on app start if online
    if (navigator.onLine) {
      setTimeout(() => this.processQueue(), 1000);
    }
  }
  
  /**
   * Load queue from localStorage
   */
  loadQueue() {
    try {
      const savedQueue = StorageUtils.getItem(this.storageKey, []);
      this.queue = Array.isArray(savedQueue) ? savedQueue : [];
      console.log(`Loaded ${this.queue.length} operations from offline queue`);
    } catch (error) {
      console.error('Failed to load offline queue:', error);
      this.queue = [];
    }
  }
  
  /**
   * Save queue to localStorage
   */
  saveQueue() {
    try {
      StorageUtils.setItem(this.storageKey, this.queue);
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }
  
  /**
   * Add operation to queue
   * @param {string} type - Operation type (currently only 'addReps')
   * @param {Object} data - Operation data
   * @returns {string} Operation ID
   */
  queueOperation(type, data) {
    const operation = {
      id: this.generateOperationId(),
      type,
      data,
      timestamp: new Date().toISOString(),
      retries: 0
    };
    
    this.queue.push(operation);
    this.saveQueue();
    
    console.log(`Queued operation ${operation.id} (${type})`);
    return operation.id;
  }
  
  /**
   * Generate unique operation ID
   * @returns {string} Unique ID
   */
  generateOperationId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Process all queued operations
   */
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0 || !navigator.onLine) {
      return;
    }
    
    this.isProcessing = true;
    console.log(`Processing ${this.queue.length} queued operations...`);
    
    try {
      // Process operations in order (FIFO)
      for (let i = 0; i < this.queue.length; i++) {
        const operation = this.queue[i];
        
        try {
          await this.processOperation(operation);
          
          // Remove successful operation from queue
          this.queue.splice(i, 1);
          i--; // Adjust index after removal
          
        } catch (error) {
          console.error(`Failed to process operation ${operation.id}:`, error);
          
          // Mark as retried
          operation.retries++;
          
          // Remove if max retries exceeded
          if (operation.retries >= this.maxRetries) {
            console.warn(`Removing operation ${operation.id} after ${this.maxRetries} failed attempts`);
            this.queue.splice(i, 1);
            i--; // Adjust index after removal
          } else {
            // Wait before retrying next operation
            await this.sleep(this.retryDelay);
          }
        }
      }
      
      this.saveQueue();
      
    } finally {
      this.isProcessing = false;
      console.log(`Queue processing complete. ${this.queue.length} operations remaining.`);
    }
  }
  
  /**
   * Process individual operation
   * @param {Object} operation - Operation to process
   */
  async processOperation(operation) {
    switch (operation.type) {
      case 'addReps':
        return await this.processAddReps(operation);
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }
  
  /**
   * Process addReps operation
   * @param {Object} operation - addReps operation
   */
  async processAddReps(operation) {
    const { userId, type, count, username } = operation.data;
    
    console.log(`Syncing queued addReps: ${type} +${count} for user ${username}`);
    
    const result = await apiClient.addReps(userId, type, count, username);
    
    if (result && typeof result.total === 'number') {
      console.log(`Successfully synced queued operation ${operation.id}:`, result);
      return result;
    } else {
      throw new Error('Invalid response from server');
    }
  }
  
  /**
   * Get number of queued operations
   * @returns {number} Queue size
   */
  getQueueCount() {
    return this.queue.length;
  }
  
  /**
   * Clear all queued operations
   */
  clearQueue() {
    this.queue = [];
    this.saveQueue();
    console.log('Offline queue cleared');
  }
  
  /**
   * Get queue status information
   * @returns {Object} Queue status
   */
  getQueueStatus() {
    const operationsByType = {};
    
    this.queue.forEach(op => {
      if (!operationsByType[op.type]) {
        operationsByType[op.type] = 0;
      }
      operationsByType[op.type]++;
    });
    
    return {
      count: this.queue.length,
      isProcessing: this.isProcessing,
      operationsByType,
      oldestOperation: this.queue.length > 0 ? this.queue[0].timestamp : null
    };
  }
  
  /**
   * Sleep for specified time
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Debug: Get all queued operations
   * @returns {Array} Array of operations
   */
  getQueueSnapshot() {
    return [...this.queue];
  }
}

// Create singleton instance
export const offlineQueue = new OfflineQueueService();