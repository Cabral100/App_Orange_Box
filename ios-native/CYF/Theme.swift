import SwiftUI

enum CYFColor {
    static let ink = Color(red: 0.094, green: 0.137, blue: 0.110)
    static let muted = Color(red: 0.306, green: 0.341, blue: 0.318)
    static let soft = Color(red: 0.945, green: 0.949, blue: 0.925)
    static let paper = Color(red: 0.980, green: 0.984, blue: 0.969)
    static let line = Color(red: 0.855, green: 0.867, blue: 0.839)
    static let lineStrong = Color(red: 0.749, green: 0.780, blue: 0.753)
    static let green = Color(red: 0.051, green: 0.420, blue: 0.251)
    static let greenDark = Color(red: 0.031, green: 0.306, blue: 0.188)
    static let greenSoft = Color(red: 0.898, green: 0.949, blue: 0.914)
    static let orange = Color(red: 0.914, green: 0.306, blue: 0.043)
    static let orangeDark = Color(red: 0.722, green: 0.227, blue: 0.031)
    static let orangeSoft = Color(red: 0.992, green: 0.906, blue: 0.867)
    static let yellow = Color(red: 0.949, green: 0.722, blue: 0.086)
    static let red = Color(red: 0.851, green: 0.204, blue: 0.169)
}

struct CardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(CYFColor.line, lineWidth: 1))
            .shadow(color: Color.black.opacity(0.08), radius: 14, y: 7)
    }
}

extension View {
    func cyfCard() -> some View { modifier(CardModifier()) }
}

struct SectionEyebrow: View {
    let text: String
    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .heavy))
            .tracking(1.2)
            .foregroundStyle(CYFColor.greenDark)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct PillButtonStyle: ButtonStyle {
    var color = CYFColor.green
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 15, weight: .bold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 54)
            .background(color.opacity(configuration.isPressed ? 0.78 : 1))
            .clipShape(Capsule())
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}
