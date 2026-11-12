#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VENV_DIR="$ROOT_DIR/.venv-ios"
MODEL_PATH="$ROOT_DIR/backend/models/best.pt"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Este preparo deve ser executado no Mac que possui o Xcode." >&2
  exit 1
fi

if [[ ! -f "$MODEL_PATH" ]]; then
  echo "Modelo não encontrado: $MODEL_PATH" >&2
  exit 1
fi

python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/python" -m pip install --upgrade pip
"$VENV_DIR/bin/python" -m pip install "ultralytics[export-coreml]>=8.4.142"
"$VENV_DIR/bin/python" "$ROOT_DIR/scripts/export_mobile.py" \
  --model "$MODEL_PATH" \
  --format coreml \
  --imgsz 640

cd "$ROOT_DIR/mobile"
npm install
npx expo prebuild --clean --platform ios
npx pod-install

echo
echo "Pronto. Abra mobile/ios/CYF.xcworkspace no Xcode e execute no iPhone físico."
