import PhotosUI
import SwiftUI
import UIKit

struct CameraScreen: View {
    @EnvironmentObject private var store: AppStore
    @StateObject private var engine = CameraEngine()
    @StateObject private var location = LocationService.shared
    @State private var torch = false
    @State private var help = false
    @State private var working = false
    @State private var success = false
    @State private var pickerItem: PhotosPickerItem?
    @State private var alertMessage: String?
    @State private var autoCaptureArmed = true

    private var percent: Int { Int((engine.confidence * 100).rounded()) }
    private var guidance: String {
        engine.confidence >= 0.95 ? "Boa distância — mantenha firme" : engine.confidence > 0 ? "Aproxime-se da praga e mantenha firme" : "Aponte e aproxime-se da praga"
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            YOLOCameraBridge(engine: engine).ignoresSafeArea()
            LinearGradient(colors: [.black.opacity(0.45), .clear, .black.opacity(0.66)], startPoint: .top, endPoint: .bottom).ignoresSafeArea().allowsHitTesting(false)
            cameraChrome
            if success { successOverlay }
        }
        .toolbar(.hidden, for: .tabBar)
        .task { location.start() }
        .onChange(of: torch) { _, enabled in engine.setTorch(enabled) }
        .onChange(of: engine.confidence) { _, confidence in
            if confidence < 0.80 { autoCaptureArmed = true }
            if confidence >= 0.95, autoCaptureArmed, !working {
                autoCaptureArmed = false
                Task { await capture() }
            }
        }
        .onChange(of: pickerItem) { _, item in if let item { Task { await importPhoto(item) } } }
        .sheet(isPresented: $help) { CameraHelpView() }
        .alert("Atenção", isPresented: Binding(get: { alertMessage != nil }, set: { if !$0 { alertMessage = nil } })) { Button("OK") { alertMessage = nil } } message: { Text(alertMessage ?? "") }
    }

    private var cameraChrome: some View {
        VStack(spacing: 0) {
            HStack(alignment: .top) {
                Button { store.selectedTab = .history } label: { roundIcon("chevron.left") }
                Spacer()
                VStack(alignment: .trailing, spacing: 8) {
                    HStack(spacing: 8) {
                        VStack(alignment: .leading, spacing: 5) {
                            HStack { Text(engine.confidence > 0 ? "Ácaro" : "Buscando"); Spacer(); Text("\(percent)%") }.font(.caption.bold())
                            GeometryReader { geometry in Capsule().fill(.white.opacity(0.25)).overlay(alignment: .leading) { Capsule().fill(CYFColor.orange).frame(width: geometry.size.width * max(0.03, engine.confidence)) } }.frame(height: 5)
                        }.foregroundStyle(.white).padding(.horizontal, 12).padding(.vertical, 9).frame(width: 132).background(.black.opacity(0.45)).clipShape(RoundedRectangle(cornerRadius: 15))
                        Button { help = true } label: { roundIcon("info.circle") }
                    }
                }
            }.padding(.horizontal, 18).padding(.top, 10)
            Text(guidance).font(.caption.bold()).foregroundStyle(.white).padding(.horizontal, 14).padding(.vertical, 8)
                .background(engine.confidence >= 0.95 ? CYFColor.green.opacity(0.9) : Color.black.opacity(0.55)).clipShape(Capsule()).padding(.top, 12)
            Spacer()
            focusFrame
            Spacer()
            HStack(spacing: 7) {
                Circle().fill(engine.modelReady ? Color.green : Color.orange).frame(width: 8, height: 8)
                Text(engine.errorMessage ?? (engine.modelReady ? "UltralyticsYOLO · Core ML pronto" : "Carregando modelo no iPhone…")).lineLimit(1)
            }.font(.caption2.weight(.semibold)).foregroundStyle(.white).padding(.horizontal, 12).padding(.vertical, 7).background(.black.opacity(0.5)).clipShape(Capsule())
            HStack {
                PhotosPicker(selection: $pickerItem, matching: .images) { sideControl(icon: "photo.on.rectangle", text: "Galeria") }
                Spacer()
                Button { Task { await capture() } } label: {
                    ZStack { Circle().stroke(.white, lineWidth: 4).frame(width: 78, height: 78); Circle().fill(.white).frame(width: 64, height: 64); if working { ProgressView().tint(CYFColor.green) } }
                }.disabled(working || !engine.modelReady)
                Spacer()
                Button { torch.toggle() } label: { sideControl(icon: torch ? "bolt.fill" : "bolt.slash", text: "Flash", active: torch) }
            }.padding(.horizontal, 28).padding(.bottom, 25).padding(.top, 15)
        }
    }

    private var focusFrame: some View {
        RoundedRectangle(cornerRadius: 24).stroke(.white.opacity(0.9), style: StrokeStyle(lineWidth: 2, dash: [26, 16]))
            .frame(width: 310, height: 310).overlay { Circle().stroke(.white.opacity(0.65), lineWidth: 1).frame(width: 54, height: 54).overlay(Circle().fill(.white).frame(width: 4, height: 4)) }
    }

    private func roundIcon(_ name: String) -> some View { Image(systemName: name).font(.title3.bold()).foregroundStyle(.white).frame(width: 45, height: 45).background(.black.opacity(0.42)).clipShape(Circle()) }
    private func sideControl(icon: String, text: String, active: Bool = false) -> some View { VStack(spacing: 5) { Image(systemName: icon).font(.title2).foregroundStyle(active ? CYFColor.orange : .white); Text(text).font(.caption2.bold()).foregroundStyle(.white) }.frame(width: 62) }

    private var successOverlay: some View {
        Color.black.opacity(0.78).ignoresSafeArea().overlay { VStack(spacing: 14) { Image(systemName: "checkmark.circle.fill").font(.system(size: 76)).foregroundStyle(CYFColor.green); Text("Imagem capturada").font(.title2.bold()).foregroundStyle(.white); Text("Registro salvo neste aparelho").foregroundStyle(.white.opacity(0.8)) } }
    }

    private func capture() async {
        working = true; defer { working = false }
        if engine.confidence > 0 && engine.confidence < 0.95 { autoCaptureArmed = true; alertMessage = "Confiança baixa. Aproxime-se da praga e mantenha o iPhone firme."; return }
        guard let image = await engine.capture(), let coordinate = await location.current() else { alertMessage = "Ative a localização precisa para salvar a inspeção no ponto correto do mapa."; return }
        await persistCapture(image: image, detections: engine.detections, coordinate: coordinate, source: "camera")
    }

    private func importPhoto(_ item: PhotosPickerItem) async {
        working = true; defer { working = false; pickerItem = nil }
        do {
            guard let data = try await item.loadTransferable(type: Data.self), let image = UIImage(data: data) else { throw CameraError.invalidImage }
            let detections = try await GalleryAnalyzer.shared.analyze(image)
            let confidence = detections.first?.confidence ?? 0
            if confidence > 0 && confidence < 0.95 { alertMessage = "A detecção ficou abaixo de 95%. Escolha uma foto mais próxima da praga."; return }
            guard let coordinate = ImageMetadata.exifCoordinate(from: data) ?? (await location.current()) else { alertMessage = "A foto não possui GPS/EXIF e a localização atual não está disponível."; return }
            await persistCapture(image: image, detections: detections, coordinate: coordinate, source: "gallery")
        } catch { alertMessage = error.localizedDescription }
    }

    private func persistCapture(image: UIImage, detections: [Detection], coordinate: FieldCoordinate, source: String) async {
        guard let data = image.jpegData(compressionQuality: 0.92) else { alertMessage = "Não foi possível salvar a imagem."; return }
        let id = UUID()
        do {
            let name = try store.saveImage(data, id: id)
            let confirmed = detections.filter { $0.confidence >= 0.95 }
            let plot = GeoService.findPlot(in: store.plots, coordinate: coordinate)
            let record = InspectionRecord(id: id, capturedAt: Date(), imageName: name, width: image.size.width, height: image.size.height,
                detections: confirmed, topConfidence: detections.first?.confidence ?? 0, location: coordinate, plotID: plot?.id, mapVisible: false, source: source, demo: false)
            success = true; try? await Task.sleep(for: .milliseconds(650)); store.addInspection(record); success = false
        } catch { alertMessage = error.localizedDescription }
    }

    enum CameraError: LocalizedError { case invalidImage; var errorDescription: String? { "Não foi possível abrir a imagem selecionada." } }
}

private struct CameraHelpView: View {
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                HelpRow(icon: "viewfinder", title: "Aproxime a laranja", copy: "Centralize a casca dentro das marcas brancas.")
                HelpRow(icon: "gauge.with.dots.needle.67percent", title: "Aguarde o sinal", copy: "A barra mede a confiança. Com 95% ou mais, a detecção é confirmada.")
                HelpRow(icon: "map", title: "Confirme o talhão", copy: "Depois da foto, informe a área, desenhe ou use um limite existente.")
                HelpRow(icon: "line.3.horizontal.decrease.circle", title: "Use os filtros", copy: "No mapa e histórico, pesquise o nome e filtre por situação sem poluir a tela.")
                Label("A análise usa UltralyticsYOLO + Core ML e funciona offline no iPhone.", systemImage: "iphone.and.arrow.forward")
                    .font(.footnote.weight(.semibold)).foregroundStyle(CYFColor.green).padding().background(CYFColor.greenSoft).clipShape(RoundedRectangle(cornerRadius: 16))
                Spacer()
                Button("Entendi") { dismiss() }.buttonStyle(PillButtonStyle())
            }.padding(20).navigationTitle("Como inspecionar").navigationBarTitleDisplayMode(.inline).toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Fechar") { dismiss() } } }
        }.presentationDetents([.medium, .large])
    }
}

private struct HelpRow: View {
    let icon: String; let title: String; let copy: String
    var body: some View { HStack(spacing: 13) { Image(systemName: icon).foregroundStyle(CYFColor.green).frame(width: 43, height: 43).background(CYFColor.greenSoft).clipShape(RoundedRectangle(cornerRadius: 14)); VStack(alignment: .leading) { Text(title).font(.headline); Text(copy).font(.subheadline).foregroundStyle(CYFColor.muted) }; Spacer() } }
}
