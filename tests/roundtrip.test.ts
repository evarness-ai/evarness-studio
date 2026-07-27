import { test } from "node:test";
import assert from "node:assert/strict";

import { layoutMissing } from "../src/canvas";
import type { GraphIR } from "../src/types";

// The round-trip contract: Studio may add layout, never semantics. A graph
// that goes CLI → Studio → export must run identically.

function fixture(): GraphIR {
  return {
    ir_version: 1,
    id: "roundtrip-check",
    name: "Roundtrip check",
    description: "no positions authored",
    nodes: [
      { id: "n1", type: "input", config: {} },
      { id: "n2", type: "llm", config: { temperature: 0.2 } },
      { id: "n3", type: "interceptor", config: { chain: ["schema_validate"] } },
      { id: "n4", type: "output", config: {} },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3", from_port: "out", to_port: "in" },
      { from: "n3", to: "n4" },
    ],
    params: { seed: 42, invariants: ["no-model-call-after-block"] },
    metadata: { origin: "test" },
  };
}

function semantics(g: GraphIR): unknown {
  return { ...g, nodes: g.nodes.map(({ position: _position, ...rest }) => rest) };
}

test("layoutMissing adds positions and touches nothing else", () => {
  const ir = fixture();
  const before = structuredClone(ir);
  layoutMissing(ir);
  for (const n of ir.nodes) {
    assert.ok(n.position, `node ${n.id} got no position`);
  }
  assert.deepEqual(semantics(ir), semantics(before));
});

test("layout is deterministic: same graph, same positions", () => {
  const a = fixture();
  const b = fixture();
  layoutMissing(a);
  layoutMissing(b);
  assert.deepEqual(a, b);
});

test("authored positions win — layout never moves them", () => {
  const ir = fixture();
  ir.nodes[1].position = { x: 777, y: 111 };
  layoutMissing(ir);
  assert.deepEqual(ir.nodes[1].position, { x: 777, y: 111 });
});

test("serialize → parse round-trips the whole IR", () => {
  const ir = fixture();
  layoutMissing(ir);
  assert.deepEqual(JSON.parse(JSON.stringify(ir)), ir);
});
