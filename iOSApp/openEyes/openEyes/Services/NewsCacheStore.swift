import Foundation

actor NewsCacheStore {
    private struct CachePayload: Codable {
        let savedAt: Date
        let clusters: [APINewsCluster]
    }

    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    private var cacheURL: URL? {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first?
            .appendingPathComponent("news_clusters_cache.json")
    }

    func load() -> [APINewsCluster] {
        guard let url = cacheURL else { return [] }
        guard let data = try? Data(contentsOf: url) else { return [] }
        guard let payload = try? decoder.decode(CachePayload.self, from: data) else { return [] }
        return payload.clusters
    }

    func save(_ clusters: [APINewsCluster]) {
        guard let url = cacheURL else { return }
        let parent = url.deletingLastPathComponent()
        try? FileManager.default.createDirectory(at: parent, withIntermediateDirectories: true)
        let payload = CachePayload(savedAt: Date(), clusters: clusters)
        guard let data = try? encoder.encode(payload) else { return }
        try? data.write(to: url, options: .atomic)
    }
}
