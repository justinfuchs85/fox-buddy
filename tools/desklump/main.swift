// Desktop Lump: the desk Lump, living in a corner of the Mac's screen instead of in a glass prism.
//
// He's the real thing, not a picture of it: design/lump.html draws him (plus design/clip_kit.js and every
// design/clips/*.js) in a transparent web view, and web/desktop.js plays him the way firmware/src/main.cpp
// does on the board. To the bridge he *is* a board: this app listens on 127.0.0.1:4210 and speaks the
// board's line protocol (tools/buddy_bridge.py connects when config.json has "desktop_lump": true), so
// moods, colours, corner counts, gags, sounds and the bridge's automatic clips all work unchanged.
// Without the bridge he goes his own way: asleep, fidgeting, at night under his blanket.
//
// Click him to tap the glass; double-click to ask him a question. Drag him anywhere. Right-click for
// size, look, corner and the clip library. His speech bubble says what Claude is doing (the bridge sends
// "n <json>" lines), with "Show me" to bring that session forward.
// Clicks on the empty space around him go through to whatever is underneath.
// Build and launch: zsh tools/desklump/build.sh

import Cocoa
import Network
import ServiceManagement
import WebKit

let BOARD_PORT: UInt16 = 4210
let BRIDGE = "http://127.0.0.1:47823"
let SIZES: [(String, CGFloat)] = [("Small", 120), ("Medium", 170), ("Large", 240), ("Huge", 340)]
let LOOKS: [(String, String)] = [("float", "Floating"), ("ink", "Floating, Dark Outline"), ("glass", "Glass Screen (Like the Desk Lump)")]
let GAGS = ["shock", "moto", "wolf", "accordion", "anvil", "disco", "banana", "balloon", "sneeze", "moon", "bomb"]
let CHARACTERS: [(String, String)] = [("lump", "Lump"), ("fox", "Fox")]
/// What each character is made of: its page and the scripts that draw it (from the app's web folder).
let CHARACTER_FILES: [String: (page: String, scripts: [String])] = [
    "lump": ("lump.html", ["clip_kit.js", "clips.bundle.js"]),
    "fox": ("fox/fox.html", ["fox/fox.js", "fox/rig.js", "fox/character.js"]),
]
let MARGIN: CGFloat = 12

// MARK: - the board's socket

/// Listens where the bridge looks for a Lump on the network, for one bridge at a time, on this Mac only.
///
/// A newcomer has to open with the board's pairing line ("k ...", which the bridge always sends first)
/// within a few seconds before it's listened to or allowed to replace the current bridge. Anything else
/// is hung up on, which matters because a web page can make the browser send an HTTP request to
/// 127.0.0.1:4210: its first line is "POST / HTTP/1.1", so it never gets as far as Lump.
final class BoardLink {
    var onLine: ((String) -> Void)?
    var onChange: ((Bool) -> Void)?
    private var listener: NWListener?
    private var conn: NWConnection?
    private var buffer = Data()
    private let queue = DispatchQueue(label: "desklump.link")
    private(set) var connected = false { didSet { let c = connected; DispatchQueue.main.async { self.onChange?(c) } } }

    func start() {
        let params = NWParameters.tcp
        params.allowLocalEndpointReuse = true
        params.requiredLocalEndpoint = NWEndpoint.hostPort(host: "127.0.0.1", port: NWEndpoint.Port(rawValue: BOARD_PORT)!)
        do { listener = try NWListener(using: params) } catch {
            NSLog("desklump: can't listen on 127.0.0.1:\(BOARD_PORT): \(error)"); return
        }
        listener?.newConnectionHandler = { [weak self] c in self?.accept(c) }
        listener?.stateUpdateHandler = { [weak self] st in
            if case .failed(let e) = st {
                NSLog("desklump: listener failed: \(e); retrying in 5 s")
                self?.listener?.cancel()
                self?.queue.asyncAfter(deadline: .now() + 5) { self?.start() }
            }
        }
        listener?.start(queue: queue)
    }

    private func accept(_ c: NWConnection) {
        c.start(queue: queue)
        queue.asyncAfter(deadline: .now() + 3) { [weak self, weak c] in      // no pairing line in time: hang up
            guard let self = self, let c = c, c !== self.conn else { return }
            c.cancel()
        }
        awaitPairing(c, Data())
    }

    /// Read the newcomer's first line. Only "k" or "k <token>" makes it the bridge.
    private func awaitPairing(_ c: NWConnection, _ got: Data) {
        c.receive(minimumIncompleteLength: 1, maximumLength: 256) { [weak self] data, _, done, err in
            guard let self = self else { return }
            var buf = got
            if let d = data { buf.append(d) }
            if let nl = buf.firstIndex(of: 0x0A) {
                let first = String(data: buf[buf.startIndex..<nl], encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                guard first == "k" || first.hasPrefix("k ") else { c.cancel(); return }
                self.promote(c, rest: Data(buf[buf.index(after: nl)...]), pairing: first)
                return
            }
            if done || err != nil || buf.count > 200 { c.cancel(); return }
            self.awaitPairing(c, buf)
        }
    }

    private func promote(_ c: NWConnection, rest: Data, pairing: String) {
        conn?.cancel()                              // a newer bridge (it restarted): that one wins
        conn = c; buffer = Data()
        c.stateUpdateHandler = { [weak self, weak c] st in
            guard let self = self, let c = c, c === self.conn else { return }
            if case .failed = st { self.conn = nil; self.connected = false }
            if case .cancelled = st { self.conn = nil; self.connected = false }
        }
        connected = true
        DispatchQueue.main.async { self.onLine?(pairing) }
        if !rest.isEmpty { buffer = rest; drain() }
        receive(c)
    }

    private func drain() {
        while let nl = buffer.firstIndex(of: 0x0A) {
            let lineData = buffer[buffer.startIndex..<nl]
            buffer = Data(buffer[buffer.index(after: nl)...])
            if let s = String(data: lineData, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines), !s.isEmpty {
                DispatchQueue.main.async { self.onLine?(s) }
            }
        }
        if buffer.count > 4096 { buffer = Data() }     // nothing the bridge says is that long
    }

    private func receive(_ c: NWConnection) {
        c.receive(minimumIncompleteLength: 1, maximumLength: 8192) { [weak self] data, _, done, err in
            guard let self = self else { return }
            guard c === self.conn else { c.cancel(); return }      // replaced by a newer bridge meanwhile
            if let d = data, !d.isEmpty {
                self.buffer.append(d)
                self.drain()
            }
            if done || err != nil {
                c.cancel()
                if c === self.conn { self.conn = nil; self.connected = false }
                return
            }
            self.receive(c)
        }
    }

    func send(_ line: String) {
        let line = line.replacingOccurrences(of: "\r", with: " ").replacingOccurrences(of: "\n", with: " ")   // always exactly one line
        queue.async { self.conn?.send(content: (line + "\n").data(using: .utf8), completion: .contentProcessed { _ in }) }
    }
}

// MARK: - the window

/// Sits on top of the web view and takes every click: a click is a tap, a drag moves him.
final class GrabView: NSView {
    var onTap: (() -> Void)?
    var onDoubleClick: (() -> Void)?
    var onMenu: ((NSEvent) -> Void)?
    private var pendingTap: DispatchWorkItem?
    var onMoved: (() -> Void)?
    var dragging = false
    private var downAt = NSPoint.zero, startOrigin = NSPoint.zero

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    override func hitTest(_ point: NSPoint) -> NSView? { frame.contains(point) ? self : nil }
    override func resetCursorRects() { addCursorRect(bounds, cursor: .openHand) }

    override func mouseDown(with e: NSEvent) {
        if e.modifierFlags.contains(.control) { onMenu?(e); return }
        downAt = NSEvent.mouseLocation; startOrigin = window?.frame.origin ?? .zero; dragging = false
    }
    override func mouseDragged(with e: NSEvent) {
        let p = NSEvent.mouseLocation, dx = p.x - downAt.x, dy = p.y - downAt.y
        if !dragging && hypot(dx, dy) < 4 { return }
        if !dragging { dragging = true; NSCursor.closedHand.push() }
        window?.setFrameOrigin(NSPoint(x: startOrigin.x + dx, y: startOrigin.y + dy))
    }
    override func mouseUp(with e: NSEvent) {
        if e.modifierFlags.contains(.control) { return }
        if dragging { dragging = false; NSCursor.pop(); onMoved?(); return }
        // one click is a tap, two ask a question: wait a double-click's length before tapping
        pendingTap?.cancel(); pendingTap = nil
        if e.clickCount >= 2 { onDoubleClick?(); return }
        let tap = DispatchWorkItem { [weak self] in self?.onTap?() }
        pendingTap = tap
        DispatchQueue.main.asyncAfter(deadline: .now() + NSEvent.doubleClickInterval, execute: tap)
    }
    override func rightMouseDown(with e: NSEvent) { onMenu?(e) }
}

final class LumpPanel: NSPanel {
    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }
}

// MARK: - the speech bubble

/// The bubble's own small window, beside him. Unlike his, it can take the keyboard (for typing a
/// question) without making Desktop Lump the active app, like Spotlight's.
final class BubblePanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
}

/// Chats with Claude Code in print mode (claude -p), with every tool switched off: it can only reply,
/// never run a command or touch a file. The first message starts a conversation with an id we choose
/// (--session-id); every message after continues it (--resume), until "New chat". Conversations are
/// kept by Claude Code under ~/.desk-buddy/ask (their own folder, so they stay out of your projects'
/// histories), which the bridge knows not to narrate.
final class Asker {
    private var running: Process?
    private var session: String?          // the conversation so far (nil: the next message starts one)
    func reset() { cancel(); session = nil }
    private lazy var claudePath: String? = Asker.findClaude()

    static func findClaude() -> String? {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        for p in ["\(home)/.claude/local/claude", "\(home)/.local/bin/claude", "/opt/homebrew/bin/claude", "/usr/local/bin/claude"]
            where FileManager.default.isExecutableFile(atPath: p) { return p }
        // wherever your login shell finds it
        let sh = Process(), out = Pipe()
        sh.executableURL = URL(fileURLWithPath: "/bin/zsh")
        sh.arguments = ["-lc", "command -v claude"]
        sh.standardOutput = out; sh.standardError = FileHandle.nullDevice; sh.standardInput = FileHandle.nullDevice
        do { try sh.run() } catch { return nil }
        let data = out.fileHandleForReading.readDataToEndOfFile()
        sh.waitUntilExit()
        let path = (String(data: data, encoding: .utf8) ?? "").split(separator: "\n").last.map { String($0).trimmingCharacters(in: .whitespaces) } ?? ""
        return path.hasPrefix("/") && FileManager.default.isExecutableFile(atPath: path) ? path : nil
    }

    func ask(_ question: String, done: @escaping (String, Bool) -> Void) {
        cancel()
        guard let claude = claudePath else {
            done("I answer questions with Claude Code, and I can't find it on this Mac. Install it (claude.com/claude-code), then ask me again.", false); return
        }
        let dir = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".desk-buddy/ask")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        let p = Process(), out = Pipe(), err = Pipe()
        let resuming = session != nil, id = session ?? UUID().uuidString.lowercased()
        p.executableURL = URL(fileURLWithPath: claude)
        p.arguments = ["-p", question, "--tools", "", "--output-format", "text"] + (resuming ? ["--resume", id] : ["--session-id", id]) +
                      ["--append-system-prompt", "You're chatting through a small speech bubble beside a cartoon fox on the user's desktop. Keep replies short and conversational: a few sentences or a short list, under 150 words, unless they ask for more."]
        p.currentDirectoryURL = dir
        var env = ProcessInfo.processInfo.environment
        env["PATH"] = (env["PATH"] ?? "/usr/bin:/bin") + ":/opt/homebrew/bin:/usr/local/bin"
        p.environment = env
        p.standardOutput = out; p.standardError = err; p.standardInput = FileHandle.nullDevice
        running = p
        DispatchQueue.global().async {
            do { try p.run() } catch {
                DispatchQueue.main.async { if self.running === p { self.running = nil; done("Couldn't start Claude Code: \(error.localizedDescription)", false) } }
                return
            }
            var timedOut = false
            let giveUp = DispatchWorkItem { if p.isRunning { timedOut = true; p.terminate() } }
            DispatchQueue.global().asyncAfter(deadline: .now() + 120, execute: giveUp)
            var errData = Data()
            let errDone = DispatchSemaphore(value: 0)
            DispatchQueue.global().async { errData = err.fileHandleForReading.readDataToEndOfFile(); errDone.signal() }
            let outData = out.fileHandleForReading.readDataToEndOfFile()
            errDone.wait()
            p.waitUntilExit(); giveUp.cancel()
            let text = String(data: outData, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let problem = String(data: errData, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            DispatchQueue.main.async {
                guard self.running === p else { return }          // cancelled, or a newer question took over
                self.running = nil
                // (Claude Code's launcher can turn the stop signal into exit code 143, so go by why we stopped it)
                if timedOut { done("Claude Code hadn't answered after 2 minutes, so I stopped it. It may be stuck: try the same question in Terminal with `claude -p \"…\"` to see what it's waiting for.", false) }
                else if p.terminationReason == .uncaughtSignal || p.terminationStatus == 143 { done("Claude Code was stopped before it answered.", false) }
                else if p.terminationStatus == 0 && !text.isEmpty { self.session = id; done(text, true) }
                else {
                    // In print mode Claude Code reports most problems on stdout ("Invalid API key · Please run /login"),
                    // so show whichever stream says something, and add the fix for the usual one.
                    let said = [problem, text].first { !$0.isEmpty } ?? ""
                    var msg = said.isEmpty ? "Claude Code didn't answer (it exited with \(p.terminationStatus))." : String(said.prefix(300))
                    if resuming && said.lowercased().contains("no conversation found") {
                        self.session = nil                        // the conversation's gone: the next message starts a new one
                        msg += "\n\nThat conversation is gone, so your next message starts a new one."
                    }
                    if said.lowercased().contains("login") || said.lowercased().contains("api key") || said.lowercased().contains("auth") {
                        msg += "\n\nTo fix it, open Terminal, run `claude`, and type `/login` to sign in."
                    }
                    done(msg, false)
                }
            }
        }
    }

    func cancel() {
        if let p = running, p.isRunning { p.terminate() }
        running = nil
    }
}

/// The bubble's window level: one above his, so he never covers it.
let BUBBLE_LEVEL = NSWindow.Level(rawValue: NSWindow.Level.floating.rawValue + 1)
/// The tallest the bubble gets (its thread scrolls inside).
let BUBBLE_MAX_H: CGFloat = 560

/// TERM_PROGRAM names (what the hook sends when there's no bundle id) to the apps they mean.
let TERMINAL_APPS: [String: String] = [
    "Apple_Terminal": "com.apple.Terminal", "iTerm.app": "com.googlecode.iterm2", "vscode": "com.microsoft.VSCode",
    "WarpTerminal": "dev.warp.Warp-Stable", "ghostty": "com.mitchellh.ghostty", "WezTerm": "com.github.wez.wezterm",
]

// MARK: - app

final class App: NSObject, NSApplicationDelegate, NSMenuDelegate, WKScriptMessageHandler, WKNavigationDelegate {
    let link = BoardLink()
    var panel: LumpPanel!
    var web: WKWebView!
    var grab: GrabView!
    var ready = false
    var queued: [String] = []
    var clips: [String] = []
    var gags: [String] = GAGS               // the character's own tap gags, as it reports them
    var webDir: URL!
    var hoverTimer: Timer?
    var hiddenByUser = false
    var bridgeConnected = false         // the link's state, kept on the main thread
    var bubble: BubblePanel!
    var bubbleWeb: WKWebView!
    var bubbleReady = false
    var bubbleQueue: [String] = []
    var bubbleSize = NSSize(width: 324, height: 90)
    var bubbleMode = "none"             // none | say (a line about Claude) | chat (talking with him)
    var bubbleJump: [String: Any]?
    var bubbleKind = ""                 // what the bubble is saying now: working | needs | done | info
    var bubblePlaced = ""
    var offlineRules: WKContentRuleList?
    let asker = Asker()
    let prefs = UserDefaults.standard

    var side: CGFloat {
        get { let v = prefs.double(forKey: "side"); return v > 0 ? CGFloat(v) : 170 }
        set { prefs.set(Double(newValue), forKey: "side") }
    }
    var look: String {                  // only ever one of LOOKS: it's put into a line of JavaScript
        get { let v = prefs.string(forKey: "look") ?? "float"; return LOOKS.contains { $0.0 == v } ? v : "float" }
        set { prefs.set(newValue, forKey: "look") }
    }
    var onDesktop: Bool {               // behind other windows, on the desktop itself, rather than floating above them
        get { prefs.bool(forKey: "onDesktop") }
        set { prefs.set(newValue, forKey: "onDesktop") }
    }
    var character: String {             // who's in the window: "lump" or "fox"
        get { let v = prefs.string(forKey: "character") ?? "lump"; return CHARACTER_FILES[v] == nil ? "lump" : v }
        set { prefs.set(newValue, forKey: "character") }
    }
    var narrate: String {               // what the bubble says about Claude: "all", "important" (needs you / done) or "off"
        get { let v = prefs.string(forKey: "narrate") ?? "all"; return ["all", "important", "off"].contains(v) ? v : "all" }
        set { prefs.set(newValue, forKey: "narrate") }
    }
    var snap: Bool {                    // after a drag, slide into the nearest corner
        get { prefs.object(forKey: "snap") == nil ? true : prefs.bool(forKey: "snap") }
        set { prefs.set(newValue, forKey: "snap") }
    }

    func applicationDidFinishLaunching(_ n: Notification) {
        guard let webDir = Bundle.main.url(forResource: "web", withExtension: nil) else {
            NSLog("desklump: no web folder in the app bundle (build it with tools/desklump/build.sh)"); NSApp.terminate(nil); return
        }
        self.webDir = webDir
        makeWindow(webDir)
        link.onLine = { [weak self] line in
            if line.hasPrefix("n ") { self?.narration(String(line.dropFirst(2))) } else { self?.toLump(line) }
        }
        link.onChange = { [weak self] on in self?.bridgeConnected = on }
        link.start()
        NotificationCenter.default.addObserver(self, selector: #selector(screensChanged), name: NSApplication.didChangeScreenParametersNotification, object: nil)
        // Let clicks through wherever he isn't: check what's under the pointer while it's over the window.
        hoverTimer = Timer(timeInterval: 0.08, repeats: true) { [weak self] _ in self?.hover() }
        RunLoop.main.add(hoverTimer!, forMode: .common)
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        hiddenByUser = false; panel.orderFrontRegardless(); return false      // opening the app again brings him back
    }

    // MARK: window

    func makeWindow(_ webDir: URL) {
        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "lump")

        let frame = NSRect(origin: savedOrigin() ?? cornerOrigin("BR"), size: NSSize(width: side, height: side))
        panel = LumpPanel(contentRect: frame, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.isMovable = false                 // GrabView moves him (so a click can still be a tap)
        panel.hidesOnDeactivate = false
        panel.isReleasedWhenClosed = false
        panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle, .fullScreenAuxiliary]
        applyLayer()

        let content = NSView(frame: NSRect(origin: .zero, size: frame.size))
        web = WKWebView(frame: content.bounds, configuration: config)
        web.autoresizingMask = [.width, .height]
        web.setValue(false, forKey: "drawsBackground")
        if #available(macOS 12.0, *) { web.underPageBackgroundColor = .clear }
        content.addSubview(web)

        grab = GrabView(frame: content.bounds)
        grab.autoresizingMask = [.width, .height]
        grab.onTap = { [weak self] in self?.js("desk.tap()") }
        grab.onDoubleClick = { [weak self] in self?.openAsk() }
        grab.onMenu = { [weak self] e in guard let self = self else { return }; NSMenu.popUpContextMenu(self.menu(), with: e, for: self.grab) }
        grab.onMoved = { [weak self] in self?.moved() }
        content.addSubview(grab)
        panel.contentView = content

        web.navigationDelegate = self
        // Lump is drawn entirely from files inside the app: block every web request (lump.html links to
        // Google Fonts, which build.sh also strips), so the app never contacts anything on the internet.
        let rules = #"[{"trigger":{"url-filter":"^(https?|wss?|ftp)://"},"action":{"type":"block"}}]"#
        WKContentRuleListStore.default().compileContentRuleList(forIdentifier: "desklump-offline", encodedContentRuleList: rules) { [weak self] list, err in
            guard let self = self else { return }
            if let list = list { self.web.configuration.userContentController.add(list); self.offlineRules = list }
            else { NSLog("desklump: couldn't install the offline rule: \(String(describing: err))") }
            self.loadCharacter()
            self.makeBubble()
        }
        clampOnScreen()
        panel.orderFrontRegardless()
    }

    /// (Re)load the page with the chosen character's scripts. He comes up offline and asks the bridge
    /// to resend everything ("resync") as soon as it next says anything, so switching loses nothing.
    func loadCharacter() {
        guard let files = CHARACTER_FILES[character] else { return }
        let uc = web.configuration.userContentController
        uc.removeAllUserScripts()
        func script(_ name: String, _ when: WKUserScriptInjectionTime) {
            guard let src = try? String(contentsOf: webDir.appendingPathComponent(name), encoding: .utf8) else { NSLog("desklump: missing \(name)"); return }
            uc.addUserScript(WKUserScript(source: src, injectionTime: when, forMainFrameOnly: true))
        }
        script("start.js", .atDocumentStart)
        files.scripts.forEach { script($0, .atDocumentEnd) }
        script("desktop.js", .atDocumentEnd)
        ready = false; queued.removeAll()
        web.loadFileURL(webDir.appendingPathComponent(files.page), allowingReadAccessTo: webDir)
    }

    func applyLayer() {
        // On the desktop: just above the desktop icons, so ordinary windows cover him like they'd cover a widget.
        panel.level = onDesktop ? NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopIconWindow)) + 1) : .floating
        bubble?.level = BUBBLE_LEVEL             // his bubble always floats, above him, even when he sits on the desktop
    }

    func visibleFrame(for point: NSPoint? = nil) -> NSRect {
        let p = point ?? NSPoint(x: panel?.frame.midX ?? 0, y: panel?.frame.midY ?? 0)
        let s = NSScreen.screens.first(where: { $0.frame.contains(p) }) ?? NSScreen.main ?? NSScreen.screens[0]
        return s.visibleFrame
    }

    func cornerOrigin(_ c: String, on vf: NSRect? = nil) -> NSPoint {
        let f = vf ?? (NSScreen.main ?? NSScreen.screens[0]).visibleFrame
        let x = c.hasSuffix("L") ? f.minX + MARGIN : f.maxX - side - MARGIN
        let y = c.hasPrefix("T") ? f.maxY - side - MARGIN : f.minY + MARGIN
        return NSPoint(x: x, y: y)
    }

    func savedOrigin() -> NSPoint? {
        guard prefs.object(forKey: "x") != nil else { return nil }
        return NSPoint(x: prefs.double(forKey: "x"), y: prefs.double(forKey: "y"))
    }
    func saveOrigin() { prefs.set(Double(panel.frame.minX), forKey: "x"); prefs.set(Double(panel.frame.minY), forKey: "y"); placeBubble() }

    func moved() {
        if snap {
            let f = visibleFrame(), mid = NSPoint(x: panel.frame.midX, y: panel.frame.midY)
            let c = (mid.y > f.midY ? "T" : "B") + (mid.x < f.midX ? "L" : "R")
            moveTo(cornerOrigin(c, on: f), animate: true)
        } else { clampOnScreen(); saveOrigin() }
    }

    func moveTo(_ origin: NSPoint, animate: Bool) {
        let target = NSRect(origin: origin, size: panel.frame.size)
        if animate {
            NSAnimationContext.runAnimationGroup({ ctx in ctx.duration = 0.22; panel.animator().setFrame(target, display: true) },
                                                 completionHandler: { self.saveOrigin() })
        } else { panel.setFrame(target, display: true); saveOrigin() }
    }

    /// Keep him wholly on a screen (a monitor was unplugged, or he was dragged half off).
    func clampOnScreen() {
        let f = visibleFrame(), r = panel.frame
        let x = min(max(r.minX, f.minX), f.maxX - r.width), y = min(max(r.minY, f.minY), f.maxY - r.height)
        if x != r.minX || y != r.minY { panel.setFrameOrigin(NSPoint(x: x, y: y)) }
        saveOrigin()
    }
    @objc func screensChanged() { clampOnScreen() }

    func hover() {
        guard let panel = panel, panel.isVisible, ready else { return }
        if grab.dragging { panel.ignoresMouseEvents = false; return }
        let p = NSEvent.mouseLocation, f = panel.frame
        guard f.contains(p) else { if !panel.ignoresMouseEvents { panel.ignoresMouseEvents = true }; return }
        let x = p.x - f.minX, y = f.maxY - p.y
        web.evaluateJavaScript("desk.hit(\(x), \(y))") { r, _ in
            let over = (r as? Bool) ?? true
            if panel.ignoresMouseEvents == over { panel.ignoresMouseEvents = !over }
        }
    }

    /// The page never goes anywhere: anything but the bundled files is refused.
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        decisionHandler(action.request.url?.isFileURL == true ? .allow : .cancel)
    }

    // MARK: talking to Lump

    func js(_ code: String) { web.evaluateJavaScript(code, completionHandler: nil) }

    func toLump(_ line: String) {
        let quoted = (try? String(data: JSONSerialization.data(withJSONObject: [line]), encoding: .utf8)) ?? "[\"\"]"
        let call = "desk.line(\(quoted)[0])"
        if ready { js(call) } else { queued.append(call) }
    }

    func userContentController(_ uc: WKUserContentController, didReceive m: WKScriptMessage) {
        guard let body = m.body as? [String: Any] else { return }
        if m.name == "bubble" { fromBubble(body); return }
        if let s = body["say"] as? String { link.send(s) }
        if body["ready"] as? Bool == true {
            ready = true
            clips = (body["clips"] as? [String]) ?? []
            gags = (body["gags"] as? [String]) ?? GAGS
            publishClips()
            js("desk.setLook('\(look)')")
            queued.forEach(js); queued.removeAll()
        }
    }

    /// Tell the bridge which clips live in here (it plays them by name, as it would send them to the board).
    func publishClips() {
        let dir = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".desk-buddy")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        if let data = try? JSONSerialization.data(withJSONObject: ["clips": clips], options: [.prettyPrinted]) {
            try? data.write(to: dir.appendingPathComponent("desktop_clips.json"), options: .atomic)
        }
    }

    /// Ask the bridge to play something (so it gets its sound, and counts as his thing for the minute);
    /// if the bridge isn't there, he plays it himself.
    func play(_ name: String) {
        guard bridgeConnected, let url = URL(string: BRIDGE + "/play") else { toLump("e " + name); return }
        var req = URLRequest(url: url); req.httpMethod = "POST"; req.httpBody = name.data(using: .utf8); req.timeoutInterval = 3
        URLSession.shared.dataTask(with: req) { _, resp, err in
            let ok = (resp as? HTTPURLResponse)?.statusCode == 200
            if !ok || err != nil { DispatchQueue.main.async { self.toLump("e " + name) } }
        }.resume()
    }

    // MARK: menu

    func item(_ title: String, _ action: Selector?, on: Bool = false, rep: Any? = nil, key: String = "") -> NSMenuItem {
        let it = NSMenuItem(title: title, action: action, keyEquivalent: key)
        it.target = self; it.state = on ? .on : .off; it.representedObject = rep; it.isEnabled = action != nil
        return it
    }
    func sub(_ title: String, _ items: [NSMenuItem]) -> NSMenuItem {
        let m = NSMenu(); items.forEach { m.addItem($0) }
        let it = NSMenuItem(title: title, action: nil, keyEquivalent: ""); it.submenu = m
        return it
    }
    func pretty(_ s: String) -> String { s.replacingOccurrences(of: "_", with: " ").capitalized }

    func menu() -> NSMenu {
        let m = NSMenu()
        m.addItem(item(bridgeConnected ? "Connected to the bridge" : "On his own (the bridge isn't connected)", nil))
        m.addItem(.separator())
        m.addItem(item("Ask a Question… (or Double-Click Him)", #selector(askFromMenu)))
        let talk = [("all", "Everything Claude Does"), ("important", "Only When Claude Needs Me or Finishes"), ("off", "Nothing")]
        m.addItem(sub("Speech Bubble", talk.map { item($0.1, #selector(pickNarrate(_:)), on: narrate == $0.0, rep: $0.0) }))
        m.addItem(.separator())
        m.addItem(item("Tap", #selector(tapNow)))
        var gagItems = [item("A Random Gag", #selector(playNamed(_:)), rep: "tap"), NSMenuItem.separator()]
        // Lump's gags go through the bridge by name (so they get their sounds); other characters play theirs as tap_<gag>
        gagItems += gags.map { item(pretty($0), #selector(playNamed(_:)), rep: character == "lump" ? $0 : "tap_" + $0) }
        m.addItem(sub("Gags", gagItems))
        var clipItems = [item("Surprise Me", #selector(playRandomClip)), NSMenuItem.separator()]
        clipItems += clips.map { item(pretty($0), #selector(playNamed(_:)), rep: $0) }
        m.addItem(sub("Clips (\(clips.count))", clipItems))
        m.addItem(item("Show Off (Every Mood, on a Loop)", #selector(demo)))
        m.addItem(.separator())
        m.addItem(sub("Character", CHARACTERS.map { item($0.1, #selector(pickCharacter(_:)), on: character == $0.0, rep: $0.0) }))
        m.addItem(sub("Size", SIZES.map { item($0.0, #selector(pickSize(_:)), on: abs(side - $0.1) < 1, rep: $0.1) }))
        m.addItem(sub("Look", LOOKS.map { item($0.1, #selector(pickLook(_:)), on: look == $0.0, rep: $0.0) }))
        let corners = [("Top Left", "TL"), ("Top Right", "TR"), ("Bottom Left", "BL"), ("Bottom Right", "BR")]
        m.addItem(sub("Move to", corners.map { item($0.0, #selector(pickCorner(_:)), rep: $0.1) }
                       + [NSMenuItem.separator(), item("Snap to Corners After Dragging", #selector(toggleSnap), on: snap)]))
        m.addItem(item("Float Above Windows", #selector(toggleLayer), on: !onDesktop))
        if #available(macOS 13.0, *) {
            m.addItem(item("Open at Login", #selector(toggleLogin), on: SMAppService.mainApp.status == .enabled))
        }
        m.addItem(.separator())
        m.addItem(item("Hide (Open Desktop Lump Again to Bring Him Back)", #selector(hideHim)))
        m.addItem(item("Quit Desktop Lump", #selector(quit), key: "q"))
        return m
    }

    @objc func tapNow() { js("desk.tap()") }
    @objc func playNamed(_ s: NSMenuItem) { if let n = s.representedObject as? String { play(n) } }
    @objc func playRandomClip() { if let n = clips.randomElement() { play(n) } }
    @objc func demo() { toLump("s demo") }
    @objc func pickSize(_ s: NSMenuItem) {
        guard let v = s.representedObject as? CGFloat else { return }
        let old = panel.frame
        side = v
        // grow or shrink about whichever corner he's nearest, so he stays tucked into it
        let f = visibleFrame(), right = old.midX > f.midX, top = old.midY > f.midY
        let x = right ? old.maxX - v : old.minX, y = top ? old.maxY - v : old.minY
        panel.setFrame(NSRect(x: x, y: y, width: v, height: v), display: true)
        clampOnScreen()
    }
    @objc func pickLook(_ s: NSMenuItem) { if let v = s.representedObject as? String { look = v; js("desk.setLook('\(look)')") } }
    @objc func pickCharacter(_ s: NSMenuItem) {
        guard let v = s.representedObject as? String, v != character, CHARACTER_FILES[v] != nil else { return }
        character = v; loadCharacter()
    }
    @objc func pickCorner(_ s: NSMenuItem) { if let c = s.representedObject as? String { moveTo(cornerOrigin(c, on: visibleFrame()), animate: true) } }
    @objc func toggleSnap() { snap.toggle(); if snap { moved() } }
    @objc func toggleLayer() { onDesktop.toggle(); applyLayer(); panel.orderFrontRegardless() }
    @objc func toggleLogin() {
        if #available(macOS 13.0, *) {
            do {
                if SMAppService.mainApp.status == .enabled { try SMAppService.mainApp.unregister() } else { try SMAppService.mainApp.register() }
            } catch { NSLog("desklump: login item: \(error)") }
        }
    }
    @objc func hideHim() { hiddenByUser = true; panel.orderOut(nil); hideBubble() }
    @objc func askFromMenu() { openAsk() }
    @objc func pickNarrate(_ s: NSMenuItem) {
        guard let v = s.representedObject as? String else { return }
        narrate = v
        if v == "off" && bubbleMode == "say" { hideBubble() }
    }

    // MARK: the bubble

    func makeBubble() {
        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "bubble")
        if let rules = offlineRules { config.userContentController.add(rules) }
        bubble = BubblePanel(contentRect: NSRect(origin: .zero, size: NSSize(width: 324, height: BUBBLE_MAX_H)),
                             styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: true)
        bubble.isOpaque = false
        bubble.backgroundColor = .clear
        bubble.hasShadow = false
        bubble.hidesOnDeactivate = false
        bubble.isReleasedWhenClosed = false
        bubble.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle, .fullScreenAuxiliary]
        bubble.level = BUBBLE_LEVEL
        bubbleWeb = WKWebView(frame: NSRect(x: 0, y: 0, width: 324, height: BUBBLE_MAX_H), configuration: config)
        bubbleWeb.autoresizingMask = [.width, .height]
        bubbleWeb.setValue(false, forKey: "drawsBackground")
        if #available(macOS 12.0, *) { bubbleWeb.underPageBackgroundColor = .clear }
        bubbleWeb.navigationDelegate = self
        bubble.contentView = bubbleWeb
        bubbleWeb.loadFileURL(webDir.appendingPathComponent("bubble.html"), allowingReadAccessTo: webDir)
    }

    func bubbleJS(_ code: String) {
        if bubbleReady { bubbleWeb.evaluateJavaScript(code, completionHandler: nil) } else { bubbleQueue.append(code) }
    }
    func jsonLiteral(_ v: Any) -> String {
        guard let d = try? JSONSerialization.data(withJSONObject: [v]), let s = String(data: d, encoding: .utf8) else { return "null" }
        return "\(s)[0]"
    }

    /// A line from the bridge about what Claude is doing.
    func narration(_ json: String) {
        guard let data = json.data(using: .utf8), let n = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let text = n["text"] as? String, !text.isEmpty else { return }
        let kind = (n["kind"] as? String) ?? "info"
        if narrate == "off" { return }
        if narrate == "important" && kind == "working" {
            if bubbleMode == "say" && bubbleKind == "needs" { hideBubble() }      // Claude's moving again: that's been dealt with
            return
        }
        if bubbleMode == "chat" || hiddenByUser || bubble == nil { return }   // you're talking with him: don't interrupt
        bubbleJump = n["jump"] as? [String: Any]
        bubbleKind = kind
        bubbleMode = "say"
        let show: [String: Any] = ["text": String(text.prefix(300)), "kind": kind, "jump": bubbleJump != nil]
        bubbleJS("bubble.show(\(jsonLiteral(show)))")
        showBubble(key: false)
    }

    func openAsk() {
        guard bubble != nil else { return }
        bubbleMode = "chat"; bubbleJump = nil
        bubbleJS("bubble.chat()")
        showBubble(key: true)
    }

    func showBubble(key: Bool) {
        placeBubble()
        if key { bubble.makeKeyAndOrderFront(nil); bubble.makeFirstResponder(bubbleWeb) } else { bubble.orderFrontRegardless() }
    }

    func hideBubble() {
        bubbleMode = "none"; bubbleJump = nil          // (a reply still on its way pops the chat back open)
        bubble?.orderOut(nil)
    }

    /// Where his bubble goes: above him if it fits, else below him, else beside him (towards the middle of
    /// the screen), and never over him. The thread inside scrolls to fit the room there is.
    func placeBubble() {
        guard let bubble = bubble, let panel = panel else { return }
        let f = panel.frame, vf = visibleFrame(), w = bubbleSize.width
        let right = f.midX > vf.midX
        let roomAbove = vf.maxY - (f.maxY - 10), roomBelow = (f.minY + 10) - vf.minY, roomBeside = vf.height - 8
        let h = bubbleSize.height
        var x: CGFloat, y: CGFloat, spot: String
        if h <= roomAbove { spot = "above"; y = f.maxY - 10 }
        else if h <= roomBelow { spot = "below"; y = f.minY + 10 - h }
        else { spot = "beside"; y = f.minY }
        if spot == "beside" { x = right ? f.minX - w + 16 : f.maxX - 16 }
        else { x = right ? f.maxX - w + 10 : f.minX - 10 }
        x = min(max(x, vf.minX + 4), vf.maxX - w - 4)
        y = min(max(y, vf.minY + 4), vf.maxY - h - 4)
        bubble.setFrame(NSRect(x: x, y: y, width: w, height: h), display: true)
        // tell the page which way the tail points and how tall it may grow here
        let room = Int(spot == "above" ? roomAbove : spot == "below" ? roomBelow : roomBeside)
        let place = "\(right ? "right" : "left") \(spot) \(room)"
        if place != bubblePlaced { bubblePlaced = place; bubbleJS("bubble.place('\(right ? "right" : "left")', '\(spot)', \(min(room, Int(BUBBLE_MAX_H))))") }
    }

    func fromBubble(_ body: [String: Any]) {
        if let size = body["size"] as? [String: Any], let w = (size["w"] as? NSNumber)?.doubleValue, let h = (size["h"] as? NSNumber)?.doubleValue {
            if !bubbleReady { bubbleReady = true; bubbleQueue.forEach { bubbleWeb.evaluateJavaScript($0, completionHandler: nil) }; bubbleQueue.removeAll() }
            bubbleSize = NSSize(width: max(200, min(w, 420)), height: max(40, min(h, BUBBLE_MAX_H)))
            if bubble.isVisible { placeBubble() }
        }
        if let action = body["action"] as? String {
            if action == "jump" { jump(bubbleJump) }
            if action == "dismiss" || action == "jump" { hideBubble() }
        }
        if let q = body["ask"] as? String, !q.isEmpty {
            let question = String(q.prefix(4000))
            bubbleJS("bubble.thinking(\(jsonLiteral(question)))")
            asker.ask(question) { [weak self] text, ok in
                guard let self = self else { return }
                self.bubbleJS(ok ? "bubble.answer(\(self.jsonLiteral(text)))" : "bubble.error(\(self.jsonLiteral(text)))")
                if self.bubbleMode != "chat" && !self.hiddenByUser {          // closed it while he was thinking: show the reply
                    self.bubbleMode = "chat"; self.bubbleJump = nil
                    self.bubbleJS("bubble.chat(false)")
                    self.showBubble(key: false)
                }
            }
        }
        if body["newChat"] as? Bool == true { asker.reset() }
        if let q = body["open"] as? String, !q.isEmpty {
            asker.cancel()                                // any reply still on its way: Claude Desktop has it now
            bubbleJS("bubble.stopped('Carried on in Claude Desktop.')")
            openInClaude(q)
            hideBubble()
        }
        if let text = body["copy"] as? String, !text.isEmpty {
            NSPasteboard.general.clearContents(); NSPasteboard.general.setString(text, forType: .string)
        }
    }

    /// A new chat in Claude Desktop with the question filled in, for you to check and send (claude://claude.ai/new?q=…).
    /// Without Claude Desktop, the same in claude.ai in your browser.
    func openInClaude(_ question: String) {
        var allowed = CharacterSet.urlQueryAllowed
        allowed.remove(charactersIn: "&+=?#")
        let q = String(question.prefix(14000)).addingPercentEncoding(withAllowedCharacters: allowed) ?? ""
        if let app = URL(string: "claude://claude.ai/new?q=" + q), NSWorkspace.shared.urlForApplication(toOpen: app) != nil {
            NSWorkspace.shared.open(app)
        } else if let web = URL(string: "https://claude.ai/new?q=" + q) {
            NSWorkspace.shared.open(web)
        }
    }

    /// "Show me": bring forward the app the session runs in, or ask the browser extension for the chat's tab.
    func jump(_ j: [String: Any]?) {
        guard let j = j else { return }
        if let raw = j["app"] as? String {
            let id = TERMINAL_APPS[raw] ?? raw
            guard let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: id) else { return }
            let cfg = NSWorkspace.OpenConfiguration(); cfg.activates = true
            NSWorkspace.shared.openApplication(at: url, configuration: cfg, completionHandler: nil)
        } else if let key = j["web"] as? String, let url = URL(string: BRIDGE + "/jump") {
            var req = URLRequest(url: url); req.httpMethod = "POST"; req.timeoutInterval = 3
            req.httpBody = try? JSONSerialization.data(withJSONObject: ["web": key])
            URLSession.shared.dataTask(with: req).resume()
        }
    }
    @objc func quit() { NSApp.terminate(nil) }
}

let app = NSApplication.shared
let delegate = App()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
