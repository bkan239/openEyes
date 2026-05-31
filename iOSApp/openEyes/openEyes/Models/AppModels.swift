import CoreLocation
import SwiftUI

struct NewsStory: Identifiable {
    let id: String
    let title: String
    let description: String
    let category: String
    let location: String
    let timeAgo: String
    let status: VerificationStatus
    let sources: [NewsSource]
    let mediaCount: Int
    let heroGradient: [Color]
    let mapCenter: CLLocationCoordinate2D
    let mapSpan: Double
    var coverImageURL: URL? = nil
    var articleCount: Int = 0
    var articles: [ArticleItem] = []
    var occurredAt: Date? = nil

    var coordinate: CLLocationCoordinate2D { mapCenter }

    var sourceCount: Int {
        articleCount > 0 ? articleCount : sources.count
    }
}

struct ArticleItem: Identifiable {
    let id: String
    let title: String
    let source: String
    var iconURL: URL? = nil
    let url: URL
}

struct NewsSource: Identifiable {
    let id: String
    let name: String
    let url: URL
    var iconURL: URL? = nil

    static func mockSet(prefix: String) -> [NewsSource] {
        let url = URL(string: "https://example.com")!
        return [
            NewsSource(id: "\(prefix)-wire", name: "\(prefix) Wire", url: url),
            NewsSource(id: "\(prefix)-post", name: "\(prefix) Post", url: url),
            NewsSource(id: "\(prefix)-desk", name: "\(prefix) Desk", url: url),
        ]
    }
}

struct MapEventPin: Identifiable, Hashable {
    let id: String
    let title: String
    let status: VerificationStatus
    let latitude: Double
    let longitude: Double
    let date: Date
    var articleCount: Int = 0

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

struct MapFocusTarget: Identifiable, Equatable {
    let id: String
    let latitude: Double
    let longitude: Double
    let span: Double

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    init(id: String = UUID().uuidString, coordinate: CLLocationCoordinate2D, span: Double) {
        self.id = id
        latitude = coordinate.latitude
        longitude = coordinate.longitude
        self.span = span
    }
}
