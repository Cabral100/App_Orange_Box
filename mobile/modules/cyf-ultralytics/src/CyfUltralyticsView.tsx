import { requireNativeViewManager } from "expo-modules-core";
import { forwardRef, type ComponentType, type RefAttributes } from "react";
import { Platform, type StyleProp, type ViewStyle } from "react-native";

import type { Detection } from "../../../src/types";

export type UltralyticsDetectionPayload = {
  detections: Detection[];
  detectionCount: number;
  topConfidence: number;
  inferenceMs: number;
  fps: number;
  width: number;
  height: number;
  model: string;
};

export type UltralyticsPhoto = {
  uri: string;
  width: number;
  height: number;
  detections: Detection[];
};

export type CyfUltralyticsViewRef = {
  capturePhoto(): Promise<UltralyticsPhoto>;
};

type Props = {
  style?: StyleProp<ViewStyle>;
  modelName: string;
  active: boolean;
  torch: boolean;
  confidenceThreshold?: number;
  onReady?: (event: { nativeEvent: { model: string; runtime: string } }) => void;
  onDetection?: (event: { nativeEvent: UltralyticsDetectionPayload }) => void;
  onError?: (event: { nativeEvent: { code: string; message: string } }) => void;
};

type NativeProps = Props & RefAttributes<CyfUltralyticsViewRef>;

let NativeView: ComponentType<NativeProps> | null = null;
if (Platform.OS === "ios") {
  try {
    NativeView = requireNativeViewManager<NativeProps>("CyfUltralytics");
  } catch {
    NativeView = null;
  }
}

export const isCyfUltralyticsAvailable = Boolean(NativeView);

export const CyfUltralyticsView = forwardRef<CyfUltralyticsViewRef, Props>((props, ref) => {
  if (!NativeView) return null;
  return <NativeView {...props} ref={ref} />;
});
