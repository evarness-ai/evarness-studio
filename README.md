# Evarness Studio

**The visual UI of [Evarness](https://github.com/evarness-ai/evarness) — build, replay, verify.**

[![ci](https://github.com/evarness-ai/evarness-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/evarness-ai/evarness-studio/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/evarness-ai/evarness-studio)](LICENSE)
[![deps](https://img.shields.io/badge/runtime%20deps-zero-brightgreen)](package.json)

[Evarness](https://github.com/evarness-ai/evarness) ·
[Documentation](https://evarness-ai.github.io/evarness/) ·
[Discussions](https://github.com/evarness-ai/evarness/discussions)

> **New here?** [Evarness](https://github.com/evarness-ai/evarness) is a
> crash-test rig for AI agents: it runs an agent's **harness** — the layer of
> ordinary software that decides what the AI is actually allowed to do —
> through scripted scenarios and produces a proof anyone can verify on their
> own laptop, offline. Studio is the visual side of that: draw the harness as
> a diagram, run it, then replay the run like a match replay — pause on any
> moment and see exactly what happened and why. The animation below is
> exactly that, ending with a hostile run stopped before it ever reaches the
> model.

![A harness running in Studio: the governed email assistant opens from the pattern library, the run replays node by node — each turning green as it finishes, the trace streaming beside the canvas — then the hostile fixture is stopped at the interceptor, red, the model never reached, and the invariant verdict still passing](docs/assets/run-replay.gif)

Studio is the graphical side of Evarness: compose a harness on a canvas,
watch a run replay node by node, and open a proof bundle as a browsable
page. It is **optional by design** — the CLI does everything headless — and
it is a **local development tool**: the server binds to `127.0.0.1`, and
that's where it belongs.

## What's inside

- **Pattern library** — every packaged harness, one click from the canvas.
- **Graph builder** — drag-and-drop nodes, type-checked connections, and
  inspector forms generated straight from the engine's own schemas.
- **Replay** — runs animate over the canonical event trace: nodes dim until
  reached, glow while active, and a blocked run shows the model never lit.
- **Proof-bundle browser** — open a `proof.json` and Studio **re-verifies it
  the way `evarness verify` does**: claim verdict, bundle integrity, and
  signature shown as three independent badges. A tampered bundle is labeled
  BUNDLE INVALID, and the canvas is only ever drawn from a graph whose hash
  matches the bundle's pinned subject.

No React, no canvas library, no state library — vanilla TypeScript compiled
to ~47 KB of plain JavaScript, and a Python standard-library server over the
installed `evarness` package. **Zero runtime dependencies**, matching the
engine's own story.

## Run it

```bash
npm install && npm run build      # dev toolchain: typescript + esbuild, pinned
python3 server.py                 # in a venv where evarness is installed
# → http://localhost:8787
```

```bash
npm run check     # types
npm test          # TypeScript tests
npm run test:server   # server tests (needs evarness installed)
```

## Contributing

Studio grows with the product — the roadmap and the deliberate v1 boundaries
live in [docs/SCOPE.md](docs/SCOPE.md). Good ways in:

- **Use it and tell us** — friction in the builder, a confusing replay, an
  import that surprised you: [issues](https://github.com/evarness-ai/evarness-studio/issues)
  welcome, screenshots doubly so.
- **Pick a boundary** — pan/zoom, undo, keyboard navigation are all wanted
  and all deliberately unbuilt; each is a well-scoped first contribution.
- **Talk domains** — when Evarness grows its second domain, Studio learns to
  discover domains through the API. Ideas belong in
  [Discussions](https://github.com/evarness-ai/evarness/discussions).

One rule above all, inherited from the engine: **never display a claim as
established when the evidence hasn't been checked.** The bundle-import tests
are the contract — start there to understand the house style.

## License

[Apache-2.0](LICENSE).
