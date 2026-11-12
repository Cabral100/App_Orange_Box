import UIKit

enum PDFReportService {
    static func generate(records: [InspectionRecord], plots: [Plot], rows: [DashboardRow], from: Date, to: Date, imageURL: (InspectionRecord) -> URL) throws -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("Relatorio-CYF-\(Int(Date().timeIntervalSince1970)).pdf")
        let format = UIGraphicsPDFRendererFormat(); format.documentInfo = [kCGPDFContextTitle as String: "Relatório completo CYF", kCGPDFContextAuthor as String: "Clean Your Farm"]
        let bounds = CGRect(x: 0, y: 0, width: 595, height: 842)
        let renderer = UIGraphicsPDFRenderer(bounds: bounds, format: format)
        try renderer.writePDF(to: url) { context in
            var page = PDFPage(context: context, bounds: bounds)
            page.begin(title: "Relatório de campo", subtitle: "Fazenda Boa Esperança · \(date(from)) a \(date(to))")
            page.heading("Resumo executivo")
            page.line("Detecções confirmadas", "\(rows.reduce(0) { $0 + $1.count })")
            page.line("Inspeções no período", "\(records.count)")
            page.line("Talhões monitorados", "\(plots.count)")
            page.heading("Extrato por talhão")
            rows.forEach { page.wrapped("\($0.plot.name) — \($0.count) detecções, \($0.photos) inspeções, variação \($0.delta >= 0 ? "+" : "")\($0.delta)") }
            page.heading("Inspeções detalhadas")
            for record in records.sorted(by: { $0.capturedAt > $1.capturedAt }) {
                let plot = plots.first { $0.id == record.plotID }?.name ?? "Sem talhão"
                let coords = record.location.map { String(format: "%.6f, %.6f (%@)", $0.latitude, $0.longitude, $0.source.uppercased()) } ?? "Não disponível"
                page.ensure(130)
                if let image = UIImage(contentsOfFile: imageURL(record).path) { page.image(image, size: CGSize(width: 78, height: 78)) }
                page.wrapped("\(plot) · \(record.capturedAt.formatted(date: .long, time: .shortened))")
                page.wrapped("Origem: \(record.source) · Coordenadas: \(coords)")
                page.wrapped("Detecções confirmadas: \(record.confirmedCount) · Confiança máxima: \(Int(record.topConfidence * 100))%")
                let classes = Set(record.detections.map(\.className)).sorted().joined(separator: ", ")
                page.wrapped("Classes: \(classes.isEmpty ? "Nenhuma" : classes)")
                page.separator()
            }
            page.heading("Pulverização, reentrada e carência")
            for plot in plots where plot.sprayApplication != nil {
                let spray = plot.sprayApplication!
                let reentry = Calendar.current.date(byAdding: .hour, value: spray.reentryHours, to: spray.appliedAt)!
                let harvest = Calendar.current.date(byAdding: .day, value: spray.harvestIntervalDays, to: spray.appliedAt)!
                let inspection = Calendar.current.date(byAdding: .day, value: spray.nextInspectionDays, to: spray.appliedAt)!
                page.wrapped("\(plot.name): \(spray.product) [\(spray.category)] · alvo \(spray.target)")
                page.wrapped("Aplicado \(date(spray.appliedAt)) · reentrada \(date(reentry)) · colheita \(date(harvest)) · reinspeção \(date(inspection))")
                page.separator()
            }
            page.heading("Placas e armadilhas de furão")
            for plot in plots where plot.trapMonitoring != nil {
                let trap = plot.trapMonitoring!
                page.wrapped("\(plot.name): \(trap.captured) capturados · \(trap.traps) armadilhas · métrica \(trap.metric) · leitura \(date(trap.checkedAt))")
            }
            page.footer()
        }
        return url
    }

    private static func date(_ date: Date) -> String { date.formatted(.dateTime.day().month().year().locale(Locale(identifier: "pt_BR"))) }
}

private final class PDFPage {
    let context: UIGraphicsPDFRendererContext; let bounds: CGRect; var y: CGFloat = 42; var pageNumber = 0
    init(context: UIGraphicsPDFRendererContext, bounds: CGRect) { self.context = context; self.bounds = bounds }
    func begin(title: String, subtitle: String) { context.beginPage(); pageNumber += 1; y = 42; text("CYF · CLEAN YOUR FARM", size: 10, weight: .bold, color: UIColor(red: 0.05, green: 0.42, blue: 0.25, alpha: 1)); text(title, size: 26, weight: .bold); text(subtitle, size: 11, color: .darkGray); y += 10 }
    func ensure(_ height: CGFloat) { if y + height > bounds.height - 50 { footer(); begin(title: "Relatório de campo", subtitle: "Continuação") } }
    func heading(_ value: String) { ensure(55); y += 12; text(value, size: 16, weight: .bold, color: UIColor(red: 0.03, green: 0.31, blue: 0.19, alpha: 1)); y += 5 }
    func line(_ label: String, _ value: String) { ensure(28); text("\(label): \(value)", size: 11, weight: .semibold) }
    func wrapped(_ value: String) { ensure(40); let rect = CGRect(x: 42, y: y, width: bounds.width - 84, height: 80); let attributes: [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 10.5), .foregroundColor: UIColor.darkText]; let size = (value as NSString).boundingRect(with: rect.size, options: [.usesLineFragmentOrigin], attributes: attributes, context: nil); (value as NSString).draw(in: CGRect(origin: rect.origin, size: size.size), withAttributes: attributes); y += size.height + 7 }
    func separator() { UIColor(white: 0.86, alpha: 1).setFill(); UIBezierPath(rect: CGRect(x: 42, y: y, width: bounds.width - 84, height: 1)).fill(); y += 9 }
    func image(_ image: UIImage, size: CGSize) { ensure(size.height + 8); image.draw(in: CGRect(x: bounds.width - 42 - size.width, y: y, width: size.width, height: size.height)); y += size.height + 6 }
    func footer() { let value = "Gerado em \(Date().formatted(date: .abbreviated, time: .shortened)) · página \(pageNumber)"; (value as NSString).draw(at: CGPoint(x: 42, y: bounds.height - 30), withAttributes: [.font: UIFont.systemFont(ofSize: 8), .foregroundColor: UIColor.gray]) }
    private func text(_ value: String, size: CGFloat, weight: UIFont.Weight = .regular, color: UIColor = .darkText) { (value as NSString).draw(at: CGPoint(x: 42, y: y), withAttributes: [.font: UIFont.systemFont(ofSize: size, weight: weight), .foregroundColor: color]); y += size + 7 }
}
