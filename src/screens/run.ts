// RunView: replay a run (or an imported proof bundle's scenarios) with the
// playhead mechanics the render artifacts established — dim → glow → done,
// red block, incoming-edge flow. Evidence and judgment stay separate panes.

import { api } from "../api";
import { Canvas } from "../canvas";
import { state } from "../store";
import type { BundleScenario, RunResult, TraceEvent, Verdicts } from "../types";

const FAIL = new Set(["policy_violation", "engine_error", "run_failed"]);

export function renderRun(host: HTMLElement, go: (screen: string) => void): void {
  host.innerHTML = `
    <div class="screen-pad runview">
      <div class="runhead" id="runhead"></div>
      <div id="bundlebar"></div>
      <div class="viewer">
        <div class="panel canvas" id="runcanvas"><div class="controls" id="controls"></div></div>
        <div class="side">
          <div class="panel"><h2>Evidence — canonical events</h2><div id="evidence"></div></div>
          <div class="panel"><h2>Judgment — invariant verdicts</h2><div id="judgment"></div></div>
        </div>
      </div>
    </div>`;

  const head = host.querySelector("#runhead") as HTMLElement;
  const bundlebar = host.querySelector("#bundlebar") as HTMLElement;

  if (!state.run && !state.bundle) {
    head.innerHTML = `<p class="dim">No run yet — run a graph from the Builder, or import a proof bundle.</p>`;
    const btn = document.createElement("button");
    btn.textContent = "Import proof.json";
    btn.className = "primary";
    btn.addEventListener("click", () => importBundle(host, go));
    head.appendChild(btn);
    const back = document.createElement("button");
    back.textContent = "◧ Library";
    back.style.marginLeft = "8px";
    back.addEventListener("click", () => go("library"));
    head.appendChild(back);
    return;
  }

  if (state.bundle) {
    renderBundleBar(bundlebar, host, go);
    const sc = state.bundle.scenarios[state.bundleScenario];
    if (sc) {
      mountReplay(host, {
        title: `${sc.fixture}`,
        status: sc.status,
        digest: sc.trace_digest,
        reason: null,
        output: null,
        events: sc.events ?? null,
        eventsCount: sc.events_count,
        verdicts: sc.invariants,
        graph: state.bundle.graph,
        declared: (state.bundle.subject["invariants_declared"] as string[]) ?? [],
        reproduced: sc.reproduced,
      });
    }
    return;
  }

  const run = state.run as RunResult;
  const declared = ((state.graph?.params?.["invariants"] as string[] | undefined) ?? []).slice();
  head.appendChild(headerFor(run.status, state.graph?.name || state.graph?.id || "run", run.reason));
  const importBtn = document.createElement("button");
  importBtn.textContent = "Import proof.json";
  importBtn.style.marginLeft = "auto";
  importBtn.addEventListener("click", () => importBundle(host, go));
  head.appendChild(importBtn);
  mountReplay(host, {
    title: state.graph?.name || "run",
    status: run.status,
    digest: run.trace_digest,
    reason: run.reason,
    output: run.output,
    events: run.events,
    eventsCount: run.events.length,
    verdicts: run.invariants,
    graph: state.graph,
    declared,
    reproduced: null,
  });
}

interface ReplayModel {
  title: string;
  status: string;
  digest: string;
  reason: string | null;
  output: unknown;
  events: TraceEvent[] | null;
  eventsCount: number;
  verdicts: Verdicts | null;
  graph: typeof state.graph;
  declared: string[];
  reproduced: boolean | null;
}

const STATUS_CLS: Record<string, string> = {
  completed: "holds",
  blocked: "failed",
  failed: "failed",
  paused: "pending",
};

function headerFor(status: string, title: string, reason: string | null): HTMLElement {
  const div = document.createElement("div");
  div.className = "masthead";
  const badge = `<span class="badge ${STATUS_CLS[status] ?? "static"}">${status.toUpperCase()}</span>`;
  const reasonHtml = reason ? ` · <span class="err"></span>` : "";
  div.innerHTML = `<div class="title">${badge}<div><h1></h1><div class="subtitle">${reasonHtml}</div></div></div>`;
  (div.querySelector("h1") as HTMLElement).textContent = title;
  if (reason) (div.querySelector(".err") as HTMLElement).textContent = reason;
  return div;
}

function mountReplay(host: HTMLElement, model: ReplayModel): void {
  const canvasHost = host.querySelector("#runcanvas") as HTMLElement;
  const controls = host.querySelector("#controls") as HTMLElement;
  const evidence = host.querySelector("#evidence") as HTMLElement;
  const judgment = host.querySelector("#judgment") as HTMLElement;

  // digest strip
  const digestbar = document.createElement("div");
  digestbar.className = "digestbar";
  digestbar.innerHTML = `<span class="stat-l">digest</span><code></code>`;
  (digestbar.querySelector("code") as HTMLElement).textContent = model.digest;
  if (model.reproduced !== null) {
    const r = document.createElement("span");
    r.className = model.reproduced ? "ok small" : "err small";
    r.textContent = model.reproduced ? "✓ digest reproduced" : "✗ DID NOT REPRODUCE";
    digestbar.appendChild(r);
  }
  (host.querySelector("#runhead") as HTMLElement).appendChild(digestbar);

  // judgment pane
  judgment.innerHTML = "";
  if (model.verdicts) {
    const v = model.verdicts;
    const sum = document.createElement("p");
    sum.className = "summary";
    sum.textContent = v.failed ? `${v.passed} passed, ${v.failed} failed` : `${v.passed} passed`;
    judgment.appendChild(sum);
    for (const r of v.results) {
      const row = document.createElement("div");
      row.className = `verdict ${r.ok ? "ok" : "fail"}`;
      row.innerHTML = `<span class="mark">${r.ok ? "✓" : "✗"}</span> <span class="vid"></span>`;
      (row.querySelector(".vid") as HTMLElement).textContent = r.ok ? r.id : `${r.id} — ${r.detail}`;
      if (!r.ok) {
        for (const s of r.evidence_seq) {
          const b = document.createElement("button");
          b.className = "seek";
          b.textContent = `seq ${s}`;
          b.addEventListener("click", () => seekTo(s));
          row.appendChild(b);
        }
      }
      judgment.appendChild(row);
    }
  } else if (model.status === "paused" && model.declared.length) {
    judgment.innerHTML = `<p class="pending">Declared but NOT evaluated (${model.declared.join(", ")}) — the run paused before judgment; nothing here claims these hold.</p>`;
  } else if (!model.declared.length) {
    judgment.innerHTML = `<p class="pending">No invariants declared — nothing was asserted, and nothing should be read as passing.</p>`;
  }

  // canvas
  const canvas = new Canvas(canvasHost, {
    onSelect() {
      /* read-only */
    },
    onGraphChange() {
      /* read-only */
    },
    onFlash() {
      /* read-only */
    },
  });
  if (model.graph) canvas.setGraph(JSON.parse(JSON.stringify(model.graph)), state.specs, false);
  else {
    const note = document.createElement("p");
    note.className = "quiet dim";
    note.textContent = "Canvas omitted: no graph matching the bundle's pinned hash is available locally.";
    canvasHost.insertBefore(note, controls);
  }
  canvasHost.appendChild(controls); // keep controls under the svg

  // evidence + playhead
  evidence.innerHTML = "";
  controls.innerHTML = "";
  if (!model.events) {
    evidence.innerHTML = `<p class="quiet dim">Canonical events were omitted from this bundle (--no-events); ${model.eventsCount} events are named by the digest but not replayable here.</p>`;
    return;
  }
  const events = model.events;
  const rows: HTMLElement[] = events.map((ev) => {
    const row = document.createElement("div");
    row.className = FAIL.has(ev.type) ? "ev bad" : "ev";
    row.dataset.seq = String(ev.seq);
    row.innerHTML = `<span class="seq">${ev.seq}</span> <span class="type"></span> <span class="nid"></span>`;
    (row.querySelector(".type") as HTMLElement).textContent = ev.type;
    (row.querySelector(".nid") as HTMLElement).textContent = ev.node_id ?? "";
    if (Object.keys(ev.payload ?? {}).length) {
      const det = document.createElement("details");
      det.innerHTML = "<summary>payload</summary>";
      const pre = document.createElement("pre");
      pre.textContent = JSON.stringify(ev.payload);
      det.appendChild(pre);
      row.appendChild(det);
    }
    evidence.appendChild(row);
    return row;
  });

  let timer: number | null = null;
  let idx = events.length - 1;
  const label = document.createElement("span");
  label.dataset.phlabel = "";

  const apply = (i: number, scroll = true) => {
    idx = i;
    const states: Record<string, string> = {};
    const flowInto = new Set<string>();
    rows.forEach((row, k) => {
      row.classList.toggle("current", k === i);
      row.classList.toggle("future", k > i);
    });
    for (let k = 0; k <= i; k++) {
      const ev = events[k];
      const id = ev.node_id;
      if (!id) continue;
      if (ev.type === "node_started") states[id] = "active";
      else if (ev.type === "node_finished") states[id] = "done";
      else if (ev.type === "policy_violation" || ev.type === "engine_error") states[id] = "bad";
      else if (ev.type === "run_paused") states[id] = "paused";
    }
    for (const [id, st] of Object.entries(states)) if (st === "active") flowInto.add(id);
    canvas.setStates(states, flowInto);
    slider.value = String(i);
    label.textContent = i >= 0 ? `seq ${events[i].seq} · ${events[i].type}` : "start";
    if (i >= 0 && scroll) rows[i].scrollIntoView({ block: "nearest" });
  };
  const stop = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
  const step = (d: number) => apply(Math.max(-1, Math.min(events.length - 1, idx + d)));

  const btn = (glyph: string, title: string, fn: () => void) => {
    const b = document.createElement("button");
    b.textContent = glyph;
    b.title = title;
    b.setAttribute("aria-label", title);
    b.addEventListener("click", fn);
    controls.appendChild(b);
  };
  btn("⏮", "First event", () => {
    stop();
    apply(-1);
  });
  btn("◀", "Previous event", () => {
    stop();
    step(-1);
  });
  btn("▶", "Play / Pause", () => {
    if (timer !== null) {
      stop();
      return;
    }
    if (idx >= events.length - 1) apply(-1);
    timer = window.setInterval(() => {
      if (idx >= events.length - 1) stop();
      else step(1);
    }, 600);
  });
  btn("▶▎", "Next event", () => {
    stop();
    step(1);
  });
  btn("⏭", "Last event", () => {
    stop();
    apply(events.length - 1);
  });
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "-1";
  slider.max = String(events.length - 1);
  slider.step = "1";
  slider.setAttribute("aria-label", "Playhead");
  slider.addEventListener("input", () => {
    stop();
    apply(Number(slider.value));
  });
  controls.appendChild(slider);
  controls.appendChild(label);

  // judgment seek buttons were created before the playhead existed; wire the
  // module-level dispatcher now that apply() is live
  seek = (seq: number) => {
    stop();
    const i = events.findIndex((e) => e.seq === seq);
    if (i >= 0) apply(i);
  };

  apply(events.length - 1, false);
}

let seek: (s: number) => void = () => undefined;
function seekTo(s: number): void {
  seek(s);
}

function renderBundleBar(bar: HTMLElement, host: HTMLElement, go: (screen: string) => void): void {
  const b = state.bundle!;
  bar.innerHTML = "";
  const head = document.createElement("div");
  head.className = "masthead";
  head.innerHTML = `<div class="title"><span class="badge ${b.badge.cls}">${b.badge.text}</span><div><h1></h1><div class="subtitle"></div></div></div>`;
  (head.querySelector("h1") as HTMLElement).textContent =
    String(b.subject["graph_name"] ?? b.subject["graph_id"] ?? "proof");
  const subtitleBits = [`${b.scenarios.length} scenario(s)`];
  if (b.note) subtitleBits.push(b.note);
  if (b.signed) subtitleBits.push("signed — signature NOT checked by this page; run evarness verify");
  (head.querySelector(".subtitle") as HTMLElement).textContent = subtitleBits.join(" · ");
  bar.appendChild(head);

  const tabs = document.createElement("div");
  tabs.className = "scenariotabs";
  b.scenarios.forEach((sc: BundleScenario, i: number) => {
    const t = document.createElement("button");
    t.className = i === state.bundleScenario ? "on" : "";
    t.textContent = `${sc.fixture} · ${sc.status}`;
    t.addEventListener("click", () => {
      state.bundleScenario = i;
      renderRun(host.parentElement as HTMLElement, go);
    });
    tabs.appendChild(t);
  });
  const clear = document.createElement("button");
  clear.textContent = "✕ close bundle";
  clear.addEventListener("click", () => {
    state.bundle = null;
    renderRun(host.parentElement as HTMLElement, go);
  });
  tabs.appendChild(clear);
  bar.appendChild(tabs);

  if (b.not_proven.length) {
    const np = document.createElement("details");
    np.className = "notproven";
    np.innerHTML = `<summary>What this bundle does not prove</summary>`;
    const ul = document.createElement("ul");
    for (const line of b.not_proven) {
      const li = document.createElement("li");
      li.textContent = line;
      ul.appendChild(li);
    }
    np.appendChild(ul);
    bar.appendChild(np);
  }
}

function importBundle(host: HTMLElement, go: (screen: string) => void): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const bundle = JSON.parse(await file.text());
      state.bundle = await api.importBundle(bundle);
      state.bundleScenario = 0;
      state.run = null;
      renderRun(host.parentElement as HTMLElement, go);
    } catch (e) {
      alert(`bundle import failed: ${(e as Error).message}`);
    }
  });
  input.click();
}
