import Foundation

struct APIGeoPoint: Decodable {
    let lat: Double
    let lng: Double
    let label: String?
}

struct APINewsArticle: Decodable {
    let id: String
    let clusterId: String
    let title: String
    let url: String
    let sourceName: String
    let summary: String?
    let publishedAt: String
    let imageUrl: String?
}

struct APINewsCluster: Decodable {
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
