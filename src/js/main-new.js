import { authManager } from "./auth/auth-manager.js";
import { stateManager } from "./services/state-manager.js";
import { storageService } from "./services/storage.js";
import { offlineQueue } from "./services/offline-queue.js";
import { RepCounterComponent } from "./components/rep-counter.js";
import { NavigationComponent } from "./components/navbar.js";
import { DOMUtils, StorageUtils } from "./utils/helpers.js";
import { CONFIG } from "./utils/constants.js";

class RepBoardApp {
  constructor() {
    this.components = {};
    this.isInitialized = false;

    this.initialize = this.initialize.bind(this);

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", this.initialize);
    } else {
      this.initialize();
    }
  }

  async initialize() {
    try {
      if (!storageService.isStorageAvailable()) {
        DOMUtils.showMessage("Warning: Local storage unavailable. Progress may not persist.", "error");
      }

      await authManager.initialize();
      this.initializeComponents();
      this.setupStateListeners();
      this.loadInitialData();
      this.registerServiceWorker();

      stateManager.setCurrentPage("repPage");
      this.isInitialized = true;
      console.log("RepBoard initialized", offlineQueue.getQueueStatus());
    } catch (error) {
      console.error("Failed to initialize RepBoard:", error);
      DOMUtils.showMessage("Failed to initialize application. Please refresh.", "error");
    }
  }

  initializeComponents() {
    this.components.repCounter = new RepCounterComponent();
    this.components.navigation = new NavigationComponent();
  }

  setupStateListeners() {
    stateManager.subscribe("ui.currentPage", (newPage) => {
      this.showPage(newPage);
    });

    stateManager.subscribe("ui.error", (error) => {
      if (error) {
        console.error("Application error:", error);
      }
    });
  }

  loadInitialData() {
    const sessionReps = storageService.loadSessionReps();
    stateManager.setNestedValue("reps.session", sessionReps);

    const preferredRepType = StorageUtils.getItem(
      CONFIG.STORAGE_KEYS.PREFERRED_REP_TYPE,
      CONFIG.EXERCISE_TYPES.PUSHUP,
    );

    stateManager.setCurrentExercise(preferredRepType);
  }

  showPage(pageKey) {
    const pages = ["repPage", "leaderboardPage", "profilePage"];
    pages.forEach((pageId) => {
      DOMUtils.toggleVisibility(pageId, pageId === pageKey);
    });

    this.updateNavigation(pageKey);
  }

  updateNavigation(activePage) {
    const buttonMap = {
      repPage: "repPageButton",
      leaderboardPage: "leaderboardButton",
      profilePage: "profileButton",
    };

    Object.values(buttonMap).forEach((buttonId) => {
      const button = DOMUtils.getElement(buttonId);
      if (button) {
        button.classList.remove("active");
      }
    });

    const activeButton = DOMUtils.getElement(buttonMap[activePage]);
    if (activeButton) {
      activeButton.classList.add("active");
    }
  }

  registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    window.addEventListener("load", async () => {
      try {
        await navigator.serviceWorker.register("./sw.js");
      } catch (error) {
        console.warn("Service worker registration failed:", error);
      }
    });
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      state: stateManager.getState(),
      components: {
        repCounter: this.components.repCounter?.getStatus() || null,
      },
      storage: storageService.getStorageInfo(),
      queue: offlineQueue.getQueueStatus(),
    };
  }

  destroy() {
    Object.values(this.components).forEach((component) => {
      if (component && typeof component.destroy === "function") {
        component.destroy();
      }
    });
  }
}

window.repBoardApp = new RepBoardApp();
window.getRepBoardStatus = () => window.repBoardApp.getStatus();

window.addEventListener("beforeunload", () => {
  const currentExercise = stateManager.state.reps.currentExercise;
  StorageUtils.setItem(CONFIG.STORAGE_KEYS.PREFERRED_REP_TYPE, currentExercise);
});

export default window.repBoardApp;
