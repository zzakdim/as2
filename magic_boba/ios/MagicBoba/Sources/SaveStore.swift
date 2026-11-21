import Foundation

/// Persists the game's save blob (coins, stars, unlocks, settings) in UserDefaults.
/// The web layer owns the format; this side only stores and returns it, after checking it is
/// valid JSON so nothing else can ever be injected into the page at launch.
final class SaveStore {
    private let key = "boba.save.v1"
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func loadJSON() -> String? {
        guard let json = defaults.string(forKey: key), Self.isValidJSONObject(json) else { return nil }
        return json
    }

    func store(json: String) {
        guard json.utf8.count < 512_000, Self.isValidJSONObject(json) else { return }
        defaults.set(json, forKey: key)
    }

    static func isValidJSONObject(_ json: String) -> Bool {
        guard let data = json.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) else { return false }
        return object is [String: Any]
    }
}
