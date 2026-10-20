import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import type { PhotoAnalysis } from "./types";

const SIZE = 640;

export async function prepareDemo() {
  return true;
}

export async function analyzeDemo(uri: string, width: number, height: number): Promise<PhotoAnalysis> {
  const size = Math.max(1, Math.min(width, height));
  const prepared = await manipulateAsync(
    uri,
    [
      { crop: { originX: Math.max(0, Math.floor((width - size) / 2)), originY: Math.max(0, Math.floor((height - size) / 2)), width: size, height: size } },
      { resize: { width: SIZE, height: SIZE } },
    ],
    { compress: 0.9, format: SaveFormat.JPEG },
  );
  return {
    imageUri: prepared.uri,
    result: {
      status: "detected",
      detections: [{ class_id: 0, class_name: "Acaro", confidence: 0.97, bbox: { x1: 225, y1: 190, x2: 390, y2: 365 } }],
      detection_count: 1,
      confidence_threshold: 0.95,
      inference_ms: 0,
      latency_ms: 0,
      quality: { status: "adequate", warnings: [], metrics: { width: SIZE, height: SIZE, brightness: 0, contrast: 0 } },
      location: null,
    },
  };
}
