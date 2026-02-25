import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import PushupHeatmap from "../components/PushupHeatmap.jsx";

describe("PushupHeatmap", () => {
  it("renders a full 365-day grid", () => {
    const { container } = render(<PushupHeatmap dailyPushups={{}} />);
    const cells = container.querySelectorAll(".heat-cell");
    expect(cells.length).toBe(365);
  });

  it("maps zero days to black and higher days to darker green", () => {
    const today = new Date().toISOString().slice(0, 10);
    const { container } = render(<PushupHeatmap dailyPushups={{ [today]: 24 }} />);

    const hotCell = container.querySelector(`.heat-cell[title='${today}: 24 push-ups']`);
    const zeroCells = container.querySelectorAll(".heat-cell.level-0");

    expect(hotCell).toBeInTheDocument();
    expect(hotCell).toHaveClass("level-4");
    expect(zeroCells.length).toBeGreaterThan(0);
  });
});
