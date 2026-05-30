import Combine
import Foundation

@MainActor
final class NewsFeedStore: ObservableObject {
    @Published private(set) var stories: [NewsStory] = MockData.stories
    @Published private(set) var isLoading = false
    @Published private(set) var loadError: String?
    @Published private(set) var isUsingMockFallback = true

    private let service = NewsService()

    /// Clusters shown on the map must have at least this many corroborating articles.
    static let mapMinimumArticleCount = NewsStoryMapper.mapMinimumArticleCount

    func refresh(limit: Int = 100) async {
        isLoading = true
        loadError = nil
        defer { isLoading = false }

        do {
            let clusters = try await service.fetchClusters(limit: limit)
            guard !clusters.isEmpty else {
                stories = MockData.stories
                isUsingMockFallback = true
                loadError = "No clustered stories yet. Run POST /news/ingest on the API."
                return
            }
            stories = clusters.map(NewsStoryMapper.story(from:))
            isUsingMockFallback = false
        } catch {
            stories = MockData.stories
            isUsingMockFallback = true
            loadError = error.localizedDescription
        }
    }

    func storyDetail(id: String) async -> NewsStory? {
        if let cached = stories.first(where: { $0.id == id }), !cached.articles.isEmpty {
            return cached
        }

        do {
            let cluster = try await service.fetchCluster(id: id)
            let detailed = NewsStoryMapper.story(from: cluster)
            if let index = stories.firstIndex(where: { $0.id == id }) {
                stories[index] = detailed
            }
            return detailed
        } catch {
            return stories.first(where: { $0.id == id })
        }
    }

    var mapPins: [MapEventPin] {
        mapStories.map(NewsStoryMapper.mapPin(from:))
    }

    private var mapStories: [NewsStory] {
        let candidates = isUsingMockFallback ? MockData.stories : stories
        return candidates.filter { story in
            story.articleCount >= Self.mapMinimumArticleCount
                && NewsStoryMapper.isPlottableCoordinate(story.mapCenter)
        }
    }
}
