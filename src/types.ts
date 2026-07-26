// Graph IR mirrors evarness/core/graph.py — the single source of truth the
// studio edits. Field names match the JSON (aliases included: "from").

export interface IRNode {
  id: string;
  type: string;
  label?: string | null;
  config: Record<string, unknown>;
  position?: { x: number; y: number } | null;
}

export interface IREdge {
  from: string;
  to: string;
  from_port?: string;
  to_port?: string;
}

export interface GraphIR {
  ir_version?: number;
  id: string;
  name?: string;
  description?: string;
  nodes: IRNode[];
  edges: IREdge[];
  params?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface NodeSpec {
  type: string;
  label: string;
  icon: string;
  group: string;
  doc: string;
  inputs: Record<string, string>;
  outputs: Record<string, string>;
  config_defaults: Record<string, unknown>;
  schema: JsonSchema;
}

export interface JsonSchema {
  properties?: Record<string, JsonSchemaProp>;
  [k: string]: unknown;
}

export interface JsonSchemaProp {
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  anyOf?: JsonSchemaProp[];
  items?: JsonSchemaProp;
  title?: string;
  description?: string;
  [k: string]: unknown;
}

export interface LintIssue {
  level: "error" | "warning";
  code: string;
  message: string;
}

export interface RunResult {
  status: string;
  output: unknown;
  reason: string | null;
  pending: { node_id: string; prompt: string } | null;
  trace_digest: string;
  invariants: Verdicts | null;
  events: TraceEvent[];
}

export interface TraceEvent {
  seq: number;
  type: string;
  node_id: string | null;
  payload: Record<string, unknown>;
}

export interface Verdicts {
  passed: number;
  failed: number;
  results: { id: string; ok: boolean; detail: string; evidence_seq: number[] }[];
}

export interface BundleScenario {
  fixture: string;
  status: string;
  deterministic: boolean;
  trace_digest: string;
  reproduced: boolean | null;
  events_count: number;
  invariants: Verdicts | null;
  events?: TraceEvent[];
}

export interface BundleImport {
  badge: { text: string; cls: string };
  verdict: Record<string, unknown>;
  subject: Record<string, unknown>;
  not_proven: string[];
  signed: boolean;
  graph: GraphIR | null;
  note: string | null;
  scenarios: BundleScenario[];
}

export interface PatternInfo {
  id: string;
  name: string;
  source: string;
  fixtures: string[];
}

// concern-group accents — the platform palette
export const GROUP_COLORS: Record<string, string> = {
  core: "#7aa2f7",
  governance: "#f7768e",
  rag: "#9ece6a",
  tools: "#e0af68",
  context: "#bb9af7",
  memory: "#ad8ee6",
  observability: "#c0caf5",
};

export const NODE_W = 150;
export const NODE_H = 52;
