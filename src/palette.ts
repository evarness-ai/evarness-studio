// Palette: node registry grouped by concern, searchable, drag-to-add.

import { state } from "./store";
import { GROUP_COLORS } from "./types";

export function renderPalette(host: HTMLElement): void {
  host.innerHTML = "";
  const head = document.createElement("div");
  head.className = "palette-head";
  head.innerHTML = `<h3>Nodes</h3><div class="dim small">Drag onto the canvas to build your harness</div>`;
  const search = document.createElement("input");
  search.className = "palette-search";
  search.placeholder = "🔍 search nodes…";
  head.appendChild(search);
  host.appendChild(head);

  const body = document.createElement("div");
  host.appendChild(body);

  const draw = () => {
    body.innerHTML = "";
    const q = search.value.trim().toLowerCase();
    const present = [...new Set(state.registry.map((s) => s.group))];
    const ordered = [
      ...state.groups.order.filter((g) => present.includes(g)),
      ...present.filter((g) => !state.groups.order.includes(g)),
    ];
    let any = false;
    for (const g of ordered) {
      const items = state.registry.filter(
        (s) => s.group === g && (!q || `${s.label} ${s.type} ${s.doc}`.toLowerCase().includes(q)),
      );
      if (!items.length) continue;
      any = true;
      const group = document.createElement("div");
      group.className = "palgroup";
      const title = document.createElement("div");
      title.className = "palgroup-title";
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = GROUP_COLORS[g] ?? GROUP_COLORS.core;
      title.appendChild(dot);
      title.appendChild(document.createTextNode(state.groups.titles[g] ?? g));
      group.appendChild(title);
      const grid = document.createElement("div");
      grid.className = "palgrid";
      for (const s of items) {
        const card = document.createElement("div");
        card.className = "palcard";
        card.draggable = true;
        card.title = s.doc;
        card.innerHTML = `<span class="palicon">${s.icon}</span><span class="pallabel"></span>`;
        (card.querySelector(".pallabel") as HTMLElement).textContent = s.label;
        card.addEventListener("dragstart", (e) =>
          e.dataTransfer?.setData("application/evarness-node", s.type),
        );
        grid.appendChild(card);
      }
      group.appendChild(grid);
      body.appendChild(group);
    }
    if (!any) {
      const p = document.createElement("p");
      p.className = "dim small";
      p.style.padding = "8px 12px";
      p.textContent = `No nodes match "${search.value}".`;
      body.appendChild(p);
    }
    const foot = document.createElement("p");
    foot.className = "dim small palette-foot";
    foot.textContent =
      "Ports: ▢ input · ● output — drag output → input. Connections are type-checked; select a node/edge and press Backspace to delete.";
    body.appendChild(foot);
  };

  search.addEventListener("input", draw);
  draw();
}
