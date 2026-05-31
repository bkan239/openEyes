import Combine
import Foundation

@MainActor
final class NewsFeedStore: ObservableObject {
    private static let alexClusterID = "926012401"
    @Published private(set) var stories: [NewsStory] = []
    @Published private(set) var isLoading = false
    @Published private(set) var loadError: String?
    @Published private(set) var isUsingMockFallback = false

    private let cache = NewsCacheStore()

    /// Clusters shown on the map must have at least this many corroborating articles.
    static let mapMinimumArticleCount = NewsStoryMapper.mapMinimumArticleCount

    func refresh(limit _: Int = 100) async {
        isLoading = true
        loadError = nil
        defer { isLoading = false }

        let cachedClusters = await cache.load()
        if !cachedClusters.isEmpty, isPulseSnapshot(cachedClusters) {
            let enriched = clustersWithAlexPrettiCase(cachedClusters)
            stories = prioritizeAlex(enriched.map(NewsStoryMapper.story(from:)))
            isUsingMockFallback = false
            loadError = "Demo mode: using local stored clusters."
            return
        }

        if let data = PulseSeedData.clustersJSON.data(using: .utf8),
           let clusters = try? JSONDecoder().decode([APINewsCluster].self, from: data),
           !clusters.isEmpty {
            let enriched = clustersWithAlexPrettiCase(clusters)
            stories = prioritizeAlex(enriched.map(NewsStoryMapper.story(from:)))
            isUsingMockFallback = false
            await cache.save(enriched)
            loadError = "Demo mode: seeded clusters loaded locally."
            return
        }

        stories = []
        isUsingMockFallback = false
        loadError = "No local cluster file found."
    }

    func storyDetail(id: String) async -> NewsStory? {
        stories.first(where: { $0.id == id })
    }

    var mapPins: [MapEventPin] {
        mapStories.map(NewsStoryMapper.mapPin(from:))
    }

    private var mapStories: [NewsStory] {
        stories.filter { story in
            story.articleCount >= Self.mapMinimumArticleCount
                && NewsStoryMapper.isPlottableCoordinate(story.mapCenter)
        }
    }

    private func isPulseSnapshot(_ clusters: [APINewsCluster]) -> Bool {
        guard !clusters.isEmpty else { return false }
        return clusters.allSatisfy { Int($0.id) != nil }
    }

    private func clustersWithAlexPrettiCase(_ clusters: [APINewsCluster]) -> [APINewsCluster] {
        let alexID = Self.alexClusterID
        if clusters.contains(where: { $0.id == alexID }) {
            var reordered = clusters
            if let index = reordered.firstIndex(where: { $0.id == alexID }) {
                let alex = reordered.remove(at: index)
                reordered.insert(alex, at: 0)
            }
            return reordered
        }

        let alexArticles: [APINewsArticle] = [
            APINewsArticle(
                id: "926012401-1",
                clusterId: alexID,
                title: "Alex Pretti identified as nurse killed in Minneapolis shooting",
                url: "https://www.mprnews.org",
                sourceName: "Minnesota Public Radio",
                summary: nil,
                publishedAt: "2026-01-24T18:30:00Z",
                imageUrl: nil
            ),
            APINewsArticle(
                id: "926012401-2",
                clusterId: alexID,
                title: "Video shows moments before fatal shooting in Whittier",
                url: "https://www.nbcnews.com",
                sourceName: "NBC News",
                summary: nil,
                publishedAt: "2026-01-24T19:10:00Z",
                imageUrl: nil
            ),
            APINewsArticle(
                id: "926012401-3",
                clusterId: alexID,
                title: "Border patrol agents involved in Minneapolis fatality",
                url: "https://www.theguardian.com",
                sourceName: "The Guardian",
                summary: nil,
                publishedAt: "2026-01-24T19:45:00Z",
                imageUrl: nil
            ),
            APINewsArticle(
                id: "926012401-4",
                clusterId: alexID,
                title: "Protesters gather at 26th and Nicollet after shooting",
                url: "https://www.startribune.com",
                sourceName: "Star Tribune",
                summary: nil,
                publishedAt: "2026-01-24T20:05:00Z",
                imageUrl: nil
            ),
        ]

        let alexCluster = APINewsCluster(
            id: alexID,
            title: "ICE fatally shoots 37-year-old ICU nurse in Minneapolis",
            summary: "On January 24 2026, Alex Pretti - a 37-year-old ICU nurse - was fatally shot by two U.S. Customs and Border Protection agents at 26th Street and Nicollet Avenue in Minneapolis's Whittier neighborhood during a federal immigration enforcement operation.",
            location: APIGeoPoint(lat: 44.9550, lng: -93.2779, label: "Minneapolis, Minnesota, USA"),
            occurredAt: "2026-01-24T20:05:00Z",
            createdAt: "2026-01-24T20:05:00Z",
            imageUrl: "https://dims.apnews.com/dims4/default/2801f46/2147483647/strip/false/crop/8426x5617+0+0/resize/980x653!/quality/90/?url=https%3A%2F%2Fassets.apnews.com%2Fa4%2Fc3%2F0753da348223a3dc308568b7e5ee%2F2d3b339b315f4de9918b53f8639aa2a9",
            articleCount: 8,
            sourceCount: 4,
            articles: alexArticles
        )

        return [alexCluster] + clusters
    }

    private func prioritizeAlex(_ stories: [NewsStory]) -> [NewsStory] {
        var reordered = stories
        if let index = reordered.firstIndex(where: { $0.id == Self.alexClusterID }) {
            let alex = reordered.remove(at: index)
            reordered.insert(alex, at: 0)
        }
        return reordered
    }
}
