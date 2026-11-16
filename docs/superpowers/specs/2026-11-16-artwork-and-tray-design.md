# Artwork and desktop card selection

The existing dark indigo, gold, and Thai ghost cartoon style stays the visual foundation. The user selected an update covering the logo, home page, waiting room, and status illustrations.

- Create one transparent ghost-and-card brand mark matching the existing artwork. Keep the Thai name as accessible HTML text; reuse the mark for the favicon and small identity treatments.
- Give the home page an illustrated introduction and clear join/create form; show useful artwork in the room list and empty state.
- Add the same identity to the lobby, illustrated player avatars and room options, and a compact end-of-game illustration. Keep mobile controls reachable and respect reduced motion.
- Fix the horizontal card-choice tray on desktop: vertical mouse-wheel movement scrolls cards, horizontal trackpad movement remains native, visible scroll controls and keyboard access work, and each new tray starts at the beginning.
- Preserve game rules, network behavior, card artwork, existing actions, and sound. Work locally; deployment is outside this request.

Verification: regression tests for wheel input and scroll controls, existing full Node test suite, actual browser checks of overflow, selection/order, home/lobby, and narrow screens.
