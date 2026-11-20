"""Spark Mail tools: what reaches the spark command, and what never does. A fake `spark` records its arguments."""
import json, os, stat, sys, tempfile, unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools", "foxbuddy"))
import foxtools as ft


class SparkTools(unittest.TestCase):
    def setUp(self):
        d = tempfile.mkdtemp()
        self.log = os.path.join(d, "args.json")
        self.spark = os.path.join(d, "spark")
        with open(self.spark, "w") as f:
            f.write(f"#!{sys.executable}\nimport json, sys\njson.dump(sys.argv[1:], open({self.log!r}, 'w'))\n"
                    "print('ok')\nsys.exit(3 if '--fail' in sys.argv else 0)\n")
        os.chmod(self.spark, stat.S_IRWXU)

    def ran(self, name, args):
        out = ft.spark_tool(self.spark, name, args)
        return out, json.load(open(self.log))

    def test_reads_with_their_options(self):
        _, argv = self.ran("spark_mail", {"command": "search", "target": "Henderson contract",
                                          "options": {"page_size": 5, "order": "descending"}})
        self.assertEqual(argv, ["search", "Henderson contract", "--page-size", "5", "--order", "descending"])
        _, argv = self.ran("spark_mail", {"command": "events", "options": {"tomorrow": True}})
        self.assertEqual(argv, ["events", "--tomorrow"])

    def test_refuses_what_it_shouldnt_read_or_slip_in(self):
        for bad in [{"command": "draft"}, {"command": "attachment", "target": "1"},
                    {"command": "thread", "target": "--download-attachments"},
                    {"command": "thread", "target": "abc", "options": {"download_attachments": True}},
                    {"command": "emails", "options": {"filter": "--stream"}},
                    {"command": "thread"}]:
            with self.assertRaises(ValueError, msg=bad):
                ft.spark_tool(self.spark, "spark_mail", bad)
        self.assertFalse(os.path.exists(self.log))

    def test_drafts_never_send_or_share(self):
        out, argv = self.ran("spark_draft", {"reply_to": "msg-42", "body": "Sounds good."})
        self.assertEqual(argv, ["draft", "--body", "Sounds good.", "--reply-to", "msg-42"])
        self.assertIn("not sent", out)
        for k in ("allow_send", "team", "user", "attach"):
            self.assertNotIn(k, ft.SPARK_TOOLS[1]["inputSchema"]["properties"])

    def test_actions_are_a_short_safe_list(self):
        _, argv = self.ran("spark_action", {"action": "snooze", "ids": ["a", "b"], "date": "2026-11-21T09:00"})
        self.assertEqual(argv, ["action", "snooze", "a", "b", "--date", "2026-11-21T09:00"])
        for act in ("moveToTrash", "markAsSpam", "unsubscribe", "assign", "shareInTeam"):
            with self.assertRaises(ValueError):
                ft.spark_tool(self.spark, "spark_action", {"action": act, "ids": ["a"]})

    def test_the_gate_treats_spark_changes_as_changes(self):
        self.assertEqual(set(ft.SPARK_CHANGE), {"spark_draft", "spark_action"})
        self.assertTrue(all(t["description"].startswith("CHANGE") for t in ft.SPARK_TOOLS if t["name"] in ft.SPARK_CHANGE))

    def test_errors_come_back_plainly(self):
        with self.assertRaises(ValueError) as e:
            ft.spark_tool(self.spark, "spark_mail", {"command": "emails", "target": "Inbox", "options": {"filter": "x"}}) if False else \
                ft.run_spark(self.spark, ["emails", "--fail"])
        self.assertIn("Spark said", str(e.exception))


if __name__ == "__main__":
    unittest.main()
