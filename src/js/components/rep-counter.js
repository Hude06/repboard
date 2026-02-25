import { CONFIG, EXERCISE_DISPLAY_NAMES } from "../utils/constants.js";
import { stateManager } from "../services/state-manager.js";
import { apiClient } from "../services/api-client.js";
import { offlineQueue } from "../services/offline-queue.js";
import { authManager } from "../auth/auth-manager.js";
import { DOMUtils } from "../utils/helpers.js";

export class RepCounterComponent {
  constructor() {
    this.elements = {};
    this.queueInterval = null;
    this.isConnected = navigator.onLine;

    this.handleAddOne = this.handleAddOne.bind(this);
    this.handleAddFive = this.handleAddFive.bind(this);
    this.handleRemoveFive = this.handleRemoveFive.bind(this);
    this.handleResetClick = this.handleResetClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleOnline = this.handleOnline.bind(this);
    this.handleOffline = this.handleOffline.bind(this);

    this.initializeElements();
    this.setupEventListeners();
    this.setupStateListeners();
    this.updateRepDisplay();
    this.updateQueueStatus();
    this.startQueueStatusLoop();
  }

  initializeElements() {
    this.elements = {
      repCount: DOMUtils.getElement("repCount"),
      repButton: DOMUtils.getElement("repButton"),
      incrementButton: DOMUtils.getElement("increment"),
      decrementButton: DOMUtils.getElement("decrement"),
      resetButton: DOMUtils.getElement("reset_current_count"),
      queueStatus: DOMUtils.getElement("queueStatus"),
      queueCount: DOMUtils.getElement("queueCount"),
      currentRepTypeLabel: DOMUtils.getElement("currentRepTypeLabel"),
    };
  }

  setupEventListeners() {
    if (this.elements.repButton) {
      this.elements.repButton.addEventListener("click", this.handleAddOne);
    }

    if (this.elements.incrementButton) {
      this.elements.incrementButton.addEventListener("click", this.handleAddFive);
    }

    if (this.elements.decrementButton) {
      this.elements.decrementButton.addEventListener("click", this.handleRemoveFive);
    }

    if (this.elements.resetButton) {
      this.elements.resetButton.addEventListener("click", this.handleResetClick);
    }

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);
  }

  setupStateListeners() {
    stateManager.subscribe("reps.session", () => {
      this.updateRepDisplay();
    });

    stateManager.subscribe("reps.currentExercise", () => {
      this.updateRepDisplay();
    });

    stateManager.subscribe("ui.loading.addRep", (loading) => {
      this.setLoadingState(loading);
    });
  }

  startQueueStatusLoop() {
    this.queueInterval = setInterval(() => {
      this.updateQueueStatus();
    }, 2000);
  }

  handleAddOne() {
    this.applyRepDelta(1);
  }

  handleAddFive() {
    this.applyRepDelta(5);
  }

  handleRemoveFive() {
    this.applyRepDelta(-5);
  }

  handleResetClick() {
    const currentExercise = stateManager.state.reps.currentExercise;
    const currentCount = stateManager.state.reps.session[currentExercise];

    if (currentCount > 0) {
      this.applyRepDelta(-currentCount);
      DOMUtils.showMessage(`${EXERCISE_DISPLAY_NAMES[currentExercise]} session reset`, "success");
    }
  }

  handleKeyDown(event) {
    if (event.code === "Space") {
      event.preventDefault();
      this.handleAddOne();
    }

    if (event.code === "ArrowUp") {
      event.preventDefault();
      this.handleAddFive();
    }

    if (event.code === "ArrowDown") {
      event.preventDefault();
      this.handleRemoveFive();
    }
  }

  handleOnline() {
    this.isConnected = true;
    this.updateQueueStatus();

    const queueCount = offlineQueue.getQueueCount();
    if (queueCount > 0) {
      DOMUtils.showMessage(`Connection restored. Syncing ${queueCount} queued updates.`, "success");
      offlineQueue.processQueue();
    }
  }

  handleOffline() {
    this.isConnected = false;
    this.updateQueueStatus();
    DOMUtils.showMessage("You are offline. Reps will sync automatically.", "info");
  }

  async applyRepDelta(delta) {
    if (!authManager.isAuthenticated()) {
      DOMUtils.showMessage("Please sign in first.", "error");
      return;
    }

    const exercise = stateManager.state.reps.currentExercise;
    const current = stateManager.state.reps.session[exercise];

    const safeDelta = delta < 0 ? Math.max(delta, -current) : delta;
    if (safeDelta === 0) {
      return;
    }

    stateManager.updateReps(exercise, safeDelta, true);
    this.syncDeltaToAPI(exercise, safeDelta);
  }

  async syncDeltaToAPI(exercise, delta) {
    const user = authManager.getCurrentUser();
    if (!user) {
      return;
    }

    stateManager.setLoading("addRep", true);

    try {
      const result = await apiClient.addReps(user.userId, exercise, delta, user.username);
      if (result && typeof result.total === "number") {
        stateManager.setAllTimeReps(exercise, result.total);
      }
    } catch (error) {
      offlineQueue.queueOperation("addReps", {
        userId: user.userId,
        type: exercise,
        count: delta,
        username: user.username,
      });

      if (!navigator.onLine) {
        DOMUtils.showMessage("Offline: rep change queued for sync.", "info");
      } else {
        DOMUtils.showMessage("Server unavailable. Change queued.", "error");
      }
    } finally {
      stateManager.setLoading("addRep", false);
      this.updateQueueStatus();
    }
  }

  updateRepDisplay() {
    const exercise = stateManager.state.reps.currentExercise;
    const count = stateManager.state.reps.session[exercise];

    if (this.elements.repCount) {
      this.elements.repCount.textContent = String(count);
    }

    if (this.elements.currentRepTypeLabel) {
      this.elements.currentRepTypeLabel.textContent = EXERCISE_DISPLAY_NAMES[exercise] || "Push-Ups";
    }
  }

  updateQueueStatus() {
    if (!this.elements.queueStatus || !this.elements.queueCount) {
      return;
    }

    const queueCount = offlineQueue.getQueueCount();

    if (queueCount > 0) {
      this.elements.queueStatus.style.display = "inline-flex";
      this.elements.queueCount.textContent = String(queueCount);
      return;
    }

    this.elements.queueStatus.style.display = "none";
  }

  setLoadingState(loading) {
    const buttons = [
      this.elements.repButton,
      this.elements.incrementButton,
      this.elements.decrementButton,
      this.elements.resetButton,
    ].filter(Boolean);

    buttons.forEach((button) => {
      button.disabled = loading;
      button.style.opacity = loading ? "0.7" : "1";
    });
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      currentExercise: stateManager.state.reps.currentExercise,
      queueCount: offlineQueue.getQueueCount(),
    };
  }

  destroy() {
    if (this.queueInterval) {
      clearInterval(this.queueInterval);
      this.queueInterval = null;
    }

    if (this.elements.repButton) {
      this.elements.repButton.removeEventListener("click", this.handleAddOne);
    }

    if (this.elements.incrementButton) {
      this.elements.incrementButton.removeEventListener("click", this.handleAddFive);
    }

    if (this.elements.decrementButton) {
      this.elements.decrementButton.removeEventListener("click", this.handleRemoveFive);
    }

    if (this.elements.resetButton) {
      this.elements.resetButton.removeEventListener("click", this.handleResetClick);
    }

    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("online", this.handleOnline);
    window.removeEventListener("offline", this.handleOffline);
  }
}
