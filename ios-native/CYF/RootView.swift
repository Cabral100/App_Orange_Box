import SwiftUI

struct RootView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        Group {
            if store.session == nil {
                LoginView()
            } else if let selected = store.selectedInspection {
                InspectionDetailView(record: selected)
            } else {
                appTabs
            }
        }
        .tint(CYFColor.green)
        .background(CYFColor.paper.ignoresSafeArea())
    }

    private var appTabs: some View {
        TabView(selection: $store.selectedTab) {
            MapScreen().tag(AppTab.map).tabItem { Label("Mapa", systemImage: "map") }
            HistoryScreen().tag(AppTab.history).tabItem { Label("Histórico", systemImage: "clock.arrow.circlepath") }
            CameraScreen().tag(AppTab.camera).tabItem { Label("Câmera", systemImage: "camera.fill") }
            if store.session?.role == .admin {
                DashboardScreen().tag(AppTab.dashboard).tabItem { Label("Relatórios", systemImage: "chart.pie.fill") }
            }
            AccountScreen().tag(AppTab.account).tabItem { Label("Conta", systemImage: "person.crop.circle") }
        }
        .toolbarBackground(.visible, for: .tabBar)
        .toolbarBackground(Color.white, for: .tabBar)
    }
}

struct AppHeader: View {
    let title: String
    var subtitle: String? = nil
    var trailing: AnyView? = nil

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                SectionEyebrow(text: "Fazenda Boa Esperança")
                Text(title).font(.system(size: 34, weight: .black)).foregroundStyle(CYFColor.ink)
                if let subtitle { Text(subtitle).font(.subheadline.weight(.medium)).foregroundStyle(CYFColor.muted) }
            }
            Spacer()
            trailing
        }
    }
}

struct EmptyState: View {
    let icon: String
    let title: String
    let message: String
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: icon).font(.system(size: 44)).foregroundStyle(CYFColor.lineStrong)
            Text(title).font(.title3.bold()).foregroundStyle(CYFColor.ink)
            Text(message).font(.subheadline).foregroundStyle(CYFColor.muted).multilineTextAlignment(.center)
        }
        .padding(36)
    }
}
