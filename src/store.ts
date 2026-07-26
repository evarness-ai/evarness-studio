// One module-scoped store, no framework: screens read state and re-render
// themselves; `notify` fans out to whoever subscribed.

import type { BundleImport, GraphIR, LintIssue, NodeSpec, RunResult } from "./types";

export type Selection = { kind: "node"; id: string } | { kind: "edge"; index: number } | null;

export interface State {
  registry: NodeSpec[];
  specs: Map<string, NodeSpec>;
  groups: { order: string[]; titles: Record<string, string> };
  graph: GraphIR | null;
  patternId: string | null;
  fixtures: string[];
  fixture: string;
  selection: Selection;
  issues: LintIssue[];
  run: RunResult | null;
  bundle: BundleImport | null;
  bundleScenario: number;
}

export const state: State = {
  registry: [],
  specs: new Map(),
  groups: { order: [], titles: {} },
  graph: null,
  patternId: null,
  fixtures: [],
  fixture: "",
  selection: null,
  issues: [],
  run: null,
  bundle: null,
  bundleScenario: 0,
};

const listeners = new Set<() => void>();
export function subscribe(fn: () => void): void {
  listeners.add(fn);
}
export function notify(): void {
  listeners.forEach((fn) => fn());
}

const AUTOSAVE = "evarness-studio:graph";

export function openGraph(graph: GraphIR, patternId: string | null, fixtures: string[]): void {
  state.graph = graph;
  state.patternId = patternId;
  state.fixtures = fixtures;
  state.fixture = fixtures[0] ?? "";
  state.selection = null;
  state.issues = [];
  state.run = null;
  autosave();
  notify();
}

export function autosave(): void {
  if (!state.graph) return;
  localStorage.setItem(
    AUTOSAVE,
    JSON.stringify({ graph: state.graph, patternId: state.patternId, fixtures: state.fixtures }),
  );
}

export function restoreAutosave(): boolean {
  const raw = localStorage.getItem(AUTOSAVE);
  if (!raw) return false;
  try {
    const saved = JSON.parse(raw) as { graph: GraphIR; patternId: string | null; fixtures: string[] };
    state.graph = saved.graph;
    state.patternId = saved.patternId;
    state.fixtures = saved.fixtures ?? [];
    state.fixture = state.fixtures[0] ?? "";
    return true;
  } catch {
    return false;
  }
}
