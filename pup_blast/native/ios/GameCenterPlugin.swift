// A small Capacitor plugin for Game Center leaderboards (sign in, submit a score, show a board).
// Registered by AppViewController.swift. The JavaScript side is www/js/gamecenter.js.
import Capacitor
import GameKit

@objc(GameCenterPlugin)
public class GameCenterPlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate {
    public let identifier = "GameCenterPlugin"
    public let jsName = "GameCenter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "submitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showLeaderboard", returnType: CAPPluginReturnPromise),
    ]

    // Touched only on the main thread.
    private var pendingSignIn: [CAPPluginCall] = []
    private var handlerSet = false
    private var handlerFired = false

    // Presents on whatever is on top, so a consent form or another sheet showing doesn't block it.
    private func presentOnTop(_ viewController: UIViewController) {
        var top = bridge?.viewController
        while let presented = top?.presentedViewController { top = presented }
        top?.present(viewController, animated: true)
    }

    // Resolves { authenticated, name }. iOS shows its own sign-in sheet or welcome banner.
    @objc func signIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let player = GKLocalPlayer.local
            if player.isAuthenticated {
                call.resolve(["authenticated": true, "name": player.displayName])
                return
            }
            // GameKit answers once per sign-in state change. If it already said "not signed in",
            // asking again would wait forever, so answer straight away.
            if self.handlerFired {
                call.resolve(["authenticated": false, "name": ""])
                return
            }
            self.pendingSignIn.append(call)
            if self.handlerSet { return }
            self.handlerSet = true
            player.authenticateHandler = { [weak self] viewController, _ in
                DispatchQueue.main.async {
                    guard let self = self else { return }
                    if let viewController = viewController {
                        self.presentOnTop(viewController)
                        return
                    }
                    self.handlerFired = true
                    let result: [String: Any] = ["authenticated": player.isAuthenticated, "name": player.isAuthenticated ? player.displayName : ""]
                    let calls = self.pendingSignIn
                    self.pendingSignIn = []
                    calls.forEach { $0.resolve(result) }
                }
            }
        }
    }

    @objc func submitScore(_ call: CAPPluginCall) {
        guard let leaderboardId = call.getString("leaderboardId"), let score = call.getInt("score") else {
            call.reject("leaderboardId and score are required")
            return
        }
        guard GKLocalPlayer.local.isAuthenticated else {
            call.reject("Not signed in to Game Center")
            return
        }
        GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [leaderboardId]) { error in
            if let error = error { call.reject(error.localizedDescription) } else { call.resolve() }
        }
    }

    // Opens Apple's leaderboard screen: one board when leaderboardId is given, else the list of boards.
    @objc func showLeaderboard(_ call: CAPPluginCall) {
        let leaderboardId = call.getString("leaderboardId")
        DispatchQueue.main.async {
            let viewController: GKGameCenterViewController
            if let leaderboardId = leaderboardId {
                viewController = GKGameCenterViewController(leaderboardID: leaderboardId, playerScope: .global, timeScope: .allTime)
            } else {
                viewController = GKGameCenterViewController(state: .leaderboards)
            }
            viewController.gameCenterDelegate = self
            self.presentOnTop(viewController)
            call.resolve()
        }
    }

    public func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }
}
