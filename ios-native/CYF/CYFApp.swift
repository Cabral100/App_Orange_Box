import SwiftUI

@main
struct CYFApp: App {
    @StateObject private var store = AppStore()
    @AppStorage(CYFAppearance.storageKey) private var appearance = CYFAppearance.light

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .preferredColorScheme(appearance.colorScheme)
        }
    }
}
