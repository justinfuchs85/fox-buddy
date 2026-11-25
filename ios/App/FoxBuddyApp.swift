import ActivityKit
import SwiftUI
import UIKit
import UserNotifications

@main
struct FoxBuddyApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate
    @StateObject private var model = Model.shared
    @Environment(\.scenePhase) private var phase

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(model)
                .onOpenURL { model.open($0) }
                .onChange(of: phase) { _, now in if now == .active { model.refresh() } }
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ app: UIApplication, didFinishLaunchingWithOptions opts: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        // Launched in the background when the Mac starts a Live Activity, too: watch for its token straight away.
        Task { @MainActor in Model.shared.start() }
        return true
    }
    func application(_ app: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken token: Data) {
        Task { @MainActor in Model.shared.deviceToken(token) }
    }
    func application(_ app: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        Task { @MainActor in Model.shared.status = "Couldn't sign up for notifications: \(error.localizedDescription)" }
    }
    // An alert while the app is open: show it anyway, and refresh the list.
    func userNotificationCenter(_ c: UNUserNotificationCenter, willPresent n: UNNotification) async -> UNNotificationPresentationOptions {
        await MainActor.run { Model.shared.refresh() }
        return [.banner, .list, .sound]
    }
}

/// Pairing, push tokens and the alert list. Whenever iOS hands us a token (for alerts, for starting Live
/// Activities, or for one that's showing), it goes to the relay, so the Mac can reach this phone.
@MainActor
final class Model: ObservableObject {
    static let shared = Model()
    @Published var pairing = Pairing.current
    @Published var alerts = AlertLog.all()
    @Published var status = ""
    @Published var notificationsAllowed = true
    private var watching = false, watched = Set<String>()

    var mood: String {
        guard let a = alerts.first, Date().timeIntervalSince(a.at) < 3600 else { return pairing == nil ? "awake" : "idle" }
        return a.kind == "needs" ? "waiting" : a.kind == "done" ? "done" : "idle"
    }

    func open(_ url: URL) {
        guard let p = Pairing(url: url) else { status = "That link isn't a Fox Buddy pairing code."; return }
        Pairing.current = p
        pairing = p
        status = "Paired. Say hi to \(p.fox)."
        start()
    }

    func unpair() {
        if let p = pairing { Task { await Relay.post(["op": "unpair"], p) } }
        Pairing.current = nil
        pairing = nil
        AlertLog.clear(); alerts = []
        status = ""
    }

    func refresh() {
        alerts = AlertLog.all()
        UNUserNotificationCenter.current().getNotificationSettings { s in
            let ok = s.authorizationStatus == .authorized || s.authorizationStatus == .provisional
            Task { @MainActor in self.notificationsAllowed = ok }
        }
    }

    func start() {
        guard pairing != nil else { return }
        Task {
            let ok = (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])) ?? false
            notificationsAllowed = ok
            UIApplication.shared.registerForRemoteNotifications()
        }
        guard !watching else { return }
        watching = true
        Task {      // the token the Mac uses to start a Live Activity on this phone
            for await data in Activity<FoxActivityAttributes>.pushToStartTokenUpdates {
                if let p = Pairing.current { await Relay.post(["op": "register", "env": Shared.apnsEnv, "start": Relay.hex(data)], p) }
            }
        }
        Task {      // each Live Activity the Mac starts: its own token, for updates and the end
            for await activity in Activity<FoxActivityAttributes>.activityUpdates { watch(activity) }
        }
        for a in Activity<FoxActivityAttributes>.activities { watch(a) }
        refresh()
    }

    private func watch(_ a: Activity<FoxActivityAttributes>) {
        guard !watched.contains(a.id) else { return }
        watched.insert(a.id)
        let key = a.attributes.key
        Task {
            for await data in a.pushTokenUpdates {
                if let p = Pairing.current { await Relay.post(["op": "register", "activity": ["key": key, "token": Relay.hex(data)]], p) }
            }
        }
        Task {
            for await state in a.activityStateUpdates where state == .ended || state == .dismissed {
                if let p = Pairing.current { await Relay.post(["op": "register", "activity": ["key": key, "ended": true] as [String: Any]], p) }
            }
        }
    }

    func deviceToken(_ data: Data) {
        guard let p = pairing else { return }
        Task {
            let s = await Relay.post(["op": "register", "env": Shared.apnsEnv, "device": Relay.hex(data)], p)
            status = s == 200 ? "" : s == 403 ? "Your Mac doesn't know this pairing anymore. Pair again from the Mac." :
                "Couldn't reach the relay (\(s == 0 ? "no connection" : "error \(s)")). It'll try again next time."
        }
    }
}
