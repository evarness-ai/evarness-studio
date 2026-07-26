// Library: packaged + user patterns as cards → open in Builder.

import { api } from "../api";
import { openGraph } from "../store";
import type { PatternInfo } from "../types";

export async function renderLibrary(host: HTMLElement, go: (screen: string) => void): Promise<void> {
  host.innerHTML = `<div class="screen-pad"><h2 class="kicker">Pattern library</h2><p class="dim">Runnable, provable examples — open one in the Builder, or import a proof bundle in the Run view.</p><div class="cardgrid" id="cards"><p class="dim">loading…</p></div></div>`;
  const cards = host.querySelector("#cards") as HTMLElement;
  try {
    const { patterns } = await api.patterns();
    cards.innerHTML = "";
    patterns.forEach((p: PatternInfo) => {
      const card = document.createElement("div");
      card.className = "pcard";
      const fixtures = p.fixtures.map((f) => `<span class="tag">${f}</span>`).join("");
      card.innerHTML = `<h3></h3><p class="dim small">${p.id} · <span class="tag vtag">${p.source}</span></p><div class="tags">${fixtures}</div><div class="cardbtns"><button class="primary">Open in Builder</button></div>`;
      (card.querySelector("h3") as HTMLElement).textContent = p.name;
      (card.querySelector("button") as HTMLElement).addEventListener("click", async () => {
        const detail = await api.pattern(p.id);
        openGraph(detail.graph, p.id, detail.fixtures);
        go("builder");
      });
      cards.appendChild(card);
    });
    if (!patterns.length) cards.innerHTML = '<p class="dim">No patterns found.</p>';
  } catch (e) {
    cards.innerHTML = `<p class="err">✗ ${(e as Error).message}</p>`;
  }
}
