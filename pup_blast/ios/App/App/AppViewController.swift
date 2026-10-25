// The app's main view controller. It registers our own local plugins and tells the web side whether
// this is a Debug build. scripts/ios-setup.mjs points Main.storyboard at this class.
import Capacitor
import WebKit

class AppViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(GameCenterPlugin())
        // window.Capacitor.DEBUG can't be trusted: Capacitor ships as a prebuilt xcframework whose own
        // `#if DEBUG` is fixed at Capacitor's build time, so it reads true in our Release builds too.
        // This target's DEBUG flag is set only in the Debug configuration, so it is the real answer.
        #if DEBUG
        webView?.configuration.userContentController.addUserScript(
            WKUserScript(source: "window.PB_DEBUG_BUILD = true;", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        #endif
    }
}
