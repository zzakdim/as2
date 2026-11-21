import UIKit

/// How a rewarded ad ended. The game only grants the bonus vial for `.earned`.
enum AdOutcome: String {
    case earned       // watched to the end: give the reward
    case closed       // player closed it early
    case unavailable  // no ad loaded (offline, no fill, SDK not set up)
}

protocol RewardedAdProvider: AnyObject {
    func start()
    func showRewarded(from controller: UIViewController, completion: @escaping (AdOutcome) -> Void)
}

enum Ads {
    /// Uses Google AdMob when its Swift package is added to the project (see ios/README.md);
    /// until then a simulated ad runs, so the whole flow can be tested without an ad account.
    static let shared: RewardedAdProvider = {
        #if canImport(GoogleMobileAds)
        return AdMobRewardedProvider(adUnitID: AdMobRewardedProvider.unitIDFromInfoPlist)
        #else
        return SimulatedRewardedAd()
        #endif
    }()
}

// MARK: - Simulated ad (default; no SDK needed)

/// A 3-second stand-in for a real rewarded ad, presented natively like a real one would be.
final class SimulatedRewardedAd: RewardedAdProvider {
    func start() {}

    func showRewarded(from controller: UIViewController, completion: @escaping (AdOutcome) -> Void) {
        let ad = SimulatedAdViewController(completion: completion)
        ad.modalPresentationStyle = .overFullScreen
        ad.modalTransitionStyle = .crossDissolve
        controller.present(ad, animated: true)
    }
}

private final class SimulatedAdViewController: UIViewController {
    private let completion: (AdOutcome) -> Void
    private var remaining = 3
    private var timer: Timer?
    private let countdown = UILabel()

    init(completion: @escaping (AdOutcome) -> Void) {
        self.completion = completion
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor.black.withAlphaComponent(0.85)

        let title = UILabel()
        title.text = "📺 Simulated ad"
        title.font = .systemFont(ofSize: 26, weight: .bold)
        title.textColor = .white

        let body = UILabel()
        body.text = "A real rewarded ad will play here\nonce AdMob is connected."
        body.numberOfLines = 0
        body.textAlignment = .center
        body.textColor = UIColor.white.withAlphaComponent(0.8)

        countdown.font = .monospacedDigitSystemFont(ofSize: 44, weight: .heavy)
        countdown.textColor = .white
        countdown.text = "\(remaining)"

        let close = UIButton(type: .system)
        close.setTitle("Close (no reward)", for: .normal)
        close.tintColor = UIColor.white.withAlphaComponent(0.7)
        close.addTarget(self, action: #selector(closeEarly), for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [title, body, countdown, close])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 18
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 24),
        ])

        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in self?.tick() }
    }

    private func tick() {
        remaining -= 1
        countdown.text = remaining > 0 ? "\(remaining)" : "✓"
        if remaining <= 0 { finish(.earned) }
    }

    @objc private func closeEarly() { finish(.closed) }

    private func finish(_ outcome: AdOutcome) {
        timer?.invalidate()
        timer = nil
        dismiss(animated: true) { [completion] in completion(outcome) }
    }
}

// MARK: - Google AdMob (compiled only when the GoogleMobileAds package is added)

#if canImport(GoogleMobileAds)
import GoogleMobileAds

/// Rewarded ads through Google Mobile Ads SDK 12.x (the Swift-named API: `MobileAds`, `RewardedAd`,
/// `Request`, `FullScreenContentDelegate`). If you use SDK 11.x, the same calls carry a `GAD` prefix.
/// NOT compiled or tested in this repo yet. Build it once with the package added, then test with
/// Google's test ad unit before switching to your own.
final class AdMobRewardedProvider: NSObject, RewardedAdProvider, FullScreenContentDelegate {
    /// Google's public test unit. Put your real unit ID in Info.plist under `BobaRewardedAdUnitID`.
    static let testUnitID = "ca-app-pub-3940256099942544/1712485313"
    static var unitIDFromInfoPlist: String {
        (Bundle.main.object(forInfoDictionaryKey: "BobaRewardedAdUnitID") as? String).flatMap { $0.isEmpty ? nil : $0 } ?? testUnitID
    }

    private let adUnitID: String
    private var ad: RewardedAd?
    private var completion: ((AdOutcome) -> Void)?
    private var earned = false

    init(adUnitID: String) {
        self.adUnitID = adUnitID
    }

    func start() {
        MobileAds.shared.start(completionHandler: nil)
        load()
    }

    private func load() {
        RewardedAd.load(with: adUnitID, request: Request()) { [weak self] ad, error in
            if let error { print("Rewarded ad failed to load: \(error.localizedDescription)") }
            self?.ad = ad
            ad?.fullScreenContentDelegate = self
        }
    }

    func showRewarded(from controller: UIViewController, completion: @escaping (AdOutcome) -> Void) {
        guard let ad else {
            completion(.unavailable)
            load()
            return
        }
        self.completion = completion
        earned = false
        ad.present(from: controller) { [weak self] in self?.earned = true }
    }

    func adDidDismissFullScreenContent(_ ad: FullScreenPresentingAd) {
        completion?(earned ? .earned : .closed)
        completion = nil
        self.ad = nil
        load()
    }

    func ad(_ ad: FullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) {
        completion?(.unavailable)
        completion = nil
        self.ad = nil
        load()
    }
}
#endif
