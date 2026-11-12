import MapKit
import SwiftUI
import UniformTypeIdentifiers

struct MapScreen: View {
    @EnvironmentObject private var store: AppStore
    @State private var camera: MapCameraPosition = .region(.init(center: .init(latitude: -22.5602, longitude: -47.4050), span: .init(latitudeDelta: 0.022, longitudeDelta: 0.022)))
    @State private var satellite = true
    @State private var filtersOpen = false
    @State private var help = false
    @State private var search = ""
    @State private var plotFilter: UUID?
    @State private var levelFilter: SeverityLevel?
    @State private var selectedPlot: Plot?
    @State private var drawing = false
    @State private var drawingPoints: [CLLocationCoordinate2D] = []
    @State private var drawingName = "Novo talhão"
    @State private var editingPlotID: UUID?
    @State private var importing = false
    @State private var alertMessage: String?

    private var visiblePlots: [Plot] {
        store.plots.filter { plot in
            (plotFilter == nil || plot.id == plotFilter) && (levelFilter == nil || store.level(for: plot) == levelFilter)
        }
    }
    private var total: Int { visiblePlots.reduce(0) { $0 + store.activeCount(for: $1) } }

    var body: some View {
        ZStack(alignment: .top) {
            MapReader { proxy in
                Map(position: $camera, interactionModes: .all) {
                    ForEach(visiblePlots) { plot in
                        ForEach(Array(plot.geometry.polygons.enumerated()), id: \.offset) { item in
                            let polygon = item.element
                            if let ring = polygon.first {
                                MapPolygon(coordinates: ring.map(\.clCoordinate))
                                    .foregroundStyle(color(for: plot).opacity(0.34))
                                    .stroke(color(for: plot), lineWidth: 2.5)
                            }
                        }
                        Annotation(plot.name, coordinate: GeoService.centroid(plot)) {
                            Button { selectedPlot = plot } label: {
                                VStack(spacing: 2) {
                                    Text("\(store.activeCount(for: plot))").font(.caption.bold())
                                    Text(plot.name).font(.system(size: 9, weight: .bold)).lineLimit(1)
                                }.foregroundStyle(.white).padding(.horizontal, 9).padding(.vertical, 6).background(color(for: plot)).clipShape(Capsule()).shadow(radius: 3)
                            }
                        }
                    }
                    ForEach(Array(drawingPoints.enumerated()), id: \.offset) { item in
                        Marker("\(item.offset + 1)", coordinate: item.element).tint(CYFColor.orange)
                    }
                    if drawingPoints.count >= 3 { MapPolygon(coordinates: drawingPoints).foregroundStyle(CYFColor.orange.opacity(0.2)).stroke(CYFColor.orange, lineWidth: 2) }
                    if let coordinate = store.pendingInspection?.location?.clCoordinate { Marker("Foto", coordinate: coordinate).tint(CYFColor.orange) }
                }
                .mapStyle(satellite ? .imagery(elevation: .realistic) : .standard(elevation: .flat))
                .mapControls { MapCompass(); MapScaleView(); MapUserLocationButton() }
                .gesture(SpatialTapGesture().onEnded { value in
                    guard drawing, let coordinate = proxy.convert(value.location, from: .local) else { return }
                    drawingPoints.append(coordinate)
                })
            }
            topBar
            VStack { Spacer(); drawingPanel.padding(.horizontal, 14).padding(.bottom, 8) }
        }
        .toolbar(.visible, for: .tabBar)
        .sheet(isPresented: $filtersOpen) { MapFilterSheet(search: $search, plotFilter: $plotFilter, levelFilter: $levelFilter, plots: store.plots, onFocus: focus) }
        .sheet(isPresented: $help) { MapHelpView() }
        .sheet(item: $selectedPlot) { plot in PlotDetailSheet(plot: plot) { target in
            selectedPlot = nil
            editingPlotID = target.id
            drawingName = target.name
            drawingPoints = []
            drawing = true
            satellite = true
            focus(GeoService.centroid(target), delta: 0.009)
        } }
        .sheet(isPresented: Binding(get: { store.pendingInspection != nil && !drawing }, set: { if !$0 { store.pendingInspectionID = nil } })) { PendingPlotSheet(onDraw: beginPendingDrawing) }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.json, UTType(filenameExtension: "geojson") ?? .data]) { result in importGeoJSON(result) }
        .alert("Mapa", isPresented: Binding(get: { alertMessage != nil }, set: { if !$0 { alertMessage = nil } })) { Button("OK") { alertMessage = nil } } message: { Text(alertMessage ?? "") }
        .onAppear { if let location = store.pendingInspection?.location { focus(location.clCoordinate, delta: 0.008) } }
    }

    private var topBar: some View {
        VStack(spacing: 9) {
            HStack {
                VStack(alignment: .leading, spacing: 2) { Text("VISÃO GERAL DA LAVOURA").font(.caption2.bold()).tracking(1).foregroundStyle(.white.opacity(0.8)); Text("Visão operacional").font(.headline).foregroundStyle(.white) }
                Spacer()
                VStack(alignment: .trailing) { Text("Total de pragas:").font(.caption2); Text("\(total)").font(.title3.bold()) }.foregroundStyle(.white)
            }.padding(.horizontal, 15).padding(.vertical, 10).background(CYFColor.green.opacity(0.96)).clipShape(RoundedRectangle(cornerRadius: 17))
            HStack(spacing: 8) {
                Button { satellite.toggle() } label: { Label(satellite ? "Satélite" : "Mapa", systemImage: "square.3.layers.3d").mapControl() }
                Button { filtersOpen = true } label: { Label("Filtros", systemImage: "line.3.horizontal.decrease").mapControl(badge: plotFilter != nil || levelFilter != nil) }
                Button { help = true } label: { Image(systemName: "info.circle").frame(width: 45, height: 45).background(.ultraThinMaterial).clipShape(RoundedRectangle(cornerRadius: 14)) }
            }.frame(maxWidth: .infinity, alignment: .trailing)
        }.padding(.horizontal, 12).padding(.top, 4)
    }

    @ViewBuilder private var drawingPanel: some View {
        if drawing {
            VStack(spacing: 10) {
                HStack { TextField("Nome do talhão", text: $drawingName).textFieldStyle(.roundedBorder); Text("\(drawingPoints.count) pontos").font(.caption.bold()).foregroundStyle(CYFColor.muted) }
                Text("Toque nos cantos do talhão. Use pelo menos três pontos.").font(.caption).foregroundStyle(CYFColor.muted).frame(maxWidth: .infinity, alignment: .leading)
                HStack {
                    Button("Desfazer") { _ = drawingPoints.popLast() }.buttonStyle(.bordered).disabled(drawingPoints.isEmpty)
                    Button("Cancelar") { cancelDrawing() }.buttonStyle(.bordered)
                    Button("Concluir") { saveDrawing() }.buttonStyle(.borderedProminent).disabled(drawingPoints.count < 3 || drawingName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }.padding(14).cyfCard()
        } else {
            HStack(spacing: 9) {
                Button { beginDrawing() } label: { Label("Desenhar", systemImage: "pencil.and.outline").frame(maxWidth: .infinity) }.buttonStyle(.borderedProminent).buttonBorderShape(.capsule)
                Button { importing = true } label: { Label("GeoJSON", systemImage: "doc.badge.plus").frame(maxWidth: .infinity) }.buttonStyle(.bordered).buttonBorderShape(.capsule)
            }.padding(12).background(.ultraThinMaterial).clipShape(RoundedRectangle(cornerRadius: 20))
        }
    }

    private func color(for plot: Plot) -> Color {
        switch store.level(for: plot) { case .green: CYFColor.green; case .yellow: CYFColor.yellow; case .red: CYFColor.red }
    }
    private func focus(_ plot: Plot) { plotFilter = plot.id; levelFilter = nil; focus(GeoService.centroid(plot), delta: 0.009); filtersOpen = false }
    private func focus(_ coordinate: CLLocationCoordinate2D, delta: Double) { withAnimation { camera = .region(.init(center: coordinate, span: .init(latitudeDelta: delta, longitudeDelta: delta))) } }
    private func beginDrawing() { editingPlotID = nil; drawing = true; drawingPoints = []; drawingName = "Novo talhão"; satellite = true }
    private func beginPendingDrawing() { guard let record = store.pendingInspection else { return }; store.drawForInspectionID = record.id; store.pendingInspectionID = nil; drawing = true; drawingPoints = record.location.map { [$0.clCoordinate] } ?? []; drawingName = "Talhão da inspeção"; satellite = true }
    private func cancelDrawing() { drawing = false; drawingPoints = []; editingPlotID = nil; store.drawForInspectionID = nil }
    private func saveDrawing() {
        guard let geometry = GeoService.drawn(drawingPoints) else { alertMessage = "Marque pelo menos três pontos."; return }
        if let editingPlotID, var plot = store.plots.first(where: { $0.id == editingPlotID }) {
            plot.name = drawingName.trimmingCharacters(in: .whitespaces)
            plot.geometry = geometry
            store.updatePlot(plot)
            alertMessage = "Limite do talhão atualizado."
        } else {
            let plot = Plot(id: UUID(), name: drawingName.trimmingCharacters(in: .whitespaces), geometry: geometry, createdAt: Date(), source: "drawn")
            store.addPlot(plot, assigning: store.drawForInspectionID)
            alertMessage = "Talhão salvo e associado à inspeção."
        }
        drawing = false; drawingPoints = []; editingPlotID = nil
    }
    private func importGeoJSON(_ result: Result<URL, Error>) {
        do {
            let url = try result.get(); guard url.startAccessingSecurityScopedResource() else { throw GeoService.GeoError.invalid }; defer { url.stopAccessingSecurityScopedResource() }
            let imported = try GeoService.parseGeoJSON(data: Data(contentsOf: url)); imported.forEach { store.addPlot($0) }
            alertMessage = "\(imported.count) talhão(ões) importado(s)."
        } catch { alertMessage = error.localizedDescription }
    }
}

private extension View {
    func mapControl(badge: Bool = false) -> some View {
        self.font(.subheadline.bold()).foregroundStyle(CYFColor.greenDark).padding(.horizontal, 13).frame(height: 45).background(.ultraThinMaterial).clipShape(RoundedRectangle(cornerRadius: 14)).overlay(alignment: .topTrailing) { if badge { Circle().fill(CYFColor.orange).frame(width: 8, height: 8).offset(x: 2, y: -2) } }
    }
}

private struct MapFilterSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var search: String
    @Binding var plotFilter: UUID?
    @Binding var levelFilter: SeverityLevel?
    let plots: [Plot]
    let onFocus: (Plot) -> Void
    private var searched: [Plot] { plots.filter { search.isEmpty || $0.name.localizedCaseInsensitiveContains(search) } }

    var body: some View {
        NavigationStack {
            Form {
                Section("Talhão") {
                    TextField("Buscar talhão pelo nome", text: $search)
                    Button("Todos os talhões") { plotFilter = nil }
                    ForEach(searched) { plot in Button { onFocus(plot) } label: { HStack { Text(plot.name); Spacer(); if plotFilter == plot.id { Image(systemName: "checkmark") } } } }
                }
                Section("Situação") {
                    Picker("Mostrar", selection: $levelFilter) {
                        Text("Todas").tag(SeverityLevel?.none)
                        ForEach(SeverityLevel.allCases) { Text($0.title).tag(Optional($0)) }
                    }.pickerStyle(.segmented)
                }
                if plotFilter != nil || levelFilter != nil || !search.isEmpty { Button(role: .destructive) { plotFilter = nil; levelFilter = nil; search = "" } label: { Label("Limpar filtros", systemImage: "line.3.horizontal.decrease.circle") } }
            }.navigationTitle("Filtros do mapa").toolbar { ToolbarItem(placement: .confirmationAction) { Button("Concluir") { dismiss() } } }
        }.presentationDetents([.medium, .large])
    }
}

private struct PendingPlotSheet: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var name = "Talhão da inspeção"
    @State private var hectares = ""
    let onDraw: () -> Void
    private var existing: Plot? { store.pendingInspection.flatMap { GeoService.findPlot(in: store.plots, coordinate: $0.location) } }

    var body: some View {
        NavigationStack {
            Form {
                Section { Text("O mapa foi centralizado nas coordenadas GPS/EXIF da foto. Informe a área para criar um limite estimado.") }
                if let existing { Section { Button { store.assignPending(to: existing); dismiss() } label: { Label("Usar \(existing.name)", systemImage: "map.fill") } } }
                Section("Dados do talhão") {
                    TextField("Nome do talhão", text: $name)
                    HStack { TextField("Ex.: 2,5", text: $hectares).keyboardType(.decimalPad); Text("hectares").foregroundStyle(.secondary) }
                }
                Section {
                    Button { createByArea() } label: { Label("Marcar automaticamente", systemImage: "scope") }
                    Button { onDraw(); dismiss() } label: { Label("Desenhar o limite exato", systemImage: "pencil.and.outline") }
                }
                Text("A marcação automática estima um círculo. Para precisão cadastral, desenhe ou importe GeoJSON.").font(.caption).foregroundStyle(.secondary)
            }.navigationTitle("Qual é a área?").navigationBarTitleDisplayMode(.inline).toolbar { ToolbarItem(placement: .cancellationAction) { Button("Depois") { store.pendingInspectionID = nil; dismiss() } } }
        }.presentationDetents([.medium, .large])
    }

    private func createByArea() {
        guard let record = store.pendingInspection, let center = record.location,
              let value = Double(hectares.replacingOccurrences(of: ",", with: ".")), value >= 0.0025, value <= 10_000 else { return }
        let plot = Plot(id: UUID(), name: name.isEmpty ? "Talhão da inspeção" : name, geometry: GeoService.circle(around: center, areaSquareMeters: value * 10_000), createdAt: Date(), source: "estimated")
        store.addPlot(plot, assigning: record.id); dismiss()
    }
}

private struct PlotDetailSheet: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State var plot: Plot
    @State private var confirmDelete = false
    let onRedraw: (Plot) -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section("Resumo") {
                    LabeledContent("Área", value: String(format: "%.2f ha", GeoService.areaHectares(plot.geometry)))
                    LabeledContent("Inspeções", value: "\(store.records.filter { $0.plotID == plot.id }.count)")
                    LabeledContent("Pragas ativas", value: "\(store.activeCount(for: plot))")
                }
                Section("Cadastro") { TextField("Nome", text: $plot.name); Button("Salvar nome") { store.updatePlot(plot) } }
                Section { Button { dismiss(); onRedraw(plot) } label: { Label("Redesenhar limite", systemImage: "pencil.and.outline") } }
                Section("Pulverização") {
                    TextField("Produto", text: Binding(get: { plot.sprayApplication?.product ?? "" }, set: { value in ensureSpray(); plot.sprayApplication?.product = value }))
                    TextField("Alvo", text: Binding(get: { plot.sprayApplication?.target ?? "" }, set: { value in ensureSpray(); plot.sprayApplication?.target = value }))
                    Picker("Categoria", selection: Binding(get: { plot.sprayApplication?.category ?? "Acaricida" }, set: { value in ensureSpray(); plot.sprayApplication?.category = value })) { ForEach(["Acaricida", "Inseticida", "Fungicida"], id: \.self) { Text($0) } }
                    Stepper("Reentrada: \(plot.sprayApplication?.reentryHours ?? 24) h", value: Binding(get: { plot.sprayApplication?.reentryHours ?? 24 }, set: { ensureSpray(); plot.sprayApplication?.reentryHours = $0 }), in: 1...168)
                    Button { ensureSpray(); plot.sprayApplication?.appliedAt = Date(); plot.lastSprayedAt = Date(); store.updatePlot(plot) } label: { Label("Registrar pulverização agora", systemImage: "sprinkler.and.droplets") }
                }
                Section("Armadilha de furão") {
                    Picker("Métrica", selection: Binding(get: { plot.trapMonitoring?.metric ?? "Índice" }, set: { ensureTrap(); plot.trapMonitoring?.metric = $0 })) { Text("Índice").tag("Índice"); Text("Volume").tag("Volume") }
                    Stepper("Capturados: \(plot.trapMonitoring?.captured ?? 0)", value: Binding(get: { plot.trapMonitoring?.captured ?? 0 }, set: { ensureTrap(); plot.trapMonitoring?.captured = $0 }), in: 0...999)
                    Stepper("Armadilhas: \(plot.trapMonitoring?.traps ?? 1)", value: Binding(get: { plot.trapMonitoring?.traps ?? 1 }, set: { ensureTrap(); plot.trapMonitoring?.traps = $0 }), in: 1...999)
                    Button("Salvar leitura") { ensureTrap(); plot.trapMonitoring?.checkedAt = Date(); store.updatePlot(plot) }
                }
                Section { Button(role: .destructive) { confirmDelete = true } label: { Label("Excluir talhão", systemImage: "trash") } }
            }.navigationTitle(plot.name).navigationBarTitleDisplayMode(.inline).toolbar { ToolbarItem(placement: .confirmationAction) { Button("Fechar") { dismiss() } } }
            .confirmationDialog("Excluir este talhão?", isPresented: $confirmDelete, titleVisibility: .visible) { Button("Excluir", role: .destructive) { store.deletePlot(plot); dismiss() } }
        }
    }

    private func ensureSpray() { if plot.sprayApplication == nil { plot.sprayApplication = .init(product: "", category: "Acaricida", target: "Ácaro", appliedAt: Date(), reentryHours: 24, harvestIntervalDays: 14, nextInspectionDays: 3) } }
    private func ensureTrap() { if plot.trapMonitoring == nil { plot.trapMonitoring = .init(pest: "Furão", metric: "Índice", captured: 0, traps: 1, checkedAt: Date()) } }
}

private struct MapHelpView: View {
    @Environment(\.dismiss) private var dismiss
    var body: some View { NavigationStack { List { Label("Desenhar: toque nos cantos e conclua com três ou mais pontos.", systemImage: "pencil.and.outline"); Label("GeoJSON: use WGS84/EPSG:4326 com Polygon ou MultiPolygon.", systemImage: "doc.badge.plus"); Label("Editar: toque no rótulo de um talhão para renomear, manejar ou excluir.", systemImage: "slider.horizontal.3"); Label("Filtrar: pesquise o nome; o mapa enquadra e mostra apenas o selecionado.", systemImage: "line.3.horizontal.decrease.circle") }.navigationTitle("Como usar o mapa").toolbar { Button("Fechar") { dismiss() } } }.presentationDetents([.medium]) }
}
