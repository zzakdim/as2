import UIKit

/// Taptic Engine patterns for each game moment. The names match the sounds in the game's
/// audio.js, so every sound has a matching feel. The intensity follows the same reward ladder:
/// taps are barely there, finishing a cup is a clear "success", winning is the biggest.
final class Haptics {
    private let light = UIImpactFeedbackGenerator(style: .light)
    private let soft = UIImpactFeedbackGenerator(style: .soft)
    private let medium = UIImpactFeedbackGenerator(style: .medium)
    private let rigid = UIImpactFeedbackGenerator(style: .rigid)
    private let heavy = UIImpactFeedbackGenerator(style: .heavy)
    private let notify = UINotificationFeedbackGenerator()
    private let selection = UISelectionFeedbackGenerator()

    init() {
        [light, soft, medium].forEach { $0.prepare() }
    }

    func play(_ kind: String) {
        switch kind {
        case "tap":      selection.selectionChanged()
        case "select":   light.impactOccurred(intensity: 0.7)
        case "hop":      light.impactOccurred(intensity: 0.4)
        case "undo":     soft.impactOccurred(intensity: 0.6)
        case "pour":     sequence([(0, soft, 0.8), (0.11, soft, 0.6), (0.22, soft, 0.45)])
        case "invalid":  sequence([(0, rigid, 0.6), (0.09, rigid, 0.4)])
        case "complete": notify.notificationOccurred(.success)
        case "serve":    notify.notificationOccurred(.success); sequence([(0.18, light, 0.8)])
        case "star":     medium.impactOccurred(intensity: 0.9)
        case "vial":     sequence([(0, light, 0.4), (0.06, light, 0.6), (0.12, medium, 0.7), (0.2, medium, 1.0)])
        case "win":      sequence([(0, heavy, 1.0), (0.12, medium, 0.8)]); notify.notificationOccurred(.success)
        case "golden":   sequence([(0, heavy, 1.0), (0.1, heavy, 0.9), (0.2, heavy, 1.0), (0.35, medium, 1.0)])
        default:         break
        }
    }

    private func sequence(_ steps: [(delay: TimeInterval, generator: UIImpactFeedbackGenerator, intensity: CGFloat)]) {
        for step in steps {
            DispatchQueue.main.asyncAfter(deadline: .now() + step.delay) {
                step.generator.impactOccurred(intensity: step.intensity)
            }
        }
    }
}
