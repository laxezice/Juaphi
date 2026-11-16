# Room scoring: first to three wins

User request: keep scores in the room; the first player to win three rounds wins the match.

- Each existing game is one round. Its server-decided sole survivor gains one point, including wins caused by leaving/removing a player under the existing game rules.
- The room owns match state: target 3, round number, score by player ID, match winner, and an internal round-winner guard. Record a result once even if later room updates repeat the finished game state.
- Scores survive round restarts, socket disconnects, reconnects and host transfer while the room exists. New players start at zero. Former players retain historical scores/names for this match; an explicit leave/rejoin creates a new identity under existing rules.
- After somebody reaches three, freeze the result. Only the host can start a new match, via the existing start action; this resets the scoreboard and starts round one. Starting another round before a match is finished preserves scores.
- Display the first-to-three rule in the waiting lobby, compact round/own-score information during play, every room player's score in the game menu, and a full scoreboard on round/match results. Clearly distinguish round wins from match wins and label the next-round/new-match button accordingly.
- Keep current game rules, backgrounds and artwork. Scores share the existing in-memory room lifetime; server restart destroys rooms and scores as before.
