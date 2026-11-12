import CoreLocation
import Foundation

enum UserRole: String, Codable, CaseIterable, Identifiable {
    case inspection
    case admin
    var id: String { rawValue }
    var title: String { self == .admin ? "Administrador" : "Inspeção" }
}

struct Session: Codable, Equatable {
    var name: String
    var email: String
    var role: UserRole
}

struct FieldCoordinate: Codable, Hashable {
    var latitude: Double
    var longitude: Double
    var accuracy: Double?
    var altitude: Double?
    var source: String

    var clCoordinate: CLLocationCoordinate2D { .init(latitude: latitude, longitude: longitude) }
}

struct BoundingBox: Codable, Hashable {
    var x1: Double
    var y1: Double
    var x2: Double
    var y2: Double
}

struct Detection: Codable, Hashable, Identifiable {
    var id = UUID()
    var classID: Int
    var className: String
    var confidence: Double
    var box: BoundingBox

    enum CodingKeys: String, CodingKey { case id, classID, className, confidence, box }
}

struct InspectionRecord: Codable, Identifiable, Hashable {
    var id: UUID
    var capturedAt: Date
    var imageName: String
    var width: Double
    var height: Double
    var detections: [Detection]
    var topConfidence: Double
    var location: FieldCoordinate?
    var plotID: UUID?
    var mapVisible: Bool
    var source: String
    var demo: Bool

    var confirmedDetections: [Detection] { detections.filter { $0.confidence >= 0.95 } }
    var confirmedCount: Int { confirmedDetections.count }
}

struct PlotGeometry: Codable, Hashable {
    /// GeoJSON order represented as coordinate rings grouped by polygon.
    var polygons: [[[FieldCoordinate]]]
}

struct SprayApplication: Codable, Hashable {
    var product: String
    var category: String
    var target: String
    var appliedAt: Date
    var reentryHours: Int
    var harvestIntervalDays: Int
    var nextInspectionDays: Int
}

struct TrapMonitoring: Codable, Hashable {
    var pest: String
    var metric: String
    var captured: Int
    var traps: Int
    var checkedAt: Date
}

struct Plot: Codable, Identifiable, Hashable {
    var id: UUID
    var name: String
    var geometry: PlotGeometry
    var createdAt: Date
    var source: String
    var lastSprayedAt: Date?
    var sprayApplication: SprayApplication?
    var trapMonitoring: TrapMonitoring?
}

enum AppTab: Hashable {
    case camera, map, history, dashboard, account
}

enum SeverityLevel: String, CaseIterable, Identifiable {
    case green, yellow, red
    var id: String { rawValue }
    var title: String {
        switch self { case .green: "Verde"; case .yellow: "Amarelo"; case .red: "Vermelho" }
    }
}

struct DashboardRow: Identifiable {
    let plot: Plot
    let count: Int
    let photos: Int
    let previousCount: Int
    var id: UUID { plot.id }
    var delta: Int { count - previousCount }
}
