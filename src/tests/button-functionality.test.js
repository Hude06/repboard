import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RepCounterComponent } from '../js/components/rep-counter.js';
import { stateManager } from '../js/services/state-manager.js';
import { authManager } from '../js/auth/auth-manager.js';

// Mock DOM elements
const mockElements = {
  repTypeSelect: { value: 'pushup', addEventListener: vi.fn() },
  repCount: { textContent: '0' },
  repButton: { addEventListener: vi.fn(), disabled: false, style: {} },
  incrementButton: { addEventListener: vi.fn(), disabled: false, style: {} },
  decrementButton: { addEventListener: vi.fn(), disabled: false, style: {} },
  resetButton: { addEventListener: vi.fn() }
};

// Mock DOMUtils
vi.mock('../js/utils/helpers.js', () => ({
  DOMUtils: {
    getElement: vi.fn((id) => mockElements[id] || null),
    showMessage: vi.fn()
  }
}));

// Mock stateManager
vi.mock('../js/services/state-manager.js', () => ({
  stateManager: {
    state: {
      reps: { session: { pushup: 0, pullup: 0 }, currentExercise: 'pushup' },
      ui: { loading: { addRep: false } }
    },
    subscribe: vi.fn(),
    updateReps: vi.fn(),
    setNestedValue: vi.fn(),
    setLoading: vi.fn()
  }
}));

// Mock authManager
vi.mock('../js/auth/auth-manager.js', () => ({
  authManager: {
    isAuthenticated: vi.fn(() => false),
    getCurrentUser: vi.fn(() => null)
  }
}));

describe('RepCounterComponent - Button Functionality', () => {
  let component;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock elements
    Object.values(mockElements).forEach(element => {
      if (element.textContent) element.textContent = '0';
      if (element.disabled) element.disabled = false;
      if (element.style) element.style = {};
    });
    
    component = new RepCounterComponent();
  });

  describe('Button Event Listeners', () => {
    it('should add click listener to rep button', () => {
      expect(mockElements.repButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should add click listener to increment button', () => {
      expect(mockElements.incrementButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should add click listener to decrement button', () => {
      expect(mockElements.decrementButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });
  });

  describe('Rep Button Clicks', () => {
    it('should add 1 rep when rep button is clicked', async () => {
      // Mock user as authenticated
      authManager.isAuthenticated.mockReturnValue(true);
      authManager.getCurrentUser.mockReturnValue({ userId: 'test-user', username: 'Test User' });

      // Get the click handler from the addEventListener call
      const repButtonHandler = mockElements.repButton.addEventListener.mock.calls[0][1];
      
      // Call the handler
      await repButtonHandler();
      
      // Should update state with 1 rep
      expect(stateManager.updateReps).toHaveBeenCalledWith('pushup', 1, true);
    });

    it('should show error if user is not authenticated', async () => {
      // Mock user as not authenticated
      authManager.isAuthenticated.mockReturnValue(false);

      const repButtonHandler = mockElements.repButton.addEventListener.mock.calls[0][1];
      
      await repButtonHandler();
      
      expect(mockElements.DOMUtils.showMessage).toHaveBeenCalledWith('Please sign in first.');
    });
  });

  describe('Increment Button (+5)', () => {
    it('should add 5 reps when increment button is clicked', async () => {
      authManager.isAuthenticated.mockReturnValue(true);
      authManager.getCurrentUser.mockReturnValue({ userId: 'test-user', username: 'Test User' });

      const incrementHandler = mockElements.incrementButton.addEventListener.mock.calls[0][1];
      
      await incrementHandler();
      
      expect(stateManager.updateReps).toHaveBeenCalledWith('pushup', 5, true);
    });

    it('should handle negative reps correctly', async () => {
      // Start with some reps
      stateManager.state.reps.session.pushup = 10;
      
      authManager.isAuthenticated.mockReturnValue(true);
      authManager.getCurrentUser.mockReturnValue({ userId: 'test-user', username: 'Test User' });

      const incrementHandler = mockElements.incrementButton.addEventListener.mock.calls[0][1];
      
      // Add negative 5 reps
      await incrementHandler();
      
      expect(stateManager.updateReps).toHaveBeenCalledWith('pushup', -5, true);
    });

    it('should not allow reps to go below 0', async () => {
      // Start with 3 reps
      stateManager.state.reps.session.pushup = 3;
      
      authManager.isAuthenticated.mockReturnValue(true);
      authManager.getCurrentUser.mockReturnValue({ userId: 'test-user', username: 'Test User' });

      const incrementHandler = mockElements.incrementButton.addEventListener.mock.calls[0][1];
      
      // Remove 5 reps (should clamp to 0)
      await incrementHandler();
      
      expect(stateManager.updateReps).toHaveBeenCalledWith('pushup', -3, true); // 3 - 5 = -2, but clamp to 0
    });
  });

  describe('Decrement Button (-5)', () => {
    it('should subtract 5 reps when decrement button is clicked', async () => {
      authManager.isAuthenticated.mockReturnValue(true);
      authManager.getCurrentUser.mockReturnValue({ userId: 'test-user', username: 'Test User' });

      const decrementHandler = mockElements.decrementButton.addEventListener.mock.calls[0][1];
      
      await decrementHandler();
      
      expect(stateManager.updateReps).toHaveBeenCalledWith('pushup', -5, true);
    });
  });

  describe('Reset Button', () => {
    it('should reset current exercise to 0', () => {
      stateManager.state.reps.session.pushup = 10;
      stateManager.state.reps.currentExercise = 'pushup';

      const resetHandler = mockElements.resetButton.addEventListener.mock.calls[0][1];
      
      resetHandler();
      
      expect(stateManager.updateReps).toHaveBeenCalledWith('pushup', -10, true);
    });
  });

  describe('Keyboard Support', () => {
    it('should add 1 rep when spacebar is pressed', async () => {
      authManager.isAuthenticated.mockReturnValue(true);
      authManager.getCurrentUser.mockReturnValue({ userId: 'test-user', username: 'Test User' });

      // Mock keyboard event
      const spaceEvent = { code: 'Space', preventDefault: vi.fn() };
      
      // Simulate spacebar press
      component.handleKeyDown(spaceEvent);
      
      expect(spaceEvent.preventDefault).toHaveBeenCalled();
      expect(stateManager.updateReps).toHaveBeenCalledWith('pushup', 1, true);
    });

    it('should add 1 rep when arrow up is pressed', async () => {
      authManager.isAuthenticated.mockReturnValue(true);
      authManager.getCurrentUser.mockReturnValue({ userId: 'test-user', username: 'Test User' });

      const upEvent = { code: 'ArrowUp', preventDefault: vi.fn() };
      
      component.handleKeyDown(upEvent);
      
      expect(stateManager.updateReps).toHaveBeenCalledWith('pushup', 1, true);
    });

    it('should subtract 1 rep when arrow down is pressed', async () => {
      authManager.isAuthenticated.mockReturnValue(true);
      authManager.getCurrentUser.mockReturnValue({ userId: 'test-user', username: 'Test User' });

      const downEvent = { code: 'ArrowDown', preventDefault: vi.fn() };
      
      component.handleKeyDown(downEvent);
      
      expect(stateManager.updateReps).toHaveBeenCalledWith('pushup', -1, true);
    });
  });

  describe('Loading States', () => {
    it('should disable buttons during loading', () => {
      // Simulate loading state
      stateManager.state.ui.loading.addRep = true;

      component.setLoadingState(true);

      expect(mockElements.repButton.disabled).toBe(true);
      expect(mockElements.incrementButton.disabled).toBe(true);
      expect(mockElements.decrementButton.disabled).toBe(true);
    });

    it('should enable buttons when not loading', () => {
      // Simulate not loading state
      stateManager.state.ui.loading.addRep = false;

      component.setLoadingState(false);

      expect(mockElements.repButton.disabled).toBe(false);
      expect(mockElements.incrementButton.disabled).toBe(false);
      expect(mockElements.decrementButton.disabled).toBe(false);
    });
  });

  describe('Display Updates', () => {
    it('should update rep count display', () => {
      // Mock session with 15 reps
      stateManager.state.reps.session.pushup = 15;
      stateManager.state.reps.currentExercise = 'pushup';

      component.updateRepDisplay();

      expect(mockElements.repCount.textContent).toBe('15');
    });
  });
});