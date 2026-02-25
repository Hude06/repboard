# RepBoard V2 Spec (3-Page App)

## Goal
Rebuild RepBoard as a modern, sleek, dark-themed PWA with:
1. Rep page
2. Leaderboard page
3. Profile page

Includes account sign-in, public profiles, and a GitHub-style pushup calendar.

## Core Pages

## 1) Rep Page
Primary interaction for adding/removing reps.

### Requirements
- One large center button: **+1**
- Two side buttons:
  - Left: **-5**
  - Right: **+5**
- Actions apply to the currently selected rep type from Profile/Settings.
- Prevent totals from dropping below zero.
- Show current rep count and selected rep type.

## 2) Leaderboard Page
Shows ranked users by pushups and allows profile viewing.

### Requirements
- Rank users by total pushups (descending).
- Show rank, username, and total pushups.
- Clicking a user opens a public profile modal.
- Includes search by username.

## 3) Profile Page
User settings and stats.

### Requirements
- Show username and total pushups/pullups.
- Settings includes editable rep type preference (`pushup` / `pullup`).
- Rep type selection persists per account and drives behavior on Rep page.
- Include pushup activity calendar (GitHub-like heatmap).

## Public Profile Requirements
When viewing another user:
- Show username
- Show total pushups
- Show pushup calendar heatmap

## Pushup Calendar (GitHub-Style Heatmap)

### Data
- 365-day grid by day.
- Each cell represents that day’s pushups.

### Color Scale
- `0 pushups`: black (`#000000`)
- Increasing pushups: progressively darker/richer green shades.

## UX / Visual Design Direction
- Theme: modern, sleek, dark
- Strong contrast and clean spacing
- Smooth subtle animations
- Responsive behavior for mobile and desktop

## PWA Requirements
- Installable web app (manifest + service worker)
- Standalone display mode
- Offline shell caching
- Queue rep actions while offline and sync when online

## Functional Rules
- Center button always adds exactly 1.
- Side buttons always add/remove exactly 5.
- Rep type is editable only in Profile/Settings and persisted.
- Leaderboard reflects up-to-date pushup totals.
- Rep totals cannot go negative.
