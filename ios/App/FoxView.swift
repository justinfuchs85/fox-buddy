import SwiftUI
import WebKit

/// Him, animated: the same drawing code as on the Mac (fox.js, rig.js, character.js from characters/fox, bundled),
/// played by fox.html in a transparent web view.
struct FoxView: UIViewRepresentable {
    let mood: String

    func makeUIView(context: Context) -> WKWebView {
        let w = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
        w.isOpaque = false
        w.backgroundColor = .clear
        w.scrollView.backgroundColor = .clear
        w.scrollView.isScrollEnabled = false
        w.isUserInteractionEnabled = false
        w.navigationDelegate = context.coordinator
        if let html = Bundle.main.url(forResource: "fox", withExtension: "html") {
            w.loadFileURL(html, allowingReadAccessTo: html.deletingLastPathComponent())
        }
        context.coordinator.mood = mood
        return w
    }

    func updateUIView(_ w: WKWebView, context: Context) {
        guard context.coordinator.mood != mood else { return }
        context.coordinator.mood = mood
        if context.coordinator.loaded { w.evaluateJavaScript("setMood('\(mood)')") }
    }

    func makeCoordinator() -> Coordinator { Coordinator() }
    final class Coordinator: NSObject, WKNavigationDelegate {
        var mood = "idle", loaded = false
        func webView(_ w: WKWebView, didFinish _: WKNavigation!) {
            loaded = true
            w.evaluateJavaScript("setMood('\(mood)')")
        }
    }
}
