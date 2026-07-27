# Contributing to Evarness Studio

Thank you — Studio grows with the product, and the deliberately-unbuilt v1
boundaries in [docs/SCOPE.md](docs/SCOPE.md) are well-scoped first
contributions (pan/zoom, undo, keyboard navigation each have an issue).

The workflow and design rules are the engine's:
[evarness CONTRIBUTING](https://github.com/evarness-ai/evarness/blob/main/CONTRIBUTING.md).
Two Studio-specific rules:

- **Never display a claim as established when the evidence hasn't been
  checked.** The bundle-import tests (`tests/test_server.py`) are the
  contract — read them first.
- **Zero runtime dependencies is a feature, not a starting point.** A new
  dev dependency needs a reason the existing two can't cover; a runtime
  dependency needs a discussion first.

Before opening a PR: `npm run check && npm test && npm run build`, and
`npm run test:server` if you touched the server.
