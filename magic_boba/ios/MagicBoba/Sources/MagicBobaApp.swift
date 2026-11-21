import SwiftUI
import AVFoundation

/// App entry point. The whole game runs in `GameViewController` (a full-screen web view that
/// hosts the bundled game in `Web/index.html`); this file only sets up the window and services.
@main
struct MagicBobaApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup {
            GameView()
                .ignoresSafeArea()
                .statusBarHidden(true)
                .persistentSystemOverlays(.hidden)
                .background(Color("LaunchBackground"))
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        // .ambient: the game respects the silent switch and lets the player's own music keep playing,
        // which is what players expect from a casual puzzle game.
        try? AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
        Ads.shared.start()
        Analytics.shared.log("app_launch", [:])
        return true
    }
}

/// Bridges the UIKit game controller into SwiftUI.
struct GameView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> GameViewController { GameViewController() }
    func updateUIViewController(_ controller: GameViewController, context: Context) {}
}

extension Bundle {
    var appVersion: String {
        let v = infoDictionary?["CFBundleShortVersionString"] as? String ?? "0"
        let b = infoDictionary?["CFBundleVersion"] as? String ?? "0"
        return "\(v) (\(b))"
    }
}
