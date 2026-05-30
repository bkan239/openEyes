import SwiftUI

struct MainTabView: View {
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

    var body: some View {
        VStack(spacing: 0) {
            Group {
                switch selectedTab {
                case .discover:
                    DiscoverView { target in
                        mapFocusTarget = target
                        selectedTab = .map
                    }
                case .capture:
                    CaptureScreenView(draftStore: draftStore)
                case .map:
                    MapScreenView(focusTarget: $mapFocusTarget)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            HStack(spacing: 0) {
                ForEach(Tab.allCases, id: \.self) { tab in
                    tabButton(for: tab)
                }
            }
            .padding(.horizontal, 8)
            .padding(.top, 8)
            .padding(.bottom, 4)
            .background(Ink.surface)
            .overlay(alignment: .top) {
                Rectangle().fill(Ink.border).frame(height: 1)
            }
        }
        .background(Ink.bg.ignoresSafeArea())
        .preferredColorScheme(.light)
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
                            .frame(width: 44, height: 44)
                    }
                    Image(systemName: tab.icon)
                        .font(.system(size: tab == .capture ? 22 : 20, weight: .semibold))
                        .foregroundStyle(isSelected ? Ink.primary : Ink.textSubtle)
                }
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
