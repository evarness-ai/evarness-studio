// App shell + hash router. No framework: the shell renders once, screens
// mount into <main> on navigation.

import { api } from "./api";
import { renderBuilder } from "./screens/builder";
import { renderLibrary } from "./screens/library";
import { renderRun } from "./screens/run";
import { restoreAutosave, state } from "./store";
import { themeToggle } from "./theme";

type Screen = "library" | "builder" | "run";
const TITLES: Record<Screen, string> = {
  library: "Pattern library",
  builder: "Builder",
  run: "Run · replay & proof",
};

function go(screen: string): void {
  location.hash = `#${screen}`;
}

function screenFromHash(): Screen {
  const h = location.hash.replace("#", "");
  return h === "builder" || h === "run" ? h : "library";
}

async function boot(): Promise<void> {
  const app = document.getElementById("app")!;
  app.innerHTML = `
    <aside class="side">
      <div class="logo">evarness<span>studio</span></div>
      <div class="sub">visual studio for provable harnesses</div>
      <button class="nav" data-nav="library">◧ Library</button>
      <button class="nav" data-nav="builder">▦ Builder</button>
      <button class="nav" data-nav="run">▶ Run</button>
      <div class="grow"></div>
      <div class="foot"></div>
    </aside>
    <div class="main">
      <header><h1 id="title"></h1><span class="dim small" id="conn"></span></header>
      <div class="screen" id="screen"></div>
    </div>`;
  (app.querySelector(".foot") as HTMLElement).appendChild(themeToggle());
  app.querySelectorAll<HTMLButtonElement>("[data-nav]").forEach((b) =>
    b.addEventListener("click", () => go(b.dataset.nav!)),
  );

  const conn = document.getElementById("conn")!;
  try {
    const { registry, groups } = await api.schemas();
    state.registry = registry;
    state.groups = groups;
    state.specs = new Map(registry.map((s) => [s.type, s]));
    conn.textContent = `${registry.length} node types`;
  } catch (e) {
    conn.textContent = `✗ server unreachable: ${(e as Error).message}`;
  }
  restoreAutosave();

  const render = () => {
    const screen = screenFromHash();
    document.getElementById("title")!.textContent = TITLES[screen];
    app.querySelectorAll<HTMLButtonElement>("[data-nav]").forEach((b) =>
      b.classList.toggle("active", b.dataset.nav === screen),
    );
    const host = document.getElementById("screen")!;
    if (screen === "library") void renderLibrary(host, go);
    else if (screen === "builder") renderBuilder(host, go);
    else renderRun(host, go);
  };
  window.addEventListener("hashchange", render);
  render();
}

void boot();
