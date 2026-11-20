"""The fox's own tools (tools/foxbuddy/foxtools.py): names only, and only inside the allowed folders."""
import json, os, re, subprocess, sys, tempfile, unittest

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


GUIDE = os.path.join(os.path.dirname(__file__), "..", "tools", "foxbuddy", "fox-guide.md")
SWIFT = os.path.join(os.path.dirname(__file__), "..", "tools", "foxbuddy", "main.swift")


class AboutFoxBuddy(unittest.TestCase):
    """His guide to himself: the about_fox_buddy tool, and that the guide keeps up with the app."""

    def ask(self, *extra):
        msgs = [{"jsonrpc": "2.0", "id": 0, "method": "initialize", "params": {}},
                {"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
                {"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "about_fox_buddy", "arguments": {"question": "can you send email?"}}}]
        out = subprocess.run([sys.executable, TOOLS, *extra], input="\n".join(map(json.dumps, msgs)) + "\n",
                             capture_output=True, text=True, timeout=20).stdout
        replies = [json.loads(l) for l in out.splitlines()]
        return [t["name"] for t in replies[1]["result"]["tools"]], replies[2]["result"]["content"][0]["text"]

    def test_answers_with_the_guide_and_current_settings(self):
        d = tempfile.mkdtemp()
        settings = os.path.join(d, "settings-now.txt")
        with open(settings, "w") as f:
            f.write("Keyboard shortcut: ⌃⌥ F\nEnd-of-day wrap-up: off")
        names, text = self.ask("--guide", GUIDE, "--settings", settings)
        self.assertIn("about_fox_buddy", names)
        self.assertIn("## What you can't do", text)
        self.assertIn("Send email", text)
        self.assertIn("## The user's current settings on this Mac", text)
        self.assertIn("Keyboard shortcut: ⌃⌥ F", text)

    def test_says_so_when_the_guide_is_missing(self):
        _, text = self.ask("--guide", "/nonexistent/fox-guide.md")
        self.assertIn("guide is missing", text)
        self.assertNotIn("current settings", text)

    def test_the_guide_names_every_menu_item(self):
        """Every fixed menu title in the app is in the guide, so a new menu item can't ship without him knowing it."""
        swift = open(SWIFT, encoding="utf-8").read()
        menu = swift[swift.index("    func menu() -> NSMenu {"):swift.index("    @objc func tapNow()")]
        menu += swift[swift.index("    func meetingItems()"):swift.index("    @objc func toggleMeetingPrep()")]
        menu += swift[swift.index("    func emailAlertItems()"):swift.index("    @objc func removeEmailAlert")]
        menu += swift[swift.index("    func captureItems()"):swift.index("    @objc func pickCaptureTo")]
        titles = set(re.findall(r'(?:item|sub)\("([^"\\]+)"', menu))
        titles -= {"Off", "Tap", "Hide (Open Fox Buddy Again to Bring Him Back)", "No alerts yet",
                   "Ask a Question… (or Double-Click Him)"}                       # named differently, or nothing to explain
        guide = " ".join(open(GUIDE, encoding="utf-8").read().split())
        missing = sorted(t for t in titles if t not in guide)
        self.assertEqual(missing, [], "add these menu items to tools/foxbuddy/fox-guide.md")
