import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Dimensions, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { CyfUltralyticsView, isCyfUltralyticsAvailable, type CyfUltralyticsViewRef, type UltralyticsDetectionPayload } from "../../modules/cyf-ultralytics";
import { CONFIRMED_THRESHOLD } from "../analytics";
import { findPlot } from "../geo";
import { persistInspectionImage } from "../storage";
import type { Coordinates, InferenceResult, InspectionRecord, PhotoAnalyzer, Plot } from "../types";
import { colors, fonts, radii, shadow } from "../theme";

const SCAN_INTERVAL_MS = 3500;
const LOCATION_TIMEOUT_MS = 8000;
const screenWidth = Dimensions.get("window").width;
const scanSize = Math.min(screenWidth - 64, 350);

type Props = {
  plots: Plot[];
  active: boolean;
  onBack: () => void;
  onCaptured: (record: InspectionRecord) => Promise<void>;
  analyzer: PhotoAnalyzer;
  prepareAnalyzer: () => Promise<unknown>;
  demoMode?: boolean;
};

function id() {
  return globalThis.crypto?.randomUUID?.() || `inspection-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function fromPosition(position: Location.LocationObject | null): Coordinates | null {
  if (!position) return null;
  return { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, altitude: position.coords.altitude, source: "gps" };
}

function exifCoordinate(exif: Record<string, unknown> | null | undefined): Coordinates | null {
  if (!exif) return null;
  let latitude = exifNumber(exif.GPSLatitude ?? exif.latitude);
  let longitude = exifNumber(exif.GPSLongitude ?? exif.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (String(exif.GPSLatitudeRef || "").toUpperCase() === "S") latitude = -Math.abs(latitude);
  if (String(exif.GPSLongitudeRef || "").toUpperCase() === "W") longitude = -Math.abs(longitude);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude, accuracy: null, altitude: null, source: "exif" };
}

function exifNumber(value: unknown): number {
  if (Array.isArray(value) && value.length >= 3) {
    const degrees = Number(value[0]);
    const minutes = Number(value[1]);
    const seconds = Number(value[2]);
    if ([degrees, minutes, seconds].every(Number.isFinite)) return Math.abs(degrees) + minutes / 60 + seconds / 3600;
  }
  if (typeof value === "string" && value.includes(",")) {
    const parts = value.split(",").map((part) => Number(part.trim()));
    if (parts.length >= 3 && parts.every(Number.isFinite)) return Math.abs(parts[0] || 0) + (parts[1] || 0) / 60 + (parts[2] || 0) / 3600;
  }
  return Number(value);
}

export function CameraScreen({ plots, active, onBack, onCaptured, analyzer, prepareAnalyzer, demoMode = false }: Props) {
  const cameraRef = useRef<CameraView>(null);
  const yoloCameraRef = useRef<CyfUltralyticsViewRef>(null);
  const inFlightRef = useRef(false);
  const armedRef = useRef(true);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [analysis, setAnalysis] = useState<InferenceResult | null>(null);
  const [working, setWorking] = useState(false);
  const [success, setSuccess] = useState(false);
  const [help, setHelp] = useState(false);
  const [message, setMessage] = useState("Aponte para a superfície da laranja");
  const [nativeFailed, setNativeFailed] = useState(false);
  const useNativeYolo = Platform.OS === "ios" && isCyfUltralyticsAvailable && !demoMode && !nativeFailed;

  useEffect(() => {
    if (useNativeYolo) {
      setMessage("Carregando modelo Ultralytics no iPhone…");
      return;
    }
    prepareAnalyzer().then(() => setModelReady(true)).catch((error) => setMessage(error instanceof Error ? error.message : "Não foi possível abrir a análise offline."));
  }, [prepareAnalyzer, useNativeYolo]);

  useEffect(() => {
    let subscription: Location.LocationSubscription | undefined;
    Location.requestForegroundPermissionsAsync().then(async ({ granted }) => {
      if (!granted) return;
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(() => null);
      setLocation(fromPosition(current));
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 2, timeInterval: 5000 },
        (position) => setLocation(fromPosition(position)),
      );
    });
    return () => subscription?.remove();
  }, []);

  const confidence = analysis?.detections[0]?.confidence || 0;
  const confidencePercent = Math.round(confidence * 100);
  const guidance = confidence >= CONFIRMED_THRESHOLD
    ? "Boa distância — mantenha firme"
    : confidence > 0
      ? "Aproxime-se da praga e mantenha firme"
      : "Aponte e aproxime-se da praga";

  const resolveCurrentLocation = useCallback(async () => {
    const freshPromise = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), LOCATION_TIMEOUT_MS));
    const fresh = await Promise.race([freshPromise, timeoutPromise]).catch(() => null);
    const fallback = fresh || await Location.getLastKnownPositionAsync({ maxAge: 30_000, requiredAccuracy: 200 }).catch(() => null);
    const coordinates = fromPosition(fallback) || location;
    if (coordinates) setLocation(coordinates);
    return coordinates;
  }, [location]);

  const storeAnalysis = useCallback(async (preparedUri: string, result: InferenceResult, source: "camera" | "gallery", captureLocation: Coordinates | null) => {
    const recordId = id();
    const imageUri = await persistInspectionImage(preparedUri, recordId);
    const confirmed = result.detections.filter((detection) => detection.confidence >= CONFIRMED_THRESHOLD);
    const plot = findPlot(plots, captureLocation);
    const record: InspectionRecord = {
      id: recordId, capturedAt: new Date().toISOString(), imageUri, width: 640, height: 640,
      detections: confirmed, topConfidence: result.detections[0]?.confidence || 0,
      location: captureLocation, plotId: plot?.id || null, mapVisible: false, source, syncState: "local", demo: demoMode,
    };
    setSuccess(true);
    await new Promise((resolve) => setTimeout(resolve, 850));
    await onCaptured(record);
    setSuccess(false);
  }, [demoMode, onCaptured, plots]);

  const receiveNativeDetection = useCallback((payload: UltralyticsDetectionPayload) => {
    const detections = [...payload.detections].sort((first, second) => second.confidence - first.confidence);
    setAnalysis({
      status: detections.length ? "detected" : "no_detection",
      detections,
      detection_count: detections.length,
      confidence_threshold: 0.01,
      inference_ms: payload.inferenceMs,
      latency_ms: payload.inferenceMs,
      quality: {
        status: "adequate",
        warnings: [],
        metrics: { width: payload.width || 640, height: payload.height || 640, brightness: 0, contrast: 0 },
      },
      location: null,
    });
    setMessage(payload.topConfidence >= CONFIRMED_THRESHOLD ? "Boa distância — mantenha firme" : payload.topConfidence > 0 ? "Aproxime-se da praga e mantenha firme" : "Aponte e aproxime-se da praga");
  }, []);

  const analyzePhoto = useCallback(async (
    photo: { uri: string; width: number; height: number },
    options: { manual: boolean; source: "camera" | "gallery"; captureLocation: Coordinates | null },
  ) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (options.manual) setWorking(true);
    try {
      setMessage("Analisando no aparelho…");
      const offline = await analyzer(photo.uri, photo.width, photo.height);
      setAnalysis(offline.result);
      const best = offline.result.detections[0]?.confidence || 0;
      if (best < 0.8) armedRef.current = true;
      if (best > 0 && best < CONFIRMED_THRESHOLD) {
        armedRef.current = true;
        setMessage("Confiança baixa — aproxime-se da praga e mantenha firme");
        return;
      }
      if (options.manual || (best >= CONFIRMED_THRESHOLD && armedRef.current)) {
        armedRef.current = false;
        const captureLocation = options.source === "camera" ? await resolveCurrentLocation() : options.captureLocation;
        if (!captureLocation) {
          armedRef.current = true;
          setMessage("Ative a localização para registrar as coordenadas da foto");
          if (options.manual) Alert.alert("Localização necessária", "Ative a localização precisa para salvar a inspeção no ponto correto do mapa.");
          return;
        }
        await storeAnalysis(offline.imageUri, offline.result, options.source, captureLocation);
      } else {
        setMessage(best > 0 ? "Possível sinal — aproxime e estabilize" : "Nenhum sinal neste quadro");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na análise offline.");
    } finally {
      inFlightRef.current = false;
      setWorking(false);
    }
  }, [analyzer, resolveCurrentLocation, storeAnalysis]);

  const capture = useCallback(async (manual: boolean) => {
    if (!ready || !modelReady || inFlightRef.current) return;
    if (useNativeYolo) {
      if (!yoloCameraRef.current || (!manual && confidence < CONFIRMED_THRESHOLD)) return;
      inFlightRef.current = true;
      if (manual) setWorking(true);
      try {
        const photo = await yoloCameraRef.current.capturePhoto();
        const detections = [...photo.detections].sort((first, second) => second.confidence - first.confidence);
        const best = detections[0]?.confidence || 0;
        if (best > 0 && best < CONFIRMED_THRESHOLD) {
          armedRef.current = true;
          setMessage("Confiança baixa — aproxime-se da praga e mantenha firme");
          return;
        }
        if (!manual && !armedRef.current) return;
        armedRef.current = false;
        const captureLocation = await resolveCurrentLocation();
        if (!captureLocation) {
          armedRef.current = true;
          setMessage("Ative a localização para registrar as coordenadas da foto");
          if (manual) Alert.alert("Localização necessária", "Ative a localização precisa para salvar a inspeção no ponto correto do mapa.");
          return;
        }
        const result: InferenceResult = {
          status: detections.length ? "detected" : "no_detection",
          detections,
          detection_count: detections.length,
          confidence_threshold: 0.01,
          inference_ms: 0,
          latency_ms: 0,
          quality: { status: "adequate", warnings: [], metrics: { width: photo.width, height: photo.height, brightness: 0, contrast: 0 } },
          location: null,
        };
        await storeAnalysis(photo.uri, result, "camera", captureLocation);
      } catch (error) {
        armedRef.current = true;
        setMessage(error instanceof Error ? error.message : "Falha ao capturar com Ultralytics.");
      } finally {
        inFlightRef.current = false;
        setWorking(false);
      }
      return;
    }
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: manual ? 0.9 : 0.55, skipProcessing: false });
    if (photo) await analyzePhoto(photo, { manual, source: "camera", captureLocation: location });
  }, [analyzePhoto, confidence, location, modelReady, ready, resolveCurrentLocation, storeAnalysis, useNativeYolo]);

  useEffect(() => {
    if (demoMode || !active || !ready || !modelReady || success) return undefined;
    const interval = setInterval(() => { capture(false).catch(() => undefined); }, SCAN_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [active, capture, demoMode, modelReady, ready, success]);

  async function chooseFromGallery() {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Acesso às fotos necessário", "Permita o acesso à galeria nos Ajustes do iPhone para analisar uma imagem existente.");
        return;
      }
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, exif: true, allowsEditing: false, selectionLimit: 1 });
      const asset = picked.canceled ? null : picked.assets[0];
      if (!asset) return;
      const exifLocation = exifCoordinate(asset.exif as Record<string, unknown> | null);
      const captureLocation = exifLocation || await resolveCurrentLocation();
      if (!exifLocation && captureLocation) {
        Alert.alert("Foto sem coordenadas EXIF", "Esta imagem não informa onde foi tirada. O app usará sua localização atual.");
      }
      if (!captureLocation) {
        Alert.alert("Localização indisponível", "A foto não possui GPS/EXIF e sua localização atual não pôde ser obtida.");
        return;
      }
      await analyzePhoto({ uri: asset.uri, width: asset.width, height: asset.height }, { manual: true, source: "gallery", captureLocation });
    } catch (error) {
      Alert.alert("Galeria indisponível", error instanceof Error ? error.message : "Não foi possível abrir suas fotos.");
    }
  }

  if (!permission) return <View style={styles.permission}><ActivityIndicator color={colors.green} /></View>;
  if (!permission.granted) {
    return <View style={styles.permission}><MaterialCommunityIcons name="camera-lock-outline" size={54} color={colors.green} /><Text style={styles.permissionTitle}>Permita o uso da câmera</Text><Text style={styles.permissionCopy}>As imagens ficam no aparelho e são usadas somente durante a inspeção.</Text><Pressable style={styles.permissionButton} onPress={requestPermission}><Text style={styles.permissionButtonText}>Permitir câmera</Text></Pressable></View>;
  }

  return (
    <View style={styles.page}>
      {useNativeYolo ? <CyfUltralyticsView
        ref={yoloCameraRef}
        style={StyleSheet.absoluteFill}
        modelName="best"
        active={active}
        torch={torch}
        confidenceThreshold={0.01}
        onReady={(event) => { setReady(true); setModelReady(true); setMessage(`${event.nativeEvent.runtime} pronto`); }}
        onDetection={(event) => receiveNativeDetection(event.nativeEvent)}
        onError={(event) => { setNativeFailed(true); setReady(false); setModelReady(false); setMessage(`${event.nativeEvent.message} Usando câmera compatível.`); }}
      /> : <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" active={active} enableTorch={torch} autofocus="on" onCameraReady={() => setReady(true)} onMountError={(event) => setMessage(event.message)} />}
      <View style={styles.shade} pointerEvents="none" />

      <View style={styles.topLeftActions}>
        <CameraButton icon="chevron-left" label="Voltar ao histórico" onPress={onBack} />
      </View>

      <View style={styles.topRightActions}>
        <View style={styles.detectorPill} accessibilityLabel={`Confiança da análise ${confidencePercent}%`}>
          <View style={styles.detectorHead}><Text style={styles.detectorText}>{confidence ? "Ácaro" : "Buscando"}</Text><Text style={styles.detectorValue}>{confidencePercent}%</Text></View>
          <View style={styles.miniTrack}><View style={[styles.miniFill, { width: `${Math.max(3, confidencePercent)}%` }]} /></View>
        </View>
        <CameraButton icon="information-outline" label="Como funciona a câmera" onPress={() => setHelp(true)} />
      </View>

      <View style={[styles.guidancePill, confidence >= CONFIRMED_THRESHOLD && styles.guidanceReady]} pointerEvents="none">
        <MaterialCommunityIcons name={confidence >= CONFIRMED_THRESHOLD ? "check-circle-outline" : "arrow-expand"} size={16} color={colors.white} />
        <Text style={styles.guidanceText}>{guidance}</Text>
      </View>

      <View style={[styles.scanBox, { width: scanSize, height: scanSize }]} pointerEvents="none">
        <View style={[styles.corner, styles.topLeft]} /><View style={[styles.corner, styles.topRight]} />
        <View style={[styles.corner, styles.bottomLeft]} /><View style={[styles.corner, styles.bottomRight]} />
        <View style={styles.focusCircle}><View style={styles.focusDot} /></View>
        {(analysis?.detections || []).slice(0, 8).map((detection, index) => <View key={`${detection.bbox.x1}-${index}`} style={[styles.box, {
          left: detection.bbox.x1 / 640 * scanSize, top: detection.bbox.y1 / 640 * scanSize,
          width: (detection.bbox.x2 - detection.bbox.x1) / 640 * scanSize, height: (detection.bbox.y2 - detection.bbox.y1) / 640 * scanSize,
        }]} />)}
      </View>

      <View style={styles.messagePill}><View style={[styles.liveDot, modelReady && styles.liveDotReady]} /><Text numberOfLines={1} style={styles.message}>{message}</Text>{demoMode ? <Text style={styles.demo}>DEMO</Text> : null}</View>
      <View style={styles.controls}>
        <Pressable accessibilityLabel="Abrir galeria" onPress={chooseFromGallery} style={({ pressed }) => [styles.sideControl, pressed && styles.pressed]}><MaterialCommunityIcons name="image-outline" size={28} color={colors.white} /><Text style={styles.controlLabel}>Galeria</Text></Pressable>
        <Pressable disabled={working || !modelReady} onPress={() => capture(true)} accessibilityLabel="Capturar e analisar" style={({ pressed }) => [styles.shutterOuter, pressed && styles.pressed]}><View style={styles.shutterInner}>{working ? <ActivityIndicator color={colors.green} /> : null}</View></Pressable>
        <Pressable accessibilityLabel={torch ? "Desligar flash" : "Ligar flash"} onPress={() => setTorch((value) => !value)} style={({ pressed }) => [styles.sideControl, torch && styles.sideControlActive, pressed && styles.pressed]}><MaterialCommunityIcons name={torch ? "flash" : "flash-off"} size={28} color={torch ? colors.orange : colors.white} /><Text style={styles.controlLabel}>Flash</Text></Pressable>
      </View>

      <Modal visible={help} transparent animationType="fade" onRequestClose={() => setHelp(false)}>
        <View style={styles.modalShade}><View style={styles.helpCard}><View style={styles.helpHeader}><Text style={styles.helpTitle}>Como inspecionar</Text><Pressable accessibilityLabel="Fechar informações" onPress={() => setHelp(false)}><MaterialCommunityIcons name="close" size={26} color={colors.ink} /></Pressable></View>
          <HelpRow icon="fruit-citrus" title="Aproxime a laranja" copy="Centralize a casca dentro das quatro marcas brancas." />
          <HelpRow icon="motion-sensor" title="Aguarde o sinal" copy="A barra cresce conforme a confiança aumenta. Com 95% ou mais, a foto é salva." />
          <HelpRow icon="map-marker-radius" title="Confirme o talhão" copy="Depois da foto, desenhe o limite ou informe a área em metros quadrados." />
          <View style={styles.helpNote}><MaterialCommunityIcons name="cloud-off-outline" size={18} color={colors.green} /><Text style={styles.helpNoteText}>{useNativeYolo ? "A câmera usa UltralyticsYOLO + Core ML em tempo real e funciona offline no iPhone." : "Câmera e registros funcionam offline. No Expo Go, a detecção permanece demonstrativa."}</Text></View>
          <Pressable onPress={() => setHelp(false)} style={styles.helpButton}><Text style={styles.helpButtonText}>Entendi</Text></Pressable>
        </View></View>
      </Modal>

      {success ? <View style={styles.success}><View style={styles.successCheck}><MaterialCommunityIcons name="check" size={74} color={colors.green} /></View><Text style={styles.successTitle}>Imagem capturada</Text><Text style={styles.successCopy}>Registro salvo neste aparelho</Text></View> : null}
    </View>
  );
}

function CameraButton({ icon, label, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void }) {
  return <Pressable accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.cameraButton, pressed && styles.pressed]}><MaterialCommunityIcons name={icon} size={27} color={colors.white} /></Pressable>;
}

function HelpRow({ icon, title, copy }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; copy: string }) {
  return <View style={styles.helpRow}><View style={styles.helpIcon}><MaterialCommunityIcons name={icon} size={22} color={colors.green} /></View><View style={styles.helpCopyWrap}><Text style={styles.helpRowTitle}>{title}</Text><Text style={styles.helpRowCopy}>{copy}</Text></View></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#000" }, shade: { position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.09)" },
  topLeftActions: { position: "absolute", top: 52, left: 16 }, cameraButton: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(8,12,9,0.48)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  topRightActions: { position: "absolute", top: 52, right: 16, flexDirection: "row", alignItems: "center", gap: 8 },
  guidancePill: { position: "absolute", top: 112, alignSelf: "center", minHeight: 34, maxWidth: "82%", paddingHorizontal: 13, borderRadius: 17, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(8,12,9,0.68)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  guidanceReady: { backgroundColor: "rgba(13,107,64,0.95)" }, guidanceText: { color: colors.white, fontFamily: fonts.bold, fontSize: 13 },
  detectorPill: { width: 138, height: 56, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 18, backgroundColor: "rgba(5,10,7,0.8)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.46)", justifyContent: "center" }, detectorHead: { width: "100%", flexDirection: "row", justifyContent: "space-between", gap: 10 }, detectorText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12 }, detectorValue: { color: colors.white, fontFamily: fonts.extraBold, fontSize: 14 }, miniTrack: { width: "100%", height: 6, marginTop: 7, borderRadius: 4, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.35)" }, miniFill: { height: "100%", borderRadius: 4, backgroundColor: colors.orange },
  scanBox: { position: "absolute", top: 168, alignSelf: "center" }, corner: { position: "absolute", width: 43, height: 43, borderColor: colors.white }, topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 16 }, topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 16 }, bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 16 }, bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 16 }, focusCircle: { position: "absolute", left: "50%", top: "50%", marginLeft: -27, marginTop: -27, width: 54, height: 54, borderRadius: 27, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.72)", alignItems: "center", justifyContent: "center" }, focusDot: { width: 21, height: 21, borderRadius: 11, borderWidth: 2, borderColor: colors.green }, box: { position: "absolute", borderWidth: 2, borderColor: colors.orange, borderRadius: 5, backgroundColor: "rgba(233,78,11,0.08)" },
  messagePill: { position: "absolute", left: 22, right: 22, bottom: 147, minHeight: 46, borderRadius: 23, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "rgba(5,10,7,0.82)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" }, liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.muted }, liveDotReady: { backgroundColor: "#53D57B" }, message: { flex: 1, color: colors.white, fontFamily: fonts.bold, fontSize: 13 }, demo: { color: "#FFB18F", fontFamily: fonts.extraBold, fontSize: 10, letterSpacing: 0.7 },
  controls: { position: "absolute", left: 0, right: 0, bottom: 20, height: 116, paddingHorizontal: 33, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(4,7,5,0.45)" }, sideControl: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(8,13,10,0.78)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.42)" }, sideControlActive: { borderColor: colors.orange }, controlLabel: { color: colors.white, fontFamily: fonts.bold, fontSize: 11, marginTop: 2 }, shutterOuter: { width: 88, height: 88, borderRadius: 44, borderWidth: 4, borderColor: colors.white, padding: 6, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.12)" }, shutterInner: { width: "100%", height: "100%", borderRadius: 38, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" }, pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  permission: { flex: 1, padding: 34, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper }, permissionTitle: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 23, textAlign: "center", marginTop: 20 }, permissionCopy: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 10 }, permissionButton: { marginTop: 24, backgroundColor: colors.green, borderRadius: radii.pill, paddingHorizontal: 28, paddingVertical: 15 }, permissionButtonText: { color: colors.white, fontFamily: fonts.bold },
  modalShade: { flex: 1, justifyContent: "flex-end", padding: 12, backgroundColor: "rgba(0,0,0,0.58)" }, helpCard: { borderRadius: 30, padding: 20, paddingBottom: 24, backgroundColor: colors.paper, ...shadow }, helpHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }, helpTitle: { color: colors.ink, fontFamily: fonts.black, fontSize: 27 }, helpRow: { flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 12 }, helpIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.greenSoft }, helpCopyWrap: { flex: 1 }, helpRowTitle: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 16 }, helpRowCopy: { color: colors.muted, fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, marginTop: 3 }, helpNote: { marginTop: 8, padding: 14, borderRadius: 15, backgroundColor: colors.greenSoft, flexDirection: "row", gap: 9 }, helpNoteText: { flex: 1, color: colors.greenDark, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 19 }, helpButton: { height: 56, borderRadius: radii.pill, marginTop: 16, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" }, helpButtonText: { color: colors.white, fontFamily: fonts.extraBold, fontSize: 16 },
  success: { position: "absolute", inset: 0, zIndex: 20, backgroundColor: colors.green, alignItems: "center", justifyContent: "center", padding: 28 }, successCheck: { width: 130, height: 130, borderRadius: 66, alignItems: "center", justifyContent: "center", backgroundColor: colors.white }, successTitle: { color: colors.white, fontFamily: fonts.black, fontSize: 30, textAlign: "center", marginTop: 27 }, successCopy: { color: "#D9EDE0", fontFamily: fonts.medium, fontSize: 14, marginTop: 9 },
});
