# Switch question bank expansion

Files in this folder:

- `switch-questions.js`: the drop-in module. 50 new puzzle variants, spread over the four existing categories plus two new ones (Spatial and Typing).
- `test-questions.js`: an independent answer checker. It re-solves every generated question by a different route and checks the shape the game needs.
- `README.md`: this file.

Written against the game version that has hints (3 per run), and tested with the real generators from that version.

## What is new

| Category | New variants | What they add |
|---|---|---|
| Maths | 13 | missing factor, double/half/triple, shop change, rounding, digit sum, squares and roots, remainders, fractions of a number, averages, elapsed minutes, "which product is biggest", negatives in the middle of a sum, order of operations |
| Memory | 8 | count one symbol in a flash, difference of two numbers, biggest/smallest, letters (and letters backwards), digit-letter pairs, the word that appeared twice, Nth word, running total |
| Logic | 8 | letter sequences, harder number sequences (shrinking steps, alternating operations), number grids ("every row follows the same rule"), input-output machines, yes/no/can't-tell reasoning, symbol equations, age chains, word odd-one-out |
| Words | 8 | Nth letter, alphabetical first/last, remove the vowels, palindrome, double letter, longest word, count a letter, find the anagram |
| Spatial (new) | 8 | compass turns, grid paths, arrow rotations, dice, mirrored clocks, painted blocks, count squares/rectangles in a grid, count routes across a grid |
| Typing (new) | 5 | speed typing: copy a word, a short phrase, a code of letters and digits, a long number, or a word twice with a space. The game's existing speed bonus already rewards fast answers, and a wrong key at the full length counts as a miss |

Existing questions keep the same visual style (same card, same big text, same sequence layout). All of the new ones are worked out, none rely on facts someone could look up.

## Plug-in checklist

### 1. Existing four categories (about 2 minutes)

Paste the module's contents into the game script, above the `GEN` definitions (or load it as a script), then right after the `GEN.word=...` block add:

```js
SwitchQuestions.install(GEN);          // optional: install(GEN,{mix:0.6})
```

`install` wraps `GEN.maths`, `GEN.memory`, `GEN.logic` and `GEN.word`. With `mix` 0.6 (default), 60 percent of questions in each category come from the new variants and 40 percent from the original generators, so a run feels the same but repeats far less. Set `mix` to 1 to use only new variants.

Every new question also carries `variant` (for example `"logic.matrix"`), handy for debugging and analytics.

### 2. The two new categories

`install` also adds `GEN.space` and `GEN.typing`. For the game to offer them:

1. In `TYPES` add `space` and `typing` from `SwitchQuestions.TYPES` (or copy the values: `{n:'Spatial',c:'var(--space)'}` and `{n:'Code',c:'var(--code)'}`, `{n:'Typing',c:'var(--typing)'}`).
2. `KEYS=['maths','memory','logic','word','space','typing']`.
3. Add the colours to the stylesheet: `document.head.insertAdjacentHTML('beforeend','<style>'+SwitchQuestions.CSS+'</style>')` or paste `SwitchQuestions.CSS` into the CSS block (it covers the Neon and Paper skins).
4. In `startRun`, `per:{...}` lists the four types by hand. Add `space` and `typing` entries, each `{ok:0,bad:0}`.
5. Layout: `.types` and `.ratings` use 4 columns. Change to `repeat(3,1fr)` (two rows of three, or three rows with Typing) or `repeat(7,1fr)` is too tight, so use 3 or 4 for the type chips, and the ratings to `repeat(3,1fr)` (the `max-width:420px` rule can stay at 2).
6. Badge `all` ("Right in every type", 2 per type) gets much harder with 6 types. Suggest keeping it at the original four types: `['maths','memory','logic','word'].every(...)`.
7. The Hearth "Game visual polish" layer picks a glyph per type for the switch curtain. Suggested glyphs: Spatial `↑ → ↓`, Typing `⌨ abc`.
8. Saved stats: `db.stats` is filled from `KEYS` on load, so new types appear automatically for existing players.

If you would rather ship the new categories later, skip step 2 and nothing changes: `GEN.space` and `GEN.code` are simply never drawn.

### 3. Things to know

- **Daily run:** changing the generators changes what a given daily seed produces. The first day after deploying, "today's" Daily run will be different from what people saw earlier in the day.
- **First-call cost:** the word odd-one-out bank is built in the background by `install` (about 60 ms, once). Nothing else precomputes.
- **No negative answers:** the numeric keyboard on phones has no minus key, so every new numeric answer is zero or more.
- **Choice questions have 3 or 4 options**, so the 50/50 hint works on all of them.
- **Hints:**
  - choice: 50/50 removes wrong options (works on every new choice question);
  - typed numbers and words: reveals the first character and the length (works on every typed question; for letter answers it says "letter");
  - sequences (`terms`): gaps are shown for number sequences, number sequences from `seqmix`, and for letter sequences (as alphabet positions, A=1);
  - flash questions: typed ones replay the flash. Choice-type flash questions (biggest, pairs, repeat, order) use the 50/50 hint instead, because the game checks for choices first.
- **Rules of thumb used throughout:** typed answers are lowercase letters or digits; coordinates and times are always choices (no punctuation to type).

## How answers were checked

`node test-questions.js path/to/game.html` runs everything below (set `N=1500` for the full run; the default is 1,500 samples per difficulty per variant).

1. **Independent solving.** Every variant has a second solver in `test-questions.js` that reads the visible question text and solves it a different way: simulation (turns, paths, arrows, step-by-step instructions), brute force (painted blocks, grids, routes, symbol equations), exhaustive model checking for the yes/no/can't-tell reasoning, interpolation for the input-output machines. The answer must match what the generator says.
2. **Ambiguity guards.**
   - Sequences: every common rule family (arithmetic, geometric, quadratic, Fibonacci-style, alternating operations, interleaved, powers) that fits the shown terms must predict the same next term.
   - Number grids: every simple rule (a×a + b, a×b + c, and weighted sums up to ±4) that fits the two complete rows must give the same answer in the third.
    - Odd word out: every feature people look for (length, double letters, first/last letter, starts/ends with a vowel, palindrome, alphabetical letters, vowel count, rare letters) is checked, and the set is only used if every feature that splits it 3-vs-1 picks the same word.
   - Input-output machines always show three examples, which fixes a straight-line or squared rule exactly.
3. **Typing:** the answer is exactly what is shown (lowercase, single spaces). The input autosubmits on the last correct character, so there is no Enter key.
4. **Shape rules the game needs.** Choice questions have 3-4 distinct options and the answer appears exactly once; typed answers are non-negative digits or lowercase letters; flash times are between 0.8 and 6 seconds; text lengths fit the card.

## Variety (how much repeats)

Most variants have hundreds or thousands of distinct questions. The smallest are intentionally narrow families, only drawn at certain difficulties: squares and roots (about 25), painted blocks (about 30), count squares in a grid (about 28), count routes (12), dice (about 54) and arrow rotations (about 130). In a 90-second run you only see about 20 to 30 questions in total, so a repeat from these is rare, and with `mix` 0.6 they are drawn even less.

## Problems found in the existing game generators (not changed)

These come from the current game code, not from the new module. They are reported so the owner thread can fix them:

1. **Negative answers in Maths.** The `expr` form (`a × b − c`, difficulty 2 to 8) can give negative results, for example `6 × 4 − 25 = -1`. Phones with a numeric keypad cannot type the minus sign. A fix: pick `c` less than `a × b`.
2. **Five-name logic questions have 5 choices.** At difficulty 6 and up, "who is in the middle / second tallest" shows 5 names. The game only has keys 1 to 4, and the hint button is disabled for them. A fix: show the four names that matter, or drop one name from the chain at that level.

## Pictures (`visual` field)

Spatial questions that have a picture carry `visual:{kind,...}` in the shapes from `design/SPEC.md` (Revision 6): `compass` (turns), `arrow` (rotations), `dice` (top face), `clock` (the real clock; the question asks for its mirror image), `cube` (block sizes), `grid` (routes, plus plain grids for the square and rectangle counts), (no cipher pictures any more). Path questions have no picture. The checker confirms each picture matches its question text.

## Changes on Aaron's request

- Code category removed. Typing stays as its own category.
- Words no longer has any alphabet-position questions (letter sums like I + N, "3 steps after M").
- Note: Logic still has letter sequences (A, C, E, G, _) and Words has "alphabetical first/last", which lean on knowing the alphabet order. Say if those should go too.
