import CoreLocation
import SwiftUI

enum MockData {
    static let categoryItems: [(id: String, title: String, icon: String)] = [
        ("all", "All", "globe"),
        ("demo", "Demo", "sparkles"),
        ("politics", "Politics", "building.columns.fill"),
        ("crisis", "Crisis", "flame.fill"),
        ("conflict", "Conflict", "exclamationmark.triangle.fill"),
        ("world", "World", "tag.fill"),
    ]

    private static let minneapolisArticles: [ArticleItem] = [
        ArticleItem(
            title: "Alex Pretti identified as nurse killed in Minneapolis shooting",
            source: "Minnesota Public Radio",
            iconURL: URL(string: "https://www.google.com/s2/favicons?domain=www.mprnews.org&sz=64"),
            url: URL(string: "https://www.mprnews.org")!
        ),
        ArticleItem(
            title: "Video shows moments before fatal shooting in Whittier",
            source: "NBC News",
            iconURL: URL(string: "https://www.google.com/s2/favicons?domain=www.nbcnews.com&sz=64"),
            url: URL(string: "https://www.nbcnews.com")!
        ),
        ArticleItem(
            title: "Border patrol agents involved in Minneapolis fatality",
            source: "The Guardian",
            iconURL: URL(string: "https://www.google.com/s2/favicons?domain=www.theguardian.com&sz=64"),
            url: URL(string: "https://www.theguardian.com")!
        ),
        ArticleItem(
            title: "Protesters gather at 26th and Nicollet after shooting",
            source: "Star Tribune",
            url: URL(string: "https://www.startribune.com")!
        ),
    ]

    static let stories: [NewsStory] = [
        NewsStory(
            storyKey: "minneapolis-ice",
            title: "ICE fatally shoots 37-year-old ICU nurse in Minneapolis",
            description: "On January 24 2026, Alex Pretti — a 37-year-old ICU nurse — was fatally shot by two U.S. Customs and Border Protection agents at 26th Street and Nicollet Avenue in Minneapolis's Whittier neighborhood during a federal immigration enforcement operation.",
            category: "Demo",
            location: "Minneapolis, Minnesota, USA",
            timeAgo: "2h ago",
            status: .pending,
            sources: [
                NewsSource(
                    name: "Minnesota Public Radio",
                    url: URL(string: "https://www.mprnews.org")!,
                    iconURL: URL(string: "https://www.google.com/s2/favicons?domain=www.mprnews.org&sz=64")
                ),
                NewsSource(
                    name: "NBC News",
                    url: URL(string: "https://www.nbcnews.com")!,
                    iconURL: URL(string: "https://www.google.com/s2/favicons?domain=www.nbcnews.com&sz=64")
                ),
                NewsSource(
                    name: "The Guardian",
                    url: URL(string: "https://www.theguardian.com")!,
                    iconURL: URL(string: "https://www.google.com/s2/favicons?domain=www.theguardian.com&sz=64")
                ),
            ],
            mediaCount: 5,
            heroGradient: [Color(hex: 0x26241F), Color(hex: 0x0F766E)],
            mapCenter: CLLocationCoordinate2D(latitude: 44.9550, longitude: -93.2779),
            mapSpan: 0.008,
            coverImageURL: URL(string: "https://dims.apnews.com/dims4/default/2801f46/2147483647/strip/false/crop/8426x5617+0+0/resize/980x653!/quality/90/?url=https%3A%2F%2Fassets.apnews.com%2Fa4%2Fc3%2F0753da348223a3dc308568b7e5ee%2F2d3b339b315f4de9918b53f8639aa2a9"),
            articleCount: 8,
            articles: minneapolisArticles
        ),
        NewsStory(
            storyKey: "zurich-tram",
            title: "Tram disruption and crowd buildup spread across central Zurich",
            description: "Witness uploads from multiple blocks show tram delays, police rerouting, and fast-growing pedestrian congestion around the station district.",
            category: "Politics",
            location: "Zurich, Switzerland",
            timeAgo: "4h ago",
            status: .verified,
            sources: NewsSource.mockSet(prefix: "Zurich"),
            mediaCount: 3,
            heroGradient: [Color(hex: 0x115E59), Color(hex: 0x6FBDB0)],
            mapCenter: CLLocationCoordinate2D(latitude: 47.3775, longitude: 8.5409),
            mapSpan: 0.012
        ),
        NewsStory(
            storyKey: "hamburg-flood",
            title: "Flooded tunnel traffic redirected in Hamburg",
            description: "Emergency crews and drivers are coordinating manually as floodwater fills the eastern underpass and reroutes traffic lane by lane.",
            category: "Crisis",
            location: "Hamburg, Germany",
            timeAgo: "6h ago",
            status: .verified,
            sources: NewsSource.mockSet(prefix: "Hamburg"),
            mediaCount: 2,
            heroGradient: [Color(hex: 0x134E4A), Color(hex: 0x16847A)],
            mapCenter: CLLocationCoordinate2D(latitude: 53.5488, longitude: 9.9976),
            mapSpan: 0.015
        ),
        NewsStory(
            storyKey: "paris-crowd",
            title: "Crowds surge into Place de la République",
            description: "More demonstrators continue to arrive from the side streets while the police line shifts farther south after the announcement.",
            category: "Politics",
            location: "Paris, France",
            timeAgo: "18h ago",
            status: .disputed,
            sources: NewsSource.mockSet(prefix: "Paris"),
            mediaCount: 2,
            heroGradient: [Color(hex: 0x1C1B19), Color(hex: 0xB45309)],
            mapCenter: CLLocationCoordinate2D(latitude: 48.8670, longitude: 2.3630),
            mapSpan: 0.018
        ),
    ]

    static let mapPins: [MapEventPin] = stories.map { story in
        MapEventPin(
            title: story.title,
            status: story.status,
            latitude: story.mapCenter.latitude,
            longitude: story.mapCenter.longitude,
            date: .now.addingTimeInterval(-3600)
        )
    }
}
