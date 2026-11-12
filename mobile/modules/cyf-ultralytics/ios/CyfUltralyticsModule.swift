import ExpoModulesCore

public final class CyfUltralyticsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CyfUltralytics")

    View(CyfUltralyticsView.self) {
      Events("onReady", "onDetection", "onError")

      Prop("modelName") { (view: CyfUltralyticsView, modelName: String) in
        view.setModelName(modelName)
      }

      Prop("active") { (view: CyfUltralyticsView, active: Bool) in
        view.setActive(active)
      }

      Prop("torch") { (view: CyfUltralyticsView, enabled: Bool) in
        view.setTorch(enabled)
      }

      Prop("confidenceThreshold") { (view: CyfUltralyticsView, threshold: Double) in
        view.setConfidenceThreshold(threshold)
      }

      AsyncFunction("capturePhoto") { (view: CyfUltralyticsView, promise: Promise) in
        view.capturePhoto(promise: promise)
      }
    }
  }
}
