import CoreLocation
import Foundation
import SwiftUI

enum NewsServiceError: LocalizedError {
    case invalidURL
    case badStatus(Int)
    case decodingFailed

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid API URL."
        case .badStatus(let code): return "Server returned HTTP \(code)."
        case .decodingFailed: return "Could not read the news response."
        }
    }
}

struct NewsService {
    private let session: URLSession
    private let decoder: JSONDecoder

    init(session: URLSession = .shared) {
        self.session = session
        self.decoder = JSONDecoder()
    }

    func fetchClusters(limit: Int = 50) async throws -> [APINewsCluster] {
        var components = URLComponents(
            url: APIConfig.baseURL.appendingPathComponent("news/clusters"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [URLQueryItem(name: "limit", value: String(limit))]
        guard let url = components?.url else { throw NewsServiceError.invalidURL }

        let (data, response) = try await session.data(from: url)
        try validate(response)
        return try decoder.decode([APINewsCluster].self, from: data)
    }

    func fetchCluster(id: String) async throws -> APINewsCluster {
        let url = APIConfig.baseURL.appendingPathComponent("news/clusters/\(id)")
        let (data, response) = try await session.data(from: url)
        try validate(response)
        return try decoder.decode(APINewsCluster.self, from: data)
    }

    private func validate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200 ... 299).contains(http.statusCode) else {
            throw NewsServiceError.badStatus(http.statusCode)
        }
    }
}

enum NewsStoryMapper {
    /// Minimum corroborating articles required before a cluster appears on the map.
    static let mapMinimumArticleCount = 3

    private static let isoFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let isoFormatterNoFraction: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static func story(from cluster: APINewsCluster) -> NewsStory {
        let articles = (cluster.articles ?? []).compactMap(article(from:))
        let sources = uniqueSources(from: articles, count: cluster.sourceCount)

        return NewsStory(
            id: cluster.id,
            title: cluster.title,
            description: cluster.summary,
            category: inferCategory(title: cluster.title, summary: cluster.summary),
            location: cluster.location.label ?? formattedCoordinate(cluster.location),
            timeAgo: relativeTime(from: cluster.occurredAt),
            status: cluster.articleCount >= Self.mapMinimumArticleCount ? .verified : .pending,
            sources: sources,
            mediaCount: 0,
            heroGradient: gradient(for: cluster.id),
            mapCenter: CLLocationCoordinate2D(latitude: cluster.location.lat, longitude: cluster.location.lng),
            mapSpan: 0.015,
            coverImageURL: cluster.imageUrl.flatMap(URL.init(string:)),
            articleCount: cluster.articleCount,
            articles: articles,
            occurredAt: parseDate(cluster.occurredAt)
        )
    }

    static func article(from dto: APINewsArticle) -> ArticleItem? {
        guard let url = URL(string: dto.url) else { return nil }
        let domain = URL(string: dto.url)?.host ?? dto.sourceName
        return ArticleItem(
            id: dto.id,
            title: dto.title,
            source: dto.sourceName,
            iconURL: faviconURL(for: domain),
            url: url
        )
    }

    static func mapPin(from story: NewsStory) -> MapEventPin {
        MapEventPin(
            id: story.id,
            title: story.title,
            status: story.status,
            latitude: story.mapCenter.latitude,
            longitude: story.mapCenter.longitude,
            date: story.occurredAt ?? .now,
            articleCount: story.articleCount
        )
    }

    static func isPlottableCoordinate(_ coordinate: CLLocationCoordinate2D) -> Bool {
        guard coordinate.latitude.isFinite, coordinate.longitude.isFinite else { return false }
        guard abs(coordinate.latitude) <= 90, abs(coordinate.longitude) <= 180 else { return false }
        return !(coordinate.latitude == 0 && coordinate.longitude == 0)
    }

    private static func uniqueSources(from articles: [ArticleItem], count: Int) -> [NewsSource] {
        var seen = Set<String>()
        var sources: [NewsSource] = []
        for article in articles {
            guard seen.insert(article.source).inserted else { continue }
            sources.append(
                NewsSource(
                    id: article.source,
                    name: article.source,
                    url: article.url,
                    iconURL: article.iconURL
                )
            )
        }
        if sources.isEmpty, count > 0 {
            sources = (0 ..< min(count, 3)).map { index in
                NewsSource(
                    id: "source-\(index)",
                    name: "Source \(index + 1)",
                    url: URL(string: "https://example.com")!
                )
            }
        }
        return sources
    }

    private static func inferCategory(title: String, summary: String) -> String {
        let text = "\(title) \(summary)".lowercased()
        if text.contains("election") || text.contains("parliament") || text.contains("president") || text.contains("politic") {
            return "Politics"
        }
        if text.contains("war") || text.contains("conflict") || text.contains("military") || text.contains("strike") || text.contains("shoot") {
            return "Conflict"
        }
        if text.contains("flood") || text.contains("earthquake") || text.contains("fire") || text.contains("storm") || text.contains("crisis") {
            return "Crisis"
        }
        return "World"
    }

    private static func relativeTime(from iso: String) -> String {
        guard let date = parseDate(iso) else { return "Recently" }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: .now)
    }

    private static func parseDate(_ iso: String) -> Date? {
        isoFormatter.date(from: iso) ?? isoFormatterNoFraction.date(from: iso)
    }

    private static func formattedCoordinate(_ point: APIGeoPoint) -> String {
        String(format: "%.2f°, %.2f°", point.lat, point.lng)
    }

    private static func faviconURL(for domain: String) -> URL? {
        let cleaned = domain.replacingOccurrences(of: "www.", with: "")
        return URL(string: "https://www.google.com/s2/favicons?domain=\(cleaned)&sz=64")
    }

    private static func gradient(for key: String) -> [Color] {
        let hash = abs(key.hashValue)
        let palettes: [[Color]] = [
            [Color(hex: 0x26241F), Color(hex: 0x0F766E)],
            [Color(hex: 0x115E59), Color(hex: 0x6FBDB0)],
            [Color(hex: 0x134E4A), Color(hex: 0x16847A)],
            [Color(hex: 0x1C1B19), Color(hex: 0xB45309)],
            [Color(hex: 0x1E293B), Color(hex: 0x6366F1)],
        ]
        return palettes[hash % palettes.count]
    }
}
