// The app's main view controller. It only exists to register our own local plugins.
// scripts/ios-setup.mjs points Main.storyboard at this class.
import Capacitor

class AppViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(GameCenterPlugin())
    }
}
