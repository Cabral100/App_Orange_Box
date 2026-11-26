import SwiftUI
import UIKit

struct DemoAvatar: View {
    let role: UserRole
    let size: CGFloat

    private static let portraits: [UserRole: UIImage] = {
        let files: [(UserRole, String)] = [(.inspection, "profile-operator"), (.admin, "profile-admin-v2")]
        return Dictionary(uniqueKeysWithValues: files.compactMap { role, name in
            let url = Bundle.main.url(forResource: name, withExtension: "png")
                ?? Bundle.main.url(forResource: name, withExtension: "png", subdirectory: "Resources")
            guard let url,
                  let photo = UIImage(contentsOfFile: url.path) else { return nil }
            return (role, photo)
        })
    }()

    var body: some View {
        Group {
            if let photo = Self.portraits[role] {
                Image(uiImage: photo).resizable().scaledToFill()
            } else {
                Image(systemName: "person.crop.circle.fill").resizable().scaledToFit()
                    .foregroundStyle(CYFColor.green)
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .accessibilityHidden(true)
    }
}

enum CYFAppearance: String, CaseIterable, Identifiable {
    case light, dark, system

    static let storageKey = "cyf.appearance"
    var id: Self { self }

    var title: String {
        switch self {
        case .light: "Claro"
        case .dark: "Escuro"
        case .system: "Sistema"
        }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .light: .light
        case .dark: .dark
        case .system: nil
        }
    }
}

enum CYFColor {
    static let ink = adaptive(0x142C22, 0xF1F8F3)
    static let muted = adaptive(0x40594B, 0xB7CABE)
    static let paper = adaptive(0xEAF3ED, 0x10261D)
    static let surface = adaptive(0xFCFDFB, 0x1B3529)
    static let soft = adaptive(0xE3EFE6, 0x284235)
    static let line = adaptive(0xCDDFD3, 0x395649)
    static let lineStrong = adaptive(0x8DAA98, 0x749584)
    static let green = adaptive(0x176643, 0x8FE1B0)
    static let greenDark = adaptive(0x0B4A33, 0xB0EAC7)
    static let greenSoft = adaptive(0xD8ECDF, 0x284F3A)
    static let forest = Color(uiColor: rgb(0x0B4A33))
    static let forestDeep = Color(uiColor: rgb(0x082B20))
    static let orange = Color(uiColor: rgb(0xB94513))
    static let orangeDark = adaptive(0x9D370D, 0xFFB982)
    static let orangeSoft = adaptive(0xFFE7D5, 0x53331F)
    static let yellow = Color(uiColor: rgb(0xEAB43C))
    static let red = adaptive(0xB83028, 0xFF8D7F)

    private static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(uiColor: UIColor { traits in
            rgb(traits.userInterfaceStyle == .dark ? dark : light)
        })
    }

    private static func rgb(_ hex: UInt32) -> UIColor {
        UIColor(
            red: CGFloat((hex >> 16) & 255) / 255,
            green: CGFloat((hex >> 8) & 255) / 255,
            blue: CGFloat(hex & 255) / 255,
            alpha: 1
        )
    }
}

struct CardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(CYFColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(CYFColor.line, lineWidth: 1))
            .shadow(color: Color.black.opacity(0.06), radius: 8, y: 3)
    }
}

extension View {
    func cyfCard() -> some View { modifier(CardModifier()) }
}

struct SectionEyebrow: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.footnote.weight(.semibold))
            .foregroundStyle(CYFColor.greenDark)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct PillButtonStyle: ButtonStyle {
    var color = CYFColor.forest
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.semibold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 54)
            .background(color.opacity(configuration.isPressed ? 0.78 : 1))
            .clipShape(Capsule())
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}
