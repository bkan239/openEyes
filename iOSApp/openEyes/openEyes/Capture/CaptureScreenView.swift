import Combine
import SwiftUI

private enum CaptureCameraLayout {
    /// Lifts shutter row above the tab bar compositing layer.
    static let controlsBottomPadding: CGFloat = 44
}

struct CaptureScreenView: View {
    @ObservedObject var draftStore: CaptureDraftStore
    @StateObject private var camera = CaptureCameraController()
    @State private var isAlbumPresented = false
    @State private var captureFlashOpacity: Double = 0

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .bottom) {
                CaptureCameraPanel(
                    camera: camera,
                    lastCapture: draftStore.drafts.first,
                    onOpenAlbum: { isAlbumPresented = true }
                )
                .frame(width: geometry.size.width, height: geometry.size.height)

                Color.white
                    .opacity(captureFlashOpacity)
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Ink.ink.ignoresSafeArea())
        }
        .background(Ink.ink)
        .task { camera.activate() }
        .onDisappear { camera.deactivate() }
        .onReceive(camera.$pendingDraft.compactMap { $0 }) { draft in
            draftStore.upsert(draft)
            camera.pendingDraft = nil
            let peakOpacity = draft.mediaMode == .video ? 0.18 : 0.42
            withAnimation(.easeOut(duration: 0.06)) { captureFlashOpacity = peakOpacity }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.06) {
                withAnimation(.easeOut(duration: 0.22)) { captureFlashOpacity = 0 }
            }
        }
        .sheet(isPresented: $isAlbumPresented) {
            CaptureAlbumView(draftStore: draftStore)
        }
        .preferredColorScheme(.dark)
    }
}

struct CaptureCameraPanel: View {
    @ObservedObject var camera: CaptureCameraController
    let lastCapture: CaptureUploadDraft?
    let onOpenAlbum: () -> Void

    @State private var deviceOrientation: UIDeviceOrientation = UIDevice.current.orientation
    @State private var isPressingShutter = false
    @State private var didBeginHoldRecording = false
    @State private var isRecordingLocked = false
    @State private var gestureStartedWhileLocked = false
    @State private var holdStartWorkItem: DispatchWorkItem?
    @State private var pinchStartZoom: CGFloat?

    var body: some View {
        ZStack {
            previewSurface
                .ignoresSafeArea(edges: [.top, .horizontal, .bottom])

            LinearGradient(
                colors: [
                    Ink.ink.opacity(0.46),
                    .clear,
                    .clear,
                    Ink.ink.opacity(0.22),
                    Ink.ink.opacity(0.62),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .allowsHitTesting(false)
        }
        .overlay(alignment: .bottom) {
            bottomOverlay
                .padding(.bottom, CaptureCameraLayout.controlsBottomPadding)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Ink.ink)
        .onChange(of: camera.isRecording) { _, isRecording in
            if !isRecording { isRecordingLocked = false }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIDevice.orientationDidChangeNotification)) { _ in
            let nextOrientation = UIDevice.current.orientation
            guard nextOrientation.isValidInterfaceOrientation else { return }
            deviceOrientation = nextOrientation
        }
    }

    private var previewSurface: some View {
        Group {
            if camera.isCameraAuthorized && camera.isSessionConfigured {
                CapturePreviewView(session: camera.session) { scale, state in
                    switch state {
                    case .began:
                        pinchStartZoom = camera.currentZoomFactor
                    case .changed:
                        let baseZoom = pinchStartZoom ?? camera.currentZoomFactor
                        camera.setZoomFactor(baseZoom * scale)
                    default:
                        pinchStartZoom = nil
                    }
                }
            } else {
                ZStack {
                    LinearGradient(
                        colors: [Ink.onInk.opacity(0.08), Ink.onInk.opacity(0.03)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )

                    VStack(spacing: 12) {
                        if camera.isCameraAuthorized {
                            ProgressView()
                                .scaleEffect(1.4)
                                .tint(Ink.primaryOnInk)
                        } else {
                            Image(systemName: "camera.fill")
                                .font(.system(size: UIScreen.main.bounds.width / 6))
                                .foregroundStyle(Ink.onInk.opacity(0.82))
                        }
                        Text(camera.permissionMessage)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Ink.onInk)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 28)
                        if !camera.isCameraAuthorized {
                            Button("Enable Camera") { camera.requestPermissions() }
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Ink.ink)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 10)
                                .background(Capsule().fill(Ink.primaryOnInk))
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .clipped()
    }

    private var bottomOverlay: some View {
        VStack(spacing: 16) {
            HStack {
                Spacer()
                HStack(spacing: 8) {
                    ForEach(camera.availableLenses) { lens in
                        lensChip(
                            title: lens.label,
                            isSelected: camera.selectedLens.id == lens.id
                        ) {
                            camera.selectLens(lens)
                        }
                    }
                }
                Spacer()
            }
            .padding(.horizontal, 16)

            if isRecordingLocked {
                Text("Locked")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Ink.onInk)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Capsule().fill(Ink.ink.opacity(0.34)))
            }

            if camera.isRecording && !isRecordingLocked {
                Text(camera.recordingDurationLabel)
                    .font(.system(size: 13, weight: .semibold).monospacedDigit())
                    .foregroundStyle(Ink.onInk)
            }

            HStack {
                lastCaptureButton
                    .frame(width: 72, alignment: .leading)

                Spacer()

                ZStack {
                    Circle()
                        .fill(didBeginHoldRecording || camera.isRecording ? Color.red : Ink.onInk)
                        .frame(width: 78, height: 78)

                    Circle()
                        .stroke(Ink.onInk.opacity(0.3), lineWidth: 2)
                        .frame(width: 92, height: 92)

                    if didBeginHoldRecording || camera.isRecording {
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Ink.onInk)
                            .frame(width: 26, height: 26)
                    } else {
                        Circle()
                            .stroke(Ink.ink.opacity(0.12), lineWidth: 1)
                            .frame(width: 62, height: 62)
                    }
                }
                .scaleEffect(isPressingShutter || camera.isRecording ? 0.94 : 1)
                .animation(.easeOut(duration: 0.14), value: isPressingShutter)
                .contentShape(Circle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            handleShutterPressChanged(translationWidth: value.translation.width)
                        }
                        .onEnded { _ in
                            handleShutterPressEnded()
                        }
                )
                .disabled(!camera.isCameraAuthorized)

                Spacer()

                Button { camera.flipCamera() } label: {
                    controlCircle(systemName: "arrow.triangle.2.circlepath.camera")
                }
                .disabled(!camera.isCameraAuthorized)
                .frame(width: 72, alignment: .trailing)
            }
            .padding(.horizontal, 16)
        }
    }

    private func handleShutterPressChanged(translationWidth: CGFloat) {
        guard camera.isCameraAuthorized else { return }

        if isRecordingLocked {
            if !didBeginHoldRecording { gestureStartedWhileLocked = true }
            isPressingShutter = true
            return
        }

        if didBeginHoldRecording && !isRecordingLocked && translationWidth < -70 {
            isRecordingLocked = true
            gestureStartedWhileLocked = false
            isPressingShutter = false
            return
        }

        guard !isPressingShutter else { return }

        isPressingShutter = true
        didBeginHoldRecording = false

        let workItem = DispatchWorkItem {
            guard isPressingShutter else { return }
            didBeginHoldRecording = true
            camera.beginVideoCapture()
        }
        holdStartWorkItem = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.18, execute: workItem)
    }

    private func handleShutterPressEnded() {
        holdStartWorkItem?.cancel()
        holdStartWorkItem = nil

        if isRecordingLocked {
            if gestureStartedWhileLocked && camera.isRecording {
                camera.endVideoCapture()
                isRecordingLocked = false
            }
            isPressingShutter = false
            didBeginHoldRecording = false
            gestureStartedWhileLocked = false
            return
        }

        if didBeginHoldRecording {
            camera.endVideoCapture()
        } else {
            camera.capturePhotoTap()
        }

        isPressingShutter = false
        didBeginHoldRecording = false
        gestureStartedWhileLocked = false
    }

    private func lensChip(title: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(isSelected ? Ink.ink : Ink.onInk)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(
                    Capsule()
                        .fill(isSelected ? Ink.primaryOnInk : Ink.ink.opacity(0.28))
                        .overlay(
                            Capsule()
                                .stroke(Ink.onInk.opacity(isSelected ? 0 : 0.12), lineWidth: 1)
                        )
                )
        }
        .buttonStyle(.plain)
    }

    private func controlCircle(systemName: String) -> some View {
        Image(systemName: systemName)
            .font(.system(size: 20, weight: .semibold))
            .foregroundStyle(Ink.onInk)
            .frame(width: 46, height: 46)
            .background(Circle().fill(Ink.onInk.opacity(0.08)))
            .overlay(Circle().stroke(Ink.onInk.opacity(0.1), lineWidth: 1))
            .rotationEffect(flipIconRotation)
            .animation(.easeOut(duration: 0.18), value: deviceOrientation)
    }

    private var flipIconRotation: Angle {
        switch deviceOrientation {
        case .landscapeLeft: return .degrees(90)
        case .landscapeRight: return .degrees(-90)
        default: return .degrees(0)
        }
    }

    private var lastCaptureButton: some View {
        Button(action: onOpenAlbum) {
            ZStack {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Ink.ink.opacity(0.28))
                    .frame(width: 52, height: 52)

                if let image = lastCapture?.image ?? lastCapture?.previewImage {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                        .frame(width: 52, height: 52)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                } else {
                    Image(systemName: "photo.on.rectangle")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundStyle(Ink.onInk.opacity(0.7))
                }
            }
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(Ink.onInk.opacity(0.14), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

private extension UIDeviceOrientation {
    var isValidInterfaceOrientation: Bool {
        switch self {
        case .portrait, .portraitUpsideDown, .landscapeLeft, .landscapeRight:
            return true
        default:
            return false
        }
    }
}

#Preview {
    CaptureScreenView(draftStore: CaptureDraftStore())
}
