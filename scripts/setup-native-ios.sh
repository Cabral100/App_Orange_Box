#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="$ROOT_DIR/ios-native/CYF.xcodeproj"
TARGET_MODEL="$ROOT_DIR/ios-native/CYF/Models/best.mlpackage"
LEGACY_MODEL="$ROOT_DIR/mobile/assets/models/best.mlpackage"
CHECKPOINT="$ROOT_DIR/backend/models/best.pt"
VENV="$ROOT_DIR/.venv-ios"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Este preparo precisa ser executado no Mac com Xcode." >&2
  exit 1
fi

command -v xcodebuild >/dev/null || { echo "Xcode/Command Line Tools não encontrados." >&2; exit 1; }

mkdir -p "$(dirname "$TARGET_MODEL")"
if [[ ! -d "$TARGET_MODEL" && -d "$LEGACY_MODEL" ]]; then
  echo "Reaproveitando o best.mlpackage já exportado..."
  ditto "$LEGACY_MODEL" "$TARGET_MODEL"
fi

if [[ ! -d "$TARGET_MODEL" ]]; then
  command -v python3 >/dev/null || { echo "Python 3 é necessário para exportar best.pt." >&2; exit 1; }
  [[ -f "$CHECKPOINT" ]] || { echo "Checkpoint não encontrado: $CHECKPOINT" >&2; exit 1; }
  echo "Exportando best.pt para Core ML..."
  python3 -m venv "$VENV"
  "$VENV/bin/python" -m pip install --upgrade pip
  "$VENV/bin/python" -m pip install "ultralytics[export-coreml]>=8.4.142"
  cd "$ROOT_DIR"
  "$VENV/bin/python" scripts/export_mobile.py --model "$CHECKPOINT" --format coreml --imgsz 640
fi

echo "Resolvendo o pacote Swift da Ultralytics..."
xcodebuild -resolvePackageDependencies -project "$PROJECT" -scheme CYF

echo
echo "Projeto SwiftUI pronto. Nenhum Expo, Node, Metro ou CocoaPods é necessário."
echo "Abrindo ios-native/CYF.xcodeproj..."
open "$PROJECT"
