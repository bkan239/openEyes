import Combine
import Foundation

@MainActor
final class NewsFeedStore: ObservableObject {
    @Published private(set) var stories: [NewsStory] = MockData.stories
    @Published private(set) var isLoading = false
    @Published private(set) var loadError: String?
    @Published private(set) var isUsingMockFallback = true

    private let service = NewsService()

    func refresh() async {
        isLoading = true
        loadError = nil
        defer { isLoading = false }

        do {
            let clusters = try await service.fetchClusters()
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
        stories.map(NewsStoryMapper.mapPin(from:))
    }
}
