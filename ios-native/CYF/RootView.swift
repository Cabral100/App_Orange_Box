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
            MapScreen().toolbar(.hidden, for: .tabBar).tag(AppTab.map)
            HistoryScreen().toolbar(.hidden, for: .tabBar).tag(AppTab.history)
            CameraScreen().tag(AppTab.camera)
            if store.session?.role == .admin {
                DashboardScreen().toolbar(.hidden, for: .tabBar).tag(AppTab.dashboard)
            }
            AccountScreen().toolbar(.hidden, for: .tabBar).tag(AppTab.account)
        }
        .toolbar(.hidden, for: .tabBar)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if store.selectedTab != .camera {
                tabBar
            }
        }
    }

    private var tabBar: some View {
        HStack(spacing: 2) {
            HStack(spacing: 0) {
                tab(.map, title: "Mapa", icon: "map")
                tab(.history, title: "Histórico", icon: "clock.arrow.circlepath")
            }.frame(maxWidth: .infinity)

            tab(.camera, title: "Câmera", icon: "camera.fill")
                .frame(width: 68)
                .zIndex(1)

            HStack(spacing: 0) {
                if store.session?.role == .admin {
                    tab(.dashboard, title: "Relatórios", icon: "chart.pie")
                }
                tab(.account, title: "Conta", icon: "person.crop.circle")
            }.frame(maxWidth: .infinity)
        }
        .padding(.horizontal, 8).padding(.top, 8).padding(.bottom, 4)
        .background {
            Color.white.ignoresSafeArea(edges: .bottom)
                .shadow(color: CYFColor.greenDark.opacity(0.1), radius: 12, y: -4)
        }
        .overlay(alignment: .top) { Rectangle().fill(CYFColor.line).frame(height: 1).allowsHitTesting(false) }
    }

    private func tab(_ destination: AppTab, title: String, icon: String) -> some View {
        let selected = store.selectedTab == destination
        let camera = destination == .camera
        return Button {
            store.selectedTab = destination
        } label: {
            VStack(spacing: 5) {
                if camera {
                    Color.clear.frame(width: 54, height: 29)
                        .overlay(alignment: .bottom) {
                            Image(systemName: icon)
                                .font(.system(size: 23, weight: .semibold))
                                .foregroundStyle(.white)
                                .frame(width: 54, height: 54)
                                .background(CYFColor.orange, in: Circle())
                                .shadow(color: CYFColor.orangeDark.opacity(0.3), radius: 6, y: 4)
                                .offset(y: -4)
                        }
                } else {
                    Image(systemName: icon).font(.system(size: 20, weight: selected ? .semibold : .regular))
                        .frame(height: 29)
                }
                Text(title).font(.caption2.weight(selected || camera ? .bold : .medium))
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
            .foregroundStyle(selected ? CYFColor.greenDark : CYFColor.muted)
            .frame(maxWidth: .infinity, minHeight: 48)
            .contentShape(Rectangle().inset(by: camera ? -15 : 0))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
        .accessibilityAddTraits(selected ? .isSelected : [])
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
