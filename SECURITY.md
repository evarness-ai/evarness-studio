# Security

Studio is a **local development interface**: the server binds to
`127.0.0.1`, is unauthenticated by design, and must not be exposed beyond
localhost. In scope for reports:

- The bundle-import verification rules displaying a tampered bundle as
  trustworthy (claim/integrity/signature badges), or a canvas drawn from a
  graph whose hash does not match the bundle's pinned subject.
- The server reachable from, or induced to serve, anything beyond localhost.

Report via [GitHub Security Advisories](https://github.com/evarness-ai/evarness-studio/security/advisories/new).
Engine-side scope lives in
[evarness SECURITY](https://github.com/evarness-ai/evarness/blob/main/SECURITY.md).
