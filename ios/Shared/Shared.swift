import CryptoKit
import Foundation

/// What the app and its two extensions (the Live Activity widget, the notification decrypter) share, through the
/// app group: the pairing with your Mac and the latest alerts.
enum Shared {
    static let group = Bundle.main.object(forInfoDictionaryKey: "FoxBuddyAppGroup") as? String ?? "group.com.foxbuddy.phone"
    static var defaults: UserDefaults { UserDefaults(suiteName: group) ?? .standard }
    /// Which Apple push servers this build talks to: Xcode builds use the sandbox, TestFlight and App Store builds production.
    static var apnsEnv: String {
        #if DEBUG
        return "sandbox"
        #else
        return "production"
        #endif
    }
}

/// The pairing with your Mac, from the QR code it shows (foxbuddy://pair?r=relay&p=pair&s=secret&k=key&n=name).
struct Pairing: Codable, Equatable {
    var relay: String
    var pair: String
    var secret: String
    var key: String            // base64url, 32 bytes: decrypts alerts; the relay never has it
    var fox: String            // what you call him

    init?(url: URL) {
        guard url.scheme == "foxbuddy", url.host == "pair",
              let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems else { return nil }
        func q(_ n: String) -> String? { items.first { $0.name == n }?.value }
        guard let r = q("r"), r.hasPrefix("https://"), let p = q("p"), p.count >= 16, let s = q("s"), s.count >= 20,
              let k = q("k"), Seal.keyData(k)?.count == 32 else { return nil }
        relay = r; pair = p; secret = s; key = k
        let n = (q("n") ?? "").trimmingCharacters(in: .whitespaces)
        fox = n.isEmpty ? "Fox" : String(n.prefix(30))
    }

    static var current: Pairing? {
        get { Shared.defaults.data(forKey: "pairing").flatMap { try? JSONDecoder().decode(Pairing.self, from: $0) } }
        set {
            if let p = newValue, let d = try? JSONEncoder().encode(p) { Shared.defaults.set(d, forKey: "pairing") }
            else { Shared.defaults.removeObject(forKey: "pairing") }
        }
    }
}

/// Alerts arrive encrypted (AES-GCM, nonce + ciphertext + tag, base64) with the key from the QR code.
enum Seal {
    static func keyData(_ s: String) -> Data? {
        var t = s.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while t.count % 4 != 0 { t += "=" }
        return Data(base64Encoded: t)
    }
    static func open(_ b64: String, key: String) -> [String: Any]? {
        guard let k = keyData(key), let combined = Data(base64Encoded: b64),
              let box = try? AES.GCM.SealedBox(combined: combined),
              let plain = try? AES.GCM.open(box, using: SymmetricKey(data: k)) else { return nil }
        return (try? JSONSerialization.jsonObject(with: plain)) as? [String: Any]
    }
}

/// One alert as it showed up on the phone. The notification extension keeps the last 50 here for the app's list.
struct FoxAlert: Codable, Identifiable, Equatable {
    var id = UUID()
    var title: String
    var body: String
    var kind: String           // done, needs, info
    var at: Date
}

enum AlertLog {
    static func all() -> [FoxAlert] {
        Shared.defaults.data(forKey: "alerts").flatMap { try? JSONDecoder().decode([FoxAlert].self, from: $0) } ?? []
    }
    static func add(_ a: FoxAlert) {
        var list = all()
        list.insert(a, at: 0)
        if let d = try? JSONEncoder().encode(Array(list.prefix(50))) { Shared.defaults.set(d, forKey: "alerts") }
    }
    static func clear() { Shared.defaults.removeObject(forKey: "alerts") }
}

/// The relay (relay/ in the fox-buddy repository): the phone tells it where to send pushes.
enum Relay {
    @discardableResult
    static func post(_ body: [String: Any], _ p: Pairing) async -> Int {
        guard let url = URL(string: p.relay) else { return 0 }
        var b = body
        b["pair"] = p.pair; b["secret"] = p.secret
        var req = URLRequest(url: url, timeoutInterval: 20)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: b)
        guard let (_, resp) = try? await URLSession.shared.data(for: req) else { return 0 }
        return (resp as? HTTPURLResponse)?.statusCode ?? 0
    }
    static func hex(_ d: Data) -> String { d.map { String(format: "%02x", $0) }.joined() }
}
