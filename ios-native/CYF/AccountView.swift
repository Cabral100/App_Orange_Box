import SwiftUI

struct AccountScreen: View {
    @EnvironmentObject private var store: AppStore
    @State private var settings = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    profileHero
                    VStack(alignment: .leading, spacing: 10) {
                        SectionEyebrow(text: "Fazenda Boa Esperança · Resumo").padding(.top, 25)
                        HStack(spacing: 9) {
                            StatCard(value: store.plots.count, label: "talhões", icon: "square.3.layers.3d")
                            StatCard(value: store.records.count, label: "inspeções", icon: "camera")
                            StatCard(value: store.records.reduce(0) { $0 + $1.confirmedCount }, label: "pragas", icon: "exclamationmark.triangle")
                        }
                        SectionEyebrow(text: "Seu perfil").padding(.top, 15)
                        HStack(alignment: .top, spacing: 13) {
                            Image(systemName: store.session?.role == .admin ? "person.badge.shield.checkmark" : "person.crop.circle.badge.checkmark")
                                .font(.title2).foregroundStyle(CYFColor.green).frame(width: 48, height: 48).background(CYFColor.greenSoft).clipShape(RoundedRectangle(cornerRadius: 16))
                            VStack(alignment: .leading, spacing: 5) {
                                Text(store.session?.role == .admin ? "Gestão completa da fazenda" : "Inspeção essencial de campo").font(.headline)
                                Text(store.session?.role == .admin ? "Acompanhe relatórios, compare talhões, gerencie limites, registre pulverizações e exporte os resultados." : "Fotografe laranjas, consulte o mapa, acompanhe o histórico e registre o manejo dos talhões durante a vistoria.")
                                    .font(.subheadline).foregroundStyle(CYFColor.muted)
                            }
                        }.padding(17).cyfCard()
                    }.padding(.horizontal, 20)
                }
            }
            .background(CYFColor.paper)
            .sheet(isPresented: $settings) { SettingsView() }
        }
    }

    private var profileHero: some View {
        HStack(spacing: 14) {
            Image(store.session?.role == .admin ? "profile-admin-v2" : "profile-operator")
                .resizable().scaledToFill().frame(width: 74, height: 74).clipShape(Circle()).overlay(Circle().stroke(Color.white.opacity(0.5), lineWidth: 2))
            VStack(alignment: .leading, spacing: 3) {
                Text(greeting + ",").font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.76))
                Text(store.session?.name ?? "Marcos Oliveira").font(.title3.bold()).foregroundStyle(.white)
                Text(store.session?.role == .admin ? "Perfil administrador" : "Perfil de inspeção").font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.82))
            }
            Spacer()
            Button { settings = true } label: { Image(systemName: "gearshape").foregroundStyle(.white).frame(width: 42, height: 42).background(.white.opacity(0.14)).clipShape(RoundedRectangle(cornerRadius: 15)) }
        }
        .padding(.horizontal, 20).padding(.top, 48).padding(.bottom, 23)
        .background(CYFColor.green).clipShape(UnevenRoundedRectangle(bottomLeadingRadius: 30, bottomTrailingRadius: 30))
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite"
    }
}

private struct StatCard: View {
    let value: Int; let label: String; let icon: String
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: icon).foregroundStyle(CYFColor.green)
            Text("\(value)").font(.title2.bold()).foregroundStyle(CYFColor.ink)
            Text(label).font(.caption.weight(.semibold)).foregroundStyle(CYFColor.muted)
        }.frame(maxWidth: .infinity, minHeight: 82, alignment: .leading).padding(13).cyfCard()
    }
}

private struct SettingsView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    Image(store.session?.role == .admin ? "profile-admin-v2" : "profile-operator")
                        .resizable().scaledToFill().frame(width: 94, height: 94).clipShape(Circle())
                    Text(store.session?.name ?? "").font(.title2.bold())
                    Text(store.session?.role.title ?? "").foregroundStyle(CYFColor.muted)
                    SectionEyebrow(text: "Dados da conta")
                    VStack(spacing: 0) {
                        SettingRow(icon: "person", label: "Nome", value: store.session?.name ?? "")
                        Divider(); SettingRow(icon: "envelope", label: "E-mail", value: store.session?.email ?? "")
                        Divider(); SettingRow(icon: "person.badge.shield.checkmark", label: "Perfil de acesso", value: store.session?.role == .admin ? "Administrador · acesso completo" : "Inspeção · acesso essencial")
                    }.padding(.horizontal, 15).cyfCard()
                    SectionEyebrow(text: "Aplicativo")
                    VStack(spacing: 0) {
                        SettingRow(icon: "iphone", label: "Armazenamento", value: "Neste aparelho")
                        Divider(); SettingRow(icon: "brain.head.profile", label: "Análise", value: "UltralyticsYOLO · Core ML")
                    }.padding(.horizontal, 15).cyfCard()
                    Button(role: .destructive) { store.logout(); dismiss() } label: { Label("Sair da conta", systemImage: "rectangle.portrait.and.arrow.right").frame(maxWidth: .infinity, minHeight: 52) }
                        .buttonStyle(.bordered).buttonBorderShape(.capsule)
                    Text("CYF · Clean Your Farm · SwiftUI nativo").font(.caption).foregroundStyle(CYFColor.muted)
                }.padding(20)
            }.background(CYFColor.paper).navigationTitle("Configurações").navigationBarTitleDisplayMode(.inline).toolbar { ToolbarItem(placement: .topBarLeading) { Button("Fechar") { dismiss() } } }
        }
    }
}

private struct SettingRow: View {
    let icon: String; let label: String; let value: String
    var body: some View { HStack(spacing: 12) { Image(systemName: icon).foregroundStyle(CYFColor.green).frame(width: 24); VStack(alignment: .leading) { Text(label).font(.caption).foregroundStyle(CYFColor.muted); Text(value).font(.subheadline.bold()) }; Spacer() }.frame(minHeight: 68) }
}
