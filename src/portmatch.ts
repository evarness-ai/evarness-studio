// Port-compatibility logic, extracted pure so it is testable headless — the
// canvas composes the flash messages; this decides.

export interface PortMatch {
  ok: boolean;
  inPort: string;
  inType: string;
  /** extra guidance appended to the mismatch message ("" when none) */
  hint: string;
}

/** Pick the target input port for an edge whose source port has type
 * `outType`: the first port whose type matches (either side `any` matches
 * everything), else the first declared port, else `in`/`any`. `ok` is false
 * only on a hard type mismatch. */
export function matchPort(
  outType: string,
  inputs: Record<string, string>,
  targetType?: string,
): PortMatch {
  const inPorts = Object.entries(inputs);
  const match =
    inPorts.find(([, t]) => t === "any" || outType === "any" || t === outType) ?? inPorts[0];
  const [inPort, inType] = match ?? ["in", "any"];
  const ok = !(outType !== "any" && inType !== "any" && outType !== inType);
  const hint =
    !ok && outType === "documents" && (inType === "prompt" || targetType === "llm")
      ? " — route documents into the Context Assembler (documents port); the LLM reads them from the prompt"
      : "";
  return { ok, inPort, inType, hint };
}
