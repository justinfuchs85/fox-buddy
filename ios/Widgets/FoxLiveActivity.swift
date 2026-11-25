import ActivityKit
import SwiftUI
import WidgetKit

@main
struct FoxWidgets: WidgetBundle {
    var body: some Widget { FoxLiveActivity() }
}

/// A print in progress or a long Claude job, on the Lock Screen and in the Dynamic Island. Live Activities can't
/// animate, so his poses are pictures drawn from the same code as the Mac fox (fox-… and head-… in Assets).
struct FoxLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: FoxActivityAttributes.self) { ctx in
            LockScreen(key: ctx.attributes.key, title: ctx.attributes.title, s: ctx.state)
                .activityBackgroundTint(Color.night)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { ctx in
            let s = ctx.state, key = ctx.attributes.key
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image("fox-" + s.pose(key)).resizable().scaledToFit().frame(width: 56, height: 56)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Clock(s: s).font(.title3.weight(.semibold).monospacedDigit()).foregroundStyle(Color.foxOrange)
                        .frame(maxHeight: .infinity, alignment: .center)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(s.headline).font(.headline).lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        if let p = s.progress { ProgressView(value: p).tint(s.mood == "failed" ? .red : Color.foxOrange) }
                        Text(s.detail).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                    }
                }
            } compactLeading: {
                Image("head-" + s.pose(key)).resizable().scaledToFit()
            } compactTrailing: {
                Clock(s: s).font(.caption.weight(.semibold).monospacedDigit()).foregroundStyle(Color.foxOrange)
                    .frame(maxWidth: 52)
            } minimal: {
                Image("head-" + s.pose(key)).resizable().scaledToFit()
            }
            .keylineTint(Color.foxOrange)
        }
    }
}

/// The short number: percent for a print (or how long until it's done), time running for a Claude job.
struct Clock: View {
    let s: FoxActivityAttributes.ContentState
    var body: some View {
        if s.finished {
            Image(systemName: s.mood == "done" ? "checkmark" : "xmark")
        } else if s.mood == "waiting" {
            Image(systemName: "exclamationmark")
        } else if let p = s.progress {
            Text("\(Int((p * 100).rounded()))%")
        } else if let since = s.sinceDate {
            Text(timerInterval: since...Date.distantFuture, countsDown: false)
        } else {
            Text("…")
        }
    }
}

struct LockScreen: View {
    let key: String, title: String
    let s: FoxActivityAttributes.ContentState
    var body: some View {
        HStack(spacing: 14) {
            Image("fox-" + s.pose(key)).resizable().scaledToFit().frame(width: 68, height: 68)
            VStack(alignment: .leading, spacing: 5) {
                HStack {
                    Text(s.headline).font(.headline).foregroundStyle(.white).lineLimit(1)
                    Spacer(minLength: 6)
                    Clock(s: s).font(.headline.monospacedDigit()).foregroundStyle(Color.foxOrange)
                }
                if let p = s.progress {
                    ProgressView(value: p).tint(s.mood == "failed" ? .red : Color.foxOrange)
                }
                HStack {
                    Text(s.detail).font(.caption).foregroundStyle(.white.opacity(0.7)).lineLimit(1)
                    Spacer(minLength: 6)
                    if !s.finished, let ends = s.endsDate, ends > Date() {
                        Text("done \(ends, style: .time)").font(.caption).foregroundStyle(.white.opacity(0.7))
                    }
                }
            }
        }
        .padding(16)
    }
}

extension Color {
    static let foxOrange = Color(red: 0.96, green: 0.45, blue: 0.24)
    static let night = Color(red: 0.12, green: 0.13, blue: 0.16)
}
