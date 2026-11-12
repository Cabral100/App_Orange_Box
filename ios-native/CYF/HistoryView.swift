import SwiftUI
import UIKit

struct HistoryScreen: View {
    @EnvironmentObject private var store: AppStore
    @State private var filtersOpen = false
    @State private var days = 14
    @State private var dayPart = "all"
    @State private var plotFilter: UUID?
    @State private var levelFilter: SeverityLevel?
    @State private var search = ""
    @State private var deleteTarget: InspectionRecord?

    private var filtered: [InspectionRecord] {
        let calendar = Calendar.current
        let cutoff = days == 0 ? calendar.startOfDay(for: Date()) : Date().addingTimeInterval(Double(-days) * 86_400)
        return store.records.filter { record in
            guard record.capturedAt >= cutoff else { return false }
            if days == 0 && dayPart != "all" {
                let hour = calendar.component(.hour, from: record.capturedAt)
                if dayPart == "morning" && hour >= 12 { return false }
                if dayPart == "afternoon" && hour < 12 { return false }
            }
            if let plotFilter, record.plotID != plotFilter { return false }
            if let levelFilter {
                let level: SeverityLevel = record.confirmedCount == 0 ? .green : record.confirmedCount <= 20 ? .yellow : .red
                if level != levelFilter { return false }
            }
            return true
        }.sorted { $0.capturedAt > $1.capturedAt }
    }

    private var groups: [(String, [InspectionRecord])] {
        let grouped = Dictionary(grouping: filtered) { dayLabel($0.capturedAt) }
        return grouped.sorted { ($0.value.first?.capturedAt ?? .distantPast) > ($1.value.first?.capturedAt ?? .distantPast) }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    AppHeader(title: "Histórico", trailing: store.session?.role == .admin ? AnyView(Button { store.selectedTab = .dashboard } label: { Label("Relatórios", systemImage: "chart.pie.fill").font(.caption.bold()).foregroundStyle(.white).padding(.horizontal, 13).frame(height: 45).background(CYFColor.orange).clipShape(Capsule()) }) : nil)
                    HStack {
                        Button { filtersOpen = true } label: { Label(filterSummary, systemImage: "line.3.horizontal.decrease").font(.subheadline.bold()).foregroundStyle(CYFColor.green).padding(.horizontal, 13).frame(height: 46).background(Color.white).clipShape(RoundedRectangle(cornerRadius: 15)).overlay(RoundedRectangle(cornerRadius: 15).stroke(CYFColor.lineStrong)) }
                        Spacer(); Text("\(filtered.count) registro(s)").font(.caption.weight(.semibold)).foregroundStyle(CYFColor.muted)
                    }
                    if groups.isEmpty { EmptyState(icon: "camera.fill", title: "Nenhuma vistoria neste período", message: "Use a câmera para registrar uma laranja, mesmo quando não houver praga.") }
                    ForEach(groups, id: \.0) { group in
                        let label = group.0
                        let records = group.1
                        VStack(alignment: .leading, spacing: 8) {
                            Text(label).font(.headline).foregroundStyle(CYFColor.muted)
                            VStack(spacing: 0) {
                                ForEach(records) { record in
                                    Button { store.selectedInspection = record } label: { HistoryRow(record: record) }.buttonStyle(.plain)
                                    if record.id != records.last?.id { Divider().padding(.leading, 94) }
                                }
                            }.cyfCard()
                        }
                    }
                }.padding(.horizontal, 20).padding(.top, 18).padding(.bottom, 30)
            }.background(CYFColor.paper)
            .sheet(isPresented: $filtersOpen) { HistoryFilterSheet(days: $days, dayPart: $dayPart, plotFilter: $plotFilter, levelFilter: $levelFilter, search: $search, plots: store.plots, resultCount: filtered.count) }
            .confirmationDialog("Excluir inspeção?", isPresented: Binding(get: { deleteTarget != nil }, set: { if !$0 { deleteTarget = nil } })) { Button("Excluir", role: .destructive) { if let deleteTarget { store.deleteInspection(deleteTarget) } }; Button("Cancelar", role: .cancel) {} }
        }
    }

    private var filterSummary: String {
        if days == 0 { return dayPart == "morning" ? "Hoje · antes das 12h" : dayPart == "afternoon" ? "Hoje · depois das 12h" : "Hoje · dia inteiro" }
        return "Últimos \(days) dias"
    }
    private func dayLabel(_ date: Date) -> String {
        let calendar = Calendar.current
        if calendar.isDateInToday(date) { return "Hoje" }
        if calendar.isDateInYesterday(date) { return "Ontem" }
        return date.formatted(.dateTime.day().month(.wide).locale(Locale(identifier: "pt_BR")))
    }
}

private struct HistoryRow: View {
    @EnvironmentObject private var store: AppStore
    let record: InspectionRecord
    var body: some View {
        HStack(spacing: 12) {
            LocalImage(url: store.imageURL(for: record)).frame(width: 70, height: 70).clipShape(RoundedRectangle(cornerRadius: 16))
            VStack(alignment: .leading, spacing: 5) {
                HStack { Text(store.plot(for: record)?.name ?? "Sem talhão").font(.headline).lineLimit(1); if record.demo { Text("EXEMPLO").font(.system(size: 8, weight: .heavy)).foregroundStyle(CYFColor.orangeDark).padding(4).background(CYFColor.orangeSoft).clipShape(RoundedRectangle(cornerRadius: 5)) } }
                Text(record.confirmedCount > 0 ? "\(record.confirmedCount) ácaro(s) detectado(s)" : "Sem sinal confirmado")
                    .font(.subheadline.weight(.semibold)).foregroundStyle(record.confirmedCount > 0 ? CYFColor.orange : CYFColor.green)
                Text(record.capturedAt.formatted(date: .abbreviated, time: .shortened)).font(.caption).foregroundStyle(CYFColor.muted)
            }
            Spacer(); Image(systemName: record.mapVisible ? "mappin.circle.fill" : "mappin.slash.circle").foregroundStyle(record.mapVisible ? CYFColor.green : CYFColor.lineStrong)
        }.padding(12)
    }
}

private struct HistoryFilterSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var days: Int
    @Binding var dayPart: String
    @Binding var plotFilter: UUID?
    @Binding var levelFilter: SeverityLevel?
    @Binding var search: String
    let plots: [Plot]
    let resultCount: Int
    private var searched: [Plot] { plots.filter { search.isEmpty || $0.name.localizedCaseInsensitiveContains(search) } }

    var body: some View {
        NavigationStack {
            Form {
                Section("Período") { Picker("Período", selection: $days) { Text("Hoje").tag(0); Text("7 dias").tag(7); Text("14 dias").tag(14); Text("30 dias").tag(30) }.pickerStyle(.segmented) }
                if days == 0 { Section("Horário de hoje") { Picker("Horário", selection: $dayPart) { Text("Dia inteiro").tag("all"); Text("Antes das 12h").tag("morning"); Text("Depois das 12h").tag("afternoon") }.pickerStyle(.inline).labelsHidden() } }
                Section("Talhão") {
                    TextField("Buscar talhão pelo nome", text: $search)
                    Picker("Selecionar", selection: $plotFilter) { Text("Todos").tag(UUID?.none); ForEach(searched) { Text($0.name).tag(Optional($0.id)) } }
                }
                Section("Situação") { Picker("Mostrar", selection: $levelFilter) { Text("Todas").tag(SeverityLevel?.none); ForEach(SeverityLevel.allCases) { Text($0.title).tag(Optional($0)) } }.pickerStyle(.segmented) }
                Section { Button(role: .destructive) { days = 14; dayPart = "all"; plotFilter = nil; levelFilter = nil; search = "" } label: { Label("Limpar filtros", systemImage: "line.3.horizontal.decrease.circle") } }
            }.navigationTitle("Refinar registros").toolbar { ToolbarItem(placement: .confirmationAction) { Button("Ver \(resultCount)") { dismiss() } } }
        }
    }
}

struct LocalImage: View {
    let url: URL
    var body: some View {
        Group {
            if let image = UIImage(contentsOfFile: url.path) { Image(uiImage: image).resizable().scaledToFill() }
            else { Rectangle().fill(CYFColor.soft).overlay(Image(systemName: "photo").foregroundStyle(CYFColor.muted)) }
        }.clipped()
    }
}
