import ActivityKit
import Foundation

/// A Live Activity from your Mac: a print in progress ("printer") or a long Claude job ("claude"). The Mac starts,
/// updates and ends them by push, through the relay. The relay's JSON must match this exactly:
/// attributes {key, title} and content-state {mood, headline, detail, progress?, since?, ends?}.
struct FoxActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var mood: String           // printing, working, waiting, done, failed, paused
        var headline: String       // "Printing Cable clip"
        var detail: String         // "Layer 80 of 200"
        var progress: Double?      // 0...1
        var since: Double?         // Unix time it started: a count-up timer
        var ends: Double?          // Unix time it should finish: a countdown
    }
    var key: String
    var title: String
}

extension FoxActivityAttributes.ContentState {
    /// His pose for this state (an image in the widget's assets: fox-… full body, head-… for the Dynamic Island).
    func pose(_ key: String) -> String {
        switch mood {
        case "printing": return "printing"
        case "waiting": return "waiting"
        case "paused": return "paused"
        case "done": return key == "printer" ? "printdone" : "done"
        case "failed": return "printfail"
        default: return "working"
        }
    }
    var endsDate: Date? { ends.map { Date(timeIntervalSince1970: $0) } }
    var sinceDate: Date? { since.map { Date(timeIntervalSince1970: $0) } }
    var finished: Bool { mood == "done" || mood == "failed" }
}
