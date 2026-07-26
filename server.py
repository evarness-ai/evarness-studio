"""Evarness Studio server — the standard library over the evarness library.

Zero dependencies beyond `evarness` itself: `http.server` serves the compiled
frontend from dist/ and exposes the library as small JSON endpoints. No web
framework — the studio's dependency policy is the render artifacts' policy.

    GET  /api/schemas        node registry: types, ports, docs, JSON Schemas
    GET  /api/patterns       packaged + user patterns
    GET  /api/pattern/{id}   one pattern: graph + fixture names
    POST /api/validate       {graph} -> {issues}
    POST /api/run            {graph, pattern?, fixture?, input?} -> run result
    POST /api/import-bundle  {bundle} -> badge + scenarios + hash-checked graph

The bundle import enforces the same rule as the proof browser (E13): the
canvas graph is returned only when its hash matches the bundle's pinned
subject — an unavailable graph is an honest omission, never a substitute.
"""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from evarness.core.executor import GraphValidationError, execute
from evarness.core.graph import GraphModel, lint, migrate
from evarness.core.prove import graph_hash
from evarness.core.registry import NODE_TYPES
from evarness.core.trace import canonical_trace, trace_digest
from evarness.domains.agents import patterns
from evarness.domains.agents.nodes.base import GROUP_ORDER, GROUP_TITLES, presentation
from evarness.domains.agents.sim import load_fixture

DIST = Path(__file__).parent / "dist"
PORT = 8787

_BADGES = {
    "nothing": ("NOTHING ASSERTED", "nothing"),
    True: ("PROOF HOLDS", "holds"),
    None: ("PROOF PENDING", "pending"),
    False: ("PROOF FAILED", "failed"),
}


def _schemas() -> dict:
    registry = []
    for type_name in sorted(NODE_TYPES):
        spec = NODE_TYPES[type_name]
        pres = presentation(type_name)
        registry.append(
            {
                "type": type_name,
                "label": pres.get("label") or type_name,
                "icon": pres.get("icon") or "⬡",
                "group": getattr(spec, "group", "core"),
                "doc": getattr(spec, "doc", ""),
                "inputs": dict(getattr(spec, "inputs", {})),
                "outputs": dict(getattr(spec, "outputs", {})),
                "config_defaults": spec.Config().model_dump(by_alias=True),
                "schema": spec.Config.model_json_schema(),
            }
        )
    return {
        "registry": registry,
        "groups": {"order": GROUP_ORDER, "titles": GROUP_TITLES},
    }


def _graph(doc: dict) -> GraphModel:
    return GraphModel.model_validate(migrate(doc))


def _run(body: dict) -> dict:
    graph = _graph(body["graph"])
    fixture = None
    if body.get("pattern") and body.get("fixture"):
        path = patterns.fixture_path(body["pattern"], body["fixture"])
        fixture = load_fixture(path)
    else:
        fixture = load_fixture(None)
    run = execute(graph, fixture, user_input=body.get("input") or None)
    return {
        "status": run.status,
        "output": run.output,
        "reason": run.reason,
        "pending": run.pending,
        "trace_digest": trace_digest(run.events),
        "invariants": run.invariants,
        "events": canonical_trace(run.events),
    }


def _bundle_graph(bundle: dict) -> tuple[dict | None, str | None]:
    """The proof browser's rule, server-side: canvas only from a graph whose
    hash matches the pinned subject."""
    subject = bundle.get("subject") or {}
    pattern = subject.get("pattern")
    if not pattern:
        return None, "bundle pins its graph by hash only — canvas omitted"
    doc = patterns.load_pattern(pattern)
    if doc is None:
        return None, f"pattern '{pattern}' not found locally — canvas omitted"
    graph = _graph(doc)
    if graph_hash(graph) != subject.get("graph_sha256"):
        return None, (
            f"pattern '{pattern}' on disk no longer matches the bundle's pinned "
            "graph — canvas omitted (the canvas is only ever drawn from the proven graph)"
        )
    return json.loads(graph.model_dump_json(by_alias=True)), None


def _import_bundle(body: dict) -> dict:
    bundle = body["bundle"]
    if "proof_version" not in bundle:
        raise ValueError("not a proof bundle: missing proof_version")
    subject = bundle.get("subject") or {}
    verdict = bundle.get("verdict") or {}
    declared = list(subject.get("invariants_declared") or [])
    text, cls = _BADGES["nothing"] if not declared else _BADGES[verdict.get("ok")]
    graph, note = _bundle_graph(bundle)
    return {
        "badge": {"text": text, "cls": cls},
        "verdict": verdict,
        "subject": subject,
        "not_proven": bundle.get("not_proven") or [],
        "signed": bool(bundle.get("attestation")),
        "graph": graph,
        "note": note,
        "scenarios": bundle.get("scenarios") or [],
    }


class Handler(BaseHTTPRequestHandler):
    def _json(self, payload: dict, code: int = 200) -> None:
        data = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _static(self, name: str, ctype: str) -> None:
        path = DIST / name
        if not path.is_file():
            self.send_error(404, f"{name} not built — run `npm run build`")
            return
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:  # noqa: N802 (http.server API)
        try:
            if self.path in ("/", "/index.html"):
                self._static("index.html", "text/html; charset=utf-8")
            elif self.path == "/app.js":
                self._static("app.js", "text/javascript")
            elif self.path == "/styles.css":
                self._static("styles.css", "text/css")
            elif self.path == "/api/schemas":
                self._json(_schemas())
            elif self.path == "/api/patterns":
                self._json({"patterns": patterns.list_patterns()})
            elif self.path.startswith("/api/pattern/"):
                pid = self.path.rsplit("/", 1)[1]
                doc = patterns.load_pattern(pid)
                if doc is None:
                    self._json({"error": f"unknown pattern '{pid}'"}, 404)
                    return
                self._json({"graph": doc, "fixtures": patterns.fixture_names(pid)})
            else:
                self.send_error(404)
        except Exception as exc:  # surfaced to the UI, never a silent 500 page
            self._json({"error": f"{type(exc).__name__}: {exc}"}, 500)

    def do_POST(self) -> None:  # noqa: N802
        try:
            length = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(length) or b"{}")
            if self.path == "/api/validate":
                issues = lint(_graph(body["graph"]), NODE_TYPES)
                self._json({"issues": issues})
            elif self.path == "/api/run":
                self._json(_run(body))
            elif self.path == "/api/import-bundle":
                self._json(_import_bundle(body))
            else:
                self.send_error(404)
        except GraphValidationError as exc:
            self._json({"error": f"graph invalid: {exc}"}, 400)
        except Exception as exc:
            self._json({"error": f"{type(exc).__name__}: {exc}"}, 400)

    def log_message(self, fmt: str, *args) -> None:  # quiet: the UI is the log
        pass


if __name__ == "__main__":
    print(f"evarness-studio on http://localhost:{PORT}  (dist: {'built' if DIST.exists() else 'MISSING — npm run build'})")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
