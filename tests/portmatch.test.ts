import { test } from "node:test";
import assert from "node:assert/strict";

import { matchPort } from "../src/portmatch";

test("exact type picks the matching port among several", () => {
  const m = matchPort("documents", { prompt: "prompt", documents: "documents" });
  assert.equal(m.ok, true);
  assert.equal(m.inPort, "documents");
  assert.equal(m.inType, "documents");
});

test("any on either side connects", () => {
  assert.equal(matchPort("any", { in: "text" }).ok, true);
  assert.equal(matchPort("text", { in: "any" }).ok, true);
});

test("a hard mismatch refuses and reports the port it would have used", () => {
  const m = matchPort("text", { docs: "documents" });
  assert.equal(m.ok, false);
  assert.equal(m.inPort, "docs");
  assert.equal(m.inType, "documents");
  assert.equal(m.hint, "");
});

test("documents into an llm carries the context-assembler hint", () => {
  const m = matchPort("documents", { prompt: "prompt" }, "llm");
  assert.equal(m.ok, false);
  assert.match(m.hint, /Context Assembler/);
});

test("no declared inputs falls back to in/any and connects", () => {
  const m = matchPort("text", {});
  assert.equal(m.ok, true);
  assert.equal(m.inPort, "in");
  assert.equal(m.inType, "any");
});
