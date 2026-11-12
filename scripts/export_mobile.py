"""Exporta o checkpoint para um formato móvel; a saída ainda exige validação no aparelho."""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, default=Path("backend/models/best.pt"))
    parser.add_argument("--format", choices=("tflite", "onnx", "coreml"), default="tflite")
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--half", action="store_true")
    args = parser.parse_args()

    model_path = args.model.resolve()
    if not model_path.is_file():
        raise SystemExit(f"Checkpoint não encontrado: {model_path}")

    from ultralytics import YOLO

    model = YOLO(str(model_path), task="detect")
    export_options: dict[str, object] = {
        "format": args.format,
        "imgsz": args.imgsz,
        "half": args.half,
    }
    if args.format == "onnx":
        # O app espera caixas finais [x1, y1, x2, y2, confiança, classe].
        # Incorporar NMS evita implementar a decodificação específica de cada
        # geração YOLO no React Native.
        export_options.update({"nms": True, "simplify": True})
    elif args.format == "coreml":
        if sys.platform == "win32":
            raise SystemExit("A exportação Core ML precisa ser executada no macOS ou Linux.")
        # O SDK UltralyticsYOLO aplica a pós-análise em Swift e aceita a saída
        # NMS-free. Manter FP16 evita recalibrar o modelo com outro dataset.
        export_options.update({"nms": False, "batch": 1, "device": "cpu"})

    exported = model.export(**export_options)
    if args.format == "coreml":
        exported_path = Path(exported).resolve()
        destination = Path("mobile/assets/models/best.mlpackage").resolve()
        if destination.exists():
            shutil.rmtree(destination)
        shutil.copytree(exported_path, destination)
        exported = destination
    print(f"Exportado para: {exported}")
    print("Valide caixas, confiança, latência e consumo no hardware-alvo antes de uso em campo.")


if __name__ == "__main__":
    main()
