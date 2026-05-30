import SwiftUI
import AVFoundation
import AVKit
import CoreLocation
import CoreMotion
import Combine
import UIKit

enum CaptureMediaMode: String, CaseIterable, Identifiable, Codable {
    case photo
    case video

    var id: String { rawValue }
}

enum CaptureDraftSource: String, Codable {
    case camera = "Live Capture"
    case library = "Library"
    case backend = "Uploaded"
}

struct CaptureLensOption: Identifiable, Equatable {
    let id: String
    let label: String
    let position: AVCaptureDevice.Position
    let deviceTypes: [AVCaptureDevice.DeviceType]

    static let front = CaptureLensOption(
        id: "front",
        label: "Front",
        position: .front,
        deviceTypes: [.builtInTrueDepthCamera, .builtInWideAngleCamera]
    )

    static let wide = CaptureLensOption(
        id: "wide",
        label: "1x",
        position: .back,
        deviceTypes: [.builtInWideAngleCamera, .builtInDualWideCamera]
    )

    static let ultraWide = CaptureLensOption(
        id: "ultra-wide",
        label: "0.5x",
        position: .back,
        deviceTypes: [.builtInUltraWideCamera]
    )

    static let telephoto = CaptureLensOption(
        id: "telephoto",
        label: "3x",
        position: .back,
        deviceTypes: [.builtInTelephotoCamera]
    )

    static let backOptions: [CaptureLensOption] = [.ultraWide, .wide, .telephoto]
}

struct CaptureSpatialSnapshot: Identifiable, Hashable {
    let id = UUID()
    let timestamp: Date
    let location: CLLocation?
    let heading: CLLocationDirection?
    let course: CLLocationDirection?
    let speed: CLLocationSpeed?
    let altitude: CLLocationDistance?
    let horizontalAccuracy: CLLocationAccuracy?
    let orientationLabel: String
    let pitch: Double?
    let roll: Double?
    let yaw: Double?

    var coordinateLabel: String {
        guard let location else { return "No coordinates" }
        return String(format: "%.5f, %.5f", location.coordinate.latitude, location.coordinate.longitude)
    }

    var headingLabel: String {
        guard let heading else { return "No heading" }
        return "\(Int(heading.rounded()))°"
    }

    var motionLabel: String {
        guard let pitch, let roll, let yaw else { return "Pitch / Roll / Yaw" }
        return "\(Int(pitch.rounded()))° / \(Int(roll.rounded()))° / \(Int(yaw.rounded()))°"
    }
}

struct CaptureUploadDraft: Identifiable {
    let id: UUID
    var source: CaptureDraftSource
    let mediaMode: CaptureMediaMode
    let image: UIImage?
    let videoURL: URL?
    let previewImage: UIImage?
    let capturedAt: Date
    let duration: TimeInterval
    let spatialSamples: [CaptureSpatialSnapshot]
    let primarySnapshot: CaptureSpatialSnapshot?
    var locationName: String?
    var caption: String
    var hashtagsText: String
    var isUploaded: Bool
    var captureHash: String?
    var mediaData: Data?
    var backendMediaID: UUID?
    var remoteFileURL: URL?
    var remoteThumbnailURL: URL?
    var backendUsername: String?
    var backendUserToken: UUID?

    var locationLabel: String {
        if let locationName, !locationName.isEmpty {
            return locationName
        }
        guard let location = primarySnapshot?.location else {
            return source.rawValue
        }
        return String(format: "%.3f, %.3f", location.coordinate.latitude, location.coordinate.longitude)
    }

    init(
        id: UUID = UUID(),
        source: CaptureDraftSource,
        mediaMode: CaptureMediaMode,
        image: UIImage? = nil,
        videoURL: URL? = nil,
        previewImage: UIImage? = nil,
        capturedAt: Date,
        duration: TimeInterval = 0,
        spatialSamples: [CaptureSpatialSnapshot],
        primarySnapshot: CaptureSpatialSnapshot?,
        locationName: String? = nil,
        caption: String = "",
        hashtagsText: String = "",
        isUploaded: Bool = false,
        captureHash: String? = nil,
        mediaData: Data? = nil,
        backendMediaID: UUID? = nil,
        remoteFileURL: URL? = nil,
        remoteThumbnailURL: URL? = nil,
        backendUsername: String? = nil,
        backendUserToken: UUID? = nil
    ) {
        self.id = id
        self.source = source
        self.mediaMode = mediaMode
        self.image = image
        self.videoURL = videoURL
        self.previewImage = previewImage
        self.capturedAt = capturedAt
        self.duration = duration
        self.spatialSamples = spatialSamples
        self.primarySnapshot = primarySnapshot
        self.locationName = locationName
        self.caption = caption
        self.hashtagsText = hashtagsText
        self.isUploaded = isUploaded
        self.captureHash = captureHash
        self.mediaData = mediaData
        self.backendMediaID = backendMediaID
        self.remoteFileURL = remoteFileURL
        self.remoteThumbnailURL = remoteThumbnailURL
        self.backendUsername = backendUsername
        self.backendUserToken = backendUserToken
    }
}

@MainActor
final class CaptureCameraController: NSObject, ObservableObject {
    @Published var pendingDraft: CaptureUploadDraft?
    @Published private(set) var capturedDrafts: [CaptureUploadDraft] = []
    @Published var latestSpatialSnapshot: CaptureSpatialSnapshot?
    @Published var captureMode: CaptureMediaMode = .photo
    @Published var availableLenses: [CaptureLensOption] = [.front, .wide]
    @Published var selectedLens: CaptureLensOption = .wide
    @Published var currentZoomFactor: CGFloat = 1
    @Published var isRecording = false
    @Published var recordingDurationLabel = "00:00"
    @Published var isSessionConfigured = false
    @Published var isCameraAuthorized = false
    @Published var permissionMessage = "Camera access is required to capture live media."

    let session = AVCaptureSession()

    private let sessionQueue = DispatchQueue(label: "openeyes.capture.session")
    private let locationManager = CLLocationManager()
    private let motionManager = CMMotionManager()
    private let photoOutput = AVCapturePhotoOutput()
    private let movieOutput = AVCaptureMovieFileOutput()
    private var videoInput: AVCaptureDeviceInput?
    private var audioInput: AVCaptureDeviceInput?
    private var currentLocation: CLLocation?
    private var currentHeading: CLLocationDirection?
    private var currentMotion: CMDeviceMotion?
    private var recordingSamples: [CaptureSpatialSnapshot] = []
    private var recordingTimer: Timer?
    private var recordingStartDate: Date?
    private var pendingVideoURL: URL?
    private var photoCaptureDate: Date?
    private var photoCaptureID = UUID()

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.headingFilter = 2
        UIDevice.current.beginGeneratingDeviceOrientationNotifications()
    }

    func activate() {
        requestPermissions()
        startSensors()
    }

    func deactivate() {
        stopSession()
        motionManager.stopDeviceMotionUpdates()
        locationManager.stopUpdatingLocation()
        locationManager.stopUpdatingHeading()
    }

    func requestPermissions() {
        Task { @MainActor in
            let videoGranted = await AVCaptureDevice.requestAccess(for: .video)
            let audioGranted = await AVCaptureDevice.requestAccess(for: .audio)
            isCameraAuthorized = videoGranted && audioGranted

            if locationManager.authorizationStatus == .notDetermined {
                locationManager.requestWhenInUseAuthorization()
            }

            if isCameraAuthorized {
                permissionMessage = "Ready to capture with full spatial metadata."
                configureSessionIfNeeded()
                startSession()
            } else {
                permissionMessage = "Enable camera and microphone access to record photos and videos."
            }
        }
    }

    func capturePhotoTap() {
        guard isCameraAuthorized else { return }
        captureMode = .photo
        capturePhoto()
    }

    func beginVideoCapture() {
        guard isCameraAuthorized, !isRecording else { return }
        captureMode = .video
        startRecording()
    }

    func endVideoCapture() {
        guard isRecording else { return }
        stopRecording()
    }

    func archiveDraft(_ draft: CaptureUploadDraft) {
        capturedDrafts.insert(draft, at: 0)
    }

    func setZoomFactor(_ factor: CGFloat) {
        sessionQueue.async {
            guard let device = self.videoInput?.device else { return }
            let maxZoom = min(device.activeFormat.videoMaxZoomFactor, 6)
            let clamped = min(max(factor, 1), maxZoom)

            do {
                try device.lockForConfiguration()
                device.videoZoomFactor = clamped
                device.unlockForConfiguration()

                DispatchQueue.main.async {
                    self.currentZoomFactor = clamped
                }
            } catch {
                return
            }
        }
    }

    func flipCamera() {
        let nextLens: CaptureLensOption
        if selectedLens.position == .front {
            nextLens = availableBackLensOptions().first ?? .wide
        } else {
            nextLens = .front
        }
        selectLens(nextLens)
    }

    func selectLens(_ lens: CaptureLensOption) {
        guard selectedLens != lens else { return }
        selectedLens = lens
        configureVideoInput(for: lens)
    }

    private func configureSessionIfNeeded() {
        guard !isSessionConfigured else { return }

        sessionQueue.async {
            self.session.beginConfiguration()
            if self.session.canSetSessionPreset(.hd1920x1080) {
                self.session.sessionPreset = .hd1920x1080
            } else if self.session.canSetSessionPreset(.hd1280x720) {
                self.session.sessionPreset = .hd1280x720
            } else {
                self.session.sessionPreset = .high
            }

            if self.session.canAddOutput(self.photoOutput) {
                self.session.addOutput(self.photoOutput)
            }

            if self.session.canAddOutput(self.movieOutput) {
                self.session.addOutput(self.movieOutput)
            }

            self.configureAudioInput()
            self.configureVideoInput(for: self.selectedLens)
            self.session.commitConfiguration()

            DispatchQueue.main.async {
                self.isSessionConfigured = true
                self.availableLenses = self.availableLensOptions(for: self.selectedLens.position)
                if !self.availableLenses.contains(self.selectedLens) {
                    self.selectedLens = self.availableLenses.first ?? .wide
                }
            }
        }
    }

    private func configureAudioInput() {
        guard audioInput == nil else { return }
        guard let device = AVCaptureDevice.default(for: .audio) else { return }
        guard let input = try? AVCaptureDeviceInput(device: device) else { return }
        if session.canAddInput(input) {
            session.addInput(input)
            audioInput = input
        }
    }

    private func configureVideoInput(for lens: CaptureLensOption) {
        sessionQueue.async {
            let options = self.availableLensOptions(for: lens.position)
            let resolvedLens = options.first(where: { $0.id == lens.id }) ?? options.first ?? lens
            guard let device = self.makeDevice(for: resolvedLens) else { return }
            guard let input = try? AVCaptureDeviceInput(device: device) else { return }

            self.session.beginConfiguration()
            if let oldInput = self.videoInput {
                self.session.removeInput(oldInput)
            }

            if self.session.canAddInput(input) {
                self.session.addInput(input)
                self.videoInput = input
            }
            self.session.commitConfiguration()

            do {
                try device.lockForConfiguration()
                device.videoZoomFactor = 1
                device.unlockForConfiguration()
            } catch {
                // Ignore zoom reset errors and continue.
            }

            DispatchQueue.main.async {
                self.availableLenses = options
                self.selectedLens = resolvedLens
                self.currentZoomFactor = 1
            }
        }
    }

    private func makeDevice(for lens: CaptureLensOption) -> AVCaptureDevice? {
        let discovery = AVCaptureDevice.DiscoverySession(
            deviceTypes: lens.deviceTypes,
            mediaType: .video,
            position: lens.position
        )

        if let primary = discovery.devices.first {
            return primary
        }

        return AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: lens.position)
    }

    private func availableLensOptions(for position: AVCaptureDevice.Position) -> [CaptureLensOption] {
        if position == .front {
            return [.front]
        }

        return availableBackLensOptions()
    }

    private func availableBackLensOptions() -> [CaptureLensOption] {
        CaptureLensOption.backOptions.filter { makeDevice(for: $0) != nil }
    }

    private func startSession() {
        sessionQueue.async {
            guard !self.session.isRunning else { return }
            self.session.startRunning()
        }
    }

    private func stopSession() {
        sessionQueue.async {
            guard self.session.isRunning else { return }
            self.session.stopRunning()
        }
    }

    private func startSensors() {
        let status = locationManager.authorizationStatus
        if status == .authorizedAlways || status == .authorizedWhenInUse {
            locationManager.startUpdatingLocation()
            if CLLocationManager.headingAvailable() {
                locationManager.startUpdatingHeading()
            }
        }

        motionManager.deviceMotionUpdateInterval = 0.2
        motionManager.startDeviceMotionUpdates(to: .main) { [weak self] motion, _ in
            guard let self else { return }
            self.currentMotion = motion
            self.latestSpatialSnapshot = self.makeSnapshot(timestamp: Date())
        }
    }

    private func capturePhoto() {
        photoCaptureDate = Date()
        photoCaptureID = UUID()
        let settings: AVCapturePhotoSettings
        if photoOutput.availablePhotoCodecTypes.contains(.jpeg) {
            settings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.jpeg])
        } else {
            settings = AVCapturePhotoSettings()
        }
        settings.flashMode = .off
        if let connection = photoOutput.connection(with: .video) {
            applyCaptureRotation(to: connection)
        }
        photoOutput.capturePhoto(with: settings, delegate: self)
    }

    private func startRecording() {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("mov")

        pendingVideoURL = url
        recordingStartDate = Date()
        recordingSamples = []
        appendRecordingSample()
        startRecordingTimer()

        if let connection = movieOutput.connection(with: .video) {
            applyCaptureRotation(to: connection)
        }
        movieOutput.startRecording(to: url, recordingDelegate: self)
        isRecording = true
    }

    private func stopRecording() {
        guard movieOutput.isRecording else { return }
        movieOutput.stopRecording()
    }

    private func startRecordingTimer() {
        recordingTimer?.invalidate()
        recordingTimer = Timer.scheduledTimer(withTimeInterval: 0.2, repeats: true) { [weak self] _ in
            guard let self else { return }
            self.appendRecordingSample()
            self.recordingDurationLabel = self.formatRecordingDuration()
        }
        recordingDurationLabel = "00:00"
    }

    private func formatRecordingDuration() -> String {
        let duration = max(Date().timeIntervalSince(recordingStartDate ?? Date()), 0)
        let minutes = Int(duration) / 60
        let seconds = Int(duration) % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }

    private func appendRecordingSample() {
        let snapshot = makeSnapshot(timestamp: Date())
        latestSpatialSnapshot = snapshot
        recordingSamples.append(snapshot)
    }

    private func finishRecordingSession() {
        recordingTimer?.invalidate()
        recordingTimer = nil
        recordingDurationLabel = "00:00"
        isRecording = false
    }

    private func makeSnapshot(timestamp: Date) -> CaptureSpatialSnapshot {
        let pitch = currentMotion.map { $0.attitude.pitch * 180 / .pi }
        let roll = currentMotion.map { $0.attitude.roll * 180 / .pi }
        let yaw = currentMotion.map { $0.attitude.yaw * 180 / .pi }

        return CaptureSpatialSnapshot(
            timestamp: timestamp,
            location: currentLocation,
            heading: currentHeading,
            course: currentLocation?.course,
            speed: currentLocation?.speed,
            altitude: currentLocation?.altitude,
            horizontalAccuracy: currentLocation?.horizontalAccuracy,
            orientationLabel: UIDevice.current.orientation.captureLabel,
            pitch: pitch,
            roll: roll,
            yaw: yaw
        )
    }

    private func makeVideoPreviewImage(from url: URL) -> UIImage? {
        let asset = AVURLAsset(url: url)
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true

        guard let cgImage = try? generator.copyCGImage(at: .zero, actualTime: nil) else {
            return nil
        }
        return UIImage(cgImage: cgImage)
    }

    private func applyCaptureRotation(to connection: AVCaptureConnection) {
        let angle = captureRotationAngle(for: resolvedDeviceOrientation())
        guard connection.isVideoRotationAngleSupported(angle) else { return }
        connection.videoRotationAngle = angle
    }

    private func resolvedDeviceOrientation() -> UIDeviceOrientation {
        let orientation = UIDevice.current.orientation
        guard orientation.isValidInterfaceOrientation else { return .portrait }
        return orientation
    }

    private func captureRotationAngle(for orientation: UIDeviceOrientation) -> CGFloat {
        switch orientation {
        case .landscapeLeft:
            return 0
        case .landscapeRight:
            return 180
        case .portraitUpsideDown:
            return 270
        case .portrait:
            return 90
        default:
            return 90
        }
    }
}

extension CaptureCameraController: AVCapturePhotoCaptureDelegate {
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        guard error == nil else { return }
        guard
            let rawData = photo.fileDataRepresentation(),
            let normalizedImage = UIImage(data: rawData)?.normalizedCaptureImage(),
            let jpegData = normalizedImage.jpegData(compressionQuality: 0.96)
        else { return }

        let capturedAt = photoCaptureDate ?? Date()
        let snapshot = makeSnapshot(timestamp: capturedAt)
        latestSpatialSnapshot = snapshot

        let lat = snapshot.location?.coordinate.latitude ?? 0
        let lon = snapshot.location?.coordinate.longitude ?? 0
        let heading = snapshot.heading ?? 0
        let captureHash = CaptureHasher.hash(
            mediaData: jpegData,
            lat: lat,
            lon: lon,
            capturedAt: capturedAt,
            heading: heading
        )
        print("[OpenEyes] SHA-256 capture hash: \(captureHash)")

        pendingDraft = CaptureUploadDraft(
            id: photoCaptureID,
            source: .camera,
            mediaMode: .photo,
            image: normalizedImage,
            previewImage: normalizedImage,
            capturedAt: capturedAt,
            spatialSamples: [snapshot],
            primarySnapshot: snapshot,
            captureHash: captureHash,
            mediaData: jpegData
        )
    }
}

extension CaptureCameraController: AVCaptureFileOutputRecordingDelegate {
    func fileOutput(_ output: AVCaptureFileOutput, didStartRecordingTo fileURL: URL, from connections: [AVCaptureConnection]) {
        recordingDurationLabel = formatRecordingDuration()
    }

    func fileOutput(_ output: AVCaptureFileOutput, didFinishRecordingTo outputFileURL: URL, from connections: [AVCaptureConnection], error: Error?) {
        finishRecordingSession()
        guard error == nil else { return }

        let asset = AVURLAsset(url: outputFileURL)
        let duration = asset.duration.seconds.isFinite ? asset.duration.seconds : 0
        let snapshot = recordingSamples.last ?? latestSpatialSnapshot
        let capturedAt = recordingStartDate ?? Date()

        let videoData = (try? Data(contentsOf: outputFileURL)) ?? Data()
        let lat = snapshot?.location?.coordinate.latitude ?? 0
        let lon = snapshot?.location?.coordinate.longitude ?? 0
        let heading = snapshot?.heading ?? 0
        let captureHash = CaptureHasher.hash(
            mediaData: videoData,
            lat: lat,
            lon: lon,
            capturedAt: capturedAt,
            heading: heading
        )
        print("[OpenEyes] SHA-256 video hash: \(captureHash)")

        pendingDraft = CaptureUploadDraft(
            source: .camera,
            mediaMode: .video,
            videoURL: outputFileURL,
            previewImage: makeVideoPreviewImage(from: outputFileURL),
            capturedAt: capturedAt,
            duration: duration,
            spatialSamples: recordingSamples,
            primarySnapshot: snapshot,
            captureHash: captureHash,
            mediaData: videoData
        )
        recordingSamples = []
        pendingVideoURL = nil
    }
}

extension CaptureCameraController: CLLocationManagerDelegate {
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        if status == .authorizedAlways || status == .authorizedWhenInUse {
            manager.startUpdatingLocation()
            if CLLocationManager.headingAvailable() {
                manager.startUpdatingHeading()
            }
        }
        latestSpatialSnapshot = makeSnapshot(timestamp: Date())
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        currentLocation = locations.last
        latestSpatialSnapshot = makeSnapshot(timestamp: Date())
        if isRecording {
            appendRecordingSample()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
        currentHeading = newHeading.trueHeading >= 0 ? newHeading.trueHeading : newHeading.magneticHeading
        latestSpatialSnapshot = makeSnapshot(timestamp: Date())
    }
}
struct CapturePreviewView: UIViewRepresentable {
    let session: AVCaptureSession
    let onPinch: (CGFloat, UIGestureRecognizer.State) -> Void

    func makeUIView(context: Context) -> CapturePreviewUIView {
        let view = CapturePreviewUIView()
        view.previewLayer.videoGravity = .resizeAspectFill
        view.previewLayer.session = session
        view.onPinch = onPinch
        return view
    }

    func updateUIView(_ uiView: CapturePreviewUIView, context: Context) {
        uiView.previewLayer.session = session
        uiView.onPinch = onPinch
    }
}

final class CapturePreviewUIView: UIView {
    var onPinch: ((CGFloat, UIGestureRecognizer.State) -> Void)?

    override class var layerClass: AnyClass {
        AVCaptureVideoPreviewLayer.self
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        isMultipleTouchEnabled = true
        let pinchRecognizer = UIPinchGestureRecognizer(target: self, action: #selector(handlePinch(_:)))
        addGestureRecognizer(pinchRecognizer)
        isUserInteractionEnabled = true
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    var previewLayer: AVCaptureVideoPreviewLayer {
        guard let layer = layer as? AVCaptureVideoPreviewLayer else {
            fatalError("Unexpected layer type")
        }
        return layer
    }

    @objc
    private func handlePinch(_ recognizer: UIPinchGestureRecognizer) {
        onPinch?(recognizer.scale, recognizer.state)
        if recognizer.state == .ended || recognizer.state == .cancelled || recognizer.state == .failed {
            recognizer.scale = 1
        }
    }
}

extension UIDeviceOrientation {
    var captureLabel: String {
        switch self {
        case .portrait: return "Portrait"
        case .portraitUpsideDown: return "Portrait Down"
        case .landscapeLeft: return "Landscape Left"
        case .landscapeRight: return "Landscape Right"
        case .faceUp: return "Face Up"
        case .faceDown: return "Face Down"
        default: return "Unknown"
        }
    }
}

extension TimeInterval {
    var compactDurationLabel: String {
        let totalSeconds = Int(self.rounded())
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}

extension DateFormatter {
    static let captureComposer: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "dd MMM yyyy, HH:mm"
        return formatter
    }()

    static let captureViewerDay: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "dd MMM yyyy"
        return formatter
    }()

    static let captureViewerTime: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter
    }()

    static let captureExploreDetail: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "dd MMM yyyy, HH:mm"
        return formatter
    }()
}

extension UIImage {
    func normalizedCaptureImage() -> UIImage {
        guard imageOrientation != .up else { return self }

        let format = UIGraphicsImageRendererFormat()
        format.scale = scale
        let renderer = UIGraphicsImageRenderer(size: size, format: format)

        return renderer.image { _ in
            draw(in: CGRect(origin: .zero, size: size))
        }
    }
}
