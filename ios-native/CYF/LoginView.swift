import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var store: AppStore
    @State private var role: UserRole = .inspection
    @State private var user = "inspecao"
    @State private var password = "campo123"
    @State private var showPassword = false
    @State private var error = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                VStack(alignment: .leading, spacing: 9) {
                    SectionEyebrow(text: "CYF · Clean Your Farm")
                    Text("Acesso ao campo").font(.system(size: 38, weight: .black)).foregroundStyle(CYFColor.ink)
                    Text("Escolha sua função. A conta de teste será preenchida automaticamente.")
                        .font(.body.weight(.medium)).foregroundStyle(CYFColor.muted)
                }

                SectionEyebrow(text: "Como você vai usar o app?")
                HStack(spacing: 10) {
                    RoleCard(role: .inspection, selected: role == .inspection) { choose(.inspection) }
                    RoleCard(role: .admin, selected: role == .admin) { choose(.admin) }
                }

                VStack(spacing: 15) {
                    LabeledContent("Usuário") { TextField("Usuário", text: $user).textInputAutocapitalization(.never).multilineTextAlignment(.trailing) }
                    Divider()
                    LabeledContent("Senha") {
                        HStack {
                            if showPassword { TextField("Senha", text: $password) } else { SecureField("Senha", text: $password) }
                            Button { showPassword.toggle() } label: { Image(systemName: showPassword ? "eye.slash" : "eye") }
                        }.multilineTextAlignment(.trailing)
                    }
                }
                .padding(18)
                .cyfCard()

                Label("Conta de teste pronta para entrar", systemImage: "checkmark.circle.fill")
                    .font(.subheadline.weight(.semibold)).foregroundStyle(CYFColor.green)
                if !error.isEmpty { Label(error, systemImage: "exclamationmark.circle").font(.footnote.weight(.semibold)).foregroundStyle(CYFColor.red) }

                Button("Entrar como \(role == .admin ? "administrador" : "inspeção")", action: submit)
                    .buttonStyle(PillButtonStyle())

                HStack { Rectangle().frame(height: 1); Text("ou"); Rectangle().frame(height: 1) }
                    .foregroundStyle(CYFColor.lineStrong)
                Button { store.login(role: role) } label: {
                    Label("Continuar com Google", systemImage: "person.crop.circle.badge.checkmark")
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .font(.headline).foregroundStyle(CYFColor.ink)
                        .background(Color.white).clipShape(Capsule())
                        .overlay(Capsule().stroke(CYFColor.lineStrong))
                }
                Text("Demonstração offline. Os dados ficam somente neste aparelho.")
                    .font(.caption).foregroundStyle(CYFColor.muted).frame(maxWidth: .infinity, alignment: .center)
            }
            .padding(.horizontal, 22).padding(.top, 52).padding(.bottom, 30)
        }
        .background(CYFColor.paper.ignoresSafeArea())
    }

    private func choose(_ next: UserRole) {
        role = next; error = ""
        if next == .admin { user = "admin"; password = "admin123" }
        else { user = "inspecao"; password = "campo123" }
    }

    private func submit() {
        let valid = role == .admin ? (user.lowercased() == "admin" && password == "admin123") : (user.lowercased() == "inspecao" && password == "campo123")
        if valid { error = ""; store.login(role: role) }
        else { error = "Use o usuário e a senha de teste preenchidos." }
    }
}

private struct RoleCard: View {
    let role: UserRole
    let selected: Bool
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 9) {
                Image(systemName: role == .admin ? "person.badge.shield.checkmark" : "person.crop.circle.badge.checkmark")
                    .font(.title2).foregroundStyle(selected ? Color.white : CYFColor.green)
                    .frame(width: 46, height: 46).background(selected ? CYFColor.green : CYFColor.greenSoft).clipShape(RoundedRectangle(cornerRadius: 15))
                Text(role.title).font(.headline).foregroundStyle(CYFColor.ink)
                Text(role == .admin ? "Acesso completo e relatórios" : "Câmera, mapa e histórico")
                    .font(.caption.weight(.medium)).foregroundStyle(CYFColor.muted).multilineTextAlignment(.leading)
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, minHeight: 135, alignment: .leading).padding(14)
            .background(selected ? CYFColor.greenSoft : Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 22))
            .overlay(RoundedRectangle(cornerRadius: 22).stroke(selected ? CYFColor.green : CYFColor.lineStrong, lineWidth: 2))
        }.buttonStyle(.plain)
    }
}
