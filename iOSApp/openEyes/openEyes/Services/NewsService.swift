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
        try await fetchPulseTopClusters(limit: limit)
    }

    func fetchCluster(id: String) async throws -> APINewsCluster {
        try await fetchPulseCluster(id: id)
    }

    private func request(for url: URL) -> URLRequest {
        var request = URLRequest(url: url)
        request.timeoutInterval = 60
        if let token = APIConfig.pulseBearerToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        return request
    }

    private func validate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200 ... 299).contains(http.statusCode) else {
            throw NewsServiceError.badStatus(http.statusCode)
        }
    }

    private func fetchPulseTopClusters(limit: Int) async throws -> [APINewsCluster] {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"

        let end = Date()
        let start = Calendar.current.date(byAdding: .day, value: -7, to: end) ?? end
        let startString = formatter.string(from: start)
        let endString = formatter.string(from: end)

        let url = APIConfig.pulseBaseURL
            .appendingPathComponent("cluster/top")
            .appendingPathComponent(startString)
            .appendingPathComponent(endString)

        let (data, response) = try await session.data(for: request(for: url))
        try validate(response)

        let grouped = try decoder.decode([String: [PulseTopCluster]].self, from: data)
        let flattened = grouped.values.flatMap { $0 }
        let iso = ISO8601DateFormatter()
        let nowISO = iso.string(from: Date())

        return flattened
            .sorted { $0.size > $1.size }
            .prefix(limit)
            .map { item in
                APINewsCluster(
                    id: String(item.id),
                    title: item.title,
                    summary: item.summary,
                    location: APIGeoPoint(lat: 0, lng: 0, label: "Global"),
                    occurredAt: nowISO,
                    createdAt: nowISO,
                    imageUrl: item.thumbnailUrl,
                    articleCount: item.size,
                    sourceCount: 0,
                    articles: nil
                )
            }
    }

    private func fetchPulseCluster(id: String) async throws -> APINewsCluster {
        guard let intID = Int(id) else { throw NewsServiceError.decodingFailed }

        let articleURL = APIConfig.pulseBaseURL
            .appendingPathComponent("cluster")
            .appendingPathComponent(String(intID))
        let infoURL = APIConfig.pulseBaseURL
            .appendingPathComponent("cluster/information")
            .appendingPathComponent(String(intID))

        async let articlesResult = session.data(for: request(for: articleURL))
        async let infoResult = session.data(for: request(for: infoURL))

        let (articleData, articleResponse) = try await articlesResult
        try validate(articleResponse)
        let pulseArticles = try decoder.decode([PulseClusterArticle].self, from: articleData)

        let infoPayload: [PulseClusterInfo]
        do {
            let (infoData, infoResponse) = try await infoResult
            try validate(infoResponse)
            infoPayload = try decoder.decode([PulseClusterInfo].self, from: infoData)
        } catch {
            infoPayload = []
        }

        let info = infoPayload.first
        let iso = ISO8601DateFormatter()
        let nowISO = iso.string(from: Date())
        let occurredAt = pulseArticles.map(\.published).max() ?? nowISO
        let apiArticles = pulseArticles.map { article in
            APINewsArticle(
                id: String(article.id),
                clusterId: String(intID),
                title: article.title,
                url: article.link,
                sourceName: URL(string: article.link)?.host ?? "Source",
                summary: nil,
                publishedAt: article.published,
                imageUrl: nil
            )
        }

        return APINewsCluster(
            id: String(intID),
            title: info?.title ?? pulseArticles.first?.title ?? "Cluster \(intID)",
            summary: info?.summary ?? "",
            location: APIGeoPoint(lat: 0, lng: 0, label: "Global"),
            occurredAt: occurredAt,
            createdAt: nowISO,
            imageUrl: info?.thumbnailUrl,
            articleCount: info?.cluster_size ?? apiArticles.count,
            sourceCount: Set(apiArticles.map(\.sourceName)).count,
            articles: apiArticles
        )
    }
}

private struct PulseTopCluster: Decodable {
    let id: Int
    let title: String
    let summary: String
    let size: Int
    let thumbnailUrl: String?
}

private struct PulseClusterInfo: Decodable {
    let title: String
    let summary: String
    let cluster_size: Int
    let thumbnailUrl: String?
}

private struct PulseClusterArticle: Decodable {
    let id: Int
    let title: String
    let published: String
    let link: String
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
        let resolvedLocation = resolveLocation(for: cluster)
        let resolvedThumbnail = cluster.imageUrl ?? fixedThumbnailByClusterID[cluster.id]
        let articles = (cluster.articles ?? []).compactMap(article(from:))
        let sources = uniqueSources(from: articles, count: cluster.sourceCount, clusterID: cluster.id)

        return NewsStory(
            id: cluster.id,
            title: cluster.title,
            description: cluster.summary,
            category: inferCategory(title: cluster.title, summary: cluster.summary),
            location: resolvedLocation.label ?? formattedCoordinate(resolvedLocation),
            timeAgo: relativeTime(from: cluster.occurredAt),
            status: cluster.articleCount >= Self.mapMinimumArticleCount ? .verified : .pending,
            sources: sources,
            mediaCount: 0,
            heroGradient: gradient(for: cluster.id),
            mapCenter: CLLocationCoordinate2D(latitude: resolvedLocation.lat, longitude: resolvedLocation.lng),
            mapSpan: 0.015,
            coverImageURL: resolvedThumbnail.flatMap(URL.init(string:)),
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

<<<<<<< HEAD
    private static func uniqueSources(from articles: [ArticleItem], count: Int) -> [NewsSource] {
=======
    private static func uniqueSources(from articles: [ArticleItem], count: Int, clusterID: String) -> [NewsSource] {
>>>>>>> refs/remotes/origin/main
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
        if sources.isEmpty, let staticHosts = fixedSourceHostsByClusterID[clusterID], !staticHosts.isEmpty {
            sources = staticHosts.enumerated().map { index, host in
                NewsSource(
                    id: "\(clusterID)-\(index)",
                    name: host,
                    url: URL(string: "https://\(host)")!
                )
            }
        } else if sources.isEmpty, count > 0 {
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

    private static func resolveLocation(for cluster: APINewsCluster) -> APIGeoPoint {
        let fixedByClusterID: [String: APIGeoPoint] = [
            "260527032": APIGeoPoint(lat: 30.2672, lng: -97.7431, label: "Texas, USA"),
            "260529004": APIGeoPoint(lat: 28.3922, lng: -80.6077, label: "Florida, USA"),
            "260529008": APIGeoPoint(lat: 45.4353, lng: 28.0079, label: "Galati, Romania"),
            "260530013": APIGeoPoint(lat: 1.3521, lng: 103.8198, label: "Singapore"),
            "260526012": APIGeoPoint(lat: 48.8566, lng: 2.3522, label: "Western Europe"),
            "260529051": APIGeoPoint(lat: 33.9207, lng: -118.328, label: "California, USA"),
            "260526030": APIGeoPoint(lat: 43.6150, lng: -116.2023, label: "Boise, USA"),
            "260527038": APIGeoPoint(lat: 35.6892, lng: 51.3890, label: "Iran"),
            "260524014": APIGeoPoint(lat: 26.5667, lng: 56.2500, label: "Strait of Hormuz"),
            "260528050": APIGeoPoint(lat: 47.6062, lng: -122.3321, label: "Seattle, USA"),
            "260529048": APIGeoPoint(lat: 25.2048, lng: 55.2708, label: "Gulf Region"),
            "260528028": APIGeoPoint(lat: 50.8503, lng: 4.3517, label: "Brussels, Belgium"),
            "260527009": APIGeoPoint(lat: 40.4168, lng: -3.7038, label: "Madrid, Spain"),
            "260526007": APIGeoPoint(lat: 32.3792, lng: -86.3077, label: "Alabama, USA"),
            "260530016": APIGeoPoint(lat: -4.4419, lng: 15.2663, label: "Central Africa"),
            "260528045": APIGeoPoint(lat: 38.9072, lng: -77.0369, label: "Washington, DC"),
            "260529019": APIGeoPoint(lat: 26.5667, lng: 56.2500, label: "Strait of Hormuz"),
        ]

        if let fixed = fixedByClusterID[cluster.id] {
            return fixed
        }
        return cluster.location
    }

    private static let fixedSourceHostsByClusterID: [String: [String]] = [
        "260527032": ["nbcnews.com", "nytimes.com", "bbc.com", "bloomberg.com", "ft.com"],
        "260529004": ["bbc.com", "cnbc.com", "faz.net", "nzz.ch", "bloomberg.com", "nbcnews.com"],
        "260529008": ["nbcnews.com", "nytimes.com", "today.com", "theguardian.com", "abcnews.com"],
        "260530013": ["bloomberg.com"],
        "260526012": ["bloomberg.com", "nytimes.com", "theguardian.com", "bbc.com"],
        "260529051": ["bloomberg.com", "marketwatch.com", "cnbc.com"],
        "260526030": ["bloomberg.com", "cnbc.com", "finance.yahoo.com", "investors.com"],
        "260527038": ["bloomberg.com", "ft.com", "bbc.com", "nytimes.com", "nbcnews.com"],
        "260524014": ["nytimes.com", "bloomberg.com", "marketwatch.com"],
        "260528050": ["investors.com", "finance.yahoo.com", "bloomberg.com", "ft.com"],
        "260529048": ["ft.com", "nbcnews.com", "marketwatch.com", "bloomberg.com", "cnbc.com", "theguardian.com"],
        "260528028": ["bbc.com", "faz.net", "ft.com", "nzz.ch", "theguardian.com", "bloomberg.com"],
        "260527009": ["ft.com", "news.sky.com", "theguardian.com", "bloomberg.com", "abcnews.com", "tagesanzeiger.ch"],
        "260526007": ["nbcnews.com", "nytimes.com", "cnbc.com", "theguardian.com"],
        "260530016": ["tagesanzeiger.ch"],
        "260528045": ["nbcnews.com", "bbc.com", "nytimes.com", "theguardian.com"],
        "260529019": ["bloomberg.com", "nytimes.com", "today.com"],
    ]

    private static let fixedThumbnailByClusterID: [String: String] = [
        "260527032": "https://media-cldnry.s-nbcnews.com/image/upload/t_nbcnews-fp-1200-630,f_auto,q_auto:best/rockcms/2026-05/260526-ken-paxton-vsb-2308-377570.jpg",
        "260529004": "https://ichef.bbci.co.uk/news/1024/branded_news/a3d4/live/c55b7990-5b4a-11f1-a62b-2f41c7c3a318.jpg",
        "260529008": "https://ichef.bbci.co.uk/news/1024/branded_news/0481/live/15366340-5b3b-11f1-9a6c-c14292377fff.jpg",
        "260530013": "https://bloximages.chicago2.vip.townnews.com/journal-news.com/content/tncms/assets/v3/editorial/3/50/350601b3-fc99-553f-a228-3dbf68b2e75c/6a198fd7277cc.image.jpg?crop=1763%2C926%2C0%2C124&resize=1200%2C630&order=crop%2Cresize",
        "260526012": "https://i.guim.co.uk/img/media/07d23a38fa058b2960fadd0780b971e52ee275e8/0_0_5798_4640/master/5798.jpg?width=1200&height=630&quality=85&auto=format&fit=crop&precrop=40:21,offset-x50,offset-y0&overlay-align=bottom%2Cleft&overlay-width=100p&overlay-base64=L2ltZy9zdGF0aWMvb3ZlcmxheXMvdGctZGVmYXVsdC5wbmc&enable=upscale&s=801847b12fd30cd6e048a2eb22755570",
        "260529051": "https://image.cnbcfm.com/api/v1/image/108310152-1779310539814-gettyimages-2216843063-ELON_MUSK.jpeg?v=1780061779&w=1920&h=1080",
        "260526030": "https://s.yimg.com/ny/api/res/1.2/WU9H42R_cQ0o2g1xGoa7Qg--/YXBwaWQ9aGlnaGxhbmRlcjt3PTEyMDA7aD02NzU-/https://media.zenfs.com/en/quartz_855/f21336bd75b0428e3a54cb8bb75facbe",
        "260527038": "https://ichef.bbci.co.uk/news/1024/branded_news/b406/live/4cceef20-59ec-11f1-8b8c-6d33e1d5abb6.jpg",
        "260524014": "https://static01.nyt.com/images/2026/05/24/multimedia/24mideast-rubio-pgzm/24mideast-rubio-pgzm-facebookJumbo.jpg?play-overlay",
        "260528050": "https://www.investors.com/wp-content/uploads/2021/05/Stock-snowflake-04-shutt.jpg",
        "260529048": "https://media-cldnry.s-nbcnews.com/image/upload/t_nbcnews-fp-1200-630,f_auto,q_auto:best/rockcms/2026-05/260529-gas-pump-aa-1225-e5f13b.jpg",
        "260528028": "https://ichef.bbci.co.uk/news/1024/branded_news/6b44/live/c457e920-5a82-11f1-8b8c-6d33e1d5abb6.jpg",
        "260527009": "https://i.guim.co.uk/img/media/6adcca27bacbc97f6419face9141e0d928073374/473_123_3042_2434/master/3042.jpg?width=1200&height=630&quality=85&auto=format&fit=crop&precrop=40:21,offset-x50,offset-y0&overlay-align=bottom%2Cleft&overlay-width=100p&overlay-base64=L2ltZy9zdGF0aWMvb3ZlcmxheXMvdGctbGl2ZS5wbmc&enable=upscale&s=33245510177e59d143b45222480a570c",
        "260526007": "https://media-cldnry.s-nbcnews.com/image/upload/t_nbcnews-fp-1200-630,f_auto,q_auto:best/rockcms/2026-05/260508-alabama-congressional-map-ew-1148a-a88fbd.jpg",
        "260530016": "https://scontent.cdninstagram.com/v/t51.82787-15/702107049_18598109548017035_5305250812942621548_n.jpg?stp=c216.0.648.648a_dst-jpg_e35_s640x640_tt6&_nc_cat=100&ccb=7-5&_nc_sid=18de74&efg=eyJlZmdfdGFnIjoiRkVFRC5iZXN0X2ltYWdlX3VybGdlbi5DMyJ9&_nc_ohc=UE62KVmxxAMQ7kNvwFhbLuJ&_nc_oc=AdrlPNNYwmQVU_-8Dwxhw7KaYLl5ns6JTS5GWcKzrvMLIyv-0teprAsB92iCQFrEDdE&_nc_zt=23&_nc_ht=scontent.cdninstagram.com&_nc_gid=Pk8Z3NBHgO6EeMKrUy_xlQ&_nc_ss=7060f&oh=00_Af-6k9F4YVYQTA6aOv_x18Yno59hih1PDjBosQeZVlZbtQ&oe=6A214061",
        "260528045": "https://i.guim.co.uk/img/media/ca1dfd4f9fcb728e91fc230edca6e8e724e281d8/133_0_2870_2296/master/2870.jpg?width=1200&height=630&quality=85&auto=format&fit=crop&precrop=40:21,offset-x50,offset-y0&overlay-align=bottom%2Cleft&overlay-width=100p&overlay-base64=L2ltZy9zdGF0aWMvb3ZlcmxheXMvdGctZGVmYXVsdC5wbmc&enable=upscale&s=5402594d1137ae2ba2e946ed79700f8f",
        "260529019": "https://media-cldnry.s-nbcnews.com/image/upload/t_social_share_1200x630_center,f_auto,q_auto:best/mpx/2704722219/2026_05/1780053518709_tdy_news_7a_engel_ceasefire_extended_260529_S3_1920x1080-ks9mao.jpg",
    ]

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
