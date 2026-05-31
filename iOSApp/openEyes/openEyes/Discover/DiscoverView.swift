import MapKit
import SwiftUI

struct DiscoverView: View {
    @ObservedObject var feedStore: NewsFeedStore
    @State private var selectedCategoryID = "all"
    @State private var previousCategoryID = "all"
    @State private var isSearching = false
    @State private var searchText = ""
    @State private var selectedStory: NewsStory?
    @State private var isLoadingDetail = false
    let onShowOnMap: (MapFocusTarget) -> Void

    private var categoryItems: [(id: String, title: String, icon: String)] {
        MockData.categoryItems
    }

    private var filteredStories: [NewsStory] {
        if isSearching && searchText.isEmpty {
            return []
        }

        var stories = feedStore.stories

        if !isSearching && selectedCategoryID != "all" {
            stories = stories.filter { $0.category.lowercased() == selectedCategoryID }
        }

        if !searchText.isEmpty {
            stories = stories.filter { story in
                story.title.localizedCaseInsensitiveContains(searchText)
                    || story.description.localizedCaseInsensitiveContains(searchText)
                    || story.location.localizedCaseInsensitiveContains(searchText)
            }
        }

        return stories
    }

    var body: some View {
        ZStack {
            VStack(spacing: 0) {
                HStack {
                    Text("Discover")
                        .font(InkFont.title())
                        .foregroundStyle(Ink.text)
                    Spacer()
                    Menu {
                        Button("View Saved") {}
                        Button("My Posts") {}
                    } label: {
                        Image(systemName: "person.crop.circle")
                            .font(.system(size: 22, weight: .semibold))
                            .foregroundStyle(Ink.text)
                            .frame(width: 36, height: 36)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 10)
                .padding(.bottom, 16)

                if feedStore.isUsingMockFallback, let loadError = feedStore.loadError {
                    HStack(spacing: 8) {
                        Image(systemName: "wifi.exclamationmark")
                            .font(.system(size: 13, weight: .semibold))
                        Text(loadError)
                            .font(InkFont.body(12))
                            .lineLimit(2)
                        Spacer(minLength: 0)
                    }
                    .foregroundStyle(Ink.textMuted)
                    .padding(.horizontal, 20)
                    .padding(.bottom, 10)
                }

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        if let firstCategory = categoryItems.first {
                            DiscoverCategoryChip(
                                title: firstCategory.title,
                                icon: firstCategory.icon,
                                isSelected: selectedCategoryID == firstCategory.id && !isSearching
                            ) {
                                withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                                    previousCategoryID = firstCategory.id
                                    selectedCategoryID = firstCategory.id
                                    isSearching = false
                                    searchText = ""
                                }
                            }
                        }

                        Button {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                                if isSearching {
                                    isSearching = false
                                    selectedCategoryID = previousCategoryID
                                    searchText = ""
                                } else {
                                    previousCategoryID = selectedCategoryID
                                    isSearching = true
                                }
                            }
                        } label: {
                            HStack(spacing: 6) {
                                Image(systemName: isSearching ? "xmark" : "magnifyingglass")
                                    .font(.system(size: 14, weight: .semibold))
                                Text(isSearching ? "Cancel" : "Search")
                                    .font(.system(size: 15, weight: .semibold))
                            }
                            .foregroundStyle(isSearching ? Ink.onPrimary : Ink.text)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 10)
                            .background(
                                Capsule()
                                    .fill(isSearching ? Ink.primary : Ink.surfaceSunken)
                                    .overlay(
                                        Capsule()
                                            .stroke(isSearching ? Color.clear : Ink.border, lineWidth: 1)
                                    )
                            )
                            .shadow(color: isSearching ? Ink.primary.opacity(0.25) : .clear, radius: 8)
                        }
                        .buttonStyle(ScaleButtonStyle())

                        ForEach(Array(categoryItems.dropFirst()), id: \.id) { category in
                            DiscoverCategoryChip(
                                title: category.title,
                                icon: category.icon,
                                isSelected: selectedCategoryID == category.id && !isSearching
                            ) {
                                withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                                    previousCategoryID = category.id
                                    selectedCategoryID = category.id
                                    isSearching = false
                                    searchText = ""
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                }
                .padding(.bottom, isSearching ? 12 : 20)

                if isSearching {
                    HStack(spacing: 12) {
                        HStack {
                            Image(systemName: "magnifyingglass")
                                .foregroundStyle(Ink.textSubtle)
                                .font(.system(size: 16))
                            TextField("Search stories, locations...", text: $searchText)
                                .font(InkFont.body(15))
                                .foregroundStyle(Ink.text)
                                .autocorrectionDisabled()
                                .textInputAutocapitalization(.never)
                            if !searchText.isEmpty {
                                Button { searchText = "" } label: {
                                    Image(systemName: "xmark.circle.fill")
                                        .foregroundStyle(Ink.textSubtle)
                                        .font(.system(size: 16))
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(Ink.surfaceSunken)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .stroke(Ink.border, lineWidth: 1)
                                )
                        )
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 16)
                    .transition(.move(edge: .top).combined(with: .opacity))
                }

                ScrollView {
                    LazyVStack(spacing: 16) {
                        if feedStore.isLoading && filteredStories.isEmpty {
                            ProgressView("Loading stories…")
                                .font(InkFont.body(14))
                                .foregroundStyle(Ink.textMuted)
                                .padding(.top, 40)
                        }

                        ForEach(filteredStories) { story in
                            NewsStoryCard(story: story) {
                                withAnimation(.spring(response: 0.34, dampingFraction: 0.88)) {
                                    selectedStory = story
                                }
                                Task {
                                    isLoadingDetail = true
                                    if let detailed = await feedStore.storyDetail(id: story.id) {
                                        selectedStory = detailed
                                    }
                                    isLoadingDetail = false
                                }
                            }
                        }

                        if filteredStories.isEmpty {
                            VStack(spacing: 12) {
                                Image(systemName: "magnifyingglass")
                                    .font(.system(size: 48))
                                    .foregroundStyle(Ink.textSubtle.opacity(0.5))
                                Text(isSearching && searchText.isEmpty ? "Start typing to search" : "No results found")
                                    .font(.system(size: 20, weight: .semibold))
                                    .foregroundStyle(Ink.text)
                                Text(isSearching && searchText.isEmpty ? "Enter keywords to find stories" : "Try adjusting your search or category")
                                    .font(InkFont.body(14))
                                    .foregroundStyle(Ink.textMuted)
                            }
                            .padding(.top, 60)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 24)
                }
                .refreshable {
                    await feedStore.refresh()
                }
            }

            if let selectedStory {
                DiscoverStoryDetailView(
                    story: selectedStory,
                    isLoadingArticles: isLoadingDetail,
                    onClose: {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.88)) {
                            self.selectedStory = nil
                        }
                    },
                    onShowOnMap: onShowOnMap
                )
                .id(selectedStory.id)
                .zIndex(1)
                .transition(.move(edge: .trailing).combined(with: .opacity))
            }
        }
        .background(Ink.bg)
        .task {
            await feedStore.refresh()
        }
    }
}

struct DiscoverCategoryChip: View {
    let title: String
    let icon: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .semibold))
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
            }
            .foregroundStyle(isSelected ? Ink.onPrimary : Ink.text)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(
                Capsule()
                    .fill(isSelected ? Ink.primary : Ink.surfaceSunken)
                    .overlay(
                        Capsule()
                            .stroke(isSelected ? Color.clear : Ink.border, lineWidth: 1)
                    )
            )
            .shadow(color: isSelected ? Ink.primary.opacity(0.25) : .clear, radius: 8)
        }
        .buttonStyle(ScaleButtonStyle())
    }
}

struct NewsStoryCard: View {
    let story: NewsStory
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 0) {
                ZStack {
                    Color.clear
                        .aspectRatio(16 / 9, contentMode: .fit)
                        .frame(maxWidth: .infinity)
                        .overlay(
                            Group {
                                if let imageURL = story.coverImageURL {
                                    AsyncImage(url: imageURL) { phase in
                                        switch phase {
                                        case .success(let image):
                                            image.resizable().scaledToFill()
                                        default:
                                            LinearGradient(
                                                colors: story.heroGradient,
                                                startPoint: .topLeading,
                                                endPoint: .bottomTrailing
                                            )
                                        }
                                    }
                                } else {
                                    LinearGradient(
                                        colors: story.heroGradient,
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                }
                            }
                        )
                        .clipped()

                    LinearGradient(
                        colors: [.clear, Ink.ink.opacity(0.56)],
                        startPoint: .top,
                        endPoint: .bottom
                    )

                    VStack {
                        HStack {
                            Text(story.category)
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(Ink.text)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(Capsule().fill(Ink.surface))

                            Spacer()

                            Text(story.timeAgo)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(Ink.onInk)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(Capsule().fill(Ink.ink.opacity(0.55)))
                        }
                        .padding(12)

                        Spacer()

                        HStack {
                            Spacer()
                            HStack(spacing: 5) {
                                Image(systemName: "location.fill")
                                    .font(.system(size: 10, weight: .semibold))
                                Text(story.location)
                                    .font(.system(size: 12, weight: .semibold))
                                    .lineLimit(1)
                            }
                            .foregroundStyle(Ink.onInk)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(Capsule().fill(.ultraThinMaterial))
                            .overlay(Capsule().stroke(Ink.onInk.opacity(0.15), lineWidth: 0.5))
                        }
                        .padding(12)
                    }
                }
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(Ink.border, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                VStack(alignment: .leading, spacing: 8) {
                    Text(story.title)
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(Ink.text)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    Text(story.description)
                        .font(InkFont.body(14))
                        .foregroundStyle(Ink.textMuted)
                        .lineLimit(3)
                        .multilineTextAlignment(.leading)

                    HStack(spacing: 16) {
                        HStack(spacing: -6) {
                            ForEach(Array(story.sources.prefix(3).enumerated()), id: \.offset) { index, source in
                                DiscoverSourceIcon(source: source)
                                    .zIndex(Double(3 - index))
                            }
                            Text("\(story.sourceCount) sources")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(Ink.textSubtle)
                                .padding(.leading, 10)
                        }

                        HStack(spacing: 4) {
                            Image(systemName: "photo.on.rectangle")
                                .font(.system(size: 12))
                            Text("\(story.mediaCount)")
                                .font(.system(size: 13, weight: .medium))
                        }
                        .foregroundStyle(Ink.textSubtle)

                        Spacer()
                    }
                    .padding(.top, 4)
                }
                .padding(.top, 12)
                .padding(.horizontal, 4)
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Ink.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(
                                LinearGradient(
                                    colors: [Ink.border, Ink.border.opacity(0.4)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                lineWidth: 1
                            )
                    )
            )
            .shadow(color: Ink.ink.opacity(0.08), radius: 10, y: 5)
        }
        .buttonStyle(.plain)
    }
}

struct DiscoverSourceIcon: View {
    let source: NewsSource

    var body: some View {
        ZStack {
            Circle().fill(Ink.surface)
            if let iconURL = source.iconURL {
                AsyncImage(url: iconURL) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFit().padding(3)
                    default:
                        Image(systemName: "globe")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(Ink.textSubtle)
                    }
                }
            } else {
                Image(systemName: "globe")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Ink.textSubtle)
            }
        }
        .frame(width: 22, height: 22)
        .overlay(Circle().stroke(Ink.borderStrong, lineWidth: 1.5))
    }
}

struct DiscoverStoryDetailView: View {
    let story: NewsStory
    var isLoadingArticles = false
    let onClose: () -> Void
    let onShowOnMap: (MapFocusTarget) -> Void
    @State private var dragOffset: CGFloat = 0
    @State private var showAllArticles = false

    private let mediaColumns = Array(repeating: GridItem(.flexible(), spacing: 8), count: 3)

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .topLeading) {
                Ink.bg.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        Text(story.title)
                            .font(.system(size: 31, weight: .bold))
                            .foregroundStyle(Ink.text)
                            .fixedSize(horizontal: false, vertical: true)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.top, 74)

                        storyHero

                        Text(story.description)
                            .font(InkFont.body(16))
                            .foregroundStyle(Ink.text.opacity(0.84))
                            .lineSpacing(4)
                            .fixedSize(horizontal: false, vertical: true)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        if !story.sources.isEmpty {
                            sourcesSection
                        }

                        if isLoadingArticles && story.articles.isEmpty {
                            HStack(spacing: 10) {
                                ProgressView()
                                Text("Loading articles…")
                                    .font(InkFont.body(14))
                                    .foregroundStyle(Ink.textMuted)
                            }
                        } else if !story.articles.isEmpty {
                            articlesSection
                        }

                        mapSection

                        eyewitnessSection
                    }
                    .frame(width: geometry.size.width - 40, alignment: .leading)
                    .padding(.horizontal, 20)
                    .padding(.bottom, 110)
                }

                HStack {
                    Button(action: onClose) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(Ink.onInk)
                            .frame(width: 38, height: 38)
                            .background(Circle().fill(Ink.ink.opacity(0.82)))
                    }
                    .buttonStyle(.plain)
                    Spacer()
                }
                .padding(.horizontal, 20)
                .padding(.top, 14)
            }
        }
        .offset(x: max(dragOffset, 0))
        .simultaneousGesture(
            DragGesture(minimumDistance: 10)
                .onChanged { value in
                    guard abs(value.translation.width) > abs(value.translation.height), value.translation.width > 0 else { return }
                    dragOffset = value.translation.width
                }
                .onEnded { value in
                    guard abs(value.translation.width) > abs(value.translation.height) else {
                        dragOffset = 0
                        return
                    }
                    if value.translation.width > 110 {
                        onClose()
                    } else {
                        withAnimation(.spring(response: 0.28, dampingFraction: 0.84)) {
                            dragOffset = 0
                        }
                    }
                }
        )
    }

    private var storyHero: some View {
        Color.clear
            .frame(height: 240)
            .frame(maxWidth: .infinity)
            .overlay(
                Group {
                    if let url = story.coverImageURL {
                        AsyncImage(url: url) { phase in
                            switch phase {
                            case .success(let image):
                                image.resizable().scaledToFill()
                            default:
                                LinearGradient(colors: story.heroGradient, startPoint: .topLeading, endPoint: .bottomTrailing)
                            }
                        }
                    } else {
                        LinearGradient(colors: story.heroGradient, startPoint: .topLeading, endPoint: .bottomTrailing)
                    }
                }
            )
            .overlay(
                LinearGradient(
                    colors: [.clear, Ink.ink.opacity(0.72)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .overlay(alignment: .bottomLeading) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(story.location)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Ink.onInk.opacity(0.88))
                    Text(story.timeAgo)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Ink.onInkMuted)
                }
                .padding(18)
            }
            .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 26, style: .continuous)
                    .stroke(Ink.border, lineWidth: 1)
            )
    }

    private var articlesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Text("Articles")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Ink.text)
                Text("\(story.articles.count)")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Ink.textMuted)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(Ink.surfaceSunken))
                Spacer()
            }

            let visible = showAllArticles ? story.articles : Array(story.articles.prefix(4))
            ForEach(visible) { article in
                Link(destination: article.url) {
                    HStack(alignment: .top, spacing: 12) {
                        ZStack {
                            Circle().fill(Ink.surface)
                            if let iconURL = article.iconURL {
                                AsyncImage(url: iconURL) { phase in
                                    switch phase {
                                    case .success(let image):
                                        image.resizable().scaledToFit().padding(6)
                                    default:
                                        Text(String(article.source.prefix(2)).uppercased())
                                            .font(.system(size: 11, weight: .bold))
                                            .foregroundStyle(Ink.text)
                                    }
                                }
                            } else {
                                Text(String(article.source.prefix(2)).uppercased())
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(Ink.text)
                            }
                        }
                        .frame(width: 34, height: 34)

                        VStack(alignment: .leading, spacing: 3) {
                            Text(article.title)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Ink.text)
                                .lineLimit(2)
                                .multilineTextAlignment(.leading)
                            Text(article.source)
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(Ink.textSubtle)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)

                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Ink.textSubtle)
                            .padding(.top, 3)
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(Ink.surfaceSunken)
                            .overlay(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .stroke(Ink.border, lineWidth: 1)
                            )
                    )
                }
                .buttonStyle(.plain)
            }

            if story.articles.count > 4 {
                Button {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.82)) {
                        showAllArticles.toggle()
                    }
                } label: {
                    HStack(spacing: 6) {
                        Spacer()
                        Text(showAllArticles ? "Show less" : "Show \(story.articles.count - 4) more")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Ink.textMuted)
                        Image(systemName: "chevron.down")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(Ink.textSubtle)
                            .rotationEffect(.degrees(showAllArticles ? 180 : 0))
                        Spacer()
                    }
                    .padding(.vertical, 10)
                    .frame(maxWidth: .infinity)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(Ink.surfaceSunken)
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var sourcesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Text("Sources")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Ink.text)
                Text("\(story.sources.count)")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Ink.textMuted)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(Ink.surfaceSunken))
                Spacer()
            }

            ForEach(story.sources) { source in
                Link(destination: source.url) {
                    HStack {
                        Text(source.name)
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(Ink.text)
                            .lineLimit(1)
                        Spacer()
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Ink.textSubtle)
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(Ink.surfaceSunken)
                            .overlay(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .stroke(Ink.border, lineWidth: 1)
                            )
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var mapSection: some View {
        Button {
            onShowOnMap(MapFocusTarget(coordinate: story.mapCenter, span: story.mapSpan))
            onClose()
        } label: {
            VStack(alignment: .leading, spacing: 10) {
                DiscoverStoryMapPreview(story: story)
                    .frame(height: 170)
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 20, style: .continuous)
                            .stroke(Ink.border, lineWidth: 1)
                    )

                HStack(spacing: 8) {
                    Image(systemName: "location.fill")
                        .font(.system(size: 12, weight: .semibold))
                    Text(story.location)
                        .font(.system(size: 14, weight: .semibold))
                        .lineLimit(1)
                    Spacer()
                    Text("Open Map")
                        .font(.system(size: 13, weight: .semibold))
                }
                .foregroundStyle(Ink.text.opacity(0.86))
            }
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(Ink.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: 22, style: .continuous)
                            .stroke(Ink.border, lineWidth: 1)
                    )
            )
        }
        .buttonStyle(.plain)
    }

    private var eyewitnessSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Text("Eyewitness Media")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Ink.text)
                Text("\(story.mediaCount)")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Ink.textMuted)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(Ink.surfaceSunken))
                Spacer()
            }

            LazyVGrid(columns: mediaColumns, spacing: 8) {
                ForEach(0..<story.mediaCount, id: \.self) { index in
                    DiscoverMediaThumbnail(
                        gradient: story.heroGradient,
                        isVideo: index == 0
                    )
                }
            }
        }
    }
}

struct DiscoverStoryMapPreview: View {
    let story: NewsStory
    @State private var position: MapCameraPosition

    init(story: NewsStory) {
        self.story = story
        _position = State(initialValue: .region(
            MKCoordinateRegion(
                center: story.mapCenter,
                span: MKCoordinateSpan(latitudeDelta: story.mapSpan * 4, longitudeDelta: story.mapSpan * 4)
            )
        ))
    }

    var body: some View {
        Map(position: $position, interactionModes: []) {
            Annotation("", coordinate: story.mapCenter, anchor: .bottom) {
                Circle()
                    .fill(Ink.primary)
                    .frame(width: 14, height: 14)
                    .overlay(Circle().stroke(Ink.surface, lineWidth: 2))
            }
        }
        .mapStyle(.standard(elevation: .flat, pointsOfInterest: .excludingAll))
        .allowsHitTesting(false)
    }
}

struct DiscoverMediaThumbnail: View {
    let gradient: [Color]
    let isVideo: Bool

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(colors: gradient, startPoint: .topLeading, endPoint: .bottomTrailing)
            LinearGradient(
                colors: [.clear, Ink.ink.opacity(0.72)],
                startPoint: .top,
                endPoint: .bottom
            )
            if isVideo {
                Image(systemName: "play.fill")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Ink.onInk)
                    .padding(8)
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Ink.border, lineWidth: 1)
        )
    }
}

#Preview {
    DiscoverView(feedStore: NewsFeedStore(), onShowOnMap: { _ in })
}
