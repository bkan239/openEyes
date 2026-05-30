import SwiftUI

struct UploadSheetView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var draft: CaptureUploadDraft
    @State private var caption: String
    @State private var isUploading = false
    @State private var didUpload = false
    let onSave: (CaptureUploadDraft) -> Void

    init(draft: CaptureUploadDraft, onSave: @escaping (CaptureUploadDraft) -> Void) {
        _draft = State(initialValue: draft)
        _caption = State(initialValue: draft.caption)
        self.onSave = onSave
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    mediaPreview

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Description")
                            .font(InkFont.headline(16))
                            .foregroundStyle(Ink.text)
                        TextEditor(text: $caption)
                            .frame(minHeight: 100)
                            .padding(10)
                            .scrollContentBackground(.hidden)
                            .background(Ink.surfaceSunken)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Ink.border, lineWidth: 1))
                    }

                    provenanceCard

                    if didUpload {
                        HStack(spacing: 8) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(VerificationStatus.verified.foreground)
                            Text("Queued for verification — frontend mock upload complete.")
                                .font(InkFont.body(14))
                                .foregroundStyle(Ink.textMuted)
                        }
                        .padding(12)
                        .background(VerificationStatus.verified.background)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }

                    PrimaryButton(title: didUpload ? "Done" : "Upload", isLoading: isUploading) {
                        if didUpload {
                            dismiss()
                        } else {
                            Task { await performMockUpload() }
                        }
                    }
                }
                .padding(20)
            }
            .background(Ink.bg.ignoresSafeArea())
            .navigationTitle("Upload")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") { dismiss() }.foregroundStyle(Ink.textMuted)
                }
            }
        }
    }

    @ViewBuilder
    private var mediaPreview: some View {
        Group {
            if let image = draft.previewImage ?? draft.image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                ZStack {
                    Ink.ink
                    Image(systemName: "video.fill")
                        .font(.system(size: 40))
                        .foregroundStyle(Ink.primaryOnInk)
                }
            }
        }
        .frame(height: 220)
        .frame(maxWidth: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Ink.border, lineWidth: 1))
    }

    private var provenanceCard: some View {
        InkCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("Provenance")
                    .font(InkFont.headline(15))
                    .foregroundStyle(Ink.text)
                Label(draft.locationLabel, systemImage: "location.fill")
                if let hash = draft.captureHash {
                    Text("Hash: \(hash.prefix(16))…")
                        .font(.system(.caption, design: .monospaced))
                        .foregroundStyle(Ink.textMuted)
                }
                Text("Captured \(draft.capturedAt.formatted(date: .abbreviated, time: .shortened))")
                    .font(InkFont.caption(13))
                    .foregroundStyle(Ink.textSubtle)
            }
            .font(InkFont.body(14))
            .foregroundStyle(Ink.textMuted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
        }
    }

    @MainActor
    private func performMockUpload() async {
        isUploading = true
        try? await Task.sleep(nanoseconds: 1_200_000_000)
        draft.caption = caption
        draft.isUploaded = true
        onSave(draft)
        isUploading = false
        didUpload = true
    }
}

#Preview {
    UploadSheetView(
        draft: CaptureUploadDraft(
            source: .camera,
            mediaMode: .photo,
            image: nil,
            previewImage: nil,
            capturedAt: .now,
            spatialSamples: [],
            primarySnapshot: nil,
            captureHash: "abc123"
        ),
        onSave: { _ in }
    )
}
