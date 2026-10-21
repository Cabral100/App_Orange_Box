"""Exporta o checkpoint para um formato móvel; a saída ainda exige validação no aparelho."""

from __future__ import annotations

import argparse
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, default=Path("backend/models/best.pt"))
    parser.add_argument("--format", choices=("tflite", "onnx"), default="tflite")
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--half", action="store_true")
    args = parser.parse_args()

    model_path = args.model.resolve()
    if not model_path.is_file():
        raise SystemExit(f"Checkpoint não encontrado: {model_path}")

    from ultralytics import YOLO

    model = YOLO(str(model_path), task="detect")
    export_options = {
        "format": args.format,
        "imgsz": args.imgsz,
        "half": args.half,
    }
    if args.format == "onnx":
        # O app espera caixas finais [x1, y1, x2, y2, confiança, classe].
        # Incorporar NMS evita implementar a decodificação específica de cada
        # geração YOLO no React Native.
        export_options.update({"nms": True, "simplify": True})

    exported = model.export(**export_options)
    print(f"Exportado para: {exported}")
    print("Valide caixas, confiança, latência e consumo no hardware-alvo antes de uso em campo.")


if __name__ == "__main__":
    main()
