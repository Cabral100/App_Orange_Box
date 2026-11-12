import SwiftUI

struct InspectionDetailView: View {
    @EnvironmentObject private var store: AppStore
    let record: InspectionRecord
    @State private var confirmDelete = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 15) {
                    ZStack {
                        LocalImage(url: store.imageURL(for: record)).aspectRatio(1.38, contentMode: .fit).clipShape(RoundedRectangle(cornerRadius: 25))
                        GeometryReader { geometry in
                            ForEach(record.detections) { detection in
                                let scaleX = geometry.size.width / max(1, record.width)
                                let scaleY = geometry.size.height / max(1, record.height)
                                RoundedRectangle(cornerRadius: 6).stroke(CYFColor.orange, lineWidth: 3)
                                    .background(CYFColor.orange.opacity(0.08))
                                    .frame(width: (detection.box.x2 - detection.box.x1) * scaleX, height: (detection.box.y2 - detection.box.y1) * scaleY)
                                    .position(x: (detection.box.x1 + detection.box.x2) / 2 * scaleX, y: (detection.box.y1 + detection.box.y2) / 2 * scaleY)
                            }
                        }
                    }.aspectRatio(1.38, contentMode: .fit)
                    HStack(spacing: 14) {
                        Image(systemName: record.confirmedCount > 0 ? "exclamationmark.triangle.fill" : "checkmark.circle.fill").font(.system(size: 38)).foregroundStyle(record.confirmedCount > 0 ? CYFColor.red : CYFColor.green)
                        VStack(alignment: .leading) { Text(record.confirmedCount > 0 ? "\(record.confirmedCount) ácaro(s) detectado(s)" : "Nenhuma praga confirmada").font(.headline).foregroundStyle(record.confirmedCount > 0 ? CYFColor.red : CYFColor.green); Text(record.confirmedCount > 0 ? "Confiança \(Int(record.topConfidence * 100))%" : "Vistoria registrada com zero ocorrência").font(.subheadline).foregroundStyle(CYFColor.muted) }
                        Spacer()
                    }.padding(17).background(record.confirmedCount > 0 ? CYFColor.red.opacity(0.1) : CYFColor.greenSoft).clipShape(RoundedRectangle(cornerRadius: 22))
                    VStack(spacing: 0) {
                        DetailRow(icon: "map", value: store.plot(for: record)?.name ?? "Talhão ainda não delimitado")
                        Divider(); DetailRow(icon: "location", value: record.location.map { String(format: "%.5f, %.5f · %@", $0.latitude, $0.longitude, $0.source.uppercased()) } ?? "Foto sem coordenada")
                        Divider(); DetailRow(icon: "clock", value: record.capturedAt.formatted(date: .long, time: .shortened))
                    }.padding(.horizontal, 16).cyfCard()
                    Menu {
                        ForEach(store.plots) { plot in Button(plot.name) { var updated = record; updated.plotID = plot.id; updated.mapVisible = true; store.updateInspection(updated); store.selectedInspection = updated } }
                    } label: { Label("Alterar talhão associado", systemImage: "map.fill").frame(maxWidth: .infinity) }.buttonStyle(PillButtonStyle())
                    Button { store.pendingInspectionID = record.id; store.selectedInspection = nil; store.selectedTab = .map } label: { Label("Marcar talhão no mapa", systemImage: "mappin.and.ellipse").frame(maxWidth: .infinity) }.buttonStyle(.bordered).buttonBorderShape(.capsule)
                    Button(role: .destructive) { confirmDelete = true } label: { Label("Apagar esta inspeção", systemImage: "trash") }
                }.padding(14).padding(.bottom, 20)
            }.background(CYFColor.paper).navigationTitle("Inspeção").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button { store.selectedInspection = nil } label: { Image(systemName: "chevron.left") } } }
            .confirmationDialog("Apagar esta inspeção?", isPresented: $confirmDelete) { Button("Apagar", role: .destructive) { store.deleteInspection(record); store.selectedInspection = nil } }
        }
    }
}

private struct DetailRow: View {
    let icon: String; let value: String
    var body: some View { HStack(spacing: 13) { Image(systemName: icon).foregroundStyle(CYFColor.green).frame(width: 25); Text(value).font(.subheadline.bold()); Spacer() }.frame(minHeight: 62) }
}
