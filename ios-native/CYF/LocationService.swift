import CoreLocation
import Foundation
import ImageIO

@MainActor
final class LocationService: NSObject, ObservableObject, CLLocationManagerDelegate {
    static let shared = LocationService()
    @Published private(set) var latest: FieldCoordinate?
    @Published private(set) var authorization: CLAuthorizationStatus = .notDetermined
    private let manager = CLLocationManager()
    private var continuation: CheckedContinuation<FieldCoordinate?, Never>?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = 2
        authorization = manager.authorizationStatus
    }

    func start() {
        if manager.authorizationStatus == .notDetermined { manager.requestWhenInUseAuthorization() }
        if manager.authorizationStatus == .authorizedWhenInUse || manager.authorizationStatus == .authorizedAlways {
            manager.startUpdatingLocation()
        }
    }

    func current() async -> FieldCoordinate? {
        start()
        if let latest, let timestamp = manager.location?.timestamp, Date().timeIntervalSince(timestamp) < 30 { return latest }
        return await withCheckedContinuation { continuation in
            self.continuation?.resume(returning: self.latest)
            self.continuation = continuation
            manager.requestLocation()
            Task { @MainActor in
                try? await Task.sleep(for: .seconds(8))
                guard self.continuation != nil else { return }
                self.continuation?.resume(returning: self.latest)
                self.continuation = nil
            }
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            authorization = manager.authorizationStatus
            if authorization == .authorizedWhenInUse || authorization == .authorizedAlways { manager.startUpdatingLocation() }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        Task { @MainActor in
            latest = FieldCoordinate(latitude: location.coordinate.latitude, longitude: location.coordinate.longitude,
                accuracy: location.horizontalAccuracy, altitude: location.altitude, source: "gps")
            continuation?.resume(returning: latest); continuation = nil
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in continuation?.resume(returning: latest); continuation = nil }
    }
}

enum ImageMetadata {
    static func exifCoordinate(from data: Data) -> FieldCoordinate? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let gps = properties[kCGImagePropertyGPSDictionary] as? [CFString: Any],
              let rawLatitude = gps[kCGImagePropertyGPSLatitude] as? Double,
              let rawLongitude = gps[kCGImagePropertyGPSLongitude] as? Double else { return nil }
        let latitude = (gps[kCGImagePropertyGPSLatitudeRef] as? String)?.uppercased() == "S" ? -abs(rawLatitude) : abs(rawLatitude)
        let longitude = (gps[kCGImagePropertyGPSLongitudeRef] as? String)?.uppercased() == "W" ? -abs(rawLongitude) : abs(rawLongitude)
        let altitude = gps[kCGImagePropertyGPSAltitude] as? Double
        return FieldCoordinate(latitude: latitude, longitude: longitude, accuracy: nil, altitude: altitude, source: "exif")
    }
}
