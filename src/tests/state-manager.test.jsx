import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../App.jsx";

function createMockApi(overrides = {}) {
  return {
    hasSupabaseEnv: true,
    getCurrentUser: vi.fn().mockResolvedValue({ id: "user-1", email: "user@example.com" }),
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    ensureProfile: vi.fn().mockResolvedValue({
      id: "user-1",
      username: "Athlete",
      preferredRepType: "pushup",
      pushupTotal: 30,
      pullupTotal: 10,
      dailyPushups: {},
    }),
    getProfile: vi.fn().mockResolvedValue(null),
    getPublicProfile: vi.fn().mockResolvedValue(null),
    updatePreferredRepType: vi.fn().mockResolvedValue({
      id: "user-1",
      username: "Athlete",
      preferredRepType: "pullup",
      pushupTotal: 30,
      pullupTotal: 10,
      dailyPushups: {},
    }),
    addRepDelta: vi.fn().mockResolvedValue({
      id: "user-1",
      username: "Athlete",
      preferredRepType: "pullup",
      pushupTotal: 30,
      pullupTotal: 11,
      dailyPushups: {},
    }),
    getLeaderboard: vi.fn().mockResolvedValue([]),
    onAuthStateChange: vi.fn(() => () => {}),
    ...overrides,
  };
}

describe("Profile settings behavior", () => {
  it("updates preferred rep type and uses it on rep page", async () => {
    const api = createMockApi();
    render(<App apiClient={api} />);

    await waitFor(() => expect(api.ensureProfile).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Profile" }));

    const repTypeSelect = screen.getByLabelText("Default rep type");
    fireEvent.change(repTypeSelect, { target: { value: "pullup" } });

    await waitFor(() => {
      expect(api.updatePreferredRepType).toHaveBeenCalledWith("user-1", "pullup");
    });

    fireEvent.click(screen.getByRole("button", { name: "Rep" }));
    fireEvent.click(screen.getByRole("button", { name: "Add one rep" }));

    await waitFor(() => {
      expect(api.addRepDelta).toHaveBeenCalledWith("user-1", "pullup", 1);
    });
  });
});
