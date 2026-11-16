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
        appContent
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                CYFBottomBar(selection: $store.selectedTab, isAdmin: store.session?.role == .admin)
                    .background(Color.white.ignoresSafeArea(edges: .bottom))
            }
    }

    @ViewBuilder private var appContent: some View {
        switch store.selectedTab {
        case .map:
            MapScreen()
        case .history:
            HistoryScreen()
        case .camera:
            CameraScreen()
        case .dashboard:
            if store.session?.role == .admin { DashboardScreen() } else { AccountScreen() }
        case .account:
            AccountScreen()
        }
    }
}

private struct CYFBottomBar: View {
    @Binding var selection: AppTab
    let isAdmin: Bool

    var body: some View {
        HStack(alignment: .bottom, spacing: 0) {
            item(.map, title: "Mapa", icon: "map")
            item(.history, title: "Histórico", icon: "clock.arrow.circlepath")
            cameraButton
            if isAdmin {
                item(.dashboard, title: "Relatórios", icon: "chart.bar.xaxis")
            } else {
                Color.clear.frame(maxWidth: .infinity, minHeight: 50)
            }
            item(.account, title: "Conta", icon: "person.crop.circle")
        }
        .frame(height: 64)
        .padding(.horizontal, 6)
        .padding(.top, 2)
        .background(Color.white.shadow(color: .black.opacity(0.10), radius: 12, y: -4))
        .accessibilityElement(children: .contain)
    }

    private func item(_ tab: AppTab, title: String, icon: String) -> some View {
        Button { selection = tab } label: {
            VStack(spacing: 4) {
                Image(systemName: icon).font(.system(size: 20, weight: selection == tab ? .bold : .medium))
                Text(title).font(.system(size: 10, weight: selection == tab ? .bold : .medium)).lineLimit(1)
            }
            .foregroundStyle(selection == tab ? CYFColor.green : CYFColor.muted)
            .frame(maxWidth: .infinity, minHeight: 50)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }

    private var cameraButton: some View {
        Button { selection = .camera } label: {
            VStack(spacing: 3) {
                ZStack {
                    Circle().fill(CYFColor.orange).frame(width: 58, height: 58)
                        .shadow(color: CYFColor.orange.opacity(0.34), radius: 10, y: 5)
                    Circle().stroke(.white.opacity(0.9), lineWidth: 3).frame(width: 48, height: 48)
                    Image(systemName: "camera.fill").font(.system(size: 23, weight: .bold)).foregroundStyle(.white)
                }
                Text("Câmera").font(.system(size: 10, weight: .bold)).foregroundStyle(selection == .camera ? CYFColor.orangeDark : CYFColor.muted)
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
        .offset(y: -13)
        .accessibilityLabel("Câmera")
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
