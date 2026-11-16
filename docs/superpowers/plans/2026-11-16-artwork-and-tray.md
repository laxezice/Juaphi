# Artwork and tray implementation plan

**Goal:** Integrate the existing cartoon art throughout the interface and fix desktop card-tray scrolling.

**Architecture:** Keep the plain HTML/CSS/ES module frontend. A small tray-scroll module owns wheel/navigation behavior; tray.js owns selection. Static brand assets and semantic HTML provide the visual refresh.

**Tech stack:** Existing Node test runner, browser ES modules, CSS, ImageGen and WebP/PNG assets.

**Spec:** ../specs/2026-11-16-artwork-and-tray-design.md

## Constraints and review focus

- No changes to game rules or production deployment.
- Preserve mouse-wheel zoom, native horizontal scrolling, touch gestures, selection and ordering.
- Check overflowing and non-overflowing rows, both ends of the row, reopening a tray, and keyboard selection.
- Check 390px mobile and 1280px desktop layouts, image loading, empty rooms and full lobbies.

## Tasks

- [x] Reproduce desktop scrolling in a temporary local browser fixture using the real tray module.
- [x] Add failing behavioral tests in test/tray-scroll.test.js, implement public/tray-scroll.js, and connect it to tray.js and the tray controls/styles.
- [x] Generate the transparent logo mark; save optimized public/brand assets and original art backup.
- [x] Update index.html, style.css, and ui.js for home, lobby, room/player artwork and game status illustrations. Version new module/assets with the existing server version mechanism.
- [x] Run npm test and browser checks; review the final diff and document any remaining limitations.

## Execution notes

- User selected the full visual scope in the clarification response; implementation proceeds in this chat.
- No new runtime dependency is needed. Temporary browser fixtures are removed before delivery.

## Verification record

- Baseline: 30-card tray, scrollWidth 5008px at 1280px width; a downward wheel gesture left scrollLeft at 0. After the fix it moved to 720px.
- Keyboard: End reaches scrollLeft 3824 (the row maximum), with the last card clear of the navigation controls. Selecting the final card returns key 29; selecting the first numeric key correctly returns 0 and displays its confirmation label.
- Reordering three cards via keyboard returned [2, 0, 1]. Non-overflowing trays hide their navigation controls and hint.
- In-game card catalogue wheel scrolling moved scrollTop from 0 to 669.
- Home and lobby checked at 1280×800 and 390×844, without horizontal overflow or broken images. Screenshots saved in the chat's visualization workspace.
- Fresh read-only review found three minor issues: touch hint wording, invite-recipient copy, and winner padding colliding with a board-seat class. All three were corrected.
- Final `npm test`: 139 passed, 0 failed. Loopback integration tests ran outside the network-restricted sandbox. Existing Node warnings about mixed CommonJS/browser ES modules remain unchanged.
- `git diff --check` and frontend syntax checks passed. No game-rule or backend changes, no deployment.
