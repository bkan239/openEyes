import SwiftUI

// Editorial Ink — warm light theme with petrol accent and status trias.
enum Ink {
    static let bg = Color(hex: 0xFCFBF8)
    static let surface = Color(hex: 0xFFFFFF)
    static let surfaceSunken = Color(hex: 0xF7F5F0)
    static let border = Color(hex: 0xECE9E1)
    static let borderStrong = Color(hex: 0xDEDAD0)
    static let text = Color(hex: 0x1C1B19)
    static let textMuted = Color(hex: 0x6B6862)
    static let textSubtle = Color(hex: 0x908B80)

    static let primary50 = Color(hex: 0xEDF7F5)
    static let primary100 = Color(hex: 0xD2EAE5)
    static let primary = Color(hex: 0x0F766E)
    static let primaryHover = Color(hex: 0x115E59)
    static let onPrimary = Color.white

    static let ink = Color(hex: 0x1C1B19)
    static let inkSurface = Color(hex: 0x26241F)
    static let inkBorder = Color(hex: 0x3A3833)
    static let onInk = Color(hex: 0xFCFBF8)
    static let onInkMuted = Color(hex: 0xA8A296)
    static let primaryOnInk = Color(hex: 0x6FBDB0)
}

enum VerificationStatus: String, CaseIterable {
    case verified, pending, disputed

    var label: String {
        rawValue.capitalized
    }

    var foreground: Color {
        switch self {
        case .verified: return Color(hex: 0x15803D)
        case .pending: return Color(hex: 0xB45309)
        case .disputed: return Color(hex: 0xB91C1C)
        }
    }

    var background: Color {
        switch self {
        case .verified: return Color(hex: 0xEAF6EC)
        case .pending: return Color(hex: 0xFBF1E3)
        case .disputed: return Color(hex: 0xFBEBEB)
        }
    }

    var border: Color {
        switch self {
        case .verified: return Color(hex: 0xC7E6CE)
        case .pending: return Color(hex: 0xF0D9B5)
        case .disputed: return Color(hex: 0xF2CFCF)
        }
    }
}

enum InkFont {
    static func title(_ size: CGFloat = 34) -> Font {
        .system(size: size, weight: .bold, design: .serif)
    }

    static func headline(_ size: CGFloat = 20) -> Font {
        .system(size: size, weight: .semibold, design: .default)
    }

    static func body(_ size: CGFloat = 16) -> Font {
        .system(size: size, weight: .regular, design: .default)
    }

    static func caption(_ size: CGFloat = 13) -> Font {
        .system(size: size, weight: .medium, design: .default)
    }
}

struct StatusBadge: View {
    let status: VerificationStatus

    var body: some View {
        Text(status.label)
            .font(InkFont.caption(12))
            .foregroundStyle(status.foreground)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(status.background)
            .overlay(Capsule().stroke(status.border, lineWidth: 1))
            .clipShape(Capsule())
    }
}

struct PrimaryButton: View {
    let title: String
    var isLoading = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView().tint(Ink.onPrimary)
                }
                Text(title)
                    .font(InkFont.headline(16))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .foregroundStyle(Ink.onPrimary)
            .background(Ink.primary)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
    }
}

struct InkCard<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        content
            .background(Ink.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Ink.border, lineWidth: 1)
            )
            .shadow(color: Color(hex: 0x1C1B19).opacity(0.06), radius: 8, y: 2)
    }
}

struct ScaleButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.92 : 1.0)
            .animation(.spring(response: 0.2, dampingFraction: 0.6), value: configuration.isPressed)
    }
}

extension Color {
    init(hex: UInt32, alpha: Double = 1) {
        let r = Double((hex >> 16) & 0xFF) / 255
        let g = Double((hex >> 8) & 0xFF) / 255
        let b = Double(hex & 0xFF) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: alpha)
    }
}
