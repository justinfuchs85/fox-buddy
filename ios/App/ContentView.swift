import SwiftUI
import UIKit

struct ContentView: View {
    @EnvironmentObject var model: Model

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    FoxView(mood: model.mood)
                        .frame(width: 220, height: 220)
                        .padding(.top, 8)
                    if let p = model.pairing { paired(p) } else { unpaired }
                    if !model.status.isEmpty {
                        Text(model.status).font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center)
                    }
                }
                .padding(.horizontal, 20).padding(.bottom, 30)
            }
            .background(Color.cream.ignoresSafeArea())
            .navigationTitle(model.pairing?.fox ?? "Fox Buddy")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if model.pairing != nil {
                    Menu {
                        Button("Clear the List") { AlertLog.clear(); model.refresh() }
                        Button("Unpair", role: .destructive) { model.unpair() }
                    } label: { Image(systemName: "ellipsis.circle") }
                }
            }
        }
        .tint(.foxOrange)
    }

    private var unpaired: some View {
        VStack(spacing: 14) {
            Text("Pair with your Mac").font(.title2.weight(.semibold))
            Text("On your Mac, right-click your fox › **iPhone** › **Pair iPhone…**, then point this phone's Camera at the code and tap the link it shows.")
                .multilineTextAlignment(.center).foregroundStyle(.secondary)
            Button {
                if let s = UIPasteboard.general.string, let u = URL(string: s.trimmingCharacters(in: .whitespacesAndNewlines)) { model.open(u) }
                else { model.status = "There's no pairing link on the clipboard. On the Mac, Pair iPhone… › Copy Link." }
            } label: { Label("Paste a Pairing Link", systemImage: "doc.on.clipboard") }
            .buttonStyle(.bordered)
        }
    }

    @ViewBuilder private func paired(_ p: Pairing) -> some View {
        if !model.notificationsAllowed {
            VStack(spacing: 8) {
                Text("Notifications are off, so \(p.fox) can't reach you.").multilineTextAlignment(.center)
                Button("Open Settings") { UIApplication.shared.open(URL(string: UIApplication.openNotificationSettingsURLString)!) }
                    .buttonStyle(.borderedProminent)
            }
            .padding().background(.white.opacity(0.7), in: RoundedRectangle(cornerRadius: 14))
        }
        if model.alerts.isEmpty {
            Text("Nothing yet. When you're away from your Mac, \(p.fox)'s alerts land here, and prints in progress show on your Lock Screen.")
                .multilineTextAlignment(.center).foregroundStyle(.secondary).padding(.top, 8)
        } else {
            VStack(spacing: 0) {
                ForEach(model.alerts) { a in
                    AlertRow(alert: a)
                    if a != model.alerts.last { Divider().padding(.leading, 44) }
                }
            }
            .background(.white, in: RoundedRectangle(cornerRadius: 16))
        }
    }
}

struct AlertRow: View {
    let alert: FoxAlert
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: alert.kind == "needs" ? "exclamationmark.circle.fill" : alert.kind == "done" ? "checkmark.circle.fill" : "bubble.left.fill")
                .foregroundStyle(alert.kind == "needs" ? Color.foxOrange : alert.kind == "done" ? Color.green : Color.secondary)
                .font(.title3).frame(width: 22)
            VStack(alignment: .leading, spacing: 3) {
                Text(alert.body).font(.body).fixedSize(horizontal: false, vertical: true)
                Text("\(alert.at, style: .relative) ago").font(.caption).foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
    }
}

extension Color {
    static let foxOrange = Color(red: 0.96, green: 0.45, blue: 0.24)
    static let cream = Color(red: 1.0, green: 0.95, blue: 0.88)
}
