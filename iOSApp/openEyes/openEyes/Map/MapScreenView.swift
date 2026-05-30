import MapKit
import SwiftUI

struct MapScreenView: View {
    @Binding var focusTarget: MapFocusTarget?
    @State private var position = MapCameraPosition.region(
        MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 48.0, longitude: 10.0),
            span: MKCoordinateSpan(latitudeDelta: 18, longitudeDelta: 18)
        )
    )
    @State private var selectedPin: MapEventPin?

    var body: some View {
        NavigationStack {
            ZStack(alignment: .top) {
                Map(position: $position, selection: $selectedPin) {
                    ForEach(MockData.mapPins) { pin in
                        Annotation(pin.title, coordinate: pin.coordinate) {
                            MapPinView(status: pin.status, isSelected: selectedPin?.id == pin.id)
                        }
                        .tag(pin)
                    }
                }
                .mapStyle(.standard(elevation: .flat, pointsOfInterest: .excludingAll))
                .ignoresSafeArea(edges: .bottom)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Map")
                        .font(InkFont.title(28))
                        .foregroundStyle(Ink.onInk)
                    Text("Corroborated events near you")
                        .font(InkFont.body(14))
                        .foregroundStyle(Ink.onInkMuted)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
                .background(
                    LinearGradient(colors: [Ink.ink.opacity(0.88), Ink.ink.opacity(0)], startPoint: .top, endPoint: .bottom)
                )
            }
            .background(Ink.bg)
            .sheet(item: $selectedPin) { pin in
                MapPinDetailSheet(pin: pin)
            }
            .onChange(of: focusTarget) { _, target in
                guard let target else { return }
                withAnimation {
                    position = .region(
                        MKCoordinateRegion(
                            center: target.coordinate,
                            span: MKCoordinateSpan(latitudeDelta: target.span, longitudeDelta: target.span)
                        )
                    )
                }
                focusTarget = nil
            }
        }
    }
}

struct MapPinView: View {
    let status: VerificationStatus
    let isSelected: Bool

    var body: some View {
        ZStack {
            Circle()
                .fill(status.background)
                .frame(width: isSelected ? 44 : 36, height: isSelected ? 44 : 36)
                .overlay(Circle().stroke(status.foreground, lineWidth: 2))
            Image(systemName: "video.fill")
                .font(.system(size: isSelected ? 14 : 12, weight: .semibold))
                .foregroundStyle(status.foreground)
        }
        .shadow(color: Ink.ink.opacity(0.15), radius: 4, y: 2)
    }
}

struct MapPinDetailSheet: View {
    let pin: MapEventPin
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                StatusBadge(status: pin.status)
                Text(pin.title)
                    .font(InkFont.headline(22))
                    .foregroundStyle(Ink.text)
                Text("Tap angles in Discover for full corroboration detail.")
                    .font(InkFont.body(15))
                    .foregroundStyle(Ink.textMuted)
                Spacer()
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Ink.bg.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }.foregroundStyle(Ink.primary)
                }
            }
        }
        .presentationDetents([.medium])
    }
}

#Preview {
    MapScreenView(focusTarget: .constant(nil))
}
