import type { BundleImport, GraphIR, LintIssue, NodeSpec, PatternInfo, RunResult } from "./types";

async function req<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body === undefined
    ? undefined
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `${res.status} ${path}`);
  return data as T;
}

export const api = {
  schemas: () =>
    req<{ registry: NodeSpec[]; groups: { order: string[]; titles: Record<string, string> } }>("/api/schemas"),
  patterns: () => req<{ patterns: PatternInfo[] }>("/api/patterns"),
  pattern: (id: string) => req<{ graph: GraphIR; fixtures: string[] }>(`/api/pattern/${id}`),
  validate: (graph: GraphIR) => req<{ issues: LintIssue[] }>("/api/validate", { graph }),
  run: (graph: GraphIR, opts: { pattern?: string; fixture?: string; input?: string }) =>
    req<RunResult>("/api/run", { graph, ...opts }),
  importBundle: (bundle: unknown) => req<BundleImport>("/api/import-bundle", { bundle }),
};
