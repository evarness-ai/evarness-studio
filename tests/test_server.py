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

    def _import(self, mutate=None):
        bundle = json.loads(json.dumps(self.bundle))
        if mutate:
            mutate(bundle)
        return server._import_bundle({"bundle": bundle})

    def test_valid_bundle_gets_badge_and_hash_verified_canvas(self):
        result = self._import()
        self.assertEqual(result["badge"]["text"], "PROOF HOLDS")
        self.assertIsNone(result["note"])
        self.assertIsNotNone(result["graph"])
        self.assertEqual(len(result["scenarios"]), 2)

    def test_valid_unsigned_bundle_is_integrity_verified_and_unsigned(self):
        result = self._import()
        self.assertEqual(result["integrity"]["text"], "INTEGRITY VERIFIED")
        self.assertEqual(result["signature"]["text"], "UNSIGNED")
        self.assertTrue(result["verification"]["ok"])

    def test_modified_event_payload_invalidates_the_bundle(self):
        def mutate(b):
            b["scenarios"][0]["events"][2]["payload"]["injected"] = "tampered"

        result = self._import(mutate)
        self.assertEqual(result["integrity"]["text"], "BUNDLE INVALID")

    def test_modified_trace_digest_invalidates_the_bundle(self):
        def mutate(b):
            b["scenarios"][0]["trace_digest"] = "c1:sha256:" + "0" * 64

        result = self._import(mutate)
        self.assertEqual(result["integrity"]["text"], "BUNDLE INVALID")

    def test_modified_event_count_invalidates_the_bundle(self):
        def mutate(b):
            b["scenarios"][0]["events_count"] += 1

        result = self._import(mutate)
        self.assertEqual(result["integrity"]["text"], "BUNDLE INVALID")

    def test_modified_stored_verdict_is_caught_and_badges_stay_independent(self):
        def mutate(b):
            b["verdict"]["ok"] = False
            b["verdict"]["invariants_pass"] = False

        result = self._import(mutate)
        # the claim badge renders the (tampered) stored verdict…
        self.assertEqual(result["badge"]["text"], "PROOF FAILED")
        # …and the integrity check exposes that it disagrees with the rows
        self.assertEqual(result["integrity"]["text"], "BUNDLE INVALID")

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


def _crypto_available() -> bool:
    try:
        import cryptography  # noqa: F401

        return True
    except ImportError:
        return False


@unittest.skipUnless(_crypto_available(), "cryptography not installed — [sign] extra required")
class SignedBundleTests(unittest.TestCase):
    """Signature and integrity are independent judgments — a re-dated signed
    bundle keeps valid digests but a broken signature, and the badges must
    say exactly that."""

    @classmethod
    def setUpClass(cls):
        cls._tmp = tempfile.TemporaryDirectory()
        out = Path(cls._tmp.name) / "signed.json"
        key = Path(cls._tmp.name) / "test_ed25519.pem"
        code = (
            "from evarness.cli import main; import sys; "
            f"sys.exit(main(['prove', 'governed_email_assistant', '-o', {str(out)!r}, "
            f"'--sign', '--key', {str(key)!r}]))"
        )
        env = dict(os.environ, EVARNESS_DB=str(Path(cls._tmp.name) / "ev.db"))
        result = subprocess.run(
            [sys.executable, "-c", code], capture_output=True, text=True, env=env, check=False
        )
        assert result.returncode == 0, result.stdout + result.stderr
        cls.bundle = json.loads(out.read_text())

    @classmethod
    def tearDownClass(cls):
        cls._tmp.cleanup()

    def _import(self, mutate=None):
        bundle = json.loads(json.dumps(self.bundle))
        if mutate:
            mutate(bundle)
        return server._import_bundle({"bundle": bundle})

    def test_valid_signed_bundle_verifies_both_ways(self):
        result = self._import()
        self.assertEqual(result["integrity"]["text"], "INTEGRITY VERIFIED")
        self.assertEqual(result["signature"]["text"], "SIGNATURE VERIFIED")

    def test_redated_bundle_breaks_the_signature_but_not_the_digests(self):
        def mutate(b):
            b["generated_at"] = "1999-01-01T00:00:00Z"

        result = self._import(mutate)
        self.assertEqual(result["integrity"]["text"], "INTEGRITY VERIFIED")
        self.assertEqual(result["signature"]["text"], "SIGNATURE INVALID")


if __name__ == "__main__":
    unittest.main()
