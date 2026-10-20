import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { toByteArray } from "base64-js";
import jpeg from "jpeg-js";
import * as ort from "onnxruntime-react-native";
import type { Detection, PhotoAnalysis } from "./types";

const INPUT_SIZE = 640;
const LIVE_THRESHOLD = 0.01;
let sessionPromise: Promise<ort.InferenceSession> | null = null;

export async function loadOfflineModel() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const asset = Asset.fromModule(require("../assets/models/best.onnx"));
      await asset.downloadAsync();
      if (!asset.localUri) throw new Error("O modelo offline não foi incluído no aplicativo.");
      return ort.InferenceSession.create(asset.localUri, {
        executionProviders: ["cpu"],
        graphOptimizationLevel: "all",
      });
    })();
  }
  return sessionPromise;
}

async function squareAndResize(uri: string, width: number, height: number) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const size = Math.min(safeWidth, safeHeight);
  const originX = Math.max(0, Math.floor((safeWidth - size) / 2));
  const originY = Math.max(0, Math.floor((safeHeight - size) / 2));
  return manipulateAsync(
    uri,
    [
      { crop: { originX, originY, width: size, height: size } },
      { resize: { width: INPUT_SIZE, height: INPUT_SIZE } },
    ],
    { compress: 0.94, format: SaveFormat.JPEG },
  );
}

async function imageTensor(uri: string) {
  const encoded = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const decoded = jpeg.decode(toByteArray(encoded), { useTArray: true, formatAsRGBA: true });
  if (decoded.width !== INPUT_SIZE || decoded.height !== INPUT_SIZE) {
    throw new Error("Não foi possível preparar a foto em 640×640.");
  }
  const pixels = decoded.data;
  const plane = INPUT_SIZE * INPUT_SIZE;
  const data = new Float32Array(plane * 3);
  for (let index = 0; index < plane; index += 1) {
    const source = index * 4;
    data[index] = (pixels[source] ?? 0) / 255;
    data[plane + index] = (pixels[source + 1] ?? 0) / 255;
    data[plane * 2 + index] = (pixels[source + 2] ?? 0) / 255;
  }
  return new ort.Tensor("float32", data, [1, 3, INPUT_SIZE, INPUT_SIZE]);
}

function detectionsFromOutput(output: ort.Tensor): Detection[] {
  const values = output.data as Float32Array;
  const rows = output.dims.at(-2) || 0;
  const columns = output.dims.at(-1) || 0;
  if (columns !== 6) throw new Error(`Saída offline inesperada: ${output.dims.join("×")}.`);
  const detections: Detection[] = [];
  for (let row = 0; row < rows; row += 1) {
    const offset = row * columns;
    const confidence = Number(values[offset + 4] ?? 0);
    if (confidence < LIVE_THRESHOLD) continue;
    const x1 = Math.max(0, Math.min(INPUT_SIZE, Number(values[offset] ?? 0)));
    const y1 = Math.max(0, Math.min(INPUT_SIZE, Number(values[offset + 1] ?? 0)));
    const x2 = Math.max(0, Math.min(INPUT_SIZE, Number(values[offset + 2] ?? 0)));
    const y2 = Math.max(0, Math.min(INPUT_SIZE, Number(values[offset + 3] ?? 0)));
    if (x2 <= x1 || y2 <= y1) continue;
    detections.push({
      class_id: Math.max(0, Math.round(Number(values[offset + 5] ?? 0))),
      class_name: "Acaro",
      confidence,
      bbox: { x1, y1, x2, y2 },
    });
  }
  return detections.sort((first, second) => second.confidence - first.confidence);
}

export async function analyzeOffline(uri: string, width: number, height: number): Promise<PhotoAnalysis> {
  const startedAt = Date.now();
  const [session, prepared] = await Promise.all([loadOfflineModel(), squareAndResize(uri, width, height)]);
  const tensor = await imageTensor(prepared.uri);
  const inferenceStartedAt = Date.now();
  const feeds: Record<string, ort.Tensor> = { [session.inputNames[0] || "images"]: tensor };
  const outputs = await session.run(feeds);
  const output = outputs[session.outputNames[0] || "output0"];
  if (!output) throw new Error("O modelo offline não retornou resultados.");
  const detections = detectionsFromOutput(output);
  return {
    imageUri: prepared.uri,
    result: {
      status: detections.length ? "detected" : "no_detection",
      detections,
      detection_count: detections.length,
      confidence_threshold: LIVE_THRESHOLD,
      inference_ms: Date.now() - inferenceStartedAt,
      latency_ms: Date.now() - startedAt,
      quality: {
        status: "adequate",
        warnings: [],
        metrics: { width: INPUT_SIZE, height: INPUT_SIZE, brightness: 0, contrast: 0 },
      },
      location: null,
    },
  };
}
