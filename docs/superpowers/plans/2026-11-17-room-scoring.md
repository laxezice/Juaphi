# Room Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** First to three round wins wins the room's match.

**Architecture:** A small CommonJS match state module supplies idempotent round accounting. The server owns it per room and exposes public scores in room snapshots. Existing start/win flows drive accounting; the client only displays results.

**Tech Stack:** Node.js, node:test, WebSocket, vanilla browser JavaScript and CSS.

**Spec:** docs/superpowers/specs/2026-11-17-room-scoring.md

## Global Constraints

- Target is always 3. No dependencies or changes to card rules.
- Preserve prior uncommitted background work. No deployment or commit requested.

## Review Focus

- Repeated broadcasts after a round must never award extra points.
- Reconnect and host transfer preserve player identity and scores.
- Mid-match arrivals start at zero; departed winners retain a readable result.
- Only the host may advance or reset, and never while a round is live.
- Mobile scores/results remain readable without covering interactive game areas.

### Task 1: Server-owned match accounting

**Files:** create game/match.js, test/match.test.js; modify server.js and test/multiplayer.test.js.

**Interfaces:** createMatch() -> {target, round, scores, winner, roundWinner}; beginRound(match, ids) -> mutation (reset only after match win); recordRoundWin(match, id) -> boolean indicating a newly recorded result. Public room.match excludes the internal guard.

- [x] Add unit tests for successive/alternating wins, duplicate results, reset, arrivals, departed participants and independent rooms. Run and observe missing-feature failures.
- [x] Implement the match module and integrate create/start/afterChange/snapshot flows.
- [x] Add WebSocket coverage for normal game completion, room updates, reconnect, late join, permissions, three wins and new match reset; run failing integration test then implement the integration.
- [x] Run unit and multiplayer tests, inspect results.

### Task 2: Scores and match results in the UI

**Files:** modify public/index.html, public/ui.js, public/style.css, public/board2d.js only if needed; document rules in README.md.

- [x] Add lobby rule text, compact game score control, menu standings, results scoreboard and match-specific copy/button labels.
- [x] Verify live rounds and result screens at desktop/mobile sizes with actual server snapshots, including a three-point champion and reset.
- [x] Run full tests and diff/syntax checks, then request one fresh-context final code review.

## Execution ledger

Ruling: Use existing checkout and execute inline; no commits/deployment, preserving prior artwork changes. The request specifies scoring sufficiently to implement without a design approval pause.

Pre-flight: All server snapshots include room.match; UI uses this shared interface and never calculates awarded wins itself.

Verification: Unit tests failed before game/match.js existed; WebSocket test failed because room.match was absent. Implemented accounting, then unit 5/5 and focused integration 2/2 passed. Full npm test: 145/145 passed. Syntax checks and git diff --check passed. Fresh read-only reviewer review_room_scoring found no actionable blockers.

Browser: Played five actual scored rounds with a bot on localhost:3131 at 390x844; results progressed to a 3-2 match finish. Refresh during the second result retained 1-1 scores. Verified lobby rule, zero-score rows, board scores and menu scores. Found and removed existing horizontal button margins causing result dialog overflow; after reloading, clientWidth and scrollWidth both measured 356px.

Final UI verification: captured the champion at 390x844 and 1280x800, then clicked the host's new-match control and observed round 1 with both participants at 0/3. Browser console errors: none. Screenshots saved outside the repo as juaphi-score-champion-mobile.jpg and juaphi-score-champion-desktop.jpg in the session visualizations folder. No fixture routes were added. Local preview server uses port 3131; no deployment performed.
