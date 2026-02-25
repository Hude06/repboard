import { stateManager } from "../services/state-manager.js";
import { authManager } from "../auth/auth-manager.js";
import { DOMUtils, StorageUtils } from "../utils/helpers.js";
import { apiClient } from "../services/api-client.js";
import { CONFIG } from "../utils/constants.js";
import { renderPushupHeatmap } from "./pushup-heatmap.js";

export class NavigationComponent {
  constructor() {
    this.elements = {};
    this.communityUsers = [];

    this.initializeElements();
    this.setupEventListeners();
    this.setupStateListeners();
  }

  initializeElements() {
    this.elements = {
      repPageButton: DOMUtils.getElement("repPageButton"),
      profileButton: DOMUtils.getElement("profileButton"),
      leaderboardButton: DOMUtils.getElement("leaderboardButton"),
      logoutBtn: DOMUtils.getElement("logoutBtn"),
      googleSignInButton: DOMUtils.getElement("googleSignInButton"),
      resetLocalStorageBtn: DOMUtils.getElement("resetLocalStorage"),
      preferredRepType: DOMUtils.getElement("preferredRepType"),
      leaderboardSearch: DOMUtils.getElement("leaderboardSearch"),
      community: DOMUtils.getElement("community"),
      profileHeatmap: DOMUtils.getElement("profileHeatmap"),
      modal: DOMUtils.getElement("publicProfileModal"),
      closeModalButton: DOMUtils.getElement("closePublicProfileModal"),
      publicProfileName: DOMUtils.getElement("publicProfileName"),
      publicProfilePushupTotal: DOMUtils.getElement("publicProfilePushupTotal"),
      publicProfileHeatmap: DOMUtils.getElement("publicProfileHeatmap"),
    };
  }

  setupEventListeners() {
    if (this.elements.repPageButton) {
      this.elements.repPageButton.addEventListener("click", () => this.navigateToPage("repPage"));
    }

    if (this.elements.profileButton) {
      this.elements.profileButton.addEventListener("click", () => this.navigateToPage("profilePage"));
    }

    if (this.elements.leaderboardButton) {
      this.elements.leaderboardButton.addEventListener("click", () => this.navigateToPage("leaderboardPage"));
    }

    if (this.elements.googleSignInButton) {
      this.elements.googleSignInButton.addEventListener("click", () => this.handleSignIn());
    }

    if (this.elements.logoutBtn) {
      this.elements.logoutBtn.addEventListener("click", () => this.handleSignOut());
    }

    if (this.elements.resetLocalStorageBtn) {
      this.elements.resetLocalStorageBtn.addEventListener("click", () => this.handleResetLocalStorage());
    }

    if (this.elements.preferredRepType) {
      this.elements.preferredRepType.addEventListener("change", (event) => {
        this.handlePreferredRepTypeChange(event.target.value);
      });
    }

    if (this.elements.leaderboardSearch) {
      this.elements.leaderboardSearch.addEventListener("input", () => {
        this.updateCommunityDisplay();
      });
    }

    if (this.elements.closeModalButton) {
      this.elements.closeModalButton.addEventListener("click", () => this.closePublicProfileModal());
    }

    if (this.elements.modal) {
      this.elements.modal.addEventListener("click", (event) => {
        if (event.target === this.elements.modal) {
          this.closePublicProfileModal();
        }
      });
    }
  }

  setupStateListeners() {
    stateManager.subscribe("ui.currentPage", (newPage) => {
      this.updateNavigationButtons(newPage);
    });

    stateManager.subscribe("auth", (authData) => {
      this.updateAuthUI(authData);

      if (authData.isAuthenticated) {
        this.loadProfileData();
      } else {
        this.resetProfileView();
      }
    });

    stateManager.subscribe("reps.currentExercise", (exercise) => {
      if (this.elements.preferredRepType) {
        this.elements.preferredRepType.value = exercise;
      }
    });
  }

  async navigateToPage(pageKey) {
    try {
      stateManager.setCurrentPage(pageKey);

      if (pageKey === "profilePage") {
        await this.loadProfileData();
      }

      if (pageKey === "leaderboardPage") {
        await this.loadCommunityData();
      }
    } catch (error) {
      console.error(`Failed to navigate to ${pageKey}:`, error);
      DOMUtils.showMessage("Failed to load page.", "error");
    }
  }

  updateNavigationButtons(activePage) {
    const pages = ["repPage", "profilePage", "leaderboardPage"];
    pages.forEach((pageId) => {
      const page = DOMUtils.getElement(pageId);
      if (page) {
        page.style.display = pageId === activePage ? "" : "none";
      }
    });

    const buttonMap = {
      repPage: this.elements.repPageButton,
      profilePage: this.elements.profileButton,
      leaderboardPage: this.elements.leaderboardButton,
    };

    Object.values(buttonMap).forEach((button) => {
      if (button) {
        button.classList.remove("active");
      }
    });

    const activeButton = buttonMap[activePage];
    if (activeButton) {
      activeButton.classList.add("active");
    }
  }

  updateAuthUI(authData) {
    const usernameElement = DOMUtils.getElement("username");
    if (usernameElement) {
      usernameElement.textContent = authData.username;
    }

    const initialElement = DOMUtils.getElement("initial");
    if (initialElement) {
      initialElement.textContent = (authData.username || "G").charAt(0).toUpperCase();
    }

    if (this.elements.googleSignInButton) {
      this.elements.googleSignInButton.style.display = authData.isAuthenticated ? "none" : "inline-flex";
    }

    if (this.elements.logoutBtn) {
      this.elements.logoutBtn.style.display = authData.isAuthenticated ? "inline-flex" : "none";
    }
  }

  async handleSignIn() {
    try {
      await authManager.signInWithGoogle();
    } catch (error) {
      console.error("Sign in failed:", error);
    }
  }

  async handleSignOut() {
    try {
      await authManager.signOut();
      stateManager.setCurrentPage("repPage");
      DOMUtils.showMessage("Signed out successfully.", "success");
    } catch (error) {
      console.error("Sign out failed:", error);
      DOMUtils.showMessage("Sign out failed.", "error");
    }
  }

  handleResetLocalStorage() {
    const confirmed = confirm("Reset local session data? This clears device-only rep counters and queue.");
    if (!confirmed) {
      return;
    }

    try {
      localStorage.clear();
      location.reload();
    } catch (error) {
      console.error("Failed to clear local storage:", error);
      DOMUtils.showMessage("Failed to reset local data.", "error");
    }
  }

  async handlePreferredRepTypeChange(repType) {
    if (!repType) {
      return;
    }

    stateManager.setCurrentExercise(repType);
    StorageUtils.setItem(CONFIG.STORAGE_KEYS.PREFERRED_REP_TYPE, repType);

    if (!authManager.isAuthenticated()) {
      DOMUtils.showMessage("Rep type preference saved locally.", "info");
      return;
    }

    try {
      const user = authManager.getCurrentUser();
      await apiClient.updatePreferredRepType(user.userId, repType);
      DOMUtils.showMessage("Rep type updated.", "success");
    } catch (error) {
      console.error("Failed to update preferred rep type:", error);
      DOMUtils.showMessage("Saved locally. Cloud update failed.", "error");
    }
  }

  async loadProfileData() {
    if (!authManager.isAuthenticated()) {
      return;
    }

    stateManager.setLoading("fetchTotals", true);

    try {
      const user = authManager.getCurrentUser();
      const totals = await apiClient.getUserTotals(user.userId);

      const pushupTotal = Number(totals.pushup || 0);
      const pullupTotal = Number(totals.pullup || 0);

      const pushupStatElement = DOMUtils.getElement("AllTimePushUpStat");
      const pullupStatElement = DOMUtils.getElement("AllTimePullUpStat");

      if (pushupStatElement) {
        pushupStatElement.textContent = String(pushupTotal);
      }

      if (pullupStatElement) {
        pullupStatElement.textContent = String(pullupTotal);
      }

      stateManager.setAllTimeReps("pushup", pushupTotal);
      stateManager.setAllTimeReps("pullup", pullupTotal);

      const profile = await apiClient.getPublicProfile(user.userId);
      const preferredRepType =
        profile?.preferredRepType ||
        StorageUtils.getItem(CONFIG.STORAGE_KEYS.PREFERRED_REP_TYPE, "pushup");

      stateManager.setCurrentExercise(preferredRepType);
      StorageUtils.setItem(CONFIG.STORAGE_KEYS.PREFERRED_REP_TYPE, preferredRepType);

      if (this.elements.preferredRepType) {
        this.elements.preferredRepType.value = preferredRepType;
      }

      if (this.elements.profileHeatmap) {
        renderPushupHeatmap(this.elements.profileHeatmap, profile?.dailyPushups || {});
      }
    } catch (error) {
      console.error("Failed to load profile data:", error);
      DOMUtils.showMessage("Failed to load profile data.", "error");
    } finally {
      stateManager.setLoading("fetchTotals", false);
    }
  }

  resetProfileView() {
    const pushupStatElement = DOMUtils.getElement("AllTimePushUpStat");
    const pullupStatElement = DOMUtils.getElement("AllTimePullUpStat");
    if (pushupStatElement) {
      pushupStatElement.textContent = "0";
    }
    if (pullupStatElement) {
      pullupStatElement.textContent = "0";
    }

    if (this.elements.preferredRepType) {
      const fallbackType = StorageUtils.getItem(CONFIG.STORAGE_KEYS.PREFERRED_REP_TYPE, "pushup");
      this.elements.preferredRepType.value = fallbackType;
      stateManager.setCurrentExercise(fallbackType);
    }

    if (this.elements.profileHeatmap) {
      renderPushupHeatmap(this.elements.profileHeatmap, {});
    }
  }

  async loadCommunityData() {
    try {
      const users = await apiClient.getCommunityTotals();
      this.communityUsers = Array.isArray(users) ? users : [];
      stateManager.updateCommunity(this.communityUsers);
      this.updateCommunityDisplay();
    } catch (error) {
      console.error("Failed to load leaderboard:", error);
      DOMUtils.showMessage("Failed to load leaderboard.", "error");
    }
  }

  updateCommunityDisplay() {
    const communityElement = this.elements.community;
    if (!communityElement) {
      return;
    }

    const searchTerm = (this.elements.leaderboardSearch?.value || "").trim().toLowerCase();
    const filteredUsers = this.communityUsers.filter((user) => {
      if (!searchTerm) {
        return true;
      }
      return String(user.name || "").toLowerCase().includes(searchTerm);
    });

    communityElement.innerHTML = "";

    if (filteredUsers.length === 0) {
      communityElement.innerHTML = '<div class="community-empty">No athletes found.</div>';
      return;
    }

    filteredUsers.forEach((user, index) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "community-user";

      let rankLabel = String(index + 1);
      if (index === 0) rankLabel = "1";
      if (index === 1) rankLabel = "2";
      if (index === 2) rankLabel = "3";

      row.innerHTML = `
        <div class="community-rank">${rankLabel}</div>
        <div>
          <div class="community-name">${user.name || "Anonymous"}</div>
          <div class="community-sub">Tap to view profile</div>
        </div>
        <div class="community-stats">
          <strong>${Number(user.pushup || 0)}</strong>
          push-ups
        </div>
      `;

      row.addEventListener("click", () => {
        this.openPublicProfile(user.userid);
      });

      communityElement.appendChild(row);
    });
  }

  async openPublicProfile(userId) {
    try {
      const profile = await apiClient.getPublicProfile(userId);
      if (!profile) {
        throw new Error("Profile unavailable");
      }

      if (this.elements.publicProfileName) {
        this.elements.publicProfileName.textContent = profile.name || "Athlete";
      }

      if (this.elements.publicProfilePushupTotal) {
        this.elements.publicProfilePushupTotal.textContent = `${Number(profile.pushup || 0)} push-ups`;
      }

      if (this.elements.publicProfileHeatmap) {
        renderPushupHeatmap(this.elements.publicProfileHeatmap, profile.dailyPushups || {});
      }

      if (this.elements.modal) {
        this.elements.modal.style.display = "block";
        this.elements.modal.setAttribute("aria-hidden", "false");
      }
    } catch (error) {
      console.error("Failed to open public profile:", error);
      DOMUtils.showMessage("Unable to open profile.", "error");
    }
  }

  closePublicProfileModal() {
    if (!this.elements.modal) {
      return;
    }

    this.elements.modal.style.display = "none";
    this.elements.modal.setAttribute("aria-hidden", "true");
  }
}
