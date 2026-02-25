import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stateManager } from '../js/services/state-manager.js';

describe('StateManager', () => {
  beforeEach(() => {
    // Reset state manager before each test
    stateManager.resetSession();
    vi.clearAllMocks();
  });

  describe('Authentication State', () => {
    it('should update auth state correctly', () => {
      const authData = {
        userId: 'test-user-123',
        username: 'Test User',
        isLoading: false,
        error: null
      };

      stateManager.updateAuth(authData);

      expect(stateManager.state.auth.userId).toBe('test-user-123');
      expect(stateManager.state.auth.username).toBe('Test User');
      expect(stateManager.state.auth.isAuthenticated).toBe(true);
    });

    it('should handle authentication with null user', () => {
      const authData = {
        userId: null,
        username: 'GUEST',
        isLoading: false,
        error: null
      };

      stateManager.updateAuth(authData);

      expect(stateManager.state.auth.isAuthenticated).toBe(false);
      expect(stateManager.state.auth.username).toBe('GUEST');
    });
  });

  describe('Rep Counting', () => {
    it('should update session reps correctly', () => {
      stateManager.updateReps('pushup', 5, true);

      expect(stateManager.state.reps.session.pushup).toBe(5);
      expect(stateManager.state.reps.sessionTotal).toBe(5);
    });

    it('should handle negative reps (not going below zero)', () => {
      stateManager.updateReps('pushup', 5, true);
      stateManager.updateReps('pushup', -10, true);

      expect(stateManager.state.reps.session.pushup).toBe(0);
      expect(stateManager.state.reps.sessionTotal).toBe(0);
    });

    it('should update all-time reps correctly', () => {
      stateManager.updateReps('pullup', 10, false);

      expect(stateManager.state.reps.allTime.pullup).toBe(10);
    });

    it('should validate exercise types', () => {
      expect(() => {
        stateManager.updateReps('invalid-exercise', 5, true);
      }).toThrow('Invalid exercise type: invalid-exercise');
    });
  });

  describe('Current Exercise', () => {
    it('should set current exercise', () => {
      stateManager.setCurrentExercise('pullup');

      expect(stateManager.state.reps.currentExercise).toBe('pullup');
    });

    it('should validate current exercise', () => {
      expect(() => {
        stateManager.setCurrentExercise('invalid');
      }).toThrow('Invalid exercise type: invalid');
    });
  });

  describe('Loading States', () => {
    it('should set loading state for operations', () => {
      stateManager.setLoading('addRep', true);

      expect(stateManager.state.ui.loading.addRep).toBe(true);
    });

    it('should update error state', () => {
      const errorMessage = 'Test error message';
      stateManager.setError(errorMessage);

      expect(stateManager.state.ui.error).toBe(errorMessage);
    });
  });

  describe('State Subscription', () => {
    it('should notify subscribers of state changes', () => {
      const callback = vi.fn();
      stateManager.subscribe('auth.userId', callback);

      stateManager.updateAuth({ userId: 'new-user', username: 'Test', isLoading: false, error: null });

      expect(callback).toHaveBeenCalledWith('new-user', null);
    });

    it('should unsubscribe from state changes', () => {
      const callback = vi.fn();
      stateManager.subscribe('auth.userId', callback);
      stateManager.unsubscribe('auth.userId', callback);

      stateManager.updateAuth({ userId: 'another-user', username: 'Test', isLoading: false, error: null });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Session Management', () => {
    it('should reset session correctly', () => {
      // Add some reps first
      stateManager.updateReps('pushup', 10, true);
      stateManager.updateReps('pullup', 5, true);

      stateManager.resetSession();

      expect(stateManager.state.reps.session.pushup).toBe(0);
      expect(stateManager.state.reps.session.pullup).toBe(0);
      expect(stateManager.state.reps.sessionTotal).toBe(0);
    });
  });
});