"""Server logic tests — stdlib unittest, no test dependencies.

The server is a thin JSON layer over the installed `evarness` package; these
tests exercise its logic functions directly (no sockets): the schema payload
Studio's palette is built from, graph validation, and the proof-bundle import
rules — especially the one that matters: the canvas is only ever drawn from a
graph whose hash matches the bundle's pinned subject.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))

import server  # noqa: E402  (imports the installed evarness package)


def _prove(out: Path) -> dict:
    code = (
        "from evarness.cli import main; import sys; "
        f"sys.exit(main(['prove', 'governed_email_assistant', '-o', {str(out)!r}]))"
    )
    env = dict(os.environ, EVARNESS_DB=str(out.parent / "ev.db"))
    result = subprocess.run(
        [sys.executable, "-c", code], capture_output=True, text=True, env=env, check=False
    )
    assert result.returncode == 0, result.stdout + result.stderr
    return json.loads(out.read_text())


class SchemaTests(unittest.TestCase):
    def test_registry_carries_ports_defaults_and_json_schema(self):
        payload = server._schemas()
        by_type = {entry["type"]: entry for entry in payload["registry"]}
        self.assertIn("llm", by_type)
        llm = by_type["llm"]
        self.assertEqual(llm["outputs"], {"out": "text"})
        self.assertIn("properties", llm["schema"])
        self.assertIn("temperature", llm["config_defaults"])
        self.assertTrue(payload["groups"]["order"])


class ValidateTests(unittest.TestCase):
    def test_lint_flags_unknown_type_and_bad_edge(self):
        graph = server._graph(
            {
                "ir_version": 1,
                "id": "bad",
                "name": "bad",
                "nodes": [{"id": "a", "type": "no_such_type", "config": {}}],
                "edges": [{"from": "a", "to": "ghost"}],
            }
        )
        codes = {i["code"] for i in server.lint(graph, server.NODE_TYPES)}
        self.assertIn("unknown_type", codes)
        self.assertIn("bad_edge", codes)


class BundleImportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._tmp = tempfile.TemporaryDirectory()
        cls.bundle = _prove(Path(cls._tmp.name) / "proof.json")

    @classmethod
    def tearDownClass(cls):
        cls._tmp.cleanup()

    def test_valid_bundle_gets_badge_and_hash_verified_canvas(self):
        result = server._import_bundle({"bundle": json.loads(json.dumps(self.bundle))})
        self.assertEqual(result["badge"]["text"], "PROOF HOLDS")
        self.assertIsNone(result["note"])
        self.assertIsNotNone(result["graph"])
        self.assertEqual(len(result["scenarios"]), 2)

    def test_tampered_graph_hash_omits_the_canvas(self):
        tampered = json.loads(json.dumps(self.bundle))
        tampered["subject"]["graph_sha256"] = "0" * 64
        result = server._import_bundle({"bundle": tampered})
        self.assertIsNone(result["graph"])
        self.assertIn("canvas omitted", result["note"])
        # the badge still reports the verdict — only the canvas is refused
        self.assertEqual(result["badge"]["text"], "PROOF HOLDS")

    def test_unknown_pattern_omits_the_canvas(self):
        tampered = json.loads(json.dumps(self.bundle))
        tampered["subject"]["pattern"] = "no_such_pattern"
        result = server._import_bundle({"bundle": tampered})
        self.assertIsNone(result["graph"])
        self.assertIn("not found locally", result["note"])

    def test_not_a_bundle_is_refused_loudly(self):
        with self.assertRaises(ValueError):
            server._import_bundle({"bundle": {"hello": "world"}})


if __name__ == "__main__":
    unittest.main()
