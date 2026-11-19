"""foxtools.py's Reminders, Notes and Shortcuts tools (osascript and `shortcuts` stubbed out: CI isn't signed in to iCloud)."""
import json
import os
import subprocess
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'tools', 'foxbuddy'))
import foxtools  # noqa: E402


def done(stdout='', code=0, stderr=''):
    return subprocess.CompletedProcess([], code, stdout=stdout, stderr=stderr)


class AppleTools(unittest.TestCase):
    def test_reminder_lists(self):
        with mock.patch('subprocess.run', return_value=done(json.dumps([{'name': 'Home', 'open': 3}, {'name': 'Work', 'open': 0}]))) as run:
            out = foxtools.apple_tool('reminders_lists', {})
        self.assertIn('- Home (3 open)', out)
        self.assertEqual(run.call_args[0][0][:3], ['/usr/bin/osascript', '-l', 'JavaScript'])
        self.assertEqual(json.loads(run.call_args[0][0][-1]), {'op': 'lists'})

    def test_adding_a_reminder_passes_exactly_what_was_asked(self):
        with mock.patch('subprocess.run', return_value=done('{"added": "Buy milk", "list": "Home", "due": null}')) as run:
            foxtools.apple_tool('reminders_add', {'title': ' Buy milk ', 'list': 'Home'})
        self.assertEqual(json.loads(run.call_args[0][0][-1]), {'op': 'add', 'title': 'Buy milk', 'list': 'Home', 'due': None, 'notes': None})

    def test_a_reminder_needs_a_title(self):
        with self.assertRaises(ValueError):
            foxtools.apple_tool('reminders_add', {'title': '  '})

    def test_not_allowed_says_where_to_switch_it_on(self):
        with mock.patch('subprocess.run', return_value=done('', 1, 'execution error: Not authorized to send Apple events to Notes. (-1743)')):
            with self.assertRaises(ValueError) as e:
                foxtools.apple_tool('notes_search', {'query': 'recipes'})
        self.assertIn('Privacy & Security', str(e.exception))

    def test_running_a_shortcut_returns_its_output(self):
        def fake(cmd, **kw):
            out = cmd[cmd.index('--output-path') + 1]
            with open(out, 'w') as f:
                f.write('42 steps')
            return done()
        with mock.patch('subprocess.run', side_effect=fake) as run:
            out = foxtools.apple_tool('shortcuts_run', {'name': 'Step Count'})
        self.assertEqual(run.call_args[0][0][:3], ['/usr/bin/shortcuts', 'run', 'Step Count'])
        self.assertIn('42 steps', out)

    def test_the_tools_are_listed_only_with_apple(self):
        names = {t['name'] for t in foxtools.APPLE_TOOLS}
        self.assertEqual(names, set(foxtools.APPLE_READ + foxtools.APPLE_CHANGE))
        for t in foxtools.APPLE_TOOLS:
            if t['name'] in foxtools.APPLE_CHANGE:
                self.assertIn('CHANGE', t['description'])

    def test_the_server_offers_them_only_with_apple(self):
        here = os.path.join(os.path.dirname(__file__), '..', 'tools', 'foxbuddy', 'foxtools.py')
        msgs = '\n'.join(json.dumps(m) for m in [{'jsonrpc': '2.0', 'id': 1, 'method': 'tools/list'}]) + '\n'
        for args, expect in (([], False), (['--apple'], True)):
            r = subprocess.run([sys.executable, here] + args, input=msgs, capture_output=True, text=True, timeout=10)
            tools = {t['name'] for t in json.loads(r.stdout.splitlines()[0])['result']['tools']}
            self.assertEqual('reminders_add' in tools, expect)


if __name__ == '__main__':
    unittest.main()
