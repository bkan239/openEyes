import Foundation
import UIKit
import CoreLocation
import Combine

final class CaptureDraftStore: ObservableObject {
    @Published private(set) var drafts: [CaptureUploadDraft] = []

    private let fileManager = FileManager.default
    private lazy var storageDirectory: URL = {
        let base = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let url = base.appendingPathComponent("OpenEyesDrafts", isDirectory: true)
        try? fileManager.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }()
    private lazy var manifestURL: URL = {
        storageDirectory.appendingPathComponent("drafts.json")
    }()

    init() {
        loadPersistedDrafts()
    }

    func upsert(_ draft: CaptureUploadDraft) {
        if let index = drafts.firstIndex(where: { $0.id == draft.id }) {
            drafts[index] = draft
        } else {
            drafts.insert(draft, at: 0)
        }
        persistDrafts()
    }

    func remove(_ draft: CaptureUploadDraft) {
        drafts.removeAll { $0.id == draft.id }
        deleteLocalFiles(for: draft.id)
        persistDrafts()
    }


    private func loadPersistedDrafts() {
        guard let data = try? Data(contentsOf: manifestURL) else { return }
        guard let persisted = try? JSONDecoder().decode([PersistedCaptureDraft].self, from: data) else { return }
        drafts = persisted.compactMap { rebuildDraft(from: $0) }
            .sorted { $0.capturedAt > $1.capturedAt }
    }

    private func persistDrafts() {
        let persisted = drafts.map(makePersistedDraft)
        guard let data = try? JSONEncoder().encode(persisted) else { return }
        try? data.write(to: manifestURL, options: .atomic)
    }

    private func makePersistedDraft(_ draft: CaptureUploadDraft) -> PersistedCaptureDraft {
        let mediaFilename = persistMediaFile(for: draft)
        let previewFilename = persistPreviewFile(for: draft)
        let samples = draft.spatialSamples.map(PersistedSpatialSample.init)
        let primarySnapshotIndex = draft.primarySnapshot.flatMap { primary in
            draft.spatialSamples.firstIndex(where: { $0.timestamp == primary.timestamp })
        }

        return PersistedCaptureDraft(
            id: draft.id,
            source: draft.source,
            mediaMode: draft.mediaMode,
            mediaFilename: mediaFilename,
            previewFilename: previewFilename,
            capturedAt: draft.capturedAt,
            duration: draft.duration,
            spatialSamples: samples,
            primarySnapshotIndex: primarySnapshotIndex,
            locationName: draft.locationName,
            caption: draft.caption,
            hashtagsText: draft.hashtagsText,
            isUploaded: draft.isUploaded,
            captureHash: draft.captureHash,
            backendMediaID: draft.backendMediaID,
            remoteFileURL: draft.remoteFileURL,
            remoteThumbnailURL: draft.remoteThumbnailURL,
            backendUsername: draft.backendUsername,
            backendUserToken: draft.backendUserToken
        )
    }

    private func rebuildDraft(from persisted: PersistedCaptureDraft) -> CaptureUploadDraft? {
        let samples = persisted.spatialSamples.map { $0.snapshot }
        let primarySnapshot = persisted.primarySnapshotIndex.flatMap { index in
            samples.indices.contains(index) ? samples[index] : nil
        }

        let mediaURL = persisted.mediaFilename.map { storageDirectory.appendingPathComponent($0) }
        let previewURL = persisted.previewFilename.map { storageDirectory.appendingPathComponent($0) }
        let previewImage = previewURL.flatMap { UIImage(contentsOfFile: $0.path) }
        let image: UIImage? = persisted.mediaMode == .photo
            ? mediaURL.flatMap { UIImage(contentsOfFile: $0.path) }
            : nil

        return CaptureUploadDraft(
            id: persisted.id,
            source: persisted.source,
            mediaMode: persisted.mediaMode,
            image: image,
            videoURL: persisted.mediaMode == .video ? mediaURL : nil,
            previewImage: previewImage ?? image,
            capturedAt: persisted.capturedAt,
            duration: persisted.duration,
            spatialSamples: samples,
            primarySnapshot: primarySnapshot,
            locationName: persisted.locationName,
            caption: persisted.caption,
            hashtagsText: persisted.hashtagsText,
            isUploaded: persisted.isUploaded,
            captureHash: persisted.captureHash,
            mediaData: persisted.mediaMode == .photo ? mediaURL.flatMap { try? Data(contentsOf: $0) } : nil,
            backendMediaID: persisted.backendMediaID,
            remoteFileURL: persisted.remoteFileURL,
            remoteThumbnailURL: persisted.remoteThumbnailURL,
            backendUsername: persisted.backendUsername,
            backendUserToken: persisted.backendUserToken
        )
    }

    private func persistMediaFile(for draft: CaptureUploadDraft) -> String? {
        switch draft.mediaMode {
        case .photo:
            let filename = "\(draft.id.uuidString).jpg"
            let destination = storageDirectory.appendingPathComponent(filename)
            if let data = draft.mediaData ?? draft.image?.jpegData(compressionQuality: 0.96) {
                try? data.write(to: destination, options: .atomic)
                return filename
            }
            return fileManager.fileExists(atPath: destination.path) ? filename : nil
        case .video:
            guard let sourceURL = draft.videoURL else { return nil }
            let ext = sourceURL.pathExtension.isEmpty ? "mov" : sourceURL.pathExtension
            let filename = "\(draft.id.uuidString).\(ext)"
            let destination = storageDirectory.appendingPathComponent(filename)
            if sourceURL.path != destination.path {
                if fileManager.fileExists(atPath: destination.path) {
                    try? fileManager.removeItem(at: destination)
                }
                try? fileManager.copyItem(at: sourceURL, to: destination)
            }
            return fileManager.fileExists(atPath: destination.path) ? filename : nil
        }
    }

    private func persistPreviewFile(for draft: CaptureUploadDraft) -> String? {
        guard let preview = draft.previewImage, let data = preview.jpegData(compressionQuality: 0.88) else { return nil }
        let filename = "\(draft.id.uuidString)-preview.jpg"
        let destination = storageDirectory.appendingPathComponent(filename)
        try? data.write(to: destination, options: .atomic)
        return filename
    }

    private func deleteLocalFiles(for draftID: UUID) {
        let prefix = draftID.uuidString
        guard let contents = try? fileManager.contentsOfDirectory(at: storageDirectory, includingPropertiesForKeys: nil) else { return }
        for url in contents where url.lastPathComponent.hasPrefix(prefix) {
            try? fileManager.removeItem(at: url)
        }
    }
}
private struct PersistedCaptureDraft: Codable {
    let id: UUID
    let source: CaptureDraftSource
    let mediaMode: CaptureMediaMode
    let mediaFilename: String?
    let previewFilename: String?
    let capturedAt: Date
    let duration: TimeInterval
    let spatialSamples: [PersistedSpatialSample]
    let primarySnapshotIndex: Int?
    let locationName: String?
    let caption: String
    let hashtagsText: String
    let isUploaded: Bool
    let captureHash: String?
    let backendMediaID: UUID?
    let remoteFileURL: URL?
    let remoteThumbnailURL: URL?
    let backendUsername: String?
    let backendUserToken: UUID?
}

private struct PersistedSpatialSample: Codable {
    let timestamp: Date
    let latitude: Double?
    let longitude: Double?
    let heading: Double?
    let course: Double?
    let speed: Double?
    let altitude: Double?
    let horizontalAccuracy: Double?
    let orientationLabel: String
    let pitch: Double?
    let roll: Double?
    let yaw: Double?

    init(_ sample: CaptureSpatialSnapshot) {
        timestamp = sample.timestamp
        latitude = sample.location?.coordinate.latitude
        longitude = sample.location?.coordinate.longitude
        heading = sample.heading
        course = sample.course
        speed = sample.speed
        altitude = sample.altitude
        horizontalAccuracy = sample.horizontalAccuracy
        orientationLabel = sample.orientationLabel
        pitch = sample.pitch
        roll = sample.roll
        yaw = sample.yaw
    }

    var snapshot: CaptureSpatialSnapshot {
        let location: CLLocation? = {
            guard let latitude, let longitude else { return nil }
            return CLLocation(
                coordinate: CLLocationCoordinate2D(latitude: latitude, longitude: longitude),
                altitude: altitude ?? 0,
                horizontalAccuracy: horizontalAccuracy ?? 0,
                verticalAccuracy: -1,
                course: course ?? -1,
                speed: speed ?? -1,
                timestamp: timestamp
            )
        }()

        return CaptureSpatialSnapshot(
            timestamp: timestamp,
            location: location,
            heading: heading,
            course: course,
            speed: speed,
            altitude: altitude,
            horizontalAccuracy: horizontalAccuracy,
            orientationLabel: orientationLabel,
            pitch: pitch,
            roll: roll,
            yaw: yaw
        )
    }
}
