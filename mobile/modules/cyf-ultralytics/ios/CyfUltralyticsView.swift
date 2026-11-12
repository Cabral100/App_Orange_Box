import ExpoModulesCore
import UltralyticsYOLO
import UIKit

@MainActor
public final class CyfUltralyticsView: ExpoView, YOLOViewDelegate {
  let onReady = EventDispatcher()
  let onDetection = EventDispatcher()
  let onError = EventDispatcher()

  private let yoloView = YOLOView(frame: .zero)
  private var requestedModelName = ""
  private var loadedModelName = ""
  private var isActive = true
  private var confidenceThreshold = 0.01
  private var lastEventAt = Date.distantPast
  private var lastPayload: [[String: Any]] = []

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .black
    clipsToBounds = true

    yoloView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    yoloView.delegate = self
    yoloView.showOverlays = false
    hideUltralyticsChrome()
    addSubview(yoloView)
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    yoloView.frame = bounds
  }

  public func setModelName(_ modelName: String) {
    let normalized = modelName.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !normalized.isEmpty, normalized != requestedModelName else { return }
    requestedModelName = normalized
    yoloView.setModel(modelPathOrName: normalized, task: .detect) { [weak self] result in
      Task { @MainActor in
        guard let self else { return }
        switch result {
        case .success:
          self.loadedModelName = normalized
          self.yoloView.setThresholds(numItems: 100, confidence: self.confidenceThreshold, iou: 0.5)
          self.hideUltralyticsChrome()
          self.onReady(["model": normalized, "runtime": "UltralyticsYOLO/CoreML"])
        case .failure(let error):
          self.onError([
            "code": "model_load_failed",
            "message": "Não foi possível carregar \(normalized).mlpackage: \(error.localizedDescription)"
          ])
        }
      }
    }
  }

  public func setActive(_ active: Bool) {
    guard active != isActive else { return }
    isActive = active
    active ? yoloView.resume() : yoloView.stop()
  }

  public func setTorch(_ enabled: Bool) {
    _ = yoloView.setTorchMode(enabled)
  }

  public func setConfidenceThreshold(_ threshold: Double) {
    confidenceThreshold = min(1, max(0, threshold))
    yoloView.setConfidenceThreshold(confidenceThreshold)
  }

  public func yoloView(_ view: YOLOView, didUpdatePerformance fps: Double, inferenceTime: Double) {
    // O desempenho acompanha o próximo evento de detecção para evitar eventos duplicados no JS.
  }

  public func yoloView(_ view: YOLOView, didReceiveResult result: YOLOResult) {
    let detections = result.boxes.map(Self.detectionPayload)
    lastPayload = detections

    let now = Date()
    guard now.timeIntervalSince(lastEventAt) >= 0.16 else { return }
    lastEventAt = now
    onDetection([
      "detections": detections,
      "detectionCount": detections.count,
      "topConfidence": detections.compactMap { $0["confidence"] as? Double }.max() ?? 0,
      "inferenceMs": result.inferenceMs > 0 ? result.inferenceMs : result.speed,
      "fps": result.fps ?? 0,
      "width": result.orig_shape.width,
      "height": result.orig_shape.height,
      "model": loadedModelName
    ])
  }

  public func capturePhoto(promise: Promise) {
    yoloView.capturePhoto { [weak self] image in
      Task { @MainActor in
        guard let self, let image, let data = image.jpegData(compressionQuality: 0.92) else {
          promise.reject("capture_failed", "Não foi possível capturar a foto da câmera Ultralytics.")
          return
        }
        do {
          let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("cyf-yolo-\(UUID().uuidString).jpg")
          try data.write(to: url, options: .atomic)
          promise.resolve([
            "uri": url.absoluteString,
            "width": image.size.width,
            "height": image.size.height,
            "detections": self.lastPayload
          ])
        } catch {
          promise.reject("capture_write_failed", error.localizedDescription)
        }
      }
    }
  }

  private func hideUltralyticsChrome() {
    yoloView.toolbar.isHidden = true
    yoloView.labelFPS.isHidden = true
    yoloView.labelBreakdown.isHidden = true
    yoloView.labelZoom.isHidden = true
    yoloView.labelName.isHidden = true
    yoloView.sliderConf.isHidden = true
    yoloView.labelSliderConf.isHidden = true
    yoloView.sliderIoU.isHidden = true
    yoloView.labelSliderIoU.isHidden = true
    yoloView.sliderNumItems.isHidden = true
    yoloView.labelSliderNumItems.isHidden = true
    yoloView.playButton.isHidden = true
    yoloView.pauseButton.isHidden = true
    yoloView.switchCameraButton.isHidden = true
    yoloView.shareButton.isHidden = true
    yoloView.infoButton.isHidden = true
  }

  private static func detectionPayload(_ box: Box) -> [String: Any] {
    let rect = box.xywh
    return [
      "class_id": box.index,
      "class_name": box.cls,
      "confidence": Double(box.conf),
      "bbox": [
        "x1": rect.minX,
        "y1": rect.minY,
        "x2": rect.maxX,
        "y2": rect.maxY
      ]
    ]
  }
}
