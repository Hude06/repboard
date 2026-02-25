import React from "react";
import { describe, it, expect, vi } from "vitest";
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

describe("Rep page interactions", () => {
  it("uses +1, +5, and -5 with clamp at zero", async () => {
    const api = createMockApi();
    render(<App apiClient={api} />);

    const count = screen.getByTestId("current-rep-count");
    const addOne = screen.getByRole("button", { name: "Add one rep" });
    const addFive = screen.getByRole("button", { name: "Add five reps" });
    const removeFive = screen.getByRole("button", { name: "Remove five reps" });

    expect(count).toHaveTextContent("0");
    fireEvent.click(addOne);
    expect(count).toHaveTextContent("1");
    fireEvent.click(addFive);
    expect(count).toHaveTextContent("6");
    fireEvent.click(removeFive);
    expect(count).toHaveTextContent("1");
    fireEvent.click(removeFive);
    expect(count).toHaveTextContent("0");
  });

  it("syncs rep changes to API for authenticated users", async () => {
    const user = { id: "user-1", email: "test@example.com" };
    const api = createMockApi({
      getCurrentUser: vi.fn().mockResolvedValue(user),
      ensureProfile: vi.fn().mockResolvedValue({
        id: "user-1",
        username: "Test",
        preferredRepType: "pushup",
        pushupTotal: 10,
        pullupTotal: 2,
        dailyPushups: {},
      }),
      addRepDelta: vi.fn().mockResolvedValue({
        id: "user-1",
        username: "Test",
        preferredRepType: "pushup",
        pushupTotal: 11,
        pullupTotal: 2,
        dailyPushups: {},
      }),
    });

    render(<App apiClient={api} />);
    await waitFor(() => expect(api.ensureProfile).toHaveBeenCalledWith(user));

    fireEvent.click(screen.getByRole("button", { name: "Add one rep" }));

    await waitFor(() => {
      expect(api.addRepDelta).toHaveBeenCalledWith("user-1", "pushup", 1);
    });
  });
});
