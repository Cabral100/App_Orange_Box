import SwiftUI
import UIKit
import UltralyticsYOLO

@MainActor
final class CameraEngine: ObservableObject {
    @Published var detections: [Detection] = []
    @Published var confidence = 0.0
    @Published var inferenceMS = 0.0
    @Published var modelReady = false
    @Published var errorMessage: String?
    weak var view: YOLOView?

    func attach(_ view: YOLOView) {
        self.view = view
        view.showOverlays = true
        view.setModel(modelPathOrName: "best", task: .detect) { [weak self] result in
            Task { @MainActor in
                guard let self else { return }
                switch result {
                case .success:
                    view.setThresholds(numItems: 100, confidence: 0.01, iou: 0.5)
                    self.hideChrome(view)
                    self.modelReady = true
                case .failure(let error): self.errorMessage = "Não foi possível carregar best.mlpackage: \(error.localizedDescription)"
                }
            }
        }
        hideChrome(view)
    }

    func update(_ result: YOLOResult) {
        detections = result.boxes.map(Self.detection).sorted { $0.confidence > $1.confidence }
        confidence = detections.first?.confidence ?? 0
        inferenceMS = result.inferenceMs > 0 ? result.inferenceMs : result.speed
    }

    func setTorch(_ enabled: Bool) { _ = view?.setTorchMode(enabled) }

    func capture() async -> UIImage? {
        await withCheckedContinuation { continuation in view?.capturePhoto { continuation.resume(returning: $0) } }
    }

    private func hideChrome(_ view: YOLOView) {
        [view.toolbar, view.labelFPS, view.labelBreakdown, view.labelZoom, view.labelName,
         view.sliderConf, view.labelSliderConf, view.sliderIoU, view.labelSliderIoU,
         view.sliderNumItems, view.labelSliderNumItems, view.playButton, view.pauseButton,
         view.switchCameraButton, view.shareButton, view.infoButton].forEach { $0.isHidden = true }
    }

    static func detection(_ box: Box) -> Detection {
        .init(classID: box.index, className: box.cls, confidence: Double(box.conf),
            box: .init(x1: box.xywh.minX, y1: box.xywh.minY, x2: box.xywh.maxX, y2: box.xywh.maxY))
    }
}

struct YOLOCameraBridge: UIViewRepresentable {
    @ObservedObject var engine: CameraEngine

    func makeCoordinator() -> Coordinator { Coordinator(engine: engine) }
    func makeUIView(context: Context) -> YOLOView {
        let view = YOLOView(frame: .zero)
        view.delegate = context.coordinator
        engine.attach(view)
        return view
    }
    func updateUIView(_ uiView: YOLOView, context: Context) { }

    final class Coordinator: NSObject, YOLOViewDelegate {
        let engine: CameraEngine
        init(engine: CameraEngine) { self.engine = engine }
        func yoloView(_ view: YOLOView, didUpdatePerformance fps: Double, inferenceTime: Double) { }
        func yoloView(_ view: YOLOView, didReceiveResult result: YOLOResult) {
            Task { @MainActor in engine.update(result) }
        }
    }
}

@MainActor
final class GalleryAnalyzer: ObservableObject {
    static let shared = GalleryAnalyzer()
    private var model: YOLO?
    private var loading = false

    func analyze(_ image: UIImage) async throws -> [Detection] {
        let model = try await loadModel()
        let result = await Task.detached { model(image) }.value
        return result.boxes.map(CameraEngine.detection).sorted { $0.confidence > $1.confidence }
    }

    private func loadModel() async throws -> YOLO {
        if let model, model.isLoaded { return model }
        if loading {
            while loading { try await Task.sleep(for: .milliseconds(100)) }
            if let model, model.isLoaded { return model }
        }
        loading = true
        defer { loading = false }
        return try await withCheckedThrowingContinuation { continuation in
            let candidate = YOLO("best", task: .detect, numItemsThreshold: 100) { [weak self] result in
                switch result {
                case .success(let ready): ready.setConfidenceThreshold(0.01); self?.model = ready; continuation.resume(returning: ready)
                case .failure(let error): continuation.resume(throwing: error)
                }
            }
            self.model = candidate
        }
    }
}
