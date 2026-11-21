import UIKit
import WebKit
import StoreKit

/// Hosts the game (bundled HTML/JS in `Web/`) in a full-screen WKWebView and answers the
/// messages the game posts to `window.webkit.messageHandlers.boba`:
///
/// | type             | payload                 | what happens                                   |
/// |------------------|-------------------------|------------------------------------------------|
/// | `haptic`         | `kind`                  | plays a Taptic Engine pattern (`Haptics`)      |
/// | `save`           | `json`                  | stores the save blob in UserDefaults           |
/// | `track`          | `name`, `props`         | forwards an analytics event (`Analytics`)      |
/// | `showRewardedAd` | `id`, `placement`       | shows a rewarded ad, replies `adResult`        |
/// | `requestReview`  | —                       | asks iOS to show the App Store rating prompt   |
///
/// Native → game calls go through `window.BobaNative` (`adResult`, `pause`, `resume`).
final class GameViewController: UIViewController {
    private var webView: WKWebView!
    private let saves = SaveStore()
    private let haptics = Haptics()

    override func loadView() {
        let content = WKUserContentController()
        content.add(WeakScriptHandler(self), name: "boba")

        // Hand the game its last save before any of its scripts run.
        let boot = "window.__BOBA_SAVE__ = \(saves.loadJSON() ?? "null"); window.__BOBA_VERSION__ = '\(Bundle.main.appVersion)';"
        content.addUserScript(WKUserScript(source: boot, injectionTime: .atDocumentStart, forMainFrameOnly: true))

        let config = WKWebViewConfiguration()
        config.userContentController = content
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []   // Web Audio may start on the first tap
        config.suppressesIncrementalRendering = true           // no half-drawn first frame

        let web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = false
        web.backgroundColor = UIColor(named: "LaunchBackground")
        web.scrollView.backgroundColor = UIColor(named: "LaunchBackground")
        web.scrollView.contentInsetAdjustmentBehavior = .never  // the page handles safe areas itself (env(safe-area-inset-*))
        web.scrollView.bounces = false
        web.scrollView.pinchGestureRecognizer?.isEnabled = false
        web.allowsLinkPreview = false
        web.allowsBackForwardNavigationGestures = false
        web.navigationDelegate = self
        #if DEBUG
        if #available(iOS 16.4, *) { web.isInspectable = true }  // Safari ▸ Develop menu can inspect the game
        #endif
        webView = web
        view = web
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        guard let index = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "Web") else {
            assertionFailure("Web/index.html missing from the bundle: run `python3 magic_boba/ios/build_web.py`")
            return
        }
        webView.loadFileURL(index, allowingReadAccessTo: index.deletingLastPathComponent())

        let nc = NotificationCenter.default
        nc.addObserver(self, selector: #selector(appPaused), name: UIApplication.willResignActiveNotification, object: nil)
        nc.addObserver(self, selector: #selector(appResumed), name: UIApplication.didBecomeActiveNotification, object: nil)
    }

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .bottom }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .portrait }

    @objc private func appPaused() { callGame("window.BobaNative && window.BobaNative.pause()") }
    @objc private func appResumed() { callGame("window.BobaNative && window.BobaNative.resume()") }

    private func callGame(_ js: String) {
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    fileprivate func handle(_ body: [String: Any]) {
        guard let type = body["type"] as? String else { return }
        switch type {
        case "haptic":
            haptics.play(body["kind"] as? String ?? "")
        case "save":
            if let json = body["json"] as? String { saves.store(json: json) }
        case "track":
            Analytics.shared.log(body["name"] as? String ?? "unknown", body["props"] as? [String: Any] ?? [:])
        case "showRewardedAd":
            let id = (body["id"] as? NSNumber)?.intValue ?? 0
            Ads.shared.showRewarded(from: self) { [weak self] outcome in
                self?.callGame("window.BobaNative.adResult(\(id), \(outcome == .earned), '\(outcome.rawValue)')")
            }
        case "requestReview":
            if let scene = view.window?.windowScene { AppStore.requestReview(in: scene) }
        default:
            break
        }
    }
}

extension GameViewController: WKNavigationDelegate {
    // Keep the game inside the app: local files load here, web links open in Safari.
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { return decisionHandler(.cancel) }
        if url.isFileURL || url.scheme == "about" { return decisionHandler(.allow) }
        if url.scheme == "https" || url.scheme == "http" { UIApplication.shared.open(url) }
        decisionHandler(.cancel)
    }

    // If iOS kills the web content process (memory pressure), reload: the save is in UserDefaults.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }
}

/// Avoids the retain cycle WKUserContentController would otherwise create with the controller.
private final class WeakScriptHandler: NSObject, WKScriptMessageHandler {
    weak var target: GameViewController?
    init(_ target: GameViewController) { self.target = target }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any] else { return }
        target?.handle(body)
    }
}
