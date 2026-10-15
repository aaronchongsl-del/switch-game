# Switch

A 90-second browser speed game that switches between maths, memory, logic, wordplay, spatial and code puzzles. Vanilla JS, no build step.

## Run locally
Open `index.html`, or `python3 -m http.server` and visit http://localhost:8000.

## Layout
- `index.html`, `css/` (`styles.css`, `juice.css`, `themes.css`), `js/` (`game.js`, `juice.js`, `questions.js`, `leaderboard.js`, `config.js`)
- `supabase/migrations/`: leaderboard table and the two RPC functions
- `tests/test-questions.js`: re-solves every generated question independently (`node tests/test-questions.js js/game.js`)
- `docs/`: effects spec and question-bank notes

## Online leaderboard
1. Apply `supabase/migrations/*_leaderboard.sql` to a Supabase project.
2. Put the project URL and publishable key in `js/config.js`. Without them the game uses a local, per-browser board.

The table has RLS on and no policies; the browser can only call `submit_score` and `leaderboard`. Scores get plausibility checks (score vs. correct answers, day window, 15 s rate limit). This stops casual tampering, not a determined cheater; replay verification is a later phase.

## Notes
Daily-run seeds depend on the generators, so changing a generator changes that day's run.
