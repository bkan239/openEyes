import CoreLocation
import SwiftUI

enum MockData {
    static let categories = ["All", "Demo", "Politics", "Crisis", "World"]

    static let stories: [NewsStory] = [
        NewsStory(
            title: "ICE fatally shoots ICU nurse in Minneapolis",
            summary: "Five independent eyewitness angles corroborate the same 12-second window at 26th & Nicollet.",
            category: "Demo",
            location: "Minneapolis, MN",
            timeAgo: "2h ago",
            status: .pending,
            sourceCount: 5,
            angleCount: 5,
            latitude: 44.9550,
            longitude: -93.2779,
            heroColors: [Color(hex: 0x26241F), Color(hex: 0x0F766E)]
        ),
        NewsStory(
            title: "Tram disruption spreads across central Zurich",
            summary: "Witness uploads from multiple blocks show delays and growing pedestrian congestion.",
            category: "Politics",
            location: "Zurich, Switzerland",
            timeAgo: "4h ago",
            status: .verified,
            sourceCount: 4,
            angleCount: 3,
            latitude: 47.3775,
            longitude: 8.5409,
            heroColors: [Color(hex: 0x115E59), Color(hex: 0x6FBDB0)]
        ),
        NewsStory(
            title: "Flooded tunnel traffic redirected in Hamburg",
            summary: "Emergency crews coordinate manually as floodwater fills the eastern underpass.",
            category: "Crisis",
            location: "Hamburg, Germany",
            timeAgo: "6h ago",
            status: .verified,
            sourceCount: 2,
            angleCount: 2,
            latitude: 53.5488,
            longitude: 9.9976,
            heroColors: [Color(hex: 0x134E4A), Color(hex: 0x16847A)]
        ),
        NewsStory(
            title: "Crowds surge into Place de la République",
            summary: "Multiple angles confirm police line shifts after the announcement.",
            category: "Politics",
            location: "Paris, France",
            timeAgo: "18h ago",
            status: .disputed,
            sourceCount: 3,
            angleCount: 2,
            latitude: 48.8670,
            longitude: 2.3630,
            heroColors: [Color(hex: 0x1C1B19), Color(hex: 0xB45309)]
        ),
    ]

    static let mapPins: [MapEventPin] = stories.map { story in
        MapEventPin(
            title: story.title,
            status: story.status,
            latitude: story.latitude,
            longitude: story.longitude,
            date: .now.addingTimeInterval(-3600)
        )
    }
}
