import Foundation
import SwiftUI

@MainActor
final class AppStore: ObservableObject {
    @Published var session: Session?
    @Published var records: [InspectionRecord] = []
    @Published var plots: [Plot] = []
    @Published var selectedTab: AppTab = .camera
    @Published var pendingInspectionID: UUID?
    @Published var selectedInspection: InspectionRecord?
    @Published var drawForInspectionID: UUID?

    private let encoder: JSONEncoder = {
        let value = JSONEncoder(); value.dateEncodingStrategy = .iso8601; value.outputFormatting = [.prettyPrinted, .sortedKeys]; return value
    }()
    private let decoder: JSONDecoder = {
        let value = JSONDecoder(); value.dateDecodingStrategy = .iso8601; return value
    }()

    init() { load() }

    var pendingInspection: InspectionRecord? { records.first { $0.id == pendingInspectionID } }

    func login(role: UserRole) {
        session = role == .admin
            ? Session(name: "Fernanda Almeida", email: "fernanda.almeida@cyf.app", role: .admin)
            : Session(name: "Marcos Oliveira", email: "inspecao@cyf.app", role: .inspection)
        selectedTab = role == .admin ? .dashboard : .camera
        persist()
    }

    func logout() { session = nil; selectedTab = .camera; persist() }

    func addInspection(_ record: InspectionRecord) {
        records.insert(record, at: 0)
        pendingInspectionID = record.id
        selectedTab = .map
        persist()
    }

    func updateInspection(_ record: InspectionRecord) {
        if let index = records.firstIndex(where: { $0.id == record.id }) { records[index] = record; persist() }
    }

    func deleteInspection(_ record: InspectionRecord) {
        records.removeAll { $0.id == record.id }
        if !record.demo { try? FileManager.default.removeItem(at: imageURL(for: record)) }
        persist()
    }

    func addPlot(_ plot: Plot, assigning inspectionID: UUID? = nil) {
        plots.append(plot)
        if let inspectionID, let index = records.firstIndex(where: { $0.id == inspectionID }) {
            records[index].plotID = plot.id; records[index].mapVisible = true
        }
        pendingInspectionID = nil; drawForInspectionID = nil
        persist()
    }

    func updatePlot(_ plot: Plot) {
        if let index = plots.firstIndex(where: { $0.id == plot.id }) { plots[index] = plot; persist() }
    }

    func deletePlot(_ plot: Plot) {
        plots.removeAll { $0.id == plot.id }
        for index in records.indices where records[index].plotID == plot.id { records[index].plotID = nil }
        persist()
    }

    func assignPending(to plot: Plot?) {
        guard let id = pendingInspectionID, let index = records.firstIndex(where: { $0.id == id }) else { return }
        records[index].plotID = plot?.id; records[index].mapVisible = true; pendingInspectionID = nil; persist()
    }

    func plot(for record: InspectionRecord) -> Plot? {
        if let id = record.plotID, let direct = plots.first(where: { $0.id == id }) { return direct }
        return GeoService.findPlot(in: plots, coordinate: record.location)
    }

    func activeCount(for plot: Plot) -> Int {
        let cutoff = plot.lastSprayedAt ?? .distantPast
        return records.filter { $0.plotID == plot.id && $0.capturedAt > cutoff }.reduce(0) { $0 + $1.confirmedCount }
    }

    func level(for plot: Plot) -> SeverityLevel {
        let count = activeCount(for: plot)
        return count == 0 ? .green : count <= 20 ? .yellow : .red
    }

    func imageURL(for record: InspectionRecord) -> URL {
        if record.demo, let url = Bundle.main.url(forResource: record.imageName.replacingOccurrences(of: ".png", with: ""), withExtension: "png") { return url }
        return Self.inspectionsDirectory.appendingPathComponent(record.imageName)
    }

    func saveImage(_ data: Data, id: UUID) throws -> String {
        try FileManager.default.createDirectory(at: Self.inspectionsDirectory, withIntermediateDirectories: true)
        let name = "\(id.uuidString).jpg"
        try data.write(to: Self.inspectionsDirectory.appendingPathComponent(name), options: .atomic)
        return name
    }

    private static var supportDirectory: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let url = base.appendingPathComponent("CYF", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }
    private static var inspectionsDirectory: URL { supportDirectory.appendingPathComponent("Inspections", isDirectory: true) }
    private var snapshotURL: URL { Self.supportDirectory.appendingPathComponent("snapshot.json") }

    private struct Snapshot: Codable { var session: Session?; var records: [InspectionRecord]; var plots: [Plot] }

    private func load() {
        if let data = try? Data(contentsOf: snapshotURL), let snapshot = try? decoder.decode(Snapshot.self, from: data) {
            session = snapshot.session; records = snapshot.records; plots = snapshot.plots
        }
        if plots.isEmpty {
            plots = DemoData.plots(); records = DemoData.records(plots: plots); persist()
        }
    }

    private func persist() {
        guard let data = try? encoder.encode(Snapshot(session: session, records: records, plots: plots)) else { return }
        try? data.write(to: snapshotURL, options: .atomic)
    }
}
