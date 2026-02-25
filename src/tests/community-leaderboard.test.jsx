import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../App.jsx";

function createMockApi(overrides = {}) {
  return {
    hasSupabaseEnv: false,
    getCurrentUser: vi.fn().mockResolvedValue(null),
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    ensureProfile: vi.fn().mockResolvedValue(null),
    getProfile: vi.fn().mockResolvedValue(null),
    getPublicProfile: vi.fn().mockResolvedValue(null),
    updatePreferredRepType: vi.fn().mockResolvedValue(null),
    addRepDelta: vi.fn().mockResolvedValue(null),
    getLeaderboard: vi.fn().mockResolvedValue([]),
    onAuthStateChange: vi.fn(() => () => {}),
    ...overrides,
  };
}

describe("Leaderboard page", () => {
  it("loads athletes and opens public profile modal", async () => {
    const api = createMockApi({
      getLeaderboard: vi.fn().mockResolvedValue([
        { id: "u1", username: "AlexFit", pushupTotal: 120, dailyPushups: {} },
        { id: "u2", username: "TaylorLift", pushupTotal: 96, dailyPushups: {} },
      ]),
      getPublicProfile: vi.fn().mockResolvedValue({
        id: "u1",
        username: "AlexFit",
        pushupTotal: 120,
        dailyPushups: {},
      }),
    });

    render(<App apiClient={api} />);

    fireEvent.click(screen.getByRole("button", { name: "Leaderboard" }));

    await waitFor(() => {
      expect(screen.getByText("AlexFit")).toBeInTheDocument();
      expect(screen.getByText("TaylorLift")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Open AlexFit profile" }));

    await waitFor(() => {
      expect(api.getPublicProfile).toHaveBeenCalledWith("u1");
      expect(screen.getByText("Public profile")).toBeInTheDocument();
      expect(screen.getByText("120 push-ups")).toBeInTheDocument();
    });
  });

  it("searches athletes by name", async () => {
    const api = createMockApi({
      getLeaderboard: vi
        .fn()
        .mockResolvedValueOnce([{ id: "u1", username: "AlexFit", pushupTotal: 120, dailyPushups: {} }])
        .mockResolvedValueOnce([{ id: "u2", username: "SamStrong", pushupTotal: 80, dailyPushups: {} }]),
    });

    render(<App apiClient={api} />);
    fireEvent.click(screen.getByRole("button", { name: "Leaderboard" }));

    await waitFor(() => expect(api.getLeaderboard).toHaveBeenCalledWith(""));

    fireEvent.change(screen.getByRole("searchbox", { name: "Search athletes" }), {
      target: { value: "sam" },
    });

    await waitFor(() => {
      expect(api.getLeaderboard).toHaveBeenLastCalledWith("sam");
    });
  });
});
