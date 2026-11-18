"""The fox's own tools (tools/foxbuddy/foxtools.py): names only, and only inside the allowed folders."""
import json, os, subprocess, sys, tempfile, unittest

TOOLS = os.path.join(os.path.dirname(__file__), "..", "tools", "foxbuddy", "foxtools.py")


class FoxTools(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp()
        j = lambda *p: os.path.join(self.root, *p)
        for d in ("Desktop/Taxes", "Documents/.hidden", "Downloads/Pages.app/Contents", "Private", "act"):
            os.makedirs(j(d))
        for f, text in [("Desktop/Taxes/W-2_2025.pdf", "WAGES"), ("Documents/budget.xlsx", "x"), ("Documents/.hidden/w2_2025.pdf", "h"),
                        ("Private/w2_2025.pdf", "secret"), ("act/activity.txt", "Steps on Nov 16: 8123")]:
            with open(j(f), "w") as fh:
                fh.write(text)
        os.symlink(j("Private"), j("Documents/link"))
        self.args = [sys.executable, TOOLS, "--folder", j("Desktop"), "--folder", j("Documents"), "--folder", j("Downloads"),
                     "--activity-dir", j("act")]

    def call(self, *calls):
        msgs = [{"jsonrpc": "2.0", "id": 0, "method": "initialize", "params": {"protocolVersion": "2025-06-18"}},
                {"jsonrpc": "2.0", "method": "notifications/initialized"}]
        msgs += [{"jsonrpc": "2.0", "id": i + 1, "method": "tools/call", "params": {"name": n, "arguments": a}} for i, (n, a) in enumerate(calls)]
        out = subprocess.run(self.args, input="\n".join(map(json.dumps, msgs)) + "\n", capture_output=True, text=True, timeout=20).stdout
        replies = [json.loads(l) for l in out.splitlines()]
        self.assertEqual(replies[0]["result"]["serverInfo"]["name"], "fox")
        return [r["result"]["content"][0]["text"] for r in replies[1:]]

    def test_finds_by_name_ignoring_case_and_punctuation(self):
        [text] = self.call(("find_files", {"query": "w2 2025"}))
        self.assertIn("Desktop/Taxes/W-2_2025.pdf", text)
        self.assertNotIn("WAGES", text)                       # names only, never contents
        self.assertNotIn(".hidden", text)                     # hidden folders skipped
        self.assertNotIn("Private", text)                     # a symlink out isn't followed

    def test_globs_and_packages(self):
        xlsx, app = self.call(("find_files", {"query": "*.xlsx"}), ("find_files", {"query": "pages"}))
        self.assertIn("budget.xlsx", xlsx)
        self.assertIn("Pages.app  (package", app)

    def test_refuses_folders_outside(self):
        for folder in (os.path.join(self.root, "Private"), os.path.join(self.root, "Documents", "link"), "/etc"):
            [text] = self.call(("find_files", {"query": "w2", "folder": folder}))
            self.assertIn("isn't one I'm allowed", text)

    def test_named_folder(self):
        [text] = self.call(("find_files", {"query": "w2", "folder": "Downloads"}))
        self.assertIn("No files", text)

    def test_activity(self):
        [text] = self.call(("activity", {}))
        self.assertIn("8123", text)


if __name__ == "__main__":
    unittest.main()
