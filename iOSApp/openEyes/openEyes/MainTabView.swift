import SwiftUI

struct MainTabView: View {
    /// Fixed icon slot so the tab bar never changes height when Capture is selected.
    private enum TabBarMetrics {
        static let iconSlot: CGFloat = 44
        static let height: CGFloat = 82
    }

    enum Tab: CaseIterable {
        case discover, capture, map

        var title: String {
            switch self {
            case .discover: return "Discover"
            case .capture: return "Capture"
            case .map: return "Map"
            }
        }

        var icon: String {
            switch self {
            case .discover: return "newspaper.fill"
            case .capture: return "camera.fill"
            case .map: return "map.fill"
            }
        }
    }

    @State private var selectedTab: Tab = .discover
    @State private var mapFocusTarget: MapFocusTarget?
    @StateObject private var draftStore = CaptureDraftStore()
    @StateObject private var feedStore = NewsFeedStore()

    var body: some View {
        Group {
            switch selectedTab {
            case .discover:
                DiscoverView(feedStore: feedStore) { target in
                    mapFocusTarget = target
                    selectedTab = .map
                }
            case .capture:
                CaptureScreenView(draftStore: draftStore)
            case .map:
                MapScreenView(focusTarget: $mapFocusTarget, mapPins: feedStore.mapPins)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Ink.bg)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            tabBar
        }
        .preferredColorScheme(.light)
    }

    private var tabBar: some View {
        HStack(spacing: 0) {
            ForEach(Tab.allCases, id: \.self) { tab in
                tabButton(for: tab)
            }
        }
        .padding(.horizontal, 8)
        .padding(.top, 8)
        .padding(.bottom, 6)
        .frame(height: TabBarMetrics.height, alignment: .top)
        .background(Ink.surface)
        .overlay(alignment: .top) {
            Rectangle().fill(Ink.border).frame(height: 1)
        }
    }

    @ViewBuilder
    private func tabButton(for tab: Tab) -> some View {
        let isSelected = selectedTab == tab
        Button {
            withAnimation(.spring(response: 0.28, dampingFraction: 0.82)) {
                selectedTab = tab
            }
        } label: {
            VStack(spacing: 4) {
                ZStack {
                    if tab == .capture && isSelected {
                        Circle()
                            .fill(Ink.primary50)
                            .frame(width: 36, height: 36)
                    }
                    Image(systemName: tab.icon)
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(isSelected ? Ink.primary : Ink.textSubtle)
                }
                .frame(width: TabBarMetrics.iconSlot, height: TabBarMetrics.iconSlot)
                Text(tab.title)
                    .font(InkFont.caption(11))
                    .foregroundStyle(isSelected ? Ink.primary : Ink.textSubtle)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 4)
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    MainTabView()
}
