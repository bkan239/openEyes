import SwiftUI

struct DiscoverView: View {
    @State private var selectedCategory = "All"
    @State private var searchText = ""
    @State private var selectedStory: NewsStory?
    let onShowOnMap: (MapFocusTarget) -> Void

    private var filteredStories: [NewsStory] {
        MockData.stories.filter { story in
            let categoryMatch = selectedCategory == "All" || story.category == selectedCategory
            let searchMatch = searchText.isEmpty
                || story.title.localizedCaseInsensitiveContains(searchText)
                || story.location.localizedCaseInsensitiveContains(searchText)
            return categoryMatch && searchMatch
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Discover")
                            .font(InkFont.title())
                            .foregroundStyle(Ink.text)
                        Text("Verified events from independent eyewitness angles.")
                            .font(InkFont.body(15))
                            .foregroundStyle(Ink.textMuted)
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 8)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(MockData.categories, id: \.self) { category in
                                Button {
                                    selectedCategory = category
                                } label: {
                                    Text(category)
                                        .font(InkFont.caption(14))
                                        .foregroundStyle(selectedCategory == category ? Ink.onPrimary : Ink.textMuted)
                                        .padding(.horizontal, 14)
                                        .padding(.vertical, 8)
                                        .background(selectedCategory == category ? Ink.primary : Ink.surfaceSunken)
                                        .clipShape(Capsule())
                                        .overlay(Capsule().stroke(Ink.border, lineWidth: selectedCategory == category ? 0 : 1))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 20)
                    }

                    HStack {
                        Image(systemName: "magnifyingglass")
                            .foregroundStyle(Ink.textSubtle)
                        TextField("Search stories, locations…", text: $searchText)
                            .font(InkFont.body(15))
                            .foregroundStyle(Ink.text)
                    }
                    .padding(12)
                    .background(Ink.surfaceSunken)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Ink.border, lineWidth: 1))
                    .padding(.horizontal, 20)

                    LazyVStack(spacing: 16) {
                        ForEach(filteredStories) { story in
                            StoryCard(story: story) {
                                selectedStory = story
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 24)
                }
            }
            .background(Ink.bg.ignoresSafeArea())
            .sheet(item: $selectedStory) { story in
                StoryDetailView(story: story, onShowOnMap: onShowOnMap)
            }
        }
    }
}

struct StoryCard: View {
    let story: NewsStory
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            InkCard {
                VStack(alignment: .leading, spacing: 0) {
                    ZStack(alignment: .bottomLeading) {
                        LinearGradient(colors: story.heroColors, startPoint: .topLeading, endPoint: .bottomTrailing)
                            .frame(height: 160)
                            .overlay(alignment: .topLeading) {
                                HStack {
                                    Text(story.category.uppercased())
                                        .font(InkFont.caption(11))
                                        .foregroundStyle(Ink.text)
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 5)
                                        .background(Ink.surface.opacity(0.92))
                                        .clipShape(Capsule())
                                    Spacer()
                                    StatusBadge(status: story.status)
                                }
                                .padding(12)
                            }

                        VStack(alignment: .leading, spacing: 4) {
                            Label(story.location, systemImage: "location.fill")
                                .font(InkFont.caption(12))
                                .foregroundStyle(Ink.onInk.opacity(0.9))
                            Text(story.timeAgo)
                                .font(InkFont.caption(12))
                                .foregroundStyle(Ink.onInkMuted)
                        }
                        .padding(12)
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text(story.title)
                            .font(InkFont.headline(18))
                            .foregroundStyle(Ink.text)
                            .multilineTextAlignment(.leading)
                        Text(story.summary)
                            .font(InkFont.body(14))
                            .foregroundStyle(Ink.textMuted)
                            .lineLimit(2)
                        HStack(spacing: 12) {
                            Label("\(story.angleCount) angles", systemImage: "video.fill")
                            Label("\(story.sourceCount) sources", systemImage: "person.2.fill")
                        }
                        .font(InkFont.caption(12))
                        .foregroundStyle(Ink.textSubtle)
                    }
                    .padding(16)
                }
            }
        }
        .buttonStyle(.plain)
    }
}

struct StoryDetailView: View {
    let story: NewsStory
    let onShowOnMap: (MapFocusTarget) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    ZStack(alignment: .bottomLeading) {
                        LinearGradient(colors: story.heroColors, startPoint: .topLeading, endPoint: .bottomTrailing)
                            .frame(height: 220)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        VStack(alignment: .leading, spacing: 8) {
                            StatusBadge(status: story.status)
                            Text(story.title)
                                .font(InkFont.title(26))
                                .foregroundStyle(Ink.onInk)
                        }
                        .padding(16)
                    }

                    Text(story.summary)
                        .font(InkFont.body(16))
                        .foregroundStyle(Ink.text)

                    HStack {
                        Label(story.location, systemImage: "mappin.and.ellipse")
                        Spacer()
                        Text(story.timeAgo)
                    }
                    .font(InkFont.caption(14))
                    .foregroundStyle(Ink.textMuted)

                    PrimaryButton(title: "Show on map") {
                        onShowOnMap(MapFocusTarget(coordinate: story.coordinate, span: 0.02))
                        dismiss()
                    }
                }
                .padding(20)
            }
            .background(Ink.bg.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Ink.primary)
                }
            }
        }
    }
}

#Preview {
    DiscoverView(onShowOnMap: { _ in })
}
