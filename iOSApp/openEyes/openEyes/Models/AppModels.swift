import CoreLocation
import SwiftUI

struct NewsStory: Identifiable {
    let id = UUID()
    let title: String
    let summary: String
    let category: String
    let location: String
    let timeAgo: String
    let status: VerificationStatus
    let sourceCount: Int
    let angleCount: Int
    let latitude: Double
    let longitude: Double
    let heroColors: [Color]

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

struct MapEventPin: Identifiable, Hashable {
    let id = UUID()
    let title: String
    let status: VerificationStatus
    let latitude: Double
    let longitude: Double
    let date: Date

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

struct MapFocusTarget: Identifiable, Equatable {
    let id = UUID()
    let latitude: Double
    let longitude: Double
    let span: Double

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    init(coordinate: CLLocationCoordinate2D, span: Double) {
        latitude = coordinate.latitude
        longitude = coordinate.longitude
        self.span = span
    }
}
