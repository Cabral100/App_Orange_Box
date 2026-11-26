import MapKit
import SwiftUI
import UniformTypeIdentifiers

struct MapScreen: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dynamicTypeSize) private var textSize
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
    @State private var framedPlots = false
    @State private var showsHeat = false

    private var visiblePlots: [Plot] {
        store.plots.filter { plot in
            (plotFilter == nil || plot.id == plotFilter) && (levelFilter == nil || store.level(for: plot) == levelFilter)
        }
    }
    private var total: Int { visiblePlots.reduce(0) { $0 + store.activeCount(for: $1) } }

    var body: some View {
        let spots = showsHeat && !drawing ? heatSpots : []
        VStack(spacing: 0) {
            topBar(hasHeatSpots: !spots.isEmpty)
            fieldMap(heat: spots)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            drawingPanel
                .padding(.horizontal, 14).padding(.vertical, 9)
                .frame(maxWidth: .infinity)
                .background(CYFColor.paper)
        }
        .background(CYFColor.paper)
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
        .onAppear {
            if let location = store.pendingInspection?.location {
                focus(location.clCoordinate, delta: 0.008)
            } else if !framedPlots {
                framePlots()
            }
        }
        .onChange(of: store.plots.map(\.id)) { _, _ in
            if !drawing && store.pendingInspection == nil { framePlots() }
        }
    }

    private func fieldMap(heat: [HeatSpot]) -> some View {
        MapReader { proxy in
            Map(position: $camera, interactionModes: .all) {
                ForEach(visiblePlots) { plot in
                    ForEach(Array(plot.geometry.polygons.enumerated()), id: \.offset) { item in
                        let polygon = item.element
                        if let ring = polygon.first {
                            MapPolygon(coordinates: ring.map(\.clCoordinate))
                                .foregroundStyle(color(for: plot).opacity(showsHeat ? 0.13 : 0.34))
                                .stroke(color(for: plot), lineWidth: 2.5)
                        }
                    }
                    Annotation(plot.name, coordinate: GeoService.centroid(plot)) {
                        Button { selectedPlot = plot } label: {
                            HStack(spacing: 5) {
                                Circle().fill(color(for: plot)).frame(width: 8, height: 8)
                                Text(plot.name).lineLimit(1)
                                Text("\(store.activeCount(for: plot))").monospacedDigit()
                            }
                            .font(.caption.weight(.semibold)).foregroundStyle(CYFColor.ink)
                            .padding(.horizontal, 9).padding(.vertical, 7)
                            .background(CYFColor.surface, in: Capsule())
                            .shadow(color: .black.opacity(0.28), radius: 3, y: 2)
                        }
                    }
                }
                if !heat.isEmpty { heatOverlay(heat) }
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
    }

    @MapContentBuilder
    private func heatOverlay(_ spots: [HeatSpot]) -> some MapContent {
        let peak = max(1, spots.map(\.count).max() ?? 0)
        ForEach(spots) { spot in
            let strength = Double(spot.count) / Double(peak)
            let tint = strength >= 0.66 ? CYFColor.red : strength >= 0.33 ? CYFColor.orange : CYFColor.yellow
            MapCircle(center: spot.coordinate, radius: 85).foregroundStyle(tint.opacity(0.20))
            MapCircle(center: spot.coordinate, radius: 52).foregroundStyle(tint.opacity(0.32))
            MapCircle(center: spot.coordinate, radius: 22).foregroundStyle(tint.opacity(0.60))
        }
    }

    private var heatSpots: [HeatSpot] {
        let visibleByID = Dictionary(uniqueKeysWithValues: visiblePlots.map { ($0.id, $0) })
        var counts: [HeatCell: Int] = [:]
        for record in store.records where record.mapVisible && record.confirmedCount > 0 {
            guard let id = record.plotID, let plot = visibleByID[id],
                  record.capturedAt > (plot.lastSprayedAt ?? .distantPast),
                  let location = record.location, CLLocationCoordinate2DIsValid(location.clCoordinate) else { continue }
            let cell = HeatCell(
                latitude: Int((location.latitude / HeatCell.degrees).rounded()),
                longitude: Int((location.longitude / HeatCell.degrees).rounded())
            )
            counts[cell, default: 0] += record.confirmedCount
        }
        return counts.map { HeatSpot(id: $0.key, count: $0.value) }
    }

    private func topBar(hasHeatSpots: Bool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Mapa de talhões").font(.title2.bold()).accessibilityAddTraits(.isHeader)
                    Text("\(visiblePlots.count) talhões · \(total) pragas ativas")
                        .font(.subheadline).foregroundStyle(.white.opacity(0.84))
                }
                Spacer(minLength: 2)
                Button { help = true } label: {
                    mapHeaderIcon("info.circle")
                }.accessibilityLabel("Como usar o mapa")
                Button { showAllPlots() } label: {
                    mapHeaderIcon("arrow.up.left.and.arrow.down.right")
                }
                .accessibilityLabel("Enquadrar todos os talhões")
                .accessibilityHint("Limpa os filtros e mostra todos os talhões cadastrados")
                .disabled(store.plots.isEmpty)
            }
            .buttonStyle(.plain).foregroundStyle(.white)
            HStack(spacing: 8) {
                Menu {
                    Button("Satélite", systemImage: satellite ? "checkmark" : "globe.americas") { satellite = true }
                    Button("Mapa padrão", systemImage: satellite ? "map" : "checkmark") { satellite = false }
                    Toggle("Mapa de calor", isOn: $showsHeat)
                } label: {
                    Label("Camadas", systemImage: "square.3.layers.3d").mapControl(badge: showsHeat)
                }
                Button { filtersOpen = true } label: {
                    Label("Filtros", systemImage: "line.3.horizontal.decrease").mapControl(badge: plotFilter != nil || levelFilter != nil)
                }.buttonStyle(.plain)
                Spacer(minLength: 0)
            }
            if showsHeat && !drawing {
                Text(hasHeatSpots ? "Mapa de calor · detecções ativas com localização" : "Sem detecções ativas com localização neste recorte.")
                    .font(.footnote.weight(.semibold)).foregroundStyle(.white)
                if hasHeatSpots {
                    HStack(spacing: 10) {
                        legendEntry("Menos", color: CYFColor.yellow)
                        legendEntry("Intermediário", color: CYFColor.orange)
                        legendEntry("Mais", color: CYFColor.red)
                    }
                }
            } else {
                HStack(spacing: 10) {
                    legendEntry("0", color: CYFColor.green)
                    legendEntry("1–20", color: CYFColor.yellow)
                    legendEntry("21+", color: CYFColor.red)
                }.accessibilityLabel("Faixas de pragas por talhão: zero, de uma a vinte, vinte e uma ou mais")
            }
        }
        .padding(.horizontal, 15).padding(.vertical, 10)
        .background(LinearGradient(colors: [CYFColor.forest, CYFColor.forestDeep], startPoint: .topLeading, endPoint: .bottomTrailing))
    }

    private func mapHeaderIcon(_ icon: String) -> some View {
        Image(systemName: icon).font(.headline).frame(width: 44, height: 44)
            .background(.white.opacity(0.14), in: Circle())
    }

    private func legendEntry(_ label: String, color: Color) -> some View {
        HStack(spacing: 4) {
            Circle().fill(color).frame(width: 9, height: 9).accessibilityHidden(true)
            Text(label).font(.footnote.weight(.medium)).foregroundStyle(.white)
        }
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
            let layout = textSize.isAccessibilitySize ? AnyLayout(VStackLayout(spacing: 8)) : AnyLayout(HStackLayout(spacing: 9))
            layout {
                Button { beginDrawing() } label: {
                    Label("Desenhar talhão", systemImage: "pencil.and.outline")
                        .foregroundStyle(.white).frame(maxWidth: .infinity, minHeight: 44).padding(.horizontal, 8)
                        .background(CYFColor.forest, in: RoundedRectangle(cornerRadius: 13))
                }
                Button { importing = true } label: {
                    Label("Importar GeoJSON", systemImage: "doc.badge.plus")
                        .foregroundStyle(CYFColor.greenDark).frame(maxWidth: .infinity, minHeight: 44).padding(.horizontal, 8)
                        .background(CYFColor.surface, in: RoundedRectangle(cornerRadius: 13))
                }
            }
            .font(.subheadline.weight(.semibold)).buttonStyle(.plain)
        }
    }

    private func color(for plot: Plot) -> Color {
        switch store.level(for: plot) { case .green: CYFColor.green; case .yellow: CYFColor.yellow; case .red: CYFColor.red }
    }
    private func focus(_ plot: Plot) { plotFilter = plot.id; levelFilter = nil; focus(GeoService.centroid(plot), delta: 0.009); filtersOpen = false }
    private func focus(_ coordinate: CLLocationCoordinate2D, delta: Double) { withAnimation { camera = .region(.init(center: coordinate, span: .init(latitudeDelta: delta, longitudeDelta: delta))) } }
    private func showAllPlots() {
        plotFilter = nil
        levelFilter = nil
        search = ""
        framePlots(store.plots)
    }

    private func framePlots(_ plots: [Plot]? = nil) {
        var bounds = MKMapRect.null
        for plot in plots ?? visiblePlots {
            for polygon in plot.geometry.polygons {
                for coordinate in polygon.first ?? [] {
                    let point = MKMapPoint(coordinate.clCoordinate)
                    bounds = bounds.union(MKMapRect(x: point.x, y: point.y, width: 1, height: 1))
                }
            }
        }
        if !bounds.isNull {
            camera = .rect(bounds.insetBy(dx: -bounds.width * 0.2, dy: -bounds.height * 0.3))
            framedPlots = true
        }
    }
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

private struct HeatCell: Hashable {
    static let degrees = 0.0006
    let latitude: Int
    let longitude: Int
}

private struct HeatSpot: Identifiable {
    let id: HeatCell
    let count: Int

    var coordinate: CLLocationCoordinate2D {
        .init(latitude: Double(id.latitude) * HeatCell.degrees, longitude: Double(id.longitude) * HeatCell.degrees)
    }
}

private extension View {
    func mapControl(badge: Bool = false) -> some View {
        self.font(.subheadline.weight(.semibold)).foregroundStyle(CYFColor.greenDark).padding(.horizontal, 13).frame(minHeight: 44).background(CYFColor.surface).clipShape(RoundedRectangle(cornerRadius: 14)).overlay(alignment: .topTrailing) { if badge { Circle().fill(CYFColor.orange).frame(width: 8, height: 8).offset(x: 2, y: -2) } }
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

    var body: some View {
        NavigationStack {
            List {
                Label("Toque nos cantos do talhão para desenhar o contorno. Marque pelo menos três pontos.", systemImage: "pencil.and.outline")
                Label("Use o botão de enquadrar para mostrar todos os talhões de uma vez.", systemImage: "arrow.up.left.and.arrow.down.right")
                Label("Em Camadas, ative o mapa de calor para destacar onde há mais detecções ativas registradas.", systemImage: "square.3.layers.3d")
                Label("Para importar, use GeoJSON em WGS84/EPSG:4326 com Polygon ou MultiPolygon.", systemImage: "doc.badge.plus")
                Label("Toque no nome de um talhão para editar o limite ou registrar o manejo.", systemImage: "slider.horizontal.3")
                Label("Use Filtros para buscar pelo nome ou pela quantidade de pragas.", systemImage: "line.3.horizontal.decrease.circle")
            }
            .navigationTitle("Como usar o mapa")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("Fechar") { dismiss() } }
        }.presentationDetents([.medium, .large])
    }
}
