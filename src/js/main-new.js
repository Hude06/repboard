// Main application entry point
import { authManager } from "./auth/auth-manager.js";
import { stateManager } from "./services/state-manager.js";
import { storageService } from "./services/storage.js";
import { offlineQueue } from "./services/offline-queue.js";
import { RepCounterComponent } from "./components/rep-counter.js";
import { NavigationComponent } from "./components/navbar.js";
import { DOMUtils } from "./utils/helpers.js";

/**
 * Main Application Class
 * Coordinates all components and handles application lifecycle
 */
class RepBoardApp {
  constructor() {
    this.components = {};
    this.isInitialized = false;
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.handleAuthState = this.handleAuthState.bind(this);
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', this.initialize);
    } else {
      this.initialize();
    }
  }
  
  /**
   * Initialize the application
   */
  async initialize() {
    try {
      console.log('Initializing RepBoard...');
      
      // Check storage availability
      if (!storageService.isStorageAvailable()) {
        DOMUtils.showMessage('Warning: Local storage not available. Your progress won\'t be saved.', 'error');
      }
      
      // Initialize authentication
      await authManager.initialize();
      
      // Initialize components
      this.initializeComponents();
      
      // Set up state listeners
      this.setupStateListeners();
      
      // Load initial data
      this.loadInitialData();
      
      // Show initial page
      this.showInitialPage();
      
      this.isInitialized = true;
      console.log('RepBoard initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize RepBoard:', error);
      DOMUtils.showMessage('Failed to initialize application. Please refresh the page.', 'error');
    }
  }
  
  /**
   * Initialize UI components
   */
  initializeComponents() {
    try {
      // Initialize rep counter component
      this.components.repCounter = new RepCounterComponent();
      
      // Initialize navigation component
      this.components.navigation = new NavigationComponent();
      
      console.log('Components initialized');
      
    } catch (error) {
      console.error('Failed to initialize components:', error);
      throw error;
    }
  }
  
  /**
   * Set up state listeners for application-wide changes
   */
  setupStateListeners() {
    // Listen for auth state changes
    stateManager.subscribe('auth', this.handleAuthState);
    
    // Listen for page changes
    stateManager.subscribe('ui.currentPage', (newPage) => {
      this.showPage(newPage);
    });
    
    // Listen for errors
    stateManager.subscribe('ui.error', (error) => {
      if (error) {
        console.error('Application error:', error);
      }
    });
  }
  
  /**
   * Load initial data
   */
  loadInitialData() {
    try {
      // Load session reps from storage
      const sessionReps = storageService.loadSessionReps();
      stateManager.setNestedValue('reps.session', sessionReps);
      
      // Set initial exercise type
      const savedExercise = localStorage.getItem('currentExercise') || 'pushup';
      stateManager.setCurrentExercise(savedExercise);
      
      console.log('Initial data loaded');
      
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  }
  
  /**
   * Show initial page based on auth state
   */
  showInitialPage() {
    const auth = stateManager.state.auth;
    
    if (auth.isAuthenticated) {
      stateManager.setCurrentPage('repPage');
    } else {
      stateManager.setCurrentPage('repPage');
    }
  }
  
  /**
   * Handle authentication state changes
   * @param {Object} authData - Authentication data
   */
  handleAuthState(authData) {
    // UI updates and profile loading are now handled by navbar component
    console.log('Auth state changed:', authData.isAuthenticated);
  }
  
  /**
   * Show a specific page
   * @param {string} pageKey - Page identifier
   */
  showPage(pageKey) {
    // Hide all pages
    const pages = ['repPage', 'profilePage', 'communityPage'];
    
    pages.forEach(page => {
      DOMUtils.toggleVisibility(page, page === pageKey);
    });
    
    // Update navigation buttons
    this.updateNavigation(pageKey);
    
    // Save current exercise when switching pages
    const currentExercise = stateManager.state.reps.currentExercise;
    localStorage.setItem('currentExercise', currentExercise);
    
    console.log('Showing page:', pageKey);
  }
  
  /**
   * Update navigation button states
   * @param {string} activePage - Currently active page
   */
  updateNavigation(activePage) {
    const buttonMap = {
      'repPage': 'repPageButton',
      'profilePage': 'profileButton', 
      'communityPage': 'communityButton'
    };
    
    // Remove active class from all buttons
    Object.values(buttonMap).forEach(buttonId => {
      const button = DOMUtils.getElement(buttonId);
      if (button) {
        button.classList.remove('active');
      }
    });
    
    // Add active class to current button
    const activeButtonId = buttonMap[activePage];
    if (activeButtonId) {
      const activeButton = DOMUtils.getElement(activeButtonId);
      if (activeButton) {
        activeButton.classList.add('active');
      }
    }
  }
  
  /**
   * Get application status for debugging
   * @returns {Object} Application status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      authManager: authManager.getAuthState(),
      state: stateManager.getState(),
      components: {
        repCounter: this.components.repCounter?.getStatus() || null
      },
      storage: storageService.getStorageInfo()
    };
  }
  
  /**
   * Handle application shutdown/cleanup
   */
  destroy() {
    // Destroy components
    Object.values(this.components).forEach(component => {
      if (component && typeof component.destroy === 'function') {
        component.destroy();
      }
    });
    
    console.log('RepBoard application destroyed');
  }
}

// Create and initialize the application
window.repBoardApp = new RepBoardApp();

// Make app available globally for debugging
window.getRepBoardStatus = () => window.repBoardApp.getStatus();

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // Page became visible again, check connectivity
    console.log('Page became visible');
  }
});

// Handle before unload to save data
window.addEventListener('beforeunload', () => {
  // Save any unsaved data
  const currentExercise = stateManager.state.reps.currentExercise;
  localStorage.setItem('currentExercise', currentExercise);
  
  console.log('Saving data before page unload');
});

// Export for modules that need the app instance
export default window.repBoardApp;