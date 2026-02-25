function toISODate(date) {
  return date.toISOString().split("T")[0];
}

function buildTimeline(days = 365) {
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    dates.push(toISODate(date));
  }

  return dates;
}

export function getHeatLevel(count, maxCount) {
  if (!count || count <= 0) {
    return 0;
  }

  if (maxCount <= 0) {
    return 1;
  }

  const ratio = count / maxCount;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}

export function renderPushupHeatmap(container, dailyPushups = {}) {
  if (!container) {
    return;
  }

  const timeline = buildTimeline(365);
  const counts = timeline.map((dateKey) => Number(dailyPushups[dateKey] || 0));
  const maxCount = counts.reduce((max, count) => (count > max ? count : max), 0);

  container.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "heatmap-grid";

  timeline.forEach((dateKey, index) => {
    const count = counts[index];
    const cell = document.createElement("div");
    const level = getHeatLevel(count, maxCount);

    cell.className = `heat-cell level-${level}`;
    cell.title = `${dateKey}: ${count} push-ups`;
    cell.setAttribute("aria-label", `${dateKey} ${count} push-ups`);

    grid.appendChild(cell);
  });

  container.appendChild(grid);
}
