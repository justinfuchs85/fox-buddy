"""The bridge's Bambu Lab printer watcher (class PrinterWatch): the MQTT conversation, against a fake printer on a
local socket (plain TCP: the TLS layer is swapped out), and the rules for when he speaks up."""
import importlib.util, json, os, socket, tempfile, threading, time, unittest

HOME = tempfile.mkdtemp(prefix="deskbuddy-printer-")
os.environ["DESKBUDDY_HOME"] = HOME
_spec = importlib.util.spec_from_file_location("bridge_printer", os.path.join(os.path.dirname(__file__), "..", "tools", "buddy_bridge.py"))
bridge = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bridge)
SERIAL, CODE = "01P00A123456789", "12345678"


class FakeBuddy:
    def __init__(self): self.said, self.sounds = [], []
    def narrate(self, text, kind, jump=None, extra=None): self.said.append((text, kind, extra))
    def sound(self, moment): self.sounds.append(moment)


def config(**printer):
    with open(bridge.CONFIG_FILE, "w") as f:
        json.dump({"printer": printer} if printer else {}, f)


class FakePrinter:
    """Speaks just enough MQTT: checks the CONNECT, answers, records the SUBSCRIBE and the pushall, then sends reports."""
    def __init__(self, code=CODE):
        self.srv = socket.socket(); self.srv.bind(("127.0.0.1", 0)); self.srv.listen(1)
        self.port, self.code, self.got, self.conn = self.srv.getsockname()[1], code, [], None
        self.ready = threading.Event()
        threading.Thread(target=self.serve, daemon=True).start()

    def recv_packet(self, c):
        head = c.recv(1)
        if not head:
            return None, b""
        n, mult = 0, 1
        while True:
            b = c.recv(1)[0]; n += (b & 0x7F) * mult
            if not b & 0x80: break
            mult *= 128
        body = b""
        while len(body) < n: body += c.recv(n - len(body))
        return head[0], body

    def serve(self):
        c, _ = self.srv.accept(); self.conn = c
        kind, body = self.recv_packet(c)
        self.got.append(("connect", body))
        ok = CODE.encode() in body and b"bblp" in body
        c.sendall(bytes([0x20, 2, 0, 0 if self.code == CODE and ok else 5]))
        if self.code != CODE:
            return
        for _ in range(2):
            kind, body = self.recv_packet(c)
            self.got.append((kind >> 4, body))
        self.ready.set()

    def report(self, p):
        payload = json.dumps({"print": p}).encode()
        topic = ("device/%s/report" % SERIAL).encode()
        self.conn.sendall(bridge.mqtt_packet(0x30, len(topic).to_bytes(2, "big") + topic + payload))


class PrinterTest(unittest.TestCase):
    def setUp(self):
        for f in os.listdir(HOME):
            os.remove(os.path.join(HOME, f))
        self.buddy = FakeBuddy()
        self.cfg = {"host": "127.0.0.1", "serial": SERIAL, "code": CODE, "name": "P1S"}

    def watch(self):
        return bridge.PrinterWatch(self.buddy, start=False, wrap=lambda s, cfg: s)

    def test_config_is_checked(self):
        config(host="192.168.1.50", serial="01p00a123456789", access_code=CODE, name="P1S")
        self.assertEqual(bridge.PrinterWatch.config()["serial"], SERIAL)
        for bad in ({"host": "a b", "serial": SERIAL, "access_code": CODE}, {"host": "1.2.3.4", "serial": "x", "access_code": CODE},
                    {"host": "1.2.3.4", "serial": SERIAL, "access_code": ""}):
            config(**bad); self.assertIsNone(bridge.PrinterWatch.config())

    def test_mqtt_conversation_and_alerts(self):
        fake = FakePrinter()
        p = mock_port(fake.port)
        config(host="127.0.0.1", serial=SERIAL, access_code=CODE, name="P1S")
        w = self.watch()
        t = threading.Thread(target=lambda: self._session(w), daemon=True); t.start()
        self.assertTrue(fake.ready.wait(5))
        sub, push = fake.got[1], fake.got[2]
        self.assertEqual(sub[0], 8)                                  # SUBSCRIBE
        self.assertIn(("device/%s/report" % SERIAL).encode(), sub[1])
        self.assertEqual(push[0], 3)                                 # the one PUBLISH: a pushall request
        self.assertIn(b'"pushall"', push[1])
        fake.report({"gcode_state": "RUNNING", "mc_percent": 40, "mc_remaining_time": 75, "layer_num": 80, "total_layer_num": 200,
                     "subtask_name": "Cable clip.3mf", "print_error": 0})
        self.wait(lambda: (read_status() or {}).get("percent") == 40)
        st = read_status()
        self.assertEqual((st["state"], st["job"], st["remaining_min"], st["connection"]), ("RUNNING", "Cable clip", 75, "connected"))
        self.assertNotIn(CODE, json.dumps(st))                       # the access code never lands in the status file
        self.assertEqual(self.buddy.said, [])
        fake.report({"mc_percent": 100})                             # P1 printers send just what changed
        fake.report({"gcode_state": "FINISH"})
        self.wait(lambda: self.buddy.said)
        text, kind, extra = self.buddy.said[0]
        self.assertIn("Cable clip", text); self.assertEqual(kind, "done")
        self.assertEqual(extra["hold"]["mood"], "printdone")
        fake.report({"gcode_state": "FINISH"})                       # still finished: no second alert
        time.sleep(0.3)
        self.assertEqual(len(self.buddy.said), 1)
        config()                                                     # settings gone: the session ends
        p(); fake.conn.close(); fake.srv.close()

    def _session(self, w):
        try:
            w.session(w.config())
        except Exception:
            pass

    def wait(self, ok, secs=5):
        end = time.time() + secs
        while time.time() < end:
            if ok(): return
            time.sleep(0.05)
        self.fail("timed out")

    def test_wrong_access_code(self):
        fake = FakePrinter(code="nope")
        p = mock_port(fake.port)
        config(host="127.0.0.1", serial=SERIAL, access_code=CODE, name="P1S")
        with self.assertRaisesRegex(bridge.PrinterError, "access code"):
            self.watch().session(bridge.PrinterWatch.config())
        p(); fake.conn.close(); fake.srv.close()

    def test_failed_paused_and_cancelled(self):
        w, now = self.watch(), 1_800_000_000
        w.report({"print": {"gcode_state": "RUNNING", "subtask_name": "Bracket", "mc_percent": 10}}, self.cfg, now)
        w.report({"print": {"gcode_state": "PAUSE", "print_error": 0x07008011, "mc_percent": 43}}, self.cfg, now + 60)
        w.report({"print": {"gcode_state": "PAUSE"}}, self.cfg, now + 70)          # same pause: once
        self.assertEqual(len(self.buddy.said), 1)
        self.assertIn("0700_8011", self.buddy.said[0][0]); self.assertEqual(self.buddy.said[0][1], "needs")
        self.assertEqual(self.buddy.said[0][2]["hold"]["mood"], "printfail")
        w.report({"print": {"gcode_state": "RUNNING", "print_error": 0}}, self.cfg, now + 120)
        w.report({"print": {"gcode_state": "FAILED", "print_error": 0x0500C011, "mc_percent": 60}}, self.cfg, now + 180)
        self.assertIn("failed at 60%", self.buddy.said[-1][0]); self.assertEqual(self.buddy.said[-1][2]["hold"]["mood"], "printfail")
        w.report({"print": {"gcode_state": "PREPARE", "subtask_name": "Hook", "print_error": 0}}, self.cfg, now + 300)
        w.report({"print": {"gcode_state": "FAILED", "print_error": 0x0300400C}}, self.cfg, now + 330)
        self.assertIn("cancelled", self.buddy.said[-1][0]); self.assertIsNone(self.buddy.said[-1][2])
        self.assertEqual(self.buddy.sounds, ["print_failed", "print_failed"])

    def test_a_restart_doesnt_repeat_but_catches_up(self):
        config(host="192.168.1.50", serial=SERIAL, access_code=CODE, name="P1S")
        w, now = self.watch(), 1_800_000_000
        w.report({"print": {"gcode_state": "RUNNING", "subtask_name": "Vase", "gcode_start_time": str(now - 3 * 3600)}}, self.cfg, now)
        w2 = self.watch()                                            # the bridge restarted: it reads what it knew
        w2.report({"print": {"gcode_state": "FINISH", "subtask_name": "Vase"}}, self.cfg, now + 600)
        self.assertIn("after 3 h 10 min", self.buddy.said[-1][0])   # finished while it was down: still told
        w3 = self.watch()
        w3.report({"print": {"gcode_state": "FINISH", "subtask_name": "Vase"}}, self.cfg, now + 900)
        self.assertEqual(len(self.buddy.said), 1)                    # already finished last time: nothing new


class PrinterTool(unittest.TestCase):
    """His chat's printer tool (foxtools.py --printer), reading the bridge's printer.json."""
    TOOLS = os.path.join(os.path.dirname(__file__), "..", "tools", "foxbuddy", "foxtools.py")

    def setUp(self):
        spec = importlib.util.spec_from_file_location("foxtools_p", self.TOOLS)
        self.ft = importlib.util.module_from_spec(spec); spec.loader.exec_module(self.ft)
        self.f = os.path.join(tempfile.mkdtemp(), "printer.json")

    def status(self, d, now):
        with open(self.f, "w") as fh:
            json.dump(d, fh)
        return self.ft.printer({}, self.f, now)

    def test_printing_paused_offline_and_unset(self):
        now = 1_800_000_000
        out = self.status({"connection": "connected", "name": "P1S", "heard": now, "state": "RUNNING", "job": "Clip", "percent": 40,
                           "remaining_min": 75, "layer": 80, "total_layers": 200}, now)
        self.assertIn('printing "Clip", 40% done, layer 80 of 200, about 1 h 15 min to go', out)
        out = self.status({"connection": "connected", "name": "P1S", "heard": now, "state": "PAUSE", "job": "Clip", "error": "0700_8011"}, now)
        self.assertIn("paused", out); self.assertIn("0700_8011", out)
        out = self.status({"connection": "can't reach it", "name": "P1S", "heard": now - 3600, "state": "FINISH", "job": "Clip"}, now)
        self.assertIn("isn't connected right now", out); self.assertIn("finished", out)
        self.assertIn("Set Up Printer", self.status({"connection": "off"}, now))
        self.assertIn("No status", self.ft.printer({}, self.f + "-none", now))

    def test_only_listed_with_a_printer(self):
        msgs = [{"jsonrpc": "2.0", "id": 0, "method": "initialize", "params": {}}, {"jsonrpc": "2.0", "id": 1, "method": "tools/list"}]
        def names(*extra):
            import subprocess, sys
            out = subprocess.run([sys.executable, self.TOOLS, *extra], input="\n".join(map(json.dumps, msgs)) + "\n", capture_output=True, text=True, timeout=20).stdout
            return [t["name"] for t in json.loads(out.splitlines()[1])["result"]["tools"]]
        self.assertNotIn("printer", names())
        self.assertIn("printer", names("--printer"))


def read_status():
    try:
        with open(bridge.PRINTER_FILE) as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def mock_port(port):
    old = bridge.PRINTER_PORT
    bridge.PRINTER_PORT = port
    return lambda: setattr(bridge, "PRINTER_PORT", old)


if __name__ == "__main__":
    unittest.main()
