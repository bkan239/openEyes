import Combine
import SwiftUI

struct CaptureScreenView: View {
    @ObservedObject var draftStore: CaptureDraftStore
    @StateObject private var camera = CaptureCameraController()
    @State private var pendingUploadDraft: CaptureUploadDraft?
    @State private var captureFlashOpacity: Double = 0

    var body: some View {
        ZStack {
            CaptureCameraPanel(
                camera: camera,
                onOpenUploads: {
                    if let draft = draftStore.drafts.first(where: { !$0.isUploaded }) {
                        pendingUploadDraft = draft
                    } else if let latest = draftStore.drafts.first {
                        pendingUploadDraft = latest
                    }
                }
            )

            Color.white.opacity(captureFlashOpacity).ignoresSafeArea().allowsHitTesting(false)
        }
        .background(Ink.ink.ignoresSafeArea())
        .task { camera.activate() }
        .onDisappear { camera.deactivate() }
        .onReceive(camera.$pendingDraft.compactMap { $0 }) { draft in
            draftStore.upsert(draft)
            camera.pendingDraft = nil
            pendingUploadDraft = draft
            let peak = draft.mediaMode == .video ? 0.18 : 0.42
            withAnimation(.easeOut(duration: 0.06)) { captureFlashOpacity = peak }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.06) {
                withAnimation(.easeOut(duration: 0.22)) { captureFlashOpacity = 0 }
            }
        }
        .sheet(item: $pendingUploadDraft) { draft in
            UploadSheetView(draft: draft) { updated in
                draftStore.upsert(updated)
                pendingUploadDraft = nil
            }
        }
    }
}

struct CaptureCameraPanel: View {
    @ObservedObject var camera: CaptureCameraController
    let onOpenUploads: () -> Void
    @State private var isPressingShutter = false

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                if camera.isCameraAuthorized && camera.isSessionConfigured {
                    CapturePreviewView(session: camera.session) { scale, state in
                        if state == .began {
                            camera.setZoomFactor(camera.currentZoomFactor * scale)
                        }
                    }
                    .ignoresSafeArea()
                } else {
                    VStack(spacing: 16) {
                        Image(systemName: "camera.fill")
                            .font(.system(size: 44))
                            .foregroundStyle(Ink.primaryOnInk)
                        Text(camera.permissionMessage)
                            .font(InkFont.body(15))
                            .foregroundStyle(Ink.onInkMuted)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                        if !camera.isCameraAuthorized {
                            Button("Enable Camera") { camera.requestPermissions() }
                                .font(InkFont.headline(14))
                                .foregroundStyle(Ink.ink)
                                .padding(.horizontal, 18)
                                .padding(.vertical, 10)
                                .background(Ink.primaryOnInk)
                                .clipShape(Capsule())
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Ink.ink)
                }

                LinearGradient(
                    colors: [Ink.ink.opacity(0.5), .clear, Ink.ink.opacity(0.65)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .allowsHitTesting(false)

                VStack {
                    HStack {
                        Text("Capture")
                            .font(InkFont.headline(18))
                            .foregroundStyle(Ink.onInk)
                        Spacer()
                        Button(action: onOpenUploads) {
                            Image(systemName: "arrow.up.circle.fill")
                                .font(.system(size: 26))
                                .foregroundStyle(Ink.primaryOnInk)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, geometry.safeAreaInsets.top + 8)

                    Spacer()

                    if camera.isRecording {
                        Text(camera.recordingDurationLabel)
                            .font(InkFont.headline(16))
                            .foregroundStyle(Ink.onInk)
                            .padding(.bottom, 8)
                    }

                    HStack(spacing: 8) {
                        ForEach(camera.availableLenses) { lens in
                            Button { camera.selectLens(lens) } label: {
                                Text(lens.label)
                                    .font(InkFont.caption(13))
                                    .foregroundStyle(camera.selectedLens.id == lens.id ? Ink.ink : Ink.onInk)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .background(camera.selectedLens.id == lens.id ? Ink.primaryOnInk : Ink.inkSurface.opacity(0.7))
                                    .clipShape(Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.bottom, 12)

                    HStack(spacing: 36) {
                        Button { camera.flipCamera() } label: {
                            Image(systemName: "arrow.triangle.2.circlepath.camera")
                                .font(.system(size: 24))
                                .foregroundStyle(Ink.onInk)
                        }

                        ZStack {
                            Circle()
                                .stroke(Ink.onInk, lineWidth: 4)
                                .frame(width: 78, height: 78)
                            Circle()
                                .fill(camera.isRecording ? Color.red : Ink.onInk)
                                .frame(width: camera.isRecording ? 34 : 62, height: camera.isRecording ? 34 : 62)
                        }
                        .gesture(
                            DragGesture(minimumDistance: 0)
                                .onChanged { _ in
                                    if !isPressingShutter {
                                        isPressingShutter = true
                                        camera.beginVideoCapture()
                                    }
                                }
                                .onEnded { _ in
                                    isPressingShutter = false
                                    if camera.isRecording {
                                        camera.endVideoCapture()
                                    } else {
                                        camera.capturePhotoTap()
                                    }
                                }
                        )

                        Button {
                            camera.capturePhotoTap()
                        } label: {
                            Image(systemName: "photo")
                                .font(.system(size: 24))
                                .foregroundStyle(Ink.onInk)
                        }
                    }
                    .padding(.bottom, geometry.safeAreaInsets.bottom + 24)
                }
            }
        }
    }
}

#Preview {
    CaptureScreenView(draftStore: CaptureDraftStore())
}
