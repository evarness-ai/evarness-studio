# Evarness Studio — scope & roadmap

Studio is the visual surface of Evarness, built deliberately lightweight:
vanilla TypeScript compiled with esbuild, **zero runtime dependencies** —
the same rule the engine's render artifacts live by. Its design language is
its own and consistent across every Evarness surface: group-color node dots,
the dim→glow→done state progression, and a canvas whose geometry matches the
render artifacts', so a graph looks the same in Studio, in a rendered HTML
artifact, and in the proof browser.

Data path: a stdlib-only Python server (`server.py`, `http.server`) over the
installed `evarness` library — patterns, node schemas, lint, execution, and
bundle import as small JSON endpoints. No FastAPI, no new Python deps.

## Parity table

| Screen (reference) | Studio v1 | Notes |
|---|---|---|
| **Builder** — palette, canvas, inspector, toolbar, lint bar | **YES — core of v1** | Canvas hand-rolled (seeded from the vanilla prototype): drag nodes, port-to-port edge drawing with a temp edge, **type-checked connections** (port types from node schemas; duplicate/self rejected with the same flash messages), select → inspector, Backspace deletes. Palette grouped by concern with icons + search, drag-to-add with config defaults. Inspector forms **auto-generated from the node registry's JSON Schemas** (string/number/bool/enum → inputs; lists/objects → JSON textarea). Toolbar: lint, fixture picker, user-input override, Run. Lint bar verbatim. |
| **RunView** — playhead replay | **YES** | The render artifacts already proved these mechanics dependency-free; Studio reuses them live: canvas states (idle-dim → active-glow → done-green, red block, incoming-edge flow), evidence pane with payload expanders, judgment pane with seek links, digest bar. |
| *(new)* **Bundle import** | **YES — the feature this exists for** | Open a `proof.json`: tri-state verdict badge, one replayable run per scenario, canvas drawn only when the pinned `graph_sha256` matches (the E13 rule, enforced server-side). This satisfies "the bundle can be imported into the UI". |
| **Library** — pattern cards | **YES (patterns only)** | Cards for packaged + `~/.evarness` patterns → open in Builder. Lab-only concepts deferred: harness persistence, lineages/versions, categories, run stats (Studio v1 keeps working graphs in localStorage + graph.json import/export — no server-side DB writes). |
| **Docs** | **NO — deliberately** | The docs site (E15) is the docs surface; an in-app copy would be a second source of truth. Studio links out. |
| **Experiments** — sweep matrix | **LATER** | Valuable, but sweeps are not yet an evarness-library surface; build when the library grows `experiments`, not before (refuse-don't-fake). |
| **Studio (publish wizard)** | **LATER** | Publishing targets `~/.evarness/patterns/`; needs the pattern-publish surface exposed library-side first. |
| **Catalog (tools/skills)** | **LATER** | `toolspec.py` exists library-side; palette integration is a clean follow-up. |
| **Generate / LogsView** | **NO / LATER** | Generation is lab-specific; the activity log viewer is trivial to add once wanted (`store.py` is already there). |

## Deliberate v1 boundaries (stated, not hidden)

- **No pan/zoom gestures** — the canvas scrolls; graphs at pattern scale fit.
  Zoom is the first polish item if real graphs outgrow it.
- **No undo stack** — mutations are cheap and localStorage autosaves; undo is
  polish, not architecture.
- **No websocket streaming** — evarness is sim-only today; runs finish in
  milliseconds, so run-then-replay covers everything until real providers
  graduate (the lab streams because it drives live models).
- **No save-to-server** — Studio edits graphs and exports `graph.json`; runs
  persist through the library's own activity log.
- **The server imports the agents domain directly** — Studio is presently the
  UI for the agents domain, so `server.py` uses its patterns and fixtures
  by name. When a second domain exists, discovery moves to public extension
  registries (a `/api/domains` shape); generalizing before that would be
  guessing the interface.

## Dependency policy

Runtime: **none**. Dev: `typescript` + `esbuild` only, pinned. The server
imports `evarness` and the standard library, nothing else. If a future screen
seems to need a package, the default answer is the same as E12's: it doesn't.
