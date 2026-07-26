// Inspector: forms auto-generated from the node registry's JSON Schemas —
// one source of truth (the pydantic Config models), zero hand-written forms.

import type { IRNode, JsonSchemaProp, NodeSpec } from "./types";

function propKind(p: JsonSchemaProp): { kind: string; enums?: unknown[] } {
  if (p.enum) return { kind: "enum", enums: p.enum };
  if (p.const !== undefined) return { kind: "const" };
  if (p.anyOf) {
    const first = p.anyOf.find((x) => x.type !== "null");
    if (first) return propKind(first);
  }
  const t = Array.isArray(p.type) ? p.type[0] : p.type;
  if (t === "string") return { kind: "string" };
  if (t === "integer" || t === "number") return { kind: "number" };
  if (t === "boolean") return { kind: "boolean" };
  return { kind: "json" }; // arrays, objects, refs — edited as JSON
}

export function renderInspector(
  host: HTMLElement,
  node: IRNode | null,
  spec: NodeSpec | undefined,
  onEdit: () => void,
): void {
  host.innerHTML = "";
  const h3 = document.createElement("h3");
  if (!node || !spec) {
    h3.textContent = "Inspector";
    host.appendChild(h3);
    const p = document.createElement("p");
    p.className = "dim small";
    p.textContent = "Select a node to edit its config. Backspace deletes the selection.";
    host.appendChild(p);
    return;
  }
  h3.textContent = `${spec.icon} ${node.label || spec.label}`;
  host.appendChild(h3);
  const sub = document.createElement("div");
  sub.className = "dim small";
  sub.textContent = `${node.id} · ${node.type}`;
  host.appendChild(sub);

  const labelField = field("label");
  const labelInput = document.createElement("input");
  labelInput.value = node.label ?? "";
  labelInput.addEventListener("change", () => {
    node.label = labelInput.value || null;
    onEdit();
  });
  labelField.appendChild(labelInput);
  host.appendChild(labelField);

  const props = spec.schema.properties ?? {};
  for (const [key, prop] of Object.entries(props)) {
    const wrap = field(key, prop.description);
    const { kind, enums } = propKind(prop);
    const current = node.config[key] ?? prop.default;
    if (kind === "boolean") {
      const row = document.createElement("label");
      row.className = "togglerow";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = Boolean(current);
      cb.addEventListener("change", () => {
        node.config[key] = cb.checked;
        onEdit();
      });
      row.appendChild(cb);
      row.appendChild(document.createTextNode(" enabled"));
      wrap.appendChild(row);
    } else if (kind === "enum" && enums) {
      const sel = document.createElement("select");
      for (const opt of enums) {
        const o = document.createElement("option");
        o.value = String(opt);
        o.textContent = String(opt);
        if (opt === current) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener("change", () => {
        node.config[key] = sel.value;
        onEdit();
      });
      wrap.appendChild(sel);
    } else if (kind === "number") {
      const input = document.createElement("input");
      input.type = "number";
      input.value = current === undefined || current === null ? "" : String(current);
      input.addEventListener("change", () => {
        node.config[key] = input.value === "" ? null : Number(input.value);
        onEdit();
      });
      wrap.appendChild(input);
    } else if (kind === "string") {
      const input = document.createElement("input");
      input.value = current === undefined || current === null ? "" : String(current);
      input.addEventListener("change", () => {
        node.config[key] = input.value;
        onEdit();
      });
      wrap.appendChild(input);
    } else {
      const ta = document.createElement("textarea");
      ta.rows = 3;
      ta.value = JSON.stringify(current ?? null, null, 1);
      ta.addEventListener("change", () => {
        try {
          node.config[key] = JSON.parse(ta.value);
          ta.classList.remove("badjson");
          onEdit();
        } catch {
          ta.classList.add("badjson");
        }
      });
      wrap.appendChild(ta);
    }
    host.appendChild(wrap);
  }

  if (spec.doc) {
    const doc = document.createElement("div");
    doc.className = "doccard";
    const b = document.createElement("b");
    b.textContent = spec.label;
    doc.appendChild(b);
    doc.appendChild(document.createTextNode(spec.doc));
    host.appendChild(doc);
  }
}

function field(name: string, help?: string): HTMLDivElement {
  const div = document.createElement("div");
  div.className = "field";
  const label = document.createElement("label");
  label.textContent = name;
  div.appendChild(label);
  if (help) {
    const fh = document.createElement("div");
    fh.className = "fieldhelp";
    fh.textContent = help;
    div.appendChild(fh);
  }
  return div;
}
