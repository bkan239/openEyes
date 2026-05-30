import Combine
import CoreLocation
import MapKit
import SwiftUI

struct MapScreenView: View {
    @Binding var focusTarget: MapFocusTarget?

    @State private var position = MapCameraPosition.region(
        MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 47.3769, longitude: 8.5417),
            span: MKCoordinateSpan(latitudeDelta: 0.08, longitudeDelta: 0.08)
        )
    )
    @State private var lastCamera: MapCamera?
    @State private var fromDate = Calendar.current.date(byAdding: .month, value: -1, to: Date())!
    @State private var toDate = Date()
    @State private var mapLoaded = false
    @State private var isSearching = false
    @State private var searchText = ""
    @State private var is3DMode = false
    @StateObject private var locationManager = MapLocationManager()
    @StateObject private var searchCompleter = LocationSearchCompleter()
    @FocusState private var searchFocused: Bool

    private var filteredPins: [MapEventPin] {
        MockData.mapPins.filter { $0.date >= fromDate && $0.date <= toDate }
    }

    var body: some View {
        ZStack {
            mapLayer

            if !mapLoaded {
                mapLoadingOverlay
                    .transition(.opacity)
            }

            VStack(spacing: 0) {
                topOverlay
                    .background(topOverlayBackground)
                Spacer()
                bottomOverlay
            }
        }
        .onAppear {
            applyFocusTargetIfNeeded(focusTarget)
        }
        .onChange(of: focusTarget) { _, target in
            applyFocusTargetIfNeeded(target)
        }
        .ignoresSafeArea(.keyboard)
    }

    private var topOverlayBackground: some View {
        LinearGradient(
            colors: [Ink.ink.opacity(isSearching ? 0.88 : 0.72), Ink.ink.opacity(0)],
            startPoint: .top,
            endPoint: .bottom
        )
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }

    private var mapLayer: some View {
        Map(position: $position) {
            ForEach(filteredPins) { pin in
                Annotation("", coordinate: pin.coordinate, anchor: .bottom) {
                    MapPinView(status: pin.status, isSelected: false)
                }
            }
        }
        .mapStyle(.standard(
            elevation: is3DMode ? .realistic : .flat,
            pointsOfInterest: .excludingAll,
            showsTraffic: false
        ))
        .mapControls {}
        .ignoresSafeArea()
        .onMapCameraChange { context in
            lastCamera = context.camera
            if !mapLoaded {
                withAnimation(.easeOut(duration: 0.4)) { mapLoaded = true }
            }
        }
    }

    private var mapLoadingOverlay: some View {
        ZStack {
            Ink.ink.ignoresSafeArea()
            VStack(spacing: 16) {
                ProgressView()
                    .scaleEffect(1.4)
                    .tint(Ink.primaryOnInk)
                Text("Loading Map…")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Ink.onInkMuted)
            }
        }
    }

    private var topOverlay: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                if isSearching {
                    HStack(spacing: 8) {
                        Image(systemName: "magnifyingglass")
                            .foregroundStyle(Ink.onInkMuted)
                            .font(.system(size: 16))
                        TextField("Search locations…", text: $searchText)
                            .font(InkFont.body(15))
                            .foregroundStyle(Ink.onInk)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                            .focused($searchFocused)
                            .onChange(of: searchText) { _, value in
                                searchCompleter.search(value)
                            }
                        if !searchText.isEmpty {
                            Button { searchText = "" } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundStyle(Ink.onInkMuted)
                            }
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(Ink.onInk.opacity(0.15))
                    )

                    Button("Cancel") {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                            isSearching = false
                            searchText = ""
                            searchCompleter.clear()
                            searchFocused = false
                        }
                    }
                    .foregroundStyle(Ink.onInk)
                    .font(.system(size: 15, weight: .medium))
                } else {
                    Text("Map")
                        .font(InkFont.title())
                        .foregroundStyle(Ink.onInk)
                    Spacer()
                    Button {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                            isSearching = true
                            searchFocused = true
                        }
                    } label: {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(Ink.onInk)
                            .frame(width: 40, height: 40)
                            .background(Circle().fill(Ink.onInk.opacity(0.15)))
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 10)
            .padding(.bottom, 8)

            if isSearching && !searchCompleter.results.isEmpty {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(searchCompleter.results, id: \.self) { completion in
                            Button { selectCompletion(completion) } label: {
                                HStack(spacing: 12) {
                                    Image(systemName: "mappin")
                                        .foregroundStyle(Ink.onInkMuted)
                                        .frame(width: 20)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(completion.title)
                                            .font(.system(size: 15, weight: .medium))
                                            .foregroundStyle(Ink.onInk)
                                        if !completion.subtitle.isEmpty {
                                            Text(completion.subtitle)
                                                .font(.system(size: 12))
                                                .foregroundStyle(Ink.onInkMuted)
                                                .lineLimit(1)
                                        }
                                    }
                                    Spacer()
                                }
                                .padding(.horizontal, 16)
                                .padding(.vertical, 12)
                            }
                            Divider().background(Ink.onInk.opacity(0.1))
                        }
                    }
                }
                .frame(height: min(CGFloat(searchCompleter.results.count) * 56, 320))
                .background(.ultraThinMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .padding(.horizontal, 16)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }

            Spacer()
        }
    }

    private var bottomOverlay: some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                VStack(spacing: 10) {
                    Button {
                        locationManager.requestIfNeeded()
                        withAnimation {
                            position = .userLocation(fallback: .automatic)
                        }
                    } label: {
                        Image(systemName: "location.fill")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Ink.ink)
                            .frame(width: 44, height: 44)
                            .background(
                                Circle()
                                    .fill(Ink.surface)
                                    .shadow(color: Ink.ink.opacity(0.25), radius: 6, y: 2)
                            )
                    }

                    Button { toggle3DMode() } label: {
                        Text(is3DMode ? "2D" : "3D")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Ink.ink)
                            .frame(width: 44, height: 44)
                            .background(
                                Circle()
                                    .fill(Ink.surface)
                                    .shadow(color: Ink.ink.opacity(0.25), radius: 6, y: 2)
                            )
                    }
                }
                .padding(.trailing, 16)
                .padding(.bottom, 12)
            }

            HStack(spacing: 8) {
                MapDatePickerButton(date: $fromDate, range: nil, upperBound: toDate)
                Image(systemName: "arrow.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Ink.onInkMuted)
                MapDatePickerButton(date: $toDate, range: fromDate, upperBound: nil)
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 10)
            .padding(.bottom, 14)
            .background(
                Rectangle()
                    .fill(.ultraThinMaterial)
                    .mask(
                        LinearGradient(
                            colors: [.clear, Ink.ink],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
            )
        }
    }

    private func selectCompletion(_ completion: MKLocalSearchCompletion) {
        let request = MKLocalSearch.Request(completion: completion)
        MKLocalSearch(request: request).start { response, _ in
            guard let item = response?.mapItems.first else { return }
            let coord = item.placemark.coordinate

            let span: MKCoordinateSpan
            if let circular = item.placemark.region as? CLCircularRegion {
                let degrees = (circular.radius / 111_000) * 2.5
                let clamped = min(max(degrees, 0.02), 100.0)
                span = MKCoordinateSpan(latitudeDelta: clamped, longitudeDelta: clamped)
            } else {
                span = MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)
            }

            withAnimation(.easeInOut(duration: 0.6)) {
                position = .region(MKCoordinateRegion(center: coord, span: span))
                isSearching = false
                searchText = ""
                searchCompleter.clear()
                searchFocused = false
            }
        }
    }

    private func applyFocusTargetIfNeeded(_ target: MapFocusTarget?) {
        guard let target else { return }
        let region = MKCoordinateRegion(
            center: target.coordinate,
            span: MKCoordinateSpan(latitudeDelta: target.span, longitudeDelta: target.span)
        )
        withAnimation(.easeInOut(duration: 0.6)) {
            position = .region(region)
        }
        focusTarget = nil
    }

    private func toggle3DMode() {
        let nextValue = !is3DMode
        is3DMode = nextValue

        withAnimation(.easeInOut(duration: 0.4)) {
            if let camera = lastCamera {
                position = .camera(
                    MapCamera(
                        centerCoordinate: camera.centerCoordinate,
                        distance: max(camera.distance, 250),
                        heading: camera.heading,
                        pitch: nextValue ? 60 : 0
                    )
                )
            } else if let region = position.region {
                let approxDistance = max(region.span.latitudeDelta * 111_000 * 1.8, 350)
                position = .camera(
                    MapCamera(
                        centerCoordinate: region.center,
                        distance: approxDistance,
                        heading: 0,
                        pitch: nextValue ? 60 : 0
                    )
                )
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
                .frame(width: isSelected ? 36 : 30, height: isSelected ? 36 : 30)
                .overlay(Circle().stroke(status.foreground, lineWidth: isSelected ? 2.5 : 2))
            Image(systemName: "video.fill")
                .font(.system(size: isSelected ? 12 : 10, weight: .semibold))
                .foregroundStyle(status.foreground)
        }
        .shadow(color: Ink.ink.opacity(0.18), radius: 3, y: 1)
    }
}

// MARK: - Map helpers

struct MapDatePickerButton: View {
    @Binding var date: Date
    var range: Date?
    var upperBound: Date?
    @State private var showPicker = false

    private static let formatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "dd.MM.yy  HH:mm"
        return formatter
    }()

    var body: some View {
        Button { showPicker = true } label: {
            Text(Self.formatter.string(from: date))
                .font(.system(size: 17, weight: .semibold).monospacedDigit())
                .foregroundStyle(Ink.onInk)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(Capsule().fill(Ink.onInk.opacity(0.15)))
        }
        .popover(isPresented: $showPicker) {
            NavigationStack {
                Group {
                    if let lower = range, let upper = upperBound {
                        DatePicker("", selection: $date, in: lower...upper, displayedComponents: [.date, .hourAndMinute])
                    } else if let lower = range {
                        DatePicker("", selection: $date, in: lower..., displayedComponents: [.date, .hourAndMinute])
                    } else if let upper = upperBound {
                        DatePicker("", selection: $date, in: ...upper, displayedComponents: [.date, .hourAndMinute])
                    } else {
                        DatePicker("", selection: $date, displayedComponents: [.date, .hourAndMinute])
                    }
                }
                .labelsHidden()
                .datePickerStyle(.graphical)
                .colorScheme(.dark)
                .accentColor(Ink.primary)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { showPicker = false }
                            .foregroundStyle(Ink.primary)
                    }
                }
            }
            .presentationDetents([.height(520)])
            .presentationBackground(Ink.ink)
        }
    }
}

final class MapLocationManager: NSObject, ObservableObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
    }

    func requestIfNeeded() {
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            manager.startUpdatingLocation()
        default:
            break
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        if manager.authorizationStatus == .authorizedWhenInUse ||
            manager.authorizationStatus == .authorizedAlways {
            manager.startUpdatingLocation()
        }
    }
}

final class LocationSearchCompleter: NSObject, ObservableObject, MKLocalSearchCompleterDelegate {
    @Published var results: [MKLocalSearchCompletion] = []
    private let completer = MKLocalSearchCompleter()

    override init() {
        super.init()
        completer.delegate = self
        completer.resultTypes = [.address, .pointOfInterest, .query]
    }

    func search(_ text: String) {
        guard !text.trimmingCharacters(in: .whitespaces).isEmpty else {
            results = []
            return
        }
        completer.queryFragment = text
    }

    func clear() {
        completer.queryFragment = ""
        results = []
    }

    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        results = completer.results
    }

    func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {}
}

#Preview {
    MapScreenView(focusTarget: .constant(nil))
}
