// The canvas: hand-rolled SVG, no framework. Seeded from the lab's vanilla
// prototype (drag, port-to-port edge drawing with a temp edge, selection) and
// the render artifacts' deterministic geometry (layered layout, same-row arc,
// arrowheads) and playhead states (idle-dim → active-glow → done, red block,
// incoming-edge flow).

import type { GraphIR, NodeSpec } from "./types";
import { GROUP_COLORS, NODE_H, NODE_W } from "./types";

const SVG_NS = "http://www.w3.org/2000/svg";
const GAP_X = 200;
const GAP_Y = 84;
const MARGIN = 30;

export type Selection = { kind: "node"; id: string } | { kind: "edge"; index: number } | null;

export interface CanvasHooks {
  onSelect(sel: Selection): void;
  onGraphChange(): void;
  onFlash(msg: string): void;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Deterministic layered fallback for nodes without authored positions —
 * the same longest-path layering the render artifacts use. */
export function layoutMissing(ir: GraphIR): void {
  const layer = new Map<string, number>();
  const ids = ir.nodes.map((n) => n.id);
  const incoming = (id: string) => ir.edges.filter((e) => e.to === id).map((e) => e.from);
  // Kahn-ish longest path in id-sorted stable order
  const pending = [...ids].sort();
  let guard = pending.length * pending.length + 1;
  while (pending.length && guard-- > 0) {
    const id = pending.shift()!;
    const preds = incoming(id);
    if (preds.some((p) => ids.includes(p) && !layer.has(p))) {
      pending.push(id);
      continue;
    }
    layer.set(id, Math.max(-1, ...preds.filter((p) => layer.has(p)).map((p) => layer.get(p)!)) + 1);
  }
  const rows = new Map<number, string[]>();
  for (const id of [...layer.keys()].sort()) {
    const lx = layer.get(id)!;
    rows.set(lx, [...(rows.get(lx) ?? []), id]);
  }
  for (const [lx, rowIds] of rows) {
    rowIds.forEach((id, iy) => {
      const node = ir.nodes.find((n) => n.id === id)!;
      if (!node.position) node.position = { x: MARGIN + lx * GAP_X, y: MARGIN + iy * GAP_Y };
    });
  }
}

function edgeD(a: { x: number; y: number }, b: { x: number; y: number }): string {
  if (a.y === b.y && b.x - a.x > NODE_W + 60) {
    return `M ${a.x + NODE_W / 2} ${a.y} Q ${(a.x + b.x + NODE_W) / 2} ${a.y - 46} ${b.x + NODE_W / 2} ${b.y}`;
  }
  if (Math.abs(a.x - b.x) < 20) return `M ${a.x + NODE_W / 2} ${a.y + NODE_H} L ${b.x + NODE_W / 2} ${b.y}`;
  if (b.x > a.x) return `M ${a.x + NODE_W} ${a.y + NODE_H / 2} L ${b.x} ${b.y + NODE_H / 2}`;
  return `M ${a.x} ${a.y + NODE_H / 2} L ${b.x + NODE_W} ${b.y + NODE_H / 2}`;
}

export class Canvas {
  private svg: SVGSVGElement;
  private ir: GraphIR | null = null;
  private specs: Map<string, NodeSpec> = new Map();
  private editable = false;
  private selection: Selection = null;
  private states: Record<string, string> = {};
  private flowInto: Set<string> = new Set();

  constructor(host: HTMLElement, private hooks: CanvasHooks) {
    this.svg = document.createElementNS(SVG_NS, "svg");
    this.svg.setAttribute("class", "gcanvas");
    host.appendChild(this.svg);
    host.addEventListener("dragover", (e) => e.preventDefault());
    host.addEventListener("drop", (e) => this.onDrop(e));
  }

  setGraph(ir: GraphIR | null, specs: Map<string, NodeSpec>, editable: boolean): void {
    this.ir = ir;
    this.specs = specs;
    this.editable = editable;
    this.selection = null;
    this.states = {};
    this.flowInto = new Set();
    if (ir) layoutMissing(ir);
    this.render();
  }

  /** Playhead: node id -> idle|active|done|bad|paused; flowInto = nodes whose
   * incoming edges light up. */
  setStates(states: Record<string, string>, flowInto: Set<string>): void {
    this.states = states;
    this.flowInto = flowInto;
    if (!this.ir) return;
    for (const g of this.svg.querySelectorAll<SVGGElement>("[data-node]")) {
      const id = g.dataset.node!;
      g.setAttribute("class", `gnode ${this.states[id] ?? "idle"}${this.isSel("node", id) ? " sel" : ""}`);
    }
    for (const p of this.svg.querySelectorAll<SVGPathElement>("path[data-eto]")) {
      const into = this.flowInto.has(p.dataset.eto!);
      p.setAttribute("class", `edge${into ? " flow" : ""}`);
    }
  }

  clearStates(): void {
    this.setStates({}, new Set());
  }

  select(sel: Selection): void {
    this.selection = sel;
    this.render();
    this.hooks.onSelect(sel);
  }

  deleteSelection(): void {
    if (!this.ir || !this.selection || !this.editable) return;
    if (this.selection.kind === "node") {
      const id = this.selection.id;
      this.ir.nodes = this.ir.nodes.filter((n) => n.id !== id);
      this.ir.edges = this.ir.edges.filter((e) => e.from !== id && e.to !== id);
      this.hooks.onFlash(`− removed ${id}`);
    } else {
      this.ir.edges.splice(this.selection.index, 1);
      this.hooks.onFlash("− edge removed");
    }
    this.selection = null;
    this.render();
    this.hooks.onSelect(null);
    this.hooks.onGraphChange();
  }

  addNode(type: string, clientX: number, clientY: number): void {
    if (!this.ir) return;
    const spec = this.specs.get(type);
    if (!spec) return;
    const pt = this.toSvg(clientX, clientY);
    const id = this.freshId();
    this.ir.nodes.push({
      id,
      type,
      label: spec.label,
      config: JSON.parse(JSON.stringify(spec.config_defaults)),
      position: { x: Math.max(0, pt.x - NODE_W / 2), y: Math.max(0, pt.y - NODE_H / 2) },
    });
    this.render();
    this.select({ kind: "node", id });
    this.hooks.onFlash(`+ ${spec.label} added — wire its ports to include it in the flow`);
    this.hooks.onGraphChange();
  }

  private freshId(): string {
    const used = new Set(this.ir!.nodes.map((n) => n.id));
    let i = this.ir!.nodes.length + 1;
    while (used.has(`n${i}`)) i++;
    return `n${i}`;
  }

  private isSel(kind: "node" | "edge", key: string | number): boolean {
    if (!this.selection) return false;
    if (this.selection.kind === "node" && kind === "node") return this.selection.id === key;
    if (this.selection.kind === "edge" && kind === "edge") return this.selection.index === key;
    return false;
  }

  private pos(id: string): { x: number; y: number } {
    const n = this.ir!.nodes.find((x) => x.id === id)!;
    return { x: n.position?.x ?? 0, y: n.position?.y ?? 0 };
  }

  private toSvg(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.svg.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }

  render(): void {
    if (!this.ir) {
      this.svg.innerHTML = "";
      return;
    }
    const ir = this.ir;
    const w = Math.max(900, ...ir.nodes.map((n) => (n.position?.x ?? 0) + NODE_W + MARGIN));
    const h = Math.max(420, ...ir.nodes.map((n) => (n.position?.y ?? 0) + NODE_H + MARGIN + 40));
    this.svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    this.svg.setAttribute("width", String(w));
    this.svg.setAttribute("height", String(h));

    const parts: string[] = [
      `<defs><marker id="sarr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" class="arrow"/></marker></defs>`,
    ];
    ir.edges.forEach((e, i) => {
      const known = ir.nodes.some((n) => n.id === e.from) && ir.nodes.some((n) => n.id === e.to);
      if (!known) return;
      const d = edgeD(this.pos(e.from), this.pos(e.to));
      const sel = this.isSel("edge", i) ? " sel" : "";
      const flow = this.flowInto.has(e.to) ? " flow" : "";
      parts.push(
        `<path class="edge${sel}${flow}" data-edge="${i}" data-eto="${esc(e.to)}" d="${d}" marker-end="url(#sarr)"/>`,
      );
      const fp = e.from_port ?? "out";
      const tp = e.to_port ?? "in";
      if (fp !== "out" || tp !== "in") {
        const a = this.pos(e.from);
        const b = this.pos(e.to);
        parts.push(
          `<text class="portlbl" x="${(a.x + b.x + NODE_W) / 2}" y="${(a.y + b.y + NODE_H) / 2 - 8}">${esc(fp)}→${esc(tp)}</text>`,
        );
      }
    });
    for (const n of ir.nodes) {
      const spec = this.specs.get(n.type);
      const color = GROUP_COLORS[spec?.group ?? "core"] ?? GROUP_COLORS.core;
      const label = (n.label || spec?.label || n.type).slice(0, 20);
      const st = this.states[n.id] ?? "idle";
      const sel = this.isSel("node", n.id) ? " sel" : "";
      const p = n.position ?? { x: 0, y: 0 };
      const ports = this.editable
        ? `${spec && Object.keys(spec.inputs).length ? `<circle class="port" data-port="in" data-node-id="${esc(n.id)}" cx="0" cy="${NODE_H / 2}" r="6"><title>input port</title></circle>` : ""}${
            spec && Object.keys(spec.outputs).length
              ? `<circle class="port" data-port="out" data-node-id="${esc(n.id)}" cx="${NODE_W}" cy="${NODE_H / 2}" r="6"><title>output port — drag to another node's input port</title></circle>`
              : ""
          }`
        : "";
      parts.push(
        `<g class="gnode ${st}${sel}" data-node="${esc(n.id)}" transform="translate(${p.x},${p.y})">` +
          `<rect width="${NODE_W}" height="${NODE_H}" rx="9"/>` +
          `<circle cx="14" cy="${NODE_H / 2}" r="4.5" fill="${color}" pointer-events="none"/>` +
          `<text class="nid" x="${NODE_W - 6}" y="12" text-anchor="end" pointer-events="none">${esc(n.id)}</text>` +
          `<text class="lbl" x="27" y="22" pointer-events="none">${esc(label)}</text>` +
          `<text class="typ" x="27" y="38" pointer-events="none">${esc(n.type)}</text>` +
          ports +
          `</g>`,
      );
    }
    this.svg.innerHTML = parts.join("");
    this.wire();
  }

  private wire(): void {
    for (const g of this.svg.querySelectorAll<SVGGElement>("[data-node]")) {
      g.addEventListener("mousedown", (e) => this.onNodeDown(e, g));
      g.addEventListener("click", (e) => {
        e.stopPropagation();
        this.select({ kind: "node", id: g.dataset.node! });
      });
    }
    for (const p of this.svg.querySelectorAll<SVGPathElement>("[data-edge]")) {
      p.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this.editable) this.select({ kind: "edge", index: Number(p.dataset.edge) });
      });
    }
    for (const c of this.svg.querySelectorAll<SVGCircleElement>('[data-port="out"]')) {
      c.addEventListener("mousedown", (e) => this.onPortDown(e, c.dataset.nodeId!));
    }
    this.svg.addEventListener("click", () => this.select(null), { once: true });
  }

  private onNodeDown(e: MouseEvent, g: SVGGElement): void {
    if (!this.editable || !this.ir) return;
    if ((e.target as Element).classList.contains("port")) return;
    e.preventDefault();
    const id = g.dataset.node!;
    const node = this.ir.nodes.find((n) => n.id === id)!;
    const start = this.toSvg(e.clientX, e.clientY);
    const orig = { x: node.position?.x ?? 0, y: node.position?.y ?? 0 };
    let moved = false;
    const move = (ev: MouseEvent) => {
      const pt = this.toSvg(ev.clientX, ev.clientY);
      const nx = Math.max(0, orig.x + pt.x - start.x);
      const ny = Math.max(0, orig.y + pt.y - start.y);
      if (!moved && Math.abs(nx - orig.x) + Math.abs(ny - orig.y) < 3) return;
      moved = true;
      node.position = { x: nx, y: ny };
      g.setAttribute("transform", `translate(${nx},${ny})`);
      // live-update connected edges without a full re-render
      this.ir!.edges.forEach((ed, i) => {
        if (ed.from !== id && ed.to !== id) return;
        const path = this.svg.querySelector<SVGPathElement>(`[data-edge="${i}"]`);
        path?.setAttribute("d", edgeD(this.pos(ed.from), this.pos(ed.to)));
      });
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      if (moved) {
        this.render();
        this.hooks.onGraphChange();
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  private onPortDown(e: MouseEvent, fromId: string): void {
    if (!this.editable || !this.ir) return;
    e.preventDefault();
    e.stopPropagation();
    const a = this.pos(fromId);
    const temp = document.createElementNS(SVG_NS, "path");
    temp.setAttribute("class", "edge temp");
    this.svg.appendChild(temp);
    const move = (ev: MouseEvent) => {
      const pt = this.toSvg(ev.clientX, ev.clientY);
      temp.setAttribute(
        "d",
        `M ${a.x + NODE_W} ${a.y + NODE_H / 2} L ${pt.x} ${pt.y}`,
      );
    };
    const up = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      temp.remove();
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const inPort = el instanceof Element && el.getAttribute("data-port") === "in";
      const toId = inPort ? (el as SVGCircleElement).dataset.nodeId : undefined;
      if (toId) this.connect(fromId, toId);
      else this.hooks.onFlash("⚠ Drop on the input port (left dot) — the node body doesn't accept edges");
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  private connect(fromId: string, toId: string): void {
    const ir = this.ir!;
    const src = ir.nodes.find((n) => n.id === fromId);
    const tgt = ir.nodes.find((n) => n.id === toId);
    const srcSpec = this.specs.get(src?.type ?? "");
    const tgtSpec = this.specs.get(tgt?.type ?? "");
    const outType = srcSpec?.outputs["out"] ?? "any";
    // pick the first input port whose type matches, else the first port
    const inPorts = Object.entries(tgtSpec?.inputs ?? { in: "any" });
    const match = inPorts.find(([, t]) => t === "any" || outType === "any" || t === outType) ?? inPorts[0];
    const [inPort, inType] = match ?? ["in", "any"];
    if (outType !== "any" && inType !== "any" && outType !== inType) {
      const hint =
        outType === "documents" && (inType === "prompt" || tgt?.type === "llm")
          ? " — route documents into the Context Assembler (documents port); the LLM reads them from the prompt"
          : "";
      this.hooks.onFlash(`✗ Type mismatch: ${src?.type}.out (${outType}) → ${tgt?.type}.${inPort} (${inType})${hint}`);
      return;
    }
    if (fromId === toId || ir.edges.some((e) => e.from === fromId && e.to === toId && (e.to_port ?? "in") === inPort)) {
      this.hooks.onFlash("✗ Duplicate or self-connection");
      return;
    }
    ir.edges.push({ from: fromId, to: toId, from_port: "out", to_port: inPort });
    this.render();
    this.hooks.onFlash(`✓ Connected (${outType} → ${inType})`);
    this.hooks.onGraphChange();
  }

  private onDrop(e: DragEvent): void {
    e.preventDefault();
    const type = e.dataTransfer?.getData("application/evarness-node");
    if (type && this.editable) this.addNode(type, e.clientX, e.clientY);
  }
}
