import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NavigationComponent } from '../js/components/navbar.js';
import { stateManager } from '../js/services/state-manager.js';
import { authManager } from '../js/auth/auth-manager.js';
import { apiClient } from '../js/services/api-client.js';

// Mock DOM elements
const mockElements = {
  repPageButton: { addEventListener: vi.fn(), classList: { add: vi.fn(), remove: vi.fn() } },
  profileButton: { addEventListener: vi.fn(), classList: { add: vi.fn(), remove: vi.fn() }, disabled: false, style: {} },
  communityButton: { addEventListener: vi.fn(), classList: { add: vi.fn(), remove: vi.fn() }, disabled: false, style: {} },
  logoutBtn: { addEventListener: vi.fn() },
  googleSignInButton: { addEventListener: vi.fn(), style: { display: 'flex' } },
  resetLocalStorageBtn: { addEventListener: vi.fn() },
  community: { innerHTML: '', appendChild: vi.fn() }
};

// Mock DOMUtils
vi.mock('../js/utils/helpers.js', () => ({
  DOMUtils: {
    getElement: vi.fn((id) => mockElements[id] || null),
    showMessage: vi.fn(),
    toggleVisibility: vi.fn()
  }
}));

// Mock stateManager
vi.mock('../js/services/state-manager.js', () => ({
  stateManager: {
    state: { auth: { isAuthenticated: false }, community: { users: [] } },
    subscribe: vi.fn(),
    setCurrentPage: vi.fn(),
    setLoading: vi.fn()
  }
}));

// Mock authManager
vi.mock('../js/auth/auth-manager.js', () => ({
  authManager: {
    isAuthenticated: vi.fn(() => false),
    getCurrentUser: vi.fn(() => null),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn()
  }
}));

// Mock apiClient
vi.mock('../js/services/api-client.js', () => ({
  apiClient: {
    getUserTotals: vi.fn(),
    getCommunityTotals: vi.fn()
  }
}));

describe('NavigationComponent - Community Leaderboard', () => {
  let component;

  beforeEach(() => {
    vi.clearAllMocks();
    component = new NavigationComponent();
  });

  describe('Community Data Loading', () => {
    it('should call API to get community totals', async () => {
      authManager.isAuthenticated.mockReturnValue(true);
      authManager.getCurrentUser.mockReturnValue({ userId: 'test-user' });

      const communityHandler = mockElements.communityButton.addEventListener.mock.calls[0][1];
      
      await communityHandler();

      expect(apiClient.getCommunityTotals).toHaveBeenCalled();
    });

    it('should not load data if user is not authenticated', async () => {
      authManager.isAuthenticated.mockReturnValue(false);

      const communityHandler = mockElements.communityButton.addEventListener.mock.calls[0][1];
      
      await communityHandler();

      expect(apiClient.getCommunityTotals).not.toHaveBeenCalled();
    });
  });

  describe('Community Display', () => {
    it('should display sorted users by total reps', () => {
      const users = [
        { name: 'User C', total: 150, pushup: 100, pullup: 50, challengeCompleted: false },
        { name: 'User A', total: 300, pushup: 200, pullup: 100, challengeCompleted: true },
        { name: 'User B', total: 200, pushup: 150, pullup: 50, challengeCompleted: false }
      ];

      component.updateCommunityDisplay(users);

      // Should have created 3 user elements
      expect(mockElements.community.appendChild).toHaveBeenCalledTimes(3);

      // Check first user (highest total)
      const firstCall = mockElements.community.appendChild.mock.calls[0];
      expect(firstCall[0].innerHTML).toContain('User A');
      expect(firstCall[0].innerHTML).toContain('300 total reps');
      expect(firstCall[0].innerHTML).toContain('🥇'); // Gold medal
    });

    it('should handle empty user list', () => {
      const users = [];

      component.updateCommunityDisplay(users);

      expect(mockElements.community.innerHTML).toBe('<p>No data available yet.</p>');
    });

    it('should display correct medals for top 3', () => {
      const users = [
        { name: 'First', total: 300 },
        { name: 'Second', total: 200 },
        { name: 'Third', total: 100 },
        { name: 'Fourth', total: 50 }
      ];

      component.updateCommunityDisplay(users);

      const calls = mockElements.community.appendChild.mock.calls;
      
      expect(calls[0][0].innerHTML).toContain('🥇'); // First place
      expect(calls[1][0].innerHTML).toContain('🥈'); // Second place
      expect(calls[2][0].innerHTML).toContain('🥉'); // Third place
      expect(calls[3][0].innerHTML).toContain('4.'); // Fourth place
    });

    it('should format user stats correctly', () => {
      const users = [
        { name: 'Test User', total: 150, pushup: 100, pullup: 50 }
      ];

      component.updateCommunityDisplay(users);

      const userElement = mockElements.community.appendChild.mock.calls[0][0];
      
      expect(userElement.innerHTML).toContain('Test User');
      expect(userElement.innerHTML).toContain('150 total reps');
      expect(userElement.innerHTML).toContain('(100 pushups, 50 pullups)');
    });

    it('should display challenge badge for completed users', () => {
      const users = [
        { name: 'Completed User', total: 300, pushup: 200, pullup: 100, challengeCompleted: true },
        { name: 'Incomplete User', total: 150, pushup: 100, pullup: 50, challengeCompleted: false }
      ];

      component.updateCommunityDisplay(users);

      const calls = mockElements.community.appendChild.mock.calls;

      // First user completed - should have badge
      expect(calls[0][0].innerHTML).toContain('🏆');
      expect(calls[0][0].innerHTML).toContain('Completed User');

      // Second user not completed - should not have badge
      expect(calls[1][0].innerHTML).not.toContain('🏆');
      expect(calls[1][0].innerHTML).toContain('Incomplete User');
    });
  });

  describe('Navigation', () => {
    it('should show correct page when button is clicked', () => {
      const profileHandler = mockElements.profileButton.addEventListener.mock.calls[0][1];
      
      profileHandler();

      expect(stateManager.setCurrentPage).toHaveBeenCalledWith('profilePage');
    });

    it('should update button active states', () => {
      const profileHandler = mockElements.profileButton.addEventListener.mock.calls[0][1];
      
      profileHandler();

      expect(mockElements.profileButton.classListList.add).toHaveBeenCalledWith('active');
    });

    it('should hide all pages when switching', () => {
      stateManager.state.ui.currentPage = 'profilePage';

      const profileHandler = mockElements.profileButton.addEventListener.mock.calls[0][1];
      
      profileHandler();

      expect(mockElements.DOMUtils.toggleVisibility).toHaveBeenCalledWith('repPage', false);
      expect(mockElements.DOMUtils.toggleVisibility).toHaveBeenCalledWith('profilePage', true);
      expect(mockElements.DOMUtils.toggleVisibility).toHaveBeenCalledWith('communityPage', false);
    });
  });

  describe('Authentication UI Updates', () => {
    it('should hide sign-in button when authenticated', () => {
      const authData = { isAuthenticated: true, username: 'Test User' };

      component.updateAuthUI(authData);

      expect(mockElements.googleSignInButton.style.display).toBe('none');
    });

    it('should show sign-in button when not authenticated', () => {
      const authData = { isAuthenticated: false, username: 'GUEST' };

      component.updateAuthUI(authData);

      expect(mockElements.googleSignInButton.style.display).toBe('flex');
    });

    it('should update username and initial', () => {
      const authData = { isAuthenticated: true, username: 'TestUser' };

      component.updateAuthUI(authData);

      // Check DOMUtils.getElement was called for username and initial
      expect(mockElements.DOMUtils.getElement).toHaveBeenCalledWith('username');
      expect(mockElements.DOMUtils.getElement).toHaveBeenCalledWith('initial');
    });
  });

  describe('Profile Loading', () => {
    it('should load user stats when profile page is opened', async () => {
      authManager.isAuthenticated.mockReturnValue(true);
      authManager.getCurrentUser.mockReturnValue({ userId: 'test-user' });
      apiClient.getUserTotals.mockResolvedValue({ pushup: 100, pullup: 50 });

      const profileHandler = mockElements.profileButton.addEventListener.mock.calls[0][1];
      
      await profileHandler();

      expect(apiClient.getUserTotals).toHaveBeenCalledWith('test-user');
      expect(mockElements.DOMUtils.getElement).toHaveBeenCalledWith('AllTimePushUpStat');
      expect(mockElements.DOMUtils.getElement).toHaveBeenCalledWith('AllTimePullUpStat');
    });
  });
});