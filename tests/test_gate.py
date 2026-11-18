"""foxtools.py's tool gate: what his chats may call, and an approved change exactly once."""
import json
import os
import sys
import tempfile
import time
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'tools', 'foxbuddy'))
import foxtools  # noqa: E402

CAL = 'mcp__claude_ai_Google_Calendar__'
EVENT = {'summary': 'Dinner', 'start': {'dateTime': '2026-11-20T18:00:00-05:00'}, 'end': {'dateTime': '2026-11-20T20:00:00-05:00'}}


class Gate(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.path = os.path.join(self.dir, 'policy.json')
        self.write({'allow': [CAL + 'list_events', 'WebSearch', 'ToolSearch'], 'read_roots': [self.dir],
                    'approval': {'tool': CAL + 'create_event', 'input': EVENT}})

    def write(self, policy):
        with open(self.path, 'w') as f:
            json.dump(policy, f)

    def call(self, tool, args=None, call_id=None):
        c = {'tool_name': tool, 'tool_input': args if args is not None else {}}
        if call_id:
            c['tool_use_id'] = call_id
        return foxtools.gate(self.path, json.dumps(c))

    def test_listed_tools_pass_and_others_are_refused(self):
        self.assertTrue(self.call(CAL + 'list_events')[0])
        ok, why = self.call('Bash', {'command': 'ls'})
        self.assertFalse(ok)
        self.assertIn("isn't one of the fox's tools", why)

    def test_a_change_needs_approval(self):
        ok, why = self.call(CAL + 'delete_event', {'eventId': 'x'})
        self.assertFalse(ok)
        self.assertIn('approval', why)

    def test_the_approved_change_goes_through(self):
        self.assertEqual(self.call(CAL + 'create_event', EVENT, 'toolu_1'), (True, ''))

    def test_the_same_call_checked_twice_still_goes_through(self):
        # the bug: the approval was struck out the first time it was seen, so a second check of that one call refused it
        self.assertTrue(self.call(CAL + 'create_event', EVENT, 'toolu_1')[0])
        self.assertTrue(self.call(CAL + 'create_event', EVENT, 'toolu_1')[0])

    def test_a_second_call_is_refused(self):
        self.assertTrue(self.call(CAL + 'create_event', EVENT, 'toolu_1')[0])
        ok, why = self.call(CAL + 'create_event', EVENT, 'toolu_2')
        self.assertFalse(ok)
        self.assertIn('already been made', why)

    def test_without_call_ids_a_quick_recheck_passes_and_a_later_call_does_not(self):
        self.assertTrue(self.call(CAL + 'create_event', EVENT)[0])
        self.assertTrue(self.call(CAL + 'create_event', EVENT)[0])
        with open(self.path) as f:
            p = json.load(f)
        p['approval']['used']['at'] = time.time() - foxtools.SAME_CALL_SECONDS - 5
        self.write(p)
        self.assertFalse(self.call(CAL + 'create_event', EVENT)[0])

    def test_different_arguments_are_refused(self):
        ok, why = self.call(CAL + 'create_event', dict(EVENT, summary='Something else'), 'toolu_1')
        self.assertFalse(ok)
        self.assertIn("aren't the arguments the user approved", why)
        self.assertTrue(self.call(CAL + 'create_event', EVENT, 'toolu_2')[0])     # the approval is still there

    def test_read_only_inside_the_folders(self):
        self.assertTrue(self.call('Read', {'file_path': os.path.join(self.dir, 'a.txt')})[0] is False)  # Read isn't allowed here
        p = json.load(open(self.path)); p['allow'].append('Read'); self.write(p)
        self.assertTrue(self.call('Read', {'file_path': os.path.join(self.dir, 'a.txt')})[0])
        self.assertFalse(self.call('Read', {'file_path': '/etc/hosts'})[0])

    def test_no_policy_fails_closed(self):
        ok, why = foxtools.gate(os.path.join(self.dir, 'missing.json'), '{}')
        self.assertFalse(ok)


if __name__ == '__main__':
    unittest.main()
