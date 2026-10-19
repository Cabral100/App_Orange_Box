import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { inferImage } from "../lib/api";
import { saveDetection } from "../lib/db";
import { findPlot, getCurrentPosition } from "../lib/geo";

const LIVE_CONFIDENCE_FLOOR = 0.01;
const AUTO_SAVE_THRESHOLD = 0.95;
const REARM_THRESHOLD = 0.8;
const REARM_STABLE_MS = 1500;
const FRAME_INTERVAL_MS = 950;
const MAX_FRAME_WIDTH = 960;
const REQUEST_TIMEOUT_MS = 15000;
const CAMERA_NOTICE_KEY = "cyf.camera.notice.v1";

function cameraNoticeAccepted() {
  try {
    return localStorage.getItem(CAMERA_NOTICE_KEY) === "accepted";
  } catch {
    return false;
  }
}

function friendlyCameraError(error) {
  const messages = {
    NotAllowedError: "Permita o acesso à câmera nas configurações do navegador.",
    NotFoundError: "Nenhuma câmera foi encontrada neste aparelho.",
    NotReadableError: "A câmera está sendo usada por outro aplicativo.",
    SecurityError: "Abra o CYF por HTTPS para liberar a câmera.",
    OverconstrainedError: "A câmera disponível não atende à configuração solicitada.",
  };
  return messages[error?.name] || "Não foi possível abrir a câmera. Tente novamente.";
}

function bestDetection(result) {
  return [...(result?.detections || [])].sort((a, b) => b.confidence - a.confidence)[0] || null;
}

function positionPayload(position, source = "geolocation") {
  if (!position) return null;
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    altitude: position.coords.altitude,
    source,
    capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
  };
}

function apiLocationPayload(location) {
  if (!location) return null;
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    altitude: location.altitude_m ?? null,
    accuracy: location.accuracy_m ?? null,
    source: location.source === "device" ? "geolocation" : "exif",
    capturedAt: new Date().toISOString(),
  };
}

export default function CameraScreen({ plots, onSaved, onOpenMap }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const viewportRef = useRef(null);
  const streamRef = useRef(null);
  const activeRef = useRef(true);
  const inFlightRef = useRef(false);
  const autoSaveArmedRef = useRef(true);
  const lowConfidenceSinceRef = useRef(null);
  const captureFlowOpenRef = useRef(false);
  const latestLocationRef = useRef(null);
  const [noticeAccepted, setNoticeAccepted] = useState(cameraNoticeAccepted);
  const [cameraState, setCameraState] = useState(() => cameraNoticeAccepted() ? "starting" : "idle");
  const [cameraError, setCameraError] = useState("");
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("Aponte para a superfície da laranja");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [torch, setTorch] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [gpsState, setGpsState] = useState("loading");
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [galleryPhoto, setGalleryPhoto] = useState(null);
  const [galleryPreviewUrl, setGalleryPreviewUrl] = useState("");
  const [captureFlow, setCaptureFlow] = useState(null);
  const [isMappingCapture, setIsMappingCapture] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraState("starting");
    setCameraError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("A câmera exige um navegador compatível e conexão HTTPS.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      if (!activeRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.() || {};
      setTorchAvailable(Boolean(capabilities.torch));
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraState("ready");
    } catch (error) {
      setCameraState("error");
      setCameraError(friendlyCameraError(error));
    }
  }, [stopCamera]);

  useEffect(() => {
    if (!noticeAccepted) return undefined;
    activeRef.current = true;
    startCamera();
    return () => {
      activeRef.current = false;
      stopCamera();
    };
  }, [noticeAccepted, startCamera, stopCamera]);

  useEffect(() => {
    if (!noticeAccepted) return undefined;
    if (!navigator.geolocation) {
      setGpsState("unavailable");
      return undefined;
    }
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        latestLocationRef.current = position;
        setGpsState("ready");
      },
      () => setGpsState("unavailable"),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [noticeAccepted]);

  useEffect(() => {
    if (!viewportRef.current) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!galleryPhoto) {
      setGalleryPreviewUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(galleryPhoto);
    setGalleryPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [galleryPhoto]);

  useEffect(() => {
    if (captureFlow?.phase !== "success") return undefined;
    const timeout = window.setTimeout(() => {
      setCaptureFlow((current) => current ? { ...current, phase: "choice" } : null);
    }, 1050);
    return () => window.clearTimeout(timeout);
  }, [captureFlow?.phase]);

  const captureFrame = useCallback(async (maxWidth = MAX_FRAME_WIDTH) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || !video.videoWidth) {
      throw new Error("A câmera ainda está preparando a imagem.");
    }
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d", { alpha: false });
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Falha ao capturar o quadro.")),
        "image/jpeg",
        0.84,
      );
    });
  }, []);

  const resolveLocation = useCallback(async (inferenceLocation, source) => {
    const fromApi = apiLocationPayload(inferenceLocation);
    if (fromApi) return fromApi;
    // Uma foto antiga sem EXIF não pode receber o GPS atual do operador.
    if (source === "gallery") return null;
    const cached = latestLocationRef.current;
    if (cached && Date.now() - cached.timestamp < 20000) return positionPayload(cached);
    try {
      return positionPayload(await getCurrentPosition());
    } catch {
      return null;
    }
  }, []);

  const persistFrame = useCallback(async (blob, inference, source, { allowEmpty = false } = {}) => {
    const top = bestDetection(inference);
    const allDetections = Array.isArray(inference.detections) ? inference.detections : [];
    const confirmedDetections = allDetections.filter((detection) => detection.confidence >= AUTO_SAVE_THRESHOLD);
    if (!allowEmpty && confirmedDetections.length === 0) return false;
    const location = await resolveLocation(inference.location, source);
    const plot = findPlot(plots, location);
    const record = {
      id: crypto.randomUUID(),
      capturedAt: new Date().toISOString(),
      image: blob,
      imageType: blob.type || "image/jpeg",
      width: inference.quality?.metrics?.width || null,
      height: inference.quality?.metrics?.height || null,
      detections: confirmedDetections,
      topConfidence: top?.confidence || 0,
      location,
      plotId: plot?.id || null,
      plotName: plot?.name || null,
      manualPlotId: "unassigned",
      mapVisible: false,
      quality: inference.quality,
      inferenceMs: inference.inference_ms,
      captureSource: source,
      syncState: "local",
    };
    await saveDetection(record);
    await onSaved();
    captureFlowOpenRef.current = true;
    setCaptureFlow({
      phase: "success",
      record,
      plot,
      confirmedCount: confirmedDetections.length,
    });
    return true;
  }, [onSaved, plots, resolveLocation]);

  const analyzeBlob = useCallback(async (blob, { source = "camera", manual = false } = {}) => {
    if (captureFlowOpenRef.current) return null;
    if (inFlightRef.current && !manual) return null;
    if (inFlightRef.current && manual) {
      setIsAnalyzing(true);
      setMessage("Aguardando a análise atual…");
      const startedAt = Date.now();
      while (inFlightRef.current && activeRef.current && Date.now() - startedAt < 15000) {
        await new Promise((resolve) => window.setTimeout(resolve, 60));
      }
      if (inFlightRef.current || !activeRef.current) {
        setIsAnalyzing(false);
        setMessage("O modelo ainda está ocupado. Tente novamente.");
        return null;
      }
      if (captureFlowOpenRef.current) {
        setIsAnalyzing(false);
        return null;
      }
    }
    inFlightRef.current = true;
    if (manual) setIsAnalyzing(true);
    try {
      const cachedPosition = latestLocationRef.current;
      const freshPosition = cachedPosition && Date.now() - cachedPosition.timestamp < 20000
        ? cachedPosition
        : null;
      const controller = new AbortController();
      const requestTimeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let inference;
      try {
        inference = await inferImage(blob, {
          confidence: LIVE_CONFIDENCE_FLOOR,
          annotated: false,
          location: source === "camera" && freshPosition ? positionPayload(freshPosition) : null,
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(requestTimeout);
      }
      if (!activeRef.current) return inference;
      setResult(inference);
      const top = bestDetection(inference);
      const confidence = top?.confidence || 0;
      const now = Date.now();
      if (confidence < REARM_THRESHOLD) {
        if (lowConfidenceSinceRef.current == null) lowConfidenceSinceRef.current = now;
        if (now - lowConfidenceSinceRef.current >= REARM_STABLE_MS) autoSaveArmedRef.current = true;
      } else {
        lowConfidenceSinceRef.current = null;
      }
      const automaticCapture = confidence >= AUTO_SAVE_THRESHOLD && autoSaveArmedRef.current;
      if (manual || automaticCapture) {
        // Salva exatamente o quadro analisado para que evidência e caixas não
        // apontem para momentos diferentes do vídeo.
        const saved = await persistFrame(blob, inference, source, { allowEmpty: manual });
        if (saved) {
          autoSaveArmedRef.current = false;
          lowConfidenceSinceRef.current = null;
        }
      } else if (!top) {
        setMessage("Nenhum sinal detectado neste quadro");
      } else {
        setMessage("Mantenha a câmera estável e aproxime");
      }
      return inference;
    } catch (error) {
      if (activeRef.current) {
        setMessage(error.name === "AbortError"
          ? "A análise demorou demais. Verifique a conexão."
          : error.message || "Modelo indisponível");
      }
      return null;
    } finally {
      inFlightRef.current = false;
      if (manual && activeRef.current) setIsAnalyzing(false);
    }
  }, [persistFrame]);

  useEffect(() => {
    if (cameraState !== "ready" || galleryPhoto || captureFlow) return undefined;
    let timer;
    let cancelled = false;
    const run = async () => {
      try {
        const blob = await captureFrame();
        await analyzeBlob(blob);
      } catch {
        // O próximo quadro tenta novamente sem interromper a câmera.
      }
      if (!cancelled) timer = window.setTimeout(run, FRAME_INTERVAL_MS);
    };
    timer = window.setTimeout(run, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [analyzeBlob, cameraState, captureFlow, captureFrame, galleryPhoto]);

  async function manualCapture() {
    try {
      setMessage("Analisando foto…");
      await analyzeBlob(await captureFrame(), { manual: true });
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function selectPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setGalleryPhoto(file);
    setResult(null);
    setMessage("Lendo foto e localização EXIF…");
    await analyzeBlob(file, { source: "gallery", manual: true });
  }

  function closeGalleryPreview() {
    setGalleryPhoto(null);
    setResult(null);
    setMessage("Aponte para a superfície da laranja");
  }

  function returnToCamera() {
    captureFlowOpenRef.current = false;
    setCaptureFlow(null);
    setIsMappingCapture(false);
    setGalleryPhoto(null);
    setResult(null);
    setMessage("Aponte para a superfície da laranja");
  }

  async function saveCaptureToMap() {
    if (!captureFlow || isMappingCapture) return;
    setIsMappingCapture(true);
    try {
      if (captureFlow.record.location) {
        const mappedRecord = {
          ...captureFlow.record,
          mapVisible: true,
          manualPlotId: captureFlow.plot?.id || null,
          plotId: captureFlow.plot?.id || null,
          plotName: captureFlow.plot?.name || null,
          mapConfirmedAt: new Date().toISOString(),
        };
        await saveDetection(mappedRecord);
        await onSaved();
      }
      returnToCamera();
      onOpenMap?.();
    } catch (error) {
      setIsMappingCapture(false);
      setCaptureFlow((current) => current ? {
        ...current,
        error: error.message || "Não foi possível atualizar o registro no mapa.",
      } : null);
    }
  }

  function acceptCameraNotice() {
    try {
      localStorage.setItem(CAMERA_NOTICE_KEY, "accepted");
    } catch {
      // O navegador ainda pode conceder as permissões sem persistir o aviso.
    }
    setCameraState("starting");
    setNoticeAccepted(true);
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torch;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorch(next);
    } catch {
      setTorchAvailable(false);
    }
  }

  const top = bestDetection(result);
  const confidence = top?.confidence || 0;
  const percentage = confidence * 100;
  const percentageLabel = confidence >= 0.9 ? percentage.toFixed(1) : Math.round(percentage).toString();
  const confirmedCount = result?.detections?.filter((detection) => detection.confidence >= AUTO_SAVE_THRESHOLD).length || 0;
  const confidenceTone = confidence >= AUTO_SAVE_THRESHOLD ? "confirmed" : confidence >= 0.5 ? "watch" : "idle";
  const boxes = useMemo(() => {
    const width = result?.quality?.metrics?.width;
    const height = result?.quality?.metrics?.height;
    if (!width || !height || !viewportSize.width || !viewportSize.height) return [];
    const scale = galleryPhoto
      ? Math.min(viewportSize.width / width, viewportSize.height / height)
      : Math.max(viewportSize.width / width, viewportSize.height / height);
    const renderWidth = width * scale;
    const renderHeight = height * scale;
    const offsetX = (viewportSize.width - renderWidth) / 2;
    const offsetY = (viewportSize.height - renderHeight) / 2;
    return (result.detections || []).map((detection, index) => ({
      ...detection,
      key: `${index}-${detection.bbox.x1}`,
      style: {
        left: offsetX + detection.bbox.x1 * scale,
        top: offsetY + detection.bbox.y1 * scale,
        width: (detection.bbox.x2 - detection.bbox.x1) * scale,
        height: (detection.bbox.y2 - detection.bbox.y1) * scale,
      },
    }));
  }, [galleryPhoto, result, viewportSize]);

  return (
    <section className={`camera-screen ${galleryPhoto ? "preview-mode" : ""}`} ref={viewportRef}>
      <video ref={videoRef} className="camera-video" autoPlay muted playsInline aria-label="Visualização da câmera traseira" />
      {galleryPreviewUrl && <img className="gallery-preview" src={galleryPreviewUrl} alt="Foto escolhida para análise" />}
      <canvas ref={canvasRef} hidden />
      <div className="camera-shade" />

      <header className={`confidence-panel ${confidenceTone}`}>
        <div className="confidence-copy">
          <span className="live-dot" />
          <div>
            <small>{galleryPhoto ? "ANÁLISE DA FOTO" : "ANÁLISE AO VIVO"}</small>
            <strong>{confirmedCount ? `${confirmedCount} sinal(is) acima do limiar` : top ? "Possível sinal de ácaro" : "Procurando por sinais"}</strong>
          </div>
          <b>{percentageLabel}%</b>
        </div>
        <div className="confidence-track" aria-label={`Confiança do modelo: ${percentageLabel}%`}>
          <span style={{ width: `${percentage}%` }} />
        </div>
        <div className="confidence-scale"><span>0</span><span>AUTO EM 95%</span><span>100</span></div>
      </header>

      <div className="scan-frame" aria-hidden="true">
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        {cameraState === "ready" && !galleryPhoto && <span className="scan-line" />}
      </div>

      <div className="detection-layer" aria-hidden="true">
        {boxes.map((box) => (
          <div className="detection-box" key={box.key} style={box.style}>
            <span>ÁCARO {(box.confidence * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>

      {cameraState !== "ready" && !galleryPhoto && (
        <div className="camera-state-card">
          <span className={cameraState === "starting" ? "loading-ring spin" : "camera-state-symbol"} aria-hidden="true">{cameraState === "error" ? "!" : ""}</span>
          <h2>{cameraState === "starting" ? "Abrindo a câmera" : "Câmera não disponível"}</h2>
          <p>{cameraError || "Autorize o acesso quando o navegador solicitar."}</p>
          {cameraState === "error" && <button className="button button-light" onClick={startCamera}>Tentar novamente</button>}
        </div>
      )}

      <div className="camera-location-chip">
        {galleryPhoto
          ? !result ? "Lendo GPS do EXIF" : result.location?.source === "exif" ? "EXIF localizado" : "Foto sem GPS EXIF"
          : gpsState === "ready" ? "GPS pronto" : gpsState === "unavailable" ? "GPS indisponível" : "Obtendo localização"}
      </div>

      <div className="camera-guidance">
        <span>{message}</span>
        {result?.quality?.status === "inadequate" && <em>Melhore luz e foco</em>}
      </div>

      {!galleryPhoto ? <div className="camera-controls">
        <label className="camera-tool" aria-label="Escolher foto da galeria">
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} hidden />
          <span>Galeria</span>
        </label>

        <button
          className={`shutter ${isAnalyzing ? "working" : ""}`}
          type="button"
          onClick={manualCapture}
          disabled={cameraState !== "ready" || isAnalyzing}
          aria-label="Analisar agora"
        >
          <span aria-hidden="true">{isAnalyzing ? "" : confidence >= AUTO_SAVE_THRESHOLD ? "✓" : ""}</span>
        </button>

        <button className="camera-tool" type="button" onClick={toggleTorch} disabled={!torchAvailable}>
          <span>{torchAvailable ? torch ? "Desligar luz" : "Ligar luz" : "Sem flash"}</span>
        </button>
      </div> : (
        <div className="gallery-actions">
          <label className="secondary-camera-action">
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} hidden />
            Escolher outra
          </label>
          <button type="button" className="primary-camera-action" onClick={closeGalleryPreview}>Voltar à câmera</button>
        </div>
      )}

      {!noticeAccepted && (
        <div className="camera-consent" role="dialog" aria-modal="true" aria-labelledby="camera-consent-title">
          <div>
            <p className="overline">ANTES DA PRIMEIRA INSPEÇÃO</p>
            <h2 id="camera-consent-title">Câmera, foto e localização</h2>
            <p>O CYF usa a câmera para analisar a laranja. Ao vivo, uma foto é salva automaticamente quando uma detecção alcança 95% de confiança do modelo.</p>
            <p>Ao tocar no botão de captura, a vistoria também pode ser salva com zero detecções confirmadas, sem inventar uma ocorrência.</p>
            <p>Capturas ao vivo usam o GPS do celular; fotos importadas usam somente o GPS existente no EXIF. O resultado é uma triagem experimental.</p>
            <button className="primary-action" type="button" onClick={acceptCameraNotice}>Entendi e quero continuar</button>
            <small>O navegador ainda solicitará as permissões do sistema. Você pode recusá-las.</small>
          </div>
        </div>
      )}

      {captureFlow && (
        <div className={`capture-confirmation capture-${captureFlow.phase}`}>
          {captureFlow.phase === "success" ? (
            <div className="capture-success-content" role="status" aria-live="assertive">
              <span className="capture-success-check" aria-hidden="true">✓</span>
              <h2>Imagem capturada com sucesso</h2>
              <p>{captureFlow.confirmedCount > 0
                ? `${captureFlow.confirmedCount} praga(s) confirmada(s) no registro.`
                : "Vistoria salva com zero pragas confirmadas."}</p>
            </div>
          ) : (
            <div className="capture-choice-layout" role="dialog" aria-modal="true" aria-labelledby="capture-choice-title">
              <div className="capture-choice-summary">
                <span aria-hidden="true">✓</span>
                <div>
                  <small>REGISTRO SALVO NESTE APARELHO</small>
                  <strong>{captureFlow.confirmedCount > 0
                    ? `${captureFlow.confirmedCount} praga(s) confirmada(s)`
                    : "Nenhuma praga confirmada"}</strong>
                </div>
              </div>
              <div className="capture-choice-sheet">
                <p className="overline">PRÓXIMO PASSO</p>
                <h2 id="capture-choice-title">Deseja incluir no mapa?</h2>
                <p className="capture-map-context">
                  {!captureFlow.record.location
                    ? "A foto não possui coordenada GPS/EXIF. Ela permanece nos relatórios, mas não pode ser posicionada automaticamente."
                    : captureFlow.plot
                      ? `A coordenada está dentro de ${captureFlow.plot.name}. Ao confirmar, a vistoria passa a contar na cor deste talhão.`
                      : "A coordenada foi salva, mas nenhum limite de talhão contém esse ponto. Abra o mapa para desenhar ou importar o limite; um único ponto não cria um polígono."}
                </p>
                {captureFlow.record.location && (
                  <p className="capture-location-source">
                    Coordenada preservada do {captureFlow.record.location.source === "exif" ? "EXIF da foto" : "GPS do celular"}.
                  </p>
                )}
                {captureFlow.error && <p className="capture-flow-error" role="alert">{captureFlow.error}</p>}
                <div className="capture-choice-actions">
                  <button className="capture-map-action" type="button" onClick={saveCaptureToMap} disabled={isMappingCapture} autoFocus>
                    {isMappingCapture
                      ? "Salvando…"
                      : captureFlow.record.location
                        ? captureFlow.plot ? "Salvar e ver no mapa" : "Abrir mapa e delimitar talhão"
                        : "Abrir mapa sem este ponto"}
                  </button>
                  <button className="capture-continue-action" type="button" onClick={returnToCamera} disabled={isMappingCapture}>
                    Só guardar o registro e continuar
                  </button>
                </div>
                <small className="capture-choice-note">Sem limite desenhado ou GeoJSON importado, o CYF não inventa a área do talhão.</small>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
