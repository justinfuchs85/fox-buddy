import UserNotifications

/// Every alert from the Mac arrives encrypted; this unlocks it with the key from pairing before iOS shows it, adds
/// his pose, and keeps a copy for the app's list. If it can't (not paired anymore), the relay's generic line shows.
final class NotificationService: UNNotificationServiceExtension {
    private var handler: ((UNNotificationContent) -> Void)?
    private var best: UNMutableNotificationContent?

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        handler = contentHandler
        let content = (request.content.mutableCopy() as? UNMutableNotificationContent) ?? UNMutableNotificationContent()
        best = content
        if let enc = request.content.userInfo["enc"] as? String, let p = Pairing.current, let m = Seal.open(enc, key: p.key) {
            let title = (m["t"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? p.fox
            let body = m["b"] as? String ?? ""
            let kind = m["k"] as? String ?? "info"
            content.title = title
            content.body = body
            content.threadIdentifier = "fox"
            AlertLog.add(FoxAlert(title: title, body: body, kind: kind, at: Date()))
            let pose = kind == "needs" ? "fox-waiting" : kind == "done" ? "fox-done" : "fox-idle"
            if let src = Bundle.main.url(forResource: pose, withExtension: "png") {
                let tmp = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".png")
                if (try? FileManager.default.copyItem(at: src, to: tmp)) != nil,
                   let a = try? UNNotificationAttachment(identifier: "fox", url: tmp, options: nil) {
                    content.attachments = [a]
                }
            }
        }
        contentHandler(content)
    }

    override func serviceExtensionTimeWillExpire() {
        if let h = handler, let b = best { h(b) }
    }
}
