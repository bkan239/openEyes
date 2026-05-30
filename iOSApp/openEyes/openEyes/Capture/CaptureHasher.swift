import Foundation
import CryptoKit
import UIKit
import CoreLocation

// Matches backend canonical format in `hash_validation.py`:
//   SHA256( imageBytes + b":" + f"{lat:.6f}:{lon:.6f}:{iso8601UTC}:{heading:.2f}" )
enum CaptureHasher {
    static let iso8601: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss'Z'"
        return f
    }()

    static func canonicalTimestamp(_ date: Date) -> String {
        iso8601.string(from: date)
    }

    static func hash(
        mediaData: Data,
        lat: Double,
        lon: Double,
        capturedAt: Date,
        heading: Double
    ) -> String {
        let canonical = String(
            format: "%.6f:%.6f:%@:%.2f",
            lat, lon, canonicalTimestamp(capturedAt), heading
        )
        var payload = mediaData
        payload.append(Data([0x3A])) // ":"
        payload.append(Data(canonical.utf8))
        let digest = SHA256.hash(data: payload)
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}
