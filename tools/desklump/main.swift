// Desktop Lump: the desk Lump, living in a corner of the Mac's screen instead of in a glass prism.
//
// He's the real thing, not a picture of it: design/lump.html draws him (plus design/clip_kit.js and every
// design/clips/*.js) in a transparent web view, and web/desktop.js plays him the way firmware/src/main.cpp
// does on the board. To the bridge he *is* a board: this app listens on 127.0.0.1:4210 and speaks the
// board's line protocol (tools/buddy_bridge.py connects when config.json has "desktop_lump": true), so
// moods, colours, corner counts, gags, sounds and the bridge's automatic clips all work unchanged.
// Without the bridge he goes his own way: asleep, fidgeting, at night under his blanket.
//
// Click him to tap the glass. Drag him anywhere. Right-click for size, look, corner and the clip library.
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
let MARGIN: CGFloat = 12

// MARK: - the board's socket

/// Listens where the bridge looks for a Lump on the network, for one bridge at a time, on this Mac only.
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
        conn?.cancel()                              // a newer bridge (it restarted): that one wins
        conn = c; buffer = Data()
        c.stateUpdateHandler = { [weak self, weak c] st in
            guard let self = self, let c = c, c === self.conn else { return }
            switch st {
            case .ready: self.connected = true
            case .failed, .cancelled: self.conn = nil; self.connected = false
            default: break
            }
        }
        c.start(queue: queue)
        receive(c)
    }

    private func receive(_ c: NWConnection) {
        c.receive(minimumIncompleteLength: 1, maximumLength: 8192) { [weak self] data, _, done, err in
            guard let self = self else { return }
            if let d = data, !d.isEmpty {
                self.buffer.append(d)
                while let nl = self.buffer.firstIndex(of: 0x0A) {
                    let lineData = self.buffer[self.buffer.startIndex..<nl]
                    self.buffer = Data(self.buffer[self.buffer.index(after: nl)...])
                    if let s = String(data: lineData, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines), !s.isEmpty {
                        DispatchQueue.main.async { self.onLine?(s) }
                    }
                }
                if self.buffer.count > 4096 { self.buffer = Data() }     // nothing the bridge says is that long
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
        queue.async { self.conn?.send(content: (line + "\n").data(using: .utf8), completion: .contentProcessed { _ in }) }
    }
}

// MARK: - the window

/// Sits on top of the web view and takes every click: a click is a tap, a drag moves him.
final class GrabView: NSView {
    var onTap: (() -> Void)?
    var onMenu: ((NSEvent) -> Void)?
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
        if dragging { dragging = false; NSCursor.pop(); onMoved?() } else { onTap?() }
    }
    override func rightMouseDown(with e: NSEvent) { onMenu?(e) }
}

final class LumpPanel: NSPanel {
    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }
}

// MARK: - app

final class App: NSObject, NSApplicationDelegate, NSMenuDelegate, WKScriptMessageHandler {
    let link = BoardLink()
    var panel: LumpPanel!
    var web: WKWebView!
    var grab: GrabView!
    var ready = false
    var queued: [String] = []
    var clips: [String] = []
    var hoverTimer: Timer?
    var hiddenByUser = false
    let prefs = UserDefaults.standard

    var side: CGFloat {
        get { let v = prefs.double(forKey: "side"); return v > 0 ? CGFloat(v) : 170 }
        set { prefs.set(Double(newValue), forKey: "side") }
    }
    var look: String {
        get { prefs.string(forKey: "look") ?? "float" }
        set { prefs.set(newValue, forKey: "look") }
    }
    var onDesktop: Bool {               // behind other windows, on the desktop itself, rather than floating above them
        get { prefs.bool(forKey: "onDesktop") }
        set { prefs.set(newValue, forKey: "onDesktop") }
    }
    var snap: Bool {                    // after a drag, slide into the nearest corner
        get { prefs.object(forKey: "snap") == nil ? true : prefs.bool(forKey: "snap") }
        set { prefs.set(newValue, forKey: "snap") }
    }

    func applicationDidFinishLaunching(_ n: Notification) {
        guard let webDir = Bundle.main.url(forResource: "web", withExtension: nil) else {
            NSLog("desklump: no web folder in the app bundle (build it with tools/desklump/build.sh)"); NSApp.terminate(nil); return
        }
        makeWindow(webDir)
        link.onLine = { [weak self] line in self?.toLump(line) }
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
        let uc = config.userContentController
        uc.add(self, name: "lump")
        func script(_ name: String, _ when: WKUserScriptInjectionTime) {
            let url = webDir.appendingPathComponent(name)
            guard let src = try? String(contentsOf: url, encoding: .utf8) else { NSLog("desklump: missing \(name)"); return }
            uc.addUserScript(WKUserScript(source: src, injectionTime: when, forMainFrameOnly: true))
        }
        script("start.js", .atDocumentStart)
        script("clip_kit.js", .atDocumentEnd)
        script("clips.bundle.js", .atDocumentEnd)
        script("desktop.js", .atDocumentEnd)

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
        grab.onMenu = { [weak self] e in guard let self = self else { return }; NSMenu.popUpContextMenu(self.menu(), with: e, for: self.grab) }
        grab.onMoved = { [weak self] in self?.moved() }
        content.addSubview(grab)
        panel.contentView = content

        web.loadFileURL(webDir.appendingPathComponent("lump.html"), allowingReadAccessTo: webDir)
        clampOnScreen()
        panel.orderFrontRegardless()
    }

    func applyLayer() {
        // On the desktop: just above the desktop icons, so ordinary windows cover him like they'd cover a widget.
        panel.level = onDesktop ? NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopIconWindow)) + 1) : .floating
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
    func saveOrigin() { prefs.set(Double(panel.frame.minX), forKey: "x"); prefs.set(Double(panel.frame.minY), forKey: "y") }

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

    // MARK: talking to Lump

    func js(_ code: String) { web.evaluateJavaScript(code, completionHandler: nil) }

    func toLump(_ line: String) {
        let quoted = (try? String(data: JSONSerialization.data(withJSONObject: [line]), encoding: .utf8)) ?? "[\"\"]"
        let call = "desk.line(\(quoted)[0])"
        if ready { js(call) } else { queued.append(call) }
    }

    func userContentController(_ uc: WKUserContentController, didReceive m: WKScriptMessage) {
        guard let body = m.body as? [String: Any] else { return }
        if let s = body["say"] as? String { link.send(s) }
        if body["ready"] as? Bool == true {
            ready = true
            clips = (body["clips"] as? [String]) ?? []
            publishClips()
            js("desk.setLook('\(look)')")
            queued.forEach(js); queued.removeAll()
        }
    }

    /// Tell the bridge which clips live in here (it plays them by name, as it would send them to the board).
    func publishClips() {
        let dir = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".desk-buddy")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        if let data = try? JSONSerialization.data(withJSONObject: ["clips": clips], options: [.prettyPrinted]) {
            try? data.write(to: dir.appendingPathComponent("desktop_clips.json"), options: .atomic)
        }
    }

    /// Ask the bridge to play something (so it gets its sound, and counts as his thing for the minute);
    /// if the bridge isn't there, he plays it himself.
    func play(_ name: String) {
        guard link.connected, let url = URL(string: BRIDGE + "/play") else { toLump("e " + name); return }
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
        m.addItem(item(link.connected ? "Connected to the bridge" : "On his own (the bridge isn't connected)", nil))
        m.addItem(.separator())
        m.addItem(item("Tap", #selector(tapNow)))
        var gagItems = [item("A Random Gag", #selector(playNamed(_:)), rep: "tap"), NSMenuItem.separator()]
        gagItems += GAGS.map { item(pretty($0), #selector(playNamed(_:)), rep: $0) }
        m.addItem(sub("Gags", gagItems))
        var clipItems = [item("Surprise Me", #selector(playRandomClip)), NSMenuItem.separator()]
        clipItems += clips.map { item(pretty($0), #selector(playNamed(_:)), rep: $0) }
        m.addItem(sub("Clips (\(clips.count))", clipItems))
        m.addItem(item("Show Off (Every Mood, on a Loop)", #selector(demo)))
        m.addItem(.separator())
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
    @objc func pickLook(_ s: NSMenuItem) { if let v = s.representedObject as? String { look = v; js("desk.setLook('\(v)')") } }
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
    @objc func hideHim() { hiddenByUser = true; panel.orderOut(nil) }
    @objc func quit() { NSApp.terminate(nil) }
}

let app = NSApplication.shared
let delegate = App()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
