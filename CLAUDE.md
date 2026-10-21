# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Beach Tennis double-elimination tournament app (React 18 + TypeScript + Vite, plain CSS, Vitest), backed by Firebase (Firestore, Storage, Auth). Live at https://bt-double-elimination.web.app. The UI text and test names are in Brazilian Portuguese; code and comments are in English.

## Commands

```bash
npm run dev                # Vite dev server (port 5173); talks to the REAL Firebase project
npm run build              # tsc -b (type-check) + vite build -> dist/
npm run preview            # serve dist/ (port 4173): production behavior, no StrictMode
npm test                   # vitest run (all tests)
npx vitest run src/bracket/generateBracket.test.ts       # one file
npx vitest run -t "queda dos perdedores"                 # tests whose name matches
npx tsc -b                 # type-check only (there is no linter)
```

There is no local emulator: dev, preview and production all read and write the same Firestore document, so anything created while testing is real data that visitors see.

## Deployment

A push to `main` triggers `.github/workflows/deploy.yml` (npm ci → npm test → npm run build → Firebase Hosting). That workflow deploys **Hosting only**. `firestore.rules` and `storage.rules` are not deployed by it; changes to them have to be published manually (Firebase Console, or `firebase deploy --only firestore:rules,storage` — the CLI isn't installed here).

## Architecture

### Data and sync (`src/App.tsx`, `src/storage/tournamentStorage.ts`)
- The whole app state is one `Tournament[]` stored in a single Firestore document, `app/tournaments` (field `list`). There are no per-tournament documents.
- `App.tsx` holds that array in state, live-subscribes with `onSnapshot`, and a save effect writes the **entire array** back on any local change.
- `isApplyingRemoteRef` stops the save effect from echoing a snapshot it just received back to Firestore (without it: infinite write loop).
- Nothing is saved until the first snapshot arrives (`syncReady`), so the empty initial state can't overwrite remote data.
- All mutations go through `updateTournament` / `updateCategory` in `App.tsx`. Handlers must compute bracket results eagerly (outside the `setState` updater) so a thrown error can be caught. React may run updaters during render, where a throw would crash the app (an `ErrorBoundary` wraps `<App/>` as a backstop).

### Auth and permissions
- Visitors use the app without signing in and get a read-only view. Admins sign in with Google (`src/auth/useAuth.ts`, `src/components/AdminBar.tsx`).
- `canEdit = isAdmin && !isLocked` in `App.tsx` gates every edit control and handler. A tournament with `status: 'completed'` ("Concluído") is locked even for admins until reopened.
- The UI gating is cosmetic; the real enforcement is the security rules.
- **The admin email list exists in three places that must stay in sync:** `src/auth/admins.ts`, `firestore.rules`, `storage.rules`.

### Bracket logic (`src/bracket/`)
Pure functions, no React. This is where the tests are.
- `generateDoubleElimination` builds every match for a category at draw time: upper bracket padded to a power of two with round-1 BYEs, lower bracket, grand final `GF` and reset `GF-RESET`. Each match is wired to the next through `nextMatchWinner` / `nextMatchLoser` slot refs.
  - Match ids look like `U-R{round}-M{n}`, `L-R{round}-M{n}`, `GF`, `GF-RESET`.
  - `matchNumber` (#1, #2…) is cosmetic display numbering in reading order.
- `reportResult` / `clearMatchResult` work on a cloned category, propagate winners and losers through those refs, and resolve BYEs along the way. Undo has to walk the same auto-resolving BYE chain that `placeTeam` follows.
- In `GF`, slot A is the upper-bracket champion. If slot B wins, `GF-RESET` is played.
- Lower-bracket wiring is tuned for fairness:
  - a better record never ends up in a worse position;
  - equal records are paired first;
  - possible rematches are avoided (`couldRematch`, `alignToAvoidRematches`, `chooseWhoPlays`);
  - there are no lower-bracket BYE cards — leftovers enter a later round directly, shown with the "direto" badge.
- **Semifinal-drop swap:** for the team counts in `SWAP_SEMIFINAL_DROPS`, the two semifinal losers' drop slots are deliberately swapped. The tests pin the resulting drops for every size from 8 to 20.
- Changing generation changes only brackets drawn afterwards. Saved brackets keep their wiring, and older saved data (e.g. legacy `byeSlot` matches) must keep working.
- After any change to generation, re-verify sizes 8–20 with tests and simulated playouts (many seeded random playouts through `reportResult`, counting repeated pairings). Total match count and bracket shape must not change.

### Rendering (`src/components/`)
- `BracketBoard` renders each bracket as flex columns of `MatchCard`s.
- `BracketConnectors` draws the arrows by **measuring the rendered DOM** (`data-match-id`, `getBoundingClientRect`, `ResizeObserver`), not by computing them from the layout. It must be a direct child of the `.bracket-columns` element, because it measures against its own SVG's parent.
  - It routes arrows that skip a column around the cards in that column.
  - It gives each target its own vertical lane so elbows don't overlap.
- Match cards are `<button>`s, disabled when not clickable. That's always the case for visitors, so the card text color is pinned in CSS so the browser's disabled styling doesn't grey it out.
- "📸 Compartilhar chaveamento" exports `.snapshot-capture` as a PNG via `html-to-image` (`src/utils/shareSnapshot.ts`). The exporter has constraints:
  - SVG colors must be plain attributes, not CSS classes;
  - arrowheads are drawn as paths, not `<marker>`s;
  - the captured node needs its own padding, which the width math adds back;
  - sponsor logos come from Firebase Storage and need the bucket's CORS policy to allow GET.
- Phone layout lives in a single `@media (max-width: 640px)` block at the end of `src/styles/global.css`.

## Verifying changes
- `npm run dev` runs under React StrictMode, which double-invokes effects and can hide first-mount bugs. A missing-arrows bug once appeared only in production. For anything involving mount, measurement or effect timing, verify with `npm run build && npm run preview`.
- `.claude/launch.json` defines the `dev` (5173) and `prod-preview` (4173) servers.
