import React, { useMemo } from "react";

const DAYS = 365;

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function getTimeline() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const timeline = [];
  for (let i = DAYS - 1; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    timeline.push(dateKey(day));
  }

  return timeline;
}

function getHeatLevel(count, max) {
  if (!count || count <= 0) return 0;
  if (max <= 0) return 1;

  const ratio = count / max;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}

export default function PushupHeatmap({ dailyPushups = {}, label = "Push-up heatmap" }) {
  const timeline = useMemo(() => getTimeline(), []);
  const counts = useMemo(() => timeline.map((key) => Number(dailyPushups[key] || 0)), [dailyPushups, timeline]);
  const maxCount = useMemo(() => counts.reduce((max, count) => (count > max ? count : max), 0), [counts]);

  return (
    <div className="heatmap-wrap" aria-label={label}>
      <div className="heatmap-grid">
        {timeline.map((key, index) => {
          const count = counts[index];
          const level = getHeatLevel(count, maxCount);
          return (
            <div
              key={key}
              className={`heat-cell level-${level}`}
              title={`${key}: ${count} push-ups`}
              aria-label={`${key} ${count} push-ups`}
            />
          );
        })}
      </div>
      <div className="heatmap-legend">
        <span>0</span>
        <span className="legend-dot level-1" />
        <span className="legend-dot level-2" />
        <span className="legend-dot level-3" />
        <span className="legend-dot level-4" />
        <span>high</span>
      </div>
    </div>
  );
}
