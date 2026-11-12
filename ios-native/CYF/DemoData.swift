import Foundation

enum DemoData {
    static let baseDate = Date()
    static func ago(days: Int, hour: Int = 9) -> Date {
        Calendar.current.date(bySettingHour: hour, minute: 15, second: 0,
            of: Calendar.current.date(byAdding: .day, value: -days, to: baseDate)!)!
    }

    static func plot(_ name: String, _ coordinates: [[Double]], spray: SprayApplication? = nil, trap: TrapMonitoring? = nil) -> Plot {
        let ring = coordinates.map { FieldCoordinate(latitude: $0[1], longitude: $0[0], accuracy: nil, altitude: nil, source: "geojson") }
        return Plot(id: UUID(), name: name, geometry: .init(polygons: [[ring]]), createdAt: ago(days: 30), source: "geojson", lastSprayedAt: spray?.appliedAt, sprayApplication: spray, trapMonitoring: trap)
    }

    static func spray(_ product: String, category: String, target: String, days: Int) -> SprayApplication {
        .init(product: product, category: category, target: target, appliedAt: ago(days: days, hour: 7), reentryHours: 24, harvestIntervalDays: 14, nextInspectionDays: 3)
    }

    static func trap(_ captured: Int, metric: String) -> TrapMonitoring {
        .init(pest: "Furão", metric: metric, captured: captured, traps: 10, checkedAt: ago(days: 1))
    }

    static func plots() -> [Plot] {
        [
            plot("Talhão 01 · Pera Norte", [[-47.4148,-22.5528],[-47.4088,-22.5526],[-47.4085,-22.5571],[-47.4145,-22.5573],[-47.4148,-22.5528]], spray: spray("Abamectina 18 EC", category: "Acaricida", target: "Ácaro da leprose", days: 0), trap: trap(2, metric: "Índice")),
            plot("Talhão 02 · Valência", [[-47.4081,-22.5526],[-47.4018,-22.5527],[-47.4016,-22.5573],[-47.4083,-22.5571],[-47.4081,-22.5526]], spray: spray("Enxofre 800 WG", category: "Acaricida", target: "Ácaros", days: 2), trap: trap(8, metric: "Volume")),
            plot("Talhão 03 · Hamlin Leste", [[-47.4009,-22.5529],[-47.3947,-22.5533],[-47.3949,-22.5578],[-47.4011,-22.5573],[-47.4009,-22.5529]], trap: trap(5, metric: "Volume")),
            plot("Talhão 04 · Natal Oeste", [[-47.4151,-22.5581],[-47.4087,-22.5579],[-47.4088,-22.5627],[-47.4148,-22.5629],[-47.4151,-22.5581]], spray: spray("Óleo mineral agrícola", category: "Inseticida", target: "Cochonilha", days: 1), trap: trap(4, metric: "Índice")),
            plot("Talhão 05 · Experimental Sul", [[-47.4080,-22.5580],[-47.4017,-22.5581],[-47.4016,-22.5628],[-47.4081,-22.5627],[-47.4080,-22.5580]], trap: trap(0, metric: "Índice")),
            plot("Talhão 06 · Ribeirão", [[-47.4009,-22.5583],[-47.3947,-22.5585],[-47.3952,-22.5630],[-47.4012,-22.5628],[-47.4009,-22.5583]], spray: spray("Cobre 500 WP", category: "Fungicida", target: "Doenças fúngicas", days: 1), trap: trap(1, metric: "Volume")),
            plot("Talhão 07 · Serra", [[-47.4146,-22.5636],[-47.4079,-22.5634],[-47.4075,-22.5682],[-47.4137,-22.5686],[-47.4146,-22.5636]], spray: spray("Deltametrina 25 EC", category: "Inseticida", target: "Furão dos citros", days: 5), trap: trap(11, metric: "Volume")),
            plot("Talhão 08 · Baixada", [[-47.4071,-22.5635],[-47.4002,-22.5636],[-47.3996,-22.5685],[-47.4066,-22.5682],[-47.4071,-22.5635]], spray: spray("Spirodiclofeno 240 SC", category: "Acaricida", target: "Ácaro da leprose", days: 0), trap: trap(6, metric: "Índice"))
        ]
    }

    static func records(plots: [Plot]) -> [InspectionRecord] {
        let points = [(-22.5542,-47.4125,3,0),(-22.5540,-47.4055,13,2),(-22.5545,-47.3983,8,1),(-22.5595,-47.4129,18,0),(-22.5603,-47.4050,0,2),(-22.5602,-47.3983,7,0),(-22.5650,-47.4112,4,1),(-22.5652,-47.4045,11,2)]
        return points.enumerated().map { index, item in
            let (lat, lon, count, image) = item
            let detections = (0..<count).map { number in
                Detection(classID: 0, className: "Ácaro", confidence: 0.97 - Double(number % 3) * 0.005,
                    box: .init(x1: Double(55 + (number % 5) * 102), y1: Double(62 + (number / 5) * 98), x2: Double(117 + (number % 5) * 102), y2: Double(120 + (number / 5) * 98)))
            }
            return InspectionRecord(id: UUID(), capturedAt: ago(days: index % 6, hour: 7 + index), imageName: "demo-inspection-\(image + 1).png", width: 640, height: 640, detections: detections, topConfidence: detections.first?.confidence ?? 0.18, location: .init(latitude: lat, longitude: lon, accuracy: 5, altitude: 579, source: "gps"), plotID: plots[index].id, mapVisible: true, source: index == 5 ? "gallery" : "camera", demo: true)
        }
    }
}
