import CoreLocation
import Foundation

enum GeoService {
    static func contains(_ geometry: PlotGeometry, coordinate: FieldCoordinate) -> Bool {
        geometry.polygons.contains { polygon in
            guard let outer = polygon.first, pointInRing(coordinate, ring: outer) else { return false }
            return !polygon.dropFirst().contains { pointInRing(coordinate, ring: $0) }
        }
    }

    static func findPlot(in plots: [Plot], coordinate: FieldCoordinate?) -> Plot? {
        guard let coordinate else { return nil }
        return plots.first { contains($0.geometry, coordinate: coordinate) }
    }

    private static func pointInRing(_ point: FieldCoordinate, ring: [FieldCoordinate]) -> Bool {
        guard ring.count >= 3 else { return false }
        var inside = false
        var previous = ring.count - 1
        for current in ring.indices {
            let a = ring[current]
            let b = ring[previous]
            let intersects = (a.latitude > point.latitude) != (b.latitude > point.latitude)
                && point.longitude < (b.longitude - a.longitude) * (point.latitude - a.latitude)
                    / ((b.latitude - a.latitude) == 0 ? 0.0000001 : (b.latitude - a.latitude)) + a.longitude
            if intersects { inside.toggle() }
            previous = current
        }
        return inside
    }

    static func circle(around center: FieldCoordinate, areaSquareMeters: Double, segments: Int = 36) -> PlotGeometry {
        let earthRadius = 6_378_137.0
        let radius = sqrt(areaSquareMeters / .pi)
        let latitudeRadians = center.latitude * .pi / 180
        var ring = (0..<segments).map { index -> FieldCoordinate in
            let angle = Double(index) / Double(segments) * .pi * 2
            let north = cos(angle) * radius
            let east = sin(angle) * radius
            return FieldCoordinate(
                latitude: center.latitude + north / earthRadius * 180 / .pi,
                longitude: center.longitude + east / (earthRadius * max(0.01, cos(latitudeRadians))) * 180 / .pi,
                accuracy: nil, altitude: nil, source: "estimated"
            )
        }
        if let first = ring.first { ring.append(first) }
        return .init(polygons: [[ring]])
    }

    static func drawn(_ points: [CLLocationCoordinate2D]) -> PlotGeometry? {
        guard points.count >= 3 else { return nil }
        var ring = points.map { FieldCoordinate(latitude: $0.latitude, longitude: $0.longitude, accuracy: nil, altitude: nil, source: "drawn") }
        if let first = ring.first { ring.append(first) }
        return .init(polygons: [[ring]])
    }

    static func areaHectares(_ geometry: PlotGeometry) -> Double {
        geometry.polygons.reduce(0) { total, polygon in
            guard let outer = polygon.first else { return total }
            let outerArea = abs(ringArea(outer))
            let holes = polygon.dropFirst().reduce(0) { $0 + abs(ringArea($1)) }
            return total + max(0, outerArea - holes) / 10_000
        }
    }

    private static func ringArea(_ ring: [FieldCoordinate]) -> Double {
        guard ring.count > 2 else { return 0 }
        let radius = 6_378_137.0
        var sum = 0.0
        for index in ring.indices {
            let current = ring[index]
            let next = ring[(index + 1) % ring.count]
            sum += (next.longitude - current.longitude) * .pi / 180
                * (2 + sin(current.latitude * .pi / 180) + sin(next.latitude * .pi / 180))
        }
        return sum * radius * radius / 2
    }

    static func centroid(_ plot: Plot) -> CLLocationCoordinate2D {
        let points = plot.geometry.polygons.first?.first ?? []
        guard !points.isEmpty else { return .init(latitude: -22.557, longitude: -47.405) }
        return .init(
            latitude: points.map(\.latitude).reduce(0, +) / Double(points.count),
            longitude: points.map(\.longitude).reduce(0, +) / Double(points.count)
        )
    }

    static func parseGeoJSON(data: Data) throws -> [Plot] {
        guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw GeoError.invalid }
        let features: [[String: Any]]
        if root["type"] as? String == "FeatureCollection" {
            features = root["features"] as? [[String: Any]] ?? []
        } else if root["type"] as? String == "Feature" {
            features = [root]
        } else {
            features = [["type": "Feature", "geometry": root, "properties": [:]]]
        }
        return try features.compactMap { feature in
            guard let geometry = feature["geometry"] as? [String: Any], let type = geometry["type"] as? String else { return nil }
            let polygons: [[[FieldCoordinate]]]
            if type == "Polygon", let raw = geometry["coordinates"] as? [[[Double]]] {
                polygons = [raw.map(convertRing)]
            } else if type == "MultiPolygon", let raw = geometry["coordinates"] as? [[[[Double]]]] {
                polygons = raw.map { $0.map(convertRing) }
            } else { return nil }
            let properties = feature["properties"] as? [String: Any]
            let name = (properties?["name"] ?? properties?["nome"] ?? properties?["talhao"]) as? String
            return Plot(id: UUID(), name: name ?? "Talhão importado", geometry: .init(polygons: polygons), createdAt: Date(), source: "geojson")
        }
    }

    private static func convertRing(_ raw: [[Double]]) -> [FieldCoordinate] {
        raw.compactMap { point in
            guard point.count >= 2 else { return nil }
            return FieldCoordinate(latitude: point[1], longitude: point[0], accuracy: nil, altitude: nil, source: "geojson")
        }
    }

    enum GeoError: LocalizedError {
        case invalid
        var errorDescription: String? { "O arquivo GeoJSON não é válido." }
    }
}
