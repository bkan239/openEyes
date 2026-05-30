import SwiftUI

struct CaptureAlbumView: View {
    @ObservedObject var draftStore: CaptureDraftStore
    @Environment(\.dismiss) private var dismiss
    @State private var uploadDraft: CaptureUploadDraft?

    private let columns = [
        GridItem(.flexible(), spacing: 2),
        GridItem(.flexible(), spacing: 2),
        GridItem(.flexible(), spacing: 2),
    ]

    var body: some View {
        NavigationStack {
            Group {
                if draftStore.drafts.isEmpty {
                    emptyState
                } else {
                    ScrollView {
                        LazyVGrid(columns: columns, spacing: 2) {
                            ForEach(draftStore.drafts) { draft in
                                Button {
                                    uploadDraft = draft
                                } label: {
                                    AlbumThumbnail(draft: draft)
                                }
                                .buttonStyle(ScaleButtonStyle())
                            }
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Ink.bg.ignoresSafeArea())
            .navigationTitle("Album")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") { dismiss() }
                        .foregroundStyle(Ink.textMuted)
                }
            }
            .sheet(item: $uploadDraft) { draft in
                UploadSheetView(draft: draft) { updated in
                    draftStore.upsert(updated)
                    uploadDraft = nil
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            Image(systemName: "photo.on.rectangle.angled")
                .font(.system(size: 40, weight: .medium))
                .foregroundStyle(Ink.textSubtle)
            Text("No captures yet")
                .font(InkFont.headline(18))
                .foregroundStyle(Ink.text)
            Text("Photos and videos you take will appear here.")
                .font(InkFont.body(14))
                .foregroundStyle(Ink.textMuted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct AlbumThumbnail: View {
    let draft: CaptureUploadDraft

    var body: some View {
        Color.clear
            .aspectRatio(1, contentMode: .fit)
            .overlay {
                thumbnailImage
            }
            .clipShape(Rectangle())
            .overlay(alignment: .topTrailing) {
                if draft.isUploaded {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(Ink.onPrimary)
                        .padding(6)
                        .shadow(color: Ink.ink.opacity(0.35), radius: 2, y: 1)
                }
            }
            .overlay(alignment: .bottomLeading) {
                if draft.mediaMode == .video, draft.duration > 0 {
                    Text(formattedDuration)
                        .font(.system(size: 11, weight: .semibold).monospacedDigit())
                        .foregroundStyle(Ink.onInk)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(Ink.ink.opacity(0.55))
                        .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
                        .padding(6)
                }
            }
    }

    @ViewBuilder
    private var thumbnailImage: some View {
        if let image = draft.previewImage ?? draft.image {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
        } else {
            ZStack {
                Ink.ink
                Image(systemName: "video.fill")
                    .font(.system(size: 28))
                    .foregroundStyle(Ink.primaryOnInk)
            }
        }
    }

    private var formattedDuration: String {
        let total = Int(draft.duration.rounded())
        let minutes = total / 60
        let seconds = total % 60
        if minutes > 0 {
            return String(format: "%d:%02d", minutes, seconds)
        }
        return "0:\(String(format: "%02d", seconds))"
    }
}

#Preview {
    CaptureAlbumView(draftStore: CaptureDraftStore())
}
