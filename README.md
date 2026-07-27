# Evarness Studio

**The visual UI of [Evarness](https://github.com/evarness-ai/evarness) —
vanilla TypeScript, zero runtime dependencies.**

Studio is an Evarness product: the interface to the `evarness` library, and
the surface where its future visual features land. It is **optional** — you
never need it to run, prove, or verify a pipeline; the CLI does all of that
headless. It is also a **local development interface**, not a hardened
multi-user web service: the server binds to `127.0.0.1` and should stay
there. Today it is
a pattern library, a drag-and-drop graph builder with type-checked
connections and schema-generated inspector forms, a replay view with the
playhead mechanics of the render artifacts (dim → glow → done, red block,
edge flow), and **proof-bundle import** — open a `proof.json` and browse its
verdict, scenarios, and replays. Every imported bundle is **re-verified the
same way `evarness verify` does it** (digests, event chains, counts, verdict
consistency, signature): the page shows the claim verdict, bundle integrity,
and signature as three independent badges, a tampered bundle is labeled
BUNDLE INVALID with its stored claim marked untrustworthy, and the canvas is
drawn only when the graph's hash matches the bundle's pinned subject.

No React, no canvas library, no state library: the compiled bundle is ~47KB
of plain JavaScript. The server is Python's standard library over the
installed `evarness` package — no web framework. Dark and light themes
(auto-follows the OS; a toggle overrides).

## Run it

```bash
npm install          # dev toolchain only: typescript + esbuild, pinned
npm run build        # -> dist/
npm run check        # tsc --noEmit
# in a venv where evarness is installed:
python3 server.py    # http://localhost:8787
```

## Scope

See [docs/SCOPE.md](docs/SCOPE.md) — the screen-by-screen parity plan
against the reference UI, including what v1 deliberately leaves out and why.
Studio grows with the product: features graduate here as the library ships
them (experiments, publishing, catalog are on the roadmap in SCOPE.md).
