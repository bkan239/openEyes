import Foundation

struct APIGeoPoint: Codable {
    let lat: Double
    let lng: Double
    let label: String?
}

struct APINewsArticle: Codable {
    let id: String
    let clusterId: String
    let title: String
    let url: String
    let sourceName: String
    let summary: String?
    let publishedAt: String
    let imageUrl: String?
}

struct APINewsCluster: Codable {
    let id: String
    let title: String
    let summary: String
    let location: APIGeoPoint
    let occurredAt: String
    let createdAt: String
    let imageUrl: String?
    let articleCount: Int
    let sourceCount: Int
    let articles: [APINewsArticle]?
}
