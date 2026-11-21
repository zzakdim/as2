import Foundation
import os

/// Receives the game's analytics events (level_start, level_win, stuck, vial_offer, vial_granted,
/// ad_cancel, shop_buy, equip, tutorial_done, screen, …; see `track()` in the game).
///
/// Ships with a logger so you can watch events in Xcode's console during play tests. To send them
/// somewhere, implement `AnalyticsSink` for your SDK (TelemetryDeck, Firebase, Amplitude…) and
/// assign it to `Analytics.shared.sink` in `AppDelegate`.
protocol AnalyticsSink {
    func log(_ name: String, _ props: [String: Any])
}

final class Analytics {
    static let shared = Analytics()
    var sink: AnalyticsSink = ConsoleAnalytics()

    func log(_ name: String, _ props: [String: Any]) {
        sink.log(name, props)
    }
}

struct ConsoleAnalytics: AnalyticsSink {
    private let logger = Logger(subsystem: Bundle.main.bundleIdentifier ?? "MagicBoba", category: "analytics")

    func log(_ name: String, _ props: [String: Any]) {
        let detail = props.map { "\($0.key)=\($0.value)" }.sorted().joined(separator: " ")
        logger.info("📊 \(name, privacy: .public) \(detail, privacy: .public)")
    }
}
