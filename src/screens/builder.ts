// Builder: palette | canvas + toolbar + lint bar | inspector.

import { api } from "../api";
import { Canvas } from "../canvas";
import { renderInspector } from "../inspector";
import { renderPalette } from "../palette";
import { autosave, state } from "../store";
import type { GraphIR } from "../types";

let canvas: Canvas | null = null;

export function renderBuilder(host: HTMLElement, go: (screen: string) => void): void {
  if (!state.graph) {
    host.innerHTML = `<div class="screen-pad"><p class="dim">Open a pattern from the Library — or import a graph.json.</p><div style="margin-top:12px;display:flex;gap:8px"><button id="openlib">◧ Open the Library</button><button id="importg">Import graph.json</button></div></div>`;
    (host.querySelector("#openlib") as HTMLElement).addEventListener("click", () => go("library"));
    (host.querySelector("#importg") as HTMLElement).addEventListener("click", () => importGraph(go));
    return;
  }

  host.innerHTML = `
    <div class="builder">
      <aside class="palette" id="palette"></aside>
      <div class="canvas-col">
        <div class="toolbar" id="toolbar"></div>
        <div class="canvas" id="canvashost" tabindex="0"></div>
        <div class="lintbar" id="lintbar"><span class="ok">✓ No lint findings (lint to re-check)</span></div>
      </div>
      <aside class="inspector" id="inspector"></aside>
    </div>`;

  renderPalette(host.querySelector("#palette") as HTMLElement);
  const inspectorHost = host.querySelector("#inspector") as HTMLElement;
  const lintbar = host.querySelector("#lintbar") as HTMLElement;
  const toolbar = host.querySelector("#toolbar") as HTMLElement;
  const canvasHost = host.querySelector("#canvashost") as HTMLElement;

  const flash = (msg: string) => {
    const el = toolbar.querySelector(".flash") as HTMLElement;
    el.textContent = msg;
    setTimeout(() => {
      if (el.textContent === msg) el.textContent = "";
    }, 2600);
  };

  canvas = new Canvas(canvasHost, {
    onSelect(sel) {
      state.selection = sel;
      const node = sel?.kind === "node" ? state.graph!.nodes.find((n) => n.id === sel.id) ?? null : null;
      renderInspector(inspectorHost, node, node ? state.specs.get(node.type) : undefined, () => {
        autosave();
        canvas?.render();
      });
    },
    onGraphChange() {
      autosave();
    },
    onFlash: flash,
  });
  canvas.setGraph(state.graph, state.specs, true);
  renderInspector(inspectorHost, null, undefined, () => undefined);

  // toolbar
  toolbar.innerHTML = "";
  const lintBtn = button("Lint", async () => {
    try {
      const { issues } = await api.validate(state.graph as GraphIR);
      state.issues = issues;
      drawLint();
      flash(issues.length ? `${issues.length} finding(s)` : "✓ Clean");
    } catch (e) {
      flash(`✗ ${(e as Error).message}`);
    }
  });
  toolbar.appendChild(lintBtn);

  if (state.fixtures.length) {
    const sel = document.createElement("select");
    sel.title = "fixture";
    state.fixtures.forEach((f) => {
      const o = document.createElement("option");
      o.value = f;
      o.textContent = `fixture: ${f}`;
      if (f === state.fixture) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => (state.fixture = sel.value));
    toolbar.appendChild(sel);
  }
  const input = document.createElement("input");
  input.className = "runinput";
  input.placeholder = "ask your own question (overrides fixture input)…";
  toolbar.appendChild(input);

  const runBtn = button("▶ Run", async () => {
    runBtn.disabled = true;
    try {
      state.run = await api.run(state.graph as GraphIR, {
        pattern: state.patternId ?? undefined,
        fixture: state.fixture || undefined,
        input: input.value.trim() || undefined,
      });
      state.bundle = null;
      go("run");
    } catch (e) {
      flash(`✗ ${(e as Error).message}`);
    } finally {
      runBtn.disabled = false;
    }
  });
  runBtn.className = "primary";
  toolbar.appendChild(runBtn);

  toolbar.appendChild(button("Export graph.json", () => {
    const blob = new Blob([JSON.stringify(state.graph, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${state.graph?.id ?? "graph"}.json`;
    a.click();
  }));
  toolbar.appendChild(button("Import graph.json", () => importGraph(go)));
  const flashEl = document.createElement("span");
  flashEl.className = "flash";
  toolbar.appendChild(flashEl);

  const drawLint = () => {
    const errors = state.issues.filter((i) => i.level === "error");
    const warnings = state.issues.filter((i) => i.level === "warning");
    lintbar.innerHTML = "";
    if (!errors.length && !warnings.length) {
      lintbar.innerHTML = '<span class="ok">✓ No lint findings</span>';
      return;
    }
    for (const i of errors) lintbar.appendChild(span("err", `✗ [${i.code}] ${i.message}`));
    for (const i of warnings) lintbar.appendChild(span("warn", `⚠ [${i.code}] ${i.message}`));
  };
  drawLint();

  canvasHost.addEventListener("keydown", (e) => {
    if ((e.key === "Backspace" || e.key === "Delete") && state.selection) {
      e.preventDefault();
      canvas?.deleteSelection();
    }
  });
}

function importGraph(go: (screen: string) => void): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    const doc = JSON.parse(await file.text()) as GraphIR;
    const { openGraph } = await import("../store");
    openGraph(doc, null, []);
    go("builder");
  });
  input.click();
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function span(cls: string, text: string): HTMLSpanElement {
  const s = document.createElement("span");
  s.className = cls;
  s.textContent = text;
  return s;
}
