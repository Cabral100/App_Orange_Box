import AuthenticationServices
import SwiftUI
import UIKit

struct LoginView: View {
    private enum Step: Equatable { case welcome, login, create }

    @EnvironmentObject private var store: AppStore
    @Environment(\.colorScheme) private var colorScheme
    @State private var step: Step = .welcome
    @State private var role: UserRole = .inspection
    @State private var user = "inspecao"
    @State private var password = "campo123"
    @State private var name = ""
    @State private var email = ""
    @State private var confirmation = ""
    @State private var showPassword = false
    @State private var error = ""

    private var creating: Bool { step == .create }

    var body: some View {
        if step == .welcome {
            welcome
        } else {
            ScrollViewReader { scroll in
                ScrollView {
                    VStack(spacing: 0) {
                        accessHeader.id("access-top")
                        panel
                    }
                }
                .onChange(of: step) { _, _ in scroll.scrollTo("access-top", anchor: .top) }
            }
            .background(CYFColor.paper.ignoresSafeArea())
        }
    }

    private var welcome: some View {
        GeometryReader { viewport in
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    wordmark
                    Spacer(minLength: 60)
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Seu pomar, mais de perto.")
                            .font(.largeTitle.weight(.bold))
                            .accessibilityAddTraits(.isHeader)
                        Text("Registre vistorias, visualize os talhões e acompanhe as detecções em campo.")
                            .font(.body).foregroundStyle(.white.opacity(0.88))
                    }
                    Button { navigate(.login) } label: {
                        Label("Começar", systemImage: "arrow.right")
                    }
                    .buttonStyle(PillButtonStyle(color: CYFColor.orange))
                    Button("Criar conta de teste") { navigate(.create) }
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .buttonStyle(.plain)
                }
                .padding(.horizontal, 24).padding(.vertical, 22)
                .frame(minHeight: viewport.size.height, alignment: .topLeading)
            }
            .scrollBounceBehavior(.basedOnSize)
        }
        .foregroundStyle(.white)
        .background { welcomeBackdrop.ignoresSafeArea() }
    }

    private var welcomeBackdrop: some View {
        GeometryReader { frame in
            if let url = Bundle.main.url(forResource: "demo-inspection-1", withExtension: "png"),
               let photo = UIImage(contentsOfFile: url.path) {
                Image(uiImage: photo).resizable().scaledToFill()
                    .frame(width: frame.size.width, height: frame.size.height)
                    .clipped()
            }
        }
        .background(CYFColor.forest)
        .overlay {
            LinearGradient(stops: [
                .init(color: CYFColor.forestDeep.opacity(0.74), location: 0),
                .init(color: CYFColor.forest.opacity(0.25), location: 0.38),
                .init(color: CYFColor.forestDeep.opacity(0.94), location: 0.78),
                .init(color: CYFColor.forestDeep, location: 1)
            ], startPoint: .top, endPoint: .bottom)
        }
        .accessibilityHidden(true)
    }

    private var wordmark: some View {
        HStack(spacing: 10) {
            Image(systemName: "leaf.fill")
                .font(.headline).foregroundStyle(.white)
                .frame(width: 40, height: 40)
                .background(CYFColor.orange, in: RoundedRectangle(cornerRadius: 13))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text("CYF").font(.title2.bold())
                Text("Clean Your Farm").font(.footnote.weight(.semibold))
            }.accessibilityElement(children: .combine)
        }
    }

    private var accessHeader: some View {
        HStack(spacing: 12) {
            Button { navigate(creating ? .login : .welcome) } label: {
                Image(systemName: "chevron.left").font(.headline)
                    .frame(width: 44, height: 44)
                    .background(.white.opacity(0.14), in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Voltar")
            wordmark
            Spacer()
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 20).padding(.vertical, 15)
        .background(CYFColor.forestDeep)
    }

    private var panel: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(creating ? "Criar conta" : "Acesso ao campo")
                .font(.largeTitle.weight(.bold)).foregroundStyle(CYFColor.ink)
                .accessibilityAddTraits(.isHeader)
            Text(creating ? "Crie um acesso local de Inspeção para experimentar o CYF." : "Escolha seu perfil. Os dados de teste são preenchidos automaticamente.")
                .font(.body).foregroundStyle(CYFColor.muted)
            if creating { registrationForm } else { loginForm }
            if !error.isEmpty {
                Label(error, systemImage: "exclamationmark.circle")
                    .font(.footnote.weight(.semibold)).foregroundStyle(CYFColor.orangeDark)
            }
            Button(creating ? "Criar acesso local" : "Entrar como \(role.title.lowercased())", action: submit)
                .buttonStyle(PillButtonStyle())
            if !creating { providerOptions }
            link(creating ? "Já tenho conta de teste" : "Criar conta de teste") { navigate(creating ? .login : .create) }
            Text("Acesso demonstrativo. Os dados ficam neste aparelho.")
                .font(.footnote).foregroundStyle(CYFColor.muted)
                .frame(maxWidth: .infinity, alignment: .center)
        }
        .padding(18).cyfCard().padding(14)
    }

    private var providerOptions: some View {
        VStack(spacing: 9) {
            HStack(spacing: 10) {
                Rectangle().fill(CYFColor.line).frame(height: 1)
                Text("Acesso social de demonstração").font(.caption).foregroundStyle(CYFColor.muted)
                Rectangle().fill(CYFColor.line).frame(height: 1)
            }.padding(.vertical, 4)
            Button { store.login(role: role) } label: {
                Label {
                    Text("Entrar com Google").font(.subheadline.weight(.semibold))
                } icon: {
                    Image("GoogleSignInMark").resizable().scaledToFit().frame(width: 19, height: 19)
                }
                .frame(maxWidth: .infinity, minHeight: 50)
                .foregroundStyle(Color.black.opacity(0.86))
                .background(.white, in: RoundedRectangle(cornerRadius: 11))
                .overlay { RoundedRectangle(cornerRadius: 11).strokeBorder(CYFColor.lineStrong) }
            }.buttonStyle(.plain)
            AppleDemoButton(style: colorScheme == .dark ? .whiteOutline : .black) { store.login(role: role) }
                .id(colorScheme).frame(height: 50)
        }
    }

    private var registrationForm: some View {
        VStack(spacing: 10) {
            field("Nome completo") { TextField("Nome completo", text: $name).textContentType(.name) }
            field("E-mail") {
                TextField("E-mail", text: $email).textContentType(.emailAddress)
                    .keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
            }
            passwordField(title: "Senha", value: $password, toggle: true)
            passwordField(title: "Confirmar senha", value: $confirmation)
        }
    }

    private var loginForm: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Como você vai usar o app?").font(.footnote.bold()).foregroundStyle(CYFColor.ink)
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .top, spacing: 8) { roleButton(.inspection); roleButton(.admin) }
                VStack(spacing: 8) { roleButton(.inspection); roleButton(.admin) }
            }
            field("Usuário") {
                TextField("Usuário", text: $user).textContentType(.username)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
            }
            passwordField(title: "Senha", value: $password, toggle: true)
            link("Usar conta de teste") { choose(role) }
        }
    }

    private func field<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.footnote.bold()).foregroundStyle(CYFColor.ink).accessibilityHidden(true)
            content().foregroundStyle(CYFColor.ink).padding(.horizontal, 15)
                .frame(minHeight: 50).background(CYFColor.soft, in: Capsule())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func passwordField(title: String, value: Binding<String>, toggle: Bool = false) -> some View {
        field(title) {
            HStack {
                Group {
                    if showPassword { TextField(title, text: value) }
                    else { SecureField(title, text: value) }
                }
                .textContentType(creating ? .newPassword : .password)
                .textInputAutocapitalization(.never).autocorrectionDisabled()
                if toggle {
                    Button { showPassword.toggle() } label: {
                        Image(systemName: showPassword ? "eye.slash" : "eye").frame(width: 44, height: 44)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(CYFColor.green)
                    .accessibilityLabel(showPassword ? "Ocultar senha" : "Mostrar senha")
                }
            }
        }
    }

    private func roleButton(_ option: UserRole) -> some View {
        Button { choose(option) } label: {
            HStack(alignment: .top, spacing: 6) {
                Image(systemName: option == .admin ? "chart.bar.xaxis" : "scope")
                    .font(.subheadline.weight(.semibold)).foregroundStyle(CYFColor.greenDark)
                    .frame(width: 28, height: 28).accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 3) {
                    Text(option.title).font(.subheadline.bold()).foregroundStyle(CYFColor.ink)
                    Text(option == .admin ? "Operação e relatórios" : "Câmera, mapa e histórico")
                        .font(.footnote).foregroundStyle(CYFColor.muted)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 63, alignment: .leading).padding(.horizontal, 8)
            .background(role == option ? CYFColor.greenSoft : CYFColor.soft, in: RoundedRectangle(cornerRadius: 14))
            .overlay { RoundedRectangle(cornerRadius: 14).strokeBorder(role == option ? CYFColor.green : CYFColor.line) }
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(role == option ? .isSelected : [])
    }

    private func link(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).font(.subheadline.bold()).underline()
                .frame(maxWidth: .infinity, minHeight: 44)
        }
        .buttonStyle(.plain).foregroundStyle(CYFColor.greenDark)
    }

    private func navigate(_ next: Step) {
        if next == .create {
            password = ""
            confirmation = ""
        } else if creating {
            choose(role)
        }
        error = ""
        showPassword = false
        step = next
    }

    private func choose(_ option: UserRole) {
        role = option
        user = option == .admin ? "admin" : "inspecao"
        password = option == .admin ? "admin123" : "campo123"
        error = ""
    }

    private func submit() {
        if creating {
            let displayName = name.trimmingCharacters(in: .whitespacesAndNewlines)
            let address = email.trimmingCharacters(in: .whitespacesAndNewlines)
            if displayName.isEmpty { error = "Informe seu nome completo."; return }
            if address.range(of: #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#, options: .regularExpression) == nil { error = "Informe um e-mail válido."; return }
            if password.count < 6 { error = "Crie uma senha de pelo menos seis caracteres."; return }
            if password != confirmation { error = "As senhas precisam ser iguais."; return }
            store.login(session: Session(name: displayName, email: address, role: .inspection))
            return
        }
        let expectedUser = role == .admin ? "admin" : "inspecao"
        let expectedPassword = role == .admin ? "admin123" : "campo123"
        if user.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == expectedUser && password == expectedPassword {
            store.login(role: role)
        } else {
            error = "Usuário ou senha incorretos. Toque em Usar conta de teste para preencher os dados."
        }
    }
}

private struct AppleDemoButton: UIViewRepresentable {
    let style: ASAuthorizationAppleIDButton.Style
    var action: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(action: action) }

    func makeUIView(context: Context) -> ASAuthorizationAppleIDButton {
        let button = ASAuthorizationAppleIDButton(type: .signIn, style: style)
        button.cornerRadius = 11
        button.addTarget(context.coordinator, action: #selector(Coordinator.tapped), for: .touchUpInside)
        return button
    }

    func updateUIView(_ button: ASAuthorizationAppleIDButton, context: Context) {
        context.coordinator.action = action
    }

    final class Coordinator: NSObject {
        var action: () -> Void
        init(action: @escaping () -> Void) { self.action = action }
        @objc func tapped() { action() }
    }
}
