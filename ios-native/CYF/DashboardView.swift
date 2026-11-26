import Charts
import SwiftUI
import UIKit

struct DashboardScreen: View {
    @EnvironmentObject private var store: AppStore
    @State private var days = 30
    @State private var selectedPlotID: UUID?
    @State private var plotSearch = ""
    @State private var filtersOpen = false
    @State private var expanded = false
    @State private var includePests = true
    @State private var includeSprays = true
    @State private var includeTraps = true
    @State private var reportURL: URL?
    @State private var reportError: String?

    private var range: (Date, Date) { (Calendar.current.date(byAdding: .day, value: -days, to: Date())!, Date()) }
    private var filteredRecords: [InspectionRecord] {
        store.records.filter { $0.capturedAt >= range.0 && $0.capturedAt <= range.1 && (selectedPlotID == nil || $0.plotID == selectedPlotID) }
    }
    private var rows: [DashboardRow] {
        let previousStart = Calendar.current.date(byAdding: .day, value: -days * 2, to: Date())!
        let previousEnd = range.0
        return store.plots.filter { selectedPlotID == nil || $0.id == selectedPlotID }.map { plot in
            let current = filteredRecords.filter { $0.plotID == plot.id }
            let previous = store.records.filter { $0.plotID == plot.id && $0.capturedAt >= previousStart && $0.capturedAt < previousEnd }
            return DashboardRow(plot: plot, count: current.reduce(0) { $0 + $1.confirmedCount }, photos: current.count, previousCount: previous.reduce(0) { $0 + $1.confirmedCount })
        }.sorted { $0.count > $1.count }
    }
    private var total: Int { rows.reduce(0) { $0 + $1.count } }
    private var previousTotal: Int { rows.reduce(0) { $0 + $1.previousCount } }
    private var visibleRows: [DashboardRow] { expanded ? rows : Array(rows.prefix(4)) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 17) {
                    AppHeader(
                        title: "Relatórios",
                        subtitle: "Acompanhe o manejo por período e talhão.",
                        trailing: AnyView(
                            Button(action: exportPDF) {
                                Image(systemName: "square.and.arrow.up")
                                    .frame(width: 44, height: 44)
                                    .background(CYFColor.greenSoft, in: RoundedRectangle(cornerRadius: 13))
                            }.accessibilityLabel("Compartilhar relatório em PDF")
                        )
                    )
                    filterSummary
                    hero
                    HStack(spacing: 8) {
                        KPI(value: rows.filter { $0.count > 20 }.count, label: "talhões críticos")
                        KPI(value: reentryBlocked.count, label: "reentrada bloqueada")
                        KPI(value: dueInspections.count, label: "reinspeções vencidas")
                    }
                    if includePests { pestSection }
                    if includeSprays { spraySection }
                    if includeTraps { trapSection }
                    exportButton
                }.padding(.horizontal, 20).padding(.top, 18).padding(.bottom, 30)
            }.background(CYFColor.paper)
            .sheet(isPresented: $filtersOpen) { DashboardFilterSheet(days: $days, selectedPlotID: $selectedPlotID, search: $plotSearch, includePests: $includePests, includeSprays: $includeSprays, includeTraps: $includeTraps, plots: store.plots) }
            .sheet(isPresented: Binding(get: { reportURL != nil }, set: { if !$0 { reportURL = nil } })) {
                if let reportURL { ActivityView(items: [reportURL]) }
            }
            .alert("Relatório", isPresented: Binding(get: { reportError != nil }, set: { if !$0 { reportError = nil } })) { Button("OK") { reportError = nil } } message: { Text(reportError ?? "") }
        }
    }

    private var filterSummary: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 7) {
                ForEach([7, 14, 30, 90], id: \.self) { period in
                    Button { days = period } label: {
                        Text("\(period) dias").font(.caption.weight(.bold))
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .foregroundStyle(period == days ? Color.white : CYFColor.greenDark)
                            .background(period == days ? CYFColor.greenDark : CYFColor.greenSoft, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(period == days ? .isSelected : [])
                }
            }
            Button { filtersOpen = true } label: {
                HStack(spacing: 10) {
                    Image(systemName: "slider.horizontal.3")
                    Text(selectedPlotID.flatMap { id in store.plots.first { $0.id == id }?.name } ?? "Todos os talhões")
                        .lineLimit(1)
                    Spacer()
                    Image(systemName: "chevron.right").font(.caption.bold())
                }
                .font(.subheadline.bold()).foregroundStyle(CYFColor.greenDark)
                .frame(minHeight: 44).padding(.horizontal, 12)
                .background(CYFColor.soft, in: RoundedRectangle(cornerRadius: 12))
            }.buttonStyle(.plain)
        }.padding(13).cyfCard()
    }

    private var hero: some View {
        let delta = total - previousTotal
        let scale = max(1, total, previousTotal)
        return VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Visão geral").font(.headline).foregroundStyle(CYFColor.greenDark)
                    Text("\(total)").font(.system(size: 43, weight: .black)).monospacedDigit().foregroundStyle(CYFColor.ink)
                    Text("Detecções confirmadas").font(.subheadline.weight(.semibold)).foregroundStyle(CYFColor.muted)
                }
                Spacer()
                Text("\(delta > 0 ? "+" : "")\(delta) vs. anterior")
                    .font(.caption.weight(.bold)).foregroundStyle(CYFColor.orangeDark)
                    .padding(.horizontal, 9).padding(.vertical, 7)
                    .background(CYFColor.orangeSoft, in: Capsule())
            }
            VStack(spacing: 9) {
                comparisonBar("Atual", value: total, scale: scale, color: CYFColor.green)
                comparisonBar("Anterior", value: previousTotal, scale: scale, color: CYFColor.orange)
            }
        }.padding(17).cyfCard()
    }

    private func comparisonBar(_ title: String, value: Int, scale: Int, color: Color) -> some View {
        HStack(spacing: 9) {
            Text(title).font(.caption.weight(.semibold)).frame(width: 49, alignment: .leading)
            GeometryReader { frame in
                Capsule().fill(CYFColor.soft).overlay(alignment: .leading) {
                    Capsule().fill(color).frame(width: frame.size.width * CGFloat(value) / CGFloat(scale))
                }
            }.frame(height: 8).accessibilityHidden(true)
            Text("\(value)").font(.caption.bold()).monospacedDigit().frame(minWidth: 25, alignment: .trailing)
        }
        .foregroundStyle(CYFColor.ink)
        .accessibilityElement(children: .combine)
    }

    private var pestSection: some View {
        let chartRows = rows.filter { $0.count > 0 }
        let palette = [CYFColor.green, CYFColor.orange, CYFColor.yellow, CYFColor.red, CYFColor.greenDark]
        return VStack(alignment: .leading, spacing: 13) {
            CardTitle(title: "Distribuição por talhão", subtitle: "Contagem, inspeções e variação.", icon: "chart.pie.fill")
            if !chartRows.isEmpty {
                Chart(chartRows.indices, id: \.self) { index in
                    SectorMark(angle: .value("Detecções", chartRows[index].count), innerRadius: .ratio(0.67), angularInset: 1.4)
                        .foregroundStyle(palette[index % palette.count])
                        .cornerRadius(3)
                }
                .chartLegend(.hidden).frame(height: 178).accessibilityHidden(true)
                .overlay {
                    VStack(spacing: 2) {
                        Text("\(total)").font(.title.bold()).foregroundStyle(CYFColor.ink)
                        Text("detecções").font(.caption.weight(.semibold)).foregroundStyle(CYFColor.muted)
                    }
                }
            } else {
                Text("Nenhuma detecção no período.").font(.subheadline).foregroundStyle(CYFColor.muted)
            }
            ForEach(visibleRows) { row in
                let colorIndex = chartRows.firstIndex { $0.id == row.id }
                HStack(spacing: 10) {
                    Circle()
                        .fill(colorIndex.map { palette[$0 % palette.count] } ?? CYFColor.lineStrong)
                        .frame(width: 9, height: 9).accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(row.plot.name).font(.subheadline.bold())
                        Text("\(row.photos) vistoria(s) · \(row.photos == 0 ? "Sem vistoria" : severityLabel(row.count))")
                            .font(.caption).foregroundStyle(CYFColor.muted)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 3) {
                        Text("\(row.count)").font(.headline.monospacedDigit())
                        Text("\(row.delta > 0 ? "+" : "")\(row.delta)")
                            .font(.caption.bold()).foregroundStyle(row.delta > 0 ? CYFColor.red : CYFColor.green)
                            .accessibilityLabel("Variação de \(row.delta) detecções")
                    }
                }
                .padding(10)
                .background(CYFColor.paper, in: RoundedRectangle(cornerRadius: 12))
            }
            if rows.count > 4 {
                Button(expanded ? "Mostrar menos talhões" : "Mostrar todos os talhões") {
                    withAnimation { expanded.toggle() }
                }
                .font(.subheadline.bold()).frame(maxWidth: .infinity, minHeight: 44)
            }
        }.padding(17).cyfCard()
    }

    private var spraySection: some View {
        VStack(alignment: .leading, spacing: 13) {
            CardTitle(title: "Pulverização e carência", subtitle: "Produto, reentrada, colheita e próxima vistoria.", icon: "drop.degreesign")
            ForEach(sprayPlots.prefix(expanded ? sprayPlots.count : 3)) { plot in
                VStack(alignment: .leading, spacing: 6) {
                    HStack { Text(plot.name).font(.subheadline.bold()); Spacer(); Text(plot.sprayApplication?.category ?? "").font(.caption.bold()).foregroundStyle(CYFColor.green) }
                    Text("\(plot.sprayApplication?.product ?? "") · alvo: \(plot.sprayApplication?.target ?? "")").font(.caption).foregroundStyle(CYFColor.muted)
                    HStack { Deadline(label: "Aplicado", date: plot.sprayApplication?.appliedAt); Deadline(label: "Reentrada", date: plot.sprayApplication.map { Calendar.current.date(byAdding: .hour, value: $0.reentryHours, to: $0.appliedAt)! }); Deadline(label: "Colheita", date: plot.sprayApplication.map { Calendar.current.date(byAdding: .day, value: $0.harvestIntervalDays, to: $0.appliedAt)! }) }
                }.padding(.vertical, 8)
                Divider()
            }
            if sprayPlots.isEmpty { Text("Nenhuma aplicação registrada.").foregroundStyle(CYFColor.muted) }
        }.padding(17).cyfCard()
    }

    private var trapSection: some View {
        VStack(alignment: .leading, spacing: 13) {
            CardTitle(title: "Armadilhas de furão", subtitle: "Leituras separadas por índice e volume capturado.", icon: "scope")
            HStack { KPI(value: trapPlots.filter { $0.trapMonitoring?.metric == "Índice" }.reduce(0) { $0 + ($1.trapMonitoring?.captured ?? 0) }, label: "índice"); KPI(value: trapPlots.filter { $0.trapMonitoring?.metric == "Volume" }.reduce(0) { $0 + ($1.trapMonitoring?.captured ?? 0) }, label: "volume") }
            ForEach(trapPlots.prefix(expanded ? trapPlots.count : 3)) { plot in HStack { VStack(alignment: .leading) { Text(plot.name).font(.subheadline.bold()); Text("\(plot.trapMonitoring?.traps ?? 0) armadilhas · \(plot.trapMonitoring?.metric ?? "")").font(.caption).foregroundStyle(CYFColor.muted) }; Spacer(); Text("\(plot.trapMonitoring?.captured ?? 0)").font(.title3.bold()).foregroundStyle(CYFColor.orange) }.padding(.vertical, 5) }
        }.padding(17).cyfCard()
    }

    private var exportButton: some View {
        Button { exportPDF() } label: { Label("Extrair relatório completo em PDF", systemImage: "doc.richtext.fill") }.buttonStyle(PillButtonStyle(color: CYFColor.orange))
    }

    private var sprayPlots: [Plot] { store.plots.filter { $0.sprayApplication != nil && (selectedPlotID == nil || $0.id == selectedPlotID) } }
    private var trapPlots: [Plot] { store.plots.filter { $0.trapMonitoring != nil && (selectedPlotID == nil || $0.id == selectedPlotID) } }
    private var reentryBlocked: [Plot] { sprayPlots.filter { plot in guard let spray = plot.sprayApplication else { return false }; return Calendar.current.date(byAdding: .hour, value: spray.reentryHours, to: spray.appliedAt)! > Date() } }
    private var dueInspections: [Plot] { sprayPlots.filter { plot in guard let spray = plot.sprayApplication else { return false }; return Calendar.current.date(byAdding: .day, value: spray.nextInspectionDays, to: spray.appliedAt)! <= Date() } }
    private func severityLabel(_ count: Int) -> String { count == 0 ? "Sem ocorrência" : count <= 20 ? "Atenção" : "Crítico" }
    private func exportPDF() { do { reportURL = try PDFReportService.generate(records: filteredRecords, plots: store.plots, rows: rows, from: range.0, to: range.1, imageURL: store.imageURL) } catch { reportError = error.localizedDescription } }
}

private struct KPI: View {
    let value: Int; let label: String
    var body: some View { VStack(alignment: .leading, spacing: 3) { Text("\(value)").font(.title3.bold()).foregroundStyle(CYFColor.ink); Text(label).font(.caption2.weight(.semibold)).foregroundStyle(CYFColor.muted).lineLimit(2) }.frame(maxWidth: .infinity, minHeight: 58, alignment: .leading).padding(10).background(CYFColor.soft).clipShape(RoundedRectangle(cornerRadius: 15)) }
}
private struct CardTitle: View {
    let title: String; let subtitle: String; let icon: String
    var body: some View { HStack { Image(systemName: icon).foregroundStyle(CYFColor.green).frame(width: 40, height: 40).background(CYFColor.greenSoft).clipShape(RoundedRectangle(cornerRadius: 13)); VStack(alignment: .leading) { Text(title).font(.headline); Text(subtitle).font(.caption).foregroundStyle(CYFColor.muted) }; Spacer() } }
}
private struct Deadline: View {
    let label: String; let date: Date?
    var body: some View { VStack(alignment: .leading) { Text(label.uppercased()).font(.system(size: 7, weight: .heavy)).foregroundStyle(CYFColor.muted); Text(date?.formatted(.dateTime.day().month()) ?? "—").font(.caption2.bold()) }.frame(maxWidth: .infinity, alignment: .leading) }
}

private struct DashboardFilterSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var days: Int; @Binding var selectedPlotID: UUID?; @Binding var search: String
    @Binding var includePests: Bool; @Binding var includeSprays: Bool; @Binding var includeTraps: Bool
    let plots: [Plot]
    private var searched: [Plot] { plots.filter { search.isEmpty || $0.name.localizedCaseInsensitiveContains(search) } }
    var body: some View {
        NavigationStack { Form {
            Section("Período") { Picker("Dias", selection: $days) { Text("7 dias").tag(7); Text("14 dias").tag(14); Text("30 dias").tag(30); Text("90 dias").tag(90) }.pickerStyle(.segmented) }
            Section("Talhão") { TextField("Buscar talhão pelo nome", text: $search); Picker("Selecionar", selection: $selectedPlotID) { Text("Todos").tag(UUID?.none); ForEach(searched) { Text($0.name).tag(Optional($0.id)) } } }
            Section("Incluir") { Toggle("Pragas", isOn: $includePests); Toggle("Pulverização", isOn: $includeSprays); Toggle("Armadilhas", isOn: $includeTraps) }
            if selectedPlotID != nil || !search.isEmpty { Section { Button(role: .destructive) { selectedPlotID = nil; search = "" } label: { Label("Limpar filtro de talhão", systemImage: "line.3.horizontal.decrease.circle") } } }
        }.navigationTitle("Montar relatório").toolbar { Button("Concluir") { dismiss() } } }
    }
}

private struct ActivityView: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController { UIActivityViewController(activityItems: items, applicationActivities: nil) }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) { }
}
